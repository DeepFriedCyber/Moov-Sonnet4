import { test, expect } from '@playwright/test';

test.describe('Homepage', () => {
    test('should load homepage successfully', async ({ page }) => {
        await page.goto('/');

        // Check page title
        await expect(page).toHaveTitle(/Moov/);

        // Check main heading
        await expect(page.getByRole('heading', { name: /Find Your Perfect Home/i })).toBeVisible();
    });

    test('should display search functionality', async ({ page }) => {
        await page.goto('/');

        // Check search input is present
        await expect(page.getByPlaceholder(/Search for properties/i)).toBeVisible();

        // Check search button is present
        await expect(page.getByRole('button', { name: /Search/i })).toBeVisible();
    });

    test('should display features section', async ({ page }) => {
        await page.goto('/');

        // Check features section
        await expect(page.getByText('Why Choose Moov?')).toBeVisible();
        await expect(page.getByText('Natural Language Search')).toBeVisible();
        await expect(page.getByText('AI-Powered Matching')).toBeVisible();
        await expect(page.getByText('Verified Listings')).toBeVisible();
    });

    test('should be responsive on mobile', async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 667 });
        await page.goto('/');

        // Check mobile navigation
        await expect(page.getByRole('button', { name: /menu/i })).toBeVisible();

        // Check content is still visible
        await expect(page.getByRole('heading', { name: /Find Your Perfect Home/i })).toBeVisible();
    });

    test('should have proper SEO meta tags', async ({ page }) => {
        await page.goto('/');

        // Check meta description
        const metaDescription = page.locator('meta[name="description"]');
        await expect(metaDescription).toHaveAttribute('content', /property search/i);

        // Check Open Graph tags
        const ogTitle = page.locator('meta[property="og:title"]');
        await expect(ogTitle).toHaveAttribute('content', /Moov/i);
    });
});