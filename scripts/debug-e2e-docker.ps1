# E2E Testing Debug Script - PowerShell Version
# Detailed logging and troubleshooting for E2E test failures

Write-Host "🔍 Starting E2E Testing Debug Session..." -ForegroundColor Green

# Create .env file
Write-Host "📝 Creating .env file..." -ForegroundColor Yellow
@"
POSTGRES_USER=moov
POSTGRES_PASSWORD=moov123
POSTGRES_DB=moov_db
JWT_SECRET=a_test_secret_for_ci_that_is_long_enough
FRONTEND_URL=http://localhost:3000
"@ | Out-File -FilePath ".env" -Encoding UTF8

Write-Host "✅ Environment file created" -ForegroundColor Green

# Clean up any existing containers
Write-Host "🧹 Cleaning up existing containers..." -ForegroundColor Yellow
try {
    docker-compose -f docker-compose.e2e.yml down --remove-orphans --volumes 2>$null
} catch {
    Write-Host "No existing containers to clean up" -ForegroundColor Gray
}

# Start the application stack with detailed logging
Write-Host "🚀 Starting application stack with detailed logging..." -ForegroundColor Yellow
docker-compose -f docker-compose.e2e.yml up -d --build

Write-Host "⏳ Waiting for containers to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# Check container status
Write-Host "📊 Container Status:" -ForegroundColor Cyan
docker-compose -f docker-compose.e2e.yml ps

Write-Host ""
Write-Host "🔍 Detailed Container Information:" -ForegroundColor Cyan
$containers = @("e2e-postgres", "e2e-redis", "e2e-api", "e2e-embedding", "e2e-frontend")

foreach ($container in $containers) {
    Write-Host "--- $container ---" -ForegroundColor White
    try {
        $status = docker ps --format "{{.Status}}" --filter "name=$container" 2>$null
        if ($status) {
            Write-Host "Status: $status" -ForegroundColor Green
            try {
                $health = docker inspect --format='{{.State.Health.Status}}' $container 2>$null
                Write-Host "Health: $health" -ForegroundColor Green
            } catch {
                Write-Host "Health: No health check" -ForegroundColor Yellow
            }
        } else {
            Write-Host "❌ Container not running" -ForegroundColor Red
        }
    } catch {
        Write-Host "❌ Error checking container status" -ForegroundColor Red
    }
    Write-Host ""
}

# Show logs for each service
Write-Host "📋 Service Logs:" -ForegroundColor Cyan

Write-Host "=== PostgreSQL Logs ===" -ForegroundColor White
try { docker logs e2e-postgres --tail 20 } catch { Write-Host "No PostgreSQL logs" -ForegroundColor Gray }
Write-Host ""

Write-Host "=== Redis Logs ===" -ForegroundColor White
try { docker logs e2e-redis --tail 20 } catch { Write-Host "No Redis logs" -ForegroundColor Gray }
Write-Host ""

Write-Host "=== API Logs ===" -ForegroundColor White
try { docker logs e2e-api --tail 30 } catch { Write-Host "No API logs" -ForegroundColor Gray }
Write-Host ""

Write-Host "=== Embedding Service Logs ===" -ForegroundColor White
try { docker logs e2e-embedding --tail 30 } catch { Write-Host "No Embedding Service logs" -ForegroundColor Gray }
Write-Host ""

Write-Host "=== Frontend Logs ===" -ForegroundColor White
try { docker logs e2e-frontend --tail 30 } catch { Write-Host "No Frontend logs" -ForegroundColor Gray }
Write-Host ""

# Test service connectivity
Write-Host "🌐 Testing Service Connectivity:" -ForegroundColor Cyan

