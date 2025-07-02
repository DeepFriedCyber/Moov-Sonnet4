export enum MetricType {
  COUNTER = 'counter',
  GAUGE = 'gauge',
  HISTOGRAM = 'histogram',
  SUMMARY = 'summary',
}

export interface MetricLabels {
  [key: string]: string;
}

export interface HistogramStats {
  count: number;
  sum: number;
  mean: number;
  min: number;
  max: number;
  p50: number;
  p90: number;
  p95: number;
  p99: number;
}

export interface SearchMetrics {
  query: string;
  resultCount: number;
  duration: number;
  cacheHit: boolean;
  userId?: string;
}

export interface PropertyViewMetrics {
  propertyId: string;
  userId?: string;
  source: 'search' | 'recommendation' | 'direct' | 'favorite';
  duration?: number;
}