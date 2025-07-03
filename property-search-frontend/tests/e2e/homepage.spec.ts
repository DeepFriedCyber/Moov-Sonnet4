import { test, expect } from '@playwright/test';

test.describe('Homepage Functionality', () => {
  test('should load homepage with all key elements', async ({ page }) => {
    // Navigate to homepage
    await page.goto('/');

    // Check main heading
    await expect(page.getByRole('heading', { name: /Find Your Next Property/i })).toBeVisible();

    // Check search input exists
    const searchInput = page.getByPlaceholder(/Enter a location, feature, or keyword/i);
    await expect(searchInput).toBeVisible();

    // Check search button exists
    const searchButton = page.getByRole('button', { name: /Search/i });
    await expect(searchButton).toBeVisible();

    // Check navigation elements
    await expect(page.getByRole('navigation')).toBeVisible();

    // Check footer exists
    await expect(page.locator('footer')).toBeVisible();
  });

  test('should have working navigation links', async ({ page }) => {
    await page.goto('/');

    // Test navigation to different sections
    // This will depend on your actual navigation structure
    const navLinks = page.locator('nav a');
    const linkCount = await navLinks.count();
    
    // Ensure we have navigation links
    expect(linkCount).toBeGreaterThan(0);
  });

  test('should be responsive on mobile devices', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    // Check that main elements are still visible on mobile
    await expect(page.getByRole('heading', { name: /Find Your Next Property/i })).toBeVisible();
    await expect(page.getByPlaceholder(/Enter a location, feature, or keyword/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Search/i })).toBeVisible();
  });
});