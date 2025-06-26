import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
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
        // Reset pipeline instance for each test
        mockRedis._pipelineInstance = null;

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
        vi.clearAllMocks();
    });

    it('should allow requests within rate limit', async () => {
        mockRedis.pipeline().exec.mockResolvedValue([
            [null, 1], // incr result
            [null, 1], // expire result
            [null, 60] // ttl result
        ]);

        const response = await request(app)
            .get('/api/test')
            .expect(200);

        expect(response.headers['x-ratelimit-limit']).toBe('5');
        expect(response.headers['x-ratelimit-remaining']).toBe('4');
        expect(response.headers['x-ratelimit-reset']).toBeDefined();
    });

    it('should reject requests exceeding rate limit', async () => {
        // Set up the pipeline mock to return 6 hits (exceeds limit of 5)
        mockRedis.pipeline().exec.mockResolvedValue([
            [null, 6], // incr result - exceeds limit of 5
            [null, 1], // expire result
            [null, 30] // ttl result
        ]);

        const response = await request(app)
            .get('/api/test')
            .expect(429);

        expect(response.status).toBe(429);
        expect(response.body).toMatchObject({
            error: 'Rate limit exceeded',
            retryAfter: expect.any(Number)
        });
        expect(response.headers['retry-after']).toBeDefined();
    });

    it('should handle Redis failures gracefully', async () => {
        mockRedis.pipeline().exec.mockRejectedValue(new Error('Redis connection failed'));

        // Should still work but without rate limiting (fail-open approach)
        const response = await request(app)
            .get('/api/test')
            .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.headers['x-ratelimit-limit']).toBeUndefined();
    });

    it('should reset counter after window expires', async () => {
        // First request
        mockRedis.pipeline().exec
            .mockResolvedValueOnce([
                [null, 1], // incr result
                [null, 1], // expire result
                [null, 60] // ttl result
            ])
            .mockResolvedValueOnce([
                [null, 1], // incr result - reset to 1
                [null, 1], // expire result
                [null, 60] // ttl result
            ]);

        await request(app).get('/api/test').expect(200);

        // Simulate window expiry and new request
        const response = await request(app).get('/api/test').expect(200);

        expect(response.headers['x-ratelimit-remaining']).toBe('4');
    });
});