function Test-Endpoint {
    param(
        [string]$Url,
        [string]$Name
    )
    
    Write-Host -NoNewline "Testing $Name ($Url): "
    
    try {
        $response = Invoke-WebRequest -Uri $Url -Method Get -TimeoutSec 10 -UseBasicParsing -ErrorAction Stop
        if ($response.StatusCode -eq 200) {
            Write-Host "✅ OK" -ForegroundColor Green
            return $true
        } else {
            Write-Host "❌ FAILED (Status: $($response.StatusCode))" -ForegroundColor Red
            return $false
        }
    } catch {
        Write-Host "❌ FAILED" -ForegroundColor Red
        Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

$apiHealthy = Test-Endpoint -Url "http://localhost:3001/health" -Name "API Health"
$aiHealthy = Test-Endpoint -Url "http://localhost:8001/health" -Name "AI Service Health"
$frontendHealthy = Test-Endpoint -Url "http://localhost:3000" -Name "Frontend"

Write-Host ""
Write-Host "🔍 Network Information:" -ForegroundColor Cyan
try {
    docker network ls | Select-String "e2e"
} catch {
    Write-Host "No E2E network found" -ForegroundColor Gray
}

Write-Host ""
Write-Host "📊 Resource Usage:" -ForegroundColor Cyan
try {
    docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}" $(docker ps --filter "name=e2e-" --format "{{.Names}}")
} catch {
    Write-Host "No containers running" -ForegroundColor Gray
}

Write-Host ""
Write-Host "🔍 Port Information:" -ForegroundColor Cyan
Write-Host "Checking if ports are available..."
$ports = @(3000, 3001, 5432, 6379, 8001)
foreach ($port in $ports) {
    try {
        $connection = Test-NetConnection -ComputerName localhost -Port $port -WarningAction SilentlyContinue
        if ($connection.TcpTestSucceeded) {
            Write-Host "Port $port`: ✅ In use" -ForegroundColor Green
        } else {
            Write-Host "Port $port`: ❌ Not in use" -ForegroundColor Red
        }
    } catch {
        Write-Host "Port $port`: ❓ Unable to check" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "🐳 Docker Information:" -ForegroundColor Cyan
Write-Host "Docker version: $(docker --version)"
Write-Host "Docker Compose version: $(docker-compose --version)"

Write-Host ""
Write-Host "📝 Environment Variables Check:" -ForegroundColor Cyan
Write-Host "NODE_ENV: $($env:NODE_ENV ?? 'not set')"
Write-Host "CI: $($env:CI ?? 'not set')"
Write-Host "GITHUB_ACTIONS: $($env:GITHUB_ACTIONS ?? 'not set')"

# If all services are healthy, try running a simple test
if ($frontendHealthy -and $apiHealthy) {
    Write-Host ""
    Write-Host "🧪 Services appear healthy. You can now run E2E tests with:" -ForegroundColor Green
    Write-Host "   cd property-search-frontend" -ForegroundColor White
    Write-Host "   `$env:PLAYWRIGHT_BASE_URL='http://localhost:3000'; npm run test:e2e" -ForegroundColor White
    Write-Host ""
    Write-Host "Or run a single test with:" -ForegroundColor Green
    Write-Host "   `$env:PLAYWRIGHT_BASE_URL='http://localhost:3000'; npx playwright test search.spec.ts --headed" -ForegroundColor White
} else {
    Write-Host ""
    Write-Host "❌ Some services are not healthy. Check the logs above for errors." -ForegroundColor Red
    Write-Host ""
    Write-Host "Common issues to check:" -ForegroundColor Yellow
    Write-Host "1. Port conflicts (check if ports 3000, 3001, 5432, 6379, 8001 are free)" -ForegroundColor White
    Write-Host "2. Docker daemon running" -ForegroundColor White
    Write-Host "3. Sufficient memory and disk space" -ForegroundColor White
    Write-Host "4. Network connectivity" -ForegroundColor White
    Write-Host "5. Environment variables properly set" -ForegroundColor White
}

Write-Host ""
Write-Host "🔍 Debug session complete. Containers are still running." -ForegroundColor Green
Write-Host "To stop containers: docker-compose -f docker-compose.e2e.yml down" -ForegroundColor White
Write-Host "To follow logs: docker-compose -f docker-compose.e2e.yml logs -f" -ForegroundColor White