// tests/email-loop.test.ts
import { describe, it, expect, beforeEach } from '@jest/globals';
import { detectEmailLoop } from '@/lib/email-loop-prevention';
import { EmailInput } from '@/types/email';

describe('Email Loop Detection', () => {
  const AGENT_EMAIL = 'g0t-phish@example.com';

  // Set environment variable for tests
  beforeEach(() => {
    process.env.RESEND_AGENT_EMAIL = AGENT_EMAIL;
  });

  const createTestEmail = (overrides: Partial<EmailInput>): EmailInput => ({
    from: 'test@example.com',
    to: AGENT_EMAIL,
    subject: 'Test Email',
    body: 'Test body',
    headers: {},
    receivedAt: new Date(),
    ...overrides,
  });

  it('should detect self-reply (exact match)', () => {
    const email = createTestEmail({ from: AGENT_EMAIL });
    const result = detectEmailLoop(email);

    expect(result.isLoop).toBe(true);
    expect(result.reason).toContain('self-reply');
    expect(result.checks.selfReply).toBe(true);
  });

  it('should detect same domain', () => {
    const email = createTestEmail({ from: 'another-agent@example.com' });
    const result = detectEmailLoop(email);

    expect(result.isLoop).toBe(true);
    expect(result.reason).toContain('same domain');
    expect(result.checks.sameDomain).toBe(true);
  });

  it('should detect auto-submitted header', () => {
    const email = createTestEmail({
      from: 'user@external.com', // Use external domain to avoid same-domain check
      headers: { 'auto-submitted': 'auto-replied' },
    });
    const result = detectEmailLoop(email);

    expect(result.isLoop).toBe(true);
    expect(result.reason).toContain('Auto-submitted');
    expect(result.checks.loopHeader).toBe(true);
  });

  it('should detect x-auto-response-suppress header', () => {
    const email = createTestEmail({
      from: 'user@external.com', // Use external domain to avoid same-domain check
      headers: { 'x-auto-response-suppress': 'All' },
    });
    const result = detectEmailLoop(email);

    expect(result.isLoop).toBe(true);
    expect(result.reason).toContain('Auto-response');
    expect(result.checks.loopHeader).toBe(true);
  });

  it('should detect excessive Re: prefixes', () => {
    const email = createTestEmail({
      from: 'user@external.com', // Use external domain to avoid same-domain check
      subject: 'Re: Re: Re: Original Subject',
    });
    const result = detectEmailLoop(email);

    expect(result.isLoop).toBe(true);
    expect(result.reason).toContain('Re:');
  });

  it('should allow legitimate external emails', () => {
    const email = createTestEmail({
      from: 'user@external.com',
      subject: 'Help me check this email',
    });
    const result = detectEmailLoop(email);

    expect(result.isLoop).toBe(false);
    expect(result.checks.selfReply).toBe(false);
    expect(result.checks.sameDomain).toBe(false);
    expect(result.checks.loopHeader).toBe(false);
  });

  it('should extract email from "Name <email>" format', () => {
    const email = createTestEmail({
      from: `g0t-phish Agent <${AGENT_EMAIL}>`,
    });
    const result = detectEmailLoop(email);

    expect(result.isLoop).toBe(true);
    expect(result.checks.selfReply).toBe(true);
  });

  it('should handle single Re: prefix (not loop)', () => {
    const email = createTestEmail({
      from: 'user@external.com',
      subject: 'Re: Original Subject',
    });
    const result = detectEmailLoop(email);

    expect(result.isLoop).toBe(false);
  });

  it('should handle two Re: prefixes (not loop)', () => {
    const email = createTestEmail({
      from: 'user@external.com',
      subject: 'Re: Re: Original Subject',
    });
    const result = detectEmailLoop(email);

    expect(result.isLoop).toBe(false);
  });
});
