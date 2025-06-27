// Search Orchestrator with Advanced Connection Pool Integration
import { DatabaseService } from '../lib/database';
import { MeilisearchService } from './MeilisearchService';
import { SemanticSearchService } from './SemanticSearchService';
import { Logger } from '../lib/logger';

export interface SearchParams {
    query: string;
    location?: string;
    priceRange?: { min: number; max: number };
    propertyType?: string;
    bedrooms?: number;
    limit?: number;
    offset?: number;
    embedding?: number[];
}

export interface SearchResult {
    properties: unknown[];
    total: number;
    searchType: 'hybrid' | 'text' | 'vector' | 'fallback';
    responseTime: number;
    metadata: {
        textResults?: number;
        vectorResults?: number;
        poolStatus?: Record<string, unknown>;
        healthCheck?: boolean | Record<string, unknown>;
        error?: string;
    };
}

export class SearchOrchestrator {
    private database: DatabaseService;
    private meilisearch: MeilisearchService;
    private semanticSearch: SemanticSearchService;
    private logger: Logger;

    constructor(database: DatabaseService) {
        this.database = database;
        this.meilisearch = new MeilisearchService();
        this.semanticSearch = new SemanticSearchService(database);
        this.logger = new Logger('SearchOrchestrator');
    }

    async searchWithFallback(params: SearchParams): Promise<SearchResult> {
        const startTime = Date.now();

        try {
            // Check database health to determine search strategy
            const healthStatus = await this.database.getDetailedHealthStatus();
            const poolStatus = this.database.getPoolStatus();

            this.logger.info('Search orchestration started', {
                query: params.query?.substring(0, 50),
                healthStatus: healthStatus.isHealthy,
                poolUtilization: poolStatus.totalCount / 20, // Assuming max 20 connections
                activeConnections: poolStatus.totalCount
            });

            // Determine optimal search strategy based on pool health
            if (healthStatus.isHealthy && healthStatus.performance.averageQueryTime < 100) {
                return await this.hybridSearch(params, startTime);
            } else if (healthStatus.isHealthy && healthStatus.performance.averageQueryTime < 500) {
                return await this.textOnlySearch(params, startTime);
            } else if (healthStatus.isHealthy) {
                return await this.vectorOnlySearch(params, startTime);
            } else {
                return await this.fallbackSearch(params, startTime);
            }
        } catch (error) {
            this.logger.error('Search orchestration failed', {
                error: error instanceof Error ? error.message : String(error),
                params: { ...params, embedding: params.embedding ? '[VECTOR_DATA]' : undefined }
            });

            // Fallback to cached or simplified search
            return await this.fallbackSearch(params, startTime);
        }
    }

    private async hybridSearch(params: SearchParams, startTime: number): Promise<SearchResult> {
        this.logger.info('Executing hybrid search strategy');

        const client = await this.database.getClientWithRetry(3, 1000);

        try {
            // Execute both text and vector searches in parallel
            const [textResults, vectorResults] = await Promise.allSettled([
                this.meilisearch.search({
                    query: params.query,
                    filter: this.buildMeilisearchFilter(params),
                    limit: params.limit || 20
                }),
                this.semanticSearch.search(params, client)
            ]);

            const mergedResults = this.mergeResults(textResults, vectorResults);
            const responseTime = Date.now() - startTime;

            return {
                properties: mergedResults,
                total: mergedResults.length,
                searchType: 'hybrid',
                responseTime,
                metadata: {
                    textResults: textResults.status === 'fulfilled' ? textResults.value.hits?.length : 0,
                    vectorResults: vectorResults.status === 'fulfilled' ? vectorResults.value.length : 0,
                    poolStatus: this.database.getPoolStatus()
                }
            };
        } finally {
            client.release();
        }
    }

    private async textOnlySearch(params: SearchParams, startTime: number): Promise<SearchResult> {
        this.logger.info('Executing text-only search strategy');

        try {
            const results = await this.meilisearch.search({
                query: params.query,
                filter: this.buildMeilisearchFilter(params),
                limit: params.limit || 20
            });

            const responseTime = Date.now() - startTime;

            return {
                properties: results.hits || [],
                total: results.estimatedTotalHits || 0,
                searchType: 'text',
                responseTime,
                metadata: {
                    textResults: results.hits?.length || 0,
                    poolStatus: this.database.getPoolStatus()
                }
            };
        } catch (error) {
            this.logger.error('Text search failed', { error: error instanceof Error ? error.message : String(error) });
            return await this.fallbackSearch(params, startTime);
        }
    }

    private async vectorOnlySearch(params: SearchParams, startTime: number): Promise<SearchResult> {
        this.logger.info('Executing vector-only search strategy');

        if (!params.embedding) {
            // Generate embedding if not provided
            params.embedding = await this.generateEmbedding(params.query);
        }

        const client = await this.database.getClientWithRetry(2, 500);

        try {
            const results = await this.semanticSearch.search(params, client);
            const responseTime = Date.now() - startTime;

            return {
                properties: results,
                total: results.length,
                searchType: 'vector',
                responseTime,
                metadata: {
                    vectorResults: results.length,
                    poolStatus: this.database.getPoolStatus()
                }
            };
        } finally {
            client.release();
        }
    }

