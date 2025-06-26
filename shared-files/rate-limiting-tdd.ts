// ===== TEST SUITE 1: Basic Rate Limiting (4 tests) =====
// property-search-api/src/__tests__/middleware/rateLimiter.test.ts
import request from 'supertest';
import express from 'express';
import { RateLimiter, RateLimitConfig } from '../../middleware/RateLimiter';
import { createMockRedis } from '../helpers/mockRedis';

describe('Rate Limiting Middleware', () => {
  let app: express.Application;
  let mockRedis: any;
  let rateLimiter: RateLimiter;

  beforeEach(() => {
    app = express();
    mockRedis = createMockRedis();
    
    const config: RateLimitConfig = {
      windowMs: 60000, // 1 minute
      maxRequests: 5,
      redis: mockRedis,
      keyGenerator: (req) => req.ip,
      skipSuccessfulRequests: false,
      skipFailedRequests: false
    };
    
    rateLimiter = new RateLimiter(config);
    
    app.use('/api/test', rateLimiter.middleware());
    app.get('/api/test', (req, res) => {
      res.json({ success: true });
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('should allow requests within rate limit', async () => {
    mockRedis.incr.mockResolvedValue(1);
    mockRedis.expire.mockResolvedValue(1);
    mockRedis.ttl.mockResolvedValue(60);

    const response = await request(app)
      .get('/api/test')
      .expect(200);

    expect(response.headers['x-ratelimit-limit']).toBe('5');
    expect(response.headers['x-ratelimit-remaining']).toBe('4');
    expect(response.headers['x-ratelimit-reset']).toBeDefined();
  });

  test('should reject requests exceeding rate limit', async () => {
    mockRedis.incr.mockResolvedValue(6); // Exceeds limit of 5
    mockRedis.ttl.mockResolvedValue(30);

    const response = await request(app)
      .get('/api/test')
      .expect(429);

    expect(response.body).toMatchObject({
      error: 'Rate limit exceeded',
      retryAfter: expect.any(Number)
    });
    expect(response.headers['retry-after']).toBeDefined();
  });

  test('should handle Redis failures gracefully', async () => {
    mockRedis.incr.mockRejectedValue(new Error('Redis connection failed'));

    // Should still work but without rate limiting (fail-open approach)
    const response = await request(app)
      .get('/api/test')
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.headers['x-ratelimit-limit']).toBeUndefined();
  });

  test('should reset counter after window expires', async () => {
    // First request
    mockRedis.incr.mockResolvedValueOnce(1);
    mockRedis.expire.mockResolvedValueOnce(1);
    mockRedis.ttl.mockResolvedValueOnce(60);

    await request(app).get('/api/test').expect(200);

    // Simulate window expiry and new request
    mockRedis.incr.mockResolvedValueOnce(1); // Reset to 1
    mockRedis.expire.mockResolvedValueOnce(1);
    mockRedis.ttl.mockResolvedValueOnce(60);

    const response = await request(app).get('/api/test').expect(200);
    
    expect(response.headers['x-ratelimit-remaining']).toBe('4');
  });
});

// ===== TEST SUITE 2: Property-Specific Rate Limiting (4 tests) =====
// property-search-api/src/__tests__/middleware/propertyRateLimiter.test.ts
import { PropertyRateLimiter } from '../../middleware/PropertyRateLimiter';

describe('Property-Specific Rate Limiting', () => {
  let app: express.Application;
  let propertyLimiter: PropertyRateLimiter;
  let mockRedis: any;

  beforeEach(() => {
    app = express();
    mockRedis = createMockRedis();
    propertyLimiter = new PropertyRateLimiter(mockRedis);

    // Different rate limits for different endpoints
    app.use('/api/properties/search', propertyLimiter.searchLimiter());
    app.use('/api/properties/details', propertyLimiter.detailsLimiter());
    app.use('/api/properties/favorites', propertyLimiter.favoritesLimiter());

    app.get('/api/properties/search', (req, res) => res.json({ properties: [] }));
    app.get('/api/properties/details/:id', (req, res) => res.json({ property: {} }));
    app.post('/api/properties/favorites', (req, res) => res.json({ success: true }));
  });

  test('should apply different limits for search vs details', async () => {
    // Search endpoint: 100 requests per 15 minutes
    mockRedis.incr.mockResolvedValue(1);
    mockRedis.expire.mockResolvedValue(1);
    mockRedis.ttl.mockResolvedValue(900); // 15 minutes

    const searchResponse = await request(app)
      .get('/api/properties/search?query=london')
      .expect(200);

    expect(searchResponse.headers['x-ratelimit-limit']).toBe('100');

    // Details endpoint: 500 requests per 15 minutes
    const detailsResponse = await request(app)
      .get('/api/properties/details/123')
      .expect(200);

    expect(detailsResponse.headers['x-ratelimit-limit']).toBe('500');
  });

  test('should track authenticated vs anonymous users separately', async () => {
    const authToken = 'valid-jwt-token';
    
    // Mock authenticated user
    mockRedis.incr.mockResolvedValue(1);
    mockRedis.expire.mockResolvedValue(1);
    mockRedis.ttl.mockResolvedValue(900);

    const authResponse = await request(app)
      .get('/api/properties/search')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    // Authenticated users get higher limits
    expect(authResponse.headers['x-ratelimit-limit']).toBe('200'); // Higher limit

    // Anonymous user
    const anonResponse = await request(app)
      .get('/api/properties/search')
      .expect(200);

    expect(anonResponse.headers['x-ratelimit-limit']).toBe('100'); // Lower limit
  });

  test('should implement burst protection for property searches', async () => {
    // Simulate rapid burst of requests
    mockRedis.incr
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(6); // This should trigger burst protection

    mockRedis.expire.mockResolvedValue(1);
    mockRedis.ttl.mockResolvedValue(60);

    // First 5 requests should succeed
    for (let i = 0; i < 5; i++) {
      await request(app).get('/api/properties/search').expect(200);
    }

    // 6th request should be rate limited
    const response = await request(app)
      .get('/api/properties/search')
      .expect(429);

    expect(response.body.error).toContain('burst limit');
  });

  test('should allow premium users higher rate limits', async () => {
    const premiumToken = 'premium-user-token';
    
    mockRedis.incr.mockResolvedValue(1);
    mockRedis.expire.mockResolvedValue(1);
    mockRedis.ttl.mockResolvedValue(900);

    // Mock premium user detection
    jest.spyOn(propertyLimiter, 'getUserTier').mockReturnValue('premium');

    const response = await request(app)
      .get('/api/properties/search')
      .set('Authorization', `Bearer ${premiumToken}`)
      .expect(200);

    // Premium users get even higher limits
    expect(response.headers['x-ratelimit-limit']).toBe('500');
  });
});

// ===== TEST SUITE 3: Rate Limit Monitoring (3 tests) =====
// property-search-api/src/__tests__/middleware/rateLimitMonitoring.test.ts
import { RateLimitMonitor } from '../../middleware/RateLimitMonitor';

describe('Rate Limit Monitoring', () => {
  let monitor: RateLimitMonitor;
  let mockRedis: any;
  let mockEventEmitter: any;

  beforeEach(() => {
    mockRedis = createMockRedis();
    mockEventEmitter = {
      emit: jest.fn(),
      on: jest.fn()
    };
    monitor = new RateLimitMonitor(mockRedis, mockEventEmitter);
  });

  test('should track rate limit violations by IP', async () => {
    const violation = {
      ip: '192.168.1.1',
      endpoint: '/api/properties/search',
      timestamp: new Date(),
      requestsInWindow: 105,
      limit: 100
    };

    await monitor.recordViolation(violation);

    expect(mockRedis.zadd).toHaveBeenCalledWith(
      'rate_limit_violations',
      expect.any(Number),
      expect.stringContaining('192.168.1.1')
    );
    expect(mockEventEmitter.emit).toHaveBeenCalledWith('rateLimitViolation', violation);
  });

  test('should detect suspicious patterns', async () => {
    // Mock multiple violations from same IP
    mockRedis.zrange.mockResolvedValue([
      'violation1', 'violation2', 'violation3', 'violation4', 'violation5'
    ]);

    const suspiciousIPs = await monitor.detectSuspiciousActivity();

    expect(suspiciousIPs).toContain('192.168.1.1');
    expect(mockEventEmitter.emit).toHaveBeenCalledWith('suspiciousActivity', expect.objectContaining({
      type: 'repeated_violations',
      ip: '192.168.1.1'
    }));
  });

  test('should generate rate limiting analytics', async () => {
    mockRedis.hgetall.mockResolvedValue({
      'total_requests': '1000',
      'blocked_requests': '50',
      'unique_ips': '200'
    });

    const analytics = await monitor.getAnalytics();

    expect(analytics).toMatchObject({
      totalRequests: 1000,
      blockedRequests: 50,
      uniqueIPs: 200,
      blockRate: 0.05,
      topEndpoints: expect.any(Array)
    });
  });
});

// ===== IMPLEMENTATION: Core Rate Limiter =====
// property-search-api/src/middleware/RateLimiter.ts
import { Request, Response, NextFunction } from 'express';
import { Redis } from 'ioredis';
import { EventEmitter } from 'events';

export interface RateLimitConfig {
  windowMs: number;           // Time window in milliseconds
  maxRequests: number;        // Maximum requests per window
  redis: Redis;              // Redis instance
  keyGenerator?: (req: Request) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  skipWhen?: (req: Request) => boolean;
  onLimitReached?: (req: Request, res: Response) => void;
}

export interface RateLimitInfo {
  totalHits: number;
  totalReset: Date;
  remainingRequests: number;
}

export class RateLimiter extends EventEmitter {
  private config: RateLimitConfig;
  private redis: Redis;

  constructor(config: RateLimitConfig) {
    super();
    this.config = {
      keyGenerator: (req) => req.ip,
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
      ...config
    };
    this.redis = config.redis;
  }

  middleware() {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        // Check if request should be skipped
        if (this.config.skipWhen && this.config.skipWhen(req)) {
          return next();
        }

        const key = this.generateKey(req);
        const limit = await this.checkLimit(key);

        // Set rate limit headers
        this.setHeaders(res, limit);

        if (limit.totalHits > this.config.maxRequests) {
          this.handleLimitExceeded(req, res, limit);
          return;
        }

        // Track response for conditional skipping
        const originalSend = res.send;
        res.send = function(body) {
          const statusCode = res.statusCode;
          
          // Skip counting if configured
          if (
            (statusCode >= 200 && statusCode < 300 && config.skipSuccessfulRequests) ||
            (statusCode >= 400 && config.skipFailedRequests)
          ) {
            // Decrement counter for skipped requests
            that.decrementCounter(key);
          }
          
          return originalSend.call(this, body);
        };

        this.emit('requestProcessed', { key, limit, req });
        next();

      } catch (error) {
        // Fail open - allow request if rate limiting fails
        console.error('Rate limiting error:', error);
        next();
      }
    };
  }

  private generateKey(req: Request): string {
    const baseKey = this.config.keyGenerator!(req);
    const window = Math.floor(Date.now() / this.config.windowMs);
    return `rate_limit:${baseKey}:${window}`;
  }

  private async checkLimit(key: string): Promise<RateLimitInfo> {
    const pipeline = this.redis.pipeline();
    
    // Increment counter
    pipeline.incr(key);
    
    // Set expiry on first request
    pipeline.expire(key, Math.ceil(this.config.windowMs / 1000));
    
    // Get TTL for reset time calculation
    pipeline.ttl(key);
    
    const results = await pipeline.exec();
    
    if (!results) {
      throw new Error('Redis pipeline failed');
    }

    const totalHits = results[0][1] as number;
    const ttl = results[2][1] as number;
    
    const resetTime = new Date(Date.now() + (ttl * 1000));
    const remainingRequests = Math.max(0, this.config.maxRequests - totalHits);

    return {
      totalHits,
      totalReset: resetTime,
      remainingRequests
    };
  }

  private setHeaders(res: Response, limit: RateLimitInfo): void {
    res.set({
      'X-RateLimit-Limit': this.config.maxRequests.toString(),
      'X-RateLimit-Remaining': limit.remainingRequests.toString(),
      'X-RateLimit-Reset': limit.totalReset.toISOString()
    });
  }

  private handleLimitExceeded(req: Request, res: Response, limit: RateLimitInfo): void {
    const retryAfter = Math.ceil((limit.totalReset.getTime() - Date.now()) / 1000);
    
    res.set('Retry-After', retryAfter.toString());
    
    res.status(429).json({
      error: 'Rate limit exceeded',
      retryAfter,
      limit: this.config.maxRequests,
      resetTime: limit.totalReset.toISOString()
    });

    this.emit('limitExceeded', {
      ip: req.ip,
      key: this.generateKey(req),
      endpoint: req.path,
      limit: this.config.maxRequests,
      hits: limit.totalHits
    });

    if (this.config.onLimitReached) {
      this.config.onLimitReached(req, res);
    }
  }

  private async decrementCounter(key: string): Promise<void> {
    try {
      await this.redis.decr(key);
    } catch (error) {
      console.error('Failed to decrement rate limit counter:', error);
    }
  }
}

// ===== IMPLEMENTATION: Property-Specific Rate Limiter =====
// property-search-api/src/middleware/PropertyRateLimiter.ts
import { Request } from 'express';
import { RateLimiter, RateLimitConfig } from './RateLimiter';
import { Redis } from 'ioredis';
import jwt from 'jsonwebtoken';

export class PropertyRateLimiter {
  private redis: Redis;

  constructor(redis: Redis) {
    this.redis = redis;
  }

  // Property search rate limiter - more restrictive
  searchLimiter() {
    const config: RateLimitConfig = {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: this.getSearchLimit.bind(this),
      redis: this.redis,
      keyGenerator: this.generateSearchKey.bind(this)
    };

    return new RateLimiter(config).middleware();
  }

  // Property details rate limiter - less restrictive  
  detailsLimiter() {
    const config: RateLimitConfig = {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: this.getDetailsLimit.bind(this),
      redis: this.redis,
      keyGenerator: this.generateDetailsKey.bind(this)
    };

    return new RateLimiter(config).middleware();
  }

  // Favorites/actions rate limiter
  favoritesLimiter() {
    const config: RateLimitConfig = {
      windowMs: 5 * 60 * 1000, // 5 minutes
      maxRequests: 50, // Lower limit for write operations
      redis: this.redis,
      keyGenerator: this.generateActionKey.bind(this)
    };

    return new RateLimiter(config).middleware();
  }

  private getSearchLimit(req: Request): number {
    const userTier = this.getUserTier(req);
    
    switch (userTier) {
      case 'premium': return 500;
      case 'authenticated': return 200;
      case 'anonymous': return 100;
      default: return 50; // Conservative default
    }
  }

  private getDetailsLimit(req: Request): number {
    const userTier = this.getUserTier(req);
    
    switch (userTier) {
      case 'premium': return 2000;
      case 'authenticated': return 1000;
      case 'anonymous': return 500;
      default: return 200;
    }
  }

  getUserTier(req: Request): string {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return 'anonymous';
    }

    try {
      const token = authHeader.slice(7);
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
      
      return decoded.tier || 'authenticated';
    } catch (error) {
      return 'anonymous';
    }
  }

  private generateSearchKey(req: Request): string {
    const userTier = this.getUserTier(req);
    const identifier = userTier === 'anonymous' ? req.ip : this.getUserId(req);
    return `search:${userTier}:${identifier}`;
  }

  private generateDetailsKey(req: Request): string {
    const userTier = this.getUserTier(req);
    const identifier = userTier === 'anonymous' ? req.ip : this.getUserId(req);
    return `details:${userTier}:${identifier}`;
  }

  private generateActionKey(req: Request): string {
    const userTier = this.getUserTier(req);
    const identifier = userTier === 'anonymous' ? req.ip : this.getUserId(req);
    return `action:${userTier}:${identifier}`;
  }

  private getUserId(req: Request): string {
    try {
      const token = req.headers.authorization?.slice(7);
      const decoded = jwt.verify(token!, process.env.JWT_SECRET!) as any;
      return decoded.userId || req.ip;
    } catch {
      return req.ip;
    }
  }
}

