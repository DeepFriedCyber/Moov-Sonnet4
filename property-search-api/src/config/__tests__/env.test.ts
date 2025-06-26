import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { validateEnv } from '../env';

describe('Environment Variable Validation', () => {
    let originalEnv: NodeJS.ProcessEnv;

    beforeEach(() => {
        originalEnv = { ...process.env };
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    describe('validateEnv', () => {
        it('should validate all required environment variables', () => {
            // Arrange
            process.env = {
                NODE_ENV: 'development',
                PORT: '3001',
                DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
                REDIS_URL: 'redis://localhost:6379',
                FRONTEND_URL: 'http://localhost:3000',
                EMBEDDING_SERVICE_URL: 'http://localhost:8001',
                JWT_SECRET: 'super-secret-jwt-key-with-32-chars',
                CORS_ORIGIN: 'http://localhost:3000',
            };

            // Act
            const env = validateEnv();

            // Assert
            expect(env.NODE_ENV).toBe('development');
            expect(env.PORT).toBe(3001);
            expect(env.DATABASE_URL).toBe('postgresql://user:pass@localhost:5432/db');
            expect(env.REDIS_URL).toBe('redis://localhost:6379');
            expect(env.FRONTEND_URL).toBe('http://localhost:3000');
            expect(env.EMBEDDING_SERVICE_URL).toBe('http://localhost:8001');
            expect(env.JWT_SECRET).toBe('super-secret-jwt-key-with-32-chars');
            expect(env.CORS_ORIGIN).toBe('http://localhost:3000');
        });

        it('should use default values for optional variables', () => {
            // Arrange
            process.env = {
                DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
                FRONTEND_URL: 'http://localhost:3000',
                EMBEDDING_SERVICE_URL: 'http://localhost:8001',
                JWT_SECRET: 'super-secret-jwt-key-with-32-chars',
            };

            // Act
            const env = validateEnv();

            // Assert
            expect(env.NODE_ENV).toBe('development'); // default
            expect(env.PORT).toBe(3001); // default from string conversion
            expect(env.CORS_ORIGIN).toBe('*'); // default
        });

        it('should throw error for missing required DATABASE_URL', () => {
            // Arrange
            process.env = {
                FRONTEND_URL: 'http://localhost:3000',
                EMBEDDING_SERVICE_URL: 'http://localhost:8001',
                JWT_SECRET: 'super-secret-jwt-key-with-32-chars',
            };

            // Act & Assert
            expect(() => validateEnv()).toThrow('DATABASE_URL');
        });

        it('should throw error for invalid URL format', () => {
            // Arrange
            process.env = {
                DATABASE_URL: 'not-a-valid-url',
                FRONTEND_URL: 'http://localhost:3000',
                EMBEDDING_SERVICE_URL: 'http://localhost:8001',
                JWT_SECRET: 'super-secret-jwt-key-with-32-chars',
            };

            // Act & Assert
            expect(() => validateEnv()).toThrow();
        });

        it('should throw error for JWT_SECRET too short', () => {
            // Arrange
            process.env = {
                DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
                FRONTEND_URL: 'http://localhost:3000',
                EMBEDDING_SERVICE_URL: 'http://localhost:8001',
                JWT_SECRET: 'short', // Less than 32 characters
            };

            // Act & Assert
            expect(() => validateEnv()).toThrow();
        });

        it('should validate NODE_ENV enum values', () => {
            // Arrange
            process.env = {
                NODE_ENV: 'invalid-env',
                DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
                FRONTEND_URL: 'http://localhost:3000',
                EMBEDDING_SERVICE_URL: 'http://localhost:8001',
                JWT_SECRET: 'super-secret-jwt-key-with-32-chars',
            };

            // Act & Assert
            expect(() => validateEnv()).toThrow();
        });

        it('should convert PORT string to number', () => {
            // Arrange
            process.env = {
                PORT: '8080',
                DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
                FRONTEND_URL: 'http://localhost:3000',
                EMBEDDING_SERVICE_URL: 'http://localhost:8001',
                JWT_SECRET: 'super-secret-jwt-key-with-32-chars',
            };

            // Act
            const env = validateEnv();

            // Assert
            expect(env.PORT).toBe(8080);
            expect(typeof env.PORT).toBe('number');
        });

        it('should handle optional REDIS_URL', () => {
            // Arrange
            process.env = {
                DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
                FRONTEND_URL: 'http://localhost:3000',
                EMBEDDING_SERVICE_URL: 'http://localhost:8001',
                JWT_SECRET: 'super-secret-jwt-key-with-32-chars',
                // REDIS_URL is optional
            };

            // Act
            const env = validateEnv();

            // Assert
            expect(env.REDIS_URL).toBeUndefined();
        });

        it('should validate REDIS_URL when provided', () => {
            // Arrange
            process.env = {
                DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
                FRONTEND_URL: 'http://localhost:3000',
                EMBEDDING_SERVICE_URL: 'http://localhost:8001',
                JWT_SECRET: 'super-secret-jwt-key-with-32-chars',
                REDIS_URL: 'invalid-redis-url',
            };

            // Act & Assert
            expect(() => validateEnv()).toThrow();
        });

        it('should provide type-safe environment object', () => {
            // Arrange
            process.env = {
                NODE_ENV: 'production',
                PORT: '3001',
                DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
                REDIS_URL: 'redis://localhost:6379',
                FRONTEND_URL: 'http://localhost:3000',
                EMBEDDING_SERVICE_URL: 'http://localhost:8001',
                JWT_SECRET: 'super-secret-jwt-key-with-32-chars',
                CORS_ORIGIN: 'https://myapp.com',
            };

            // Act
            const env = validateEnv();

            // Assert - TypeScript should infer correct types
            expect(typeof env.NODE_ENV).toBe('string');
            expect(typeof env.PORT).toBe('number');
            expect(typeof env.DATABASE_URL).toBe('string');
            expect(typeof env.JWT_SECRET).toBe('string');
        });
    });
});