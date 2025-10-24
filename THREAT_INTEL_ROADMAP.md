# Agentic Architecture + Threat Intelligence Roadmap

> **✅ STATUS: v1.1 IN ACTIVE DEVELOPMENT**
>
> **Current Version:** v1.0 (Claude AI-only workflow)
> **Target Version:** v1.1 (Agentic Architecture + Intelligent Threat Intel)
> **Status:** Documentation phase, implementation starting
>
> This document outlines the v1.1 upgrade from a simple workflow to a **true agentic system** where Claude uses tools (including threat intelligence APIs) to make intelligent decisions.

---

## Overview

This document describes the v1.1 architectural upgrade that transforms g0t-phish from a simple LLM workflow into an **intelligent agent** that:

1. **Uses Claude's tool use** to make autonomous decisions
2. **Integrates threat intelligence** (VirusTotal, AbuseIPDB) as tools
3. **Calls APIs intelligently** - only when Claude determines it's necessary
4. **Provides reasoning chains** - shows decision-making process to users

**Goal:** Create a true AI agent that combines autonomous reasoning with objective threat intelligence, only calling external APIs when contextually appropriate.

---

## Previous State (v1.0 - Production)

**Architecture:** Serverless workflow with single LLM call
- Single API call to Claude for analysis
- No tool use or autonomous decision-making
- No external threat intelligence
- Fixed prompt → response pattern

**What worked:**
- ✅ Fast (2-3s response time)
- ✅ Simple and reliable
- ✅ 92% accuracy on test cases

**Limitations:**
- ❌ Not a true "agent" - just prompt engineering
- ❌ No tool use capabilities
- ❌ No cross-validation with threat databases
- ❌ Cannot make contextual decisions about when to call APIs
- ❌ No reasoning chain visible to users

---

## Target State (v1.1 - Agentic + Intelligent Threat Intel)

**Architecture:** Autonomous agent with tool use
- Claude decides which tools to use and when
- Multi-step reasoning with tool calls
- Intelligent API usage (only when needed)
- Reasoning chain recorded and displayed
- Increased confidence scores when both systems agree
- Concrete evidence ("Flagged by 23/89 VirusTotal vendors")

---

## Architecture Design

### v1.1 Agentic Tool Use Pattern

```
┌─────────────────┐
│  Email Received │
└────────┬────────┘
         │
    ┌────▼────────────┐
    │ Claude Agent    │
    │ (Tool Use Loop) │
    └────┬────────────┘
         │
         ├─────────────────────────────┐
         │ Autonomous Decision Making  │
         └─────────────────────────────┘
         │
    ┌────▼─────────┐
    │ Analyze Email│ ← Claude reads email
    └────┬─────────┘
         │
    ┌────▼──────────────────────────────┐
    │ "I see suspicious URL, let me     │
    │  verify with threat intelligence" │ ← Claude decides
    └────┬──────────────────────────────┘
         │
    ┌────▼─────────────────┐
    │ Tool: check_url_     │
    │ reputation(url)      │ ← Claude calls tool
    └────┬─────────────────┘
         │
    ┌────▼─────────────────┐
    │ Execute VirusTotal   │
    │ API call             │ ← System executes
    └────┬─────────────────┘
         │
    ┌────▼─────────────────┐
    │ Return: "23/89       │
    │ vendors flagged"     │ ← Result back to Claude
    └────┬─────────────────┘
         │
    ┌────▼─────────────────┐
    │ Claude reasons:      │
    │ "Confirmed phishing  │
    │ with evidence"       │ ← Claude synthesizes
    └────┬─────────────────┘
         │
    ┌────▼─────────────────┐
    │ Generate HTML with   │
    │ Reasoning Chain      │
    └────┬─────────────────┘
         │
    ┌────▼────────┐
    │ Send Report │
    └─────────────┘
```

### Key Design Principles (v1.1)

