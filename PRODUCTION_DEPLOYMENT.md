# 🚀 Production Deployment Guide

This guide covers deploying the Moov Property Search application to production using Docker containers with immutable, security-hardened images.

## 📋 Prerequisites

- Docker and Docker Compose installed
- Production environment variables configured
- SSL certificates (for HTTPS)
- Domain names configured
- Reverse proxy/load balancer setup

## 🏗️ Production Architecture

### Docker Compose Files

- **`docker-compose.yml`**: Base configuration for all environments
- **`docker-compose.prod.yml`**: Production overrides with immutable images

### Production Features

- ✅ **Immutable Images**: No volume mounts, code baked into images
- ✅ **Multi-stage Builds**: Optimized image sizes
- ✅ **Non-root Users**: Security-hardened containers
- ✅ **Health Checks**: Built-in container health monitoring
- ✅ **Production Optimizations**: Database and Redis tuning
- ✅ **Security Scanning**: Automated secret detection

## 🔧 Setup Instructions

### 1. Configure Environment Variables

```bash
# Copy the production environment template
cp .env.production.example .env.production

# Edit with your production values
nano .env.production
```

**Required Production Variables:**
```env
# Database
POSTGRES_USER=your_production_db_user
POSTGRES_PASSWORD=your_very_secure_production_password
POSTGRES_DB=moov_production_db

# Application
NODE_ENV=production
JWT_SECRET=your_extremely_secure_jwt_secret_64_chars_minimum
FRONTEND_URL=https://your-production-domain.com

# API URLs
NEXT_PUBLIC_API_URL=https://api.your-production-domain.com
NEXT_PUBLIC_EMBEDDING_SERVICE_URL=https://embedding.your-production-domain.com

# API Keys
MAPTILER_API_KEY=your_production_maptiler_key
```

### 2. Security Validation

Run security checks before deployment:

```bash
# Check for hardcoded secrets
bash test_for_hardcoded_secrets.sh

# Run comprehensive security validation
powershell -ExecutionPolicy Bypass -File validate_security_simple.ps1
```

### 3. Production Deployment

#### Option A: PowerShell Script (Windows)

```powershell
# Full deployment with security checks
.\deploy-production.ps1

# Skip security checks (not recommended)
.\deploy-production.ps1 -SkipSecurityCheck

# Skip build (use existing images)
.\deploy-production.ps1 -NoBuild
```

#### Option B: Manual Docker Compose

```bash
# Build production images
docker-compose -f docker-compose.yml -f docker-compose.prod.yml --env-file .env.production build

# Start production services
docker-compose -f docker-compose.yml -f docker-compose.prod.yml --env-file .env.production up -d

# Check status
docker-compose -f docker-compose.yml -f docker-compose.prod.yml --env-file .env.production ps
```

## 🐳 Production Docker Images

### API Service (`Dockerfile.prod`)
- **Base**: `node:18-alpine`
- **Multi-stage**: Build → Production
- **User**: Non-root `nodejs` user
- **Port**: 8000
- **Health Check**: `/health` endpoint

### Frontend Service (`Dockerfile.prod`)
- **Base**: `node:18-alpine`
- **Output**: Next.js standalone
- **User**: Non-root `nextjs` user
- **Port**: 3000
- **Health Check**: Root endpoint

### Embedding Service (`Dockerfile.prod`)
- **Base**: `python:3.9-slim`
- **Virtual Environment**: Isolated dependencies
- **User**: Non-root `appuser` user
- **Port**: 8001
- **Health Check**: `/health` endpoint

## 🔒 Security Features

### Container Security
- ✅ Non-root users in all containers
- ✅ Minimal base images (Alpine/Slim)
- ✅ No unnecessary packages
- ✅ Read-only file systems where possible

### Secret Management
- ✅ No hardcoded secrets in images
- ✅ Environment variables from `.env.production`
- ✅ Automated secret detection in CI/CD
- ✅ Fail-fast on missing secrets

### Network Security
- ✅ Internal Docker network isolation
- ✅ Only necessary ports exposed
- ✅ Health checks for service monitoring

## 📊 Production Optimizations

### Database (PostgreSQL)
```yaml
# Production-optimized settings
max_connections: 200
shared_buffers: 256MB
effective_cache_size: 1GB
maintenance_work_mem: 64MB
```

### Cache (Redis)
```yaml
# Production-optimized settings
maxmemory: 256mb
maxmemory-policy: allkeys-lru
save: "900 1 300 10 60 10000"
appendonly: yes
```

### Application
- **Node.js**: Production mode, optimized builds
- **Next.js**: Standalone output, static optimization
- **Python**: Bytecode compilation, virtual environment

## 🔍 Health Monitoring

### Built-in Health Checks

| Service | Endpoint | Interval | Timeout |
|---------|----------|----------|---------|
| API | `http://localhost:8000/health` | 30s | 3s |
| Frontend | `http://localhost:3000/` | 30s | 3s |
| Embedding | `http://localhost:8001/health` | 30s | 10s |

### Monitoring Commands

```bash
# Check all container health
docker-compose -f docker-compose.yml -f docker-compose.prod.yml ps

# View logs
docker-compose -f docker-compose.yml -f docker-compose.prod.yml logs -f

# Check specific service
docker-compose -f docker-compose.yml -f docker-compose.prod.yml logs api
```

## 🚨 Troubleshooting

### Common Issues

1. **Container fails to start**
   ```bash
   # Check logs
   docker-compose logs [service-name]
   
   # Check environment variables
   docker-compose config
   ```

2. **Health checks failing**
   ```bash
   # Test endpoints manually
   curl http://localhost:8000/health
   curl http://localhost:3000
   curl http://localhost:8001/health
   ```

3. **Database connection issues**
   ```bash
   # Check PostgreSQL logs
   docker-compose logs postgres
   
   # Test database connection
   docker-compose exec postgres psql -U $POSTGRES_USER -d $POSTGRES_DB
   ```

### Rollback Procedure

```bash
# Stop production containers
docker-compose -f docker-compose.yml -f docker-compose.prod.yml down

# Start previous version (if available)
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d --scale api=0
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

## 🔄 CI/CD Integration

The production deployment integrates with GitHub Actions:

```yaml
# .github/workflows/ci.yml
deploy-production:
  name: 🌟 Deploy to Production
  runs-on: ubuntu-latest
  if: github.event_name == 'push' && github.ref == 'refs/heads/main'
  needs: [frontend-test, backend-test, ai-service-test, docker-build]
  environment: production
```

## 📝 Post-Deployment Checklist

- [ ] All services are healthy and responding
- [ ] SSL certificates are configured
- [ ] Domain names are pointing to the server
- [ ] Reverse proxy/load balancer is configured
- [ ] Monitoring and alerting are set up
- [ ] Backup procedures are in place
- [ ] Log aggregation is configured
- [ ] Performance monitoring is active

## 🛡️ Security Checklist

- [ ] No hardcoded secrets in code or images
- [ ] All containers run as non-root users
- [ ] Environment variables are properly secured
- [ ] Network access is restricted to necessary ports
- [ ] Regular security updates are scheduled
- [ ] Vulnerability scanning is automated

## 📞 Support

For deployment issues:
1. Check the logs: `docker-compose logs`
2. Verify configuration: `docker-compose config`
3. Run security validation: `bash test_for_hardcoded_secrets.sh`
4. Check health endpoints manually
5. Review this documentation

---

**🎯 Production deployment is now secure, automated, and ready for scale!**