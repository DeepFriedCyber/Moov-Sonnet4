import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { createApiLimiter, createAuthLimiter, RateLimitConfig } from '../rateLimit';

// Mock Redis client
const mockRedisClient = {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    incr: vi.fn(),
    expire: vi.fn(),
    ttl: vi.fn(),
};

// Mock express-rate-limit
vi.mock('express-rate-limit', () => ({
    default: vi.fn((config) => {
        return (req: Request, res: Response, next: NextFunction) => {
            // Mock rate limiter behavior
            const key = `rate-limit:${req.ip}`;
            const current = mockRedisClient.get(key) || 0;

            if (current >= config.max) {
                return res.status(429).json({
                    error: config.message || 'Too many requests',
                    retryAfter: config.windowMs / 1000,
                });
            }

            mockRedisClient.incr(key);
            res.setHeader('X-RateLimit-Limit', config.max);
            res.setHeader('X-RateLimit-Remaining', config.max - current - 1);
            res.setHeader('X-RateLimit-Reset', Date.now() + config.windowMs);

            next();
        };
    }),
}));

// Mock rate-limit-redis
vi.mock('rate-limit-redis', () => ({
    default: vi.fn().mockImplementation(() => ({
        incr: mockRedisClient.incr,
        decrement: vi.fn(),
        resetKey: vi.fn(),
    })),
}));

