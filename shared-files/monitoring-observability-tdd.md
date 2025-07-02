# TDD Implementation for Monitoring, Logging & Observability

## 1. Structured Logging System

### A. Logger Service Tests

```typescript
// property-search-api/src/services/logging/Logger.test.ts
import { Logger } from './Logger';
import { LogLevel, LogContext } from '@/types/logging';

describe('Logger', () => {
  let logger: Logger;
  let mockTransport: jest.Mock;

  beforeEach(() => {
    mockTransport = jest.fn();
    logger = new Logger({
      level: LogLevel.DEBUG,
      transports: [mockTransport],
    });
  });

  describe('log levels', () => {
    it('should log messages at appropriate levels', () => {
      logger.debug('Debug message');
      logger.info('Info message');
      logger.warn('Warning message');
      logger.error('Error message');

      expect(mockTransport).toHaveBeenCalledTimes(4);
      
      const calls = mockTransport.mock.calls;
      expect(calls[0][0].level).toBe(LogLevel.DEBUG);
      expect(calls[1][0].level).toBe(LogLevel.INFO);
      expect(calls[2][0].level).toBe(LogLevel.WARN);
      expect(calls[3][0].level).toBe(LogLevel.ERROR);
    });

    it('should respect minimum log level', () => {
      logger = new Logger({
        level: LogLevel.WARN,
        transports: [mockTransport],
      });

      logger.debug('Debug message');
      logger.info('Info message');
      logger.warn('Warning message');
      logger.error('Error message');

      expect(mockTransport).toHaveBeenCalledTimes(2);
      expect(mockTransport).toHaveBeenCalledWith(
        expect.objectContaining({ level: LogLevel.WARN })
      );
      expect(mockTransport).toHaveBeenCalledWith(
        expect.objectContaining({ level: LogLevel.ERROR })
      );
    });
  });

  describe('context enrichment', () => {
    it('should include context in log entries', () => {
      const context: LogContext = {
        userId: 'user-123',
        sessionId: 'session-456',
        requestId: 'req-789',
      };

      logger.withContext(context).info('User action', {
        action: 'search',
        query: 'apartment',
      });

      expect(mockTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'User action',
          context,
          metadata: { action: 'search', query: 'apartment' },
        })
      );
    });

    it('should merge nested contexts', () => {
      const baseLogger = logger.withContext({ app: 'property-search' });
      const userLogger = baseLogger.withContext({ userId: 'user-123' });
      
      userLogger.info('Action performed');

      expect(mockTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          context: {
            app: 'property-search',
            userId: 'user-123',
          },
        })
      );
    });
  });

  describe('error logging', () => {
    it('should serialize error objects', () => {
      const error = new Error('Something went wrong');
      error.stack = 'Error: Something went wrong\n    at test.js:10:5';

      logger.error('Operation failed', { error });

      expect(mockTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          level: LogLevel.ERROR,
          message: 'Operation failed',
          metadata: {
            error: {
              message: 'Something went wrong',
              stack: expect.stringContaining('test.js:10:5'),
              name: 'Error',
            },
          },
        })
      );
    });

    it('should handle circular references', () => {
      const obj: any = { name: 'test' };
      obj.circular = obj;

      expect(() => {
        logger.info('Circular reference test', { data: obj });
      }).not.toThrow();

      expect(mockTransport).toHaveBeenCalled();
    });
  });

  describe('performance logging', () => {
    it('should measure operation duration', async () => {
      const timer = logger.startTimer();
      
      // Simulate async operation
      await new Promise(resolve => setTimeout(resolve, 100));
      
      timer.done('Operation completed');

      expect(mockTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Operation completed',
          metadata: expect.objectContaining({
            duration: expect.any(Number),
          }),
        })
      );

      const duration = mockTransport.mock.calls[0][0].metadata.duration;
      expect(duration).toBeGreaterThan(90);
      expect(duration).toBeLessThan(150);
    });
  });
});
```

### B. Logger Implementation

