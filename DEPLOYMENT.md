# 🚀 Moov Property Search Platform - Deployment Guide

This guide covers production deployment of the Moov Property Search Platform with all its AI-powered features.

## 📋 Prerequisites

### Infrastructure Requirements
- **Server**: Linux server with 16GB+ RAM, 4+ CPU cores
- **Database**: PostgreSQL 15+ with pgvector extension
- **Cache**: Redis 7+ for session and embedding cache
- **Docker**: Docker & Docker Compose for containerization
- **SSL**: Valid SSL certificate (Let's Encrypt recommended)

### Accounts & Services
- **Domain**: Registered domain name
- **Neon**: PostgreSQL database (or self-hosted)
- **Redis Cloud**: Redis hosting (or self-hosted)
- **GitHub**: Repository access
- **Docker Hub**: Container registry (optional)

## 🏗️ Architecture Overview

```
[Load Balancer/Nginx] ← SSL Termination
         │
    [Frontend - Next.js]
         │
    [API Gateway - Node.js]
         │
    ┌────┴────┬────────────┬─────────────┐
    │         │            │             │
[Database]  [Cache]   [AI Service]  [Monitoring]
PostgreSQL   Redis      Python       Prometheus
+ pgvector            FastAPI        + Grafana
```

## 🔧 Step 1: Server Setup

### 1.1 Update System
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install curl wget git nginx certbot python3-certbot-nginx
```

### 1.2 Install Docker
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
```

### 1.3 Install Docker Compose
```bash
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

## 🗄️ Step 2: Database Setup

### 2.1 PostgreSQL with pgvector (Option A - Neon Cloud)
```bash
# Create account at https://neon.tech
# Create database with pgvector extension
# Copy connection string
```

### 2.2 Self-Hosted PostgreSQL (Option B)
```bash
# Create docker-compose.override.yml
version: '3.8'
services:
  postgres:
    image: pgvector/pgvector:pg15
    environment:
      POSTGRES_DB: moov_production
      POSTGRES_USER: moov_prod
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./property-search-api/migrations:/docker-entrypoint-initdb.d
    ports:
      - "5432:5432"
    restart: unless-stopped

volumes:
  postgres_data:
```

## 📦 Step 3: Application Deployment

### 3.1 Clone Repository
```bash
cd /opt
sudo git clone https://github.com/your-username/Moov-Sonnet4.git
sudo chown -R $USER:$USER Moov-Sonnet4
cd Moov-Sonnet4
```

### 3.2 Environment Configuration
```bash
# Copy and configure environment files
cp .env.example .env

# Edit production environment
sudo nano .env
```

Production `.env`:
```env
# Environment
NODE_ENV=production

# Database
DATABASE_URL=postgresql://user:password@host:5432/database
POSTGRES_USER=moov_prod
POSTGRES_PASSWORD=your_secure_password_here
POSTGRES_DB=moov_production

# Redis
REDIS_URL=redis://redis:6379
REDIS_HOST=redis
REDIS_PORT=6379

# API Configuration
API_PORT=8000
JWT_SECRET=your_super_secure_jwt_secret_key_at_least_32_characters_long

# Frontend
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
FRONTEND_URL=https://yourdomain.com

# AI Service
EMBEDDING_SERVICE_URL=http://embedding-primary:8001
EMBEDDING_SERVICE_BACKUP_URL=http://embedding-secondary:8002

# Security
CORS_ORIGIN=https://yourdomain.com

# Monitoring
GRAFANA_PASSWORD=your_grafana_password
```

### 3.3 Build and Deploy
```bash
# Build all services
docker-compose -f docker-compose.production.yml build

# Start services
docker-compose -f docker-compose.production.yml up -d

# Check status
docker-compose -f docker-compose.production.yml ps
```

## 🌐 Step 4: Nginx Configuration

### 4.1 Create Nginx Config
```bash
sudo nano /etc/nginx/sites-available/moov-platform
```

```nginx
# Frontend
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}

