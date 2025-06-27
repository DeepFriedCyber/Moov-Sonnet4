import { Express } from 'express';
import { Response } from 'supertest';

const request = require('supertest');

export interface LoadTestResult {
    testName: string;
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    avgResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
    minResponseTime: number;
    maxResponseTime: number;
    requestsPerSecond: number;
    errorRate: number;
    errors: { [key: string]: number };
}

export interface RateLimitTestResult {
    testName: string;
    allowedRequests: number;
    blockedRequests: number;
    avgBlockResponseTime: number;
    systemStable: boolean;
    totalRequests: number;
}

export interface ValidationTestResult {
    testName: string;
    validInputAvgTime: number;
    invalidInputAvgTime: number;
    maliciousInputAvgTime: number;
    accuracy: number;
    totalTests: number;
}

export interface HealthCheckResult {
    testName: string;
    avgHealthCheckTime: number;
    successRate: number;
    fastestTime: number;
    slowestTime: number;
    totalChecks: number;
}

export class LoadTester {
    constructor(private app: Express) { }

    async warmupSystem(): Promise<void> {
        console.log('🔥 Warming up system...');

        // Make a few requests to warm up the system
        for (let i = 0; i < 5; i++) {
            try {
                await request(this.app)
                    .get('/api/properties/search')
                    .query({ query: 'test', limit: 1 });
            } catch (error) {
                // Ignore warmup errors
            }
        }

        console.log('✅ System warmed up');
    }

    async runConcurrentTest(config: {
        testName: string;
        endpoint: string;
        method: 'GET' | 'POST';
        concurrentUsers: number;
        requestsPerUser: number;
        queries: any[];
    }): Promise<LoadTestResult> {
        console.log(`\n🚀 Running ${config.testName}...`);

        const responseTimes: number[] = [];
        const errors: { [key: string]: number } = {};
        let successfulRequests = 0;
        let failedRequests = 0;

        const startTime = Date.now();

        // Create concurrent user promises
        const userPromises: Promise<void>[] = [];

        for (let user = 0; user < config.concurrentUsers; user++) {
            const userPromise = this.simulateUser(
                config.endpoint,
                config.method,
                config.requestsPerUser,
                config.queries,
                responseTimes,
                errors,
                (success) => {
                    if (success) {
                        successfulRequests++;
                    } else {
                        failedRequests++;
                    }
                }
            );
            userPromises.push(userPromise);
        }

        // Wait for all users to complete
        await Promise.allSettled(userPromises);

        const totalTime = Date.now() - startTime;
        const totalRequests = config.concurrentUsers * config.requestsPerUser;

        // Calculate statistics
        responseTimes.sort((a, b) => a - b);
        const avgResponseTime = responseTimes.length > 0
            ? responseTimes.reduce((a, b) => a + b) / responseTimes.length
            : 0;

        const p95Index = Math.floor(responseTimes.length * 0.95);
        const p99Index = Math.floor(responseTimes.length * 0.99);

        return {
            testName: config.testName,
            totalRequests,
            successfulRequests,
            failedRequests,
            avgResponseTime: Math.round(avgResponseTime * 100) / 100,
            p95ResponseTime: responseTimes[p95Index] || 0,
            p99ResponseTime: responseTimes[p99Index] || 0,
            minResponseTime: responseTimes[0] || 0,
            maxResponseTime: responseTimes[responseTimes.length - 1] || 0,
            requestsPerSecond: Math.round((totalRequests / totalTime) * 1000 * 100) / 100,
            errorRate: Math.round((failedRequests / totalRequests) * 100 * 100) / 100,
            errors
        };
    }

