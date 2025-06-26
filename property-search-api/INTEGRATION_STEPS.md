# 🔧 Step-by-Step Integration Guide

## Option 1: Quick Start with Enhanced Server

The easiest way to get started is to use our enhanced server that includes all the new features:

### 1. Backup Your Current Server
```bash
cp src/server.ts src/server.backup.ts
```

### 2. Use the Enhanced Server
```bash
cp src/server.enhanced.ts src/server.ts
```

### 3. Update Environment Variables
Add these to your `.env` file:
```bash
# Meilisearch Configuration (optional)
MEILISEARCH_HOST=http://localhost:7700
MEILISEARCH_API_KEY=your_api_key
MEILISEARCH_INDEX=properties

# Embedding Service (optional)
EMBEDDING_SERVICE_URL=http://localhost:8001
```

### 4. Start Your Server
```bash
npm run dev
```

### 5. Test the New Endpoints
- **Advanced Health**: http://localhost:8000/health/advanced
- **Pool Metrics**: http://localhost:8000/health/pool
- **Enhanced Search**: http://localhost:8000/api/properties/enhanced-search
- **Admin Metrics**: http://localhost:8000/api/admin/metrics

---

## Option 2: Manual Integration (Recommended for Production)

If you prefer to integrate manually into your existing server:

### Step 1: Add Imports to Your server.ts

```typescript
// Add these imports after your existing imports
import { PropertyPoolManager } from './database/PropertyPoolManager';
import { SearchOrchestrator } from './services/SearchOrchestrator';
import { OptimizedPropertyService } from './services/OptimizedPropertyService';
import { PoolMetricsMiddleware } from './middleware/poolMetrics';
import { createAdvancedHealthRouter } from './routes/advancedHealth';
import { MeilisearchService } from './services/MeilisearchService';
```

### Step 2: Initialize Services

Add this after your existing app initialization:

```typescript
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
        cooldownPeriod: 60000,
        peakHours: [9, 12, 17, 19], // UK property search peak hours
        offPeakHours: [2, 3, 4, 5, 6]
    }
});

// Initialize Enhanced Services
const searchOrchestrator = new SearchOrchestrator(poolManager);
const propertyService = new OptimizedPropertyService(poolManager);
const meilisearchService = new MeilisearchService();
const metricsMiddleware = new PoolMetricsMiddleware(poolManager);
```

### Step 3: Add Middleware

Add this after your existing middleware:

```typescript
// Enhanced Pool Metrics Middleware
app.use(metricsMiddleware.middleware());
```

### Step 4: Add Enhanced Health Routes

Add this before your existing routes:

```typescript
// Enhanced Health Routes (with advanced monitoring)
app.use('/health', createAdvancedHealthRouter({
    database: poolManager,
    searchOrchestrator,
    propertyService,
    meilisearch: meilisearchService
}));
```

### Step 5: Update Your startServer Function

Replace your existing startServer function with:

```typescript
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
    });
  } catch (error) {
    logger.error('Failed to start enhanced server:', error);
    process.exit(1);
  }
}
```

### Step 6: Add Graceful Shutdown

Add this before your startServer function:

```typescript
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
```

---

## Option 3: Gradual Integration

If you want to integrate gradually:

### Phase 1: Add Health Monitoring
1. Add the `PoolMetricsMiddleware`
2. Add the `createAdvancedHealthRouter`
3. Test the health endpoints

### Phase 2: Add Enhanced Search
1. Add the `SearchOrchestrator`
2. Create a new enhanced search endpoint
3. Test alongside your existing search

### Phase 3: Add Property Service
1. Add the `OptimizedPropertyService`
2. Integrate with your property routes
3. Monitor performance improvements

### Phase 4: Full Integration
1. Replace existing database connections with `PropertyPoolManager`
2. Update all routes to use the new services
3. Monitor and optimize

---

## 🧪 Testing Your Integration

### 1. Run the Tests
```bash
npm test src/__tests__/unit/connection-pool-extensions.test.ts
```

### 2. Test Health Endpoints
```bash
# Basic health check
curl http://localhost:8000/health/advanced

# Pool-specific health
curl http://localhost:8000/health/pool

# Comprehensive health
curl http://localhost:8000/health/comprehensive
```

### 3. Test Enhanced Search
```bash
# Enhanced property search
curl "http://localhost:8000/api/properties/enhanced-search?q=apartment&location=London&minPrice=200000&maxPrice=500000"
```

### 4. Monitor Metrics
```bash
# Admin metrics
curl http://localhost:8000/api/admin/metrics
```

---

## 🚨 Important Notes

### Database Compatibility
- The new `PropertyPoolManager` is compatible with your existing database
- It extends your current connection pooling with auto-scaling
- No schema changes required

### Backward Compatibility
- All existing endpoints continue to work
- New features are additive, not replacing
- You can run both old and new systems side by side

### Environment Variables
- Most features work with your existing environment
- Optional services (Meilisearch, Embedding) can be disabled
- The system gracefully handles missing optional dependencies

### Performance Impact
- Minimal overhead for monitoring
- Significant performance gains under load
- Auto-scaling reduces response times during peak hours

---

## 🎯 Next Steps After Integration

1. **Monitor the Logs**: Watch for scaling events and performance metrics
2. **Set Up Alerts**: Configure alerts based on the health endpoints
3. **Tune Parameters**: Adjust scaling thresholds based on your traffic patterns
4. **Dashboard Integration**: Use the metrics endpoints to create monitoring dashboards
5. **Load Testing**: Test the auto-scaling under realistic load conditions

---

## 🆘 Troubleshooting

### Common Issues

1. **Import Errors**: Make sure all new files are in the correct locations
2. **Environment Variables**: Check that DATABASE_URL is properly set
3. **Port Conflicts**: Ensure no other services are using the same ports
4. **Permission Issues**: Check database connection permissions

### Getting Help

- Check the comprehensive test suite for usage examples
- Review the `IMPLEMENTATION_GUIDE.md` for detailed documentation
- Look at `src/examples/integration-example.ts` for complete examples

### Rollback Plan

If you need to rollback:
1. Restore your original `server.ts` from backup
2. Remove the new service imports
3. Restart your server

The new extensions are designed to be completely optional and non-breaking!