// ===== IMPLEMENTATION: Rate Limit Monitor =====
// property-search-api/src/middleware/RateLimitMonitor.ts
import { Redis } from 'ioredis';
import { EventEmitter } from 'events';

export interface RateLimitViolation {
  ip: string;
  endpoint: string;
  timestamp: Date;
  requestsInWindow: number;
  limit: number;
  userAgent?: string;
  userId?: string;
}

export interface RateLimitAnalytics {
  totalRequests: number;
  blockedRequests: number;
  uniqueIPs: number;
  blockRate: number;
  topEndpoints: Array<{ endpoint: string; requests: number }>;
  topViolators: Array<{ ip: string; violations: number }>;
}

export class RateLimitMonitor {
  private redis: Redis;
  private eventEmitter: EventEmitter;

  constructor(redis: Redis, eventEmitter: EventEmitter) {
    this.redis = redis;
    this.eventEmitter = eventEmitter;
  }

  async recordViolation(violation: RateLimitViolation): Promise<void> {
    const key = 'rate_limit_violations';
    const score = violation.timestamp.getTime();
    const member = JSON.stringify({
      ip: violation.ip,
      endpoint: violation.endpoint,
      timestamp: violation.timestamp,
      requests: violation.requestsInWindow,
      limit: violation.limit
    });

    // Store violation with timestamp as score for time-based queries
    await this.redis.zadd(key, score, member);
    
    // Clean up old violations (older than 24 hours)
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
    await this.redis.zremrangebyscore(key, 0, oneDayAgo);

    // Track violation count per IP
    await this.redis.hincrby('violation_count_by_ip', violation.ip, 1);
    
    // Emit event for real-time monitoring
    this.eventEmitter.emit('rateLimitViolation', violation);
  }

