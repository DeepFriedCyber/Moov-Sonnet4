// REFACTORED version with improved structure and TDD validation
import { z } from 'zod';

// Constants for configuration
const JWT_SECRET_MIN_LENGTH = 32;
const DEFAULT_PORT = '3001';
const DEFAULT_CORS_ORIGIN = '*';
const DEFAULT_NODE_ENV = 'development';

// Reusable schemas
const NodeEnvironmentSchema = z.enum(['development', 'production', 'test']);
const PortSchema = z.string().default(DEFAULT_PORT).transform(Number);
const UrlSchema = z.string().url();

// Main environment schema with comprehensive validation
const ApiEnvironmentSchema = z.object({
    NODE_ENV: NodeEnvironmentSchema.default(DEFAULT_NODE_ENV),
    PORT: PortSchema,
    DATABASE_URL: UrlSchema,
    REDIS_URL: UrlSchema.optional(),
    FRONTEND_URL: UrlSchema,
    EMBEDDING_SERVICE_URL: UrlSchema,
    JWT_SECRET: z.string().min(JWT_SECRET_MIN_LENGTH, {
        message: `JWT_SECRET must be at least ${JWT_SECRET_MIN_LENGTH} characters long`
    }),
    CORS_ORIGIN: z.string().default(DEFAULT_CORS_ORIGIN),
});

// Export types
export type ApiEnvironment = z.infer<typeof ApiEnvironmentSchema>;
export type NodeEnvironment = z.infer<typeof NodeEnvironmentSchema>;
export type Env = ApiEnvironment; // Alias for test compatibility

// Parse function remains the same - maintaining the same public API
export const parseEnv = (): ApiEnvironment => {
    try {
        return ApiEnvironmentSchema.parse(process.env);
    } catch (error) {
        if (error instanceof z.ZodError) {
            const errorMessages = error.errors.map(err => {
                const path = err.path.join('.');
                return `${path}: ${err.message}`;
            });

            throw new Error(
                `Environment validation failed:\n${errorMessages.join('\n')}`
            );
        }
        throw error;
    }
};

// Test-compatible function
export const validateEnv = parseEnv;

// Lazy-loaded singleton for actual usage
let cachedEnv: ApiEnvironment | undefined;

export const getEnv = (): ApiEnvironment => {
    if (!cachedEnv) {
        cachedEnv = parseEnv();
    }
    return cachedEnv;
};

// For testing - allows resetting the cache
export const resetEnvCache = (): void => {
    cachedEnv = undefined;
};

// Utility functions for environment checks
export const isDevelopment = (): boolean => getEnv().NODE_ENV === 'development';
export const isProduction = (): boolean => getEnv().NODE_ENV === 'production';
export const isTest = (): boolean => getEnv().NODE_ENV === 'test';

// Utility to check if Redis is configured
export const hasRedis = (): boolean => !!getEnv().REDIS_URL;