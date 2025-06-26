// Connection Pool Metrics Middleware
import { Request, Response, NextFunction } from 'express';
import { DatabaseService } from '../lib/database';
import { Logger } from '../lib/logger';

export interface PoolMetricsConfig {
    slowRequestThreshold: number; // milliseconds
    enableHeaders: boolean;
    enableLogging: boolean;
    logSlowRequests: boolean;
}

export class PoolMetricsMiddleware {
    private database: DatabaseService;
    private logger: Logger;
    private config: PoolMetricsConfig;

    constructor(database: DatabaseService, config: Partial<PoolMetricsConfig> = {}) {
        this.database = database;
        this.logger = new Logger('PoolMetrics');
        this.config = {
            slowRequestThreshold: 1000,
            enableHeaders: true,
            enableLogging: true,
            logSlowRequests: true,
            ...config
        };
    }

    middleware() {
        return (req: Request, res: Response, next: NextFunction) => {
            const startTime = Date.now();
            const requestId = this.generateRequestId();

            // Add request ID to request for tracing
            (req as any).requestId = requestId;

            // Log request start if enabled
            if (this.config.enableLogging) {
                this.logger.info('Request started', {
                    requestId,
                    method: req.method,
                    path: req.path,
                    userAgent: req.get('User-Agent'),
                    ip: req.ip
                });
            }

            // Capture initial pool status
            const initialPoolStatus = this.database.getPoolStatus();
            const initialMetrics = this.database.getMetrics();

            res.on('finish', () => {
                const duration = Date.now() - startTime;
                const finalPoolStatus = this.database.getPoolStatus();
                const finalMetrics = this.database.getMetrics();

                // Add metrics headers if enabled
                if (this.config.enableHeaders) {
                    this.addMetricsHeaders(res, finalPoolStatus, finalMetrics, duration);
                }

                // Log request completion
                if (this.config.enableLogging) {
                    this.logRequestCompletion(req, res, duration, requestId, finalPoolStatus, finalMetrics);
                }

                // Log slow requests
                if (this.config.logSlowRequests && duration > this.config.slowRequestThreshold) {
                    this.logSlowRequest(req, res, duration, requestId, initialPoolStatus, finalPoolStatus, initialMetrics, finalMetrics);
                }

                // Emit metrics event for monitoring systems
                this.database.emit('requestMetrics', {
                    requestId,
                    method: req.method,
                    path: req.path,
                    statusCode: res.statusCode,
                    duration,
                    poolStatus: finalPoolStatus,
                    metrics: finalMetrics,
                    timestamp: new Date().toISOString()
                });
            });

            res.on('error', (error) => {
                const duration = Date.now() - startTime;
                const poolStatus = this.database.getPoolStatus();
                const metrics = this.database.getMetrics();

                this.logger.error('Request error', {
                    requestId,
                    method: req.method,
                    path: req.path,
                    error: error.message,
                    duration,
                    poolStatus,
                    metrics
                });
            });

            next();
        };
    }

    private addMetricsHeaders(res: Response, poolStatus: any, metrics: any, duration: number): void {
        res.set({
            'X-DB-Pool-Active': poolStatus.totalCount.toString(),
            'X-DB-Pool-Idle': poolStatus.idleCount.toString(),
            'X-DB-Pool-Waiting': poolStatus.waitingCount.toString(),
            'X-DB-Pool-Total': poolStatus.totalCount.toString(),
            'X-DB-Response-Time': duration.toString(),
            'X-DB-Query-Count': metrics.totalQueries.toString(),
            'X-DB-Error-Count': metrics.errors.toString(),
            'X-DB-Avg-Query-Time': Math.round(metrics.averageQueryTime).toString(),
            'X-DB-Slow-Queries': metrics.slowQueries.toString()
        });
    }