```typescript
// property-search-api/src/services/logging/Logger.ts
import winston from 'winston';
import { performance } from 'perf_hooks';
import { LogLevel, LogContext, LogEntry } from '@/types/logging';

export class Logger {
  private winston: winston.Logger;
  private context: LogContext = {};

  constructor(config: {
    level: LogLevel;
    transports?: any[];
  }) {
    this.winston = winston.createLogger({
      level: config.level,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json(),
        winston.format.printf(this.formatLog.bind(this))
      ),
      transports: config.transports || [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          ),
        }),
      ],
    });
  }

  private formatLog(info: any): string {
    const entry: LogEntry = {
      timestamp: info.timestamp,
      level: info.level,
      message: info.message,
      context: { ...this.context, ...info.context },
      metadata: info.metadata,
    };

    // Handle error serialization
    if (info.metadata?.error) {
      entry.metadata.error = this.serializeError(info.metadata.error);
    }

    return JSON.stringify(entry);
  }

  private serializeError(error: any): any {
    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
        stack: error.stack,
        ...error,
      };
    }
    return error;
  }

  withContext(context: LogContext): Logger {
    const newLogger = Object.create(this);
    newLogger.context = { ...this.context, ...context };
    return newLogger;
  }

  debug(message: string, metadata?: any): void {
    this.log(LogLevel.DEBUG, message, metadata);
  }

  info(message: string, metadata?: any): void {
    this.log(LogLevel.INFO, message, metadata);
  }

  warn(message: string, metadata?: any): void {
    this.log(LogLevel.WARN, message, metadata);
  }

  error(message: string, metadata?: any): void {
    this.log(LogLevel.ERROR, message, metadata);
  }

  private log(level: LogLevel, message: string, metadata?: any): void {
    this.winston.log({
      level,
      message,
      context: this.context,
      metadata: this.sanitizeMetadata(metadata),
    });
  }

  private sanitizeMetadata(metadata: any): any {
    try {
      // Remove circular references
      return JSON.parse(JSON.stringify(metadata));
    } catch {
      return { error: 'Failed to serialize metadata' };
    }
  }

  startTimer(): { done: (message: string, metadata?: any) => void } {
    const start = performance.now();
    
    return {
      done: (message: string, metadata?: any) => {
        const duration = Math.round(performance.now() - start);
        this.info(message, { ...metadata, duration });
      },
    };
  }
}

// Singleton instance
export const logger = new Logger({
  level: process.env.LOG_LEVEL as LogLevel || LogLevel.INFO,
});
```

## 2. Metrics Collection System

### A. Metrics Collector Tests

```typescript
// property-search-api/src/services/metrics/MetricsCollector.test.ts
import { MetricsCollector } from './MetricsCollector';
import { MetricType } from '@/types/metrics';

describe('MetricsCollector', () => {
  let metrics: MetricsCollector;
  let mockRegistry: any;

  beforeEach(() => {
    mockRegistry = {
      metrics: new Map(),
      registerMetric: jest.fn(),
      getSingleMetric: jest.fn(),
    };
    
    metrics = new MetricsCollector(mockRegistry);
  });

  describe('counter metrics', () => {
    it('should increment counters', () => {
      metrics.increment('api.requests', { endpoint: '/search' });
      metrics.increment('api.requests', { endpoint: '/search' });
      metrics.increment('api.requests', { endpoint: '/properties' });

      const value = metrics.getMetric('api.requests');
      expect(value).toBe(3);
    });

    it('should handle labeled counters', () => {
      metrics.increment('api.requests', { method: 'GET', status: '200' });
      metrics.increment('api.requests', { method: 'GET', status: '404' });
      metrics.increment('api.requests', { method: 'POST', status: '201' });

      const values = metrics.getMetricWithLabels('api.requests');
      expect(values).toEqual({
        'method="GET",status="200"': 1,
        'method="GET",status="404"': 1,
        'method="POST",status="201"': 1,
      });
    });
  });

  describe('gauge metrics', () => {
    it('should set gauge values', () => {
      metrics.gauge('memory.usage', 1024);
      expect(metrics.getMetric('memory.usage')).toBe(1024);

      metrics.gauge('memory.usage', 2048);
      expect(metrics.getMetric('memory.usage')).toBe(2048);
    });

    it('should track concurrent operations', () => {
      metrics.gauge('concurrent.searches', 5);
      metrics.gauge('concurrent.searches', 8);
      metrics.gauge('concurrent.searches', 3);

      expect(metrics.getMetric('concurrent.searches')).toBe(3);
    });
  });

  describe('histogram metrics', () => {
    it('should record response times', () => {
      metrics.histogram('response.time', 100, { endpoint: '/search' });
      metrics.histogram('response.time', 150, { endpoint: '/search' });
      metrics.histogram('response.time', 200, { endpoint: '/search' });

      const stats = metrics.getHistogramStats('response.time', { endpoint: '/search' });
      
      expect(stats.count).toBe(3);
      expect(stats.sum).toBe(450);
      expect(stats.mean).toBe(150);
      expect(stats.p50).toBe(150);
      expect(stats.p95).toBeCloseTo(200, 0);
    });

    it('should calculate percentiles correctly', () => {
      // Add 100 samples
      for (let i = 1; i <= 100; i++) {
        metrics.histogram('test.metric', i);
      }

      const stats = metrics.getHistogramStats('test.metric');
      
      expect(stats.p50).toBe(50);
      expect(stats.p90).toBe(90);
      expect(stats.p95).toBe(95);
      expect(stats.p99).toBe(99);
    });
  });

  describe('timing helpers', () => {
    it('should measure operation duration', async () => {
      const timer = metrics.startTimer('operation.duration');
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      timer.done({ operation: 'search' });

      const stats = metrics.getHistogramStats('operation.duration');
      expect(stats.count).toBe(1);
      expect(stats.mean).toBeGreaterThan(90);
      expect(stats.mean).toBeLessThan(150);
    });
  });

  describe('business metrics', () => {
    it('should track search metrics', () => {
      metrics.trackSearch({
        query: 'apartment London',
        resultCount: 25,
        duration: 150,
        cacheHit: false,
      });

      expect(metrics.getMetric('search.total')).toBe(1);
      expect(metrics.getMetric('search.cache.miss')).toBe(1);
      
      const stats = metrics.getHistogramStats('search.duration');
      expect(stats.mean).toBe(150);
    });

    it('should track property views', () => {
      metrics.trackPropertyView({
        propertyId: 'prop-123',
        userId: 'user-456',
        source: 'search',
      });

      metrics.trackPropertyView({
        propertyId: 'prop-123',
        userId: 'user-789',
        source: 'recommendation',
      });

      expect(metrics.getMetric('property.views')).toBe(2);
      expect(metrics.getMetricWithLabels('property.views.by_source')).toEqual({
        'source="search"': 1,
        'source="recommendation"': 1,
      });
    });
  });
});
```

