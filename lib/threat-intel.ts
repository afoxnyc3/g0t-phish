/**
 * Threat Intelligence Enrichment for g0t-phish
 *
 * Integrates with:
 * - VirusTotal: URL reputation scanning
 * - AbuseIPDB: IP address reputation checking
 * - URLScan.io: Live URL analysis
 *
 * Adapted for Vercel serverless:
 * - Uses Upstash Redis for caching (not NodeCache)
 * - Aggressive timeouts (3s per service)
 * - Parallel execution with Promise.allSettled
 * - Graceful degradation if APIs unavailable
 */

import axios, { AxiosInstance } from 'axios';
import { Redis } from '@upstash/redis';
import { z } from 'zod';

// ============================================================================
// TYPES
// ============================================================================

export interface ThreatIntelResult {
  indicators: ThreatIndicator[];
  riskContribution: number;
  servicesUsed: string[];
}

export interface ThreatIndicator {
  type: 'url' | 'ip' | 'domain' | 'sender';
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  evidence: string;
  confidence: number; // 0-1
}

export interface UrlReputationResult {
  url: string;
  malicious: boolean;
  maliciousCount: number;
  totalScans: number;
  detectedBy: string[];
  confidenceScore: number;
}

export interface IpReputationResult {
  ip: string;
  malicious: boolean;
  abuseConfidenceScore: number;
  totalReports: number;
}

export interface DomainAgeResult {
  domain: string;
  ageDays: number;
  createdDate: string;
  suspicious: boolean;
}

// ============================================================================
// ZOD SCHEMAS FOR API VALIDATION
// ============================================================================

const VirusTotalUrlResponseSchema = z.object({
  data: z.object({
    attributes: z.object({
      last_analysis_stats: z.object({
        malicious: z.number(),
        suspicious: z.number(),
        harmless: z.number(),
        undetected: z.number(),
      }),
      last_analysis_results: z.record(z.any()).optional(),
    }),
  }),
});

const AbuseIPDBResponseSchema = z.object({
  data: z.object({
    abuseConfidenceScore: z.number(),
    totalReports: z.number(),
    ipAddress: z.string(),
  }),
});

// ============================================================================
// THREAT INTEL SERVICE
// ============================================================================

export class ThreatIntelService {
  private redis: Redis | null = null;
  private virusTotalClient?: AxiosInstance;
  private abuseIpDbClient?: AxiosInstance;
  private urlScanClient?: AxiosInstance;
  private enabled: boolean;
  private cacheTtl = 3600; // 1 hour in seconds

  constructor() {
    this.enabled = this.initializeClients();
    this.initializeRedisCache();
  }

  /**
   * Initialize Redis cache for threat intel results
   */
  private initializeRedisCache(): void {
    const redisUrl = process.env.UPSTASH_REDIS_REST_URL?.trim();
    const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();

    if (redisUrl && redisToken) {
      this.redis = new Redis({
        url: redisUrl,
        token: redisToken,
      });
    } else {
      this.redis = null;
      console.warn('[ThreatIntel] Redis not configured - caching disabled');
    }
  }

  /**
   * Initialize API clients for threat intelligence services
   */
  private initializeClients(): boolean {
    let hasAnyClient = false;

    // VirusTotal API
    if (process.env.VIRUSTOTAL_API_KEY) {
      this.virusTotalClient = axios.create({
        baseURL: 'https://www.virustotal.com/api/v3',
        headers: { 'x-apikey': process.env.VIRUSTOTAL_API_KEY },
        timeout: 3000, // 3s timeout for serverless
      });
      hasAnyClient = true;
    }

    // AbuseIPDB API
    if (process.env.ABUSEIPDB_API_KEY) {
      this.abuseIpDbClient = axios.create({
        baseURL: 'https://api.abuseipdb.com/api/v2',
        headers: { Key: process.env.ABUSEIPDB_API_KEY },
        timeout: 3000,
      });
      hasAnyClient = true;
    }

    // URLScan.io API
    if (process.env.URLSCAN_API_KEY) {
      this.urlScanClient = axios.create({
        baseURL: 'https://urlscan.io/api/v1',
        headers: { 'API-Key': process.env.URLSCAN_API_KEY },
        timeout: 3000,
      });
      hasAnyClient = true;
    }

    return hasAnyClient;
  }

