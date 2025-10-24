// lib/tools/local-tools.ts

import { logger } from '@/utils/logger';

/**
 * Local analysis tools for email phishing detection (v1.1)
 * These tools execute locally in <100ms without external API calls
 */

// Common safe domains to filter out from URL extraction
const SAFE_DOMAINS = new Set([
  'google.com',
  'gmail.com',
  'microsoft.com',
  'outlook.com',
  'office.com',
  'apple.com',
  'icloud.com',
  'yahoo.com',
  'linkedin.com',
  'facebook.com',
  'twitter.com',
  'instagram.com',
  'youtube.com',
  'amazon.com',
  'github.com',
]);

/**
 * Extract URLs from email body and HTML content
 *
 * Uses regex to find URLs, deduplicates them, and filters out common safe domains.
 * Returns URLs that may be suspicious and worth checking further.
 */
export function extractUrls(input: {
  email_body: string;
  email_html?: string;
}): {
  success: boolean;
  data: {
    urls: Array<{
      url: string;
      context: string;
      domain: string;
      is_safe_domain: boolean;
    }>;
    total_found: number;
    suspicious_count: number;
  };
} {
  const startTime = Date.now();

  try {
    // Regex for URLs (http/https)
    const urlRegex = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/gi;

    const foundUrls = new Set<string>();
    const urlDetails: Array<{
      url: string;
      context: string;
      domain: string;
      is_safe_domain: boolean;
    }> = [];

    // Extract from plaintext body
    const textMatches = input.email_body.match(urlRegex) || [];
    textMatches.forEach((url) => foundUrls.add(url));

    // Extract from HTML if provided
    if (input.email_html) {
      const htmlMatches = input.email_html.match(urlRegex) || [];
      htmlMatches.forEach((url) => foundUrls.add(url));
    }

    // Process each unique URL
    foundUrls.forEach((url) => {
      try {
        const urlObj = new URL(url);
        const domain = urlObj.hostname.replace(/^www\./, '');

        // Check if domain is in safe list
        const rootDomain = domain.split('.').slice(-2).join('.');
        const isSafeDomain = SAFE_DOMAINS.has(rootDomain);

        // Get context (surrounding text)
        const urlIndex = input.email_body.indexOf(url);
        const contextStart = Math.max(0, urlIndex - 50);
        const contextEnd = Math.min(input.email_body.length, urlIndex + url.length + 50);
        const context = input.email_body.substring(contextStart, contextEnd).trim();

        urlDetails.push({
          url,
          context,
          domain,
          is_safe_domain: isSafeDomain,
        });
      } catch (error) {
        // Invalid URL, skip
        logger.warn('Invalid URL found during extraction', { url });
      }
    });

    const suspiciousUrls = urlDetails.filter((u) => !u.is_safe_domain);

    logger.info('URL extraction completed', {
      total: urlDetails.length,
      suspicious: suspiciousUrls.length,
      duration: Date.now() - startTime,
    });

    return {
      success: true,
      data: {
        urls: urlDetails,
        total_found: urlDetails.length,
        suspicious_count: suspiciousUrls.length,
      },
    };
  } catch (error) {
    logger.error('URL extraction failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return {
      success: false,
      data: {
        urls: [],
        total_found: 0,
        suspicious_count: 0,
      },
    };
  }
}

/**
 * Parse email authentication headers (SPF, DKIM, DMARC)
 *
 * Extracts authentication status from email headers and returns structured data.
 * Helps detect sender spoofing and authentication failures.
 */
