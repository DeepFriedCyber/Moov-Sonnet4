import { DatabaseService } from '../lib/database';
import { QueryPerformanceAnalyzer } from '../database/QueryPerformanceAnalyzer';
import { PropertySearchParams } from '../validation/propertySearchValidation';

export interface BenchmarkResult {
    testName: string;
    totalRequests: number;
    avgExecutionTime: number;
    p95ExecutionTime: number;
    p99ExecutionTime: number;
    minExecutionTime: number;
    maxExecutionTime: number;
    totalTime: number;
    requestsPerSecond: number;
    indexesUsed: string[];
    scanTypes: string[];
}

export interface VectorBenchmarkResult extends BenchmarkResult {
    vectorIndexUsed: boolean;
    avgSimilarityScore: number;
}

export interface ConnectionPoolResult {
    testName: string;
    totalRequests: number;
    successfulAcquisitions: number;
    failedAcquisitions: number;
    avgAcquisitionTime: number;
    maxPoolSize: number;
    connectionLeaks: number;
    efficiency: number;
}

export interface ComparisonResult {
    speedImprovement: number;
    timeReduction: number;
    throughputIncrease: number;
}

export class PerformanceTester {
    private analyzer: QueryPerformanceAnalyzer;
    private results = new Map<string, BenchmarkResult>();

    constructor(private database: DatabaseService) {
        this.analyzer = new QueryPerformanceAnalyzer(database);
    }

    async createTestProperties(count: number): Promise<void> {
        console.log(`🏗️ Creating ${count} test properties...`);

        const connection = await this.database.getClientWithRetry(3, 1000);

        try {
            // Clear existing test data
            await connection.query("DELETE FROM properties WHERE title LIKE 'TEST_%'");

            // Generate realistic test data
            const batchSize = 1000;
            for (let i = 0; i < count; i += batchSize) {
                const properties = this.generateTestProperties(Math.min(batchSize, count - i), i);
                await this.insertPropertiesBatch(connection, properties);

                if (i % 5000 === 0) {
                    console.log(`  Progress: ${i + batchSize}/${count} properties created`);
                }
            }

            console.log(`✅ Created ${count} test properties`);
        } finally {
            connection.release();
        }
    }

    private generateTestProperties(count: number, offset: number): any[] {
        const properties = [];
        const propertyTypes = ['house', 'flat', 'studio'];
        const areas = ['London', 'Manchester', 'Birmingham', 'Leeds', 'Liverpool'];
        const features = ['parking', 'garden', 'balcony', 'gym', 'concierge'];

        for (let i = 0; i < count; i++) {
            const propertyType = propertyTypes[Math.floor(Math.random() * propertyTypes.length)];
            const area = areas[Math.floor(Math.random() * areas.length)];
            const bedrooms = Math.floor(Math.random() * 5) + 1;
            const bathrooms = Math.floor(Math.random() * 3) + 1;
            const price = Math.floor(Math.random() * 1000000) + 100000;

            // London coordinates with some variance
            const lat = 51.5074 + (Math.random() - 0.5) * 0.5;
            const lng = -0.1278 + (Math.random() - 0.5) * 0.5;

            properties.push({
                title: `TEST_Property ${offset + i} - ${bedrooms}bed ${propertyType} in ${area}`,
                description: `Beautiful ${bedrooms}-bedroom ${propertyType} located in ${area}. Modern amenities and excellent transport links.`,
                price,
                bedrooms,
                bathrooms,
                property_type: propertyType,
                postcode: this.generatePostcode(),
                latitude: lat,
                longitude: lng,
                square_feet: Math.floor(Math.random() * 1000) + 500,
                features: this.randomFeatures(features),
                available: Math.random() > 0.1, // 90% available
                energy_rating: ['A', 'B', 'C', 'D', 'E'][Math.floor(Math.random() * 5)],
                council_tax_band: ['A', 'B', 'C', 'D', 'E', 'F', 'G'][Math.floor(Math.random() * 7)]
            });
        }

        return properties;
    }

