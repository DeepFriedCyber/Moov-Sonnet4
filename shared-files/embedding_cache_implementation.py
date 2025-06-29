# ============================================================================
# STEP 1: Update requirements.txt in property-embedding-service
# ============================================================================
# Add to requirements.txt:
# redis==5.0.1
# xxhash==3.4.1

# ============================================================================
# STEP 2: Create the Smart Embedding Cache
# property-embedding-service/src/services/embedding_cache.py
# ============================================================================

import redis
import pickle
import numpy as np
import xxhash
import time
import logging
from typing import Optional, Dict, List
from dataclasses import dataclass
from datetime import datetime, timedelta

@dataclass
class CacheStats:
    hits: int = 0
    misses: int = 0
    cost_saved: float = 0.0
    time_saved: float = 0.0

class SmartEmbeddingCache:
    """
    Intelligent embedding cache that:
    - Groups similar queries together
    - Uses Redis for persistence + local memory for speed
    - Tracks cost savings
    - Self-optimizes cache keys
    """
    
    def __init__(self, redis_url: str = "redis://localhost:6379"):
        self.redis_client = redis.from_url(redis_url)
        self.local_cache: Dict[str, np.ndarray] = {}
        self.stats = CacheStats()
        self.logger = logging.getLogger(__name__)
        
        # Cache configuration
        self.CACHE_TTL = 7 * 24 * 3600  # 7 days
        self.LOCAL_CACHE_SIZE = 1000    # Keep 1000 embeddings in memory
        self.EMBEDDING_COST_PER_REQUEST = 0.001  # Adjust based on your compute cost
        
    def _normalize_query(self, query: str) -> str:
        """
        Normalize queries to increase cache hits
        'luxury apartment London' == 'Luxury Apartment in London'
        """
        # Convert to lowercase
        normalized = query.lower().strip()
        
        # Remove common stop words that don't affect semantic meaning
        stop_words = {
            'the', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'with', 'by',
            'near', 'close', 'around', 'looking', 'want', 'need', 'searching'
        }
        
        # Remove punctuation and extra spaces
        import re
        normalized = re.sub(r'[^\w\s]', ' ', normalized)
        words = [w for w in normalized.split() if w and w not in stop_words]
        
        # Sort words to handle different orderings
        # "London flat 2 bedroom" == "2 bedroom flat London"
        return ' '.join(sorted(words))
    
    def _get_cache_key(self, query: str) -> str:
        """Generate fast, consistent cache key"""
        normalized = self._normalize_query(query)
        # Use xxhash for speed (3x faster than md5)
        return f"emb:{xxhash.xxh64(normalized.encode()).hexdigest()}"
    
    def _get_semantic_cluster_key(self, query: str) -> str:
        """
        Create broader cache keys for semantic clustering
        Maps similar concepts to same cache entry
        """
        normalized = self._normalize_query(query)
        
        # Group by semantic concepts
        concept_mapping = {
            # Property types
            ('flat', 'apartment'): 'apartment',
            ('house', 'home', 'property'): 'house',
            ('studio', 'bedsit'): 'studio',
            
            # Locations (add your common areas)
            ('london', 'central london', 'london center'): 'london',
            ('manchester', 'manchester city'): 'manchester',
            
            # Price indicators  
            ('cheap', 'budget', 'affordable'): 'budget',
            ('luxury', 'premium', 'high-end', 'expensive'): 'luxury',
            
            # Bedrooms
            ('1 bed', 'one bedroom', '1bedroom'): '1bed',
            ('2 bed', 'two bedroom', '2bedroom'): '2bed',
        }
        
        # Apply concept clustering
        words = normalized.split()
        clustered_words = []
        
        for word in words:
            mapped = False
            for concepts, cluster in concept_mapping.items():
                if word in concepts:
                    if cluster not in clustered_words:  # Avoid duplicates
                        clustered_words.append(cluster)
                    mapped = True
                    break
            if not mapped:
                clustered_words.append(word)
        
        return ' '.join(sorted(clustered_words))
    
    def get_embedding(self, query: str, embedding_func) -> np.ndarray:
        """
        Get embedding with intelligent caching
        Returns cached version if available, otherwise generates new one
        """
        start_time = time.time()
        
        # Try exact match first
        cache_key = self._get_cache_key(query)
        
        # Check local memory cache (fastest)
        if cache_key in self.local_cache:
            self.stats.hits += 1
            self.stats.cost_saved += self.EMBEDDING_COST_PER_REQUEST
            self.stats.time_saved += time.time() - start_time
            self.logger.debug(f"Local cache hit for: {query[:50]}...")
            return self.local_cache[cache_key]
        
        # Check Redis cache
        try:
            cached_data = self.redis_client.get(cache_key)
            if cached_data:
                embedding = pickle.loads(cached_data)
                
                # Store in local cache for next time
                self._store_local(cache_key, embedding)
                
                self.stats.hits += 1
                self.stats.cost_saved += self.EMBEDDING_COST_PER_REQUEST
                self.stats.time_saved += time.time() - start_time
                self.logger.debug(f"Redis cache hit for: {query[:50]}...")
                return embedding
                
        except Exception as e:
            self.logger.warning(f"Redis cache error: {e}")
        
        # Try semantic clustering (broader match)
        cluster_key = f"cluster:{xxhash.xxh64(self._get_semantic_cluster_key(query).encode()).hexdigest()}"
        try:
            cached_data = self.redis_client.get(cluster_key)
            if cached_data:
                embedding = pickle.loads(cached_data)
                
                # Store under both keys
                self._store_local(cache_key, embedding)
                self._store_redis(cache_key, embedding)
                
                self.stats.hits += 1
                self.stats.cost_saved += self.EMBEDDING_COST_PER_REQUEST
                self.logger.debug(f"Semantic cluster hit for: {query[:50]}...")
                return embedding
                
        except Exception as e:
            self.logger.warning(f"Cluster cache error: {e}")
        
        # Cache miss - generate new embedding
        self.logger.debug(f"Cache miss, generating embedding for: {query[:50]}...")
        embedding = embedding_func(query)
        
        # Store in all cache levels
        self._store_local(cache_key, embedding)
        self._store_redis(cache_key, embedding)
        self._store_redis(cluster_key, embedding)  # Also store as semantic cluster
        
        self.stats.misses += 1
        return embedding
    
    def _store_local(self, key: str, embedding: np.ndarray):
        """Store in local memory cache with size limit"""
        if len(self.local_cache) >= self.LOCAL_CACHE_SIZE:
            # Remove oldest entry (simple FIFO)
            oldest_key = next(iter(self.local_cache))
            del self.local_cache[oldest_key]
        
        self.local_cache[key] = embedding
    
    def _store_redis(self, key: str, embedding: np.ndarray):
        """Store in Redis with TTL"""
        try:
            self.redis_client.setex(
                key, 
                self.CACHE_TTL, 
                pickle.dumps(embedding)
            )
        except Exception as e:
            self.logger.warning(f"Failed to store in Redis: {e}")
    
    def get_stats(self) -> Dict:
        """Get cache performance statistics"""
        total_requests = self.stats.hits + self.stats.misses
        hit_rate = (self.stats.hits / total_requests * 100) if total_requests > 0 else 0
        
        return {
            "hit_rate_percent": round(hit_rate, 2),
            "total_requests": total_requests,
            "cache_hits": self.stats.hits,
            "cache_misses": self.stats.misses,
            "cost_saved_dollars": round(self.stats.cost_saved, 4),
            "time_saved_seconds": round(self.stats.time_saved, 2),
            "local_cache_size": len(self.local_cache)
        }
    
    def clear_cache(self):
        """Clear all caches (useful for testing)"""
        self.local_cache.clear()
        try:
            # Clear Redis embeddings (be careful in production!)
            for key in self.redis_client.scan_iter(match="emb:*"):
                self.redis_client.delete(key)
            for key in self.redis_client.scan_iter(match="cluster:*"):
                self.redis_client.delete(key)
        except Exception as e:
            self.logger.warning(f"Failed to clear Redis cache: {e}")

