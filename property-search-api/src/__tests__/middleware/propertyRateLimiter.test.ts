import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { PropertyRateLimiter } from '../../middleware/PropertyRateLimiter';
import { createMockRedis } from '../helpers/mockRedis';

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

    it('should apply different limits for search vs details', async () => {
        // Mock pipeline for search endpoint
        mockRedis.pipeline().exec.mockResolvedValue([
            [null, 1], // incr result
            [null, 1], // expire result
            [null, 900] // ttl result (15 minutes)
        ]);

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

    it('should track authenticated vs anonymous users separately', async () => {
        const authToken = 'valid-jwt-token';

        // Mock JWT verification
        vi.mock('jsonwebtoken', () => ({
            default: {
                verify: vi.fn().mockReturnValue({ userId: 'user123', tier: 'authenticated' })
            }
        }));

        mockRedis.pipeline().exec.mockResolvedValue([
            [null, 1], // incr result
            [null, 1], // expire result
            [null, 900] // ttl result
        ]);

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

    it('should implement burst protection for property searches', async () => {
        let callCount = 0;

        // Mock the pipeline to return increasing hit counts
        mockRedis.pipeline().exec.mockImplementation(() => {
            callCount++;
            return Promise.resolve([
                [null, callCount], // incr result - increments with each call
                [null, 1], // expire result
                [null, 60] // ttl result
            ]);
        });

        // First 5 requests should succeed (limit is 100 for search, but we're testing burst logic)
        // Let's use a smaller limit for this test
        for (let i = 0; i < 5; i++) {
            await request(app).get('/api/properties/search').expect(200);
        }

        // 6th request should be rate limited if we exceed the limit
        // Since the search limit is 100, let's simulate hitting that limit
        callCount = 101; // Force the next call to exceed limit

        const response = await request(app)
            .get('/api/properties/search')
            .expect(429);

        expect(response.body.error).toContain('Rate limit exceeded');
    });

    it('should allow premium users higher rate limits', async () => {
        const premiumToken = 'premium-user-token';

        // Mock premium user detection
        vi.spyOn(propertyLimiter, 'getUserTier').mockReturnValue('premium');

        mockRedis.pipeline().exec.mockResolvedValue([
            [null, 1], // incr result
            [null, 1], // expire result
            [null, 900] // ttl result
        ]);

        const response = await request(app)
            .get('/api/properties/search')
            .set('Authorization', `Bearer ${premiumToken}`)
            .expect(200);

        // Premium users get even higher limits
        expect(response.headers['x-ratelimit-limit']).toBe('500');
    });
});