// TDD RED PHASE - Error Handling Infrastructure Tests
import { describe, it, expect } from 'vitest';
import {
    ApiError,
    ValidationError,
    NotFoundError,
    UnauthorizedError,
    createApiError,
    isApiError
} from './errors';

describe('Error Handling Infrastructure', () => {
    describe('ApiError', () => {
        it('should create a basic API error', () => {
            // Arrange & Act
            const error = new ApiError('Something went wrong');

            // Assert
            expect(error).toBeInstanceOf(Error);
            expect(error).toBeInstanceOf(ApiError);
            expect(error.message).toBe('Something went wrong');
            expect(error.statusCode).toBe(500);
            expect(error.code).toBe('INTERNAL_ERROR');
            expect(error.isOperational).toBe(true);
        });

        it('should create API error with custom status and code', () => {
            // Arrange & Act
            const error = new ApiError('Custom error', 422, 'CUSTOM_ERROR');

            // Assert
            expect(error.message).toBe('Custom error');
            expect(error.statusCode).toBe(422);
            expect(error.code).toBe('CUSTOM_ERROR');
            expect(error.isOperational).toBe(true);
        });

        it('should include stack trace', () => {
            // Arrange & Act
            const error = new ApiError('Test error');

            // Assert
            expect(error.stack).toBeDefined();
            expect(error.stack).toContain('ApiError');
        });
    });

    describe('Specific Error Types', () => {
        it('should create ValidationError with correct defaults', () => {
            // Arrange & Act
            const error = new ValidationError('Invalid input');

            // Assert
            expect(error).toBeInstanceOf(ApiError);
            expect(error.message).toBe('Invalid input');
            expect(error.statusCode).toBe(400);
            expect(error.code).toBe('VALIDATION_ERROR');
        });

        it('should create NotFoundError with correct defaults', () => {
            // Arrange & Act
            const error = new NotFoundError('Resource not found');

            // Assert
            expect(error).toBeInstanceOf(ApiError);
            expect(error.message).toBe('Resource not found');
            expect(error.statusCode).toBe(404);
            expect(error.code).toBe('NOT_FOUND');
        });

        it('should create UnauthorizedError with correct defaults', () => {
            // Arrange & Act
            const error = new UnauthorizedError('Access denied');

            // Assert
            expect(error).toBeInstanceOf(ApiError);
            expect(error.message).toBe('Access denied');
            expect(error.statusCode).toBe(401);
            expect(error.code).toBe('UNAUTHORIZED');
        });
    });

    describe('Error Factory Function', () => {
        it('should create different error types based on status code', () => {
            // Arrange & Act
            const validationError = createApiError('Invalid data', 400);
            const notFoundError = createApiError('Not found', 404);
            const unauthorizedError = createApiError('Unauthorized', 401);
            const genericError = createApiError('Server error', 500);

            // Assert
            expect(validationError).toBeInstanceOf(ValidationError);
            expect(notFoundError).toBeInstanceOf(NotFoundError);
            expect(unauthorizedError).toBeInstanceOf(UnauthorizedError);
            expect(genericError).toBeInstanceOf(ApiError);
        });
    });

    describe('Error Type Guards', () => {
        it('should identify ApiError instances', () => {
            // Arrange
            const apiError = new ApiError('API error');
            const standardError = new Error('Standard error');

            // Act & Assert
            expect(isApiError(apiError)).toBe(true);
            expect(isApiError(standardError)).toBe(false);
            expect(isApiError('not an error')).toBe(false);
            expect(isApiError(null)).toBe(false);
        });

        it('should identify specific error types as ApiErrors', () => {
            // Arrange
            const validationError = new ValidationError('Validation failed');
            const notFoundError = new NotFoundError('Not found');

            // Act & Assert
            expect(isApiError(validationError)).toBe(true);
            expect(isApiError(notFoundError)).toBe(true);
        });
    });

    describe('Error Serialization', () => {
        it('should serialize error for API response', () => {
            // Arrange
            const error = new ValidationError('Field is required');

            // Act
            const serialized = error.toJSON();

            // Assert
            expect(serialized).toEqual({
                error: true,
                message: 'Field is required',
                code: 'VALIDATION_ERROR',
                statusCode: 400,
                timestamp: expect.any(String),
            });
        });

        it('should include additional details in serialization', () => {
            // Arrange
            const error = new ValidationError('Multiple errors', 400, 'VALIDATION_ERROR', {
                fields: ['email', 'password'],
            });

            // Act
            const serialized = error.toJSON();

            // Assert
            expect(serialized.details).toEqual({
                fields: ['email', 'password'],
            });
        });
    });
});