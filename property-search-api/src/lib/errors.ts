// REFACTORED Error Handling Infrastructure
// Constants for better maintainability
export const HTTP_STATUS_CODES = {
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    INTERNAL_SERVER_ERROR: 500,
} as const;

export const ERROR_CODES = {
    INTERNAL_ERROR: 'INTERNAL_ERROR',
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    NOT_FOUND: 'NOT_FOUND',
    UNAUTHORIZED: 'UNAUTHORIZED',
    FORBIDDEN: 'FORBIDDEN',
} as const;

// Type definitions for better type safety
export type HttpStatusCode = typeof HTTP_STATUS_CODES[keyof typeof HTTP_STATUS_CODES];
export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];

export interface ApiErrorJSON {
    error: true;
    message: string;
    code: string;
    statusCode: number;
    timestamp: string;
    details?: Record<string, unknown>;
}

export class ApiError extends Error {
    public readonly statusCode: number;
    public readonly code: string;
    public readonly isOperational: boolean;
    public readonly details?: Record<string, unknown>;

    constructor(
        message: string,
        statusCode: number = HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
        code: string = ERROR_CODES.INTERNAL_ERROR,
        details?: Record<string, unknown>
    ) {
        super(message);
        this.name = 'ApiError';
        this.statusCode = statusCode;
        this.code = code;
        this.isOperational = true;
        this.details = details;

        // Ensure proper stack trace for V8
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, ApiError);
        }
    }

    toJSON(): ApiErrorJSON {
        const result: ApiErrorJSON = {
            error: true,
            message: this.message,
            code: this.code,
            statusCode: this.statusCode,
            timestamp: new Date().toISOString(),
        };

        if (this.details) {
            result.details = this.details;
        }

        return result;
    }
}

export class ValidationError extends ApiError {
    constructor(
        message: string,
        statusCode: number = HTTP_STATUS_CODES.BAD_REQUEST,
        code: string = ERROR_CODES.VALIDATION_ERROR,
        details?: Record<string, unknown>
    ) {
        super(message, statusCode, code, details);
        this.name = 'ValidationError';
    }
}

export class NotFoundError extends ApiError {
    constructor(
        message: string,
        statusCode: number = HTTP_STATUS_CODES.NOT_FOUND,
        code: string = ERROR_CODES.NOT_FOUND,
        details?: Record<string, unknown>
    ) {
        super(message, statusCode, code, details);
        this.name = 'NotFoundError';
    }
}

export class UnauthorizedError extends ApiError {
    constructor(
        message: string,
        statusCode: number = HTTP_STATUS_CODES.UNAUTHORIZED,
        code: string = ERROR_CODES.UNAUTHORIZED,
        details?: Record<string, unknown>
    ) {
        super(message, statusCode, code, details);
        this.name = 'UnauthorizedError';
    }
}

// Error factory function with improved type safety
export function createApiError(message: string, statusCode: number): ApiError {
    switch (statusCode) {
        case HTTP_STATUS_CODES.BAD_REQUEST:
            return new ValidationError(message);
        case HTTP_STATUS_CODES.UNAUTHORIZED:
            return new UnauthorizedError(message);
        case HTTP_STATUS_CODES.NOT_FOUND:
            return new NotFoundError(message);
        default:
            return new ApiError(message, statusCode);
    }
}

// Enhanced type guard with better type checking
export function isApiError(error: unknown): error is ApiError {
    return error instanceof ApiError;
}

// Additional utility functions for error handling
export function isHttpError(error: unknown): error is ApiError {
    return isApiError(error) && error.isOperational;
}

export function formatErrorForLogging(error: unknown): Record<string, unknown> {
    if (isApiError(error)) {
        return {
            name: error.name,
            message: error.message,
            code: error.code,
            statusCode: error.statusCode,
            stack: error.stack,
            details: error.details,
        };
    }

    if (error instanceof Error) {
        return {
            name: error.name,
            message: error.message,
            stack: error.stack,
        };
    }

    return {
        error: 'Unknown error',
        value: error,
    };
}