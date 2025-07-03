import { test, expect } from '@playwright/test';

test.describe('Search Results Page', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to homepage and perform a search
    await page.goto('/');
    const searchInput = page.getByPlaceholder(/Enter a location, feature, or keyword/i);
    await searchInput.fill('modern apartment');
    const searchButton = page.getByRole('button', { name: /Search/i });
    await searchButton.click();
    await page.waitForURL(/.*\/search/);
  });

  test('should display search results with property cards', async ({ page }) => {
    // Wait for results to load
    await expect(page.getByRole('heading', { name: /Search Results/i })).toBeVisible();

    // Check for property cards
    const propertyCards = page.locator('[data-testid="property-card"]');
    await expect(propertyCards.first()).toBeVisible({ timeout: 10000 });

    // Verify property card contains essential information
    const firstCard = propertyCards.first();
    await expect(firstCard).toContainText(/£/); // Price
    await expect(firstCard).toContainText(/bed/i); // Bedrooms info
  });

  test('should allow filtering search results', async ({ page }) => {
    // Wait for results to load
    await page.waitForSelector('[data-testid="property-card"]', { timeout: 10000 });

    // Look for filter controls (adjust selectors based on your UI)
    const priceFilter = page.locator('[data-testid="price-filter"]').or(
      page.getByLabel(/price/i)
    );
    
    if (await priceFilter.isVisible()) {
      await priceFilter.click();
      
      // Apply a filter and verify results change
      const initialCount = await page.locator('[data-testid="property-card"]').count();
      
      // Select a price range (adjust based on your filter UI)
      await page.getByText(/£100,000 - £200,000/i).click();
      
      // Wait for filtered results
      await page.waitForTimeout(2000);
      
      const filteredCount = await page.locator('[data-testid="property-card"]').count();
      
      // Results should change (could be more or less)
      expect(filteredCount).not.toBe(initialCount);
    }
  });

  test('should allow pagination through results', async ({ page }) => {
    // Wait for results to load
    await page.waitForSelector('[data-testid="property-card"]', { timeout: 10000 });

    // Look for pagination controls
    const nextButton = page.getByRole('button', { name: /next/i }).or(
      page.locator('[data-testid="next-page"]')
    );

    if (await nextButton.isVisible()) {
      const firstPageFirstCard = await page.locator('[data-testid="property-card"]').first().textContent();
      
      await nextButton.click();
      await page.waitForTimeout(2000);
      
      const secondPageFirstCard = await page.locator('[data-testid="property-card"]').first().textContent();
      
      // First card should be different on page 2
      expect(firstPageFirstCard).not.toBe(secondPageFirstCard);
    }
  });

  test('should handle empty search results', async ({ page }) => {
    // Go back to homepage and search for something unlikely to exist
    await page.goto('/');
    const searchInput = page.getByPlaceholder(/Enter a location, feature, or keyword/i);
    await searchInput.fill('xyzabc123nonexistentproperty');
    const searchButton = page.getByRole('button', { name: /Search/i });
    await searchButton.click();

    await page.waitForURL(/.*\/search/);

    // Check for "no results" message
    await expect(page.getByText(/no properties found/i).or(
      page.getByText(/no results/i).or(
        page.locator('[data-testid="no-results"]')
      )
    )).toBeVisible({ timeout: 10000 });
  });

  test('should allow viewing property details', async ({ page }) => {
    // Wait for results to load
    await page.waitForSelector('[data-testid="property-card"]', { timeout: 10000 });

    // Click on first property card
    const firstCard = page.locator('[data-testid="property-card"]').first();
    await firstCard.click();

    // Should navigate to property details page
    await expect(page).toHaveURL(/.*\/property\/\d+/);

    // Should show property details
    await expect(page.getByRole('heading')).toBeVisible();
    await expect(page.getByText(/£/)).toBeVisible(); // Price
  });
});