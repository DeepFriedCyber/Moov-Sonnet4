# Logger Integration Examples

This document shows how to integrate different logging solutions with the SemanticSearchService.

## Logger Interface

The service requires a logger that implements the `Logger` interface:

```typescript
// src/types/logger.ts
export interface Logger {
  debug(message: string, context?: Record<string, any>): void;
  info(message: string, context?: Record<string, any>): void;
  warn(message: string, context?: Record<string, any>): void;
  error(message: string, context?: Record<string, any>): void;
}
```

## Integration Examples

### 1. Winston Logger (Production)

```typescript
import winston from 'winston';
import { Logger } from '@/types/logger';
import { SemanticSearchService } from '@/services/search/SemanticSearchService';

// Create Winston logger
const winstonLogger = winston.createLogger({
  level: 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ 
      filename: 'logs/search-debug.log',
      level: 'debug'
    }),
    new winston.transports.File({ 
      filename: 'logs/search-error.log',
      level: 'error'
    }),
    new winston.transports.Console({
      level: 'info',
      format: winston.format.simple()
    })
  ]
});

// Adapter to match our Logger interface
const logger: Logger = {
  debug: (message: string, context?: Record<string, any>) => 
    winstonLogger.debug(message, context),
  info: (message: string, context?: Record<string, any>) => 
    winstonLogger.info(message, context),
  warn: (message: string, context?: Record<string, any>) => 
    winstonLogger.warn(message, context),
  error: (message: string, context?: Record<string, any>) => 
    winstonLogger.error(message, context),
};

// Create search service
const searchService = new SemanticSearchService(
  db, 
  embedding, 
  cache, 
  queryParser, 
  logger
);
```

### 2. Pino Logger (High Performance)

```typescript
import pino from 'pino';
import { Logger } from '@/types/logger';

// Create Pino logger
const pinoLogger = pino({
  level: 'debug',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true
    }
  }
});

// Adapter for our Logger interface
const logger: Logger = {
  debug: (message: string, context?: Record<string, any>) => 
    pinoLogger.debug(context, message),
  info: (message: string, context?: Record<string, any>) => 
    pinoLogger.info(context, message),
  warn: (message: string, context?: Record<string, any>) => 
    pinoLogger.warn(context, message),
  error: (message: string, context?: Record<string, any>) => 
    pinoLogger.error(context, message),
};

const searchService = new SemanticSearchService(
  db, embedding, cache, queryParser, logger
);
```

### 3. Console Logger (Development)

```typescript
import { Logger } from '@/types/logger';

const consoleLogger: Logger = {
  debug: (message: string, context?: Record<string, any>) => {
    console.log(`🔍 DEBUG: ${message}`);
    if (context) console.log(JSON.stringify(context, null, 2));
  },
  info: (message: string, context?: Record<string, any>) => {
    console.info(`ℹ️ INFO: ${message}`);
    if (context) console.info(JSON.stringify(context, null, 2));
  },
  warn: (message: string, context?: Record<string, any>) => {
    console.warn(`⚠️ WARN: ${message}`);
    if (context) console.warn(JSON.stringify(context, null, 2));
  },
  error: (message: string, context?: Record<string, any>) => {
    console.error(`❌ ERROR: ${message}`);
    if (context) console.error(JSON.stringify(context, null, 2));
  },
};

const searchService = new SemanticSearchService(
  db, embedding, cache, queryParser, consoleLogger
);
```

### 4. No-Op Logger (Silent Mode)

```typescript
import { Logger } from '@/types/logger';

const noOpLogger: Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
};

const searchService = new SemanticSearchService(
  db, embedding, cache, queryParser, noOpLogger
);
```

### 5. Custom Application Logger

