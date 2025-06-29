from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List
import numpy as np
import os
import logging

# Try to import your enhanced cache, fallback to simple version
try:
    from services.embedding_cache import EmbeddingCache
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
        import redis
        redis_client = redis.from_url(os.getenv("REDIS_URL", "redis://localhost:6379"))
        cache = EmbeddingCache(redis_client, model.model)
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
        embedding = cache.get_or_generate(request.query)
        current_stats = cache.get_cache_stats()
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
        return cache.get_cache_stats()
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