    private async simulateUser(
        endpoint: string,
        method: 'GET' | 'POST',
        requestsPerUser: number,
        queries: any[],
        responseTimes: number[],
        errors: { [key: string]: number },
        onComplete: (success: boolean) => void
    ): Promise<void> {
        for (let i = 0; i < requestsPerUser; i++) {
            const query = queries[i % queries.length];
            const startTime = Date.now();

            try {
                let response: Response;
                if (method === 'GET') {
                    response = await request(this.app)
                        .get(endpoint)
                        .query(query)
                        .timeout(10000); // 10 second timeout
                } else {
                    response = await request(this.app)
                        .post(endpoint)
                        .send(query)
                        .timeout(10000);
                }

                const responseTime = Date.now() - startTime;
                responseTimes.push(responseTime);

                if (response.status >= 200 && response.status < 400) {
                    onComplete(true);
                } else {
                    onComplete(false);
                    const errorKey = `HTTP_${response.status}`;
                    errors[errorKey] = (errors[errorKey] || 0) + 1;
                }
            } catch (error) {
                const responseTime = Date.now() - startTime;
                responseTimes.push(responseTime);
                onComplete(false);

                const errorKey = (error as any)?.code || 'UNKNOWN_ERROR';
                errors[errorKey] = (errors[errorKey] || 0) + 1;
            }

            // Small delay between requests from same user
            await new Promise(resolve => setTimeout(resolve, 10));
        }
    }

    async runRateLimitTest(config: {
        testName: string;
        endpoint: string;
        requestsPerSecond: number;
        duration: number;
        expectedHttpStatus: number[];
    }): Promise<RateLimitTestResult> {
        console.log(`\n🛡️ Running ${config.testName}...`);

        let allowedRequests = 0;
        let blockedRequests = 0;
        const blockResponseTimes: number[] = [];
        let systemStable = true;

        const startTime = Date.now();
        const endTime = startTime + config.duration;
        const intervalMs = 1000 / config.requestsPerSecond;

        const promises: Promise<void>[] = [];

        while (Date.now() < endTime) {
            const requestStart = Date.now();

            const promise = request(this.app)
                .get(config.endpoint)
                .query({ query: 'test', limit: 1 })
                .timeout(5000)
                .then((response: Response) => {
                    const responseTime = Date.now() - requestStart;

                    if (response.status === 200) {
                        allowedRequests++;
                    } else if (response.status === 429) {
                        blockedRequests++;
                        blockResponseTimes.push(responseTime);
                    } else if (!config.expectedHttpStatus.includes(response.status)) {
                        systemStable = false;
                    }
                })
                .catch((error: any) => {
                    // Consider timeouts as system instability
                    if (error?.code === 'ECONNABORTED') {
                        systemStable = false;
                    }
                    blockedRequests++;
                });

            promises.push(promise);

            // Wait for next request interval
            await new Promise(resolve => setTimeout(resolve, intervalMs));
        }

        // Wait for all requests to complete
        await Promise.allSettled(promises);

        const avgBlockResponseTime = blockResponseTimes.length > 0
            ? blockResponseTimes.reduce((a, b) => a + b) / blockResponseTimes.length
            : 0;

        return {
            testName: config.testName,
            allowedRequests,
            blockedRequests,
            avgBlockResponseTime: Math.round(avgBlockResponseTime * 100) / 100,
            systemStable,
            totalRequests: allowedRequests + blockedRequests
        };
    }

