import { Page, expect } from '@playwright/test';

/**
 * Common test utilities for E2E tests
 */
export class TestHelpers {
  constructor(private page: Page) {}

  /**
   * Perform a property search from the homepage
   */
  async performSearch(query: string) {
    await this.page.goto('/');
    const searchInput = this.page.getByPlaceholder(/Enter a location, feature, or keyword/i);
    await searchInput.fill(query);
    const searchButton = this.page.getByRole('button', { name: /Search/i });
    await searchButton.click();
    await this.page.waitForURL(/.*\/search/);
  }

  /**
   * Wait for property cards to load
   */
  async waitForPropertyCards() {
    await this.page.waitForSelector('[data-testid="property-card"]', { timeout: 10000 });
  }

  /**
   * Get the count of property cards on the page
   */
  async getPropertyCardCount(): Promise<number> {
    await this.waitForPropertyCards();
    return await this.page.locator('[data-testid="property-card"]').count();
  }

  /**
   * Check if the page is in a loading state
   */
  async isLoading(): Promise<boolean> {
    const loadingIndicators = [
      '[data-testid="loading"]',
      '[data-testid="spinner"]',
      '.loading',
      '.spinner'
    ];

    for (const selector of loadingIndicators) {
      if (await this.page.locator(selector).isVisible()) {
        return true;
      }
    }

    return false;
  }

  /**
   * Wait for loading to complete
   */
  async waitForLoadingToComplete() {
    // Wait for any loading indicators to disappear
    const loadingSelectors = [
      '[data-testid="loading"]',
      '[data-testid="spinner"]',
      '.loading',
      '.spinner'
    ];

    for (const selector of loadingSelectors) {
      await this.page.waitForSelector(selector, { state: 'hidden', timeout: 15000 }).catch(() => {
        // Ignore timeout errors - loading indicator might not exist
      });
    }
  }

  /**
   * Check for error messages on the page
   */
  async hasErrorMessage(): Promise<boolean> {
    const errorSelectors = [
      '[data-testid="error-message"]',
      '[data-testid="error"]',
      '.error-message',
      '.error'
    ];

    for (const selector of errorSelectors) {
      if (await this.page.locator(selector).isVisible()) {
        return true;
      }
    }

    // Also check for common error text
    const errorTexts = [
      /something went wrong/i,
      /error occurred/i,
      /failed to load/i,
      /network error/i
    ];

    for (const text of errorTexts) {
      if (await this.page.getByText(text).isVisible()) {
        return true;
      }
    }

    return false;
  }

  /**
   * Mock API responses for testing
   */
  async mockApiResponse(endpoint: string, response: any, status: number = 200) {
    await this.page.route(`**${endpoint}**`, route => {
      route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify(response)
      });
    });
  }

  /**
   * Mock API to simulate slow response
   */
  async mockSlowApiResponse(endpoint: string, delay: number = 2000) {
    await this.page.route(`**${endpoint}**`, async route => {
      await new Promise(resolve => setTimeout(resolve, delay));
      route.continue();
    });
  }

  /**
   * Take a screenshot with a descriptive name
   */
  async takeScreenshot(name: string) {
    await this.page.screenshot({ 
      path: `test-results/screenshots/${name}-${Date.now()}.png`,
      fullPage: true 
    });
  }

  /**
   * Verify page accessibility basics
   */
  async checkBasicAccessibility() {
    // Check for alt text on images
    const images = this.page.locator('img');
    const imageCount = await images.count();
    
    for (let i = 0; i < imageCount; i++) {
      const img = images.nth(i);
      const alt = await img.getAttribute('alt');
      const src = await img.getAttribute('src');
      
      if (src && !alt) {
        console.warn(`Image without alt text: ${src}`);
      }
    }

    // Check for proper heading hierarchy
    const h1Count = await this.page.locator('h1').count();
    expect(h1Count).toBeLessThanOrEqual(1); // Should have at most one h1

    // Check for form labels
    const inputs = this.page.locator('input[type="text"], input[type="email"], input[type="password"], textarea');
    const inputCount = await inputs.count();
    
    for (let i = 0; i < inputCount; i++) {
      const input = inputs.nth(i);
      const id = await input.getAttribute('id');
      const ariaLabel = await input.getAttribute('aria-label');
      const placeholder = await input.getAttribute('placeholder');
      
      if (id) {
        const label = this.page.locator(`label[for="${id}"]`);
        const hasLabel = await label.count() > 0;
        
        if (!hasLabel && !ariaLabel && !placeholder) {
          console.warn(`Input without proper labeling: ${await input.getAttribute('name') || 'unnamed'}`);
        }
      }
    }
  }
}

/**
 * Test data generators
 */
export class TestData {
  static searchQueries = {
    valid: [
      'modern apartment London',
      'house with garden',
      '2 bedroom flat',
      'property near station'
    ],
    invalid: [
      '',
      '   ',
      'xyzabc123nonexistent',
      '!@#$%^&*()'
    ],
    edge: [
      'a'.repeat(1000), // Very long query
      '🏠🏡🏢', // Emoji
      'café résidence', // Accented characters
    ]
  };

  static getRandomSearchQuery(): string {
    const queries = this.searchQueries.valid;
    return queries[Math.floor(Math.random() * queries.length)];
  }
}

/**
 * Environment helpers
 */
export class Environment {
  static isCI(): boolean {
    return !!process.env.CI;
  }

  static getBaseUrl(): string {
    return process.env.BASE_URL || 'http://localhost:3000';
  }

  static getApiUrl(): string {
    return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  }

  static getEmbeddingServiceUrl(): string {
    return process.env.NEXT_PUBLIC_EMBEDDING_SERVICE_URL || 'http://localhost:8001';
  }
}