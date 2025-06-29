# Enhanced Embedding Cache Performance Tests
import pytest
import time
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity
from unittest.mock import Mock, patch
import sys
import os

# Add src to path for imports
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'src'))

from services.embedding_cache import EmbeddingCache
from models.embedding_model import EmbeddingModel

class TestEnhancedEmbeddingCache:
    @pytest.fixture
    def mock_redis(self):
        """Mock Redis client for testing"""
        redis_mock = Mock()
        redis_mock.get.return_value = None
        redis_mock.setex.return_value = True
        redis_mock.scan_iter.return_value = []
        return redis_mock
    
    @pytest.fixture
    def mock_embedding_model(self):
        """Mock embedding model that returns consistent embeddings"""
        model_mock = Mock()
        # Return consistent embeddings for same input
        def mock_encode(text):
            # Simple hash-based embedding for testing
            hash_val = hash(text.lower().strip())
            return np.array([hash_val % 1000 / 1000.0] * 384)  # 384-dim like MiniLM
        
        model_mock.encode = mock_encode
        return model_mock
    
    @pytest.fixture
    def embedding_cache(self, mock_redis, mock_embedding_model):
        """Create embedding cache with mocked dependencies"""
        cache = EmbeddingCache(mock_redis)
        cache.embedding_model = mock_embedding_model
        return cache
    
    def test_enhanced_cache_hit_performance(self, embedding_cache):
        """Test that cached embeddings return in <10ms with cost tracking"""
        query = "modern apartment London"
        
        # First call - cache miss
        start_time = time.time()
        embedding1 = embedding_cache.get_or_generate(query)
        first_call_time = time.time() - start_time
        
        # Second call - cache hit (local cache)
        start_time = time.time()
        embedding2 = embedding_cache.get_or_generate(query)
        cache_hit_time = time.time() - start_time
        
        assert cache_hit_time < 0.01  # Under 10ms
        assert np.array_equal(embedding1, embedding2)
        assert first_call_time > cache_hit_time * 10  # Significant improvement
        
        # Check enhanced stats
        stats = embedding_cache.get_cache_stats()
        assert stats['cache_hits'] == 1
        assert stats['cache_misses'] == 1
        assert stats['cost_saved_dollars'] > 0
        assert stats['time_saved_seconds'] > 0
    
    def test_semantic_clustering_cache_hits(self, embedding_cache):
        """Test that semantic clustering improves cache hit rates"""
        # These queries should hit the same semantic cluster
        queries = [
            "luxury apartment London",
            "Luxury apartment in London",  # Should hit semantic cluster
            "premium flat london",         # Should hit semantic cluster
            "high-end apartment London"    # Should hit semantic cluster
        ]
        
        embeddings = []
        for query in queries:
            embedding = embedding_cache.get_or_generate(query)
            embeddings.append(embedding)
        
        stats = embedding_cache.get_cache_stats()
        
        # Should have fewer misses than queries due to semantic clustering
        assert stats['cache_misses'] < len(queries)
        assert stats['cache_hits'] > 0
        assert stats['hit_rate_percent'] > 0
    
    def test_query_normalization_effectiveness(self, embedding_cache):
        """Test that query normalization groups similar queries"""
        queries = [
            "2 bedroom flat London",
            "2-bed apartment in London", 
            "two bedroom flat London",
            "London flat 2 bedrooms",  # Different word order
            "  2   bedroom   flat   London  "  # Extra spaces
        ]
        
        # Generate cache keys to test normalization
        cache_keys = [embedding_cache.get_cache_key(q) for q in queries]
        
        # Most should have similar cache keys due to normalization
        unique_keys = set(cache_keys)
        assert len(unique_keys) <= 3  # Should be grouped effectively
    
    def test_concept_mapping_clustering(self, embedding_cache):
        """Test that concept mapping creates effective clusters"""
        # These should map to same concepts
        property_type_queries = [
            "flat in London",
            "apartment in London",
            "apt in London"
        ]
        
        bedroom_queries = [
            "1 bed flat",
            "one bedroom flat",
            "1bedroom flat"
        ]
        
        # Test property type clustering
        cluster_keys = [embedding_cache._get_semantic_cluster_key(q) for q in property_type_queries]
        assert len(set(cluster_keys)) == 1  # Should all map to same cluster
        
        # Test bedroom clustering
        cluster_keys = [embedding_cache._get_semantic_cluster_key(q) for q in bedroom_queries]
        assert len(set(cluster_keys)) == 1  # Should all map to same cluster
    
    def test_multi_level_caching_fallback(self, mock_redis, mock_embedding_model):
        """Test the multi-level caching fallback system"""
        import pickle
        
        cache = EmbeddingCache(mock_redis)
        cache.embedding_model = mock_embedding_model
        
        query = "test query"
        expected_embedding = np.array([0.1, 0.2, 0.3])
        
        # Test Redis exact match fallback
        from services.embedding_cache import CachedEmbedding
        mock_redis.get.side_effect = [
            None,  # Local cache miss
            pickle.dumps(CachedEmbedding(
                data=expected_embedding,
                timestamp=time.time(),
                ttl=cache.CACHE_TTL,
                hit_count=0
            ))  # Redis exact hit
        ]
        
        result = cache.get_or_generate(query)
        
        # Should get embedding from Redis exact match
        assert np.array_equal(result, expected_embedding)
        stats = cache.get_cache_stats()
        assert stats['cache_hits'] == 1
        assert stats['cache_misses'] == 0
    
    def test_cost_tracking_accuracy(self, embedding_cache):
        """Test that cost tracking is accurate"""
        queries = ["query1", "query2", "query1", "query3", "query1"]
        
        for query in queries:
            embedding_cache.get_or_generate(query)
        
        stats = embedding_cache.get_cache_stats()
        
        # Should track costs correctly
        expected_cost_saved = stats['cache_hits'] * embedding_cache.EMBEDDING_COST_PER_REQUEST
        assert abs(stats['cost_saved_dollars'] - expected_cost_saved) < 0.0001
        
        # Should have monthly savings estimate
        assert stats['estimated_monthly_savings'] > 0
    
    def test_performance_under_load(self, embedding_cache):
        """Test cache performance under high load"""
        # Generate many similar queries
        base_queries = [
            "luxury apartment London",
            "2 bedroom flat Manchester", 
            "studio apartment Birmingham",
            "house with garden Leeds"
        ]
        
        # Create variations of each query
        all_queries = []
        for base in base_queries:
            variations = [
                base,
                base.upper(),
                f"  {base}  ",
                base.replace("apartment", "flat"),
                base.replace("bedroom", "bed")
            ]
            all_queries.extend(variations)
        
        start_time = time.time()
        
        # Process all queries
        for query in all_queries:
            embedding_cache.get_or_generate(query)
        
        total_time = time.time() - start_time
        stats = embedding_cache.get_cache_stats()
        
        # Should have good hit rate due to clustering
        assert stats['hit_rate_percent'] > 50  # At least 50% hit rate
        assert total_time < 5.0  # Should complete quickly
        assert stats['cost_saved_dollars'] > 0
    
    def test_cache_expiration_handling(self, embedding_cache):
        """Test that cache expiration is handled correctly"""
        query = "test expiration query"
        
        # Generate embedding
        embedding1 = embedding_cache.get_or_generate(query)
        
        # Manually expire the cache entry
        cache_key = embedding_cache.get_cache_key(query)
        if cache_key in embedding_cache.local_cache:
            cached = embedding_cache.local_cache[cache_key]
            cached.timestamp = time.time() - (embedding_cache.CACHE_TTL + 1)
        
        # Should regenerate due to expiration
        embedding2 = embedding_cache.get_or_generate(query)
        
        # Should be same embedding but regenerated
        assert np.array_equal(embedding1, embedding2)
        stats = embedding_cache.get_cache_stats()
        assert stats['cache_misses'] == 2  # Initial + regeneration
    
    def test_memory_management(self, embedding_cache):
        """Test that local cache doesn't exceed size limits"""
        # Generate more queries than cache size limit
        queries = [f"query {i}" for i in range(embedding_cache.max_local_cache_size + 100)]
        
        for query in queries:
            embedding_cache.get_or_generate(query)
        
        # Local cache should not exceed limit
        assert len(embedding_cache.local_cache) <= embedding_cache.max_local_cache_size
    
    def test_redis_error_handling(self, mock_redis, mock_embedding_model):
        """Test graceful handling of Redis errors"""
        cache = EmbeddingCache(mock_redis)
        cache.embedding_model = mock_embedding_model
        
        # Simulate Redis errors
        mock_redis.get.side_effect = Exception("Redis connection error")
        mock_redis.setex.side_effect = Exception("Redis write error")
        
        query = "test redis error"
        
        # Should still work without Redis
        embedding = cache.get_or_generate(query)
        assert embedding is not None
        assert len(embedding) > 0
    
    def test_cache_statistics_comprehensive(self, embedding_cache):
        """Test comprehensive cache statistics"""
        # Mix of cache hits and misses
        queries = [
            "query1", "query2", "query1",  # query1 should hit cache on second call
            "query3", "query2", "query4"   # query2 should hit cache on second call
        ]
        
        for query in queries:
            embedding_cache.get_or_generate(query)
        
        stats = embedding_cache.get_cache_stats()
        
        # Verify all expected stats are present
        required_keys = [
            'hit_rate_percent', 'total_requests', 'cache_hits', 'cache_misses',
            'cost_saved_dollars', 'time_saved_seconds', 'local_cache_size',
            'estimated_monthly_savings'
        ]
        
        for key in required_keys:
            assert key in stats
            assert isinstance(stats[key], (int, float))
        
        # Verify calculations
        assert stats['total_requests'] == stats['cache_hits'] + stats['cache_misses']
        assert stats['total_requests'] == len(queries)
        assert stats['cache_hits'] == 2  # query1 and query2 second calls
        assert stats['cache_misses'] == 4  # All first calls
    
    def test_clear_cache_functionality(self, embedding_cache):
        """Test cache clearing functionality"""
        # Add some data to cache
        queries = ["query1", "query2", "query3"]
        for query in queries:
            embedding_cache.get_or_generate(query)
        
        # Verify cache has data
        stats_before = embedding_cache.get_cache_stats()
        assert stats_before['total_requests'] > 0
        assert stats_before['local_cache_size'] > 0
        
        # Clear cache
        embedding_cache.clear_cache()
        
        # Verify cache is cleared
        stats_after = embedding_cache.get_cache_stats()
        assert stats_after['total_requests'] == 0
        assert stats_after['local_cache_size'] == 0
        assert len(embedding_cache.local_cache) == 0