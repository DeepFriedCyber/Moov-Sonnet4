# Simple Security Validation Script
Write-Host "SECURITY VALIDATION SUITE" -ForegroundColor Cyan
Write-Host "=========================" -ForegroundColor Cyan

$allTestsPassed = $true

# Test 1: Check for hardcoded secrets
Write-Host "Test 1: Checking for hardcoded secrets..." -ForegroundColor Yellow
try {
    & bash test_for_hardcoded_secrets.sh
    if ($LASTEXITCODE -eq 0) {
        Write-Host "PASS: No hardcoded secrets found" -ForegroundColor Green
    }
    else {
        Write-Host "FAIL: Hardcoded secrets detected" -ForegroundColor Red
        $allTestsPassed = $false
    }
}
catch {
    Write-Host "FAIL: Error running hardcoded secrets test" -ForegroundColor Red
    $allTestsPassed = $false
}

# Test 2: Check if .env exists
Write-Host "Test 2: Checking if .env file exists..." -ForegroundColor Yellow
if (Test-Path ".env") {
    Write-Host "PASS: .env file exists" -ForegroundColor Green
}
else {
    Write-Host "FAIL: .env file is missing" -ForegroundColor Red
    $allTestsPassed = $false
}

# Test 3: Check if .env.example exists
Write-Host "Test 3: Checking if .env.example exists..." -ForegroundColor Yellow
if (Test-Path ".env.example") {
    Write-Host "PASS: .env.example file exists" -ForegroundColor Green
}
else {
    Write-Host "FAIL: .env.example file is missing" -ForegroundColor Red
    $allTestsPassed = $false
}

# Test 4: Check if required environment variables are in .env
Write-Host "Test 4: Checking required environment variables..." -ForegroundColor Yellow
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
        Write-Host "PASS: All required environment variables are present" -ForegroundColor Green
    }
    else {
        Write-Host "FAIL: Missing environment variables: $($missingVars -join ', ')" -ForegroundColor Red
        $allTestsPassed = $false
    }
}

# Final Results
Write-Host ""
Write-Host "=========================" -ForegroundColor Cyan
if ($allTestsPassed) {
    Write-Host "ALL SECURITY TESTS PASSED!" -ForegroundColor Green
    Write-Host "Your application is properly secured." -ForegroundColor Green
    exit 0
}
else {
    Write-Host "SECURITY TESTS FAILED!" -ForegroundColor Red
    Write-Host "Please fix the issues above before deploying." -ForegroundColor Red
    exit 1
}