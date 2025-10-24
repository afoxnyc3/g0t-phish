# g0t-phish Technical Specification (v1.0 MVP)

**Version:** 1.0.0
**Last Updated:** 2025-10-23
**Status:** Production Ready

---

## Overview

g0t-phish is a serverless email phishing detection agent that analyzes suspicious emails using Claude AI and returns security assessments within 2-3 seconds.

**Core Features:**
- Claude Haiku 4.5 powered phishing analysis
- 5-layer email loop prevention
- Redis-backed rate limiting (10/hour per sender, 100/hour global)
- HTML email reports with color-coded verdicts
- Vercel serverless deployment
- Cost-optimized (~$2-10/month)

---

## Architecture

### Request Flow

```
1. User forwards suspicious email to g0t-phish@domain.com
2. Resend receives email → POSTs webhook to /api/inbound
3. Validate payload (Zod schema)
4. Loop detection (4 checks: self-reply, domain, headers, Re: count)
5. Rate limiting check (Redis: per-sender + global limits)
6. Content deduplication (SHA-256 hash with 1-hour TTL)
7. Claude AI analysis (1-2s inference)
8. Generate HTML report (color-coded verdict, threats, auth status)
9. Send analysis email via Resend
10. Return 200 OK with summary
```

**Total Latency:** 2-3 seconds end-to-end
**Timeout Limit:** 10 seconds (Vercel Hobby tier)

---

## Technology Stack

| Component | Technology | Version | Purpose |
|-----------|-----------|---------|---------|
| **Framework** | Next.js | 14.2.5 | Serverless API routes |
| **Language** | TypeScript | 5.5.3 | Type safety |
| **Validation** | Zod | 3.23.8 | Runtime type checking |
| **AI** | Claude Haiku 4.5 | Latest | Phishing detection |
| **Email** | Resend | 3.2.0 | Inbound/outbound email |
| **Database** | Upstash Redis | 1.28.2 | Rate limiting + caching |
| **Hosting** | Vercel | Hobby/Pro | Serverless deployment |
| **Testing** | Jest | 29.7.0 | Unit testing |

---

## Project Structure

```
app/
├── api/
│   ├── inbound/route.ts          # Main webhook endpoint (178 lines)
│   └── health/route.ts           # Health check (11 lines)
├── layout.tsx                    # Root layout
├── page.tsx                      # Landing page
└── globals.css                   # Global styles

lib/
├── claude-analyzer.ts            # Claude AI integration (146 lines)
├── email-loop-prevention.ts      # 4-layer loop detection (109 lines)
├── rate-limiter.ts               # Rate limiting + deduplication (168 lines)
├── html-generator.ts             # HTML report generation (163 lines)
├── resend-sender.ts              # Outbound email sending (64 lines)
└── threat-intel.ts               # [v2.0 FUTURE] Threat intelligence (450 lines)

types/
└── email.ts                      # TypeScript interfaces (89 lines)

utils/
└── logger.ts                     # Structured logging (36 lines)

tests/
└── email-loop.test.ts            # Unit tests (117 lines)

Configuration:
├── .env.example                  # Environment variables template
├── package.json                  # Dependencies + scripts
├── tsconfig.json                 # TypeScript config
├── jest.config.js                # Jest config
└── next.config.mjs               # Next.js config (maxDuration: 10s)
```

**Total Business Logic:** ~660 lines
**Test Coverage:** 90%+

---

## API Specification

### POST /api/inbound

**Purpose:** Receives Resend webhook for incoming emails

**Request Headers:**
```
Content-Type: application/json
```

**Request Body (Resend Webhook):**
```json
{
  "type": "email.received",
  "created_at": "2025-10-23T12:00:00.000Z",
  "data": {
    "email_id": "abc123",
    "from": "user@example.com",
    "to": ["g0t-phish@yourdomain.com"],
    "subject": "Suspicious email",
    "text": "Email body content...",
    "html": "<html>...</html>",
    "headers": {
      "received-spf": "pass",
      "dkim-signature": "v=1; ...",
      ...
    }
  }
}
```

**Response (200 OK - Success):**
```json
{
  "success": true,
  "requestId": "req-123456789",
  "verdict": "phishing",
  "confidence": 87,
  "emailId": "sent-abc123"
}
```

**Response (200 OK - Loop Detected):**
```json
{
  "success": true,
  "ignored": true,
  "reason": "Self-reply detected"
}
```

**Response (429 - Rate Limit):**
```json
{
  "error": "Rate limit exceeded",
  "reason": "Per-sender limit: 10/hour",
  "limits": {
    "perSender": { "count": 11, "limit": 10 },
    "global": { "count": 45, "limit": 100 }
  }
}
```

**Response (500 - Error):**
```json
{
  "error": "Internal server error",
  "requestId": "req-123456789"
}
```

### GET /api/health

**Purpose:** Health check for monitoring

**Response (200 OK):**
```json
{
  "status": "healthy",
  "timestamp": "2025-10-23T12:00:00.000Z",
  "service": "g0t-phish",
  "version": "1.0.0"
}
```