  async detectSuspiciousActivity(): Promise<string[]> {
    const suspiciousIPs: string[] = [];
    
    // Get IPs with more than 5 violations in the last hour
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    const recentViolations = await this.redis.zrangebyscore(
      'rate_limit_violations',
      oneHourAgo,
      Date.now()
    );

    const ipViolationCount: Record<string, number> = {};
    
    for (const violation of recentViolations) {
      try {
        const parsed = JSON.parse(violation);
        ipViolationCount[parsed.ip] = (ipViolationCount[parsed.ip] || 0) + 1;
      } catch (error) {
        console.error('Failed to parse violation:', error);
      }
    }

    // Flag IPs with excessive violations
    for (const [ip, count] of Object.entries(ipViolationCount)) {
      if (count >= 5) {
        suspiciousIPs.push(ip);
        this.eventEmitter.emit('suspiciousActivity', {
          type: 'repeated_violations',
          ip,
          violationCount: count,
          timeWindow: '1 hour'
        });
      }
    }

    return suspiciousIPs;
  }

  async getAnalytics(): Promise<RateLimitAnalytics> {
    const [
      totalRequests,
      blockedRequests,
      uniqueIPs,
      topEndpoints,
      topViolators
    ] = await Promise.all([
      this.redis.hget('rate_limit_stats', 'total_requests'),
      this.redis.hget('rate_limit_stats', 'blocked_requests'),
      this.redis.hget('rate_limit_stats', 'unique_ips'),
      this.getTopEndpoints(),
      this.getTopViolators()
    ]);

    const total = parseInt(totalRequests || '0');
    const blocked = parseInt(blockedRequests || '0');

    return {
      totalRequests: total,
      blockedRequests: blocked,
      uniqueIPs: parseInt(uniqueIPs || '0'),
      blockRate: total > 0 ? blocked / total : 0,
      topEndpoints,
      topViolators
    };
  }

