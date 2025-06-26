#!/usr/bin/env ts-node

/**
 * Performance Test Runner
 * 
 * This script runs comprehensive performance tests for the property search API
 * including database optimization, API load testing, and connection pool testing.
 */

import * as dotenv from 'dotenv';
import { DatabaseService } from '../src/lib/database';
import { PerformanceTester } from '../src/testing/PerformanceTester';
import { DatabaseIndexOptimizer } from '../src/database/DatabaseIndexOptimizer';

// Load environment variables
dotenv.config();

interface PerformanceTestConfig {
    runDatabaseTests: boolean;
    runApiTests: boolean;
    runConnectionPoolTests: boolean;
    testDataSize: number;
    iterations: number;
    concurrentUsers: number;
    verbose: boolean;
}

class PerformanceTestRunner {
    private database: DatabaseService;
    private tester: PerformanceTester;
    private optimizer: DatabaseIndexOptimizer;

    constructor(private config: PerformanceTestConfig) {
        this.database = new DatabaseService({
            connectionString: process.env.DATABASE_URL!,
            minConnections: 5,
            maxConnections: 20
        });

        this.tester = new PerformanceTester(this.database);
        this.optimizer = new DatabaseIndexOptimizer(this.database);
    }

    async initialize(): Promise<void> {
        console.log('🚀 Initializing Performance Test Runner...');
        await this.database.initialize();
        console.log('✅ Database connection established');
    }

    async runAllTests(): Promise<void> {
        console.log('\n📊 STARTING COMPREHENSIVE PERFORMANCE TESTS');
        console.log('='.repeat(60));

        const startTime = Date.now();

        try {
            if (this.config.runDatabaseTests) {
                await this.runDatabasePerformanceTests();
            }

            if (this.config.runConnectionPoolTests) {
                await this.runConnectionPoolTests();
            }

            // Generate final report
            await this.generateFinalReport();

        } catch (error) {
            console.error('❌ Performance tests failed:', error);
            throw error;
        } finally {
            const totalTime = Date.now() - startTime;
            console.log(`\n⏱️ Total test time: ${Math.round(totalTime / 1000)}s`);
        }
    }

