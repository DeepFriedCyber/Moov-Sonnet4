# Database Index Optimization System

This comprehensive database indexing optimization system provides advanced performance monitoring, index management, and query optimization for the property search API.

## 🚀 Features

### Core Components

1. **DatabaseIndexOptimizer** - Creates and manages property search indexes
2. **QueryPerformanceAnalyzer** - Measures and analyzes query performance
3. **IndexManager** - Manages index lifecycle and provides recommendations
4. **QueryOptimizer** - Analyzes and optimizes slow queries
5. **IndexOptimizedPropertyService** - Production-ready service with optimized queries

### Index Types Created

- **B-tree indexes** for exact matches and range queries
- **GIN indexes** for full-text search
- **GiST indexes** for geographic searches
- **HNSW/IVFFlat indexes** for vector similarity search
- **Partial indexes** for filtered data
- **Composite indexes** for multi-column queries

## 📊 Performance Improvements

Expected performance improvements with proper indexing:

- **Property price range queries**: 10-100x faster
- **Full-text search**: 5-50x faster
- **Geographic proximity search**: 5-20x faster
- **Vector similarity search**: 2-10x faster
- **Complex composite queries**: 3-15x faster

## 🛠️ Installation & Setup

### 1. Run Database Migration

```bash
# Apply the index creation migration
psql -d your_database -f migrations/005_create_property_indexes.sql
```

### 2. Install Required Extensions

```sql
-- Enable required PostgreSQL extensions
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS vector;
```

### 3. Initialize Index Optimizer

```typescript
import { AdvancedConnectionPool } from './database/AdvancedConnectionPool';
import { DatabaseIndexOptimizer } from './database/DatabaseIndexOptimizer';

const pool = new AdvancedConnectionPool({
  connectionString: process.env.DATABASE_URL!
});

const optimizer = new DatabaseIndexOptimizer(pool);
await optimizer.createPropertyIndexes();
```

## 🧪 Testing

### Run Performance Tests

```bash
# Run all database optimization tests
npm test -- --testPathPattern=database

# Run specific test suites
npm test -- src/__tests__/database/indexPerformance.test.ts
npm test -- src/__tests__/database/indexManagement.test.ts
npm test -- src/__tests__/database/queryOptimization.test.ts
```

### Test Coverage

- **Index Performance Tests** (6 tests)
  - Index creation verification
  - Query performance before/after indexing
  - Full-text search optimization
  - Geographic search optimization
  - Vector similarity search
  - Complex composite queries

- **Index Management Tests** (4 tests)
  - Concurrent index creation
  - Missing index detection
  - Usage analysis and recommendations
  - Index effectiveness validation

- **Query Optimization Tests** (3 tests)
  - Query improvement suggestions
  - Multi-filter optimization
  - Pagination optimization

## 📈 Usage Examples

### Basic Property Search with Optimized Indexes

```typescript
import { IndexOptimizedPropertyService } from './services/IndexOptimizedPropertyService';

const service = new IndexOptimizedPropertyService(pool);

const results = await service.searchProperties({
  query: 'modern apartment london',
  price_min: 200000,
  price_max: 800000,
  bedrooms: 2,
  property_type: 'flat',
  page: 1,
  limit: 20,
  sort: 'relevance'
});

console.log(`Found ${results.totalCount} properties in ${results.executionTime}ms`);
```

### Semantic Search with Vector Embeddings

```typescript
const embedding = await getPropertyEmbedding('luxury apartment with garden');

const results = await service.searchPropertiesWithSemanticSimilarity({
  price_min: 300000,
  bedrooms: 2,
  page: 1,
  limit: 10
}, embedding);
```

### Performance Analysis

```typescript
import { QueryPerformanceAnalyzer } from './database/QueryPerformanceAnalyzer';

const analyzer = new QueryPerformanceAnalyzer(pool);

const metrics = await analyzer.measureQueryPerformance(
  'SELECT * FROM properties WHERE price BETWEEN $1 AND $2',
  [100000, 500000]
);

console.log(`Query executed in ${metrics.executionTime}ms`);
console.log(`Indexes used: ${metrics.indexesUsed.join(', ')}`);
```

### Index Management

```typescript
import { IndexManager } from './database/IndexManager';

const manager = new IndexManager(pool);

// Get optimization recommendations
const recommendations = await manager.getOptimizationRecommendations();

// Find unused indexes
const unusedIndexes = await manager.findUnusedIndexes();

// Validate index effectiveness
const effectiveness = await manager.validateIndexEffectiveness(
  'idx_properties_price',
  'SELECT * FROM properties WHERE price BETWEEN $1 AND $2',
  [100000, 500000]
);
```

## 🔍 Query Optimization

### Automatic Query Analysis

