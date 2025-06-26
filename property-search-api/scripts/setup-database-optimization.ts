#!/usr/bin/env ts-node

/**
 * Database Optimization Setup Script
 * 
 * This script sets up the comprehensive database indexing optimization system
 * for the property search API.
 */

import { DatabaseService } from '../src/lib/database';
import { DatabaseIndexOptimizer } from '../src/database/DatabaseIndexOptimizer';
import { IndexManager } from '../src/database/IndexManager';
import { QueryPerformanceAnalyzer } from '../src/database/QueryPerformanceAnalyzer';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

interface SetupOptions {
    createIndexes: boolean;
    analyzePerformance: boolean;
    generateReport: boolean;
    dropExisting: boolean;
}

class DatabaseOptimizationSetup {
    private database: DatabaseService;
    private optimizer: DatabaseIndexOptimizer;
    private manager: IndexManager;
    private analyzer: QueryPerformanceAnalyzer;

    constructor() {
        if (!process.env.DATABASE_URL) {
            throw new Error('DATABASE_URL environment variable is required');
        }

        this.database = new DatabaseService({
            connectionString: process.env.DATABASE_URL,
            minConnections: 2,
            maxConnections: 10
        });

        this.optimizer = new DatabaseIndexOptimizer(this.database);
        this.manager = new IndexManager(this.database);
        this.analyzer = new QueryPerformanceAnalyzer(this.database);
    }

    async initialize(): Promise<void> {
        console.log('🚀 Initializing database optimization setup...');
        await this.database.initialize();
        console.log('✅ Database connection established');
    }

    async setupOptimization(options: SetupOptions): Promise<void> {
        try {
            console.log('\n📊 Starting database optimization setup...\n');

            if (options.dropExisting) {
                await this.dropExistingIndexes();
            }

            if (options.createIndexes) {
                await this.createOptimizedIndexes();
            }

            if (options.analyzePerformance) {
                await this.analyzeCurrentPerformance();
            }

            if (options.generateReport) {
                await this.generateOptimizationReport();
            }

            console.log('\n🎉 Database optimization setup completed successfully!');

        } catch (error) {
            console.error('\n❌ Database optimization setup failed:', error);
            throw error;
        }
    }

    private async dropExistingIndexes(): Promise<void> {
        console.log('🗑️  Dropping existing property indexes...');

        try {
            await this.optimizer.dropPropertyIndexes();
            console.log('✅ Existing indexes dropped successfully');
        } catch (error) {
            console.warn('⚠️  Some indexes could not be dropped:', error.message);
        }
    }

    private async createOptimizedIndexes(): Promise<void> {
        console.log('🔨 Creating optimized property indexes...');

        const startTime = Date.now();
        const createdIndexes = await this.optimizer.createPropertyIndexes();
        const duration = Date.now() - startTime;

        console.log(`✅ Created ${createdIndexes.length} indexes in ${duration}ms:`);
        createdIndexes.forEach(index => {
            console.log(`   - ${index}`);
        });
    }

    private async analyzeCurrentPerformance(): Promise<void> {
        console.log('📈 Analyzing current query performance...');

        const testQueries = [
            {
                name: 'Basic price range query',
                sql: 'SELECT * FROM properties WHERE price BETWEEN $1 AND $2 LIMIT 20',
                params: [100000, 500000]
            },
            {
                name: 'Full-text search query',
                sql: `SELECT *, ts_rank(search_vector, plainto_tsquery('english', $1)) as rank 
              FROM properties 
              WHERE search_vector @@ plainto_tsquery('english', $1) 
              ORDER BY rank DESC LIMIT 20`,
                params: ['london apartment']
            },
            {
                name: 'Complex composite query',
                sql: `SELECT * FROM properties 
              WHERE price BETWEEN $1 AND $2 
              AND bedrooms >= $3 
              AND property_type = $4 
              AND available = true 
              ORDER BY created_at DESC LIMIT 20`,
                params: [200000, 800000, 2, 'flat']
            }
        ];

        for (const query of testQueries) {
            try {
                const metrics = await this.analyzer.measureQueryPerformance(query.sql, query.params);

                console.log(`\n📊 ${query.name}:`);
                console.log(`   Execution time: ${metrics.executionTime.toFixed(2)}ms`);
                console.log(`   Planning time: ${metrics.planningTime.toFixed(2)}ms`);
                console.log(`   Rows returned: ${metrics.rowsReturned}`);
                console.log(`   Indexes used: ${metrics.indexesUsed.join(', ') || 'None'}`);
                console.log(`   Scan types: ${metrics.scanTypes.join(', ')}`);

                if (metrics.executionTime > 100) {
                    console.log('   ⚠️  Query is slow - consider optimization');
                } else {
                    console.log('   ✅ Query performance is good');
                }
            } catch (error) {
                console.warn(`   ❌ Failed to analyze query: ${error.message}`);
            }
        }
    }