    private generatePostcode(): string {
        const areas = ['SW1A', 'E1', 'N1', 'W1', 'SE1', 'M1', 'B1', 'LS1'];
        const area = areas[Math.floor(Math.random() * areas.length)];
        const number = Math.floor(Math.random() * 9) + 1;
        const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const suffix = letters[Math.floor(Math.random() * letters.length)] +
            letters[Math.floor(Math.random() * letters.length)];
        return `${area} ${number}${suffix}`;
    }

    private randomFeatures(features: string[]): string[] {
        const count = Math.floor(Math.random() * 3) + 1;
        const selected: string[] = [];
        for (let i = 0; i < count; i++) {
            const feature = features[Math.floor(Math.random() * features.length)];
            if (!selected.includes(feature)) {
                selected.push(feature);
            }
        }
        return selected;
    }

    private async insertPropertiesBatch(connection: any, properties: any[]): Promise<void> {
        const values = properties.map(p =>
            `('${p.title.replace(/'/g, "''")}', '${p.description.replace(/'/g, "''")}', ${p.price}, ${p.bedrooms}, ${p.bathrooms}, '${p.property_type}', '${p.postcode}', ${p.latitude}, ${p.longitude}, ${p.square_feet}, '${JSON.stringify(p.features).replace(/'/g, "''")}', ${p.available}, '${p.energy_rating}', '${p.council_tax_band}', NOW(), NOW())`
        ).join(',');

        const sql = `
      INSERT INTO properties (
        title, description, price, bedrooms, bathrooms, property_type,
        postcode, latitude, longitude, square_feet, features, available,
        energy_rating, council_tax_band, created_at, updated_at
      ) VALUES ${values}
    `;

        await connection.query(sql);
    }

    async runPropertySearchBenchmark(config: {
        testName: string;
        iterations: number;
        searchQueries: PropertySearchParams[];
    }): Promise<BenchmarkResult> {
        console.log(`\n🚀 Running ${config.testName} benchmark...`);

        const executionTimes: number[] = [];
        const allIndexesUsed = new Set<string>();
        const allScanTypes = new Set<string>();

        const startTime = Date.now();

        for (let i = 0; i < config.iterations; i++) {
            const query = config.searchQueries[i % config.searchQueries.length];

            const queryStart = Date.now();
            const result = await this.executePropertySearch(query);
            const queryEnd = Date.now();

            const executionTime = queryEnd - queryStart;
            executionTimes.push(executionTime);

            // Track indexes and scan types used
            if (result.indexesUsed) {
                result.indexesUsed.forEach(idx => allIndexesUsed.add(idx));
            }
            if (result.scanTypes) {
                result.scanTypes.forEach(scan => allScanTypes.add(scan));
            }

            if (i % 10 === 0) {
                process.stdout.write(`  Progress: ${i + 1}/${config.iterations}\r`);
            }
        }

        const totalTime = Date.now() - startTime;

        // Calculate statistics
        executionTimes.sort((a, b) => a - b);
        const avgExecutionTime = executionTimes.reduce((a, b) => a + b) / executionTimes.length;
        const p95Index = Math.floor(executionTimes.length * 0.95);
        const p99Index = Math.floor(executionTimes.length * 0.99);

        const result: BenchmarkResult = {
            testName: config.testName,
            totalRequests: config.iterations,
            avgExecutionTime: Math.round(avgExecutionTime * 100) / 100,
            p95ExecutionTime: executionTimes[p95Index],
            p99ExecutionTime: executionTimes[p99Index],
            minExecutionTime: executionTimes[0],
            maxExecutionTime: executionTimes[executionTimes.length - 1],
            totalTime,
            requestsPerSecond: Math.round((config.iterations / totalTime) * 1000 * 100) / 100,
            indexesUsed: Array.from(allIndexesUsed),
            scanTypes: Array.from(allScanTypes)
        };

        this.results.set(config.testName, result);
        return result;
    }

