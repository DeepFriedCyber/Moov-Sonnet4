# Performance Testing Suite

This comprehensive performance testing suite is designed to measure and validate the performance improvements achieved through database optimization, indexing strategies, and connection pool management.

## 🎯 Overview

The performance testing suite includes:

- **Database Performance Tests**: Measure query execution times with and without indexes
- **API Load Tests**: Test API endpoints under concurrent load
- **Connection Pool Tests**: Validate connection pool efficiency and leak detection
- **Vector Search Tests**: Benchmark semantic search performance
- **Validation Performance**: Test input validation speed and accuracy

## 🚀 Quick Start

### Run All Performance Tests
```bash
npm run test:performance
```

### Run Specific Test Categories
```bash
# Database optimization tests only
npm run test:performance:database

# API load tests only  
npm run test:performance:api

# Connection pool tests only
npm run test:performance:pool

# All tests with custom parameters
npm run test:performance:all
```

### Custom Test Configuration
```bash
# Run with custom parameters
tsx scripts/run-performance-tests.ts --database --data-size=10000 --iterations=50 --users=100

# Get help with all options
npm run test:performance:help
```

## 📊 Test Categories

### 1. Database Performance Tests

Tests the impact of database indexing on query performance:

- **Baseline Test**: Measures performance without indexes
- **Optimized Test**: Measures performance with all indexes created
- **Complex Query Test**: Tests multi-filter searches with joins
- **Vector Search Test**: Benchmarks semantic similarity searches

**Key Metrics:**
- Average execution time
- P95/P99 response times
- Requests per second
- Indexes utilized
- Scan types used

### 2. API Load Tests

Tests API endpoints under concurrent load:

- **Concurrent User Simulation**: Multiple users making simultaneous requests
- **Rate Limiting Tests**: Validates rate limiting under high load
- **Input Validation Tests**: Tests validation performance with various inputs
- **Health Check Tests**: Monitors system health endpoint performance

**Key Metrics:**
- Response times (avg, P95, P99)
- Error rates
- Requests per second
- System stability

### 3. Connection Pool Tests

Validates database connection pool efficiency:

- **Connection Acquisition Speed**: Time to get database connections
- **Pool Utilization**: Efficiency of connection reuse
- **Leak Detection**: Identifies connection leaks
- **Concurrent Load**: Pool behavior under high concurrency

**Key Metrics:**
- Acquisition times
- Pool efficiency percentage
- Connection leaks
- Maximum pool utilization

## 🔧 Configuration Options

### Command Line Options

| Option | Description | Default |
|--------|-------------|---------|
| `--database` | Run database performance tests | true |
| `--api` | Run API load tests | false |
| `--pool` | Run connection pool tests | true |
| `--all` | Run all test categories | false |
| `--data-size=N` | Number of test properties to create | 5000 |
| `--iterations=N` | Number of test iterations per benchmark | 30 |
| `--users=N` | Number of concurrent users for load tests | 25 |
| `--verbose` | Enable verbose output | false |
| `--help` | Show help information | - |

### Environment Variables

```bash
# Required
DATABASE_URL=postgresql://user:pass@localhost:5432/property_search
TEST_DATABASE_URL=postgresql://user:pass@localhost:5432/property_search_test

# Optional
PERFORMANCE_TEST_DATA_SIZE=5000
PERFORMANCE_TEST_ITERATIONS=30
PERFORMANCE_TEST_CONCURRENT_USERS=25
```

## 📈 Understanding Results

### Database Performance Results

```
📊 BASELINE PERFORMANCE (No Indexes):
Average Query Time: 1250ms
P95 Query Time: 2100ms
Total Test Time: 37500ms
Requests/Second: 1.33

🚀 OPTIMIZED PERFORMANCE (With Indexes):
Average Query Time: 85ms
P95 Query Time: 120ms
Total Test Time: 2550ms
Requests/Second: 19.6

⚡ PERFORMANCE IMPROVEMENT:
Speed Improvement: 14.7x faster
Time Reduction: 93.2%
Throughput Increase: 1370%
```

### API Load Test Results

```
🔥 CONCURRENT LOAD TEST RESULTS:
Total Requests: 500
Successful Requests: 498
Failed Requests: 2
Average Response Time: 145ms
P95 Response Time: 280ms
P99 Response Time: 450ms
Requests/Second: 12.5
Error Rate: 0.4%
```

### Connection Pool Results

```
🏊 CONNECTION POOL PERFORMANCE:
Total Connections Requested: 1000
Successful Acquisitions: 1000
Failed Acquisitions: 0
Avg Acquisition Time: 12ms
Connection Leaks: 0
Pool Efficiency: 98.5%
```

