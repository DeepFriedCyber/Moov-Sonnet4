/**
 * Rate Limiting Integration Example
 * 
 * This example demonstrates how to integrate the comprehensive rate limiting system
 * into your property search API with monitoring and analytics.
 */

import express from 'express';
import { Redis } from 'ioredis';
import { PropertyRateLimiter } from '../middleware/PropertyRateLimiter';
import { RateLimitMonitor } from '../middleware/RateLimitMonitor';
import { EventEmitter } from 'events';

const app = express();
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const eventEmitter = new EventEmitter();

// Initialize rate limiting components
const propertyLimiter = new PropertyRateLimiter(redis);
const rateLimitMonitor = new RateLimitMonitor(redis, eventEmitter);

// Set up event listeners for monitoring
eventEmitter.on('rateLimitViolation', (violation) => {
    console.log('🚨 Rate limit violation detected:', {
        ip: violation.ip,
        endpoint: violation.endpoint,
        requestsInWindow: violation.requestsInWindow,
        limit: violation.limit
    });
});

eventEmitter.on('suspiciousActivity', (activity) => {
    console.log('⚠️ Suspicious activity detected:', {
        type: activity.type,
        ip: activity.ip,
        violationCount: activity.violationCount
    });

    // Here you could implement additional security measures:
    // - Send alerts to security team
    // - Temporarily block the IP
    // - Increase monitoring for this IP
});

// Apply rate limiting to different property endpoints
app.use('/api/properties/search', propertyLimiter.searchLimiter());
app.use('/api/properties/:id', propertyLimiter.detailsLimiter());
app.use('/api/properties/favorites', propertyLimiter.favoritesLimiter());

// Property search endpoint
app.get('/api/properties/search', async (req, res) => {
    // Your existing search logic here - destructure but don't use in this example
    // const { q, location, minPrice, maxPrice } = req.query;

    // Simulate search results
    const results = {
        properties: [
            { id: 1, title: 'Modern Apartment', price: 250000, location: 'London' },
            { id: 2, title: 'Victorian House', price: 450000, location: 'Manchester' }
        ],
        total: 2,
        page: 1
    };

    res.json({ success: true, data: results });
});

// Property details endpoint
app.get('/api/properties/:id', async (req, res) => {
    const { id } = req.params;

    // Simulate property details
    const property = {
        id: parseInt(id),
        title: 'Modern Apartment',
        description: 'Beautiful modern apartment in the heart of the city',
        price: 250000,
        bedrooms: 2,
        bathrooms: 1,
        location: 'London',
        images: ['image1.jpg', 'image2.jpg']
    };

    res.json({ success: true, data: property });
});

// Favorites endpoint (write operation)
app.post('/api/properties/favorites', async (req, res) => {
    const { propertyId } = req.body;

    // Simulate adding to favorites
    res.json({
        success: true,
        message: `Property ${propertyId} added to favorites`
    });
});

// Admin endpoints for monitoring
app.get('/api/admin/rate-limit-stats', async (req, res) => {
    try {
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
        res.status(500).json({
            success: false,
            error: 'Failed to fetch rate limit statistics'
        });
    }
});

// Health check endpoint
app.get('/health/rate-limiting', async (req, res) => {
    try {
        await redis.ping();

        res.json({
            success: true,
            data: {
                redis: true,
                rateLimiting: true,
                monitoring: true,
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        res.json({
            success: false,
            data: {
                redis: false,
                rateLimiting: false,
                monitoring: false,
                error: error instanceof Error ? error.message : 'Unknown error occurred',
                timestamp: new Date().toISOString()
            }
        });
    }
});

// Error handling middleware
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (error.status === 429) {
        // Rate limit exceeded
        res.status(429).json({
            error: 'Rate limit exceeded',
            message: 'Too many requests. Please try again later.',
            retryAfter: error.retryAfter
        });
    } else {
        next(error);
    }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Rate limiting example server running on port ${PORT}`);
    console.log(`📊 Rate limit stats: http://localhost:${PORT}/api/admin/rate-limit-stats`);
    console.log(`🔍 Health check: http://localhost:${PORT}/health/rate-limiting`);
    console.log(`🏠 Property search: http://localhost:${PORT}/api/properties/search?q=apartment&location=London`);
});

export default app;