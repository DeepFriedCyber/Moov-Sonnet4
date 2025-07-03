# 🎭 End-to-End Testing with Playwright

This directory contains comprehensive E2E tests for the Property Search application using Playwright and TDD principles.

## 📁 Test Structure

```
tests/e2e/
├── README.md                     # This file
├── search.spec.ts               # Core search functionality tests
├── homepage.spec.ts             # Homepage functionality tests
├── search-results.spec.ts       # Search results page tests
├── api-integration.spec.ts      # API integration tests
├── comprehensive-flow.spec.ts   # Full user journey tests
└── utils/
    └── test-helpers.ts          # Reusable test utilities
```

## 🚀 Running Tests

### Prerequisites
```bash
# Install dependencies (from frontend directory)
npm install

# Install Playwright browsers
npx playwright install
```

### Local Development
```bash
# Run all E2E tests
npm run test:e2e

# Run tests with UI (interactive mode)
npm run test:e2e:ui

# Run tests in headed mode (see browser)
npm run test:e2e:headed

# Debug specific test
npm run test:e2e:debug -- --grep "search functionality"
```

### CI/CD Pipeline
Tests automatically run in the CI pipeline after:
- ✅ Frontend tests pass
- ✅ Backend tests pass  
- ✅ AI service tests pass
- ✅ All services are healthy

## 🧪 Test Categories

### 1. **Core Functionality Tests** (`search.spec.ts`)
- Homepage to search results flow
- Search input validation
- Results display verification
- API integration confirmation

### 2. **Homepage Tests** (`homepage.spec.ts`)
- Page load verification
- Element visibility checks
- Navigation functionality
- Mobile responsiveness

### 3. **Search Results Tests** (`search-results.spec.ts`)
- Property card display
- Filtering functionality
- Pagination
- Empty results handling
- Property detail navigation

### 4. **API Integration Tests** (`api-integration.spec.ts`)
- Backend connectivity
- Error handling
- Loading states
- Response validation

### 5. **Comprehensive Flow Tests** (`comprehensive-flow.spec.ts`)
- Complete user journeys
- Cross-browser testing
- Performance validation
- Accessibility compliance

## 🛠️ Test Utilities

The `utils/test-helpers.ts` file provides:

### TestHelpers Class
```typescript
const helpers = new TestHelpers(page);

// Common actions
await helpers.performSearch('London apartment');
await helpers.waitForPropertyCards();
await helpers.waitForLoadingToComplete();

// Verification
const cardCount = await helpers.getPropertyCardCount();
const hasError = await helpers.hasErrorMessage();

// Mocking
await helpers.mockApiResponse('/api/search', mockData);
await helpers.mockSlowApiResponse('/api/search', 3000);
```

### TestData Class
```typescript
// Get random test data
const query = TestData.getRandomSearchQuery();

// Access predefined test sets
TestData.searchQueries.valid
TestData.searchQueries.invalid
TestData.searchQueries.edge
```

### Environment Class
```typescript
// Environment detection
Environment.isCI()
Environment.getBaseUrl()
Environment.getApiUrl()
```

## 🎯 TDD Workflow

### Red → Green → Refactor

1. **🔴 Red State**: Write failing test first
   ```typescript
   test('should display search results', async ({ page }) => {
     // This will fail initially
     await expect(page.locator('[data-testid="property-card"]')).toBeVisible();
   });
   ```

2. **🟢 Green State**: Make test pass
   - Implement frontend components
   - Add required data-testid attributes
   - Ensure API endpoints work
   - Fix any integration issues

3. **🔵 Refactor**: Improve code quality
   - Extract common patterns to test helpers
   - Optimize selectors
   - Add better error handling
   - Improve test reliability

## 📊 Test Configuration

### Browser Coverage
- ✅ Chromium (Chrome/Edge)
- ✅ Firefox
- ✅ WebKit (Safari)
- ✅ Mobile Chrome
- ✅ Mobile Safari

### Test Environments
- 🏠 **Local**: Full interactive testing
- 🔄 **CI**: Headless, parallel execution
- 📱 **Mobile**: Responsive design validation
- 🌐 **Cross-browser**: Compatibility testing

## 🐛 Debugging Tests

### Common Issues & Solutions

1. **Element not found**
   ```typescript
   // ❌ Too specific
   await page.locator('#specific-id').click();
   
   // ✅ More resilient
   await page.getByRole('button', { name: /search/i }).click();
   ```

2. **Timing issues**
   ```typescript
   // ❌ Hard wait
   await page.waitForTimeout(5000);
   
   // ✅ Wait for condition
   await page.waitForSelector('[data-testid="results"]');
   await helpers.waitForLoadingToComplete();
   ```

3. **API mocking**
   ```typescript
   // Mock before navigation
   await helpers.mockApiResponse('/api/search', mockData);
   await page.goto('/');
   ```

### Debug Commands
```bash
# Run single test with debug
npx playwright test search.spec.ts --debug

# Generate test code
npx playwright codegen localhost:3000

# Show test report
npx playwright show-report
```

## 📈 Best Practices

### 1. **Reliable Selectors**
- Use `data-testid` attributes
- Prefer semantic selectors (`getByRole`, `getByText`)
- Avoid CSS selectors that might change

### 2. **Test Independence**
- Each test should be independent
- Use `beforeEach` for common setup
- Clean up after tests

### 3. **Realistic Testing**
- Test real user workflows
- Use realistic test data
- Test error conditions

### 4. **Performance**
- Run tests in parallel when possible
- Use page object patterns for complex flows
- Mock external dependencies

## 🔧 Maintenance

### Adding New Tests
1. Create test file in appropriate category
2. Use existing test helpers when possible
3. Follow naming conventions
4. Add to CI pipeline if needed

### Updating Selectors
1. Update in test helpers first
2. Run full test suite to verify
3. Update documentation

### Performance Monitoring
- Monitor test execution time
- Identify flaky tests
- Optimize slow tests

## 📚 Resources

- [Playwright Documentation](https://playwright.dev/)
- [Testing Best Practices](https://playwright.dev/docs/best-practices)
- [Debugging Guide](https://playwright.dev/docs/debug)
- [CI/CD Integration](https://playwright.dev/docs/ci)