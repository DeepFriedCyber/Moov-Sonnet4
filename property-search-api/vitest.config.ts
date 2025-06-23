/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        setupFiles: ['./tests/vitest.setup.ts'],
        include: ['**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts}'],
        exclude: ['node_modules', 'dist', '**/*.d.ts'],
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