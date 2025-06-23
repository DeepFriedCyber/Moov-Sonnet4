# Virtual Environment Setup

This directory contains a properly configured virtual environment for the property-embedding-service.

## Quick Start

### 1. Activate the Virtual Environment
```powershell
.\activate_venv.ps1
```

### 2. Test Your Setup
```powershell
python test_imports.py
```

### 3. Run the Service
```powershell
python src/main_enhanced.py
```

## Manual Activation (Alternative)
If you prefer to activate manually:
```powershell
.\venv\Scripts\Activate.ps1
```

## Installed Packages
The virtual environment includes all required dependencies:
- ✅ fastapi==0.115.13
- ✅ prometheus_client==0.22.1  
- ✅ sentence-transformers==4.1.0
- ✅ torch==2.7.1+cpu
- ✅ redis==6.2.0
- ✅ And all other dependencies from requirements.txt

## Benefits of Using This Virtual Environment

1. **Isolation**: Your project dependencies are separate from other Python projects
2. **Reproducibility**: Exact versions are pinned and documented
3. **No Conflicts**: Avoids version conflicts with globally installed packages
4. **Clean Development**: Easy to reset/recreate if needed

## Troubleshooting

If you encounter import errors:
1. Make sure you activated the virtual environment first
2. Run `test_imports.py` to verify everything is working
3. If issues persist, you can recreate the environment:
   ```powershell
   Remove-Item -Recurse -Force venv
   python -m venv venv
   .\venv\Scripts\Activate.ps1
   pip install -r requirements.txt
   ```

## Development Workflow

Always remember to:
1. Activate the virtual environment before working
2. Install new packages within the virtual environment
3. Update requirements.txt when adding new dependencies