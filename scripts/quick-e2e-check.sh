#!/bin/bash

# Quick E2E Health Check Script
echo "🔍 Quick E2E Health Check..."

echo "📊 Container Status:"
docker-compose -f docker-compose.e2e.yml ps 2>/dev/null || echo "No containers running"

echo ""
echo "🌐 Service Health Checks:"

# Function to test endpoint
test_endpoint() {
    local url=$1
    local name=$2
    echo -n "$name: "
    
    if curl -f -s --max-time 5 "$url" > /dev/null 2>&1; then
        echo "✅ OK"
    else
        echo "❌ FAILED"
    fi
}

test_endpoint "http://localhost:3000" "Frontend"
test_endpoint "http://localhost:3001/health" "API"
test_endpoint "http://localhost:8001/health" "AI Service"

echo ""
echo "🐳 Recent Container Logs (last 5 lines each):"
for container in e2e-frontend e2e-api e2e-embedding; do
    echo "--- $container ---"
    docker logs $container --tail 5 2>/dev/null || echo "No logs available"
    echo ""
done