from fastapi import FastAPI, HTTPException
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

@asynccontextmanager
async def lifespan(app: FastAPI):
    global models, redis_client

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
    
    yield
    
    # Cleanup on shutdown
    logger.info("Shutting down embedding service...")
    if redis_client:
        redis_client.close()

app = FastAPI(
    title="Property Embedding Service", 
    version="1.0.0",
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
    return {
        "status": "healthy",
        "models_loaded": list(models.keys()),
        "redis_connected": redis_client is not None
    }

@app.post("/embed", response_model=EmbeddingResponse)
async def create_embeddings(request: EmbeddingRequest):
    try:
        # Ensure model_name is always a string
        model_name = request.model if request.model and request.model in models else "primary"
        model = models[model_name]

        # Generate embeddings
        embeddings = model.encode(request.texts)

        # Convert to list for JSON serialization
        embeddings_list = [embedding.tolist() for embedding in embeddings]

        # Cache embeddings if Redis is available
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
