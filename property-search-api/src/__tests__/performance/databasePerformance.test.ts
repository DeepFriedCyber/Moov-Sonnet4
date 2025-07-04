// ===== UPDATED PERFORMANCE TEST SUITE: Database Index Performance =====
import { PerformanceTester } from '../../testing/PerformanceTester';
import { DatabaseIndexOptimizer } from '../../database/DatabaseIndexOptimizer';
import { DatabaseService } from '../../lib/database';
import { OptimizedPropertyService } from '../../services/OptimizedPropertyService';

describe('Database Performance Testing', () => {
    let tester: PerformanceTester;
    let optimizer: DatabaseIndexOptimizer;
    let database: DatabaseService;
    let propertyService: OptimizedPropertyService;

    beforeAll(async () => {
        // Set up test environment with DatabaseService
        database = new DatabaseService({
            connectionString: process.env.TEST_DATABASE_URL!,
            maxConnections: 20,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 5000,
            enableSSL: false,
            retryAttempts: 3,
            retryDelay: 1000
        });
        await database.initialize();

        optimizer = new DatabaseIndexOptimizer(database);
        propertyService = new OptimizedPropertyService(database);
        tester = new PerformanceTester(database);

        // Create test data
        await tester.createTestProperties(10000); // 10k properties for realistic testing
    });

    afterAll(async () => {
        await tester.cleanupTestData();
        await database.close();
    });

    test('should measure baseline performance without indexes', async () => {
        // Drop all indexes first
        await optimizer.dropPropertyIndexes();

        const baselineResults = await tester.runPropertySearchBenchmark({
            testName: 'Baseline (No Indexes)',
            iterations: 50,
            searchQueries: [
                { query: 'london apartment', price_min: 100000, price_max: 500000 },
                { bedrooms: 2, property_type: 'flat', page: 1, limit: 20 },
                { latitude: 51.5074, longitude: -0.1278, radius: 5 },
                { query: 'garden parking', bathrooms: 2, sort: 'price_asc' }
            ]
        });

        console.log('📊 BASELINE PERFORMANCE (No Indexes):');
        console.log(`Average Query Time: ${baselineResults.avgExecutionTime}ms`);
        console.log(`P95 Query Time: ${baselineResults.p95ExecutionTime}ms`);
        console.log(`Total Test Time: ${baselineResults.totalTime}ms`);

        // Store baseline for comparison
        expect(baselineResults.avgExecutionTime).toBeGreaterThan(500); // Should be slow without indexes
    });

    test('should measure dramatic improvement with indexes', async () => {
        // Create all property indexes
        const createdIndexes = await optimizer.createPropertyIndexes();
        console.log(`✅ Created ${createdIndexes.length} indexes`);

        const optimizedResults = await tester.runPropertySearchBenchmark({
            testName: 'Optimized (With Indexes)',
            iterations: 50,
            searchQueries: [
                { query: 'london apartment', price_min: 100000, price_max: 500000 },
                { bedrooms: 2, property_type: 'flat', page: 1, limit: 20 },
                { latitude: 51.5074, longitude: -0.1278, radius: 5 },
                { query: 'garden parking', bathrooms: 2, sort: 'price_asc' }
            ]
        });

        console.log('\n🚀 OPTIMIZED PERFORMANCE (With Indexes):');
        console.log(`Average Query Time: ${optimizedResults.avgExecutionTime}ms`);
        console.log(`P95 Query Time: ${optimizedResults.p95ExecutionTime}ms`);
        console.log(`Total Test Time: ${optimizedResults.totalTime}ms`);

        // Compare with baseline
        const improvement = await tester.comparePerformance('Baseline (No Indexes)', 'Optimized (With Indexes)');
        console.log(`\n⚡ PERFORMANCE IMPROVEMENT:`);
        console.log(`Speed Improvement: ${improvement.speedImprovement}x faster`);
        console.log(`Time Reduction: ${improvement.timeReduction}%`);

        // Validate significant improvement
        expect(optimizedResults.avgExecutionTime).toBeLessThan(100); // Should be under 100ms
        expect(improvement.speedImprovement).toBeGreaterThan(5); // At least 5x faster
    });

    test('should test complex query performance with all optimizations', async () => {
        const complexQueryResults = await tester.runComplexQueryBenchmark({
            testName: 'Complex Multi-Filter Search',
            iterations: 30,
            query: {
                query: 'modern apartment near station',
                price_min: 200000,
                price_max: 800000,
                bedrooms: 2,
                bathrooms: 1,
                property_type: 'flat',
                latitude: 51.5074,
                longitude: -0.1278,
                radius: 10,
                features: ['parking', 'garden'],
                sort: 'price_desc',
                page: 1,
                limit: 20
            }
        });

        console.log('\n🔍 COMPLEX QUERY PERFORMANCE:');
        console.log(`Average Time: ${complexQueryResults.avgExecutionTime}ms`);
        console.log(`Indexes Used: ${complexQueryResults.indexesUsed.join(', ')}`);
        console.log(`Scan Types: ${complexQueryResults.scanTypes.join(', ')}`);

        // Complex queries should still be fast with proper indexes
        expect(complexQueryResults.avgExecutionTime).toBeLessThan(200); // Under 200ms
        expect(complexQueryResults.indexesUsed.length).toBeGreaterThan(2); // Multiple indexes
    });

    test('should test vector similarity search performance', async () => {
        // Test semantic search with vector embeddings
        const vectorResults = await tester.runVectorSearchBenchmark({
            testName: 'Vector Similarity Search',
            iterations: 20,
            embeddingQueries: [
                'luxury apartment with river views',
                'family house with garden and parking',
                'studio flat near transport links'
            ]
        });

        console.log('\n🧠 VECTOR SEARCH PERFORMANCE:');
        console.log(`Average Time: ${vectorResults.avgExecutionTime}ms`);
        console.log(`Vector Index Used: ${vectorResults.vectorIndexUsed}`);
        console.log(`Similarity Threshold: ${vectorResults.avgSimilarityScore}`);

        // Vector search should be fast with HNSW index
        expect(vectorResults.avgExecutionTime).toBeLessThan(300); // Under 300ms
        expect(vectorResults.vectorIndexUsed).toBe(true);
    });

    test('should test connection pool performance under load', async () => {
        const poolResults = await tester.runConnectionPoolTest({
            testName: 'Connection Pool Load Test',
            concurrentConnections: 50,
            operationsPerConnection: 10,
            holdTimeMs: 100,
            testDurationMs: 30000 // 30 seconds
        });

        console.log('\n🏊 CONNECTION POOL PERFORMANCE:');
        console.log(`Total Connections Requested: ${poolResults.totalRequests}`);
        console.log(`Successful Acquisitions: ${poolResults.successfulAcquisitions}`);
        console.log(`Failed Acquisitions: ${poolResults.failedAcquisitions}`);
        console.log(`Avg Acquisition Time: ${poolResults.avgAcquisitionTime}ms`);
        console.log(`Connection Leaks: ${poolResults.connectionLeaks}`);
        console.log(`Pool Efficiency: ${poolResults.efficiency}%`);

        // Connection pool should be efficient and leak-free
        expect(poolResults.connectionLeaks).toBe(0); // No connection leaks
        expect(poolResults.avgAcquisitionTime).toBeLessThan(50); // Fast acquisition
        expect(poolResults.efficiency).toBeGreaterThan(95); // High efficiency
    });
});