// Property Pool Manager with Auto-Scaling for Property Platform
import { DatabaseService, DatabaseConfig } from '../lib/database';
import { Logger } from '../lib/logger';

export interface PropertyPoolConfig extends DatabaseConfig {
    autoScaling?: {
        enabled: boolean;
        minConnections: number;
        maxConnections: number;
        scaleUpThreshold: number;
        scaleDownThreshold: number;
        scaleUpIncrement: number;
        scaleDownIncrement: number;
        cooldownPeriod: number; // milliseconds
        peakHours: number[];
        offPeakHours: number[];
    };
    monitoring?: {
        metricsInterval: number;
        alertThresholds: {
            highUtilization: number;
            slowQueries: number;
            errorRate: number;
        };
    };
}

export interface ScalingMetrics {
    timestamp: number;
    poolUtilization: number;
    averageQueryTime: number;
    errorRate: number;
    activeConnections: number;
    waitingRequests: number;
    currentHour: number;
    isPeakHour: boolean;
}

export class PropertyPoolManager extends DatabaseService {
    private logger: Logger;
    private scalingConfig: PropertyPoolConfig['autoScaling'];
    private monitoringConfig: PropertyPoolConfig['monitoring'];
    private scalingTimer?: NodeJS.Timeout;
    private metricsTimer?: NodeJS.Timeout;
    private lastScalingAction = 0;
    private scalingHistory: ScalingMetrics[] = [];
    private readonly MAX_HISTORY_SIZE = 100;

    // UK property search peak hours (9 AM, 12 PM, 5 PM, 7 PM)
    private readonly DEFAULT_PEAK_HOURS = [9, 12, 17, 19];
    private readonly DEFAULT_OFF_PEAK_HOURS = [2, 3, 4, 5, 6];

    constructor(config: PropertyPoolConfig) {
        super(config);

        this.logger = new Logger('PropertyPoolManager');

        this.scalingConfig = {
            enabled: true,
            minConnections: 5,
            maxConnections: 50,
            scaleUpThreshold: 0.7,
            scaleDownThreshold: 0.3,
            scaleUpIncrement: 5,
            scaleDownIncrement: 2,
            cooldownPeriod: 5 * 60 * 1000, // 5 minutes
            peakHours: this.DEFAULT_PEAK_HOURS,
            offPeakHours: this.DEFAULT_OFF_PEAK_HOURS,
            ...config.autoScaling
        };

        this.monitoringConfig = {
            metricsInterval: 60 * 1000, // 1 minute
            alertThresholds: {
                highUtilization: 0.85,
                slowQueries: 10,
                errorRate: 0.05
            },
            ...config.monitoring
        };

        if (this.scalingConfig.enabled) {
            this.setupAutoScaling();
        }

        this.setupMonitoring();
        this.setupEventHandlers();
    }

    private setupAutoScaling(): void {
        this.logger.info('Setting up auto-scaling for property platform', {
            minConnections: this.scalingConfig!.minConnections,
            maxConnections: this.scalingConfig!.maxConnections,
            peakHours: this.scalingConfig!.peakHours,
            scaleUpThreshold: this.scalingConfig!.scaleUpThreshold,
            scaleDownThreshold: this.scalingConfig!.scaleDownThreshold
        });

        // Check scaling conditions every minute
        this.scalingTimer = setInterval(() => {
            this.evaluateScaling();
        }, 60000);
    }

    private setupMonitoring(): void {
        this.logger.info('Setting up property platform monitoring', {
            metricsInterval: this.monitoringConfig!.metricsInterval,
            alertThresholds: this.monitoringConfig!.alertThresholds
        });

        // Collect metrics at specified interval
        this.metricsTimer = setInterval(() => {
            this.collectMetrics();
        }, this.monitoringConfig!.metricsInterval);
    }

    private setupEventHandlers(): void {
        // Listen to database events for property-specific handling
        this.on('slowQuery', (queryInfo) => {
            this.handleSlowQuery(queryInfo);
        });

        this.on('poolError', (error) => {
            this.handlePoolError(error);
        });

        this.on('highUtilization', (metrics) => {
            this.handleHighUtilization(metrics);
        });
    }