export function checkAuthentication(input: {
  headers: Record<string, string>;
}): {
  success: boolean;
  data: {
    spf: 'pass' | 'fail' | 'neutral' | 'softfail' | 'none';
    dkim: 'pass' | 'fail' | 'neutral' | 'none';
    dmarc: 'pass' | 'fail' | 'neutral' | 'none';
    details: {
      spf_raw?: string;
      dkim_raw?: string;
      dmarc_raw?: string;
    };
  };
} {
  const startTime = Date.now();

  try {
    const headers = input.headers;

    // Parse SPF
    let spf: 'pass' | 'fail' | 'neutral' | 'softfail' | 'none' = 'none';
    const spfHeader =
      headers['received-spf'] ||
      headers['spf'] ||
      headers['SPF'] ||
      headers['Received-SPF'];

    if (spfHeader) {
      const spfLower = spfHeader.toLowerCase();
      if (spfLower.includes('pass')) spf = 'pass';
      else if (spfLower.includes('fail') && !spfLower.includes('softfail')) spf = 'fail';
      else if (spfLower.includes('softfail')) spf = 'softfail';
      else if (spfLower.includes('neutral')) spf = 'neutral';
    }

    // Parse DKIM
    let dkim: 'pass' | 'fail' | 'neutral' | 'none' = 'none';
    const dkimHeader =
      headers['dkim-signature'] ||
      headers['DKIM-Signature'] ||
      headers['dkim'] ||
      headers['authentication-results'];

    if (dkimHeader) {
      const dkimLower = dkimHeader.toLowerCase();
      if (dkimLower.includes('dkim=pass')) dkim = 'pass';
      else if (dkimLower.includes('dkim=fail')) dkim = 'fail';
      else if (dkimLower.includes('dkim=neutral')) dkim = 'neutral';
      // Note: Do NOT check for signature presence (v=1) alone
      // DKIM-Signature header is added by sender, not validator
      // Only trust explicit dkim=pass/fail from Authentication-Results
    }

    // Parse DMARC
    let dmarc: 'pass' | 'fail' | 'neutral' | 'none' = 'none';
    const dmarcHeader =
      headers['dmarc'] ||
      headers['DMARC'] ||
      headers['authentication-results'];

    if (dmarcHeader) {
      const dmarcLower = dmarcHeader.toLowerCase();
      if (dmarcLower.includes('dmarc=pass')) dmarc = 'pass';
      else if (dmarcLower.includes('dmarc=fail')) dmarc = 'fail';
      else if (dmarcLower.includes('dmarc=neutral')) dmarc = 'neutral';
    }

    logger.info('Authentication check completed', {
      spf,
      dkim,
      dmarc,
      duration: Date.now() - startTime,
    });

    return {
      success: true,
      data: {
        spf,
        dkim,
        dmarc,
        details: {
          spf_raw: spfHeader,
          dkim_raw: dkimHeader,
          dmarc_raw: dmarcHeader,
        },
      },
    };
  } catch (error) {
    logger.error('Authentication check failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return {
      success: false,
      data: {
        spf: 'none',
        dkim: 'none',
        dmarc: 'none',
        details: {},
      },
    };
  }
}

/**
 * Analyze sender email address and domain for spoofing patterns
 *
 * Checks for common spoofing techniques:
 * - Display name vs email mismatch
 * - Typosquatting (e.g., paypa1.com vs paypal.com)
 * - Suspicious TLDs
 * - Free email provider mismatches
 */
