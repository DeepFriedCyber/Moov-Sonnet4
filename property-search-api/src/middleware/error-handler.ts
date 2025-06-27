// src/middleware/error-handler.ts
import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { ApiError, ValidationError, isApiError } from '../lib/errors';

interface ErrorResponse {
    status: 'error';
    message: string;
    errors?: unknown;
    stack?: string;
}

const DEFAULT_ERROR_MESSAGE = 'Internal server error';
const VALIDATION_ERROR_MESSAGE = 'Validation error';

const handleApiError = (error: ApiError): Pick<ErrorResponse, 'message' | 'errors'> => {
    const response: Pick<ErrorResponse, 'message' | 'errors'> = {
        message: error.message,
    };

    if (error.details) {
        response.errors = error.details;
    }

    return response;
};

const handleZodError = (error: ZodError): Pick<ErrorResponse, 'message' | 'errors'> => {
    return {
        message: VALIDATION_ERROR_MESSAGE,
        errors: error.errors.map(err => ({
            field: err.path.join('.') || 'unknown',
            message: err.message,
            code: err.code,
        })),
    };
};

const handleGenericError = (error: Error): Pick<ErrorResponse, 'message'> => {
    return {
        message: error.message || DEFAULT_ERROR_MESSAGE,
    };
};

const getStatusCode = (error: Error): number => {
    if (isApiError(error)) {
        return error.statusCode;
    }

    if (error instanceof ZodError) {
        return 400; // Bad Request
    }

    if (error instanceof ValidationError) {
        return 400;
    }

    return 500; // Internal Server Error
};

const buildErrorResponse = (error: Error): ErrorResponse => {
    const baseResponse: ErrorResponse = { status: 'error', message: '' };

    if (isApiError(error)) {
        Object.assign(baseResponse, handleApiError(error));
    } else if (error instanceof ZodError) {
        Object.assign(baseResponse, handleZodError(error));
    } else {
        Object.assign(baseResponse, handleGenericError(error));
    }

    // Include stack trace in development
    if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
        baseResponse.stack = error.stack;
    }

    return baseResponse;
};

export const globalErrorHandler = (
    err: Error,
    req: Request,
    res: Response,
    _next: NextFunction
): void => {
    const statusCode = getStatusCode(err);
    const response = buildErrorResponse(err);

    res.status(statusCode).json(response);
};