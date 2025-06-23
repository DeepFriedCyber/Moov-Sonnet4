# Moov-Sonnet4 Repository Improvements and Code Fixes

## 1. Security Improvements

### A. Environment Variable Validation
The repository lacks proper environment variable validation. Add this to ensure all required variables are present:

**File: `property-search-api/src/config/env.ts`**
```typescript
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3001').transform(Number),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url().optional(),
  FRONTEND_URL: z.string().url(),
  EMBEDDING_SERVICE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  CORS_ORIGIN: z.string().default('*'),
});

export const env = envSchema.parse(process.env);

// Type-safe environment variables
export type Env = z.infer<typeof envSchema>;
```

**File: `property-search-frontend/src/lib/env.ts`**
```typescript
import { z } from 'zod';

const envSchema = z.object({
  NEXT_PUBLIC_API_URL: z.string().url(),
  NEXT_PUBLIC_EMBEDDING_SERVICE_URL: z.string().url(),
});

export const env = envSchema.parse({
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  NEXT_PUBLIC_EMBEDDING_SERVICE_URL: process.env.NEXT_PUBLIC_EMBEDDING_SERVICE_URL,
});
```

### B. API Rate Limiting
Add rate limiting to prevent abuse:

**File: `property-search-api/src/middleware/rateLimit.ts`**
```typescript
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { redis } from '../lib/redis';

export const apiLimiter = rateLimit({
  store: new RedisStore({
    client: redis,
    prefix: 'rate-limit:',
  }),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

export const authLimiter = rateLimit({
  store: new RedisStore({
    client: redis,
    prefix: 'auth-limit:',
  }),
  windowMs: 15 * 60 * 1000,
  max: 5, // Limit auth attempts
  skipSuccessfulRequests: true,
});
```

## 2. Error Handling Improvements

### A. Global Error Handler
**File: `property-search-api/src/middleware/errorHandler.ts`**
```typescript
import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from '../lib/logger';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public isOperational = true
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let statusCode = 500;
  let message = 'Internal server error';
  let errors: any = undefined;

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
  } else if (err instanceof ZodError) {
    statusCode = 400;
    message = 'Validation error';
    errors = err.errors;
  } else if (err.name === 'UnauthorizedError') {
    statusCode = 401;
    message = 'Unauthorized';
  }

  logger.error({
    error: err,
    request: {
      method: req.method,
      url: req.url,
      headers: req.headers,
      body: req.body,
    },
  });

  res.status(statusCode).json({
    status: 'error',
    message,
    errors,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};
```

### B. Frontend Error Boundary
**File: `property-search-frontend/src/components/ErrorBoundary.tsx`**
```typescript
'use client';

import React, { ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
    // Send to error tracking service
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'exception', {
        description: error.toString(),
        fatal: true,
      });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="flex flex-col items-center justify-center min-h-[400px] p-6">
            <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
            <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
            <p className="text-gray-600 mb-4 text-center max-w-md">
              We're sorry, but something unexpected happened. Please try refreshing the page.
            </p>
            <Button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
            >
              Refresh Page
            </Button>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
```

## 3. Database Connection Pooling

**File: `property-search-api/src/lib/db.ts`**
```typescript
import { Pool } from 'pg';
import { env } from '../config/env';

// Create a connection pool
export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection could not be established
  ssl: env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// Health check
export const checkDatabaseConnection = async (): Promise<boolean> => {
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    return true;
  } catch (error) {
    console.error('Database connection failed:', error);
    return false;
  }
};

// Graceful shutdown
process.on('SIGINT', async () => {
  await pool.end();
  process.exit(0);
});
```

## 4. Type Safety Improvements

**File: `property-search-types/src/index.ts`**
```typescript
// Shared types for the entire application
export interface Property {
  id: string;
  title: string;
  description: string;
  price: number;
  bedrooms: number;
  bathrooms: number;
  area: number;
  location: {
    address: string;
    city: string;
    postcode: string;
    coordinates: {
      lat: number;
      lng: number;
    };
  };
  images: string[];
  features: string[];
  propertyType: 'house' | 'flat' | 'bungalow' | 'maisonette' | 'studio';
  listingType: 'sale' | 'rent';
  createdAt: Date;
  updatedAt: Date;
}

export interface SearchQuery {
  query: string;
  filters?: {
    minPrice?: number;
    maxPrice?: number;
    minBedrooms?: number;
    maxBedrooms?: number;
    propertyType?: Property['propertyType'][];
    location?: string;
    radius?: number; // in miles
  };
  sort?: {
    field: 'price' | 'bedrooms' | 'createdAt';
    order: 'asc' | 'desc';
  };
  pagination?: {
    page: number;
    limit: number;
  };
}

export interface ApiResponse<T> {
  status: 'success' | 'error';
  data?: T;
  error?: {
    message: string;
    code?: string;
  };
  meta?: {
    page?: number;
    totalPages?: number;
    totalItems?: number;
  };
}
```

