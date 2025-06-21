import { config } from 'dotenv';

// Load environment variables from .env file
config();

// Environment configuration with defaults
export const env = {
    NODE_ENV: process.env.NODE_ENV || 'development',
    PORT: parseInt(process.env.PORT || '3001', 10),

    // Database
    DATABASE_URL: process.env.DATABASE_URL || process.env.NEON_DATABASE_URL,

    // Redis
    REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',

    // Services
    EMBEDDING_SERVICE_URL: process.env.EMBEDDING_SERVICE_URL || 'http://localhost:8001',
    FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3000',

    // Authentication
    JWT_SECRET: process.env.JWT_SECRET || 'dev_jwt_secret_fallback',
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',

    // External APIs
    GOOGLE_PLACES_API_KEY: process.env.GOOGLE_PLACES_API_KEY,
    MAPTILER_API_KEY: process.env.MAPTILER_API_KEY,
    WHATSAPP_ACCESS_TOKEN: process.env.WHATSAPP_ACCESS_TOKEN,
    WHATSAPP_PHONE_NUMBER_ID: process.env.WHATSAPP_PHONE_NUMBER_ID,

    // Email
    SMTP_HOST: process.env.SMTP_HOST || 'smtp.gmail.com',
    SMTP_PORT: parseInt(process.env.SMTP_PORT || '587', 10),
    SMTP_USER: process.env.SMTP_USER,
    SMTP_PASS: process.env.SMTP_PASS,

    // File Upload
    CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
    CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
    CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,

    // Payments
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,

    // Monitoring
    SENTRY_DSN: process.env.SENTRY_DSN,

    // Development flags
    IS_DEVELOPMENT: process.env.NODE_ENV === 'development',
    IS_PRODUCTION: process.env.NODE_ENV === 'production',
    IS_TEST: process.env.NODE_ENV === 'test',
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