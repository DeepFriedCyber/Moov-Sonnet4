// ===== TEST SUITE 1: Basic Error Handling (5 tests) =====
// property-search-api/src/__tests__/middleware/errorHandler.test.ts
import request from 'supertest';
import express from 'express';
import { globalErrorHandler } from '../../middleware/errorHandler';
import { AppError, ValidationError, DatabaseError } from '../../errors/AppError';
import { ErrorLogger } from '../../services/ErrorLogger';

jest.mock('../../services/ErrorLogger');

describe('Global Error Handler', () => {
  let app: express.Application;
  let mockLogger: jest.Mocked<ErrorLogger>;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    
    mockLogger = new ErrorLogger() as jest.Mocked<ErrorLogger>;
    (ErrorLogger as jest.MockedClass<typeof ErrorLogger>).mockImplementation(() => mockLogger);

    // Test routes that throw different types of errors
    app.get('/test/app-error', () => {
      throw new AppError('Test application error', 400);
    });

    app.get('/test/validation-error', () => {
      throw new ValidationError('Test validation error', ['field1: invalid', 'field2: required']);
    });

    app.get('/test/database-error', () => {
      throw new DatabaseError('Connection failed', 'connection_timeout');
    });

    app.get('/test/generic-error', () => {
      throw new Error('Generic error message');
    });

    app.get('/test/async-error', async () => {
      throw new AppError('Async error', 500);
    });

    // Apply global error handler
    app.use(globalErrorHandler);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('should handle AppError with correct status code and message', async () => {
    const response = await request(app)
      .get('/test/app-error')
      .expect(400);

    expect(response.body).toMatchObject({
      success: false,
      error: {
        message: 'Test application error',
        type: 'AppError',
        statusCode: 400
      },
      timestamp: expect.any(String),
      path: '/test/app-error'
    });

    expect(mockLogger.logError).toHaveBeenCalledWith(
      expect.any(AppError),
      expect.objectContaining({
        method: 'GET',
        url: '/test/app-error',
        ip: expect.any(String)
      })
    );
  });

  test('should handle ValidationError with detailed field errors', async () => {
    const response = await request(app)
      .get('/test/validation-error')
      .expect(400);

    expect(response.body).toMatchObject({
      success: false,
      error: {
        message: 'Test validation error',
        type: 'ValidationError',
        statusCode: 400,
        details: ['field1: invalid', 'field2: required']
      },
      timestamp: expect.any(String)
    });
  });

  test('should handle DatabaseError with appropriate response', async () => {
    const response = await request(app)
      .get('/test/database-error')
      .expect(503);

    expect(response.body).toMatchObject({
      success: false,
      error: {
        message: 'Database service temporarily unavailable',
        type: 'DatabaseError',
        statusCode: 503
      }
    });

    // Should not expose internal database details
    expect(response.body.error.message).not.toContain('Connection failed');
  });

  test('should handle generic errors securely in production', async () => {
    // Mock production environment
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    const response = await request(app)
      .get('/test/generic-error')
      .expect(500);

    expect(response.body).toMatchObject({
      success: false,
      error: {
        message: 'Internal server error',
        type: 'InternalError',
        statusCode: 500
      }
    });

    // Should not expose internal error details in production
    expect(response.body.error.message).not.toContain('Generic error message');

    process.env.NODE_ENV = originalEnv;
  });

  test('should include debug information in development', async () => {
    // Mock development environment
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    const response = await request(app)
      .get('/test/generic-error')
      .expect(500);

    expect(response.body).toMatchObject({
      success: false,
      error: {
        message: 'Generic error message',
        stack: expect.any(String)
      }
    });

    process.env.NODE_ENV = originalEnv;
  });
});

// ===== TEST SUITE 2: Property-Specific Error Handling (4 tests) =====
// property-search-api/src/__tests__/middleware/propertyErrorHandler.test.ts
import { PropertySearchError, PropertyNotFoundError } from '../../errors/PropertyErrors';