### B. Metrics Implementation

```typescript
// property-search-api/src/services/metrics/MetricsCollector.ts
import * as promClient from 'prom-client';

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
    this.registerHistogram('api_request_duration_seconds', 'API request duration', ['method', 'endpoint']);
    
    // Search metrics
    this.registerCounter('search_total', 'Total searches performed');
    this.registerCounter('search_cache_hits', 'Search cache hits');
    this.registerCounter('search_cache_misses', 'Search cache misses');
    this.registerHistogram('search_duration_ms', 'Search duration in milliseconds');
    this.registerHistogram('search_result_count', 'Number of search results');
    
    // Property metrics
    this.registerCounter('property_views_total', 'Total property views', ['source']);
    this.registerCounter('property_favorites_total', 'Total properties favorited');
    
    // Chat metrics
    this.registerCounter('chat_messages_total', 'Total chat messages', ['type']);
    this.registerHistogram('chat_response_time_ms', 'Chat response time');
    
    // Business metrics
    this.registerGauge('active_users', 'Number of active users');
    this.registerGauge('properties_available', 'Number of available properties');
  }

  private registerCounter(name: string, help: string, labels: string[] = []): void {
    this.counters.set(name, new promClient.Counter({
      name,
      help,
      labelNames: labels,
      registers: [this.registry],
    }));
  }

  private registerGauge(name: string, help: string, labels: string[] = []): void {
    this.gauges.set(name, new promClient.Gauge({
      name,
      help,
      labelNames: labels,
      registers: [this.registry],
    }));
  }

  private registerHistogram(name: string, help: string, labels: string[] = []): void {
    this.histograms.set(name, new promClient.Histogram({
      name,
      help,
      labelNames: labels,
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
      registers: [this.registry],
    }));
  }

  increment(metric: string, labels?: Record<string, string>): void {
    const counter = this.counters.get(metric);
    if (counter) {
      labels ? counter.labels(labels).inc() : counter.inc();
    }
  }

  gauge(metric: string, value: number, labels?: Record<string, string>): void {
    const gauge = this.gauges.get(metric);
    if (gauge) {
      labels ? gauge.labels(labels).set(value) : gauge.set(value);
    }
  }

  histogram(metric: string, value: number, labels?: Record<string, string>): void {
    const histogram = this.histograms.get(metric);
    if (histogram) {
      labels ? histogram.labels(labels).observe(value) : histogram.observe(value);
    }
  }

  startTimer(metric: string, labels?: Record<string, string>): { done: (extraLabels?: Record<string, string>) => void } {
    const histogram = this.histograms.get(metric);
    if (!histogram) {
      return { done: () => {} };
    }

    const timer = labels ? histogram.labels(labels).startTimer() : histogram.startTimer();
    
    return {
      done: (extraLabels?: Record<string, string>) => {
        timer(extraLabels);
      },
    };
  }

  // Business metric helpers
  trackSearch(data: {
    query: string;
    resultCount: number;
    duration: number;
    cacheHit: boolean;
  }): void {
    this.increment('search_total');
    this.increment(data.cacheHit ? 'search_cache_hits' : 'search_cache_misses');
    this.histogram('search_duration_ms', data.duration);
    this.histogram('search_result_count', data.resultCount);
  }

  trackPropertyView(data: {
    propertyId: string;
    userId: string;
    source: string;
  }): void {
    this.increment('property_views_total', { source: data.source });
  }

  trackChatMessage(data: {
    sessionId: string;
    type: 'user' | 'assistant';
    responseTime?: number;
  }): void {
    this.increment('chat_messages_total', { type: data.type });
    if (data.responseTime) {
      this.histogram('chat_response_time_ms', data.responseTime);
    }
  }

  // For testing
  getMetric(name: string): number {
    const counter = this.counters.get(name);
    if (counter) {
      return (counter as any)._getValue();
    }
    const gauge = this.gauges.get(name);
    if (gauge) {
      return (gauge as any)._getValue();
    }
    return 0;
  }

  getMetricWithLabels(name: string): Record<string, number> {
    const counter = this.counters.get(name);
    if (counter) {
      return (counter as any)._getValues();
    }
    return {};
  }

  getHistogramStats(name: string, labels?: Record<string, string>): any {
    const histogram = this.histograms.get(name);
    if (histogram) {
      return (histogram as any).get(labels);
    }
    return null;
  }

  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }
}

export const metrics = new MetricsCollector();
```

