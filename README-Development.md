# Wildlife Tracker - Development Setup

This document explains how to run the Wildlife Tracker application in development mode, which consists of an Angular frontend and a .NET Core backend.

## Project Structure

- **PersonalSite/** - Angular 18 frontend application
- **PersonalSiteAPI/** - .NET 8.0 backend API
- **PersonalSiteAPI.Tests/** - Backend unit tests

## Prerequisites

Before running the application, ensure you have the following installed:

1. **.NET 8.0 SDK** - [Download here](https://dotnet.microsoft.com/download/dotnet/8.0)
2. **Node.js (18+)** - [Download here](https://nodejs.org/)
3. **npm** (comes with Node.js)

## Quick Start

### Option 1: PowerShell Script (Recommended for Windows)

```powershell
# Run both frontend and backend
.\start-dev.ps1

# Additional options:
.\start-dev.ps1 -NoWatch          # Backend without file watching
.\start-dev.ps1 -ApiOnly          # Only backend
.\start-dev.ps1 -FrontendOnly     # Only frontend
```

### Option 2: Batch File (Windows Alternative)

```cmd
start-dev.bat
```

### Option 3: NPM Scripts (Cross-platform)

First, install the npm dependencies for the development scripts:

```bash
npm install
```

Then use these commands:

```bash
# Run both frontend and backend
npm run dev

# Run only backend API
npm run dev:api-only

# Run only frontend
npm run dev:frontend-only

# Install frontend dependencies
npm run install:frontend
```

### Option 4: Manual Setup

If you prefer to run each service manually:

**Terminal 1 - Backend API:**
```bash
cd PersonalSiteAPI
dotnet watch run
```

**Terminal 2 - Frontend:**
```bash
cd PersonalSite
npm install  # First time only
npm start
```

## Application URLs

Once both services are running:

- **Frontend (Angular)**: https://localhost:4200
- **Backend API**: https://localhost:40443
- **API Documentation (Swagger)**: https://localhost:40443/swagger
- **Backend (HTTP)**: http://localhost:40080

## Development Features

### Frontend (Angular)
- **Hot Reload**: Code changes automatically refresh the browser
- **SSL Enabled**: Runs with HTTPS certificates for secure development
- **API Proxy**: Automatically proxies `/api/*` requests to the backend
- **Service Worker**: Progressive Web App features enabled

### Backend (.NET Core)
- **Hot Reload**: Code changes automatically restart the API (`dotnet watch run`)
- **Swagger UI**: Interactive API documentation at `/swagger`
- **CORS Enabled**: Configured for frontend development
- **HTTPS & HTTP**: Dual protocol support

## Troubleshooting

### Common Issues

**Backend fails to start:**
- Ensure .NET 8.0 SDK is installed: `dotnet --version`
- Check if ports 40443/40080 are available
- Verify you're in the project root directory

**Frontend fails to start:**
- Ensure Node.js is installed: `node --version`
- Install dependencies: `cd PersonalSite && npm install`
- Clear npm cache: `npm cache clean --force`

**SSL Certificate Issues:**
- The frontend automatically handles SSL certificate setup
- If you see certificate warnings, accept them for localhost
- Certificates are stored in `%APPDATA%\ASP.NET\https\`

**API Proxy Issues:**
- The frontend is configured to proxy API calls to the backend
- Proxy configuration is in `PersonalSite/src/proxy.conf.js`
- Ensure backend is running before starting frontend

### Port Conflicts

If the default ports are in use, you can modify:

**Backend ports** - Edit `PersonalSiteAPI/Properties/launchSettings.json`:
```json
{
  "applicationUrl": "https://localhost:YOUR_HTTPS_PORT;http://localhost:YOUR_HTTP_PORT"
}
```

**Frontend proxy** - Edit `PersonalSite/src/proxy.conf.js`:
```javascript
{
  "target": "https://localhost:YOUR_BACKEND_PORT"
}
```

## Building for Production

```bash
# Build backend
cd PersonalSiteAPI
dotnet build --configuration Release

# Build frontend
cd PersonalSite
npm run build
```

## Database Setup

If the application uses a database:
1. Update connection strings in `PersonalSiteAPI/appsettings.Development.json`
2. Run migrations: `cd PersonalSiteAPI && dotnet ef database update`

## Environment Variables

Create a `.env` file in the project root for any environment-specific settings:

```
ASPNETCORE_ENVIRONMENT=Development
API_BASE_URL=https://localhost:40443
```

---

**Happy Coding! 🚀**