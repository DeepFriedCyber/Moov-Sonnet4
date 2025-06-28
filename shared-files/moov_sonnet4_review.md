# Moov-Sonnet4 Property Search Platform - Code Review & TDD Improvements

## 🔍 Current Architecture Assessment

**Strengths:**
- Modern tech stack (Next.js 15, TypeScript, Python/FastAPI)
- Clear separation of concerns with microservices
- Docker containerization support
- PostgreSQL with cloud hosting
- AI-powered search functionality

**Areas for Improvement:**
1. **Testing Infrastructure**: Missing comprehensive test coverage
2. **Error Handling**: Needs standardized error handling across services
3. **Input Validation**: Requires robust validation layers
4. **Performance**: Caching and optimization opportunities
5. **Security**: Authentication, authorization, and data protection
6. **Monitoring**: Observability and health checks

## 🧪 TDD-Based Improvements

### 1. Testing Infrastructure

#### Frontend Testing Framework
```typescript
// property-search-frontend/src/test-utils/render.tsx
import { render, RenderOptions } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactElement } from 'react'

const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
})

const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  const queryClient = createTestQueryClient()
  
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllTheProviders, ...options })

export * from '@testing-library/react'
export { customRender as render }
```

```typescript
// property-search-frontend/__tests__/components/PropertyCard.test.tsx
import { render, screen, fireEvent } from '../test-utils/render'
import { PropertyCard } from '@/components/PropertyCard'
import { Property } from '@/types/property'

const mockProperty: Property = {
  id: '123',
  title: 'Beautiful 2BR Apartment',
  price: 450000,
  location: 'London, UK',
  bedrooms: 2,
  bathrooms: 1,
  area: 850,
  images: ['https://example.com/image1.jpg'],
}

describe('PropertyCard', () => {
  it('displays property information correctly', () => {
    render(<PropertyCard property={mockProperty} />)
    
    expect(screen.getByText('Beautiful 2BR Apartment')).toBeInTheDocument()
    expect(screen.getByText('£450,000')).toBeInTheDocument()
    expect(screen.getByText('London, UK')).toBeInTheDocument()
    expect(screen.getByText('2 bed')).toBeInTheDocument()
  })

  it('handles click events', () => {
    const onClickMock = jest.fn()
    render(<PropertyCard property={mockProperty} onClick={onClickMock} />)
    
    fireEvent.click(screen.getByRole('button'))
    expect(onClickMock).toHaveBeenCalledWith(mockProperty)
  })
})
```

#### API Testing Framework
```typescript
// property-search-api/src/tests/setup.ts
import { createApp } from '../app'
import { setupTestDatabase, cleanupTestDatabase } from './test-db'
import request from 'supertest'

export let app: any
export let testRequest: any

beforeAll(async () => {
  await setupTestDatabase()
  app = createApp()
  testRequest = request(app)
})

afterAll(async () => {
  await cleanupTestDatabase()
})

beforeEach(async () => {
  // Clear test data between tests
  await cleanupTestDatabase()
  await setupTestDatabase()
})
```

```typescript
// property-search-api/src/tests/routes/properties.test.ts
import { testRequest } from '../setup'
import { Property } from '../../models/Property'

describe('GET /api/properties', () => {
  beforeEach(async () => {
    // Seed test data
    await Property.create({
      title: 'Test Property',
      price: 300000,
      location: 'Test Location',
      bedrooms: 2,
      bathrooms: 1,
    })
  })

  it('returns a list of properties', async () => {
    const response = await testRequest
      .get('/api/properties')
      .expect(200)
    
    expect(response.body).toHaveProperty('properties')
    expect(response.body.properties).toHaveLength(1)
    expect(response.body.properties[0]).toMatchObject({
      title: 'Test Property',
      price: 300000,
    })
  })

  it('filters properties by price range', async () => {
    await Property.create({ title: 'Expensive', price: 500000 })
    
    const response = await testRequest
      .get('/api/properties?minPrice=100000&maxPrice=400000')
      .expect(200)
    
    expect(response.body.properties).toHaveLength(1)
    expect(response.body.properties[0].price).toBeLessThanOrEqual(400000)
  })
})
```

### 2. Enhanced Error Handling

