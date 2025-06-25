# CI/CD Pipeline and Monitoring Setup - Complete Implementation

Let's add automated testing, deployment, and comprehensive monitoring to our system.

## GitHub Actions CI/CD Pipeline

### Main Workflow

Create `.github/workflows/main.yml`:

```yaml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  # Shared setup job
  setup:
    runs-on: ubuntu-latest
    outputs:
      version: ${{ steps.version.outputs.version }}
    steps:
      - uses: actions/checkout@v4
      
      - name: Generate version
        id: version
        run: |
          if [[ "${{ github.ref }}" == "refs/heads/main" ]]; then
            echo "version=$(date +%Y.%m.%d)-${{ github.run_number }}" >> $GITHUB_OUTPUT
          else
            echo "version=dev-${{ github.sha }}" >> $GITHUB_OUTPUT
          fi

  # Frontend tests
  test-frontend:
    runs-on: ubuntu-latest
    needs: setup
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
          cache-dependency-path: property-search-frontend/package-lock.json
      
      - name: Install dependencies
        working-directory: ./property-search-frontend
        run: npm ci
      
      - name: Run linting
        working-directory: ./property-search-frontend
        run: npm run lint
      
      - name: Run type checking
        working-directory: ./property-search-frontend
        run: npm run type-check
      
      - name: Run tests with coverage
        working-directory: ./property-search-frontend
        run: npm run test:coverage
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          file: ./property-search-frontend/coverage/lcov.info
          flags: frontend
      
      - name: Build application
        working-directory: ./property-search-frontend
        run: npm run build

  # API tests
  test-api:
    runs-on: ubuntu-latest
    needs: setup
    services:
      postgres:
        image: pgvector/pgvector:pg15
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: test_db
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432
      
      redis:
        image: redis:7-alpine
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 6379:6379
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
          cache-dependency-path: property-search-api/package-lock.json
      
      - name: Install dependencies
        working-directory: ./property-search-api
        run: npm ci
      
      - name: Run linting
        working-directory: ./property-search-api
        run: npm run lint
      
      - name: Run type checking
        working-directory: ./property-search-api
        run: npm run type-check
      
      - name: Run tests with coverage
        working-directory: ./property-search-api
        env:
          NODE_ENV: test
          DATABASE_URL: postgresql://test:test@localhost:5432/test_db
          REDIS_URL: redis://localhost:6379
          JWT_SECRET: test-secret-key-with-at-least-32-characters
          EMBEDDING_SERVICE_URL: http://localhost:8001
          FRONTEND_URL: http://localhost:3000
        run: npm run test:coverage
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          file: ./property-search-api/coverage/lcov.info
          flags: api
      
      - name: Build application
        working-directory: ./property-search-api
        run: npm run build

  # Embedding service tests
  test-embedding:
    runs-on: ubuntu-latest
    needs: setup
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'
          cache: 'pip'
          cache-dependency-path: property-embedding-service/requirements.txt
      
      - name: Install dependencies
        working-directory: ./property-embedding-service
        run: |
          pip install -r requirements.txt
          pip install pytest pytest-cov pytest-asyncio black isort mypy
      
      - name: Run linting
        working-directory: ./property-embedding-service
        run: |
          black --check src/
          isort --check-only src/
          mypy src/
      
      - name: Run tests with coverage
        working-directory: ./property-embedding-service
        run: |
          pytest --cov=src --cov-report=xml --cov-report=term tests/
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          file: ./property-embedding-service/coverage.xml
          flags: embedding

  # Security scanning
  security:
    runs-on: ubuntu-latest
    needs: setup
    steps:
      - uses: actions/checkout@v4
      
      - name: Run Trivy vulnerability scanner
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: 'fs'
          scan-ref: '.'
          format: 'sarif'
          output: 'trivy-results.sarif'
      
      - name: Upload Trivy scan results
        uses: github/codeql-action/upload-sarif@v2
        with:
          sarif_file: 'trivy-results.sarif'
      
      - name: Run npm audit
        run: |
          cd property-search-frontend && npm audit --production
          cd ../property-search-api && npm audit --production

  # Build and push Docker images
  build:
    runs-on: ubuntu-latest
    needs: [test-frontend, test-api, test-embedding, security]
    if: github.event_name == 'push'
    permissions:
      contents: read
      packages: write
    strategy:
      matrix:
        service: [frontend, api, embedding]
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3
      
      - name: Log in to GitHub Container Registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      
      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}-${{ matrix.service }}
          tags: |
            type=ref,event=branch
            type=ref,event=pr
            type=semver,pattern={{version}}
            type=raw,value=${{ needs.setup.outputs.version }}
      
      - name: Build and push Docker image
        uses: docker/build-push-action@v5
        with:
          context: ./property-search-${{ matrix.service }}
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
          build-args: |
            VERSION=${{ needs.setup.outputs.version }}

  # Deploy to staging
  deploy-staging:
    runs-on: ubuntu-latest
    needs: [build, setup]
    if: github.ref == 'refs/heads/develop'
    environment: staging
    steps:
      - uses: actions/checkout@v4
      
      - name: Deploy to staging
        env:
          STAGING_HOST: ${{ secrets.STAGING_HOST }}
          STAGING_USER: ${{ secrets.STAGING_USER }}
          STAGING_KEY: ${{ secrets.STAGING_KEY }}
        run: |
          echo "$STAGING_KEY" > deploy_key
          chmod 600 deploy_key
          
          ssh -o StrictHostKeyChecking=no -i deploy_key $STAGING_USER@$STAGING_HOST << 'EOF'
            cd /opt/moov-staging
            docker compose pull
            docker compose up -d --remove-orphans
            docker system prune -f
          EOF

  # Deploy to production
  deploy-production:
    runs-on: ubuntu-latest
    needs: [build, setup]
    if: github.ref == 'refs/heads/main'
    environment: production
    steps:
      - uses: actions/checkout@v4
      
      - name: Deploy to production
        env:
          PROD_HOST: ${{ secrets.PROD_HOST }}
          PROD_USER: ${{ secrets.PROD_USER }}
          PROD_KEY: ${{ secrets.PROD_KEY }}
        run: |
          echo "$PROD_KEY" > deploy_key
          chmod 600 deploy_key
          
          ssh -o StrictHostKeyChecking=no -i deploy_key $PROD_USER@$PROD_HOST << 'EOF'
            cd /opt/moov-production
            
            # Blue-green deployment
            export NEW_COLOR=$(docker compose ps -q frontend-blue > /dev/null && echo "green" || echo "blue")
            export OLD_COLOR=$([ "$NEW_COLOR" = "green" ] && echo "blue" || echo "green")
            
            # Deploy new version
            docker compose up -d frontend-$NEW_COLOR api-$NEW_COLOR embedding-$NEW_COLOR
            
            # Health checks
            sleep 30
            curl -f http://frontend-$NEW_COLOR:3000/health || exit 1
            curl -f http://api-$NEW_COLOR:3001/health || exit 1
            
            # Switch traffic
            docker compose up -d traefik
            
            # Stop old version
            docker compose stop frontend-$OLD_COLOR api-$OLD_COLOR embedding-$OLD_COLOR
            docker compose rm -f frontend-$OLD_COLOR api-$OLD_COLOR embedding-$OLD_COLOR
            
            # Cleanup
            docker system prune -f
          EOF

  # E2E tests
  e2e-tests:
    runs-on: ubuntu-latest
    needs: deploy-staging
    if: github.ref == 'refs/heads/develop'
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
      
      - name: Install Playwright
        run: |
          npm install -g @playwright/test
          npx playwright install --with-deps
      
      - name: Run E2E tests
        env:
          BASE_URL: ${{ secrets.STAGING_URL }}
        run: |
          cd e2e-tests
          npm install
          npm run test
      
      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: e2e-tests/playwright-report/
```

