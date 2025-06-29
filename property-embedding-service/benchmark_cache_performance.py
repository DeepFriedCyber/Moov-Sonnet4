#!/usr/bin/env python3
"""
Enhanced Embedding Cache Performance Benchmark
Tests the real-world performance improvements of the enhanced caching system
"""

import asyncio
import httpx
import time
import statistics
from typing import List, Dict
import json

class CachePerformanceBenchmark:
    def __init__(self, base_url: str = "http://localhost:8001"):
        self.base_url = base_url
        self.results = []
    
    async def benchmark_cache_performance(self):
        """Comprehensive cache performance benchmark"""
        
        print("🚀 Enhanced Embedding Cache Performance Benchmark")
        print("=" * 60)
        
        # Test scenarios with realistic property search queries
        test_scenarios = [
            {
                "name": "Exact Query Repetition",
                "queries": [
                    "luxury apartment London",
                    "luxury apartment London",  # Exact repeat
                    "luxury apartment London",  # Exact repeat
                ]
            },
            {
                "name": "Semantic Clustering",
                "queries": [
                    "luxury apartment London",
                    "Luxury apartment in London",  # Should hit semantic cluster
                    "premium flat london",         # Should hit semantic cluster
                    "high-end apartment London",   # Should hit semantic cluster
                ]
            },
            {
                "name": "Query Normalization",
                "queries": [
                    "2 bedroom flat Manchester",
                    "2-bed apartment in Manchester",  # Different format
                    "two bedroom flat Manchester",    # Written out number
                    "Manchester flat 2 bedrooms",     # Different word order
                    "  2   bedroom   flat   Manchester  ",  # Extra spaces
                ]
            },
            {
                "name": "Mixed Property Types",
                "queries": [
                    "studio flat London",
                    "1 bedroom apartment London",
                    "2 bed house Manchester", 
                    "3 bedroom family home Birmingham",
                    "luxury penthouse London",
                    "budget flat Leeds",
                ]
            },
            {
                "name": "Location Variations",
                "queries": [
                    "flat in London",
                    "apartment London",
                    "London flat",
                    "central london apartment",
                    "london center flat",
                ]
            }
        ]
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            # Clear cache before starting
            await self.clear_cache(client)
            
            for scenario in test_scenarios:
                print(f"\n📊 Testing: {scenario['name']}")
                print("-" * 40)
                
                scenario_results = await self.run_scenario(client, scenario)
                self.results.append(scenario_results)
                
                # Print scenario summary
                self.print_scenario_summary(scenario_results)
            
            # Final comprehensive stats
            await self.print_final_stats(client)
    
    async def run_scenario(self, client: httpx.AsyncClient, scenario: Dict) -> Dict:
        """Run a single test scenario"""
        scenario_start = time.time()
        query_results = []
        
        for i, query in enumerate(scenario['queries']):
            start_time = time.time()
            
            try:
                response = await client.post(
                    f"{self.base_url}/embed",
                    json={"query": query}
                )
                response.raise_for_status()
                result = response.json()
                
                duration = time.time() - start_time
                
                query_result = {
                    "query": query,
                    "duration": duration,
                    "cached": result.get('cached', False),
                    "cache_stats": result.get('cache_stats', {}),
                    "embedding_length": len(result.get('embedding', []))
                }
                
                query_results.append(query_result)
                
                print(f"  Query {i+1}: {query[:40]}{'...' if len(query) > 40 else ''}")
                print(f"    Time: {duration:.3f}s | Cached: {query_result['cached']} | Hit Rate: {query_result['cache_stats'].get('hit_rate_percent', 0):.1f}%")
                
            except Exception as e:
                print(f"  ❌ Error with query {i+1}: {e}")
                query_results.append({
                    "query": query,
                    "error": str(e),
                    "duration": time.time() - start_time
                })
        
        scenario_duration = time.time() - scenario_start
        
        return {
            "name": scenario['name'],
            "queries": query_results,
            "total_duration": scenario_duration,
            "query_count": len(scenario['queries'])
        }
    
    def print_scenario_summary(self, scenario_results: Dict):
        """Print summary for a scenario"""
        successful_queries = [q for q in scenario_results['queries'] if 'error' not in q]
        
        if not successful_queries:
            print("  ❌ No successful queries in this scenario")
            return
        
        durations = [q['duration'] for q in successful_queries]
        cached_count = sum(1 for q in successful_queries if q.get('cached', False))
        
        print(f"  📈 Results:")
        print(f"    Total Time: {scenario_results['total_duration']:.3f}s")
        print(f"    Avg Query Time: {statistics.mean(durations):.3f}s")
        print(f"    Min/Max Time: {min(durations):.3f}s / {max(durations):.3f}s")
        print(f"    Cache Hits: {cached_count}/{len(successful_queries)} ({cached_count/len(successful_queries)*100:.1f}%)")
        
        # Get final cache stats from last query
        if successful_queries:
            final_stats = successful_queries[-1].get('cache_stats', {})
            if final_stats:
                print(f"    Cost Saved: ${final_stats.get('cost_saved_dollars', 0):.4f}")
                print(f"    Time Saved: {final_stats.get('time_saved_seconds', 0):.2f}s")
    
    async def print_final_stats(self, client: httpx.AsyncClient):
        """Print comprehensive final statistics"""
        print("\n" + "=" * 60)
        print("📊 COMPREHENSIVE PERFORMANCE ANALYSIS")
        print("=" * 60)
        
        try:
            # Get final cache stats
            response = await client.get(f"{self.base_url}/cache/stats")
            response.raise_for_status()
            final_stats = response.json()
            
            print(f"🎯 Cache Performance:")
            print(f"  Hit Rate: {final_stats.get('hit_rate_percent', 0):.2f}%")
            print(f"  Total Requests: {final_stats.get('total_requests', 0)}")
            print(f"  Cache Hits: {final_stats.get('cache_hits', 0)}")
            print(f"  Cache Misses: {final_stats.get('cache_misses', 0)}")
            print(f"  Local Cache Size: {final_stats.get('local_cache_size', 0)}")
            
            print(f"\n💰 Cost Analysis:")
            print(f"  Cost Saved: ${final_stats.get('cost_saved_dollars', 0):.4f}")
            print(f"  Time Saved: {final_stats.get('time_saved_seconds', 0):.2f}s")
            print(f"  Est. Monthly Savings: ${final_stats.get('estimated_monthly_savings', 0):.2f}")
            
            # Calculate performance improvements
            all_durations = []
            cached_durations = []
            uncached_durations = []
            
            for scenario in self.results:
                for query in scenario['queries']:
                    if 'error' not in query:
                        all_durations.append(query['duration'])
                        if query.get('cached', False):
                            cached_durations.append(query['duration'])
                        else:
                            uncached_durations.append(query['duration'])
            
            if cached_durations and uncached_durations:
                avg_cached = statistics.mean(cached_durations)
                avg_uncached = statistics.mean(uncached_durations)
                speedup = avg_uncached / avg_cached if avg_cached > 0 else 0
                
                print(f"\n⚡ Performance Improvements:")
                print(f"  Avg Cached Query Time: {avg_cached:.3f}s")
                print(f"  Avg Uncached Query Time: {avg_uncached:.3f}s")
                print(f"  Cache Speedup: {speedup:.1f}x faster")
                print(f"  Time Reduction: {((avg_uncached - avg_cached) / avg_uncached * 100):.1f}%")
            
            # Scenario-specific analysis
            print(f"\n📋 Scenario Analysis:")
            for scenario in self.results:
                successful_queries = [q for q in scenario['queries'] if 'error' not in q]
                if successful_queries:
                    cached_count = sum(1 for q in successful_queries if q.get('cached', False))
                    hit_rate = cached_count / len(successful_queries) * 100
                    avg_time = statistics.mean([q['duration'] for q in successful_queries])
                    
                    print(f"  {scenario['name']}: {hit_rate:.1f}% hit rate, {avg_time:.3f}s avg time")
            
        except Exception as e:
            print(f"❌ Error getting final stats: {e}")
    
    async def clear_cache(self, client: httpx.AsyncClient):
        """Clear cache before testing"""
        try:
            response = await client.post(f"{self.base_url}/cache/clear")
            response.raise_for_status()
            print("✅ Cache cleared for fresh testing")
        except Exception as e:
            print(f"⚠️  Could not clear cache: {e}")
    
    async def test_concurrent_performance(self):
        """Test performance under concurrent load"""
        print("\n🔄 Testing Concurrent Performance")
        print("-" * 40)
        
        # Queries that should benefit from caching
        concurrent_queries = [
            "luxury apartment London",
            "Luxury apartment in London",  # Should hit cache
            "2 bedroom flat Manchester",
            "two bedroom flat Manchester",  # Should hit cache
            "studio apartment Birmingham",
            "studio flat Birmingham",  # Should hit cache
        ] * 5  # Repeat 5 times for more concurrent requests
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            start_time = time.time()
            
            # Make concurrent requests
            tasks = []
            for query in concurrent_queries:
                task = client.post(f"{self.base_url}/embed", json={"query": query})
                tasks.append(task)
            
            responses = await asyncio.gather(*tasks, return_exceptions=True)
            total_time = time.time() - start_time
            
            # Analyze results
            successful_responses = [r for r in responses if not isinstance(r, Exception)]
            errors = [r for r in responses if isinstance(r, Exception)]
            
            print(f"  Total Requests: {len(concurrent_queries)}")
            print(f"  Successful: {len(successful_responses)}")
            print(f"  Errors: {len(errors)}")
            print(f"  Total Time: {total_time:.3f}s")
            print(f"  Avg Time per Request: {total_time/len(concurrent_queries):.3f}s")
            print(f"  Requests per Second: {len(concurrent_queries)/total_time:.1f}")
            
            if successful_responses:
                # Get cache stats from last response
                try:
                    last_response = successful_responses[-1]
                    if hasattr(last_response, 'json'):
                        result = last_response.json()
                        cache_stats = result.get('cache_stats', {})
                        print(f"  Final Hit Rate: {cache_stats.get('hit_rate_percent', 0):.1f}%")
                        print(f"  Cost Saved: ${cache_stats.get('cost_saved_dollars', 0):.4f}")
                except Exception as e:
                    print(f"  Could not get final stats: {e}")

async def main():
    """Run the complete benchmark suite"""
    benchmark = CachePerformanceBenchmark()
    
    print("Starting Enhanced Embedding Cache Benchmark...")
    print("Make sure your embedding service is running on http://localhost:8001")
    print()
    
    try:
        # Test basic cache performance
        await benchmark.benchmark_cache_performance()
        
        # Test concurrent performance
        await benchmark.test_concurrent_performance()
        
        print("\n✅ Benchmark completed successfully!")
        print("\n💡 Key Takeaways:")
        print("  - Semantic clustering improves cache hit rates for similar queries")
        print("  - Query normalization handles different formats of same intent")
        print("  - Multi-level caching provides fast response times")
        print("  - Cost tracking helps quantify savings")
        
    except Exception as e:
        print(f"\n❌ Benchmark failed: {e}")
        print("Make sure the embedding service is running and accessible")

if __name__ == "__main__":
    asyncio.run(main())