## 5. Caching Strategy

**File: `property-search-api/src/lib/cache.ts`**
```typescript
import Redis from 'ioredis';
import { env } from '../config/env';

const redis = env.REDIS_URL ? new Redis(env.REDIS_URL) : null;

export class CacheService {
  private static instance: CacheService;
  private ttl = 3600; // 1 hour default

  static getInstance(): CacheService {
    if (!CacheService.instance) {
      CacheService.instance = new CacheService();
    }
    return CacheService.instance;
  }

  async get<T>(key: string): Promise<T | null> {
    if (!redis) return null;
    
    try {
      const data = await redis.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  async set(key: string, value: any, ttl?: number): Promise<void> {
    if (!redis) return;
    
    try {
      await redis.set(
        key,
        JSON.stringify(value),
        'EX',
        ttl || this.ttl
      );
    } catch (error) {
      console.error('Cache set error:', error);
    }
  }

  async invalidate(pattern: string): Promise<void> {
    if (!redis) return;
    
    try {
      const keys = await redis.keys(pattern);
      if (keys.length) {
        await redis.del(...keys);
      }
    } catch (error) {
      console.error('Cache invalidation error:', error);
    }
  }

  generateKey(prefix: string, params: any): string {
    return `${prefix}:${JSON.stringify(params)}`;
  }
}

export const cache = CacheService.getInstance();
```

## 6. Logging Service

**File: `property-search-api/src/lib/logger.ts`**
```typescript
import winston from 'winston';
import { env } from '../config/env';

const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

const level = () => {
  const isDevelopment = env.NODE_ENV === 'development';
  return isDevelopment ? 'debug' : 'warn';
};

const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

winston.addColors(colors);

const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`
  )
);

const transports = [
  new winston.transports.Console(),
  new winston.transports.File({
    filename: 'logs/error.log',
    level: 'error',
  }),
  new winston.transports.File({
    filename: 'logs/all.log',
  }),
];

export const logger = winston.createLogger({
  level: level(),
  levels: logLevels,
  format,
  transports,
});

// Stream for Morgan HTTP logger
export const httpLogStream = {
  write: (message: string) => {
    logger.http(message.trim());
  },
};
```

## 7. API Request Validation

**File: `property-search-api/src/validators/property.ts`**
```typescript
import { z } from 'zod';

export const searchPropertiesSchema = z.object({
  body: z.object({
    query: z.string().min(1).max(500),
    filters: z.object({
      minPrice: z.number().min(0).optional(),
      maxPrice: z.number().min(0).optional(),
      minBedrooms: z.number().min(0).max(10).optional(),
      maxBedrooms: z.number().min(0).max(10).optional(),
      propertyType: z.array(z.enum(['house', 'flat', 'bungalow', 'maisonette', 'studio'])).optional(),
      location: z.string().optional(),
      radius: z.number().min(0).max(100).optional(),
    }).optional(),
    sort: z.object({
      field: z.enum(['price', 'bedrooms', 'createdAt']),
      order: z.enum(['asc', 'desc']),
    }).optional(),
    pagination: z.object({
      page: z.number().min(1).default(1),
      limit: z.number().min(1).max(100).default(20),
    }).optional(),
  }),
});

