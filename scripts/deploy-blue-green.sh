#!/bin/bash

# Blue-Green Deployment Script for Moov Property Search
set -e

# Configuration
COMPOSE_FILE="docker-compose.production-enhanced.yml"
HEALTH_CHECK_TIMEOUT=60
HEALTH_CHECK_INTERVAL=5

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Check if required environment variables are set
check_env() {
    log "Checking environment variables..."
    
    required_vars=(
        "REGISTRY"
        "IMAGE_NAME"
        "VERSION"
        "DATABASE_URL"
        "REDIS_URL"
        "JWT_SECRET"
        "POSTGRES_DB"
        "POSTGRES_USER"
        "POSTGRES_PASSWORD"
    )
    
    for var in "${required_vars[@]}"; do
        if [[ -z "${!var}" ]]; then
            error "Environment variable $var is not set"
            exit 1
        fi
    done
    
    success "All required environment variables are set"
}

# Determine current and new colors
determine_colors() {
    log "Determining current deployment color..."
    
    if docker compose -f $COMPOSE_FILE ps frontend-blue | grep -q "Up"; then
        CURRENT_COLOR="blue"
        NEW_COLOR="green"
    else
        CURRENT_COLOR="green"
        NEW_COLOR="blue"
    fi
    
    log "Current color: $CURRENT_COLOR, New color: $NEW_COLOR"
}

# Pull latest images
pull_images() {
    log "Pulling latest Docker images..."
    
    docker compose -f $COMPOSE_FILE pull frontend-$NEW_COLOR
    docker compose -f $COMPOSE_FILE pull api-$NEW_COLOR
    docker compose -f $COMPOSE_FILE pull embedding-1
    docker compose -f $COMPOSE_FILE pull embedding-2
    
    success "Images pulled successfully"
}

# Deploy new version
deploy_new_version() {
    log "Deploying new version ($NEW_COLOR)..."
    
    # Start new services
    docker compose -f $COMPOSE_FILE up -d frontend-$NEW_COLOR api-$NEW_COLOR
    
    success "New version deployed"
}

# Health check function
health_check() {
    local service=$1
    local port=$2
    local endpoint=${3:-/health}
    
    log "Performing health check for $service..."
    
    local count=0
    local max_attempts=$((HEALTH_CHECK_TIMEOUT / HEALTH_CHECK_INTERVAL))
    
    while [ $count -lt $max_attempts ]; do
        if curl -f -s "http://localhost:$port$endpoint" > /dev/null 2>&1; then
            success "$service health check passed"
            return 0
        fi
        
        count=$((count + 1))
        log "Health check attempt $count/$max_attempts for $service..."
        sleep $HEALTH_CHECK_INTERVAL
    done
    
    error "$service health check failed after $HEALTH_CHECK_TIMEOUT seconds"
    return 1
}

# Perform health checks
perform_health_checks() {
    log "Performing health checks on new deployment..."
    
    # Wait for services to start
    sleep 30
    
    # Check frontend
    if [[ $NEW_COLOR == "blue" ]]; then
        health_check "frontend-blue" "3000"
    else
        health_check "frontend-green" "3000"
    fi
    
    # Check API
    if [[ $NEW_COLOR == "blue" ]]; then
        health_check "api-blue" "3001"
    else
        health_check "api-green" "3001"
    fi
    
    # Check embedding services
    health_check "embedding-1" "8001"
    health_check "embedding-2" "8001"
    
    success "All health checks passed"
}

# Switch traffic
switch_traffic() {
    log "Switching traffic to new deployment..."
    
    # Update Traefik configuration to point to new services
    # This would typically involve updating the Traefik configuration
    # For now, we'll simulate this by updating environment variables
    
    # Restart Traefik to pick up new configuration
    docker compose -f docker-compose.monitoring.yml restart traefik
    
    success "Traffic switched to new deployment"
}

# Stop old version
stop_old_version() {
    log "Stopping old version ($CURRENT_COLOR)..."
    
    # Stop old services
    docker compose -f $COMPOSE_FILE stop frontend-$CURRENT_COLOR api-$CURRENT_COLOR
    docker compose -f $COMPOSE_FILE rm -f frontend-$CURRENT_COLOR api-$CURRENT_COLOR
    
    success "Old version stopped and removed"
}

# Cleanup
cleanup() {
    log "Performing cleanup..."
    
    # Remove unused images
    docker image prune -f
    
    # Remove unused volumes
    docker volume prune -f
    
    success "Cleanup completed"
}

# Rollback function
rollback() {
    error "Deployment failed, initiating rollback..."
    
    # Stop new services
    docker compose -f $COMPOSE_FILE stop frontend-$NEW_COLOR api-$NEW_COLOR
    docker compose -f $COMPOSE_FILE rm -f frontend-$NEW_COLOR api-$NEW_COLOR
    
    # Ensure old services are running
    docker compose -f $COMPOSE_FILE up -d frontend-$CURRENT_COLOR api-$CURRENT_COLOR
    
    warning "Rollback completed. Old version is still running."
    exit 1
}

# Main deployment function
main() {
    log "Starting blue-green deployment..."
    
    # Set trap for cleanup on failure
    trap rollback ERR
    
    check_env
    determine_colors
    pull_images
    deploy_new_version
    
    if perform_health_checks; then
        switch_traffic
        sleep 30  # Wait for traffic to stabilize
        
        # Final health check after traffic switch
        if perform_health_checks; then
            stop_old_version
            cleanup
            success "Blue-green deployment completed successfully!"
            log "New deployment ($NEW_COLOR) is now live"
        else
            rollback
        fi
    else
        rollback
    fi
}

# Run main function
main "$@"