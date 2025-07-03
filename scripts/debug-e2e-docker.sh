#!/bin/bash

# E2E Testing Debug Script - Detailed logging and troubleshooting
# This script provides detailed debugging information for E2E test failures

set -e

echo "🔍 Starting E2E Testing Debug Session..."

# Create .env file
echo "📝 Creating .env file..."
cat > .env << EOF
POSTGRES_USER=moov
POSTGRES_PASSWORD=moov123
POSTGRES_DB=moov_db
JWT_SECRET=a_test_secret_for_ci_that_is_long_enough
FRONTEND_URL=http://localhost:3000
EOF

echo "✅ Environment file created"

# Clean up any existing containers
echo "🧹 Cleaning up existing containers..."
docker-compose -f docker-compose.e2e.yml down --remove-orphans --volumes 2>/dev/null || true

# Start the application stack with detailed logging
echo "🚀 Starting application stack with detailed logging..."
docker-compose -f docker-compose.e2e.yml up -d --build

echo "⏳ Waiting for containers to start..."
sleep 10

# Check container status
echo "📊 Container Status:"
docker-compose -f docker-compose.e2e.yml ps

echo ""
echo "🔍 Detailed Container Information:"
for container in e2e-postgres e2e-redis e2e-api e2e-embedding e2e-frontend; do
    echo "--- $container ---"
    if docker ps --format "table {{.Names}}\t{{.Status}}" | grep -q "$container"; then
        echo "Status: $(docker ps --format "{{.Status}}" --filter "name=$container")"
        echo "Health: $(docker inspect --format='{{.State.Health.Status}}' $container 2>/dev/null || echo 'No health check')"
    else
        echo "❌ Container not running"
    fi
    echo ""
done

# Show logs for each service
echo "📋 Service Logs:"
echo "=== PostgreSQL Logs ==="
docker logs e2e-postgres --tail 20 2>&1 || echo "No PostgreSQL logs"
echo ""

echo "=== Redis Logs ==="
docker logs e2e-redis --tail 20 2>&1 || echo "No Redis logs"
echo ""

echo "=== API Logs ==="
docker logs e2e-api --tail 30 2>&1 || echo "No API logs"
echo ""

echo "=== Embedding Service Logs ==="
docker logs e2e-embedding --tail 30 2>&1 || echo "No Embedding Service logs"
echo ""

echo "=== Frontend Logs ==="
docker logs e2e-frontend --tail 30 2>&1 || echo "No Frontend logs"
echo ""

# Test service connectivity
echo "🌐 Testing Service Connectivity:"

test_endpoint() {
    local url=$1
    local name=$2
    echo -n "Testing $name ($url): "
    
    if curl -f -s --max-time 10 "$url" > /dev/null 2>&1; then
        echo "✅ OK"
        return 0
    else
        echo "❌ FAILED"
        echo "  Response: $(curl -s --max-time 5 "$url" 2>&1 || echo 'Connection failed')"
        return 1
    fi
}

test_endpoint "http://localhost:5433" "PostgreSQL"
test_endpoint "http://localhost:6380" "Redis"
test_endpoint "http://localhost:3001/health" "API Health"
test_endpoint "http://localhost:8001/health" "AI Service Health"
test_endpoint "http://localhost:3002" "Frontend"

echo ""
echo "🔍 Network Information:"
docker network ls | grep e2e || echo "No E2E network found"

echo ""
echo "📊 Resource Usage:"
docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}" $(docker ps --filter "name=e2e-" --format "{{.Names}}") 2>/dev/null || echo "No containers running"

echo ""
echo "🔍 Port Information:"
echo "Checking if ports are available..."
for port in 3002 3001 5433 6380 8001; do
    if netstat -tuln 2>/dev/null | grep -q ":$port "; then
        echo "Port $port: ✅ In use"
    else
        echo "Port $port: ❌ Not in use"
    fi
done

echo ""
echo "🐳 Docker Information:"
echo "Docker version: $(docker --version)"
echo "Docker Compose version: $(docker-compose --version)"
echo "Available memory: $(free -h 2>/dev/null | grep Mem || echo 'Memory info not available')"
echo "Available disk: $(df -h . 2>/dev/null | tail -1 || echo 'Disk info not available')"

echo ""
echo "📝 Environment Variables Check:"
echo "NODE_ENV: ${NODE_ENV:-not set}"
echo "CI: ${CI:-not set}"
echo "GITHUB_ACTIONS: ${GITHUB_ACTIONS:-not set}"

# If all services are healthy, try running a simple test
if test_endpoint "http://localhost:3002" "Frontend" && test_endpoint "http://localhost:3001/health" "API"; then
    echo ""
    echo "🧪 Services appear healthy. You can now run E2E tests with:"
    echo "   cd property-search-frontend"
    echo "   PLAYWRIGHT_BASE_URL=http://localhost:3002 npm run test:e2e"
    echo ""
    echo "Or run a single test with:"
    echo "   PLAYWRIGHT_BASE_URL=http://localhost:3002 npx playwright test search.spec.ts --headed"
else
    echo ""
    echo "❌ Some services are not healthy. Check the logs above for errors."
    echo ""
    echo "Common issues to check:"
    echo "1. Port conflicts (check if ports 3002, 3001, 5433, 6380, 8001 are free)"
    echo "2. Docker daemon running"
    echo "3. Sufficient memory and disk space"
    echo "4. Network connectivity"
    echo "5. Environment variables properly set"
fi

echo ""
echo "🔍 Debug session complete. Containers are still running."
echo "To stop containers: docker-compose -f docker-compose.e2e.yml down"
echo "To follow logs: docker-compose -f docker-compose.e2e.yml logs -f"