# Threat Intelligence Integration Roadmap

> **⚠️ STATUS: v2.0 FUTURE FEATURE - NOT IN CURRENT MVP**
>
> **Current Version:** v1.0 (Claude AI-only analysis)
> **Target Version:** v2.0 (Claude AI + Threat Intelligence)
> **Status:** Scaffolding complete, integration pending
>
> This document describes **future enhancements**. The current production system (v1.0) uses only Claude AI for phishing detection. Do not implement these features until v1.0 is stable and validated in production.

---

## Overview

This document outlines the phased integration of external threat intelligence services (VirusTotal, AbuseIPDB, URLScan.io) into g0t-phish to enhance phishing detection accuracy through objective, database-backed threat data.

**Goal:** Combine Claude AI's pattern recognition with concrete threat intelligence to achieve higher detection accuracy and confidence scores.

---

## Current State (v1.0)

**Detection Method:** 100% Claude AI analysis
- Authentication checks (SPF, DKIM, DMARC)
- Sender spoofing detection
- Social engineering patterns
- Brand impersonation

**Limitations:**
- No cross-validation with known threat databases
- Cannot detect URLs/IPs already flagged by security community
- Relies solely on AI pattern matching

---

## Target State (v2.0)

**Hybrid Detection:** Claude AI + Threat Intelligence
- Parallel execution of Claude + threat intel lookups (2-3s total latency)
- Cross-validation between AI and objective data sources
- Increased confidence scores when both systems agree
- Concrete evidence ("Flagged by 23/89 VirusTotal vendors")

---

## Architecture Design

### Parallel Execution Pattern

```
┌─────────────────┐
│  Email Received │
└────────┬────────┘
         │
    ┌────▼────┐
    │  Split  │
    └────┬────┘
         │
    ┌────┴─────────────────────┐
    │                          │
┌───▼──────────┐      ┌────────▼──────┐
│ Claude AI    │      │ Threat Intel  │
│ Analysis     │      │ Lookups       │
│              │      │               │
│ - Patterns   │      │ - VirusTotal  │
│ - Spoofing   │      │ - AbuseIPDB   │
│ - Social Eng │      │ - URLScan.io  │
└───┬──────────┘      └────────┬──────┘
    │                          │
    └────┬─────────────────────┘
         │
    ┌────▼─────────┐
    │ Merge Results│
    └────┬─────────┘
         │
    ┌────▼──────────┐
    │ Generate HTML │
    │ Report        │
    └────┬──────────┘
         │
    ┌────▼────────┐
    │ Send Email  │
    └─────────────┘
```

### Key Design Principles

1. **Fail Gracefully** - If threat intel APIs are unavailable, fall back to Claude-only analysis
2. **Aggressive Timeouts** - 3s per service to stay under 10s Vercel limit
3. **Redis Caching** - 1-hour cache for API results to reduce costs and latency
4. **Optional Services** - Each API key is optional; system adapts based on availability
5. **Parallel Execution** - All lookups happen simultaneously to minimize latency

---

## Implementation Phases

### ✅ Phase 0: Scaffolding (COMPLETED)

**Status:** DONE
**Files Created:**
- `lib/threat-intel.ts` - Service with VirusTotal, AbuseIPDB, URLScan clients
- Updated `types/email.ts` - Added threat intel fields to EmailAnalysis
- Updated `.env.example` - Added API key placeholders

**Features:**
- Axios HTTP clients with 3s timeouts
- Zod validation schemas for API responses
- Redis caching using Upstash
- URL/IP extraction utilities
- Health check endpoint

---

### 📋 Phase 1: Integration with Main Pipeline

**Goal:** Wire threat intel into the `/api/inbound` route

**Tasks:**
1. Import ThreatIntelService into `/app/api/inbound/route.ts`
2. Initialize service (singleton pattern for warm starts)
3. Add parallel execution with Claude analysis:
   ```typescript
   const [claudeResult, threatIntelResult] = await Promise.all([
     analyzeEmail(emailInput),
     threatIntelService.enrichEmail(email.from, senderIp, urls)
   ]);
   ```
4. Merge threat intel indicators into `claudeResult.threats` array
5. Calculate adjusted confidence score based on cross-validation
6. Add threat intel metadata to response

**Acceptance Criteria:**
- Threat intel lookups execute in parallel with Claude
- Total latency remains under 10 seconds
- System works with 0, 1, 2, or 3 API keys configured
- Logs show which services were used

**Files to Modify:**
- `app/api/inbound/route.ts` (main webhook handler)

---

### 📋 Phase 2: Enhanced HTML Reporting

**Goal:** Display threat intelligence findings in email reports

**Tasks:**
1. Update `lib/html-generator.ts` to render threat intel indicators
2. Add badges for threat intel sources (VirusTotal, AbuseIPDB)
3. Create separate section for "External Threat Intelligence"
4. Show which services were consulted
5. Display enrichment latency in performance metrics

