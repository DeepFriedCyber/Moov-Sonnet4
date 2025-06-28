// ============================================================================
// Enhanced Embedding Service Client for Property API
// ============================================================================

import axios, { AxiosInstance } from 'axios';

export interface EmbeddingResponse {
  embedding: number[];
  cached: boolean;
  cache_stats: {
    hit_rate_percent: number;
    total_requests: number;
    cache_hits: number;
    cache_misses: number;
    cost_saved_dollars: number;
    time_saved_seconds: number;
  };
}

export interface SearchQuery {
  query: string;
}

export class EnhancedEmbeddingService {
  private client: AxiosInstance;
  private isHealthy: boolean = false;
  private lastHealthCheck: number = 0;
  private healthCheckInterval: number = 30000; // 30 seconds
  
  // Performance tracking
  private stats = {
    totalRequests: 0,
    cacheHits: 0,
    totalResponseTime: 0,
    errors: 0
  };

  constructor(
    private baseUrl: string = process.env.EMBEDDING_SERVICE_URL || 'http://localhost:8001'
  ) {
    this.client = axios.create({
      baseURL: baseUrl,
      timeout: 10000, // 10 second timeout
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    // Setup request/response interceptors for monitoring
    this.setupInterceptors();
    
    // Initial health check
    this.checkHealth();
  }

  private setupInterceptors(): void {
    // Request interceptor
    this.client.interceptors.request.use(
      (config: any) => {
        config.metadata = { startTime: Date.now() };
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor for performance tracking
    this.client.interceptors.response.use(
      (response: any) => {
        const responseTime = Date.now() - response.config.metadata.startTime;
        this.updateStats(responseTime, response.data?.cached || false);
        
        console.log('Embedding request completed', {
          responseTime,
          cached: response.data?.cached,
          url: response.config.url
        });
        
        return response;
      },
      (error) => {
        this.stats.errors++;
        console.error('Embedding service error', {
          error: error.message,
          url: error.config?.url
        });
        return Promise.reject(error);
      }
    );
  }

  private updateStats(responseTime: number, cached: boolean): void {
    this.stats.totalRequests++;
    this.stats.totalResponseTime += responseTime;
    if (cached) {
      this.stats.cacheHits++;
    }
  }

  async checkHealth(): Promise<boolean> {
    const now = Date.now();
    
    // Skip if recently checked
    if (now - this.lastHealthCheck < this.healthCheckInterval && this.isHealthy) {
      return this.isHealthy;
    }

    try {
      const response = await this.client.get('/health', { timeout: 5000 });
      this.isHealthy = response.status === 200 && response.data.status === 'healthy';
      this.lastHealthCheck = now;
      
      if (this.isHealthy) {
        console.log('Embedding service health check passed', {
          cacheAvailable: response.data.cache_available,
          model: response.data.model?.model_name
        });
      }
      
      return this.isHealthy;
    } catch (error: any) {
      this.isHealthy = false;
      this.lastHealthCheck = now;
      console.warn('Embedding service health check failed', { error: error.message });
      return false;
    }
  }

  async generateEmbedding(query: string): Promise<number[]> {
    const startTime = Date.now();
    
    try {
      // Health check if service seems down
      if (!this.isHealthy) {
        const isHealthy = await this.checkHealth();
        if (!isHealthy) {
          throw new Error('Embedding service is not available');
        }
      }

      const response = await this.client.post<EmbeddingResponse>('/embed', {
        query: query.trim()
      });

      const responseTime = Date.now() - startTime;
      
      console.log('Embedding generated successfully', {
        query: query.substring(0, 50),
        responseTime,
        cached: response.data.cached,
        embeddingDimension: response.data.embedding.length,
        cacheHitRate: response.data.cache_stats.hit_rate_percent
      });

      return response.data.embedding;
      
    } catch (error: any) {
      console.error('Failed to generate embedding', {
        query: query.substring(0, 50),
        error: error.message,
        responseTime: Date.now() - startTime
      });
      
      throw new Error(`Embedding generation failed: ${error.message}`);
    }
  }

  async batchGenerateEmbeddings(queries: string[]): Promise<number[][]> {
    console.log('Generating batch embeddings', { count: queries.length });
    
    // Process in parallel but with concurrency limit
    const BATCH_SIZE = 5;
    const results: number[][] = [];
    
    for (let i = 0; i < queries.length; i += BATCH_SIZE) {
      const batch = queries.slice(i, i + BATCH_SIZE);
      
      const batchPromises = batch.map(query => this.generateEmbedding(query));
      const batchResults = await Promise.all(batchPromises);
      
      results.push(...batchResults);
    }
    
    return results;
  }

  async getCacheStats(): Promise<any> {
    try {
      const response = await this.client.get('/cache/stats');
      return response.data;
    } catch (error: any) {
      console.warn('Could not fetch cache stats', { error: error.message });
      return null;
    }
  }

  getPerformanceStats() {
    const avgResponseTime = this.stats.totalRequests > 0 
      ? this.stats.totalResponseTime / this.stats.totalRequests 
      : 0;
    
    const cacheHitRate = this.stats.totalRequests > 0
      ? (this.stats.cacheHits / this.stats.totalRequests) * 100
      : 0;

    return {
      totalRequests: this.stats.totalRequests,
      cacheHitRate: cacheHitRate.toFixed(1),
      avgResponseTime: avgResponseTime.toFixed(2),
      errors: this.stats.errors,
      isHealthy: this.isHealthy
    };
  }
}