  private async getTopEndpoints(): Promise<Array<{ endpoint: string; requests: number }>> {
    const endpoints = await this.redis.hgetall('endpoint_request_count');
    
    return Object.entries(endpoints)
      .map(([endpoint, requests]) => ({ endpoint, requests: parseInt(requests) }))
      .sort((a, b) => b.requests - a.requests)
      .slice(0, 10);
  }

  private async getTopViolators(): Promise<Array<{ ip: string; violations: number }>> {
    const violators = await this.redis.hgetall('violation_count_by_ip');
    
    return Object.entries(violators)
      .map(([ip, violations]) => ({ ip, violations: parseInt(violations) }))
      .sort((a, b) => b.violations - a.violations)
      .slice(0, 10);
  }
}

// ===== INTEGRATION: Apply to Property Routes =====
// property-search-api/src/routes/properties.ts
import { Router } from 'express';
import { PropertyRateLimiter } from '../middleware/PropertyRateLimiter';
import { redis } from '../config/redis';

const router = Router();
const propertyLimiter = new PropertyRateLimiter(redis);

// Apply specific rate limits to property endpoints
router.use('/search', propertyLimiter.searchLimiter());
router.use('/details/:id', propertyLimiter.detailsLimiter());
router.use('/favorites', propertyLimiter.favoritesLimiter());