## Monitoring Setup

### Prometheus Configuration

Create `prometheus.yml`:

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

alerting:
  alertmanagers:
    - static_configs:
        - targets: ['alertmanager:9093']

rule_files:
  - '/etc/prometheus/alerts/*.yml'

scrape_configs:
  # API metrics
  - job_name: 'api'
    static_configs:
      - targets: ['api:3001']
    metrics_path: '/metrics'

  # Embedding service metrics
  - job_name: 'embedding'
    static_configs:
      - targets: 
          - 'embedding-1:8001'
          - 'embedding-2:8001'
    metrics_path: '/metrics'

  # Node exporter for system metrics
  - job_name: 'node'
    static_configs:
      - targets: ['node-exporter:9100']

  # PostgreSQL exporter
  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres-exporter:9187']

  # Redis exporter
  - job_name: 'redis'
    static_configs:
      - targets: ['redis-exporter:9121']

  # Traefik metrics
  - job_name: 'traefik'
    static_configs:
      - targets: ['traefik:8080']
```

### Alert Rules

Create `alerts/application.yml`:

```yaml
groups:
  - name: application
    interval: 30s
    rules:
      # API alerts
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
          description: "Error rate is {{ $value | humanizePercentage }} for the last 5 minutes"

      - alert: APIHighLatency
        expr: |
          histogram_quantile(0.95,
            sum(rate(http_request_duration_seconds_bucket{job="api"}[5m])) by (le)
          ) > 1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High API latency"
          description: "95th percentile latency is {{ $value }}s"

      # Embedding service alerts
      - alert: EmbeddingServiceDown
        expr: up{job="embedding"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Embedding service is down"
          description: "{{ $labels.instance }} has been down for more than 1 minute"

      - alert: EmbeddingHighFailureRate
        expr: |
          rate(embedding_errors_total[5m]) > 0.1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High embedding failure rate"
          description: "Embedding error rate is {{ $value }} per second"

      # Database alerts
      - alert: DatabaseConnectionPoolExhausted
        expr: |
          pg_stat_database_numbackends{datname="moov_db"} 
          / 
          pg_settings_max_connections > 0.8
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Database connection pool nearly exhausted"
          description: "{{ $value | humanizePercentage }} of connections are in use"

      - alert: DatabaseHighQueryTime
        expr: |
          avg(pg_stat_statements_mean_exec_time_seconds) > 0.5
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Database queries are slow"
          description: "Average query time is {{ $value }}s"

      # Redis alerts
      - alert: RedisHighMemoryUsage
        expr: |
          redis_memory_used_bytes / redis_memory_max_bytes > 0.8
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Redis memory usage is high"
          description: "Redis is using {{ $value | humanizePercentage }} of available memory"

      # System alerts
      - alert: HighCPUUsage
        expr: |
          (1 - avg(rate(node_cpu_seconds_total{mode="idle"}[5m]))) > 0.8
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "High CPU usage"
          description: "CPU usage is {{ $value | humanizePercentage }}"

      - alert: HighMemoryUsage
        expr: |
          (1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) > 0.8
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "High memory usage"
          description: "Memory usage is {{ $value | humanizePercentage }}"

      - alert: DiskSpaceLow
        expr: |
          (1 - (node_filesystem_avail_bytes{mountpoint="/"} / node_filesystem_size_bytes{mountpoint="/"})) > 0.8
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Low disk space"
          description: "Disk usage is {{ $value | humanizePercentage }}"
```

### Grafana Dashboards

Create `grafana-dashboards/moov-overview.json`:

```json
{
  "dashboard": {
    "title": "Moov Platform Overview",
    "panels": [
      {
        "title": "Request Rate",
        "targets": [
          {
            "expr": "sum(rate(http_requests_total{job=\"api\"}[5m])) by (method)",
            "legendFormat": "{{method}}"
          }
        ],
        "type": "graph",
        "gridPos": { "h": 8, "w": 12, "x": 0, "y": 0 }
      },
      {
        "title": "Error Rate",
        "targets": [
          {
            "expr": "sum(rate(http_requests_total{job=\"api\",status=~\"5..\"}[5m])) / sum(rate(http_requests_total{job=\"api\"}[5m]))",
            "legendFormat": "Error Rate"
          }
        ],
        "type": "graph",
        "gridPos": { "h": 8, "w": 12, "x": 12, "y": 0 }
      },
      {
        "title": "Response Time (p95)",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket{job=\"api\"}[5m])) by (le))",
            "legendFormat": "95th percentile"
          }
        ],
        "type": "graph",
        "gridPos": { "h": 8, "w": 12, "x": 0, "y": 8 }
      },
      {
        "title": "Active Searches",
        "targets": [
          {
            "expr": "sum(rate(embedding_requests_total[5m]))",
            "legendFormat": "Searches/sec"
          }
        ],
        "type": "stat",
        "gridPos": { "h": 8, "w": 6, "x": 12, "y": 8 }
      },
      {
        "title": "Cache Hit Rate",
        "targets": [
          {
            "expr": "sum(rate(cache_hits_total[5m])) / (sum(rate(cache_hits_total[5m])) + sum(rate(cache_misses_total[5m])))",
            "legendFormat": "Hit Rate"
          }
        ],
        "type": "gauge",
        "gridPos": { "h": 8, "w": 6, "x": 18, "y": 8 }
      },
      {
        "title": "Database Connections",
        "targets": [
          {
            "expr": "pg_stat_database_numbackends{datname=\"moov_db\"}",
            "legendFormat": "Active Connections"
          }
        ],
        "type": "graph",
        "gridPos": { "h": 8, "w": 12, "x": 0, "y": 16 }
      },
      {
        "title": "System Resources",
        "targets": [
          {
            "expr": "(1 - avg(rate(node_cpu_seconds_total{mode=\"idle\"}[5m])))",
            "legendFormat": "CPU Usage"
          },
          {
            "expr": "(1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes))",
            "legendFormat": "Memory Usage"
          }
        ],
        "type": "graph",
        "gridPos": { "h": 8, "w": 12, "x": 12, "y": 16 }
      }
    ]
  }
}
```

### Create Semantic Search Dashboard

Create `grafana-dashboards/semantic-search.json`:

```json
{
  "dashboard": {
    "title": "Semantic Search Performance",
    "panels": [
      {
        "title": "Embedding Service Health",
        "targets": [
          {
            "expr": "up{job=\"embedding\"}",
            "legendFormat": "{{instance}}"
          }
        ],
        "type": "stat",
        "gridPos": { "h": 4, "w": 24, "x": 0, "y": 0 }
      },
      {
        "title": "Search Latency Distribution",
        "targets": [
          {
            "expr": "histogram_quantile(0.5, sum(rate(embedding_duration_seconds_bucket[5m])) by (le))",
            "legendFormat": "p50"
          },
          {
            "expr": "histogram_quantile(0.95, sum(rate(embedding_duration_seconds_bucket[5m])) by (le))",
            "legendFormat": "p95"
          },
          {
            "expr": "histogram_quantile(0.99, sum(rate(embedding_duration_seconds_bucket[5m])) by (le))",
            "legendFormat": "p99"
          }
        ],
        "type": "graph",
        "gridPos": { "h": 8, "w": 12, "x": 0, "y": 4 }
      },
      {
        "title": "Model Usage",
        "targets": [
          {
            "expr": "sum(rate(embedding_requests_total[5m])) by (model)",
            "legendFormat": "{{model}}"
          }
        ],
        "type": "piechart",
        "gridPos": { "h": 8, "w": 12, "x": 12, "y": 4 }
      },
      {
        "title": "Cache Performance",
        "targets": [
          {
            "expr": "sum(rate(cache_hits_total[5m]))",
            "legendFormat": "Cache Hits"
          },
          {
            "expr": "sum(rate(cache_misses_total[5m]))",
            "legendFormat": "Cache Misses"
          }
        ],
        "type": "graph",
        "gridPos": { "h": 8, "w": 12, "x": 0, "y": 12 }
      },
      {
        "title": "Search Query Analysis",
        "type": "table",
        "targets": [
          {
            "expr": "topk(10, sum by (query) (rate(search_queries_total[1h])))",
            "format": "table"
          }
        ],
        "gridPos": { "h": 8, "w": 12, "x": 12, "y": 12 }
      }
    ]
  }
}
```

## Logging Setup with ELK Stack

Add to `docker-compose.production.yml`:

```yaml
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.11.0
    container_name: moov-elasticsearch
    environment:
      - discovery.type=single-node
      - "ES_JAVA_OPTS=-Xms512m -Xmx512m"
      - xpack.security.enabled=false
    volumes:
      - elasticsearch_data:/usr/share/elasticsearch/data
    networks:
      - moov-network

  logstash:
    image: docker.elastic.co/logstash/logstash:8.11.0
    container_name: moov-logstash
    volumes:
      - ./logstash.conf:/usr/share/logstash/pipeline/logstash.conf
    environment:
      - "LS_JAVA_OPTS=-Xmx256m -Xms256m"
    networks:
      - moov-network
    depends_on:
      - elasticsearch

  kibana:
    image: docker.elastic.co/kibana/kibana:8.11.0
    container_name: moov-kibana
    environment:
      - ELASTICSEARCH_HOSTS=http://elasticsearch:9200
    networks:
      - moov-network
    depends_on:
      - elasticsearch
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.kibana.rule=Host(`logs.moov.com`)"
      - "traefik.http.routers.kibana.entrypoints=websecure"
      - "traefik.http.routers.kibana.tls.certresolver=letsencrypt"
      - "traefik.http.services.kibana.loadbalancer.server.port=5601"

  filebeat:
    image: docker.elastic.co/beats/filebeat:8.11.0
    container_name: moov-filebeat
    user: root
    volumes:
      - ./filebeat.yml:/usr/share/filebeat/filebeat.yml:ro
      - /var/lib/docker/containers:/var/lib/docker/containers:ro
      - /var/run/docker.sock:/var/run/docker.sock:ro
    networks:
      - moov-network
    depends_on:
      - logstash
