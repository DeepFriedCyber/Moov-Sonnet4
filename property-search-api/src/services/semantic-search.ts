// src/services/semantic-search.ts
import axios from 'axios';

export interface EmbeddingServiceConfig {
    embeddingUrls: string[];
    timeout: number;
    retryAttempts: number;
}

export interface SearchOptions {
    query: string;
    filters?: {
        minPrice?: number;
        maxPrice?: number;
        minBedrooms?: number;
        maxBedrooms?: number;
    };
    limit?: number;
    offset?: number;
    similarityThreshold?: number;
}

export interface SearchResult {
    properties: any[];
    total: number;
    searchTime: number;
}

interface DatabaseAdapter {
    query(params: any): Promise<{ properties: any[]; total: number }>;
}

export class SemanticSearchService {
    private currentServiceIndex = 0;
    private database?: DatabaseAdapter;
    private cache = new Map<string, { embeddings: number[][]; expires: number }>();
    private cacheTTL = 3600 * 1000; // 1 hour

    constructor(private readonly config: EmbeddingServiceConfig) { }

    setDatabase(db: DatabaseAdapter): void {
        this.database = db;
    }

    async getEmbeddings(texts: string[]): Promise<number[][]> {
        // Check cache
        const cacheKey = JSON.stringify(texts);
        const cached = this.cache.get(cacheKey);
        if (cached && cached.expires > Date.now()) {
            return cached.embeddings;
        }

        let lastError: Error = new Error('No embedding services configured');

        for (let serviceAttempt = 0; serviceAttempt < this.config.embeddingUrls.length; serviceAttempt++) {
            const serviceUrl = this.config.embeddingUrls[this.currentServiceIndex];

            for (let retry = 0; retry < this.config.retryAttempts; retry++) {
                try {
                    const response = await axios.post(
                        `${serviceUrl}/embed`,
                        { texts, model: 'primary' },
                        {
                            timeout: this.config.timeout,
                            headers: { 'Content-Type': 'application/json' }
                        }
                    );

                    const embeddings = response.data.embeddings;

                    // Cache result
                    this.cache.set(cacheKey, {
                        embeddings,
                        expires: Date.now() + this.cacheTTL
                    });

                    return embeddings;
                } catch (error) {
                    lastError = error as Error;

                    if (retry < this.config.retryAttempts - 1) {
                        await new Promise(resolve => setTimeout(resolve, 100 * (retry + 1)));
                    }
                }
            }

            // Move to next service
            this.currentServiceIndex = (this.currentServiceIndex + 1) % this.config.embeddingUrls.length;
        }

        throw new Error(`All embedding services failed: ${lastError.message}`);
    }

    async searchProperties(options: SearchOptions): Promise<SearchResult> {
        if (!this.database) {
            throw new Error('Database not configured');
        }

        if (!options.query) {
            throw new Error('Query is required');
        }

        if (options.limit !== undefined && options.limit < 0) {
            throw new Error('Limit must be positive');
        }

        const startTime = Date.now();

        const [embedding] = await this.getEmbeddings([options.query]);

        const result = await this.database.query({
            embedding,
            filters: options.filters,
            limit: options.limit || 20,
            offset: options.offset || 0,
            similarityThreshold: options.similarityThreshold || 0.3,
        });

        return {
            properties: result.properties,
            total: result.total,
            searchTime: Date.now() - startTime,
        };
    }
}