import { describe, it, expect, beforeEach, afterEach } from 'vitest';

// Mock process.env for frontend testing
const mockProcessEnv = (env: Record<string, string | undefined>) => {
    Object.defineProperty(process, 'env', {
        value: env,
        writable: true,
    });
};

describe('Frontend Environment Variable Validation', () => {
    let originalEnv: NodeJS.ProcessEnv;

    beforeEach(() => {
        originalEnv = { ...process.env };
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    describe('validateClientEnv', () => {
        it('should validate required client environment variables', async () => {
            // Arrange
            mockProcessEnv({
                NEXT_PUBLIC_API_URL: 'http://localhost:3001',
                NEXT_PUBLIC_EMBEDDING_SERVICE_URL: 'http://localhost:8001',
            });

            // Act
            const { validateClientEnv } = await import('../env');
            const env = validateClientEnv();

            // Assert
            expect(env.NEXT_PUBLIC_API_URL).toBe('http://localhost:3001');
            expect(env.NEXT_PUBLIC_EMBEDDING_SERVICE_URL).toBe('http://localhost:8001');
        });

        it('should throw error for missing NEXT_PUBLIC_API_URL', async () => {
            // Arrange
            mockProcessEnv({
                NEXT_PUBLIC_EMBEDDING_SERVICE_URL: 'http://localhost:8001',
                // Missing NEXT_PUBLIC_API_URL
            });

            // Act & Assert
            const { validateClientEnv } = await import('../env');
            expect(() => validateClientEnv()).toThrow('NEXT_PUBLIC_API_URL');
        });

        it('should throw error for missing NEXT_PUBLIC_EMBEDDING_SERVICE_URL', async () => {
            // Arrange
            mockProcessEnv({
                NEXT_PUBLIC_API_URL: 'http://localhost:3001',
                // Missing NEXT_PUBLIC_EMBEDDING_SERVICE_URL
            });

            // Act & Assert
            const { validateClientEnv } = await import('../env');
            expect(() => validateClientEnv()).toThrow('NEXT_PUBLIC_EMBEDDING_SERVICE_URL');
        });

        it('should throw error for invalid URL format', async () => {
            // Arrange
            mockProcessEnv({
                NEXT_PUBLIC_API_URL: 'not-a-valid-url',
                NEXT_PUBLIC_EMBEDDING_SERVICE_URL: 'http://localhost:8001',
            });

            // Act & Assert
            const { validateClientEnv } = await import('../env');
            expect(() => validateClientEnv()).toThrow();
        });

        it('should validate both URLs are properly formatted', async () => {
            // Arrange
            mockProcessEnv({
                NEXT_PUBLIC_API_URL: 'https://api.production.com',
                NEXT_PUBLIC_EMBEDDING_SERVICE_URL: 'https://embedding.production.com',
            });

            // Act
            const { validateClientEnv } = await import('../env');
            const env = validateClientEnv();

            // Assert
            expect(env.NEXT_PUBLIC_API_URL).toBe('https://api.production.com');
            expect(env.NEXT_PUBLIC_EMBEDDING_SERVICE_URL).toBe('https://embedding.production.com');
        });

        it('should provide type-safe environment object', async () => {
            // Arrange
            mockProcessEnv({
                NEXT_PUBLIC_API_URL: 'http://localhost:3001',
                NEXT_PUBLIC_EMBEDDING_SERVICE_URL: 'http://localhost:8001',
            });

            // Act
            const { validateClientEnv } = await import('../env');
            const env = validateClientEnv();

            // Assert - TypeScript should infer correct types
            expect(typeof env.NEXT_PUBLIC_API_URL).toBe('string');
            expect(typeof env.NEXT_PUBLIC_EMBEDDING_SERVICE_URL).toBe('string');
        });

        it('should handle localhost URLs in development', async () => {
            // Arrange
            mockProcessEnv({
                NEXT_PUBLIC_API_URL: 'http://localhost:3001',
                NEXT_PUBLIC_EMBEDDING_SERVICE_URL: 'http://localhost:8001',
            });

            // Act
            const { validateClientEnv } = await import('../env');
            const env = validateClientEnv();

            // Assert
            expect(env.NEXT_PUBLIC_API_URL).toContain('localhost');
            expect(env.NEXT_PUBLIC_EMBEDDING_SERVICE_URL).toContain('localhost');
        });

        it('should handle production URLs', async () => {
            // Arrange
            mockProcessEnv({
                NEXT_PUBLIC_API_URL: 'https://api.moov-property.com',
                NEXT_PUBLIC_EMBEDDING_SERVICE_URL: 'https://embedding.moov-property.com',
            });

            // Act
            const { validateClientEnv } = await import('../env');
            const env = validateClientEnv();

            // Assert
            expect(env.NEXT_PUBLIC_API_URL).toContain('https://');
            expect(env.NEXT_PUBLIC_EMBEDDING_SERVICE_URL).toContain('https://');
        });
    });
});