import { Request } from 'express';
import { RateLimiter, RateLimitConfig } from './RateLimiter';
import { Redis } from 'ioredis';
import jwt from 'jsonwebtoken';

export class PropertyRateLimiter {
  private redis: Redis;

  constructor(redis: Redis) {
    this.redis = redis;
  }

  // Property search rate limiter - more restrictive
  searchLimiter() {
    const config: RateLimitConfig = {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: this.getSearchLimit.bind(this),
      redis: this.redis,
      keyGenerator: this.generateSearchKey.bind(this)
    };

    return new RateLimiter(config).middleware();
  }

  // Property details rate limiter - less restrictive  
  detailsLimiter() {
    const config: RateLimitConfig = {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: this.getDetailsLimit.bind(this),
      redis: this.redis,
      keyGenerator: this.generateDetailsKey.bind(this)
    };

    return new RateLimiter(config).middleware();
  }

  // Favorites/actions rate limiter
  favoritesLimiter() {
    const config: RateLimitConfig = {
      windowMs: 5 * 60 * 1000, // 5 minutes
      maxRequests: 50, // Lower limit for write operations
      redis: this.redis,
      keyGenerator: this.generateActionKey.bind(this)
    };

    return new RateLimiter(config).middleware();
  }

  private getSearchLimit(req: Request): number {
    const userTier = this.getUserTier(req);
    
    switch (userTier) {
      case 'premium': return 500;
      case 'authenticated': return 200;
      case 'anonymous': return 100;
      default: return 50; // Conservative default
    }
  }

  private getDetailsLimit(req: Request): number {
    const userTier = this.getUserTier(req);
    
    switch (userTier) {
      case 'premium': return 2000;
      case 'authenticated': return 1000;
      case 'anonymous': return 500;
      default: return 200;
    }
  }

  getUserTier(req: Request): string {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return 'anonymous';
    }

    try {
      const token = authHeader.slice(7);
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
      
      return decoded.tier || 'authenticated';
    } catch (error) {
      return 'anonymous';
    }
  }

  private generateSearchKey(req: Request): string {
    const userTier = this.getUserTier(req);
    const identifier = userTier === 'anonymous' ? req.ip : this.getUserId(req);
    return `search:${userTier}:${identifier}`;
  }

  private generateDetailsKey(req: Request): string {
    const userTier = this.getUserTier(req);
    const identifier = userTier === 'anonymous' ? req.ip : this.getUserId(req);
    return `details:${userTier}:${identifier}`;
  }

  private generateActionKey(req: Request): string {
    const userTier = this.getUserTier(req);
    const identifier = userTier === 'anonymous' ? req.ip : this.getUserId(req);
    return `action:${userTier}:${identifier}`;
  }

  private getUserId(req: Request): string {
    try {
      const token = req.headers.authorization?.slice(7);
      const decoded = jwt.verify(token!, process.env.JWT_SECRET!) as any;
      return decoded.userId || req.ip;
    } catch {
      return req.ip;
    }
  }
}