// tests/threat-intel-tools.test.ts

/**
 * Unit tests for threat intelligence tools (v1.1)
 *
 * These tests verify:
 * - Tool wrappers return correct ToolResult format
 * - Graceful handling of missing API keys
 * - Invalid input validation
 * - Success and error cases
 *
 * Note: These are unit tests that mock the ThreatIntelService.
 * Integration tests with real APIs would require API keys in CI.
 */

import { ThreatIntelService } from '../lib/threat-intel';

// Mock the ThreatIntelService module
jest.mock('../lib/threat-intel', () => {
  return {
    ThreatIntelService: jest.fn(),
  };
});

// Import after mock setup
import { checkUrlReputation, checkIpReputation } from '../lib/tools/threat-intel-tools';

describe('Threat Intelligence Tools', () => {
  let mockCheckUrlReputation: jest.Mock;
  let mockCheckIpReputation: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset mock implementations
    mockCheckUrlReputation = jest.fn();
    mockCheckIpReputation = jest.fn();

    // Mock the ThreatIntelService constructor
    (ThreatIntelService as jest.Mock).mockImplementation(() => ({
      checkUrlReputation: mockCheckUrlReputation,
      checkIpReputation: mockCheckIpReputation,
    }));
  });

  describe('checkUrlReputation', () => {
    it('should return success with malicious URL data from VirusTotal', async () => {
      process.env.VIRUSTOTAL_API_KEY = 'test-key';

      // Mock VirusTotal response
      const mockResult = {
        url: 'https://malicious-site.com/phish',
        malicious: true,
        maliciousCount: 15,
        totalScans: 85,
        detectedBy: ['Google', 'Kaspersky', 'BitDefender', 'Norton', 'McAfee', 'AVG'],
        confidenceScore: 0.18, // 15/85
      };

      mockCheckUrlReputation.mockResolvedValue(mockResult);

      const result = await checkUrlReputation({
        url: 'https://malicious-site.com/phish',
      });

      expect(result.success).toBe(true);
      expect(result.source).toBe('virustotal');
      expect(result.data?.malicious).toBe(true);
      expect(result.data?.malicious_count).toBe(15);
      expect(result.data?.total_scans).toBe(85);
      expect(result.data?.detected_by).toHaveLength(5); // Limited to 5 vendors
      expect(result.data?.confidence_score).toBe(0.18);
    });

    it('should return success with clean URL data from VirusTotal', async () => {
      process.env.VIRUSTOTAL_API_KEY = 'test-key';

      const mockResult = {
        url: 'https://google.com',
        malicious: false,
        maliciousCount: 0,
        totalScans: 85,
        detectedBy: [],
        confidenceScore: 0,
      };

      mockCheckUrlReputation.mockResolvedValue(mockResult);

      const result = await checkUrlReputation({
        url: 'https://google.com',
      });

      expect(result.success).toBe(true);
      expect(result.data?.malicious).toBe(false);
      expect(result.data?.malicious_count).toBe(0);
      expect(result.data?.detected_by).toHaveLength(0);
    });

    it('should return error when VirusTotal API key not configured', async () => {
      // Remove API key
      const originalKey = process.env.VIRUSTOTAL_API_KEY;
      delete process.env.VIRUSTOTAL_API_KEY;

      const result = await checkUrlReputation({
        url: 'https://example.com',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('VirusTotal API key not configured');
      expect(result.source).toBe('virustotal');

      // Restore API key
      if (originalKey) process.env.VIRUSTOTAL_API_KEY = originalKey;
    });

    it('should return error for invalid URL format', async () => {
      // Set a mock API key to bypass the key check
      process.env.VIRUSTOTAL_API_KEY = 'test-key';

      const result = await checkUrlReputation({
        url: 'not-a-valid-url',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid URL format');
      expect(result.source).toBe('virustotal');
    });

    it('should return error when VirusTotal API returns null', async () => {
      process.env.VIRUSTOTAL_API_KEY = 'test-key';

      mockCheckUrlReputation.mockResolvedValue(null);

      const result = await checkUrlReputation({
        url: 'https://example.com',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('VirusTotal API unavailable');
      expect(result.source).toBe('virustotal');
    });

    it('should handle API errors gracefully', async () => {
      process.env.VIRUSTOTAL_API_KEY = 'test-key';

      mockCheckUrlReputation.mockRejectedValue(new Error('Network timeout'));

      const result = await checkUrlReputation({
        url: 'https://example.com',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network timeout');
      expect(result.source).toBe('virustotal');
    });

    it('should limit detected_by list to 5 vendors', async () => {
      process.env.VIRUSTOTAL_API_KEY = 'test-key';

      const mockResult = {
        url: 'https://malicious-site.com',
        malicious: true,
        maliciousCount: 50,
        totalScans: 85,
        detectedBy: Array(50).fill('Vendor').map((v, i) => `${v}${i + 1}`),
        confidenceScore: 0.59,
      };

      mockCheckUrlReputation.mockResolvedValue(mockResult);

      const result = await checkUrlReputation({
        url: 'https://malicious-site.com',
      });

      expect(result.success).toBe(true);
      expect(result.data?.detected_by).toHaveLength(5); // Limited to 5
    });
  });

  describe('checkIpReputation', () => {
    it('should return success with malicious IP data from AbuseIPDB', async () => {
      process.env.ABUSEIPDB_API_KEY = 'test-key';

      const mockResult = {
        ip: '192.168.1.100',
        malicious: true,
        abuseConfidenceScore: 85,
        totalReports: 42,
      };

      mockCheckIpReputation.mockResolvedValue(mockResult);

      const result = await checkIpReputation({
        ip: '192.168.1.100',
      });

      expect(result.success).toBe(true);
      expect(result.source).toBe('abuseipdb');
      expect(result.data?.malicious).toBe(true);
      expect(result.data?.abuse_confidence_score).toBe(85);
      expect(result.data?.total_reports).toBe(42);
      expect(result.data?.risk_level).toBe('critical'); // >= 75
    });

    it('should return success with clean IP data from AbuseIPDB', async () => {
      process.env.ABUSEIPDB_API_KEY = 'test-key';

      const mockResult = {
        ip: '8.8.8.8',
        malicious: false,
        abuseConfidenceScore: 0,
        totalReports: 0,
      };

      mockCheckIpReputation.mockResolvedValue(mockResult);

      const result = await checkIpReputation({
        ip: '8.8.8.8',
      });

      expect(result.success).toBe(true);
      expect(result.data?.malicious).toBe(false);
      expect(result.data?.abuse_confidence_score).toBe(0);
      expect(result.data?.risk_level).toBe('low'); // < 25
    });

    it('should calculate correct risk levels', async () => {
      process.env.ABUSEIPDB_API_KEY = 'test-key';

      const testCases = [
        { score: 85, expectedRisk: 'critical' }, // >= 75
        { score: 60, expectedRisk: 'high' },     // >= 50
        { score: 40, expectedRisk: 'medium' },   // >= 25
        { score: 10, expectedRisk: 'low' },      // < 25
      ];

      for (const testCase of testCases) {
        const mockResult = {
          ip: '192.168.1.1',
          malicious: testCase.score >= 50,
          abuseConfidenceScore: testCase.score,
          totalReports: 10,
        };

        mockCheckIpReputation.mockResolvedValue(mockResult);

        const result = await checkIpReputation({
          ip: '192.168.1.1',
        });

        expect(result.data?.risk_level).toBe(testCase.expectedRisk);
      }
    });

    it('should return error when AbuseIPDB API key not configured', async () => {
      const originalKey = process.env.ABUSEIPDB_API_KEY;
      delete process.env.ABUSEIPDB_API_KEY;

      const result = await checkIpReputation({
        ip: '192.168.1.1',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('AbuseIPDB API key not configured');
      expect(result.source).toBe('abuseipdb');

      if (originalKey) process.env.ABUSEIPDB_API_KEY = originalKey;
    });

    it('should return error for invalid IP format', async () => {
      process.env.ABUSEIPDB_API_KEY = 'test-key';

      const invalidIps = [
        'not-an-ip',
        '256.256.256.256',
        '192.168.1',
        '192.168.1.1.1',
        '',
      ];

      for (const ip of invalidIps) {
        const result = await checkIpReputation({ ip });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Invalid IP address format');
        expect(result.source).toBe('abuseipdb');
      }
    });

    it('should return error when AbuseIPDB API returns null', async () => {
      process.env.ABUSEIPDB_API_KEY = 'test-key';

      mockCheckIpReputation.mockResolvedValue(null);

      const result = await checkIpReputation({
        ip: '192.168.1.1',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('AbuseIPDB API unavailable');
      expect(result.source).toBe('abuseipdb');
    });

    it('should handle API errors gracefully', async () => {
      process.env.ABUSEIPDB_API_KEY = 'test-key';

      mockCheckIpReputation.mockRejectedValue(new Error('Rate limit exceeded'));

      const result = await checkIpReputation({
        ip: '192.168.1.1',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Rate limit exceeded');
      expect(result.source).toBe('abuseipdb');
    });
  });

  describe('Integration with Agent Framework', () => {
    it('checkUrlReputation should return ToolResult format', async () => {
      process.env.VIRUSTOTAL_API_KEY = 'test-key';

      mockCheckUrlReputation.mockResolvedValue({
        url: 'https://example.com',
        malicious: false,
        maliciousCount: 0,
        totalScans: 85,
        detectedBy: [],
        confidenceScore: 0,
      });

      const result = await checkUrlReputation({ url: 'https://example.com' });

      // Verify ToolResult structure
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('source');
      expect(result.source).toBe('virustotal');

      if (result.success) {
        expect(result).toHaveProperty('data');
        expect(result.data).toHaveProperty('url');
        expect(result.data).toHaveProperty('malicious');
        expect(result.data).toHaveProperty('malicious_count');
        expect(result.data).toHaveProperty('total_scans');
        expect(result.data).toHaveProperty('detected_by');
        expect(result.data).toHaveProperty('confidence_score');
      }
    });

    it('checkIpReputation should return ToolResult format', async () => {
      process.env.ABUSEIPDB_API_KEY = 'test-key';

      mockCheckIpReputation.mockResolvedValue({
        ip: '8.8.8.8',
        malicious: false,
        abuseConfidenceScore: 0,
        totalReports: 0,
      });

      const result = await checkIpReputation({ ip: '8.8.8.8' });

      // Verify ToolResult structure
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('source');
      expect(result.source).toBe('abuseipdb');

      if (result.success) {
        expect(result).toHaveProperty('data');
        expect(result.data).toHaveProperty('ip');
        expect(result.data).toHaveProperty('malicious');
        expect(result.data).toHaveProperty('abuse_confidence_score');
        expect(result.data).toHaveProperty('total_reports');
        expect(result.data).toHaveProperty('risk_level');
      }
    });
  });
});