// Property search endpoint
router.get('/search', async (req, res) => {
  try {
    // Your existing search logic here
    const results = await searchProperties(req.query);
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: 'Search failed' });
  }
});

// Property details endpoint
router.get('/details/:id', async (req, res) => {
  try {
    const property = await getPropertyDetails(req.params.id);
    res.json(property);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get property details' });
  }
});

export { router as propertyRoutes };

// ===== CONFIGURATION: Environment Setup =====
// property-search-api/src/config/rateLimiting.ts
export const rateLimitConfig = {
  // Standard API endpoints
  default: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100
  },
  
  // Property search (resource intensive)
  propertySearch: {
    windowMs: 15 * 60 * 1000,
    maxRequests: {
      anonymous: 100,
      authenticated: 200,
      premium: 500
    }
  },
  
  // Property details (less intensive)
  propertyDetails: {
    windowMs: 15 * 60 * 1000,
    maxRequests: {
      anonymous: 500,
      authenticated: 1000,
      premium: 2000
    }
  },
  
  // Write operations (favorites, etc.)
  writeOperations: {
    windowMs: 5 * 60 * 1000, // 5 minutes
    maxRequests: 50
  }
};

// ===== MONITORING: Dashboard Endpoint =====
// property-search-api/src/routes/admin.ts
import { RateLimitMonitor } from '../middleware/RateLimitMonitor';

router.get('/rate-limit-stats', async (req, res) => {
  const monitor = new RateLimitMonitor(redis, eventEmitter);
  
  const [analytics, suspiciousIPs] = await Promise.all([
    monitor.getAnalytics(),
    monitor.detectSuspiciousActivity()
  ]);

  res.json({
    analytics,
    suspiciousIPs,
    timestamp: new Date().toISOString()
  });
});
