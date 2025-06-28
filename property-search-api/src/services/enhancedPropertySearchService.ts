// ============================================================================
// Enhanced Property Search Service with Cached Embeddings
// ============================================================================

import { EnhancedEmbeddingService } from './embeddingService';
import { Property } from '../types';

export interface SearchFilters {
    location?: string;
    minPrice?: number;
    maxPrice?: number;
    bedrooms?: number;
    propertyType?: 'house' | 'flat' | 'studio' | 'commercial';
    radius?: number; // in km
}

export interface SearchQuery {
    query: string;
    filters?: SearchFilters;
    limit?: number;
    offset?: number;
}

export interface SearchResult {
    properties: Property[];
    total: number;
    searchId: string;
    processingTime: number;
    cacheStats?: any;
    performance: {
        embeddingTime: number;
        searchTime: number;
        totalTime: number;
        fromCache: boolean;
    };
}

export class EnhancedPropertySearchService {
    private embeddingService: EnhancedEmbeddingService;

    constructor(
        private database: any, // Your database service
        embeddingServiceUrl?: string
    ) {
        this.embeddingService = new EnhancedEmbeddingService(embeddingServiceUrl);
    }

    async searchProperties(searchQuery: SearchQuery): Promise<SearchResult> {
        const startTime = Date.now();
        const searchId = this.generateSearchId();

        console.log('Starting property search', {
            searchId,
            query: searchQuery.query,
            filters: searchQuery.filters
        });

        try {
            // Step 1: Generate query embedding with caching
            const embeddingStartTime = Date.now();
            const queryEmbedding = await this.embeddingService.generateEmbedding(searchQuery.query);
            const embeddingTime = Date.now() - embeddingStartTime;

            // Step 2: Search database using embedding similarity
            const searchStartTime = Date.now();
            const { properties, total } = await this.performDatabaseSearch(
                queryEmbedding,
                searchQuery.filters,
                searchQuery.limit || 20,
                searchQuery.offset || 0
            );
            const searchTime = Date.now() - searchStartTime;

            // Step 3: Get cache performance stats
            const cacheStats = await this.embeddingService.getCacheStats();
            const performanceStats = this.embeddingService.getPerformanceStats();

            const totalTime = Date.now() - startTime;

            console.log('Property search completed', {
                searchId,
                resultsCount: properties.length,
                totalMatches: total,
                processingTime: totalTime,
                embeddingTime,
                searchTime,
                cacheHitRate: performanceStats.cacheHitRate
            });

            return {
                properties,
                total,
                searchId,
                processingTime: totalTime,
                cacheStats,
                performance: {
                    embeddingTime,
                    searchTime,
                    totalTime,
                    fromCache: parseFloat(performanceStats.cacheHitRate) > 0
                }
            };

        } catch (error: any) {
            console.error('Property search failed', {
                searchId,
                error: error.message,
                processingTime: Date.now() - startTime
            });

            throw error;
        }
    }

    private async performDatabaseSearch(
        queryEmbedding: number[],
        filters?: SearchFilters,
        limit: number = 20,
        offset: number = 0
    ): Promise<{ properties: Property[], total: number }> {

        // Build SQL query with vector similarity search
        let query = `
      SELECT 
        p.*,
        (1 - (p.embedding <=> $1::vector)) as similarity_score
      FROM properties p
      WHERE 1=1
    `;

        const params: any[] = [JSON.stringify(queryEmbedding)];
        let paramIndex = 2;

        // Add filters
        if (filters?.location) {
            query += ` AND LOWER(p.location) LIKE LOWER($${paramIndex})`;
            params.push(`%${filters.location}%`);
            paramIndex++;
        }

        if (filters?.minPrice) {
            query += ` AND p.price >= $${paramIndex}`;
            params.push(filters.minPrice);
            paramIndex++;
        }

        if (filters?.maxPrice) {
            query += ` AND p.price <= $${paramIndex}`;
            params.push(filters.maxPrice);
            paramIndex++;
        }

        if (filters?.bedrooms) {
            query += ` AND p.bedrooms = $${paramIndex}`;
            params.push(filters.bedrooms);
            paramIndex++;
        }

        if (filters?.propertyType) {
            query += ` AND p.property_type = $${paramIndex}`;
            params.push(filters.propertyType);
            paramIndex++;
        }

        // Add similarity threshold and ordering
        query += ` 
      AND (1 - (p.embedding <=> $1::vector)) > 0.3
      ORDER BY similarity_score DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

        params.push(limit, offset);

        // Execute search
        const results = await this.database.query(query, params);

        // Get total count for pagination
        const countQuery = query.replace(/SELECT.*?FROM/, 'SELECT COUNT(*) as total FROM')
            .replace(/ORDER BY.*$/, '');
        const countResult = await this.database.query(countQuery, params.slice(0, -2));

        return {
            properties: results.rows,
            total: parseInt(countResult.rows[0].total)
        };
    }

    async indexPropertyEmbeddings(properties: Property[]): Promise<void> {
        console.log('Starting property embedding indexing', { count: properties.length });

        const BATCH_SIZE = 10;
        let processed = 0;

        for (let i = 0; i < properties.length; i += BATCH_SIZE) {
            const batch = properties.slice(i, i + BATCH_SIZE);

            // Generate embeddings for property descriptions
            const descriptions = batch.map(p => this.createPropertyDescription(p));
            const embeddings = await this.embeddingService.batchGenerateEmbeddings(descriptions);

            // Update database with embeddings
            for (let j = 0; j < batch.length; j++) {
                const property = batch[j];
                const embedding = embeddings[j];

                await this.database.query(
                    'UPDATE properties SET embedding = $1, updated_at = NOW() WHERE id = $2',
                    [JSON.stringify(embedding), property.id]
                );
            }

            processed += batch.length;
            console.log('Property embeddings indexed', {
                processed,
                total: properties.length,
                progress: `${(processed / properties.length * 100).toFixed(1)}%`
            });
        }

        console.log('Property embedding indexing completed', { total: processed });
    }

    private createPropertyDescription(property: Property): string {
        // Create rich description for embedding
        const parts = [
            property.title || '',
            property.description || '',
            property.location || '',
            property.propertyType || '',
            property.bedrooms ? `${property.bedrooms} bedrooms` : '',
            property.bathrooms ? `${property.bathrooms} bathrooms` : '',
            property.price ? `£${property.price}` : '',
            property.features ? property.features.join(' ') : ''
        ].filter(Boolean);

        return parts.join(' ');
    }

    private generateSearchId(): string {
        return `search_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    async getSearchAnalytics(): Promise<any> {
        const embeddingStats = this.embeddingService.getPerformanceStats();
        const cacheStats = await this.embeddingService.getCacheStats();

        return {
            embedding_service: embeddingStats,
            cache_performance: cacheStats,
            timestamp: new Date().toISOString()
        };
    }
}