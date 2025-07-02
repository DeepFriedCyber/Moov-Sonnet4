import * as promClient from 'prom-client';
import { MetricLabels, HistogramStats, SearchMetrics, PropertyViewMetrics } from '@/types/metrics';

export class MetricsCollector {
    private counters: Map<string, promClient.Counter> = new Map();
    private gauges: Map<string, promClient.Gauge> = new Map();
    private histograms: Map<string, promClient.Histogram> = new Map();

    constructor(private registry = promClient.register) {
        // Initialize default metrics
        promClient.collectDefaultMetrics({ register: this.registry });

        this.initializeMetrics();
    }

    private initializeMetrics(): void {
        // API metrics
        this.registerCounter('api_requests_total', 'Total API requests', ['method', 'endpoint', 'status']);
        this.registerHistogram('api_request_duration_ms', 'API request duration in milliseconds', ['method', 'endpoint']);

        // Search metrics
        this.registerCounter('search_total', 'Total search requests');
        this.registerCounter('search_cache_hits', 'Search cache hits');
        this.registerCounter('search_cache_misses', 'Search cache misses');
        this.registerHistogram('search_duration_ms', 'Search duration in milliseconds');
        this.registerHistogram('search_result_count', 'Number of search results');

        // Property metrics
        this.registerCounter('property_views_total', 'Total property views');
        this.registerCounter('property_views_by_source', 'Property views by source', ['source']);
        this.registerHistogram('property_view_duration_ms', 'Property view duration in milliseconds');

        // Business metrics
        this.registerCounter('favorites_added', 'Properties added to favorites');
        this.registerCounter('favorites_removed', 'Properties removed from favorites');
        this.registerCounter('contact_requests', 'Contact requests to agents');

        // System metrics
        this.registerGauge('concurrent_searches', 'Number of concurrent searches');
        this.registerGauge('active_websocket_connections', 'Number of active WebSocket connections');
        this.registerGauge('database_connections', 'Number of database connections');
    }

    private registerCounter(name: string, help: string, labelNames: string[] = []): void {
        const counter = new promClient.Counter({
            name,
            help,
            labelNames,
            registers: [this.registry],
        });
        this.counters.set(name, counter);
    }

    private registerGauge(name: string, help: string, labelNames: string[] = []): void {
        const gauge = new promClient.Gauge({
            name,
            help,
            labelNames,
            registers: [this.registry],
        });
        this.gauges.set(name, gauge);
    }

