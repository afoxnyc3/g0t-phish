// lib/rate-limiter.ts
import { Redis } from '@upstash/redis';
import { RateLimitCheck } from '@/types/email';
import { logger } from '@/utils/logger';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Rate limit configuration
const RATE_LIMITS = {
  perSender: {
    limit: 10, // Max emails per sender per hour
    windowMs: 60 * 60 * 1000, // 1 hour
  },
  global: {
    limit: 100, // Max total emails per hour
    windowMs: 60 * 60 * 1000, // 1 hour
  },
  circuitBreaker: {
    limit: 50, // Max emails in 10 minutes (triggers emergency shutdown)
    windowMs: 10 * 60 * 1000, // 10 minutes
  },
};

/**
 * LAYER 2: Rate limiting
 * Prevents abuse by limiting emails per sender and globally
 */
export async function checkRateLimit(from: string): Promise<RateLimitCheck> {
  const senderKey = `rate-limit:sender:${from}`;
  const globalKey = `rate-limit:global`;
  const circuitBreakerKey = `circuit-breaker:global`;

  try {
    // Check circuit breaker first (emergency shutdown)
    const circuitBreakerCount = await redis.incr(circuitBreakerKey);
    if (circuitBreakerCount === 1) {
      await redis.expire(circuitBreakerKey, RATE_LIMITS.circuitBreaker.windowMs / 1000);
    }

    if (circuitBreakerCount > RATE_LIMITS.circuitBreaker.limit) {
      logger.error('Circuit breaker triggered!', {
        count: circuitBreakerCount,
        limit: RATE_LIMITS.circuitBreaker.limit,
      });
      return {
        allowed: false,
        reason: 'Circuit breaker triggered (too many emails in 10 minutes)',
        limits: {
          perSender: { count: 0, limit: RATE_LIMITS.perSender.limit },
          global: { count: circuitBreakerCount, limit: RATE_LIMITS.circuitBreaker.limit },
        },
      };
    }

    // Check per-sender limit
    const senderCount = await redis.incr(senderKey);
    if (senderCount === 1) {
      await redis.expire(senderKey, RATE_LIMITS.perSender.windowMs / 1000);
    }

    if (senderCount > RATE_LIMITS.perSender.limit) {
      logger.warn('Per-sender rate limit exceeded', {
        from,
        count: senderCount,
        limit: RATE_LIMITS.perSender.limit,
      });
      return {
        allowed: false,
        reason: `Rate limit exceeded for sender (${senderCount}/${RATE_LIMITS.perSender.limit} per hour)`,
        limits: {
          perSender: { count: senderCount, limit: RATE_LIMITS.perSender.limit },
          global: { count: 0, limit: RATE_LIMITS.global.limit },
        },
      };
    }

    // Check global limit
    const globalCount = await redis.incr(globalKey);
    if (globalCount === 1) {
      await redis.expire(globalKey, RATE_LIMITS.global.windowMs / 1000);
    }

    if (globalCount > RATE_LIMITS.global.limit) {
      logger.warn('Global rate limit exceeded', {
        count: globalCount,
        limit: RATE_LIMITS.global.limit,
      });
      return {
        allowed: false,
        reason: `Global rate limit exceeded (${globalCount}/${RATE_LIMITS.global.limit} per hour)`,
        limits: {
          perSender: { count: senderCount, limit: RATE_LIMITS.perSender.limit },
          global: { count: globalCount, limit: RATE_LIMITS.global.limit },
        },
      };
    }

    // Rate limit passed
    return {
      allowed: true,
      limits: {
        perSender: { count: senderCount, limit: RATE_LIMITS.perSender.limit },
        global: { count: globalCount, limit: RATE_LIMITS.global.limit },
      },
    };
  } catch (error) {
    logger.error('Rate limit check failed', {
      from,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    // Fail open (allow request) to avoid blocking legitimate emails due to Redis errors
    return {
      allowed: true,
      limits: {
        perSender: { count: 0, limit: RATE_LIMITS.perSender.limit },
        global: { count: 0, limit: RATE_LIMITS.global.limit },
      },
    };
  }
}

/**
 * LAYER 3: Content deduplication
 * Prevents processing duplicate emails
 */
export async function checkDeduplication(subject: string, body: string): Promise<{ allowed: boolean; reason?: string }> {
  try {
    // Create content hash
    const contentHash = await hashContent(`${subject}|${body}`);
    const dedupeKey = `dedupe:${contentHash}`;

    // Check if we've seen this content recently
    const exists = await redis.get(dedupeKey);
    if (exists) {
      logger.info('Duplicate email detected', { contentHash });
      return {
        allowed: false,
        reason: 'Duplicate email (same subject + body within 1 hour)',
      };
    }

    // Mark as seen for 1 hour
    await redis.set(dedupeKey, '1', { ex: 60 * 60 });

    return { allowed: true };
  } catch (error) {
    logger.error('Deduplication check failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    // Fail open
    return { allowed: true };
  }
}

/**
 * Simple hash function using Web Crypto API
 */
async function hashContent(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
