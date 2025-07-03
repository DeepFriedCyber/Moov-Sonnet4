# 🐳 E2E Testing with Docker Compose - Complete Setup

## 📋 Overview

This document describes the complete End-to-End testing setup using **Docker Compose** and **TDD principles**. The implementation follows the **Red → Green → Refactor** cycle and provides a production-like testing environment.

## 🏗️ Architecture

```
🐳 Docker Compose E2E Testing Stack
├── 🗄️  PostgreSQL Database (port 5432)
├── 🔄 Redis Cache (port 6379)
├── 🚀 Backend API (port 3001)
├── 🤖 AI Embedding Service (port 8001)
├── 🌐 Frontend Application (port 3000)
└── 🧪 Playwright E2E Tests (external)
```

## 📁 Files Created

### Docker Configuration
```
├── docker-compose.e2e.yml          # E2E testing stack
├── property-search-frontend/
│   └── Dockerfile                  # Frontend container
└── scripts/
    ├── test-e2e-docker.sh          # Linux/Mac test script
    └── test-e2e-docker.ps1         # Windows test script
```

### CI/CD Integration
```
├── .github/workflows/ci.yml        # Updated with Docker Compose E2E job
└── property-search-frontend/
    └── playwright.config.ts        # Updated with environment-based baseURL
```

## 🚀 Getting Started

### Prerequisites
- Docker and Docker Compose installed
- Node.js 18+ (for running Playwright tests)
- Git (for cloning the repository)

### Local Testing

#### Option 1: Using Scripts (Recommended)

**Linux/Mac:**
```bash
# Make script executable
chmod +x scripts/test-e2e-docker.sh

# Run E2E tests
./scripts/test-e2e-docker.sh
```

**Windows (PowerShell):**
```powershell
# Run E2E tests
.\scripts\test-e2e-docker.ps1
```

#### Option 2: Manual Steps

1. **Create Environment File:**
```bash
cat > .env << EOF
POSTGRES_USER=moov
POSTGRES_PASSWORD=moov123
POSTGRES_DB=moov_db
JWT_SECRET=a_test_secret_for_ci_that_is_long_enough
FRONTEND_URL=http://localhost:3000
EOF
```

2. **Start Application Stack:**
```bash
docker-compose -f docker-compose.e2e.yml up -d --build
```

3. **Wait for Services:**
```bash
# Wait for all services to be healthy
docker-compose -f docker-compose.e2e.yml ps

# Check service health
curl http://localhost:3000        # Frontend
curl http://localhost:3001/health # API
curl http://localhost:8001/health # AI Service
```

4. **Run E2E Tests:**
```bash
cd property-search-frontend
npm ci
npx playwright install --with-deps
PLAYWRIGHT_BASE_URL=http://localhost:3000 npm run test:e2e
```

5. **Cleanup:**
```bash
docker-compose -f docker-compose.e2e.yml down
```

## 🧪 Test Structure

### Test Categories
1. **Core Search Functionality** (`search.spec.ts`)
   - Homepage to search results flow
   - Search input validation
   - API integration verification

2. **Homepage Tests** (`homepage.spec.ts`)
   - Page load verification
   - Element visibility checks
   - Mobile responsiveness

3. **API Integration** (`api-integration.spec.ts`)
   - Backend connectivity
   - Error handling
   - Loading states

4. **Comprehensive Flows** (`comprehensive-flow.spec.ts`)
   - Complete user journeys
   - Performance validation
   - Accessibility compliance

### Test Execution Flow
```
1. 🐳 Start Docker Compose stack
2. ⏳ Wait for all services to be healthy
3. 🧪 Run Playwright tests against live stack
4. 📊 Generate test reports
5. 🛑 Stop and cleanup containers
```

## 🔧 CI/CD Integration

### GitHub Actions Job
```yaml
e2e-tests:
  name: 🧪 End-to-End Tests
  runs-on: ubuntu-latest
  needs: [frontend-test, backend-test, ai-service-test]
  
  steps:
    - name: 📦 Checkout Code
    - name: 📝 Create .env file
    - name: 🚀 Start Full Application Stack
    - name: ⏳ Wait for services to be ready
    - name: 🧪 Run Playwright E2E Tests
    - name: 📊 Upload test reports
    - name: 🛑 Stop Application Stack
```

### Pipeline Integration
```
Setup → Unit Tests → Integration Tests → E2E Tests → Build → Deploy
  ↓         ↓             ↓              ↓         ↓       ↓
 📦       🧪           🔗            🐳       🏗️     🚀
```

## 🐳 Docker Compose Configuration

### Services Overview

#### PostgreSQL Database
```yaml
postgres:
  image: postgres:15-alpine
  ports: ["5432:5432"]
  environment:
    POSTGRES_USER: moov
    POSTGRES_PASSWORD: moov123
    POSTGRES_DB: moov_db
  healthcheck:
    test: ["CMD-SHELL", "pg_isready -U moov -d moov_db"]
```

#### Redis Cache
```yaml
redis:
  image: redis:7-alpine
  ports: ["6379:6379"]
  healthcheck:
    test: ["CMD", "redis-cli", "ping"]
```

#### Backend API
```yaml
api:
  build: ./property-search-api
  ports: ["3001:3001"]
  environment:
    NODE_ENV: test
    DATABASE_URL: postgresql://moov:moov123@postgres:5432/moov_db
    REDIS_URL: redis://redis:6379
    PORT: 3001
  depends_on:
    - postgres
    - redis
```

