# g0t-phish: Claude Code Agent Instructions

**Version:** 1.1.0 (Agentic Architecture)
**Last Updated:** 2025-10-24
**Purpose:** Definitive guide for AI agents working on this codebase

---

## Mission

g0t-phish is a **production serverless AI agent** for email phishing detection. Users forward suspicious emails to a configured address and receive AI-powered security analysis in 2-3 seconds via automated HTML email response.

**Core Goal:** Detect phishing attempts using an **autonomous Claude AI agent** with tool use capabilities, integrated threat intelligence, 5-layer security, and intelligent cost optimization ($2-10/month target).

**Key Innovation (v1.1):** Claude operates as a true **agent** that autonomously decides which tools to use (local analysis tools + external threat intelligence APIs) based on email content, providing explainable reasoning chains to users.

---

## Current Stack (v1.1 - Agentic Architecture)

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Framework** | Next.js 14.2.5 | Serverless API routes |
| **Language** | TypeScript 5.5.3 | Type safety |
| **Validation** | Zod 3.23.8 | Runtime type checking |
| **AI Agent** | Anthropic Claude Haiku 4.5 | **Agentic analysis with tool use** |
| **Email Inbound** | SendGrid Inbound Parse | Receiving forwarded emails |
| **Email Outbound** | Resend 3.2.0 | Sending analysis reports |
| **Database** | Upstash Redis 1.28.2 | Rate limiting + caching |
| **Threat Intel** | VirusTotal, AbuseIPDB | External threat databases (tools) |
| **Hosting** | Vercel (Pro tier) | Serverless deployment (60s timeout) |
| **Testing** | Jest 29.7.0 | Unit tests |

**Dependencies:** 8 production deps (added axios for APIs)

---

## Architecture (v1.1 - Agentic Implementation)

### Request Flow

```
Email → SendGrid → /api/inbound → 5 Security Layers → Claude Agent → HTML Report → Resend → User
                        ↓                                   ↓
                  Security Checks                    Tool Use Loop
                  1. Loop Detection                   ├─ extract_urls
                  2. Rate Limiting                    ├─ check_authentication
                  3. Deduplication                    ├─ analyze_sender
                  4. Circuit Breaker                  ├─ check_url_reputation (VirusTotal)
                  5. Validation (Zod)                 └─ check_ip_reputation (AbuseIPDB)
                                                            ↓
                                                      Autonomous Decision Making
                                                      ↓
                                                   Reasoning Chain
                                                   + Verdict + Evidence
```

### Agentic Decision Flow

```
1. Email received with suspicious URL
2. Claude analyzes: "I see 'paypa1.com' - likely typosquatting"
3. Claude decides: "I should verify this URL"
4. Claude calls: check_url_reputation("http://paypa1.com")
5. System executes: VirusTotal API → "23/89 vendors flagged"
6. Claude receives result and reasons: "Confirmed phishing with evidence"
7. Claude returns: PHISHING verdict (95% confidence) + reasoning chain
```

**Target Latency:** 2-4 seconds end-to-end (including tool calls)
**Timeout Limit:** 60 seconds (Vercel Pro tier)
**Tool Call Budget:** Max 5 tool calls per email for optimal performance

### File Structure (v1.1 Code)

```
app/
├── api/
│   ├── inbound/route.ts        # Main webhook (~200 lines) - orchestrates flow + tool routing
│   └── health/route.ts         # Health check (11 lines)
│
lib/
├── agent-analyzer.ts           # [NEW v1.1] Agentic Claude with tool use (~300 lines)
├── claude-analyzer.ts          # [LEGACY v1.0] Simple Claude API call (kept for fallback)
├── tools/
│   ├── local-tools.ts          # [NEW] extract_urls, check_auth, analyze_sender (~150 lines)
│   └── threat-intel-tools.ts   # [NEW] check_url_reputation, check_ip_reputation (~200 lines)
├── threat-intel.ts             # External threat API service (450 lines) - now used by tools
├── email-loop-prevention.ts    # 4-layer loop detection (109 lines)
├── rate-limiter.ts             # Redis rate limiting + deduplication (168 lines)
├── html-generator.ts           # HTML report + reasoning chain (~250 lines updated)
└── resend-sender.ts            # Outbound email sending (64 lines)
│
types/
└── email.ts                    # TypeScript interfaces + tool types (~150 lines updated)
│
utils/
└── logger.ts                   # Structured logging (36 lines)
│
tests/
├── email-loop.test.ts          # Loop detection tests (117 lines)
├── local-tools.test.ts         # Local tool execution tests
└── threat-intel-tools.test.ts  # Threat intelligence tool tests
```

