# Critical Issues to Address in Moov-Sonnet4

## 🚨 **High Priority Issues (Must Fix)**

### 1. **Missing API Rate Limiting & Security** ⚠️
**Issue**: No rate limiting on property search endpoints
**Risk**: API abuse, DoS attacks, high costs
**Location**: `property-search-api/src/routes/`

```typescript
// MISSING: Rate limiting middleware
// Current vulnerable endpoint:
app.get('/api/properties/search', async (req, res) => {
  // No rate limiting - can be abused!
  const results = await searchProperties(req.query);
  res.json(results);
});

// FIX: Add rate limiting
import rateLimit from 'express-rate-limit';

const searchRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many search requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

app.get('/api/properties/search', searchRateLimit, async (req, res) => {
  // Now protected!
});
```

### 2. **Input Validation Missing** ⚠️
**Issue**: No validation on search parameters
**Risk**: SQL injection, data corruption
**Location**: All API endpoints

```typescript
// CURRENT VULNERABLE CODE:
app.get('/api/properties/search', (req, res) => {
  const { query, price_min, price_max } = req.query;
  // Direct use without validation!
  const sql = `SELECT * FROM properties WHERE price >= ${price_min}`;
});

// FIX: Add validation with Zod
import { z } from 'zod';

const SearchParamsSchema = z.object({
  query: z.string().min(1).max(100),
  price_min: z.coerce.number().min(0).optional(),
  price_max: z.coerce.number().max(10000000).optional(),
  page: z.coerce.number().min(1).max(100).default(1),
  limit: z.coerce.number().min(1).max(50).default(20)
});

app.get('/api/properties/search', (req, res) => {
  try {
    const params = SearchParamsSchema.parse(req.query);
    // Now safe to use params
  } catch (error) {
    return res.status(400).json({ error: 'Invalid parameters' });
  }
});
```

### 3. **Error Handling Gaps** ⚠️
**Issue**: Inconsistent error responses, no error boundaries
**Risk**: Poor UX, debugging difficulties

```typescript
// MISSING: Global error handler
// property-search-api/src/middleware/errorHandler.ts
import { Request, Response, NextFunction } from 'express';

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

export const globalErrorHandler = (
  err: AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { statusCode = 500, message } = err;
  
  // Log error details
  console.error('API Error:', {
    error: message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    timestamp: new Date().toISOString()
  });

  // Don't leak error details in production
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  res.status(statusCode).json({
    success: false,
    error: {
      message: isDevelopment ? message : 'Internal server error',
      ...(isDevelopment && { stack: err.stack })
    },
    timestamp: new Date().toISOString(),
    path: req.url
  });
};

// Usage in app.ts
app.use(globalErrorHandler);
```

### 4. **Frontend Error Boundaries Missing** ⚠️
**Issue**: React errors crash entire property search
**Location**: `property-search-frontend/src/components/`

```typescript
// MISSING: Error boundary for property search
// property-search-frontend/src/components/PropertySearchErrorBoundary.tsx
import React, { Component, ReactNode } from 'react';

interface State {
  hasError: boolean;
  error?: Error;
}

export class PropertySearchErrorBoundary extends Component<
  { children: ReactNode },
  State
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    // Log to your error tracking service
    console.error('Property search error:', error, errorInfo);
    
    // Track error in analytics
    this.trackError(error, errorInfo);
  }

  trackError(error: Error, errorInfo: any) {
    // Send to your analytics/error tracking
    fetch('/api/errors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: error.message,
        stack: error.stack,
        component: errorInfo.componentStack,
        timestamp: new Date().toISOString()
      })
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <h2>Something went wrong with the property search</h2>
          <button onClick={() => this.setState({ hasError: false })}>
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
```

## 🔍 **Medium Priority Issues**

### 5. **Environment Variables Security**
**Issue**: Sensitive data in .env files
**Risk**: API keys exposed

```typescript
// CURRENT ISSUE: .env files tracked in git?
// Check if these are in .gitignore:
.env
.env.local
.env.production

// ADD: Environment validation
// property-search-api/src/config/env.ts
import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  REDIS_URL: z.string().url().optional(),
  EMBEDDING_SERVICE_URL: z.string().url(),
  FRONTEND_URL: z.string().url(),
  PORT: z.coerce.number().default(3001)
});

export const env = EnvSchema.parse(process.env);
```

