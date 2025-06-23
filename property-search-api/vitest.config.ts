/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        setupFiles: ['./tests/vitest.setup.ts'],
        include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts}'],
        exclude: ['node_modules', 'dist', 'tests', '**/*.d.ts'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            exclude: [
                'node_modules/',
                'dist/',
                'tests/',
                '**/*.d.ts',
                '**/*.config.{js,ts}',
                '**/types/',
            ],
            include: ['src/**/*.ts'],
            all: true,
            lines: 100,
            functions: 100,
            branches: 100,
            statements: 100,
        },
        // Increase timeout for async operations
        testTimeout: 30000,
        // Allow environment variables to be modified in tests
        env: {
            NODE_ENV: 'test',
        },
    },
    resolve: {
        alias: {
            '@': '/src',
        },
    },
});