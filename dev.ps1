# Development Server Manager
param(
    [string]$Action = "start"
)

$ErrorActionPreference = "Continue"

function Show-Header {
    Write-Host "Moov Property Search - Development Server Manager" -ForegroundColor Cyan
    Write-Host "=======================================================" -ForegroundColor Cyan
}

function Kill-DevServers {
    Write-Host "Killing existing development servers..." -ForegroundColor Yellow
    
    # Kill processes on specific ports
    $ports = @(3000, 3001, 8000)
    foreach ($port in $ports) {
        $processes = netstat -ano | findstr ":$port " | ForEach-Object { ($_ -split '\s+')[4] }
        foreach ($pid in $processes) {
            if ($pid -and $pid -ne "0") {
                try {
                    taskkill /f /pid $pid 2>$null
                    Write-Host "   ✅ Killed process $pid on port $port" -ForegroundColor Green
                }
                catch {
                    Write-Host "   ⚠️ Could not kill process $pid" -ForegroundColor Yellow
                }
            }
        }
    }
}

function Start-DevServers {
    Write-Host "🚀 Starting development servers..." -ForegroundColor Green
    
    # Start API Server
    Write-Host "   📡 Starting API Server (Port 3000)..." -ForegroundColor Blue
    Start-Job -Name "API" -ScriptBlock {
        Set-Location "C:\Users\aps33\Projects\Moov-Sonnet4\property-search-api"
        npm run dev
    } | Out-Null
    
    # Start Frontend Server
    Write-Host "   🌐 Starting Frontend Server (Port 3001)..." -ForegroundColor Blue
    Start-Job -Name "Frontend" -ScriptBlock {
        Set-Location "C:\Users\aps33\Projects\Moov-Sonnet4\property-search-frontend"
        npm run dev
    } | Out-Null
    
    # Start Embedding Service
    Write-Host "   🧠 Starting Embedding Service (Port 8000)..." -ForegroundColor Blue
    Start-Job -Name "Embedding" -ScriptBlock {
        Set-Location "C:\Users\aps33\Projects\Moov-Sonnet4\property-embedding-service"
        python src/main.py
    } | Out-Null
    
    Write-Host ""
    Write-Host "⏳ Waiting for servers to start..." -ForegroundColor Yellow
    Start-Sleep -Seconds 5
    
    # Check server status
    Test-ServerStatus
}

function Test-ServerStatus {
    Write-Host "📊 Server Status:" -ForegroundColor Cyan
    
    $services = @(
        @{ Name = "API Server"; Port = 3000; URL = "http://localhost:3000" },
        @{ Name = "Frontend"; Port = 3001; URL = "http://localhost:3001" },
        @{ Name = "Embedding Service"; Port = 8000; URL = "http://localhost:8000" }
    )
    
    foreach ($service in $services) {
        try {
            $response = Invoke-WebRequest -Uri "$($service.URL)/health" -TimeoutSec 2 -ErrorAction SilentlyContinue
            if ($response.StatusCode -eq 200) {
                Write-Host "   ✅ $($service.Name) - Running on port $($service.Port)" -ForegroundColor Green
            }
            else {
                Write-Host "   ⚠️ $($service.Name) - Port $($service.Port) open but no response" -ForegroundColor Yellow
            }
        }
        catch {
            # Check if port is listening
            $portCheck = netstat -ano | findstr ":$($service.Port) "
            if ($portCheck) {
                Write-Host "   🟡 $($service.Name) - Starting on port $($service.Port)" -ForegroundColor Yellow
            }
            else {
                Write-Host "   ❌ $($service.Name) - Not running on port $($service.Port)" -ForegroundColor Red
            }
        }
    }
}

function Show-JobStatus {
    Write-Host "💼 Job Status:" -ForegroundColor Cyan
    Get-Job | Format-Table Name, State, HasMoreData -AutoSize
}

function Show-Logs {
    param([string]$ServiceName)
    
    if ($ServiceName) {
        Write-Host "📋 Logs for ${ServiceName}:" -ForegroundColor Cyan
        Receive-Job -Name $ServiceName -Keep
    }
    else {
        Write-Host "📋 All Service Logs:" -ForegroundColor Cyan
        Get-Job | ForEach-Object {
            Write-Host "--- $($_.Name) ---" -ForegroundColor Yellow
            Receive-Job -Job $_ -Keep
        }
    }
}

function Show-Usage {
    Write-Host "📖 Usage:" -ForegroundColor Cyan
    Write-Host "   .\dev.ps1 start       - Start all development servers"
    Write-Host "   .\dev.ps1 stop        - Stop all development servers"
    Write-Host "   .\dev.ps1 restart     - Restart all development servers"
    Write-Host "   .\dev.ps1 status      - Check server status"
    Write-Host "   .\dev.ps1 logs        - Show all logs"
    Write-Host "   .\dev.ps1 logs api    - Show API logs"
    Write-Host "   .\dev.ps1 jobs        - Show PowerShell job status"
    Write-Host ""
    Write-Host "🌐 URLs:" -ForegroundColor Cyan
    Write-Host "   Frontend:  http://localhost:3001"
    Write-Host "   API:       http://localhost:3000"
    Write-Host "   Embedding: http://localhost:8000"
}

# Main script logic
Show-Header

switch ($Action.ToLower()) {
    "start" {
        Kill-DevServers
        Start-DevServers
        Show-Usage
    }
    "stop" {
        Kill-DevServers
        Get-Job | Stop-Job
        Get-Job | Remove-Job
        Write-Host "✅ All development servers stopped" -ForegroundColor Green
    }
    "restart" {
        Kill-DevServers
        Get-Job | Stop-Job
        Get-Job | Remove-Job
        Start-Sleep -Seconds 2
        Start-DevServers
        Show-Usage
    }
    "status" {
        Test-ServerStatus
        Show-JobStatus
    }
    "logs" {
        if ($args.Count -gt 0) {
            Show-Logs -ServiceName $args[0]
        }
        else {
            Show-Logs
        }
    }
    "jobs" {
        Show-JobStatus
    }
    default {
        Show-Usage
    }
}