**Total Business Logic:** ~1,400 lines (doubled from v1.0)
**New Code:** ~750 lines (agentic framework + tools)
**Test Coverage:** 90%+ business logic, 100% security-critical paths

---

## Agentic Architecture (v1.1 Key Feature)

### What Makes This a TRUE Agent?

**v1.0 (Simple Workflow):**
```typescript
// Fixed pipeline: prompt → Claude → response
const analysis = await claude.messages.create({
  messages: [{ role: "user", content: formatEmail(email) }]
});
// Claude returns verdict (one-shot, no decisions)
```

**v1.1 (Agentic with Tools):**
```typescript
// Claude makes autonomous decisions about which tools to use
const tools = [
  { name: "extract_urls", description: "..." },
  { name: "check_url_reputation", description: "..." },
  // ... more tools
];

// Multi-turn conversation with tool execution
let messages = [{ role: "user", content: formatEmail(email) }];
while (true) {
  const response = await claude.messages.create({ tools, messages });

  if (response.stop_reason === "tool_use") {
    // Claude decided to call a tool
    const toolUse = response.content.find(c => c.type === "tool_use");
    const result = await executeTool(toolUse.name, toolUse.input);

    // Send result back to Claude
    messages.push({ role: "assistant", content: response.content });
    messages.push({ role: "user", content: [{ type: "tool_result", ... }] });

    continue; // Claude iterates with new information
  }

  // Claude finished reasoning
  return parseAnalysis(response);
}
```

### Available Tools (v1.1)

**Local Analysis Tools** (fast, always available):
1. **extract_urls** - Extract and validate URLs from email body
2. **check_authentication** - Parse and validate SPF/DKIM/DMARC headers
3. **analyze_sender** - Check sender domain for spoofing patterns

**External Threat Intel Tools** (slower, called only when needed):
4. **check_url_reputation** - Query VirusTotal for URL maliciousness (23/89 vendors flagged)
5. **check_ip_reputation** - Query AbuseIPDB for IP abuse score (87% confidence)

### Tool Usage Intelligence

**Claude decides contextually:**
- Safe-looking email from Gmail → No external tools needed (save API calls)
- Suspicious URL like `paypa1.com` → Calls check_url_reputation to verify
- Known good domain → Skips reputation check
- Multiple suspicious signals → May call multiple tools for confirmation

**Cost Savings:** ~60% reduction in API calls vs. always-on approach

### Reasoning Chain

Every analysis includes Claude's decision-making process:
```
User: "Analyze this email for phishing"
Agent: "I notice the sender domain 'paypa1-security.com' uses '1' instead of 'l'"
Agent: "This is a typosquatting pattern. Let me verify the URL reputation."
Agent: *calls check_url_reputation*
Tool: "VirusTotal reports 23/89 vendors flagged this URL as malicious"
Agent: "Combined with urgency language and authentication failure, this is PHISHING (95% confidence)"
```

---

## Critical Constraints

### Performance
- **60-second Vercel timeout** (Pro tier) - HARD LIMIT
- **Target: 2-4s end-to-end** (Claude agent with tool use ~1-3s)
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

**Purpose:** Receives SendGrid webhooks, orchestrates security checks, triggers agentic analysis

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

### 2. Agent Analyzer (`lib/agent-analyzer.ts`)

**Model:** `claude-haiku-4-5-20251001` (fastest, cheapest)
**Config:** Temperature 0 (deterministic), max_tokens 4096, tool use enabled
**Input:** Formatted email with headers, body, authentication data
**Output:** JSON with verdict, confidence, threats, tool calls, reasoning chain

**Agentic Capabilities:**
- Autonomous tool selection based on email content
- Multi-turn conversation with tool execution
- Reasoning chain explaining decision-making process
- Graceful degradation if tools fail

**Verdict Categories:**
- `safe` (0-30%): No threats, authentication passes
- `suspicious` (31-69%): Some red flags, caution advised
- `phishing` (70-100%): High confidence malicious

