// Vitest setup file
import { vi } from 'vitest';

// Mock environment variables for testing
vi.mock('dotenv', () => ({
    config: vi.fn(),
}));

// Set up global test environment
process.env.NODE_ENV = 'test';

// Mock console to reduce noise in tests (optional)
global.console = {
    ...console,
    // Uncomment the lines below to suppress console output in tests
    // log: vi.fn(),
    // info: vi.fn(),
    // warn: vi.fn(),
    // error: vi.fn(),
};

// Setup for async tests
vi.setConfig({
    testTimeout: 30000,
});