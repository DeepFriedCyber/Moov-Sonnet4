import { test, expect } from '@playwright/test';

test.describe('Property Search', () => {
  test('should perform basic property search', async ({ page }) => {
    await page.goto('/');
    
    // Enter search query
    const searchInput = page.getByPlaceholder(/Search for properties/i);
    await searchInput.fill('2 bedroom apartment in London');
    
    // Click search button
    await page.getByRole('button', { name: /Search/i }).click();
    
    // Wait for results to load
    await page.waitForSelector('[data-testid="search-results"]', { timeout: 10000 });
    
    // Check results are displayed
    await expect(page.getByTestId('search-results')).toBeVisible();
  });

  test('should handle empty search gracefully', async ({ page }) => {
    await page.goto('/');
    
    // Click search without entering text
    await page.getByRole('button', { name: /Search/i }).click();
    
    // Should show validation message or stay on homepage
    await expect(page.getByText(/Please enter a search query/i).or(page.getByRole('heading', { name: /Find Your Perfect Home/i }))).toBeVisible();
  });

  test('should display search filters', async ({ page }) => {
    await page.goto('/search');
    
    // Check filter options are present
    await expect(page.getByText(/Price Range/i)).toBeVisible();
    await expect(page.getByText(/Property Type/i)).toBeVisible();
    await expect(page.getByText(/Bedrooms/i)).toBeVisible();
  });

  test('should show property details on click', async ({ page }) => {
    await page.goto('/');
    
    // Perform search
    await page.getByPlaceholder(/Search for properties/i).fill('apartment London');
    await page.getByRole('button', { name: /Search/i }).click();
    
    // Wait for results
    await page.waitForSelector('[data-testid="property-card"]', { timeout: 10000 });
    
    // Click on first property
    await page.getByTestId('property-card').first().click();
    
    // Should navigate to property details
    await expect(page.url()).toContain('/property/');
    await expect(page.getByTestId('property-details')).toBeVisible();
  });

  test('should handle search API errors gracefully', async ({ page }) => {
    // Mock API to return error
    await page.route('**/api/search**', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal server error' })
      });
    });

    await page.goto('/');
    await page.getByPlaceholder(/Search for properties/i).fill('test search');
    await page.getByRole('button', { name: /Search/i }).click();
    
    // Should show error message
    await expect(page.getByText(/Something went wrong/i).or(page.getByText(/Error/i))).toBeVisible();
  });
});