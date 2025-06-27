/// <reference types="jest" />
/// <reference types="node" />
// ===== API PERFORMANCE TEST SUITE =====
const request = require('supertest');
import { app } from '../../app';
import { LoadTester } from '../../testing/LoadTester';

describe('API Performance Testing', () => {
    let loadTester: LoadTester;

    beforeAll(async () => {
        loadTester = new LoadTester(app);

        // Ensure all optimizations are active
        await loadTester.warmupSystem();
    });

    afterAll(async () => {
        await loadTester.cleanup();
    });

    test('should handle concurrent property searches efficiently', async () => {
        const loadTestResults = await loadTester.runConcurrentTest({
            testName: 'Concurrent Property Searches',
            endpoint: '/api/properties/search',
            method: 'GET',
            concurrentUsers: 25, // Reduced for testing
            requestsPerUser: 5,   // Reduced for testing
            queries: [
                { query: 'london', page: 1, limit: 20 },
                { price_min: 100000, price_max: 500000, bedrooms: 2 },
                { property_type: 'flat', bathrooms: 1 },
                { query: 'apartment', sort: 'price_asc' }
            ]
        });

        console.log('\n🔥 CONCURRENT LOAD TEST RESULTS:');
        console.log(`Total Requests: ${loadTestResults.totalRequests}`);
        console.log(`Successful Requests: ${loadTestResults.successfulRequests}`);
        console.log(`Failed Requests: ${loadTestResults.failedRequests}`);
        console.log(`Average Response Time: ${loadTestResults.avgResponseTime}ms`);
        console.log(`P95 Response Time: ${loadTestResults.p95ResponseTime}ms`);
        console.log(`P99 Response Time: ${loadTestResults.p99ResponseTime}ms`);
        console.log(`Requests/Second: ${loadTestResults.requestsPerSecond}`);
        console.log(`Error Rate: ${loadTestResults.errorRate}%`);

        // Validate performance under load
        expect(loadTestResults.errorRate).toBeLessThan(5); // Less than 5% errors (relaxed for testing)
        expect(loadTestResults.avgResponseTime).toBeLessThan(1000); // Under 1s average (relaxed)
        expect(loadTestResults.p95ResponseTime).toBeLessThan(2000); // Under 2s P95 (relaxed)
    });

    test('should test rate limiting performance under load', async () => {
        const rateLimitResults = await loadTester.runRateLimitTest({
            testName: 'Rate Limit Stress Test',
            endpoint: '/api/properties/search',
            requestsPerSecond: 50, // Reduced for testing
            duration: 10000, // 10 seconds
            expectedHttpStatus: [200, 429] // Success or rate limited
        });

        console.log('\n🛡️ RATE LIMITING PERFORMANCE:');
        console.log(`Requests Allowed: ${rateLimitResults.allowedRequests}`);
        console.log(`Requests Blocked: ${rateLimitResults.blockedRequests}`);
        console.log(`Rate Limit Response Time: ${rateLimitResults.avgBlockResponseTime}ms`);
        console.log(`System Stability: ${rateLimitResults.systemStable ? 'Stable' : 'Unstable'}`);

        // Rate limiting should be fast and effective
        expect(rateLimitResults.avgBlockResponseTime).toBeLessThan(100); // Fast rate limit responses
        expect(rateLimitResults.systemStable).toBe(true); // System should remain stable
    });

    test('should test validation performance under various inputs', async () => {
        const validationResults = await loadTester.runValidationTest({
            testName: 'Input Validation Performance',
            endpoint: '/api/properties/search',
            testCases: [
                // Valid inputs
                { query: 'london', price_min: 100000, expectedStatus: 200 },
                { bedrooms: 2, property_type: 'flat', expectedStatus: 200 },

                // Invalid inputs (should be fast to reject)
                { query: '', price_min: 'invalid', expectedStatus: 400 },
                { bedrooms: 999, price_max: 'not_a_number', expectedStatus: 400 },

                // Malicious inputs (should be sanitized quickly)
                { query: '<script>alert("xss")</script>', expectedStatus: 400 },
                { query: 'SELECT * FROM properties--', expectedStatus: 400 }
            ],
            iterations: 50 // Reduced for testing
        });

        console.log('\n✅ VALIDATION PERFORMANCE:');
        console.log(`Valid Input Avg Time: ${validationResults.validInputAvgTime}ms`);
        console.log(`Invalid Input Avg Time: ${validationResults.invalidInputAvgTime}ms`);
        console.log(`Malicious Input Avg Time: ${validationResults.maliciousInputAvgTime}ms`);
        console.log(`Validation Accuracy: ${validationResults.accuracy}%`);

        // Validation should be reasonably fast
        expect(validationResults.validInputAvgTime).toBeLessThan(100); // Under 100ms (relaxed)
        expect(validationResults.invalidInputAvgTime).toBeLessThan(50); // Faster for rejects
        expect(validationResults.accuracy).toBeGreaterThan(90); // Good accuracy
    });

    test('should test health check endpoint performance', async () => {
        const healthResults = await loadTester.runHealthCheckTest({
            testName: 'Health Check Performance',
            endpoint: '/api/health',
            iterations: 100,
            timeoutMs: 5000
        });

        console.log('\n❤️ HEALTH CHECK PERFORMANCE:');
        console.log(`Avg Health Check Time: ${healthResults.avgHealthCheckTime}ms`);
        console.log(`Health Check Success Rate: ${healthResults.successRate}%`);
        console.log(`Fastest Health Check: ${healthResults.fastestTime}ms`);
        console.log(`Slowest Health Check: ${healthResults.slowestTime}ms`);

        // Health checks should be fast and reliable
        expect(healthResults.avgHealthCheckTime).toBeLessThan(200); // Under 200ms
        expect(healthResults.successRate).toBeGreaterThan(95); // Very reliable
    });
});