# Moov-Sonnet4 Code Analysis & TDD Improvements

## Architecture Overview
The Moov-Sonnet4 property search platform consists of:
- **Frontend**: Next.js 15 with TypeScript (Port 3000)
- **API Server**: Node.js/TypeScript (Port 3001) 
- **AI Service**: Python FastAPI (Port 8001)
- **Database**: PostgreSQL with Neon cloud hosting
- **Cache**: Redis for session management

## Identified Areas for Improvement

### 1. **Error Handling & Validation**
**Issues**: Missing comprehensive error boundaries, inconsistent API error responses
**Risk Level**: High

### 2. **Database Connection Management**
**Issues**: Potential connection leaks, no retry logic for database failures
**Risk Level**: High

### 3. **API Rate Limiting & Security**
**Issues**: No rate limiting, missing input sanitization
**Risk Level**: Critical

### 4. **Type Safety & Validation**
**Issues**: Shared types not properly enforced, runtime validation missing
**Risk Level**: Medium

### 5. **Testing Infrastructure**
**Issues**: Limited test coverage, no integration tests for services
**Risk Level**: Medium

### 6. **Performance & Caching**
**Issues**: No query optimization, inefficient caching strategy
**Risk Level**: Medium

---

## TDD-Based Code Improvements

### 1. API Rate Limiting & Validation Middleware

**Test First:**
```typescript
// property-search-api/src/__tests__/middleware/rateLimiter.test.ts
import request from 'supertest';
import { app } from '../../app';
import Redis from 'ioredis';

jest.mock('ioredis');
const mockRedis = Redis as jest.MockedClass<typeof Redis>;

describe('Rate Limiter Middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should allow requests within rate limit', async () => {
    mockRedis.prototype.incr.mockResolvedValue(1);
    mockRedis.prototype.expire.mockResolvedValue(1);

    const response = await request(app)
      .get('/api/properties')
      .expect(200);
    
    expect(response.headers['x-ratelimit-remaining']).toBe('99');
  });

  it('should reject requests exceeding rate limit', async () => {
    mockRedis.prototype.incr.mockResolvedValue(101);

    const response = await request(app)
      .get('/api/properties')
      .expect(429);
    
    expect(response.body.error).toBe('Rate limit exceeded');
  });

  it('should handle redis connection failures gracefully', async () => {
    mockRedis.prototype.incr.mockRejectedValue(new Error('Redis down'));

    const response = await request(app)
      .get('/api/properties')
      .expect(200); // Should still work with degraded performance
  });
});
```

**Implementation:**
```typescript
// property-search-api/src/middleware/rateLimiter.ts
import { Request, Response, NextFunction } from 'express';
import Redis from 'ioredis';
import { logger } from '../utils/logger';

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  skipSuccessfulRequests?: boolean;
}

export class RateLimiter {
  private redis: Redis;
  private config: RateLimitConfig;

  constructor(redis: Redis, config: RateLimitConfig) {
    this.redis = redis;
    this.config = config;
  }

  async middleware(req: Request, res: Response, next: NextFunction): Promise<void> {
    const key = this.generateKey(req);
    const window = Math.floor(Date.now() / this.config.windowMs);
    const redisKey = `rate_limit:${key}:${window}`;

    try {
      const current = await this.redis.incr(redisKey);
      
      if (current === 1) {
        await this.redis.expire(redisKey, Math.ceil(this.config.windowMs / 1000));
      }

      const remaining = Math.max(0, this.config.maxRequests - current);
      
      res.set({
        'X-RateLimit-Limit': this.config.maxRequests.toString(),
        'X-RateLimit-Remaining': remaining.toString(),
        'X-RateLimit-Reset': new Date(Date.now() + this.config.windowMs).toISOString()
      });

      if (current > this.config.maxRequests) {
        res.status(429).json({
          error: 'Rate limit exceeded',
          retryAfter: Math.ceil(this.config.windowMs / 1000)
        });
        return;
      }

      next();
    } catch (error) {
      logger.error('Rate limiter error:', error);
      // Fail open - allow request but log error
      next();
    }
  }

  private generateKey(req: Request): string {
    return req.ip || req.connection.remoteAddress || 'unknown';
  }
}
```

### 2. Database Connection Pool with Retry Logic