export function analyzeSender(input: {
  from: string;
  display_name?: string;
  subject?: string;
}): {
  success: boolean;
  data: {
    email: string;
    domain: string;
    is_suspicious: boolean;
    spoofing_indicators: Array<{
      type: string;
      severity: 'low' | 'medium' | 'high';
      description: string;
    }>;
    free_email_provider: boolean;
  };
} {
  const startTime = Date.now();

  try {
    // Extract email from "Name <email@domain.com>" format
    const emailMatch = input.from.match(/<(.+?)>/);
    const email = emailMatch ? emailMatch[1] : input.from;
    const displayName = input.display_name || input.from.split('<')[0].trim();

    // Extract domain
    const domainMatch = email.match(/@(.+)$/);
    const domain = domainMatch ? domainMatch[1].toLowerCase() : '';

    const spoofingIndicators: Array<{
      type: string;
      severity: 'low' | 'medium' | 'high';
      description: string;
    }> = [];

    // Check for free email providers
    const freeEmailProviders = new Set([
      'gmail.com',
      'yahoo.com',
      'outlook.com',
      'hotmail.com',
      'aol.com',
      'protonmail.com',
      'mail.com',
      'icloud.com',
    ]);
    const isFreeEmailProvider = freeEmailProviders.has(domain);

    // Check for display name mismatch
    if (displayName && displayName !== email && displayName.length > 0) {
      // Check if display name contains a different email
      const displayEmailMatch = displayName.match(/[\w\.-]+@[\w\.-]+\.\w+/);
      if (displayEmailMatch && displayEmailMatch[0] !== email) {
        spoofingIndicators.push({
          type: 'display_name_email_mismatch',
          severity: 'high',
          description: `Display name contains different email (${displayEmailMatch[0]}) than sender (${email})`,
        });
      }

      // Check if display name contains brand name but uses free email
      const brandNames = ['paypal', 'amazon', 'microsoft', 'apple', 'google', 'bank'];
      const displayLower = displayName.toLowerCase();
      brandNames.forEach((brand) => {
        if (displayLower.includes(brand) && isFreeEmailProvider) {
          spoofingIndicators.push({
            type: 'brand_impersonation',
            severity: 'high',
            description: `Display name "${displayName}" suggests ${brand} but uses free email provider ${domain}`,
          });
        }
      });
    }

    // Check for typosquatting patterns (common substitutions)
    const typosquattingPatterns = [
      { original: 'paypal', variants: ['paypa1', 'paypai', 'paypa'] },
      { original: 'amazon', variants: ['arnazon', 'amazom', 'amaz0n'] },
      { original: 'microsoft', variants: ['micros0ft', 'micr0soft'] },
      { original: 'apple', variants: ['appie', 'appl3'] },
    ];

    typosquattingPatterns.forEach((pattern) => {
      pattern.variants.forEach((variant) => {
        if (domain.includes(variant)) {
          spoofingIndicators.push({
            type: 'typosquatting',
            severity: 'high',
            description: `Domain ${domain} resembles ${pattern.original} (possible typosquatting)`,
          });
        }
      });
    });

    // Check for suspicious TLDs
    const suspiciousTlds = new Set([
      '.tk',
      '.ml',
      '.ga',
      '.cf',
      '.gq',
      '.xyz',
      '.top',
      '.work',
      '.click',
    ]);
    const tld = domain.substring(domain.lastIndexOf('.'));
    if (suspiciousTlds.has(tld)) {
      spoofingIndicators.push({
        type: 'suspicious_tld',
        severity: 'medium',
        description: `Domain uses suspicious TLD ${tld}`,
      });
    }

    // Check for numeric substitutions (l33t speak in domains)
    if (/[0-9]/.test(domain) && !domain.match(/^[a-z0-9-]+\.com$/)) {
      const hasNumericSubstitution = /[0o1l]/.test(domain);
      if (hasNumericSubstitution) {
        spoofingIndicators.push({
          type: 'numeric_substitution',
          severity: 'medium',
          description: `Domain contains suspicious numeric substitutions (${domain})`,
        });
      }
    }

    const isSuspicious = spoofingIndicators.length > 0;

    logger.info('Sender analysis completed', {
      email,
      domain,
      suspicious: isSuspicious,
      indicators: spoofingIndicators.length,
      duration: Date.now() - startTime,
    });

    return {
      success: true,
      data: {
        email,
        domain,
        is_suspicious: isSuspicious,
        spoofing_indicators: spoofingIndicators,
        free_email_provider: isFreeEmailProvider,
      },
    };
  } catch (error) {
    logger.error('Sender analysis failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return {
      success: false,
      data: {
        email: input.from,
        domain: 'unknown',
        is_suspicious: false,
        spoofing_indicators: [],
        free_email_provider: false,
      },
    };
  }
}
