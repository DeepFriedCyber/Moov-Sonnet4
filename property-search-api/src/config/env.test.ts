// File: property-search-api/src/config/env.test.ts
// This is our FIRST file - we write the test before any implementation
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { parseEnv, type ApiEnvironment } from './env';

describe('API Environment Configuration', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        // Create a clean environment for each test
        process.env = { ...originalEnv };
    });

    afterEach(() => {
        // Restore original environment
        process.env = originalEnv;
    });

    it('should parse valid environment variables', () => {
        // Arrange
        process.env = {
            NODE_ENV: 'development',
            PORT: '3001',
            DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
            FRONTEND_URL: 'http://localhost:3000',
            EMBEDDING_SERVICE_URL: 'http://localhost:8001',
            JWT_SECRET: 'a-very-long-secret-key-that-is-at-least-32-chars',
        };

        // Act
        const result = parseEnv();

        // Assert
        expect(result.NODE_ENV).toBe('development');
        expect(result.PORT).toBe(3001);
        expect(result.DATABASE_URL).toBe('postgresql://user:pass@localhost:5432/db');
        expect(result.JWT_SECRET).toBe('a-very-long-secret-key-that-is-at-least-32-chars');
    });

    it('should throw error when DATABASE_URL is missing', () => {
        // Arrange
        process.env = {
            NODE_ENV: 'development',
            PORT: '3001',
            FRONTEND_URL: 'http://localhost:3000',
            EMBEDDING_SERVICE_URL: 'http://localhost:8001',
            JWT_SECRET: 'a-very-long-secret-key-that-is-at-least-32-chars',
        };

        // Act & Assert
        expect(() => parseEnv()).toThrow();
    });

    it('should throw error when JWT_SECRET is too short', () => {
        // Arrange
        process.env = {
            NODE_ENV: 'development',
            PORT: '3001',
            DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
            FRONTEND_URL: 'http://localhost:3000',
            EMBEDDING_SERVICE_URL: 'http://localhost:8001',
            JWT_SECRET: 'too-short',
        };

        // Act & Assert
        expect(() => parseEnv()).toThrow();
    });

    it('should use default values when optional vars are missing', () => {
        // Arrange
        process.env = {
            DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
            FRONTEND_URL: 'http://localhost:3000',
            EMBEDDING_SERVICE_URL: 'http://localhost:8001',
            JWT_SECRET: 'a-very-long-secret-key-that-is-at-least-32-chars',
        };

        // Act
        const result = parseEnv();

        // Assert
        expect(result.NODE_ENV).toBe('development');
        expect(result.PORT).toBe(3001);
        expect(result.REDIS_URL).toBe('redis://localhost:6379');
    });

    it('should validate URL formats', () => {
        // Arrange
        process.env = {
            DATABASE_URL: 'not-a-url',
            FRONTEND_URL: 'http://localhost:3000',
            EMBEDDING_SERVICE_URL: 'http://localhost:8001',
            JWT_SECRET: 'a-very-long-secret-key-that-is-at-least-32-chars',
        };

        // Act & Assert
        expect(() => parseEnv()).toThrow();
    });

    it('should handle production environment', () => {
        // Arrange
        process.env = {
            NODE_ENV: 'production',
            PORT: '8080',
            DATABASE_URL: 'postgresql://prod:pass@db.example.com:5432/proddb',
            REDIS_URL: 'redis://redis.example.com:6379',
            FRONTEND_URL: 'https://app.example.com',
            EMBEDDING_SERVICE_URL: 'https://ml.example.com',
            JWT_SECRET: 'super-secret-production-key-with-enough-length!!!',
            CORS_ORIGIN: 'https://app.example.com',
        };

        // Act
        const result = parseEnv();

        // Assert
        expect(result.NODE_ENV).toBe('production');
        expect(result.PORT).toBe(8080);
        expect(result.REDIS_URL).toBe('redis://redis.example.com:6379');
        expect(result.CORS_ORIGIN).toBe('https://app.example.com');
    });
});