describe('Property-Specific Error Handling', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    
    app.get('/test/search-error', () => {
      throw new PropertySearchError('Search service unavailable', 'meilisearch_down');
    });

    app.get('/test/property-not-found', () => {
      throw new PropertyNotFoundError('12345');
    });

    app.get('/test/semantic-search-error', () => {
      throw new PropertySearchError('Vector similarity search failed', 'embedding_service_error');
    });

    app.get('/test/database-connection-error', () => {
      throw new DatabaseError('Pool exhausted', 'connection_pool_exhausted');
    });

    app.use(globalErrorHandler);
  });

  test('should handle property search errors with fallback suggestions', async () => {
    const response = await request(app)
      .get('/test/search-error')
      .expect(503);

    expect(response.body).toMatchObject({
      success: false,
      error: {
        message: 'Property search temporarily unavailable',
        type: 'PropertySearchError',
        statusCode: 503,
        suggestions: [
          'Try again in a few moments',
          'Use fewer search filters',
          'Contact support if the issue persists'
        ]
      }
    });
  });

  test('should handle property not found with helpful response', async () => {
    const response = await request(app)
      .get('/test/property-not-found')
      .expect(404);

    expect(response.body).toMatchObject({
      success: false,
      error: {
        message: 'Property not found',
        type: 'PropertyNotFoundError',
        statusCode: 404,
        propertyId: '12345',
        suggestions: [
          'Check the property ID is correct',
          'The property may have been sold or removed',
          'Browse similar properties in the area'
        ]
      }
    });
  });

  test('should handle semantic search errors with graceful degradation', async () => {
    const response = await request(app)
      .get('/test/semantic-search-error')
      .expect(503);

    expect(response.body).toMatchObject({
      success: false,
      error: {
        message: 'Advanced search temporarily unavailable',
        fallback: 'basic_text_search',
        suggestions: ['Try a basic text search instead']
      }
    });
  });

  test('should handle database connection errors with retry information', async () => {
    const response = await request(app)
      .get('/test/database-connection-error')
      .expect(503);

    expect(response.body).toMatchObject({
      success: false,
      error: {
        message: 'Database service temporarily unavailable',
        retryAfter: expect.any(Number),
        suggestions: [
          'Please try again in a few moments',
          'Check your internet connection'
        ]
      }
    });
  });
});

// ===== TEST SUITE 3: Error Logging and Monitoring (3 tests) =====
// property-search-api/src/__tests__/services/errorLogger.test.ts
import { ErrorLogger } from '../../services/ErrorLogger';
import { ErrorAnalytics } from '../../services/ErrorAnalytics';
import { AlertingService } from '../../services/AlertingService';

jest.mock('../../services/ErrorAnalytics');
jest.mock('../../services/AlertingService');

