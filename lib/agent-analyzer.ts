// lib/agent-analyzer.ts
import Anthropic from '@anthropic-ai/sdk';
import type { MessageParam, Tool, ToolUseBlock, TextBlock } from '@anthropic-ai/sdk/resources/messages';
import { EmailInput, EmailAnalysis, ToolCall, ToolResult } from '@/types/email';
import { logger } from '@/utils/logger';
import { extractUrls, checkAuthentication, analyzeSender } from './tools/local-tools';
import { checkUrlReputation, checkIpReputation } from './tools/threat-intel-tools';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

// Maximum tool calls to prevent timeout (10s Vercel limit)
const MAX_TOOL_CALLS = 3; // Reduced from 5 to prevent timeout
const MAX_TOOL_LOOP_TIME_MS = 5000; // Reduced from 7000 - Reserve 3-4s for final Claude response
const MAX_ANALYSIS_TIME_MS = 8000; // Reduced from 9000 - Overall budget (leave 2s for processing)
const MIN_FALLBACK_TIME_MS = 2500; // Reduced from 3000 - Minimum time needed for fallback analysis

/**
 * System prompt for agentic analysis with tool use (v1.1)
 */
const SYSTEM_PROMPT = `You are an expert email security analyst with access to analysis tools. Your job is to intelligently decide which tools to use to thoroughly analyze emails for phishing threats.

**Available Tools**:
1. **extract_urls**: Extract and analyze URLs from email body
2. **check_authentication**: Parse SPF, DKIM, DMARC headers
3. **analyze_sender**: Analyze sender domain for spoofing patterns
4. **check_url_reputation** (optional): Check URL against VirusTotal database
5. **check_ip_reputation** (optional): Check sender IP against AbuseIPDB

**When to Use Tools**:
- Use local tools (extract_urls, check_authentication, analyze_sender) when you need specific data
- Use external tools (check_url_reputation, check_ip_reputation) ONLY when you have concrete suspicions
- You can call multiple tools, but be efficient - only call what you need

**Analysis Guidelines**:
- **Safe (0-30%)**: No threats detected, authentication passes, sender is legitimate
- **Suspicious (31-69%)**: Minor red flags, unverified sender, unusual patterns (requires user caution)
- **Phishing (70-100%)**: Multiple threats, failed authentication, clear malicious intent

**After gathering information with tools, return your analysis in this exact JSON structure (no markdown)**:
{
  "verdict": "safe" | "suspicious" | "phishing",
  "confidence": 0-100,
  "threats": [
    {
      "type": "spoofing" | "malicious_link" | "urgency_manipulation" | "brand_impersonation",
      "severity": "low" | "medium" | "high" | "critical",
      "description": "Human-readable explanation of the threat",
      "evidence": "Specific evidence from the email or tool results",
      "source": "claude" | "virustotal" | "abuseipdb"
    }
  ],
  "authentication": {
    "spf": "pass" | "fail" | "neutral" | "none",
    "dkim": "pass" | "fail" | "neutral" | "none",
    "dmarc": "pass" | "fail" | "neutral" | "none"
  },
  "summary": "2-3 sentence overall assessment for the user",
  "reasoning": ["Step 1: analyzed headers", "Step 2: checked authentication", ...]
}`;

/**
 * Tool definitions for Claude
 */
const TOOLS: Tool[] = [
  {
    name: 'extract_urls',
    description: 'Extract URLs from email body and HTML content. Use this when you need to analyze links in the email.',
    input_schema: {
      type: 'object',
      properties: {
        email_body: {
          type: 'string',
          description: 'The email body text to extract URLs from',
        },
      },
      required: ['email_body'],
    },
  },
  {
    name: 'check_authentication',
    description: 'Parse email authentication headers (SPF, DKIM, DMARC). Use this to verify sender authentication status.',
    input_schema: {
      type: 'object',
      properties: {
        headers: {
          type: 'object',
          description: 'Email headers object',
        },
      },
      required: ['headers'],
    },
  },
  {
    name: 'analyze_sender',
    description: 'Analyze sender email address and domain for spoofing patterns. Use this when sender looks suspicious.',
    input_schema: {
      type: 'object',
      properties: {
        from: {
          type: 'string',
          description: 'Sender email address',
        },
        display_name: {
          type: 'string',
          description: 'Sender display name (optional)',
        },
      },
      required: ['from'],
    },
  },
  {
    name: 'check_url_reputation',
    description: 'Check URL reputation using VirusTotal API. Use this ONLY when you suspect a URL may be malicious (e.g., from suspicious domains, shortened links, or typosquatting). This tool makes an external API call and should be used sparingly.',
    input_schema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'The URL to check (must be a valid http/https URL)',
        },
      },
      required: ['url'],
    },
  },
  {
    name: 'check_ip_reputation',
    description: 'Check IP address reputation using AbuseIPDB. Use this ONLY when you suspect the sender IP may be from a known malicious source (e.g., failed authentication, suspicious sender patterns). This tool makes an external API call and should be used sparingly.',
    input_schema: {
      type: 'object',
      properties: {
        ip: {
          type: 'string',
          description: 'The IP address to check (IPv4 format)',
        },
      },
      required: ['ip'],
    },
  },
];