```typescript
// property-search-api/src/middleware/errorHandler.ts
import { Request, Response, NextFunction } from 'express'
import { logger } from '../utils/logger'

export class AppError extends Error {
  public statusCode: number
  public isOperational: boolean

  constructor(message: string, statusCode: number) {
    super(message)
    this.statusCode = statusCode
    this.isOperational = true
    Error.captureStackTrace(this, this.constructor)
  }
}

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let error = { ...err }
  error.message = err.message

  logger.error({
    error: err,
    request: {
      method: req.method,
      url: req.url,
      headers: req.headers,
      body: req.body,
    },
  })

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = 'Resource not found'
    error = new AppError(message, 404)
  }

  // Mongoose duplicate key
  if (err.name === 'MongoError' && (err as any).code === 11000) {
    const message = 'Duplicate field value entered'
    error = new AppError(message, 400)
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = Object.values((err as any).errors).map((val: any) => val.message)
    error = new AppError(message.join(', '), 400)
  }

  res.status((error as AppError).statusCode || 500).json({
    success: false,
    error: (error as AppError).message || 'Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  })
}
```

```typescript
// property-search-api/src/tests/middleware/errorHandler.test.ts
import { errorHandler, AppError } from '../../middleware/errorHandler'
import { Request, Response } from 'express'

describe('Error Handler Middleware', () => {
  let mockReq: Partial<Request>
  let mockRes: Partial<Response>
  let mockNext: jest.Mock

  beforeEach(() => {
    mockReq = {
      method: 'GET',
      url: '/test',
      headers: {},
      body: {},
    }
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    }
    mockNext = jest.fn()
  })

  it('handles AppError correctly', () => {
    const error = new AppError('Test error', 400)
    
    errorHandler(error, mockReq as Request, mockRes as Response, mockNext)
    
    expect(mockRes.status).toHaveBeenCalledWith(400)
    expect(mockRes.json).toHaveBeenCalledWith({
      success: false,
      error: 'Test error',
    })
  })
})
```

### 3. Input Validation Layer

```typescript
// property-search-api/src/validation/propertyValidation.ts
import Joi from 'joi'
import { Request, Response, NextFunction } from 'express'
import { AppError } from '../middleware/errorHandler'

const propertySchema = Joi.object({
  title: Joi.string().min(3).max(100).required(),
  description: Joi.string().max(1000),
  price: Joi.number().positive().required(),
  location: Joi.string().required(),
  bedrooms: Joi.number().integer().min(0).max(20),
  bathrooms: Joi.number().positive().max(20),
  area: Joi.number().positive(),
  propertyType: Joi.string().valid('apartment', 'house', 'studio', 'commercial'),
  images: Joi.array().items(Joi.string().uri()).max(20),
})

export const validateProperty = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error } = schema.validate(req.body)
    if (error) {
      const message = error.details.map(detail => detail.message).join(', ')
      return next(new AppError(message, 400))
    }
    next()
  }
}

export const validateCreateProperty = validateProperty(propertySchema)
```

```typescript
// property-search-api/src/tests/validation/propertyValidation.test.ts
import { validateCreateProperty } from '../../validation/propertyValidation'
import { Request, Response, NextFunction } from 'express'

describe('Property Validation', () => {
  let mockReq: Partial<Request>
  let mockRes: Partial<Response>
  let mockNext: NextFunction

  beforeEach(() => {
    mockReq = { body: {} }
    mockRes = {}
    mockNext = jest.fn()
  })

  it('passes validation for valid property data', () => {
    mockReq.body = {
      title: 'Test Property',
      price: 300000,
      location: 'London',
      bedrooms: 2,
      bathrooms: 1,
    }

    validateCreateProperty(mockReq as Request, mockRes as Response, mockNext)
    expect(mockNext).toHaveBeenCalledWith()
  })

  it('rejects invalid property data', () => {
    mockReq.body = {
      title: 'Te', // Too short
      price: -100, // Negative price
    }

    validateCreateProperty(mockReq as Request, mockRes as Response, mockNext)
    expect(mockNext).toHaveBeenCalledWith(expect.any(Error))
  })
})
```

### 4. Caching Layer

```typescript
// property-search-api/src/services/cacheService.ts
import Redis from 'ioredis'
import { logger } from '../utils/logger'

export class CacheService {
  private redis: Redis
  private defaultTTL = 3600 // 1 hour

  constructor() {
    this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379')
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.redis.get(key)
      return value ? JSON.parse(value) : null
    } catch (error) {
      logger.error('Cache get error:', error)
      return null
    }
  }

  async set(key: string, value: any, ttl = this.defaultTTL): Promise<boolean> {
    try {
      await this.redis.setex(key, ttl, JSON.stringify(value))
      return true
    } catch (error) {
      logger.error('Cache set error:', error)
      return false
    }
  }

  async del(pattern: string): Promise<number> {
    try {
      const keys = await this.redis.keys(pattern)
      if (keys.length > 0) {
        return await this.redis.del(...keys)
      }
      return 0
    } catch (error) {
      logger.error('Cache delete error:', error)
      return 0
    }
  }

  generateKey(prefix: string, ...parts: string[]): string {
    return `${prefix}:${parts.join(':')}`
  }
}

export const cacheService = new CacheService()
```