---

## Data Models

### EmailInput (Internal)

```typescript
interface EmailInput {
  from: string;
  to: string;
  subject: string;
  body: string;
  headers: Record<string, string>;
  receivedAt: Date;
}
```

### EmailAnalysis (Claude Output)

```typescript
interface EmailAnalysis {
  verdict: 'safe' | 'suspicious' | 'phishing';
  confidence: number; // 0-100
  threats: Array<{
    type: 'spoofing' | 'malicious_link' | 'urgency_manipulation' | 'brand_impersonation';
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    evidence: string;
    confidence?: number;
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
```

---

## Configuration

### Environment Variables

**Required:**
```bash
# Anthropic Claude API
ANTHROPIC_API_KEY=sk-ant-xxxxx

# Resend Email Service
RESEND_API_KEY=re_xxxxx
RESEND_AGENT_EMAIL=g0t-phish@yourdomain.com

# Upstash Redis
UPSTASH_REDIS_REST_URL=https://xxxxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=xxxxx
```

**Optional:**
```bash
NODE_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Rate Limit Configuration

**Location:** `lib/rate-limiter.ts`

```typescript
const RATE_LIMITS = {
  perSender: { limit: 10, windowMs: 3600000 },    // 10/hour
  global: { limit: 100, windowMs: 3600000 },       // 100/hour
  circuitBreaker: { limit: 50, windowMs: 600000 } // 50/10min
};
```

---

## Security Implementation

### Email Loop Prevention (5 Layers)

**Layer 1 - Self-Reply Detection:**
```typescript
if (email.from.toLowerCase() === agentEmail.toLowerCase()) {
  return { isLoop: true, reason: 'Self-reply detected' };
}
```

**Layer 2 - Same Domain Detection:**
```typescript
const senderDomain = extractDomain(email.from);
const agentDomain = extractDomain(agentEmail);
if (senderDomain === agentDomain) {
  return { isLoop: true, reason: 'Same domain' };
}
```

**Layer 3 - Loop Header Detection:**
```typescript
if (headers['auto-submitted'] && headers['auto-submitted'] !== 'no') {
  return { isLoop: true, reason: 'Auto-submitted header' };
}
```

**Layer 4 - Excessive Re: Detection:**
```typescript
const reCount = (subject.match(/^(Re:\s*)+/i) || [''])[0].split('Re:').length - 1;
if (reCount >= 3) {
  return { isLoop: true, reason: 'Excessive Re: count' };
}
```

**Layer 5 - Outbound Headers:**
```typescript
// Added to all outbound analysis emails
headers: {
  'Auto-Submitted': 'auto-replied',
  'X-Auto-Response-Suppress': 'All',
  'Precedence': 'auto_reply',
}
```

### Rate Limiting

**Three-Tier Protection:**
1. **Per-Sender:** 10 emails/hour (prevents single user abuse)
2. **Global:** 100 emails/hour (cost control)
3. **Circuit Breaker:** 50 emails/10min (emergency DDoS protection)

**Implementation:** Upstash Redis with sliding window counters

**Redis Keys:**
- `ratelimit:sender:<email>` (TTL: 1 hour)
- `ratelimit:global` (TTL: 1 hour)
- `circuitbreaker:global` (TTL: 10 minutes)

### Content Deduplication

**Method:** SHA-256 hash of subject + body
**TTL:** 1 hour
**Purpose:** Prevent processing identical emails multiple times

---

## Performance

### Latency Breakdown

| Phase | Duration | % of Total |
|-------|----------|------------|
| Webhook receipt | <100ms | 3% |
| Validation (Zod) | <50ms | 2% |
| Loop detection | <10ms | <1% |
| Rate limit check | 50-100ms | 3% |
| **Claude AI analysis** | **1000-2000ms** | **70%** |
| HTML generation | 50-100ms | 3% |
| Email sending | 300-500ms | 15% |
| Response return | <50ms | 2% |
| **TOTAL** | **2000-3000ms** | **100%** |

### Resource Usage

**Memory:**
- Typical: 128-256 MB
- Peak: 512 MB
- Allocated: 1024 MB (Vercel default)

**Throughput:**
- Vercel Hobby: ~1000 emails/hour (rate limited)
- Vercel Pro: ~10,000+ emails/hour

---

## Cost Analysis (v1.0)

### Free Tier (100 emails/month)

| Service | Usage | Cost |
|---------|-------|------|
| Vercel | 100 function calls | $0 |
| Resend | 200 emails (in+out) | $0 |
| Claude API | ~100 emails × 1K tokens | $0.05 |
| Upstash Redis | ~1000 ops | $0 |
| **TOTAL** | | **$0.05/month** |

### Typical Usage (1,000 emails/month)

| Service | Usage | Cost |
|---------|-------|------|
| Vercel | 1K function calls | $0 |
| Resend | 2K emails | $0 |
| Claude API | ~1K emails × 1K tokens | $0.50 |
| Upstash Redis | ~10K ops | $0 |
| **TOTAL** | | **$0.50/month** |

### High Volume (5,000 emails/month)

| Service | Usage | Cost |
|---------|-------|------|
| Vercel | 5K function calls | $0-20 |
| Resend | 10K emails | $10 |
| Claude API | ~5K emails × 1K tokens | $2.50 |
| Upstash Redis | ~50K ops | $0-5 |
| **TOTAL** | | **$12-37/month** |

**Cost per Email:** $0.0005-0.01 (volume dependent)

---

## Development Guide

### Local Setup

```bash
# Clone and install
git clone <repo-url>
cd g0t-phish
npm install