describe('Error Logging and Monitoring', () => {
  let errorLogger: ErrorLogger;
  let mockAnalytics: jest.Mocked<ErrorAnalytics>;
  let mockAlerting: jest.Mocked<AlertingService>;

  beforeEach(() => {
    mockAnalytics = new ErrorAnalytics() as jest.Mocked<ErrorAnalytics>;
    mockAlerting = new AlertingService() as jest.Mocked<AlertingService>;
    
    errorLogger = new ErrorLogger({
      analytics: mockAnalytics,
      alerting: mockAlerting
    });
  });

  test('should log error with contextual information', async () => {
    const error = new AppError('Test error', 400);
    const context = {
      method: 'GET',
      url: '/api/properties/search',
      ip: '192.168.1.1',
      userAgent: 'Mozilla/5.0...',
      userId: 'user123'
    };

    await errorLogger.logError(error, context);

    expect(mockAnalytics.recordError).toHaveBeenCalledWith({
      error: {
        message: 'Test error',
        type: 'AppError',
        statusCode: 400,
        stack: expect.any(String)
      },
      context,
      timestamp: expect.any(Date),
      severity: 'medium'
    });
  });

  test('should trigger alerts for critical errors', async () => {
    const criticalError = new DatabaseError('Database connection lost', 'connection_lost');
    const context = {
      method: 'POST',
      url: '/api/properties',
      ip: '192.168.1.1'
    };

    await errorLogger.logError(criticalError, context);

    expect(mockAlerting.sendAlert).toHaveBeenCalledWith({
      severity: 'high',
      title: 'Critical Database Error',
      message: 'Database connection lost',
      context,
      timestamp: expect.any(Date)
    });
  });

  test('should aggregate error patterns for analysis', async () => {
    // Simulate multiple similar errors
    const errors = [
      new PropertySearchError('Search timeout', 'timeout'),
      new PropertySearchError('Search timeout', 'timeout'),
      new PropertySearchError('Search timeout', 'timeout')
    ];

    for (const error of errors) {
      await errorLogger.logError(error, { method: 'GET', url: '/api/properties/search' });
    }

    expect(mockAnalytics.detectPattern).toHaveBeenCalledWith({
      errorType: 'PropertySearchError',
      message: 'Search timeout',
      count: 3,
      timeWindow: '5m'
    });
  });
});

// ===== TEST SUITE 4: Security and Information Leakage (3 tests) =====
// property-search-api/src/__tests__/middleware/errorSecurity.test.ts
describe('Error Security and Information Leakage', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    
    app.get('/test/sensitive-error', () => {
      const sensitiveError = new Error('Database connection failed: postgresql://user:password@host:5432/db');
      sensitiveError.stack = 'Error: Database connection failed\n    at /home/user/secret-path/app.js:123:45';
      throw sensitiveError;
    });

    app.get('/test/sql-error', () => {
      const sqlError = new Error('relation "secret_table" does not exist');
      throw sqlError;
    });

    app.get('/test/file-path-error', () => {
      const fileError = new Error('ENOENT: no such file or directory, open \'/etc/passwd\'');
      throw fileError;
    });

    app.use(globalErrorHandler);
  });

  test('should sanitize sensitive information from error messages', async () => {
    process.env.NODE_ENV = 'production';

    const response = await request(app)
      .get('/test/sensitive-error')
      .expect(500);

    expect(response.body.error.message).toBe('Internal server error');
    expect(response.body.error.message).not.toContain('password');
    expect(response.body.error.message).not.toContain('postgresql://');
  });

  test('should not expose database schema information', async () => {
    process.env.NODE_ENV = 'production';

    const response = await request(app)
      .get('/test/sql-error')
      .expect(500);

    expect(response.body.error.message).not.toContain('secret_table');
    expect(response.body.error.message).not.toContain('relation');
    expect(response.body.error.message).toBe('Internal server error');
  });

  test('should not expose file system paths', async () => {
    process.env.NODE_ENV = 'production';

    const response = await request(app)
      .get('/test/file-path-error')
      .expect(500);

    expect(response.body.error.message).not.toContain('/etc/passwd');
    expect(response.body.error.message).not.toContain('ENOENT');
    expect(response.body.error.message).toBe('Internal server error');
  });
});

// ===== IMPLEMENTATION: Custom Error Classes =====
// property-search-api/src/errors/AppError.ts
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly type: string;

  constructor(
    message: string,
    statusCode: number = 500,
    isOperational: boolean = true
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.type = this.constructor.name;

    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      message: this.message,
      type: this.type,
      statusCode: this.statusCode,
      isOperational: this.isOperational
    };
  }
}

export class ValidationError extends AppError {
  public readonly details: string[];

  constructor(message: string, details: string[] = []) {
    super(message, 400);
    this.details = details;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      details: this.details
    };
  }
}

export class DatabaseError extends AppError {
  public readonly code: string;
  public readonly retryAfter?: number;

