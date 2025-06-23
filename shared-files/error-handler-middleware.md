# Error Handler Middleware - Complete TDD Implementation

## Step 1: RED - Write Failing Tests First

Create the test file:

```bash
cd property-search-api
touch src/middleware/error-handler.test.ts
```

### Test File Content

```typescript
// src/middleware/error-handler.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { errorHandler } from './error-handler';
import { AppError, ValidationError } from '../lib/errors';

// Test helpers - create mock Express objects
const createMockRequest = (overrides?: Partial<Request>): Request => {
  return {
    method: 'GET',
    url: '/test',
    headers: {},
    body: {},
    ...overrides,
  } as Request;
};

const createMockResponse = (): Response => {
  const res = {} as Response;
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
};

const createMockNext = (): NextFunction => vi.fn();

describe('Error Handler Middleware', () => {
  let req: Request;
  let res: Response;
  let next: NextFunction;

  beforeEach(() => {
    req = createMockRequest();
    res = createMockResponse();
    next = createMockNext();
  });

  it('should handle AppError with correct status and message', () => {
    // Arrange
    const error = new AppError(400, 'Bad request');

    // Act
    errorHandler(error, req, res, next);

    // Assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      status: 'error',
      message: 'Bad request',
    });
  });

  it('should handle ValidationError with details', () => {
    // Arrange
    const details = [{ field: 'email', message: 'Invalid format' }];
    const error = new ValidationError('Validation failed', details);

    // Act
    errorHandler(error, req, res, next);

    // Assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      status: 'error',
      message: 'Validation failed',
      errors: details,
    });
  });

  it('should handle ZodError as validation error', () => {
    // Arrange
    const zodError = new ZodError([
      {
        code: 'invalid_type',
        expected: 'string',
        received: 'number',
        path: ['email'],
        message: 'Expected string, received number',
      },
    ]);

    // Act
    errorHandler(zodError, req, res, next);

    // Assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      status: 'error',
      message: 'Validation error',
      errors: zodError.errors,
    });
  });

  it('should handle unknown errors as 500', () => {
    // Arrange
    const error = new Error('Unknown error');

    // Act
    errorHandler(error, req, res, next);

    // Assert
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      status: 'error',
      message: 'Internal server error',
    });
  });

  it('should include stack trace in development mode', () => {
    // Arrange
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    const error = new Error('Test error');
    error.stack = 'Error: Test error\n    at TestFile.js:10:15';

    // Act
    errorHandler(error, req, res, next);

    // Assert
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        stack: error.stack,
      })
    );

    // Cleanup
    process.env.NODE_ENV = originalEnv;
  });

  it('should not include stack trace in production mode', () => {
    // Arrange
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    const error = new Error('Test error');

    // Act
    errorHandler(error, req, res, next);

    // Assert
    const response = (res.json as any).mock.calls[0][0];
    expect(response).not.toHaveProperty('stack');

    // Cleanup
    process.env.NODE_ENV = originalEnv;
  });

  it('should handle non-operational errors differently', () => {
    // Arrange
    const error = new AppError(500, 'Database connection lost', false);

    // Act
    errorHandler(error, req, res, next);

    // Assert
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      status: 'error',
      message: 'Database connection lost',
    });
  });
});
```

Run the tests - they MUST fail:

```bash
npm test src/middleware/error-handler.test.ts

# Error: Cannot find module './error-handler'
# GOOD! We have failing tests.
```

## Step 2: GREEN - Write Minimal Code to Pass

Create the implementation file:

```bash
touch src/middleware/error-handler.ts
```

### Minimal Implementation

```typescript
// src/middleware/error-handler.ts
import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError, ValidationError, isAppError } from '../lib/errors';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  let statusCode = 500;
  let message = 'Internal server error';
  let errors: any = undefined;

  if (isAppError(err)) {
    statusCode = err.statusCode;
    message = err.message;
    if (err instanceof ValidationError) {
      errors = err.details;
    }
  } else if (err instanceof ZodError) {
    statusCode = 400;
    message = 'Validation error';
    errors = err.errors;
  }

  const response: any = {
    status: 'error',
    message,
  };

  if (errors) {
    response.errors = errors;
  }

  if (process.env.NODE_ENV === 'development') {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
};
```

Run tests - they should pass:

```bash
npm test src/middleware/error-handler.test.ts
# ✓ All tests pass
```

Commit the working version:

```bash
git add src/middleware/error-handler.test.ts src/middleware/error-handler.ts
git commit -m "feat: add error handler middleware"
```

## Step 3: REFACTOR - Improve Structure

### Refactored Implementation