    private registerHistogram(name: string, help: string, labelNames: string[] = [], buckets?: number[]): void {
        const histogram = new promClient.Histogram({
            name,
            help,
            labelNames,
            buckets: buckets || [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
            registers: [this.registry],
        });
        this.histograms.set(name, histogram);
    }

    // Counter methods
    increment(name: string, labels?: MetricLabels): void {
        const counter = this.counters.get(name);
        if (counter) {
            if (labels) {
                counter.inc(labels);
            } else {
                counter.inc();
            }
        }
    }

    // Gauge methods
    gauge(name: string, value: number, labels?: MetricLabels): void {
        const gauge = this.gauges.get(name);
        if (gauge) {
            if (labels) {
                gauge.set(labels, value);
            } else {
                gauge.set(value);
            }
        }
    }

    incrementGauge(name: string, labels?: MetricLabels): void {
        const gauge = this.gauges.get(name);
        if (gauge) {
            if (labels) {
                gauge.inc(labels);
            } else {
                gauge.inc();
            }
        }
    }

    decrementGauge(name: string, labels?: MetricLabels): void {
        const gauge = this.gauges.get(name);
        if (gauge) {
            if (labels) {
                gauge.dec(labels);
            } else {
                gauge.dec();
            }
        }
    }

    // Histogram methods
    histogram(name: string, value: number, labels?: MetricLabels): void {
        const histogram = this.histograms.get(name);
        if (histogram) {
            if (labels) {
                histogram.observe(labels, value);
            } else {
                histogram.observe(value);
            }
        }
    }

    // Timer helper
    startTimer(name: string, labels?: MetricLabels): { done: (additionalLabels?: MetricLabels) => void } {
        const start = Date.now();

        return {
            done: (additionalLabels?: MetricLabels) => {
                const duration = Date.now() - start;
                const allLabels = { ...labels, ...additionalLabels };
                this.histogram(name, duration, allLabels);
            },
        };
    }

    // Business-specific tracking methods
    trackSearch(metrics: SearchMetrics): void {
        this.increment('search_total');

        if (metrics.cacheHit) {
            this.increment('search_cache_hits');
        } else {
            this.increment('search_cache_misses');
        }

        this.histogram('search_duration_ms', metrics.duration);
        this.histogram('search_result_count', metrics.resultCount);
    }

    trackPropertyView(metrics: PropertyViewMetrics): void {
        this.increment('property_views_total');
        this.increment('property_views_by_source', { source: metrics.source });

        if (metrics.duration) {
            this.histogram('property_view_duration_ms', metrics.duration);
        }
    }

    trackFavoriteAdded(): void {
        this.increment('favorites_added');
    }

    trackFavoriteRemoved(): void {
        this.increment('favorites_removed');
    }

    trackContactRequest(): void {
        this.increment('contact_requests');
    }

    // API request tracking
    trackApiRequest(method: string, endpoint: string, status: number, duration: number): void {
        this.increment('api_requests_total', { method, endpoint, status: status.toString() });
        this.histogram('api_request_duration_ms', duration, { method, endpoint });
    }

    // System metrics
    setConcurrentSearches(count: number): void {
        this.gauge('concurrent_searches', count);
    }

    setActiveWebSocketConnections(count: number): void {
        this.gauge('active_websocket_connections', count);
    }

    setDatabaseConnections(count: number): void {
        this.gauge('database_connections', count);
    }

    // Utility methods
    getMetric(name: string): number {
        const counter = this.counters.get(name);
        if (counter) {
            return (counter as any).hashMap[''].value || 0;
        }

        const gauge = this.gauges.get(name);
        if (gauge) {
            return (gauge as any).hashMap[''].value || 0;
        }

        return 0;
    }

    getMetricWithLabels(name: string): Record<string, number> {
        const metric = this.counters.get(name) || this.gauges.get(name);
        if (metric) {
            const result: Record<string, number> = {};
            const hashMap = (metric as any).hashMap;

            for (const [key, value] of Object.entries(hashMap)) {
                if (key !== '') {
                    result[key] = (value as any).value || 0;
                }
            }

            return result;
        }

        return {};
    }

    getHistogramStats(name: string, labels?: MetricLabels): HistogramStats {
        const histogram = this.histograms.get(name);
        if (!histogram) {
            return {
                count: 0,
                sum: 0,
                mean: 0,
                min: 0,
                max: 0,
                p50: 0,
                p90: 0,
                p95: 0,
                p99: 0,
            };
        }

        // This is a simplified implementation
        // In a real scenario, you'd need to access the histogram's internal data
        const labelString = labels ? Object.entries(labels).map(([k, v]) => `${k}="${v}"`).join(',') : '';
        const buckets = (histogram as any).hashMap[labelString];

        if (!buckets) {
            return {
                count: 0,
                sum: 0,
                mean: 0,
                min: 0,
                max: 0,
                p50: 0,
                p90: 0,
                p95: 0,
                p99: 0,
            };
        }

        // Calculate basic stats (simplified)
        const count = buckets.count || 0;
        const sum = buckets.sum || 0;
        const mean = count > 0 ? sum / count : 0;

        return {
            count,
            sum,
            mean,
            min: 0, // Would need to track separately
            max: 0, // Would need to track separately
            p50: mean, // Simplified
            p90: mean * 1.5, // Simplified
            p95: mean * 1.8, // Simplified
            p99: mean * 2.0, // Simplified
        };
    }

    // Export metrics for Prometheus
    getMetrics(): string {
        return this.registry.metrics();
    }

    // Clear all metrics (useful for testing)
    clear(): void {
        this.registry.clear();
        this.counters.clear();
        this.gauges.clear();
        this.histograms.clear();
        this.initializeMetrics();
    }
}

// Singleton instance
export const metricsCollector = new MetricsCollector();