/**
 * Analyze email with agentic tool use (v1.1)
 */
export async function analyzeWithTools(email: EmailInput): Promise<EmailAnalysis> {
  const startTime = Date.now();
  const toolCalls: ToolCall[] = [];
  let totalToolTime = 0;

  try {
    logger.info('Starting agentic analysis with tool use', {
      from: email.from,
      subject: email.subject,
    });

    // Initialize conversation with formatted email
    const messages: MessageParam[] = [
      {
        role: 'user',
        content: formatEmailForAnalysis(email),
      },
    ];

    let iterationCount = 0;

    // Tool execution loop with timeout handling
    try {
      while (iterationCount < MAX_TOOL_CALLS) {
        // Check if we're approaching timeout (reserve time for final Claude response)
        const elapsed = Date.now() - startTime;
        if (elapsed > MAX_TOOL_LOOP_TIME_MS) {
          logger.warn('Approaching timeout, ending tool loop early', {
            iterations: iterationCount,
            elapsed,
            budget: MAX_TOOL_LOOP_TIME_MS,
          });
          break;
        }

        // Call Claude with tool definitions (with 7s timeout per call)
        const response = await Promise.race([
          anthropic.messages.create({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 512, // Reduced from 1024 for faster response
            temperature: 0,
            system: SYSTEM_PROMPT,
            tools: TOOLS,
            messages,
          }),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Claude API timeout')), 7000)
          ),
        ]) as Anthropic.Messages.Message;

      // Check stop reason
      if (response.stop_reason === 'end_turn' || response.stop_reason === 'max_tokens') {
        // Claude finished without calling tools, parse final response
        const analysis = parseFinalResponse(response.content, toolCalls, {
          model: response.model,
          totalLatency: Date.now() - startTime,
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
          toolExecutionTime: totalToolTime,
        });

        logger.info('Agentic analysis completed (no tools needed)', {
          from: email.from,
          verdict: analysis.verdict,
          confidence: analysis.confidence,
          toolCalls: toolCalls.length,
          latency: Date.now() - startTime,
        });

        return analysis;
      }

      if (response.stop_reason === 'tool_use') {
        // Claude wants to use tools
        const toolUseBlocks = response.content.filter(
          (block): block is ToolUseBlock => block.type === 'tool_use'
        );

        if (toolUseBlocks.length === 0) {
          // No tool use blocks found, treat as final response
          const analysis = parseFinalResponse(response.content, toolCalls, {
            model: response.model,
            totalLatency: Date.now() - startTime,
            inputTokens: response.usage.input_tokens,
            outputTokens: response.usage.output_tokens,
            toolExecutionTime: totalToolTime,
          });
          return analysis;
        }

        // Execute tools
        const toolResults: any[] = [];

        for (const toolUse of toolUseBlocks) {
          const toolStartTime = Date.now();

          logger.info('Executing tool', {
            name: toolUse.name,
            id: toolUse.id,
          });

          try {
            const toolInput = toolUse.input as Record<string, any>;
            const result = await executeTool(toolUse.name, toolInput, email);
            const toolDuration = Date.now() - toolStartTime;
            totalToolTime += toolDuration;

            const toolCall: ToolCall = {
              id: toolUse.id,
              name: toolUse.name as any,
              input: toolInput,
              result,
              startTime: toolStartTime,
              endTime: Date.now(),
              duration: toolDuration,
            };

            toolCalls.push(toolCall);

            // Add tool result for Claude
            toolResults.push({
              type: 'tool_result',
              tool_use_id: toolUse.id,
              content: JSON.stringify(result.data),
            });

            logger.info('Tool executed successfully', {
              name: toolUse.name,
              duration: toolDuration,
              cached: result.cached,
            });
          } catch (toolError) {
            logger.error('Tool execution failed', {
              name: toolUse.name,
              error: toolError instanceof Error ? toolError.message : 'Unknown error',
            });

            // Return error to Claude
            toolResults.push({
              type: 'tool_result',
              tool_use_id: toolUse.id,
              content: JSON.stringify({
                error: toolError instanceof Error ? toolError.message : 'Tool execution failed',
              }),
              is_error: true,
            });
          }
        }

        // Add assistant's tool use and user's tool results to conversation
        messages.push({
          role: 'assistant',
          content: response.content,
        });

        messages.push({
          role: 'user',
          content: toolResults,
        });

        iterationCount++;
        continue; // Continue the loop for Claude to process tool results
      }

        // Unexpected stop reason
        logger.warn('Unexpected stop reason from Claude', {
          stop_reason: response.stop_reason,
        });
        break;
      }

      // If we exit loop without returning, return conservative analysis
      // (likely timeout or max iterations reached)
      logger.warn('Exited tool loop without final response, returning conservative analysis', {
        iterations: iterationCount,
        toolCalls: toolCalls.length,
        elapsed: Date.now() - startTime,
      });

      return buildConservativeAnalysis(email, toolCalls, {
        model: 'claude-haiku-4-5-20251001',
        totalLatency: Date.now() - startTime,
        inputTokens: 0,
        outputTokens: 0,
        toolExecutionTime: totalToolTime,
      });

    } catch (toolLoopError) {
      // Claude API timeout during tool loop - return conservative analysis immediately
      logger.error('Claude API timeout in tool loop, returning conservative analysis', {
        error: toolLoopError instanceof Error ? toolLoopError.message : 'Unknown error',
        toolCalls: toolCalls.length,
        elapsed: Date.now() - startTime,
      });

      return buildConservativeAnalysis(email, toolCalls, {
        model: 'claude-haiku-4-5-20251001',
        totalLatency: Date.now() - startTime,
        inputTokens: 0,
        outputTokens: 0,
        toolExecutionTime: totalToolTime,
      });
    }

  } catch (error) {
    const elapsed = Date.now() - startTime;

    logger.error('Agentic analysis failed', {
      from: email.from,
      error: error instanceof Error ? error.message : 'Unknown error',
      toolCalls: toolCalls.length,
      elapsed,
    });

    // Check if we have enough time for fallback (needs 3s minimum for Claude API call)
    if (elapsed + MIN_FALLBACK_TIME_MS > MAX_ANALYSIS_TIME_MS) {
      // Not enough time for fallback, return conservative analysis
      logger.warn('Insufficient time for fallback, returning conservative analysis', {
        elapsed,
        remaining: MAX_ANALYSIS_TIME_MS - elapsed,
        required: MIN_FALLBACK_TIME_MS,
      });

      return buildConservativeAnalysis(email, toolCalls, {
        model: 'claude-haiku-4-5-20251001',
        totalLatency: elapsed,
        inputTokens: 0,
        outputTokens: 0,
        toolExecutionTime: totalToolTime,
      });
    }

    // Enough time remaining, use fallback to v1.0 simple analysis
    logger.info('Sufficient time remaining, using fallback simple analysis');
    return fallbackToSimpleAnalysis(email, startTime);
  }
}

