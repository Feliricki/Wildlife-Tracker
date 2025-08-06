#!/bin/bash

# =============================================================================
# Wildlife Tracker Development Startup Script (Unix/Linux/macOS)
# =============================================================================
# Starts both the WildlifeTracker frontend and WildlifeTrackerAPI backend
# - WildlifeTrackerAPI (.NET 8.0) on https://localhost:40443 and http://localhost:40080  
# - WildlifeTracker (Angular 18) on https://localhost:4200 with SSL certificates
# =============================================================================

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

print_color() {
    printf "${2}${1}${NC}\n"
}

check_command() {
    if ! command -v "$1" &> /dev/null; then
        print_color "❌ Error: $1 not found. Please install $2." "$RED"
        exit 1
    fi
}

# Check if we're in the right directory
if [ ! -f "WildlifeTracker.sln" ]; then
    print_color "❌ Error: WildlifeTracker.sln not found. Please run this script from the project root directory." "$RED"
    exit 1
fi

print_color "🎯 Wildlife Tracker Development Startup Script" "$CYAN"
print_color "===============================================" "$CYAN"

# Check prerequisites
check_command "dotnet" ".NET 8.0 SDK"
check_command "npm" "Node.js"

# Check if projects exist
if [ ! -f "WildlifeTrackerAPI/WildlifeTrackerAPI.csproj" ]; then
    print_color "❌ Error: WildlifeTrackerAPI.csproj not found." "$RED"
    exit 1
fi

if [ ! -f "WildlifeTracker/package.json" ]; then
    print_color "❌ Error: package.json not found in WildlifeTracker directory." "$RED"
    exit 1
fi

# Function to start backend
start_backend() {
    print_color "🚀 Starting WildlifeTrackerAPI (.NET 8.0)..." "$CYAN"
    cd WildlifeTrackerAPI
    
    # Start backend in background
    if [ "$1" = "no-watch" ]; then
        print_color "▶️  Running: dotnet run" "$CYAN"
        dotnet run &
    else
        print_color "▶️  Running: dotnet watch run (with file watching)" "$CYAN"
        dotnet watch run &
    fi
    
    BACKEND_PID=$!
    cd ..
    print_color "✅ Backend started on https://localhost:40443 and http://localhost:40080" "$GREEN"
    sleep 2  # Give backend time to start
}

# Function to start frontend
start_frontend() {
    print_color "🌐 Starting WildlifeTracker (Angular 18)..." "$CYAN"
    cd WildlifeTracker
    
    # Check if node_modules exists
    if [ ! -d "node_modules" ]; then
        print_color "📦 Installing npm dependencies..." "$YELLOW"
        npm install
    fi
    
    print_color "▶️  Running: npm start (with SSL certificates)" "$CYAN"
    npm start &
    FRONTEND_PID=$!
    cd ..
    print_color "✅ Frontend will start on https://localhost:4200 (may take a moment to compile)" "$GREEN"
}

# Function to cleanup on exit
cleanup() {
    print_color "\n🛑 Shutting down services..." "$YELLOW"
    if [ ! -z "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null || true
    fi
    if [ ! -z "$FRONTEND_PID" ]; then
        kill $FRONTEND_PID 2>/dev/null || true
    fi
    print_color "✅ Services stopped." "$GREEN"
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Parse command line arguments
BACKEND_ONLY=false
FRONTEND_ONLY=false
NO_WATCH=false

for arg in "$@"; do
    case $arg in
        --backend-only)
            BACKEND_ONLY=true
            shift
            ;;
        --frontend-only)
            FRONTEND_ONLY=true
            shift
            ;;
        --no-watch)
            NO_WATCH=true
            shift
            ;;
        --help)
            print_color "Usage: ./start-dev.sh [OPTIONS]" "$CYAN"
            print_color "Options:" "$CYAN"
            print_color "  --backend-only   Start only the backend API" "$CYAN"
            print_color "  --frontend-only  Start only the frontend app" "$CYAN"
            print_color "  --no-watch       Start backend without file watching" "$CYAN"
            print_color "  --help           Show this help message" "$CYAN"
            exit 0
            ;;
        *)
            print_color "Unknown option: $arg. Use --help for usage information." "$RED"
            exit 1
            ;;
    esac
done

# Start services based on options
if [ "$BACKEND_ONLY" = true ]; then
    if [ "$NO_WATCH" = true ]; then
        start_backend "no-watch"
    else
        start_backend
    fi
elif [ "$FRONTEND_ONLY" = true ]; then
    start_frontend
else
    # Start both services
    if [ "$NO_WATCH" = true ]; then
        start_backend "no-watch"
    else
        start_backend
    fi
    start_frontend
    
    print_color "" 
    print_color "🎉 Both services are starting!" "$GREEN"
    print_color "📡 API: https://localhost:40443 (Swagger: https://localhost:40443/swagger)" "$CYAN"
    print_color "🌐 Frontend: https://localhost:4200" "$CYAN"
    print_color "" 
    print_color "💡 The Angular app will automatically proxy API calls to the backend." "$CYAN"
    print_color "⏹️  Press Ctrl+C to stop all services." "$YELLOW"
fi

print_color ""
print_color "✨ Development environment ready!" "$GREEN"
print_color "Press Ctrl+C to stop all services..." "$YELLOW"

# Wait for processes to finish or for interrupt
wait
