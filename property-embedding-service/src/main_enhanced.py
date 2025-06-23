from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Optional
import numpy as np
from sentence_transformers import SentenceTransformer
import torch
import redis.asyncio as aioredis
import json
import hashlib
import logging
from datetime import datetime, timedelta
import asyncio
from contextlib import asynccontextmanager
import os
from prometheus_client import Counter, Histogram, generate_latest
import time

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Metrics
embedding_requests = Counter('embedding_requests_total', 'Total embedding requests')
embedding_errors = Counter('embedding_errors_total', 'Total embedding errors')
embedding_duration = Histogram('embedding_duration_seconds', 'Embedding request duration')
cache_hits = Counter('cache_hits_total', 'Total cache hits')
cache_misses = Counter('cache_misses_total', 'Total cache misses')

class EmbeddingRequest(BaseModel):
    texts: List[str]
    model: Optional[str] = "primary"

class EmbeddingResponse(BaseModel):
    embeddings: List[List[float]]
    model_used: str
    cached: bool

class ModelManager:
    """Manages multiple embedding models with failover support"""
    
    def __init__(self):
        self.models = {}
        self.model_configs = {
            "primary": {
                "name": "sentence-transformers/all-MiniLM-L6-v2",
                "dimension": 384,
                "max_seq_length": 256,
            },
            "secondary": {
                "name": "sentence-transformers/all-mpnet-base-v2",
                "dimension": 768,
                "max_seq_length": 384,
            },
            "compact": {
                "name": "sentence-transformers/paraphrase-MiniLM-L3-v2",
                "dimension": 384,
                "max_seq_length": 128,
            }
        }
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self._load_models()
    
    def _load_models(self):
        """Load all models with error handling"""
        for model_key, config in self.model_configs.items():
            try:
                logger.info(f"Loading model: {config['name']}")
                model = SentenceTransformer(
                    config['name'],
                    device=self.device,
                    cache_folder="./model_cache"
                )
                model.max_seq_length = config['max_seq_length']
                self.models[model_key] = model
                logger.info(f"Successfully loaded model: {config['name']}")
            except Exception as e:
                logger.error(f"Failed to load model {config['name']}: {e}")
    
    def get_embedding(self, texts: List[str], model_key: str = "primary") -> tuple:
        """Get embeddings with automatic failover"""
        # Try requested model first
        if model_key in self.models:
            try:
                with embedding_duration.time():
                    embeddings = self.models[model_key].encode(
                        texts,
                        batch_size=32,
                        show_progress_bar=False,
                        convert_to_numpy=True,
                        normalize_embeddings=True
                    )
                return embeddings.tolist(), model_key
            except Exception as e:
                logger.error(f"Error with {model_key} model: {e}")
                embedding_errors.inc()
        
        # Failover to other models
        for fallback_key, model in self.models.items():
            if fallback_key != model_key:
                try:
                    logger.warning(f"Failing over from {model_key} to {fallback_key}")
                    with embedding_duration.time():
                        embeddings = model.encode(
                            texts,
                            batch_size=32,
                            show_progress_bar=False,
                            convert_to_numpy=True,
                            normalize_embeddings=True
                        )
                    return embeddings.tolist(), fallback_key
                except Exception as e:
                    logger.error(f"Error with fallback model {fallback_key}: {e}")
                    embedding_errors.inc()
        
        raise HTTPException(status_code=503, detail="All embedding models are unavailable")

