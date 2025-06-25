// Vitest setup file for frontend
import { vi, afterEach, expect } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';

expect.extend(matchers);

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

// Mock IntersectionObserver for framer-motion
global.IntersectionObserver = vi.fn().mockImplementation((callback) => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
    callback
}));

// Mock ResizeObserver for framer-motion
global.ResizeObserver = vi.fn().mockImplementation((callback) => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
    callback
}));

// Mock window.matchMedia for responsive design
Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
    })),
});

// Mock scrollTo for smooth scrolling
global.scrollTo = vi.fn();

// Clean up after each test
afterEach(() => {
    cleanup();
    vi.clearAllMocks();
});