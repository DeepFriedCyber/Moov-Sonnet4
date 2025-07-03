# 🔧 E2E Testing Troubleshooting Guide

## 🚨 Common Issues and Solutions

### 1. **"🚀 Start Full Application Stack" Fails**

#### **Symptoms:**
- Docker containers fail to start
- Services don't become healthy
- Port binding errors

#### **Debugging Steps:**

1. **Run Debug Script Locally:**
```bash
# Linux/Mac
npm run debug:e2e:docker

# Windows
npm run debug:e2e:docker:windows
```

2. **Check Docker Logs:**
```bash
# View all container logs
docker-compose -f docker-compose.e2e.yml logs

# View specific service logs
docker logs e2e-frontend --tail 50
docker logs e2e-api --tail 50
docker logs e2e-embedding --tail 50
```

3. **Check Container Status:**
```bash
docker-compose -f docker-compose.e2e.yml ps
docker inspect e2e-frontend --format='{{.State.Health.Status}}'
```

#### **Common Causes & Solutions:**

##### **A. Frontend Build Failures**
**Error:** `npm run build` fails in frontend container

**Solutions:**
1. **Missing Dependencies:**
```bash
# Check if all dependencies are installed
cd property-search-frontend
npm ci
npm run build
```

2. **TypeScript Errors:**
```bash
# Check for TypeScript issues
npm run type-check
```

3. **Environment Variables:**
```bash
# Ensure required env vars are set
echo $NEXT_PUBLIC_API_URL
echo $NEXT_PUBLIC_EMBEDDING_SERVICE_URL
```

##### **B. API Service Failures**
**Error:** API container exits or health check fails

**Solutions:**
1. **Database Connection:**
```bash
# Test database connectivity
docker exec e2e-postgres psql -U moov -d moov_db -c "SELECT 1;"
```

2. **Missing Environment Variables:**
```bash
# Check API environment
docker exec e2e-api env | grep -E "(DATABASE_URL|REDIS_URL|JWT_SECRET)"
```

3. **Port Conflicts:**
```bash
# Check if ports are available
netstat -tuln | grep -E ":(3001|8000)"
```

##### **C. Database Issues**
**Error:** PostgreSQL fails to start or initialize

**Solutions:**
1. **Migration Files:**
```bash
# Check if migration files exist
ls -la property-search-api/migrations/
```

2. **Database Permissions:**
```bash
# Check PostgreSQL logs
docker logs e2e-postgres
```

3. **Volume Conflicts:**
```bash
# Clean up volumes
docker-compose -f docker-compose.e2e.yml down --volumes
```

##### **D. AI Service Issues**
**Error:** Embedding service fails to start

**Solutions:**
1. **Python Dependencies:**
```bash
# Check if requirements.txt exists
ls -la property-search-embedding-service/requirements.txt
```

2. **Service Health:**
```bash
# Test AI service directly
curl http://localhost:8001/health
```

### 2. **Service Health Check Timeouts**

#### **Symptoms:**
- `wait-on` commands timeout
- Services appear to start but health checks fail

#### **Solutions:**

1. **Increase Timeout Values:**
```yaml
# In CI workflow, increase timeout
run: npx wait-on http://localhost:3000 --timeout 300000 # 5 minutes
```

2. **Check Health Endpoints:**
```bash
# Test health endpoints manually
curl -v http://localhost:3001/health
curl -v http://localhost:8001/health
curl -v http://localhost:3000
```

3. **Network Issues:**
```bash
# Check Docker network
docker network inspect $(docker-compose -f docker-compose.e2e.yml config | grep -A1 networks | tail -1 | awk '{print $1}')
```

### 3. **Playwright Test Failures**

#### **Symptoms:**
- Tests fail to connect to frontend
- Browser launch failures
- Element not found errors

#### **Solutions:**

1. **Browser Installation:**
```bash
cd property-search-frontend
npx playwright install --with-deps
```

2. **Base URL Configuration:**
```bash
# Ensure correct base URL
export PLAYWRIGHT_BASE_URL=http://localhost:3000
npm run test:e2e
```

3. **Test Debugging:**
```bash
# Run tests in headed mode
npx playwright test --headed

# Run with debug
npx playwright test --debug

# Generate trace
npx playwright test --trace on
```

### 4. **CI/CD Specific Issues**

#### **GitHub Actions Failures:**

1. **Resource Limitations:**
```yaml
# Add resource monitoring
- name: Check Resources
  run: |
    df -h
    free -h
    docker system df
```

