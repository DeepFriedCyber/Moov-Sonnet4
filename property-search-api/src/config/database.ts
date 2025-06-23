import { Pool } from 'pg';
import { logger } from '../lib/logger';
import { env } from './env';

let pool: Pool | null = null;

export const connectDatabase = async (): Promise<Pool> => {
    if (pool) {
        return pool;
    }

    try {
        pool = new Pool({
            connectionString: env.DATABASE_URL,
            ssl: env.IS_PRODUCTION ? {
                rejectUnauthorized: false
            } : false,
            max: 20,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000,
        });

        // Test the connection
        await pool.query('SELECT NOW()');
        logger.info('✅ Database connected successfully');

        return pool;
    } catch (error) {
        logger.error('❌ Database connection failed:', error);
        throw error;
    }
};

export const getDatabase = (): Pool => {
    if (!pool) {
        throw new Error('Database not initialized. Call connectDatabase() first.');
    }
    return pool;
};

export const closeDatabaseConnection = async (): Promise<void> => {
    if (pool) {
        await pool.end();
        pool = null;
        logger.info('Database connection closed');
    }
};

// Handle graceful shutdown
process.on('SIGINT', async () => {
    await closeDatabaseConnection();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    await closeDatabaseConnection();
    process.exit(0);
});