    private async fallbackSearch(params: SearchParams, startTime: number): Promise<SearchResult> {
        this.logger.warn('Executing fallback search strategy');

        try {
            // Use cached results or simplified database query
            const cachedResults = await this.getCachedResults(params);
            const responseTime = Date.now() - startTime;

            return {
                properties: cachedResults,
                total: cachedResults.length,
                searchType: 'fallback',
                responseTime,
                metadata: {
                    healthCheck: await this.database.healthCheck()
                }
            };
        } catch (error) {
            this.logger.error('Fallback search failed', { error: error instanceof Error ? error.message : String(error) });

            return {
                properties: [],
                total: 0,
                searchType: 'fallback',
                responseTime: Date.now() - startTime,
                metadata: {
                    error: 'All search strategies failed'
                }
            };
        }
    }

    private mergeResults(textResults: PromiseSettledResult<any>, vectorResults: PromiseSettledResult<any>): any[] {
        const merged = new Map();
        const textHits = textResults.status === 'fulfilled' ? textResults.value.hits || [] : [];
        const vectorHits = vectorResults.status === 'fulfilled' ? vectorResults.value || [] : [];

        // Add text search results with text relevance score
        textHits.forEach((hit: any, index: number) => {
            merged.set(hit.id, {
                ...hit,
                textScore: 1 - (index / textHits.length), // Higher score for earlier results
                vectorScore: 0,
                combinedScore: 1 - (index / textHits.length)
            });
        });

        // Add or enhance with vector search results
        vectorHits.forEach((hit: Record<string, unknown>, _index: number) => {
            const existing = merged.get(hit.id);
            const vectorScore = 1 - (typeof hit.similarity_score === 'number' ? hit.similarity_score : 0); // Assuming similarity_score is distance

            if (existing) {
                // Combine scores for properties found in both searches
                existing.vectorScore = vectorScore;
                existing.combinedScore = (existing.textScore * 0.6) + (vectorScore * 0.4);
            } else {
                // Add vector-only results
                merged.set(hit.id, {
                    ...hit,
                    textScore: 0,
                    vectorScore,
                    combinedScore: vectorScore * 0.4 // Lower weight for vector-only
                });
            }
        });

        // Sort by combined score and return top results
        return Array.from(merged.values())
            .sort((a, b) => b.combinedScore - a.combinedScore)
            .slice(0, 20);
    }

    private buildMeilisearchFilter(params: SearchParams): string[] {
        const filters: string[] = [];

        if (params.location) {
            filters.push(`location = "${params.location}"`);
        }

        if (params.priceRange) {
            filters.push(`price >= ${params.priceRange.min} AND price <= ${params.priceRange.max}`);
        }

        if (params.propertyType) {
            filters.push(`property_type = "${params.propertyType}"`);
        }

        if (params.bedrooms) {
            filters.push(`bedrooms = ${params.bedrooms}`);
        }

        return filters;
    }

    private async generateEmbedding(query: string): Promise<number[]> {
        // This would integrate with your embedding service
        // For now, return a mock embedding
        this.logger.info('Generating embedding for query', { query: query.substring(0, 50) });

        try {
            // TODO: Integrate with actual embedding service
            // const response = await fetch(process.env.EMBEDDING_SERVICE_URL, {
            //     method: 'POST',
            //     headers: { 'Content-Type': 'application/json' },
            //     body: JSON.stringify({ text: query })
            // });
            // return await response.json();

            // Mock embedding for now
            return new Array(384).fill(0).map(() => Math.random() - 0.5);
        } catch (error) {
            this.logger.error('Embedding generation failed', { error: error instanceof Error ? error.message : String(error) });
            throw new Error('Failed to generate embedding');
        }
    }

    private async getCachedResults(_params: SearchParams): Promise<unknown[]> {
        // Implement caching logic here
        // For now, return empty array
        this.logger.info('Retrieving cached results', { query: _params.query?.substring(0, 50) });
        return [];
    }

    // Health monitoring method
    async getSearchHealth(): Promise<{
        database: Record<string, unknown>;
        meilisearch: Record<string, unknown>;
        overall: 'healthy' | 'degraded' | 'unhealthy';
    }> {
        const [dbHealth, meilisearchHealth] = await Promise.allSettled([
            this.database.getDetailedHealthStatus(),
            this.meilisearch.health()
        ]);

        const dbHealthy = dbHealth.status === 'fulfilled' && dbHealth.value.isHealthy;
        const meilisearchHealthy = meilisearchHealth.status === 'fulfilled';

        let overall: 'healthy' | 'degraded' | 'unhealthy';
        if (dbHealthy && meilisearchHealthy) {
            overall = 'healthy';
        } else if (dbHealthy || meilisearchHealthy) {
            overall = 'degraded';
        } else {
            overall = 'unhealthy';
        }

        return {
            database: dbHealth.status === 'fulfilled' ? dbHealth.value : { error: dbHealth.reason },
            meilisearch: meilisearchHealth.status === 'fulfilled' ? { status: 'healthy' } : { error: meilisearchHealth.reason },
            overall
        };
    }
}