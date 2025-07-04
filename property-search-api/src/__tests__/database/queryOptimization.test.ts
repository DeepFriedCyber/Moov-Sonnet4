import { QueryOptimizer } from '../../database/QueryOptimizer';
import { DatabaseService } from '../../lib/database';

describe('Query Optimization', () => {
    let optimizer: QueryOptimizer;
    let database: DatabaseService;

    beforeAll(async () => {
        database = new DatabaseService({
            connectionString: process.env.TEST_DATABASE_URL!,
            maxConnections: 5,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 5000,
            enableSSL: false,
            retryAttempts: 3,
            retryDelay: 1000
        });
        await database.initialize();
        optimizer = new QueryOptimizer(database);
    });

    afterAll(async () => {
        await database.close();
    });

    test('should suggest query improvements for slow property searches', async () => {
        const slowQuery = `
      SELECT * FROM properties p
      LEFT JOIN property_images pi ON p.id = pi.property_id
      WHERE p.title LIKE '%london%'
      AND p.price > 100000
      ORDER BY p.created_at DESC
    `;

        const suggestions = await optimizer.analyzeAndOptimize(slowQuery);

        expect(suggestions).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    type: expect.stringMatching(/^(index|query_rewrite|schema_change)$/),
                    suggestion: expect.any(String),
                    impact: expect.stringMatching(/^(low|medium|high)$/)
                })
            ])
        );

        // Should suggest full-text search for LIKE patterns
        const fullTextSuggestion = suggestions.find(s =>
            s.suggestion.includes('full-text search')
        );
        expect(fullTextSuggestion).toBeDefined();
    });

    test('should optimize property search with multiple filters', async () => {
        const originalQuery = `
      SELECT p.* FROM properties p
      WHERE p.price BETWEEN 200000 AND 800000
      AND p.bedrooms >= 2
      AND p.property_type IN ('house', 'flat')
      AND p.available = true
      AND (p.title LIKE '%garden%' OR p.description LIKE '%garden%')
      ORDER BY p.price ASC
    `;

        const optimizedQuery = await optimizer.optimizeQuery(originalQuery);

        expect(optimizedQuery).toContain('search_vector @@ plainto_tsquery');
        expect(optimizedQuery).toContain('CREATE INDEX IF NOT EXISTS');

        const performance = await optimizer.compareQueryPerformance(
            originalQuery,
            optimizedQuery.split('\n').slice(-10).join('\n') // Get actual query without comments
        );

        expect(performance).toMatchObject({
            originalExecutionTime: expect.any(Number),
            optimizedExecutionTime: expect.any(Number),
            improvement: expect.any(Number),
            recommendation: expect.any(String)
        });
    });

    test('should optimize pagination queries for large result sets', async () => {
        const paginationQuery = `
      SELECT * FROM properties
      WHERE available = true
      ORDER BY created_at DESC
      OFFSET 1000 LIMIT 20
    `;

        const optimization = await optimizer.optimizePagination(paginationQuery);

        expect(optimization.suggestedApproach).toBe('cursor_based');
        expect(optimization.optimizedQuery).toContain('WHERE created_at <');
        expect(optimization.indexRecommendation).toContain('created_at');
        expect(optimization.reasoning).toContain('Large OFFSET');
    });

    test('should suggest composite indexes for common query patterns', async () => {
        const queries = [
            'SELECT * FROM properties WHERE price BETWEEN 100000 AND 500000 AND bedrooms >= 2',
            'SELECT * FROM properties WHERE price > 200000 AND property_type = \'flat\'',
            'SELECT * FROM properties WHERE bedrooms = 3 AND property_type = \'house\' ORDER BY price'
        ];

        const suggestions = await optimizer.suggestCompositeIndexes(queries);

        expect(Array.isArray(suggestions)).toBe(true);
        expect(suggestions.length).toBeGreaterThan(0);

        // Should suggest composite indexes for frequently used column combinations
        const priceBedroomsIndex = suggestions.find(s =>
            s.includes('price') && s.includes('bedrooms')
        );
        expect(priceBedroomsIndex).toBeDefined();
    });

    test('should analyze query for anti-patterns', async () => {
        const antiPatternQuery = `
      SELECT * FROM properties 
      WHERE title LIKE '%expensive%'
      AND description ILIKE '%luxury%'
      ORDER BY created_at
    `;

        const suggestions = await optimizer.analyzeAndOptimize(antiPatternQuery);

        // Should detect LIKE with leading wildcard
        const likeSuggestion = suggestions.find(s =>
            s.suggestion.includes('full-text search')
        );
        expect(likeSuggestion).toBeDefined();
        expect(likeSuggestion?.impact).toBe('high');

        // Should detect ILIKE usage
        const ilikeSuggestion = suggestions.find(s =>
            s.suggestion.includes('ILIKE')
        );
        expect(ilikeSuggestion).toBeDefined();
    });

    test('should handle queries without optimization opportunities', async () => {
        const efficientQuery = `
      SELECT id, title, price FROM properties 
      WHERE id = $1
    `;

        const suggestions = await optimizer.analyzeAndOptimize(efficientQuery);

        // Should return minimal or no suggestions for already efficient queries
        expect(Array.isArray(suggestions)).toBe(true);
    });
});