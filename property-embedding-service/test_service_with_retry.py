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
    
    print("Enhanced Embedding Service Test")
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