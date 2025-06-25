# 📚 Moov Property Search - Documentation

Welcome to the comprehensive documentation for the Moov Property Search platform. This documentation provides detailed information about the API, authentication, deployment, and monitoring systems.

## 📋 Documentation Index

### 🔌 API Documentation
- **[API Documentation](./API_DOCUMENTATION.md)** - Complete REST API reference
  - Authentication endpoints
  - Property management
  - Search functionality
  - Chat system
  - WebSocket events
  - Data models and examples

### 🔐 Authentication & Security
- **[Authentication Guide](./AUTHENTICATION.md)** - Security and authentication system
  - JWT token management
  - Role-based access control (RBAC)
  - API key authentication
  - Two-factor authentication (2FA)
  - OAuth integration
  - Security best practices

### 🚀 Deployment & Operations
- **[Monitoring Setup](../MONITORING.md)** - Comprehensive monitoring and CI/CD guide
  - CI/CD pipeline configuration
  - Monitoring stack (Prometheus, Grafana, Loki)
  - Alerting system
  - Blue-green deployment
  - Performance monitoring

- **[Deployment Checklist](../DEPLOYMENT_CHECKLIST.md)** - Pre-deployment verification
  - Environment configuration
  - Security checklist
  - Testing requirements
  - Monitoring setup
  - Emergency procedures

## 🏗️ Architecture Overview

### System Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Load Balancer │    │   Monitoring    │
│   (Next.js)     │◄──►│   (Traefik)     │◄──►│   (Grafana)     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   API Server    │    │   Embedding     │    │   Prometheus    │
│   (Node.js)     │◄──►│   Service       │◄──►│   (Metrics)     │
└─────────────────┘    │   (Python)      │    └─────────────────┘
         │              └─────────────────┘              │
         ▼                       │                       ▼
┌─────────────────┐              ▼              ┌─────────────────┐
│   Database      │    ┌─────────────────┐     │   Log Storage   │
│   (PostgreSQL)  │    │   Cache         │     │   (Loki)        │
│   + pgvector     │    │   (Redis)       │     └─────────────────┘
└─────────────────┘    └─────────────────┘
```

### Technology Stack

#### Frontend
- **Framework**: Next.js 14 with TypeScript
- **Styling**: Tailwind CSS
- **State Management**: Zustand
- **Maps**: MapTiler GL JS
- **Testing**: Playwright (E2E), Vitest (Unit)

#### Backend API
- **Runtime**: Node.js 18+
- **Framework**: Express.js with TypeScript
- **Database**: PostgreSQL with pgvector extension
- **Cache**: Redis (Master-Slave setup)
- **Authentication**: JWT with refresh tokens
- **Real-time**: Socket.IO for chat

#### Embedding Service
- **Language**: Python 3.11+
- **Framework**: FastAPI
- **ML Models**: Sentence Transformers
- **Vector Operations**: NumPy, SciPy
- **Caching**: Redis integration

#### Infrastructure
- **Containerization**: Docker & Docker Compose
- **Load Balancer**: Traefik with SSL termination
- **Monitoring**: Prometheus, Grafana, Loki, Jaeger
- **CI/CD**: GitHub Actions
- **Deployment**: Blue-Green strategy

## 🚀 Quick Start Guide

### Prerequisites
- Docker and Docker Compose
- Node.js 18+ (for development)
- Python 3.11+ (for embedding service development)
- Git

### 1. Clone Repository
```bash
git clone https://github.com/DeepFriedCyber/Moov-Sonnet4.git
cd Moov-Sonnet4
```

### 2. Environment Setup
```bash
# Copy environment files
cp .env.example .env.development
cp .env.production.example .env.production

# Edit environment variables
nano .env.development
```

### 3. Development Setup
```bash
# Start development environment
docker compose -f docker-compose.development.yml up -d

# Install frontend dependencies
cd property-search-frontend
npm install
npm run dev

# Install API dependencies
cd ../property-search-api
npm install
npm run dev
```

### 4. Production Deployment
```bash
# Start monitoring stack
docker compose -f docker-compose.monitoring.yml up -d

# Deploy application
docker compose -f docker-compose.production-enhanced.yml up -d
```

### 5. Access Applications
- **Frontend**: http://localhost:3000
- **API**: http://localhost:3001
- **Embedding Service**: http://localhost:8001
- **Grafana**: http://localhost:3001 (admin/admin123)
- **Prometheus**: http://localhost:9090

## 📖 API Quick Reference

### Authentication
```bash
# Register new user
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123","firstName":"John","lastName":"Doe"}'

