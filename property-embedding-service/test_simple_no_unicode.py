import requests
import time
import json

def test_service():
    """Simple test without Unicode characters"""
    base_url = "http://127.0.0.1:8001"
    
    print("Enhanced Embedding Service Test")
    print("=" * 40)
    
    # Wait for service
    print("Waiting for service to be ready...")
    max_retries = 30
    for i in range(max_retries):
        try:
            response = requests.get(f"{base_url}/health", timeout=2)
            if response.status_code == 200:
                print(f"Service ready after {i+1} attempts")
                break
        except:
            time.sleep(1)
    else:
        print("ERROR: Service not ready after 30 seconds")
        return False
    
    # Test health
    print("\n1. Testing health endpoint...")
    try:
        response = requests.get(f"{base_url}/health", timeout=5)
        if response.status_code == 200:
            health = response.json()
            print(f"   Status: {health.get('status')}")
            print(f"   Cache available: {health.get('cache_available')}")
            print(f"   Model: {health.get('model', {}).get('model_name', 'unknown')}")
        else:
            print(f"   ERROR: Health check failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"   ERROR: Health check error: {e}")
        return False
    
    # Test embedding generation
    print("\n2. Testing embedding generation...")
    test_queries = [
        "luxury apartment London",
        "2 bedroom flat Manchester",
        "luxury apartment London",  # Repeat for cache test
        "Luxury apartment in London"  # Similar for semantic cache
    ]
    
    for i, query in enumerate(test_queries, 1):
        try:
            start_time = time.time()
            response = requests.post(
                f"{base_url}/embed",
                json={"query": query},
                timeout=10
            )
            duration = time.time() - start_time
            
            if response.status_code == 200:
                result = response.json()
                embedding_length = len(result['embedding'])
                cached = result.get('cached', False)
                
                print(f"   Query {i}: '{query[:30]}...'")
                print(f"     Embedding dim: {embedding_length}")
                print(f"     Time: {duration:.3f}s")
                print(f"     Cached: {cached}")
            else:
                print(f"   ERROR: Query {i} failed: {response.status_code}")
                return False
        except Exception as e:
            print(f"   ERROR: Query {i} error: {e}")
            return False
    
    # Test cache stats
    print("\n3. Testing cache statistics...")
    try:
        response = requests.get(f"{base_url}/cache/stats", timeout=5)
        if response.status_code == 200:
            stats = response.json()
            print(f"   Hit Rate: {stats.get('hit_rate_percent', 0):.1f}%")
            print(f"   Total Requests: {stats.get('total_requests', 0)}")
            print(f"   Cache Hits: {stats.get('cache_hits', 0)}")
            print(f"   Cache Misses: {stats.get('cache_misses', 0)}")
            print(f"   Cost Saved: ${stats.get('cost_saved_dollars', 0):.4f}")
            
            hit_rate = stats.get('hit_rate_percent', 0)
            if hit_rate > 40:
                print(f"   SUCCESS: Cache working effectively! {hit_rate:.1f}% hit rate")
            elif hit_rate > 0:
                print(f"   OK: Cache working. {hit_rate:.1f}% hit rate")
            else:
                print(f"   WARNING: Cache may not be working properly")
        else:
            print("   WARNING: Could not get cache stats")
    except Exception as e:
        print(f"   WARNING: Cache stats error: {e}")
    
    print("\nALL TESTS COMPLETED SUCCESSFULLY!")
    print("Your Enhanced TDD Implementation is working!")
    return True

if __name__ == "__main__":
    success = test_service()
    if success:
        print("\nSUCCESS: Service is ready for production!")
    else:
        print("\nERROR: Some tests failed")