```typescript
// src/middleware/error-handler.ts
import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError, ValidationError, isAppError } from '../lib/errors';

interface ErrorResponse {
  status: 'error';
  message: string;
  errors?: unknown;
  stack?: string;
}

const DEFAULT_ERROR_MESSAGE = 'Internal server error';
const VALIDATION_ERROR_MESSAGE = 'Validation error';

const handleAppError = (error: AppError): Pick<ErrorResponse, 'message' | 'errors'> => {
  const response: Pick<ErrorResponse, 'message' | 'errors'> = {
    message: error.message,
  };

  if (error instanceof ValidationError) {
    response.errors = error.details;
  }

  return response;
};

const handleZodError = (error: ZodError): Pick<ErrorResponse, 'message' | 'errors'> => {
  return {
    message: VALIDATION_ERROR_MESSAGE,
    errors: error.errors,
  };
};

const getStatusCode = (error: Error): number => {
  if (isAppError(error)) {
    return error.statusCode;
  }
  if (error instanceof ZodError) {
    return 400;
  }
  return 500;
};

const buildErrorResponse = (error: Error): ErrorResponse => {
  const response: ErrorResponse = {
    status: 'error',
    message: DEFAULT_ERROR_MESSAGE,
  };

  if (isAppError(error)) {
    Object.assign(response, handleAppError(error));
  } else if (error instanceof ZodError) {
    Object.assign(response, handleZodError(error));
  }

  if (process.env.NODE_ENV === 'development' && error.stack) {
    response.stack = error.stack;
  }

  return response;
};

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const statusCode = getStatusCode(err);
  const response = buildErrorResponse(err);
  
  res.status(statusCode).json(response);
};
```

Run tests again:

```bash
npm test src/middleware/error-handler.test.ts
# ✓ All tests still pass
```

Commit the refactoring:

```bash
git add src/middleware/error-handler.ts
git commit -m "refactor: improve error handler structure with helper functions"
```

# Rate Limiting - Complete TDD Implementation

## Step 1: RED - Write Failing Tests

Create the test file:

```bash
touch src/middleware/rate-limit.test.ts
```

### Test File Content

```typescript
// src/middleware/rate-limit.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { createRateLimiter, RateLimiterOptions } from './rate-limit';

const createMockRequest = (ip: string = '127.0.0.1'): Request => {
  return {
    ip,
    method: 'GET',
    url: '/test',
  } as Request;
};

const createMockResponse = (): Response => {
  const res = {} as Response;
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.setHeader = vi.fn().mockReturnValue(res);
  
  // Mock event emitter functionality
  const listeners: { [key: string]: Function[] } = {};
  res.on = vi.fn((event: string, callback: Function) => {
    if (!listeners[event]) listeners[event] = [];
    listeners[event].push(callback);
    return res;
  }) as any;
  
  res.emit = vi.fn((event: string) => {
    if (listeners[event]) {
      listeners[event].forEach(cb => cb());
    }
    return true;
  }) as any;
  
  return res;
};

describe('Rate Limiter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should allow requests within limit', async () => {
    // Arrange
    const options: RateLimiterOptions = {
      windowMs: 60000, // 1 minute
      maxRequests: 3,
      keyGenerator: (req) => req.ip || 'unknown',
    };
    const limiter = createRateLimiter(options);
    const req = createMockRequest();
    const res = createMockResponse();
    const next = vi.fn();

    // Act - Make 3 requests (within limit)
    for (let i = 0; i < 3; i++) {
      await limiter(req, res, next);
    }

    // Assert
    expect(next).toHaveBeenCalledTimes(3);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should block requests exceeding limit', async () => {
    // Arrange
    const options: RateLimiterOptions = {
      windowMs: 60000,
      maxRequests: 2,
      keyGenerator: (req) => req.ip || 'unknown',
    };
    const limiter = createRateLimiter(options);
    const req = createMockRequest();
    const res = createMockResponse();
    const next = vi.fn();

    // Act - Make 3 requests (exceeds limit)
    await limiter(req, res, next);
    await limiter(req, res, next);
    await limiter(req, res, next);

    // Assert
    expect(next).toHaveBeenCalledTimes(2);
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith({
      status: 'error',
      message: 'Too many requests, please try again later.',
    });
  });

  it('should track different IPs separately', async () => {
    // Arrange
    const options: RateLimiterOptions = {
      windowMs: 60000,
      maxRequests: 1,
      keyGenerator: (req) => req.ip || 'unknown',
    };
    const limiter = createRateLimiter(options);
    const req1 = createMockRequest('192.168.1.1');
    const req2 = createMockRequest('192.168.1.2');
    const res = createMockResponse();
    const next = vi.fn();

    // Act
    await limiter(req1, res, next);
    await limiter(req2, res, next);

    // Assert - Both requests should pass
    expect(next).toHaveBeenCalledTimes(2);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should reset after time window', async () => {
    // Arrange
    const windowMs = 60000; // 1 minute
    const options: RateLimiterOptions = {
      windowMs,
      maxRequests: 1,
      keyGenerator: (req) => req.ip || 'unknown',
    };
    const limiter = createRateLimiter(options);
    const req = createMockRequest();
    const res = createMockResponse();
    const next = vi.fn();

    // Act
    await limiter(req, res, next);
    
    // Advance time past the window
    vi.advanceTimersByTime(windowMs + 1000);
    
    // Make another request
    await limiter(req, res, next);

    // Assert - Both requests should pass
    expect(next).toHaveBeenCalledTimes(2);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should set rate limit headers when configured', async () => {
    // Arrange
    const options: RateLimiterOptions = {
      windowMs: 60000,
      maxRequests: 10,
      keyGenerator: (req) => req.ip || 'unknown',
      includeHeaders: true,
    };
    const limiter = createRateLimiter(options);
    const req = createMockRequest();
    const res = createMockResponse();
    const next = vi.fn();

    // Act
    await limiter(req, res, next);

    // Assert
    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', '10');
    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', '9');
    expect(res.setHeader).toHaveBeenCalledWith(
      'X-RateLimit-Reset',
      expect.any(String)
    );
  });

  it('should use custom error message', async () => {
    // Arrange
    const customMessage = 'Custom rate limit message';
    const options: RateLimiterOptions = {
      windowMs: 60000,
      maxRequests: 1,
      keyGenerator: (req) => req.ip || 'unknown',
      message: customMessage,
    };
    const limiter = createRateLimiter(options);
    const req = createMockRequest();
    const res = createMockResponse();
    const next = vi.fn();

    // Act - Exceed limit
    await limiter(req, res, next);
    await limiter(req, res, next);

    // Assert
    expect(res.json).toHaveBeenCalledWith({
      status: 'error',
      message: customMessage,
    });
  });
});
```