    private async evaluateScaling(): Promise<void> {
        try {
            const currentTime = Date.now();
            const cooldownRemaining = this.lastScalingAction + this.scalingConfig!.cooldownPeriod - currentTime;

            if (cooldownRemaining > 0) {
                this.logger.debug('Scaling in cooldown period', {
                    remainingMs: cooldownRemaining
                });
                return;
            }

            const metrics = this.getCurrentMetrics();
            const shouldScale = this.shouldScale(metrics);

            if (shouldScale.action !== 'none') {
                await this.executeScaling(shouldScale.action, shouldScale.reason, metrics);
            }

        } catch (error) {
            this.logger.error('Error during scaling evaluation', {
                error: error.message
            });
        }
    }

    private getCurrentMetrics(): ScalingMetrics {
        const poolStatus = this.getPoolStatus();
        const dbMetrics = this.getMetrics();
        const currentHour = new Date().getHours();

        const poolUtilization = poolStatus.totalCount / this.getCurrentMaxConnections();
        const errorRate = dbMetrics.totalQueries > 0 ? dbMetrics.errors / dbMetrics.totalQueries : 0;

        return {
            timestamp: Date.now(),
            poolUtilization,
            averageQueryTime: dbMetrics.averageQueryTime,
            errorRate,
            activeConnections: poolStatus.totalCount,
            waitingRequests: poolStatus.waitingCount,
            currentHour,
            isPeakHour: this.scalingConfig!.peakHours.includes(currentHour)
        };
    }

    private shouldScale(metrics: ScalingMetrics): { action: 'up' | 'down' | 'none'; reason: string } {
        const { poolUtilization, isPeakHour, waitingRequests, averageQueryTime } = metrics;

        // Scale up conditions
        if (isPeakHour && poolUtilization > this.scalingConfig!.scaleUpThreshold) {
            return { action: 'up', reason: 'High utilization during peak hours' };
        }

        if (waitingRequests > 0 && poolUtilization > 0.8) {
            return { action: 'up', reason: 'Requests waiting with high utilization' };
        }

        if (averageQueryTime > 1000 && poolUtilization > 0.6) {
            return { action: 'up', reason: 'Slow queries with moderate utilization' };
        }

        // Scale down conditions
        if (!isPeakHour && poolUtilization < this.scalingConfig!.scaleDownThreshold) {
            return { action: 'down', reason: 'Low utilization during off-peak hours' };
        }

        if (this.scalingConfig!.offPeakHours.includes(metrics.currentHour) && poolUtilization < 0.2) {
            return { action: 'down', reason: 'Very low utilization during off-peak hours' };
        }

        return { action: 'none', reason: 'No scaling needed' };
    }

    private async executeScaling(action: 'up' | 'down', reason: string, metrics: ScalingMetrics): Promise<void> {
        const currentMax = this.getCurrentMaxConnections();
        let newMax: number;

        if (action === 'up') {
            newMax = Math.min(
                currentMax + this.scalingConfig!.scaleUpIncrement,
                this.scalingConfig!.maxConnections
            );
        } else {
            newMax = Math.max(
                currentMax - this.scalingConfig!.scaleDownIncrement,
                this.scalingConfig!.minConnections
            );
        }

        if (newMax === currentMax) {
            this.logger.debug('Scaling limit reached', {
                action,
                currentMax,
                requestedMax: newMax,
                reason
            });
            return;
        }

        try {
            await this.updateMaxConnections(newMax);
            this.lastScalingAction = Date.now();

            this.logger.info('Pool scaled successfully', {
                action,
                reason,
                oldMax: currentMax,
                newMax,
                poolUtilization: `${Math.round(metrics.poolUtilization * 100)}%`,
                activeConnections: metrics.activeConnections,
                waitingRequests: metrics.waitingRequests
            });

            // Emit scaling event
            this.emit('poolScaled', {
                action,
                reason,
                oldMax: currentMax,
                newMax,
                metrics,
                timestamp: new Date().toISOString()
            });

            // Store scaling history
            this.addToScalingHistory(metrics);

        } catch (error) {
            this.logger.error('Failed to scale pool', {
                action,
                reason,
                error: error.message,
                currentMax,
                requestedMax: newMax
            });
        }
    }

