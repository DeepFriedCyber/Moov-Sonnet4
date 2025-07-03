#!/bin/bash

# E2E Testing with Docker Compose - Local Test Script
# This script mimics what happens in the CI pipeline

set -e

echo "🧪 Starting E2E Testing with Docker Compose..."

# Create .env file
echo "📝 Creating .env file..."
cat > .env << EOF
POSTGRES_USER=moov
POSTGRES_PASSWORD=moov123
POSTGRES_DB=moov_db
JWT_SECRET=a_test_secret_for_ci_that_is_long_enough
FRONTEND_URL=http://localhost:3000
EOF

# Start the application stack
echo "🚀 Starting application stack..."
docker-compose -f docker-compose.e2e.yml up -d --build

# Function to wait for service
wait_for_service() {
    local url=$1
    local name=$2
    local max_attempts=30
    local attempt=1
    
    echo "⏳ Waiting for $name to be ready at $url..."
    
    while [ $attempt -le $max_attempts ]; do
        if curl -f -s $url > /dev/null 2>&1; then
            echo "✅ $name is ready!"
            return 0
        fi
        
        echo "   Attempt $attempt/$max_attempts - $name not ready yet..."
        sleep 5
        attempt=$((attempt + 1))
    done
    
    echo "❌ $name failed to start after $max_attempts attempts"
    return 1
}

# Wait for services to be ready
wait_for_service "http://localhost:3000" "Frontend"
wait_for_service "http://localhost:3001/health" "API"
wait_for_service "http://localhost:8001/health" "AI Service"

echo "🎉 All services are ready!"

# Install dependencies and run tests
echo "📦 Installing dependencies..."
cd property-search-frontend
npm ci

echo "🌐 Installing Playwright browsers..."
npx playwright install --with-deps

echo "🧪 Running E2E tests..."
PLAYWRIGHT_BASE_URL=http://localhost:3000 npm run test:e2e

echo "✅ E2E tests completed!"

# Cleanup
echo "🛑 Stopping application stack..."
cd ..
docker-compose -f docker-compose.e2e.yml down

echo "🎉 E2E testing complete!"