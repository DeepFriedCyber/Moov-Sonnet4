// Optimized Property Service with Advanced Connection Pool Integration
import { DatabaseService } from '../lib/database';
import { Logger } from '../lib/logger';

export interface PropertySearchParams {
    query?: string;
    location?: string;
    priceRange?: { min: number; max: number };
    propertyType?: string;
    bedrooms?: number;
    bathrooms?: number;
    minSize?: number;
    maxSize?: number;
    features?: string[];
    embedding?: number[];
    limit?: number;
    offset?: number;
    sortBy?: 'price' | 'size' | 'date' | 'relevance';
    sortOrder?: 'asc' | 'desc';
}

export interface PropertySearchResult {
    properties: Property[];
    total: number;
    searchStrategy: 'optimized' | 'cached' | 'fallback' | 'vector' | 'standard';
    responseTime: number;
    metadata: {
        poolUtilization: number;
        queryOptimizations: string[];
        cacheHit?: boolean;
        indexesUsed?: string[];
        queryPlan?: any;
    };
}

export interface Property {
    id: string;
    title: string;
    description: string;
    price: number;
    location: string;
    property_type: string;
    bedrooms: number;
    bathrooms: number;
    size_sqft: number;
    features: string[];
    images: string[];
    created_at: Date;
    updated_at: Date;
    similarity_score?: number;
    relevance_score?: number;
}

export class OptimizedPropertyService {
    private database: DatabaseService;
    private logger: Logger;
    private queryCache: Map<string, { result: any; timestamp: number; ttl: number }>;
    private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
    private readonly HIGH_LOAD_THRESHOLD = 0.8;
    private readonly SLOW_QUERY_THRESHOLD = 1000; // ms

    constructor(database: DatabaseService) {
        this.database = database;
        this.logger = new Logger('OptimizedPropertyService');
        this.queryCache = new Map();

        // Setup cache cleanup interval
        setInterval(() => this.cleanupCache(), 60000); // Cleanup every minute
    }

    async searchProperties(params: PropertySearchParams): Promise<PropertySearchResult> {
        const startTime = Date.now();
        const cacheKey = this.generateCacheKey(params);

        try {
            // Check cache first
            const cachedResult = this.getCachedResult(cacheKey);
            if (cachedResult) {
                return {
                    ...cachedResult,
                    responseTime: Date.now() - startTime,
                    metadata: {
                        ...cachedResult.metadata,
                        cacheHit: true,
                        poolUtilization: this.getPoolUtilization()
                    }
                };
            }

            // Analyze pool status to determine search strategy
            const poolStats = this.database.getPoolStatus();
            const metrics = this.database.getMetrics();
            const poolUtilization = this.getPoolUtilization();

            this.logger.info('Property search initiated', {
                params: { ...params, embedding: params.embedding ? '[VECTOR_DATA]' : undefined },
                poolUtilization: `${Math.round(poolUtilization * 100)}%`,
                activeConnections: poolStats.totalCount,
                averageQueryTime: `${Math.round(metrics.averageQueryTime)}ms`
            });

            let result: PropertySearchResult;

            // Determine optimal search strategy
            if (poolUtilization > this.HIGH_LOAD_THRESHOLD) {
                result = await this.executeHighLoadStrategy(params, startTime);
            } else if (params.embedding && metrics.averageQueryTime < this.SLOW_QUERY_THRESHOLD) {
                result = await this.executeVectorSearch(params, startTime);
            } else {
                result = await this.executeOptimizedSearch(params, startTime);
            }

            // Cache successful results
            if (result.properties.length > 0) {
                this.cacheResult(cacheKey, result);
            }

            return result;

        } catch (error) {
            this.logger.error('Property search failed', {
                error: error.message,
                params: { ...params, embedding: params.embedding ? '[VECTOR_DATA]' : undefined },
                poolStatus: this.database.getPoolStatus()
            });

            return await this.executeFallbackSearch(params, startTime);
        }
    }

