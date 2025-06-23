// TDD RED PHASE - Rate Limiting Middleware Tests
import { describe, it, expect, vi, beforeEach, afterEach, MockedFunction } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import {
    createRateLimiter,
    RateLimitConfig,
    RateLimitRule,
    createApiRateLimiter,
    createSearchRateLimiter,
    clearRateLimit
} from './rateLimit';

// Mock implementations
const mockRequest = (overrides: Partial<Request> = {}): Request => ({
    ip: '192.168.1.1',
    headers: {},
    method: 'GET',
    url: '/api/test',
    ...overrides,
} as Request);

const mockResponse = (): { res: Response; status: MockedFunction<any>; json: MockedFunction<any>; set: MockedFunction<any> } => {
    const res = {} as Response;
    const status = vi.fn().mockReturnThis();
    const json = vi.fn().mockReturnThis();
    const set = vi.fn().mockReturnThis();

    res.status = status;
    res.json = json;
    res.set = set;

    return { res, status, json, set };
};

const mockNext: NextFunction = vi.fn();

describe('Rate Limiting Middleware', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        // Clear rate limit data between tests
        clearRateLimit();
    });

    describe('Basic Rate Limiter', () => {
        it('should allow requests within rate limit', async () => {
            // Arrange
            const config: RateLimitConfig = {
                windowMs: 60000, // 1 minute
                maxRequests: 10,
                message: 'Too many requests',
            };
            const rateLimiter = createRateLimiter(config);
            const req = mockRequest();
            const { res, status, json } = mockResponse();
            const next = vi.fn();

            // Act
            await rateLimiter(req, res, next);

            // Assert
            expect(next).toHaveBeenCalledOnce();
            expect(status).not.toHaveBeenCalled();
            expect(json).not.toHaveBeenCalled();
        });

        it('should block requests exceeding rate limit', async () => {
            // Arrange
            const config: RateLimitConfig = {
                windowMs: 60000,
                maxRequests: 2,
                message: 'Rate limit exceeded',
            };
            const rateLimiter = createRateLimiter(config);
            const req = mockRequest();
            const { res, status, json } = mockResponse();
            const next = vi.fn();

            // Act - Make requests up to limit
            await rateLimiter(req, res, next);
            await rateLimiter(req, res, next);
            // This should exceed the limit
            await rateLimiter(req, res, next);

            // Assert
            expect(next).toHaveBeenCalledTimes(2);
            expect(status).toHaveBeenCalledWith(429);
            expect(json).toHaveBeenCalledWith({
                error: true,
                message: 'Rate limit exceeded',
                code: 'RATE_LIMIT_EXCEEDED',
                statusCode: 429,
                retryAfter: expect.any(Number),
            });
        });

        it('should reset rate limit after time window', async () => {
            // Arrange
            const config: RateLimitConfig = {
                windowMs: 100, // 100ms window for testing
                maxRequests: 1,
                message: 'Rate limit exceeded',
            };
            const rateLimiter = createRateLimiter(config);
            const req = mockRequest();
            const { res } = mockResponse();
            const next = vi.fn();

            // Act
            await rateLimiter(req, res, next);
            // Wait for window to reset
            await new Promise(resolve => setTimeout(resolve, 150));
            await rateLimiter(req, res, next);

            // Assert
            expect(next).toHaveBeenCalledTimes(2);
        });

        it('should track different IPs separately', async () => {
            // Arrange
            const config: RateLimitConfig = {
                windowMs: 60000,
                maxRequests: 1,
                message: 'Rate limit exceeded',
            };
            const rateLimiter = createRateLimiter(config);
            const req1 = mockRequest({ ip: '192.168.1.1' });
            const req2 = mockRequest({ ip: '192.168.1.2' });
            const { res } = mockResponse();
            const next = vi.fn();

            // Act
            await rateLimiter(req1, res, next);
            await rateLimiter(req2, res, next);

            // Assert - Both should be allowed
            expect(next).toHaveBeenCalledTimes(2);
        });
    });

    describe('Rate Limit Headers', () => {
        it('should set rate limit headers on successful request', async () => {
            // Arrange
            const config: RateLimitConfig = {
                windowMs: 60000,
                maxRequests: 10,
                message: 'Too many requests',
            };
            const rateLimiter = createRateLimiter(config);
            const req = mockRequest();
            const { res, set } = mockResponse();
            const next = vi.fn();

            // Act
            await rateLimiter(req, res, next);

            // Assert
            expect(set).toHaveBeenCalledWith('X-RateLimit-Limit', '10');
            expect(set).toHaveBeenCalledWith('X-RateLimit-Remaining', '9');
            expect(set).toHaveBeenCalledWith('X-RateLimit-Reset', expect.any(String));
        });

        it('should set retry-after header when rate limited', async () => {
            // Arrange
            const config: RateLimitConfig = {
                windowMs: 60000,
                maxRequests: 1,
                message: 'Rate limit exceeded',
            };
            const rateLimiter = createRateLimiter(config);
            const req = mockRequest();
            const { res, set } = mockResponse();
            const next = vi.fn();

            // Act
            await rateLimiter(req, res, next);
            await rateLimiter(req, res, next); // This should trigger rate limit

            // Assert
            expect(set).toHaveBeenCalledWith('Retry-After', expect.any(String));
        });
    });

    describe('Predefined Rate Limiters', () => {
        it('should create API rate limiter with correct defaults', () => {
            // Act
            const apiLimiter = createApiRateLimiter();

            // Assert
            expect(apiLimiter).toBeDefined();
            expect(typeof apiLimiter).toBe('function');
        });

        it('should create search rate limiter with stricter limits', () => {
            // Act
            const searchLimiter = createSearchRateLimiter();

            // Assert
            expect(searchLimiter).toBeDefined();
            expect(typeof searchLimiter).toBe('function');
        });

        it('should allow custom overrides for predefined limiters', () => {
            // Act
            const customApiLimiter = createApiRateLimiter({ maxRequests: 5 });
            const customSearchLimiter = createSearchRateLimiter({ windowMs: 30000 });

            // Assert
            expect(customApiLimiter).toBeDefined();
            expect(customSearchLimiter).toBeDefined();
        });
    });

    describe('Advanced Rate Limiting Features', () => {
        it('should support custom key generation', async () => {
            // Arrange
            const config: RateLimitConfig = {
                windowMs: 60000,
                maxRequests: 1,
                message: 'Rate limit exceeded',
                keyGenerator: (req) => `${req.ip}-${req.headers['user-agent']}`,
            };
            const rateLimiter = createRateLimiter(config);
            const req1 = mockRequest({
                ip: '192.168.1.1',
                headers: { 'user-agent': 'Mozilla/5.0' }
            });
            const req2 = mockRequest({
                ip: '192.168.1.1',
                headers: { 'user-agent': 'Chrome/90.0' }
            });
            const { res } = mockResponse();
            const next = vi.fn();

            // Act
            await rateLimiter(req1, res, next);
            await rateLimiter(req2, res, next);

            // Assert - Different user agents should be tracked separately
            expect(next).toHaveBeenCalledTimes(2);
        });

        it('should support skip function', async () => {
            // Arrange
            const config: RateLimitConfig = {
                windowMs: 60000,
                maxRequests: 1,
                message: 'Rate limit exceeded',
                skip: (req) => req.headers['x-skip-rate-limit'] === 'true',
            };
            const rateLimiter = createRateLimiter(config);
            const req = mockRequest({
                headers: { 'x-skip-rate-limit': 'true' }
            });
            const { res } = mockResponse();
            const next = vi.fn();

            // Act - Multiple requests should all be skipped
            await rateLimiter(req, res, next);
            await rateLimiter(req, res, next);

            // Assert
            expect(next).toHaveBeenCalledTimes(2);
        });
    });

    describe('Rate Limit Rules', () => {
        it('should apply different rules based on request properties', async () => {
            // Arrange
            const rules: RateLimitRule[] = [
                {
                    path: '/api/search',
                    method: 'GET',
                    windowMs: 60000,
                    maxRequests: 5,
                },
                {
                    path: '/api/properties',
                    method: 'POST',
                    windowMs: 60000,
                    maxRequests: 2,
                },
            ];
            const rateLimiter = createRateLimiter({ rules });
            const searchReq = mockRequest({ method: 'GET', url: '/api/search' });
            const postReq = mockRequest({ method: 'POST', url: '/api/properties' });
            const { res } = mockResponse();
            const next = vi.fn();

            // Act - Test different endpoints get different limits
            // Should be able to make 5 search requests
            for (let i = 0; i < 5; i++) {
                await rateLimiter(searchReq, res, next);
            }
            // Should be able to make 2 POST requests
            for (let i = 0; i < 2; i++) {
                await rateLimiter(postReq, res, next);
            }

            // Assert
            expect(next).toHaveBeenCalledTimes(7);
        });
    });
});