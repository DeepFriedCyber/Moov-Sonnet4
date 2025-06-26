// Semantic Search Service with Vector Similarity
import { DatabaseService } from '../lib/database';
import { Logger } from '../lib/logger';
import { PoolClient } from 'pg';

export interface SemanticSearchParams {
    query?: string;
    embedding?: number[];
    location?: string;
    priceRange?: { min: number; max: number };
    propertyType?: string;
    limit?: number;
    offset?: number;
    similarityThreshold?: number;
}

export interface SemanticSearchResult {
    id: string;
    title: string;
    description: string;
    price: number;
    location: string;
    property_type: string;
    bedrooms: number;
    bathrooms: number;
    size_sqft: number;
    similarity_score: number;
    relevance_score?: number;
}

export class SemanticSearchService {
    private database: DatabaseService;
    private logger: Logger;
    private readonly DEFAULT_SIMILARITY_THRESHOLD = 0.7;
    private readonly DEFAULT_LIMIT = 20;

    constructor(database: DatabaseService) {
        this.database = database;
        this.logger = new Logger('SemanticSearchService');
    }

    async search(params: SemanticSearchParams, client?: PoolClient): Promise<SemanticSearchResult[]> {
        const startTime = Date.now();
        let connection = client;
        let shouldReleaseConnection = false;

        try {
            if (!connection) {
                connection = await this.database.getClientWithRetry(3, 1000);
                shouldReleaseConnection = true;
            }

            this.logger.info('Executing semantic search', {
                hasEmbedding: !!params.embedding,
                query: params.query?.substring(0, 50),
                location: params.location,
                limit: params.limit || this.DEFAULT_LIMIT
            });

            let embedding = params.embedding;
            
            // Generate embedding if not provided
            if (!embedding && params.query) {
                embedding = await this.generateEmbedding(params.query);
            }

            if (!embedding) {
                throw new Error('No embedding provided and unable to generate from query');
            }

            const query = this.buildVectorQuery(params, embedding);
            const result = await connection.query(query.sql, query.params);

            const searchResults = result.rows.map(row => ({
                id: row.id,
                title: row.title,
                description: row.description,
                price: row.price,
                location: row.location,
                property_type: row.property_type,
                bedrooms: row.bedrooms,
                bathrooms: row.bathrooms,
                size_sqft: row.size_sqft,
                similarity_score: row.similarity_score,
                relevance_score: this.calculateRelevanceScore(row)
            }));

            const responseTime = Date.now() - startTime;
            
            this.logger.info('Semantic search completed', {
                resultCount: searchResults.length,
                responseTime: `${responseTime}ms`,
                averageSimilarity: this.calculateAverageSimilarity(searchResults)
            });

            return searchResults;

        } catch (error) {
            this.logger.error('Semantic search failed', {
                error: error.message,
                query: params.query?.substring(0, 50),
                hasEmbedding: !!params.embedding
            });
            throw error;

        } finally {
            if (shouldReleaseConnection && connection) {
                connection.release();
            }
        }
    }

    private buildVectorQuery(params: SemanticSearchParams, embedding: number[]): { sql: string; params: any[] } {
        const similarityThreshold = params.similarityThreshold || this.DEFAULT_SIMILARITY_THRESHOLD;
        const limit = params.limit || this.DEFAULT_LIMIT;
        const offset = params.offset || 0;

        let sql = `
            SELECT 
                p.id,
                p.title,
                p.description,
                p.price,
                p.location,
                p.property_type,
                p.bedrooms,
                p.bathrooms,
                p.size_sqft,
                pe.combined_embedding <=> $1::vector as similarity_score
            FROM properties p
            INNER JOIN property_embeddings pe ON p.id = pe.property_id
            WHERE pe.combined_embedding <=> $1::vector < $2
        `;

        const queryParams: any[] = [
            JSON.stringify(embedding),
            1 - similarityThreshold // Convert similarity to distance
        ];

        let paramIndex = 3;

        // Add filters
        if (params.location) {
            sql += ` AND p.location ILIKE $${paramIndex}`;
            queryParams.push(`%${params.location}%`);
            paramIndex++;
        }

        if (params.priceRange) {
            sql += ` AND p.price >= $${paramIndex} AND p.price <= $${paramIndex + 1}`;
            queryParams.push(params.priceRange.min, params.priceRange.max);
            paramIndex += 2;
        }

        if (params.propertyType) {
            sql += ` AND p.property_type = $${paramIndex}`;
            queryParams.push(params.propertyType);
            paramIndex++;
        }

        sql += `
            ORDER BY similarity_score ASC
            LIMIT $${paramIndex}
            OFFSET $${paramIndex + 1}
        `;

        queryParams.push(limit, offset);

        return { sql, params: queryParams };
    }

