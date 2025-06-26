import { DatabaseService } from '../lib/database';
import { QueryPerformanceAnalyzer, QueryPerformanceMetrics } from './QueryPerformanceAnalyzer';

export interface QueryOptimizationSuggestion {
    type: 'index' | 'query_rewrite' | 'schema_change';
    suggestion: string;
    impact: 'low' | 'medium' | 'high';
    estimatedImprovement: string;
}

export interface PaginationOptimization {
    suggestedApproach: 'cursor_based' | 'offset_limit' | 'keyset_pagination';
    optimizedQuery: string;
    indexRecommendation: string;
    reasoning: string;
}

export class QueryOptimizer {
    private analyzer: QueryPerformanceAnalyzer;

    constructor(private database: DatabaseService) {
        this.analyzer = new QueryPerformanceAnalyzer(database);
    }

    async analyzeAndOptimize(query: string): Promise<QueryOptimizationSuggestion[]> {
        const suggestions: QueryOptimizationSuggestion[] = [];

        // Analyze for common anti-patterns
        if (query.includes('LIKE \'%')) {
            suggestions.push({
                type: 'index',
                suggestion: 'Consider using full-text search with GIN index instead of LIKE with leading wildcard',
                impact: 'high',
                estimatedImprovement: '10-100x faster'
            });
        }

        if (query.includes('ILIKE')) {
            suggestions.push({
                type: 'query_rewrite',
                suggestion: 'Replace ILIKE with full-text search using tsvector and tsquery',
                impact: 'medium',
                estimatedImprovement: '5-20x faster'
            });
        }

        // Check for missing WHERE clause optimization
        if (query.includes('ORDER BY') && !query.includes('WHERE')) {
            suggestions.push({
                type: 'index',
                suggestion: 'Add composite index for sorting without filtering',
                impact: 'medium',
                estimatedImprovement: '2-5x faster'
            });
        }

        // Check for N+1 query patterns
        if (query.includes('LEFT JOIN') && query.includes('LIMIT')) {
            suggestions.push({
                type: 'query_rewrite',
                suggestion: 'Consider using window functions or subqueries to avoid N+1 problems',
                impact: 'high',
                estimatedImprovement: '5-50x faster'
            });
        }

        return suggestions;
    }

    async optimizeQuery(originalQuery: string): Promise<string> {
        let optimizedQuery = originalQuery;

        // Replace LIKE patterns with full-text search
        if (originalQuery.includes('title LIKE') || originalQuery.includes('description LIKE')) {
            optimizedQuery = this.convertToFullTextSearch(originalQuery);
        }

        // Add index creation suggestions as comments
        const indexSuggestions = await this.generateIndexSuggestions(originalQuery);
        if (indexSuggestions.length > 0) {
            const indexComments = indexSuggestions.map(idx => `-- ${idx}`).join('\n');
            optimizedQuery = `${indexComments}\n${optimizedQuery}`;
        }

        return optimizedQuery;
    }

    private convertToFullTextSearch(query: string): string {
        // Convert LIKE patterns to full-text search
        let optimized = query;

        // Replace title LIKE '%term%' with search_vector @@ plainto_tsquery('term')
        optimized = optimized.replace(
            /title\s+LIKE\s+'%([^%]+)%'/gi,
            "search_vector @@ plainto_tsquery('english', '$1')"
        );

        // Replace description LIKE '%term%' with search_vector @@ plainto_tsquery('term')
        optimized = optimized.replace(
            /description\s+LIKE\s+'%([^%]+)%'/gi,
            "search_vector @@ plainto_tsquery('english', '$1')"
        );

        // Replace combined LIKE conditions
        optimized = optimized.replace(
            /\(title\s+LIKE\s+'%([^%]+)%'\s+OR\s+description\s+LIKE\s+'%\1%'\)/gi,
            "search_vector @@ plainto_tsquery('english', '$1')"
        );

        return optimized;
    }

    private async generateIndexSuggestions(query: string): Promise<string[]> {
        const suggestions: string[] = [];

        // Analyze WHERE clauses for index opportunities
        const whereMatches = query.match(/WHERE\s+(.+?)(?:\s+ORDER\s+BY|\s+GROUP\s+BY|\s+LIMIT|$)/gi);

        if (whereMatches) {
            for (const whereClause of whereMatches) {
                if (whereClause.includes('price BETWEEN')) {
                    suggestions.push('CREATE INDEX IF NOT EXISTS idx_properties_price ON properties(price)');
                }
                if (whereClause.includes('bedrooms >=')) {
                    suggestions.push('CREATE INDEX IF NOT EXISTS idx_properties_bedrooms ON properties(bedrooms)');
                }
                if (whereClause.includes('property_type =')) {
                    suggestions.push('CREATE INDEX IF NOT EXISTS idx_properties_type ON properties(property_type)');
                }
                if (whereClause.includes('available = true')) {
                    suggestions.push('CREATE INDEX IF NOT EXISTS idx_properties_available ON properties(available) WHERE available = true');
                }
            }
        }

        // Analyze ORDER BY clauses
        const orderMatches = query.match(/ORDER\s+BY\s+([^;]+)/gi);
        if (orderMatches) {
            for (const orderClause of orderMatches) {
                if (orderClause.includes('created_at')) {
                    suggestions.push('CREATE INDEX IF NOT EXISTS idx_properties_created_at ON properties(created_at)');
                }
                if (orderClause.includes('price')) {
                    suggestions.push('CREATE INDEX IF NOT EXISTS idx_properties_price_sort ON properties(price)');
                }
            }
        }

        return [...new Set(suggestions)]; // Remove duplicates
    }

