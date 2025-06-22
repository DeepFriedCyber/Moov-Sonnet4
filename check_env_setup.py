#!/usr/bin/env python3
"""
Environment variables checker - verifies all .env files are properly configured
"""

import os
from pathlib import Path

def check_env_file(filepath, required_vars=None, optional_vars=None):
    """Check if env file exists and has required variables"""
    print(f"\n📋 Checking: {filepath}")
    
    if not os.path.exists(filepath):
        print(f"  ❌ File not found")
        return False
    
    print(f"  ✅ File exists")
    
    # Read env file
    env_vars = {}
    try:
        with open(filepath, 'r') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    env_vars[key.strip()] = value.strip()
    except Exception as e:
        print(f"  ❌ Error reading file: {e}")
        return False
    
    print(f"  📊 Found {len(env_vars)} variables")
    
    # Check required variables
    if required_vars:
        missing_required = []
        placeholder_vars = []
        
        for var in required_vars:
            if var not in env_vars:
                missing_required.append(var)
            elif env_vars[var] in ['', 'dev_placeholder', 'your_api_key', 'change_me']:
                placeholder_vars.append(var)
        
        if missing_required:
            print(f"  ❌ Missing required variables: {', '.join(missing_required)}")
            return False
        
        if placeholder_vars:
            print(f"  ⚠️  Variables with placeholder values: {', '.join(placeholder_vars)}")
            print(f"     💡 These should be updated with real values for production")
    
    print(f"  ✅ Environment file is properly configured")
    return True

def main():
    """Check all environment files"""
    print("🔍 Environment Variables Setup Check")
    print("=" * 50)
    
    project_root = Path(__file__).parent
    
    # Define files to check with their requirements
    env_files = [
        {
            'path': project_root / 'property-search-api' / '.env',
            'required': ['DATABASE_URL', 'JWT_SECRET', 'PORT'],
            'optional': ['REDIS_URL', 'GOOGLE_PLACES_API_KEY']
        },
        {
            'path': project_root / 'property-search-frontend' / '.env.local',
            'required': ['NEXT_PUBLIC_API_URL', 'NEXTAUTH_URL', 'NEXTAUTH_SECRET'],
            'optional': ['NEXT_PUBLIC_MAPTILER_KEY', 'NEXT_PUBLIC_GOOGLE_PLACES_KEY']
        },
        {
            'path': project_root / 'property-embedding-service' / '.env',
            'required': ['API_PORT', 'MODEL_NAME', 'API_BASE_URL'],
            'optional': ['REDIS_URL', 'API_KEY']
        }
    ]
    
    all_good = True
    
    for env_file in env_files:
        result = check_env_file(
            env_file['path'],
            env_file.get('required'),
            env_file.get('optional')
        )
        if not result:
            all_good = False
    
    print("\n" + "=" * 50)
    
    if all_good:
        print("🎉 All environment files are properly configured!")
        print("\n📋 Next steps:")
        print("   1. Update placeholder values with real API keys when needed")
        print("   2. Run: python check_db.py (to verify database connection)")
        print("   3. Start services: npm run dev (or docker-compose up)")
    else:
        print("❌ Some environment files need attention!")
        print("\n🔧 Troubleshooting:")
        print("   1. Check the missing files above")
        print("   2. Copy from .env.example files if needed")
        print("   3. Add required environment variables")
        print("   4. Re-run this script to verify")
    
    return all_good

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)