```

### Logstash Configuration

Create `logstash.conf`:

```conf
input {
  beats {
    port => 5044
  }
}

filter {
  if [docker][container][name] =~ /^moov-/ {
    # Parse JSON logs
    json {
      source => "message"
      target => "log"
    }

    # Extract fields based on service
    if [docker][container][name] =~ /moov-api/ {
      mutate {
        add_field => { "service" => "api" }
      }
    } else if [docker][container][name] =~ /moov-frontend/ {
      mutate {
        add_field => { "service" => "frontend" }
      }
    } else if [docker][container][name] =~ /moov-embedding/ {
      mutate {
        add_field => { "service" => "embedding" }
      }
    }

    # Parse log level
    if [log][level] {
      mutate {
        add_field => { "log_level" => "%{[log][level]}" }
      }
    }

    # Parse HTTP logs
    if [log][method] and [log][path] {
      mutate {
        add_field => {
          "http_method" => "%{[log][method]}"
          "http_path" => "%{[log][path]}"
          "http_status" => "%{[log][status]}"
          "http_duration" => "%{[log][duration]}"
        }
      }
    }

    # Parse search queries
    if [log][search_query] {
      mutate {
        add_field => {
          "search_query" => "%{[log][search_query]}"
          "search_results" => "%{[log][results_count]}"
          "search_duration" => "%{[log][search_duration]}"
        }
      }
    }
  }

  # Add geographic IP information
  if [log][ip] {
    geoip {
      source => "[log][ip]"
      target => "geoip"
    }
  }

  # Remove unnecessary fields
  mutate {
    remove_field => ["message", "host", "agent"]
  }
}

