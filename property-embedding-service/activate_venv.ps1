# Activate the virtual environment for property-embedding-service
# Usage: .\activate_venv.ps1

Write-Host "🔄 Activating virtual environment for property-embedding-service..." -ForegroundColor Yellow

# Activate the virtual environment
& ".\venv\Scripts\Activate.ps1"

# Verify activation
if ($env:VIRTUAL_ENV) {
    Write-Host "✅ Virtual environment activated successfully!" -ForegroundColor Green
    Write-Host "📍 Virtual environment path: $env:VIRTUAL_ENV" -ForegroundColor Cyan
    Write-Host "🐍 Python version:" -ForegroundColor Cyan
    python --version
    Write-Host "📦 Installed packages:" -ForegroundColor Cyan
    pip list --format=freeze | Select-String "fastapi|prometheus|sentence-transformers|torch|redis"
}
else {
    Write-Host "❌ Failed to activate virtual environment" -ForegroundColor Red
}