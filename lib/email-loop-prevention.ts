// lib/email-loop-prevention.ts
import { EmailInput, EmailLoopCheck } from '@/types/email';
import { logger } from '@/utils/logger';

const AGENT_EMAIL = process.env.RESEND_AGENT_EMAIL!;
const AGENT_DOMAIN = AGENT_EMAIL?.split('@')[1];

/**
 * LAYER 1: Email loop detection
 * Checks if email is from our own agent to prevent infinite loops
 */
export function detectEmailLoop(email: EmailInput): EmailLoopCheck {
  const checks = {
    selfReply: false,
    sameDomain: false,
    loopHeader: false,
  };

  const fromAddress = extractEmailAddress(email.from);
  const fromDomain = fromAddress.split('@')[1];

  // Check 1: Exact match (agent replying to itself)
  if (fromAddress.toLowerCase() === AGENT_EMAIL?.toLowerCase()) {
    checks.selfReply = true;
    logger.warn('Email loop detected: self-reply', {
      from: fromAddress,
      agentEmail: AGENT_EMAIL,
    });
    return {
      isLoop: true,
      reason: 'Email from agent itself (self-reply)',
      checks,
    };
  }

  // Check 2: Same domain (multiple agent addresses)
  if (AGENT_DOMAIN && fromDomain === AGENT_DOMAIN) {
    checks.sameDomain = true;
    logger.warn('Email loop detected: same domain', {
      from: fromAddress,
      agentDomain: AGENT_DOMAIN,
    });
    return {
      isLoop: true,
      reason: 'Email from same domain as agent',
      checks,
    };
  }

  // Check 3: Loop detection header (X-Auto-Response-Suppress, Auto-Submitted)
  const autoSubmitted = email.headers['auto-submitted'];
  const autoResponseSuppress = email.headers['x-auto-response-suppress'];

  if (autoSubmitted && autoSubmitted !== 'no') {
    checks.loopHeader = true;
    logger.warn('Email loop detected: auto-submitted header', {
      from: fromAddress,
      autoSubmitted,
    });
    return {
      isLoop: true,
      reason: `Auto-submitted email (${autoSubmitted})`,
      checks,
    };
  }

  if (autoResponseSuppress && autoResponseSuppress.toLowerCase() === 'all') {
    checks.loopHeader = true;
    logger.warn('Email loop detected: auto-response-suppress header', {
      from: fromAddress,
      autoResponseSuppress,
    });
    return {
      isLoop: true,
      reason: 'Auto-response suppressed',
      checks,
    };
  }

  // Check 4: Subject line patterns (Re: Re: Re: ...)
  const reCount = (email.subject.match(/^(Re:\s*)+/i) || []).join('').match(/Re:/gi)?.length || 0;
  if (reCount >= 3) {
    logger.warn('Email loop detected: excessive Re: in subject', {
      from: fromAddress,
      subject: email.subject,
      reCount,
    });
    return {
      isLoop: true,
      reason: `Too many Re: prefixes in subject (${reCount})`,
      checks,
    };
  }

  // No loop detected
  return {
    isLoop: false,
    checks,
  };
}

/**
 * Extract email address from "Name <email@domain.com>" format
 */
function extractEmailAddress(from: string): string {
  const match = from.match(/<(.+?)>/);
  return match ? match[1] : from;
}