    private logRequestCompletion(
        req: Request, 
        res: Response, 
        duration: number, 
        requestId: string, 
        poolStatus: any, 
        metrics: any
    ): void {
        this.logger.info('Request completed', {
            requestId,
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            duration: `${duration}ms`,
            poolUtilization: `${Math.round((poolStatus.totalCount / 20) * 100)}%`, // Assuming max 20 connections
            activeConnections: poolStatus.totalCount,
            idleConnections: poolStatus.idleCount,
            waitingRequests: poolStatus.waitingCount,
            averageQueryTime: `${Math.round(metrics.averageQueryTime)}ms`,
            totalQueries: metrics.totalQueries,
            errors: metrics.errors
        });
    }

    private logSlowRequest(
        req: Request,
        res: Response,
        duration: number,
        requestId: string,
        initialPoolStatus: any,
        finalPoolStatus: any,
        initialMetrics: any,
        finalMetrics: any
    ): void {
        const poolUtilizationChange = finalPoolStatus.totalCount - initialPoolStatus.totalCount;
        const queryCountChange = finalMetrics.totalQueries - initialMetrics.totalQueries;

        this.logger.warn('Slow request detected', {
            requestId,
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            duration: `${duration}ms`,
            threshold: `${this.config.slowRequestThreshold}ms`,
            poolStatus: {
                initial: {
                    active: initialPoolStatus.totalCount,
                    idle: initialPoolStatus.idleCount,
                    waiting: initialPoolStatus.waitingCount
                },
                final: {
                    active: finalPoolStatus.totalCount,
                    idle: finalPoolStatus.idleCount,
                    waiting: finalPoolStatus.waitingCount
                },
                change: {
                    connections: poolUtilizationChange,
                    queries: queryCountChange
                }
            },
            performance: {
                averageQueryTime: `${Math.round(finalMetrics.averageQueryTime)}ms`,
                slowQueries: finalMetrics.slowQueries,
                errorRate: finalMetrics.errors / finalMetrics.totalQueries
            },
            recommendations: this.generateRecommendations(duration, finalPoolStatus, finalMetrics)
        });

        // Emit slow request event for alerting
        this.database.emit('slowRequest', {
            requestId,
            method: req.method,
            path: req.path,
            duration,
            poolStatus: finalPoolStatus,
            metrics: finalMetrics,
            timestamp: new Date().toISOString()
        });
    }

    private generateRecommendations(duration: number, poolStatus: any, metrics: any): string[] {
        const recommendations: string[] = [];

        if (poolStatus.waitingCount > 0) {
            recommendations.push('Consider increasing connection pool size');
        }

        if (metrics.averageQueryTime > 500) {
            recommendations.push('Review and optimize slow queries');
        }

        if (poolStatus.totalCount / 20 > 0.8) { // Assuming max 20 connections
            recommendations.push('High pool utilization - consider read replicas');
        }

        if (metrics.errors / metrics.totalQueries > 0.01) {
            recommendations.push('High error rate detected - investigate query failures');
        }

        if (duration > 5000) {
            recommendations.push('Extremely slow request - consider request timeout optimization');
        }

        return recommendations;
    }

    private generateRequestId(): string {
        return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // Method to get current metrics summary
    getMetricsSummary(): {
        poolStatus: any;
        metrics: any;
        health: boolean;
        timestamp: string;
    } {
        return {
            poolStatus: this.database.getPoolStatus(),
            metrics: this.database.getMetrics(),
            health: this.database.isReady(),
            timestamp: new Date().toISOString()
        };
    }

    // Method to reset metrics (useful for testing or periodic resets)
    async resetMetrics(): Promise<void> {
        // This would reset internal metrics if the database service supports it
        this.logger.info('Metrics reset requested');
        // Implementation depends on database service capabilities
    }
}

// Utility function to create middleware with default configuration
export function createPoolMetricsMiddleware(
    database: DatabaseService, 
    config?: Partial<PoolMetricsConfig>
): (req: Request, res: Response, next: NextFunction) => void {
    const middleware = new PoolMetricsMiddleware(database, config);
    return middleware.middleware();
}

// Express middleware factory for easy integration
export function poolMetrics(database: DatabaseService, config?: Partial<PoolMetricsConfig>) {
    return createPoolMetricsMiddleware(database, config);
}