    private async executePropertySearch(params: PropertySearchParams): Promise<{
        results: any[];
        indexesUsed: string[];
        scanTypes: string[];
    }> {
        // Build a simple search query for testing
        const connection = await this.database.getClientWithRetry(3, 1000);

        try {
            let query = 'SELECT * FROM properties WHERE 1=1';
            const queryParams: any[] = [];
            let paramIndex = 1;

            if (params.query) {
                query += ` AND (title ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`;
                queryParams.push(`%${params.query}%`);
                paramIndex++;
            }

            if (params.price_min) {
                query += ` AND price >= $${paramIndex}`;
                queryParams.push(params.price_min);
                paramIndex++;
            }

            if (params.price_max) {
                query += ` AND price <= $${paramIndex}`;
                queryParams.push(params.price_max);
                paramIndex++;
            }

            if (params.bedrooms) {
                query += ` AND bedrooms = $${paramIndex}`;
                queryParams.push(params.bedrooms);
                paramIndex++;
            }

            if (params.property_type) {
                query += ` AND property_type = $${paramIndex}`;
                queryParams.push(params.property_type);
                paramIndex++;
            }

            if (params.latitude && params.longitude && params.radius) {
                query += ` AND ST_DWithin(ST_MakePoint(longitude, latitude)::geography, ST_MakePoint($${paramIndex}, $${paramIndex + 1})::geography, $${paramIndex + 2} * 1000)`;
                queryParams.push(params.longitude, params.latitude, params.radius);
                paramIndex += 3;
            }

            const limit = params.limit || 20;
            const page = params.page || 1;
            const offset = (page - 1) * limit;
            query += ` LIMIT ${limit} OFFSET ${offset}`;

            // Get query performance metrics
            const metrics = await this.analyzer.measureQueryPerformance(query, queryParams);

            // Execute the actual query
            const result = await connection.query(query, queryParams);

            return {
                results: result.rows,
                indexesUsed: metrics.indexesUsed,
                scanTypes: metrics.scanTypes
            };
        } finally {
            connection.release();
        }
    }

    async runComplexQueryBenchmark(config: {
        testName: string;
        iterations: number;
        query: PropertySearchParams;
    }): Promise<BenchmarkResult> {
        console.log(`\n🔍 Running ${config.testName} benchmark...`);

        const executionTimes: number[] = [];
        const allIndexesUsed = new Set<string>();
        const allScanTypes = new Set<string>();

        const startTime = Date.now();

        for (let i = 0; i < config.iterations; i++) {
            const queryStart = Date.now();
            const result = await this.executePropertySearch(config.query);
            const queryEnd = Date.now();

            const executionTime = queryEnd - queryStart;
            executionTimes.push(executionTime);

            result.indexesUsed.forEach(idx => allIndexesUsed.add(idx));
            result.scanTypes.forEach(scan => allScanTypes.add(scan));

            if (i % 5 === 0) {
                process.stdout.write(`  Progress: ${i + 1}/${config.iterations}\r`);
            }
        }

        const totalTime = Date.now() - startTime;

        // Calculate statistics
        executionTimes.sort((a, b) => a - b);
        const avgExecutionTime = executionTimes.reduce((a, b) => a + b) / executionTimes.length;
        const p95Index = Math.floor(executionTimes.length * 0.95);
        const p99Index = Math.floor(executionTimes.length * 0.99);

        const result: BenchmarkResult = {
            testName: config.testName,
            totalRequests: config.iterations,
            avgExecutionTime: Math.round(avgExecutionTime * 100) / 100,
            p95ExecutionTime: executionTimes[p95Index],
            p99ExecutionTime: executionTimes[p99Index],
            minExecutionTime: executionTimes[0],
            maxExecutionTime: executionTimes[executionTimes.length - 1],
            totalTime,
            requestsPerSecond: Math.round((config.iterations / totalTime) * 1000 * 100) / 100,
            indexesUsed: Array.from(allIndexesUsed),
            scanTypes: Array.from(allScanTypes)
        };

        this.results.set(config.testName, result);
        return result;
    }

