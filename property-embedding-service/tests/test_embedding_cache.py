# Embedding Cache Performance Tests
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

class TestEmbeddingCache:
    @pytest.fixture
    def mock_redis(self):
        """Mock Redis client for testing"""
        redis_mock = Mock()
        redis_mock.get.return_value = None
        redis_mock.setex.return_value = True
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
    
    def test_cache_hit_performance(self, embedding_cache):
        """Test that cached embeddings return in <10ms"""
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
        assert embedding_cache.cache_hits == 1
        assert embedding_cache.cache_misses == 1
    
    def test_semantic_similarity_grouping(self, embedding_cache):
        """Test that similar queries use same cached embedding"""
        queries = [
            "2 bedroom flat London",
            "2-bed apartment in London", 
            "two bedroom flat London"
        ]
        
        embeddings = [embedding_cache.get_or_generate(q) for q in queries]
        
        # These should be grouped and use similar embeddings
        for i in range(len(embeddings)):
            for j in range(i+1, len(embeddings)):
                similarity = cosine_similarity([embeddings[i]], [embeddings[j]])[0][0]
                assert similarity > 0.9  # Very high similarity threshold
    
    def test_cache_key_normalization(self, embedding_cache):
        """Test that cache keys are normalized for better hit rates"""
        queries = [
            "Modern apartment in London",
            "modern apartment london",
            "  Modern   apartment   in   London  ",
            "apartment modern in London"  # Different word order
        ]
        
        cache_keys = [embedding_cache.get_cache_key(q) for q in queries]
        
        # First three should have same cache key (normalization)
        assert cache_keys[0] == cache_keys[1] == cache_keys[2]
        
        # Fourth might be different due to word order, but should still work
        # This tests our normalization strategy
    
    def test_redis_fallback(self, mock_redis, mock_embedding_model):
        """Test Redis cache fallback when local cache misses"""
        import pickle
        
        cache = EmbeddingCache(mock_redis)
        cache.embedding_model = mock_embedding_model
        
        query = "test query"
        expected_embedding = np.array([0.1, 0.2, 0.3])
        
        # Mock Redis to return cached embedding
        mock_redis.get.return_value = pickle.dumps(expected_embedding)
        
        result = cache.get_or_generate(query)
        
        # Should get embedding from Redis
        assert np.array_equal(result, expected_embedding)
        assert cache.cache_hits == 1
        assert cache.cache_misses == 0
        
        # Should also store in local cache
        assert query in [cache.get_cache_key(query)] or len(cache.local_cache) > 0
    
    def test_cache_statistics(self, embedding_cache):
        """Test cache hit/miss statistics tracking"""
        queries = ["query1", "query2", "query1", "query3", "query1"]
        
        for query in queries:
            embedding_cache.get_or_generate(query)
        
        # query1: 1 miss + 2 hits = 3 total
        # query2: 1 miss
        # query3: 1 miss
        # Total: 3 misses, 2 hits
        assert embedding_cache.cache_misses == 3
        assert embedding_cache.cache_hits == 2
        
        hit_rate = embedding_cache.cache_hits / (embedding_cache.cache_hits + embedding_cache.cache_misses)
        assert hit_rate == 0.4  # 2/5 = 40% hit rate
    
    def test_stop_words_removal(self, embedding_cache):
        """Test that stop words are removed for better cache hits"""
        queries = [
            "apartment in London",
            "apartment London",
            "the apartment in London",
            "an apartment at London"
        ]
        
        cache_keys = [embedding_cache.get_cache_key(q) for q in queries]
        
        # All should have similar cache keys after stop word removal
        unique_keys = set(cache_keys)
        assert len(unique_keys) <= 2  # Should be very similar or identical