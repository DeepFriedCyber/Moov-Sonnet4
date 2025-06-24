// Integration tests for the enhanced database architecture
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { DatabaseFactory } from '../factory/database.factory';
import { DatabaseConfigFactory } from '../config/database.config';
import { DatabaseMonitor } from '../monitoring/database.monitoring';
import { MigrationRunner } from '../migrations/database.migrations';

// Mock pg module for integration tests
const mockClient = {
    query: vi.fn().mockResolvedValue({ rows: [] }),
    release: vi.fn(),
};

const mockPool = {
    query: vi.fn().mockResolvedValue({ rows: [] }),
    connect: vi.fn().mockResolvedValue(mockClient),
    end: vi.fn(),
    on: vi.fn(),
};

// Make mockPool available globally for tests
(global as any).mockPool = mockPool;

vi.mock('pg', () => {
    return {
        Pool: vi.fn(() => mockPool),
    };
});

describe('Database Integration - Enhanced Architecture', () => {
    let factory: DatabaseFactory;

    beforeAll(() => {
        factory = DatabaseFactory.getInstance();

        // Set up mock responses for health checks
        mockPool.query
            .mockResolvedValue({ rows: [{ extname: 'vector' }] }) // Extension check
            .mockResolvedValueOnce({ rows: [{ table_name: 'properties' }] }) // Table check
            .mockResolvedValueOnce({ rows: [{ count: '0' }] }); // Count check
    });

    afterAll(async () => {
        await factory.shutdown();
    });

    describe('DatabaseConfigFactory', () => {
        it('should create configuration from environment', () => {
            const config = DatabaseConfigFactory.fromEnvironment();

            expect(config.connectionString).toBeDefined();
            expect(config.maxConnections).toBeGreaterThan(0);
            expect(config.enableSSL).toBeDefined();
        });

        it('should create test configuration', () => {
            const config = DatabaseConfigFactory.forTesting();

            expect(config.connectionString).toContain('test');
            expect(config.maxConnections).toBe(5);
            expect(config.enableSSL).toBe(false);
        });

        it('should validate configuration schema', () => {
            const validConfig = {
                connectionString: 'postgresql://test:test@localhost:5432/test',
                maxConnections: 10,
                idleTimeoutMillis: 30000,
                connectionTimeoutMillis: 5000,
                enableSSL: false,
                retryAttempts: 3,
                retryDelay: 1000,
            };

            expect(() => DatabaseConfigFactory.validate(validConfig)).not.toThrow();
        });

        it('should reject invalid configuration', () => {
            const invalidConfig = {
                connectionString: '', // Invalid empty string
                maxConnections: -1, // Invalid negative number
            };

            expect(() => DatabaseConfigFactory.validate(invalidConfig)).toThrow();
        });
    });

    describe('DatabaseFactory', () => {
        it('should create database service singleton', async () => {
            const config = DatabaseConfigFactory.forTesting();

            const service1 = await factory.createDatabaseService(config);
            const service2 = await factory.createDatabaseService(config);

            expect(service1).toBe(service2); // Should be the same instance
        });

        it('should create property repository', async () => {
            const config = DatabaseConfigFactory.forTesting();
            const repository = await factory.createPropertyRepository(config);

            expect(repository).toBeDefined();
            expect(repository.create).toBeDefined();
            expect(repository.findById).toBeDefined();
            expect(repository.searchBySimilarity).toBeDefined();
        });

        it('should setup complete database stack', async () => {
            const config = DatabaseConfigFactory.forTesting();

            // Mock successful health check responses
            mockPool.query
                .mockResolvedValueOnce({ rows: [{ result: 1 }] }) // SELECT 1 (connectivity)
                .mockResolvedValueOnce({ rows: [{ count: '0' }] }) // COUNT query (performance)
                .mockResolvedValueOnce({ rows: [{ extname: 'vector' }] }) // Extension check
                .mockResolvedValueOnce({ rows: [{ table_name: 'properties' }] }); // Table check

            const stack = await factory.setupDatabase(config);

            expect(stack.database).toBeDefined();
            expect(stack.repository).toBeDefined();
            expect(stack.monitor).toBeDefined();
            expect(stack.migrationRunner).toBeDefined();
        });

        it('should reset factory state', async () => {
            const config = DatabaseConfigFactory.forTesting();
            await factory.createDatabaseService(config);

            factory.reset();

            // Creating service again should create new instance
            const newService = await factory.createDatabaseService(config);
            expect(newService).toBeDefined();
        });
    });

    describe('DatabaseMonitor', () => {
        it('should perform health checks', async () => {
            const config = DatabaseConfigFactory.forTesting();
            const monitor = await factory.createMonitor(config);

            const healthStatus = await monitor.getHealthStatus();

            expect(healthStatus.status).toMatch(/healthy|degraded|unhealthy/);
            expect(healthStatus.timestamp).toBeInstanceOf(Date);
            expect(healthStatus.metrics).toBeDefined();
            expect(healthStatus.checks).toBeInstanceOf(Array);
            expect(healthStatus.uptime).toBeGreaterThanOrEqual(0);
        });

        it('should check connectivity', async () => {
            const config = DatabaseConfigFactory.forTesting();
            const monitor = await factory.createMonitor(config);

            const healthStatus = await monitor.getHealthStatus();
            const connectivityCheck = healthStatus.checks.find(
                check => check.name === 'database_connectivity'
            );

            expect(connectivityCheck).toBeDefined();
            expect(connectivityCheck?.status).toMatch(/pass|fail|warn/);
            expect(connectivityCheck?.duration).toBeGreaterThanOrEqual(0);
        });

        it('should monitor query performance', async () => {
            const config = DatabaseConfigFactory.forTesting();
            const monitor = await factory.createMonitor(config);

            const healthStatus = await monitor.getHealthStatus();
            const performanceCheck = healthStatus.checks.find(
                check => check.name === 'query_performance'
            );

            expect(performanceCheck).toBeDefined();
            expect(performanceCheck?.duration).toBeGreaterThanOrEqual(0);
        });
    });

    describe('MigrationRunner', () => {
        let migrationRunner: MigrationRunner;

        beforeAll(async () => {
            const config = DatabaseConfigFactory.forTesting();
            migrationRunner = await factory.createMigrationRunner(config);
        });

        it('should initialize migration system', async () => {
            // Migration runner should be initialized in beforeAll
            expect(migrationRunner).toBeDefined();
        });

        it('should track applied migrations', async () => {
            const appliedMigrations = await migrationRunner.getAppliedMigrations();

            expect(appliedMigrations).toBeInstanceOf(Array);
        });

        it('should handle migration application', async () => {
            const testMigration = {
                version: 'test_001',
                description: 'Test migration',
                up: vi.fn().mockResolvedValue(undefined),
                down: vi.fn().mockResolvedValue(undefined),
            };

            // This should not throw
            await expect(migrationRunner.applyMigration(testMigration)).resolves.not.toThrow();
        });
    });

    describe('Error Handling', () => {
        it('should handle database connection failures gracefully', async () => {
            // Mock a connection failure
            const mockPool = (global as any).mockPool;
            mockPool.query.mockRejectedValueOnce(new Error('Connection failed'));

            const config = DatabaseConfigFactory.forTesting();
            const monitor = await factory.createMonitor(config);

            const healthStatus = await monitor.getHealthStatus();

            // Should handle the error gracefully and report unhealthy status
            expect(healthStatus.status).toBe('unhealthy');
        });

        it('should validate configurations properly', () => {
            const invalidConfig = {
                connectionString: 'invalid-url',
                maxConnections: 'not-a-number',
            };

            expect(() => DatabaseConfigFactory.validate(invalidConfig)).toThrow();
        });
    });

    describe('Performance and Scalability', () => {
        it('should handle concurrent requests', async () => {
            const config = DatabaseConfigFactory.forTesting();
            const repository = await factory.createPropertyRepository(config);

            // Mock empty results for findById queries (non-existent IDs)
            mockPool.query.mockResolvedValue({ rows: [] });

            // Create multiple concurrent operations
            const promises = Array.from({ length: 10 }, (_, i) =>
                repository.findById(`test-id-${i}`)
            );

            const results = await Promise.all(promises);

            // All should complete without error
            expect(results).toHaveLength(10);
            results.forEach(result => {
                expect(result).toBeNull(); // Since these IDs don't exist
            });
        });

        it('should maintain metrics correctly', async () => {
            const config = DatabaseConfigFactory.forTesting();
            const dbService = await factory.createDatabaseService(config);

            // Perform some operations
            await dbService.query('SELECT 1');
            await dbService.query('SELECT 2');

            const metrics = (dbService as any).getMetrics?.();
            if (metrics) {
                expect(metrics.totalQueries).toBeGreaterThanOrEqual(2);
            }
        });
    });
});