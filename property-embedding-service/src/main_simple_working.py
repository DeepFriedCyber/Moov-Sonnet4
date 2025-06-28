from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List
import numpy as np
import os
import logging
import sys

# Add current directory to path for imports
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Import our verified working components
try:
    from services.embedding_cache import EmbeddingCache
    from models.embedding_model import EmbeddingModel
    print("✅ All modules imported successfully")
except ImportError as e:
    print(f"❌ Import error: {e}")
    sys.exit(1)

app = FastAPI(title="Property Embedding Service - Simple Working Version")

# Initialize model (we know this works from manual test)
print("🔄 Loading embedding model...")
model = EmbeddingModel()
print("✅ Embedding model loaded")

# Initialize cache (we know this works from manual test)
cache = None
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

# Request/Response models
class SearchQuery(BaseModel):
    query: str

class EmbeddingResponse(BaseModel):
    embedding: List[float]
    cached: bool = False
    cache_stats: dict = {}

@app.get("/")
async def root():
    return {
        "message": "Property Embedding Service - Simple Working Version", 
        "version": "1.0.0",
        "status": "running"
    }

@app.get("/health")
async def health_check():
    return {
        "status": "healthy", 
        "model": model.get_model_info(),
        "cache_available": cache is not None,
        "cache_type": "enhanced" if cache else "none"
    }

@app.post("/embed", response_model=EmbeddingResponse)
async def generate_embedding(request: SearchQuery):
    """Generate embedding with optional caching"""
    
    try:
        if cache:
            # Use enhanced caching (we know this works)
            embedding = cache.get_or_generate(request.query)
            current_stats = cache.get_cache_stats()
            
            return EmbeddingResponse(
                embedding=embedding.tolist(),
                cached=current_stats.get("cache_hits", 0) > 0,
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
    except Exception as e:
        logger.error(f"Error generating embedding: {e}")
        raise HTTPException(status_code=500, detail=f"Error generating embedding: {str(e)}")

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

if __name__ == "__main__":
    import uvicorn
    print("🚀 Starting Property Embedding Service...")
    print("📊 Enhanced caching:", "✅ Enabled" if cache else "❌ Disabled")
    print("🌐 Service will be available at: http://localhost:8001")
    print("📖 API docs at: http://localhost:8001/docs")
    print("🛑 Press Ctrl+C to stop")
    
    uvicorn.run(app, host="127.0.0.1", port=8001, log_level="info")