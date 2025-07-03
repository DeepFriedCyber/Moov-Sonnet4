import { test, expect } from '@playwright/test';

test.describe('Homepage Search Functionality', () => {
    test('should allow a user to search for a property and see results', async ({ page }) => {
        // 1. Go to the homepage
        await page.goto('/');

        // 2. Verify the homepage has loaded by checking for a key element
        await expect(page.getByRole('heading', { name: /Find Your Next Property/i })).toBeVisible();

        // 3. Find the search input and type a query
        const searchInput = page.getByPlaceholder(/Enter a location, feature, or keyword/i);
        await expect(searchInput).toBeVisible();
        await searchInput.fill('modern apartment with a balcony');

        // 4. Click the search button
        const searchButton = page.getByRole('button', { name: /Search/i });
        await searchButton.click();

        // 5. Verify the user is on the search results page
        await expect(page).toHaveURL(/.*\/search/);
        await expect(page.getByRole('heading', { name: /Search Results/i })).toBeVisible();

        // 6. Verify that at least one property card is displayed
        // This confirms the API call worked and the frontend rendered the result.
        const propertyCards = page.locator('[data-testid="property-card"]');
        await expect(propertyCards.first()).toBeVisible({ timeout: 10000 }); // Wait up to 10s for results
    });
});