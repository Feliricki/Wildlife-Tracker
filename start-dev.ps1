#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Starts both the PersonalSite frontend and PersonalSiteAPI backend in development mode.

.DESCRIPTION
    This script mimics Visual Studio's behavior by running both projects concurrently:
    - PersonalSiteAPI (.NET 8.0) on https://localhost:40443 and http://localhost:40080
    - PersonalSite (Angular 18) on https://localhost:4200 with SSL certificates
    
    The Angular app is configured to proxy API calls to the backend automatically.

.PARAMETER NoWatch
    Run the backend without file watching (faster startup, but no auto-reload)

.PARAMETER ApiOnly
    Only start the backend API

.PARAMETER FrontendOnly
    Only start the frontend Angular app

.EXAMPLE
    .\start-dev.ps1
    Starts both frontend and backend with file watching

.EXAMPLE
    .\start-dev.ps1 -NoWatch
    Starts both projects without backend file watching

.EXAMPLE
    .\start-dev.ps1 -ApiOnly
    Starts only the backend API
#>

param(
    [switch]$NoWatch,
    [switch]$ApiOnly,
    [switch]$FrontendOnly
)

# Colors for output
$ErrorColor = "Red"
$SuccessColor = "Green"
$InfoColor = "Cyan"
$WarningColor = "Yellow"

function Write-ColorText {
    param([string]$Text, [string]$Color = "White")
    Write-Host $Text -ForegroundColor $Color
}

function Test-Command {
    param([string]$Command)
    try {
        Get-Command $Command -ErrorAction Stop | Out-Null
        return $true
    } catch {
        return $false
    }
}

function Start-Backend {
    Write-ColorText "🚀 Starting PersonalSiteAPI (.NET 8.0)..." $InfoColor
    
    if (-not (Test-Path "PersonalSiteAPI/PersonalSiteAPI.csproj")) {
        Write-ColorText "❌ Error: PersonalSiteAPI.csproj not found. Make sure you're running this from the project root." $ErrorColor
        exit 1
    }
    
    if (-not (Test-Command "dotnet")) {
        Write-ColorText "❌ Error: .NET SDK not found. Please install .NET 8.0 SDK." $ErrorColor
        exit 1
    }
    
    Set-Location "PersonalSiteAPI"
    
    if ($NoWatch) {
        Write-ColorText "▶️  Running: dotnet run" $InfoColor
        Start-Process powershell -ArgumentList "-Command", "dotnet run; Read-Host 'Press Enter to close...'" -NoNewWindow
    } else {
        Write-ColorText "▶️  Running: dotnet watch run (with file watching)" $InfoColor
        Start-Process powershell -ArgumentList "-Command", "dotnet watch run; Read-Host 'Press Enter to close...'" -NoNewWindow
    }
    
    Set-Location ".."
    Write-ColorText "✅ Backend started on https://localhost:40443 and http://localhost:40080" $SuccessColor
}

function Start-Frontend {
    Write-ColorText "🌐 Starting PersonalSite (Angular 18)..." $InfoColor
    
    if (-not (Test-Path "PersonalSite/package.json")) {
        Write-ColorText "❌ Error: package.json not found in PersonalSite directory." $ErrorColor
        exit 1
    }
    
    if (-not (Test-Command "npm")) {
        Write-ColorText "❌ Error: npm not found. Please install Node.js." $ErrorColor
        exit 1
    }
    
    Set-Location "PersonalSite"
    
    # Check if node_modules exists
    if (-not (Test-Path "node_modules")) {
        Write-ColorText "📦 Installing npm dependencies..." $WarningColor
        npm install
        if ($LASTEXITCODE -ne 0) {
            Write-ColorText "❌ Error: npm install failed." $ErrorColor
            Set-Location ".."
            exit 1
        }
    }
    
    Write-ColorText "▶️  Running: npm start (with SSL certificates)" $InfoColor
    Start-Process powershell -ArgumentList "-Command", "npm start; Read-Host 'Press Enter to close...'" -NoNewWindow
    
    Set-Location ".."
    Write-ColorText "✅ Frontend will start on https://localhost:4200 (may take a moment to compile)" $SuccessColor
}

# Main execution
Write-ColorText "🎯 Wildlife Tracker Development Startup Script" $InfoColor
Write-ColorText "===============================================" $InfoColor

# Check if we're in the right directory
if (-not (Test-Path "PersonalSite.sln")) {
    Write-ColorText "❌ Error: PersonalSite.sln not found. Please run this script from the project root directory." $ErrorColor
    exit 1
}

if ($ApiOnly) {
    Start-Backend
} elseif ($FrontendOnly) {
    Start-Frontend
} else {
    # Start both
    Start-Backend
    Start-Sleep -Seconds 2  # Give backend a moment to start
    Start-Frontend
    
    Write-ColorText "" 
    Write-ColorText "🎉 Both services are starting!" $SuccessColor
    Write-ColorText "📡 API: https://localhost:40443 (Swagger: https://localhost:40443/swagger)" $InfoColor
    Write-ColorText "🌐 Frontend: https://localhost:4200" $InfoColor
    Write-ColorText "" 
    Write-ColorText "💡 The Angular app will automatically proxy API calls to the backend." $InfoColor
    Write-ColorText "⏹️  Press Ctrl+C in either terminal window to stop that service." $WarningColor
    Write-ColorText "📝 Check the individual terminal windows for detailed logs." $InfoColor
}

Write-ColorText ""
Write-ColorText "✨ Development environment ready!" $SuccessColor