#### AI Embedding Service
```yaml
embedding-service:
  build: ./property-embedding-service
  ports: ["8001:8001"]
  environment:
    REDIS_URL: redis://redis:6379
  depends_on:
    - redis
```

#### Frontend Application
```yaml
frontend:
  build: ./property-search-frontend
  ports: ["3000:3000"]
  environment:
    NEXT_PUBLIC_API_URL: http://localhost:3001
    NEXT_PUBLIC_EMBEDDING_SERVICE_URL: http://localhost:8001
  depends_on:
    - api
    - embedding-service
```

## 🎯 TDD Implementation

### Red → Green → Refactor Cycle

#### 🔴 Red State (Test First)
```typescript
test('should allow a user to search for a property and see results', async ({ page }) => {
  // This test will initially fail because:
  // 1. Docker containers might not be built
  // 2. Services might not be properly configured
  // 3. Frontend components might not exist
  // 4. API endpoints might not be implemented
});
```

#### 🟢 Green State (Make It Pass)
1. **Infrastructure Setup:**
   - Create Docker Compose configuration
   - Build all service containers
   - Configure service dependencies
   - Set up health checks

2. **Service Implementation:**
   - Implement API endpoints
   - Create frontend components
   - Set up database schema
   - Configure AI service

3. **Integration:**
   - Connect frontend to API
   - Connect API to database
   - Connect API to AI service
   - Test end-to-end flow

#### 🔵 Refactor State (Improve Quality)
1. **Performance Optimization:**
   - Optimize Docker build times
   - Improve service startup times
   - Add proper health checks
   - Optimize test execution

2. **Reliability Improvements:**
   - Add retry mechanisms
   - Improve error handling
   - Add comprehensive logging
   - Enhance monitoring

## 📊 Benefits of Docker Compose E2E Testing

### 1. **Production-Like Environment** 🏭
- Tests run against the same stack as production
- Database migrations are tested
- Service-to-service communication is validated
- Environment variables and configuration are tested

### 2. **Isolation and Consistency** 🔒
- Each test run starts with a clean environment
- No interference between test runs
- Consistent results across different machines
- Reproducible test failures

### 3. **Comprehensive Testing** 🎯
- Full application stack is tested
- Database interactions are real
- Network communication is tested
- Performance characteristics are validated

### 4. **CI/CD Integration** 🔄
- Automated testing in GitHub Actions
- Parallel execution with other test jobs
- Artifact collection for debugging
- Automatic cleanup after tests

## 🐛 Troubleshooting

### Common Issues

#### 1. **Services Not Starting**
```bash
# Check service logs
docker-compose -f docker-compose.e2e.yml logs

# Check specific service
docker logs e2e-frontend
docker logs e2e-api
docker logs e2e-postgres
```

#### 2. **Port Conflicts**
```bash
# Check what's using ports
netstat -tulpn | grep :3000
netstat -tulpn | grep :3001
netstat -tulpn | grep :5432

# Stop conflicting services
docker stop $(docker ps -q)
```

#### 3. **Database Connection Issues**
```bash
# Test database connection
docker exec e2e-postgres psql -U moov -d moov_db -c "SELECT 1;"

# Check database logs
docker logs e2e-postgres
```

#### 4. **Test Failures**
```bash
# Run tests with debug output
PLAYWRIGHT_BASE_URL=http://localhost:3000 npm run test:e2e:debug

# Check test artifacts
ls -la property-search-frontend/test-results/
ls -la property-search-frontend/playwright-report/
```

### Debug Commands
```bash
# Check all container status
docker-compose -f docker-compose.e2e.yml ps

# Follow logs in real-time
docker-compose -f docker-compose.e2e.yml logs -f

# Execute commands in containers
docker exec -it e2e-api bash
docker exec -it e2e-frontend sh

# Check network connectivity
docker exec e2e-frontend curl http://api:3001/health
docker exec e2e-api curl http://embedding-service:8001/health
```

## 📈 Performance Considerations

### Build Optimization
- Use multi-stage Docker builds
- Leverage Docker layer caching
- Minimize image sizes
- Use .dockerignore files

### Test Execution
- Run tests in parallel when possible
- Use test fixtures for common data
- Implement proper cleanup
- Monitor resource usage

### CI/CD Optimization
- Cache Docker layers
- Use artifact storage
- Implement proper timeouts
- Monitor pipeline performance

## 🔮 Future Enhancements

### Planned Improvements
1. **Multi-Environment Testing**
   - Staging environment tests
   - Production smoke tests
   - Cross-browser testing in containers

2. **Advanced Monitoring**
   - Performance metrics collection
   - Error rate monitoring
   - Resource usage tracking

3. **Test Data Management**
   - Seed data automation
   - Test data cleanup
   - Data privacy compliance

4. **Security Testing**
   - Vulnerability scanning
   - Authentication testing
   - Authorization validation

## 🎉 Conclusion

The Docker Compose E2E testing setup provides a **robust, scalable, and maintainable** testing solution that:

- ✅ **Follows TDD principles** with Red → Green → Refactor cycle
- ✅ **Tests the complete application stack** in a production-like environment
- ✅ **Integrates seamlessly with CI/CD** pipelines
- ✅ **Provides comprehensive test coverage** across all services
- ✅ **Ensures consistent and reliable** test execution
- ✅ **Supports local development** and debugging workflows

This implementation represents a **production-ready E2E testing solution** that will scale with the application and provide confidence in deployments! 🚀