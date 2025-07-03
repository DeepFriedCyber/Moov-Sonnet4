// property-search-api/src/config.test.ts

import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';

describe('Configuration', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        // Reset modules to ensure config is re-evaluated for each test
        vi.resetModules();
        // Reset environment for each test
        process.env = { ...originalEnv };
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    it('should use default values when environment variables are not set', async () => {
        // Arrange: Clear env vars
        delete process.env.CACHE_TTL_SECONDS;
        delete process.env.SEARCH_RESULT_LIMIT;

        // Act: Import config (this will re-evaluate the module)
        const { CACHE_TTL_SECONDS, SEARCH_RESULT_LIMIT } = await import('./config');

        // Assert: Should use defaults
        expect(CACHE_TTL_SECONDS).toBe(300); // 5 minutes default
        expect(SEARCH_RESULT_LIMIT).toBe(50); // 50 results default
    });

    it('should use environment variables when they are set', async () => {
        // Arrange: Set custom env vars
        process.env.CACHE_TTL_SECONDS = '600';
        process.env.SEARCH_RESULT_LIMIT = '25';

        // Act: Import config
        const { CACHE_TTL_SECONDS, SEARCH_RESULT_LIMIT } = await import('./config');

        // Assert: Should use env var values
        expect(CACHE_TTL_SECONDS).toBe(600);
        expect(SEARCH_RESULT_LIMIT).toBe(25);
    });

    it('should handle invalid environment variable values', async () => {
        // Arrange: Set invalid env vars
        process.env.CACHE_TTL_SECONDS = 'invalid';
        process.env.SEARCH_RESULT_LIMIT = 'not-a-number';

        // Act: Import config
        const { CACHE_TTL_SECONDS, SEARCH_RESULT_LIMIT } = await import('./config');

        // Assert: parseInt returns NaN for invalid strings
        expect(CACHE_TTL_SECONDS).toBeNaN(); // parseInt('invalid', 10) returns NaN
        expect(SEARCH_RESULT_LIMIT).toBeNaN(); // parseInt('not-a-number', 10) returns NaN
    });

    it('should use default ranking weights when RANKING_WEIGHTS is not set', async () => {
        // Arrange: Clear ranking weights env var
        delete process.env.RANKING_WEIGHTS;

        // Act: Import config
        const { rankingWeights } = await import('./config');

        // Assert: Should use default weights
        expect(rankingWeights.baseScore).toBe(0.5);
        expect(rankingWeights.featureMatch).toBe(0.05);
        expect(rankingWeights.cityMatch).toBe(0.1);
    });

    it('should override ranking weights when RANKING_WEIGHTS is set', async () => {
        // Arrange: Set custom ranking weights
        process.env.RANKING_WEIGHTS = JSON.stringify({
            baseScore: 0.2,
            featureMatch: 0.8,
            cityMatch: 0.0
        });

        // Act: Import config
        const { rankingWeights } = await import('./config');

        // Assert: Should use custom weights while keeping defaults for unspecified
        expect(rankingWeights.baseScore).toBe(0.2); // overridden
        expect(rankingWeights.featureMatch).toBe(0.8); // overridden
        expect(rankingWeights.cityMatch).toBe(0.0); // overridden
        expect(rankingWeights.priceInRange).toBe(0.1); // default (not overridden)
    });

    it('should handle invalid JSON in RANKING_WEIGHTS gracefully', async () => {
        // Arrange: Set invalid JSON
        process.env.RANKING_WEIGHTS = 'invalid-json';

        // Act & Assert: Should throw when trying to parse invalid JSON
        await expect(async () => {
            await import('./config');
        }).rejects.toThrow();
    });
});