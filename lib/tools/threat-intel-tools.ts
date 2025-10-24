// lib/tools/threat-intel-tools.ts

import { logger } from '@/utils/logger';
import { ThreatIntelService } from '../threat-intel';

/**
 * Threat Intelligence Tools for Claude Agent (v1.1)
 *
 * These tools wrap the ThreatIntelService to provide Claude with access to:
 * - VirusTotal URL reputation checking
 * - AbuseIPDB IP reputation checking
 *
 * All tools:
 * - Execute with 3-second timeout
 * - Cache results in Redis (1-hour TTL)
 * - Return ToolResult format for agent framework
 * - Gracefully handle API failures
 */

/**
 * Get ThreatIntelService instance
 * Creates new instance for each call (serverless-friendly, no shared state)
 */
function getThreatIntelService(): ThreatIntelService {
  return new ThreatIntelService();
}

/**
 * Check URL reputation using VirusTotal API
 *
 * Tool for Claude to check if a URL has been flagged as malicious by security vendors.
 * Returns detection counts, vendor list, and confidence score.
 */
export async function checkUrlReputation(input: {
  url: string;
}): Promise<{
  success: boolean;
  data?: {
    url: string;
    malicious: boolean;
    malicious_count: number;
    total_scans: number;
    detected_by: string[];
    confidence_score: number;
    cached?: boolean;
  };
  error?: string;
  source: 'virustotal';
  cached?: boolean;
}> {
  const startTime = Date.now();

  try {
    const service = getThreatIntelService();

    // Validate API key is configured
    if (!process.env.VIRUSTOTAL_API_KEY) {
      logger.warn('VirusTotal API key not configured');
      return {
        success: false,
        error: 'VirusTotal API key not configured. Tool unavailable.',
        source: 'virustotal',
      };
    }

    // Validate URL format
    try {
      new URL(input.url);
    } catch (error) {
      return {
        success: false,
        error: `Invalid URL format: ${input.url}`,
        source: 'virustotal',
      };
    }

    logger.info('Checking URL reputation', { url: input.url });

    // Execute with timeout (handled by axios in ThreatIntelService - 3s)
    const result = await service.checkUrlReputation(input.url);

    if (!result) {
      // API call failed or returned null
      logger.warn('VirusTotal API returned null', { url: input.url });
      return {
        success: false,
        error: 'VirusTotal API unavailable or URL not found',
        source: 'virustotal',
      };
    }

    logger.info('URL reputation check completed', {
      url: input.url,
      malicious: result.malicious,
      duration: Date.now() - startTime,
    });

    return {
      success: true,
      data: {
        url: result.url,
        malicious: result.malicious,
        malicious_count: result.maliciousCount,
        total_scans: result.totalScans,
        detected_by: result.detectedBy.slice(0, 5), // Limit to 5 vendors for brevity
        confidence_score: result.confidenceScore,
      },
      source: 'virustotal',
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('URL reputation check failed', {
      url: input.url,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration,
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      source: 'virustotal',
    };
  }
}

/**
 * Check IP address reputation using AbuseIPDB
 *
 * Tool for Claude to check if an IP has been reported for abusive behavior.
 * Returns abuse confidence score (0-100) and total report count.
 */
export async function checkIpReputation(input: {
  ip: string;
}): Promise<{
  success: boolean;
  data?: {
    ip: string;
    malicious: boolean;
    abuse_confidence_score: number;
    total_reports: number;
    risk_level: 'low' | 'medium' | 'high' | 'critical';
    cached?: boolean;
  };
  error?: string;
  source: 'abuseipdb';
  cached?: boolean;
}> {
  const startTime = Date.now();

  try {
    const service = getThreatIntelService();

    // Validate API key is configured
    if (!process.env.ABUSEIPDB_API_KEY) {
      logger.warn('AbuseIPDB API key not configured');
      return {
        success: false,
        error: 'AbuseIPDB API key not configured. Tool unavailable.',
        source: 'abuseipdb',
      };
    }

    // Validate IP format (IPv4 check with octet validation)
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipRegex.test(input.ip)) {
      return {
        success: false,
        error: `Invalid IP address format: ${input.ip}`,
        source: 'abuseipdb',
      };
    }

    // Validate octets are in range 0-255
    const octets = input.ip.split('.');
    const invalidOctet = octets.some(octet => {
      const num = parseInt(octet, 10);
      return num < 0 || num > 255;
    });

    if (invalidOctet) {
      return {
        success: false,
        error: `Invalid IP address format: ${input.ip}`,
        source: 'abuseipdb',
      };
    }

    logger.info('Checking IP reputation', { ip: input.ip });

    // Execute with timeout (handled by axios in ThreatIntelService - 3s)
    const result = await service.checkIpReputation(input.ip);

    if (!result) {
      // API call failed or returned null
      logger.warn('AbuseIPDB API returned null', { ip: input.ip });
      return {
        success: false,
        error: 'AbuseIPDB API unavailable or IP not found',
        source: 'abuseipdb',
      };
    }

    // Determine risk level from confidence score
    let riskLevel: 'low' | 'medium' | 'high' | 'critical';
    if (result.abuseConfidenceScore >= 75) {
      riskLevel = 'critical';
    } else if (result.abuseConfidenceScore >= 50) {
      riskLevel = 'high';
    } else if (result.abuseConfidenceScore >= 25) {
      riskLevel = 'medium';
    } else {
      riskLevel = 'low';
    }

    logger.info('IP reputation check completed', {
      ip: input.ip,
      malicious: result.malicious,
      score: result.abuseConfidenceScore,
      duration: Date.now() - startTime,
    });

    return {
      success: true,
      data: {
        ip: result.ip,
        malicious: result.malicious,
        abuse_confidence_score: result.abuseConfidenceScore,
        total_reports: result.totalReports,
        risk_level: riskLevel,
      },
      source: 'abuseipdb',
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('IP reputation check failed', {
      ip: input.ip,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration,
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      source: 'abuseipdb',
    };
  }
}
