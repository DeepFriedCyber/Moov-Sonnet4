from fastapi import FastAPI, HTTPException, Response, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from contextlib import asynccontextmanager
import uvicorn
import os
from sentence_transformers import SentenceTransformer
import numpy as np
import redis
import json
import logging
import time
from datetime import datetime
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from services.embedding_cache import EmbeddingCache

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Models
class EmbeddingRequest(BaseModel):
    texts: List[str]
    model: Optional[str] = "primary"

class EmbeddingResponse(BaseModel):
    embeddings: List[List[float]]
    model_used: str

class SearchRequest(BaseModel):
    query: str
    property_embeddings: List[List[float]]
    property_ids: List[str]
    top_k: Optional[int] = 10

class SearchResponse(BaseModel):
    results: List[dict]
    query_embedding: List[float]

# Global variables
models = {}
redis_client = None
embedding_cache = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global models, redis_client, embedding_cache

    logger.info("Loading embedding models...")

    # Load primary model
    models["primary"] = SentenceTransformer('all-MiniLM-L6-v2')
    logger.info("✅ Primary model loaded: all-MiniLM-L6-v2")

    # Load fallback model
    try:
        models["fallback"] = SentenceTransformer('all-mpnet-base-v2')
        logger.info("✅ Fallback model loaded: all-mpnet-base-v2")
    except Exception as e:
        logger.warning(f"Failed to load fallback model: {e}")

    # Connect to Redis
    try:
        redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
        redis_client = redis.from_url(redis_url)
        redis_client.ping()
        logger.info("✅ Connected to Redis")
    except Exception as e:
        logger.warning(f"Failed to connect to Redis: {e}")
    
    # Initialize enhanced embedding cache
    try:
        embedding_cache = EmbeddingCache(redis_client, models["primary"])
        logger.info("✅ Enhanced embedding cache initialized")
    except Exception as e:
        logger.error(f"Failed to initialize embedding cache: {e}")
    
    yield
    
    # Cleanup on shutdown
    logger.info("Shutting down embedding service...")
    if redis_client:
        redis_client.close()

