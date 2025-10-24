# g0t-phish

**AI-Powered Email Phishing Detection Agent**

Forward suspicious emails and receive instant AI-powered security analysis in 2-3 seconds.

![Status](https://img.shields.io/badge/status-active-success)
![Version](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)

---

## What is g0t-phish?

g0t-phish is a serverless email security agent that uses Claude AI to detect phishing attempts. Simply forward any suspicious email to your g0t-phish address and receive a detailed security assessment instantly.

**Key Benefits:**
- ⚡ **2-3 second response time** - Instant analysis via webhooks
- 🤖 **Claude AI powered** - Advanced pattern recognition
- 💰 **$0.50-10/month** - Cost-effective serverless architecture
- 🛡️ **Production-ready** - 5-layer loop prevention and rate limiting
- 🚀 **Zero maintenance** - Fully serverless on Vercel

---

## Features

- **Email Authentication Verification** - Checks SPF, DKIM, DMARC status
- **Sender Spoofing Detection** - Identifies forged sender addresses
- **Malicious Link Analysis** - Scans URLs for threats
- **Social Engineering Detection** - Recognizes urgency manipulation
- **Brand Impersonation** - Detects fake emails mimicking companies
- **Beautiful HTML Reports** - Color-coded verdicts with detailed evidence

### Security & Abuse Prevention
- **5-Layer Loop Prevention** - Self-reply, domain, header, Re: count checks
- **Rate Limiting** - 10 emails/hour per sender, 100/hour global
- **Circuit Breaker** - Emergency shutdown at 50 emails/10 minutes
- **Content Deduplication** - SHA-256 hashing prevents duplicates

---

## Quick Start

### Prerequisites

Sign up for these free services:
- [Vercel](https://vercel.com/signup) - Serverless hosting
- [SendGrid](https://sendgrid.com/signup) - Inbound email receiving (unlimited free)
- [Resend](https://resend.com/signup) - Outbound email sending (100 emails/day free)
- [Anthropic](https://console.anthropic.com/signup) - Claude API
- [Upstash](https://upstash.com/signup) - Redis (10K requests/day free)

You'll also need a domain for your agent email address (e.g., `alert@inbound.yourdomain.com`).

### Installation

```bash
# Clone repository
git clone <your-repo-url>
cd g0t-phish

# Install dependencies
npm install

# Copy environment template
cp .env.example .env.local

# Edit .env.local with your API keys:
# - ANTHROPIC_API_KEY (from console.anthropic.com)
# - RESEND_API_KEY (from resend.com/api-keys)
# - RESEND_AGENT_EMAIL (your agent email address)
# - UPSTASH_REDIS_REST_URL (from console.upstash.com)
# - UPSTASH_REDIS_REST_TOKEN (from console.upstash.com)
```

### Deploy to Vercel

```bash
# Install Vercel CLI
npm install -g vercel

# Login and deploy
vercel login
vercel --prod

# Add environment variables in Vercel dashboard
# Settings → Environment Variables → Add all from .env.local
```

### Configure Email Services

#### SendGrid (Inbound - Receiving Emails)

1. **Create SendGrid account** at [sendgrid.com](https://sendgrid.com/signup)
2. **Authenticate domain** - Add DNS records for SPF, DKIM
3. **Configure MX records** for your subdomain:
   ```
   Type: MX
   Host: inbound
   Priority: 10
   Value: mx.sendgrid.net
   ```
4. **Setup Inbound Parse Webhook**:
   - Domain: `yourdomain.com`
   - Subdomain: `inbound` (creates `alert@inbound.yourdomain.com`)
   - Webhook URL: `https://your-project.vercel.app/api/inbound`
   - Enable spam check ✅

**See [SENDGRID_SETUP.md](./SENDGRID_SETUP.md) for detailed configuration guide.**

#### Resend (Outbound - Sending Reports)

1. **Add your domain** at [resend.com/domains](https://resend.com/domains)
2. **Add DNS records** for sending authentication (SPF, DKIM)
3. **No inbound configuration needed** - SendGrid handles receiving

**Test**: Send an email to `alert@inbound.yourdomain.com`!

---

## Usage

### Analyze a Suspicious Email

Forward any suspicious email to your configured agent address:

```
To: alert@inbound.yourdomain.com
Subject: Can you check this suspicious email?
```

### Receive Analysis Report

Within 2-3 seconds, you'll receive an HTML email containing:

- **Verdict**: Safe ✅ / Suspicious ⚠️ / Phishing 🚨
- **Confidence Score**: 0-100% confidence level
- **Threat Details**: Specific findings with severity and evidence
- **Authentication Status**: SPF, DKIM, DMARC results
- **AI Summary**: Human-readable explanation

---

## Example Analysis

**Input:** Email claiming urgent account verification from "PayPal"

**Output Report:**
```
🚨 PHISHING DETECTED - Confidence: 87%

Threats Identified:
• [CRITICAL] Sender spoofing: Email claims PayPal but from @paypa1.net
• [HIGH] Malicious link: URL redirects to credential harvesting site
• [MEDIUM] Urgency manipulation: "Verify within 24 hours or account suspended"

Authentication:
• SPF: FAIL ❌
• DKIM: NONE ❌
• DMARC: FAIL ❌

Summary: This email is a phishing attempt impersonating PayPal. The sender
domain is fake, authentication checks fail, and the link leads to a
credential harvesting page. Do not click any links or provide information.
```

---

## Documentation

- **[CLAUDE.md](./CLAUDE.md)** - AI agent instructions (for Claude Code)
- **[SPEC.md](./SPEC.md)** - Complete technical specifications
- **[THREAT_INTEL_ROADMAP.md](./THREAT_INTEL_ROADMAP.md)** - Future v2.0 plans

---

## Development

```bash
# Start development server
npm run dev

# Run tests
npm test

# Type checking
npm run type-check

# Linting
npm run lint
```

See **[SPEC.md](./SPEC.md)** for detailed development guide, API specs, and troubleshooting.

---

## Cost Estimate

### Typical Usage (1,000 emails/month)
- **Vercel**: $0 (Hobby tier)
- **Resend**: $0 (within 100/day limit)
- **Claude API**: ~$0.50
- **Upstash Redis**: $0 (within free tier)
- **Total**: **~$0.50/month**

All services have free tiers that cover typical usage. See [SPEC.md](./SPEC.md) for detailed cost breakdown.

---

## Troubleshooting

**Not receiving analysis emails?**
- Check Resend domain verification (green checkmark)
- Verify inbound route points to correct Vercel URL
- Test webhook manually in Resend dashboard

**Claude analysis failing?**
- Verify `ANTHROPIC_API_KEY` in Vercel environment variables
- Check API credits at console.anthropic.com
- Review Vercel function logs for errors

**More issues?** See full troubleshooting guide in [SPEC.md](./SPEC.md#troubleshooting)

---

## Contributing

Contributions welcome! This project is designed for educational purposes.

**How to contribute:**
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## Security

If you discover a security vulnerability, please email security@yourdomain.com instead of using the issue tracker.

**Production Security Checklist:**
- Rotate API keys every 90 days
- Enable 2FA on all service accounts
- Monitor rate limiting logs for abuse patterns
- Review function logs weekly
- Set up billing alerts

See [SPEC.md](./SPEC.md#security-implementation) for complete security details.

---

## License

MIT License - See [LICENSE](./LICENSE) file for details.

---

## Support

- **Documentation**: [SPEC.md](./SPEC.md)
- **Issues**: [GitHub Issues](../../issues)
- **Discussions**: [GitHub Discussions](../../discussions)

---

## Acknowledgments

Built with:
- [Claude AI](https://anthropic.com) by Anthropic
- [Vercel](https://vercel.com) for serverless hosting
- [Resend](https://resend.com) for email infrastructure
- [Upstash](https://upstash.com) for serverless Redis
- [Next.js](https://nextjs.org) framework

---

**Built with ❤️ for safer email communications**