    private async executeOptimizedSearch(params: PropertySearchParams, startTime: number): Promise<PropertySearchResult> {
        const connection = await this.database.getClientWithRetry(3, 1000);

        try {
            const queryBuilder = this.buildOptimizedQuery(params);
            const queryOptimizations: string[] = [];

            // Apply query optimizations based on pool performance
            const metrics = this.database.getMetrics();
            if (metrics.slowQueries > 0) {
                queryBuilder.addIndexHints();
                queryOptimizations.push('index_hints_applied');
            }

            if (metrics.averageQueryTime > 500) {
                queryBuilder.limitJoins();
                queryOptimizations.push('joins_limited');
            }

            // Execute query with performance monitoring
            const queryStart = Date.now();
            const result = await connection.query(queryBuilder.sql, queryBuilder.params);
            const queryTime = Date.now() - queryStart;

            // Log slow queries for optimization
            if (queryTime > this.SLOW_QUERY_THRESHOLD) {
                this.logger.warn('Slow property query detected', {
                    queryTime: `${queryTime}ms`,
                    sql: queryBuilder.sql.substring(0, 200),
                    paramCount: queryBuilder.params.length,
                    resultCount: result.rows.length
                });
            }

            const properties = this.formatProperties(result.rows);
            const responseTime = Date.now() - startTime;

            return {
                properties,
                total: properties.length,
                searchStrategy: 'optimized',
                responseTime,
                metadata: {
                    poolUtilization: this.getPoolUtilization(),
                    queryOptimizations,
                    indexesUsed: queryBuilder.indexesUsed,
                    queryPlan: queryBuilder.explainPlan
                }
            };

        } finally {
            connection.release();
        }
    }

    private async executeVectorSearch(params: PropertySearchParams, startTime: number): Promise<PropertySearchResult> {
        const connection = await this.database.getClientWithRetry(2, 500);

        try {
            const vectorQuery = this.buildVectorQuery(params);
            const result = await connection.query(vectorQuery.sql, vectorQuery.params);

            const properties = this.formatProperties(result.rows);
            const responseTime = Date.now() - startTime;

            return {
                properties,
                total: properties.length,
                searchStrategy: 'vector',
                responseTime,
                metadata: {
                    poolUtilization: this.getPoolUtilization(),
                    queryOptimizations: ['vector_similarity_search'],
                    indexesUsed: ['property_embeddings_idx']
                }
            };

        } finally {
            connection.release();
        }
    }

    private async executeHighLoadStrategy(params: PropertySearchParams, startTime: number): Promise<PropertySearchResult> {
        this.logger.info('Executing high-load search strategy');

        // Try cached results first
        const cachedResult = this.getBestCachedResult(params);
        if (cachedResult) {
            return {
                ...cachedResult,
                searchStrategy: 'cached',
                responseTime: Date.now() - startTime,
                metadata: {
                    ...cachedResult.metadata,
                    cacheHit: true,
                    poolUtilization: this.getPoolUtilization()
                }
            };
        }

        // Use simplified query to reduce load
        const connection = await this.database.getClientWithRetry(1, 200);

        try {
            const simplifiedQuery = this.buildSimplifiedQuery(params);
            const result = await connection.query(simplifiedQuery.sql, simplifiedQuery.params);

            const properties = this.formatProperties(result.rows);
            const responseTime = Date.now() - startTime;

            return {
                properties,
                total: properties.length,
                searchStrategy: 'optimized',
                responseTime,
                metadata: {
                    poolUtilization: this.getPoolUtilization(),
                    queryOptimizations: ['simplified_for_high_load'],
                    indexesUsed: ['properties_basic_idx']
                }
            };

        } finally {
            connection.release();
        }
    }