  constructor(message: string, code: string, retryAfter?: number) {
    super(message, 503);
    this.code = code;
    this.retryAfter = retryAfter;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      code: this.code,
      ...(this.retryAfter && { retryAfter: this.retryAfter })
    };
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication required') {
    super(message, 401);
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Insufficient permissions') {
    super(message, 403);
  }
}

export class RateLimitError extends AppError {
  public readonly retryAfter: number;
  public readonly limit: number;

  constructor(message: string, retryAfter: number, limit: number) {
    super(message, 429);
    this.retryAfter = retryAfter;
    this.limit = limit;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      retryAfter: this.retryAfter,
      limit: this.limit
    };
  }
}

// ===== IMPLEMENTATION: Property-Specific Errors =====
// property-search-api/src/errors/PropertyErrors.ts
import { AppError } from './AppError';

export class PropertySearchError extends AppError {
  public readonly searchType: string;
  public readonly suggestions: string[];
  public readonly fallback?: string;

  constructor(message: string, searchType: string, suggestions: string[] = []) {
    super(message, 503);
    this.searchType = searchType;
    this.suggestions = suggestions.length > 0 ? suggestions : this.getDefaultSuggestions();
    this.fallback = this.getFallbackOption(searchType);
  }

  private getDefaultSuggestions(): string[] {
    return [
      'Try again in a few moments',
      'Use fewer search filters',
      'Contact support if the issue persists'
    ];
  }

  private getFallbackOption(searchType: string): string | undefined {
    const fallbacks: Record<string, string> = {
      'embedding_service_error': 'basic_text_search',
      'meilisearch_down': 'database_search',
      'timeout': 'cached_results'
    };
    return fallbacks[searchType];
  }

  toJSON() {
    return {
      ...super.toJSON(),
      searchType: this.searchType,
      suggestions: this.suggestions,
      ...(this.fallback && { fallback: this.fallback })
    };
  }
}

export class PropertyNotFoundError extends AppError {
  public readonly propertyId: string;
  public readonly suggestions: string[];

  constructor(propertyId: string) {
    super('Property not found', 404);
    this.propertyId = propertyId;
    this.suggestions = [
      'Check the property ID is correct',
      'The property may have been sold or removed',
      'Browse similar properties in the area'
    ];
  }

  toJSON() {
    return {
      ...super.toJSON(),
      propertyId: this.propertyId,
      suggestions: this.suggestions
    };
  }
}

export class PropertyValidationError extends AppError {
  public readonly field: string;
  public readonly value: any;
  public readonly constraint: string;

  constructor(field: string, value: any, constraint: string) {
    super(`Invalid value for ${field}`, 400);
    this.field = field;
    this.value = value;
    this.constraint = constraint;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      field: this.field,
      value: this.value,
      constraint: this.constraint
    };
  }
}

// ===== IMPLEMENTATION: Error Logger Service =====
// property-search-api/src/services/ErrorLogger.ts
import { AppError } from '../errors/AppError';
import { ErrorAnalytics } from './ErrorAnalytics';
import { AlertingService } from './AlertingService';

export interface ErrorContext {
  method?: string;
  url?: string;
  ip?: string;
  userAgent?: string;
  userId?: string;
  correlationId?: string;
  additionalData?: Record<string, any>;
}

