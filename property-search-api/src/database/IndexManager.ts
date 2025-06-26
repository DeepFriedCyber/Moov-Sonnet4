import { DatabaseService } from '../lib/database';
import { QueryPerformanceAnalyzer } from './QueryPerformanceAnalyzer';

export interface IndexInfo {
    indexName: string;
    tableName: string;
    columnNames: string[];
    indexType: string;
    isUnique: boolean;
    size: string;
    scans: number;
    tupleReads: number;
    tupleFetches: number;
}

export interface IndexSuggestion {
    indexName: string;
    tableName: string;
    columns: string[];
    reason: string;
    impact: 'low' | 'medium' | 'high';
    estimatedSize: string;
}

export class IndexManager {
    constructor(private database: DatabaseService) { }

    async listIndexes(tableName?: string): Promise<string[]> {
        const connection = await this.database.getClientWithRetry(3, 1000);

        try {
            let query = `
        SELECT indexname 
        FROM pg_indexes 
        WHERE schemaname = 'public'
      `;

            if (tableName) {
                query += ` AND tablename = $1`;
            }

            const result = await connection.query(query, tableName ? [tableName] : []);
            return result.rows.map(row => row.indexname);
        } finally {
            connection.release();
        }
    }

    async getIndexInfo(tableName: string): Promise<IndexInfo[]> {
        const connection = await this.database.getClientWithRetry(3, 1000);

        try {
            const query = `
        SELECT 
          i.indexname,
          i.tablename,
          array_agg(a.attname ORDER BY a.attnum) as column_names,
          am.amname as index_type,
          ix.indisunique as is_unique,
          pg_size_pretty(pg_relation_size(ix.indexrelid)) as size,
          COALESCE(s.idx_scan, 0) as scans,
          COALESCE(s.idx_tup_read, 0) as tuple_reads,
          COALESCE(s.idx_tup_fetch, 0) as tuple_fetches
        FROM pg_indexes i
        JOIN pg_class c ON c.relname = i.indexname
        JOIN pg_index ix ON ix.indexrelid = c.oid
        JOIN pg_class ct ON ct.oid = ix.indrelid
        JOIN pg_am am ON am.oid = c.relam
        JOIN pg_attribute a ON a.attrelid = ix.indrelid AND a.attnum = ANY(ix.indkey)
        LEFT JOIN pg_stat_user_indexes s ON s.indexrelid = ix.indexrelid
        WHERE i.tablename = $1 AND i.schemaname = 'public'
        GROUP BY i.indexname, i.tablename, am.amname, ix.indisunique, ix.indexrelid, s.idx_scan, s.idx_tup_read, s.idx_tup_fetch
        ORDER BY i.indexname
      `;

            const result = await connection.query(query, [tableName]);

            return result.rows.map(row => ({
                indexName: row.indexname,
                tableName: row.tablename,
                columnNames: row.column_names,
                indexType: row.index_type,
                isUnique: row.is_unique,
                size: row.size,
                scans: row.scans,
                tupleReads: row.tuple_reads,
                tupleFetches: row.tuple_fetches
            }));
        } finally {
            connection.release();
        }
    }

    async findUnusedIndexes(): Promise<IndexInfo[]> {
        const indexes = await this.getIndexInfo('properties');

        // Consider an index unused if it has very few scans relative to table size
        return indexes.filter(index =>
            index.scans < 10 && // Less than 10 scans
            !index.indexName.includes('pkey') && // Not primary key
            !index.isUnique // Not unique constraint
        );
    }

    async getIndexSuggestions(): Promise<IndexSuggestion[]> {
        const connection = await this.database.getClientWithRetry(3, 1000);

        try {
            // For now, return basic suggestions based on common patterns
            // In production, this would analyze pg_stat_statements
            const suggestions: IndexSuggestion[] = [
                {
                    indexName: 'idx_properties_price_range',
                    tableName: 'properties',
                    columns: ['price'],
                    reason: 'Frequently used in range queries',
                    impact: 'high',
                    estimatedSize: '< 1MB'
                },
                {
                    indexName: 'idx_properties_bedrooms_filter',
                    tableName: 'properties',
                    columns: ['bedrooms'],
                    reason: 'Frequently used in WHERE clauses',
                    impact: 'medium',
                    estimatedSize: '< 500KB'
                },
                {
                    indexName: 'idx_properties_created_at_sort',
                    tableName: 'properties',
                    columns: ['created_at'],
                    reason: 'Frequently used for sorting',
                    impact: 'medium',
                    estimatedSize: '< 1MB'
                }
            ];

            return this.deduplicateSuggestions(suggestions);
        } finally {
            connection.release();
        }
    }