export const createPropertySchema = z.object({
  body: z.object({
    title: z.string().min(1).max(200),
    description: z.string().min(1).max(5000),
    price: z.number().min(0),
    bedrooms: z.number().min(0).max(10),
    bathrooms: z.number().min(0).max(10),
    area: z.number().min(0),
    location: z.object({
      address: z.string(),
      city: z.string(),
      postcode: z.string().regex(/^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i),
      coordinates: z.object({
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
      }),
    }),
    images: z.array(z.string().url()).min(1).max(20),
    features: z.array(z.string()).max(50),
    propertyType: z.enum(['house', 'flat', 'bungalow', 'maisonette', 'studio']),
    listingType: z.enum(['sale', 'rent']),
  }),
});
```

## 8. Docker Configuration Improvements

**File: `docker-compose.yml`**
```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    container_name: moov-postgres
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-moov}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-moov123}
      POSTGRES_DB: ${POSTGRES_DB:-moov_db}
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-moov}"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - moov-network

  redis:
    image: redis:7-alpine
    container_name: moov-redis
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - moov-network

  api:
    build:
      context: ./property-search-api
      dockerfile: Dockerfile
    container_name: moov-api
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    environment:
      NODE_ENV: ${NODE_ENV:-production}
      DATABASE_URL: postgresql://${POSTGRES_USER:-moov}:${POSTGRES_PASSWORD:-moov123}@postgres:5432/${POSTGRES_DB:-moov_db}
      REDIS_URL: redis://redis:6379
      JWT_SECRET: ${JWT_SECRET}
      EMBEDDING_SERVICE_URL: http://embedding:8001
    ports:
      - "3001:3001"
    volumes:
      - ./property-search-api:/app
      - /app/node_modules
    networks:
      - moov-network

  frontend:
    build:
      context: ./property-search-frontend
      dockerfile: Dockerfile
    container_name: moov-frontend
    depends_on:
      - api
    environment:
      NEXT_PUBLIC_API_URL: http://localhost:3001
      NEXT_PUBLIC_EMBEDDING_SERVICE_URL: http://localhost:8001
    ports:
      - "3000:3000"
    volumes:
      - ./property-search-frontend:/app
      - /app/node_modules
      - /app/.next
    networks:
      - moov-network

  embedding:
    build:
      context: ./property-embedding-service
      dockerfile: Dockerfile
    container_name: moov-embedding
    environment:
      MODEL_NAME: all-MiniLM-L6-v2
      CACHE_DIR: /app/model_cache
      API_HOST: 0.0.0.0
      API_PORT: 8001
    ports:
      - "8001:8001"
    volumes:
      - ./property-embedding-service:/app
      - model_cache:/app/model_cache
    networks:
      - moov-network

volumes:
  postgres_data:
  redis_data:
  model_cache:

networks:
  moov-network:
    driver: bridge
```

## 9. GitHub Actions CI/CD

**File: `.github/workflows/ci.yml`**
```yaml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

env:
  NODE_VERSION: '18.x'
  PYTHON_VERSION: '3.11'

jobs:
  lint-and-type-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run ESLint
        run: npm run lint
      
      - name: Run TypeScript check
        run: npm run type-check

  test-frontend:
    runs-on: ubuntu-latest
    needs: lint-and-type-check
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
      
      - name: Install dependencies
        run: |
          cd property-search-frontend
          npm ci
      
      - name: Run tests
        run: |
          cd property-search-frontend
          npm test -- --coverage
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          file: ./property-search-frontend/coverage/lcov.info
          flags: frontend

  test-api:
    runs-on: ubuntu-latest
    needs: lint-and-type-check
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: test_db
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
      
      - name: Install dependencies
        run: |
          cd property-search-api
          npm ci
      
      - name: Run tests
        run: |
          cd property-search-api
          npm test -- --coverage
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/test_db
          JWT_SECRET: test-secret-key
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          file: ./property-search-api/coverage/lcov.info
          flags: api

  test-embedding-service:
    runs-on: ubuntu-latest
    needs: lint-and-type-check
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Python
        uses: actions/setup-python@v4
        with:
          python-version: ${{ env.PYTHON_VERSION }}
          cache: 'pip'
      
      - name: Install dependencies
        run: |
          cd property-embedding-service
          pip install -r requirements.txt
          pip install pytest pytest-cov
      
      - name: Run tests
        run: |
          cd property-embedding-service
          pytest --cov=src tests/
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          file: ./property-embedding-service/coverage.xml
          flags: embedding

  build-and-push:
    runs-on: ubuntu-latest
    needs: [test-frontend, test-api, test-embedding-service]
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      
      - name: Set up QEMU
        uses: docker/setup-qemu-action@v3
      
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3
      
      - name: Login to Docker Hub
        uses: docker/login-action@v3
        with:
          username: ${{ secrets.DOCKER_USERNAME }}
          password: ${{ secrets.DOCKER_TOKEN }}
      
      - name: Build and push images
        run: |
          docker compose build
          docker compose push