```typescript
import { Logger } from '@/types/logger';

class ApplicationLogger implements Logger {
  constructor(
    private serviceName: string,
    private environment: string
  ) {}

  debug(message: string, context?: Record<string, any>): void {
    this.log('DEBUG', message, context);
  }

  info(message: string, context?: Record<string, any>): void {
    this.log('INFO', message, context);
  }

  warn(message: string, context?: Record<string, any>): void {
    this.log('WARN', message, context);
  }

  error(message: string, context?: Record<string, any>): void {
    this.log('ERROR', message, context);
  }

  private log(level: string, message: string, context?: Record<string, any>): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      service: this.serviceName,
      environment: this.environment,
      message,
      ...context
    };

    // Send to your logging service (e.g., DataDog, Splunk, etc.)
    if (this.environment === 'production') {
      this.sendToLoggingService(logEntry);
    } else {
      console.log(JSON.stringify(logEntry, null, 2));
    }
  }

  private sendToLoggingService(logEntry: any): void {
    // Implementation for your logging service
    // e.g., HTTP request to logging endpoint
  }
}

const logger = new ApplicationLogger('property-search', process.env.NODE_ENV || 'development');
const searchService = new SemanticSearchService(
  db, embedding, cache, queryParser, logger
);
```

## Environment-Based Logger Factory

```typescript
import { Logger } from '@/types/logger';

export function createLogger(): Logger {
  const environment = process.env.NODE_ENV || 'development';
  
  switch (environment) {
    case 'production':
      return createProductionLogger();
    case 'staging':
      return createStagingLogger();
    case 'test':
      return createTestLogger();
    default:
      return createDevelopmentLogger();
  }
}

function createProductionLogger(): Logger {
  // Winston with file transports, structured logging
  const winston = require('winston');
  const winstonLogger = winston.createLogger({
    level: 'info', // Less verbose in production
    format: winston.format.json(),
    transports: [
      new winston.transports.File({ filename: 'logs/app.log' })
    ]
  });

  return {
    debug: (msg, ctx) => winstonLogger.debug(msg, ctx),
    info: (msg, ctx) => winstonLogger.info(msg, ctx),
    warn: (msg, ctx) => winstonLogger.warn(msg, ctx),
    error: (msg, ctx) => winstonLogger.error(msg, ctx),
  };
}

function createDevelopmentLogger(): Logger {
  // Console logger with pretty formatting
  return {
    debug: (msg, ctx) => console.log(`🔍 ${msg}`, ctx || ''),
    info: (msg, ctx) => console.info(`ℹ️ ${msg}`, ctx || ''),
    warn: (msg, ctx) => console.warn(`⚠️ ${msg}`, ctx || ''),
    error: (msg, ctx) => console.error(`❌ ${msg}`, ctx || ''),
  };
}

function createTestLogger(): Logger {
  // Silent logger for tests
  return {
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
  };
}

function createStagingLogger(): Logger {
  // Similar to production but with debug level
  // ... implementation
}
```

## Usage in Application

```typescript
// src/app.ts
import { createLogger } from './utils/logger-factory';
import { SemanticSearchService } from './services/search/SemanticSearchService';

const logger = createLogger();
const searchService = new SemanticSearchService(
  db, 
  embedding, 
  cache, 
  queryParser, 
  logger
);

// Now all search operations will be logged according to your environment
app.get('/search', async (req, res) => {
  try {
    const results = await searchService.search(req.query.q);
    res.json(results);
  } catch (error) {
    logger.error('Search failed', { 
      query: req.query.q, 
      error: error.message 
    });
    res.status(500).json({ error: 'Search failed' });
  }
});
```

## Log Output Example

When a search is performed, you'll see detailed logs like:

```json
{
  "timestamp": "2024-01-15T10:30:45.123Z",
  "level": "DEBUG",
  "message": "Re-ranking property ID: 123",
  "propertyId": "123",
  "initialScore": 0.85,
  "finalScore": 0.92,
  "boosts": {
    "baseScore": 0.425,
    "cityMatch": 0.1,
    "featureMatch": 0.15,
    "matchedFeatures": ["garden", "parking"],
    "priceInRange": 0.1,
    "freshnessBoost": 0.05
  },
  "property": {
    "id": "123",
    "title": "Modern apartment with garden",
    "city": "London",
    "price": 450000,
    "features": ["garden", "parking"],
    "daysSinceListed": 0.5
  }
}
```

This structured approach makes the search ranking algorithm completely transparent and debuggable across all environments!