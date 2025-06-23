import { cache, connectRedis } from '../src/lib/cache';

// Mock logger to avoid logging during tests
jest.mock('../src/lib/logger', () => ({
    logger: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
    }
}));

// Mock ioredis for testing
jest.mock('ioredis', () => {
    const mockRedis = {
        status: 'ready',
        on: jest.fn(),
        get: jest.fn(),
        set: jest.fn(),
        del: jest.fn(),
        keys: jest.fn(),
        exists: jest.fn(),
        incr: jest.fn(),
        expire: jest.fn(),
        quit: jest.fn(),
    };

    return jest.fn(() => mockRedis);
});

describe('Cache Service', () => {
    let mockRedis: any;

    beforeAll(async () => {
        mockRedis = connectRedis();
    });

    afterAll(async () => {
        // Clean up Redis connection
        await mockRedis.quit();
    });

    test('should connect to Redis successfully', async () => {
        const redis = connectRedis();
        expect(redis).toBeDefined();
        expect(redis.status).toBe('ready');
    });

    test('should set and get data from cache', async () => {
        const testKey = 'test:cache:key';
        const testValue = { message: 'Hello Redis!', timestamp: Date.now() };

        // Mock Redis get to return our test value
        mockRedis.get.mockResolvedValue(JSON.stringify(testValue));

        // Set data
        await cache.set(testKey, testValue, 60); // 60 seconds TTL

        // Get data
        const retrievedValue = await cache.get(testKey);

        expect(retrievedValue).toEqual(testValue);
        expect(mockRedis.set).toHaveBeenCalledWith(testKey, JSON.stringify(testValue), 'EX', 60);
    });

    test('should return null for non-existent key', async () => {
        const nonExistentKey = 'test:non:existent';

        // Mock Redis get to return null
        mockRedis.get.mockResolvedValue(null);

        const result = await cache.get(nonExistentKey);

        expect(result).toBeNull();
    });

    test('should check if key exists', async () => {
        const testKey = 'test:exists:key';
        const testValue = 'test value';

        // Initially should not exist
        mockRedis.exists.mockResolvedValue(0);
        let exists = await cache.exists(testKey);
        expect(exists).toBe(false);

        // Set the key
        await cache.set(testKey, testValue);

        // Now should exist
        mockRedis.exists.mockResolvedValue(1);
        exists = await cache.exists(testKey);
        expect(exists).toBe(true);

        // Clean up
        await cache.del(testKey);
    });

    test('should delete keys from cache', async () => {
        const testKey = 'test:delete:key';
        const testValue = 'test value';

        // Set data
        await cache.set(testKey, testValue);

        // Verify it exists
        mockRedis.exists.mockResolvedValue(1);
        let exists = await cache.exists(testKey);
        expect(exists).toBe(true);

        // Delete the key
        await cache.del(testKey);

        // Verify it's gone
        mockRedis.exists.mockResolvedValue(0);
        exists = await cache.exists(testKey);
        expect(exists).toBe(false);

        expect(mockRedis.del).toHaveBeenCalledWith(testKey);
    });

    test('should increment counter', async () => {
        const counterKey = 'test:counter';

        // First increment should return 1
        mockRedis.incr.mockResolvedValue(1);
        let count = await cache.incr(counterKey, 60);
        expect(count).toBe(1);

        // Second increment should return 2
        mockRedis.incr.mockResolvedValue(2);
        count = await cache.incr(counterKey);
        expect(count).toBe(2);

        // Clean up
        await cache.del(counterKey);

        expect(mockRedis.incr).toHaveBeenCalledWith(counterKey);
        expect(mockRedis.expire).toHaveBeenCalledWith(counterKey, 60);
    });

    test('should generate cache keys correctly', () => {
        const prefix = 'user';
        const params = { id: 123, name: 'John' };

        const key1 = cache.generateKey(prefix, params);
        const key2 = cache.generateKey(prefix, params);

        // Same params should generate same key
        expect(key1).toBe(key2);
        expect(key1).toMatch(/^user:/);

        // Different params should generate different keys
        const key3 = cache.generateKey(prefix, { id: 456, name: 'Jane' });
        expect(key3).not.toBe(key1);
    });

    test('should invalidate keys by pattern', async () => {
        const pattern = 'test:pattern:*';
        const keys = [
            'test:pattern:key1',
            'test:pattern:key2',
            'test:pattern:key3'
        ];

        // Set multiple keys
        for (const key of keys) {
            await cache.set(key, `value for ${key}`);
        }

        // Mock keys method to return matching keys
        mockRedis.keys.mockResolvedValue(keys);

        // Verify they exist
        mockRedis.exists.mockResolvedValue(1);
        for (const key of keys) {
            const exists = await cache.exists(key);
            expect(exists).toBe(true);
        }

        // Invalidate pattern
        await cache.invalidate(pattern);

        // Verify they're gone
        mockRedis.exists.mockResolvedValue(0);
        for (const key of keys) {
            const exists = await cache.exists(key);
            expect(exists).toBe(false);
        }

        expect(mockRedis.keys).toHaveBeenCalledWith(pattern);
        expect(mockRedis.del).toHaveBeenCalledWith(...keys);
    });
});