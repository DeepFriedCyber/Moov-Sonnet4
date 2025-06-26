// Example: Integrating Advanced Connection Pool Extensions
// This file shows how to integrate the new extensions with your existing property search API

import express from 'express';
import { PropertyPoolManager } from '../database/PropertyPoolManager';
import { SearchOrchestrator } from '../services/SearchOrchestrator';
import { OptimizedPropertyService } from '../services/OptimizedPropertyService';
import { PoolMetricsMiddleware } from '../middleware/poolMetrics';
import { createAdvancedHealthRouter } from '../routes/advancedHealth';
import { MeilisearchService } from '../services/MeilisearchService';
import { Logger } from '../lib/logger';

const app = express();
const logger = new Logger('IntegrationExample');

// 1. Initialize the enhanced connection pool manager
const poolManager = new PropertyPoolManager({
    connectionString: process.env.DATABASE_URL!,
    maxConnections: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    enableSSL: process.env.NODE_ENV === 'production',
    autoScaling: {
        enabled: true,
        minConnections: 5,
        maxConnections: 50,
        scaleUpThreshold: 0.7,
        scaleDownThreshold: 0.3,
        scaleUpIncrement: 5,
        scaleDownIncrement: 2,
        cooldownPeriod: 60000, // 1 minute
        peakHours: [9, 12, 17, 19], // UK property search peak hours
        offPeakHours: [2, 3, 4, 5, 6]
    }
});

// 2. Initialize enhanced services
const searchOrchestrator = new SearchOrchestrator(poolManager);
const propertyService = new OptimizedPropertyService(poolManager);
const meilisearchService = new MeilisearchService();
const metricsMiddleware = new PoolMetricsMiddleware(poolManager);

// 3. Setup middleware
app.use(express.json());
app.use(metricsMiddleware.middleware());

// 4. Setup enhanced health routes
app.use('/health', createAdvancedHealthRouter({
    database: poolManager,
    searchOrchestrator,
    propertyService,
    meilisearch: meilisearchService
}));

// 5. Enhanced property search endpoint
app.get('/api/properties/search', async (req, res) => {
    const startTime = Date.now();

    try {
        const searchParams = {
            query: req.query.q as string,
            location: req.query.location as string,
            priceRange: {
                min: parseInt(req.query.minPrice as string) || 0,
                max: parseInt(req.query.maxPrice as string) || Infinity
            },
            propertyType: req.query.type as string,
            bedrooms: parseInt(req.query.bedrooms as string),
            bathrooms: parseInt(req.query.bathrooms as string),
            limit: parseInt(req.query.limit as string) || 20,
            offset: parseInt(req.query.offset as string) || 0
        };

        logger.info('Property search request', {
            params: searchParams,
            userAgent: req.get('User-Agent'),
            ip: req.ip
        });

        // Use the search orchestrator for intelligent routing
        const result = await searchOrchestrator.searchWithFallback(searchParams);

        const responseTime = Date.now() - startTime;

        res.json({
            success: true,
            data: result.properties,
            metadata: {
                searchType: result.searchType,
                responseTime,
                totalResults: result.totalResults,
                poolStatus: result.metadata?.poolStatus,
                recommendations: result.metadata?.recommendations,
                pagination: {
                    limit: searchParams.limit,
                    offset: searchParams.offset,
                    hasMore: result.properties.length === searchParams.limit
                }
            }
        });

        logger.info('Property search completed', {
            searchType: result.searchType,
            resultCount: result.properties.length,
            responseTime,
            poolUtilization: result.metadata?.poolUtilization
        });

    } catch (error) {
        const responseTime = Date.now() - startTime;

        logger.error('Property search failed', {
            error: error.message,
            responseTime,
            params: req.query
        });

        res.status(500).json({
            success: false,
            error: 'Search temporarily unavailable',
            metadata: {
                responseTime,
                errorType: error.name
            }
        });
    }
});

