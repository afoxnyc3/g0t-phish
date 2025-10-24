// lib/agent-analyzer.ts
import Anthropic from '@anthropic-ai/sdk';
import type { MessageParam, Tool, ToolUseBlock, TextBlock } from '@anthropic-ai/sdk/resources/messages';
import { EmailInput, EmailAnalysis, ToolCall, ToolResult } from '@/types/email';
import { logger } from '@/utils/logger';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

// Maximum tool calls to prevent timeout (10s Vercel limit)
const MAX_TOOL_CALLS = 5;
const MAX_ANALYSIS_TIME_MS = 9000; // Leave 1s buffer for response

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

    // Tool execution loop
    while (iterationCount < MAX_TOOL_CALLS) {
      // Check if we're approaching timeout
      if (Date.now() - startTime > MAX_ANALYSIS_TIME_MS) {
        logger.warn('Approaching timeout, ending tool loop early', {
          iterations: iterationCount,
          elapsed: Date.now() - startTime,
        });
        break;
      }

      // Call Claude with tool definitions
      const response = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2048,
        temperature: 0,
        system: SYSTEM_PROMPT,
        tools: TOOLS,
        messages,
      });

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

    // If we exit loop without returning, Claude may be stuck in tool loop
    // Fall back to parsing the last response
    logger.warn('Exited tool loop without final response, falling back', {
      iterations: iterationCount,
    });

    // Fallback: use simple analyzer
    return fallbackToSimpleAnalysis(email, startTime);

  } catch (error) {
    logger.error('Agentic analysis failed, falling back to simple analysis', {
      from: email.from,
      error: error instanceof Error ? error.message : 'Unknown error',
      toolCalls: toolCalls.length,
    });

    // Graceful degradation: fall back to simple Claude analysis
    return fallbackToSimpleAnalysis(email, startTime);
  }
}

/**
 * Execute a tool (stub implementations for Issue #1)
 * Real implementations will come in Issues #2 and #3
 */
async function executeTool(
  name: string,
  input: Record<string, any>,
  email: EmailInput
): Promise<ToolResult> {
  // For Issue #1, return stub responses
  // Real implementations coming in Issue #2 (local tools) and Issue #3 (threat intel)

  switch (name) {
    case 'extract_urls':
      return {
        success: true,
        data: { urls: [] },
        source: 'local',
      };

    case 'check_authentication':
      return {
        success: true,
        data: {
          spf: 'none',
          dkim: 'none',
          dmarc: 'none',
        },
        source: 'local',
      };

    case 'analyze_sender':
      return {
        success: true,
        data: {
          domain: email.from.split('@')[1] || 'unknown',
          is_suspicious: false,
          spoofing_indicators: [],
        },
        source: 'local',
      };

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