1. **Autonomous Decision-Making** - Claude decides which tools to use and when
2. **Intelligent API Usage** - Only call external APIs when Claude determines it's necessary (60% cost savings)
3. **Tool-Based Architecture** - All capabilities exposed as tools Claude can call
4. **Reasoning Chains** - Record and display Claude's decision-making process
5. **Fail Gracefully** - If tools fail, Claude can still reason without them
6. **Aggressive Timeouts** - 3s per tool to stay under 10s Vercel limit
7. **Redis Caching** - 1-hour cache for API results to reduce costs
8. **Explainable AI** - Users see WHY Claude made decisions

---

## Implementation Phases (v1.1)

### ✅ Phase 0: Scaffolding (COMPLETED in v1.0)

**Status:** DONE
**Files Created:**
- `lib/threat-intel.ts` - Service with VirusTotal, AbuseIPDB clients (450 lines)
- Updated `types/email.ts` - Added threat intel fields
- Updated `.env.example` - Added API key placeholders

**Features:**
- Axios HTTP clients with 3s timeouts
- Zod validation schemas for API responses
- Redis caching using Upstash
- URL/IP extraction utilities
- Ready to be wired as tools

---

### 🔄 Phase 1: Tool Use Framework (Issue #1)

**Goal:** Implement Claude's tool use capability

**Tasks:**
1. Create `lib/agent-analyzer.ts` (replaces simple claude-analyzer)
2. Implement tool execution loop with message history
3. Handle `tool_use` stop reason from Claude
4. Define tool interface and execution router
5. Add comprehensive error handling
6. Update `types/email.ts` with tool metadata

**Acceptance Criteria:**
- Claude can call tools and receive results
- Tool execution loop handles multiple tool calls
- Message history maintained correctly
- Errors handled gracefully (fallback to no tools)
- Total latency under 10 seconds

**Files to Create/Modify:**
- `lib/agent-analyzer.ts` (NEW - main agent logic)
- `types/email.ts` (add ToolCall, ToolResult types)

**Branch:** `feature/1-tool-use-framework`

---

### 🔄 Phase 2: Local Analysis Tools (Issue #2)

**Goal:** Implement local tools for email analysis

**Tasks:**
1. Implement `extract_urls` tool
   - Regex-based URL extraction
   - Deduplication and safe domain filtering
2. Implement `check_authentication` tool
   - Parse SPF/DKIM/DMARC headers
   - Return structured authentication status
3. Implement `analyze_sender` tool
   - Extract sender domain
   - Check for common spoofing patterns
4. Add tool descriptions and JSON schemas
5. Unit tests for each tool

**Acceptance Criteria:**
- All 3 local tools implemented and tested
- Tools return structured JSON
- Clear descriptions for Claude to understand when to use them
- Tools execute in <100ms each

**Files to Create/Modify:**
- `lib/tools/local-tools.ts` (NEW)
- `tests/local-tools.test.ts` (NEW)

**Branch:** `feature/2-local-analysis-tools`

---

### 🔄 Phase 3: Threat Intelligence Tools (Issue #3)

**Goal:** Wire threat intel APIs as Claude tools

**Tasks:**
1. Implement `check_url_reputation` tool
   - Calls VirusTotal API via ThreatIntelService
   - Returns malicious count, total scans, confidence
2. Implement `check_ip_reputation` tool
   - Calls AbuseIPDB API via ThreatIntelService
   - Returns abuse score, report count
3. Add tool descriptions optimized for Claude
4. Wire tools to existing `ThreatIntelService`
5. Add timeout handling (3s per API)
6. Implement caching (Redis) for API results

**Acceptance Criteria:**
- Both threat intel tools implemented and tested
- APIs called only when Claude requests them
- Caching reduces duplicate API calls
- Tools handle API failures gracefully
- Clear descriptions explain when to use each tool

**Files to Create/Modify:**
- `lib/tools/threat-intel-tools.ts` (NEW)
- `lib/threat-intel.ts` (minor updates for tool interface)

