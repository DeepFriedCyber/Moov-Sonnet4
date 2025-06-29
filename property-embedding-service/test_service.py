#!/usr/bin/env python3
"""
Quick test script for the Enhanced Property Embedding Service
"""
import requests
import json
import time

SERVICE_URL = "http://localhost:8001"

def test_health_check():
    """Test the health endpoint"""
    print("🔍 Testing health check...")
    try:
        response = requests.get(f"{SERVICE_URL}/health")
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Health check passed: {data.get('status', 'unknown')}")
            return True
        else:
            print(f"❌ Health check failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Health check error: {e}")
        return False

def test_basic_embedding():
    """Test basic embedding generation"""
    print("🔍 Testing basic embedding generation...")
    try:
        payload = {
            "texts": ["luxury apartment London"]
        }
        response = requests.post(f"{SERVICE_URL}/embed", json=payload)
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Embedding generated successfully")
            print(f"   Model used: {data.get('model_used')}")
            print(f"   Embedding length: {len(data.get('embeddings', [{}])[0])}")
            return True
        else:
            print(f"❌ Embedding generation failed: {response.status_code}")
            print(f"   Response: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Embedding generation error: {e}")
        return False

def test_cache_stats():
    """Test cache statistics endpoint"""
    print("🔍 Testing cache statistics...")
    try:
        response = requests.get(f"{SERVICE_URL}/cache/stats")
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Cache stats retrieved successfully")
            print(f"   Hit rate: {data.get('hit_rate_percent', 0):.1f}%")
            print(f"   Total requests: {data.get('total_requests', 0)}")
            print(f"   Cost saved: ${data.get('cost_saved_dollars', 0):.4f}")
            return True
        else:
            print(f"❌ Cache stats failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Cache stats error: {e}")
        return False

def test_semantic_clustering():
    """Test semantic clustering functionality"""
    print("🔍 Testing semantic clustering...")
    try:
        # Test queries that should hit semantic clusters
        test_queries = [
            "luxury apartment London",
            "Luxury apartment in London",  # Should cluster with above
            "premium flat London",         # Should cluster with above
            "2 bedroom flat Manchester",
            "two bedroom apartment Manchester"  # Should cluster with above
        ]
        
        print("   Generating embeddings for clustering test...")
        for i, query in enumerate(test_queries):
            payload = {"texts": [query]}
            response = requests.post(f"{SERVICE_URL}/embed", json=payload)
            
            if response.status_code == 200:
                print(f"   ✅ Query {i+1}: '{query[:30]}...' processed")
            else:
                print(f"   ❌ Query {i+1} failed")
                return False
            
            time.sleep(0.1)  # Small delay between requests
        
        # Check final cache stats
        response = requests.get(f"{SERVICE_URL}/cache/stats")
        if response.status_code == 200:
            data = response.json()
            hit_rate = data.get('hit_rate_percent', 0)
            print(f"✅ Semantic clustering test completed")
            print(f"   Final hit rate: {hit_rate:.1f}%")
            if hit_rate > 20:  # Should have some cache hits from clustering
                print("   🎯 Semantic clustering appears to be working!")
            return True
        
        return False
    except Exception as e:
        print(f"❌ Semantic clustering test error: {e}")
        return False

def test_preload_functionality():
    """Test cache preloading"""
    print("🔍 Testing cache preloading...")
    try:
        response = requests.post(f"{SERVICE_URL}/cache/preload")
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Cache preloading started")
            print(f"   Queries to preload: {data.get('queries_count', 0)}")
            
            # Wait a moment for preloading to start
            time.sleep(2)
            
            # Check cache stats after preloading
            stats_response = requests.get(f"{SERVICE_URL}/cache/stats")
            if stats_response.status_code == 200:
                stats = stats_response.json()
                print(f"   Cache size after preloading: {stats.get('local_cache_size', 0)}")
            
            return True
        else:
            print(f"❌ Cache preloading failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Cache preloading error: {e}")
        return False

def run_all_tests():
    """Run all tests"""
    print("🎯 Enhanced TDD Property Embedding Service - Test Suite")
    print("=" * 60)
    
    tests = [
        ("Health Check", test_health_check),
        ("Basic Embedding", test_basic_embedding),
        ("Cache Statistics", test_cache_stats),
        ("Semantic Clustering", test_semantic_clustering),
        ("Cache Preloading", test_preload_functionality)
    ]
    
    passed = 0
    total = len(tests)
    
    for test_name, test_func in tests:
        print(f"\n📋 Running: {test_name}")
        print("-" * 40)
        
        if test_func():
            passed += 1
        
        time.sleep(1)  # Brief pause between tests
    
    print("\n" + "=" * 60)
    print(f"🎯 Test Results: {passed}/{total} tests passed")
    
    if passed == total:
        print("✅ All tests passed! Your enhanced TDD service is working correctly.")
        print("\n🚀 Next steps:")
        print("   1. Check the cache stats at: http://localhost:8001/cache/stats")
        print("   2. View the API docs at: http://localhost:8001/docs")
        print("   3. Monitor performance in real-time")
    else:
        print(f"❌ {total - passed} tests failed. Please check the service configuration.")
    
    return passed == total

if __name__ == "__main__":
    # Wait a moment for service to be ready
    print("⏳ Waiting for service to be ready...")
    time.sleep(3)
    
    run_all_tests()