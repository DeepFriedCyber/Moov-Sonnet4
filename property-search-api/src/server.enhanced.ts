import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import rateLimit from 'express-rate-limit';

import { env } from './config/env';
import { logger } from './utils/logger';
import { connectDatabase } from './config/database';
import { connectRedis } from './config/redis';

// Enhanced Connection Pool Extensions
import { PropertyPoolManager } from './database/PropertyPoolManager';
import { SearchOrchestrator } from './services/SearchOrchestrator';
import { OptimizedPropertyService } from './services/OptimizedPropertyService';
import { PoolMetricsMiddleware } from './middleware/poolMetrics';
import { createAdvancedHealthRouter } from './routes/advancedHealth';
import { MeilisearchService } from './services/MeilisearchService';

// Routes
import authRoutes from './routes/auth';
import propertyRoutes from './routes/properties';
import searchRoutes from './routes/search';
import chatRoutes from './routes/chat';
import webhookRoutes from './routes/webhooks';
import healthRoutes from './routes/health';

const app = express();
const server = createServer(app);
const io = new SocketIOServer(server, {
    cors: {
        origin: env.FRONTEND_URL,
        methods: ['GET', 'POST']
    }
});

// Initialize Enhanced Connection Pool Manager
const poolManager = new PropertyPoolManager({
    connectionString: env.DATABASE_URL,
    maxConnections: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    enableSSL: env.NODE_ENV === 'production',
    autoScaling: {
        enabled: true,
        minConnections: 5,
        maxConnections: 50,
        scaleUpThreshold: 0.7,
        scaleDownThreshold: 0.3,
        scaleUpIncrement: 5,
        scaleDownIncrement: 2,
        cooldownPeriod: 60000, // 1 minute
        peakHours: [9, 12, 17, 19], // UK property search peak hours
        offPeakHours: [2, 3, 4, 5, 6]
    }
});

// Initialize Enhanced Services
const searchOrchestrator = new SearchOrchestrator(poolManager);
const propertyService = new OptimizedPropertyService(poolManager);
const meilisearchService = new MeilisearchService();
const metricsMiddleware = new PoolMetricsMiddleware(poolManager);

