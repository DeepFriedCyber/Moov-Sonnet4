import { vi } from 'vitest';

export const createMockRedis = () => {
    const mockRedis = {
        // Basic Redis operations
        get: vi.fn(),
        set: vi.fn(),
        del: vi.fn(),
        exists: vi.fn(),

        // Counter operations
        incr: vi.fn(),
        decr: vi.fn(),
        incrby: vi.fn(),
        decrby: vi.fn(),

        // Expiration operations
        expire: vi.fn(),
        ttl: vi.fn(),
        pttl: vi.fn(),

        // Hash operations
        hget: vi.fn(),
        hset: vi.fn(),
        hgetall: vi.fn(),
        hincrby: vi.fn(),
        hdel: vi.fn(),

        // Sorted set operations
        zadd: vi.fn(),
        zrange: vi.fn(),
        zrangebyscore: vi.fn(),
        zremrangebyscore: vi.fn(),
        zcard: vi.fn(),

        // Pipeline operations
        pipeline: vi.fn(() => {
            // Return the same pipeline instance so mocks persist
            if (!mockRedis._pipelineInstance) {
                mockRedis._pipelineInstance = {
                    incr: vi.fn().mockReturnThis(),
                    expire: vi.fn().mockReturnThis(),
                    ttl: vi.fn().mockReturnThis(),
                    exec: vi.fn().mockResolvedValue([
                        [null, 1], // incr result
                        [null, 1], // expire result
                        [null, 60] // ttl result
                    ])
                };
            }
            return mockRedis._pipelineInstance;
        }),

        // Connection operations
        ping: vi.fn(),
        quit: vi.fn(),
        disconnect: vi.fn(),

        // Event emitter methods
        on: vi.fn(),
        off: vi.fn(),
        emit: vi.fn(),

        // Additional methods that might be used
        call: vi.fn(),
        multi: vi.fn(),
        eval: vi.fn(),
        evalsha: vi.fn(),

        // Pipeline instance reference
        _pipelineInstance: null as any
    };

    return mockRedis;
};

export const createMockEventEmitter = () => {
    return {
        emit: vi.fn(),
        on: vi.fn(),
        off: vi.fn(),
        once: vi.fn(),
        removeListener: vi.fn(),
        removeAllListeners: vi.fn(),
        listeners: vi.fn(),
        listenerCount: vi.fn()
    };
};