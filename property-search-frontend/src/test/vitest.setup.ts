// Vitest setup file for frontend
import { vi, afterEach } from 'vitest';

// Mock Next.js router
vi.mock('next/router', () => ({
    useRouter: () => ({
        route: '/',
        pathname: '/',
        query: {},
        asPath: '/',
        push: vi.fn(),
        replace: vi.fn(),
        reload: vi.fn(),
        back: vi.fn(),
    }),
}));

// Mock Next.js navigation
vi.mock('next/navigation', () => ({
    useRouter: () => ({
        push: vi.fn(),
        replace: vi.fn(),
        back: vi.fn(),
        forward: vi.fn(),
        refresh: vi.fn(),
    }),
    usePathname: () => '/',
    useSearchParams: () => new URLSearchParams(),
}));

// Environment variables are handled in the env.ts file itself for tests

// Global test setup
global.fetch = vi.fn();

// Clean up after each test
afterEach(() => {
    vi.clearAllMocks();
});