    async compareQueryPerformance(
        originalQuery: string,
        optimizedQuery: string,
        params: any[] = []
    ): Promise<{
        originalExecutionTime: number;
        optimizedExecutionTime: number;
        improvement: number;
        recommendation: string;
    }> {
        const comparison = await this.analyzer.compareQueries(originalQuery, optimizedQuery, params);

        const improvement = comparison.improvement;
        let recommendation = 'No significant improvement';

        if (improvement > 50) {
            recommendation = 'Significant improvement - implement optimization';
        } else if (improvement > 20) {
            recommendation = 'Moderate improvement - consider implementing';
        } else if (improvement < 0) {
            recommendation = 'Optimization made query slower - avoid this approach';
        }

        return {
            originalExecutionTime: comparison.query1.executionTime,
            optimizedExecutionTime: comparison.query2.executionTime,
            improvement,
            recommendation
        };
    }

    async optimizePagination(query: string): Promise<PaginationOptimization> {
        // Analyze pagination pattern
        const hasOffset = query.includes('OFFSET');
        const hasLimit = query.includes('LIMIT');
        const hasOrderBy = query.includes('ORDER BY');

        if (hasOffset && hasLimit) {
            // Large offset pagination is inefficient
            const offsetMatch = query.match(/OFFSET\s+(\d+)/i);
            const offset = offsetMatch ? parseInt(offsetMatch[1]) : 0;

            if (offset > 1000) {
                // Suggest cursor-based pagination
                const orderByMatch = query.match(/ORDER\s+BY\s+([^\s]+)/i);
                const orderColumn = orderByMatch ? orderByMatch[1] : 'id';

                return {
                    suggestedApproach: 'cursor_based',
                    optimizedQuery: query.replace(
                        /OFFSET\s+\d+/i,
                        `WHERE ${orderColumn} > $cursor_value`
                    ),
                    indexRecommendation: `CREATE INDEX IF NOT EXISTS idx_pagination_${orderColumn} ON properties(${orderColumn})`,
                    reasoning: `Large OFFSET (${offset}) is inefficient. Cursor-based pagination using ${orderColumn} will be much faster.`
                };
            }
        }

        // For smaller offsets, suggest keyset pagination
        if (hasOrderBy && hasLimit) {
            return {
                suggestedApproach: 'keyset_pagination',
                optimizedQuery: query,
                indexRecommendation: 'Ensure proper index exists for ORDER BY columns',
                reasoning: 'Current pagination is acceptable for small result sets'
            };
        }

        return {
            suggestedApproach: 'offset_limit',
            optimizedQuery: query,
            indexRecommendation: 'No specific index needed',
            reasoning: 'Simple pagination without ordering'
        };
    }

    async suggestCompositeIndexes(queries: string[]): Promise<string[]> {
        const columnCombinations = new Map<string, number>();

        // Analyze all queries to find common column combinations
        for (const query of queries) {
            const columns = this.extractColumnsFromQuery(query);

            // Generate combinations of 2-3 columns
            for (let i = 0; i < columns.length; i++) {
                for (let j = i + 1; j < columns.length; j++) {
                    const combo = [columns[i], columns[j]].sort().join(',');
                    columnCombinations.set(combo, (columnCombinations.get(combo) || 0) + 1);

                    // Three-column combinations
                    for (let k = j + 1; k < columns.length; k++) {
                        const combo3 = [columns[i], columns[j], columns[k]].sort().join(',');
                        columnCombinations.set(combo3, (columnCombinations.get(combo3) || 0) + 1);
                    }
                }
            }
        }

        // Suggest indexes for frequently used combinations
        const suggestions: string[] = [];
        for (const [combo, frequency] of columnCombinations.entries()) {
            if (frequency >= 2) { // Used in at least 2 queries
                const columns = combo.split(',');
                const indexName = `idx_properties_${columns.join('_')}`;
                suggestions.push(
                    `CREATE INDEX IF NOT EXISTS ${indexName} ON properties(${columns.join(', ')})`
                );
            }
        }

        return suggestions;
    }

    private extractColumnsFromQuery(query: string): string[] {
        const columns: string[] = [];

        // Extract columns from WHERE clauses
        const whereMatches = query.match(/WHERE\s+(.+?)(?:\s+ORDER\s+BY|\s+GROUP\s+BY|\s+LIMIT|$)/gi);
        if (whereMatches) {
            for (const whereClause of whereMatches) {
                const columnMatches = whereClause.match(/(\w+)\s*[=<>]/g);
                if (columnMatches) {
                    columns.push(...columnMatches.map(match => match.replace(/\s*[=<>].*/, '')));
                }
            }
        }

        // Extract columns from ORDER BY clauses
        const orderMatches = query.match(/ORDER\s+BY\s+([^;]+)/gi);
        if (orderMatches) {
            for (const orderClause of orderMatches) {
                const columnMatches = orderClause.match(/(\w+)(?:\s+(?:ASC|DESC))?/g);
                if (columnMatches) {
                    columns.push(...columnMatches.map(match => match.replace(/\s+(?:ASC|DESC).*/, '')));
                }
            }
        }

        return [...new Set(columns)]; // Remove duplicates
    }
}