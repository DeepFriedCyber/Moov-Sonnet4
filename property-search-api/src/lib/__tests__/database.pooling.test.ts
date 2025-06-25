// TDD RED PHASE - Database Connection Pooling and Health Check Tests
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi, afterEach } from 'vitest';
import { DatabaseService } from '../database';
import { Pool, PoolClient } from 'pg';

// Mock pg module for testing
vi.mock('pg', () => {
    const mockClient = {
        query: vi.fn(),
        release: vi.fn(),
    };

    const mockPool = {
        query: vi.fn(),
        connect: vi.fn(() => Promise.resolve(mockClient)),
        end: vi.fn(),
        on: vi.fn(),
        totalCount: 0,
        idleCount: 0,
        waitingCount: 0,
    };

    return {
        Pool: vi.fn(() => mockPool),
    };
});

describe('Database Connection Pooling and Health Checks', () => {
    let database: DatabaseService;
    let mockPool: any;
    let mockClient: any;

    beforeAll(async () => {
        // Create database service with pooling configuration
        database = new DatabaseService({
            connectionString: 'postgresql://test:test@localhost:5432/testdb',
            maxConnections: 10,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 5000,
            enableSSL: false,
        });

        // Get reference to the mocked pool and client
        const { Pool } = await import('pg');
        mockPool = new (Pool as any)();
        mockClient = {
            query: vi.fn(),
            release: vi.fn(),
        };

        // Setup basic mock responses for initialization
        mockPool.query.mockImplementation((query: string) => {
            if (query.includes('CREATE EXTENSION')) {
                return Promise.resolve({ rows: [] });
            }
            if (query.includes('CREATE TABLE') || query.includes('CREATE INDEX')) {
                return Promise.resolve({ rows: [] });
            }
            return Promise.resolve({ rows: [] });
        });

        await database.initialize();
    });

    afterAll(async () => {
        await database.close();
    });

    beforeEach(() => {
        vi.clearAllMocks();
        mockPool.connect.mockResolvedValue(mockClient);
    });

    describe('Connection Pool Management', () => {
        it('should create pool with correct configuration', () => {
            // Arrange - Create a new database instance to test pool creation
            const testDatabase = new DatabaseService({
                connectionString: 'postgresql://test:test@localhost:5432/testdb',
                maxConnections: 10,
                idleTimeoutMillis: 30000,
                connectionTimeoutMillis: 5000,
                enableSSL: false,
            });

            // Assert - Check that Pool constructor was called with correct config
            expect(Pool).toHaveBeenCalledWith(expect.objectContaining({
                connectionString: 'postgresql://test:test@localhost:5432/testdb',
                max: 10,
                idleTimeoutMillis: 30000,
                connectionTimeoutMillis: 5000,
                ssl: false,
            }));
        });

        it('should handle multiple concurrent connections', async () => {
            // Arrange
            const connectionPromises = [];
            mockPool.connect.mockImplementation(() => {
                return Promise.resolve({
                    query: vi.fn().mockResolvedValue({ rows: [{ result: 'success' }] }),
                    release: vi.fn(),
                });
            });

            // Act - Request multiple connections simultaneously
            for (let i = 0; i < 5; i++) {
                connectionPromises.push(database.getClient());
            }

            const clients = await Promise.all(connectionPromises);

            // Assert
            expect(clients).toHaveLength(5);
            expect(mockPool.connect).toHaveBeenCalledTimes(5);

            // Clean up
            clients.forEach(client => client.release());
        });

        it('should track connection metrics', async () => {
            // Arrange
            const eventHandlers: { [key: string]: Function } = {};
            mockPool.on.mockImplementation((event: string, handler: Function) => {
                eventHandlers[event] = handler;
            });

            // Create a fresh database instance to capture events
            const testDatabase = new DatabaseService({
                connectionString: 'postgresql://test:test@localhost:5432/testdb',
                maxConnections: 10,
            });

            mockPool.connect.mockResolvedValue({
                query: vi.fn(),
                release: vi.fn(),
            });

            // Simulate connection events
            eventHandlers['connect']?.();
            eventHandlers['connect']?.();

            // Act
            const client1 = await testDatabase.getClient();
            const client2 = await testDatabase.getClient();

            const metrics = testDatabase.getMetrics();

            // Assert
            expect(metrics.activeConnections).toBe(2);
            expect(metrics.totalConnections).toBeGreaterThan(0);

            // Clean up
            client1.release();
            client2.release();
        });

        it('should handle connection pool exhaustion gracefully', async () => {
            // Arrange
            const maxConnections = 2;
            const poolExhaustedDatabase = new DatabaseService({
                connectionString: 'postgresql://test:test@localhost:5432/testdb',
                maxConnections,
                connectionTimeoutMillis: 1000, // Short timeout for testing
            });

            // Mock pool to simulate exhaustion
            const exhaustedPool = {
                connect: vi.fn().mockRejectedValue(new Error('Connection pool exhausted')),
                query: vi.fn(),
                end: vi.fn(),
                on: vi.fn(),
            };

            // Replace the pool
            (poolExhaustedDatabase as any).pool = exhaustedPool;

            // Act & Assert
            await expect(poolExhaustedDatabase.getClient()).rejects.toThrow('Failed to get database client');
        });

        it('should properly release connections back to pool', async () => {
            // Arrange
            const mockRelease = vi.fn();
            mockPool.connect.mockResolvedValue({
                query: vi.fn(),
                release: mockRelease,
            });

            // Act
            const client = await database.getClient();
            client.release();

            // Assert
            expect(mockRelease).toHaveBeenCalled();

            const metrics = database.getMetrics();
            expect(metrics.idleConnections).toBeGreaterThan(0);
        });
    });

    describe('Health Check System', () => {
        it('should return true for healthy database connection', async () => {
            // Arrange
            mockPool.query.mockResolvedValue({ rows: [{ result: 1 }] });

            // Act
            const isHealthy = await database.healthCheck();

            // Assert
            expect(isHealthy).toBe(true);
            expect(mockPool.query).toHaveBeenCalledWith('SELECT 1', undefined);
        });

        it('should return false for unhealthy database connection', async () => {
            // Arrange
            mockPool.query.mockRejectedValue(new Error('Connection failed'));

            // Act
            const isHealthy = await database.healthCheck();

            // Assert
            expect(isHealthy).toBe(false);
        });

        it('should provide detailed health status', async () => {
            // Arrange
            mockPool.query.mockResolvedValue({ rows: [{ result: 1 }] });

            // Act
            const healthStatus = await database.getDetailedHealthStatus();

            // Assert
            expect(healthStatus).toEqual({
                isHealthy: true,
                connectionPool: {
                    totalConnections: expect.any(Number),
                    activeConnections: expect.any(Number),
                    idleConnections: expect.any(Number),
                    waitingConnections: 0,
                },
                performance: {
                    averageQueryTime: expect.any(Number),
                    slowQueries: expect.any(Number),
                    totalQueries: expect.any(Number),
                    errorRate: expect.any(Number),
                },
                lastHealthCheck: expect.any(Date),
            });
        });

        it('should handle health check timeout', async () => {
            // Arrange
            mockPool.query.mockImplementation(() =>
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Timeout')), 100)
                )
            );

            // Act
            const isHealthy = await database.healthCheckWithTimeout(50);

            // Assert
            expect(isHealthy).toBe(false);
        });
    });

    describe('Connection Recovery', () => {
        it('should attempt to reconnect on connection failure', async () => {
            // Arrange
            let attemptCount = 0;
            mockPool.connect.mockImplementation(() => {
                attemptCount++;
                if (attemptCount <= 2) {
                    return Promise.reject(new Error('Connection failed'));
                }
                return Promise.resolve({
                    query: vi.fn(),
                    release: vi.fn(),
                });
            });

            // Act
            const client = await database.getClientWithRetry(3, 100);

            // Assert
            expect(client).toBeDefined();
            expect(attemptCount).toBe(3);
        });

        it('should fail after max retry attempts', async () => {
            // Arrange
            mockPool.connect.mockRejectedValue(new Error('Persistent connection failure'));

            // Act & Assert
            await expect(database.getClientWithRetry(2, 50)).rejects.toThrow('Failed to get database client after 2 attempts');
        });
    });

    describe('Performance Monitoring', () => {
        it('should track query execution times', async () => {
            // Arrange
            mockPool.query.mockImplementation(() =>
                new Promise(resolve =>
                    setTimeout(() => resolve({ rows: [] }), 100)
                )
            );

            // Act
            await database.query('SELECT * FROM test_table');
            const metrics = database.getMetrics();

            // Assert
            expect(metrics.averageQueryTime).toBeGreaterThan(0);
            expect(metrics.totalQueries).toBeGreaterThan(0);
        });

        it('should identify slow queries', async () => {
            // Arrange
            mockPool.query.mockImplementation(() =>
                new Promise(resolve =>
                    setTimeout(() => resolve({ rows: [] }), 1500) // Slow query > 1000ms
                )
            );

            // Act
            await database.query('SELECT * FROM large_table');
            const metrics = database.getMetrics();

            // Assert
            expect(metrics.slowQueries).toBeGreaterThan(0);
        });

        it('should track error rates', async () => {
            // Arrange - Create fresh database instance to avoid interference
            const testDatabase = new DatabaseService('postgresql://test:test@localhost:5432/testdb');

            mockPool.query
                .mockResolvedValueOnce({ rows: [] }) // Success
                .mockRejectedValueOnce(new Error('Query failed')) // Error
                .mockResolvedValueOnce({ rows: [] }); // Success

            // Act
            await testDatabase.query('SELECT 1');
            try {
                await testDatabase.query('INVALID QUERY');
            } catch (e) {
                // Expected error
            }
            await testDatabase.query('SELECT 2');

            const metrics = testDatabase.getMetrics();

            // Assert
            expect(metrics.errors).toBe(1);
            expect(metrics.totalQueries).toBe(3);
        });
    });

    describe('Connection Lifecycle Management', () => {
        it('should handle graceful shutdown', async () => {
            // Arrange
            const testDatabase = new DatabaseService('postgresql://test:test@localhost:5432/testdb');
            const testPool = {
                end: vi.fn().mockResolvedValue(undefined),
                query: vi.fn(),
                connect: vi.fn(),
                on: vi.fn(),
            };
            (testDatabase as any).pool = testPool;

            // Act
            await testDatabase.close();

            // Assert
            expect(testPool.end).toHaveBeenCalled();
        });

        it('should handle connection events properly', () => {
            // Arrange
            const eventHandlers: { [key: string]: Function } = {};
            mockPool.on.mockImplementation((event: string, handler: Function) => {
                eventHandlers[event] = handler;
            });

            // Act
            new DatabaseService('postgresql://test:test@localhost:5432/testdb');

            // Assert
            expect(mockPool.on).toHaveBeenCalledWith('connect', expect.any(Function));
            expect(mockPool.on).toHaveBeenCalledWith('error', expect.any(Function));

            // Test event handlers
            eventHandlers['connect']();
            eventHandlers['error'](new Error('Test error'));

            // Should not throw
        });
    });

    describe('Transaction Management with Pooling', () => {
        it('should handle transactions with proper connection management', async () => {
            // Arrange
            const mockQuery = vi.fn()
                .mockResolvedValueOnce({ rows: [] }) // BEGIN
                .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // INSERT
                .mockResolvedValueOnce({ rows: [] }); // COMMIT
            const mockRelease = vi.fn();

            const mockTransactionClient = {
                query: mockQuery,
                release: mockRelease,
            };
            mockPool.connect.mockResolvedValueOnce(mockTransactionClient);

            // Act
            const result = await database.withTransaction(async (tx) => {
                await tx.query('INSERT INTO test (name) VALUES ($1)', ['test']);
                return { success: true };
            });

            // Assert
            expect(result.success).toBe(true);
            expect(mockQuery).toHaveBeenCalledWith('BEGIN');
            expect(mockQuery).toHaveBeenCalledWith('COMMIT');
            expect(mockRelease).toHaveBeenCalled();
        });

        it('should rollback transaction on error and release connection', async () => {
            // Arrange
            const mockQuery = vi.fn()
                .mockResolvedValueOnce({ rows: [] }) // BEGIN
                .mockRejectedValueOnce(new Error('Insert failed')) // INSERT fails
                .mockResolvedValueOnce({ rows: [] }); // ROLLBACK
            const mockRelease = vi.fn();

            const mockTransactionClient = {
                query: mockQuery,
                release: mockRelease,
            };
            mockPool.connect.mockResolvedValueOnce(mockTransactionClient);

            // Act & Assert
            await expect(database.withTransaction(async (tx) => {
                await tx.query('INSERT INTO test (name) VALUES ($1)', ['test']);
            })).rejects.toThrow('Transaction failed');

            expect(mockQuery).toHaveBeenCalledWith('BEGIN');
            expect(mockQuery).toHaveBeenCalledWith('ROLLBACK');
            expect(mockRelease).toHaveBeenCalled();
        });
    });
});