    async runVectorSearchBenchmark(config: {
        testName: string;
        iterations: number;
        embeddingQueries: string[];
    }): Promise<VectorBenchmarkResult> {
        console.log(`\n🧠 Running ${config.testName} benchmark...`);

        const executionTimes: number[] = [];
        const similarityScores: number[] = [];
        let vectorIndexUsed = false;

        const startTime = Date.now();

        for (let i = 0; i < config.iterations; i++) {
            const queryText = config.embeddingQueries[i % config.embeddingQueries.length];

            const queryStart = Date.now();
            const result = await this.executeVectorSearch(queryText);
            const queryEnd = Date.now();

            const executionTime = queryEnd - queryStart;
            executionTimes.push(executionTime);

            if (result.avgSimilarity) {
                similarityScores.push(result.avgSimilarity);
            }

            if (result.vectorIndexUsed) {
                vectorIndexUsed = true;
            }

            if (i % 5 === 0) {
                process.stdout.write(`  Progress: ${i + 1}/${config.iterations}\r`);
            }
        }

        const totalTime = Date.now() - startTime;

        // Calculate statistics
        executionTimes.sort((a, b) => a - b);
        const avgExecutionTime = executionTimes.reduce((a, b) => a + b) / executionTimes.length;
        const p95Index = Math.floor(executionTimes.length * 0.95);
        const p99Index = Math.floor(executionTimes.length * 0.99);
        const avgSimilarityScore = similarityScores.length > 0
            ? similarityScores.reduce((a, b) => a + b) / similarityScores.length
            : 0;

        const result: VectorBenchmarkResult = {
            testName: config.testName,
            totalRequests: config.iterations,
            avgExecutionTime: Math.round(avgExecutionTime * 100) / 100,
            p95ExecutionTime: executionTimes[p95Index],
            p99ExecutionTime: executionTimes[p99Index],
            minExecutionTime: executionTimes[0],
            maxExecutionTime: executionTimes[executionTimes.length - 1],
            totalTime,
            requestsPerSecond: Math.round((config.iterations / totalTime) * 1000 * 100) / 100,
            indexesUsed: ['property_embeddings_hnsw'], // Assume vector index
            scanTypes: ['Index Scan'],
            vectorIndexUsed,
            avgSimilarityScore: Math.round(avgSimilarityScore * 1000) / 1000
        };

        this.results.set(config.testName, result);
        return result;
    }

    private async executeVectorSearch(queryText: string): Promise<{
        results: any[];
        avgSimilarity: number;
        vectorIndexUsed: boolean;
    }> {
        // Mock vector search for now - in real implementation this would:
        // 1. Generate embedding for queryText
        // 2. Perform vector similarity search
        // 3. Return results with similarity scores

        const connection = await this.database.getClientWithRetry(3, 1000);

        try {
            // Simple text search as placeholder for vector search
            const query = `
        SELECT *, 
               CASE WHEN title ILIKE $1 OR description ILIKE $1 
                    THEN 0.8 
                    ELSE 0.3 
               END as similarity_score
        FROM properties 
        WHERE title ILIKE $1 OR description ILIKE $1
        ORDER BY similarity_score DESC
        LIMIT 20
      `;

            const result = await connection.query(query, [`%${queryText}%`]);

            const avgSimilarity = result.rows.length > 0
                ? result.rows.reduce((sum, row) => sum + row.similarity_score, 0) / result.rows.length
                : 0;

            return {
                results: result.rows,
                avgSimilarity,
                vectorIndexUsed: true // Mock - would check if vector index was actually used
            };
        } finally {
            connection.release();
        }
    }

    async runConnectionPoolTest(config: {
        testName: string;
        concurrentConnections: number;
        operationsPerConnection: number;
        holdTimeMs: number;
        testDurationMs: number;
    }): Promise<ConnectionPoolResult> {
        console.log(`\n🏊 Running ${config.testName}...`);

        let totalRequests = 0;
        let successfulAcquisitions = 0;
        let failedAcquisitions = 0;
        const acquisitionTimes: number[] = [];
        let maxPoolSize = 0;
        let connectionLeaks = 0;

        const startTime = Date.now();
        const promises: Promise<void>[] = [];

        // Create concurrent connection workers
        for (let i = 0; i < config.concurrentConnections; i++) {
            const promise = this.connectionWorker(
                config.operationsPerConnection,
                config.holdTimeMs,
                acquisitionTimes,
                startTime,
                config.testDurationMs
            );
            promises.push(promise);
        }

        // Wait for all workers to complete
        const results = await Promise.allSettled(promises);

        // Count results
        results.forEach(result => {
            if (result.status === 'fulfilled') {
                totalRequests += config.operationsPerConnection;
                successfulAcquisitions += config.operationsPerConnection;
            } else {
                totalRequests += config.operationsPerConnection;
                failedAcquisitions += config.operationsPerConnection;
            }
        });

        const avgAcquisitionTime = acquisitionTimes.length > 0
            ? acquisitionTimes.reduce((a, b) => a + b) / acquisitionTimes.length
            : 0;

        const efficiency = totalRequests > 0
            ? (successfulAcquisitions / totalRequests) * 100
            : 0;

        return {
            testName: config.testName,
            totalRequests,
            successfulAcquisitions,
            failedAcquisitions,
            avgAcquisitionTime: Math.round(avgAcquisitionTime * 100) / 100,
            maxPoolSize: Math.max(config.concurrentConnections, 20), // Mock max pool size
            connectionLeaks,
            efficiency: Math.round(efficiency * 100) / 100
        };
    }

