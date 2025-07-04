// Unit Tests for Connection Pool Extensions
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';

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

// Mock logger
vi.mock('../../lib/logger', () => ({
    Logger: vi.fn().mockImplementation(() => ({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
    }))
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
import { MeilisearchService } from '../../services/MeilisearchService';
import { SemanticSearchService } from '../../services/SemanticSearchService';

describe('Connection Pool Extensions', () => {
    let poolManager: PropertyPoolManager;
    let searchOrchestrator: SearchOrchestrator;
    let propertyService: OptimizedPropertyService;
    let metricsMiddleware: PoolMetricsMiddleware;
    let meilisearchService: MeilisearchService;
    let semanticSearchService: SemanticSearchService;

    const mockConfig = {
        connectionString: 'postgresql://test:test@localhost:5432/test_db',
        maxConnections: 10,
        idleTimeoutMillis: 10000,
        connectionTimeoutMillis: 3000,
        enableSSL: false,
        retryAttempts: 3,
        retryDelay: 1000,
        autoScaling: {
            enabled: true,
            minConnections: 2,
            maxConnections: 20,
            scaleUpThreshold: 0.7,
            scaleDownThreshold: 0.3,
            scaleUpIncrement: 3,
            scaleDownIncrement: 1,
            cooldownPeriod: 30000,
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
        meilisearchService = new MeilisearchService();
        semanticSearchService = new SemanticSearchService(poolManager);
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

        it('should provide property platform health status', () => {
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

        it('should collect scaling history', () => {
            const history = poolManager.getScalingHistory();
            expect(Array.isArray(history)).toBe(true);
        });

        it('should emit scaling events', async () => {
            const eventPromise = new Promise((resolve) => {
                poolManager.once('poolScaled', (event) => {
                    expect(event).toBeDefined();
                    expect(event.action).toMatch(/up|down/);
                    expect(event.reason).toBeDefined();
                    expect(event.metrics).toBeDefined();
                    resolve(event);
                });
            });

            // Trigger scaling event
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

            await eventPromise;
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
            expect(result.responseTime).toBeGreaterThanOrEqual(0);
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
            const searchParams = {
                query: 'test property search',
                limit: 5
            };

            // Mock healthy pool
            vi.spyOn(poolManager, 'getDetailedHealthStatus').mockResolvedValue({
                isHealthy: true,
                performance: { averageQueryTime: 50 }
            });

            const healthyResult = await searchOrchestrator.searchWithFallback(searchParams);
            expect(healthyResult.searchType).toMatch(/hybrid|text|vector|fallback/);

            // Mock degraded pool
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
            expect(result.responseTime).toBeGreaterThanOrEqual(0);
            expect(result.metadata).toBeDefined();
            expect(result.metadata.poolUtilization).toBeGreaterThanOrEqual(0);
            expect(Array.isArray(result.metadata.queryOptimizations)).toBe(true);
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
        it('should provide metrics summary', () => {
            const summary = metricsMiddleware.getMetricsSummary();

            expect(summary).toBeDefined();
            expect(summary.poolStatus).toBeDefined();
            expect(summary.metrics).toBeDefined();
            expect(typeof summary.health).toBe('boolean');
            expect(summary.timestamp).toBeDefined();
        });

        it('should create middleware function', () => {
            const middleware = metricsMiddleware.middleware();
            expect(typeof middleware).toBe('function');
        });
    });

    describe('MeilisearchService', () => {
        it('should execute search queries', async () => {
            const searchParams = {
                query: 'test search',
                limit: 10
            };

            const result = await meilisearchService.search(searchParams);

            expect(result).toBeDefined();
            expect(result.query).toBe(searchParams.query);
            expect(typeof result.processingTimeMs).toBe('number');
            expect(Array.isArray(result.hits)).toBe(true);
        });

        it('should provide health status', async () => {
            const health = await meilisearchService.health();

            expect(health).toBeDefined();
            expect(health.status).toBeDefined();
            expect(typeof health.responseTime).toBe('number');
        });

        it('should provide metrics', async () => {
            const metrics = await meilisearchService.getMetrics();

            expect(metrics).toBeDefined();
            expect(typeof metrics.totalDocuments).toBe('number');
            expect(typeof metrics.indexSize).toBe('number');
            expect(metrics.lastUpdate).toBeDefined();
        });
    });

    describe('SemanticSearchService', () => {
        it('should execute semantic search', async () => {
            const searchParams = {
                query: 'modern apartment with garden',
                location: 'London',
                limit: 10,
                similarityThreshold: 0.7
            };

            // Mock the query result
            const mockClient = {
                query: vi.fn().mockResolvedValue({
                    rows: [
                        {
                            id: '1',
                            title: 'Modern Apartment',
                            description: 'Beautiful modern apartment',
                            price: 300000,
                            location: 'London',
                            property_type: 'apartment',
                            bedrooms: 2,
                            bathrooms: 1,
                            size_sqft: 800,
                            similarity_score: 0.2,
                            created_at: new Date()
                        }
                    ]
                }),
                release: vi.fn()
            };

            const result = await semanticSearchService.search(searchParams, mockClient as any);

            expect(result).toBeDefined();
            expect(Array.isArray(result)).toBe(true);
            if (result.length > 0) {
                expect(result[0]).toHaveProperty('id');
                expect(result[0]).toHaveProperty('similarity_score');
                expect(result[0]).toHaveProperty('relevance_score');
            }
        });

        it('should find similar properties', async () => {
            const propertyId = 'test-property-id';

            // Mock the embedding query
            vi.spyOn(poolManager, 'getClientWithRetry').mockResolvedValue({
                query: vi.fn()
                    .mockResolvedValueOnce({
                        rows: [{ combined_embedding: [0.1, 0.2, 0.3] }]
                    })
                    .mockResolvedValueOnce({
                        rows: [
                            {
                                id: '2',
                                title: 'Similar Property',
                                description: 'Similar to the original',
                                price: 280000,
                                location: 'London',
                                property_type: 'apartment',
                                bedrooms: 2,
                                bathrooms: 1,
                                size_sqft: 750,
                                similarity_score: 0.15,
                                created_at: new Date()
                            }
                        ]
                    }),
                release: vi.fn()
            } as any);

            const result = await semanticSearchService.findSimilarProperties(propertyId, 5);

            expect(result).toBeDefined();
            expect(Array.isArray(result)).toBe(true);
        });

        it('should provide service health status', async () => {
            const health = await semanticSearchService.getServiceHealth();

            expect(health).toBeDefined();
            expect(health.status).toMatch(/healthy|degraded|unhealthy/);
            expect(health.embeddingService).toMatch(/available|unavailable/);
            expect(health.vectorIndex).toMatch(/available|unavailable/);
            expect(typeof health.averageQueryTime).toBe('number');
            expect(Array.isArray(health.recommendations)).toBe(true);
        });
    });

    describe('Integration Scenarios', () => {
        it('should handle high load scenario with graceful degradation', async () => {
            // Simulate multiple concurrent searches
            const promises = Array.from({ length: 10 }, (_, i) =>
                propertyService.searchProperties({
                    query: `test query ${i}`,
                    limit: 5
                })
            );

            const results = await Promise.allSettled(promises);
            const successful = results.filter(r => r.status === 'fulfilled');

            expect(successful.length).toBeGreaterThan(0);
            // Most requests should succeed
            expect(successful.length / results.length).toBeGreaterThan(0.7);
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
            expect(orchestratorResult.responseTime).toBeGreaterThanOrEqual(0);
            expect(propertyServiceResult.responseTime).toBeGreaterThanOrEqual(0);

            // Metadata should include pool status
            expect(orchestratorResult.metadata).toBeDefined();
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

            expect(searchHealth.overall).toMatch(/healthy|degraded|unhealthy/);
            expect(propertyHealth.status).toMatch(/healthy|degraded|unhealthy/);
            expect(platformHealth.status).toMatch(/healthy|degraded|critical/);
        });

        it('should handle service failures gracefully', async () => {
            // Mock a service failure
            vi.spyOn(poolManager, 'getClientWithRetry').mockRejectedValueOnce(new Error('Connection failed'));

            const searchParams = {
                query: 'test search with failure',
                limit: 5
            };

            // Search should still return a result (fallback)
            const result = await searchOrchestrator.searchWithFallback(searchParams);

            expect(result).toBeDefined();
            expect(result.searchType).toBe('fallback');
            expect(Array.isArray(result.properties)).toBe(true);
        });
    });
});