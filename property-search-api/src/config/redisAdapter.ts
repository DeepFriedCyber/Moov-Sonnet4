import { Redis } from 'ioredis';
import { logger } from '../utils/logger';

let redisClient: Redis | null = null;

export const connectRedisIORedis = async (): Promise<Redis> => {
  if (redisClient && redisClient.status === 'ready') {
    return redisClient;
  }

  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

  try {
    redisClient = new Redis(redisUrl, {
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      reconnectOnError: (err) => {
        const targetError = 'READONLY';
        return err.message.includes(targetError);
      },
    });

    redisClient.on('error', (error) => {
      logger.error('Redis IORedis Client Error:', error);
    });

    redisClient.on('connect', () => {
      logger.info('✅ Redis IORedis connected successfully');
    });

    redisClient.on('reconnecting', () => {
      logger.info('Redis IORedis reconnecting...');
    });

    redisClient.on('ready', () => {
      logger.info('Redis IORedis client ready');
    });

    await redisClient.connect();
    
    // Test the connection
    await redisClient.ping();
    
    return redisClient;
  } catch (error) {
    logger.error('❌ Redis IORedis connection failed:', error);
    throw error;
  }
};

export const getRedisIORedisClient = (): Redis => {
  if (!redisClient || redisClient.status !== 'ready') {
    throw new Error('Redis IORedis not initialized. Call connectRedisIORedis() first.');
  }
  return redisClient;
};

export const closeRedisIORedisConnection = async (): Promise<void> => {
  if (redisClient && redisClient.status === 'ready') {
    await redisClient.quit();
    redisClient = null;
    logger.info('Redis IORedis connection closed');
  }
};

// Handle graceful shutdown
process.on('SIGINT', async () => {
  await closeRedisIORedisConnection();
});

process.on('SIGTERM', async () => {
  await closeRedisIORedisConnection();
});