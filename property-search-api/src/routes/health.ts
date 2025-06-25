import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import Redis from 'ioredis';
import { logger } from '../utils/logger';

const router = Router();

// Health check endpoint
router.get('/health', async (req: Request, res: Response) => {
  const healthCheck = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    services: {
      database: 'unknown',
      redis: 'unknown',
      embedding: 'unknown'
    },
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      external: Math.round(process.memoryUsage().external / 1024 / 1024)
    },
    cpu: process.cpuUsage()
  };

  try {
    // Check database connection
    const dbClient = new Pool({
      connectionString: process.env.DATABASE_URL
    });
    
    await dbClient.query('SELECT 1');
    healthCheck.services.database = 'healthy';
    await dbClient.end();
  } catch (error) {
    logger.error('Database health check failed:', error);
    healthCheck.services.database = 'unhealthy';
    healthCheck.status = 'degraded';
  }

  try {
    // Check Redis connection
    const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
    await redis.ping();
    healthCheck.services.redis = 'healthy';
    redis.disconnect();
  } catch (error) {
    logger.error('Redis health check failed:', error);
    healthCheck.services.redis = 'unhealthy';
    healthCheck.status = 'degraded';
  }

  try {
    // Check embedding service
    const embeddingUrl = process.env.EMBEDDING_SERVICE_URL || 'http://localhost:8001';
    const response = await fetch(`${embeddingUrl}/health`, {
      method: 'GET',
      timeout: 5000
    });
    
    if (response.ok) {
      healthCheck.services.embedding = 'healthy';
    } else {
      healthCheck.services.embedding = 'unhealthy';
      healthCheck.status = 'degraded';
    }
  } catch (error) {
    logger.error('Embedding service health check failed:', error);
    healthCheck.services.embedding = 'unhealthy';
    healthCheck.status = 'degraded';
  }

  // Determine overall status
  const unhealthyServices = Object.values(healthCheck.services).filter(status => status === 'unhealthy');
  if (unhealthyServices.length > 0) {
    if (unhealthyServices.length === Object.keys(healthCheck.services).length) {
      healthCheck.status = 'critical';
      res.status(503);
    } else {
      healthCheck.status = 'degraded';
      res.status(200);
    }
  } else {
    res.status(200);
  }

  res.json(healthCheck);
});

// Readiness check endpoint
router.get('/ready', async (req: Request, res: Response) => {
  try {
    // Check if all critical services are available
    const dbClient = new Pool({
      connectionString: process.env.DATABASE_URL
    });
    
    await dbClient.query('SELECT 1');
    await dbClient.end();

    const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
    await redis.ping();
    redis.disconnect();

    res.status(200).json({
      status: 'ready',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Readiness check failed:', error);
    res.status(503).json({
      status: 'not ready',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Liveness check endpoint
router.get('/live', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Metrics endpoint for Prometheus
router.get('/metrics', async (req: Request, res: Response) => {
  try {
    const metrics = [
      `# HELP nodejs_heap_size_used_bytes Process heap space used in bytes`,
      `# TYPE nodejs_heap_size_used_bytes gauge`,
      `nodejs_heap_size_used_bytes ${process.memoryUsage().heapUsed}`,
      ``,
      `# HELP nodejs_heap_size_total_bytes Process heap space total in bytes`,
      `# TYPE nodejs_heap_size_total_bytes gauge`,
      `nodejs_heap_size_total_bytes ${process.memoryUsage().heapTotal}`,
      ``,
      `# HELP nodejs_external_memory_bytes Nodejs external memory size in bytes`,
      `# TYPE nodejs_external_memory_bytes gauge`,
      `nodejs_external_memory_bytes ${process.memoryUsage().external}`,
      ``,
      `# HELP process_uptime_seconds Number of seconds the process has been running`,
      `# TYPE process_uptime_seconds gauge`,
      `process_uptime_seconds ${process.uptime()}`,
      ``
    ].join('\n');

    res.set('Content-Type', 'text/plain');
    res.send(metrics);
  } catch (error) {
    logger.error('Metrics endpoint error:', error);
    res.status(500).json({ error: 'Failed to generate metrics' });
  }
});

export default router;