    private async generateEmbedding(text: string): Promise<number[]> {
        try {
            this.logger.info('Generating embedding', {
                textLength: text.length,
                preview: text.substring(0, 50)
            });

            // Mock embedding generation - replace with actual embedding service
            // const response = await fetch(process.env.EMBEDDING_SERVICE_URL + '/embed', {
            //     method: 'POST',
            //     headers: { 'Content-Type': 'application/json' },
            //     body: JSON.stringify({ text })
            // });
            // 
            // if (!response.ok) {
            //     throw new Error(`Embedding service error: ${response.statusText}`);
            // }
            // 
            // const data = await response.json();
            // return data.embedding;

            // Mock embedding for development
            return new Array(384).fill(0).map(() => Math.random() - 0.5);

        } catch (error) {
            this.logger.error('Embedding generation failed', {
                error: error.message,
                text: text.substring(0, 50)
            });
            throw new Error('Failed to generate embedding');
        }
    }

    private calculateRelevanceScore(row: any): number {
        // Calculate relevance based on multiple factors
        let score = 1 - row.similarity_score; // Convert distance to similarity

        // Boost score for certain property types or features
        if (row.property_type === 'house') {
            score *= 1.1;
        }

        // Boost newer properties
        const propertyAge = Date.now() - new Date(row.created_at || Date.now()).getTime();
        const ageInDays = propertyAge / (1000 * 60 * 60 * 24);
        if (ageInDays < 30) {
            score *= 1.05;
        }

        // Normalize to 0-1 range
        return Math.min(Math.max(score, 0), 1);
    }

    private calculateAverageSimilarity(results: SemanticSearchResult[]): string {
        if (results.length === 0) return '0.00';
        
        const average = results.reduce((sum, result) => sum + (1 - result.similarity_score), 0) / results.length;
        return average.toFixed(2);
    }

    // Batch embedding generation for multiple texts
    async generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
        try {
            this.logger.info('Generating batch embeddings', {
                count: texts.length
            });

            // Mock batch embedding generation
            return texts.map(() => new Array(384).fill(0).map(() => Math.random() - 0.5));

        } catch (error) {
            this.logger.error('Batch embedding generation failed', {
                error: error.message,
                count: texts.length
            });
            throw error;
        }
    }

    // Find similar properties to a given property
    async findSimilarProperties(propertyId: string, limit: number = 10): Promise<SemanticSearchResult[]> {
        const connection = await this.database.getClientWithRetry(2, 500);

        try {
            // Get the embedding for the given property
            const embeddingQuery = `
                SELECT pe.combined_embedding
                FROM property_embeddings pe
                WHERE pe.property_id = $1
            `;
            
            const embeddingResult = await connection.query(embeddingQuery, [propertyId]);
            
            if (embeddingResult.rows.length === 0) {
                throw new Error(`No embedding found for property ${propertyId}`);
            }

            const embedding = embeddingResult.rows[0].combined_embedding;

            // Find similar properties
            const similarQuery = `
                SELECT 
                    p.id,
                    p.title,
                    p.description,
                    p.price,
                    p.location,
                    p.property_type,
                    p.bedrooms,
                    p.bathrooms,
                    p.size_sqft,
                    pe.combined_embedding <=> $1::vector as similarity_score
                FROM properties p
                INNER JOIN property_embeddings pe ON p.id = pe.property_id
                WHERE p.id != $2
                ORDER BY similarity_score ASC
                LIMIT $3
            `;

            const result = await connection.query(similarQuery, [embedding, propertyId, limit]);

            return result.rows.map(row => ({
                id: row.id,
                title: row.title,
                description: row.description,
                price: row.price,
                location: row.location,
                property_type: row.property_type,
                bedrooms: row.bedrooms,
                bathrooms: row.bathrooms,
                size_sqft: row.size_sqft,
                similarity_score: row.similarity_score,
                relevance_score: this.calculateRelevanceScore(row)
            }));

        } finally {
            connection.release();
        }
    }

    // Get service health and performance metrics
    async getServiceHealth(): Promise<{
        status: 'healthy' | 'degraded' | 'unhealthy';
        embeddingService: 'available' | 'unavailable';
        vectorIndex: 'available' | 'unavailable';
        averageQueryTime: number;
        recommendations: string[];
    }> {
        const recommendations: string[] = [];
        let embeddingService: 'available' | 'unavailable' = 'unavailable';
        let vectorIndex: 'available' | 'unavailable' = 'unavailable';

        try {
            // Test embedding service
            await this.generateEmbedding('test query');
            embeddingService = 'available';
        } catch (error) {
            recommendations.push('Embedding service is unavailable');
        }

        try {
            // Test vector index
            const connection = await this.database.getClientWithRetry(1, 500);
            try {
                await connection.query('SELECT COUNT(*) FROM property_embeddings');
                vectorIndex = 'available';
            } finally {
                connection.release();
            }
        } catch (error) {
            recommendations.push('Vector index is unavailable');
        }

        // Get average query time from database metrics
        const dbMetrics = this.database.getMetrics();
        const averageQueryTime = dbMetrics.averageQueryTime;

        if (averageQueryTime > 1000) {
            recommendations.push('Vector queries are slow - consider index optimization');
        }

        let status: 'healthy' | 'degraded' | 'unhealthy';
        if (embeddingService === 'available' && vectorIndex === 'available' && averageQueryTime < 500) {
            status = 'healthy';
        } else if (embeddingService === 'available' || vectorIndex === 'available') {
            status = 'degraded';
        } else {
            status = 'unhealthy';
        }

        return {
            status,
            embeddingService,
            vectorIndex,
            averageQueryTime,
            recommendations
        };
    }
}