```typescript
import { QueryOptimizer } from './database/QueryOptimizer';

const optimizer = new QueryOptimizer(pool);

const slowQuery = `
  SELECT * FROM properties 
  WHERE title LIKE '%london%' 
  AND price > 100000
`;

const suggestions = await optimizer.analyzeAndOptimize(slowQuery);
const optimizedQuery = await optimizer.optimizeQuery(slowQuery);
```

### Pagination Optimization

```typescript
// Automatically detects and optimizes large offset pagination
const paginationOptimization = await optimizer.optimizePagination(`
  SELECT * FROM properties 
  ORDER BY created_at DESC 
  OFFSET 1000 LIMIT 20
`);

console.log(paginationOptimization.suggestedApproach); // 'cursor_based'
```

## 📊 Monitoring & Metrics

### Development Mode Monitoring

The system automatically monitors query performance in development mode:

```typescript
// Automatically logs slow queries (>100ms)
if (process.env.NODE_ENV === 'development') {
  const metrics = await analyzer.measureQueryPerformance(query, params);
  if (metrics.executionTime > 100) {
    console.warn(`Slow query detected: ${metrics.executionTime}ms`);
  }
}
```

### Production Metrics

```typescript
// Get comprehensive performance metrics
const metrics = await service.getQueryPerformanceMetrics(searchParams);

console.log({
  executionTime: metrics.executionTime,
  indexesUsed: metrics.indexesUsed,
  scanTypes: metrics.scanTypes,
  bufferHits: metrics.bufferHits
});
```

## 🏗️ Architecture

### Database Schema Enhancements

The system adds the following to your database:

1. **search_vector column** - tsvector for full-text search
2. **property_embeddings table** - vector embeddings for semantic search
3. **Comprehensive indexes** - 15+ optimized indexes
4. **Triggers** - Automatic search vector updates

### Index Strategy

- **Single-column indexes** for basic filtering
- **Composite indexes** for common query patterns
- **Partial indexes** for filtered data (e.g., available properties only)
- **Specialized indexes** for geographic and vector data

## 🚨 Troubleshooting

### Common Issues

1. **Vector extension not available**
   ```sql
   -- Install pgvector extension
   CREATE EXTENSION IF NOT EXISTS vector;
   ```

2. **PostGIS not available**
   ```sql
   -- Install PostGIS extension
   CREATE EXTENSION IF NOT EXISTS postgis;
   ```

3. **Slow index creation**
   ```sql
   -- Use CONCURRENTLY for large tables
   CREATE INDEX CONCURRENTLY idx_name ON table_name(column);
   ```

### Performance Tuning

1. **Monitor index usage**
   ```sql
   SELECT * FROM pg_stat_user_indexes WHERE relname = 'properties';
   ```

2. **Analyze query plans**
   ```sql
   EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM properties WHERE price > 100000;
   ```

3. **Update table statistics**
   ```sql
   ANALYZE properties;
   ```

## 🔧 Configuration

### Environment Variables

```env
# Database connection
DATABASE_URL=postgresql://user:pass@localhost:5432/db

# Test database for running tests
TEST_DATABASE_URL=postgresql://user:pass@localhost:5432/test_db

# Performance monitoring
NODE_ENV=development  # Enables query monitoring
```

### Pool Configuration

```typescript
const pool = new AdvancedConnectionPool({
  connectionString: process.env.DATABASE_URL!,
  minConnections: 2,
  maxConnections: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000
});
```

## 📚 API Reference

### DatabaseIndexOptimizer

- `createPropertyIndexes()` - Creates all property search indexes
- `dropPropertyIndexes()` - Drops all property search indexes
- `createSearchVectorColumn()` - Sets up full-text search

### QueryPerformanceAnalyzer

- `measureQueryPerformance(query, params)` - Measures query performance
- `compareQueries(query1, query2, params)` - Compares two queries
- `extractMetrics(plan)` - Extracts metrics from query plan

### IndexManager

- `listIndexes(tableName)` - Lists all indexes for a table
- `getIndexInfo(tableName)` - Gets detailed index information
- `findUnusedIndexes()` - Finds rarely used indexes
- `getOptimizationRecommendations()` - Gets optimization suggestions

### QueryOptimizer

- `analyzeAndOptimize(query)` - Analyzes query for improvements
- `optimizeQuery(query)` - Returns optimized version of query
- `optimizePagination(query)` - Optimizes pagination queries

## 🤝 Contributing

1. Add new index patterns to `DatabaseIndexOptimizer`
2. Extend query analysis in `QueryOptimizer`
3. Add performance tests for new features
4. Update documentation for new capabilities

## 📄 License

This database optimization system is part of the Moov-Sonnet4 property search project.