  /**
   * Main enrichment function - analyzes URLs, IPs, and domains
   */
  async enrichEmail(
    senderEmail: string,
    senderIp: string | null,
    urls: string[]
  ): Promise<ThreatIntelResult> {
    if (!this.enabled) {
      return { indicators: [], riskContribution: 0, servicesUsed: [] };
    }

    const startTime = Date.now();
    const servicesUsed: string[] = [];
    const indicators: ThreatIndicator[] = [];
    let riskContribution = 0;

    // Perform all lookups in parallel
    const domain = this.extractDomain(senderEmail);
    const urlsToCheck = urls.slice(0, 5); // Limit to 5 URLs to avoid timeout

    const [urlResults, ipResult, domainResult] = await Promise.allSettled([
      // URL reputation checks (parallel)
      Promise.all(urlsToCheck.map(url => this.checkUrlReputation(url))),
      // IP reputation check
      senderIp ? this.checkIpReputation(senderIp) : Promise.resolve(null),
      // Domain age check
      domain ? this.checkDomainAge(domain) : Promise.resolve(null),
    ]);

    // Process URL results
    if (urlResults.status === 'fulfilled' && urlResults.value) {
      urlResults.value.forEach((result, i) => {
        if (result?.malicious) {
          const risk = 2.0 + (result.confidenceScore * 1.0);
          indicators.push({
            type: 'url',
            description: `Malicious URL detected by VirusTotal (${result.maliciousCount}/${result.totalScans} vendors)`,
            severity: result.confidenceScore > 0.5 ? 'critical' : 'high',
            evidence: `${urlsToCheck[i]} - Detected by: ${result.detectedBy.slice(0, 3).join(', ')}${result.detectedBy.length > 3 ? '...' : ''}`,
            confidence: result.confidenceScore,
          });
          riskContribution += risk;
          servicesUsed.push('VirusTotal');
        }
      });
    }

    // Process IP result
    if (ipResult.status === 'fulfilled' && ipResult.value?.malicious) {
      const ipData = ipResult.value;
      if (ipData.abuseConfidenceScore >= 50) {
        const risk = 1.5 + ((ipData.abuseConfidenceScore - 50) / 100);
        indicators.push({
          type: 'ip',
          description: `Sender IP flagged for abuse (${ipData.abuseConfidenceScore}% confidence)`,
          severity: ipData.abuseConfidenceScore >= 75 ? 'high' : 'medium',
          evidence: `${ipData.ip} - ${ipData.totalReports} abuse reports`,
          confidence: ipData.abuseConfidenceScore / 100,
        });
        riskContribution += risk;
        servicesUsed.push('AbuseIPDB');
      }
    }

    // Process domain age result
    if (domainResult.status === 'fulfilled' && domainResult.value) {
      const domainData = domainResult.value;
      if (domainData.ageDays >= 0 && domainData.ageDays < 30) {
        const risk = domainData.ageDays < 7 ? 2.0 : 1.0;
        indicators.push({
          type: 'domain',
          description: `Domain registered only ${domainData.ageDays} days ago`,
          severity: domainData.ageDays < 7 ? 'high' : 'medium',
          evidence: `${domainData.domain} - Created: ${domainData.createdDate}`,
          confidence: domainData.ageDays < 7 ? 0.9 : 0.7,
        });
        riskContribution += risk;
        servicesUsed.push('WHOIS');
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[ThreatIntel] Enrichment completed in ${duration}ms`, {
      indicators: indicators.length,
      riskContribution: riskContribution.toFixed(2),
      services: [...new Set(servicesUsed)],
    });

    return {
      indicators,
      riskContribution,
      servicesUsed: [...new Set(servicesUsed)],
    };
  }

  /**
   * Check URL reputation via VirusTotal API
   */
  async checkUrlReputation(url: string): Promise<UrlReputationResult | null> {
    if (!this.virusTotalClient) return null;

    const cacheKey = `threat:vt:url:${url}`;

    // Check cache first
    if (this.redis) {
      try {
        const cached = await this.redis.get<UrlReputationResult>(cacheKey);
        if (cached) return cached;
      } catch (error) {
        console.warn('[ThreatIntel] Redis cache read error:', error);
      }
    }

    try {
      // VirusTotal URL ID is base64-encoded URL without padding
      const urlId = Buffer.from(url).toString('base64').replace(/=/g, '');
      const response = await this.virusTotalClient.get(`/urls/${urlId}`);

      // Validate with Zod
      const validated = VirusTotalUrlResponseSchema.safeParse(response.data);
      if (!validated.success) {
        console.warn('[ThreatIntel] Invalid VirusTotal response', validated.error);
        return null;
      }

      const stats = validated.data.data.attributes.last_analysis_stats;
      const totalScans = stats.malicious + stats.suspicious + stats.harmless + stats.undetected;

      const result: UrlReputationResult = {
        url,
        malicious: stats.malicious > 0,
        maliciousCount: stats.malicious,
        totalScans,
        detectedBy: Object.keys(validated.data.data.attributes.last_analysis_results || {})
          .filter((vendor) => {
            const vendorResult = validated.data.data.attributes.last_analysis_results?.[vendor];
            return vendorResult?.category === 'malicious';
          }),
        confidenceScore: totalScans > 0 ? stats.malicious / totalScans : 0,
      };

      // Cache result
      if (this.redis) {
        try {
          await this.redis.setex(cacheKey, this.cacheTtl, JSON.stringify(result));
        } catch (error) {
          console.warn('[ThreatIntel] Redis cache write error:', error);
        }
      }

      return result;
    } catch (error: any) {
      console.warn('[ThreatIntel] VirusTotal API error:', error.message);
      return null;
    }
  }

  /**
   * Check IP reputation via AbuseIPDB
   */
  async checkIpReputation(ip: string): Promise<IpReputationResult | null> {
    if (!this.abuseIpDbClient) return null;

    const cacheKey = `threat:abuseipdb:${ip}`;

    // Check cache
    if (this.redis) {
      try {
        const cached = await this.redis.get<IpReputationResult>(cacheKey);
        if (cached) return cached;
      } catch (error) {
        console.warn('[ThreatIntel] Redis cache read error:', error);
      }
    }

    try {
      const response = await this.abuseIpDbClient.get('/check', {
        params: { ipAddress: ip, maxAgeInDays: 90 },
      });

      // Validate with Zod
      const validated = AbuseIPDBResponseSchema.safeParse(response.data);
      if (!validated.success) {
        console.warn('[ThreatIntel] Invalid AbuseIPDB response', validated.error);
        return null;
      }

      const data = validated.data.data;
      const result: IpReputationResult = {
        ip,
        malicious: data.abuseConfidenceScore >= 50,
        abuseConfidenceScore: data.abuseConfidenceScore,
        totalReports: data.totalReports,
      };

      // Cache result
      if (this.redis) {
        try {
          await this.redis.setex(cacheKey, this.cacheTtl, JSON.stringify(result));
        } catch (error) {
          console.warn('[ThreatIntel] Redis cache write error:', error);
        }
      }

      return result;
    } catch (error: any) {
      console.warn('[ThreatIntel] AbuseIPDB API error:', error.message);
      return null;
    }
  }

  /**
   * Check domain age (placeholder - would integrate with WHOIS API)
   * TODO: Integrate with actual WHOIS API service
   */
  async checkDomainAge(domain: string): Promise<DomainAgeResult | null> {
    const cacheKey = `threat:domain:${domain}`;

    // Check cache
    if (this.redis) {
      try {
        const cached = await this.redis.get<DomainAgeResult>(cacheKey);
        if (cached) return cached;
      } catch (error) {
        console.warn('[ThreatIntel] Redis cache read error:', error);
      }
    }

    // TODO: Implement actual WHOIS lookup
    // For now, return null to skip this check
    return null;
  }

  /**
   * Extract domain from email address
   */
  private extractDomain(email: string): string | null {
    const match = email.match(/@(.+)$/);
    return match ? match[1].toLowerCase() : null;
  }

  /**
   * Extract sender IP from email headers
   */
  extractSenderIp(headers: Array<{ key: string; value: string }>): string | null {
    // Look for X-Originating-IP or Received headers
    const ipHeader = headers.find(
      (h) => h.key.toLowerCase() === 'x-originating-ip'
    );

    if (ipHeader) {
      const match = ipHeader.value.match(/\[?(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\]?/);
      return match ? match[1] : null;
    }

    // Parse Received header for IP
    const receivedHeader = headers.find((h) => h.key.toLowerCase() === 'received');
    if (receivedHeader) {
      const match = receivedHeader.value.match(/\[?(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\]?/);
      return match ? match[1] : null;
    }

    return null;
  }

  /**
   * Extract URLs from email body
   */
  extractUrls(text: string): string[] {
    const urlRegex = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi;
    const matches = text.match(urlRegex) || [];

    // Deduplicate and filter out common safe domains
    const uniqueUrls = [...new Set(matches)];
    const safeDomains = ['unsubscribe', 'yourdomain.com']; // Customize as needed

    return uniqueUrls.filter(url => {
      return !safeDomains.some(domain => url.toLowerCase().includes(domain));
    });
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ enabled: boolean; services: string[] }> {
    const services: string[] = [];

    if (this.virusTotalClient) services.push('VirusTotal');
    if (this.abuseIpDbClient) services.push('AbuseIPDB');
    if (this.urlScanClient) services.push('URLScan');
    if (this.redis) services.push('Redis Cache');

    return {
      enabled: this.enabled,
      services,
    };
  }
}
