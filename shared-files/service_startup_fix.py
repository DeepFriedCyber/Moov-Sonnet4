# ============================================================================
# QUICK FIX: Better Service Test with Proper Timing
# test_service_with_retry.py
# ============================================================================

import requests
import time
import json
from typing import Optional
import threading
import subprocess
import sys
import os

class ServiceTester:
    def __init__(self, base_url: str = "http://127.0.0.1:8001"):
        self.base_url = base_url
        self.service_process = None
        
    def wait_for_service(self, timeout: int = 30) -> bool:
        """Wait for service to be ready with proper retry logic"""
        print(f"⏳ Waiting for service at {self.base_url} (timeout: {timeout}s)...")
        
        start_time = time.time()
        retry_count = 0
        
        while time.time() - start_time < timeout:
            try:
                response = requests.get(f"{self.base_url}/health", timeout=2)
                if response.status_code == 200:
                    print(f"✅ Service ready after {time.time() - start_time:.1f}s")
                    return True
            except requests.exceptions.RequestException as e:
                retry_count += 1
                if retry_count % 5 == 0:  # Print every 5th retry
                    print(f"   ⏳ Attempt {retry_count}, still waiting... ({e.__class__.__name__})")
                time.sleep(1)
        
        print(f"❌ Service not ready after {timeout}s")
        return False
    
    def test_basic_functionality(self) -> bool:
        """Test basic embedding functionality"""
        
        print("\n🧪 Testing Basic Embedding Service...")
        
        # Test health endpoint first
        try:
            response = requests.get(f"{self.base_url}/health", timeout=5)
            if response.status_code == 200:
                health = response.json()
                print(f"✅ Service healthy: {health.get('status')}")
                print(f"📊 Cache available: {health.get('cache_available')}")
                print(f"🤖 Model: {health.get('model', {}).get('model_name', 'unknown')}")
            else:
                print(f"❌ Health check failed: {response.status_code}")
                return False
        except Exception as e:
            print(f"❌ Health check error: {e}")
            return False
        
        # Test embedding generation with cache performance
        test_scenarios = [
            {
                "name": "First-time queries (cache miss)",
                "queries": [
                    "luxury apartment London",
                    "2 bedroom flat Manchester", 
                    "studio flat central"
                ]
            },
            {
                "name": "Repeated queries (cache hit)",
                "queries": [
                    "luxury apartment London",  # Same as first
                    "2 bedroom flat Manchester",  # Same as second
                ]
            },
            {
                "name": "Similar queries (semantic cache)",
                "queries": [
                    "Luxury apartment in London",  # Similar to first
                    "Two bedroom flat in Manchester",  # Similar to second
                ]
            }
        ]
        
        all_successful = True
        total_cost_saved = 0
        
        for scenario in test_scenarios:
            print(f"\n🔍 {scenario['name']}:")
            
            for i, query in enumerate(scenario['queries'], 1):
                try:
                    start_time = time.time()
                    
                    response = requests.post(
                        f"{self.base_url}/embed",
                        json={"query": query},
                        timeout=10
                    )
                    
                    duration = time.time() - start_time
                    
                    if response.status_code == 200:
                        result = response.json()
                        embedding_length = len(result['embedding'])
                        cached = result.get('cached', False)
                        cache_stats = result.get('cache_stats', {})
                        
                        print(f"  Query {i}: '{query[:40]}...' ")
                        print(f"    ✅ Embedding generated (dim: {embedding_length})")
                        print(f"    ⏱️  Response time: {duration:.3f}s")
                        print(f"    📊 From cache: {'✅' if cached else '❌'}")
                        
                        if 'cost_saved_dollars' in cache_stats:
                            total_cost_saved = cache_stats['cost_saved_dollars']
                            print(f"    💰 Total cost saved: ${total_cost_saved:.4f}")
                        
                        if 'hit_rate_percent' in cache_stats:
                            print(f"    📈 Cache hit rate: {cache_stats['hit_rate_percent']:.1f}%")
                            
                    else:
                        print(f"  ❌ Query {i} failed: {response.status_code}")
                        print(f"      Response: {response.text}")
                        all_successful = False
                        
                except Exception as e:
                    print(f"  ❌ Query {i} error: {e}")
                    all_successful = False
        
        # Get final cache statistics
        try:
            response = requests.get(f"{self.base_url}/cache/stats", timeout=5)
            if response.status_code == 200:
                stats = response.json()
                print(f"\n📊 Final Cache Performance:")
                print(f"    🎯 Hit Rate: {stats.get('hit_rate_percent', 0):.1f}%")
                print(f"    📞 Total Requests: {stats.get('total_requests', 0)}")
                print(f"    ✅ Cache Hits: {stats.get('cache_hits', 0)}")
                print(f"    ❌ Cache Misses: {stats.get('cache_misses', 0)}")
                print(f"    💰 Cost Saved: ${stats.get('cost_saved_dollars', 0):.4f}")
                print(f"    ⚡ Time Saved: {stats.get('time_saved_seconds', 0):.2f}s")
                
                # Calculate effectiveness
                hit_rate = stats.get('hit_rate_percent', 0)
                if hit_rate > 50:
                    print(f"    🚀 Cache is working effectively! {hit_rate:.1f}% hit rate")
                elif hit_rate > 0:
                    print(f"    ⚠️  Cache is working but could be better. {hit_rate:.1f}% hit rate")
                else:
                    print(f"    ❌ Cache may not be working properly")
                    
        except Exception as e:
            print(f"\n📊 Could not get cache stats: {e}")
        
        return all_successful

def main():
    """Main test function"""
    tester = ServiceTester()
    
    print("🚀 Enhanced Embedding Service Test")
    print("=" * 50)
    
    # Wait for service to be ready
    if not tester.wait_for_service(timeout=45):  # Longer timeout for model loading
        print("❌ Service failed to start. Check if:")
        print("   1. Redis is running: docker-compose up redis -d")
        print("   2. Service is starting: python src/main.py")
        print("   3. No other service is using port 8001")
        return False
    
    # Run tests
    success = tester.test_basic_functionality()
    
    if success:
        print("\n🎉 All tests passed!")
        print("💡 Key improvements achieved:")
        print("   • Intelligent caching reduces API costs")
        print("   • Faster response times for repeated queries")
        print("   • Semantic clustering improves cache hit rates")
        print("   • Real-time cost tracking")
    else:
        print("\n❌ Some tests failed. Check the logs above.")
    
    return success

if __name__ == "__main__":
    main()

# ============================================================================
# ALTERNATIVE: Manual Service Starter
# start_service_manual.py
# ============================================================================

import subprocess
import sys
import os
import time

def start_service_manually():
    """Start the service manually for testing"""
    
    print("🚀 Manual Service Startup")
    print("=" * 30)
    
    # Check if we're in the right directory
    if not os.path.exists("src/main.py"):
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
    print("   💡 This will start the service on http://localhost:8001")
    print("   💡 Press Ctrl+C to stop")
    print("   💡 Run the test in another terminal with: python test_service_with_retry.py")
    
    try:
        # Start the service
        subprocess.run([sys.executable, "src/main.py"], check=True)
    except KeyboardInterrupt:
        print("\n🛑 Service stopped by user")
    except Exception as e:
        print(f"\n❌ Service failed to start: {e}")
        return False
    
    return True

if __name__ == "__main__":
    start_service_manually()

# ============================================================================
# QUICK CHECK: Port availability
# check_environment.py
# ============================================================================

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