## 3. Distributed Tracing

### A. Tracing Service Tests

```typescript
// property-search-api/src/services/tracing/TracingService.test.ts
import { TracingService } from './TracingService';
import { SpanContext, SpanKind } from '@/types/tracing';

describe('TracingService', () => {
  let tracing: TracingService;
  let mockExporter: jest.Mock;

  beforeEach(() => {
    mockExporter = jest.fn();
    tracing = new TracingService({
      serviceName: 'property-api',
      exporter: mockExporter,
    });
  });

  describe('span creation', () => {
    it('should create root spans', () => {
      const span = tracing.startSpan('search.request');
      
      expect(span.name).toBe('search.request');
      expect(span.traceId).toMatch(/^[a-f0-9]{32}$/);
      expect(span.spanId).toMatch(/^[a-f0-9]{16}$/);
      expect(span.parentId).toBeUndefined();
    });

    it('should create child spans', () => {
      const parent = tracing.startSpan('search.request');
      const child = tracing.startSpan('database.query', {
        parent: parent.context(),
      });

      expect(child.traceId).toBe(parent.traceId);
      expect(child.parentId).toBe(parent.spanId);
    });

    it('should set span attributes', () => {
      const span = tracing.startSpan('search.request');
      
      span.setAttributes({
        'http.method': 'GET',
        'http.url': '/api/search',
        'user.id': 'user-123',
      });

      const exported = span.end();
      expect(exported.attributes).toMatchObject({
        'http.method': 'GET',
        'http.url': '/api/search',
        'user.id': 'user-123',
      });
    });
  });

  describe('span events', () => {
    it('should add events to spans', () => {
      const span = tracing.startSpan('search.request');
      
      span.addEvent('cache.hit', { key: 'search:apartment' });
      span.addEvent('results.filtered', { count: 25 });
      
      const exported = span.end();
      expect(exported.events).toHaveLength(2);
      expect(exported.events[0]).toMatchObject({
        name: 'cache.hit',
        attributes: { key: 'search:apartment' },
      });
    });

    it('should record errors', () => {
      const span = tracing.startSpan('database.query');
      const error = new Error('Connection timeout');
      
      span.recordError(error);
      
      const exported = span.end();
      expect(exported.status).toBe('ERROR');
      expect(exported.events).toContainEqual(
        expect.objectContaining({
          name: 'error',
          attributes: expect.objectContaining({
            'error.type': 'Error',
            'error.message': 'Connection timeout',
          }),
        })
      );
    });
  });

  describe('context propagation', () => {
    it('should inject context into headers', () => {
      const span = tracing.startSpan('api.request');
      const headers: Record<string, string> = {};
      
      tracing.inject(span.context(), headers);
      
      expect(headers['x-trace-id']).toBe(span.traceId);
      expect(headers['x-span-id']).toBe(span.spanId);
      expect(headers['x-trace-flags']).toBe('01');
    });

    it('should extract context from headers', () => {
      const headers = {
        'x-trace-id': '12345678901234567890123456789012',
        'x-span-id': '1234567890123456',
        'x-trace-flags': '01',
      };
      
      const context = tracing.extract(headers);
      
      expect(context?.traceId).toBe('12345678901234567890123456789012');
      expect(context?.spanId).toBe('1234567890123456');
      expect(context?.flags).toBe(1);
    });
  });

  describe('span timing', () => {
    it('should calculate span duration', async () => {
      const span = tracing.startSpan('async.operation');
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const exported = span.end();
      
      expect(exported.duration).toBeGreaterThan(90);
      expect(exported.duration).toBeLessThan(150);
    });
  });

  describe('sampling', () => {
    it('should respect sampling decisions', () => {
      tracing = new TracingService({
        serviceName: 'property-api',
        samplingRate: 0.5,
        exporter: mockExporter,
      });

      const sampled = [];
      for (let i = 0; i < 100; i++) {
        const span = tracing.startSpan(`test.${i}`);
        if (span.isSampled()) {
          sampled.push(span);
        }
        span.end();
      }

      // Should sample approximately 50% (with some variance)
      expect(sampled.length).toBeGreaterThan(30);
      expect(sampled.length).toBeLessThan(70);
    });
  });
});
```

