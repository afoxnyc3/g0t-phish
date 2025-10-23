# g0t-phish

**AI-Powered Email Phishing Detection Agent**

An automated phishing detection service that analyzes suspicious emails using Claude AI and returns instant security assessments.

![Status](https://img.shields.io/badge/status-active-success)
![Version](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)

---

## Overview

**g0t-phish** is a serverless email security agent built with:
- **Claude AI** (Haiku 4.5) for intelligent phishing detection
- **Vercel** for serverless hosting
- **Resend** for inbound/outbound email
- **Upstash Redis** for rate limiting and deduplication

Send any suspicious email to your configured agent address and receive a detailed security analysis within 2-3 seconds.

---

## Features

### Core Capabilities
- ✅ **Instant Analysis**: Webhook-based detection (no polling delays)
- ✅ **AI-Powered**: Claude Haiku 4.5 identifies sophisticated phishing attempts
- ✅ **Email Authentication**: Checks SPF, DKIM, DMARC
- ✅ **Threat Detection**: Identifies spoofing, malicious links, social engineering, brand impersonation
- ✅ **Beautiful Reports**: HTML-formatted analysis emails

### Security Features
- 🛡️ **5-Layer Email Loop Prevention**:
  1. Self-reply detection (prevents agent replying to itself)
  2. Rate limiting (10/hour per sender, 100/hour global)
  3. Circuit breaker (emergency shutdown at 50 emails/10min)
  4. Content deduplication (SHA-256 hashing)
  5. Auto-submitted header detection

### Performance
- ⚡ **~2-3s** end-to-end latency (webhook → analysis → reply)
- 📈 **Auto-scaling** via Vercel serverless
- 💰 **~$2-10/month** for typical usage (1,000 emails/month)

---

## Quick Start

### Prerequisites

1. **Accounts** (all free tiers available):
   - [Vercel](https://vercel.com/signup) - Hosting
   - [Resend](https://resend.com/signup) - Email (100 emails/day free)
   - [Anthropic](https://console.anthropic.com/signup) - Claude API
   - [Upstash](https://upstash.com/signup) - Redis (10k requests/day free)

2. **Domain**: You'll need a domain or subdomain for email (e.g., `g0t-phish@yourdomain.com`)

### Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd g0t-phish

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local

# Edit .env.local with your API keys
# - ANTHROPIC_API_KEY
# - RESEND_API_KEY
# - RESEND_AGENT_EMAIL
# - UPSTASH_REDIS_REST_URL
# - UPSTASH_REDIS_REST_TOKEN
```

### Local Development

```bash
# Run development server
npm run dev

# Test health endpoint
curl http://localhost:3000/api/health

# Test webhook (mock Resend payload)
curl -X POST http://localhost:3000/api/inbound \
  -H "Content-Type: application/json" \
  -d '{
    "type": "email.received",
    "created_at": "2025-10-23T12:00:00Z",
    "data": {
      "email_id": "test-123",
      "from": "test@example.com",
      "to": ["g0t-phish@yourdomain.com"],
      "subject": "Test Email",
      "text": "This is a test.",
      "headers": {}
    }
  }'
```

### Deployment

```bash
# Deploy to Vercel
npm install -g vercel
vercel login
vercel --prod

# Configure environment variables in Vercel dashboard
# Settings → Environment Variables → Add all from .env.local
```

### Configure Resend

1. **Add domain to Resend**:
   - Go to https://resend.com/domains
   - Add your domain (e.g., `yourdomain.com`)

2. **Add DNS records** (provided by Resend):
   ```
   MX    @    feedback-smtp.us-east-1.amazonses.com    10
   TXT   @    v=spf1 include:amazonses.com ~all
   TXT   resend._domainkey    [DKIM key from Resend]
   ```

3. **Configure inbound route**:
   - Go to https://resend.com/inbound
   - Match: `g0t-phish@yourdomain.com`
   - Forward to: `https://your-project.vercel.app/api/inbound`

4. **Test**: Send email to `g0t-phish@yourdomain.com` and wait for analysis!

---

## Architecture

```
User sends email → Resend receives → Webhook to Vercel →
Email loop checks → Rate limiting → Claude AI analysis →
HTML report generation → Send reply via Resend → User receives analysis
```

### Email Loop Prevention (5 Layers)

1. **Self-Reply Detection**: Checks if sender === agent address
2. **Rate Limiting**: 10/hour per sender, 100/hour global (Upstash Redis)
3. **Circuit Breaker**: Emergency shutdown at 50 emails/10min
4. **Deduplication**: SHA-256 content hashing (1-hour TTL)
5. **Header Detection**: Checks `Auto-Submitted`, `X-Auto-Response-Suppress`

### Technology Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Framework** | Next.js 14 (App Router) | Serverless API routes |
| **Hosting** | Vercel | Serverless functions |
| **Email** | Resend | Inbound webhooks + outbound API |
| **AI** | Claude Haiku 4.5 | Phishing detection |
| **Rate Limiting** | Upstash Redis | Abuse prevention |
| **Language** | TypeScript | Type safety |
| **Validation** | Zod | Runtime type checking |

---

## Usage

### Send Email for Analysis

Forward any suspicious email to your configured agent address:

```
To: g0t-phish@yourdomain.com
Subject: [Fwd: Suspicious email]
Body: [Paste suspicious email content]
```

### Analysis Report

Within 2-3 seconds, you'll receive an HTML email with:

- **Verdict**: Safe / Suspicious / Phishing
- **Confidence**: 0-100%
- **Threats**: Detailed list with severity and evidence
- **Authentication**: SPF, DKIM, DMARC status
- **Summary**: Human-readable assessment

Example verdicts:
- **Safe**: ✅ No threats detected, authentication passes
- **Suspicious**: ⚠️ Some red flags, proceed with caution
- **Phishing**: 🚨 Clear malicious intent, do not engage

---

## Development

### Project Structure

```
g0t-phish/
├── app/
│   ├── api/
│   │   ├── inbound/route.ts       # Main webhook endpoint
│   │   └── health/route.ts        # Health check
│   ├── layout.tsx                 # Root layout
│   └── page.tsx                   # Landing page
├── lib/
│   ├── claude-analyzer.ts         # Claude AI integration
│   ├── email-loop-prevention.ts   # Loop detection
│   ├── rate-limiter.ts            # Rate limiting + deduplication
│   ├── resend-sender.ts           # Email sending
│   └── html-generator.ts          # Report generation
├── types/
│   └── email.ts                   # TypeScript interfaces
├── utils/
│   └── logger.ts                  # Logging utility
└── tests/
    └── email-loop.test.ts         # Unit tests
```

### Testing

```bash
# Run all tests
npm test

# Run in watch mode
npm run test:watch

# Type checking
npm run type-check

# Linting
npm run lint
```

### Key Configuration

**Vercel Timeout** (`app/api/inbound/route.ts`):
```typescript
export const config = {
  maxDuration: 10, // 10 seconds (Hobby tier)
};
```

**Rate Limits** (`lib/rate-limiter.ts`):
```typescript
const RATE_LIMITS = {
  perSender: { limit: 10, windowMs: 60 * 60 * 1000 },  // 10/hour
  global: { limit: 100, windowMs: 60 * 60 * 1000 },     // 100/hour
  circuitBreaker: { limit: 50, windowMs: 10 * 60 * 1000 }, // 50/10min
};
```

---

## Cost Analysis

### Free Tier (100-300 emails/month)
- **Vercel**: $0 (Hobby tier)
- **Resend**: $0 (100 emails/day free)
- **Anthropic**: ~$0.50 (Claude API)
- **Upstash**: $0 (10k requests/day free)
- **Total**: **~$0.50/month**

### Paid Tier (1,000-5,000 emails/month)
- **Vercel**: $0-20 (Hobby or Pro)
- **Resend**: $10 (50k emails/month)
- **Anthropic**: ~$5 (Claude API)
- **Upstash**: $0 (still within free tier)
- **Total**: **~$15-35/month**

Compare to Azure solution: **~$35/month** (fixed cost regardless of volume)

---

## Troubleshooting

### Webhook not receiving emails
- Verify MX records: `dig MX yourdomain.com`
- Check Resend domain verified (green checkmark)
- Test webhook manually in Resend dashboard

### Claude analysis failing
- Verify `ANTHROPIC_API_KEY` in Vercel env vars
- Check API credits at https://console.anthropic.com/
- Review Vercel function logs for errors

### Email loop detected incorrectly
- Verify `RESEND_AGENT_EMAIL` matches sending address
- Check headers for auto-submitted flags
- Review detection logic in `lib/email-loop-prevention.ts`

---

## Documentation

- **Architecture**: See inline comments in code
- **API Reference**: Check `app/api/inbound/route.ts` for webhook spec
- **Email Loop Prevention**: See `lib/email-loop-prevention.ts`
- **Rate Limiting**: See `lib/rate-limiter.ts`

---

## Contributing

This project is designed for educational purposes (class assignment). Feel free to:
- Report bugs via issues
- Suggest improvements
- Fork and customize for your needs

---

## Security Considerations

### Production Checklist
- [ ] Rotate API keys every 90 days
- [ ] Enable 2FA on all accounts (Vercel, Resend, Anthropic, Upstash)
- [ ] Monitor rate limiting logs for abuse
- [ ] Review Vercel function logs weekly
- [ ] Set up billing alerts on all services
- [ ] Test email loop prevention regularly

### Best Practices
- Never commit `.env.local` or API keys
- Use Vercel environment variables for secrets
- Review Claude analysis prompts for data leakage
- Monitor Resend bounce rates
- Keep dependencies updated

---

## License

MIT License - See LICENSE file for details

---

## Acknowledgments

- **Anthropic** - Claude AI
- **Vercel** - Serverless hosting
- **Resend** - Email infrastructure
- **Upstash** - Redis for rate limiting

---

## Support

For questions or issues:
1. Check the troubleshooting section above
2. Review Vercel function logs
3. Check Resend webhook logs
4. Open an issue in the repository

---

**Built with ❤️ using Next.js, Claude AI, and modern serverless technologies**
