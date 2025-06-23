// src/middleware/error-handler.ts
import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { ApiError, ValidationError, isApiError } from '../lib/errors';

export const errorHandler = (
    err: Error,
    req: Request,
    res: Response,
    next: NextFunction
): void => {
    let statusCode = 500;
    let message = 'Internal server error';
    let errors: any = undefined;

    if (isApiError(err)) {
        statusCode = err.statusCode;
        message = err.message;
        if (err instanceof ValidationError && err.details) {
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