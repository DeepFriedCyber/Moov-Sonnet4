// Database monitoring and health check utilities
import { IDatabaseService, DatabaseMetrics } from '../interfaces/database.interfaces';

export interface HealthStatus {
    status: 'healthy' | 'degraded' | 'unhealthy';
    timestamp: Date;
    metrics: DatabaseMetrics;
    checks: HealthCheck[];
    uptime: number;
}

export interface HealthCheck {
    name: string;
    status: 'pass' | 'fail' | 'warn';
    message: string;
    duration: number;
    details?: any;
}

export class DatabaseMonitor {
    private startTime: Date;

    constructor(private db: IDatabaseService) {
        this.startTime = new Date();
    }

    async getHealthStatus(): Promise<HealthStatus> {
        const checks: HealthCheck[] = [];
        const startTime = Date.now();

        // Basic connectivity check
        const connectivityCheck = await this.checkConnectivity();
        checks.push(connectivityCheck);

        // Query performance check
        const performanceCheck = await this.checkQueryPerformance();
        checks.push(performanceCheck);

        // Extension check
        const extensionCheck = await this.checkExtensions();
        checks.push(extensionCheck);

        // Table existence check
        const tableCheck = await this.checkTables();
        checks.push(tableCheck);

        // Determine overall status
        const failedChecks = checks.filter(c => c.status === 'fail');
        const warnChecks = checks.filter(c => c.status === 'warn');

        let status: 'healthy' | 'degraded' | 'unhealthy';
        if (failedChecks.length > 0) {
            status = 'unhealthy';
        } else if (warnChecks.length > 0) {
            status = 'degraded';
        } else {
            status = 'healthy';
        }

        return {
            status,
            timestamp: new Date(),
            metrics: (this.db as any).getMetrics?.() || this.getDefaultMetrics(),
            checks,
            uptime: Date.now() - this.startTime.getTime(),
        };
    }

    private async checkConnectivity(): Promise<HealthCheck> {
        const startTime = Date.now();

        try {
            await this.db.query('SELECT 1');
            return {
                name: 'database_connectivity',
                status: 'pass',
                message: 'Database connection is healthy',
                duration: Date.now() - startTime,
            };
        } catch (error) {
            return {
                name: 'database_connectivity',
                status: 'fail',
                message: 'Failed to connect to database',
                duration: Date.now() - startTime,
                details: error,
            };
        }
    }

    private async checkQueryPerformance(): Promise<HealthCheck> {
        const startTime = Date.now();

        try {
            await this.db.query('SELECT COUNT(*) FROM properties WHERE is_active = true');
            const duration = Date.now() - startTime;

            let status: 'pass' | 'warn' | 'fail';
            let message: string;

            if (duration < 100) {
                status = 'pass';
                message = 'Query performance is optimal';
            } else if (duration < 1000) {
                status = 'warn';
                message = 'Query performance is acceptable but could be improved';
            } else {
                status = 'fail';
                message = 'Query performance is poor';
            }

            return {
                name: 'query_performance',
                status,
                message,
                duration,
                details: { queryTimeMs: duration },
            };
        } catch (error) {
            return {
                name: 'query_performance',
                status: 'fail',
                message: 'Performance check query failed',
                duration: Date.now() - startTime,
                details: error,
            };
        }
    }

    private async checkExtensions(): Promise<HealthCheck> {
        const startTime = Date.now();

        try {
            const result = await this.db.query(
                "SELECT extname FROM pg_extension WHERE extname = 'vector'"
            );

            if (result.rows.length > 0) {
                return {
                    name: 'vector_extension',
                    status: 'pass',
                    message: 'pgvector extension is installed',
                    duration: Date.now() - startTime,
                };
            } else {
                return {
                    name: 'vector_extension',
                    status: 'fail',
                    message: 'pgvector extension is not installed',
                    duration: Date.now() - startTime,
                };
            }
        } catch (error) {
            return {
                name: 'vector_extension',
                status: 'fail',
                message: 'Failed to check extensions',
                duration: Date.now() - startTime,
                details: error,
            };
        }
    }

    private async checkTables(): Promise<HealthCheck> {
        const startTime = Date.now();

        try {
            const result = await this.db.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'properties'
      `);

            if (result.rows.length > 0) {
                return {
                    name: 'table_existence',
                    status: 'pass',
                    message: 'Required tables exist',
                    duration: Date.now() - startTime,
                };
            } else {
                return {
                    name: 'table_existence',
                    status: 'fail',
                    message: 'Properties table does not exist',
                    duration: Date.now() - startTime,
                };
            }
        } catch (error) {
            return {
                name: 'table_existence',
                status: 'fail',
                message: 'Failed to check table existence',
                duration: Date.now() - startTime,
                details: error,
            };
        }
    }

    private getDefaultMetrics(): DatabaseMetrics {
        return {
            totalConnections: 0,
            activeConnections: 0,
            idleConnections: 0,
            totalQueries: 0,
            averageQueryTime: 0,
            slowQueries: 0,
            errors: 0,
        };
    }

    async logMetrics(): Promise<void> {
        const status = await this.getHealthStatus();
        console.log(`📊 Database Health Status: ${status.status.toUpperCase()}`);
        console.log(`⏱️  Uptime: ${Math.round(status.uptime / 1000)}s`);
        console.log(`📈 Metrics:`, status.metrics);

        const failedChecks = status.checks.filter(c => c.status === 'fail');
        if (failedChecks.length > 0) {
            console.warn('❌ Failed checks:', failedChecks.map(c => c.name));
        }
    }
}