import { test, expect } from '@playwright/test';
import { TestHelpers, TestData, Environment } from './utils/test-helpers';

test.describe('Comprehensive User Flow', () => {
    let helpers: TestHelpers;

    test.beforeEach(async ({ page }) => {
        helpers = new TestHelpers(page);
    });

    test('complete property search journey', async ({ page }) => {
        // 1. Start from homepage
        await page.goto('/');

        // 2. Verify homepage loads correctly
        await expect(page.getByRole('heading', { name: /Find Your Next Property/i })).toBeVisible();

        // 3. Perform search
        const searchQuery = TestData.getRandomSearchQuery();
        await helpers.performSearch(searchQuery);

        // 4. Wait for results to load
        await helpers.waitForLoadingToComplete();
        await helpers.waitForPropertyCards();

        // 5. Verify search results page
        await expect(page.getByRole('heading', { name: /Search Results/i })).toBeVisible();

        // 6. Check that we have property cards
        const cardCount = await helpers.getPropertyCardCount();
        expect(cardCount).toBeGreaterThan(0);

        // 7. Click on first property to view details
        const firstCard = page.locator('[data-testid="property-card"]').first();
        await firstCard.click();

        // 8. Verify property details page loads
        await expect(page).toHaveURL(/.*\/property\/\d+/);
        await expect(page.getByRole('heading')).toBeVisible();

        // 9. Go back to search results
        await page.goBack();
        await expect(page).toHaveURL(/.*\/search/);

        // 10. Verify we're back on search results
        await helpers.waitForPropertyCards();
        const backCardCount = await helpers.getPropertyCardCount();
        expect(backCardCount).toBe(cardCount);
    });

    test('search with different query types', async ({ page }) => {
        const queries = [
            'London apartment',
            '2 bedroom house',
            'property with garden',
            'flat near station'
        ];

        for (const query of queries) {
            await helpers.performSearch(query);
            await helpers.waitForLoadingToComplete();

            // Should either have results or show "no results" message
            const hasResults = await page.locator('[data-testid="property-card"]').count() > 0;
            const hasNoResultsMessage = await page.getByText(/no properties found/i).isVisible();

            expect(hasResults || hasNoResultsMessage).toBe(true);

            // Take screenshot for visual verification
            if (!Environment.isCI()) {
                await helpers.takeScreenshot(`search-${query.replace(/\s+/g, '-')}`);
            }
        }
    });

    test('error handling and recovery', async ({ page }) => {
        // Mock API to return error
        await helpers.mockApiResponse('/api/search', { error: 'Server Error' }, 500);

        await helpers.performSearch('test query');

        // Should show error message
        const hasError = await helpers.hasErrorMessage();
        expect(hasError).toBe(true);

        // Remove mock and try again
        await page.unroute('**/api/search**');

        // Perform new search
        await helpers.performSearch('recovery test');
        await helpers.waitForLoadingToComplete();

        // Should work normally now
        const hasErrorAfterRecovery = await helpers.hasErrorMessage();
        expect(hasErrorAfterRecovery).toBe(false);
    });

    test('performance and loading states', async ({ page }) => {
        // Mock slow API response
        await helpers.mockSlowApiResponse('/api/search', 3000);

        await page.goto('/');
        const searchInput = page.getByPlaceholder(/Enter a location, feature, or keyword/i);
        await searchInput.fill('performance test');
        const searchButton = page.getByRole('button', { name: /Search/i });

        // Start search
        await searchButton.click();

        // Should show loading state
        await page.waitForTimeout(500); // Give time for loading state to appear
        const isLoading = await helpers.isLoading();
        expect(isLoading).toBe(true);

        // Wait for loading to complete
        await helpers.waitForLoadingToComplete();

        // Should show results or no results message
        await page.waitForURL(/.*\/search/);
        const finalIsLoading = await helpers.isLoading();
        expect(finalIsLoading).toBe(false);
    });

    test('accessibility compliance', async ({ page }) => {
        await page.goto('/');

        // Check basic accessibility
        await helpers.checkBasicAccessibility();

        // Test keyboard navigation
        await page.keyboard.press('Tab');
        const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
        expect(focusedElement).toBeTruthy();

        // Test search with keyboard
        const searchInput = page.getByPlaceholder(/Enter a location, feature, or keyword/i);
        await searchInput.focus();
        await searchInput.fill('accessibility test');
        await page.keyboard.press('Enter');

        // Should navigate to search results
        await page.waitForURL(/.*\/search/);
        await expect(page.getByRole('heading', { name: /Search Results/i })).toBeVisible();
    });

    test('mobile responsiveness', async ({ page }) => {
        // Test different mobile viewport sizes
        const viewports = [
            { width: 375, height: 667, name: 'iPhone SE' },
            { width: 414, height: 896, name: 'iPhone 11' },
            { width: 360, height: 640, name: 'Android' }
        ];

        for (const viewport of viewports) {
            await page.setViewportSize({ width: viewport.width, height: viewport.height });
            await page.goto('/');

            // Check that main elements are visible
            await expect(page.getByRole('heading', { name: /Find Your Next Property/i })).toBeVisible();
            await expect(page.getByPlaceholder(/Enter a location, feature, or keyword/i)).toBeVisible();
            await expect(page.getByRole('button', { name: /Search/i })).toBeVisible();

            // Perform search
            await helpers.performSearch('mobile test');
            await helpers.waitForLoadingToComplete();

            // Check search results are visible on mobile
            await expect(page.getByRole('heading', { name: /Search Results/i })).toBeVisible();

            if (!Environment.isCI()) {
                await helpers.takeScreenshot(`mobile-${viewport.name.toLowerCase().replace(/\s+/g, '-')}`);
            }
        }
    });
});