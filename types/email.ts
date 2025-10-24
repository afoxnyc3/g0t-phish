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
 * Tool call made by Claude during analysis (v1.1)
 */
export interface ToolCall {
  id: string; // Unique identifier from Claude API
  name: 'extract_urls' | 'check_authentication' | 'analyze_sender' | 'check_url_reputation' | 'check_ip_reputation';
  input: Record<string, any>; // Tool-specific parameters
  result?: ToolResult; // Execution result (populated after tool runs)
  startTime: number; // Timestamp when tool was called
  endTime?: number; // Timestamp when tool completed
  duration?: number; // Execution duration in milliseconds
}

/**
 * Result from tool execution (v1.1)
 */
export interface ToolResult {
  success: boolean;
  data?: any; // Tool-specific result data
  error?: string; // Error message if tool failed
  cached?: boolean; // True if result came from Redis cache
  source?: 'local' | 'virustotal' | 'abuseipdb'; // Where the data came from
}

/**
 * Claude analysis result (v1.1 enhanced with tool use)
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
    source?: 'claude' | 'virustotal' | 'abuseipdb'; // v1.1: Evidence source
  }>;
  authentication: {
    spf: 'pass' | 'fail' | 'neutral' | 'none';
    dkim: 'pass' | 'fail' | 'neutral' | 'none';
    dmarc: 'pass' | 'fail' | 'neutral' | 'none';
  };
  summary: string;
  reasoning?: string[]; // v1.1: Step-by-step reasoning chain
  toolCalls?: ToolCall[]; // v1.1: Tools used during analysis
  metadata: {
    model: string;
    latency: number;
    inputTokens: number;
    outputTokens: number;
    toolExecutionTime?: number; // v1.1: Time spent in tool calls
  };
  // Threat intelligence enrichment (optional - legacy, may be removed)
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