# Login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123"}'
```

### Property Search
```bash
# Natural language search
curl -X POST http://localhost:3001/api/search \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"query":"2 bedroom apartment near Central Park under $400k"}'

# Get property details
curl -X GET http://localhost:3001/api/properties/PROPERTY_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Health Checks
```bash
# API health
curl http://localhost:3001/health

# Embedding service health
curl http://localhost:8001/health

# Metrics
curl http://localhost:3001/metrics
```

## 🔧 Development Guidelines

### Code Style
- **TypeScript**: Strict mode enabled
- **ESLint**: Airbnb configuration
- **Prettier**: Automatic formatting
- **Husky**: Pre-commit hooks

### Testing Strategy
- **Unit Tests**: Jest/Vitest (>90% coverage)
- **Integration Tests**: Supertest for API
- **E2E Tests**: Playwright
- **Performance Tests**: Artillery/K6

### Git Workflow
```bash
# Feature development
git checkout -b feature/new-feature
git commit -m "feat: add new feature"
git push origin feature/new-feature

# Create pull request
# After review and approval, merge to develop
# Release from main branch
```

### Database Migrations
```bash
# Create migration
npm run migration:create -- --name add_new_table

# Run migrations
npm run migration:run

# Rollback migration
npm run migration:rollback
```

## 📊 Monitoring & Observability

### Key Metrics
- **Application Performance**: Response times, error rates
- **Business Metrics**: User engagement, search success rates
- **Infrastructure**: CPU, memory, disk usage
- **Security**: Failed login attempts, API abuse

### Dashboards
- **Application Overview**: General health and performance
- **Business Metrics**: User engagement and conversion
- **Infrastructure**: System resources and capacity
- **Security**: Authentication and access patterns

### Alerting
- **Critical**: Service downtime, database issues
- **Warning**: High latency, resource usage
- **Info**: Deployment notifications, scheduled maintenance

## 🔒 Security Considerations

### Data Protection
- **Encryption**: TLS 1.3 for data in transit
- **Database**: Encrypted at rest
- **Secrets**: Environment variables, never in code
- **PII**: Minimal collection, secure handling

### Access Control
- **Authentication**: JWT with short expiry
- **Authorization**: Role-based permissions
- **API Keys**: Scoped permissions, rate limited
- **Network**: Firewall rules, VPN access

### Compliance
- **GDPR**: Data privacy and user rights
- **OWASP**: Security best practices
- **SOC 2**: Security and availability controls

## 🐛 Troubleshooting

### Common Issues

#### Database Connection
```bash
# Check database status
docker logs moov-postgres

# Test connection
docker exec -it moov-postgres psql -U moov_user -d moov_db
```

#### Redis Connection
```bash
# Check Redis status
docker logs moov-redis-master

# Test connection
docker exec -it moov-redis-master redis-cli ping
```

#### High Memory Usage
```bash
# Check container memory
docker stats

# Restart services
docker compose restart api embedding-1
```

### Log Analysis
```bash
# Application logs
docker logs moov-api --tail 100 -f

# System logs
journalctl -u docker -f

# Grafana logs
docker logs moov-grafana --tail 50
```

## 📞 Support & Contact

### Development Team
- **Backend Lead**: backend@moov-property.com
- **Frontend Lead**: frontend@moov-property.com
- **DevOps Lead**: devops@moov-property.com
- **Security Team**: security@moov-property.com

### Communication Channels
- **Slack**: #moov-development, #moov-support
- **Email**: dev-team@moov-property.com
- **Issues**: GitHub Issues
- **Documentation**: https://docs.moov-property.com

### Emergency Contacts
- **Production Issues**: emergency@moov-property.com
- **Security Incidents**: security-emergency@moov-property.com
- **On-call**: +1-555-MOOV-911

## 📄 License & Legal

### License
This project is proprietary software owned by Moov Property Search. All rights reserved.

### Third-Party Licenses
- See `THIRD_PARTY_LICENSES.md` for open source dependencies
- All third-party software used in compliance with respective licenses

### Data Privacy
- Privacy Policy: https://moov-property.com/privacy
- Terms of Service: https://moov-property.com/terms
- GDPR Compliance: https://moov-property.com/gdpr

---

## 🔄 Document Updates

This documentation is actively maintained. Last updated: January 2024

For documentation updates or corrections, please:
1. Create an issue in the GitHub repository
2. Submit a pull request with changes
3. Contact the documentation team: docs@moov-property.com

---

**Happy coding! 🚀**