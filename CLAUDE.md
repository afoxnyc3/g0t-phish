# g0t-phish: Claude Code Agent Instructions

**Version:** 1.0.0
**Last Updated:** 2025-10-23
**Purpose:** Definitive guide for AI agents working on this codebase

---

## Mission

g0t-phish is a **production serverless email phishing detection agent**. Users forward suspicious emails to a configured address and receive AI-powered security analysis in 2-3 seconds via automated HTML email response.

**Core Goal:** Detect phishing attempts using Claude AI with 5-layer loop prevention, rate limiting, and cost optimization ($2-10/month operational target).

---

## Current Stack (v1.0 MVP - Production)

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Framework** | Next.js 14.2.5 | Serverless API routes |
| **Language** | TypeScript 5.5.3 | Type safety |
| **Validation** | Zod 3.23.8 | Runtime type checking |
| **AI** | Anthropic Claude Haiku 4.5 | Phishing analysis |
| **Email** | Resend 3.2.0 | Inbound webhooks + outbound |
| **Database** | Upstash Redis 1.28.2 | Rate limiting + deduplication |
| **Hosting** | Vercel (Hobby tier) | Serverless deployment |
| **Testing** | Jest 29.7.0 | Unit tests |

**Dependencies:** Minimal by design (6 production deps) for fast cold starts.

---

## Architecture (Actual Implementation)

### Request Flow

```
Email → Resend Webhook → /api/inbound → 5 Security Layers → Claude AI → HTML Report → Resend → User
                             ↓
                    1. Loop Detection
                    2. Rate Limiting (10/hr per sender, 100/hr global)
                    3. Deduplication (SHA-256)
                    4. Circuit Breaker (50/10min)
                    5. Validation (Zod)
```

**Target Latency:** 2-3 seconds end-to-end
**Timeout Limit:** 10 seconds (Vercel Hobby tier)

### File Structure (Actual Code)

```
app/
├── api/
│   ├── inbound/route.ts        # Main webhook (178 lines) - orchestrates entire flow
│   └── health/route.ts         # Health check (11 lines)
│
lib/
├── claude-analyzer.ts          # Claude AI integration (146 lines)
├── email-loop-prevention.ts    # 4-layer loop detection (109 lines)
├── rate-limiter.ts             # Redis rate limiting + deduplication (168 lines)
├── html-generator.ts           # HTML email report formatting (163 lines)
├── resend-sender.ts            # Outbound email sending (64 lines)
└── threat-intel.ts             # [v2.0 FUTURE] External threat APIs (450 lines)
│
types/
└── email.ts                    # TypeScript interfaces (89 lines)
│
utils/
└── logger.ts                   # Structured logging (36 lines)
│
tests/
└── email-loop.test.ts          # Unit tests (117 lines) - 8 test cases
```

**Total Business Logic:** ~660 lines
**Test Coverage:** 90%+ (critical paths 100%)

---

## Critical Constraints

### Performance
- **10-second Vercel timeout** (Hobby tier) - HARD LIMIT
- **Target: 2-3s end-to-end** (Claude analysis ~1-2s)
- **Cold start:** 200-500ms (minimal dependencies)

### Cost
- **Target: $2-10/month** for 1,000 emails/month
- **Breakdown:** Vercel $0, Resend $0, Claude $0.50, Redis $0
- **Stays within free tiers** for typical usage

### Security
- **MUST prevent email loops** - Agent analyzing its own replies creates infinite recursion
- **5-layer defense:** Self-reply check, domain check, header check, Re: count, deduplication
- **Rate limits enforced:** 10/hour per sender, 100/hour global

### Email Processing
- **ALWAYS return 200 status** - Even on errors (prevents email bounce-backs)
- **NEVER log email content** - PII compliance
- **Fail gracefully** - Return safe verdict on errors

---

## Key Implementation Details

### 1. Webhook Handler (`app/api/inbound/route.ts`)

**Purpose:** Receives Resend webhooks, orchestrates security checks, triggers analysis

**Flow:**
1. Validate payload with Zod schema
2. Parse email from webhook
3. Run loop detection (4 checks)
4. Check rate limits (Redis)
5. Check deduplication (SHA-256 hash)
6. Analyze with Claude
7. Send HTML report via Resend
8. Return 200 OK with summary

