// Jest setup file
import { config } from 'dotenv';

// Load test environment variables
config({ path: '.env.test' });

// Set test environment
process.env.NODE_ENV = 'test';

// Set default Redis URL for tests
if (!process.env.REDIS_URL) {
    process.env.REDIS_URL = 'redis://localhost:6379';
}

// Increase timeout for async operations
jest.setTimeout(30000);

// Mock console in tests to reduce noise (optional)
const originalConsole: Console = global.console;
global.console = {
    ...originalConsole,
    // Uncomment the lines below to suppress console output in tests
    // log: jest.fn(),
    // info: jest.fn(),
    // warn: jest.fn(),
    // error: jest.fn(),
};