describe('Rate Limiting Middleware', () => {
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;
    let mockNext: NextFunction;

    beforeEach(() => {
        mockReq = {
            ip: '127.0.0.1',
            method: 'GET',
            path: '/api/test',
        };

        mockRes = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn().mockReturnThis(),
            setHeader: vi.fn().mockReturnThis(),
        };

        mockNext = vi.fn();

        // Reset all mocks
        vi.clearAllMocks();
    });

    describe('createApiLimiter', () => {
        it('should create API rate limiter with default config', () => {
            // Act
            const limiter = createApiLimiter();

            // Assert
            expect(limiter).toBeDefined();
            expect(typeof limiter).toBe('function');
        });

        it('should create API rate limiter with custom config', () => {
            // Arrange
            const customConfig: RateLimitConfig = {
                windowMs: 10 * 60 * 1000, // 10 minutes
                max: 50,
                message: 'Custom rate limit message',
            };

            // Act
            const limiter = createApiLimiter(customConfig);

            // Assert
            expect(limiter).toBeDefined();
            expect(typeof limiter).toBe('function');
        });

        it('should allow requests within rate limit', async () => {
            // Arrange
            const limiter = createApiLimiter({ max: 5, windowMs: 60000 });
            mockRedisClient.get.mockReturnValue(2); // Current count is 2

            // Act
            limiter(mockReq as Request, mockRes as Response, mockNext);

            // Assert
            expect(mockNext).toHaveBeenCalled();
            expect(mockRes.status).not.toHaveBeenCalledWith(429);
            expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', 5);
            expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', 2);
        });

        it('should block requests exceeding rate limit', async () => {
            // Arrange
            const limiter = createApiLimiter({ max: 5, windowMs: 60000 });
            mockRedisClient.get.mockReturnValue(5); // At limit

            // Act
            limiter(mockReq as Request, mockRes as Response, mockNext);

            // Assert
            expect(mockNext).not.toHaveBeenCalled();
            expect(mockRes.status).toHaveBeenCalledWith(429);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'Too many requests from this IP, please try again later.',
                retryAfter: 60,
            });
        });

        it('should set correct rate limit headers', async () => {
            // Arrange
            const limiter = createApiLimiter({ max: 100, windowMs: 15 * 60 * 1000 });
            mockRedisClient.get.mockReturnValue(25);

            // Act
            limiter(mockReq as Request, mockRes as Response, mockNext);

            // Assert
            expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', 100);
            expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', 74);
            expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Reset', expect.any(Number));
        });
    });

    describe('createAuthLimiter', () => {
        it('should create auth rate limiter with stricter limits', () => {
            // Act
            const limiter = createAuthLimiter();

            // Assert
            expect(limiter).toBeDefined();
            expect(typeof limiter).toBe('function');
        });

        it('should create auth rate limiter with custom config', () => {
            // Arrange
            const customConfig: RateLimitConfig = {
                windowMs: 5 * 60 * 1000, // 5 minutes
                max: 3,
                message: 'Too many authentication attempts',
            };

            // Act
            const limiter = createAuthLimiter(customConfig);

            // Assert
            expect(limiter).toBeDefined();
            expect(typeof limiter).toBe('function');
        });

        it('should allow auth requests within limit', async () => {
            // Arrange
            const limiter = createAuthLimiter({ max: 5, windowMs: 60000 });
            mockRedisClient.get.mockReturnValue(2);

            // Act
            limiter(mockReq as Request, mockRes as Response, mockNext);

            // Assert
            expect(mockNext).toHaveBeenCalled();
            expect(mockRes.status).not.toHaveBeenCalledWith(429);
        });

        it('should block excessive auth attempts', async () => {
            // Arrange
            const limiter = createAuthLimiter({ max: 3, windowMs: 60000 });
            mockRedisClient.get.mockReturnValue(3); // At limit

            // Act
            limiter(mockReq as Request, mockRes as Response, mockNext);

            // Assert
            expect(mockNext).not.toHaveBeenCalled();
            expect(mockRes.status).toHaveBeenCalledWith(429);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'Too many authentication attempts, please try again later.',
                retryAfter: 60,
            });
        });

        it('should handle different IPs independently', async () => {
            // Arrange
            const limiter = createApiLimiter({ max: 5, windowMs: 60000 });
            const req1 = { ...mockReq, ip: '192.168.1.1' };
            const req2 = { ...mockReq, ip: '192.168.1.2' };

            mockRedisClient.get.mockImplementation((key) => {
                if (key.includes('192.168.1.1')) return 4; // Near limit
                if (key.includes('192.168.1.2')) return 1; // Well under limit
                return 0;
            });

            // Act
            limiter(req1 as Request, mockRes as Response, mockNext);
            const nextCallCount1 = mockNext.mock.calls.length;

            limiter(req2 as Request, mockRes as Response, mockNext);
            const nextCallCount2 = mockNext.mock.calls.length;

            // Assert
            expect(nextCallCount1).toBe(1); // First IP allowed
            expect(nextCallCount2).toBe(2); // Second IP also allowed
        });
    });

    describe('Rate Limit Configuration', () => {
        it('should handle missing Redis gracefully', () => {
            // Arrange
            const config: RateLimitConfig = {
                windowMs: 60000,
                max: 10,
                skipRedis: true,
            };

            // Act
            const limiter = createApiLimiter(config);

            // Assert
            expect(limiter).toBeDefined();
            expect(typeof limiter).toBe('function');
        });

        it('should support custom key generator', async () => {
            // Arrange
            const customKeyGen = (req: Request) => `custom:${req.ip}:${req.path}`;
            const config: RateLimitConfig = {
                windowMs: 60000,
                max: 10,
                keyGenerator: customKeyGen,
            };

            // Act
            const limiter = createApiLimiter(config);

            // Assert
            expect(limiter).toBeDefined();
        });

        it('should support skip function', async () => {
            // Arrange
            const skipFunction = (req: Request) => req.ip === '127.0.0.1';
            const config: RateLimitConfig = {
                windowMs: 60000,
                max: 10,
                skip: skipFunction,
            };

            // Act
            const limiter = createApiLimiter(config);

            // Assert
            expect(limiter).toBeDefined();
        });

        it('should validate configuration parameters', () => {
            // Arrange & Act & Assert
            expect(() => createApiLimiter({ max: -1, windowMs: 60000 })).toThrow();
            expect(() => createApiLimiter({ max: 10, windowMs: -1 })).toThrow();
            expect(() => createApiLimiter({ max: 0, windowMs: 60000 })).toThrow();
        });
    });

    describe('Error Handling', () => {
        it('should handle Redis connection errors gracefully', async () => {
            // Arrange
            mockRedisClient.get.mockRejectedValue(new Error('Redis connection failed'));
            const limiter = createApiLimiter({ max: 5, windowMs: 60000 });

            // Act & Assert - Should not throw, should fall back to memory store
            expect(() => {
                limiter(mockReq as Request, mockRes as Response, mockNext);
            }).not.toThrow();
        });

        it('should handle malformed requests', async () => {
            // Arrange
            const limiter = createApiLimiter({ max: 5, windowMs: 60000 });
            const malformedReq = { ...mockReq, ip: undefined };

            // Act & Assert
            expect(() => {
                limiter(malformedReq as Request, mockRes as Response, mockNext);
            }).not.toThrow();
        });
    });
});