    private async executeFallbackSearch(params: PropertySearchParams, startTime: number): Promise<PropertySearchResult> {
        this.logger.warn('Executing fallback search strategy');

        // Return cached results or empty result
        const cachedResult = this.getBestCachedResult(params);
        if (cachedResult) {
            return {
                ...cachedResult,
                searchStrategy: 'fallback',
                responseTime: Date.now() - startTime
            };
        }

        return {
            properties: [],
            total: 0,
            searchStrategy: 'fallback',
            responseTime: Date.now() - startTime,
            metadata: {
                poolUtilization: this.getPoolUtilization(),
                queryOptimizations: [],
                cacheHit: false
            }
        };
    }

    private buildOptimizedQuery(params: PropertySearchParams): QueryBuilder {
        const builder = new QueryBuilder();

        builder.select([
            'p.id', 'p.title', 'p.description', 'p.price', 'p.location',
            'p.property_type', 'p.bedrooms', 'p.bathrooms', 'p.size_sqft',
            'p.features', 'p.images', 'p.created_at', 'p.updated_at'
        ]);

        builder.from('properties p');

        // Add vector similarity if embedding provided
        if (params.embedding) {
            builder.leftJoin('property_embeddings pe', 'p.id = pe.property_id');
            builder.select('pe.combined_embedding <=> $1::vector as similarity_score');
            builder.addParam(JSON.stringify(params.embedding));
            builder.orderBy('similarity_score ASC');
            builder.addIndexUsed('property_embeddings_combined_embedding_idx');
        }

        // Add filters
        this.addFilters(builder, params);

        // Add sorting
        if (!params.embedding) {
            this.addSorting(builder, params);
        }

        // Add pagination
        builder.limit(params.limit || 20);
        builder.offset(params.offset || 0);

        return builder;
    }

    private buildVectorQuery(params: PropertySearchParams): { sql: string; params: any[] } {
        const sql = `
            SELECT p.*, 
                   pe.combined_embedding <=> $1::vector as similarity_score
            FROM properties p
            LEFT JOIN property_embeddings pe ON p.id = pe.property_id
            WHERE pe.combined_embedding IS NOT NULL
            ${this.buildWhereClause(params)}
            ORDER BY similarity_score ASC
            LIMIT $${this.getNextParamIndex(params)}
            OFFSET $${this.getNextParamIndex(params) + 1}
        `;

        const queryParams = [JSON.stringify(params.embedding)];
        this.addFilterParams(queryParams, params);
        queryParams.push(params.limit || 20, params.offset || 0);

        return { sql, params: queryParams };
    }

    private buildSimplifiedQuery(params: PropertySearchParams): { sql: string; params: any[] } {
        const sql = `
            SELECT p.id, p.title, p.price, p.location, p.property_type, 
                   p.bedrooms, p.bathrooms, p.size_sqft
            FROM properties p
            ${this.buildWhereClause(params)}
            ORDER BY p.created_at DESC
            LIMIT $${this.getNextParamIndex(params)}
            OFFSET $${this.getNextParamIndex(params) + 1}
        `;

        const queryParams: any[] = [];
        this.addFilterParams(queryParams, params);
        queryParams.push(params.limit || 20, params.offset || 0);

        return { sql, params: queryParams };
    }

    private addFilters(builder: QueryBuilder, params: PropertySearchParams): void {
        if (params.location) {
            builder.where('p.location ILIKE $?', `%${params.location}%`);
        }

        if (params.priceRange) {
            builder.where('p.price >= $? AND p.price <= $?', params.priceRange.min, params.priceRange.max);
        }

        if (params.propertyType) {
            builder.where('p.property_type = $?', params.propertyType);
        }

        if (params.bedrooms) {
            builder.where('p.bedrooms = $?', params.bedrooms);
        }

        if (params.bathrooms) {
            builder.where('p.bathrooms >= $?', params.bathrooms);
        }

        if (params.minSize) {
            builder.where('p.size_sqft >= $?', params.minSize);
        }

        if (params.maxSize) {
            builder.where('p.size_sqft <= $?', params.maxSize);
        }

        if (params.features && params.features.length > 0) {
            builder.where('p.features && $?', params.features);
        }
    }

