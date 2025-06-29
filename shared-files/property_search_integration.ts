// ============================================================================
// STEP 1: Enhanced Embedding Service Client for Property API
// property-search-api/src/services/embeddingService.ts
// ============================================================================

import axios, { AxiosInstance } from 'axios';
import { logger } from '../utils/logger';

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
      (config) => {
        config.metadata = { startTime: Date.now() };
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor for performance tracking
    this.client.interceptors.response.use(
      (response) => {
        const responseTime = Date.now() - response.config.metadata.startTime;
        this.updateStats(responseTime, response.data?.cached || false);
        
        logger.debug('Embedding request completed', {
          responseTime,
          cached: response.data?.cached,
          url: response.config.url
        });
        
        return response;
      },
      (error) => {
        this.stats.errors++;
        logger.error('Embedding service error', {
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
        logger.info('Embedding service health check passed', {
          cacheAvailable: response.data.cache_available,
          model: response.data.model?.model_name
        });
      }
      
      return this.isHealthy;
    } catch (error) {
      this.isHealthy = false;
      this.lastHealthCheck = now;
      logger.warn('Embedding service health check failed', { error: error.message });
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
      
      logger.info('Embedding generated successfully', {
        query: query.substring(0, 50),
        responseTime,
        cached: response.data.cached,
        embeddingDimension: response.data.embedding.length,
        cacheHitRate: response.data.cache_stats.hit_rate_percent
      });

      return response.data.embedding;
      
    } catch (error) {
      logger.error('Failed to generate embedding', {
        query: query.substring(0, 50),
        error: error.message,
        responseTime: Date.now() - startTime
      });
      
      throw new Error(`Embedding generation failed: ${error.message}`);
    }
  }

  async batchGenerateEmbeddings(queries: string[]): Promise<number[][]> {
    logger.info('Generating batch embeddings', { count: queries.length });
    
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
    } catch (error) {
      logger.warn('Could not fetch cache stats', { error: error.message });
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

// ============================================================================
// STEP 2: Enhanced Property Search Service with Cached Embeddings
// property-search-api/src/services/propertySearchService.ts
// ============================================================================

import { EnhancedEmbeddingService } from './embeddingService';
import { Property } from '../types/property';
import { logger } from '../utils/logger';

export interface SearchFilters {
  location?: string;
  minPrice?: number;
  maxPrice?: number;
  bedrooms?: number;
  propertyType?: 'house' | 'flat' | 'studio' | 'commercial';
  radius?: number; // in km
}

export interface SearchQuery {
  query: string;
  filters?: SearchFilters;
  limit?: number;
  offset?: number;
}

export interface SearchResult {
  properties: Property[];
  total: number;
  searchId: string;
  processingTime: number;
  cacheStats?: any;
  performance: {
    embeddingTime: number;
    searchTime: number;
    totalTime: number;
    fromCache: boolean;
  };
}

export class EnhancedPropertySearchService {
  private embeddingService: EnhancedEmbeddingService;
  
  constructor(
    private database: any, // Your database service
    embeddingServiceUrl?: string
  ) {
    this.embeddingService = new EnhancedEmbeddingService(embeddingServiceUrl);
  }

  async searchProperties(searchQuery: SearchQuery): Promise<SearchResult> {
    const startTime = Date.now();
    const searchId = this.generateSearchId();
    
    logger.info('Starting property search', {
      searchId,
      query: searchQuery.query,
      filters: searchQuery.filters
    });

    try {
      // Step 1: Generate query embedding with caching
      const embeddingStartTime = Date.now();
      const queryEmbedding = await this.embeddingService.generateEmbedding(searchQuery.query);
      const embeddingTime = Date.now() - embeddingStartTime;
      
      // Step 2: Search database using embedding similarity
      const searchStartTime = Date.now();
      const { properties, total } = await this.performDatabaseSearch(
        queryEmbedding,
        searchQuery.filters,
        searchQuery.limit || 20,
        searchQuery.offset || 0
      );
      const searchTime = Date.now() - searchStartTime;
      
      // Step 3: Get cache performance stats
      const cacheStats = await this.embeddingService.getCacheStats();
      const performanceStats = this.embeddingService.getPerformanceStats();
      
      const totalTime = Date.now() - startTime;
      
      logger.info('Property search completed', {
        searchId,
        resultsCount: properties.length,
        totalMatches: total,
        processingTime: totalTime,
        embeddingTime,
        searchTime,
        cacheHitRate: performanceStats.cacheHitRate
      });

      return {
        properties,
        total,
        searchId,
        processingTime: totalTime,
        cacheStats,
        performance: {
          embeddingTime,
          searchTime, 
          totalTime,
          fromCache: parseFloat(performanceStats.cacheHitRate) > 0
        }
      };
      
    } catch (error) {
      logger.error('Property search failed', {
        searchId,
        error: error.message,
        processingTime: Date.now() - startTime
      });
      
      throw error;
    }
  }

  private async performDatabaseSearch(
    queryEmbedding: number[],
    filters?: SearchFilters,
    limit: number = 20,
    offset: number = 0
  ): Promise<{ properties: Property[], total: number }> {
    
    // Build SQL query with vector similarity search
    let query = `
      SELECT 
        p.*,
        (1 - (p.embedding <=> $1::vector)) as similarity_score
      FROM properties p
      WHERE 1=1
    `;
    
    const params: any[] = [JSON.stringify(queryEmbedding)];
    let paramIndex = 2;
    
    // Add filters
    if (filters?.location) {
      query += ` AND LOWER(p.location) LIKE LOWER($${paramIndex})`;
      params.push(`%${filters.location}%`);
      paramIndex++;
    }
    
    if (filters?.minPrice) {
      query += ` AND p.price >= $${paramIndex}`;
      params.push(filters.minPrice);
      paramIndex++;
    }
    
    if (filters?.maxPrice) {
      query += ` AND p.price <= $${paramIndex}`;
      params.push(filters.maxPrice);
      paramIndex++;
    }
    
    if (filters?.bedrooms) {
      query += ` AND p.bedrooms = $${paramIndex}`;
      params.push(filters.bedrooms);
      paramIndex++;
    }
    
    if (filters?.propertyType) {
      query += ` AND p.property_type = $${paramIndex}`;
      params.push(filters.propertyType);
      paramIndex++;
    }
    
    // Add similarity threshold and ordering
    query += ` 
      AND (1 - (p.embedding <=> $1::vector)) > 0.3
      ORDER BY similarity_score DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    
    params.push(limit, offset);
    
    // Execute search
    const results = await this.database.query(query, params);
    
    // Get total count for pagination
    const countQuery = query.replace(/SELECT.*?FROM/, 'SELECT COUNT(*) as total FROM')
                          .replace(/ORDER BY.*$/, '');
    const countResult = await this.database.query(countQuery, params.slice(0, -2));
    
    return {
      properties: results.rows,
      total: parseInt(countResult.rows[0].total)
    };
  }

  async indexPropertyEmbeddings(properties: Property[]): Promise<void> {
    logger.info('Starting property embedding indexing', { count: properties.length });
    
    const BATCH_SIZE = 10;
    let processed = 0;
    
    for (let i = 0; i < properties.length; i += BATCH_SIZE) {
      const batch = properties.slice(i, i + BATCH_SIZE);
      
      // Generate embeddings for property descriptions
      const descriptions = batch.map(p => this.createPropertyDescription(p));
      const embeddings = await this.embeddingService.batchGenerateEmbeddings(descriptions);
      
      // Update database with embeddings
      for (let j = 0; j < batch.length; j++) {
        const property = batch[j];
        const embedding = embeddings[j];
        
        await this.database.query(
          'UPDATE properties SET embedding = $1, updated_at = NOW() WHERE id = $2',
          [JSON.stringify(embedding), property.id]
        );
      }
      
      processed += batch.length;
      logger.info('Property embeddings indexed', { 
        processed, 
        total: properties.length,
        progress: `${(processed / properties.length * 100).toFixed(1)}%`
      });
    }
    
    logger.info('Property embedding indexing completed', { total: processed });
  }

  private createPropertyDescription(property: Property): string {
    // Create rich description for embedding
    const parts = [
      property.title || '',
      property.description || '',
      `${property.bedrooms} bedroom ${property.propertyType || 'property'}`,
      `£${property.price?.toLocaleString() || 'price on application'}`,
      property.location || '',
      property.features?.join(', ') || ''
    ].filter(Boolean);
    
    return parts.join('. ');
  }

  private generateSearchId(): string {
    return `search_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async getServiceHealth(): Promise<any> {
    const embeddingHealth = await this.embeddingService.checkHealth();
    const embeddingStats = this.embeddingService.getPerformanceStats();
    const cacheStats = await this.embeddingService.getCacheStats();
    
    return {
      embedding_service: {
        healthy: embeddingHealth,
        performance: embeddingStats
      },
      cache: cacheStats,
      overall_status: embeddingHealth ? 'healthy' : 'degraded'
    };
  }
}

// ============================================================================
// STEP 3: Enhanced Search API Routes
// property-search-api/src/routes/search.ts
// ============================================================================

import { Router, Request, Response } from 'express';
import { EnhancedPropertySearchService } from '../services/propertySearchService';
import { logger } from '../utils/logger';
import { validateSearchQuery } from '../middleware/validation';

const router = Router();

// Initialize search service
const searchService = new EnhancedPropertySearchService(
  // Your database instance
  require('../database').db,
  process.env.EMBEDDING_SERVICE_URL
);

/**
 * POST /api/search/properties
 * Enhanced property search with cached embeddings
 */
router.post('/properties', validateSearchQuery, async (req: Request, res: Response) => {
  const requestId = req.headers['x-request-id'] || `req_${Date.now()}`;
  
  try {
    const searchQuery = {
      query: req.body.query,
      filters: req.body.filters,
      limit: req.body.limit || 20,
      offset: req.body.offset || 0
    };

    logger.info('Property search request received', {
      requestId,
      query: searchQuery.query,
      filters: searchQuery.filters
    });

    const result = await searchService.searchProperties(searchQuery);

    // Add performance metrics to response
    res.json({
      success: true,
      data: {
        properties: result.properties,
        pagination: {
          total: result.total,
          limit: searchQuery.limit,
          offset: searchQuery.offset,
          hasMore: (searchQuery.offset + searchQuery.limit) < result.total
        },
        search_metadata: {
          search_id: result.searchId,
          processing_time_ms: result.processingTime,
          performance: result.performance,
          cache_efficiency: {
            hit_rate: result.cacheStats?.hit_rate_percent || 0,
            cost_saved: result.cacheStats?.cost_saved_dollars || 0,
            requests_served_from_cache: result.cacheStats?.cache_hits || 0
          }
        }
      },
      request_id: requestId
    });

  } catch (error) {
    logger.error('Property search failed', {
      requestId,
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      error: {
        message: 'Search failed',
        code: 'SEARCH_ERROR',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      request_id: requestId
    });
  }
});

/**
 * GET /api/search/health
 * Get search service health and performance stats
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const health = await searchService.getServiceHealth();
    
    res.json({
      success: true,
      data: health,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Health check failed',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/search/index
 * Index property embeddings (admin endpoint)
 */
router.post('/index', async (req: Request, res: Response) => {
  try {
    // Get all properties that need indexing
    const properties = await searchService.database.query(
      'SELECT * FROM properties WHERE embedding IS NULL OR updated_at > embedding_updated_at'
    );

    await searchService.indexPropertyEmbeddings(properties.rows);

    res.json({
      success: true,
      data: {
        indexed_properties: properties.rows.length,
        message: 'Property embeddings indexed successfully'
      }
    });

  } catch (error) {
    logger.error('Property indexing failed', { error: error.message });
    
    res.status(500).json({
      success: false,
      error: 'Indexing failed'
    });
  }
});

export { router as searchRouter };

// ============================================================================
// STEP 4: Integration Test Suite
// property-search-api/tests/integration/enhancedSearch.test.ts
// ============================================================================

import request from 'supertest';
import { app } from '../../src/app';
import { testDb } from '../helpers/database';

describe('Enhanced Property Search Integration', () => {
  beforeAll(async () => {
    await testDb.setup();
    await seedTestProperties();
  });

  afterAll(async () => {
    await testDb.teardown();
  });

  describe('POST /api/search/properties', () => {
    it('should search properties with cached embeddings', async () => {
      const searchQuery = {
        query: 'luxury apartment with great views',
        filters: {
          location: 'London',
          minPrice: 400000,
          maxPrice: 800000
        },
        limit: 10
      };

      const response = await request(app)
        .post('/api/search/properties')
        .send(searchQuery)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.properties).toBeInstanceOf(Array);
      expect(response.body.data.search_metadata).toBeDefined();
      expect(response.body.data.search_metadata.processing_time_ms).toBeLessThan(1000);
      
      // Should have cache efficiency data
      expect(response.body.data.search_metadata.cache_efficiency).toBeDefined();
    });

    it('should show performance improvement on repeated searches', async () => {
      const searchQuery = {
        query: 'modern 2 bedroom flat London',
        limit: 5
      };

      // First search (likely cache miss)
      const response1 = await request(app)
        .post('/api/search/properties')
        .send(searchQuery)
        .expect(200);

      const firstSearchTime = response1.body.data.search_metadata.processing_time_ms;

      // Second identical search (should be cache hit)
      const response2 = await request(app)
        .post('/api/search/properties')
        .send(searchQuery)
        .expect(200);

      const secondSearchTime = response2.body.data.search_metadata.processing_time_ms;
      
      // Second search should be faster (cached embedding)
      expect(secondSearchTime).toBeLessThan(firstSearchTime);
      
      // Should show cache hit
      expect(response2.body.data.search_metadata.performance.fromCache).toBe(true);
    });
  });

  describe('GET /api/search/health', () => {
    it('should return comprehensive health status', async () => {
      const response = await request(app)
        .get('/api/search/health')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.embedding_service).toBeDefined();
      expect(response.body.data.cache).toBeDefined();
      expect(response.body.data.overall_status).toMatch(/healthy|degraded/);
    });
  });
});

async function seedTestProperties() {
  // Add test properties with diverse descriptions for embedding testing
  const testProperties = [
    {
      title: 'Luxury Penthouse with Thames Views',
      description: 'Stunning 3-bedroom penthouse overlooking the River Thames with floor-to-ceiling windows and modern amenities.',
      bedrooms: 3,
      price: 750000,
      location: 'London, Canary Wharf',
      property_type: 'flat',
      features: ['river view', 'modern kitchen', 'balcony', 'concierge']
    },
    {
      title: 'Charming Victorian House',
      description: 'Beautiful 4-bedroom Victorian house with original features, large garden, and excellent transport links.',
      bedrooms: 4,
      price: 650000,
      location: 'London, Clapham',
      property_type: 'house',
      features: ['garden', 'period features', 'near station']
    },
    {
      title: 'Modern Studio Apartment',
      description: 'Compact studio in the heart of the city with everything you need for city living.',
      bedrooms: 1,
      price: 320000,
      location: 'London, Shoreditch',
      property_type: 'studio',
      features: ['city center', 'modern', 'transport links']
    }
  ];

  for (const property of testProperties) {
    await testDb.query(
      `INSERT INTO properties (title, description, bedrooms, price, location, property_type, features, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
      [
        property.title,
        property.description,
        property.bedrooms,
        property.price,
        property.location,
        property.property_type,
        property.features
      ]
    );
  }
}