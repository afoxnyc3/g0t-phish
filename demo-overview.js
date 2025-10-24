#!/usr/bin/env node

/**
 * g0t-phish Agent Architecture Demo
 *
 * Run: node demo-overview.js
 *
 * This script provides a visual overview of the agentic system
 * for demo videos and presentations.
 */

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  red: '\x1b[31m',
};

const { cyan, green, yellow, blue, magenta, red, bright, dim, reset } = colors;

console.clear();

// Header
console.log(`
${cyan}${bright}╔════════════════════════════════════════════════════════════════╗
║                                                                ║
║                  🎯 g0t-phish v1.1 Agent System                ║
║                                                                ║
║            AI-Powered Phishing Detection with Tool Use         ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝${reset}
`);

// Project Overview
console.log(`${bright}📊 PROJECT OVERVIEW${reset}
${dim}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${reset}

  ${green}✓${reset} Serverless phishing detection agent
  ${green}✓${reset} Powered by Claude Haiku 4.5 with tool use
  ${green}✓${reset} <3 second analysis time (p95 <5s)
  ${green}✓${reset} 5-layer security defense
  ${green}✓${reset} Production-ready with 52/52 tests passing
`);

// Agent Architecture
console.log(`${bright}🤖 AGENTIC ARCHITECTURE${reset}
${dim}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${reset}

  ${blue}Core File:${reset} lib/agent-analyzer.ts (560 lines)

  ${magenta}┌─ Claude AI Agent${reset}
  ${magenta}│${reset}
  ${magenta}├──▶${reset} ${yellow}Analyzes email context${reset}
  ${magenta}├──▶${reset} ${yellow}Decides which tools to use${reset}
  ${magenta}├──▶${reset} ${yellow}Executes tools intelligently${reset}
  ${magenta}├──▶${reset} ${yellow}Synthesizes results${reset}
  ${magenta}└──▶${reset} ${yellow}Returns verdict + reasoning${reset}

  ${dim}Max 5 tool calls | 7s timeout | Multi-turn conversation${reset}
`);

// Available Tools
console.log(`${bright}🛠️  AVAILABLE TOOLS${reset}
${dim}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${reset}

  ${cyan}LOCAL TOOLS${reset} (No API keys required)
  ${dim}├─${reset} ${green}extract_urls${reset}          Extract & analyze URLs from email
  ${dim}├─${reset} ${green}check_authentication${reset}  Parse SPF/DKIM/DMARC headers
  ${dim}└─${reset} ${green}analyze_sender${reset}        Detect spoofing & typosquatting

  ${cyan}THREAT INTEL TOOLS${reset} (Optional, with caching)
  ${dim}├─${reset} ${green}check_url_reputation${reset}  VirusTotal URL scanning (85 vendors)
  ${dim}└─${reset} ${green}check_ip_reputation${reset}   AbuseIPDB IP abuse database
`);

// Request Flow
console.log(`${bright}🔄 REQUEST FLOW${reset}
${dim}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${reset}

  ${blue}1.${reset} Email → SendGrid → ${yellow}/api/inbound${reset} webhook
  ${blue}2.${reset} Loop Detection      ${dim}(4 checks)${reset}
  ${blue}3.${reset} Rate Limiting       ${dim}(10/hr per sender, 100/hr global)${reset}
  ${blue}4.${reset} Deduplication       ${dim}(SHA-256 content hash)${reset}
  ${blue}5.${reset} ${magenta}Agent Analysis${reset}      ${dim}(Claude + tools)${reset}
  ${blue}6.${reset} HTML Report         ${dim}(with reasoning chain)${reset}
  ${blue}7.${reset} Email Response      ${dim}(via Resend)${reset}

  ${green}✓${reset} Total latency: ~2-3 seconds
`);

// Security Layers
console.log(`${bright}🛡️  5-LAYER SECURITY${reset}
${dim}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${reset}

  ${red}Layer 1:${reset} Email Loop Prevention  ${dim}(4 detection methods)${reset}
  ${red}Layer 2:${reset} Rate Limiting           ${dim}(per-sender + global)${reset}
  ${red}Layer 3:${reset} Content Deduplication   ${dim}(1-hour window)${reset}
  ${red}Layer 4:${reset} Circuit Breaker         ${dim}(50 emails/10min)${reset}
  ${red}Layer 5:${reset} Input Validation        ${dim}(Zod schemas)${reset}
`);

// Key Features
console.log(`${bright}⭐ KEY FEATURES${reset}
${dim}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${reset}

  ${green}✓${reset} ${bright}Explainable AI${reset}     Reasoning chain shows decision process
  ${green}✓${reset} ${bright}Intelligent Tools${reset}  Claude decides when/which tools to use
  ${green}✓${reset} ${bright}Graceful Fallback${reset}  Works without external APIs
  ${green}✓${reset} ${bright}Performance${reset}        Redis caching (1hr TTL)
  ${green}✓${reset} ${bright}Cost Optimized${reset}     $2-10/month for 1K emails
  ${green}✓${reset} ${bright}Production Ready${reset}   52 tests, 100% pass rate
`);

// Example Analysis
console.log(`${bright}📧 EXAMPLE ANALYSIS${reset}
${dim}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${reset}

  ${yellow}Input:${reset} "Urgent: Verify your PayPal account"
  ${dim}       From: security@paypa1.com${reset}

  ${magenta}Agent Reasoning:${reset}
  ${dim}1.${reset} Extracted URLs → found suspicious link
  ${dim}2.${reset} Checked authentication → SPF failed
  ${dim}3.${reset} Analyzed sender → typosquatting detected (paypa1 ≠ paypal)
  ${dim}4.${reset} Called VirusTotal → 23/89 vendors flagged URL
  ${dim}5.${reset} Synthesis: High confidence phishing

  ${red}Verdict:${reset} ${bright}PHISHING${reset} (95% confidence)
  ${red}Threats:${reset} Spoofing, Malicious Link, Urgency Manipulation
  ${green}Tools Used:${reset} 4 tools in 1,234ms
`);

// Tech Stack
console.log(`${bright}🔧 TECH STACK${reset}
${dim}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${reset}

  ${cyan}AI:${reset}        Anthropic Claude Haiku 4.5
  ${cyan}Framework:${reset} Next.js 14.2.5 (App Router)
  ${cyan}Runtime:${reset}   Node.js on Vercel Serverless
  ${cyan}Database:${reset}  Upstash Redis (rate limiting + cache)
  ${cyan}Email:${reset}     SendGrid (inbound) + Resend (outbound)
  ${cyan}Language:${reset}  TypeScript 5.5.3 (strict mode)
  ${cyan}Testing:${reset}   Jest 29.7.0 (52 tests)
`);

// Performance Stats
console.log(`${bright}⚡ PERFORMANCE${reset}
${dim}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${reset}

  ${green}p50:${reset}  2.0s   ${dim}│${reset}  ${green}p95:${reset}  4.5s   ${dim}│${reset}  ${green}p99:${reset}  9.5s
  ${green}Tool execution:${reset} <100ms per tool (local), <2s (external)
  ${green}Cache hit rate:${reset} 80%+ after 24 hours
  ${green}Success rate:${reset}   99.5%+ uptime
`);

// Footer
console.log(`
${dim}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${reset}

  ${cyan}Repository:${reset}  github.com/afoxnyc3/g0t-phish
  ${cyan}Version:${reset}     1.1.0 (Agentic Architecture)
  ${cyan}Status:${reset}      ${green}Production Ready ✓${reset}

${dim}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${reset}

${cyan}${bright}Ready to analyze emails with AI-powered tool use! 🚀${reset}
`);
