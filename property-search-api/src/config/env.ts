import { config } from 'dotenv';
import { z } from 'zod';

// Load environment variables from .env file
config();

// Enhanced environment schema with Zod validation
const envSchema = z.object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.string().default('3001').transform(Number),

    // Database
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required').refine(
        (url) => url.startsWith('postgresql://') || url.startsWith('postgres://'),
        'DATABASE_URL must be a valid PostgreSQL connection string'
    ),

    // Redis
    REDIS_URL: z.string().default('redis://localhost:6379').refine(
        (url) => url.startsWith('redis://') || url.startsWith('rediss://'),
        'REDIS_URL must be a valid Redis connection string'
    ),

    // Services
    EMBEDDING_SERVICE_URL: z.string().url().default('http://localhost:8001'),
    FRONTEND_URL: z.string().url().default('http://localhost:3000'),

    // Authentication
    JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters').default('dev_jwt_secret_fallback_12345678901234567890'),
    JWT_EXPIRES_IN: z.string().default('7d'),

    // External APIs
    GOOGLE_PLACES_API_KEY: z.string().optional(),
    MAPTILER_API_KEY: z.string().optional(),
    WHATSAPP_ACCESS_TOKEN: z.string().optional(),
    WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),

    // Email
    SMTP_HOST: z.string().default('smtp.gmail.com'),
    SMTP_PORT: z.string().default('587').transform(Number),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),

    // File Upload
    CLOUDINARY_CLOUD_NAME: z.string().optional(),
    CLOUDINARY_API_KEY: z.string().optional(),
    CLOUDINARY_API_SECRET: z.string().optional(),

    // Payments
    STRIPE_SECRET_KEY: z.string().optional(),
    STRIPE_WEBHOOK_SECRET: z.string().optional(),

    // Monitoring
    SENTRY_DSN: z.string().optional(),

    // CORS
    CORS_ORIGIN: z.string().default('*'),
});

// Function to get current environment variables
const getCurrentEnvVars = () => ({
    NODE_ENV: process.env.NODE_ENV,
    PORT: process.env.PORT,
    DATABASE_URL: process.env.DATABASE_URL || process.env.NEON_DATABASE_URL,
    REDIS_URL: process.env.REDIS_URL,
    EMBEDDING_SERVICE_URL: process.env.EMBEDDING_SERVICE_URL,
    FRONTEND_URL: process.env.FRONTEND_URL,
    JWT_SECRET: process.env.JWT_SECRET,
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN,
    GOOGLE_PLACES_API_KEY: process.env.GOOGLE_PLACES_API_KEY,
    MAPTILER_API_KEY: process.env.MAPTILER_API_KEY,
    WHATSAPP_ACCESS_TOKEN: process.env.WHATSAPP_ACCESS_TOKEN,
    WHATSAPP_PHONE_NUMBER_ID: process.env.WHATSAPP_PHONE_NUMBER_ID,
    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_PORT: process.env.SMTP_PORT,
    SMTP_USER: process.env.SMTP_USER,
    SMTP_PASS: process.env.SMTP_PASS,
    CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
    CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
    CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    SENTRY_DSN: process.env.SENTRY_DSN,
    CORS_ORIGIN: process.env.CORS_ORIGIN,
});

// Parse and validate environment variables (only in non-test environment)
let parsedEnv: any;
try {
    parsedEnv = envSchema.parse(getCurrentEnvVars());
} catch (error) {
    if (process.env.NODE_ENV !== 'test') {
        throw error;
    }
    // In test environment, provide minimal defaults
    parsedEnv = {
        NODE_ENV: 'test',
        PORT: 3001,
        DATABASE_URL: 'postgresql://test:test@localhost:5432/test_db',
        JWT_SECRET: 'test-jwt-secret-12345678901234567890',
        FRONTEND_URL: 'http://localhost:3000',
        EMBEDDING_SERVICE_URL: 'http://localhost:8001',
        JWT_EXPIRES_IN: '7d',
        REDIS_URL: 'redis://localhost:6379',
        SMTP_HOST: 'smtp.gmail.com',
        SMTP_PORT: 587,
        CORS_ORIGIN: '*',
    };
}

// Environment configuration with computed flags
export const env = {
    ...parsedEnv,
    // Development flags
    IS_DEVELOPMENT: parsedEnv.NODE_ENV === 'development',
    IS_PRODUCTION: parsedEnv.NODE_ENV === 'production',
    IS_TEST: parsedEnv.NODE_ENV === 'test',
};

// Type-safe environment variables
export type Env = typeof env;
export type ApiEnvironment = typeof env;

// Function to parse environment variables for testing
export const parseEnv = (): ApiEnvironment => {
    const result = envSchema.parse(getCurrentEnvVars());

    return {
        ...result,
        IS_DEVELOPMENT: result.NODE_ENV === 'development',
        IS_PRODUCTION: result.NODE_ENV === 'production',
        IS_TEST: result.NODE_ENV === 'test',
    };
};

// Validate required environment variables in production
if (env.IS_PRODUCTION) {
    const requiredVars = ['DATABASE_URL', 'JWT_SECRET'];
    const missingVars = requiredVars.filter(varName => !process.env[varName]);

    if (missingVars.length > 0) {
        throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
    }
}

// Log environment info (without sensitive data)
if (env.IS_DEVELOPMENT) {
    console.log('🔧 Environment Configuration:');
    console.log(`   NODE_ENV: ${env.NODE_ENV}`);
    console.log(`   PORT: ${env.PORT}`);
    console.log(`   DATABASE_URL: ${env.DATABASE_URL ? 'Set' : 'Not set'}`);
    console.log(`   FRONTEND_URL: ${env.FRONTEND_URL}`);
    console.log(`   EMBEDDING_SERVICE_URL: ${env.EMBEDDING_SERVICE_URL}`);
}