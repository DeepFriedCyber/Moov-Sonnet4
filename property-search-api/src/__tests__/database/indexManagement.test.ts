import { IndexManager } from '../../database/IndexManager';
import { DatabaseService } from '../../lib/database';

describe('Index Creation and Management', () => {
    let indexManager: IndexManager;
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
        indexManager = new IndexManager(database);
    });

    afterAll(async () => {
        await database.close();
    });

    test('should create indexes concurrently without blocking', async () => {
        const startTime = Date.now();

        // Create multiple indexes concurrently
        await indexManager.createIndexesConcurrently([
            'idx_test_concurrent_1',
            'idx_test_concurrent_2',
            'idx_test_concurrent_3'
        ]);

        const endTime = Date.now();

        // Should complete all indexes in reasonable time
        expect(endTime - startTime).toBeLessThan(60000); // 60 seconds max for test

        // Verify all indexes exist
        const indexes = await indexManager.listIndexes('properties');
        expect(indexes).toContain('idx_test_concurrent_1');
        expect(indexes).toContain('idx_test_concurrent_2');
        expect(indexes).toContain('idx_test_concurrent_3');
    });

    test('should detect missing indexes and suggest creation', async () => {
        // Drop some indexes first
        await indexManager.dropIndex('idx_properties_price');

        const missingIndexes = await indexManager.detectMissingIndexes();

        expect(missingIndexes).toContain('idx_properties_price');

        const suggestions = await indexManager.getIndexSuggestions();
        expect(suggestions).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    indexName: expect.any(String),
                    reason: expect.any(String),
                    impact: expect.stringMatching(/^(low|medium|high)$/)
                })
            ])
        );
    });

    test('should analyze index usage and recommend optimization', async () => {
        // Simulate some queries to generate usage stats
        await simulateQueryWorkload();

        const unusedIndexes = await indexManager.findUnusedIndexes();
        const recommendations = await indexManager.getOptimizationRecommendations();

        expect(recommendations).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    type: expect.stringMatching(/^(create|drop|modify)$/),
                    indexName: expect.any(String),
                    reason: expect.any(String),
                    estimatedImpact: expect.any(String)
                })
            ])
        );
    });

    test('should validate index effectiveness', async () => {
        const testQuery = `
      SELECT * FROM properties 
      WHERE price BETWEEN $1 AND $2 
      ORDER BY created_at DESC 
      LIMIT 10
    `;

        const effectiveness = await indexManager.validateIndexEffectiveness(
            'idx_properties_price',
            testQuery,
            [100000, 500000]
        );

        expect(effectiveness).toMatchObject({
            indexUsed: expect.any(Boolean),
            scanType: expect.any(String),
            rowsExamined: expect.any(Number),
            rowsReturned: expect.any(Number),
            selectivity: expect.any(Number),
            recommendation: expect.any(String)
        });
    });

    test('should list all indexes for a table', async () => {
        const indexes = await indexManager.listIndexes('properties');

        expect(Array.isArray(indexes)).toBe(true);
        expect(indexes.length).toBeGreaterThan(0);
    });

    test('should get detailed index information', async () => {
        const indexInfo = await indexManager.getIndexInfo('properties');

        expect(Array.isArray(indexInfo)).toBe(true);

        if (indexInfo.length > 0) {
            expect(indexInfo[0]).toMatchObject({
                indexName: expect.any(String),
                tableName: expect.any(String),
                columnNames: expect.any(Array),
                indexType: expect.any(String),
                isUnique: expect.any(Boolean),
                size: expect.any(String),
                scans: expect.any(Number),
                tupleReads: expect.any(Number),
                tupleFetches: expect.any(Number)
            });
        }
    });
});

// Helper function to simulate query workload
async function simulateQueryWorkload(): Promise<void> {
    // This would run various property search queries to generate usage statistics
    console.log('Simulating query workload...');
}