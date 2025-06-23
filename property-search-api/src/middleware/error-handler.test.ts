// src/middleware/error-handler.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { errorHandler } from './error-handler';
import { ApiError, ValidationError } from '../lib/errors';

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

    it('should handle ApiError with correct status and message', () => {
        // Arrange
        const error = new ApiError('Bad request', 400);

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
        const details = { fields: ['email', 'password'] };
        const error = new ValidationError('Validation failed', 400, 'VALIDATION_ERROR', details);

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
        const error = new ApiError('Database connection lost', 500, 'INTERNAL_ERROR');

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