app = FastAPI(
    title="Enhanced Property Embedding Service", 
    version="2.0.0",
    description="High-performance embedding service with semantic clustering and cost optimization",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": "Property Embedding Service", "status": "running"}

@app.get("/health")
async def health_check():
    import psutil
    import time
    
    health_status = {
        "status": "healthy",
        "timestamp": time.time(),
        "service": "embedding-service",
        "version": "1.0.0",
        "models": {
            "loaded": list(models.keys()),
            "primary_available": "primary" in models,
            "fallback_available": "fallback" in models
        },
        "redis": {
            "connected": False,
            "ping_success": False
        },
        "system": {
            "cpu_percent": psutil.cpu_percent(),
            "memory_percent": psutil.virtual_memory().percent,
            "disk_percent": psutil.disk_usage('/').percent
        }
    }
    
    # Check Redis connection
    if redis_client:
        try:
            redis_client.ping()
            health_status["redis"]["connected"] = True
            health_status["redis"]["ping_success"] = True
        except Exception as e:
            health_status["redis"]["connected"] = True
            health_status["redis"]["ping_success"] = False
            health_status["redis"]["error"] = str(e)
            health_status["status"] = "degraded"
    
    # Check if critical models are loaded
    if "primary" not in models:
        health_status["status"] = "unhealthy"
    
    return health_status

@app.get("/ready")
async def readiness_check():
    """Kubernetes readiness probe endpoint"""
    if "primary" not in models:
        raise HTTPException(status_code=503, detail="Primary model not loaded")
    
    return {"status": "ready", "models_loaded": list(models.keys())}

@app.get("/live")
async def liveness_check():
    """Kubernetes liveness probe endpoint"""
    return {"status": "alive", "timestamp": time.time()}

@app.get("/metrics")
async def metrics():
    """Prometheus metrics endpoint"""
    import psutil
    import time
    
    metrics_text = f"""# HELP embedding_service_models_loaded Number of models loaded
# TYPE embedding_service_models_loaded gauge
embedding_service_models_loaded {len(models)}

# HELP embedding_service_redis_connected Redis connection status
# TYPE embedding_service_redis_connected gauge
embedding_service_redis_connected {1 if redis_client else 0}

# HELP embedding_service_memory_usage_percent Memory usage percentage
# TYPE embedding_service_memory_usage_percent gauge
embedding_service_memory_usage_percent {psutil.virtual_memory().percent}

# HELP embedding_service_cpu_usage_percent CPU usage percentage
# TYPE embedding_service_cpu_usage_percent gauge
embedding_service_cpu_usage_percent {psutil.cpu_percent()}

# HELP embedding_service_uptime_seconds Service uptime in seconds
# TYPE embedding_service_uptime_seconds counter
embedding_service_uptime_seconds {time.time()}
"""
    
    return Response(content=metrics_text, media_type="text/plain")

# Enhanced cache endpoints
@app.get("/cache/stats")
async def get_enhanced_cache_stats():
    """Get comprehensive cache performance statistics"""
    if not embedding_cache:
        raise HTTPException(status_code=503, detail="Enhanced cache not available")
    
    try:
        stats = embedding_cache.get_cache_stats()
        stats["timestamp"] = datetime.now().isoformat()
        return stats
    except Exception as e:
        logger.error(f"Error getting cache stats: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get cache stats: {str(e)}")

@app.post("/cache/clear")
async def clear_enhanced_cache():
    """Clear enhanced cache (admin function)"""
    if not embedding_cache:
        raise HTTPException(status_code=503, detail="Enhanced cache not available")
    
    try:
        embedding_cache.clear_cache()
        logger.info("Enhanced cache cleared successfully")
        return {"message": "Enhanced cache cleared successfully", "timestamp": datetime.now().isoformat()}
    except Exception as e:
        logger.error(f"Error clearing cache: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to clear cache: {str(e)}")

@app.post("/cache/preload")
async def preload_common_queries(background_tasks: BackgroundTasks):
    """Preload common property search queries for better performance"""
    if not embedding_cache:
        raise HTTPException(status_code=503, detail="Enhanced cache not available")
    
    def preload_queries():
        common_queries = [
            # Property types
            "luxury apartment London", "2 bedroom flat Manchester", "studio apartment Birmingham",
            "3 bedroom house Leeds", "1 bedroom flat London", "family home with garden",
            
            # Location-based
            "apartment central London", "flat near tube station", "house with parking",
            "property near schools", "flat with balcony", "house with garden",
            
            # Price-based
            "budget apartment London", "luxury penthouse", "affordable flat Manchester",
            "premium apartment Birmingham", "cheap studio London", "expensive house Leeds",
            
            # Feature-based
            "apartment with gym", "flat with concierge", "house with garage",
            "property with garden", "apartment with view", "flat near transport"
        ]
        
        logger.info(f"Preloading {len(common_queries)} common queries...")
        
        for query in common_queries:
            try:
                embedding_cache.get_or_generate(query)
            except Exception as e:
                logger.warning(f"Failed to preload query '{query}': {e}")
        
        logger.info("Query preloading completed")
    
    background_tasks.add_task(preload_queries)
    return {"message": "Query preloading started", "queries_count": 24}

@app.post("/embed", response_model=EmbeddingResponse)
async def create_embeddings(request: EmbeddingRequest):
    try:
        # Ensure model_name is always a string
        model_name = request.model if request.model and request.model in models else "primary"
        model = models[model_name]

        # Use enhanced caching for single queries, direct model for batch
        if len(request.texts) == 1 and embedding_cache:
            # Single query - use enhanced cache with semantic clustering
            embedding = embedding_cache.get_or_generate(request.texts[0])
            embeddings_list = [embedding.tolist()]
        else:
            # Batch queries - use direct model encoding
            embeddings = model.encode(request.texts)
            embeddings_list = [embedding.tolist() for embedding in embeddings]

            # Cache individual embeddings if Redis is available
            if redis_client:
                for i, text in enumerate(request.texts):
                    cache_key = f"embedding:{hash(text)}:{model_name}"
                    redis_client.setex(
                        cache_key, 
                        3600,  # 1 hour TTL
                        json.dumps(embeddings_list[i])
                    )

        return EmbeddingResponse(
            embeddings=embeddings_list,
            model_used=model_name
        )

    except Exception as e:
        logger.error(f"Error creating embeddings: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/search", response_model=SearchResponse)
async def semantic_search(request: SearchRequest):
    try:
        # Get query embedding
        model = models.get("primary")
        if not model:
            raise HTTPException(status_code=500, detail="Primary model not loaded")

        query_embedding = model.encode([request.query])[0]

        # Calculate similarities
        similarities = []
        for i, prop_embedding in enumerate(request.property_embeddings):
            similarity = np.dot(query_embedding, prop_embedding) / (
                np.linalg.norm(query_embedding) * np.linalg.norm(prop_embedding)
            )
            similarities.append({
                "property_id": request.property_ids[i],
                "similarity": float(similarity),
                "index": i
            })

        # Sort by similarity and return top k
        similarities.sort(key=lambda x: x["similarity"], reverse=True)
        top_results = similarities[:request.top_k]

        return SearchResponse(
            results=top_results,
            query_embedding=query_embedding.tolist()
        )

    except Exception as e:
        logger.error(f"Error in semantic search: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/similar")
async def find_similar_properties(property_embedding: List[float], 
                                 candidate_embeddings: List[List[float]],
                                 candidate_ids: List[str],
                                 top_k: int = 5):
    try:
        similarities = []
        for i, candidate_embedding in enumerate(candidate_embeddings):
            similarity = np.dot(property_embedding, candidate_embedding) / (
                np.linalg.norm(property_embedding) * np.linalg.norm(candidate_embedding)
            )
            similarities.append({
                "property_id": candidate_ids[i],
                "similarity": float(similarity)
            })

        similarities.sort(key=lambda x: x["similarity"], reverse=True)
        return {"similar_properties": similarities[:top_k]}

    except Exception as e:
        logger.error(f"Error finding similar properties: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8001,
        reload=True,
        log_level="info"
    )
