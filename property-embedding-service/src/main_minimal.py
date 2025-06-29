"""
Minimal working version for testing
"""
from fastapi import FastAPI
from pydantic import BaseModel
from typing import List
import sys
import os

# Add current directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Simple imports with fallbacks
try:
    from sentence_transformers import SentenceTransformer
    print("✅ SentenceTransformers available")
except ImportError:
    print("❌ SentenceTransformers not available")
    sys.exit(1)

try:
    import redis
    redis_client = redis.from_url("redis://localhost:6379")
    redis_client.ping()
    print("✅ Redis connection successful")
    REDIS_AVAILABLE = True
except Exception as e:
    print(f"⚠️ Redis not available: {e}")
    REDIS_AVAILABLE = False

# Initialize FastAPI
app = FastAPI(title="Minimal Property Embedding Service")

# Initialize model
print("🔄 Loading model...")
model = SentenceTransformer('all-MiniLM-L6-v2')
print("✅ Model loaded")

# Simple cache
cache = {}

class QueryRequest(BaseModel):
    query: str

class EmbeddingResponse(BaseModel):
    embedding: List[float]
    cached: bool = False

@app.get("/")
async def root():
    return {"message": "Minimal Property Embedding Service", "status": "running"}

@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "model": "all-MiniLM-L6-v2",
        "redis_available": REDIS_AVAILABLE
    }

@app.post("/embed", response_model=EmbeddingResponse)
async def embed(request: QueryRequest):
    query = request.query
    
    # Check simple cache first
    if query in cache:
        return EmbeddingResponse(
            embedding=cache[query],
            cached=True
        )
    
    # Generate embedding
    embedding = model.encode(query)
    embedding_list = embedding.tolist()
    
    # Store in cache
    cache[query] = embedding_list
    
    return EmbeddingResponse(
        embedding=embedding_list,
        cached=False
    )

@app.get("/cache/stats")
async def cache_stats():
    return {
        "cache_size": len(cache),
        "redis_available": REDIS_AVAILABLE
    }

if __name__ == "__main__":
    import uvicorn
    print("🚀 Starting minimal service on http://localhost:8001")
    uvicorn.run(app, host="127.0.0.1", port=8001)