**Test First:**
```typescript
// property-search-api/src/__tests__/database/connection.test.ts
import { DatabaseManager } from '../../database/connection';
import { Pool } from 'pg';

jest.mock('pg');
const mockPool = Pool as jest.MockedClass<typeof Pool>;

describe('DatabaseManager', () => {
  let dbManager: DatabaseManager;

  beforeEach(() => {
    jest.clearAllMocks();
    dbManager = new DatabaseManager();
  });

  it('should establish connection successfully', async () => {
    const mockClient = {
      query: jest.fn().mockResolvedValue({ rows: [{ now: new Date() }] }),
      release: jest.fn()
    };
    mockPool.prototype.connect.mockResolvedValue(mockClient as any);

    const isConnected = await dbManager.testConnection();
    expect(isConnected).toBe(true);
  });

  it('should retry failed connections', async () => {
    mockPool.prototype.connect
      .mockRejectedValueOnce(new Error('Connection failed'))
      .mockRejectedValueOnce(new Error('Connection failed'))
      .mockResolvedValueOnce({
        query: jest.fn().mockResolvedValue({ rows: [{ now: new Date() }] }),
        release: jest.fn()
      } as any);

    const isConnected = await dbManager.testConnection();
    expect(isConnected).toBe(true);
    expect(mockPool.prototype.connect).toHaveBeenCalledTimes(3);
  });

  it('should handle graceful shutdown', async () => {
    mockPool.prototype.end.mockResolvedValue(undefined);
    
    await dbManager.close();
    expect(mockPool.prototype.end).toHaveBeenCalled();
  });
});
```

**Implementation:**
```typescript
// property-search-api/src/database/connection.ts
import { Pool, PoolClient, PoolConfig } from 'pg';
import { logger } from '../utils/logger';

export interface DatabaseConfig extends PoolConfig {
  retryAttempts?: number;
  retryDelay?: number;
}

export class DatabaseManager {
  private pool: Pool;
  private config: DatabaseConfig;
  private isShuttingDown = false;

  constructor(config?: DatabaseConfig) {
    this.config = {
      connectionString: process.env.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
      retryAttempts: 3,
      retryDelay: 1000,
      ...config
    };

    this.pool = new Pool(this.config);
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.pool.on('error', (err) => {
      logger.error('Unexpected error on idle client', err);
    });

    this.pool.on('connect', () => {
      logger.info('Database connection established');
    });

    process.on('SIGINT', () => this.gracefulShutdown());
    process.on('SIGTERM', () => this.gracefulShutdown());
  }

  async query<T = any>(text: string, params?: any[]): Promise<T[]> {
    if (this.isShuttingDown) {
      throw new Error('Database is shutting down');
    }

    let attempt = 0;
    while (attempt < (this.config.retryAttempts || 3)) {
      try {
        const client = await this.pool.connect();
        try {
          const result = await client.query(text, params);
          return result.rows;
        } finally {
          client.release();
        }
      } catch (error) {
        attempt++;
        logger.warn(`Database query attempt ${attempt} failed:`, error);
        
        if (attempt >= (this.config.retryAttempts || 3)) {
          throw error;
        }
        
        await this.delay(this.config.retryDelay || 1000);
      }
    }
    
    throw new Error('All database retry attempts failed');
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.query('SELECT NOW()');
      return true;
    } catch (error) {
      logger.error('Database connection test failed:', error);
      return false;
    }
  }

  async close(): Promise<void> {
    this.isShuttingDown = true;
    await this.pool.end();
    logger.info('Database connection pool closed');
  }

  private async gracefulShutdown(): Promise<void> {
    logger.info('Gracefully shutting down database connections...');
    await this.close();
    process.exit(0);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

### 3. Property Search Service with Caching

**Test First:**
```typescript
// property-search-api/src/__tests__/services/propertySearch.test.ts
import { PropertySearchService } from '../../services/propertySearch';
import { DatabaseManager } from '../../database/connection';
import Redis from 'ioredis';

jest.mock('../../database/connection');
jest.mock('ioredis');

const mockDB = DatabaseManager as jest.MockedClass<typeof DatabaseManager>;
const mockRedis = Redis as jest.MockedClass<typeof Redis>;