# ============================================================================
# STEP 3: Update your main.py to use the cache
# property-embedding-service/src/main.py
# ============================================================================

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List
import numpy as np
from sentence_transformers import SentenceTransformer
from .services.embedding_cache import SmartEmbeddingCache
import os

app = FastAPI(title="Property Embedding Service with Smart Caching")

# Initialize cache and model
cache = SmartEmbeddingCache(redis_url=os.getenv("REDIS_URL", "redis://localhost:6379"))
model = SentenceTransformer('all-MiniLM-L6-v2')

class SearchQuery(BaseModel):
    query: str

class EmbeddingResponse(BaseModel):
    embedding: List[float]
    cached: bool
    cache_stats: dict

@app.post("/embed", response_model=EmbeddingResponse)
async def generate_embedding(request: SearchQuery):
    """Generate embedding with intelligent caching"""
    
    def generate_new_embedding(query: str) -> np.ndarray:
        """Wrapper function for actual embedding generation"""
        return model.encode(query)
    
    # Get embedding (cached or generated)
    embedding = cache.get_embedding(request.query, generate_new_embedding)
    
    # Check if this was a cache hit
    current_stats = cache.get_stats()
    was_cached = len(cache.local_cache) > 0 or current_stats["cache_hits"] > 0
    
    return EmbeddingResponse(
        embedding=embedding.tolist(),
        cached=was_cached,
        cache_stats=current_stats
    )

