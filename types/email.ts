// types/email.ts

/**
 * Resend inbound webhook payload
 * Reference: https://resend.com/docs/api-reference/webhooks/email-received
 */
export interface ResendInboundWebhook {
  type: 'email.received';
  created_at: string;
  data: {
    email_id: string;
    from: string;
    to: string[];
    subject: string;
    text?: string;
    html?: string;
    headers: Record<string, string>;
    reply_to?: string;
    attachments?: Array<{
      filename: string;
      content_type: string;
      size: number;
    }>;
  };
}

/**
 * Parsed email for internal processing
 */
export interface EmailInput {
  from: string;
  to: string;
  subject: string;
  body: string;
  headers: Record<string, string>;
  receivedAt: Date;
}

/**
 * Claude analysis result
 */
export interface EmailAnalysis {
  verdict: 'safe' | 'suspicious' | 'phishing';
  confidence: number;
  threats: Array<{
    type: 'spoofing' | 'malicious_link' | 'urgency_manipulation' | 'brand_impersonation';
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    evidence: string;
  }>;
  authentication: {
    spf: 'pass' | 'fail' | 'neutral' | 'none';
    dkim: 'pass' | 'fail' | 'neutral' | 'none';
    dmarc: 'pass' | 'fail' | 'neutral' | 'none';
  };
  summary: string;
  metadata: {
    model: string;
    latency: number;
    inputTokens: number;
    outputTokens: number;
  };
}

/**
 * Email loop detection result
 */
export interface EmailLoopCheck {
  isLoop: boolean;
  reason?: string;
  checks: {
    selfReply: boolean;
    sameDomain: boolean;
    loopHeader: boolean;
  };
}

/**
 * Rate limit check result
 */
export interface RateLimitCheck {
  allowed: boolean;
  reason?: string;
  limits: {
    perSender: { count: number; limit: number };
    global: { count: number; limit: number };
  };
}