class CacheManager:
    """Manages Redis caching with fallback to in-memory cache"""
    
    def __init__(self):
        self.redis_client = None
        self.memory_cache = {}
        self.cache_ttl = 86400  # 24 hours
    
    async def _init_redis(self):
        """Initialize Redis connection"""
        try:
            self.redis_client = aioredis.from_url(
                f"redis://{os.getenv('REDIS_HOST', 'localhost')}:{int(os.getenv('REDIS_PORT', 6379))}",
                decode_responses=True,
                socket_connect_timeout=5
            )
            await self.redis_client.ping()
            logger.info("Redis connection established")
        except Exception as e:
            logger.warning(f"Redis connection failed, using memory cache: {e}")
            self.redis_client = None
    
    def _get_cache_key(self, texts: List[str], model: str) -> str:
        """Generate cache key from texts and model"""
        content = json.dumps({"texts": sorted(texts), "model": model}, sort_keys=True)
        return f"embedding:{hashlib.sha256(content.encode()).hexdigest()}"
    
    async def get(self, texts: List[str], model: str) -> Optional[List[List[float]]]:
        """Get embeddings from cache"""
        cache_key = self._get_cache_key(texts, model)
        
        # Try Redis first
        if self.redis_client:
            try:
                cached = await self.redis_client.get(cache_key)
                if cached:
                    cache_hits.inc()
                    return json.loads(cached)
            except Exception as e:
                logger.error(f"Redis get error: {e}")
        
        # Fallback to memory cache
        if cache_key in self.memory_cache:
            cached_data, expiry = self.memory_cache[cache_key]
            if datetime.now() < expiry:
                cache_hits.inc()
                return cached_data
            else:
                del self.memory_cache[cache_key]
        
        cache_misses.inc()
        return None
    
    async def set(self, texts: List[str], model: str, embeddings: List[List[float]]):
        """Set embeddings in cache"""
        cache_key = self._get_cache_key(texts, model)
        
        # Try Redis first
        if self.redis_client:
            try:
                await self.redis_client.setex(
                    cache_key,
                    self.cache_ttl,
                    json.dumps(embeddings)
                )
            except Exception as e:
                logger.error(f"Redis set error: {e}")
        
        # Always set in memory cache as backup
        self.memory_cache[cache_key] = (
            embeddings,
            datetime.now() + timedelta(seconds=self.cache_ttl)
        )
        
        # Clean up old entries if memory cache gets too large
        if len(self.memory_cache) > 10000:
            self._cleanup_memory_cache()
    
    def _cleanup_memory_cache(self):
        """Remove expired entries from memory cache"""
        now = datetime.now()
        expired_keys = [
            key for key, (_, expiry) in self.memory_cache.items()
            if now >= expiry
        ]
        for key in expired_keys:
            del self.memory_cache[key]

# Global instances
model_manager = None
cache_manager = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifecycle"""
    global model_manager, cache_manager
    
    # Startup
    logger.info("Starting embedding service...")
    model_manager = ModelManager()
    cache_manager = CacheManager()
    await cache_manager._init_redis()
    
    yield
    
    # Shutdown
    logger.info("Shutting down embedding service...")
    if cache_manager and cache_manager.redis_client:
        await cache_manager.redis_client.close()

# Create FastAPI app
app = FastAPI(
    title="Property Embedding Service",
    version="2.0.0",
    lifespan=lifespan
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    # Check if managers are initialized
    if model_manager is None or cache_manager is None:
        return {
            "status": "initializing",
            "timestamp": datetime.now().isoformat(),
            "error": "Service is still initializing"
        }
    
    health_status = {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "models": {
            model_key: model_key in model_manager.models
            for model_key in model_manager.model_configs
        },
        "redis": cache_manager.redis_client is not None,
        "device": model_manager.device
    }
    
    # Check if at least one model is loaded
    if not any(health_status["models"].values()):
        return {"status": "unhealthy", "error": "No models loaded"}, 503
    
    return health_status

@app.get("/metrics")
async def metrics():
    """Prometheus metrics endpoint"""
    return generate_latest()

@app.post("/embed", response_model=EmbeddingResponse)
async def create_embeddings(request: EmbeddingRequest):
    """Create embeddings for given texts"""
    embedding_requests.inc()
    
    # Check if managers are initialized
    if model_manager is None or cache_manager is None:
        raise HTTPException(
            status_code=503, 
            detail="Service is still initializing. Please try again in a few moments."
        )
    
    if not request.texts:
        raise HTTPException(status_code=400, detail="No texts provided")
    
    if len(request.texts) > 100:
        raise HTTPException(status_code=400, detail="Maximum 100 texts per request")
    
    # Check cache first
    model_key = request.model or "primary"
    cached_embeddings = await cache_manager.get(request.texts, model_key)
    if cached_embeddings:
        return EmbeddingResponse(
            embeddings=cached_embeddings,
            model_used=model_key,
            cached=True
        )
    
    # Generate embeddings
    try:
        embeddings, model_used = model_manager.get_embedding(
            request.texts,
            model_key
        )
        
        # Cache the results
        await cache_manager.set(request.texts, model_used, embeddings)
        
        return EmbeddingResponse(
            embeddings=embeddings,
            model_used=model_used,
            cached=False
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Embedding generation error: {e}")
        embedding_errors.inc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/embed/batch")
async def create_embeddings_batch(requests: List[EmbeddingRequest]):
    """Batch endpoint for multiple embedding requests"""
    # Check if managers are initialized
    if model_manager is None or cache_manager is None:
        raise HTTPException(
            status_code=503, 
            detail="Service is still initializing. Please try again in a few moments."
        )
        
    if len(requests) > 10:
        raise HTTPException(status_code=400, detail="Maximum 10 requests per batch")
    
    results = []
    for request in requests:
        try:
            result = await create_embeddings(request)
            results.append({"status": "success", "data": result})
        except Exception as e:
            results.append({"status": "error", "error": str(e)})
    
    return results

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        app,
        host=os.getenv("API_HOST", "0.0.0.0"),
        port=int(os.getenv("API_PORT", 8001)),
        workers=int(os.getenv("WORKERS", 1))
    )