# API
server {
    listen 80;
    server_name api.yourdomain.com;
    
    location / {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Enable CORS
        add_header Access-Control-Allow-Origin https://yourdomain.com;
        add_header Access-Control-Allow-Methods 'GET, POST, PUT, DELETE, OPTIONS';
        add_header Access-Control-Allow-Headers 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization';
    }
}

# Monitoring
server {
    listen 80;
    server_name monitoring.yourdomain.com;
    
    auth_basic "Monitoring";
    auth_basic_user_file /etc/nginx/.htpasswd;
    
    location /grafana/ {
        proxy_pass http://localhost:3002/;
    }
    
    location /prometheus/ {
        proxy_pass http://localhost:9090/;
    }
}
```

### 4.2 Enable Site
```bash
sudo ln -s /etc/nginx/sites-available/moov-platform /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## 🔒 Step 5: SSL Setup

### 5.1 Install SSL Certificates
```bash
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
sudo certbot --nginx -d api.yourdomain.com
sudo certbot --nginx -d monitoring.yourdomain.com
```

### 5.2 Auto-Renewal
```bash
sudo crontab -e
# Add line:
0 12 * * * /usr/bin/certbot renew --quiet
```

## 📊 Step 6: Monitoring Setup

### 6.1 Create Monitoring Password
```bash
sudo apt install apache2-utils
sudo htpasswd -c /etc/nginx/.htpasswd admin
```

### 6.2 Configure Prometheus
```bash
# Create prometheus.yml
cat > prometheus.yml << EOF
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'moov-api'
    static_configs:
      - targets: ['api:8000']
    
  - job_name: 'moov-embedding'
    static_configs:
      - targets: ['embedding-primary:8001', 'embedding-secondary:8002']
    
  - job_name: 'moov-frontend'
    static_configs:
      - targets: ['frontend:3000']
EOF
```

## 🚦 Step 7: Health Checks

### 7.1 Service Health Check Script
```bash
cat > health-check.sh << 'EOF'
#!/bin/bash

echo "🔍 Moov Platform Health Check"
echo "============================="

# Check Docker services
echo "🐳 Docker Services:"
docker-compose -f docker-compose.production.yml ps

# Check endpoints
echo -e "\n🌐 Service Endpoints:"

# Frontend
if curl -f -s http://localhost:3000 > /dev/null; then
    echo "✅ Frontend: Running"
else
    echo "❌ Frontend: Down"
fi

# API
if curl -f -s http://localhost:8000/health > /dev/null; then
    echo "✅ API: Running" 
else
    echo "❌ API: Down"
fi

# AI Service
if curl -f -s http://localhost:8001/health > /dev/null; then
    echo "✅ AI Service: Running"
else
    echo "❌ AI Service: Down"
fi

# Database
if docker-compose -f docker-compose.production.yml exec -T postgres pg_isready > /dev/null; then
    echo "✅ Database: Running"
else
    echo "❌ Database: Down"
fi

# Redis
if docker-compose -f docker-compose.production.yml exec -T redis-master redis-cli ping > /dev/null; then
    echo "✅ Redis: Running"
else
    echo "❌ Redis: Down"
fi

echo -e "\n📊 System Resources:"
echo "CPU: $(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)% used"
echo "Memory: $(free | grep Mem | awk '{printf "%.1f%%", $3/$2 * 100.0}')"
echo "Disk: $(df -h | grep '/$' | awk '{print $5}')"
EOF

chmod +x health-check.sh
```

### 7.2 Set up Cron for Regular Health Checks
```bash
crontab -e
# Add:
*/5 * * * * /opt/Moov-Sonnet4/health-check.sh >> /var/log/moov-health.log 2>&1
```

## 🔧 Step 8: Performance Optimization

### 8.1 Database Optimization
```sql
-- Connect to PostgreSQL and run:
-- Create indexes for better performance
CREATE INDEX CONCURRENTLY idx_properties_embedding_hnsw 
ON properties USING hnsw (embedding vector_cosine_ops) 
WITH (m = 16, ef_construction = 64);

-- Update statistics
ANALYZE properties;
```

### 8.2 Redis Configuration
```bash
# Add to redis.conf
maxmemory 2gb
maxmemory-policy allkeys-lru
tcp-keepalive 300
timeout 0
```

