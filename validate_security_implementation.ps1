# Comprehensive Security Validation Script
# This script validates the complete security implementation

Write-Host "🔒 SECURITY VALIDATION SUITE" -ForegroundColor Cyan
Write-Host "=============================" -ForegroundColor Cyan
Write-Host ""

$allTestsPassed = $true

# Test 1: Check for hardcoded secrets
Write-Host "Test 1: Checking for hardcoded secrets..." -ForegroundColor Yellow
try {
    $result = & powershell -ExecutionPolicy Bypass -File "test_for_hardcoded_secrets.ps1"
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ PASS: No hardcoded secrets found" -ForegroundColor Green
    }
    else {
        Write-Host "❌ FAIL: Hardcoded secrets detected" -ForegroundColor Red
        $allTestsPassed = $false
    }
}
catch {
    Write-Host "❌ FAIL: Error running hardcoded secrets test" -ForegroundColor Red
    $allTestsPassed = $false
}

# Test 2: Check if .env exists
Write-Host "Test 2: Checking if .env file exists..." -ForegroundColor Yellow
if (Test-Path ".env") {
    Write-Host "✅ PASS: .env file exists" -ForegroundColor Green
}
else {
    Write-Host "❌ FAIL: .env file is missing" -ForegroundColor Red
    $allTestsPassed = $false
}

# Test 3: Check if .env.example exists
Write-Host "Test 3: Checking if .env.example exists..." -ForegroundColor Yellow
if (Test-Path ".env.example") {
    Write-Host "✅ PASS: .env.example file exists" -ForegroundColor Green
}
else {
    Write-Host "❌ FAIL: .env.example file is missing" -ForegroundColor Red
    $allTestsPassed = $false
}

# Test 4: Check if .env is gitignored
Write-Host "Test 4: Checking if .env is gitignored..." -ForegroundColor Yellow
if (Test-Path ".gitignore") {
    $gitignoreContent = Get-Content ".gitignore" -Raw
    if ($gitignoreContent -match "\.env") {
        Write-Host "✅ PASS: .env is properly gitignored" -ForegroundColor Green
    }
    else {
        Write-Host "❌ FAIL: .env is not in .gitignore" -ForegroundColor Red
        $allTestsPassed = $false
    }
}
else {
    Write-Host "❌ FAIL: .gitignore file is missing" -ForegroundColor Red
    $allTestsPassed = $false
}

# Test 5: Check if required environment variables are in .env
Write-Host "Test 5: Checking required environment variables..." -ForegroundColor Yellow
if (Test-Path ".env") {
    $envContent = Get-Content ".env" -Raw
    $requiredVars = @("POSTGRES_PASSWORD", "JWT_SECRET")
    $missingVars = @()
    
    foreach ($var in $requiredVars) {
        if ($envContent -notmatch "$var=") {
            $missingVars += $var
        }
    }
    
    if ($missingVars.Count -eq 0) {
        Write-Host "✅ PASS: All required environment variables are present" -ForegroundColor Green
    }
    else {
        $missingVarsString = $missingVars -join ", "
        Write-Host "❌ FAIL: Missing environment variables: $missingVarsString" -ForegroundColor Red
        $allTestsPassed = $false
    }
}

# Test 6: Validate docker-compose configuration
Write-Host "Test 6: Validating docker-compose configuration..." -ForegroundColor Yellow
try {
    $dockerComposeOutput = docker-compose config 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ PASS: docker-compose.yml is valid with current .env" -ForegroundColor Green
    }
    else {
        Write-Host "❌ FAIL: docker-compose.yml validation failed" -ForegroundColor Red
        Write-Host "Error: $dockerComposeOutput" -ForegroundColor Red
        $allTestsPassed = $false
    }
}
catch {
    Write-Host "⚠️  WARNING: Docker not available for validation" -ForegroundColor Yellow
}

# Test 7: Check for security documentation
Write-Host "Test 7: Checking for security documentation..." -ForegroundColor Yellow
if (Test-Path "SECURITY_GUIDE.md") {
    Write-Host "✅ PASS: Security documentation exists" -ForegroundColor Green
}
else {
    Write-Host "❌ FAIL: SECURITY_GUIDE.md is missing" -ForegroundColor Red
    $allTestsPassed = $false
}

# Final Results
Write-Host ""
Write-Host "=============================" -ForegroundColor Cyan
if ($allTestsPassed) {
    Write-Host "🎉 ALL SECURITY TESTS PASSED!" -ForegroundColor Green
    Write-Host "Your application is properly secured." -ForegroundColor Green
    exit 0
}
else {
    Write-Host "🚨 SECURITY TESTS FAILED!" -ForegroundColor Red
    Write-Host "Please fix the issues above before deploying." -ForegroundColor Red
    exit 1
}