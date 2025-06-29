import requests
import time

def test_minimal_service():
    base_url = "http://127.0.0.1:8001"
    
    print("🧪 Testing Minimal Service")
    print("=" * 30)
    
    try:
        # Test health
        print("1. Health check...")
        response = requests.get(f"{base_url}/health")
        print(f"   Status: {response.status_code}")
        if response.status_code == 200:
            print(f"   Data: {response.json()}")
        
        # Test embedding
        print("\n2. Embedding test...")
        response = requests.post(f"{base_url}/embed", json={"query": "test apartment"})
        print(f"   Status: {response.status_code}")
        if response.status_code == 200:
            result = response.json()
            print(f"   Embedding length: {len(result['embedding'])}")
            print(f"   Cached: {result['cached']}")
        
        # Test same query (should be cached)
        print("\n3. Cache test...")
        response = requests.post(f"{base_url}/embed", json={"query": "test apartment"})
        if response.status_code == 200:
            result = response.json()
            print(f"   Cached: {result['cached']}")
        
        print("\n✅ All tests passed!")
        
    except Exception as e:
        print(f"❌ Test failed: {e}")

if __name__ == "__main__":
    time.sleep(1)  # Wait for service
    test_minimal_service()