Run the tests:

```bash
npm test src/middleware/rate-limit.test.ts
# Error: Cannot find module './rate-limit'
# GOOD!
```

## Step 2: GREEN - Minimal Implementation

Create the implementation:

```bash
touch src/middleware/rate-limit.ts
```

### Minimal Implementation

```typescript
// src/middleware/rate-limit.ts
import { Request, Response, NextFunction } from 'express';

export interface RateLimiterOptions {
  windowMs: number;
  maxRequests: number;
  keyGenerator: (req: Request) => string;
  message?: string;
  includeHeaders?: boolean;
  skipSuccessfulRequests?: boolean;
}

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

export const createRateLimiter = (options: RateLimiterOptions) => {
  const store: RateLimitStore = {};
  const {
    windowMs,
    maxRequests,
    keyGenerator,
    message = 'Too many requests, please try again later.',
    includeHeaders = false,
  } = options;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const key = keyGenerator(req);
    const now = Date.now();
    const resetTime = now + windowMs;

    if (!store[key] || store[key].resetTime < now) {
      store[key] = { count: 0, resetTime };
    }

    const entry = store[key];
    entry.count++;

    if (includeHeaders) {
      res.setHeader('X-RateLimit-Limit', maxRequests.toString());
      res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - entry.count).toString());
      res.setHeader('X-RateLimit-Reset', new Date(entry.resetTime).toISOString());
    }

    if (entry.count > maxRequests) {
      res.status(429).json({
        status: 'error',
        message,
      });
      return;
    }

    next();
  };
};
```

Run tests:

```bash
npm test src/middleware/rate-limit.test.ts
# ✓ All tests pass
```

Commit:

```bash
git add src/middleware/rate-limit.test.ts src/middleware/rate-limit.ts
git commit -m "feat: add rate limiting middleware"
```

## Step 3: REFACTOR - Improve Structure

### Refactored Implementation