export interface ErrorLogEntry {
  error: {
    message: string;
    type: string;
    statusCode?: number;
    stack?: string;
  };
  context: ErrorContext;
  timestamp: Date;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export class ErrorLogger {
  private analytics: ErrorAnalytics;
  private alerting: AlertingService;

  constructor(services?: { analytics?: ErrorAnalytics; alerting?: AlertingService }) {
    this.analytics = services?.analytics || new ErrorAnalytics();
    this.alerting = services?.alerting || new AlertingService();
  }

  async logError(error: Error, context: ErrorContext): Promise<void> {
    const severity = this.determineSeverity(error);
    const sanitizedError = this.sanitizeError(error);

    const logEntry: ErrorLogEntry = {
      error: sanitizedError,
      context: this.sanitizeContext(context),
      timestamp: new Date(),
      severity
    };

    // Log to console with structured format
    this.logToConsole(logEntry);

    // Record in analytics
    await this.analytics.recordError(logEntry);

    // Send alerts for high/critical errors
    if (severity === 'high' || severity === 'critical') {
      await this.sendAlert(logEntry);
    }

    // Detect error patterns
    await this.analytics.detectPattern({
      errorType: error.constructor.name,
      message: error.message,
      count: 1,
      timeWindow: '5m'
    });
  }

  private determineSeverity(error: Error): 'low' | 'medium' | 'high' | 'critical' {
    if (error instanceof AppError) {
      if (error.statusCode >= 500) return 'high';
      if (error.statusCode >= 400) return 'medium';
      return 'low';
    }

    // Database errors are critical
    if (error.message.includes('database') || error.message.includes('connection')) {
      return 'critical';
    }

    // Generic errors are high severity
    return 'high';
  }

  private sanitizeError(error: Error) {
    const isProduction = process.env.NODE_ENV === 'production';
    
    return {
      message: isProduction ? this.sanitizeMessage(error.message) : error.message,
      type: error.constructor.name,
      statusCode: (error as any).statusCode,
      ...(isProduction ? {} : { stack: error.stack })
    };
  }

  private sanitizeMessage(message: string): string {
    // Remove sensitive patterns
    const sensitivePatterns = [
      /postgresql:\/\/[^:]+:[^@]+@[^\/]+\/\w+/gi, // Database URLs
      /password[^=]*=\s*[^\s;]+/gi,              // Passwords
      /token[^=]*=\s*[^\s;]+/gi,                 // Tokens
      /secret[^=]*=\s*[^\s;]+/gi,                // Secrets
      /\/home\/[^\s]+/gi,                        // File paths
      /\/etc\/[^\s]+/gi,                         // System paths
      /relation\s+"[^"]+"/gi,                    // Database schema
      /table\s+"[^"]+"/gi                        // Table names
    ];

    let sanitized = message;
    sensitivePatterns.forEach(pattern => {
      sanitized = sanitized.replace(pattern, '[REDACTED]');
    });

    return sanitized;
  }

  private sanitizeContext(context: ErrorContext): ErrorContext {
    return {
      ...context,
      // Remove sensitive headers/data
      userAgent: context.userAgent?.substring(0, 100), // Truncate user agent
    };
  }

  private logToConsole(logEntry: ErrorLogEntry): void {
    const logLevel = logEntry.severity === 'critical' ? 'error' : 'warn';
    
    console[logLevel]('Application Error:', {
      timestamp: logEntry.timestamp.toISOString(),
      severity: logEntry.severity,
      error: {
        type: logEntry.error.type,
        message: logEntry.error.message,
        statusCode: logEntry.error.statusCode
      },
      context: {
        method: logEntry.context.method,
        url: logEntry.context.url,
        ip: logEntry.context.ip,
        userId: logEntry.context.userId
      }
    });
  }

  private async sendAlert(logEntry: ErrorLogEntry): Promise<void> {
    const alertTitle = this.generateAlertTitle(logEntry);
    
    await this.alerting.sendAlert({
      severity: logEntry.severity,
      title: alertTitle,
      message: logEntry.error.message,
      context: logEntry.context,
      timestamp: logEntry.timestamp
    });
  }

  private generateAlertTitle(logEntry: ErrorLogEntry): string {
    const errorType = logEntry.error.type;
    const severity = logEntry.severity.toUpperCase();
    
    if (errorType.includes('Database')) {
      return `${severity} Database Error`;
    }
    if (errorType.includes('Property')) {
      return `${severity} Property Service Error`;
    }
    if (errorType.includes('Authentication')) {
      return `${severity} Authentication Error`;
    }
    
    return `${severity} Application Error`;
  }
}