### B. Tracing Implementation

```typescript
// property-search-api/src/services/tracing/TracingService.ts
import { performance } from 'perf_hooks';
import { randomBytes } from 'crypto';

export interface Span {
  name: string;
  traceId: string;
  spanId: string;
  parentId?: string;
  startTime: number;
  attributes: Record<string, any>;
  events: SpanEvent[];
  status: 'OK' | 'ERROR';
  
  setAttributes(attributes: Record<string, any>): void;
  addEvent(name: string, attributes?: Record<string, any>): void;
  recordError(error: Error): void;
  context(): SpanContext;
  end(): ExportedSpan;
  isSampled(): boolean;
}

export interface SpanEvent {
  name: string;
  timestamp: number;
  attributes?: Record<string, any>;
}

export interface SpanContext {
  traceId: string;
  spanId: string;
  flags: number;
}

export interface ExportedSpan {
  name: string;
  traceId: string;
  spanId: string;
  parentId?: string;
  startTime: number;
  endTime: number;
  duration: number;
  attributes: Record<string, any>;
  events: SpanEvent[];
  status: 'OK' | 'ERROR';
}

export class TracingService {
  private samplingRate: number;
  private exporter: (span: ExportedSpan) => void;

  constructor(config: {
    serviceName: string;
    samplingRate?: number;
    exporter?: (span: ExportedSpan) => void;
  }) {
    this.samplingRate = config.samplingRate ?? 1.0;
    this.exporter = config.exporter || this.defaultExporter;
  }

  startSpan(name: string, options?: {
    parent?: SpanContext;
    kind?: 'CLIENT' | 'SERVER' | 'INTERNAL';
    attributes?: Record<string, any>;
  }): Span {
    const traceId = options?.parent?.traceId || this.generateTraceId();
    const spanId = this.generateSpanId();
    const parentId = options?.parent?.spanId;
    
    // Sampling decision
    const sampled = options?.parent?.flags === 1 || Math.random() < this.samplingRate;
    
    return new SpanImpl({
      name,
      traceId,
      spanId,
      parentId,
      sampled,
      attributes: options?.attributes || {},
      exporter: this.exporter,
    });
  }

  inject(context: SpanContext, carrier: Record<string, string>): void {
    carrier['x-trace-id'] = context.traceId;
    carrier['x-span-id'] = context.spanId;
    carrier['x-trace-flags'] = context.flags.toString().padStart(2, '0');
  }

  extract(carrier: Record<string, string>): SpanContext | null {
    const traceId = carrier['x-trace-id'];
    const spanId = carrier['x-span-id'];
    const flags = carrier['x-trace-flags'];
    
    if (!traceId || !spanId) {
      return null;
    }
    
    return {
      traceId,
      spanId,
      flags: parseInt(flags || '00', 10),
    };
  }

  private generateTraceId(): string {
    return randomBytes(16).toString('hex');
  }

  private generateSpanId(): string {
    return randomBytes(8).toString('hex');
  }

  private defaultExporter(span: ExportedSpan): void {
    console.log(JSON.stringify(span));
  }
}

class SpanImpl implements Span {
  name: string;
  traceId: string;
  spanId: string;
  parentId?: string;
  startTime: number;
  attributes: Record<string, any>;
  events: SpanEvent[] = [];
  status: 'OK' | 'ERROR' = 'OK';
  private sampled: boolean;
  private exporter: (span: ExportedSpan) => void;

  constructor(config: {
    name: string;
    traceId: string;
    spanId: string;
    parentId?: string;
    sampled: boolean;
    attributes: Record<string, any>;
    exporter: (span: ExportedSpan) => void;
  }) {
    this.name = config.name;
    this.traceId = config.traceId;
    this.spanId = config.spanId;
    this.parentId = config.parentId;
    this.sampled = config.sampled;
    this.attributes = config.attributes;
    this.exporter = config.exporter;
    this.startTime = performance.now();
  }

  setAttributes(attributes: Record<string, any>): void {
    Object.assign(this.attributes, attributes);
  }

  addEvent(name: string, attributes?: Record<string, any>): void {
    this.events.push({
      name,
      timestamp: performance.now(),
      attributes,
    });
  }

  recordError(error: Error): void {
    this.status = 'ERROR';
    this.addEvent('error', {
      'error.type': error.name,
      'error.message': error.message,
      'error.stack': error.stack,
    });
  }

  context(): SpanContext {
    return {
      traceId: this.traceId,
      spanId: this.spanId,
      flags: this.sampled ? 1 : 0,
    };
  }

  end(): ExportedSpan {
    const endTime = performance.now();
    const exported: ExportedSpan = {
      name: this.name,
      traceId: this.traceId,
      spanId: this.spanId,
      parentId: this.parentId,
      startTime: this.startTime,
      endTime,
      duration: endTime - this.startTime,
      attributes: this.attributes,
      events: this.events,
      status: this.status,
    };
    
    if (this.sampled) {
      this.exporter(exported);
    }
    
    return exported;
  }

  isSampled(): boolean {
    return this.sampled;
  }
}
```