    async runValidationTest(config: {
        testName: string;
        endpoint: string;
        testCases: Array<{
            [key: string]: any;
            expectedStatus: number;
        }>;
        iterations: number;
    }): Promise<ValidationTestResult> {
        console.log(`\n✅ Running ${config.testName}...`);

        const validInputTimes: number[] = [];
        const invalidInputTimes: number[] = [];
        const maliciousInputTimes: number[] = [];
        let correctValidations = 0;
        let totalTests = 0;

        for (let i = 0; i < config.iterations; i++) {
            for (const testCase of config.testCases) {
                const { expectedStatus, ...queryParams } = testCase;
                const startTime = Date.now();

                try {
                    const response: Response = await request(this.app)
                        .get(config.endpoint)
                        .query(queryParams)
                        .timeout(5000);

                    const responseTime = Date.now() - startTime;

                    // Categorize the test case
                    if (expectedStatus === 200) {
                        validInputTimes.push(responseTime);
                    } else if (this.isMaliciousInput(queryParams)) {
                        maliciousInputTimes.push(responseTime);
                    } else {
                        invalidInputTimes.push(responseTime);
                    }

                    // Check if validation was correct
                    if (response.status === expectedStatus) {
                        correctValidations++;
                    }

                    totalTests++;
                } catch (error) {
                    const responseTime = Date.now() - startTime;

                    // Categorize based on expected behavior
                    if (expectedStatus === 200) {
                        validInputTimes.push(responseTime);
                    } else if (this.isMaliciousInput(queryParams)) {
                        maliciousInputTimes.push(responseTime);
                    } else {
                        invalidInputTimes.push(responseTime);
                    }

                    // If we expected an error and got one, it's correct
                    if (expectedStatus >= 400) {
                        correctValidations++;
                    }

                    totalTests++;
                }
            }
        }

        const validInputAvgTime = validInputTimes.length > 0
            ? validInputTimes.reduce((a, b) => a + b) / validInputTimes.length
            : 0;

        const invalidInputAvgTime = invalidInputTimes.length > 0
            ? invalidInputTimes.reduce((a, b) => a + b) / invalidInputTimes.length
            : 0;

        const maliciousInputAvgTime = maliciousInputTimes.length > 0
            ? maliciousInputTimes.reduce((a, b) => a + b) / maliciousInputTimes.length
            : 0;

        const accuracy = totalTests > 0 ? (correctValidations / totalTests) * 100 : 0;

        return {
            testName: config.testName,
            validInputAvgTime: Math.round(validInputAvgTime * 100) / 100,
            invalidInputAvgTime: Math.round(invalidInputAvgTime * 100) / 100,
            maliciousInputAvgTime: Math.round(maliciousInputAvgTime * 100) / 100,
            accuracy: Math.round(accuracy * 100) / 100,
            totalTests
        };
    }

    private isMaliciousInput(queryParams: any): boolean {
        const maliciousPatterns = [
            '<script',
            'SELECT',
            'DROP',
            'INSERT',
            'UPDATE',
            'DELETE',
            'UNION',
            '--',
            ';'
        ];

        const queryString = JSON.stringify(queryParams).toLowerCase();
        return maliciousPatterns.some(pattern => queryString.includes(pattern.toLowerCase()));
    }

    async runHealthCheckTest(config: {
        testName: string;
        endpoint: string;
        iterations: number;
        timeoutMs: number;
    }): Promise<HealthCheckResult> {
        console.log(`\n❤️ Running ${config.testName}...`);

        const responseTimes: number[] = [];
        let successfulChecks = 0;

        for (let i = 0; i < config.iterations; i++) {
            const startTime = Date.now();

            try {
                const response: Response = await request(this.app)
                    .get(config.endpoint)
                    .timeout(config.timeoutMs);

                const responseTime = Date.now() - startTime;
                responseTimes.push(responseTime);

                if (response.status === 200) {
                    successfulChecks++;
                }
            } catch (error) {
                const responseTime = Date.now() - startTime;
                responseTimes.push(responseTime);
            }

            // Small delay between health checks
            await new Promise(resolve => setTimeout(resolve, 50));
        }

        const avgHealthCheckTime = responseTimes.length > 0
            ? responseTimes.reduce((a, b) => a + b) / responseTimes.length
            : 0;

        const successRate = (successfulChecks / config.iterations) * 100;

        return {
            testName: config.testName,
            avgHealthCheckTime: Math.round(avgHealthCheckTime * 100) / 100,
            successRate: Math.round(successRate * 100) / 100,
            fastestTime: Math.min(...responseTimes),
            slowestTime: Math.max(...responseTimes),
            totalChecks: config.iterations
        };
    }

    async cleanup(): Promise<void> {
        // Cleanup any resources if needed
        console.log('🧹 Load tester cleanup completed');
    }
}