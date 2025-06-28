// ============================================================================
// Enhanced Search Routes with Embedding Integration
// ============================================================================

import { Router, Request, Response } from 'express';
import { EnhancedEmbeddingService } from '../services/embeddingService';
import { EnhancedPropertySearchService } from '../services/enhancedPropertySearchService';

const router = Router();

// Initialize services (you'll need to inject your database service)
const embeddingService = new EnhancedEmbeddingService();

// Demo route to test embedding generation
router.post('/test-embedding', async (req: Request, res: Response) => {
    try {
        const { query } = req.body;

        if (!query) {
            return res.status(400).json({
                success: false,
                error: 'Query is required'
            });
        }

        const startTime = Date.now();
        const embedding = await embeddingService.generateEmbedding(query);
        const processingTime = Date.now() - startTime;

        const cacheStats = await embeddingService.getCacheStats();
        const performanceStats = embeddingService.getPerformanceStats();

        res.json({
            success: true,
            data: {
                query,
                embedding_dimension: embedding.length,
                processing_time_ms: processingTime,
                cache_stats: cacheStats,
                performance_stats: performanceStats
            }
        });

    } catch (error: any) {
        console.error('Embedding test failed:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Health check for embedding service
router.get('/embedding-health', async (req: Request, res: Response) => {
    try {
        const isHealthy = await embeddingService.checkHealth();
        const performanceStats = embeddingService.getPerformanceStats();
        const cacheStats = await embeddingService.getCacheStats();

        res.json({
            success: true,
            data: {
                embedding_service_healthy: isHealthy,
                performance_stats: performanceStats,
                cache_stats: cacheStats,
                timestamp: new Date().toISOString()
            }
        });

    } catch (error: any) {
        console.error('Embedding health check failed:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Batch embedding generation for property indexing
router.post('/batch-embeddings', async (req: Request, res: Response) => {
    try {
        const { queries } = req.body;

        if (!queries || !Array.isArray(queries)) {
            return res.status(400).json({
                success: false,
                error: 'Queries array is required'
            });
        }

        if (queries.length > 50) {
            return res.status(400).json({
                success: false,
                error: 'Maximum 50 queries per batch'
            });
        }

        const startTime = Date.now();
        const embeddings = await embeddingService.batchGenerateEmbeddings(queries);
        const processingTime = Date.now() - startTime;

        const cacheStats = await embeddingService.getCacheStats();

        res.json({
            success: true,
            data: {
                queries_processed: queries.length,
                embeddings_generated: embeddings.length,
                processing_time_ms: processingTime,
                average_time_per_query: processingTime / queries.length,
                cache_stats: cacheStats
            }
        });

    } catch (error: any) {
        console.error('Batch embedding generation failed:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Analytics endpoint
router.get('/analytics', async (req: Request, res: Response) => {
    try {
        const performanceStats = embeddingService.getPerformanceStats();
        const cacheStats = await embeddingService.getCacheStats();

        // Calculate cost savings and efficiency metrics
        const totalRequests = parseInt(performanceStats.totalRequests);
        const cacheHitRate = parseFloat(performanceStats.cacheHitRate);
        const avgResponseTime = parseFloat(performanceStats.avgResponseTime);

        const costPerRequest = 0.0001; // $0.0001 per request
        const totalCostWithoutCache = totalRequests * costPerRequest;
        const actualCost = totalCostWithoutCache * (1 - cacheHitRate / 100);
        const costSaved = totalCostWithoutCache - actualCost;

        res.json({
            success: true,
            data: {
                performance: {
                    total_requests: totalRequests,
                    cache_hit_rate_percent: cacheHitRate,
                    average_response_time_ms: avgResponseTime,
                    errors: performanceStats.errors,
                    service_healthy: performanceStats.isHealthy
                },
                cost_analysis: {
                    total_cost_without_cache: totalCostWithoutCache.toFixed(4),
                    actual_cost: actualCost.toFixed(4),
                    cost_saved: costSaved.toFixed(4),
                    savings_percentage: ((costSaved / totalCostWithoutCache) * 100).toFixed(1)
                },
                cache_performance: cacheStats,
                timestamp: new Date().toISOString()
            }
        });

    } catch (error: any) {
        console.error('Analytics retrieval failed:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

export default router;