// 6. Optimized property details endpoint
app.get('/api/properties/:id', async (req, res) => {
    try {
        const propertyId = req.params.id;

        // Use optimized property service
        const property = await propertyService.getPropertyById(propertyId);

        if (!property) {
            return res.status(404).json({
                success: false,
                error: 'Property not found'
            });
        }

        // Get similar properties using semantic search
        const similarProperties = await propertyService.findSimilarProperties(propertyId, 5);

        res.json({
            success: true,
            data: {
                property,
                similarProperties
            },
            metadata: {
                cacheHit: property.metadata?.cacheHit,
                poolUtilization: property.metadata?.poolUtilization
            }
        });

    } catch (error) {
        logger.error('Property details fetch failed', {
            error: error.message,
            propertyId: req.params.id
        });

        res.status(500).json({
            success: false,
            error: 'Unable to fetch property details'
        });
    }
});

// 7. Property recommendations endpoint
app.get('/api/properties/:id/similar', async (req, res) => {
    try {
        const propertyId = req.params.id;
        const limit = parseInt(req.query.limit as string) || 10;

        const similarProperties = await propertyService.findSimilarProperties(propertyId, limit);

        res.json({
            success: true,
            data: similarProperties,
            metadata: {
                algorithm: 'vector_similarity',
                poolStatus: poolManager.getPoolStatus()
            }
        });

    } catch (error) {
        logger.error('Similar properties fetch failed', {
            error: error.message,
            propertyId: req.params.id
        });

        res.status(500).json({
            success: false,
            error: 'Unable to fetch similar properties'
        });
    }
});

// 8. Admin metrics endpoint
app.get('/api/admin/metrics', async (req, res) => {
    try {
        const [
            poolHealth,
            searchHealth,
            propertyServiceHealth,
            meilisearchMetrics
        ] = await Promise.all([
            poolManager.getPropertyPlatformHealth(),
            searchOrchestrator.getSearchHealth(),
            propertyService.getServiceHealth(),
            meilisearchService.getMetrics()
        ]);

        res.json({
            timestamp: new Date().toISOString(),
            platform: {
                status: poolHealth.status,
                uptime: process.uptime(),
                version: process.env.npm_package_version
            },
            database: {
                poolHealth: poolHealth.poolHealth,
                scalingHealth: poolHealth.scalingHealth,
                recommendations: poolHealth.recommendations
            },
            search: {
                orchestrator: searchHealth,
                propertyService: propertyServiceHealth,
                meilisearch: meilisearchMetrics
            },
            performance: {
                memoryUsage: process.memoryUsage(),
                cpuUsage: process.cpuUsage()
            }
        });

    } catch (error) {
        logger.error('Metrics fetch failed', { error: error.message });

        res.status(500).json({
            success: false,
            error: 'Unable to fetch metrics'
        });
    }
});

// 9. Graceful shutdown handling
process.on('SIGTERM', async () => {
    logger.info('Received SIGTERM, shutting down gracefully');

    try {
        await poolManager.shutdown();
        logger.info('Pool manager shut down successfully');
        process.exit(0);
    } catch (error) {
        logger.error('Error during shutdown', { error: error.message });
        process.exit(1);
    }
});

// 10. Initialize and start server
async function startServer() {
    try {
        // Initialize the pool manager
        await poolManager.initialize();
        logger.info('Pool manager initialized successfully');

        // Setup event listeners for monitoring
        poolManager.on('poolScaled', (event) => {
            logger.info('Pool scaling event', {
                action: event.action,
                reason: event.reason,
                oldMax: event.oldMax,
                newMax: event.newMax,
                utilization: event.metrics.poolUtilization
            });
        });

        poolManager.on('slowQuery', (queryInfo) => {
            logger.warn('Slow query detected', {
                duration: queryInfo.duration,
                query: queryInfo.query.substring(0, 100),
                suggestions: queryInfo.optimizationSuggestions
            });
        });

        poolManager.on('highUtilization', (metrics) => {
            logger.warn('High pool utilization detected', {
                utilization: metrics.poolUtilization,
                activeConnections: metrics.activeConnections,
                waitingRequests: metrics.waitingRequests
            });
        });

        // Start the server
        const PORT = process.env.PORT || 3000;
        app.listen(PORT, () => {
            logger.info(`Property search API server started on port ${PORT}`, {
                environment: process.env.NODE_ENV,
                poolConfig: {
                    maxConnections: poolManager.getScalingConfig()?.maxConnections,
                    autoScalingEnabled: poolManager.getScalingConfig()?.enabled
                }
            });
        });

    } catch (error) {
        logger.error('Failed to start server', { error: error.message });
        process.exit(1);
    }
}

// Start the server
startServer();

export { app, poolManager, searchOrchestrator, propertyService };