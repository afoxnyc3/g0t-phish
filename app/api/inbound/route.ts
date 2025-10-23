// app/api/inbound/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ResendInboundWebhook, EmailInput } from '@/types/email';
import { analyzeEmail } from '@/lib/claude-analyzer';
import { detectEmailLoop } from '@/lib/email-loop-prevention';
import { checkRateLimit, checkDeduplication } from '@/lib/rate-limiter';
import { sendAnalysisEmail } from '@/lib/resend-sender';
import { logger } from '@/utils/logger';

// Validate webhook payload
const resendWebhookSchema = z.object({
  type: z.literal('email.received'),
  created_at: z.string(),
  data: z.object({
    email_id: z.string(),
    from: z.string().email(),
    to: z.array(z.string()),
    subject: z.string(),
    text: z.string().optional(),
    html: z.string().optional(),
    headers: z.record(z.string()),
    reply_to: z.string().optional(),
  }),
});

export async function POST(req: NextRequest) {
  const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  try {
    logger.info('Webhook received', { requestId });

    // Parse and validate webhook payload
    const body = await req.json();
    const validationResult = resendWebhookSchema.safeParse(body);

    if (!validationResult.success) {
      logger.error('Invalid webhook payload', {
        requestId,
        errors: validationResult.error.errors,
      });
      return NextResponse.json(
        { error: 'Invalid webhook payload' },
        { status: 400 }
      );
    }

    const webhook: ResendInboundWebhook = validationResult.data;
    const email = parseEmailFromWebhook(webhook);

    logger.info('Email parsed', {
      requestId,
      from: email.from,
      subject: email.subject,
    });

    // LAYER 1: Email loop detection
    const loopCheck = detectEmailLoop(email);
    if (loopCheck.isLoop) {
      logger.warn('Email loop detected, ignoring', {
        requestId,
        reason: loopCheck.reason,
      });
      return NextResponse.json({
        success: true,
        ignored: true,
        reason: loopCheck.reason,
      });
    }

    // LAYER 2: Rate limiting
    const rateLimitCheck = await checkRateLimit(email.from);
    if (!rateLimitCheck.allowed) {
      logger.warn('Rate limit exceeded', {
        requestId,
        reason: rateLimitCheck.reason,
      });
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          reason: rateLimitCheck.reason,
          limits: rateLimitCheck.limits,
        },
        { status: 429 }
      );
    }

    // LAYER 3: Deduplication
    const dedupeCheck = await checkDeduplication(email.subject, email.body);
    if (!dedupeCheck.allowed) {
      logger.info('Duplicate email detected, ignoring', {
        requestId,
        reason: dedupeCheck.reason,
      });
      return NextResponse.json({
        success: true,
        ignored: true,
        reason: dedupeCheck.reason,
      });
    }

    // All checks passed - analyze with Claude
    const analysis = await analyzeEmail(email);

    logger.info('Analysis completed', {
      requestId,
      verdict: analysis.verdict,
      confidence: analysis.confidence,
      latency: analysis.metadata.latency,
    });

    // Send analysis email to user
    const emailResult = await sendAnalysisEmail({
      to: email.from,
      subject: `Re: ${email.subject}`,
      analysis,
    });

    if (!emailResult.success) {
      logger.error('Failed to send analysis email', {
        requestId,
        error: emailResult.error,
      });
      return NextResponse.json(
        { error: 'Failed to send analysis email', details: emailResult.error },
        { status: 500 }
      );
    }

    logger.info('Processing completed successfully', {
      requestId,
      verdict: analysis.verdict,
      emailId: emailResult.emailId,
    });

    return NextResponse.json({
      success: true,
      requestId,
      verdict: analysis.verdict,
      confidence: analysis.confidence,
      emailId: emailResult.emailId,
    });

  } catch (error) {
    logger.error('Webhook processing failed', {
      requestId,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      { error: 'Internal server error', requestId },
      { status: 500 }
    );
  }
}

/**
 * Parse Resend webhook into internal EmailInput format
 */
function parseEmailFromWebhook(webhook: ResendInboundWebhook): EmailInput {
  const { data } = webhook;

  return {
    from: data.from,
    to: data.to[0], // Use first recipient
    subject: data.subject,
    body: data.text || data.html || '',
    headers: data.headers,
    receivedAt: new Date(webhook.created_at),
  };
}

// Vercel timeout configuration
export const config = {
  maxDuration: 10, // 10 seconds (Vercel Hobby tier limit)
};
