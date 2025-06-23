// REFACTORED version with improved structure
import { z } from 'zod';

// Constants for configuration
const JWT_SECRET_MIN_LENGTH = 32;
const DEFAULT_PORT = '3001';
const DEFAULT_CORS_ORIGIN = '*';
const DEFAULT_REDIS_URL = 'redis://localhost:6379';

// Reusable schemas
const NodeEnvironmentSchema = z.enum(['development', 'production', 'test']);
const PortSchema = z.string().default(DEFAULT_PORT).transform(Number);
const UrlSchema = z.string().url();

// Main environment schema
const ApiEnvironmentSchema = z.object({
    NODE_ENV: NodeEnvironmentSchema.default('development'),
    PORT: PortSchema,
    DATABASE_URL: UrlSchema,
    REDIS_URL: UrlSchema.default(DEFAULT_REDIS_URL),
    FRONTEND_URL: UrlSchema,
    EMBEDDING_SERVICE_URL: UrlSchema,
    JWT_SECRET: z.string().min(JWT_SECRET_MIN_LENGTH),
    CORS_ORIGIN: z.string().default(DEFAULT_CORS_ORIGIN),
});

// Export types
export type ApiEnvironment = z.infer<typeof ApiEnvironmentSchema>;
export type NodeEnvironment = z.infer<typeof NodeEnvironmentSchema>;

// Parse function remains the same - maintaining the same public API
export const parseEnv = (): ApiEnvironment => {
    return ApiEnvironmentSchema.parse(process.env);
};

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