/**
 * Execute a tool
 * - Local tools (Issue #2): extract_urls, check_authentication, analyze_sender
 * - Threat intel tools (Issue #3): check_url_reputation, check_ip_reputation
 */
async function executeTool(
  name: string,
  input: Record<string, any>,
  email: EmailInput
): Promise<ToolResult> {
  switch (name) {
    case 'extract_urls': {
      const result = extractUrls({
        email_body: input.email_body || email.body,
        email_html: input.email_html,
      });
      return {
        ...result,
        source: 'local',
      };
    }

    case 'check_authentication': {
      const result = checkAuthentication({
        headers: input.headers || email.headers,
      });
      return {
        ...result,
        source: 'local',
      };
    }

    case 'analyze_sender': {
      const result = analyzeSender({
        from: input.from || email.from,
        display_name: input.display_name,
        subject: input.subject || email.subject,
      });
      return {
        ...result,
        source: 'local',
      };
    }

    // Threat intel tools (Issue #3)
    case 'check_url_reputation': {
      const result = await checkUrlReputation({
        url: input.url,
      });
      return result;
    }

    case 'check_ip_reputation': {
      const result = await checkIpReputation({
        ip: input.ip,
      });
      return result;
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

/**
 * Parse Claude's final response (with JSON)
 */
function parseFinalResponse(
  content: Array<TextBlock | ToolUseBlock>,
  toolCalls: ToolCall[],
  metadata: {
    model: string;
    totalLatency: number;
    inputTokens: number;
    outputTokens: number;
    toolExecutionTime: number;
  }
): EmailAnalysis {
  // Find text block with JSON
  const textBlock = content.find((block): block is TextBlock => block.type === 'text');

  if (!textBlock) {
    throw new Error('No text response from Claude');
  }

  // Parse JSON (strip markdown if present)
  let jsonText = textBlock.text.trim();
  if (jsonText.startsWith('```json')) {
    jsonText = jsonText.replace(/^```json\s*\n/, '').replace(/\n```\s*$/, '');
  } else if (jsonText.startsWith('```')) {
    jsonText = jsonText.replace(/^```\s*\n/, '').replace(/\n```\s*$/, '');
  }

  const parsed = JSON.parse(jsonText);

  return {
    ...parsed,
    toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    metadata: {
      model: metadata.model,
      latency: metadata.totalLatency,
      inputTokens: metadata.inputTokens,
      outputTokens: metadata.outputTokens,
      toolExecutionTime: metadata.toolExecutionTime,
    },
  };
}

/**
 * Build conservative analysis when Claude doesn't return final verdict
 * (e.g., timeout, loop exit, unexpected stop reason)
 *
 * Returns "suspicious" verdict with low confidence to signal incomplete analysis.
 * This is safer than returning "safe" when we couldn't complete the analysis.
 */
function buildConservativeAnalysis(
  email: EmailInput,
  toolCalls: ToolCall[],
  metadata: {
    model: string;
    totalLatency: number;
    inputTokens: number;
    outputTokens: number;
    toolExecutionTime: number;
  }
): EmailAnalysis {
  logger.info('Building conservative analysis due to incomplete agent flow', {
    from: email.from,
    toolCalls: toolCalls.length,
    elapsed: metadata.totalLatency,
  });

  return {
    verdict: 'suspicious',
    confidence: 50, // Low confidence due to incomplete analysis
    threats: [],
    authentication: {
      spf: 'none',
      dkim: 'none',
      dmarc: 'none',
    },
    summary: 'Analysis incomplete due to timeout. Email flagged as suspicious for manual review. Please verify sender authenticity and avoid clicking links until you can confirm this email is legitimate.',
    reasoning: [
      'Analysis started but did not complete within time limit',
      `Executed ${toolCalls.length} tool${toolCalls.length === 1 ? '' : 's'} before timeout`,
      'Returning conservative "suspicious" verdict for safety',
      'Recommend manual review of this email',
    ],
    toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    metadata: {
      model: metadata.model,
      latency: metadata.totalLatency,
      inputTokens: metadata.inputTokens,
      outputTokens: metadata.outputTokens,
      toolExecutionTime: metadata.toolExecutionTime,
    },
  };
}

/**
 * Fallback to simple Claude analysis (no tools) if agentic flow fails
 */
async function fallbackToSimpleAnalysis(email: EmailInput, startTime: number): Promise<EmailAnalysis> {
  logger.info('Using fallback simple analysis', { from: email.from });

  // Import and use the v1.0 analyzer
  const { analyzeEmail } = await import('./claude-analyzer');
  return analyzeEmail(email);
}

/**
 * Format email for Claude analysis
 */
function formatEmailForAnalysis(email: EmailInput): string {
  const authHeaders = {
    spf: email.headers['received-spf'] || email.headers['spf'] || 'none',
    dkim: email.headers['dkim-signature'] || email.headers['dkim'] || 'none',
    dmarc: email.headers['dmarc'] || 'none',
  };

  return `Analyze this email for phishing threats:

**From**: ${email.from}
**To**: ${email.to}
**Subject**: ${email.subject}
**Received**: ${email.receivedAt.toISOString()}

**Authentication Headers**:
- SPF: ${authHeaders.spf}
- DKIM: ${authHeaders.dkim}
- DMARC: ${authHeaders.dmarc}

**Email Body**:
${email.body}

---

Use the available tools to gather information, then provide your detailed security analysis.`;
}
