// tests/local-tools.test.ts

import { extractUrls, checkAuthentication, analyzeSender } from '../lib/tools/local-tools';

describe('Local Analysis Tools', () => {
  describe('extractUrls', () => {
    it('should extract URLs from plaintext email body', () => {
      const result = extractUrls({
        email_body: 'Click here: https://example.com/verify and https://malicious.xyz/phish',
      });

      expect(result.success).toBe(true);
      expect(result.data.urls).toHaveLength(2);
      expect(result.data.total_found).toBe(2);
      expect(result.data.urls[0].url).toContain('example.com');
      expect(result.data.urls[1].url).toContain('malicious.xyz');
    });

    it('should deduplicate URLs found in both text and HTML', () => {
      const result = extractUrls({
        email_body: 'Visit https://example.com',
        email_html: '<a href="https://example.com">Click</a>',
      });

      expect(result.success).toBe(true);
      expect(result.data.urls).toHaveLength(1);
      expect(result.data.urls[0].url).toBe('https://example.com');
    });

    it('should identify safe domains', () => {
      const result = extractUrls({
        email_body: 'Login at https://google.com and https://suspicious-site.com',
      });

      expect(result.success).toBe(true);
      expect(result.data.urls).toHaveLength(2);

      const googleUrl = result.data.urls.find(u => u.domain.includes('google'));
      const suspiciousUrl = result.data.urls.find(u => u.domain.includes('suspicious'));

      expect(googleUrl?.is_safe_domain).toBe(true);
      expect(suspiciousUrl?.is_safe_domain).toBe(false);
    });

    it('should count suspicious URLs correctly', () => {
      const result = extractUrls({
        email_body: 'Visit https://gmail.com and https://paypa1.com',
      });

      expect(result.success).toBe(true);
      expect(result.data.total_found).toBe(2);
      expect(result.data.suspicious_count).toBe(1); // Only paypa1.com
    });

    it('should extract context around URLs', () => {
      const result = extractUrls({
        email_body: 'Please verify your account at https://example.com/verify within 24 hours.',
      });

      expect(result.success).toBe(true);
      expect(result.data.urls[0].context).toContain('verify your account');
      expect(result.data.urls[0].context).toContain('within 24 hours');
    });

    it('should handle emails with no URLs', () => {
      const result = extractUrls({
        email_body: 'This email has no URLs.',
      });

      expect(result.success).toBe(true);
      expect(result.data.urls).toHaveLength(0);
      expect(result.data.total_found).toBe(0);
      expect(result.data.suspicious_count).toBe(0);
    });

    it('should handle malformed URLs gracefully', () => {
      const result = extractUrls({
        email_body: 'Bad URL: htp://broken and good URL: https://example.com',
      });

      expect(result.success).toBe(true);
      expect(result.data.urls).toHaveLength(1);
      expect(result.data.urls[0].url).toBe('https://example.com');
    });
  });

  describe('checkAuthentication', () => {
    it('should parse SPF pass status', () => {
      const result = checkAuthentication({
        headers: {
          'received-spf': 'pass (google.com: domain of sender@example.com)',
        },
      });

      expect(result.success).toBe(true);
      expect(result.data.spf).toBe('pass');
    });

    it('should parse SPF fail status', () => {
      const result = checkAuthentication({
        headers: {
          'received-spf': 'fail (google.com: domain of sender@example.com)',
        },
      });

      expect(result.success).toBe(true);
      expect(result.data.spf).toBe('fail');
    });

    it('should parse SPF softfail status', () => {
      const result = checkAuthentication({
        headers: {
          'received-spf': 'softfail (google.com: domain of sender@example.com)',
        },
      });

      expect(result.success).toBe(true);
      expect(result.data.spf).toBe('softfail');
    });

    it('should parse DKIM pass from signature header', () => {
      const result = checkAuthentication({
        headers: {
          'dkim-signature': 'v=1; a=rsa-sha256; d=example.com',
        },
      });

      expect(result.success).toBe(true);
      expect(result.data.dkim).toBe('pass');
    });

    it('should parse DKIM from authentication-results', () => {
      const result = checkAuthentication({
        headers: {
          'authentication-results': 'mx.google.com; dkim=pass header.d=example.com',
        },
      });

      expect(result.success).toBe(true);
      expect(result.data.dkim).toBe('pass');
    });

    it('should parse DMARC from authentication-results', () => {
      const result = checkAuthentication({
        headers: {
          'authentication-results': 'mx.google.com; dmarc=pass (p=REJECT sp=REJECT)',
        },
      });

      expect(result.success).toBe(true);
      expect(result.data.dmarc).toBe('pass');
    });

    it('should return none for missing authentication headers', () => {
      const result = checkAuthentication({
        headers: {},
      });

      expect(result.success).toBe(true);
      expect(result.data.spf).toBe('none');
      expect(result.data.dkim).toBe('none');
      expect(result.data.dmarc).toBe('none');
    });

    it('should parse all three authentication methods', () => {
      const result = checkAuthentication({
        headers: {
          'received-spf': 'pass',
          'dkim-signature': 'v=1; a=rsa-sha256; d=example.com',
          'authentication-results': 'dmarc=pass',
        },
      });

      expect(result.success).toBe(true);
      expect(result.data.spf).toBe('pass');
      expect(result.data.dkim).toBe('pass');
      expect(result.data.dmarc).toBe('pass');
    });

    it('should include raw header values in details', () => {
      const spfHeader = 'pass (google.com: domain of sender@example.com)';
      const result = checkAuthentication({
        headers: {
          'received-spf': spfHeader,
        },
      });

      expect(result.success).toBe(true);
      expect(result.data.details.spf_raw).toBe(spfHeader);
    });
  });

  describe('analyzeSender', () => {
    it('should extract email from standard format', () => {
      const result = analyzeSender({
        from: 'user@example.com',
      });

      expect(result.success).toBe(true);
      expect(result.data.email).toBe('user@example.com');
      expect(result.data.domain).toBe('example.com');
    });

    it('should extract email from "Name <email>" format', () => {
      const result = analyzeSender({
        from: 'John Doe <john@example.com>',
      });

      expect(result.success).toBe(true);
      expect(result.data.email).toBe('john@example.com');
      expect(result.data.domain).toBe('example.com');
    });

    it('should detect display name with different email (high severity)', () => {
      const result = analyzeSender({
        from: 'John Doe <john@example.com>',
        display_name: 'PayPal Support <support@paypal.com>',
      });

      expect(result.success).toBe(true);
      expect(result.data.is_suspicious).toBe(true);
      expect(result.data.spoofing_indicators.length).toBeGreaterThan(0);

      const mismatchIndicator = result.data.spoofing_indicators.find(
        i => i.type === 'display_name_email_mismatch'
      );
      expect(mismatchIndicator).toBeDefined();
      expect(mismatchIndicator?.severity).toBe('high');
    });

    it('should detect brand impersonation with free email provider', () => {
      const result = analyzeSender({
        from: 'user@gmail.com',
        display_name: 'PayPal Security Team',
      });

      expect(result.success).toBe(true);
      expect(result.data.is_suspicious).toBe(true);

      const brandIndicator = result.data.spoofing_indicators.find(
        i => i.type === 'brand_impersonation'
      );
      expect(brandIndicator).toBeDefined();
      expect(brandIndicator?.severity).toBe('high');
      expect(brandIndicator?.description).toContain('paypal');
    });

    it('should detect typosquatting domains', () => {
      const result = analyzeSender({
        from: 'support@paypa1.com',
      });

      expect(result.success).toBe(true);
      expect(result.data.is_suspicious).toBe(true);

      const typoIndicator = result.data.spoofing_indicators.find(
        i => i.type === 'typosquatting'
      );
      expect(typoIndicator).toBeDefined();
      expect(typoIndicator?.severity).toBe('high');
      expect(typoIndicator?.description).toContain('paypal');
    });

    it('should detect suspicious TLDs', () => {
      const result = analyzeSender({
        from: 'admin@secure-login.tk',
      });

      expect(result.success).toBe(true);
      expect(result.data.is_suspicious).toBe(true);

      const tldIndicator = result.data.spoofing_indicators.find(
        i => i.type === 'suspicious_tld'
      );
      expect(tldIndicator).toBeDefined();
      expect(tldIndicator?.severity).toBe('medium');
    });

    it('should identify free email providers', () => {
      const gmailResult = analyzeSender({
        from: 'user@gmail.com',
      });

      expect(gmailResult.success).toBe(true);
      expect(gmailResult.data.free_email_provider).toBe(true);

      const businessResult = analyzeSender({
        from: 'admin@company.com',
      });

      expect(businessResult.success).toBe(true);
      expect(businessResult.data.free_email_provider).toBe(false);
    });

    it('should not flag legitimate emails as suspicious', () => {
      const result = analyzeSender({
        from: 'support@amazon.com',
        display_name: 'Amazon Customer Service',
      });

      expect(result.success).toBe(true);
      expect(result.data.is_suspicious).toBe(false);
      expect(result.data.spoofing_indicators).toHaveLength(0);
    });

    it('should detect numeric substitution in domains', () => {
      const result = analyzeSender({
        from: 'admin@micros0ft.com',
      });

      expect(result.success).toBe(true);
      expect(result.data.is_suspicious).toBe(true);

      const indicators = result.data.spoofing_indicators;
      const hasNumericOrTypo = indicators.some(
        i => i.type === 'numeric_substitution' || i.type === 'typosquatting'
      );
      expect(hasNumericOrTypo).toBe(true);
    });

    it('should handle multiple spoofing indicators', () => {
      const result = analyzeSender({
        from: 'support@paypa1.tk',
        display_name: 'PayPal Security',
      });

      expect(result.success).toBe(true);
      expect(result.data.is_suspicious).toBe(true);
      expect(result.data.spoofing_indicators.length).toBeGreaterThan(1);
    });
  });
});