    private async updateMaxConnections(newMax: number): Promise<void> {
        // This would update the pool configuration
        // Implementation depends on the underlying pool library
        this.logger.info('Updating max connections', {
            newMax,
            currentConfig: this.getPoolStatus()
        });

        // For now, we'll emit an event that could be handled by infrastructure
        this.emit('configurationUpdate', {
            maxConnections: newMax,
            timestamp: new Date().toISOString()
        });
    }

    private getCurrentMaxConnections(): number {
        // This should return the current max connections from pool config
        // For now, return a default value
        return 20; // This should be dynamic based on actual pool config
    }

    private collectMetrics(): void {
        const metrics = this.getCurrentMetrics();
        this.addToScalingHistory(metrics);

        // Check alert thresholds
        this.checkAlertThresholds(metrics);

        // Emit metrics for external monitoring
        this.emit('metricsCollected', {
            metrics,
            timestamp: new Date().toISOString()
        });
    }

    private checkAlertThresholds(metrics: ScalingMetrics): void {
        const thresholds = this.monitoringConfig!.alertThresholds;

        if (metrics.poolUtilization > thresholds.highUtilization) {
            this.emit('highUtilization', {
                utilization: metrics.poolUtilization,
                threshold: thresholds.highUtilization,
                metrics
            });
        }

        if (metrics.errorRate > thresholds.errorRate) {
            this.emit('highErrorRate', {
                errorRate: metrics.errorRate,
                threshold: thresholds.errorRate,
                metrics
            });
        }

        if (metrics.averageQueryTime > 1000) { // 1 second threshold
            this.emit('slowQueries', {
                averageQueryTime: metrics.averageQueryTime,
                threshold: 1000,
                metrics
            });
        }
    }

    private addToScalingHistory(metrics: ScalingMetrics): void {
        this.scalingHistory.push(metrics);

        // Keep only recent history
        if (this.scalingHistory.length > this.MAX_HISTORY_SIZE) {
            this.scalingHistory = this.scalingHistory.slice(-this.MAX_HISTORY_SIZE);
        }
    }

    private handleSlowQuery(queryInfo: any): void {
        this.logger.warn('Slow query detected in property platform', {
            query: queryInfo.query?.substring(0, 100),
            duration: queryInfo.duration,
            table: this.extractTableFromQuery(queryInfo.query)
        });

        // If it's a property-related query, consider optimization
        if (this.isPropertyQuery(queryInfo.query)) {
            this.emit('propertyQueryOptimizationNeeded', {
                query: queryInfo.query,
                duration: queryInfo.duration,
                suggestions: this.getQueryOptimizationSuggestions(queryInfo.query)
            });
        }
    }

    private handlePoolError(error: any): void {
        this.logger.error('Pool error in property platform', {
            error: error.message,
            poolStatus: this.getPoolStatus(),
            metrics: this.getMetrics()
        });

        // Emit critical alert for property platform
        this.emit('criticalError', {
            error: error.message,
            component: 'PropertyPoolManager',
            timestamp: new Date().toISOString(),
            poolStatus: this.getPoolStatus()
        });
    }

    private handleHighUtilization(metrics: any): void {
        this.logger.warn('High pool utilization detected', {
            utilization: `${Math.round(metrics.utilization * 100)}%`,
            activeConnections: metrics.metrics.activeConnections,
            waitingRequests: metrics.metrics.waitingRequests
        });

        // Consider immediate scaling if conditions are severe
        if (metrics.metrics.waitingRequests > 5) {
            this.logger.info('Emergency scaling triggered due to high waiting requests');
            this.evaluateScaling(); // Trigger immediate scaling evaluation
        }
    }

    private isPropertyQuery(query: string): boolean {
        const propertyTables = ['properties', 'property_embeddings', 'property_images', 'property_features'];
        return propertyTables.some(table => query.toLowerCase().includes(table));
    }

    private extractTableFromQuery(query: string): string {
        const match = query.match(/FROM\s+(\w+)/i);
        return match ? match[1] : 'unknown';
    }