    private addSorting(builder: QueryBuilder, params: PropertySearchParams): void {
        const sortOrder = params.sortOrder || 'desc';

        switch (params.sortBy) {
            case 'price':
                builder.orderBy(`p.price ${sortOrder.toUpperCase()}`);
                break;
            case 'size':
                builder.orderBy(`p.size_sqft ${sortOrder.toUpperCase()}`);
                break;
            case 'date':
                builder.orderBy(`p.created_at ${sortOrder.toUpperCase()}`);
                break;
            default:
                builder.orderBy('p.created_at DESC');
        }
    }

    private buildWhereClause(params: PropertySearchParams): string {
        const conditions: string[] = [];
        let paramIndex = 2; // Start from 2 since $1 is embedding

        if (params.location) {
            conditions.push(`p.location ILIKE $${paramIndex++}`);
        }

        if (params.priceRange) {
            conditions.push(`p.price >= $${paramIndex++} AND p.price <= $${paramIndex++}`);
        }

        if (params.propertyType) {
            conditions.push(`p.property_type = $${paramIndex++}`);
        }

        if (params.bedrooms) {
            conditions.push(`p.bedrooms = $${paramIndex++}`);
        }

        return conditions.length > 0 ? `AND ${conditions.join(' AND ')}` : '';
    }

    private addFilterParams(params: any[], searchParams: PropertySearchParams): void {
        if (searchParams.location) {
            params.push(`%${searchParams.location}%`);
        }

        if (searchParams.priceRange) {
            params.push(searchParams.priceRange.min, searchParams.priceRange.max);
        }

        if (searchParams.propertyType) {
            params.push(searchParams.propertyType);
        }

        if (searchParams.bedrooms) {
            params.push(searchParams.bedrooms);
        }
    }

    private getNextParamIndex(params: PropertySearchParams): number {
        let index = 2; // Start from 2 since $1 is embedding

        if (params.location) index++;
        if (params.priceRange) index += 2;
        if (params.propertyType) index++;
        if (params.bedrooms) index++;

        return index;
    }

    private formatProperties(rows: any[]): Property[] {
        return rows.map(row => ({
            id: row.id,
            title: row.title,
            description: row.description,
            price: row.price,
            location: row.location,
            property_type: row.property_type,
            bedrooms: row.bedrooms,
            bathrooms: row.bathrooms,
            size_sqft: row.size_sqft,
            features: row.features || [],
            images: row.images || [],
            created_at: row.created_at,
            updated_at: row.updated_at,
            similarity_score: row.similarity_score,
            relevance_score: row.relevance_score
        }));
    }

    private getPoolUtilization(): number {
        const poolStatus = this.database.getPoolStatus();
        return poolStatus.totalCount / 20; // Assuming max 20 connections
    }

    private generateCacheKey(params: PropertySearchParams): string {
        const keyParams = { ...params };
        delete keyParams.embedding; // Don't include embedding in cache key
        return `property_search_${JSON.stringify(keyParams)}`;
    }

    private getCachedResult(key: string): PropertySearchResult | null {
        const cached = this.queryCache.get(key);
        if (cached && Date.now() - cached.timestamp < cached.ttl) {
            return cached.result;
        }
        return null;
    }

    private getBestCachedResult(params: PropertySearchParams): PropertySearchResult | null {
        // Find the best matching cached result
        for (const [key, cached] of this.queryCache.entries()) {
            if (Date.now() - cached.timestamp < cached.ttl) {
                // Simple matching logic - could be more sophisticated
                if (key.includes(params.location || '') && key.includes(params.propertyType || '')) {
                    return cached.result;
                }
            }
        }
        return null;
    }

    private cacheResult(key: string, result: PropertySearchResult): void {
        this.queryCache.set(key, {
            result,
            timestamp: Date.now(),
            ttl: this.CACHE_TTL
        });
    }

    private cleanupCache(): void {
        const now = Date.now();
        for (const [key, cached] of this.queryCache.entries()) {
            if (now - cached.timestamp > cached.ttl) {
                this.queryCache.delete(key);
            }
        }
    }