// Middleware
app.use(helmet());
app.use(compression());
app.use(cors({
    origin: env.FRONTEND_URL,
    credentials: true
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP'
});
app.use(limiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Enhanced Pool Metrics Middleware
app.use(metricsMiddleware.middleware());

// Enhanced Health Routes (with advanced monitoring)
app.use('/health', createAdvancedHealthRouter({
    database: poolManager,
    searchOrchestrator,
    propertyService,
    meilisearch: meilisearchService
}));

// Original Routes
app.use('/api/auth', authRoutes);
app.use('/api/properties', propertyRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/webhooks', webhookRoutes);

// Original Health routes (for backward compatibility)
app.use('/', healthRoutes);

// Enhanced Property Search Endpoint (example of integration)
app.get('/api/properties/enhanced-search', async (req, res) => {
    const startTime = Date.now();

    try {
        const searchParams = {
            query: req.query.q as string,
            location: req.query.location as string,
            priceRange: {
                min: parseInt(req.query.minPrice as string) || 0,
                max: parseInt(req.query.maxPrice as string) || Infinity
            },
            propertyType: req.query.type as string,
            bedrooms: parseInt(req.query.bedrooms as string),
            bathrooms: parseInt(req.query.bathrooms as string),
            limit: parseInt(req.query.limit as string) || 20,
            offset: parseInt(req.query.offset as string) || 0
        };

        logger.info('Enhanced property search request', {
            params: searchParams,
            userAgent: req.get('User-Agent'),
            ip: req.ip
        });

        // Use the search orchestrator for intelligent routing
        const result = await searchOrchestrator.searchWithFallback(searchParams);

        const responseTime = Date.now() - startTime;

        res.json({
            success: true,
            data: result.properties,
            metadata: {
                searchType: result.searchType,
                responseTime,
                totalResults: result.totalResults,
                poolStatus: result.metadata?.poolStatus,
                recommendations: result.metadata?.recommendations,
                pagination: {
                    limit: searchParams.limit,
                    offset: searchParams.offset,
                    hasMore: result.properties.length === searchParams.limit
                }
            }
        });

        logger.info('Enhanced property search completed', {
            searchType: result.searchType,
            resultCount: result.properties.length,
            responseTime,
            poolUtilization: result.metadata?.poolUtilization
        });

    } catch (error) {
        const responseTime = Date.now() - startTime;

        logger.error('Enhanced property search failed', {
            error: error.message,
            responseTime,
            params: req.query
        });

        res.status(500).json({
            success: false,
            error: 'Search temporarily unavailable',
            metadata: {
                responseTime,
                errorType: error.name
            }
        });
    }
});

// Admin Metrics Endpoint
app.get('/api/admin/metrics', async (req, res) => {
    try {
        const [
            poolHealth,
            searchHealth,
            propertyServiceHealth,
            meilisearchMetrics
        ] = await Promise.all([
            poolManager.getPropertyPlatformHealth(),
            searchOrchestrator.getSearchHealth(),
            propertyService.getServiceHealth(),
            meilisearchService.getMetrics()
        ]);

        res.json({
            timestamp: new Date().toISOString(),
            platform: {
                status: poolHealth.status,
                uptime: process.uptime(),
                version: process.env.npm_package_version
            },
            database: {
                poolHealth: poolHealth.poolHealth,
                scalingHealth: poolHealth.scalingHealth,
                recommendations: poolHealth.recommendations
            },
            search: {
                orchestrator: searchHealth,
                propertyService: propertyServiceHealth,
                meilisearch: meilisearchMetrics
            },
            performance: {
                memoryUsage: process.memoryUsage(),
                cpuUsage: process.cpuUsage()
            }
        });

    } catch (error) {
        logger.error('Metrics fetch failed', { error: error.message });

        res.status(500).json({
            success: false,
            error: 'Unable to fetch metrics'
        });
    }
});

// Socket.IO for real-time chat
io.on('connection', (socket) => {
    logger.info(`Client connected: ${socket.id}`);

    socket.on('join_chat', (data) => {
        socket.join(`chat_${data.chatId}`);
    });

    socket.on('send_message', async (data) => {
        // Handle chat message
        io.to(`chat_${data.chatId}`).emit('new_message', data);
    });

    socket.on('disconnect', () => {
        logger.info(`Client disconnected: ${socket.id}`);
    });
});

// Error handling
app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    logger.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// Graceful shutdown handling
process.on('SIGTERM', async () => {
    logger.info('Received SIGTERM, shutting down gracefully');

    try {
        await poolManager.shutdown();
        logger.info('Pool manager shut down successfully');
        process.exit(0);
    } catch (error) {
        logger.error('Error during shutdown', { error: error.message });
        process.exit(1);
    }
});

// Enhanced Start Server Function
async function startServer() {
    try {
        // Initialize original database connection
        await connectDatabase();
        await connectRedis();

        // Initialize the enhanced pool manager
        await poolManager.initialize();
        logger.info('Enhanced pool manager initialized successfully');

        // Setup event listeners for monitoring
        poolManager.on('poolScaled', (event) => {
            logger.info('Pool scaling event', {
                action: event.action,
                reason: event.reason,
                oldMax: event.oldMax,
                newMax: event.newMax,
                utilization: event.metrics.poolUtilization
            });
        });

        poolManager.on('slowQuery', (queryInfo) => {
            logger.warn('Slow query detected', {
                duration: queryInfo.duration,
                query: queryInfo.query.substring(0, 100),
                suggestions: queryInfo.optimizationSuggestions
            });
        });

        poolManager.on('highUtilization', (metrics) => {
            logger.warn('High pool utilization detected', {
                utilization: metrics.poolUtilization,
                activeConnections: metrics.activeConnections,
                waitingRequests: metrics.waitingRequests
            });
        });

        const port = env.PORT || 8000;
        server.listen(port, () => {
            logger.info(`🚀 Enhanced Property Search API server started on port ${port}`, {
                environment: env.NODE_ENV,
                poolConfig: {
                    maxConnections: poolManager.getScalingConfig()?.maxConnections,
                    autoScalingEnabled: poolManager.getScalingConfig()?.enabled
                }
            });
            logger.info(`📊 Health check: http://localhost:${port}/health`);
            logger.info(`🔍 Advanced health: http://localhost:${port}/health/advanced`);
            logger.info(`📈 Pool metrics: http://localhost:${port}/health/pool`);
            logger.info(`🎯 Enhanced search: http://localhost:${port}/api/properties/enhanced-search`);
            logger.info(`📊 Admin metrics: http://localhost:${port}/api/admin/metrics`);
        });
    } catch (error) {
        logger.error('Failed to start enhanced server:', error);
        process.exit(1);
    }
}

// Start the enhanced server
startServer();

// Export for testing
export { app, poolManager, searchOrchestrator, propertyService };