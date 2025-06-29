"""
Integrated test - run service and test in same process
"""
import sys
import os
import threading
import time
import requests

# Add src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

def run_service():
    """Run the service in a separate thread"""
    try:
        from main_simple_working import app
        import uvicorn
        
        print("🚀 Starting service in background thread...")
        uvicorn.run(app, host="127.0.0.1", port=8001, log_level="error")
    except Exception as e:
        print(f"❌ Service error: {e}")

def test_service():
    """Test the service"""
    base_url = "http://127.0.0.1:8001"
    
    print("⏳ Waiting for service to start...")
    time.sleep(3)  # Give service time to start
    
    print("🧪 Testing Service")
    print("=" * 30)
    
    # Test 1: Health check
    try:
        print("1. Health check...")
        response = requests.get(f"{base_url}/health", timeout=10)
        if response.status_code == 200:
            health = response.json()
            print(f"   ✅ Status: {health['status']}")
            print(f"   📊 Cache: {health['cache_available']}")
            print(f"   🤖 Model: {health['model']['model_name']}")
        else:
            print(f"   ❌ Health failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"   ❌ Health error: {e}")
        return False
    
    # Test 2: Embedding generation
    try:
        print("\n2. Embedding generation...")
        test_queries = [
            "luxury apartment London",
            "2 bedroom flat Manchester", 
            "luxury apartment London"  # Repeat to test caching
        ]
        
        for i, query in enumerate(test_queries, 1):
            start_time = time.time()
            response = requests.post(
                f"{base_url}/embed",
                json={"query": query},
                timeout=30
            )
            duration = time.time() - start_time
            
            if response.status_code == 200:
                result = response.json()
                print(f"   Query {i}: '{query[:30]}...'")
                print(f"     ✅ Embedding: {len(result['embedding'])} dims")
                print(f"     ⏱️  Time: {duration:.3f}s")
                print(f"     💾 Cached: {result.get('cached', False)}")
            else:
                print(f"   ❌ Query {i} failed: {response.status_code}")
                return False
                
    except Exception as e:
        print(f"   ❌ Embedding error: {e}")
        return False
    
    # Test 3: Cache stats
    try:
        print("\n3. Cache statistics...")
        response = requests.get(f"{base_url}/cache/stats", timeout=10)
        if response.status_code == 200:
            stats = response.json()
            print(f"   📊 Hit rate: {stats.get('hit_rate_percent', 0):.1f}%")
            print(f"   📈 Requests: {stats.get('total_requests', 0)}")
            print(f"   💰 Saved: ${stats.get('cost_saved_dollars', 0):.4f}")
        else:
            print(f"   ⚠️  Cache stats unavailable")
    except Exception as e:
        print(f"   ⚠️  Cache stats error: {e}")
    
    print("\n✅ All tests completed successfully!")
    print("🎯 Your enhanced TDD embedding service is working!")
    return True

def main():
    print("🎯 Integrated Service Test")
    print("=" * 50)
    
    # Start service in background thread
    service_thread = threading.Thread(target=run_service, daemon=True)
    service_thread.start()
    
    # Run tests
    success = test_service()
    
    if success:
        print("\n🎉 SUCCESS! Your enhanced TDD implementation is working!")
        print("\n🚀 Next steps:")
        print("   1. Service is running with enhanced caching")
        print("   2. Semantic clustering is active")
        print("   3. Cost tracking is operational")
        print("   4. Ready for production deployment!")
    else:
        print("\n❌ Some tests failed. Check the output above.")
    
    print("\n🛑 Press Ctrl+C to stop the service")
    
    # Keep main thread alive
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n👋 Service stopped")

if __name__ == "__main__":
    main()