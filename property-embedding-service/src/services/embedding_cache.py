# Smart Embedding Cache Implementation - Enhanced Version
import redis
import pickle
import numpy as np
import xxhash
import time
import logging
from typing import Optional, Dict, List
from dataclasses import dataclass
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

@dataclass
class CacheStats:
    hits: int = 0
    misses: int = 0
    cost_saved: float = 0.0
    time_saved: float = 0.0

@dataclass
class CachedEmbedding:
    """Enhanced cached embedding data structure"""
    data: np.ndarray
    timestamp: float
    ttl: int
    hit_count: int = 0
    query_cluster: Optional[str] = None

class EmbeddingCache:
    """
    Enhanced smart embedding cache with:
    - Semantic clustering for better cache hits
    - Multi-level caching (local memory + Redis)
    - Cost tracking and performance analytics
    - Query normalization and optimization
    """
    
    def __init__(self, redis_client: redis.Redis, embedding_model=None):
        self.redis = redis_client
        self.embedding_model = embedding_model
        self.local_cache: Dict[str, CachedEmbedding] = {}
        self.stats = CacheStats()
        self.max_local_cache_size = 1000  # Prevent memory bloat
        
        # Cache configuration
        self.CACHE_TTL = 7 * 24 * 3600  # 7 days (longer than original for better cost savings)
        self.EMBEDDING_COST_PER_REQUEST = 0.001  # Adjust based on your compute cost
        
        # Enhanced stop words for better normalization
        self.stop_words = {
            'the', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
            'by', 'from', 'up', 'about', 'into', 'through', 'during',
            'before', 'after', 'above', 'below', 'between', 'among',
            'near', 'close', 'around', 'looking', 'want', 'need', 'searching'
        }
        
        # Semantic concept mapping for clustering
        self.concept_mapping = {
            # Property types
            ('flat', 'apartment', 'apt'): 'apartment',
            ('house', 'home', 'property'): 'house',
            ('studio', 'bedsit'): 'studio',
            ('penthouse', 'luxury flat'): 'penthouse',
            
            # Locations (extend with your common areas)
            ('london', 'central london', 'london center'): 'london',
            ('manchester', 'manchester city'): 'manchester',
            ('birmingham', 'brum'): 'birmingham',
            
            # Price indicators  
            ('cheap', 'budget', 'affordable', 'low cost'): 'budget',
            ('luxury', 'premium', 'high-end', 'expensive', 'upmarket'): 'luxury',
            
            # Bedrooms
            ('1 bed', 'one bedroom', '1bedroom', 'single bedroom'): '1bed',
            ('2 bed', 'two bedroom', '2bedroom', 'double bedroom'): '2bed',
            ('3 bed', 'three bedroom', '3bedroom'): '3bed',
            ('4 bed', 'four bedroom', '4bedroom'): '4bed',
        }
    
    def get_cache_key(self, query: str) -> str:
        """
        Generate fast, consistent cache key using xxhash (3x faster than md5)
        """
        normalized = self._normalize_query(query)
        return f"emb:{xxhash.xxh64(normalized.encode()).hexdigest()}"
    
    def _normalize_query(self, query: str) -> str:
        """
        Enhanced query normalization for better cache hits
        'luxury apartment London' == 'Luxury Apartment in London'
        """
        # Convert to lowercase
        normalized = query.lower().strip()
        
        # Remove punctuation and extra spaces
        import re
        normalized = re.sub(r'[^\w\s]', ' ', normalized)
        normalized = re.sub(r'\s+', ' ', normalized)
        
        # Remove stop words that don't affect semantic meaning
        words = [w for w in normalized.split() if w and w not in self.stop_words]
        
        # Sort words for consistency (helps with different word orders)
        # "London flat 2 bedroom" == "2 bedroom flat London"
        return ' '.join(sorted(words))
    
    def _get_semantic_cluster_key(self, query: str) -> str:
        """
        Create broader cache keys for semantic clustering
        Maps similar concepts to same cache entry for better hit rates
        """
        normalized = self._normalize_query(query)
        
        # Apply concept clustering
        words = normalized.split()
        clustered_words = []
        
        for word in words:
            mapped = False
            for concepts, cluster in self.concept_mapping.items():
                if word in concepts:
                    if cluster not in clustered_words:  # Avoid duplicates
                        clustered_words.append(cluster)
                    mapped = True
                    break
            if not mapped:
                clustered_words.append(word)
        
        clustered_query = ' '.join(sorted(clustered_words))
        return f"cluster:{xxhash.xxh64(clustered_query.encode()).hexdigest()}"
    
    def get_or_generate(self, query: str) -> np.ndarray:
        """
        Enhanced multi-level caching with semantic clustering:
        Local -> Redis Exact -> Redis Semantic Cluster -> Generate
        """
        start_time = time.time()
        cache_key = self.get_cache_key(query)
        
        # Level 1: Try local cache first (fastest)
        if cache_key in self.local_cache:
            cached = self.local_cache[cache_key]
            if not self._is_cache_expired(cached):
                cached.hit_count += 1
                self.stats.hits += 1
                self.stats.cost_saved += self.EMBEDDING_COST_PER_REQUEST
                self.stats.time_saved += time.time() - start_time
                logger.debug(f"Local cache hit for query: {query[:50]}...")
                return cached.data
            else:
                # Remove expired entry
                del self.local_cache[cache_key]
        
        # Level 2: Try Redis exact match
        try:
            cached_data = self.redis.get(cache_key)
            if cached_data:
                cached_embedding = pickle.loads(cached_data)
                embedding = cached_embedding.data if hasattr(cached_embedding, 'data') else cached_embedding
                
                # Store in local cache for faster future access
                self._store_in_local_cache(cache_key, embedding)
                
                self.stats.hits += 1
                self.stats.cost_saved += self.EMBEDDING_COST_PER_REQUEST
                self.stats.time_saved += time.time() - start_time
                logger.debug(f"Redis exact cache hit for query: {query[:50]}...")
                return embedding
        except Exception as e:
            logger.warning(f"Redis cache error: {e}")
        
        # Level 3: Try semantic clustering (broader match)
        cluster_key = self._get_semantic_cluster_key(query)
        try:
            cached_data = self.redis.get(cluster_key)
            if cached_data:
                cached_embedding = pickle.loads(cached_data)
                embedding = cached_embedding.data if hasattr(cached_embedding, 'data') else cached_embedding
                
                # Store under both exact and cluster keys
                self._store_in_local_cache(cache_key, embedding)
                self._store_in_redis_cache(cache_key, embedding)
                
                self.stats.hits += 1
                self.stats.cost_saved += self.EMBEDDING_COST_PER_REQUEST
                self.stats.time_saved += time.time() - start_time
                logger.debug(f"Semantic cluster hit for query: {query[:50]}...")
                return embedding
        except Exception as e:
            logger.warning(f"Cluster cache error: {e}")
        
        # Level 4: Generate new embedding (cache miss)
        if not self.embedding_model:
            raise ValueError("Embedding model not initialized")
        
        logger.debug(f"Cache miss, generating embedding for query: {query[:50]}...")
        embedding = self.embedding_model.encode(query)
        
        # Store in all cache levels
        cluster_key = self._get_semantic_cluster_key(query)
        self._store_in_local_cache(cache_key, embedding, cluster_key)
        self._store_in_redis_cache(cache_key, embedding)
        self._store_in_redis_cache(cluster_key, embedding)  # Also store as semantic cluster
        
        self.stats.misses += 1
        return embedding
    
    def _store_in_local_cache(self, cache_key: str, embedding: np.ndarray, cluster_key: Optional[str] = None):
        """Store embedding in local cache with enhanced LRU eviction"""
        # Implement simple LRU by removing oldest entries when cache is full
        if len(self.local_cache) >= self.max_local_cache_size:
            # Remove least recently used (lowest hit_count)
            lru_key = min(self.local_cache.keys(), 
                         key=lambda k: self.local_cache[k].hit_count)
            del self.local_cache[lru_key]
        
        self.local_cache[cache_key] = CachedEmbedding(
            data=embedding,
            timestamp=time.time(),
            ttl=self.CACHE_TTL,  # Use longer TTL for better cost savings
            hit_count=0,
            query_cluster=cluster_key
        )
    
    def _store_in_redis_cache(self, cache_key: str, embedding: np.ndarray):
        """Store embedding in Redis cache with enhanced TTL"""
        try:
            # Create cached embedding object for consistency
            cached_embedding = CachedEmbedding(
                data=embedding,
                timestamp=time.time(),
                ttl=self.CACHE_TTL,
                hit_count=0
            )
            
            # Store for 7 days in Redis (longer for better cost savings)
            self.redis.setex(
                cache_key,  # Use direct key (already prefixed)
                self.CACHE_TTL,
                pickle.dumps(cached_embedding)
            )
        except Exception as e:
            logger.warning(f"Failed to store in Redis cache: {e}")
    
    def _is_cache_expired(self, cached: CachedEmbedding) -> bool:
        """Check if cached embedding has expired"""
        return time.time() - cached.timestamp > cached.ttl
    
    def get_cache_stats(self) -> Dict:
        """Get enhanced cache performance statistics with cost tracking"""
        total_requests = self.stats.hits + self.stats.misses
        hit_rate = (self.stats.hits / total_requests * 100) if total_requests > 0 else 0
        
        return {
            "hit_rate_percent": round(hit_rate, 2),
            "total_requests": total_requests,
            "cache_hits": self.stats.hits,
            "cache_misses": self.stats.misses,
            "cost_saved_dollars": round(self.stats.cost_saved, 4),
            "time_saved_seconds": round(self.stats.time_saved, 2),
            "local_cache_size": len(self.local_cache),
            "estimated_monthly_savings": round(self.stats.cost_saved * 30, 2) if total_requests > 0 else 0
        }
    
    def clear_cache(self):
        """Clear all caches (useful for testing)"""
        self.local_cache.clear()
        try:
            # Clear Redis embeddings (be careful in production!)
            for key in self.redis.scan_iter(match="emb:*"):
                self.redis.delete(key)
            for key in self.redis.scan_iter(match="cluster:*"):
                self.redis.delete(key)
        except Exception as e:
            logger.warning(f"Failed to clear Redis cache: {e}")
        
        # Reset stats
        self.stats = CacheStats()
    
    def preload_common_queries(self, common_queries: list):
        """Preload embeddings for common queries to improve hit rates"""
        logger.info(f"Preloading {len(common_queries)} common queries...")
        
        for query in common_queries:
            try:
                self.get_or_generate(query)
            except Exception as e:
                logger.warning(f"Failed to preload query '{query}': {e}")
        
        logger.info("Preloading complete")
    
    def get_similar_cached_queries(self, query: str, threshold: float = 0.8) -> list:
        """
        Find similar cached queries that might be reusable
        Useful for query suggestion features
        """
        if not self.embedding_model:
            return []
        
        query_embedding = self.get_or_generate(query)
        similar_queries = []
        
        # Check local cache for similar embeddings
        for cache_key, cached in self.local_cache.items():
            similarity = np.dot(query_embedding, cached.data) / (
                np.linalg.norm(query_embedding) * np.linalg.norm(cached.data)
            )
            
            if similarity >= threshold:
                similar_queries.append({
                    'cache_key': cache_key,
                    'similarity': similarity,
                    'hit_count': cached.hit_count
                })
        
        # Sort by similarity and hit count
        similar_queries.sort(key=lambda x: (x['similarity'], x['hit_count']), reverse=True)
        return similar_queries[:5]  # Return top 5 similar queries