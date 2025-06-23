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

    if (error instanceof ValidationError && error.details) {
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
    if (isApiError(error)) {
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

    if (isApiError(error)) {
        Object.assign(response, handleApiError(error));
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