describe('PropertySearchService', () => {
  let service: PropertySearchService;
  let mockDbInstance: jest.Mocked<DatabaseManager>;
  let mockRedisInstance: jest.Mocked<Redis>;

  beforeEach(() => {
    mockDbInstance = new mockDB() as jest.Mocked<DatabaseManager>;
    mockRedisInstance = new mockRedis() as jest.Mocked<Redis>;
    service = new PropertySearchService(mockDbInstance, mockRedisInstance);
  });

  describe('searchProperties', () => {
    it('should return cached results when available', async () => {
      const cachedResults = JSON.stringify([{ id: 1, title: 'Test Property' }]);
      mockRedisInstance.get.mockResolvedValue(cachedResults);

      const result = await service.searchProperties({ 
        query: 'london', 
        page: 1, 
        limit: 10 
      });

      expect(result).toEqual([{ id: 1, title: 'Test Property' }]);
      expect(mockDbInstance.query).not.toHaveBeenCalled();
    });

    it('should query database and cache results when cache miss', async () => {
      mockRedisInstance.get.mockResolvedValue(null);
      mockDbInstance.query.mockResolvedValue([{ id: 2, title: 'New Property' }]);
      mockRedisInstance.setex.mockResolvedValue('OK');

      const result = await service.searchProperties({
        query: 'manchester',
        page: 1,
        limit: 10
      });

      expect(result).toEqual([{ id: 2, title: 'New Property' }]);
      expect(mockDbInstance.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        expect.arrayContaining(['%manchester%'])
      );
      expect(mockRedisInstance.setex).toHaveBeenCalled();
    });

    it('should validate search parameters', async () => {
      await expect(service.searchProperties({
        query: '',
        page: -1,
        limit: 1000
      })).rejects.toThrow('Invalid search parameters');
    });
  });
});
```

**Implementation:**
```typescript
// property-search-api/src/services/propertySearch.ts
import { DatabaseManager } from '../database/connection';
import Redis from 'ioredis';
import { z } from 'zod';
import { logger } from '../utils/logger';

const SearchParamsSchema = z.object({
  query: z.string().min(1).max(100),
  page: z.number().min(1).max(100),
  limit: z.number().min(1).max(50),
  priceMin: z.number().optional(),
  priceMax: z.number().optional(),
  bedrooms: z.number().optional(),
  propertyType: z.enum(['house', 'flat', 'studio', 'land']).optional()
});

export type SearchParams = z.infer<typeof SearchParamsSchema>;

export interface Property {
  id: number;
  title: string;
  description: string;
  price: number;
  bedrooms: number;
  bathrooms: number;
  propertyType: string;
  location: {
    lat: number;
    lng: number;
    postcode: string;
  };
  images: string[];
  features: string[];
  createdAt: Date;
  updatedAt: Date;
}

export class PropertySearchService {
  private db: DatabaseManager;
  private redis: Redis;
  private cacheExpiry = 300; // 5 minutes

  constructor(db: DatabaseManager, redis: Redis) {
    this.db = db;
    this.redis = redis;
  }

  async searchProperties(params: SearchParams): Promise<Property[]> {
    // Validate input parameters
    const validatedParams = SearchParamsSchema.parse(params);
    
    // Generate cache key
    const cacheKey = this.generateCacheKey(validatedParams);
    
    try {
      // Try to get from cache first
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        logger.info(`Cache hit for search: ${cacheKey}`);
        return JSON.parse(cached);
      }
    } catch (error) {
      logger.warn('Cache read error:', error);
    }

    // Query database
    const properties = await this.queryDatabase(validatedParams);
    
    // Cache the results
    try {
      await this.redis.setex(
        cacheKey,
        this.cacheExpiry,
        JSON.stringify(properties)
      );
    } catch (error) {
      logger.warn('Cache write error:', error);
    }