    private async runDatabasePerformanceTests(): Promise<void> {
        console.log('\n🗄️ DATABASE PERFORMANCE TESTS');
        console.log('-'.repeat(40));

        // Create test data
        await this.tester.createTestProperties(this.config.testDataSize);

        // Test 1: Baseline performance (no indexes)
        console.log('\n📊 Testing baseline performance (no indexes)...');
        await this.optimizer.dropPropertyIndexes();

        const baselineResults = await this.tester.runPropertySearchBenchmark({
            testName: 'Baseline (No Indexes)',
            iterations: this.config.iterations,
            searchQueries: [
                { query: 'london apartment', price_min: 100000, price_max: 500000 },
                { bedrooms: 2, property_type: 'flat', page: 1, limit: 20 },
                { latitude: 51.5074, longitude: -0.1278, radius: 5 },
                { query: 'garden parking', bathrooms: 2, sort: 'price_asc' }
            ]
        });

        this.logResults('BASELINE PERFORMANCE', baselineResults);

        // Test 2: Optimized performance (with indexes)
        console.log('\n🚀 Testing optimized performance (with indexes)...');
        const createdIndexes = await this.optimizer.createPropertyIndexes();
        console.log(`✅ Created ${createdIndexes.length} indexes`);

        const optimizedResults = await this.tester.runPropertySearchBenchmark({
            testName: 'Optimized (With Indexes)',
            iterations: this.config.iterations,
            searchQueries: [
                { query: 'london apartment', price_min: 100000, price_max: 500000 },
                { bedrooms: 2, property_type: 'flat', page: 1, limit: 20 },
                { latitude: 51.5074, longitude: -0.1278, radius: 5 },
                { query: 'garden parking', bathrooms: 2, sort: 'price_asc' }
            ]
        });

        this.logResults('OPTIMIZED PERFORMANCE', optimizedResults);

        // Compare results
        const improvement = await this.tester.comparePerformance(
            'Baseline (No Indexes)',
            'Optimized (With Indexes)'
        );

        console.log('\n⚡ PERFORMANCE IMPROVEMENT:');
        console.log(`Speed Improvement: ${improvement.speedImprovement}x faster`);
        console.log(`Time Reduction: ${improvement.timeReduction}%`);
        console.log(`Throughput Increase: ${improvement.throughputIncrease}%`);

        // Test 3: Complex query performance
        console.log('\n🔍 Testing complex query performance...');
        const complexResults = await this.tester.runComplexQueryBenchmark({
            testName: 'Complex Multi-Filter Search',
            iterations: Math.floor(this.config.iterations / 2),
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

        this.logResults('COMPLEX QUERY PERFORMANCE', complexResults);

        // Test 4: Vector search performance
        console.log('\n🧠 Testing vector search performance...');
        const vectorResults = await this.tester.runVectorSearchBenchmark({
            testName: 'Vector Similarity Search',
            iterations: Math.floor(this.config.iterations / 3),
            embeddingQueries: [
                'luxury apartment with river views',
                'family house with garden and parking',
                'studio flat near transport links'
            ]
        });

        this.logVectorResults('VECTOR SEARCH PERFORMANCE', vectorResults);
    }

    private async runConnectionPoolTests(): Promise<void> {
        console.log('\n🏊 CONNECTION POOL PERFORMANCE TESTS');
        console.log('-'.repeat(40));

        const poolResults = await this.tester.runConnectionPoolTest({
            testName: 'Connection Pool Load Test',
            concurrentConnections: this.config.concurrentUsers,
            operationsPerConnection: 10,
            holdTimeMs: 100,
            testDurationMs: 30000 // 30 seconds
        });

        console.log('\n🏊 CONNECTION POOL RESULTS:');
        console.log(`Total Requests: ${poolResults.totalRequests}`);
        console.log(`Successful Acquisitions: ${poolResults.successfulAcquisitions}`);
        console.log(`Failed Acquisitions: ${poolResults.failedAcquisitions}`);
        console.log(`Avg Acquisition Time: ${poolResults.avgAcquisitionTime}ms`);
        console.log(`Max Pool Size: ${poolResults.maxPoolSize}`);
        console.log(`Connection Leaks: ${poolResults.connectionLeaks}`);
        console.log(`Pool Efficiency: ${poolResults.efficiency}%`);

        // Validate pool performance
        if (poolResults.connectionLeaks > 0) {
            console.warn('⚠️ Connection leaks detected!');
        }

        if (poolResults.efficiency < 95) {
            console.warn('⚠️ Pool efficiency below 95%');
        }

        if (poolResults.avgAcquisitionTime > 100) {
            console.warn('⚠️ Average acquisition time above 100ms');
        }
    }

    private logResults(title: string, results: any): void {
        console.log(`\n📊 ${title}:`);
        console.log(`Average Query Time: ${results.avgExecutionTime}ms`);
        console.log(`P95 Query Time: ${results.p95ExecutionTime}ms`);
        console.log(`P99 Query Time: ${results.p99ExecutionTime}ms`);
        console.log(`Min Query Time: ${results.minExecutionTime}ms`);
        console.log(`Max Query Time: ${results.maxExecutionTime}ms`);
        console.log(`Requests/Second: ${results.requestsPerSecond}`);
        console.log(`Total Requests: ${results.totalRequests}`);
        console.log(`Indexes Used: ${results.indexesUsed.join(', ') || 'None'}`);
        console.log(`Scan Types: ${results.scanTypes.join(', ') || 'None'}`);
    }

    private logVectorResults(title: string, results: any): void {
        this.logResults(title, results);
        console.log(`Vector Index Used: ${results.vectorIndexUsed}`);
        console.log(`Avg Similarity Score: ${results.avgSimilarityScore}`);
    }

    private async generateFinalReport(): Promise<void> {
        console.log('\n📋 GENERATING FINAL PERFORMANCE REPORT');
        console.log('-'.repeat(40));

        const report = await this.tester.generatePerformanceReport();
        console.log(report);

        // Save report to file
        const fs = require('fs');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `performance-report-${timestamp}.txt`;

        fs.writeFileSync(filename, report);
        console.log(`📄 Report saved to: ${filename}`);
    }

    async cleanup(): Promise<void> {
        console.log('\n🧹 Cleaning up...');
        await this.tester.cleanupTestData();
        await this.database.close();
        console.log('✅ Cleanup completed');
    }
}

// CLI Interface
async function main(): Promise<void> {
    const args = process.argv.slice(2);

    const config: PerformanceTestConfig = {
        runDatabaseTests: args.includes('--database') || args.includes('--all') || args.length === 0,
        runApiTests: args.includes('--api') || args.includes('--all'),
        runConnectionPoolTests: args.includes('--pool') || args.includes('--all') || args.length === 0,
        testDataSize: parseInt(args.find(arg => arg.startsWith('--data-size='))?.split('=')[1] || '5000'),
        iterations: parseInt(args.find(arg => arg.startsWith('--iterations='))?.split('=')[1] || '30'),
        concurrentUsers: parseInt(args.find(arg => arg.startsWith('--users='))?.split('=')[1] || '25'),
        verbose: args.includes('--verbose')
    };

    if (args.includes('--help')) {
        console.log(`
Performance Test Runner

Usage: npm run test:performance [options]

Options:
  --database          Run database performance tests
  --api              Run API performance tests  
  --pool             Run connection pool tests
  --all              Run all tests (default)
  --data-size=N      Number of test properties to create (default: 5000)
  --iterations=N     Number of test iterations (default: 30)
  --users=N          Number of concurrent users (default: 25)
  --verbose          Verbose output
  --help             Show this help

Examples:
  npm run test:performance --database --iterations=50
  npm run test:performance --all --data-size=10000 --users=50
  npm run test:performance --pool --verbose
    `);
        return;
    }

    console.log('🎯 PROPERTY SEARCH API PERFORMANCE TESTING SUITE');
    console.log('='.repeat(60));
    console.log(`Test Data Size: ${config.testDataSize} properties`);
    console.log(`Iterations: ${config.iterations}`);
    console.log(`Concurrent Users: ${config.concurrentUsers}`);
    console.log(`Database Tests: ${config.runDatabaseTests ? '✅' : '❌'}`);
    console.log(`API Tests: ${config.runApiTests ? '✅' : '❌'}`);
    console.log(`Pool Tests: ${config.runConnectionPoolTests ? '✅' : '❌'}`);

    const runner = new PerformanceTestRunner(config);

    try {
        await runner.initialize();
        await runner.runAllTests();
        console.log('\n🎉 All performance tests completed successfully!');
    } catch (error) {
        console.error('\n❌ Performance tests failed:', error);
        process.exit(1);
    } finally {
        await runner.cleanup();
    }
}

// Run if called directly
if (require.main === module) {
    main().catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}

export { PerformanceTestRunner, PerformanceTestConfig };