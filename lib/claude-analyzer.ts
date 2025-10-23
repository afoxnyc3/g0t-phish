// lib/claude-analyzer.ts
import Anthropic from '@anthropic-ai/sdk';
import { EmailInput, EmailAnalysis } from '@/types/email';
import { logger } from '@/utils/logger';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

const SYSTEM_PROMPT = `You are an expert email security analyst specializing in phishing detection. Analyze emails for security threats including:

1. **Email Authentication**: Verify SPF, DKIM, DMARC status from headers
2. **Sender Spoofing**: Check for domain spoofing, display name tricks, homograph attacks
3. **Malicious Links**: Identify suspicious URLs, typosquatting domains, URL shorteners
4. **Social Engineering**: Detect urgency manipulation, impersonation, credential harvesting attempts
5. **Brand Impersonation**: Check for legitimate brand misuse, logo copying, typosquatting

**Analysis Guidelines**:
- **Safe**: No threats detected, authentication passes, sender is legitimate
- **Suspicious**: Minor red flags, unverified sender, unusual patterns (requires user caution)
- **Phishing**: Multiple threats, failed authentication, clear malicious intent

Return your analysis in this exact JSON structure (no markdown, just raw JSON):
{
  "verdict": "safe" | "suspicious" | "phishing",
  "confidence": 0-100,
  "threats": [
    {
      "type": "spoofing" | "malicious_link" | "urgency_manipulation" | "brand_impersonation",
      "severity": "low" | "medium" | "high" | "critical",
      "description": "Human-readable explanation of the threat",
      "evidence": "Specific evidence from the email (quote exact text)"
    }
  ],
  "authentication": {
    "spf": "pass" | "fail" | "neutral" | "none",
    "dkim": "pass" | "fail" | "neutral" | "none",
    "dmarc": "pass" | "fail" | "neutral" | "none"
  },
  "summary": "2-3 sentence overall assessment for the user"
}`;

export async function analyzeEmail(email: EmailInput): Promise<EmailAnalysis> {
  const startTime = Date.now();

  try {
    logger.info('Starting Claude analysis', {
      from: email.from,
      subject: email.subject,
    });

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      temperature: 0, // Deterministic output
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: formatEmailForAnalysis(email),
        },
      ],
    });

    const latency = Date.now() - startTime;

    // Extract text content
    const textContent = message.content[0];
    if (textContent.type !== 'text') {
      throw new Error('Unexpected response format from Claude');
    }

    // Parse JSON response
    let analysis: Omit<EmailAnalysis, 'metadata'>;
    try {
      analysis = JSON.parse(textContent.text);
    } catch (parseError) {
      logger.error('Failed to parse Claude response', {
        response: textContent.text,
        error: parseError instanceof Error ? parseError.message : 'Unknown error',
      });
      throw new Error('Invalid JSON response from Claude');
    }

    logger.info('Claude analysis completed', {
      from: email.from,
      verdict: analysis.verdict,
      confidence: analysis.confidence,
      latency,
    });

    return {
      ...analysis,
      metadata: {
        model: message.model,
        latency,
        inputTokens: message.usage.input_tokens,
        outputTokens: message.usage.output_tokens,
      },
    };
  } catch (error) {
    logger.error('Claude analysis failed', {
      from: email.from,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw new Error(`Email analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Format email for Claude analysis
 */
function formatEmailForAnalysis(email: EmailInput): string {
  // Extract authentication headers
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

**All Headers**:
${Object.entries(email.headers)
  .map(([key, value]) => `${key}: ${value}`)
  .join('\n')}

**Email Body**:
${email.body}

---

Provide your detailed security analysis in JSON format.`;
}