// ===== IMPLEMENTATION: Global Error Handler Middleware =====
// property-search-api/src/middleware/errorHandler.ts
import { Request, Response, NextFunction } from 'express';
import { AppError, ValidationError, DatabaseError } from '../errors/AppError';
import { PropertySearchError, PropertyNotFoundError } from '../errors/PropertyErrors';
import { ErrorLogger } from '../services/ErrorLogger';

const errorLogger = new ErrorLogger();

export const globalErrorHandler = async (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  // Extract request context
  const context = {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('User-Agent'),
    userId: (req as any).user?.id,
    correlationId: req.headers['x-correlation-id'] as string,
    additionalData: {
      query: req.query,
      body: req.method === 'POST' ? req.body : undefined
    }
  };

  // Log the error
  await errorLogger.logError(err, context);

  // Determine response based on error type
  if (err instanceof AppError) {
    handleAppError(err, res, req);
  } else {
    handleGenericError(err, res, req);
  }
};

function handleAppError(err: AppError, res: Response, req: Request): void {
  const response = {
    success: false,
    error: {
      message: getPublicErrorMessage(err),
      type: err.type,
      statusCode: err.statusCode,
      ...(err instanceof ValidationError && { details: err.details }),
      ...(err instanceof PropertySearchError && { 
        suggestions: err.suggestions,
        fallback: err.fallback 
      }),
      ...(err instanceof PropertyNotFoundError && { 
        propertyId: err.propertyId,
        suggestions: err.suggestions 
      }),
      ...(err instanceof DatabaseError && { 
        retryAfter: err.retryAfter || 30 
      })
    },
    timestamp: new Date().toISOString(),
    path: req.originalUrl,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  };

  res.status(err.statusCode).json(response);
}

function handleGenericError(err: Error, res: Response, req: Request): void {
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  const response = {
    success: false,
    error: {
      message: isDevelopment ? err.message : 'Internal server error',
      type: 'InternalError',
      statusCode: 500,
      ...(isDevelopment && { stack: err.stack })
    },
    timestamp: new Date().toISOString(),
    path: req.originalUrl
  };

  res.status(500).json(response);
}

function getPublicErrorMessage(err: AppError): string {
  // Override sensitive database error messages
  if (err instanceof DatabaseError) {
    return 'Database service temporarily unavailable';
  }
  
  // Override sensitive property search messages
  if (err instanceof PropertySearchError) {
    const publicMessages: Record<string, string> = {
      'meilisearch_down': 'Property search temporarily unavailable',
      'embedding_service_error': 'Advanced search temporarily unavailable',
      'timeout': 'Search request timed out'
    };
    return publicMessages[err.searchType] || 'Property search temporarily unavailable';
  }

  return err.message;
}

// Handle async errors
export const asyncErrorWrapper = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// ===== IMPLEMENTATION: Error Analytics Service =====
// property-search-api/src/services/ErrorAnalytics.ts
export interface ErrorPattern {
  errorType: string;
  message: string;
  count: number;
  timeWindow: string;
}

export class ErrorAnalytics {
  private errorCounts = new Map<string, number>();
  private patternThresholds = {
    '1m': 5,   // 5 errors in 1 minute
    '5m': 10,  // 10 errors in 5 minutes
    '1h': 50   // 50 errors in 1 hour
  };

  async recordError(logEntry: any): Promise<void> {
    const key = `${logEntry.error.type}:${logEntry.error.message}`;
    const count = (this.errorCounts.get(key) || 0) + 1;
    this.errorCounts.set(key, count);

    // Store in persistent storage (Redis/Database)
    // Implementation depends on your storage choice
  }

  async detectPattern(pattern: ErrorPattern): Promise<void> {
    const threshold = this.patternThresholds[pattern.timeWindow as keyof typeof this.patternThresholds];
    
    if (pattern.count >= threshold) {
      console.warn('Error pattern detected:', {
        pattern,
        threshold,
        recommendation: this.getRecommendation(pattern)
      });
      
      // Trigger automated response if needed
      await this.handleErrorPattern(pattern);
    }
  }