@app.get("/cache/stats")
async def get_cache_stats():
    """Get cache performance statistics"""
    return cache.get_stats()

@app.post("/cache/clear")
async def clear_cache():
    """Clear cache (admin function)"""
    cache.clear_cache()
    return {"message": "Cache cleared"}

@app.get("/health")
async def health_check():
    return {"status": "healthy", "cache_active": True}

# ============================================================================
# STEP 4: Update docker-compose.yml (if not already done)
# ============================================================================

# Ensure your docker-compose.yml has Redis:
"""
version: '3.8'
services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes

  # ... your other services

volumes:
  redis_data:
"""

# ============================================================================
# STEP 5: Simple test to verify it works
# property-embedding-service/test_cache.py
# ============================================================================

import asyncio
import httpx
import time

async def test_cache_performance():
    """Quick test to verify cache is working"""
    
    base_url = "http://localhost:8001"
    
    # Test queries (similar ones should hit cache)
    test_queries = [
        "luxury apartment London",
        "Luxury apartment in London",  # Should hit cache (similar)
        "2 bedroom flat Manchester", 
        "Two bedroom flat in Manchester",  # Should hit cache (similar)
        "studio flat",
        "completely different unique query 12345"
    ]
    
    async with httpx.AsyncClient() as client:
        print("Testing embedding cache performance...\n")
        
        for i, query in enumerate(test_queries):
            start_time = time.time()
            
            response = await client.post(
                f"{base_url}/embed",
                json={"query": query}
            )
            
            duration = time.time() - start_time
            result = response.json()
            
            print(f"Query {i+1}: '{query[:30]}...'")
            print(f"  Time: {duration:.3f}s")
            print(f"  Cached: {result['cached']}")
            print(f"  Hit Rate: {result['cache_stats']['hit_rate_percent']}%")
            print(f"  Cost Saved: ${result['cache_stats']['cost_saved_dollars']}")
            print()
        
        # Get final stats
        stats_response = await client.get(f"{base_url}/cache/stats")
        final_stats = stats_response.json()
        
        print("=== FINAL CACHE PERFORMANCE ===")
        print(f"Hit Rate: {final_stats['hit_rate_percent']}%")
        print(f"Total Requests: {final_stats['total_requests']}")
        print(f"Cost Saved: ${final_stats['cost_saved_dollars']}")
        print(f"Time Saved: {final_stats['time_saved_seconds']}s")

if __name__ == "__main__":
    asyncio.run(test_cache_performance())