output {
  elasticsearch {
    hosts => ["elasticsearch:9200"]
    index => "moov-%{service}-%{+YYYY.MM.dd}"
  }
}
```

### Filebeat Configuration

Create `filebeat.yml`:

```yaml
filebeat.inputs:
  - type: container
    paths:
      - '/var/lib/docker/containers/*/*.log'
    processors:
      - add_docker_metadata:
          host: "unix:///var/run/docker.sock"
      - decode_json_fields:
          fields: ["message"]
          target: ""
          overwrite_keys: true

output.logstash:
  hosts: ["logstash:5044"]

logging.level: info
logging.to_files: true
logging.files:
  path: /var/log/filebeat
  name: filebeat
  keepfiles: 7
  permissions: 0644
```

## Application Metrics Implementation

### API Metrics Middleware

Create `property-search-api/src/middleware/metrics.ts`:

```typescript
import { Request, Response, NextFunction } from 'express';
import promClient from 'prom-client';

// Create metrics
const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.1, 0.5, 1, 2, 5],
});

const httpRequestsTotal = new promClient.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status'],
});

const activeRequests = new promClient.Gauge({
  name: 'http_requests_active',
  help: 'Number of active HTTP requests',
});

// Database metrics
const dbQueryDuration = new promClient.Histogram({
  name: 'db_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  labelNames: ['operation', 'table'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1],
});

