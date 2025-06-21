# 🚀 Development Workflow Guide

## Quick Start Options

### Option 1: VS Code Integrated Workflow (Recommended)

1. **Open the workspace:**
   ```bash
   code moov-property-search.code-workspace
   ```

2. **Start all services:**
   - Press `Ctrl+Shift+P` → "Tasks: Run Task" → "🚀 Start All Services"
   - Or press `Ctrl+Shift+B` (default build task)

3. **Access your applications:**
   - 🌐 Frontend: http://localhost:3000
   - 🚀 API: http://localhost:3001  
   - 🧠 Embedding: http://localhost:8001

### Option 2: Terminal Commands

```bash
# Start all services with concurrently
npm run dev

# Or individually:
npm run dev:api
npm run dev:frontend  
npm run dev:embedding
```

### Option 3: PowerShell Management Script

```powershell
# Start all services
.\dev-simple.ps1 start

# Check status
.\dev-simple.ps1 status

# View logs
.\dev-simple.ps1 logs

# Stop all
.\dev-simple.ps1 stop
```

## 🔧 VS Code Features

### Tasks Available (Ctrl+Shift+P → "Tasks")
- **🚀 Start All Services** - Launches all development servers
- **🛑 Stop All Services** - Kills all running services
- **📊 Check Server Status** - Shows which services are running
- **🧪 Test Flexible Import** - Tests the property import system

### Debug Configurations (F5)
- **Debug API Server** - Debug Node.js API with breakpoints
- **Debug Embedding Service** - Debug Python FastAPI service
- **Debug Flexible Import** - Debug the property import system
- **Debug All Services** - Debug API + Embedding together

### Multi-Root Workspace
- **🏠 Root** - Project overview and configuration
- **🚀 API** - Node.js/TypeScript backend
- **🌐 Frontend** - Next.js React frontend  
- **🧠 Embedding** - Python FastAPI AI service

## 📱 Testing the Flexible Import System

### Using VS Code:
1. Press `Ctrl+Shift+P` → "Tasks: Run Task" → "🧪 Test Flexible Import"

### Using Command Line:
```bash
cd property-search-api
python test_flexible_import.py
```

### Using API:
```bash
# Upload a CSV file
curl -X POST http://localhost:3001/api/upload/property-file \
  -F "file=@sample.csv" \
  -F "agentId=rightmove"

# Preview file columns
curl -X POST http://localhost:3001/api/upload/preview-columns \
  -F "file=@sample.csv"
```

## 🛠️ Development Tips

### Terminal Management
- Use **integrated terminal** (`Ctrl+``) for better integration
- Split terminals (`Ctrl+Shift+5`) for multiple services
- Use **terminal tabs** for organization

### File Navigation
- **Quick Open** (`Ctrl+P`) - Jump to any file
- **Symbol Search** (`Ctrl+T`) - Find functions/classes across project
- **Workspace Search** (`Ctrl+Shift+F`) - Search across all services

### Debugging
- Set breakpoints in any service
- Use **Debug Console** for interactive debugging
- **Watch variables** and **call stack** inspection

### Environment Management
- Edit `.env` files for each service
- Use **Settings Sync** to share configuration
- **Workspace settings** override user settings

## 📋 Service Information

| Service | Port | Purpose | Technology |
|---------|------|---------|------------|
| Frontend | 3000 | User Interface | Next.js, React, Tailwind |
| API | 3001 | Backend API | Node.js, Express, TypeScript |
| Embedding | 8001 | AI Search | Python, FastAPI, Transformers |

## 🔍 Troubleshooting

### Common Issues:

1. **Port conflicts:**
   ```powershell
   .\dev-simple.ps1 stop
   .\dev-simple.ps1 start
   ```

2. **Environment variables missing:**
   - Check `.env` files in each service directory
   - Copy from `.env.example` if needed

3. **Dependencies out of date:**
   ```bash
   npm run install:all
   ```

4. **Python modules missing:**
   ```bash
   cd property-embedding-service
   pip install -r requirements.txt
   ```

### View Logs:
```powershell
# All service logs
.\dev-simple.ps1 logs

# Specific service logs  
.\dev-simple.ps1 logs api
.\dev-simple.ps1 logs frontend
.\dev-simple.ps1 logs embedding
```

### Check Running Services:
```powershell
.\dev-simple.ps1 status
```

## 🎯 Next Steps

1. **Setup Database:** Update `NEON_DATABASE_URL` in API `.env`
2. **Configure External APIs:** Add real API keys when needed
3. **Test Import System:** Try uploading property CSV files
4. **Customize Mappings:** Edit `agent_field_mappings.json` for new agents

---

**Happy Coding! 🎉**