  private getRecommendation(pattern: ErrorPattern): string {
    if (pattern.errorType.includes('Database')) {
      return 'Consider scaling database connections or checking database health';
    }
    if (pattern.errorType.includes('Search')) {
      return 'Check search service health and consider enabling fallback search';
    }
    return 'Investigate error cause and consider implementing circuit breaker';
  }

  private async handleErrorPattern(pattern: ErrorPattern): Promise<void> {
    // Implement automated responses like:
    // - Enable circuit breaker
    // - Scale services
    // - Switch to fallback systems
    // - Send alerts to operations team
  }
}

// ===== IMPLEMENTATION: Alerting Service =====
// property-search-api/src/services/AlertingService.ts
export interface Alert {
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  context: any;
  timestamp: Date;
}

export class AlertingService {
  async sendAlert(alert: Alert): Promise<void> {
    // Implement based on your alerting system:
    // - Slack webhook
    // - PagerDuty
    // - Email
    // - SMS
    
    console.log('ALERT:', {
      severity: alert.severity.toUpperCase(),
      title: alert.title,
      message: alert.message,
      timestamp: alert.timestamp.toISOString()
    });

    // Example Slack webhook implementation:
    if (process.env.SLACK_WEBHOOK_URL) {
      await this.sendSlackAlert(alert);
    }
  }

  private async sendSlackAlert(alert: Alert): Promise<void> {
    const color = this.getSeverityColor(alert.severity);
    const payload = {
      attachments: [{
        color,
        title: alert.title,
        text: alert.message,
        fields: [
          {
            title: 'Severity',
            value: alert.severity.toUpperCase(),
            short: true
          },
          {
            title: 'Timestamp',
            value: alert.timestamp.toISOString(),
            short: true
          }
        ]
      }]
    };

    // Send to Slack webhook
    // Implementation depends on your HTTP client
  }

  private getSeverityColor(severity: string): string {
    const colors: Record<string, string> = {
      'low': '#36a64f',      // Green
      'medium': '#ff9500',   // Orange
      'high': '#ff2d00',     // Red
      'critical': '#8b0000'  // Dark red
    };
    return colors[severity] || '#cccccc';
  }
}

// ===== INTEGRATION: Apply to Express App =====
// property-search-api/src/app.ts
import express from 'express';
import { globalErrorHandler, asyncErrorWrapper } from './middleware/errorHandler';
import { propertyRoutes } from './routes/properties';

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes with async error handling
app.use('/api/properties', propertyRoutes);

// Example of using asyncErrorWrapper for async routes
app.get('/api/properties/search', asyncErrorWrapper(async (req, res) => {
  const results = await searchProperties(req.query);
  res.json(results);
}));

// 404 handler for undefined routes
app.use('*', (req, res, next) => {
  const error = new AppError(`Route ${req.originalUrl} not found`, 404);
  next(error);
});

// Global error handler (must be last)
app.use(globalErrorHandler);

export { app };

// ===== CONFIGURATION: Error Handling Config =====
// property-search-api/src/config/errorHandling.ts
export const errorConfig = {
  // Logging configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'json',
    enableConsole: process.env.NODE_ENV !== 'test',
    enableFile: process.env.NODE_ENV === 'production'
  },

  // Alert thresholds
  alerting: {
    errorRateThreshold: 0.05, // 5% error rate
    responseTimeThreshold: 5000, // 5 seconds
    criticalErrorTypes: [
      'DatabaseError',
      'AuthenticationError'
    ]
  },

  // Error message sanitization
  sanitization: {
    enableInProduction: true,
    sensitivePatterns: [
      /password/gi,
      /secret/gi,
      /token/gi,
      /postgresql:\/\//gi
    ]
  },

  // Retry configuration
  retry: {
    defaultRetryAfter: 30, // seconds
    maxRetryAfter: 300,    // 5 minutes
    backoffMultiplier: 2
  }
};