## 4. Health Check System

### A. Health Check Tests

```typescript
// property-search-api/src/services/health/HealthChecker.test.ts
import { HealthChecker, HealthStatus } from './HealthChecker';

describe('HealthChecker', () => {
  let healthChecker: HealthChecker;

  beforeEach(() => {
    healthChecker = new HealthChecker();
  });

  describe('component registration', () => {
    it('should register health check components', async () => {
      const dbCheck = jest.fn().mockResolvedValue({ healthy: true });
      const cacheCheck = jest.fn().mockResolvedValue({ healthy: true });

      healthChecker.register('database', dbCheck);
      healthChecker.register('cache', cacheCheck);

      const status = await healthChecker.check();

      expect(status.status).toBe(HealthStatus.HEALTHY);
      expect(status.components.database.healthy).toBe(true);
      expect(status.components.cache.healthy).toBe(true);
    });

    it('should handle unhealthy components', async () => {
      const dbCheck = jest.fn().mockResolvedValue({ 
        healthy: false, 
        message: 'Connection failed' 
      });
      const cacheCheck = jest.fn().mockResolvedValue({ healthy: true });

      healthChecker.register('database', dbCheck);
      healthChecker.register('cache', cacheCheck);

      const status = await healthChecker.check();

      expect(status.status).toBe(HealthStatus.UNHEALTHY);
      expect(status.components.database.healthy).toBe(false);
      expect(status.components.database.message).toBe('Connection failed');
    });

    it('should handle check timeouts', async () => {
      const slowCheck = jest.fn().mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 5000))
      );

      healthChecker.register('slowService', slowCheck, { timeout: 1000 });

      const status = await healthChecker.check();

      expect(status.status).toBe(HealthStatus.UNHEALTHY);
      expect(status.components.slowService.healthy).toBe(false);
      expect(status.components.slowService.message).toContain('timeout');
    });
  });

  describe('critical components', () => {
    it('should mark system as unhealthy if critical component fails', async () => {
      const dbCheck = jest.fn().mockResolvedValue({ 
        healthy: false 
      });
      const optionalCheck = jest.fn().mockResolvedValue({ 
        healthy: true 
      });

      healthChecker.register('database', dbCheck, { critical: true });
      healthChecker.register('optional', optionalCheck, { critical: false });

      const status = await healthChecker.check();

      expect(status.status).toBe(HealthStatus.UNHEALTHY);
    });

    it('should mark system as degraded if non-critical component fails', async () => {
      const dbCheck = jest.fn().mockResolvedValue({ healthy: true });
      const optionalCheck = jest.fn().mockResolvedValue({ 
        healthy: false,
        message: 'Service unavailable' 
      });

      healthChecker.register('database', dbCheck, { critical: true });
      healthChecker.register('optional', optionalCheck, { critical: false });

      const status = await healthChecker.check();

      expect(status.status).toBe(HealthStatus.DEGRADED);
      expect(status.components.optional.healthy).toBe(false);
    });
  });

  describe('detailed checks', () => {
    it('should include detailed metrics when requested', async () => {
      const dbCheck = jest.fn().mockResolvedValue({ 
        healthy: true,
        details: {
          connections: 10,
          latency: 5,
          version: '13.4',
        }
      });

      healthChecker.register('database', dbCheck);

      const status = await healthChecker.check({ detailed: true });

      expect(status.components.database.details).toMatchObject({
        connections: 10,
        latency: 5,
        version: '13.4',
      });
    });
  });
});
```