## 🎯 Performance Targets

### Database Performance Targets

| Metric | Target | Excellent |
|--------|--------|-----------|
| Average Query Time | < 100ms | < 50ms |
| P95 Query Time | < 200ms | < 100ms |
| Index Usage | > 80% | > 95% |
| Speed Improvement | > 5x | > 10x |

### API Performance Targets

| Metric | Target | Excellent |
|--------|--------|-----------|
| Average Response Time | < 200ms | < 100ms |
| P95 Response Time | < 500ms | < 250ms |
| Error Rate | < 1% | < 0.1% |
| Requests/Second | > 10 | > 50 |

### Connection Pool Targets

| Metric | Target | Excellent |
|--------|--------|-----------|
| Acquisition Time | < 50ms | < 20ms |
| Pool Efficiency | > 95% | > 98% |
| Connection Leaks | 0 | 0 |
| Failed Acquisitions | < 1% | 0% |

## 🔍 Troubleshooting

### Common Issues

**Slow Database Tests**
- Ensure test database has sufficient resources
- Check if other processes are using the database
- Verify indexes are being created correctly

**API Test Failures**
- Check if the API server is running
- Verify database connections are available
- Ensure rate limiting is configured correctly

**Connection Pool Issues**
- Monitor database connection limits
- Check for connection leaks in application code
- Verify pool configuration matches database limits

### Debug Mode

Run tests with verbose output for detailed debugging:

```bash
tsx scripts/run-performance-tests.ts --all --verbose
```

## 📋 Reports

Performance tests automatically generate detailed reports:

- **Console Output**: Real-time results during test execution
- **Report Files**: Saved to `performance-report-[timestamp].txt`
- **Metrics Summary**: Key performance indicators and comparisons

### Sample Report Structure

```
📊 PERFORMANCE TEST REPORT
==================================================

🚀 Baseline (No Indexes)
------------------------------
Total Requests: 50
Average Time: 1250.45ms
P95 Time: 2100ms
P99 Time: 2800ms
Min Time: 890ms
Max Time: 3200ms
Requests/Second: 1.33
Indexes Used: None
Scan Types: Seq Scan

🚀 Optimized (With Indexes)
------------------------------
Total Requests: 50
Average Time: 85.23ms
P95 Time: 120ms
P99 Time: 180ms
Min Time: 45ms
Max Time: 250ms
Requests/Second: 19.6
Indexes Used: idx_properties_price, idx_properties_bedrooms
Scan Types: Index Scan, Bitmap Heap Scan
```

## 🚀 Integration with CI/CD

### GitHub Actions Example

```yaml
name: Performance Tests

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  performance:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Run performance tests
        run: npm run test:performance:database
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test
          
      - name: Upload performance report
        uses: actions/upload-artifact@v3
        with:
          name: performance-report
          path: performance-report-*.txt
```

## 🎯 Best Practices

### Before Running Tests

1. **Isolate Test Environment**: Use dedicated test database
2. **Warm Up System**: Allow JIT compilation and caching to stabilize
3. **Monitor Resources**: Ensure sufficient CPU, memory, and disk I/O
4. **Baseline Measurements**: Always establish baseline before optimization

### During Tests

1. **Consistent Environment**: Run tests under similar conditions
2. **Multiple Iterations**: Use sufficient iterations for statistical significance
3. **Monitor System**: Watch for resource constraints during tests
4. **Document Changes**: Record any configuration changes between test runs

### After Tests

1. **Analyze Trends**: Look for performance trends over time
2. **Compare Results**: Compare against previous benchmarks
3. **Investigate Anomalies**: Research unexpected performance changes
4. **Document Findings**: Record insights and optimization opportunities

## 🔗 Related Documentation

- [Database Optimization Guide](./DATABASE_OPTIMIZATION.md)
- [Index Management](./INDEX_MANAGEMENT.md)
- [Connection Pool Configuration](./CONNECTION_POOL.md)
- [API Performance Tuning](./API_PERFORMANCE.md)

## 🤝 Contributing

When adding new performance tests:

1. Follow existing test patterns and naming conventions
2. Include appropriate assertions and thresholds
3. Add documentation for new metrics
4. Update this README with new test descriptions
5. Ensure tests are deterministic and repeatable

## 📞 Support

For questions about performance testing:

1. Check the troubleshooting section above
2. Review existing test results and reports
3. Consult the related documentation
4. Open an issue with detailed test results and environment information