```typescript
// src/middleware/rate-limit.ts
import { Request, Response, NextFunction } from 'express';

export interface RateLimiterOptions {
  windowMs: number;
  maxRequests: number;
  keyGenerator: (req: Request) => string;
  message?: string;
  includeHeaders?: boolean;
  skipSuccessfulRequests?: boolean;
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// Memory store for rate limit data
class MemoryStore {
  private store = new Map<string, RateLimitEntry>();
  private cleanupInterval: NodeJS.Timeout;

  constructor(windowMs: number) {
    // Periodically clean up expired entries
    this.cleanupInterval = setInterval(() => this.cleanup(), windowMs);
  }

  get(key: string): RateLimitEntry | undefined {
    return this.store.get(key);
  }

  set(key: string, entry: RateLimitEntry): void {
    this.store.set(key, entry);
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (entry.resetTime < now) {
        this.store.delete(key);
      }
    }
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.store.clear();
  }
}

// Constants
const DEFAULT_MESSAGE = 'Too many requests, please try again later.';
const DEFAULT_AUTH_MESSAGE = 'Too many authentication attempts, please try again later.';
const FIFTEEN_MINUTES = 15 * 60 * 1000;

// Helper functions
const setRateLimitHeaders = (
  res: Response,
  maxRequests: number,
  entry: RateLimitEntry
): void => {
  res.setHeader('X-RateLimit-Limit', maxRequests.toString());
  res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - entry.count).toString());
  res.setHeader('X-RateLimit-Reset', new Date(entry.resetTime).toISOString());
};

const isRequestLimitExceeded = (entry: RateLimitEntry, maxRequests: number): boolean => {
  return entry.count > maxRequests;
};

// Main factory function
export const createRateLimiter = (options: RateLimiterOptions) => {
  const {
    windowMs,
    maxRequests,
    keyGenerator,
    message = DEFAULT_MESSAGE,
    includeHeaders = false,
    skipSuccessfulRequests = false,
  } = options;

  const store = new MemoryStore(windowMs);

  const middleware = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const key = keyGenerator(req);
    const now = Date.now();

    let entry = store.get(key);
    if (!entry || entry.resetTime < now) {
      entry = { count: 0, resetTime: now + windowMs };
    }

    entry.count++;
    store.set(key, entry);

    if (includeHeaders) {
      setRateLimitHeaders(res, maxRequests, entry);
    }

    if (isRequestLimitExceeded(entry, maxRequests)) {
      res.status(429).json({
        status: 'error',
        message,
      });
      return;
    }

    if (skipSuccessfulRequests) {
      res.on('finish', () => {
        const statusCode = res.statusCode;
        if (statusCode && statusCode < 400) {
          entry.count--;
        }
      });
    }

    next();
  };

  // Allow cleanup for testing
  middleware.destroy = () => store.destroy();

  return middleware;
};

// Pre-configured rate limiters
export const apiLimiter = createRateLimiter({
  windowMs: FIFTEEN_MINUTES,
  maxRequests: 100,
  keyGenerator: (req) => req.ip || 'unknown',
  includeHeaders: true,
});

export const authLimiter = createRateLimiter({
  windowMs: FIFTEEN_MINUTES,
  maxRequests: 5,
  keyGenerator: (req) => req.ip || 'unknown',
  message: DEFAULT_AUTH_MESSAGE,
  skipSuccessfulRequests: true,
});
```

Run tests again:

```bash
npm test src/middleware/rate-limit.test.ts
# ✓ All tests still pass
```

Commit the refactoring:

```bash
git add src/middleware/rate-limit.ts
git commit -m "refactor: improve rate limiter with memory store and better structure"
```

# Integration: Wire Everything Together

Now let's create the main app file that uses our TDD-built components:

## Test First!

```typescript
// src/app.test.ts
import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { createApp } from './app';

describe('Express App', () => {
  it('should handle errors with custom error handler', async () => {
    // Arrange
    const app = createApp();

    // Act
    const response = await request(app)
      .get('/api/test-error')
      .expect(404);

    // Assert
    expect(response.body).toEqual({
      status: 'error',
      message: 'Not Found',
    });
  });

  it('should apply rate limiting', async () => {
    // Arrange
    const app = createApp();

    // Act - Make requests up to limit
    for (let i = 0; i < 100; i++) {
      await request(app).get('/api/health').expect(200);
    }

    // Make one more request - should be rate limited
    const response = await request(app)
      .get('/api/health')
      .expect(429);

    // Assert
    expect(response.body.message).toContain('Too many requests');
  });
});
```

## Implementation

```typescript
// src/app.ts
import express, { Express } from 'express';
import { errorHandler } from './middleware/error-handler';
import { apiLimiter } from './middleware/rate-limit';
import { NotFoundError } from './lib/errors';

export const createApp = (): Express => {
  const app = express();

  // Middleware
  app.use(express.json());
  app.use('/api', apiLimiter);

  // Routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // 404 handler
  app.use((req, res, next) => {
    next(new NotFoundError('Not Found'));
  });

  // Error handler (must be last)
  app.use(errorHandler);

  return app;
};
```

# What's Next?

We've now implemented:
1. ✅ Environment Configuration with Zod validation
2. ✅ Custom Error Classes
3. ✅ Error Handler Middleware
4. ✅ Rate Limiting

Next features to implement (following the same TDD process):
1. **SearchBar React Component** - Test user interactions
2. **Semantic Search Service** - Test failover logic
3. **Database Integration** - Test with pgvector
4. **Homepage Components** - Test animations and interactions

Remember: **ALWAYS start with a failing test!** No exceptions.

Would you like me to continue with the SearchBar component implementation or focus on a different feature?