// Additional test file for frontend environment validation
// File: property-search-frontend/src/lib/env.test.ts
import { describe, it, expect } from 'vitest';
import { parseFrontendEnv } from './env';

describe('Frontend Environment Configuration', () => {
    it('should parse valid frontend environment variables', () => {
        // Arrange
        const mockEnv = {
            NEXT_PUBLIC_API_URL: 'http://localhost:3001',
            NEXT_PUBLIC_EMBEDDING_SERVICE_URL: 'http://localhost:8001',
        };

        // Act
        const result = parseFrontendEnv(mockEnv);

        // Assert
        expect(result.NEXT_PUBLIC_API_URL).toBe('http://localhost:3001');
        expect(result.NEXT_PUBLIC_EMBEDDING_SERVICE_URL).toBe('http://localhost:8001');
    });

    it('should throw error when API URL is invalid', () => {
        // Arrange
        const mockEnv = {
            NEXT_PUBLIC_API_URL: 'not-a-url',
            NEXT_PUBLIC_EMBEDDING_SERVICE_URL: 'http://localhost:8001',
        };

        // Act & Assert
        expect(() => parseFrontendEnv(mockEnv)).toThrow();
    });

    it('should throw error when required variables are missing', () => {
        // Arrange
        const mockEnv = {
            NEXT_PUBLIC_API_URL: 'http://localhost:3001',
            // Missing NEXT_PUBLIC_EMBEDDING_SERVICE_URL
        };

        // Act & Assert
        expect(() => parseFrontendEnv(mockEnv as any)).toThrow();
    });

    it('should handle production URLs', () => {
        // Arrange
        const mockEnv = {
            NEXT_PUBLIC_API_URL: 'https://api.moov.com',
            NEXT_PUBLIC_EMBEDDING_SERVICE_URL: 'https://ml.moov.com',
        };

        // Act
        const result = parseFrontendEnv(mockEnv);

        // Assert
        expect(result.NEXT_PUBLIC_API_URL).toBe('https://api.moov.com');
        expect(result.NEXT_PUBLIC_EMBEDDING_SERVICE_URL).toBe('https://ml.moov.com');
    });
});