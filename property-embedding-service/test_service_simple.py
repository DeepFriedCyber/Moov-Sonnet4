import requests
import time
import json

def test_basic_functionality():
    """Test the service is working without complex caching"""
    
    base_url = "http://127.0.0.1:8001"
    
    print("🧪 Testing Basic Embedding Service...")
    
    # Test health endpoint
    try:
        response = requests.get(f"{base_url}/health")
        if response.status_code == 200:
            health = response.json()
            print(f"✅ Service is healthy: {health['status']}")
            print(f"📊 Cache available: {health['cache_available']}")
        else:
            print(f"❌ Health check failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Cannot connect to service: {e}")
        print("💡 Make sure to start the service with: python src/main_simple.py")
        return False
    
    # Test embedding generation
    test_queries = [
        "luxury apartment London",
        "2 bedroom flat Manchester",
        "studio flat central"
    ]
    
    print("\n🔍 Testing Embedding Generation...")
    
    for i, query in enumerate(test_queries, 1):
        try:
            start_time = time.time()
            
            response = requests.post(
                f"{base_url}/embed",
                json={"query": query}
            )
            
            duration = time.time() - start_time
            
            if response.status_code == 200:
                result = response.json()
                embedding_length = len(result['embedding'])
                
                print(f"  Query {i}: '{query}'")
                print(f"    ✅ Generated embedding (dim: {embedding_length})")
                print(f"    ⏱️  Time: {duration:.3f}s")
                print(f"    📊 Cached: {result.get('cached', False)}")
                
                # Test the same query again to see if caching works
                start_time = time.time()
                response2 = requests.post(f"{base_url}/embed", json={"query": query})
                duration2 = time.time() - start_time
                
                if response2.status_code == 200:
                    result2 = response2.json()
                    print(f"    🔄 Second call: {duration2:.3f}s (cached: {result2.get('cached', False)})")
                    
                    if duration2 < duration * 0.5:  # At least 50% faster
                        print(f"    🚀 Caching working! {((duration - duration2) / duration * 100):.1f}% faster")
                
            else:
                print(f"  ❌ Query {i} failed: {response.status_code}")
                
        except Exception as e:
            print(f"  ❌ Query {i} error: {e}")
    
    # Test cache stats if available
    try:
        response = requests.get(f"{base_url}/cache/stats")
        if response.status_code == 200:
            stats = response.json()
            print(f"\n📊 Cache Statistics:")
            print(f"    Hit Rate: {stats.get('hit_rate_percent', 0)}%")
            print(f"    Total Requests: {stats.get('total_requests', 0)}")
            print(f"    Cost Saved: ${stats.get('cost_saved_dollars', 0)}")
    except:
        print("\n📊 Cache stats not available")
    
    print("\n✅ Basic functionality test complete!")
    return True

if __name__ == "__main__":
    test_basic_functionality()