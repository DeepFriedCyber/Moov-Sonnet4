import requests
import json
import time

def test_service():
    base_url = "http://127.0.0.1:8001"
    
    print("🧪 Quick Service Test")
    print("=" * 30)
    
    # Test 1: Health check
    try:
        print("1. Testing health endpoint...")
        response = requests.get(f"{base_url}/health", timeout=10)
        if response.status_code == 200:
            health = response.json()
            print(f"   ✅ Status: {health['status']}")
            print(f"   📊 Cache: {health['cache_available']}")
            print(f"   🤖 Model: {health['model']['model_name']}")
        else:
            print(f"   ❌ Health check failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"   ❌ Health check error: {e}")
        return False
    
    # Test 2: Generate embedding
    try:
        print("\n2. Testing embedding generation...")
        test_query = "luxury apartment London"
        
        start_time = time.time()
        response = requests.post(
            f"{base_url}/embed",
            json={"query": test_query},
            timeout=30
        )
        duration = time.time() - start_time
        
        if response.status_code == 200:
            result = response.json()
            print(f"   ✅ Query: '{test_query}'")
            print(f"   📏 Embedding dimension: {len(result['embedding'])}")
            print(f"   ⏱️  Time: {duration:.3f}s")
            print(f"   💾 Cached: {result.get('cached', False)}")
            
            # Test same query again for caching
            print("\n3. Testing caching (same query)...")
            start_time = time.time()
            response2 = requests.post(
                f"{base_url}/embed",
                json={"query": test_query},
                timeout=30
            )
            duration2 = time.time() - start_time
            
            if response2.status_code == 200:
                result2 = response2.json()
                print(f"   ⏱️  Second call: {duration2:.3f}s")
                print(f"   💾 Cached: {result2.get('cached', False)}")
                
                if duration2 < duration * 0.8:
                    speedup = ((duration - duration2) / duration) * 100
                    print(f"   🚀 Speedup: {speedup:.1f}% faster!")
                
        else:
            print(f"   ❌ Embedding failed: {response.status_code}")
            print(f"   Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"   ❌ Embedding error: {e}")
        return False
    
    # Test 3: Cache stats
    try:
        print("\n4. Testing cache statistics...")
        response = requests.get(f"{base_url}/cache/stats", timeout=10)
        if response.status_code == 200:
            stats = response.json()
            print(f"   📊 Hit rate: {stats.get('hit_rate_percent', 0):.1f}%")
            print(f"   📈 Total requests: {stats.get('total_requests', 0)}")
            print(f"   💰 Cost saved: ${stats.get('cost_saved_dollars', 0):.4f}")
        else:
            print(f"   ⚠️  Cache stats not available")
    except Exception as e:
        print(f"   ⚠️  Cache stats error: {e}")
    
    print("\n✅ Service test completed successfully!")
    print("🎯 Your enhanced TDD embedding service is working!")
    return True

if __name__ == "__main__":
    # Wait a moment for service to be ready
    print("⏳ Waiting for service to be ready...")
    time.sleep(2)
    
    test_service()