    private getQueryOptimizationSuggestions(query: string): string[] {
        const suggestions: string[] = [];

        if (query.includes('ORDER BY') && !query.includes('LIMIT')) {
            suggestions.push('Add LIMIT clause to ORDER BY queries');
        }

        if (query.includes('LIKE') && query.includes('%')) {
            suggestions.push('Consider full-text search instead of LIKE with wildcards');
        }

        if (query.includes('property_embeddings') && !query.includes('INDEX')) {
            suggestions.push('Ensure vector similarity queries use proper indexes');
        }

        return suggestions;
    }

    // Public methods for monitoring and control

    getScalingHistory(): ScalingMetrics[] {
        return [...this.scalingHistory];
    }

    getScalingConfig(): PropertyPoolConfig['autoScaling'] {
        return { ...this.scalingConfig };
    }

    async updateScalingConfig(newConfig: Partial<PropertyPoolConfig['autoScaling']>): Promise<void> {
        this.scalingConfig = { ...this.scalingConfig, ...newConfig };

        this.logger.info('Scaling configuration updated', {
            newConfig: this.scalingConfig
        });

        this.emit('configurationUpdated', {
            type: 'scaling',
            config: this.scalingConfig,
            timestamp: new Date().toISOString()
        });
    }

    getPropertyPlatformHealth(): {
        status: 'healthy' | 'degraded' | 'critical';
        poolHealth: any;
        scalingHealth: any;
        recommendations: string[];
    } {
        const poolStatus = this.getPoolStatus();
        const metrics = this.getMetrics();
        const currentMetrics = this.getCurrentMetrics();
        const recommendations: string[] = [];

        // Assess pool health
        const poolUtilization = currentMetrics.poolUtilization;
        let poolHealth: 'healthy' | 'degraded' | 'critical';

        if (poolUtilization < 0.7 && metrics.averageQueryTime < 500) {
            poolHealth = 'healthy';
        } else if (poolUtilization < 0.9 && metrics.averageQueryTime < 1000) {
            poolHealth = 'degraded';
            recommendations.push('Monitor pool utilization - approaching high usage');
        } else {
            poolHealth = 'critical';
            recommendations.push('High pool utilization detected - immediate attention required');
        }

        // Assess scaling health
        const recentScaling = this.scalingHistory.slice(-10);
        const scalingFrequency = recentScaling.length;
        let scalingHealth: 'healthy' | 'degraded' | 'critical';

        if (scalingFrequency < 3) {
            scalingHealth = 'healthy';
        } else if (scalingFrequency < 7) {
            scalingHealth = 'degraded';
            recommendations.push('Frequent scaling detected - review scaling thresholds');
        } else {
            scalingHealth = 'critical';
            recommendations.push('Excessive scaling activity - investigate underlying issues');
        }

        // Overall status
        let status: 'healthy' | 'degraded' | 'critical';
        if (poolHealth === 'healthy' && scalingHealth === 'healthy') {
            status = 'healthy';
        } else if (poolHealth === 'critical' || scalingHealth === 'critical') {
            status = 'critical';
        } else {
            status = 'degraded';
        }

        // Add property-specific recommendations
        if (currentMetrics.isPeakHour && poolUtilization > 0.8) {
            recommendations.push('Consider pre-scaling before peak hours');
        }

        if (metrics.slowQueries > 5) {
            recommendations.push('Optimize property search queries for better performance');
        }

        return {
            status,
            poolHealth: {
                status: poolHealth,
                utilization: poolUtilization,
                activeConnections: poolStatus.totalCount,
                waitingRequests: poolStatus.waitingCount,
                averageQueryTime: metrics.averageQueryTime
            },
            scalingHealth: {
                status: scalingHealth,
                recentScalingEvents: scalingFrequency,
                lastScalingAction: new Date(this.lastScalingAction).toISOString(),
                autoScalingEnabled: this.scalingConfig!.enabled
            },
            recommendations
        };
    }

    async shutdown(): Promise<void> {
        this.logger.info('Shutting down PropertyPoolManager');

        if (this.scalingTimer) {
            clearInterval(this.scalingTimer);
        }

        if (this.metricsTimer) {
            clearInterval(this.metricsTimer);
        }

        await super.close();

        this.emit('shutdown', {
            timestamp: new Date().toISOString(),
            finalMetrics: this.getCurrentMetrics()
        });
    }
}