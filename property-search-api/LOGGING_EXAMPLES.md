# Search Ranking Debug Logging

This document shows how the logging system provides visibility into the ranking algorithm.

## Logger Interface

The SemanticSearchService accepts an optional logger that implements:

```typescript
interface Logger {
  debug(message: string, meta?: any): void;
  info(message: string, meta?: any): void;
  warn(message: string, meta?: any): void;
  error(message: string, meta?: any): void;
}
```

## Example Log Output

When a search is performed, the service logs detailed information about each property's ranking calculation:

```javascript
// Example log entry for a property
{
  message: "Re-ranking property ID: 123",
  meta: {
    initialScore: 0.85,        // Original semantic similarity score
    finalScore: 0.92,          // Final score after all boosts
    boosts: {
      baseScore: 0.425,        // 0.85 * 0.5 (base weight)
      cityMatch: 0.1,          // Exact city match bonus
      featureMatch: 0.15,      // 3 features * 0.05 each
      matchedFeatures: ["garden", "parking", "balcony"],
      priceInRange: 0.1,       // Within budget bonus
      bedroomMatch: 0.05,      // Bedroom requirement met
      freshnessBoost: 0.05,    // Listed < 7 days ago
      superFreshnessBoost: 0.05 // Listed < 1 day ago
    },
    property: {
      id: "123",
      title: "Modern 2-bed apartment with garden",
      city: "London",
      price: 450000,
      features: ["garden", "parking", "balcony"],
      daysSinceListed: 0.5     // Half a day old
    }
  }
}
```

## Integration Examples

### With Winston Logger

```typescript
import winston from 'winston';
import { SemanticSearchService } from './services/search/SemanticSearchService';

const logger = winston.createLogger({
  level: 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'search-debug.log' })
  ]
});

const searchService = new SemanticSearchService(
  db, 
  embedding, 
  cache, 
  queryParser, 
  logger
);
```

### With Console Logger (Development)

```typescript
const consoleLogger = {
  debug: (msg, meta) => console.log(`🔍 ${msg}`, meta),
  info: (msg, meta) => console.info(`ℹ️ ${msg}`, meta),
  warn: (msg, meta) => console.warn(`⚠️ ${msg}`, meta),
  error: (msg, meta) => console.error(`❌ ${msg}`, meta),
};

const searchService = new SemanticSearchService(
  db, 
  embedding, 
  cache, 
  queryParser, 
  consoleLogger
);
```

### With Structured Logging (Production)

```typescript
import { createLogger } from './utils/logger';

const logger = createLogger({
  service: 'property-search',
  level: process.env.LOG_LEVEL || 'info',
  structured: true
});

const searchService = new SemanticSearchService(
  db, 
  embedding, 
  cache, 
  queryParser, 
  logger
);
```

## Debugging Scenarios

### 1. Why is Property X Ranking Low?

Search the logs for the property ID:

```bash
grep "Re-ranking property ID: 123" search-debug.log
```

You'll see exactly which boosts it received and why its final score is what it is.

### 2. Feature Matching Not Working?

Look for properties that should have feature matches:

```javascript
// Log will show:
{
  boosts: {
    featureMatch: 0,           // No boost = no matching features
    matchedFeatures: []        // Empty array confirms no matches
  }
}
```

### 3. Location Scoring Issues?

Check if city/postcode matching is working:

```javascript
// Expected for London property when searching in London:
{
  boosts: {
    cityMatch: 0.1,           // Should be present
    postcodePrefixMatch: 0.05 // Should be present for same postcode area
  }
}
```

### 4. Price Range Problems?

Verify price filtering logic:

```javascript
// For property priced at £450k with budget £400k-£500k:
{
  boosts: {
    priceInRange: 0.1         // Should be present
  }
}
```

## Performance Considerations

### Production Logging

In production, you might want to:

1. **Log only top N results** to reduce noise
2. **Use async logging** to avoid blocking search requests
3. **Sample logging** (e.g., log 1 in 100 searches)

```typescript
const productionLogger = {
  debug: (msg, meta) => {
    // Sample logging - only log 1% of searches
    if (Math.random() < 0.01) {
      asyncLogger.debug(msg, meta);
    }
  },
  // ... other methods
};
```

### Development Logging

In development, log everything for full visibility:

```typescript
const devLogger = {
  debug: (msg, meta) => {
    console.log(`🔍 ${new Date().toISOString()} ${msg}`);
    console.log(JSON.stringify(meta, null, 2));
  },
  // ... other methods
};
```

## Log Analysis Queries

### Find Properties with High Feature Scores

```bash
# Using jq to analyze JSON logs
cat search-debug.log | jq 'select(.meta.boosts.featureMatch > 0.1)'
```

### Average Ranking Scores by City

```bash
cat search-debug.log | jq -r '[.meta.property.city, .meta.finalScore] | @csv'
```

### Properties Getting Freshness Boosts

```bash
cat search-debug.log | jq 'select(.meta.boosts.freshnessBoost > 0)'
```

## Troubleshooting Guide

| Issue | What to Look For | Expected Log Values |
|-------|------------------|-------------------|
| Low semantic scores | `initialScore` values | Should be > 0.5 for good matches |
| Missing city matches | `boosts.cityMatch` | Should be 0.1 when cities match |
| Feature matching broken | `boosts.matchedFeatures` | Should contain expected features |
| Price filtering wrong | `boosts.priceInRange` | Should be 0.1 when in range |
| Freshness not working | `boosts.freshnessBoost` | Should be 0.05 for recent listings |

This logging system makes the "black box" of search ranking completely transparent and debuggable!