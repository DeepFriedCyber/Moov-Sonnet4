// REFACTORED Rate Limiting Middleware
import { Request, Response, NextFunction } from 'express';

// Constants for better maintainability
export const RATE_LIMIT_DEFAULTS = {
    WINDOW_MS: 15 * 60 * 1000, // 15 minutes
    MAX_REQUESTS: 100,
    MESSAGE: 'Too many requests from this IP, please try again later.',
    SEARCH_WINDOW_MS: 60 * 1000, // 1 minute
    SEARCH_MAX_REQUESTS: 30,
    SEARCH_MESSAGE: 'Too many search requests, please slow down.',
} as const;

// Enhanced type definitions
export interface RateLimitConfig {
    windowMs: number;
    maxRequests: number;
    message: string;
    keyGenerator?: (req: Request) => string;
    skip?: (req: Request) => boolean;
    rules?: RateLimitRule[];
}

export interface RateLimitRule {
    path: string;
    method: string;
    windowMs: number;
    maxRequests: number;
}

export interface RateLimitData {
    count: number;
    resetTime: number;
}

export interface RateLimitResponse {
    error: true;
    message: string;
    code: 'RATE_LIMIT_EXCEEDED';
    statusCode: 429;
    retryAfter: number;
}

// Enhanced in-memory store with better typing
class RateLimitStore {
    private store = new Map<string, RateLimitData>();

    get(key: string): RateLimitData | undefined {
        return this.store.get(key);
    }

    set(key: string, data: RateLimitData): void {
        this.store.set(key, data);
    }

    clear(): void {
        this.store.clear();
    }

    // Clean up expired entries
    cleanup(): void {
        const now = Date.now();
        for (const [key, data] of this.store.entries()) {
            if (data.resetTime <= now) {
                this.store.delete(key);
            }
        }
    }
}

// Global store instance
const rateLimitStore = new RateLimitStore();

// Enhanced key generator with better defaults
const defaultKeyGenerator = (req: Request): string => req.ip || 'unknown';

// Helper function to create rule-specific key
const createRuleKey = (baseKey: string, rule: RateLimitRule): string =>
    `${baseKey}-${rule.path}-${rule.method}`;

// Main rate limiter creation function with improved structure
export function createRateLimiter(config: RateLimitConfig) {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        // Early exit for skipped requests
        if (config.skip && config.skip(req)) {
            return next();
        }

        // Handle rules-based configuration
        if (config.rules) {
            const matchingRule = findMatchingRule(config.rules, req);
            if (matchingRule) {
                const ruleConfig = createRuleConfig(config, matchingRule);
                return applyRateLimit(req, res, next, ruleConfig);
            }
        }

        // Apply default rate limiting
        return applyRateLimit(req, res, next, config);
    };
}

// Helper function to find matching rule
function findMatchingRule(rules: RateLimitRule[], req: Request): RateLimitRule | undefined {
    return rules.find(rule =>
        req.url?.includes(rule.path) && req.method === rule.method
    );
}

// Helper function to create rule-specific configuration
function createRuleConfig(config: RateLimitConfig, rule: RateLimitRule): RateLimitConfig {
    return {
        ...config,
        windowMs: rule.windowMs,
        maxRequests: rule.maxRequests,
        keyGenerator: (req) => createRuleKey(defaultKeyGenerator(req), rule),
    };
}

// Core rate limiting logic with improved error handling
function applyRateLimit(
    req: Request,
    res: Response,
    next: NextFunction,
    config: RateLimitConfig
): void {
    try {
        const keyGenerator = config.keyGenerator || defaultKeyGenerator;
        const key = keyGenerator(req);
        const now = Date.now();

        // Get or create rate limit data
        const limitData = getOrCreateLimitData(key, now, config.windowMs);

        // Update request count
        limitData.count++;
        rateLimitStore.set(key, limitData);

        // Set standard rate limit headers
        setRateLimitHeaders(res, config, limitData, now);

        // Check if rate limit exceeded
        if (limitData.count > config.maxRequests) {
            handleRateLimitExceeded(res, config, limitData, now);
            return;
        }

        // Request allowed - continue
        next();
    } catch (error) {
        // In case of any error, allow the request to continue
        // but log the error for monitoring
        console.error('Rate limiting error:', error);
        next();
    }
}

// Helper function to get or create limit data
function getOrCreateLimitData(key: string, now: number, windowMs: number): RateLimitData {
    let limitData = rateLimitStore.get(key);

    if (!limitData || limitData.resetTime <= now) {
        // Create new window
        limitData = {
            count: 0,
            resetTime: now + windowMs,
        };
    }

    return limitData;
}

// Helper function to set rate limit headers
function setRateLimitHeaders(
    res: Response,
    config: RateLimitConfig,
    limitData: RateLimitData,
    now: number
): void {
    const remaining = Math.max(0, config.maxRequests - limitData.count);
    const resetTime = new Date(limitData.resetTime).toISOString();

    res.set('X-RateLimit-Limit', config.maxRequests.toString());
    res.set('X-RateLimit-Remaining', remaining.toString());
    res.set('X-RateLimit-Reset', resetTime);
}

// Helper function to handle rate limit exceeded
function handleRateLimitExceeded(
    res: Response,
    config: RateLimitConfig,
    limitData: RateLimitData,
    now: number
): void {
    const retryAfter = Math.ceil((limitData.resetTime - now) / 1000);
    res.set('Retry-After', retryAfter.toString());

    const response: RateLimitResponse = {
        error: true,
        message: config.message,
        code: 'RATE_LIMIT_EXCEEDED',
        statusCode: 429,
        retryAfter,
    };

    res.status(429).json(response);
}

// Predefined rate limiters with enhanced defaults
export function createApiRateLimiter(overrides: Partial<RateLimitConfig> = {}) {
    const config: RateLimitConfig = {
        windowMs: RATE_LIMIT_DEFAULTS.WINDOW_MS,
        maxRequests: RATE_LIMIT_DEFAULTS.MAX_REQUESTS,
        message: RATE_LIMIT_DEFAULTS.MESSAGE,
        ...overrides,
    };
    return createRateLimiter(config);
}

export function createSearchRateLimiter(overrides: Partial<RateLimitConfig> = {}) {
    const config: RateLimitConfig = {
        windowMs: RATE_LIMIT_DEFAULTS.SEARCH_WINDOW_MS,
        maxRequests: RATE_LIMIT_DEFAULTS.SEARCH_MAX_REQUESTS,
        message: RATE_LIMIT_DEFAULTS.SEARCH_MESSAGE,
        ...overrides,
    };
    return createRateLimiter(config);
}

// Utility functions for testing and maintenance
export function clearRateLimit(): void {
    rateLimitStore.clear();
}

export function cleanupExpiredRateLimits(): void {
    rateLimitStore.cleanup();
}

// Optional: Auto-cleanup expired entries periodically
if (typeof setInterval !== 'undefined') {
    setInterval(cleanupExpiredRateLimits, 5 * 60 * 1000); // Every 5 minutes
}