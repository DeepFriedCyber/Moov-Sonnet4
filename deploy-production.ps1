# Production Deployment Script for Moov Property Search (PowerShell)
# This script builds and deploys the application using production Docker configurations

param(
    [switch]$SkipSecurityCheck = $false,
    [switch]$NoBuild = $false
)

# Set error action preference
$ErrorActionPreference = "Stop"

Write-Host "🚀 Starting Production Deployment..." -ForegroundColor Blue

# Function to print colored output
function Write-Status {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Cyan
}

function Write-Success {
    param([string]$Message)
    Write-Host "[SUCCESS] $Message" -ForegroundColor Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "[WARNING] $Message" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

try {
    # Check if .env.production exists
    if (-not (Test-Path ".env.production")) {
        Write-Error ".env.production file not found!"
        Write-Warning "Please copy .env.production.example to .env.production and configure it."
        exit 1
    }

    Write-Success ".env.production file found"

    # Run security checks (unless skipped)
    if (-not $SkipSecurityCheck) {
        Write-Status "Running security checks..."
        $securityResult = & bash test_for_hardcoded_secrets.sh
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Security checks passed"
        }
        else {
            Write-Error "Security checks failed! Deployment aborted."
            exit 1
        }
    }
    else {
        Write-Warning "Security checks skipped"
    }

    # Validate Docker Compose configuration
    Write-Status "Validating Docker Compose configuration..."
    $null = docker-compose -f docker-compose.yml -f docker-compose.prod.yml --env-file .env.production config 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Docker Compose configuration is valid"
    }
    else {
        Write-Error "Docker Compose configuration is invalid! Deployment aborted."
        exit 1
    }

    # Build production images (unless skipped)
    if (-not $NoBuild) {
        Write-Status "Building production Docker images..."
        docker-compose -f docker-compose.yml -f docker-compose.prod.yml --env-file .env.production build --no-cache

        if ($LASTEXITCODE -eq 0) {
            Write-Success "Production images built successfully"
        }
        else {
            Write-Error "Failed to build production images! Deployment aborted."
            exit 1
        }
    }
    else {
        Write-Warning "Build step skipped"
    }

    # Stop existing containers (if any)
    Write-Status "Stopping existing containers..."
    docker-compose -f docker-compose.yml -f docker-compose.prod.yml --env-file .env.production down

    # Start production containers
    Write-Status "Starting production containers..."
    docker-compose -f docker-compose.yml -f docker-compose.prod.yml --env-file .env.production up -d

    if ($LASTEXITCODE -eq 0) {
        Write-Success "Production containers started successfully"
    }
    else {
        Write-Error "Failed to start production containers! Deployment failed."
        exit 1
    }

    # Wait for services to be healthy
    Write-Status "Waiting for services to be healthy..."
    Start-Sleep -Seconds 30

    # Check service health
    Write-Status "Checking service health..."

    # Check API health
    try {
        $apiResponse = Invoke-WebRequest -Uri "http://localhost:8000/health" -TimeoutSec 10 -UseBasicParsing
        if ($apiResponse.StatusCode -eq 200) {
            Write-Success "API service is healthy"
        }
        else {
            Write-Warning "API service health check returned status: $($apiResponse.StatusCode)"
        }
    }
    catch {
        Write-Warning "API service health check failed: $($_.Exception.Message)"
    }

    # Check Frontend health
    try {
        $frontendResponse = Invoke-WebRequest -Uri "http://localhost:3000" -TimeoutSec 10 -UseBasicParsing
        if ($frontendResponse.StatusCode -eq 200) {
            Write-Success "Frontend service is healthy"
        }
        else {
            Write-Warning "Frontend service health check returned status: $($frontendResponse.StatusCode)"
        }
    }
    catch {
        Write-Warning "Frontend service health check failed: $($_.Exception.Message)"
    }

    # Check Embedding Service health
    try {
        $embeddingResponse = Invoke-WebRequest -Uri "http://localhost:8001/health" -TimeoutSec 10 -UseBasicParsing
        if ($embeddingResponse.StatusCode -eq 200) {
            Write-Success "Embedding service is healthy"
        }
        else {
            Write-Warning "Embedding service health check returned status: $($embeddingResponse.StatusCode)"
        }
    }
    catch {
        Write-Warning "Embedding service health check failed: $($_.Exception.Message)"
    }

    # Display running containers
    Write-Status "Production deployment status:"
    docker-compose -f docker-compose.yml -f docker-compose.prod.yml --env-file .env.production ps

    Write-Success "🎉 Production deployment completed!"
    Write-Status "Services are available at:"
    Write-Host "  🌐 Frontend: http://localhost:3000" -ForegroundColor White
    Write-Host "  🔌 API: http://localhost:8000" -ForegroundColor White
    Write-Host "  🤖 Embedding Service: http://localhost:8001" -ForegroundColor White
    Write-Host ""
    Write-Warning "Remember to:"
    Write-Host "  - Configure your reverse proxy/load balancer" -ForegroundColor White
    Write-Host "  - Set up SSL certificates" -ForegroundColor White
    Write-Host "  - Configure monitoring and logging" -ForegroundColor White
    Write-Host "  - Set up backup procedures" -ForegroundColor White

}
catch {
    Write-Error "Deployment failed: $($_.Exception.Message)"
    Write-Status "Rolling back..."
    docker-compose -f docker-compose.yml -f docker-compose.prod.yml --env-file .env.production down
    exit 1
}