const dbConnectionsActive = new promClient.Gauge({
  name: 'db_connections_active',
  help: 'Number of active database connections',
});

// Search metrics
const searchQueries = new promClient.Counter({
  name: 'search_queries_total',
  help: 'Total number of search queries',
  labelNames: ['type'],
});

const searchResultsCount = new promClient.Histogram({
  name: 'search_results_count',
  help: 'Number of results returned per search',
  buckets: [0, 1, 5, 10, 20, 50, 100],
});

// Middleware
export const metricsMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  activeRequests.inc();

  // Capture route pattern
  const route = req.route?.path || req.path;

  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const labels = {
      method: req.method,
      route,
      status: res.statusCode.toString(),
    };

    httpRequestDuration.observe(labels, duration);
    httpRequestsTotal.inc(labels);
    activeRequests.dec();

    // Log for analysis
    console.log(JSON.stringify({
      type: 'http_request',
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      timestamp: new Date().toISOString(),
    }));
  });

  next();
};

// Metrics endpoint
export const metricsHandler = async (req: Request, res: Response) => {
  res.set('Content-Type', promClient.register.contentType);
  const metrics = await promClient.register.metrics();
  res.end(metrics);
};

// Export metrics for use in other modules
export const metrics = {
  dbQueryDuration,
  dbConnectionsActive,
  searchQueries,
  searchResultsCount,
};
```

## Health Check Endpoints

### API Health Check

Create `property-search-api/src/routes/health.ts`:

```typescript
import { Router, Request, Response } from 'express';
import { DatabaseService } from '@/lib/database';
import { getEnv } from '@/config/env';