**Note:** `lib/claude-analyzer.ts` is kept as v1.0 legacy fallback

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
2. **Exceed 60s timeout** - Vercel Pro tier will kill function
3. **Log email content** - PII compliance violation
4. **Skip loop prevention** - Creates infinite recursion
5. **Implement unvalidated features** - Stay focused on current version
6. **Change validation library** - Already using Zod, don't switch to Typia
7. **Change test framework** - Already using Jest, don't switch to Vitest
8. **Break agentic tool use** - v1.1 core feature

### ⚠️ Be Careful With
1. **External API calls** - Can timeout, always set timeout limits
2. **Redis operations** - Can fail, implement graceful degradation
3. **JSON parsing** - Claude responses can be malformed, validate
4. **Environment variables** - Must be set in Vercel, not just .env.local

---

## Common Tasks

### Add New Threat Detection Pattern
1. Update agent system prompt in `lib/agent-analyzer.ts`
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
2. Check SendGrid Inbound Parse webhook logs
3. Verify DNS records (MX, SPF, DKIM)
4. Test `/api/health` endpoint

### Add Environment Variable
1. Add to `.env.example`
2. Add validation in code (Zod schema)
3. Add to Vercel dashboard
4. Update SPEC.md

---

## Future Enhancements (Beyond v1.1)

**Current Status:** v1.1 production-ready with agentic architecture and threat intelligence

**Potential v1.2+ Features:**
- Conversation memory (multi-email threat correlation)
- Additional threat intel sources (URLScan.io, PhishTank)
- User feedback loop for continuous learning
- Advanced reporting dashboard
- Attachment analysis capabilities

**See:** `docs/development/THREAT_INTEL_ROADMAP.md` for v1.1 implementation details

**Important:** Focus on v1.1 stability and user feedback before expanding features.

---

## Troubleshooting Quick Reference

| Issue | Check | Solution |
|-------|-------|----------|
| No email received | SendGrid webhook logs, Vercel logs | Verify Inbound Parse webhook configured |
| Agent timeout | Function duration in logs | Reduce tool calls, check API status |
| Rate limit issues | Redis keys in Upstash console | Adjust limits or clear keys |
| Loop detected | Loop check logs | Verify agent email config |
| Build fails | TypeScript errors | Run `npm run type-check` |

**Full troubleshooting:** See `docs/development/SPEC.md` Section 18

---

## Documentation References

| Document | Purpose | When to Use |
|----------|---------|-------------|
| **CLAUDE.md** (this file) | AI agent instructions | Always read first |
| **README.md** | User-facing guide | For setup and usage |
| **docs/development/SPEC.md** | Technical reference | For architecture and APIs |
| **docs/development/THREAT_INTEL_ROADMAP.md** | v1.1 agentic plan | For implementation roadmap |
| **types/email.ts** | Data model definitions | For TypeScript interfaces |

---

## Success Criteria (v1.1 Production)

- ✅ <4s average response time with tool use (p95 <8s)
- ✅ <1% error rate over 7 days
- ✅ Zero email loops in production
- ✅ $0.75-10/month operational cost (60% API savings)
- ✅ >90% test coverage (100% security-critical paths)
- ✅ Agentic tool use operational on Vercel Pro tier

---

## Key Principles

1. **Agentic Architecture** - Claude operates as autonomous agent with tool use capabilities
2. **Intelligent Tool Selection** - Claude decides when to use external APIs based on context
3. **Explainable AI** - Reasoning chains show WHY decisions were made
4. **Serverless-Optimized** - Fast cold starts, stateless design, 60s timeout budget
5. **Cost-Conscious** - 60% API cost savings through intelligent decision-making
6. **Security-First** - 5-layer loop prevention is non-negotiable
7. **User-Focused** - 2-4s response time with clear verdicts and evidence
8. **Production-Ready** - Error handling, logging, graceful degradation, fallbacks

---

**Last Updated:** 2025-10-24
**Current Version:** 1.1.0 (Agentic Architecture - ✅ COMPLETE & PRODUCTION-READY)
**Previous Version:** 1.0.0 (Simple Workflow - Production Stable)
**Next Version:** 1.2.0 (Conversation Memory - Future)

Built with ❤️ for secure email communications.
