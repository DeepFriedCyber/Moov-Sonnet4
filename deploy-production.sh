#!/bin/bash

# Production Deployment Script for Moov Property Search
# This script builds and deploys the application using production Docker configurations

set -e  # Exit on any error

echo "🚀 Starting Production Deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if .env.production exists
if [ ! -f ".env.production" ]; then
    print_error ".env.production file not found!"
    print_warning "Please copy .env.production.example to .env.production and configure it."
    exit 1
fi

print_success ".env.production file found"

# Run security checks
print_status "Running security checks..."
if bash test_for_hardcoded_secrets.sh; then
    print_success "Security checks passed"
else
    print_error "Security checks failed! Deployment aborted."
    exit 1
fi

# Validate Docker Compose configuration
print_status "Validating Docker Compose configuration..."
if docker-compose -f docker-compose.yml -f docker-compose.prod.yml --env-file .env.production config > /dev/null; then
    print_success "Docker Compose configuration is valid"
else
    print_error "Docker Compose configuration is invalid! Deployment aborted."
    exit 1
fi

# Build production images
print_status "Building production Docker images..."
docker-compose -f docker-compose.yml -f docker-compose.prod.yml --env-file .env.production build --no-cache

if [ $? -eq 0 ]; then
    print_success "Production images built successfully"
else
    print_error "Failed to build production images! Deployment aborted."
    exit 1
fi

# Stop existing containers (if any)
print_status "Stopping existing containers..."
docker-compose -f docker-compose.yml -f docker-compose.prod.yml --env-file .env.production down

# Start production containers
print_status "Starting production containers..."
docker-compose -f docker-compose.yml -f docker-compose.prod.yml --env-file .env.production up -d

if [ $? -eq 0 ]; then
    print_success "Production containers started successfully"
else
    print_error "Failed to start production containers! Deployment failed."
    exit 1
fi

# Wait for services to be healthy
print_status "Waiting for services to be healthy..."
sleep 30

# Check service health
print_status "Checking service health..."

# Check API health
if curl -f http://localhost:8000/health > /dev/null 2>&1; then
    print_success "API service is healthy"
else
    print_warning "API service health check failed"
fi

# Check Frontend health
if curl -f http://localhost:3000 > /dev/null 2>&1; then
    print_success "Frontend service is healthy"
else
    print_warning "Frontend service health check failed"
fi

# Check Embedding Service health
if curl -f http://localhost:8001/health > /dev/null 2>&1; then
    print_success "Embedding service is healthy"
else
    print_warning "Embedding service health check failed"
fi

# Display running containers
print_status "Production deployment status:"
docker-compose -f docker-compose.yml -f docker-compose.prod.yml --env-file .env.production ps

print_success "🎉 Production deployment completed!"
print_status "Services are available at:"
echo "  🌐 Frontend: http://localhost:3000"
echo "  🔌 API: http://localhost:8000"
echo "  🤖 Embedding Service: http://localhost:8001"
echo ""
print_warning "Remember to:"
echo "  - Configure your reverse proxy/load balancer"
echo "  - Set up SSL certificates"
echo "  - Configure monitoring and logging"
echo "  - Set up backup procedures"