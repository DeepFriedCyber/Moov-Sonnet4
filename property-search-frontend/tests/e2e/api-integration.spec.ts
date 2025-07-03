import { test, expect } from '@playwright/test';

test.describe('API Integration Tests', () => {
    test('should successfully connect to backend API', async ({ page }) => {
        // Navigate to homepage
        await page.goto('/');

        // Listen for API calls
        const apiCalls: string[] = [];
        page.on('request', request => {
            if (request.url().includes('localhost:3001') || request.url().includes('/api/')) {
                apiCalls.push(request.url());
            }
        });

        // Perform a search to trigger API call
        const searchInput = page.getByPlaceholder(/Enter a location, feature, or keyword/i);
        await searchInput.fill('London apartment');

        const searchButton = page.getByRole('button', { name: /Search/i });
        await searchButton.click();

        // Wait for navigation to search results
        await page.waitForURL(/.*\/search/);

        // Verify API calls were made
        await page.waitForTimeout(2000); // Give time for API calls
        expect(apiCalls.length).toBeGreaterThan(0);
    });

    test('should handle API errors gracefully', async ({ page }) => {
        // Mock API to return error
        await page.route('**/api/search**', route => {
            route.fulfill({
                status: 500,
                contentType: 'application/json',
                body: JSON.stringify({ error: 'Internal Server Error' })
            });
        });

        await page.goto('/');

        // Perform search
        const searchInput = page.getByPlaceholder(/Enter a location, feature, or keyword/i);
        await searchInput.fill('test query');

        const searchButton = page.getByRole('button', { name: /Search/i });
        await searchButton.click();

        // Check for error message or fallback UI
        // This will depend on how your app handles errors
        await expect(page.locator('[data-testid="error-message"]').or(
            page.getByText(/something went wrong/i)
        )).toBeVisible({ timeout: 5000 });
    });

    test('should display loading state during search', async ({ page }) => {
        // Slow down API response to see loading state
        await page.route('**/api/search**', async route => {
            await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
            route.continue();
        });

        await page.goto('/');

        const searchInput = page.getByPlaceholder(/Enter a location, feature, or keyword/i);
        await searchInput.fill('test query');

        const searchButton = page.getByRole('button', { name: /Search/i });
        await searchButton.click();

        // Check for loading indicator
        await expect(page.locator('[data-testid="loading"]').or(
            page.getByText(/loading/i).or(
                page.locator('.spinner')
            )
        )).toBeVisible({ timeout: 1000 });
    });
});