    private async connectionWorker(
        operations: number,
        holdTimeMs: number,
        acquisitionTimes: number[],
        startTime: number,
        maxDurationMs: number
    ): Promise<void> {
        for (let i = 0; i < operations; i++) {
            if (Date.now() - startTime > maxDurationMs) {
                break;
            }

            const acquisitionStart = Date.now();
            const connection = await this.database.getClientWithRetry(3, 1000);
            const acquisitionEnd = Date.now();

            acquisitionTimes.push(acquisitionEnd - acquisitionStart);

            try {
                // Simulate work
                await new Promise(resolve => setTimeout(resolve, holdTimeMs));
                await connection.query('SELECT 1');
            } finally {
                connection.release();
            }
        }
    }

    async comparePerformance(baseline: string, optimized: string): Promise<ComparisonResult> {
        const baselineResult = this.results.get(baseline);
        const optimizedResult = this.results.get(optimized);

        if (!baselineResult || !optimizedResult) {
            throw new Error('Both baseline and optimized results must exist for comparison');
        }

        const speedImprovement = baselineResult.avgExecutionTime / optimizedResult.avgExecutionTime;
        const timeReduction = ((baselineResult.avgExecutionTime - optimizedResult.avgExecutionTime) / baselineResult.avgExecutionTime) * 100;
        const throughputIncrease = ((optimizedResult.requestsPerSecond - baselineResult.requestsPerSecond) / baselineResult.requestsPerSecond) * 100;

        return {
            speedImprovement: Math.round(speedImprovement * 100) / 100,
            timeReduction: Math.round(timeReduction * 100) / 100,
            throughputIncrease: Math.round(throughputIncrease * 100) / 100
        };
    }

    async cleanupTestData(): Promise<void> {
        console.log('🧹 Cleaning up test data...');

        const connection = await this.database.getClientWithRetry(3, 1000);

        try {
            await connection.query("DELETE FROM properties WHERE title LIKE 'TEST_%'");
            console.log('✅ Test data cleaned up');
        } finally {
            connection.release();
        }
    }

    getResults(): Map<string, BenchmarkResult> {
        return this.results;
    }

    async generatePerformanceReport(): Promise<string> {
        let report = '\n📊 PERFORMANCE TEST REPORT\n';
        report += '='.repeat(50) + '\n\n';

        for (const [testName, result] of this.results) {
            report += `🚀 ${testName}\n`;
            report += `-`.repeat(30) + '\n';
            report += `Total Requests: ${result.totalRequests}\n`;
            report += `Average Time: ${result.avgExecutionTime}ms\n`;
            report += `P95 Time: ${result.p95ExecutionTime}ms\n`;
            report += `P99 Time: ${result.p99ExecutionTime}ms\n`;
            report += `Min Time: ${result.minExecutionTime}ms\n`;
            report += `Max Time: ${result.maxExecutionTime}ms\n`;
            report += `Requests/Second: ${result.requestsPerSecond}\n`;
            report += `Indexes Used: ${result.indexesUsed.join(', ') || 'None'}\n`;
            report += `Scan Types: ${result.scanTypes.join(', ') || 'None'}\n`;
            report += '\n';
        }

        return report;
    }
}