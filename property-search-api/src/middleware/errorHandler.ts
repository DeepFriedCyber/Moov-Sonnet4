import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from '../lib/logger';
import { AppError, ValidationError, DatabaseError } from '../errors/AppError';
import { PropertySearchError, PropertyNotFoundError } from '../errors/PropertyErrors';

export const globalErrorHandler = async (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
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
  logger.error('Application Error:', {
    error: {
      message: err.message,
      type: err.constructor.name,
      stack: err.stack
    },
    context
  });

  // Determine response based on error type
  if (err instanceof AppError) {
    handleAppError(err, res, req);
  } else if (err instanceof ZodError) {
    handleZodError(err, res, req);
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

function handleZodError(err: ZodError, res: Response, req: Request): void {
  const response = {
    success: false,
    error: {
      message: 'Validation error',
      type: 'ValidationError',
      statusCode: 400,
      details: err.errors.map(e => `${e.path.join('.')}: ${e.message}`)
    },
    timestamp: new Date().toISOString(),
    path: req.originalUrl
  };

  res.status(400).json(response);
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

// Legacy error handler for backward compatibility
export const errorHandler = globalErrorHandler;

// Handle async errors
export const asyncErrorWrapper = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Legacy async handler for backward compatibility
export const asyncHandler = asyncErrorWrapper;