    private analyzeQueryForIndexes(query: string): IndexSuggestion[] {
        const suggestions: IndexSuggestion[] = [];

        // Pattern matching for common index opportunities
        const patterns = [
            {
                pattern: /WHERE.*price\s+BETWEEN/gi,
                suggestion: {
                    indexName: 'idx_properties_price_range',
                    tableName: 'properties',
                    columns: ['price'],
                    reason: 'Frequently used in range queries',
                    impact: 'high' as const,
                    estimatedSize: '< 1MB'
                }
            },
            {
                pattern: /WHERE.*bedrooms\s*>=?/gi,
                suggestion: {
                    indexName: 'idx_properties_bedrooms_filter',
                    tableName: 'properties',
                    columns: ['bedrooms'],
                    reason: 'Frequently used in WHERE clauses',
                    impact: 'medium' as const,
                    estimatedSize: '< 500KB'
                }
            },
            {
                pattern: /ORDER BY.*created_at/gi,
                suggestion: {
                    indexName: 'idx_properties_created_at_sort',
                    tableName: 'properties',
                    columns: ['created_at'],
                    reason: 'Frequently used for sorting',
                    impact: 'medium' as const,
                    estimatedSize: '< 1MB'
                }
            }
        ];

        for (const { pattern, suggestion } of patterns) {
            if (pattern.test(query)) {
                suggestions.push(suggestion);
            }
        }

        return suggestions;
    }

    private deduplicateSuggestions(suggestions: IndexSuggestion[]): IndexSuggestion[] {
        const seen = new Set<string>();
        return suggestions.filter(suggestion => {
            const key = `${suggestion.tableName}.${suggestion.columns.join('.')}`;
            if (seen.has(key)) {
                return false;
            }
            seen.add(key);
            return true;
        });
    }

    async createIndexesConcurrently(indexNames: string[]): Promise<void> {
        const promises = indexNames.map(async (indexName) => {
            const connection = await this.database.getClientWithRetry(3, 1000);
            try {
                await connection.query(`
          CREATE INDEX CONCURRENTLY IF NOT EXISTS ${indexName}
          ON properties (created_at)
        `);
            } finally {
                connection.release();
            }
        });

        await Promise.all(promises);
    }

    async dropIndex(indexName: string): Promise<void> {
        const connection = await this.database.getClientWithRetry(3, 1000);

        try {
            await connection.query(`DROP INDEX IF EXISTS ${indexName}`);
        } finally {
            connection.release();
        }
    }

    async detectMissingIndexes(): Promise<string[]> {
        const currentIndexes = await this.listIndexes('properties');
        const requiredIndexes = [
            'idx_properties_price',
            'idx_properties_bedrooms',
            'idx_properties_property_type',
            'idx_properties_available',
            'idx_properties_search_vector'
        ];

        return requiredIndexes.filter(required =>
            !currentIndexes.includes(required)
        );
    }

    async validateIndexEffectiveness(
        indexName: string,
        testQuery: string,
        params: any[] = []
    ): Promise<{
        indexUsed: boolean;
        scanType: string;
        rowsExamined: number;
        rowsReturned: number;
        selectivity: number;
        recommendation: string;
    }> {
        const analyzer = new QueryPerformanceAnalyzer(this.database);
        const metrics = await analyzer.measureQueryPerformance(testQuery, params);

        const indexUsed = metrics.indexesUsed.includes(indexName);
        const selectivity = metrics.rowsReturned / (metrics.rowsReturned + 1000); // Rough estimate

        let recommendation = 'Index is working effectively';
        if (!indexUsed) {
            recommendation = 'Index is not being used - consider query optimization';
        } else if (selectivity > 0.1) {
            recommendation = 'Index has low selectivity - consider adding filters';
        }

        return {
            indexUsed,
            scanType: metrics.scanTypes[0] || 'unknown',
            rowsExamined: metrics.rowsReturned * 2, // Estimate
            rowsReturned: metrics.rowsReturned,
            selectivity,
            recommendation
        };
    }

    async getOptimizationRecommendations(): Promise<Array<{
        type: 'create' | 'drop' | 'modify';
        indexName: string;
        reason: string;
        estimatedImpact: string;
    }>> {
        const [unused, missing, suggestions] = await Promise.all([
            this.findUnusedIndexes(),
            this.detectMissingIndexes(),
            this.getIndexSuggestions()
        ]);

        const recommendations = [];

        // Recommend dropping unused indexes
        for (const index of unused) {
            recommendations.push({
                type: 'drop' as const,
                indexName: index.indexName,
                reason: `Index has only ${index.scans} scans - rarely used`,
                estimatedImpact: 'Reduce storage and maintenance overhead'
            });
        }

        // Recommend creating missing indexes
        for (const indexName of missing) {
            recommendations.push({
                type: 'create' as const,
                indexName,
                reason: 'Required for optimal query performance',
                estimatedImpact: 'Significant performance improvement'
            });
        }

        return recommendations;
    }
}