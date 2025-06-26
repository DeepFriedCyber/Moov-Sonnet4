// Advanced Health Check Router with Property Platform Integration
import { Router, Request, Response } from 'express';
import { PropertyPoolManager } from '../database/PropertyPoolManager';
import { SearchOrchestrator } from '../services/SearchOrchestrator';
import { OptimizedPropertyService } from '../services/OptimizedPropertyService';
import { MeilisearchService } from '../services/MeilisearchService';
import { Logger } from '../lib/logger';

export interface HealthCheckDependencies {
    database: PropertyPoolManager;
    searchOrchestrator?: SearchOrchestrator;
    propertyService?: OptimizedPropertyService;
    meilisearch?: MeilisearchService;
}

export interface HealthCheckResponse {
    status: 'healthy' | 'degraded' | 'unhealthy';
    timestamp: string;
    version?: string;
    environment?: string;
    uptime: number;
    checks: {
        database: any;
        connectionPool: any;
        search?: any;
        dependencies: any;
        performance?: any;
    };
    metadata?: {
        requestId: string;
        responseTime: number;
        recommendations?: string[];
    };
}

export function createAdvancedHealthRouter(dependencies: HealthCheckDependencies): Router {
    const router = Router();
    const logger = new Logger('AdvancedHealthRouter');
    const { database, searchOrchestrator, propertyService, meilisearch } = dependencies;

    // Enhanced health check endpoint
    router.get('/health/advanced', async (req: Request, res: Response) => {
        const startTime = Date.now();
        const requestId = generateRequestId();

        try {
            logger.info('Advanced health check requested', { requestId });

            const dbHealth = await database.healthCheck();
            const poolStatus = database.getPoolStatus();
            const platformHealth = database.getPropertyPlatformHealth();
            
            const status = dbHealth && platformHealth.status !== 'critical' ? 'healthy' : 'unhealthy';
            const responseTime = Date.now() - startTime;

            const response: HealthCheckResponse = {
                status,
                timestamp: new Date().toISOString(),
                version: process.env.npm_package_version || '1.0.0',
                environment: process.env.NODE_ENV || 'development',
                uptime: process.uptime(),
                checks: {
                    database: {
                        status: dbHealth ? 'pass' : 'fail',
                        responseTime: responseTime,
                        platformHealth: platformHealth.poolHealth
                    },
                    connectionPool: {
                        status: poolStatus.totalCount > 0 ? 'pass' : 'fail',
                        activeConnections: poolStatus.totalCount,
                        idleConnections: poolStatus.idleCount,
                        waitingRequests: poolStatus.waitingCount,
                        utilization: `${Math.round((poolStatus.totalCount / 20) * 100)}%`,
                        autoScaling: {
                            enabled: database.getScalingConfig()?.enabled,
                            status: platformHealth.scalingHealth.status
                        }
                    },
                    dependencies: {
                        database: dbHealth ? 'healthy' : 'unhealthy',
                        poolManager: platformHealth.status
                    }
                },
                metadata: {
                    requestId,
                    responseTime,
                    recommendations: platformHealth.recommendations
                }
            };

            res.status(dbHealth ? 200 : 503).json(response);

        } catch (error) {
            logger.error('Advanced health check failed', {
                requestId,
                error: error.message
            });

            res.status(503).json({
                status: 'unhealthy',
                timestamp: new Date().toISOString(),
                checks: {
                    database: { status: 'fail', error: error.message },
                    connectionPool: { status: 'fail' },
                    dependencies: { database: 'unhealthy' }
                },
                metadata: {
                    requestId,
                    responseTime: Date.now() - startTime
                }
            });
        }
    });

    // Comprehensive health check with all services
    router.get('/health/comprehensive', async (req: Request, res: Response) => {
        const startTime = Date.now();
        const requestId = generateRequestId();

        try {
            logger.info('Comprehensive health check requested', { requestId });

            // Parallel health checks for better performance
            const [
                dbHealth,
                poolHealth,
                searchHealth,
                propertyServiceHealth,
                meilisearchHealth
            ] = await Promise.allSettled([
                database.getDetailedHealthStatus(),
                database.getPropertyPlatformHealth(),
                searchOrchestrator?.getSearchHealth(),
                propertyService?.getServiceHealth(),
                checkMeilisearchHealth(meilisearch)
            ]);

            const response = buildComprehensiveHealthResponse({
                requestId,
                startTime,
                dbHealth,
                poolHealth,
                searchHealth,
                propertyServiceHealth,
                meilisearchHealth
            });

            const statusCode = response.status === 'healthy' ? 200 : 
                              response.status === 'degraded' ? 200 : 503;

            res.status(statusCode).json(response);

        } catch (error) {
            logger.error('Comprehensive health check failed', {
                requestId,
                error: error.message
            });

            res.status(503).json({
                status: 'unhealthy',
                timestamp: new Date().toISOString(),
                checks: {
                    database: { status: 'fail', error: error.message },
                    connectionPool: { status: 'fail' },
                    search: { status: 'fail' },
                    dependencies: { error: 'Health check system failure' }
                },
                metadata: {
                    requestId,
                    responseTime: Date.now() - startTime,
                    error: error.message
                }
            });
        }
    });

    // Pool-specific health endpoint
    router.get('/health/pool', async (req: Request, res: Response) => {
        const startTime = Date.now();
        const requestId = generateRequestId();

        try {
            const poolStatus = database.getPoolStatus();
            const dbMetrics = database.getMetrics();
            const platformHealth = database.getPropertyPlatformHealth();
            const scalingHistory = database.getScalingHistory().slice(-5); // Last 5 scaling events

            const response = {
                status: platformHealth.status,
                timestamp: new Date().toISOString(),
                pool: {
                    status: platformHealth.poolHealth.status,
                    connections: {
                        active: poolStatus.totalCount,
                        idle: poolStatus.idleCount,
                        waiting: poolStatus.waitingCount,
                        utilization: `${Math.round(platformHealth.poolHealth.utilization * 100)}%`
                    },
                    performance: {
                        averageQueryTime: `${Math.round(dbMetrics.averageQueryTime)}ms`,
                        slowQueries: dbMetrics.slowQueries,
                        errorRate: `${Math.round((dbMetrics.errors / dbMetrics.totalQueries) * 100)}%`,
                        totalQueries: dbMetrics.totalQueries
                    }
                },
                autoScaling: {
                    enabled: database.getScalingConfig()?.enabled,
                    status: platformHealth.scalingHealth.status,
                    recentEvents: scalingHistory.length,
                    lastAction: platformHealth.scalingHealth.lastScalingAction,
                    config: {
                        minConnections: database.getScalingConfig()?.minConnections,
                        maxConnections: database.getScalingConfig()?.maxConnections,
                        scaleUpThreshold: database.getScalingConfig()?.scaleUpThreshold,
                        scaleDownThreshold: database.getScalingConfig()?.scaleDownThreshold
                    }
                },
                recommendations: platformHealth.recommendations,
                metadata: {
                    requestId,
                    responseTime: Date.now() - startTime
                }
            };

            res.status(200).json(response);

        } catch (error) {
            logger.error('Pool health check failed', {
                requestId,
                error: error.message
            });

            res.status(500).json({
                status: 'error',
                timestamp: new Date().toISOString(),
                error: error.message,
                metadata: {
                    requestId,
                    responseTime: Date.now() - startTime
                }
            });
        }
    });

    // Search health endpoint
    router.get('/health/search', async (req: Request, res: Response) => {
        const startTime = Date.now();
        const requestId = generateRequestId();

        try {
            const searchHealth = searchOrchestrator ? 
                await searchOrchestrator.getSearchHealth() : 
                { overall: 'not_configured' };

            const propertyServiceHealth = propertyService ? 
                await propertyService.getServiceHealth() : 
                { status: 'not_configured' };

            const meilisearchHealth = await checkMeilisearchHealth(meilisearch);

            const response = {
                status: searchHealth.overall,
                timestamp: new Date().toISOString(),
                services: {
                    searchOrchestrator: {
                        status: searchHealth.overall,
                        database: searchHealth.database,
                        meilisearch: searchHealth.meilisearch
                    },
                    propertyService: {
                        status: propertyServiceHealth.status,
                        poolUtilization: propertyServiceHealth.poolUtilization,
                        cacheSize: propertyServiceHealth.cacheSize,
                        averageQueryTime: propertyServiceHealth.averageQueryTime,
                        recommendations: propertyServiceHealth.recommendations
                    },
                    meilisearch: meilisearchHealth
                },
                metadata: {
                    requestId,
                    responseTime: Date.now() - startTime
                }
            };

            const statusCode = searchHealth.overall === 'healthy' ? 200 : 
                              searchHealth.overall === 'degraded' ? 200 : 503;

            res.status(statusCode).json(response);

        } catch (error) {
            logger.error('Search health check failed', {
                requestId,
                error: error.message
            });

            res.status(503).json({
                status: 'unhealthy',
                timestamp: new Date().toISOString(),
                error: error.message,
                metadata: {
                    requestId,
                    responseTime: Date.now() - startTime
                }
            });
        }
    });

    // Performance metrics endpoint
    router.get('/health/performance', async (req: Request, res: Response) => {
        const startTime = Date.now();
        const requestId = generateRequestId();

        try {
            const poolStatus = database.getPoolStatus();
            const dbMetrics = database.getMetrics();
            const scalingHistory = database.getScalingHistory();
            const platformHealth = database.getPropertyPlatformHealth();

            // Calculate performance trends
            const recentMetrics = scalingHistory.slice(-10);
            const avgUtilization = recentMetrics.length > 0 ? 
                recentMetrics.reduce((sum, m) => sum + m.poolUtilization, 0) / recentMetrics.length : 0;
            const avgQueryTime = recentMetrics.length > 0 ? 
                recentMetrics.reduce((sum, m) => sum + m.averageQueryTime, 0) / recentMetrics.length : 0;

            const response = {
                timestamp: new Date().toISOString(),
                current: {
                    poolUtilization: `${Math.round(platformHealth.poolHealth.utilization * 100)}%`,
                    activeConnections: poolStatus.totalCount,
                    waitingRequests: poolStatus.waitingCount,
                    averageQueryTime: `${Math.round(dbMetrics.averageQueryTime)}ms`,
                    slowQueries: dbMetrics.slowQueries,
                    errorRate: `${Math.round((dbMetrics.errors / dbMetrics.totalQueries) * 100)}%`
                },
                trends: {
                    averageUtilization: `${Math.round(avgUtilization * 100)}%`,
                    averageQueryTime: `${Math.round(avgQueryTime)}ms`,
                    scalingEvents: scalingHistory.length,
                    recentScalingEvents: recentMetrics.length
                },
                thresholds: {
                    utilizationWarning: '70%',
                    utilizationCritical: '85%',
                    queryTimeWarning: '500ms',
                    queryTimeCritical: '1000ms',
                    errorRateWarning: '1%',
                    errorRateCritical: '5%'
                },
                recommendations: platformHealth.recommendations,
                metadata: {
                    requestId,
                    responseTime: Date.now() - startTime,
                    dataPoints: recentMetrics.length
                }
            };

            res.status(200).json(response);

        } catch (error) {
            logger.error('Performance metrics request failed', {
                requestId,
                error: error.message
            });

            res.status(500).json({
                error: 'Failed to retrieve performance metrics',
                timestamp: new Date().toISOString(),
                metadata: {
                    requestId,
                    responseTime: Date.now() - startTime
                }
            });
        }
    });

    return router;
}