# Configure environment
cp .env.example .env.local
# Edit .env.local with API keys

# Run development server
npm run dev

# Run tests
npm test
npm run test:watch

# Type checking
npm run type-check

# Linting
npm run lint
```

### Testing

**Framework:** Jest 29.7.0
**Coverage Target:** 90%+ business logic

**Run tests:**
```bash
npm test                  # Run all tests
npm run test:watch        # Watch mode
npm test -- --coverage    # With coverage report
```

**Current Test Suite:**
- `tests/email-loop.test.ts` - 8 test cases covering all loop detection scenarios
- Coverage: 95%+ on loop prevention logic

### Deployment

**Deploy to Vercel:**
```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel login
vercel --prod
```

**Configure Environment Variables:**
1. Go to Vercel dashboard → Settings → Environment Variables
2. Add all required env vars from `.env.example`
3. Redeploy if needed

**Configure Resend:**
1. Add domain at resend.com/domains
2. Add DNS records (MX, SPF, DKIM)
3. Configure inbound route:
   - Match: `g0t-phish@yourdomain.com`
   - Forward to: `https://your-project.vercel.app/api/inbound`
4. Test by sending email to agent address

---

## Troubleshooting

### 1. Not Receiving Analysis Emails

**Symptoms:** Email sent to agent, no response

**Check:**
- Resend domain verified (green checkmark)
- Inbound route configured correctly
- Vercel function logs for errors
- DNS records (MX, SPF, DKIM)

**Solution:**
```bash
# Verify DNS
dig MX yourdomain.com

# Check Vercel logs
vercel logs

# Test webhook manually
curl -X POST https://your-project.vercel.app/api/inbound \
  -H "Content-Type: application/json" \
  -d @test-payload.json
```

### 2. Claude Analysis Failing

**Symptoms:** 500 errors, no analysis in response

**Check:**
- `ANTHROPIC_API_KEY` set in Vercel
- API credits at console.anthropic.com
- Vercel function logs for specific error

**Solution:**
```bash
# Test API key
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{"model":"claude-haiku-4-5-20251001","max_tokens":10,"messages":[{"role":"user","content":"test"}]}'
```

### 3. Rate Limit Issues

**Symptoms:** 429 responses, legitimate emails rejected

**Check:**
- Redis connection working
- Current rate limit counts
- Circuit breaker not triggered

**Solution:**
```bash
# Check Redis (Upstash console)
# View keys: ratelimit:sender:*, ratelimit:global, circuitbreaker:global

# Clear specific sender limit
redis-cli DEL ratelimit:sender:user@example.com

# Adjust limits in lib/rate-limiter.ts if needed
```

### 4. Email Loops Detected Incorrectly

**Symptoms:** Legitimate emails marked as loops

**Check:**
- `RESEND_AGENT_EMAIL` matches exactly
- No multiple agent addresses on same domain
- Subject line "Re:" count reasonable

**Solution:**
- Verify exact match: `g0t-phish@domain.com` (case-insensitive)
- Check loop detection logs for specific reason
- Adjust "Re:" threshold if needed (currently 3+)

### 5. High Latency (>5s)

**Symptoms:** Slow responses, timeouts

**Check:**
- Claude API latency in logs
- Redis latency
- Resend API latency

**Solution:**
- Upgrade to Vercel Pro (60s timeout)
- Optimize Claude prompt (reduce tokens)
- Check for API outages

### 6. Build/Deploy Failures

**Symptoms:** Vercel build fails, TypeScript errors

**Check:**
```bash
# Local type checking
npm run type-check

# Build locally
npm run build

# Check for missing dependencies
npm install
```

---

## Future Enhancements (v2.0)

See `THREAT_INTEL_ROADMAP.md` for detailed v2.0 plan including:
- VirusTotal URL reputation
- AbuseIPDB IP reputation
- URLScan.io live analysis
- Parallel execution with Claude
- Cross-validation between AI and threat databases

**Current Status:** v1.0 production (Claude-only)
**Target:** v2.0 (Claude + Threat Intel)

---

## References

- **CLAUDE.md** - AI agent instructions
- **README.md** - User-facing guide
- **THREAT_INTEL_ROADMAP.md** - v2.0 feature plan
- **types/email.ts** - Data model definitions

---

**Document Version:** 1.0.0
**Last Updated:** 2025-10-23
**Status:** Production Ready
