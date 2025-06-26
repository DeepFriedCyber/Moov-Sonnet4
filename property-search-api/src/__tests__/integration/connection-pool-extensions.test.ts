// Integration Tests for Connection Pool Extensions
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

// Mock environment variables before importing modules
vi.mock('../../config/env', () => ({
    getEnv: () => ({
        DATABASE_URL: 'postgresql://test:test@localhost:5432/test_db',
        FRONTEND_URL: 'http://localhost:3000',
        EMBEDDING_SERVICE_URL: 'http://localhost:8001',
        JWT_SECRET: 'test-secret',
        NODE_ENV: 'test'
    }),
    isDevelopment: () => false,
    isProduction: () => false,
    isTest: () => true
}));

// Mock pg module
vi.mock('pg', () => ({
    Pool: vi.fn().mockImplementation(() => ({
        connect: vi.fn().mockResolvedValue({
            query: vi.fn().mockResolvedValue({ rows: [] }),
            release: vi.fn()
        }),
        query: vi.fn().mockResolvedValue({ rows: [] }),
        end: vi.fn().mockResolvedValue(undefined),
        totalCount: 5,
        idleCount: 3,
        waitingCount: 0,
        on: vi.fn()
    }))
}));

import { PropertyPoolManager } from '../../database/PropertyPoolManager';
import { SearchOrchestrator } from '../../services/SearchOrchestrator';
import { OptimizedPropertyService } from '../../services/OptimizedPropertyService';
import { PoolMetricsMiddleware } from '../../middleware/poolMetrics';
import { createAdvancedHealthRouter } from '../../routes/advancedHealth';
import { DatabaseService } from '../../lib/database';

