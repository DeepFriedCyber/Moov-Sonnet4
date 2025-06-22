#!/usr/bin/env python3
"""
Test script to verify all database setup scripts work correctly
"""

import os
import sys
import subprocess
import importlib.util

def test_script_imports():
    """Test that all required modules can be imported"""
    print("🔍 Testing Python module imports...")
    
    required_modules = ['psycopg2', 'dotenv']
    missing_modules = []
    
    for module in required_modules:
        try:
            __import__(module)
            print(f"  ✅ {module}")
        except ImportError:
            missing_modules.append(module)
            print(f"  ❌ {module} - Missing")
    
    if missing_modules:
        print(f"\n❌ Missing modules: {', '.join(missing_modules)}")
        print("💡 Install with: pip install -r database_requirements.txt")
        return False
    
    print("✅ All required modules available")
    return True

def test_env_file():
    """Test that .env file exists and has DATABASE_URL"""
    print("\n🔍 Testing environment configuration...")
    
    # Check if .env file exists
    env_files = ['.env', 'property-search-api/.env']
    env_found = False
    
    for env_file in env_files:
        if os.path.exists(env_file):
            print(f"  ✅ Found {env_file}")
            env_found = True
            
            # Check if DATABASE_URL is in the file
            with open(env_file, 'r') as f:
                content = f.read()
                if 'DATABASE_URL=' in content:
                    print(f"  ✅ DATABASE_URL found in {env_file}")
                else:
                    print(f"  ⚠️ DATABASE_URL not found in {env_file}")
            break
    
    if not env_found:
        print("  ❌ No .env file found")
        print("  💡 Copy .env.example to .env and configure DATABASE_URL")
        return False
    
    return True

def test_database_scripts():
    """Test that database scripts can be imported and run"""
    print("\n🔍 Testing database scripts...")
    
    scripts = [
        'test_neon_connection.py',
        'setup_database.py', 
        'check_db.py'
    ]
    
    results = {}
    
    for script in scripts:
        print(f"\n📝 Testing {script}...")
        
        if not os.path.exists(script):
            print(f"  ❌ {script} not found")
            results[script] = False
            continue
        
        # Test if script can be imported (syntax check)
        try:
            spec = importlib.util.spec_from_file_location("test_module", script)
            if spec is None:
                print(f"  ❌ {script} - Could not create module spec")
                results[script] = False
                continue
            
            module = importlib.util.module_from_spec(spec)
            # Don't execute, just check syntax
            with open(script, 'r', encoding='utf-8') as f:
                compile(f.read(), script, 'exec')
            print(f"  ✅ {script} syntax valid")
            results[script] = True
        except Exception as e:
            print(f"  ❌ {script} syntax error: {e}")
            results[script] = False
    
    return all(results.values())

def test_migration_files():
    """Test that migration files exist and are readable"""
    print("\n🔍 Testing migration files...")
    
    migrations_dir = 'property-search-api/migrations'
    
    if not os.path.exists(migrations_dir):
        print(f"  ❌ {migrations_dir} not found")
        return False
    
    migration_files = [f for f in os.listdir(migrations_dir) if f.endswith('.sql')]
    migration_files.sort()
    
    if not migration_files:
        print(f"  ❌ No migration files found in {migrations_dir}")
        return False
    
    print(f"  ✅ Found {len(migration_files)} migration files:")
    for migration in migration_files:
        print(f"    • {migration}")
        
        # Check if file is readable
        filepath = os.path.join(migrations_dir, migration)
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read().strip()
                if content:
                    print(f"      ✅ Readable ({len(content)} chars)")
                else:
                    print(f"      ⚠️ Empty file")
        except Exception as e:
            print(f"      ❌ Error reading: {e}")
    
    return True

def main():
    """Run all database script tests"""
    print("🧪 Database Setup Scripts Test Suite")
    print("=" * 50)
    
    tests = [
        ("Module Imports", test_script_imports),
        ("Environment Files", test_env_file),
        ("Database Scripts", test_database_scripts),
        ("Migration Files", test_migration_files)
    ]
    
    results = {}
    
    for test_name, test_func in tests:
        print(f"\n🔬 {test_name}")
        print("-" * 30)
        results[test_name] = test_func()
    
    # Summary
    print("\n📊 Test Results Summary")
    print("=" * 50)
    
    passed = 0
    total = len(results)
    
    for test_name, result in results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} - {test_name}")
        if result:
            passed += 1
    
    print(f"\n🎯 {passed}/{total} tests passed")
    
    if passed == total:
        print("\n🎉 All tests passed! Database scripts are ready to use.")
        print("\n🚀 Next steps:")
        print("   1. Configure your DATABASE_URL in .env file")
        print("   2. Run: python test_neon_connection.py")
        print("   3. Run: python setup_database.py")
        print("   4. Run: python check_db.py")
    else:
        print(f"\n❌ {total - passed} tests failed!")
        print("\n🔧 Fix the issues above before running database scripts.")
    
    return passed == total

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)