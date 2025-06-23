import Redis from 'ioredis';
import { env } from '../config/env';
import { logger } from './logger';

let redis: Redis | null = null;

export const connectRedis = (): Redis => {
    if (redis && redis.status === 'ready') {
        return redis;
    }

    redis = new Redis(env.REDIS_URL, {
        enableReadyCheck: false,
        maxRetriesPerRequest: null,
    });

    redis.on('connect', () => {
        logger.info('✅ Redis connected successfully');
    });

    redis.on('error', (error) => {
        logger.error('❌ Redis connection error:', error);
    });

    redis.on('ready', () => {
        logger.info('Redis client ready');
    });

    return redis;
};

export class CacheService {
    private static instance: CacheService;
    private redis: Redis;
    private ttl = 3600; // 1 hour default

    private constructor() {
        this.redis = connectRedis();
    }

    static getInstance(): CacheService {
        if (!CacheService.instance) {
            CacheService.instance = new CacheService();
        }
        return CacheService.instance;
    }

    async get<T>(key: string): Promise<T | null> {
        try {
            const data = await this.redis.get(key);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            logger.error('Cache get error:', error);
            return null;
        }
    }

    async set(key: string, value: any, ttl?: number): Promise<void> {
        try {
            await this.redis.set(
                key,
                JSON.stringify(value),
                'EX',
                ttl || this.ttl
            );
        } catch (error) {
            logger.error('Cache set error:', error);
        }
    }

    async del(key: string): Promise<void> {
        try {
            await this.redis.del(key);
        } catch (error) {
            logger.error('Cache delete error:', error);
        }
    }

    async invalidate(pattern: string): Promise<void> {
        try {
            const keys = await this.redis.keys(pattern);
            if (keys.length) {
                await this.redis.del(...keys);
            }
        } catch (error) {
            logger.error('Cache invalidation error:', error);
        }
    }

    async exists(key: string): Promise<boolean> {
        try {
            const result = await this.redis.exists(key);
            return result === 1;
        } catch (error) {
            logger.error('Cache exists error:', error);
            return false;
        }
    }

    async incr(key: string, ttl?: number): Promise<number> {
        try {
            const result = await this.redis.incr(key);
            if (ttl && result === 1) {
                await this.redis.expire(key, ttl);
            }
            return result;
        } catch (error) {
            logger.error('Cache increment error:', error);
            return 0;
        }
    }

    generateKey(prefix: string, params: any): string {
        const serialized = typeof params === 'object'
            ? JSON.stringify(params)
            : String(params);
        return `${prefix}:${Buffer.from(serialized).toString('base64')}`;
    }
}

export const cache = CacheService.getInstance();

// Export the redis instance for rate limiting
export { redis };