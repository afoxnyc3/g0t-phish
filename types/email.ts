// types/email.ts

/**
 * SendGrid Inbound Parse webhook payload (multipart/form-data)
 * Reference: https://www.twilio.com/docs/sendgrid/for-developers/parsing-email/setting-up-the-inbound-parse-webhook
 */
export interface SendGridInboundWebhook {
  headers: string; // Raw email headers
  dkim: string; // DKIM verification results (e.g., "{@example.com : pass}")
  to: string; // Recipient address
  from: string; // Sender address
  subject: string; // Email subject
  text?: string; // Plaintext body
  html?: string; // HTML body
  sender_ip: string; // Sender's IP address
  envelope: string; // JSON string with SMTP envelope data
  attachments: string; // Number of attachments
  'attachment-info'?: string; // JSON string with attachment metadata
  spam_score?: string; // Spam Assassin score
  spam_report?: string; // Spam Assassin report
  charsets?: string; // JSON string with character set info
  SPF?: string; // SPF verification result
  'content-ids'?: string; // JSON string mapping content IDs
}

/**
 * Resend inbound webhook payload (not used - private beta)
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
    type: 'spoofing' | 'malicious_link' | 'urgency_manipulation' | 'brand_impersonation' | 'url' | 'ip' | 'domain' | 'sender';
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    evidence: string;
    confidence?: number; // Added for threat intel indicators
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
  // Threat intelligence enrichment (optional)
  threatIntel?: {
    riskContribution: number;
    servicesUsed: string[];
    enrichmentLatency?: number;
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
