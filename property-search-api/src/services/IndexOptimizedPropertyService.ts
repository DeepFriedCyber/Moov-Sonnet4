import { DatabaseService } from '../lib/database';
import { QueryPerformanceAnalyzer } from '../database/QueryPerformanceAnalyzer';

export interface PropertySearchParams {
    query?: string;
    price_min?: number;
    price_max?: number;
    property_type?: string;
    bedrooms?: number;
    bathrooms?: number;
    latitude?: number;
    longitude?: number;
    radius?: number; // in kilometers
    sort?: 'price_asc' | 'price_desc' | 'date_desc' | 'relevance';
    page: number;
    limit: number;
}

export interface PropertySearchResult {
    properties: any[];
    totalCount: number;
    page: number;
    limit: number;
    totalPages: number;
    executionTime: number;
    indexesUsed?: string[];
}

export class IndexOptimizedPropertyService {
    private analyzer: QueryPerformanceAnalyzer;

    constructor(private database: DatabaseService) {
        this.analyzer = new QueryPerformanceAnalyzer(database);
    }

    async searchProperties(params: PropertySearchParams): Promise<PropertySearchResult> {
        const startTime = Date.now();
        const connection = await this.database.getClientWithRetry(3, 1000);

        try {
            // Use optimized query with proper indexes
            const query = this.buildOptimizedSearchQuery(params);
            const queryParams = this.buildQueryParams(params);

            // Monitor performance in development
            if (process.env.NODE_ENV === 'development') {
                const metrics = await this.analyzer.measureQueryPerformance(query, queryParams);
                if (metrics.executionTime > 100) {
                    console.warn(`Slow query detected (${metrics.executionTime}ms):`, {
                        query: query.substring(0, 100) + '...',
                        indexes: metrics.indexesUsed,
                        params: params
                    });
                }
            }

            const result = await connection.query(query, queryParams);
            const executionTime = Date.now() - startTime;

            return this.formatSearchResults(result.rows, params, executionTime);
        } finally {
            connection.release();
        }
    }

    async searchPropertiesWithSemanticSimilarity(
        params: PropertySearchParams,
        embedding?: number[]
    ): Promise<PropertySearchResult> {
        const startTime = Date.now();
        const connection = await this.database.getClientWithRetry(3, 1000);

        try {
            const query = this.buildSemanticSearchQuery(params, !!embedding);
            const queryParams = this.buildSemanticQueryParams(params, embedding);

            const result = await connection.query(query, queryParams);
            const executionTime = Date.now() - startTime;

            return this.formatSearchResults(result.rows, params, executionTime);
        } finally {
            connection.release();
        }
    }

    private buildOptimizedSearchQuery(params: PropertySearchParams): string {
        let query = `
      SELECT 
        p.*,
        ${params.query ? 'ts_rank(p.search_vector, plainto_tsquery(\'english\', $1)) as text_rank,' : ''}
        ${params.latitude && params.longitude ? `
          ST_Distance(
            ST_Point(p.longitude, p.latitude)::geography,
            ST_Point($${this.getParamIndex(params, 'longitude')}, $${this.getParamIndex(params, 'latitude')})::geography
          ) as distance,
        ` : ''}
        COUNT(*) OVER() as total_count
      FROM properties p
      WHERE p.available = true
    `;

        const conditions: string[] = [];

        // Full-text search using GIN index
        if (params.query) {
            conditions.push(`p.search_vector @@ plainto_tsquery('english', $1)`);
        }

        // Price range using B-tree index
        if (params.price_min !== undefined) {
            conditions.push(`p.price >= $${this.getParamIndex(params, 'price_min')}`);
        }

        if (params.price_max !== undefined) {
            conditions.push(`p.price <= $${this.getParamIndex(params, 'price_max')}`);
        }

        // Property type using B-tree index
        if (params.property_type) {
            conditions.push(`p.property_type = $${this.getParamIndex(params, 'property_type')}`);
        }

        // Bedrooms using B-tree index
        if (params.bedrooms !== undefined) {
            conditions.push(`p.bedrooms >= $${this.getParamIndex(params, 'bedrooms')}`);
        }

        // Bathrooms using B-tree index
        if (params.bathrooms !== undefined) {
            conditions.push(`p.bathrooms >= $${this.getParamIndex(params, 'bathrooms')}`);
        }

        // Geographic search using GiST index
        if (params.latitude && params.longitude && params.radius) {
            conditions.push(`ST_DWithin(
        ST_Point(p.longitude, p.latitude)::geography,
        ST_Point($${this.getParamIndex(params, 'longitude')}, $${this.getParamIndex(params, 'latitude')})::geography,
        $${this.getParamIndex(params, 'radius')} * 1000
      )`);
        }

        if (conditions.length > 0) {
            query += ` AND ${conditions.join(' AND ')}`;
        }

        // Optimized sorting
        query += this.buildOptimizedOrderBy(params);

        // Pagination
        query += ` LIMIT $${this.getParamIndex(params, 'limit')} OFFSET $${this.getParamIndex(params, 'offset')}`;

        return query;
    }