### 6. **CORS Configuration Missing**
**Issue**: No CORS policy for production
**Risk**: Browser security issues

```typescript
// MISSING: Proper CORS setup
import cors from 'cors';

const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://your-domain.com'] 
    : ['http://localhost:3000'],
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
```

### 7. **Property Data Validation**
**Issue**: No schema validation for property data
**Risk**: Corrupted property listings

```typescript
// MISSING: Property schema validation
// property-search-types/src/schemas.ts
import { z } from 'zod';

export const PropertySchema = z.object({
  id: z.number(),
  title: z.string().min(5).max(200),
  description: z.string().min(10).max(2000),
  price: z.number().min(1000).max(50000000),
  bedrooms: z.number().min(0).max(20),
  bathrooms: z.number().min(0).max(10),
  property_type: z.enum(['house', 'flat', 'studio', 'commercial']),
  postcode: z.string().regex(/^[A-Z]{1,2}[0-9][A-Z0-9]?\s?[0-9][A-Z]{2}$/i),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  images: z.array(z.string().url()).max(20),
  features: z.array(z.string()).max(50),
  available: z.boolean(),
  created_at: z.date(),
  updated_at: z.date()
});

export type Property = z.infer<typeof PropertySchema>;
```

## 🛡️ **Security Issues**

### 8. **SQL Injection Prevention**
**Issue**: Potential SQL injection if not using parameterized queries

```typescript
// ENSURE: All queries use parameters
// BAD:
const query = `SELECT * FROM properties WHERE title LIKE '%${searchTerm}%'`;

// GOOD:
const query = 'SELECT * FROM properties WHERE title ILIKE $1';
const params = [`%${searchTerm}%`];
```

### 9. **Authentication & Authorization Missing**
**Issue**: No user authentication system
**Risk**: Anyone can access all features

```typescript
// MISSING: JWT authentication middleware
// property-search-api/src/middleware/auth.ts
import jwt from 'jsonwebtoken';

export const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET!, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  });
};
```

## 📊 **Performance Issues**

### 10. **Missing Database Indexes**
**Issue**: No indexes on search columns
**Risk**: Slow property searches

```sql
-- MISSING: Essential indexes for property search
-- Add these to your migration:
CREATE INDEX CONCURRENTLY idx_properties_search_text ON properties USING gin(to_tsvector('english', title || ' ' || description));
CREATE INDEX CONCURRENTLY idx_properties_price ON properties (price);
CREATE INDEX CONCURRENTLY idx_properties_bedrooms ON properties (bedrooms);
CREATE INDEX CONCURRENTLY idx_properties_location ON properties (latitude, longitude);
CREATE INDEX CONCURRENTLY idx_properties_type ON properties (property_type);
CREATE INDEX CONCURRENTLY idx_properties_available ON properties (available) WHERE available = true;
```

### 11. **No Response Compression**
**Issue**: Large JSON responses not compressed
**Risk**: Slow API responses

```typescript
// MISSING: Response compression
import compression from 'compression';
app.use(compression());
```

## 🧪 **Testing Gaps**

### 12. **Integration Tests Missing**
**Issue**: No end-to-end API tests
**Risk**: Breaking changes undetected

```typescript
// MISSING: API integration tests
// property-search-api/src/__tests__/integration/search.test.ts
describe('Property Search API Integration', () => {
  test('should search properties with filters', async () => {
    const response = await request(app)
      .get('/api/properties/search')
      .query({
        query: 'london',
        price_min: 100000,
        price_max: 500000,
        bedrooms: 2
      })
      .expect(200);

    expect(response.body.properties).toBeDefined();
    expect(Array.isArray(response.body.properties)).toBe(true);
  });
});
```

## 🎯 **Recommended Fix Priority:**

### **Week 1 (Critical):**
1. ✅ Advanced connection pooling (DONE!)
2. 🔧 Add rate limiting
3. 🔧 Input validation with Zod
4. 🔧 Global error handler

### **Week 2 (High):**
5. 🔧 Frontend error boundaries
6. 🔧 Environment validation
7. 🔧 CORS configuration
8. 🔧 Database indexes

### **Week 3 (Medium):**
9. 🔧 Authentication system
10. 🔧 Property data validation
11. 🔧 Integration tests
12. 🔧 Security audit

**Your connection pooling implementation was excellent - it addresses the most complex infrastructure issue. These remaining fixes are more straightforward but equally important for production readiness.**