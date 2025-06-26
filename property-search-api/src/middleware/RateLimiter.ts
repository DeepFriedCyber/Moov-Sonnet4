import { Request, Response, NextFunction } from 'express';
import { Redis } from 'ioredis';
import { EventEmitter } from 'events';

export interface RateLimitConfig {
    windowMs: number;           // Time window in milliseconds
    maxRequests: number | ((req: Request) => number);        // Maximum requests per window
    redis: Redis;              // Redis instance
    keyGenerator?: (req: Request) => string;
    skipSuccessfulRequests?: boolean;
    skipFailedRequests?: boolean;
    skipWhen?: (req: Request) => boolean;
    onLimitReached?: (req: Request, res: Response) => void;
}

export interface RateLimitInfo {
    totalHits: number;
    totalReset: Date;
    remainingRequests: number;
}

export class RateLimiter extends EventEmitter {
    private config: RateLimitConfig;
    private redis: Redis;

    constructor(config: RateLimitConfig) {
        super();
        this.config = {
            keyGenerator: (req) => req.ip || 'unknown',
            skipSuccessfulRequests: false,
            skipFailedRequests: false,
            ...config
        };
        this.redis = config.redis;
    }

    middleware() {
        return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
            try {
                // Check if request should be skipped
                if (this.config.skipWhen && this.config.skipWhen(req)) {
                    return next();
                }

                const key = this.generateKey(req);
                const maxRequests = typeof this.config.maxRequests === 'function'
                    ? this.config.maxRequests(req)
                    : this.config.maxRequests;

                let limit: RateLimitInfo;
                try {
                    limit = await this.checkLimit(key, maxRequests);
                } catch (redisError) {
                    // Fail open - allow request if Redis fails
                    console.error('Rate limiting Redis error:', redisError);
                    return next();
                }

                // Set rate limit headers
                this.setHeaders(res, limit, maxRequests);

                if (limit.totalHits > maxRequests) {
                    this.handleLimitExceeded(req, res, limit, maxRequests);
                    return;
                }

                // Track response for conditional skipping
                const that = this;
                const originalSend = res.send;
                res.send = function (body) {
                    const statusCode = res.statusCode;

                    // Skip counting if configured
                    if (
                        (statusCode >= 200 && statusCode < 300 && that.config.skipSuccessfulRequests) ||
                        (statusCode >= 400 && that.config.skipFailedRequests)
                    ) {
                        // Decrement counter for skipped requests
                        that.decrementCounter(key);
                    }

                    return originalSend.call(this, body);
                };

                this.emit('requestProcessed', { key, limit, req });
                next();

            } catch (error) {
                // Fail open - allow request if rate limiting fails
                console.error('Rate limiting error:', error);
                next();
            }
        };
    }

    private generateKey(req: Request): string {
        const baseKey = this.config.keyGenerator!(req);
        const window = Math.floor(Date.now() / this.config.windowMs);
        return `rate_limit:${baseKey}:${window}`;
    }

    private async checkLimit(key: string, maxRequests: number): Promise<RateLimitInfo> {
        const pipeline = this.redis.pipeline();

        // Increment counter
        pipeline.incr(key);

        // Set expiry on first request
        pipeline.expire(key, Math.ceil(this.config.windowMs / 1000));

        // Get TTL for reset time calculation
        pipeline.ttl(key);

        const results = await pipeline.exec();

        if (!results) {
            throw new Error('Redis pipeline failed');
        }

        const totalHits = results[0][1] as number;
        const ttl = results[2][1] as number;

        const resetTime = new Date(Date.now() + (ttl * 1000));
        const remainingRequests = Math.max(0, maxRequests - totalHits);

        return {
            totalHits,
            totalReset: resetTime,
            remainingRequests
        };
    }

    private setHeaders(res: Response, limit: RateLimitInfo, maxRequests: number): void {
        res.set({
            'X-RateLimit-Limit': maxRequests.toString(),
            'X-RateLimit-Remaining': limit.remainingRequests.toString(),
            'X-RateLimit-Reset': limit.totalReset.toISOString()
        });
    }

    private handleLimitExceeded(req: Request, res: Response, limit: RateLimitInfo, maxRequests: number): void {
        const retryAfter = Math.ceil((limit.totalReset.getTime() - Date.now()) / 1000);

        res.set('Retry-After', retryAfter.toString());

        res.status(429).json({
            error: 'Rate limit exceeded',
            retryAfter,
            limit: maxRequests,
            resetTime: limit.totalReset.toISOString()
        });

        this.emit('limitExceeded', {
            ip: req.ip,
            key: this.generateKey(req),
            endpoint: req.path,
            limit: maxRequests,
            hits: limit.totalHits
        });

        if (this.config.onLimitReached) {
            this.config.onLimitReached(req, res);
        }
    }

    private async decrementCounter(key: string): Promise<void> {
        try {
            await this.redis.decr(key);
        } catch (error) {
            console.error('Failed to decrement rate limit counter:', error);
        }
    }
}