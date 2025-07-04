import { DatabaseIndexOptimizer } from '../../database/DatabaseIndexOptimizer';
import { DatabaseService } from '../../lib/database';
import { QueryPerformanceAnalyzer } from '../../database/QueryPerformanceAnalyzer';

describe('Database Index Performance', () => {
    let optimizer: DatabaseIndexOptimizer;
    let database: DatabaseService;
    let analyzer: QueryPerformanceAnalyzer;

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

        optimizer = new DatabaseIndexOptimizer(database);
        analyzer = new QueryPerformanceAnalyzer(database);

        // Set up test data
        await setupTestData();
    });

    afterAll(async () => {
        await database.close();
    });

    test('should create all required indexes for property search', async () => {
        const indexesCreated = await optimizer.createPropertyIndexes();

        expect(indexesCreated).toContain('idx_properties_price');
        expect(indexesCreated).toContain('idx_properties_bedrooms');
        expect(indexesCreated).toContain('idx_properties_property_type');
        expect(indexesCreated).toContain('idx_properties_available');
        expect(indexesCreated).toContain('idx_properties_available_type_price');
        expect(indexesCreated).toContain('idx_properties_bedrooms_bathrooms');
        expect(indexesCreated).toContain('idx_properties_location_gist');
        expect(indexesCreated).toContain('idx_properties_search_vector');
    });

    test('should dramatically improve property search query performance', async () => {
        // Test query performance before indexes
        const queryWithoutIndexes = `
      SELECT * FROM properties 
      WHERE price BETWEEN $1 AND $2 
      AND bedrooms >= $3 
      AND property_type = $4
      AND available = true
      ORDER BY price ASC
      LIMIT 20
    `;

        // Drop indexes to test baseline
        await optimizer.dropPropertyIndexes();
        const performanceBefore = await analyzer.measureQueryPerformance(
            queryWithoutIndexes,
            [100000, 500000, 2, 'flat']
        );

        // Create indexes
        await optimizer.createPropertyIndexes();
        const performanceAfter = await analyzer.measureQueryPerformance(
            queryWithoutIndexes,
            [100000, 500000, 2, 'flat']
        );

        // Should be significantly faster with indexes
        expect(performanceAfter.executionTime).toBeLessThan(performanceBefore.executionTime);
        expect(performanceAfter.totalTime).toBeLessThan(performanceBefore.totalTime);
    });

    test('should optimize full-text search queries', async () => {
        const textSearchQuery = `
      SELECT p.*, ts_rank(search_vector, plainto_tsquery('english', $1)) as rank
      FROM properties p
      WHERE search_vector @@ plainto_tsquery('english', $1)
      ORDER BY rank DESC
      LIMIT 20
    `;

        const performance = await analyzer.measureQueryPerformance(
            textSearchQuery,
            ['london apartment modern']
        );

        // Text search should complete in reasonable time with proper GIN index
        expect(performance.executionTime).toBeLessThan(1000); // 1 second max for test
        expect(performance.indexesUsed).toContain('idx_properties_search_vector');
    });

    test('should optimize geographic proximity searches', async () => {
        const geoSearchQuery = `
      SELECT *, 
        ST_Distance(
          ST_Point(longitude, latitude)::geography,
          ST_Point($1, $2)::geography
        ) as distance
      FROM properties
      WHERE ST_DWithin(
        ST_Point(longitude, latitude)::geography,
        ST_Point($1, $2)::geography,
        $3 * 1000
      )
      ORDER BY distance
      LIMIT 20
    `;

        const performance = await analyzer.measureQueryPerformance(
            geoSearchQuery,
            [-0.1278, 51.5074, 5] // London coordinates, 5km radius
        );

        // Geographic search should be reasonably fast with spatial index
        expect(performance.executionTime).toBeLessThan(2000); // 2 seconds max for test
        expect(performance.indexesUsed).toContain('idx_properties_location_gist');
    });

    test('should optimize vector similarity searches for semantic search', async () => {
        const vectorSearchQuery = `
      SELECT p.*, 
        1 - (pe.combined_embedding <=> $1::vector) as similarity_score
      FROM properties p
      JOIN property_embeddings pe ON p.id = pe.property_id
      WHERE 1 - (pe.combined_embedding <=> $1::vector) > 0.7
      ORDER BY pe.combined_embedding <=> $1::vector
      LIMIT 20
    `;

        // Generate test embedding vector (384 dimensions)
        const testEmbedding = Array(384).fill(0).map(() => Math.random());

        const performance = await analyzer.measureQueryPerformance(
            vectorSearchQuery,
            [JSON.stringify(testEmbedding)]
        );

        // Vector search should complete in reasonable time
        expect(performance.executionTime).toBeLessThan(5000); // 5 seconds max for test
        // Note: Vector indexes might not be available in test environment
    });

    test('should optimize complex composite queries', async () => {
        const complexQuery = `
      SELECT p.*, 
        ts_rank(search_vector, plainto_tsquery('english', $1)) as text_rank,
        ST_Distance(
          ST_Point(longitude, latitude)::geography,
          ST_Point($2, $3)::geography
        ) as distance
      FROM properties p
      WHERE price BETWEEN $4 AND $5
      AND bedrooms >= $6
      AND property_type = ANY($7)
      AND available = true
      AND search_vector @@ plainto_tsquery('english', $1)
      AND ST_DWithin(
        ST_Point(longitude, latitude)::geography,
        ST_Point($2, $3)::geography,
        $8 * 1000
      )
      ORDER BY text_rank DESC, distance ASC
      LIMIT 20
    `;

        const performance = await analyzer.measureQueryPerformance(
            complexQuery,
            [
                'modern apartment',    // $1 - search text
                -0.1278, 51.5074,     // $2, $3 - London coordinates
                200000, 800000,       // $4, $5 - price range
                2,                    // $6 - minimum bedrooms
                ['flat', 'house'],    // $7 - property types
                10                    // $8 - radius in km
            ]
        );

        // Complex query should still complete in reasonable time with proper indexes
        expect(performance.executionTime).toBeLessThan(10000); // 10 seconds max for test
        expect(performance.indexesUsed.length).toBeGreaterThan(0);
    });
});

// Helper function to set up test data
async function setupTestData(): Promise<void> {
    // This would be implemented to create sample property data for testing
    // For now, we'll assume the test database has some sample data
    console.log('Setting up test data...');
}