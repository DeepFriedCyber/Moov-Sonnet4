import { Pool } from 'pg';
import axios from 'axios';
import { logger } from '../lib/logger';
import { cache } from '../lib/cache';
import { Property, SearchQuery } from '../types';

interface EmbeddingServiceConfig {
    urls: string[];
    timeout: number;
    retries: number;
}

export class SemanticSearchService {
    private pool: Pool;
    private embeddingConfig: EmbeddingServiceConfig;
    private currentServiceIndex = 0;

    constructor(pool: Pool) {
        this.pool = pool;
        this.embeddingConfig = {
            urls: [
                process.env.EMBEDDING_SERVICE_URL || 'http://localhost:8001',
                process.env.EMBEDDING_SERVICE_BACKUP_URL || 'http://localhost:8002',
            ],
            timeout: 5000,
            retries: 3,
        };
    }

    /**
     * Get embeddings with failover support
     */
    private async getEmbeddings(texts: string[]): Promise<number[][]> {
        const cacheKey = cache.generateKey('embeddings', texts);
        const cached = await cache.get<number[][]>(cacheKey);
        if (cached) return cached;

        let lastError: Error | null = null;

        // Try each embedding service
        for (let serviceAttempt = 0; serviceAttempt < this.embeddingConfig.urls.length; serviceAttempt++) {
            const serviceUrl = this.embeddingConfig.urls[this.currentServiceIndex];

            // Try multiple times with the current service
            for (let retry = 0; retry < this.embeddingConfig.retries; retry++) {
                try {
                    const response = await axios.post(
                        `${serviceUrl}/embed`,
                        { texts, model: 'primary' },
                        {
                            timeout: this.embeddingConfig.timeout,
                            headers: { 'Content-Type': 'application/json' }
                        }
                    );

                    const embeddings = response.data.embeddings;

                    // Cache successful response
                    await cache.set(cacheKey, embeddings, 3600); // 1 hour

                    return embeddings;
                } catch (error) {
                    lastError = error as Error;
                    logger.error(`Embedding service error (attempt ${retry + 1}):`, error);

                    // Wait before retry
                    if (retry < this.embeddingConfig.retries - 1) {
                        await new Promise(resolve => setTimeout(resolve, 1000 * (retry + 1)));
                    }
                }
            }

            // Move to next service
            this.currentServiceIndex = (this.currentServiceIndex + 1) % this.embeddingConfig.urls.length;
        }

        throw new Error(`All embedding services failed: ${lastError?.message}`);
    }

    /**
     * Search properties using semantic similarity
     */
    async searchProperties(query: SearchQuery): Promise<{
        properties: Property[];
        totalCount: number;
        searchMetadata: any;
    }> {
        const startTime = Date.now();

        try {
            // Get query embedding
            const [queryEmbedding] = await this.getEmbeddings([query.query]);

            // Build SQL query with vector similarity search
            const { sql, params } = this.buildSearchQuery(query, queryEmbedding);

            // Execute search
            const result = await this.pool.query(sql, params);

            // Get total count
            const countResult = await this.pool.query(
                this.buildCountQuery(query, queryEmbedding).sql,
                this.buildCountQuery(query, queryEmbedding).params
            );

            const properties = result.rows.map(row => ({
                ...row,
                similarity_score: row.similarity_score,
            }));

            const searchMetadata = {
                query: query.query,
                resultsFound: result.rows.length,
                searchTime: Date.now() - startTime,
                embeddingModel: 'sentence-transformers',
                filters: query.filters,
            };

            return {
                properties,
                totalCount: parseInt(countResult.rows[0].count),
                searchMetadata,
            };
        } catch (error) {
            logger.error('Semantic search error:', error);
            throw error;
        }
    }