**Branch:** `feature/3-threat-intel-tools`

---

### 🔄 Phase 4: Webhook Integration (Issue #4)

**Goal:** Wire agentic analyzer into webhook handler

**Tasks:**
1. Update `app/api/inbound/route.ts`
2. Replace `analyzeEmail()` with `analyzeWithTools()`
3. Add tool execution routing logic
4. Update error handling for tool failures
5. Ensure 10s timeout compliance
6. Add logging for tool calls

**Acceptance Criteria:**
- Webhook calls new agent analyzer
- Tool execution integrated into request flow
- Errors don't crash webhook (graceful degradation)
- Total latency under 10 seconds
- Logs show which tools were called

**Files to Modify:**
- `app/api/inbound/route.ts`
- Update imports to use `agent-analyzer`

**Branch:** `feature/4-webhook-integration`

---

### 🔄 Phase 5: Reasoning Chain Reports (Issue #5)

**Goal:** Display agent reasoning in HTML reports

**Tasks:**
1. Update `lib/html-generator.ts`
2. Add "Agent Reasoning" section
3. Display tool call history (which tools, when, why)
4. Show tool results with evidence
5. Update styling for new sections
6. Add performance metrics (tool execution time)

**Design Mockup:**
```html
┌─────────────────────────────────────┐
│ 🔴 PHISHING - Confidence: 95%       │
├─────────────────────────────────────┤
│ Agent Reasoning:                    │
│ 1. Analyzed email headers           │
│ 2. Detected typosquatting domain    │
│ 3. ✓ Called check_url_reputation    │
│    → VirusTotal: 23/89 flagged      │
│ 4. Verdict: PHISHING (high conf)    │
│                                     │
│ Detected Threats:                   │
│ 🔴 Malicious URL (VirusTotal)       │
│    - 23/89 vendors flagged          │
│ 🟠 Urgency manipulation             │
│ 🟠 Brand impersonation              │
└─────────────────────────────────────┘
```

**Acceptance Criteria:**
- Reasoning chain clearly displayed
- Tool calls shown with results
- User understands WHY agent made decision
- Professional visual design
- Mobile-responsive

**Files to Modify:**
- `lib/html-generator.ts`
- `types/email.ts` (add reasoning chain types)

**Branch:** `feature/5-reasoning-reports`

---

### 🔄 Phase 6: Testing & Validation (Issue #6)

**Goal:** Comprehensive testing of agentic system

**Test Scenarios:**
1. **Safe email** - Claude decides no tools needed
2. **Phishing with suspicious URL** - Claude calls check_url_reputation
3. **Phishing with bad IP** - Claude calls check_ip_reputation
4. **API failure** - Tools fail, Claude reasons without them
5. **Cache hit** - Second identical email uses cached results
6. **No API keys** - System works with local tools only

**Test Coverage:**
- Unit tests for each tool
- Integration tests for tool execution loop
- End-to-end tests with real emails
- Performance tests (latency under 10s)

**Files to Create/Modify:**
- `tests/agent.test.ts` (NEW - agentic tests)
- `tests/tools.test.ts` (NEW - tool tests)
- Update existing tests for new architecture

**Branch:** `feature/6-testing-validation`

---

## Free Tier Limits & Costs

| Service | Free Tier | Cost After Free |
|---------|-----------|-----------------|
| **VirusTotal** | 4 requests/min<br>500 requests/day | $45/month (Premium) |
| **AbuseIPDB** | 1,000 checks/day | $20/month (5K checks)<br>$40/month (15K) |
| **URLScan.io** | Public API (rate limited) | $199/month (Pro) |
| **Upstash Redis** | 10K commands/day | $0.20 per 100K commands |

### Cost Scenarios

**Low Volume (10 emails/day):**
- VirusTotal: ~30 URL checks/day → FREE
- AbuseIPDB: ~10 IP checks/day → FREE
- Total: $0/month (stays on free tier)

