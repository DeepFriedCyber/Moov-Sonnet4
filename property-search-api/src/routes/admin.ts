import { Router } from 'express';
import { RateLimitMonitor } from '../middleware/RateLimitMonitor';
import { getRedisIORedisClient } from '../config/redisAdapter';
import { logger } from '../utils/logger';
import { EventEmitter } from 'events';

const router = Router();

// Create event emitter for monitoring
const eventEmitter = new EventEmitter();

// Initialize rate limit monitor
let rateLimitMonitor: RateLimitMonitor | null = null;

try {
  const redis = getRedisIORedisClient();
  rateLimitMonitor = new RateLimitMonitor(redis, eventEmitter);
} catch (error) {
  logger.warn('Rate limit monitoring disabled - Redis not available:', error);
}

// Get rate limiting statistics and analytics
router.get('/rate-limit-stats', async (req, res) => {
  try {
    if (!rateLimitMonitor) {
      return res.status(503).json({
        success: false,
        error: 'Rate limit monitoring not available - Redis not connected'
      });
    }

    const [analytics, suspiciousIPs] = await Promise.all([
      rateLimitMonitor.getAnalytics(),
      rateLimitMonitor.detectSuspiciousActivity()
    ]);

    res.json({
      success: true,
      data: {
        analytics,
        suspiciousIPs,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Rate limit stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch rate limit statistics'
    });
  }
});

// Get recent rate limit violations
router.get('/rate-limit-violations', async (req, res) => {
  try {
    if (!rateLimitMonitor) {
      return res.status(503).json({
        success: false,
        error: 'Rate limit monitoring not available - Redis not connected'
      });
    }

    const redis = getRedisIORedisClient();
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    
    const recentViolations = await redis.zrangebyscore(
      'rate_limit_violations',
      oneHourAgo,
      Date.now(),
      'WITHSCORES'
    );

    const violations = [];
    for (let i = 0; i < recentViolations.length; i += 2) {
      try {
        const violation = JSON.parse(recentViolations[i]);
        const timestamp = parseInt(recentViolations[i + 1]);
        violations.push({
          ...violation,
          timestamp: new Date(timestamp).toISOString()
        });
      } catch (parseError) {
        logger.error('Failed to parse violation:', parseError);
      }
    }

    res.json({
      success: true,
      data: {
        violations: violations.slice(0, 100), // Limit to last 100 violations
        count: violations.length,
        timeWindow: '1 hour'
      }
    });
  } catch (error) {
    logger.error('Rate limit violations error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch rate limit violations'
    });
  }
});

// Get rate limiting configuration
router.get('/rate-limit-config', (req, res) => {
  const config = {
    propertySearch: {
      windowMs: 15 * 60 * 1000,
      limits: {
        anonymous: 100,
        authenticated: 200,
        premium: 500
      }
    },
    propertyDetails: {
      windowMs: 15 * 60 * 1000,
      limits: {
        anonymous: 500,
        authenticated: 1000,
        premium: 2000
      }
    },
    writeOperations: {
      windowMs: 5 * 60 * 1000,
      maxRequests: 50
    }
  };

  res.json({
    success: true,
    data: config
  });
});

// Health check for rate limiting system
router.get('/rate-limit-health', async (req, res) => {
  try {
    const redis = getRedisIORedisClient();
    await redis.ping();
    
    res.json({
      success: true,
      data: {
        redis: true,
        monitor: rateLimitMonitor !== null,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    res.json({
      success: true,
      data: {
        redis: false,
        monitor: false,
        error: error.message,
        timestamp: new Date().toISOString()
      }
    });
  }
});

export default router;