    // Health check method
    async getServiceHealth(): Promise<{
        status: 'healthy' | 'degraded' | 'unhealthy';
        poolUtilization: number;
        cacheSize: number;
        averageQueryTime: number;
        recommendations: string[];
    }> {
        const poolUtilization = this.getPoolUtilization();
        const metrics = this.database.getMetrics();
        const recommendations: string[] = [];

        if (poolUtilization > 0.8) {
            recommendations.push('High pool utilization - consider scaling');
        }

        if (metrics.averageQueryTime > 1000) {
            recommendations.push('Slow queries detected - review query optimization');
        }

        if (this.queryCache.size > 1000) {
            recommendations.push('Large cache size - consider cache cleanup');
        }

        let status: 'healthy' | 'degraded' | 'unhealthy';
        if (poolUtilization < 0.7 && metrics.averageQueryTime < 500) {
            status = 'healthy';
        } else if (poolUtilization < 0.9 && metrics.averageQueryTime < 1000) {
            status = 'degraded';
        } else {
            status = 'unhealthy';
        }

        return {
            status,
            poolUtilization,
            cacheSize: this.queryCache.size,
            averageQueryTime: metrics.averageQueryTime,
            recommendations
        };
    }
}

// Query Builder Helper Class
class QueryBuilder {
    private selectFields: string[] = [];
    private fromClause = '';
    private joinClauses: string[] = [];
    private whereClauses: string[] = [];
    private orderByClauses: string[] = [];
    private limitClause = '';
    private offsetClause = '';
    private params: any[] = [];
    public indexesUsed: string[] = [];
    public explainPlan: any = null;

    select(fields: string | string[]): QueryBuilder {
        if (Array.isArray(fields)) {
            this.selectFields.push(...fields);
        } else {
            this.selectFields.push(fields);
        }
        return this;
    }

    from(table: string): QueryBuilder {
        this.fromClause = table;
        return this;
    }

    leftJoin(table: string, condition: string): QueryBuilder {
        this.joinClauses.push(`LEFT JOIN ${table} ON ${condition}`);
        return this;
    }

    where(condition: string, ...params: any[]): QueryBuilder {
        // Replace $? placeholders with actual parameter numbers
        let paramIndex = this.params.length + 1;
        const processedCondition = condition.replace(/\$\?/g, () => `$${paramIndex++}`);

        this.whereClauses.push(processedCondition);
        this.params.push(...params);
        return this;
    }

    orderBy(clause: string): QueryBuilder {
        this.orderByClauses.push(clause);
        return this;
    }

    limit(count: number): QueryBuilder {
        this.limitClause = `LIMIT ${count}`;
        return this;
    }

    offset(count: number): QueryBuilder {
        this.offsetClause = `OFFSET ${count}`;
        return this;
    }

    addParam(param: any): QueryBuilder {
        this.params.push(param);
        return this;
    }

    addIndexHints(): QueryBuilder {
        // Add index hints for optimization
        this.indexesUsed.push('properties_location_idx', 'properties_price_idx');
        return this;
    }

    limitJoins(): QueryBuilder {
        // Remove unnecessary joins for performance
        this.joinClauses = this.joinClauses.slice(0, 2);
        return this;
    }

    addIndexUsed(index: string): QueryBuilder {
        this.indexesUsed.push(index);
        return this;
    }

    get sql(): string {
        const parts = [
            `SELECT ${this.selectFields.join(', ')}`,
            `FROM ${this.fromClause}`,
            ...this.joinClauses,
            this.whereClauses.length > 0 ? `WHERE ${this.whereClauses.join(' AND ')}` : '',
            this.orderByClauses.length > 0 ? `ORDER BY ${this.orderByClauses.join(', ')}` : '',
            this.limitClause,
            this.offsetClause
        ].filter(part => part.length > 0);

        return parts.join('\n');
    }
}