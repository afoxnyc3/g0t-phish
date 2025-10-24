// app/api/inbound/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { SendGridInboundWebhook, EmailInput } from '@/types/email';
import { analyzeEmail } from '@/lib/claude-analyzer';
import { detectEmailLoop } from '@/lib/email-loop-prevention';
import { checkRateLimit, checkDeduplication } from '@/lib/rate-limiter';
import { sendAnalysisEmail } from '@/lib/resend-sender';
import { logger } from '@/utils/logger';

export async function POST(req: NextRequest) {
  const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  try {
    logger.info('Webhook received', { requestId });

    // Parse SendGrid multipart/form-data webhook payload
    const formData = await req.formData();

    // Validate required fields
    const from = formData.get('from') as string;
    const to = formData.get('to') as string;
    const subject = formData.get('subject') as string;

    if (!from || !to || !subject) {
      logger.error('Missing required fields in webhook', {
        requestId,
        hasFrom: !!from,
        hasTo: !!to,
        hasSubject: !!subject,
      });
      return NextResponse.json(
        { error: 'Invalid webhook payload: missing required fields (from, to, subject)' },
        { status: 400 }
      );
    }

    const email = parseEmailFromSendGrid(formData);

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
 * Parse SendGrid Inbound Parse webhook (multipart/form-data) into internal EmailInput format
 * Reference: https://www.twilio.com/docs/sendgrid/for-developers/parsing-email/setting-up-the-inbound-parse-webhook
 */
function parseEmailFromSendGrid(formData: FormData): EmailInput {
  const from = formData.get('from') as string;
  const to = formData.get('to') as string;
  const subject = formData.get('subject') as string;
  const text = formData.get('text') as string | null;
  const html = formData.get('html') as string | null;
  const rawHeaders = formData.get('headers') as string | null;
  const envelopeJson = formData.get('envelope') as string | null;
  const dkim = formData.get('dkim') as string | null;
  const spf = formData.get('SPF') as string | null;

  // Parse headers from raw string into key-value pairs
  const headers: Record<string, string> = {};
  if (rawHeaders) {
    // SendGrid sends headers as raw email header format
    // Example: "From: user@example.com\nTo: alert@inbound.g0tphish.com\n..."
    const headerLines = rawHeaders.split('\n');
    for (const line of headerLines) {
      const colonIndex = line.indexOf(':');
      if (colonIndex > 0) {
        const key = line.substring(0, colonIndex).trim().toLowerCase();
        const value = line.substring(colonIndex + 1).trim();
        headers[key] = value;
      }
    }
  }

  // Add authentication results to headers
  if (dkim) headers['dkim'] = dkim;
  if (spf) headers['received-spf'] = spf;

  // Parse envelope for additional metadata
  if (envelopeJson) {
    try {
      const envelope = JSON.parse(envelopeJson);
      headers['x-envelope-from'] = envelope.from || '';
      headers['x-envelope-to'] = envelope.to?.[0] || '';
    } catch (error) {
      logger.warn('Failed to parse envelope JSON', { envelope: envelopeJson });
    }
  }

  return {
    from,
    to,
    subject,
    body: text || html || '',
    headers,
    receivedAt: new Date(),
  };
}

// Vercel timeout configuration (Next.js 14 App Router format)
export const maxDuration = 10; // 10 seconds (Vercel Hobby tier limit)
