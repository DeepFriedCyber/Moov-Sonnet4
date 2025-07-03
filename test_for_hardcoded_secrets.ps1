# PowerShell script to check for insecure fallback values in docker-compose.yml
# It looks for patterns like: VARIABLE:-insecure_value

Write-Host "Checking for hardcoded secrets in docker-compose.yml..." -ForegroundColor Yellow

# Check if docker-compose.yml exists
if (-not (Test-Path "docker-compose.yml")) {
    Write-Host "ERROR: docker-compose.yml not found in current directory" -ForegroundColor Red
    exit 1
}

# Search for hardcoded secret patterns
$patterns = @('POSTGRES_PASSWORD:-', 'JWT_SECRET:-')
$foundSecrets = @()

foreach ($pattern in $patterns) {
    $matches = Select-String -Path "docker-compose.yml" -Pattern $pattern
    if ($matches) {
        $foundSecrets += $matches
    }
}

if ($foundSecrets.Count -gt 0) {
    Write-Host "FAIL: Found hardcoded secret fallbacks:" -ForegroundColor Red
    foreach ($match in $foundSecrets) {
        Write-Host "  Line $($match.LineNumber): $($match.Line.Trim())" -ForegroundColor Red
    }
    Write-Host "Please move them to a .env file." -ForegroundColor Red
    exit 1
}
else {
    Write-Host "PASS: No hardcoded secret fallbacks found." -ForegroundColor Green
    exit 0
}