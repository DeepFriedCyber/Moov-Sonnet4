// ============================================================================
// Enhanced Cache Service with TDD Approach
// ============================================================================

import Redis from 'ioredis';
import { logger } from '../utils/logger';

export interface CacheOptions {
  ttl?: number;
  prefix?: string;
  compress?: boolean;
}

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  totalRequests: number;
  memoryUsage?: number;
}

export class CacheService {
  private redis: Redis;
  private defaultTTL = 3600; // 1 hour
  private stats = {
    hits: 0,
    misses: 0
  };

  constructor(redisUrl?: string) {
    this.redis = new Redis(redisUrl || process.env.REDIS_URL || 'redis://localhost:6379', {
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      keepAlive: 30000,
      family: 4,
      keyPrefix: 'property_search:',
    });

    this.redis.on('error', (error) => {
      logger.error('Redis connection error:', error);
    });

    this.redis.on('connect', () => {
      logger.info('Redis connected successfully');
    });
  }

  async get<T>(key: string, options?: CacheOptions): Promise<T | null> {
    try {
      const fullKey = this.buildKey(key, options?.prefix);
      const value = await this.redis.get(fullKey);
      
      if (value) {
        this.stats.hits++;
        const parsed = JSON.parse(value);
        
        // Handle compressed data if needed
        if (options?.compress && parsed.compressed) {
          // Implement decompression logic here if needed
          return parsed.data;
        }
        
        return parsed;
      } else {
        this.stats.misses++;
        return null;
      }
    } catch (error) {
      logger.error('Cache get error:', { key, error });
      this.stats.misses++;
      return null;
    }
  }

  async set(key: string, value: any, options?: CacheOptions): Promise<boolean> {
    try {
      const fullKey = this.buildKey(key, options?.prefix);
      const ttl = options?.ttl || this.defaultTTL;
      
      let dataToStore = value;
      
      // Handle compression if needed
      if (options?.compress) {
        // Implement compression logic here if needed
        dataToStore = { compressed: true, data: value };
      }
      
      await this.redis.setex(fullKey, ttl, JSON.stringify(dataToStore));
      return true;
    } catch (error) {
      logger.error('Cache set error:', { key, error });
      return false;
    }
  }

  async del(pattern: string, options?: CacheOptions): Promise<number> {
    try {
      const fullPattern = this.buildKey(pattern, options?.prefix);
      const keys = await this.redis.keys(fullPattern);
      
      if (keys.length > 0) {
        return await this.redis.del(...keys);
      }
      return 0;
    } catch (error) {
      logger.error('Cache delete error:', { pattern, error });
      return 0;
    }
  }

  async exists(key: string, options?: CacheOptions): Promise<boolean> {
    try {
      const fullKey = this.buildKey(key, options?.prefix);
      const result = await this.redis.exists(fullKey);
      return result === 1;
    } catch (error) {
      logger.error('Cache exists error:', { key, error });
      return false;
    }
  }

  async increment(key: string, amount = 1, options?: CacheOptions): Promise<number> {
    try {
      const fullKey = this.buildKey(key, options?.prefix);
      const result = await this.redis.incrby(fullKey, amount);
      
      // Set expiration if it's a new key
      if (result === amount) {
        await this.redis.expire(fullKey, options?.ttl || this.defaultTTL);
      }
      
      return result;
    } catch (error) {
      logger.error('Cache increment error:', { key, error });
      return 0;
    }
  }

  async setHash(key: string, field: string, value: any, options?: CacheOptions): Promise<boolean> {
    try {
      const fullKey = this.buildKey(key, options?.prefix);
      await this.redis.hset(fullKey, field, JSON.stringify(value));
      
      if (options?.ttl) {
        await this.redis.expire(fullKey, options.ttl);
      }
      
      return true;
    } catch (error) {
      logger.error('Cache setHash error:', { key, field, error });
      return false;
    }
  }

  async getHash<T>(key: string, field: string, options?: CacheOptions): Promise<T | null> {
    try {
      const fullKey = this.buildKey(key, options?.prefix);
      const value = await this.redis.hget(fullKey, field);
      
      if (value) {
        this.stats.hits++;
        return JSON.parse(value);
      } else {
        this.stats.misses++;
        return null;
      }
    } catch (error) {
      logger.error('Cache getHash error:', { key, field, error });
      this.stats.misses++;
      return null;
    }
  }

  async getAllHash<T>(key: string, options?: CacheOptions): Promise<Record<string, T> | null> {
    try {
      const fullKey = this.buildKey(key, options?.prefix);
      const hash = await this.redis.hgetall(fullKey);
      
      if (Object.keys(hash).length > 0) {
        this.stats.hits++;
        const result: Record<string, T> = {};
        
        for (const [field, value] of Object.entries(hash)) {
          result[field] = JSON.parse(value);
        }
        
        return result;
      } else {
        this.stats.misses++;
        return null;
      }
    } catch (error) {
      logger.error('Cache getAllHash error:', { key, error });
      this.stats.misses++;
      return null;
    }
  }

  async addToSet(key: string, value: string, options?: CacheOptions): Promise<boolean> {
    try {
      const fullKey = this.buildKey(key, options?.prefix);
      await this.redis.sadd(fullKey, value);
      
      if (options?.ttl) {
        await this.redis.expire(fullKey, options.ttl);
      }
      
      return true;
    } catch (error) {
      logger.error('Cache addToSet error:', { key, value, error });
      return false;
    }
  }

  async getSet(key: string, options?: CacheOptions): Promise<string[]> {
    try {
      const fullKey = this.buildKey(key, options?.prefix);
      return await this.redis.smembers(fullKey);
    } catch (error) {
      logger.error('Cache getSet error:', { key, error });
      return [];
    }
  }

  async getStats(): Promise<CacheStats> {
    const totalRequests = this.stats.hits + this.stats.misses;
    const hitRate = totalRequests > 0 ? (this.stats.hits / totalRequests) * 100 : 0;
    
    let memoryUsage: number | undefined;
    try {
      const info = await this.redis.memory('usage', 'property_search:*');
      memoryUsage = info;
    } catch (error) {
      // Memory usage not available
    }
    
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: Math.round(hitRate * 100) / 100,
      totalRequests,
      memoryUsage
    };
  }

  async clearStats(): Promise<void> {
    this.stats.hits = 0;
    this.stats.misses = 0;
  }

  async flush(pattern?: string): Promise<boolean> {
    try {
      if (pattern) {
        const keys = await this.redis.keys(this.buildKey(pattern));
        if (keys.length > 0) {
          await this.redis.del(...keys);
        }
      } else {
        await this.redis.flushdb();
      }
      return true;
    } catch (error) {
      logger.error('Cache flush error:', { pattern, error });
      return false;
    }
  }

  generateKey(prefix: string, ...parts: (string | number)[]): string {
    return `${prefix}:${parts.join(':')}`;
  }

  private buildKey(key: string, prefix?: string): string {
    return prefix ? `${prefix}:${key}` : key;
  }

  async disconnect(): Promise<void> {
    await this.redis.disconnect();
  }

  async ping(): Promise<boolean> {
    try {
      const result = await this.redis.ping();
      return result === 'PONG';
    } catch (error) {
      return false;
    }
  }
}

// Singleton instance
export const cacheService = new CacheService();

export default cacheService;