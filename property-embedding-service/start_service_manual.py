import subprocess
import sys
import os
import time

def start_service_manually():
    """Start the service manually for testing"""
    
    print("🚀 Manual Service Startup")
    print("=" * 30)
    
    # Check if we're in the right directory
    if not os.path.exists("src/main_simple_working.py"):
        print("❌ Please run this from the property-embedding-service directory")
        print("   Current directory:", os.getcwd())
        return False
    
    # Check Redis
    print("1. Checking Redis...")
    try:
        import redis
        r = redis.Redis(host='localhost', port=6379, decode_responses=True)
        r.ping()
        print("   ✅ Redis is running")
    except Exception as e:
        print(f"   ❌ Redis not available: {e}")
        print("   💡 Start Redis with: docker-compose up redis -d")
        return False
    
    # Start the service
    print("\n2. Starting embedding service...")
    print("   💡 This will start the service on http://127.0.0.1:8001")
    print("   💡 Press Ctrl+C to stop")
    print("   💡 Run the test in another terminal with: python test_service_with_retry.py")
    
    try:
        # Start the service
        subprocess.run([sys.executable, "src/main_simple_working.py"], check=True)
    except KeyboardInterrupt:
        print("\n🛑 Service stopped by user")
    except Exception as e:
        print(f"\n❌ Service failed to start: {e}")
        return False
    
    return True

if __name__ == "__main__":
    start_service_manually()