**Key Code Pattern:**
```typescript
// Orchestration with early returns
const loopCheck = detectEmailLoop(email);
if (loopCheck.isLoop) return NextResponse.json({ ignored: true });

const rateLimitCheck = await checkRateLimit(email.from);
if (!rateLimitCheck.allowed) return NextResponse.json({ error: 'Rate limit' }, { status: 429 });

const analysis = await analyzeEmail(email);
await sendAnalysisEmail({ to: email.from, analysis });
```

### 2. Claude AI Analysis (`lib/claude-analyzer.ts`)

**Model:** `claude-haiku-4-5-20251001` (fastest, cheapest)
**Config:** Temperature 0 (deterministic), max_tokens 2048
**Input:** Formatted email with headers, body, authentication data
**Output:** JSON with verdict, confidence, threats, authentication status

**System Prompt Instructs:**
- Check SPF/DKIM/DMARC authentication
- Detect sender spoofing, malicious links, social engineering
- Return structured JSON (no markdown)

**Verdict Categories:**
- `safe` (0-30%): No threats, authentication passes
- `suspicious` (31-69%): Some red flags, caution advised
- `phishing` (70-100%): High confidence malicious

### 3. Email Loop Prevention (`lib/email-loop-prevention.ts`)

**4 Independent Checks:**
1. **Self-reply:** Sender email === agent email
2. **Same domain:** Sender domain === agent domain
3. **Loop headers:** `auto-submitted`, `x-auto-response-suppress`
4. **Excessive Re::** Subject has 3+ "Re:" prefixes

**Returns:** `{ isLoop: boolean, reason?: string, checks: {...} }`

### 4. Rate Limiting (`lib/rate-limiter.ts`)

**Three-Tier Protection:**
1. **Per-sender:** 10 emails/hour (prevents single user abuse)
2. **Global:** 100 emails/hour (cost control)
3. **Circuit breaker:** 50 emails/10min (emergency shutdown)

**Implementation:** Upstash Redis with sliding window counters
**Deduplication:** SHA-256 hash of subject + body (1-hour TTL)

### 5. HTML Report Generator (`lib/html-generator.ts`)

**Output:** Color-coded HTML email with:
- Verdict badge (green/orange/red)
- Threat list with severity
- Authentication status
- AI summary
- Performance metrics

---

## Development Workflow

### Local Development
```bash
# Setup
npm install
cp .env.example .env.local
# Edit .env.local with API keys

# Run
npm run dev              # Start Next.js dev server
npm test                 # Run Jest tests
npm run test:watch       # Watch mode
npm run type-check       # TypeScript validation
npm run lint             # ESLint
```

### Deployment
```bash
# Deploy to Vercel
vercel --prod

# Configure environment variables in Vercel dashboard:
# - ANTHROPIC_API_KEY
# - RESEND_API_KEY
# - RESEND_AGENT_EMAIL
# - UPSTASH_REDIS_REST_URL
# - UPSTASH_REDIS_REST_TOKEN
```

