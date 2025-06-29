#!/usr/bin/env python3
"""
Windows-friendly startup script for Property Embedding Service
"""
import sys
import os
import time

# Add src directory to Python path
current_dir = os.path.dirname(os.path.abspath(__file__))
src_dir = os.path.join(current_dir, 'src')
sys.path.insert(0, src_dir)

def check_redis():
    """Check Redis connection"""
    try:
        import redis
        client = redis.from_url("redis://localhost:6379")
        client.ping()
        print("✅ Redis connection successful")
        return True
    except Exception as e:
        print(f"⚠️ Redis connection failed: {e}")
        return False

def check_dependencies():
    """Check dependencies"""
    required = ['fastapi', 'uvicorn', 'sentence_transformers', 'numpy']
    missing = []
    
    for pkg in required:
        try:
            __import__(pkg.replace('-', '_'))
        except ImportError:
            missing.append(pkg)
    
    if missing:
        print(f"❌ Missing: {', '.join(missing)}")
        return False
    
    print("✅ All dependencies available")
    return True

def main():
    print("🎯 Property Embedding Service - Windows Startup")
    print("=" * 50)
    
    if not check_dependencies():
        print("Install missing packages with: pip install fastapi uvicorn sentence-transformers numpy redis")
        return
    
    redis_ok = check_redis()
    
    print(f"🚀 Starting service...")
    print(f"📊 Redis: {'✅ Available' if redis_ok else '❌ Not available'}")
    
    # Change to src directory
    os.chdir(src_dir)
    
    # Import and run the app directly
    try:
        from main_working import app
        import uvicorn
        
        print("🌐 Service will be available at: http://localhost:8001")
        print("📖 API docs at: http://localhost:8001/docs")
        print("🛑 Press Ctrl+C to stop")
        print()
        
        uvicorn.run(app, host="127.0.0.1", port=8001, log_level="info")
        
    except KeyboardInterrupt:
        print("\n🛑 Service stopped")
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    main()