    /**
     * Build PostgreSQL query with pgvector
     */
    private buildSearchQuery(query: SearchQuery, embedding: number[]) {
        const params: any[] = [JSON.stringify(embedding)];
        let paramIndex = 2;

        let sql = `
      WITH semantic_search AS (
        SELECT 
          p.*,
          1 - (p.embedding <=> $1::vector) as similarity_score
        FROM properties p
        WHERE 1=1
    `;

        // Add filters
        if (query.filters) {
            if (query.filters.minPrice !== undefined) {
                sql += ` AND p.price >= $${paramIndex++}`;
                params.push(query.filters.minPrice);
            }
            if (query.filters.maxPrice !== undefined) {
                sql += ` AND p.price <= $${paramIndex++}`;
                params.push(query.filters.maxPrice);
            }
            if (query.filters.minBedrooms !== undefined) {
                sql += ` AND p.bedrooms >= $${paramIndex++}`;
                params.push(query.filters.minBedrooms);
            }
            if (query.filters.propertyType?.length) {
                sql += ` AND p.property_type = ANY($${paramIndex++})`;
                params.push(query.filters.propertyType);
            }
            if (query.filters.location) {
                sql += ` AND (p.city ILIKE $${paramIndex} OR p.postcode ILIKE $${paramIndex})`;
                params.push(`%${query.filters.location}%`);
                paramIndex++;
            }
        }

        sql += `
      )
      SELECT * FROM semantic_search
      WHERE similarity_score > 0.3
    `;

        // Add sorting
        if (query.sort) {
            sql += ` ORDER BY ${query.sort.field} ${query.sort.order}`;
        } else {
            sql += ` ORDER BY similarity_score DESC`;
        }

        // Add pagination
        const limit = query.pagination?.limit || 20;
        const offset = ((query.pagination?.page || 1) - 1) * limit;
        sql += ` LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
        params.push(limit, offset);

        return { sql, params };
    }

    /**
     * Build count query
     */
    private buildCountQuery(query: SearchQuery, embedding: number[]) {
        const params: any[] = [JSON.stringify(embedding)];
        let paramIndex = 2;

        let sql = `
      SELECT COUNT(*) as count
      FROM properties p
      WHERE 1 - (p.embedding <=> $1::vector) > 0.3
    `;

        // Add same filters as search query
        if (query.filters) {
            if (query.filters.minPrice !== undefined) {
                sql += ` AND p.price >= $${paramIndex++}`;
                params.push(query.filters.minPrice);
            }
            if (query.filters.maxPrice !== undefined) {
                sql += ` AND p.price <= $${paramIndex++}`;
                params.push(query.filters.maxPrice);
            }
            if (query.filters.minBedrooms !== undefined) {
                sql += ` AND p.bedrooms >= $${paramIndex++}`;
                params.push(query.filters.minBedrooms);
            }
            if (query.filters.propertyType?.length) {
                sql += ` AND p.property_type = ANY($${paramIndex++})`;
                params.push(query.filters.propertyType);
            }
            if (query.filters.location) {
                sql += ` AND (p.city ILIKE $${paramIndex} OR p.postcode ILIKE $${paramIndex})`;
                params.push(`%${query.filters.location}%`);
                paramIndex++;
            }
        }

        return { sql, params };
    }

    /**
     * Index a property's description for semantic search
     */
    async indexProperty(propertyId: string, description: string): Promise<void> {
        try {
            const [embedding] = await this.getEmbeddings([description]);

            await this.pool.query(
                `UPDATE properties 
         SET embedding = $1::vector, 
             indexed_at = CURRENT_TIMESTAMP 
         WHERE id = $2`,
                [JSON.stringify(embedding), propertyId]
            );

            logger.info(`Indexed property ${propertyId}`);
        } catch (error) {
            logger.error(`Failed to index property ${propertyId}:`, error);
            throw error;
        }
    }

    /**
     * Batch index multiple properties
     */
    async batchIndexProperties(properties: Array<{ id: string; description: string }>): Promise<void> {
        const batchSize = 50;

        for (let i = 0; i < properties.length; i += batchSize) {
            const batch = properties.slice(i, i + batchSize);
            const descriptions = batch.map(p => p.description);

            try {
                const embeddings = await this.getEmbeddings(descriptions);

                // Use transaction for batch update
                const client = await this.pool.connect();
                try {
                    await client.query('BEGIN');

                    for (let j = 0; j < batch.length; j++) {
                        await client.query(
                            `UPDATE properties 
               SET embedding = $1::vector, 
                   indexed_at = CURRENT_TIMESTAMP 
               WHERE id = $2`,
                            [JSON.stringify(embeddings[j]), batch[j].id]
                        );
                    }

                    await client.query('COMMIT');
                    logger.info(`Indexed batch of ${batch.length} properties`);
                } catch (error) {
                    await client.query('ROLLBACK');
                    throw error;
                } finally {
                    client.release();
                }
            } catch (error) {
                logger.error(`Failed to index batch starting at ${i}:`, error);
                // Continue with next batch
            }
        }
    }
}