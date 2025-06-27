// REFACTORED Rate Limiting Middleware with TDD implementation and Redis support
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { Redis } from 'ioredis';
import { Request } from 'express';
import { getEnv, hasRedis, isDevelopment } from '../config/env';

// Rate limit configuration interface
export interface RateLimitConfig {
    windowMs: number;
    max: number;
    message?: string;
    skipRedis?: boolean;
    keyGenerator?: (req: Request) => string;
    skip?: (req: Request) => boolean;
}

// Default configurations
const DEFAULT_API_CONFIG: RateLimitConfig = {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.',
};

const DEFAULT_AUTH_CONFIG: RateLimitConfig = {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Limit auth attempts
    message: 'Too many authentication attempts, please try again later.',
};

// Redis client singleton
let redisClient: Redis | null = null;

const getRedisClient = (): Redis | null => {
    // Skip Redis in test environment or if not configured
    if (process.env.NODE_ENV === 'test') {
        return null;
    }

    try {
        if (!hasRedis()) {
            return null;
        }
    } catch (error) {
        // If environment validation fails, skip Redis
        return null;
    }

    try {
        if (!redisClient) {
            const env = getEnv();
            redisClient = new Redis(env.REDIS_URL!, {
                retryDelayOnFailover: 100,
                maxRetriesPerRequest: 3,
                lazyConnect: true,
            });

            redisClient.on('error', (error) => {
                console.error('Redis connection error:', error);
                // Don't set to null immediately, let it retry
            });

            redisClient.on('connect', () => {
                if (isDevelopment()) {
                    console.log('Redis connected for rate limiting');
                }
            });
        }

        return redisClient;
    } catch (error) {
        console.error('Failed to create Redis client:', error);
        return null;
    }
};

// Validation function
const validateConfig = (config: RateLimitConfig): void => {
    if (config.max <= 0) {
        throw new Error('Rate limit max must be greater than 0');
    }
    if (config.windowMs <= 0) {
        throw new Error('Rate limit windowMs must be greater than 0');
    }
};

// Create API rate limiter
export const createApiLimiter = (customConfig?: Partial<RateLimitConfig>) => {
    const config = { ...DEFAULT_API_CONFIG, ...customConfig };
    validateConfig(config);

    const redis = config.skipRedis ? null : getRedisClient();

    const rateLimitOptions: any = {
        windowMs: config.windowMs,
        max: config.max,
        message: config.message,
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: config.keyGenerator || ((req: Request) => req.ip),
        skip: config.skip,
    };

    // Add Redis store if available
    if (redis) {
        rateLimitOptions.store = new RedisStore({
            sendCommand: (...args: string[]) => redis.call(...args),
            prefix: 'rate-limit:',
        });
    }

    return rateLimit(rateLimitOptions);
};

// Create auth rate limiter
export const createAuthLimiter = (customConfig?: Partial<RateLimitConfig>) => {
    const config = { ...DEFAULT_AUTH_CONFIG, ...customConfig };
    validateConfig(config);

    const redis = config.skipRedis ? null : getRedisClient();

    const rateLimitOptions: any = {
        windowMs: config.windowMs,
        max: config.max,
        message: config.message,
        standardHeaders: true,
        legacyHeaders: false,
        skipSuccessfulRequests: true, // Only count failed auth attempts
        keyGenerator: config.keyGenerator || ((req: Request) => req.ip),
        skip: config.skip,
    };

    // Add Redis store if available
    if (redis) {
        rateLimitOptions.store = new RedisStore({
            sendCommand: (...args: string[]) => redis.call(...args),
            prefix: 'auth-limit:',
        });
    }

    return rateLimit(rateLimitOptions);
};

// Pre-configured limiters for easy use (lazy initialization)
export const getApiLimiter = () => createApiLimiter();
export const getAuthLimiter = () => createAuthLimiter();

// Utility functions for testing and maintenance
export const closeRedisConnection = async (): Promise<void> => {
    if (redisClient) {
        try {
            await redisClient.quit();
        } catch (error) {
            console.error('Error closing Redis connection:', error);
        } finally {
            redisClient = null;
        }
    }
};

// Health check function
export const checkRateLimitHealth = async (): Promise<{
    redis: boolean;
    memory: boolean;
}> => {
    const redis = getRedisClient();
    let redisHealthy = false;

    if (redis) {
        try {
            await redis.ping();
            redisHealthy = true;
        } catch (error) {
            console.error('Redis health check failed:', error);
        }
    }

    return {
        redis: redisHealthy,
        memory: true, // Memory store is always available
    };
};

// Create specialized rate limiters for different endpoints
export const createSearchLimiter = (customConfig?: Partial<RateLimitConfig>) => {
    return createApiLimiter({
        windowMs: 60 * 1000, // 1 minute
        max: 30, // 30 searches per minute
        message: 'Too many search requests, please slow down.',
        ...customConfig,
    });
};

export const createUploadLimiter = (customConfig?: Partial<RateLimitConfig>) => {
    return createApiLimiter({
        windowMs: 60 * 60 * 1000, // 1 hour
        max: 50, // 50 uploads per hour
        message: 'Too many upload requests, please try again later.',
        ...customConfig,
    });
};