### Testing
- **Jest** for unit tests (already chosen, don't change)
- **Mock external APIs** (Resend, Anthropic, Redis)
- **Coverage target:** 90%+ business logic, 100% security-critical paths
- **Test file:** `tests/email-loop.test.ts` (8 test cases, all passing)

---

## Code Style Guide

### What We Actually Use
- **TypeScript strict mode** enabled
- **Zod** for all validation (NOT Typia - decision already made)
- **Async/await** for all async operations
- **Error handling:** Try/catch with logging, never throw to user
- **Logging:** Structured JSON via `utils/logger.ts`
- **No console.log** in production code (use logger)

### Function Patterns (As Implemented)
```typescript
// ✅ Typical function in this codebase
export async function analyzeEmail(email: EmailInput): Promise<EmailAnalysis> {
  const startTime = Date.now();

  try {
    const message = await anthropic.messages.create({...});
    const analysis = JSON.parse(message.content[0].text);

    return {
      ...analysis,
      metadata: { latency: Date.now() - startTime, ... }
    };
  } catch (error) {
    logger.error('Claude analysis failed', { error });
    throw new Error(`Email analysis failed: ${error.message}`);
  }
}
```

**Note:** Code does NOT use:
- Result<T, E> pattern (just standard try/catch)
- Atomic function constraints (functions are natural size 20-50 lines)
- Vitest (using Jest)
- Typia (using Zod)

---

## What NOT to Do

### 🚫 Never Do These
1. **Add heavyweight dependencies** - Breaks cold start performance
2. **Exceed 10s timeout** - Vercel Hobby tier will kill function
3. **Log email content** - PII compliance violation
4. **Skip loop prevention** - Creates infinite recursion
5. **Implement unvalidated features** - Stay focused on MVP
6. **Change validation library** - Already using Zod, don't switch to Typia
7. **Change test framework** - Already using Jest, don't switch to Vitest
8. **Mix v1.0 and v2.0 features** - v2.0 is future (threat intel)

### ⚠️ Be Careful With
1. **External API calls** - Can timeout, always set timeout limits
2. **Redis operations** - Can fail, implement graceful degradation
3. **JSON parsing** - Claude responses can be malformed, validate
4. **Environment variables** - Must be set in Vercel, not just .env.local

---

## Common Tasks

### Add New Threat Detection Pattern
1. Update Claude system prompt in `lib/claude-analyzer.ts`
2. Add threat type to `types/email.ts`
3. Update HTML generator in `lib/html-generator.ts`
4. Add test cases
5. Deploy

### Adjust Rate Limits
1. Edit constants in `lib/rate-limiter.ts`
2. Test with multiple emails
3. Deploy

### Debug Email Not Received
1. Check Vercel function logs
2. Check Resend webhook logs
3. Verify DNS records (MX, SPF, DKIM)
4. Test `/api/health` endpoint

### Add Environment Variable
1. Add to `.env.example`
2. Add validation in code (Zod schema)
3. Add to Vercel dashboard
4. Update SPEC.md

---

## v2.0 Future Features (NOT IN MVP)

**Current Status:** v1.0 production (Claude-only analysis)

**Planned for v2.0:**
- Threat intelligence integration (VirusTotal, AbuseIPDB, URLScan.io)
- Parallel execution (Claude + threat intel simultaneously)
- URL/IP extraction and reputation checking
- Cross-validation between AI and threat databases

**See:** `THREAT_INTEL_ROADMAP.md` for full v2.0 plan

**Important:** Do NOT implement v2.0 features until v1.0 is stable and validated.

---

## Troubleshooting Quick Reference

| Issue | Check | Solution |
|-------|-------|----------|
| No email received | Resend webhook logs, Vercel logs | Verify inbound route configured |
| Claude timeout | Function duration in logs | Optimize prompt, check API status |
| Rate limit issues | Redis keys in Upstash console | Adjust limits or clear keys |
| Loop detected | Loop check logs | Verify agent email config |
| Build fails | TypeScript errors | Run `npm run type-check` |

**Full troubleshooting:** See `SPEC.md` Section 18

---

## Documentation References

| Document | Purpose | When to Use |
|----------|---------|-------------|
| **CLAUDE.md** (this file) | AI agent instructions | Always read first |
| **README.md** | User-facing guide | For setup and usage |
| **SPEC.md** | Technical reference | For architecture and APIs |
| **THREAT_INTEL_ROADMAP.md** | v2.0 future plan | For future enhancements |
| **types/email.ts** | Data model definitions | For TypeScript interfaces |

---

## Success Criteria (v1.0 MVP)

- ✅ <3s average response time (p95 <5s)
- ✅ <1% error rate over 7 days
- ✅ Zero email loops in production
- ✅ $2-10/month operational cost
- ✅ >90% test coverage
- ✅ Working deployment on Vercel

---

## Key Principles

1. **MVP First** - v1.0 must be rock-solid before v2.0
2. **Serverless-Optimized** - Fast cold starts, stateless design
3. **Cost-Conscious** - Stay within free tiers when possible
4. **Security-First** - Loop prevention is non-negotiable
5. **User-Focused** - 2-3s response time, clear verdicts
6. **Production-Ready** - Error handling, logging, monitoring

---

**Last Updated:** 2025-10-23
**Current Version:** 1.0.0 (Production)
**Next Version:** 2.0.0 (Threat Intelligence - Planned)

Built with ❤️ for secure email communications.