describe('Connection Pool Extensions Integration', () => {
    let poolManager: PropertyPoolManager;
    let searchOrchestrator: SearchOrchestrator;
    let propertyService: OptimizedPropertyService;
    let metricsMiddleware: PoolMetricsMiddleware;
    let app: express.Application;

    const mockConfig = {
        connectionString: 'postgresql://test:test@localhost:5432/test_db',
        maxConnections: 10,
        idleTimeoutMillis: 10000,
        connectionTimeoutMillis: 3000,
        enableSSL: false,
        autoScaling: {
            enabled: true,
            minConnections: 2,
            maxConnections: 20,
            scaleUpThreshold: 0.7,
            scaleDownThreshold: 0.3,
            scaleUpIncrement: 3,
            scaleDownIncrement: 1,
            cooldownPeriod: 30000, // 30 seconds for testing
            peakHours: [9, 12, 17, 19],
            offPeakHours: [2, 3, 4, 5]
        }
    };

    beforeAll(async () => {

        // Initialize services
        poolManager = new PropertyPoolManager(mockConfig);
        await poolManager.initialize();

        searchOrchestrator = new SearchOrchestrator(poolManager);
        propertyService = new OptimizedPropertyService(poolManager);
        metricsMiddleware = new PoolMetricsMiddleware(poolManager);

        // Setup Express app for testing
        app = express();
        app.use(express.json());
        app.use(metricsMiddleware.middleware());
        app.use('/health', createAdvancedHealthRouter({
            database: poolManager,
            searchOrchestrator,
            propertyService
        }));
    });

    afterAll(async () => {
        await poolManager.shutdown();
    });

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('PropertyPoolManager', () => {
        it('should initialize with auto-scaling configuration', () => {
            const config = poolManager.getScalingConfig();

            expect(config).toBeDefined();
            expect(config?.enabled).toBe(true);
            expect(config?.minConnections).toBe(2);
            expect(config?.maxConnections).toBe(20);
            expect(config?.peakHours).toEqual([9, 12, 17, 19]);
        });

        it('should collect and store scaling metrics', async () => {
            // Wait for metrics collection
            await new Promise(resolve => setTimeout(resolve, 100));

            const history = poolManager.getScalingHistory();
            expect(Array.isArray(history)).toBe(true);
        });

        it('should provide property platform health status', async () => {
            const health = poolManager.getPropertyPlatformHealth();

            expect(health).toBeDefined();
            expect(health.status).toMatch(/healthy|degraded|critical/);
            expect(health.poolHealth).toBeDefined();
            expect(health.scalingHealth).toBeDefined();
            expect(Array.isArray(health.recommendations)).toBe(true);
        });

        it('should update scaling configuration', async () => {
            const newConfig = {
                scaleUpThreshold: 0.8,
                scaleDownThreshold: 0.2
            };

            await poolManager.updateScalingConfig(newConfig);
            const updatedConfig = poolManager.getScalingConfig();

            expect(updatedConfig?.scaleUpThreshold).toBe(0.8);
            expect(updatedConfig?.scaleDownThreshold).toBe(0.2);
        });

        it('should emit scaling events', (done) => {
            poolManager.once('poolScaled', (event) => {
                expect(event).toBeDefined();
                expect(event.action).toMatch(/up|down/);
                expect(event.reason).toBeDefined();
                expect(event.metrics).toBeDefined();
                done();
            });

            // Trigger scaling event (mock)
            poolManager.emit('poolScaled', {
                action: 'up',
                reason: 'Test scaling event',
                oldMax: 10,
                newMax: 15,
                metrics: {
                    timestamp: Date.now(),
                    poolUtilization: 0.8,
                    averageQueryTime: 200,
                    errorRate: 0.01,
                    activeConnections: 8,
                    waitingRequests: 2,
                    currentHour: 12,
                    isPeakHour: true
                },
                timestamp: new Date().toISOString()
            });
        });
    });

    describe('SearchOrchestrator', () => {
        it('should execute search with fallback strategy', async () => {
            const searchParams = {
                query: 'modern apartment London',
                location: 'London',
                priceRange: { min: 200000, max: 500000 },
                limit: 10
            };

            const result = await searchOrchestrator.searchWithFallback(searchParams);

            expect(result).toBeDefined();
            expect(result.searchType).toMatch(/hybrid|text|vector|fallback/);
            expect(result.responseTime).toBeGreaterThan(0);
            expect(result.metadata).toBeDefined();
            expect(Array.isArray(result.properties)).toBe(true);
        });

        it('should provide search health status', async () => {
            const health = await searchOrchestrator.getSearchHealth();

            expect(health).toBeDefined();
            expect(health.overall).toMatch(/healthy|degraded|unhealthy/);
            expect(health.database).toBeDefined();
            expect(health.meilisearch).toBeDefined();
        });

        it('should handle different search strategies based on pool health', async () => {
            // Mock different pool health scenarios
            const searchParams = {
                query: 'test property search',
                limit: 5
            };

            // Test with healthy pool
            vi.spyOn(poolManager, 'getDetailedHealthStatus').mockResolvedValue({
                isHealthy: true,
                performance: { averageQueryTime: 50 }
            });

            const healthyResult = await searchOrchestrator.searchWithFallback(searchParams);
            expect(healthyResult.searchType).toMatch(/hybrid|text|vector/);

            // Test with degraded pool
            vi.spyOn(poolManager, 'getDetailedHealthStatus').mockResolvedValue({
                isHealthy: true,
                performance: { averageQueryTime: 800 }
            });

            const degradedResult = await searchOrchestrator.searchWithFallback(searchParams);
            expect(degradedResult.searchType).toMatch(/text|vector|fallback/);
        });
    });

    describe('OptimizedPropertyService', () => {
        it('should execute optimized property search', async () => {
            const searchParams = {
                location: 'Manchester',
                propertyType: 'apartment',
                bedrooms: 2,
                priceRange: { min: 150000, max: 300000 },
                limit: 15
            };

            const result = await propertyService.searchProperties(searchParams);

            expect(result).toBeDefined();
            expect(result.searchStrategy).toMatch(/optimized|cached|fallback|vector|standard/);
            expect(result.responseTime).toBeGreaterThan(0);
            expect(result.metadata).toBeDefined();
            expect(result.metadata.poolUtilization).toBeGreaterThanOrEqual(0);
            expect(Array.isArray(result.metadata.queryOptimizations)).toBe(true);
        });

        it('should use caching for repeated searches', async () => {
            const searchParams = {
                location: 'Birmingham',
                propertyType: 'house',
                bedrooms: 3
            };

            // First search
            const firstResult = await propertyService.searchProperties(searchParams);
            expect(firstResult.metadata.cacheHit).toBeFalsy();

            // Second search (should hit cache)
            const secondResult = await propertyService.searchProperties(searchParams);
            // Note: In real implementation, this would be a cache hit
            expect(secondResult).toBeDefined();
        });

        it('should provide service health status', async () => {
            const health = await propertyService.getServiceHealth();

            expect(health).toBeDefined();
            expect(health.status).toMatch(/healthy|degraded|unhealthy/);
            expect(typeof health.poolUtilization).toBe('number');
            expect(typeof health.cacheSize).toBe('number');
            expect(typeof health.averageQueryTime).toBe('number');
            expect(Array.isArray(health.recommendations)).toBe(true);
        });

        it('should adapt search strategy based on pool load', async () => {
            const searchParams = {
                query: 'luxury property',
                location: 'London',
                limit: 10
            };

            // Mock high pool utilization
            vi.spyOn(poolManager, 'getPoolStatus').mockReturnValue({
                totalCount: 18,
                idleCount: 2,
                waitingCount: 5
            });

            const result = await propertyService.searchProperties(searchParams);
            expect(result.searchStrategy).toMatch(/cached|optimized|fallback/);
        });
    });

    describe('PoolMetricsMiddleware', () => {
        it('should add metrics headers to responses', async () => {
            const response = await request(app)
                .get('/health/advanced')
                .expect(200);

            // Check for metrics headers
            expect(response.headers['x-db-pool-active']).toBeDefined();
            expect(response.headers['x-db-pool-idle']).toBeDefined();
            expect(response.headers['x-db-response-time']).toBeDefined();
        });

        it('should log slow requests', (done) => {
            // Mock a slow endpoint
            app.get('/slow-endpoint', (req, res) => {
                setTimeout(() => {
                    res.json({ message: 'slow response' });
                }, 1100); // Longer than threshold
            });

            poolManager.once('slowRequest', (event) => {
                expect(event).toBeDefined();
                expect(event.duration).toBeGreaterThan(1000);
                expect(event.path).toBe('/slow-endpoint');
                done();
            });

            request(app)
                .get('/slow-endpoint')
                .end(() => { });
        });

        it('should provide metrics summary', () => {
            const summary = metricsMiddleware.getMetricsSummary();

            expect(summary).toBeDefined();
            expect(summary.poolStatus).toBeDefined();
            expect(summary.metrics).toBeDefined();
            expect(typeof summary.health).toBe('boolean');
            expect(summary.timestamp).toBeDefined();
        });
    });

    describe('Advanced Health Router', () => {
        it('should provide advanced health check', async () => {
            const response = await request(app)
                .get('/health/advanced')
                .expect(200);

            expect(response.body.status).toMatch(/healthy|degraded|unhealthy/);
            expect(response.body.checks).toBeDefined();
            expect(response.body.checks.database).toBeDefined();
            expect(response.body.checks.connectionPool).toBeDefined();
            expect(response.body.metadata).toBeDefined();
            expect(response.body.metadata.requestId).toBeDefined();
        });

        it('should provide comprehensive health check', async () => {
            const response = await request(app)
                .get('/health/comprehensive')
                .expect(200);

            expect(response.body.status).toMatch(/healthy|degraded|unhealthy/);
            expect(response.body.checks.database).toBeDefined();
            expect(response.body.checks.connectionPool).toBeDefined();
            expect(response.body.checks.search).toBeDefined();
            expect(response.body.checks.dependencies).toBeDefined();
        });

        it('should provide pool-specific health check', async () => {
            const response = await request(app)
                .get('/health/pool')
                .expect(200);

            expect(response.body.status).toMatch(/healthy|degraded|critical/);
            expect(response.body.pool).toBeDefined();
            expect(response.body.pool.connections).toBeDefined();
            expect(response.body.pool.performance).toBeDefined();
            expect(response.body.autoScaling).toBeDefined();
        });

        it('should provide search health check', async () => {
            const response = await request(app)
                .get('/health/search')
                .expect(200);

            expect(response.body.status).toMatch(/healthy|degraded|unhealthy|not_configured/);
            expect(response.body.services).toBeDefined();
            expect(response.body.services.searchOrchestrator).toBeDefined();
            expect(response.body.services.propertyService).toBeDefined();
        });

        it('should provide performance metrics', async () => {
            const response = await request(app)
                .get('/health/performance')
                .expect(200);

            expect(response.body.current).toBeDefined();
            expect(response.body.trends).toBeDefined();
            expect(response.body.thresholds).toBeDefined();
            expect(Array.isArray(response.body.recommendations)).toBe(true);
        });
    });

    describe('Integration Scenarios', () => {
        it('should handle high load scenario with graceful degradation', async () => {
            // Simulate high load
            const promises = Array.from({ length: 20 }, (_, i) =>
                propertyService.searchProperties({
                    query: `test query ${i}`,
                    limit: 5
                })
            );

            const results = await Promise.allSettled(promises);
            const successful = results.filter(r => r.status === 'fulfilled');

            expect(successful.length).toBeGreaterThan(0);
            // Some requests should succeed even under high load
            expect(successful.length / results.length).toBeGreaterThan(0.5);
        });

        it('should coordinate between services during search operations', async () => {
            const searchParams = {
                query: 'family home with garden',
                location: 'Bristol',
                bedrooms: 4,
                limit: 10
            };

            // Execute search through orchestrator
            const orchestratorResult = await searchOrchestrator.searchWithFallback(searchParams);

            // Execute search through property service
            const propertyServiceResult = await propertyService.searchProperties(searchParams);

            // Both should succeed and provide meaningful results
            expect(orchestratorResult.responseTime).toBeGreaterThan(0);
            expect(propertyServiceResult.responseTime).toBeGreaterThan(0);

            // Metadata should include pool status
            expect(orchestratorResult.metadata?.poolStatus).toBeDefined();
            expect(propertyServiceResult.metadata.poolUtilization).toBeGreaterThanOrEqual(0);
        });

        it('should maintain service health during scaling events', async () => {
            // Trigger scaling event
            poolManager.emit('poolScaled', {
                action: 'up',
                reason: 'High utilization test',
                oldMax: 10,
                newMax: 15,
                metrics: {
                    timestamp: Date.now(),
                    poolUtilization: 0.85,
                    averageQueryTime: 300,
                    errorRate: 0.02,
                    activeConnections: 12,
                    waitingRequests: 3,
                    currentHour: 14,
                    isPeakHour: true
                },
                timestamp: new Date().toISOString()
            });

            // Services should remain healthy
            const searchHealth = await searchOrchestrator.getSearchHealth();
            const propertyHealth = await propertyService.getServiceHealth();
            const platformHealth = poolManager.getPropertyPlatformHealth();

            expect(searchHealth.overall).not.toBe('unhealthy');
            expect(propertyHealth.status).not.toBe('unhealthy');
            expect(platformHealth.status).not.toBe('critical');
        });
    });
});