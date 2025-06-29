import socket
import subprocess
import sys

def check_port(host: str, port: int) -> bool:
    """Check if a port is available"""
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(1)
            result = s.connect_ex((host, port))
            return result == 0  # 0 means port is open/in use
    except Exception:
        return False

def check_environment():
    """Check if environment is ready"""
    print("🔍 Environment Check")
    print("=" * 20)
    
    # Check Python version
    print(f"🐍 Python version: {sys.version}")
    
    # Check required packages
    required_packages = ['fastapi', 'uvicorn', 'redis', 'sentence_transformers']
    for package in required_packages:
        try:
            __import__(package)
            print(f"✅ {package} installed")
        except ImportError:
            print(f"❌ {package} missing")
    
    # Check Redis
    print("\n🗄️  Redis check:")
    if check_port('localhost', 6379):
        print("✅ Redis is running on port 6379")
        try:
            import redis
            r = redis.Redis(host='localhost', port=6379)
            r.ping()
            print("✅ Redis responds to ping")
        except Exception as e:
            print(f"❌ Redis connection failed: {e}")
    else:
        print("❌ Redis not running on port 6379")
        print("💡 Start with: docker-compose up redis -d")
    
    # Check port 8001
    print("\n🌐 Port 8001 check:")
    if check_port('localhost', 8001):
        print("⚠️  Port 8001 is already in use")
        print("💡 Stop existing service or use different port")
    else:
        print("✅ Port 8001 is available")
    
    print("\n🎯 Ready to start service!")

if __name__ == "__main__":
    check_environment()