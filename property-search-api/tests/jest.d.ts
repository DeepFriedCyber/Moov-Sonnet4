/// <reference types="jest" />
/// <reference types="node" />

declare global {
    // Jest globals
    const jest: typeof import('jest');
    const describe: typeof import('@jest/globals').describe;
    const test: typeof import('@jest/globals').test;
    const expect: typeof import('@jest/globals').expect;
    const beforeAll: typeof import('@jest/globals').beforeAll;
    const afterAll: typeof import('@jest/globals').afterAll;
    const beforeEach: typeof import('@jest/globals').beforeEach;
    const afterEach: typeof import('@jest/globals').afterEach;
    const it: typeof import('@jest/globals').it;

    namespace jest {
        interface Matchers<R> {
            toBeDefined(): R;
            toBeNull(): R;
            toBe(expected: any): R;
            toEqual(expected: any): R;
            toMatch(expected: string | RegExp): R;
            toHaveBeenCalled(): R;
            toHaveBeenCalledWith(...args: any[]): R;
        }
    }

    namespace NodeJS {
        interface ProcessEnv {
            NODE_ENV: 'development' | 'production' | 'test';
            REDIS_URL: string;
            DATABASE_URL: string;
            JWT_SECRET: string;
            PORT: string;
            FRONTEND_URL: string;
            EMBEDDING_SERVICE_URL: string;
        }
    }
}

export { };