**Design Mockup:**
```html
┌─────────────────────────────────────┐
│ 🔴 PHISHING - Confidence: 95%       │
├─────────────────────────────────────┤
│ Claude AI Analysis:                 │
│ • Urgency manipulation detected     │
│ • Suspicious sender domain          │
│                                     │
│ External Threat Intelligence:       │
│ 🔴 Malicious URL (VirusTotal)       │
│    - 23/89 vendors flagged          │
│    - URL: hxxp://evil[.]com         │
│                                     │
│ 🟠 Sender IP Flagged (AbuseIPDB)    │
│    - 87% abuse confidence           │
│    - 15 abuse reports               │
└─────────────────────────────────────┘
```

**Acceptance Criteria:**
- Threat intel threats clearly separated from Claude threats
- Service badges visible (VirusTotal, AbuseIPDB logos/text)
- Color coding matches severity
- Performance section shows enrichment latency

**Files to Modify:**
- `lib/html-generator.ts`

---

### 📋 Phase 3: Confidence Score Algorithm

**Goal:** Implement intelligent confidence score calculation

**Logic:**
```typescript
function calculateConfidence(
  claudeConfidence: number,
  threatIntelRisk: number,
  crossValidation: boolean
): number {
  let finalConfidence = claudeConfidence;

  // Boost confidence if both systems agree
  if (crossValidation) {
    finalConfidence = Math.min(100, claudeConfidence + 15);
  }

  // Add risk contribution from threat intel
  finalConfidence += threatIntelRisk;

  // Cap at 100
  return Math.min(100, finalConfidence);
}
```

**Cross-Validation Scenarios:**
- Both say phishing → +15% confidence boost
- Claude says phishing, threat intel neutral → No change
- Claude says safe, threat intel finds malicious URL → Override to suspicious/phishing

**Acceptance Criteria:**
- Confidence scores are higher when both systems agree
- Known malicious URLs always trigger at least "suspicious" verdict
- System never reduces confidence from threat intel

**Files to Modify:**
- `lib/claude-analyzer.ts` (add merging logic) OR
- Create new `lib/analysis-merger.ts` for separation of concerns

---

### 📋 Phase 4: Testing & Validation

**Goal:** Ensure threat intel works correctly across scenarios

**Test Cases:**
1. **All APIs Enabled** - Verify parallel execution and caching
2. **No API Keys** - Ensure graceful fallback to Claude-only
3. **Mixed Keys** - Works with only VirusTotal or only AbuseIPDB
4. **Known Malicious URL** - Test with URL known to be flagged
5. **Redis Cache Hit** - Verify second request uses cache
6. **API Timeout** - Verify 3s timeout doesn't block request
7. **API Error** - Verify error handling doesn't crash webhook

**Files to Create:**
- `tests/threat-intel.test.ts` - Unit tests for service
- `tests/integration.test.ts` - End-to-end tests

---

### 📋 Phase 5: Documentation & Deployment

**Goal:** Update docs and deploy to production

**Tasks:**
1. Update README.md with threat intel setup instructions
2. Add API key acquisition guide (VirusTotal, AbuseIPDB)
3. Update architecture diagram to show threat intel
4. Add cost analysis section (API pricing)
5. Create troubleshooting guide for API errors
6. Deploy to Vercel with new environment variables

**Acceptance Criteria:**
- README has clear setup instructions for each API
- Architecture diagram shows parallel execution
- Cost analysis includes API pricing tiers
- Deployed and working in production

**Files to Modify:**
- `README.md`

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

## Next Steps

### Immediate (This Sprint):
1. ✅ Complete Phase 0: Scaffolding (DONE)
2. 🔲 Start Phase 1: Integration with main pipeline
3. 🔲 Set up test VirusTotal/AbuseIPDB accounts
4. 🔲 Test with known malicious URLs

### Near Term (Next Sprint):
1. Complete Phase 2: Enhanced HTML reporting
2. Complete Phase 3: Confidence score algorithm
3. Begin Phase 4: Testing & validation

### Future:
1. Add WHOIS API integration for domain age checking
2. Add SSL certificate validation
3. Consider additional threat intel sources (Shodan, AlienVault OTX)
4. Machine learning model to weight different signals

---

## Questions & Decisions

### Decided:
- ✅ Use Upstash Redis for caching (not NodeCache)
- ✅ 3-second timeout per service
- ✅ Parallel execution with Promise.all
- ✅ Optional API keys with graceful degradation
- ✅ Merge threat intel into existing EmailAnalysis type

### To Decide:
- 🤔 Should threat intel override Claude's verdict? (Lean: Yes for known malicious)
- 🤔 Should we submit URLs to URLScan for live scanning? (Lean: No, too slow)
- 🤔 Should we store analysis history? (Lean: Future phase)
- 🤔 Should we add webhook for abuse reports? (Lean: Future)

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

**Last Updated:** 2025-10-23
**Status:** Phase 0 Complete, Ready for Phase 1
**Next Review:** After Phase 1 completion