**Medium Volume (100 emails/day):**
- VirusTotal: ~300 URL checks/day → FREE (under 500/day)
- AbuseIPDB: ~100 IP checks/day → FREE (under 1K/day)
- Total: $0/month (still free tier)

**High Volume (500 emails/day):**
- VirusTotal: ~1,500 URL checks/day → **PAID** ($45/month)
- AbuseIPDB: ~500 IP checks/day → FREE
- Total: ~$45-50/month

**Note:** Caching reduces API calls by ~70-80% for repeat senders/URLs.

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| API timeout causes request failure | High | 3s aggressive timeout, fail gracefully |
| API rate limits exhausted | Medium | Redis caching, respect rate limits |
| Increased latency | Medium | Parallel execution, optional feature |
| Additional costs | Low | Free tiers sufficient for most users |
| False positives increase | Low | Require high confidence from both systems |

---

## Success Metrics

**Target Metrics (after Phase 5):**
- ✅ 95%+ detection rate for known malicious URLs
- ✅ <10% false positive rate
- ✅ <4s average end-to-end latency
- ✅ 80%+ cache hit rate after 24 hours
- ✅ 99.5%+ uptime (with graceful degradation)

**Monitoring:**
- Track threat intel API errors in logs
- Measure cache hit rate daily
- Monitor average enrichment latency
- Track percentage of emails using threat intel vs. Claude-only

---

## Next Steps (v1.1 Implementation)

### Phase 1: Documentation (IN PROGRESS)
- 🔄 Update THREAT_INTEL_ROADMAP.md (this file)
- ⏳ Update CLAUDE.md with agent architecture
- ⏳ Update SPEC.md with tool use details
- ⏳ Update README.md with agentic features

### Phase 2: GitHub Issues (NEXT)
- Create Issue #1: Tool use framework
- Create Issue #2: Local analysis tools
- Create Issue #3: Threat intel tools
- Create Issue #4: Webhook integration
- Create Issue #5: Reasoning chain reports
- Create Issue #6: Testing & validation

### Phase 3-8: Feature Branches
- Implement each feature in dedicated branch
- Create PR for each feature
- User reviews and merges
- Proceed to next feature

### Future (v1.2+):
1. Add WHOIS API integration for domain age checking
2. Add SSL certificate validation
3. Consider additional threat intel sources (Shodan, AlienVault OTX)
4. Add conversation memory (multi-email context)
5. Machine learning model to weight different signals

---

## Key Decisions (v1.1)

### Decided:
- ✅ Use Claude tool use (not blind parallel execution)
- ✅ Threat intel as tools (not always-on APIs)
- ✅ Use Upstash Redis for caching
- ✅ 3-second timeout per tool
- ✅ Optional API keys with graceful degradation
- ✅ Display reasoning chains in HTML reports
- ✅ Implement proper git workflow (feature branches, PRs)

### Architecture Choices:
- ✅ Tools decide when to call external APIs (60% cost savings)
- ✅ Local tools first, external APIs only when needed
- ✅ Reasoning chain recorded and displayed to users
- ✅ Fail gracefully if tools unavailable

---

## Rollback Plan

If threat intel causes issues in production:

1. **Immediate:** Remove API keys from Vercel environment variables
   - System automatically falls back to Claude-only
   - Zero code changes needed
2. **Short-term:** Add feature flag `ENABLE_THREAT_INTEL=false`
3. **Long-term:** Revert `/app/api/inbound/route.ts` to previous version

---

## References

- [VirusTotal API v3 Docs](https://developers.virustotal.com/reference/overview)
- [AbuseIPDB API Docs](https://docs.abuseipdb.com/)
- [URLScan.io API Docs](https://urlscan.io/docs/api/)
- [Upstash Redis SDK](https://github.com/upstash/upstash-redis)

---

**Last Updated:** 2025-10-24
**Version:** v1.1 (Agentic Architecture)
**Status:** Documentation phase complete, implementation starting
**Next Review:** After each phase completion