```typescript
// property-search-api/src/tests/services/cacheService.test.ts
import { CacheService } from '../../services/cacheService'
import Redis from 'ioredis-mock'

jest.mock('ioredis', () => require('ioredis-mock'))

describe('CacheService', () => {
  let cacheService: CacheService

  beforeEach(() => {
    cacheService = new CacheService()
  })

  it('sets and gets cache values correctly', async () => {
    const key = 'test:key'
    const value = { id: 1, name: 'test' }

    await cacheService.set(key, value)
    const result = await cacheService.get(key)

    expect(result).toEqual(value)
  })

  it('returns null for non-existent keys', async () => {
    const result = await cacheService.get('non:existent')
    expect(result).toBeNull()
  })

  it('generates cache keys correctly', () => {
    const key = cacheService.generateKey('properties', 'user', '123')
    expect(key).toBe('properties:user:123')
  })
})
```

### 5. Property Service with Caching

```typescript
// property-search-api/src/services/propertyService.ts
import { Property } from '../models/Property'
import { cacheService } from './cacheService'
import { AppError } from '../middleware/errorHandler'

export interface PropertySearchFilters {
  minPrice?: number
  maxPrice?: number
  bedrooms?: number
  location?: string
  propertyType?: string
  page?: number
  limit?: number
}

export class PropertyService {
  async searchProperties(filters: PropertySearchFilters) {
    const cacheKey = cacheService.generateKey(
      'properties:search',
      JSON.stringify(filters)
    )

    // Try cache first
    const cached = await cacheService.get(cacheKey)
    if (cached) {
      return cached
    }

    // Build query
    const query = this.buildSearchQuery(filters)
    const { page = 1, limit = 20 } = filters
    const offset = (page - 1) * limit

    const [properties, total] = await Promise.all([
      Property.findAll({ where: query, limit, offset }),
      Property.count({ where: query })
    ])

    const result = {
      properties,
      total,
      page,
      pages: Math.ceil(total / limit),
    }

    // Cache for 5 minutes
    await cacheService.set(cacheKey, result, 300)
    return result
  }

  private buildSearchQuery(filters: PropertySearchFilters) {
    const query: any = {}

    if (filters.minPrice || filters.maxPrice) {
      query.price = {}
      if (filters.minPrice) query.price.gte = filters.minPrice
      if (filters.maxPrice) query.price.lte = filters.maxPrice
    }

    if (filters.bedrooms) {
      query.bedrooms = filters.bedrooms
    }

    if (filters.location) {
      query.location = { contains: filters.location }
    }

    if (filters.propertyType) {
      query.propertyType = filters.propertyType
    }

    return query
  }

  async invalidatePropertyCache(propertyId?: string) {
    await cacheService.del('properties:search:*')
    if (propertyId) {
      await cacheService.del(`property:${propertyId}`)
    }
  }
}

export const propertyService = new PropertyService()
```

### 6. AI Service Testing

```python
# property-embedding-service/tests/test_embedding_service.py
import pytest
import numpy as np
from unittest.mock import Mock, patch
from src.services.embedding_service import EmbeddingService

class TestEmbeddingService:
    @pytest.fixture
    def embedding_service(self):
        return EmbeddingService()

    def test_encode_text(self, embedding_service):
        """Test text encoding returns proper embedding vector"""
        text = "2 bedroom apartment in London"
        embedding = embedding_service.encode_text(text)
        
        assert isinstance(embedding, np.ndarray)
        assert embedding.shape[0] > 0  # Should have dimensions
        assert not np.isnan(embedding).any()  # No NaN values

    def test_calculate_similarity(self, embedding_service):
        """Test similarity calculation between embeddings"""
        text1 = "Modern apartment with garden"
        text2 = "Contemporary flat with outdoor space"
        text3 = "Commercial office building"
        
        emb1 = embedding_service.encode_text(text1)
        emb2 = embedding_service.encode_text(text2)
        emb3 = embedding_service.encode_text(text3)
        
        # Similar texts should have higher similarity
        similarity_similar = embedding_service.calculate_similarity(emb1, emb2)
        similarity_different = embedding_service.calculate_similarity(emb1, emb3)
        
        assert similarity_similar > similarity_different
        assert 0 <= similarity_similar <= 1
        assert 0 <= similarity_different <= 1

    @patch('src.services.embedding_service.requests.post')
    def test_api_error_handling(self, mock_post, embedding_service):
        """Test API handles errors gracefully"""
        mock_post.side_effect = Exception("API Error")
        
        with pytest.raises(Exception):
            embedding_service.encode_text("test text")

    def test_batch_encoding(self, embedding_service):
        """Test batch encoding of multiple texts"""
        texts = [
            "Studio apartment",
            "One bedroom flat", 
            "Two bedroom house"
        ]
        
        embeddings = embedding_service.encode_batch(texts)
        
        assert len(embeddings) == len(texts)
        assert all(isinstance(emb, np.ndarray) for emb in embeddings)
```