2. **Service Dependencies:**
```yaml
# Ensure proper service startup order
depends_on:
  postgres:
    condition: service_healthy
  redis:
    condition: service_healthy
```

3. **Artifact Collection:**
```yaml
# Always collect artifacts for debugging
- name: Upload Debug Artifacts
  if: always()
  uses: actions/upload-artifact@v3
  with:
    name: debug-logs
    path: |
      docker-logs/
      test-results/
```

## 🔍 Debugging Commands Reference

### **Local Development:**
```bash
# Start debug session
npm run debug:e2e:docker

# View live logs
docker-compose -f docker-compose.e2e.yml logs -f

# Execute commands in containers
docker exec -it e2e-frontend sh
docker exec -it e2e-api bash

# Test individual services
curl http://localhost:3000
curl http://localhost:3001/health
curl http://localhost:8001/health
```

### **Container Management:**
```bash
# Restart specific service
docker-compose -f docker-compose.e2e.yml restart frontend

# Rebuild specific service
docker-compose -f docker-compose.e2e.yml up -d --build frontend

# Clean restart
docker-compose -f docker-compose.e2e.yml down --volumes
docker-compose -f docker-compose.e2e.yml up -d --build
```

### **Network Debugging:**
```bash
# Check network connectivity between containers
docker exec e2e-frontend ping e2e-api
docker exec e2e-api ping e2e-postgres

# Check port bindings
docker port e2e-frontend
docker port e2e-api
```

## 📊 Performance Optimization

### **Build Time Optimization:**
1. **Docker Layer Caching:**
```dockerfile
# Copy package files first for better caching
COPY package*.json ./
RUN npm ci
COPY . .
```

2. **Multi-stage Builds:**
```dockerfile
FROM node:18-alpine AS deps
# Install dependencies

FROM node:18-alpine AS builder
# Build application

FROM node:18-alpine AS runner
# Runtime image
```

### **Test Execution Optimization:**
1. **Parallel Test Execution:**
```bash
# Run tests in parallel
npx playwright test --workers=2
```

2. **Selective Test Running:**
```bash
# Run only critical tests
npx playwright test --grep "critical"
```

## 🚨 Emergency Procedures

### **Complete Reset:**
```bash
# Stop everything
docker-compose -f docker-compose.e2e.yml down --volumes --remove-orphans

# Clean Docker system
docker system prune -f

# Remove all E2E related containers and images
docker rm -f $(docker ps -aq --filter "name=e2e-")
docker rmi -f $(docker images -q --filter "reference=*e2e*")

# Restart from scratch
npm run test:e2e:docker
```

### **Quick Health Check:**
```bash
# One-liner to check all services
for port in 3000 3001 5432 6379 8001; do echo -n "Port $port: "; curl -s -o /dev/null -w "%{http_code}" http://localhost:$port || echo "failed"; done
```

## 📞 Getting Help

### **Log Collection for Support:**
```bash
# Collect all relevant logs
mkdir debug-logs
docker logs e2e-frontend > debug-logs/frontend.log 2>&1
docker logs e2e-api > debug-logs/api.log 2>&1
docker logs e2e-embedding > debug-logs/embedding.log 2>&1
docker logs e2e-postgres > debug-logs/postgres.log 2>&1
docker logs e2e-redis > debug-logs/redis.log 2>&1
docker-compose -f docker-compose.e2e.yml ps > debug-logs/containers.log
```

### **System Information:**
```bash
# Collect system info
echo "Docker version: $(docker --version)" > debug-logs/system.log
echo "Docker Compose version: $(docker-compose --version)" >> debug-logs/system.log
echo "Node version: $(node --version)" >> debug-logs/system.log
echo "NPM version: $(npm --version)" >> debug-logs/system.log
df -h >> debug-logs/system.log
free -h >> debug-logs/system.log
```

## ✅ Success Indicators

### **Healthy System Checklist:**
- [ ] All containers show "Up" status
- [ ] All health checks return "healthy"
- [ ] All ports respond to curl requests
- [ ] No error messages in container logs
- [ ] Playwright tests can connect to frontend
- [ ] Database migrations completed successfully
- [ ] Redis connection established
- [ ] AI service responds to health checks

### **Performance Benchmarks:**
- Container startup: < 2 minutes
- Service health checks: < 30 seconds each
- Frontend build: < 3 minutes
- API startup: < 30 seconds
- Database initialization: < 1 minute

---

**Remember:** Most E2E test failures are due to timing issues or missing dependencies. The debug scripts will help identify the root cause quickly! 🔍✨