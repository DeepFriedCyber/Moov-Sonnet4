# ============================================================================
# QUICK FIX 1: Create/Update src/models/embedding_model.py
# ============================================================================

from sentence_transformers import SentenceTransformer
import numpy as np
from typing import Union, List
import logging

class EmbeddingModel:
    """Wrapper for sentence transformer model"""
    
    def __init__(self, model_name: str = "all-MiniLM-L6-v2"):
        self.model_name = model_name
        self.model = SentenceTransformer(model_name)
        self.logger = logging.getLogger(__name__)
        
    def encode(self, texts: Union[str, List[str]]) -> np.ndarray:
        """Generate embeddings for text(s)"""
        return self.model.encode(texts)
    
    def get_model_info(self) -> dict:
        """Get model information"""
        return {
            "model_name": self.model_name,
            "max_seq_length": self.model.max_seq_length,
            "embedding_dimension": self.model.get_sentence_embedding_dimension()
        }

# ============================================================================
# QUICK FIX 2: Simplified main.py for immediate testing
# src/main.py
# ============================================================================

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List
import numpy as np
import os
import logging

# Try to import your enhanced cache, fallback to simple version
try:
    from services.embedding_cache import SmartEmbeddingCache
    CACHE_AVAILABLE = True
except ImportError:
    CACHE_AVAILABLE = False
    logging.warning("Enhanced cache not available, using simple version")

from models.embedding_model import EmbeddingModel

app = FastAPI(title="Property Embedding Service")

# Initialize model
model = EmbeddingModel()

# Initialize cache if available
if CACHE_AVAILABLE:
    try:
        cache = SmartEmbeddingCache(redis_url=os.getenv("REDIS_URL", "redis://localhost:6379"))
        print("✅ Enhanced cache initialized")
    except Exception as e:
        print(f"⚠️ Cache initialization failed: {e}")
        cache = None
else:
    cache = None

class SearchQuery(BaseModel):
    query: str

class EmbeddingResponse(BaseModel):
    embedding: List[float]
    cached: bool = False
    cache_stats: dict = {}

@app.post("/embed", response_model=EmbeddingResponse)
async def generate_embedding(request: SearchQuery):
    """Generate embedding with optional caching"""
    
    if cache:
        # Use enhanced caching
        def generate_new_embedding(query: str) -> np.ndarray:
            return model.encode(query)
        
        embedding = cache.get_embedding(request.query, generate_new_embedding)
        current_stats = cache.get_stats()
        was_cached = current_stats.get("cache_hits", 0) > 0
        
        return EmbeddingResponse(
            embedding=embedding.tolist(),
            cached=was_cached,
            cache_stats=current_stats
        )
    else:
        # Simple non-cached version
        embedding = model.encode(request.query)
        return EmbeddingResponse(
            embedding=embedding.tolist(),
            cached=False,
            cache_stats={"message": "Cache not available"}
        )

@app.get("/cache/stats")
async def get_cache_stats():
    """Get cache performance statistics"""
    if cache:
        return cache.get_stats()
    else:
        return {"error": "Cache not available"}

@app.post("/cache/clear")
async def clear_cache():
    """Clear cache (admin function)"""
    if cache:
        cache.clear_cache()
        return {"message": "Cache cleared"}
    else:
        return {"error": "Cache not available"}

@app.get("/health")
async def health_check():
    return {
        "status": "healthy", 
        "model": model.get_model_info(),
        "cache_available": cache is not None
    }

@app.get("/")
async def root():
    return {"message": "Property Embedding Service", "version": "1.0.0"}

if __name__ == "__main__":
    import uvicorn
    print("🚀 Starting Property Embedding Service...")
    print("📊 Enhanced caching:", "✅ Enabled" if cache else "❌ Disabled")
    uvicorn.run(app, host="0.0.0.0", port=8001)

# ============================================================================
# QUICK FIX 3: Simple test script to verify it works
# test_service_simple.py
# ============================================================================

import requests
import time
import json

def test_basic_functionality():
    """Test the service is working without complex caching"""
    
    base_url = "http://localhost:8001"
    
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
        print("💡 Make sure to start the service with: python src/main.py")
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

# ============================================================================
# QUICK FIX 4: Updated test file with correct imports
# tests/test_simple_embedding.py
# ============================================================================

import pytest
import sys
import os

# Add src to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

from models.embedding_model import EmbeddingModel
import numpy as np

def test_embedding_model_creation():
    """Test that we can create an embedding model"""
    model = EmbeddingModel()
    assert model.model_name == "all-MiniLM-L6-v2"

def test_embedding_generation():
    """Test that we can generate embeddings"""
    model = EmbeddingModel()
    
    text = "luxury apartment in London"
    embedding = model.encode(text)
    
    assert isinstance(embedding, np.ndarray)
    assert len(embedding) > 0
    assert embedding.shape[0] == 384  # all-MiniLM-L6-v2 dimension

def test_model_info():
    """Test that model info is available"""
    model = EmbeddingModel()
    info = model.get_model_info()
    
    assert "model_name" in info
    assert "embedding_dimension" in info
    assert info["embedding_dimension"] == 384