### 7. Frontend Hook Testing

```typescript
// property-search-frontend/src/hooks/usePropertySearch.ts
import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { propertyApi } from '@/lib/api'
import { Property, PropertySearchFilters } from '@/types/property'

export const usePropertySearch = (filters: PropertySearchFilters) => {
  const [debouncedFilters, setDebouncedFilters] = useState(filters)

  // Debounce filters to avoid too many API calls
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedFilters(filters)
    }, 300)

    return () => clearTimeout(timer)
  }, [filters])

  return useQuery({
    queryKey: ['properties', debouncedFilters],
    queryFn: () => propertyApi.searchProperties(debouncedFilters),
    enabled: Object.keys(debouncedFilters).length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
  })
}
```

```typescript
// property-search-frontend/__tests__/hooks/usePropertySearch.test.ts
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { usePropertySearch } from '@/hooks/usePropertySearch'
import { propertyApi } from '@/lib/api'

jest.mock('@/lib/api')
const mockPropertyApi = propertyApi as jest.Mocked<typeof propertyApi>

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  })
  
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}

describe('usePropertySearch', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('fetches properties with given filters', async () => {
    const mockProperties = [
      { id: '1', title: 'Test Property', price: 300000 }
    ]
    
    mockPropertyApi.searchProperties.mockResolvedValue({
      properties: mockProperties,
      total: 1,
    })

    const { result } = renderHook(
      () => usePropertySearch({ minPrice: 200000 }),
      { wrapper: createWrapper() }
    )

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(mockPropertyApi.searchProperties).toHaveBeenCalledWith({
      minPrice: 200000
    })
    expect(result.current.data?.properties).toEqual(mockProperties)
  })

  it('debounces filter changes', async () => {
    const { result, rerender } = renderHook(
      ({ filters }) => usePropertySearch(filters),
      {
        wrapper: createWrapper(),
        initialProps: { filters: { minPrice: 200000 } }
      }
    )

    // Change filters quickly
    rerender({ filters: { minPrice: 300000 } })
    rerender({ filters: { minPrice: 400000 } })

    // Should only call API once after debounce
    await waitFor(() => {
      expect(mockPropertyApi.searchProperties).toHaveBeenCalledTimes(1)
    })
  })
})
```

## 📊 Performance Monitoring

```typescript
// property-search-api/src/middleware/performanceMonitoring.ts
import { Request, Response, NextFunction } from 'express'
import { logger } from '../utils/logger'

export const performanceMonitoring = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const start = Date.now()
  
  res.on('finish', () => {
    const duration = Date.now() - start
    
    logger.info({
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration,
      userAgent: req.get('User-Agent'),
    })

    // Alert on slow requests
    if (duration > 5000) {
      logger.warn({
        message: 'Slow request detected',
        method: req.method,
        url: req.url,
        duration,
      })
    }
  })

  next()
}
```

## 🔒 Security Enhancements

```typescript
// property-search-api/src/middleware/security.ts
import rateLimit from 'express-rate-limit'
import helmet from 'helmet'
import { Request, Response, NextFunction } from 'express'

export const securityMiddleware = [
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
  }),

  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP',
    standardHeaders: true,
    legacyHeaders: false,
  }),
]

export const apiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: 'API rate limit exceeded',
})
```

## 🚀 Implementation Priority

1. **Phase 1**: Set up testing infrastructure and basic unit tests
2. **Phase 2**: Implement error handling and validation layers
3. **Phase 3**: Add caching and performance optimizations
4. **Phase 4**: Enhance security and monitoring
5. **Phase 5**: Add integration tests and E2E testing

This TDD approach ensures robust, maintainable code with comprehensive test coverage while improving the platform's reliability, performance, and security.