interface HealthCheckResult {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  uptime: number;
  checks: {
    database: boolean;
    redis: boolean;
    embedding: boolean;
  };
  version: string;
}

export const createHealthRouter = (database: DatabaseService): Router => {
  const router = Router();
  const startTime = Date.now();

  router.get('/health', async (req: Request, res: Response) => {
    const health: HealthCheckResult = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: (Date.now() - startTime) / 1000,
      checks: {
        database: false,
        redis: false,
        embedding: false,
      },
      version: process.env.VERSION || 'unknown',
    };

    // Check database
    try {
      const dbHealthy = await database.healthCheck();
      health.checks.database = dbHealthy;
    } catch (error) {
      health.checks.database = false;
      health.status = 'unhealthy';
    }

    // Check Redis
    try {
      const redis = await import('@/lib/redis');
      await redis.client.ping();
      health.checks.redis = true;
    } catch (error) {
      health.checks.redis = false;
    }

    // Check embedding service
    try {
      const env = getEnv();
      const response = await fetch(`${env.EMBEDDING_SERVICE_URL}/health`);
      health.checks.embedding = response.ok;
    } catch (error) {
      health.checks.embedding = false;
    }

    const statusCode = health.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(health);
  });

  router.get('/ready', async (req: Request, res: Response) => {
    // More thorough readiness check
    try {
      await database.query('SELECT 1');
      res.status(200).json({ ready: true });
    } catch (error) {
      res.status(503).json({ ready: false });
    }
  });

  return router;
};
```

## Performance Monitoring Script

Create `scripts/performance-test.js`:

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '2m', target: 50 },  // Ramp up to 50 users
    { duration: '5m', target: 50 },  // Stay at 50 users
    { duration: '2m', target: 100 }, // Ramp up to 100 users
    { duration: '5m', target: 100 }, // Stay at 100 users
    { duration: '2m', target: 0 },   // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000'], // 95% of requests must complete below 1s
    errors: ['rate<0.1'],              // Error rate must be below 10%
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';

const searchQueries = [
  'Modern flat near tube station',
  'Family home with garden',
  'Studio apartment in city center',
  'Victorian house needing renovation',
  'New build with parking',
  'Pet-friendly apartment',
  'Luxury penthouse with views',
  'Affordable starter home',
];

export default function () {
  // Random search query
  const query = searchQueries[Math.floor(Math.random() * searchQueries.length)];
  
  // Search request
  const searchRes = http.post(
    `${BASE_URL}/api/properties/search`,
    JSON.stringify({
      query: query,
      filters: {
        maxPrice: 500000,
        minBedrooms: Math.floor(Math.random() * 3) + 1,
      },
    }),
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );

  check(searchRes, {
    'search status is 200': (r) => r.status === 200,
    'search response time < 1s': (r) => r.timings.duration < 1000,
    'search returns results': (r) => {
      const body = JSON.parse(r.body);
      return body.data && body.data.properties;
    },
  });

  errorRate.add(searchRes.status !== 200);

  // If search was successful, get a property detail
  if (searchRes.status === 200) {
    const body = JSON.parse(searchRes.body);
    if (body.data.properties.length > 0) {
      const propertyId = body.data.properties[0].id;
      
      const detailRes = http.get(`${BASE_URL}/api/properties/${propertyId}`);
      
      check(detailRes, {
        'property detail status is 200': (r) => r.status === 200,
        'property detail response time < 500ms': (r) => r.timings.duration < 500,
      });

      errorRate.add(detailRes.status !== 200);
    }
  }

  sleep(1);
}
```

## Summary

We've now added comprehensive CI/CD and monitoring:

### CI/CD Pipeline Features:
1. ✅ **Automated Testing** - Frontend, API, and embedding service tests
2. ✅ **Security Scanning** - Trivy and npm audit
3. ✅ **Docker Build & Push** - Automated image building
4. ✅ **Blue-Green Deployment** - Zero-downtime deployments
5. ✅ **E2E Testing** - Playwright tests on staging

### Monitoring Features:
1. ✅ **Metrics Collection** - Prometheus with custom metrics
2. ✅ **Visual Dashboards** - Grafana dashboards for all services
3. ✅ **Alerting Rules** - Comprehensive alerts for issues
4. ✅ **Log Aggregation** - ELK stack for centralized logging
5. ✅ **Performance Testing** - k6 load testing scripts
6. ✅ **Health Checks** - Readiness and liveness probes

The system now has:
- **Complete observability** into performance and errors
- **Automated deployment** with safety checks
- **Real-time alerts** for issues
- **Performance benchmarking** capabilities
- **Centralized logging** for debugging

This completes a production-ready, enterprise-grade property search platform with professional monitoring and deployment automation!