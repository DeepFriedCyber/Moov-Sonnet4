# 🔍 Moov Property Search - Monitoring & CI/CD Setup

This document provides a comprehensive guide to the monitoring, alerting, and CI/CD pipeline setup for the Moov Property Search application.

## 📋 Table of Contents

- [Overview](#overview)
- [CI/CD Pipeline](#cicd-pipeline)
- [Monitoring Stack](#monitoring-stack)
- [Alerting System](#alerting-system)
- [Blue-Green Deployment](#blue-green-deployment)
- [Health Checks](#health-checks)
- [E2E Testing](#e2e-testing)
- [Backup & Recovery](#backup--recovery)
- [Getting Started](#getting-started)
- [Troubleshooting](#troubleshooting)

## 🎯 Overview

Our monitoring and CI/CD setup provides:

- **Comprehensive CI/CD Pipeline** with GitHub Actions
- **Real-time Monitoring** with Prometheus, Grafana, and Loki
- **Intelligent Alerting** with AlertManager
- **Blue-Green Deployment** for zero-downtime releases
- **End-to-End Testing** with Playwright
- **Automated Backups** and disaster recovery
- **Performance Monitoring** and business metrics

## 🚀 CI/CD Pipeline

### Workflow Structure

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Code Push     │───▶│   CI Pipeline   │───▶│   Deployment    │
│                 │    │                 │    │                 │
│ • main branch   │    │ • Tests         │    │ • Staging       │
│ • develop       │    │ • Security      │    │ • Production    │
│ • pull requests │    │ • Build         │    │ • Blue-Green    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Pipeline Stages

1. **Setup & Versioning**
   - Generate semantic versions
   - Set up build environment

2. **Testing**
   - Frontend tests (Jest/Vitest)
   - API tests (Node.js/TypeScript)
   - Embedding service tests (Python/pytest)
   - Security scanning (Trivy)

3. **Building**
   - Docker image builds
   - Multi-architecture support
   - Image optimization

4. **Deployment**
   - Staging deployment (develop branch)
   - Production deployment (main branch)
   - Blue-green strategy

5. **Post-Deployment**
   - E2E testing
   - Health checks
   - Performance monitoring

### Key Files

- `.github/workflows/main.yml` - Main CI/CD pipeline
- `.github/workflows/dependencies.yml` - Dependency updates
- `.github/workflows/release.yml` - Release management

## 📊 Monitoring Stack

### Architecture

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│ Application │───▶│ Prometheus  │───▶│   Grafana   │
│  Services   │    │  (Metrics)  │    │ (Dashboard) │
└─────────────┘    └─────────────┘    └─────────────┘
       │                   │                   │
       ▼                   ▼                   ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│    Loki     │    │AlertManager │    │   Jaeger    │
│   (Logs)    │    │ (Alerts)    │    │ (Tracing)   │
└─────────────┘    └─────────────┘    └─────────────┘
```

### Components

#### Prometheus
- **Purpose**: Metrics collection and storage
- **Port**: 9090
- **Config**: `monitoring/prometheus.yml`
- **Retention**: 200 hours

#### Grafana
- **Purpose**: Visualization and dashboards
- **Port**: 3001
- **Dashboards**:
  - Application Overview
  - Business Metrics
  - Infrastructure Monitoring
- **Default Login**: admin/admin123

#### Loki
- **Purpose**: Log aggregation
- **Port**: 3100
- **Integration**: Grafana datasource

#### AlertManager
- **Purpose**: Alert routing and notifications
- **Port**: 9093
- **Config**: `monitoring/alertmanager.yml`

#### Jaeger
- **Purpose**: Distributed tracing
- **Port**: 16686
- **Integration**: OpenTelemetry

### Metrics Collected

#### Application Metrics
- HTTP request rates and latencies
- Error rates by service
- Database connection pools
- Cache hit/miss rates
- Search performance
- User engagement

#### Business Metrics
- Daily Active Users (DAU)
- Search success rates
- Property view counts
- Conversion rates
- Popular search terms
- Geographic distribution

#### Infrastructure Metrics
- CPU and memory usage
- Disk space utilization
- Network I/O
- Container health
- Load balancer status

## 🚨 Alerting System

### Alert Categories

#### Critical Alerts
- Service downtime
- Database connectivity issues
- High error rates (>5%)
- Disk space critical (<10%)

#### Warning Alerts
- High latency (>1s)
- Memory usage high (>90%)
- Low search success rate (<95%)
- SSL certificate expiry (<30 days)

#### Business Alerts
- Low user engagement
- High bounce rate
- Conversion rate drops
- Property data staleness

### Notification Channels

1. **Email**: Critical and warning alerts
2. **Slack**: Real-time notifications
3. **PagerDuty**: Critical alerts (optional)

### Alert Configuration

```yaml
# Example alert rule
- alert: APIHighErrorRate
  expr: |
    (
      sum(rate(http_requests_total{job="api",status=~"5.."}[5m]))
      /
      sum(rate(http_requests_total{job="api"}[5m]))
    ) > 0.05
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "High error rate on API"
    description: "Error rate is {{ $value | humanizePercentage }}"
```

## 🔄 Blue-Green Deployment

### Strategy Overview

Blue-green deployment ensures zero-downtime releases by maintaining two identical production environments.

```
┌─────────────┐    ┌─────────────┐
│    Blue     │    │    Green    │
│ Environment │    │ Environment │
│             │    │             │
│ ┌─────────┐ │    │ ┌─────────┐ │
│ │Frontend │ │    │ │Frontend │ │
│ │   API   │ │    │ │   API   │ │
│ │Embedding│ │    │ │Embedding│ │
│ └─────────┘ │    │ └─────────┘ │
└─────────────┘    └─────────────┘
       │                   │
       └─────────┬─────────┘
                 │
         ┌─────────────┐
         │   Traefik   │
         │Load Balancer│
         └─────────────┘
```

### Deployment Process

1. **Deploy to inactive environment** (Blue or Green)
2. **Run health checks** on new deployment
3. **Switch traffic** via load balancer
4. **Monitor** for issues
5. **Stop old environment** if successful
6. **Rollback** if issues detected

### Usage

```bash
# Deploy using blue-green strategy
./scripts/deploy-blue-green.sh

# Manual rollback if needed
docker compose -f docker-compose.production-enhanced.yml up -d frontend-blue api-blue
```

## 🏥 Health Checks

### Endpoint Types

#### Health (`/health`)
- Overall service status
- Dependency checks
- Resource utilization

#### Readiness (`/ready`)
- Service ready to accept traffic
- All dependencies available

#### Liveness (`/live`)
- Service is alive
- Basic functionality check

#### Metrics (`/metrics`)
- Prometheus-compatible metrics
- Performance counters

### Implementation

#### API Service
```typescript
// Comprehensive health check
app.get('/health', async (req, res) => {
  const health = {
    status: 'ok',
    services: {
      database: await checkDatabase(),
      redis: await checkRedis(),
      embedding: await checkEmbedding()
    }
  };
  res.json(health);
});
```

#### Embedding Service
```python
@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "models_loaded": list(models.keys()),
        "redis_connected": redis_client is not None
    }
```

## 🧪 E2E Testing

### Test Structure

```
e2e-tests/
├── tests/
│   ├── homepage.spec.ts      # Homepage functionality
│   ├── search.spec.ts        # Search features
│   └── performance.spec.ts   # Performance tests
├── playwright.config.ts      # Test configuration
└── package.json             # Dependencies
```

### Test Categories

1. **Functional Tests**
   - Homepage loading
   - Search functionality
   - Property details
   - User interactions

2. **Performance Tests**
   - Page load times
   - Core Web Vitals
   - Memory usage
   - Concurrent users

3. **Accessibility Tests**
   - WCAG compliance
   - Screen reader compatibility
   - Keyboard navigation

### Running Tests

```bash
# Install dependencies
cd e2e-tests && npm install

# Run all tests
npm run test

# Run with UI
npm run test:ui

# Run specific test
npx playwright test homepage.spec.ts
```

## 💾 Backup & Recovery

### Backup Strategy

#### Automated Backups
- **Database**: Daily PostgreSQL dumps
- **Redis**: Daily RDB snapshots
- **Application Data**: Configuration and logs
- **Retention**: 30 days local, 90 days cloud

#### Cloud Storage
- **AWS S3**: Primary backup destination
- **Google Cloud Storage**: Secondary backup
- **Encryption**: AES-256 at rest

### Backup Script

```bash
# Run manual backup
./scripts/backup.sh

# Restore from backup
./scripts/restore.sh backup_20240101_120000.sql.gz
```

### Disaster Recovery

1. **RTO (Recovery Time Objective)**: 4 hours
2. **RPO (Recovery Point Objective)**: 24 hours
3. **Backup Testing**: Monthly
4. **Documentation**: Updated quarterly

## 🚀 Getting Started

### Prerequisites

- Docker and Docker Compose
- Node.js 18+
- Python 3.11+
- Git

### Quick Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/DeepFriedCyber/Moov-Sonnet4.git
   cd Moov-Sonnet4
   ```

2. **Set up environment variables**
   ```bash
   cp .env.production.example .env.production
   # Edit .env.production with your values
   ```

3. **Start monitoring stack**
   ```bash
   docker compose -f docker-compose.monitoring.yml up -d
   ```

4. **Start application**
   ```bash
   docker compose -f docker-compose.production-enhanced.yml up -d
   ```

5. **Access dashboards**
   - Grafana: http://localhost:3001
   - Prometheus: http://localhost:9090
   - AlertManager: http://localhost:9093

### Environment Setup

#### Production
```bash
# Use production environment
export NODE_ENV=production
docker compose -f docker-compose.production-enhanced.yml up -d
```

#### Staging
```bash
# Use staging environment
export NODE_ENV=staging
docker compose -f docker-compose.staging.yml up -d
```

## 🔧 Troubleshooting

### Common Issues

#### High Memory Usage
```bash
# Check container memory usage
docker stats

# Restart services if needed
docker compose restart api embedding-1
```

#### Database Connection Issues
```bash
# Check database logs
docker logs moov-postgres

# Test connection
docker exec -it moov-postgres psql -U moov_user -d moov_production
```

#### Monitoring Not Working
```bash
# Check Prometheus targets
curl http://localhost:9090/api/v1/targets

# Restart monitoring stack
docker compose -f docker-compose.monitoring.yml restart
```

### Log Analysis

#### Application Logs
```bash
# View API logs
docker logs moov-api --tail 100 -f

# View embedding service logs
docker logs moov-embedding-1 --tail 100 -f
```

#### System Logs
```bash
# Check system resources
docker exec -it moov-prometheus promtool query instant 'up'

# View Grafana logs
docker logs moov-grafana --tail 50
```

### Performance Optimization

#### Database
- Monitor connection pool usage
- Optimize slow queries
- Regular VACUUM and ANALYZE

#### Redis
- Monitor memory usage
- Set appropriate TTL values
- Use Redis clustering for scale

#### Application
- Monitor heap usage
- Optimize bundle sizes
- Use CDN for static assets

## 📚 Additional Resources

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [Playwright Documentation](https://playwright.dev/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

**Need Help?** 
- 📧 Email: support@moov-property.com
- 💬 Slack: #moov-support
- 📖 Wiki: [Internal Documentation](https://wiki.moov-property.com)