    return properties;
  }

  private async queryDatabase(params: SearchParams): Promise<Property[]> {
    const { query, page, limit, priceMin, priceMax, bedrooms, propertyType } = params;
    
    let sql = `
      SELECT 
        p.id, p.title, p.description, p.price, p.bedrooms, p.bathrooms,
        p.property_type, p.latitude, p.longitude, p.postcode,
        p.created_at, p.updated_at,
        COALESCE(
          json_agg(DISTINCT pi.image_url) FILTER (WHERE pi.image_url IS NOT NULL),
          '[]'::json
        ) as images,
        COALESCE(
          json_agg(DISTINCT pf.feature_name) FILTER (WHERE pf.feature_name IS NOT NULL),
          '[]'::json
        ) as features
      FROM properties p
      LEFT JOIN property_images pi ON p.id = pi.property_id
      LEFT JOIN property_features pf ON p.id = pf.property_id
      WHERE (
        p.title ILIKE $1 OR 
        p.description ILIKE $1 OR 
        p.postcode ILIKE $1
      )
    `;

    const queryParams: any[] = [`%${query}%`];
    let paramIndex = 2;

    if (priceMin !== undefined) {
      sql += ` AND p.price >= $${paramIndex}`;
      queryParams.push(priceMin);
      paramIndex++;
    }

    if (priceMax !== undefined) {
      sql += ` AND p.price <= $${paramIndex}`;
      queryParams.push(priceMax);
      paramIndex++;
    }

    if (bedrooms !== undefined) {
      sql += ` AND p.bedrooms >= $${paramIndex}`;
      queryParams.push(bedrooms);
      paramIndex++;
    }

    if (propertyType) {
      sql += ` AND p.property_type = $${paramIndex}`;
      queryParams.push(propertyType);
      paramIndex++;
    }

    sql += `
      GROUP BY p.id
      ORDER BY p.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    queryParams.push(limit, (page - 1) * limit);

    const rows = await this.db.query(sql, queryParams);
    
    return rows.map(row => ({
      id: row.id,
      title: row.title,
      description: row.description,
      price: row.price,
      bedrooms: row.bedrooms,
      bathrooms: row.bathrooms,
      propertyType: row.property_type,
      location: {
        lat: row.latitude,
        lng: row.longitude,
        postcode: row.postcode
      },
      images: row.images || [],
      features: row.features || [],
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  }

  private generateCacheKey(params: SearchParams): string {
    const normalized = {
      ...params,
      query: params.query.toLowerCase().trim()
    };
    return `search:${Buffer.from(JSON.stringify(normalized)).toString('base64')}`;
  }
}
```

### 4. AI Service Integration with Error Handling

**Test First:**
```typescript
// property-search-api/src/__tests__/services/aiService.test.ts
import { AIServiceClient } from '../../services/aiService';
import axios from 'axios';

jest.mock('axios');
const mockAxios = axios as jest.Mocked<typeof axios>;

describe('AIServiceClient', () => {
  let aiService: AIServiceClient;

  beforeEach(() => {
    aiService = new AIServiceClient('http://localhost:8001');
    jest.clearAllMocks();
  });

  it('should successfully get property embeddings', async () => {
    mockAxios.post.mockResolvedValue({
      data: { embeddings: [0.1, 0.2, 0.3] }
    });

    const embeddings = await aiService.getPropertyEmbeddings('2 bed flat in London');
    
    expect(embeddings).toEqual([0.1, 0.2, 0.3]);
    expect(mockAxios.post).toHaveBeenCalledWith(
      'http://localhost:8001/embeddings',
      { text: '2 bed flat in London' },
      expect.objectContaining({
        timeout: 5000,
        headers: { 'Content-Type': 'application/json' }
      })
    );
  });

  it('should retry on network errors', async () => {
    mockAxios.post
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({
        data: { embeddings: [0.1, 0.2, 0.3] }
      });

    const embeddings = await aiService.getPropertyEmbeddings('test query');
    
    expect(embeddings).toEqual([0.1, 0.2, 0.3]);
    expect(mockAxios.post).toHaveBeenCalledTimes(2);
  });

  it('should handle service unavailable gracefully', async () => {
    mockAxios.post.mockRejectedValue(new Error('Service unavailable'));

    await expect(
      aiService.getPropertyEmbeddings('test query')
    ).rejects.toThrow('AI service temporarily unavailable');
  });
});
```

**Implementation:**
```typescript
// property-search-api/src/services/aiService.ts
import axios, { AxiosInstance, AxiosError } from 'axios';
import { logger } from '../utils/logger';

export interface EmbeddingResponse {
  embeddings: number[];
}

export class AIServiceClient {
  private client: AxiosInstance;
  private maxRetries = 3;
  private retryDelay = 1000;

  constructor(baseURL: string) {
    this.client = axios.create({
      baseURL,
      timeout: 5000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    this.client.interceptors.response.use(
      response => response,
      async (error: AxiosError) => {
        if (this.shouldRetry(error)) {
          return this.retryRequest(error);
        }
        return Promise.reject(error);
      }
    );
  }

  async getPropertyEmbeddings(text: string): Promise<number[]> {
    try {
      const response = await this.client.post<EmbeddingResponse>('/embeddings', {
        text: text.trim()
      });

      return response.data.embeddings;
    } catch (error) {
      logger.error('AI service error:', error);
      throw new Error('AI service temporarily unavailable');
    }
  }

  async searchSimilarProperties(
    queryEmbeddings: number[],
    limit: number = 10
  ): Promise<{ id: number; similarity: number }[]> {
    try {
      const response = await this.client.post('/search', {
        embeddings: queryEmbeddings,
        limit
      });

      return response.data.results;
    } catch (error) {
      logger.error('AI search error:', error);
      return []; // Graceful degradation
    }
  }

  private shouldRetry(error: AxiosError): boolean {
    return (
      !error.response ||
      error.response.status >= 500 ||
      error.code === 'ECONNRESET' ||
      error.code === 'ETIMEDOUT'
    );
  }

  private async retryRequest(error: AxiosError): Promise<any> {
    const config = error.config;
    if (!config) return Promise.reject(error);

    config.__retryCount = config.__retryCount || 0;

    if (config.__retryCount >= this.maxRetries) {
      return Promise.reject(error);
    }

    config.__retryCount++;

    await new Promise(resolve => 
      setTimeout(resolve, this.retryDelay * config.__retryCount)
    );

    return this.client(config);
  }
}

declare module 'axios' {
  interface AxiosRequestConfig {
    __retryCount?: number;
  }
}
```

### 5. Frontend Error Boundary with Logging

**Test First:**
```typescript
// property-search-frontend/src/__tests__/components/ErrorBoundary.test.tsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import * as errorLogger from '../../utils/errorLogger';

jest.mock('../../utils/errorLogger');
const mockErrorLogger = errorLogger as jest.Mocked<typeof errorLogger>;

const ThrowError = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) {
    throw new Error('Test error');
  }
  return <div>No error</div>;
};

describe('ErrorBoundary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should render children when no error occurs', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={false} />
      </ErrorBoundary>
    );

    expect(screen.getByText('No error')).toBeInTheDocument();
  });

  it('should render error UI when error occurs', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText(/Something went wrong/)).toBeInTheDocument();
    expect(screen.getByText('Try again')).toBeInTheDocument();
  });

  it('should log error details', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(mockErrorLogger.logError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        component: 'ErrorBoundary',
        timestamp: expect.any(Date)
      })
    );
  });
});
```

### 6. Integration Test Setup

**Implementation:**
```typescript
// property-search-api/src/__tests__/integration/propertyApi.integration.test.ts
import request from 'supertest';
import { app } from '../../app';
import { DatabaseManager } from '../../database/connection';
import { createTestDatabase, clearTestDatabase } from '../helpers/testDatabase';

describe('Property API Integration', () => {
  let db: DatabaseManager;

  beforeAll(async () => {
    db = await createTestDatabase();
  });

  afterAll(async () => {
    await db.close();
  });

  beforeEach(async () => {
    await clearTestDatabase(db);
  });

  describe('GET /api/properties/search', () => {
    it('should return properties matching search criteria', async () => {
      // Seed test data
      await db.query(
        `INSERT INTO properties (title, description, price, bedrooms, property_type, postcode) 
         VALUES ($1, $2, $3, $4, $5, $6)`,
        ['Modern Flat', 'Beautiful 2-bed flat in London', 450000, 2, 'flat', 'SW1A 1AA']
      );

      const response = await request(app)
        .get('/api/properties/search')
        .query({
          query: 'london',
          page: 1,
          limit: 10
        })
        .expect(200);

      expect(response.body.properties).toHaveLength(1);
      expect(response.body.properties[0]).toMatchObject({
        title: 'Modern Flat',
        price: 450000,
        bedrooms: 2
      });
    });

    it('should handle pagination correctly', async () => {
      // Seed multiple properties
      for (let i = 1; i <= 15; i++) {
        await db.query(
          `INSERT INTO properties (title, description, price, bedrooms, property_type, postcode) 
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [`Property ${i}`, `Description ${i}`, 100000 + i, 2, 'flat', 'SW1A 1AA']
        );
      }

      const response = await request(app)
        .get('/api/properties/search')
        .query({
          query: 'property',
          page: 2,
          limit: 10
        })
        .expect(200);

      expect(response.body.properties).toHaveLength(5);
      expect(response.body.pagination).toMatchObject({
        currentPage: 2,
        totalPages: 2,
        totalItems: 15
      });
    });
  });
});
```

## Implementation Priority

1. **Critical (Week 1)**:
   - Database connection management with retry logic
   - API rate limiting and input validation
   - Error boundaries and logging

2. **High (Week 2)**:
   - Caching layer for property search
   - AI service integration improvements
   - Comprehensive test suite

3. **Medium (Week 3)**:
   - Performance optimizations
   - Security enhancements
   - Monitoring and metrics

## Benefits of TDD Approach

- **Reliability**: Tests ensure code works as expected before deployment
- **Maintainability**: Clear contracts and expectations make refactoring safer
- **Documentation**: Tests serve as living documentation of system behavior
- **Quality**: Forces consideration of edge cases and error scenarios
- **Confidence**: Enables rapid iteration with confidence in system stability