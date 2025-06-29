#!/usr/bin/env python3
"""
Simple Property Embedding Service Startup Script
"""
import sys
import os
import subprocess
import time

# Add src directory to Python path
current_dir = os.path.dirname(os.path.abspath(__file__))
src_dir = os.path.join(current_dir, 'src')
sys.path.insert(0, src_dir)

def check_redis_connection():
    """Check if Redis is running and accessible"""
    try:
        import redis
        client = redis.from_url("redis://localhost:6379")
        client.ping()
        print("✅ Redis connection successful")
        return True
    except Exception as e:
        print(f"⚠️ Redis connection failed: {e}")
        print("Service will run without caching")
        return False

def check_dependencies():
    """Check if all required dependencies are installed"""
    required_packages = [
        'fastapi', 'uvicorn', 'numpy', 'sentence-transformers'
    ]
    
    missing_packages = []
    for package in required_packages:
        try:
            __import__(package.replace('-', '_'))
        except ImportError:
            missing_packages.append(package)
    
    if missing_packages:
        print(f"❌ Missing packages: {', '.join(missing_packages)}")
        print("Install with: pip install -r requirements.txt")
        return False
    
    print("✅ All dependencies installed")
    return True

def start_service():
    """Start the simple embedding service"""
    if not check_dependencies():
        return False
    
    redis_available = check_redis_connection()
    
    print("🚀 Starting Simple Property Embedding Service...")
    print("📊 Features:")
    print("  - Basic embedding generation")
    print("  - Enhanced caching:", "✅ Enabled" if redis_available else "❌ Disabled")
    print("  - Health monitoring")
    print()
    
    # Change to src directory and start the service
    os.chdir(src_dir)
    
    try:
        # Start with uvicorn
        subprocess.run([
            sys.executable, "-m", "uvicorn", 
            "main_simple:app", 
            "--host", "0.0.0.0", 
            "--port", "8001", 
            "--reload",
            "--log-level", "info"
        ])
    except KeyboardInterrupt:
        print("\n🛑 Service stopped by user")
    except Exception as e:
        print(f"❌ Error starting service: {e}")
        print("Trying alternative startup method...")
        
        # Fallback to direct python execution
        try:
            subprocess.run([sys.executable, "main_simple.py"])
        except Exception as e2:
            print(f"❌ Alternative startup failed: {e2}")
            return False
    
    return True

if __name__ == "__main__":
    print("🎯 Simple TDD Property Embedding Service")
    print("=" * 50)
    
    success = start_service()
    if not success:
        print("\n❌ Service startup failed. Please check the errors above.")
        sys.exit(1)