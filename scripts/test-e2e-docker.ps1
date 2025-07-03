# E2E Testing with Docker Compose - Local Test Script (PowerShell)
# This script mimics what happens in the CI pipeline

Write-Host "🧪 Starting E2E Testing with Docker Compose..." -ForegroundColor Green

# Create .env file
Write-Host "📝 Creating .env file..." -ForegroundColor Yellow
@"
POSTGRES_USER=moov
POSTGRES_PASSWORD=moov123
POSTGRES_DB=moov_db
JWT_SECRET=a_test_secret_for_ci_that_is_long_enough
FRONTEND_URL=http://localhost:3000
"@ | Out-File -FilePath ".env" -Encoding UTF8

# Start the application stack
Write-Host "🚀 Starting application stack..." -ForegroundColor Yellow
docker-compose -f docker-compose.e2e.yml up -d --build

# Function to wait for service
function Wait-ForService {
    param(
        [string]$Url,
        [string]$Name,
        [int]$MaxAttempts = 30
    )
    
    Write-Host "⏳ Waiting for $Name to be ready at $Url..." -ForegroundColor Yellow
    
    for ($attempt = 1; $attempt -le $MaxAttempts; $attempt++) {
        try {
            $response = Invoke-WebRequest -Uri $Url -Method Get -TimeoutSec 5 -UseBasicParsing
            if ($response.StatusCode -eq 200) {
                Write-Host "✅ $Name is ready!" -ForegroundColor Green
                return $true
            }
        }
        catch {
            # Service not ready yet
        }
        
        Write-Host "   Attempt $attempt/$MaxAttempts - $Name not ready yet..." -ForegroundColor Gray
        Start-Sleep -Seconds 5
    }
    
    Write-Host "❌ $Name failed to start after $MaxAttempts attempts" -ForegroundColor Red
    return $false
}

# Wait for services to be ready
$frontendReady = Wait-ForService -Url "http://localhost:3000" -Name "Frontend"
$apiReady = Wait-ForService -Url "http://localhost:3001/health" -Name "API"
$aiReady = Wait-ForService -Url "http://localhost:8001/health" -Name "AI Service"

if (-not ($frontendReady -and $apiReady -and $aiReady)) {
    Write-Host "❌ Some services failed to start. Stopping..." -ForegroundColor Red
    docker-compose -f docker-compose.e2e.yml down
    exit 1
}

Write-Host "🎉 All services are ready!" -ForegroundColor Green

# Install dependencies and run tests
Write-Host "📦 Installing dependencies..." -ForegroundColor Yellow
Set-Location property-search-frontend
npm ci

Write-Host "🌐 Installing Playwright browsers..." -ForegroundColor Yellow
npx playwright install --with-deps

Write-Host "🧪 Running E2E tests..." -ForegroundColor Yellow
$env:PLAYWRIGHT_BASE_URL = "http://localhost:3000"
npm run test:e2e

Write-Host "✅ E2E tests completed!" -ForegroundColor Green

# Cleanup
Write-Host "🛑 Stopping application stack..." -ForegroundColor Yellow
Set-Location ..
docker-compose -f docker-compose.e2e.yml down

Write-Host "🎉 E2E testing complete!" -ForegroundColor Green