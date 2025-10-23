// lib/resend-sender.ts
import { Resend } from 'resend';
import { EmailAnalysis } from '@/types/email';
import { generateHTMLReport } from './html-generator';
import { logger } from '@/utils/logger';

const resend = new Resend(process.env.RESEND_API_KEY!);
const AGENT_EMAIL = process.env.RESEND_AGENT_EMAIL!;

/**
 * Send phishing analysis report to user
 */
export async function sendAnalysisEmail(params: {
  to: string;
  subject: string;
  analysis: EmailAnalysis;
}): Promise<{ success: boolean; emailId?: string; error?: string }> {
  try {
    logger.info('Sending analysis email', { to: params.to });

    const html = generateHTMLReport(params.analysis, {
      from: params.to,
      subject: params.subject.replace(/^Re:\s*/i, ''),
    });

    const { data, error } = await resend.emails.send({
      from: AGENT_EMAIL,
      to: params.to,
      subject: params.subject,
      html,
      headers: {
        // Add headers to prevent email loops
        'Auto-Submitted': 'auto-replied',
        'X-Auto-Response-Suppress': 'OOF, AutoReply',
        'Precedence': 'auto_reply',
      },
    });

    if (error) {
      logger.error('Failed to send email', {
        to: params.to,
        error: error.message,
      });
      return { success: false, error: error.message };
    }

    logger.info('Email sent successfully', {
      to: params.to,
      emailId: data?.id,
    });

    return { success: true, emailId: data?.id };
  } catch (error) {
    logger.error('Email sending failed', {
      to: params.to,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