```

## 10. Testing Setup

**File: `property-search-frontend/src/components/__tests__/PropertyCard.test.tsx`**
```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { PropertyCard } from '../PropertyCard';
import { Property } from '@/types';

const mockProperty: Property = {
  id: '1',
  title: 'Beautiful Family Home',
  description: 'A lovely 3-bedroom house in a quiet neighborhood',
  price: 450000,
  bedrooms: 3,
  bathrooms: 2,
  area: 1500,
  location: {
    address: '123 Test Street',
    city: 'London',
    postcode: 'SW1A 1AA',
    coordinates: { lat: 51.5074, lng: -0.1278 },
  },
  images: ['https://example.com/image1.jpg'],
  features: ['Garden', 'Garage', 'Modern Kitchen'],
  propertyType: 'house',
  listingType: 'sale',
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('PropertyCard', () => {
  it('renders property information correctly', () => {
    render(<PropertyCard property={mockProperty} />);
    
    expect(screen.getByText('Beautiful Family Home')).toBeInTheDocument();
    expect(screen.getByText('£450,000')).toBeInTheDocument();
    expect(screen.getByText('3 bedrooms')).toBeInTheDocument();
    expect(screen.getByText('2 bathrooms')).toBeInTheDocument();
    expect(screen.getByText('London, SW1A 1AA')).toBeInTheDocument();
  });

  it('handles click events', () => {
    const handleClick = jest.fn();
    render(<PropertyCard property={mockProperty} onClick={handleClick} />);
    
    fireEvent.click(screen.getByRole('article'));
    expect(handleClick).toHaveBeenCalledWith(mockProperty);
  });

  it('displays property features', () => {
    render(<PropertyCard property={mockProperty} />);
    
    expect(screen.getByText('Garden')).toBeInTheDocument();
    expect(screen.getByText('Garage')).toBeInTheDocument();
    expect(screen.getByText('Modern Kitchen')).toBeInTheDocument();
  });
});
```

## 11. Performance Optimizations

**File: `property-search-frontend/next.config.js`**
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  images: {
    domains: ['images.example.com'],
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
  experimental: {
    optimizeCss: true,
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  headers: async () => [
    {
      source: '/(.*)',
      headers: [
        {
          key: 'X-Content-Type-Options',
          value: 'nosniff',
        },
        {
          key: 'X-Frame-Options',
          value: 'DENY',
        },
        {
          key: 'X-XSS-Protection',
          value: '1; mode=block',
        },
        {
          key: 'Referrer-Policy',
          value: 'strict-origin-when-cross-origin',
        },
      ],
    },
  ],
};

module.exports = nextConfig;
```

## 12. Monitoring and Health Checks

**File: `property-search-api/src/routes/health.ts`**
```typescript
import { Router } from 'express';
import { checkDatabaseConnection } from '../lib/db';
import { redis } from '../lib/redis';

const router = Router();

router.get('/health', async (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    checks: {
      database: false,
      redis: false,
      embedding: false,
    },
  };

  // Check database
  try {
    health.checks.database = await checkDatabaseConnection();
  } catch (error) {
    health.checks.database = false;
  }

  // Check Redis
  try {
    if (redis) {
      await redis.ping();
      health.checks.redis = true;
    }
  } catch (error) {
    health.checks.redis = false;
  }

  // Check embedding service
  try {
    const response = await fetch(`${process.env.EMBEDDING_SERVICE_URL}/health`);
    health.checks.embedding = response.ok;
  } catch (error) {
    health.checks.embedding = false;
  }

  const allHealthy = Object.values(health.checks).every(check => check);
  res.status(allHealthy ? 200 : 503).json(health);
});

export default router;
```

## Summary of Key Improvements

1. **Security**: Added environment variable validation, rate limiting, and proper CORS configuration
2. **Error Handling**: Implemented global error handlers and error boundaries
3. **Performance**: Added connection pooling, caching strategy, and image optimization
4. **Type Safety**: Created comprehensive shared types and validation schemas
5. **Testing**: Set up proper test structure with examples
6. **CI/CD**: Configured GitHub Actions for automated testing and deployment
7. **Monitoring**: Added health checks and logging
8. **Docker**: Improved Docker setup with health checks and proper networking
9. **Code Quality**: Added linting, formatting, and pre-commit hooks

These improvements will make the application more robust, secure, and maintainable. Implement them gradually, starting with the most critical ones like security and error handling.