### B. Health Check Implementation

```typescript
// property-search-api/src/services/health/HealthChecker.ts
export enum HealthStatus {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  UNHEALTHY = 'unhealthy',
}

export interface HealthCheckResult {
  healthy: boolean;
  message?: string;
  details?: Record<string, any>;
  duration?: number;
}

export interface SystemHealth {
  status: HealthStatus;
  timestamp: string;
  components: Record<string, HealthCheckResult>;
  version: string;
  uptime: number;
}

type HealthCheckFunction = () => Promise<HealthCheckResult>;

interface HealthCheckConfig {
  critical?: boolean;
  timeout?: number;
}

export class HealthChecker {
  private checks: Map<string, {
    check: HealthCheckFunction;
    config: HealthCheckConfig;
  }> = new Map();
  
  private startTime = Date.now();

  register(
    name: string, 
    check: HealthCheckFunction, 
    config: HealthCheckConfig = {}
  ): void {
    this.checks.set(name, {
      check,
      config: {
        critical: config.critical ?? true,
        timeout: config.timeout ?? 5000,
      },
    });
  }

  async check(options?: { detailed?: boolean }): Promise<SystemHealth> {
    const results: Record<string, HealthCheckResult> = {};
    let overallStatus = HealthStatus.HEALTHY;

    // Run all checks in parallel
    const checkPromises = Array.from(this.checks.entries()).map(
      async ([name, { check, config }]) => {
        const start = Date.now();
        
        try {
          const result = await this.withTimeout(check(), config.timeout!);
          results[name] = {
            ...result,
            duration: Date.now() - start,
          };

          // Update overall status
          if (!result.healthy) {
            if (config.critical) {
              overallStatus = HealthStatus.UNHEALTHY;
            } else if (overallStatus !== HealthStatus.UNHEALTHY) {
              overallStatus = HealthStatus.DEGRADED;
            }
          }
        } catch (error) {
          results[name] = {
            healthy: false,
            message: error instanceof Error ? error.message : 'Check failed',
            duration: Date.now() - start,
          };

          if (config.critical) {
            overallStatus = HealthStatus.UNHEALTHY;
          } else if (overallStatus !== HealthStatus.UNHEALTHY) {
            overallStatus = HealthStatus.DEGRADED;
          }
        }
      }
    );

    await Promise.all(checkPromises);

    // Remove detailed info if not requested
    if (!options?.detailed) {
      Object.values(results).forEach(result => {
        delete result.details;
      });
    }

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      components: results,
      version: process.env.APP_VERSION || '1.0.0',
      uptime: Date.now() - this.startTime,
    };
  }

  private async withTimeout<T>(
    promise: Promise<T>, 
    timeout: number
  ): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(`Health check timeout after ${timeout}ms`)), timeout)
      ),
    ]);
  }
}

// Pre-configured health checks
export const createStandardHealthChecks = (services: {
  prisma: any;
  redis: any;
  embeddingService: any;
}): HealthChecker => {
  const checker = new HealthChecker();

  // Database health check
  checker.register('database', async () => {
    try {
      await services.prisma.$queryRaw`SELECT 1`;
      return { healthy: true };
    } catch (error) {
      return { 
        healthy: false, 
        message: 'Database connection failed',
      };
    }
  });

  // Redis health check
  checker.register('cache', async () => {
    try {
      await services.redis.ping();
      const info = await services.redis.info();
      return { 
        healthy: true,
        details: {
          connectedClients: parseInt(info.match(/connected_clients:(\d+)/)?.[1] || '0'),
          usedMemory: info.match(/used_memory_human:(.+)/)?.[1],
        },
      };
    } catch (error) {
      return { 
        healthy: false, 
        message: 'Redis connection failed',
      };
    }
  }, { critical: false });

  // Embedding service health check
  checker.register('embedding', async () => {
    try {
      const response = await fetch(`${process.env.EMBEDDING_SERVICE_URL}/health`);
      const data = await response.json();
      return { 
        healthy: response.ok,
        details: data,
      };
    } catch (error) {
      return { 
        healthy: false, 
        message: 'Embedding service unavailable',
      };
    }
  }, { critical: false });

  return checker;
};
```