// Helper functions

function generateRequestId(): string {
    return `health_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

async function checkMeilisearchHealth(meilisearch?: MeilisearchService): Promise<any> {
    if (!meilisearch) {
        return { status: 'not_configured' };
    }

    try {
        const health = await meilisearch.health();
        return {
            status: 'healthy',
            version: health.version || 'unknown',
            responseTime: health.responseTime || 0
        };
    } catch (error) {
        return {
            status: 'unhealthy',
            error: error.message
        };
    }
}

function buildComprehensiveHealthResponse(params: {
    requestId: string;
    startTime: number;
    dbHealth: PromiseSettledResult<any>;
    poolHealth: PromiseSettledResult<any>;
    searchHealth: PromiseSettledResult<any>;
    propertyServiceHealth: PromiseSettledResult<any>;
    meilisearchHealth: PromiseSettledResult<any>;
}): HealthCheckResponse {
    const { requestId, startTime, dbHealth, poolHealth, searchHealth, propertyServiceHealth, meilisearchHealth } = params;
    const responseTime = Date.now() - startTime;

    // Extract health status from each check
    const dbHealthy = dbHealth.status === 'fulfilled' && dbHealth.value.isHealthy;
    const poolHealthy = poolHealth.status === 'fulfilled' && poolHealth.value.status === 'healthy';
    const searchHealthy = searchHealth.status === 'fulfilled' && 
                         (!searchHealth.value || searchHealth.value.overall === 'healthy');
    const propertyServiceHealthy = propertyServiceHealth.status === 'fulfilled' && 
                                  (!propertyServiceHealth.value || propertyServiceHealth.value.status === 'healthy');
    const meilisearchHealthy = meilisearchHealth.status === 'fulfilled' && 
                              meilisearchHealth.value.status === 'healthy';

    // Determine overall status
    const healthyCount = [dbHealthy, poolHealthy, searchHealthy, propertyServiceHealthy, meilisearchHealthy]
        .filter(Boolean).length;
    const totalChecks = 5;

    let overallStatus: 'healthy' | 'degraded' | 'unhealthy';
    if (healthyCount === totalChecks) {
        overallStatus = 'healthy';
    } else if (healthyCount >= totalChecks * 0.6) {
        overallStatus = 'degraded';
    } else {
        overallStatus = 'unhealthy';
    }

    // Build recommendations
    const recommendations: string[] = [];
    if (!dbHealthy) recommendations.push('Database connectivity issues detected');
    if (!poolHealthy) recommendations.push('Connection pool performance issues detected');
    if (!searchHealthy) recommendations.push('Search service degradation detected');
    if (!propertyServiceHealthy) recommendations.push('Property service performance issues detected');
    if (!meilisearchHealthy) recommendations.push('Meilisearch service issues detected');

    return {
        status: overallStatus,
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        uptime: process.uptime(),
        checks: {
            database: dbHealth.status === 'fulfilled' ? dbHealth.value : { 
                status: 'fail', 
                error: dbHealth.reason?.message 
            },
            connectionPool: poolHealth.status === 'fulfilled' ? {
                status: poolHealth.value.poolHealth.status === 'healthy' ? 'pass' : 'fail',
                details: poolHealth.value
            } : { 
                status: 'fail', 
                error: poolHealth.reason?.message 
            },
            search: searchHealth.status === 'fulfilled' ? searchHealth.value : {
                status: 'fail',
                error: searchHealth.reason?.message
            },
            dependencies: {
                database: dbHealthy ? 'healthy' : 'unhealthy',
                meilisearch: meilisearchHealth.status === 'fulfilled' ? 
                    meilisearchHealth.value.status : 'unhealthy',
                propertyService: propertyServiceHealthy ? 'healthy' : 'degraded'
            },
            performance: propertyServiceHealth.status === 'fulfilled' ? 
                propertyServiceHealth.value : undefined
        },
        metadata: {
            requestId,
            responseTime,
            recommendations: recommendations.length > 0 ? recommendations : undefined
        }
    };
}

// Export utility functions for testing
export { generateRequestId, checkMeilisearchHealth, buildComprehensiveHealthResponse };