    private async generateOptimizationReport(): Promise<void> {
        console.log('\n📋 Generating optimization report...');

        try {
            // Get current indexes
            const currentIndexes = await this.manager.listIndexes('properties');
            console.log(`\n📊 Current indexes (${currentIndexes.length}):`);
            currentIndexes.forEach(index => {
                console.log(`   - ${index}`);
            });

            // Get index information
            const indexInfo = await this.manager.getIndexInfo('properties');
            console.log(`\n📈 Index usage statistics:`);
            indexInfo.forEach(info => {
                console.log(`   ${info.indexName}:`);
                console.log(`     Size: ${info.size}`);
                console.log(`     Scans: ${info.scans}`);
                console.log(`     Type: ${info.indexType}`);
            });

            // Get optimization recommendations
            const recommendations = await this.manager.getOptimizationRecommendations();
            if (recommendations.length > 0) {
                console.log(`\n💡 Optimization recommendations:`);
                recommendations.forEach(rec => {
                    console.log(`   ${rec.type.toUpperCase()}: ${rec.indexName}`);
                    console.log(`     Reason: ${rec.reason}`);
                    console.log(`     Impact: ${rec.estimatedImpact}`);
                });
            } else {
                console.log(`\n✅ No optimization recommendations - indexes are well optimized!`);
            }

            // Find unused indexes
            const unusedIndexes = await this.manager.findUnusedIndexes();
            if (unusedIndexes.length > 0) {
                console.log(`\n🗑️  Unused indexes (consider dropping):`);
                unusedIndexes.forEach(index => {
                    console.log(`   - ${index.indexName} (${index.scans} scans)`);
                });
            }

        } catch (error) {
            console.warn('⚠️  Could not generate complete optimization report:', error.message);
        }
    }

    async cleanup(): Promise<void> {
        console.log('\n🧹 Cleaning up...');
        await this.database.close();
        console.log('✅ Database connections closed');
    }
}

// CLI Interface
async function main(): Promise<void> {
    const args = process.argv.slice(2);

    const options: SetupOptions = {
        createIndexes: args.includes('--create-indexes') || args.includes('--all'),
        analyzePerformance: args.includes('--analyze') || args.includes('--all'),
        generateReport: args.includes('--report') || args.includes('--all'),
        dropExisting: args.includes('--drop-existing')
    };

    // Default to all operations if no specific flags
    if (!args.length || args.includes('--all')) {
        options.createIndexes = true;
        options.analyzePerformance = true;
        options.generateReport = true;
    }

    if (args.includes('--help')) {
        console.log(`
Database Optimization Setup Script

Usage: ts-node scripts/setup-database-optimization.ts [options]

Options:
  --create-indexes    Create optimized database indexes
  --analyze          Analyze query performance
  --report           Generate optimization report
  --drop-existing    Drop existing indexes before creating new ones
  --all              Run all operations (default)
  --help             Show this help message

Examples:
  ts-node scripts/setup-database-optimization.ts --all
  ts-node scripts/setup-database-optimization.ts --create-indexes --analyze
  ts-node scripts/setup-database-optimization.ts --report
    `);
        return;
    }

    const setup = new DatabaseOptimizationSetup();

    try {
        await setup.initialize();
        await setup.setupOptimization(options);
    } catch (error) {
        console.error('Setup failed:', error);
        process.exit(1);
    } finally {
        await setup.cleanup();
    }
}

// Run if called directly
if (require.main === module) {
    main().catch(error => {
        console.error('Unhandled error:', error);
        process.exit(1);
    });
}

export { DatabaseOptimizationSetup, SetupOptions };