### 8.3 Nginx Optimization
```nginx
# Add to http block in /etc/nginx/nginx.conf
gzip on;
gzip_vary on;
gzip_min_length 1024;
gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;

# Enable caching
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

## 🔄 Step 9: Backup Strategy

### 9.1 Database Backup
```bash
cat > backup-db.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/opt/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="moov_db_backup_$TIMESTAMP.sql"

mkdir -p $BACKUP_DIR

docker-compose -f docker-compose.production.yml exec -T postgres \
  pg_dump -U moov_prod moov_production > "$BACKUP_DIR/$BACKUP_FILE"

# Compress backup
gzip "$BACKUP_DIR/$BACKUP_FILE"

# Keep only last 7 days of backups
find $BACKUP_DIR -name "moov_db_backup_*.sql.gz" -mtime +7 -delete

echo "Database backup completed: $BACKUP_FILE.gz"
EOF

chmod +x backup-db.sh

# Schedule daily backups
crontab -e
# Add:
0 2 * * * /opt/Moov-Sonnet4/backup-db.sh
```

### 9.2 Full System Backup
```bash
cat > backup-system.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/opt/backups/system"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Backup configuration files
tar czf "$BACKUP_DIR/config_$TIMESTAMP.tar.gz" \
  /opt/Moov-Sonnet4/.env \
  /opt/Moov-Sonnet4/docker-compose.production.yml \
  /etc/nginx/sites-available/moov-platform \
  /opt/Moov-Sonnet4/prometheus.yml

# Backup uploaded files (if any)
if [ -d "/opt/Moov-Sonnet4/uploads" ]; then
  tar czf "$BACKUP_DIR/uploads_$TIMESTAMP.tar.gz" /opt/Moov-Sonnet4/uploads
fi

echo "System backup completed: $TIMESTAMP"
EOF

chmod +x backup-system.sh
```

## 🔄 Step 10: Updates & Maintenance

### 10.1 Update Application
```bash
cat > update-app.sh << 'EOF'
#!/bin/bash
echo "🔄 Updating Moov Platform..."

cd /opt/Moov-Sonnet4

# Pull latest changes
git pull origin main

# Rebuild and restart services
docker-compose -f docker-compose.production.yml build --no-cache
docker-compose -f docker-compose.production.yml down
docker-compose -f docker-compose.production.yml up -d

# Run health check
./health-check.sh

echo "✅ Update completed!"
EOF

chmod +x update-app.sh
```

### 10.2 Log Rotation
```bash
sudo nano /etc/logrotate.d/moov-platform
```

```
/var/log/moov-*.log {
    daily
    missingok
    rotate 52
    compress
    notifempty
    create 644 root root
    postrotate
        docker-compose -f /opt/Moov-Sonnet4/docker-compose.production.yml restart api frontend > /dev/null 2>&1 || true
    endscript
}
```

## 🚨 Troubleshooting

### Common Issues

**Services won't start:**
```bash
# Check logs
docker-compose -f docker-compose.production.yml logs -f

# Check disk space
df -h

# Check memory
free -h
```

**Database connection issues:**
```bash
# Test database connection
docker-compose -f docker-compose.production.yml exec postgres psql -U moov_prod -d moov_production -c "SELECT 1;"
```

**SSL certificate issues:**
```bash
# Check certificate status
sudo certbot certificates

# Renew certificates
sudo certbot renew --dry-run
```

**High memory usage:**
```bash
# Restart services to clear memory
docker-compose -f docker-compose.production.yml restart

# Monitor memory usage
docker stats
```

## 📞 Support Contacts

- **Critical Issues**: admin@yourdomain.com
- **Monitoring**: https://monitoring.yourdomain.com
- **Status Page**: https://status.yourdomain.com

---

**Deployment completed! 🎉**

Your Moov Property Search Platform is now running in production with:
- ✅ SSL encryption
- ✅ Load balancing  
- ✅ Database clustering
- ✅ AI service redundancy
- ✅ Monitoring & alerting
- ✅ Automated backups
- ✅ Health checks