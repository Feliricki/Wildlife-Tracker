@echo off
setlocal EnableDelayedExpansion

REM =============================================================================
REM Wildlife Tracker Development Startup Script (Batch Version)
REM =============================================================================
REM Starts both the WildlifeTracker frontend and WildlifeTrackerAPI backend
REM - WildlifeTrackerAPI (.NET 8.0) on https://localhost:40443 and http://localhost:40080  
REM - WildlifeTracker (Angular 18) on https://localhost:4200 with SSL certificates
REM =============================================================================

echo.
echo 🎯 Wildlife Tracker Development Startup Script
echo ===============================================

REM Check if we're in the right directory
if not exist "WildlifeTrackerProject.sln" (
    echo ❌ Error: WildlifeTrackerProject.sln not found. Please run this script from the project root directory.
    pause
    exit /b 1
)

REM Check for .NET
dotnet --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Error: .NET SDK not found. Please install .NET 8.0 SDK.
    pause
    exit /b 1
)

REM Check for Node.js/npm
npm --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Error: npm not found. Please install Node.js.
    pause
    exit /b 1
)

REM Check if backend project exists
if not exist "WildlifeTrackerAPI\WildlifeTrackerAPI.csproj" (
    echo ❌ Error: WildlifeTrackerAPI.csproj not found.
    pause
    exit /b 1
)

REM Check if frontend project exists  
if not exist "WildlifeTracker\package.json" (
    echo ❌ Error: package.json not found in WildlifeTracker directory.
    pause
    exit /b 1
)

echo 🚀 Starting WildlifeTrackerAPI (.NET 8.0)...
cd WildlifeTrackerAPI
start "WildlifeTrackerAPI Backend" cmd /k "echo ▶️ Backend API starting... && dotnet watch run"
cd ..

echo ✅ Backend started on https://localhost:40443 and http://localhost:40080

REM Give backend a moment to start
timeout /t 3 /nobreak >nul

echo 🌐 Starting WildlifeTracker (Angular 18)...
cd WildlifeTracker

REM Check if node_modules exists and install if needed
if not exist "node_modules" (
    echo 📦 Installing npm dependencies...
    npm install
    if errorlevel 1 (
        echo ❌ Error: npm install failed.
        cd ..
        pause
        exit /b 1
    )
)

start "WildlifeTracker Frontend" cmd /k "echo ▶️ Frontend starting with SSL... && npm start"
cd ..

echo ✅ Frontend will start on https://localhost:4200 (may take a moment to compile)

echo.
echo 🎉 Both services are starting!
echo 📡 API: https://localhost:40443 (Swagger: https://localhost:40443/swagger)
echo 🌐 Frontend: https://localhost:4200
echo.
echo 💡 The Angular app will automatically proxy API calls to the backend.
echo ⏹️  Close the terminal windows to stop the services.
echo 📝 Check the individual terminal windows for detailed logs.
echo.
echo ✨ Development environment ready!
echo.
pause
