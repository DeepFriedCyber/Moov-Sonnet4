from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List
import numpy as np
import os
import logging
import sys

# Add current directory to path for imports
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Try to import your enhanced cache, fallback to simple version
try:
    from services.embedding_cache import EmbeddingCache
    CACHE_AVAILABLE = True
    print("✅ Enhanced cache module found")
except ImportError as e:
    CACHE_AVAILABLE = False
    print(f"⚠️ Enhanced cache not available: {e}")

try:
    from models.embedding_model import EmbeddingModel
    print("✅ EmbeddingModel found")
except ImportError as e:
    print(f"❌ EmbeddingModel not found: {e}")
    # Fallback simple model
    from sentence_transformers import SentenceTransformer
    class EmbeddingModel:
        def __init__(self, model_name: str = "all-MiniLM-L6-v2"):
            self.model_name = model_name
            self.model = SentenceTransformer(model_name)
        
        def encode(self, texts):
            return self.model.encode(texts)
        
        def get_model_info(self):
            return {
                "model_name": self.model_name,
                "embedding_dimension": self.model.get_sentence_embedding_dimension()
            }

app = FastAPI(title="Property Embedding Service")

# Initialize model
print("🔄 Loading embedding model...")
model = EmbeddingModel()
print("✅ Embedding model loaded")

# Initialize cache if available
cache = None
if CACHE_AVAILABLE:
    try:
        import redis
        redis_client = redis.from_url(os.getenv("REDIS_URL", "redis://localhost:6379"))
        redis_client.ping()  # Test connection
        cache = EmbeddingCache(redis_client, model.model)
        print("✅ Enhanced cache initialized with Redis")
    except Exception as e:
        print(f"⚠️ Cache initialization failed: {e}")
        print("   Service will run without caching")
        cache = None
else:
    print("❌ Cache not available - running without caching")

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
        try:
            # Use enhanced caching
            embedding = cache.get_or_generate(request.query)
            current_stats = cache.get_cache_stats()
            
            return EmbeddingResponse(
                embedding=embedding.tolist(),
                cached=True,  # Assume cached if using cache system
                cache_stats=current_stats
            )
        except Exception as e:
            print(f"Cache error: {e}, falling back to direct generation")
            # Fall back to direct generation
            embedding = model.encode(request.query)
            return EmbeddingResponse(
                embedding=embedding.tolist(),
                cached=False,
                cache_stats={"error": str(e)}
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
        try:
            return cache.get_cache_stats()
        except Exception as e:
            return {"error": f"Cache stats error: {str(e)}"}
    else:
        return {"error": "Cache not available"}

@app.post("/cache/clear")
async def clear_cache():
    """Clear cache (admin function)"""
    if cache:
        try:
            cache.clear_cache()
            return {"message": "Cache cleared"}
        except Exception as e:
            return {"error": f"Cache clear error: {str(e)}"}
    else:
        return {"error": "Cache not available"}

@app.get("/health")
async def health_check():
    return {
        "status": "healthy", 
        "model": model.get_model_info(),
        "cache_available": cache is not None,
        "cache_type": "enhanced" if cache else "none"
    }

@app.get("/")
async def root():
    return {"message": "Property Embedding Service", "version": "1.0.0"}

if __name__ == "__main__":
    import uvicorn
    print("🚀 Starting Property Embedding Service...")
    print("📊 Enhanced caching:", "✅ Enabled" if cache else "❌ Disabled")
    uvicorn.run(app, host="0.0.0.0", port=8001)