## 5. Monitoring Dashboard Configuration

```yaml
# monitoring/prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'property-api'
    static_configs:
      - targets: ['api:3001']
    metrics_path: '/metrics'

  - job_name: 'frontend'
    static_configs:
      - targets: ['frontend:3000']
    metrics_path: '/api/metrics'

  - job_name: 'embedding-service'
    static_configs:
      - targets: ['embedding:8001']
    metrics_path: '/metrics'

  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres-exporter:9187']

  - job_name: 'redis'
    static_configs:
      - targets: ['redis-exporter:9121']

rule_files:
  - 'alerts.yml'
```

```yaml
# monitoring/alerts.yml
groups:
  - name: property-portal
    interval: 30s
    rules:
      - alert: HighErrorRate
        expr: rate(api_requests_total{status=~"5.."}[5m]) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"
          description: "Error rate is above 5% for the last 5 minutes"

      - alert: SlowSearchResponse
        expr: histogram_quantile(0.95, rate(search_duration_ms_bucket[5m])) > 1000
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Search response time is slow"
          description: "95th percentile search time is above 1 second"

      - alert: LowCacheHitRate
        expr: rate(search_cache_hits[5m]) / (rate(search_cache_hits[5m]) + rate(search_cache_misses[5m])) < 0.5
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Low cache hit rate"
          description: "Cache hit rate is below 50%"

      - alert: DatabaseConnectionPoolExhausted
        expr: pg_stat_database_numbackends / pg_settings_max_connections > 0.8
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Database connection pool nearly exhausted"
          description: "Using more than 80% of available connections"
```

```json
// monitoring/grafana-dashboard.json
{
  "dashboard": {
    "title": "Moov Property Portal Monitoring",
    "panels": [
      {
        "title": "API Request Rate",
        "targets": [{
          "expr": "sum(rate(api_requests_total[5m])) by (method, endpoint)"
        }]
      },
      {
        "title": "Search Performance",
        "targets": [{
          "expr": "histogram_quantile(0.99, rate(search_duration_ms_bucket[5m]))"
        }]
      },
      {
        "title": "Cache Hit Rate",
        "targets": [{
          "expr": "rate(search_cache_hits[5m]) / (rate(search_cache_hits[5m]) + rate(search_cache_misses[5m])) * 100"
        }]
      },
      {
        "title": "Property Views by Source",
        "targets": [{
          "expr": "sum(rate(property_views_total[5m])) by (source)"
        }]
      },
      {
        "title": "Chat Response Time",
        "targets": [{
          "expr": "histogram_quantile(0.95, rate(chat_response_time_ms_bucket[5m]))"
        }]
      },
      {
        "title": "System Health Status",
        "targets": [{
          "expr": "up"
        }]
      }
    ]
  }
}
```

## Summary

This comprehensive monitoring and observability implementation provides:

1. **Structured Logging** with context propagation and performance tracking
2. **Metrics Collection** using Prometheus with business-specific metrics
3. **Distributed Tracing** for request flow visualization
4. **Health Checks** with configurable component monitoring
5. **Alerting Rules** for proactive issue detection
6. **Dashboard Configuration** for real-time monitoring

All components are built with TDD principles, ensuring reliability and maintainability of the monitoring infrastructure.