import { test, expect } from '@playwright/test';

test.describe('Performance Tests', () => {
    test('should load homepage within acceptable time', async ({ page }) => {
        const startTime = Date.now();

        await page.goto('/');
        await page.waitForLoadState('networkidle');

        const loadTime = Date.now() - startTime;

        // Should load within 3 seconds
        expect(loadTime).toBeLessThan(3000);

        // Check Core Web Vitals
        const lcp = await page.evaluate(() => {
            return new Promise((resolve) => {
                new PerformanceObserver((list) => {
                    const entries = list.getEntries();
                    const lastEntry = entries[entries.length - 1];
                    resolve(lastEntry.startTime);
                }).observe({ entryTypes: ['largest-contentful-paint'] });
            });
        });

        // LCP should be under 2.5 seconds
        expect(lcp).toBeLessThan(2500);
    });

    test('should have good Lighthouse scores', async ({ page }) => {
        await page.goto('/');

        // Check basic performance indicators
        const performanceMetrics = await page.evaluate(() => {
            const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
            return {
                domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
                loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
                firstPaint: performance.getEntriesByName('first-paint')[0]?.startTime || 0,
                firstContentfulPaint: performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0,
            };
        });

        // DOM Content Loaded should be fast
        expect(performanceMetrics.domContentLoaded).toBeLessThan(1000);

        // First Contentful Paint should be under 1.8 seconds
        expect(performanceMetrics.firstContentfulPaint).toBeLessThan(1800);
    });

    test('should handle concurrent users', async ({ browser }) => {
        const contexts = await Promise.all([
            browser.newContext(),
            browser.newContext(),
            browser.newContext(),
            browser.newContext(),
            browser.newContext(),
        ]);

        const pages = await Promise.all(contexts.map(context => context.newPage()));

        // Simulate 5 concurrent users
        const startTime = Date.now();

        await Promise.all(pages.map(async (page, index) => {
            await page.goto('/');
            await page.getByPlaceholder(/Search for properties/i).fill(`search query ${index}`);
            await page.getByRole('button', { name: /Search/i }).click();
            await page.waitForLoadState('networkidle');
        }));

        const totalTime = Date.now() - startTime;

        // All requests should complete within reasonable time
        expect(totalTime).toBeLessThan(10000);

        // Cleanup
        await Promise.all(contexts.map(context => context.close()));
    });

    test('should not have memory leaks', async ({ page }) => {
        await page.goto('/');

        // Get initial memory usage
        const initialMemory = await page.evaluate(() => {
            return (performance as any).memory?.usedJSHeapSize || 0;
        });

        // Perform multiple searches to stress test
        for (let i = 0; i < 10; i++) {
            await page.getByPlaceholder(/Search for properties/i).fill(`test search ${i}`);
            await page.getByRole('button', { name: /Search/i }).click();
            await page.waitForTimeout(1000);

            // Navigate back to homepage
            await page.goto('/');
            await page.waitForLoadState('networkidle');
        }

        // Check memory usage hasn't grown excessively
        const finalMemory = await page.evaluate(() => {
            return (performance as any).memory?.usedJSHeapSize || 0;
        });

        if (initialMemory > 0 && finalMemory > 0) {
            const memoryIncrease = finalMemory - initialMemory;
            const memoryIncreasePercent = (memoryIncrease / initialMemory) * 100;

            // Memory shouldn't increase by more than 50%
            expect(memoryIncreasePercent).toBeLessThan(50);
        }
    });
});