    private buildSemanticSearchQuery(params: PropertySearchParams, hasEmbedding: boolean): string {
        let query = `
      SELECT 
        p.*,
        ${params.query ? 'ts_rank(p.search_vector, plainto_tsquery(\'english\', $1)) as text_rank,' : ''}
        ${hasEmbedding ? '1 - (pe.combined_embedding <=> $2::vector) as similarity_score,' : ''}
        COUNT(*) OVER() as total_count
      FROM properties p
      ${hasEmbedding ? 'JOIN property_embeddings pe ON p.id = pe.property_id' : ''}
      WHERE p.available = true
    `;

        const conditions: string[] = [];

        // Full-text search
        if (params.query) {
            conditions.push(`p.search_vector @@ plainto_tsquery('english', $1)`);
        }

        // Semantic similarity threshold
        if (hasEmbedding) {
            conditions.push(`1 - (pe.combined_embedding <=> $2::vector) > 0.7`);
        }

        // Add other filters...
        if (params.price_min !== undefined) {
            conditions.push(`p.price >= $${this.getParamIndex(params, 'price_min', hasEmbedding ? 3 : 2)}`);
        }

        if (conditions.length > 0) {
            query += ` AND ${conditions.join(' AND ')}`;
        }

        // Semantic search ordering
        if (hasEmbedding) {
            query += ` ORDER BY pe.combined_embedding <=> $2::vector`;
        } else {
            query += this.buildOptimizedOrderBy(params);
        }

        query += ` LIMIT $${this.getParamIndex(params, 'limit')} OFFSET $${this.getParamIndex(params, 'offset')}`;

        return query;
    }

    private buildOptimizedOrderBy(params: PropertySearchParams): string {
        switch (params.sort) {
            case 'price_asc':
                return ' ORDER BY p.price ASC';
            case 'price_desc':
                return ' ORDER BY p.price DESC';
            case 'date_desc':
                return ' ORDER BY p.created_at DESC';
            case 'relevance':
            default:
                if (params.query) {
                    return ' ORDER BY text_rank DESC, p.created_at DESC';
                } else if (params.latitude && params.longitude) {
                    return ' ORDER BY distance ASC, p.created_at DESC';
                } else {
                    return ' ORDER BY p.created_at DESC';
                }
        }
    }

    private getParamIndex(params: PropertySearchParams, field: string, startIndex: number = 1): number {
        const paramOrder = [
            'query',
            'embedding',
            'price_min',
            'price_max',
            'property_type',
            'bedrooms',
            'bathrooms',
            'longitude',
            'latitude',
            'radius',
            'limit',
            'offset'
        ];

        let index = startIndex;
        for (const param of paramOrder) {
            if (param === field) {
                return index;
            }

            // Check if this parameter is actually used
            if (this.isParamUsed(params, param)) {
                index++;
            }
        }

        return index;
    }

    private isParamUsed(params: PropertySearchParams, param: string): boolean {
        switch (param) {
            case 'query':
                return !!params.query;
            case 'price_min':
                return params.price_min !== undefined;
            case 'price_max':
                return params.price_max !== undefined;
            case 'property_type':
                return !!params.property_type;
            case 'bedrooms':
                return params.bedrooms !== undefined;
            case 'bathrooms':
                return params.bathrooms !== undefined;
            case 'longitude':
                return !!params.longitude;
            case 'latitude':
                return !!params.latitude;
            case 'radius':
                return !!params.radius;
            case 'limit':
            case 'offset':
                return true; // Always used
            default:
                return false;
        }
    }

    private buildQueryParams(params: PropertySearchParams): any[] {
        const queryParams: any[] = [];

        if (params.query) queryParams.push(params.query);
        if (params.price_min !== undefined) queryParams.push(params.price_min);
        if (params.price_max !== undefined) queryParams.push(params.price_max);
        if (params.property_type) queryParams.push(params.property_type);
        if (params.bedrooms !== undefined) queryParams.push(params.bedrooms);
        if (params.bathrooms !== undefined) queryParams.push(params.bathrooms);

        if (params.longitude && params.latitude) {
            queryParams.push(params.longitude, params.latitude);
            if (params.radius) queryParams.push(params.radius);
        }

        queryParams.push(params.limit, (params.page - 1) * params.limit);

        return queryParams;
    }

    private buildSemanticQueryParams(params: PropertySearchParams, embedding?: number[]): any[] {
        const queryParams: any[] = [];

        if (params.query) queryParams.push(params.query);
        if (embedding) queryParams.push(JSON.stringify(embedding));
        if (params.price_min !== undefined) queryParams.push(params.price_min);
        if (params.price_max !== undefined) queryParams.push(params.price_max);

        queryParams.push(params.limit, (params.page - 1) * params.limit);

        return queryParams;
    }

    private formatSearchResults(
        rows: any[],
        params: PropertySearchParams,
        executionTime: number
    ): PropertySearchResult {
        return {
            properties: rows,
            totalCount: rows[0]?.total_count || 0,
            page: params.page,
            limit: params.limit,
            totalPages: Math.ceil((rows[0]?.total_count || 0) / params.limit),
            executionTime
        };
    }

    async getQueryPerformanceMetrics(params: PropertySearchParams): Promise<any> {
        const query = this.buildOptimizedSearchQuery(params);
        const queryParams = this.buildQueryParams(params);

        return await this.analyzer.measureQueryPerformance(query, queryParams);
    }
}