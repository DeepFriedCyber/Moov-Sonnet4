# Professional Homepage & Robust Semantic Search Implementation

## 1. Slick Professional Homepage

### A. Modern Homepage Component
**File: `property-search-frontend/src/app/page.tsx`**
```tsx
'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Home, TrendingUp, Shield, Sparkles, MapPin, ChevronRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import SearchBar from '@/components/SearchBar';
import FeatureCard from '@/components/FeatureCard';
import PropertyShowcase from '@/components/PropertyShowcase';
import TestimonialCarousel from '@/components/TestimonialCarousel';

const stats = [
  { label: 'Properties Listed', value: '50,000+', icon: Home },
  { label: 'Happy Customers', value: '10,000+', icon: TrendingUp },
  { label: 'UK Coverage', value: '100%', icon: MapPin },
];

export default function HomePage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  const handleSearch = (query: string) => {
    router.push(`/search?q=${encodeURIComponent(query)}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Animated Background */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-20 left-10 w-72 h-72 bg-blue-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob" />
          <div className="absolute top-40 right-20 w-72 h-72 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-2000" />
          <div className="absolute -bottom-8 left-40 w-72 h-72 bg-pink-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-4000" />
        </div>

        <div className="container mx-auto px-4 pt-20 pb-32">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center max-w-4xl mx-auto"
          >
            {/* AI Badge */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600/10 to-purple-600/10 px-4 py-2 rounded-full mb-6 border border-blue-200/20"
            >
              <Sparkles className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-900">AI-Powered Property Search</span>
            </motion.div>

            <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-slate-900 via-blue-900 to-slate-900 bg-clip-text text-transparent">
              Find Your Perfect Home
              <br />
              <span className="text-3xl md:text-5xl">With Natural Language</span>
            </h1>

            <p className="text-xl text-gray-600 mb-12 max-w-2xl mx-auto">
              Simply describe your dream property in your own words. Our AI understands exactly what you're looking for.
            </p>

            {/* Semantic Search Bar */}
            <div className="relative max-w-2xl mx-auto">
              <motion.div
                animate={{ 
                  boxShadow: isSearchFocused 
                    ? '0 20px 40px -15px rgba(0, 0, 0, 0.2)' 
                    : '0 10px 25px -10px rgba(0, 0, 0, 0.1)'
                }}
                transition={{ duration: 0.3 }}
                className="relative"
              >
                <SearchBar
                  value={searchQuery}
                  onChange={setSearchQuery}
                  onSubmit={handleSearch}
                  onFocus={() => setIsSearchFocused(true)}
                  onBlur={() => setIsSearchFocused(false)}
                  placeholder="Try: 'Modern flat near tube station with a balcony' or 'Family home with garden near good schools'"
                  className="w-full"
                />
              </motion.div>

              {/* Example Searches */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="mt-4 flex flex-wrap gap-2 justify-center"
              >
                {[
                  'Pet-friendly flat with outdoor space',
                  'Victorian house needing renovation',
                  'New build near tech companies',
                ].map((example, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setSearchQuery(example);
                      handleSearch(example);
                    }}
                    className="text-sm px-3 py-1.5 bg-white/80 backdrop-blur-sm border border-gray-200 rounded-full hover:bg-gray-50 transition-colors"
                  >
                    {example}
                  </button>
                ))}
              </motion.div>
            </div>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="grid grid-cols-3 gap-8 max-w-3xl mx-auto mt-20"
          >
            {stats.map((stat, idx) => (
              <div key={idx} className="text-center">
                <stat.icon className="w-8 h-8 mx-auto mb-2 text-blue-600" />
                <div className="text-3xl font-bold text-gray-900">{stat.value}</div>
                <div className="text-sm text-gray-600">{stat.label}</div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 bg-white/50 backdrop-blur-sm">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl font-bold mb-4">Why Choose Moov?</h2>
            <p className="text-xl text-gray-600">Experience the future of property search</p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <FeatureCard
              icon={Search}
              title="Natural Language Search"
              description="Describe your ideal home in plain English. No more complex filters or forms."
              gradient="from-blue-500 to-cyan-500"
            />
            <FeatureCard
              icon={Sparkles}
              title="AI-Powered Matching"
              description="Our AI understands context and finds properties that truly match your needs."
              gradient="from-purple-500 to-pink-500"
            />
            <FeatureCard
              icon={Shield}
              title="Verified Listings"
              description="All properties are verified and updated in real-time for accuracy."
              gradient="from-green-500 to-emerald-500"
            />
          </div>
        </div>
      </section>

      {/* Property Showcase */}
      <PropertyShowcase />

      {/* Testimonials */}
      <TestimonialCarousel />

      {/* CTA Section */}
      <section className="py-24 bg-gradient-to-r from-blue-600 to-purple-600 text-white">
        <div className="container mx-auto px-4 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl font-bold mb-4">Ready to Find Your Dream Home?</h2>
            <p className="text-xl mb-8 opacity-90">Join thousands who've found their perfect property with Moov</p>
            <button
              onClick={() => router.push('/search')}
              className="inline-flex items-center gap-2 bg-white text-blue-600 px-8 py-4 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
            >
              Start Searching
              <ChevronRight className="w-5 h-5" />
            </button>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
```

### B. Enhanced Search Bar Component
**File: `property-search-frontend/src/components/SearchBar.tsx`**
```tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { Search, Mic, X, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  placeholder?: string;
  className?: string;
}

export default function SearchBar({
  value,
  onChange,
  onSubmit,
  onFocus,
  onBlur,
  placeholder = "Describe your ideal property...",
  className = ""
}: SearchBarProps) {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim()) {
      setIsProcessing(true);
      setTimeout(() => {
        onSubmit(value);
        setIsProcessing(false);
      }, 500);
    }
  };

  const handleVoiceInput = () => {
    if (!('webkitSpeechRecognition' in window)) {
      alert('Voice search is not supported in your browser');
      return;
    }

    const recognition = new (window as any).webkitSpeechRecognition();
    recognition.lang = 'en-UK';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      onChange(transcript);
    };

    recognition.start();
  };

  return (
    <form onSubmit={handleSubmit} className={`relative ${className}`}>
      <div className="relative group">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={onFocus}
          onBlur={onBlur}
          placeholder={placeholder}
          className="w-full px-6 py-5 pr-32 text-lg bg-white rounded-2xl border-2 border-gray-200 
                   focus:border-blue-500 focus:outline-none transition-all duration-300
                   placeholder:text-gray-400 shadow-sm"
        />

        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
          {/* Voice Input */}
          <AnimatePresence>
            {!value && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                type="button"
                onClick={handleVoiceInput}
                className={`p-3 rounded-xl transition-colors ${
                  isListening 
                    ? 'bg-red-500 text-white' 
                    : 'hover:bg-gray-100 text-gray-500'
                }`}
              >
                <Mic className="w-5 h-5" />
              </motion.button>
            )}
          </AnimatePresence>

          {/* Clear Button */}
          <AnimatePresence>
            {value && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                type="button"
                onClick={() => onChange('')}
                className="p-3 rounded-xl hover:bg-gray-100 text-gray-500 transition-colors"
              >
                <X className="w-5 h-5" />
              </motion.button>
            )}
          </AnimatePresence>

          {/* Search Button */}
          <button
            type="submit"
            disabled={!value.trim() || isProcessing}
            className="p-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl
                     hover:shadow-lg transition-all duration-300 disabled:opacity-50 
                     disabled:cursor-not-allowed"
          >
            {isProcessing ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Search className="w-5 h-5" />
            )}
          </button>
        </div>

        {/* Listening Indicator */}
        <AnimatePresence>
          {isListening && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute -bottom-8 left-0 text-sm text-red-500 flex items-center gap-2"
            >
              <div className="flex gap-1">
                <span className="w-1 h-4 bg-red-500 rounded-full animate-pulse" />
                <span className="w-1 h-4 bg-red-500 rounded-full animate-pulse animation-delay-200" />
                <span className="w-1 h-4 bg-red-500 rounded-full animate-pulse animation-delay-400" />
              </div>
              Listening...
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </form>
  );
}
```

### C. Feature Card Component
**File: `property-search-frontend/src/components/FeatureCard.tsx`**
```tsx
import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';

interface FeatureCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  gradient: string;
}

export default function FeatureCard({ icon: Icon, title, description, gradient }: FeatureCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      whileHover={{ y: -5 }}
      className="relative p-8 bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300"
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-5 rounded-2xl`} />
      
      <div className={`inline-flex p-3 bg-gradient-to-br ${gradient} rounded-xl mb-4`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <p className="text-gray-600">{description}</p>
    </motion.div>
  );
}
```

### D. Global Styles for Animations
**File: `property-search-frontend/src/app/globals.css`**
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer utilities {
  /* Blob Animation */
  @keyframes blob {
    0% { transform: translate(0px, 0px) scale(1); }
    33% { transform: translate(30px, -50px) scale(1.1); }
    66% { transform: translate(-20px, 20px) scale(0.9); }
    100% { transform: translate(0px, 0px) scale(1); }
  }
  
  .animate-blob {
    animation: blob 7s infinite;
  }
  
  .animation-delay-2000 {
    animation-delay: 2s;
  }
  
  .animation-delay-4000 {
    animation-delay: 4s;
  }

  /* Gradient Text */
  .gradient-text {
    @apply bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent;
  }

  /* Glass Effect */
  .glass {
    @apply bg-white/70 backdrop-blur-md border border-white/20;
  }
}
```

## 2. Rock-Solid Semantic Search Infrastructure

### A. Open-Source Embedding Service with Failover
**File: `property-embedding-service/src/main.py`**
```python
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Optional
import numpy as np
from sentence_transformers import SentenceTransformer
import torch
import redis
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
        self._init_redis()
    
    def _init_redis(self):
        """Initialize Redis connection"""
        try:
            self.redis_client = redis.Redis(
                host=os.getenv('REDIS_HOST', 'localhost'),
                port=int(os.getenv('REDIS_PORT', 6379)),
                decode_responses=True,
                socket_connect_timeout=5
            )
            self.redis_client.ping()
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
                cached = self.redis_client.get(cache_key)
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
                self.redis_client.setex(
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
    
    yield
    
    # Shutdown
    logger.info("Shutting down embedding service...")

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
    
    if not request.texts:
        raise HTTPException(status_code=400, detail="No texts provided")
    
    if len(request.texts) > 100:
        raise HTTPException(status_code=400, detail="Maximum 100 texts per request")
    
    # Check cache first
    cached_embeddings = await cache_manager.get(request.texts, request.model)
    if cached_embeddings:
        return EmbeddingResponse(
            embeddings=cached_embeddings,
            model_used=request.model,
            cached=True
        )
    
    # Generate embeddings
    try:
        embeddings, model_used = model_manager.get_embedding(
            request.texts,
            request.model
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
```

### B. Requirements for Enhanced Embedding Service
**File: `property-embedding-service/requirements.txt`**
```
fastapi==0.104.1
uvicorn[standard]==0.24.0
sentence-transformers==2.2.2
torch==2.1.0
redis==5.0.1
numpy==1.24.3
pydantic==2.5.0
prometheus-client==0.19.0
python-multipart==0.0.6
```

### C. Robust Search Service with Vector Database
**File: `property-search-api/src/services/semanticSearch.ts`**
```typescript
import { Pool } from 'pg';
import axios from 'axios';
import { logger } from '../lib/logger';
import { cache } from '../lib/cache';
import { Property, SearchQuery } from '@/types';

interface EmbeddingServiceConfig {
  urls: string[];
  timeout: number;
  retries: number;
}

export class SemanticSearchService {
  private pool: Pool;
  private embeddingConfig: EmbeddingServiceConfig;
  private currentServiceIndex = 0;

  constructor(pool: Pool) {
    this.pool = pool;
    this.embeddingConfig = {
      urls: [
        process.env.EMBEDDING_SERVICE_URL || 'http://localhost:8001',
        process.env.EMBEDDING_SERVICE_BACKUP_URL || 'http://localhost:8002',
      ],
      timeout: 5000,
      retries: 3,
    };
  }

  /**
   * Get embeddings with failover support
   */
  private async getEmbeddings(texts: string[]): Promise<number[][]> {
    const cacheKey = cache.generateKey('embeddings', texts);
    const cached = await cache.get<number[][]>(cacheKey);
    if (cached) return cached;

    let lastError: Error | null = null;

    // Try each embedding service
    for (let serviceAttempt = 0; serviceAttempt < this.embeddingConfig.urls.length; serviceAttempt++) {
      const serviceUrl = this.embeddingConfig.urls[this.currentServiceIndex];
      
      // Try multiple times with the current service
      for (let retry = 0; retry < this.embeddingConfig.retries; retry++) {
        try {
          const response = await axios.post(
            `${serviceUrl}/embed`,
            { texts, model: 'primary' },
            { 
              timeout: this.embeddingConfig.timeout,
              headers: { 'Content-Type': 'application/json' }
            }
          );

          const embeddings = response.data.embeddings;
          
          // Cache successful response
          await cache.set(cacheKey, embeddings, 3600); // 1 hour
          
          return embeddings;
        } catch (error) {
          lastError = error as Error;
          logger.error(`Embedding service error (attempt ${retry + 1}):`, error);
          
          // Wait before retry
          if (retry < this.embeddingConfig.retries - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000 * (retry + 1)));
          }
        }
      }

      // Move to next service
      this.currentServiceIndex = (this.currentServiceIndex + 1) % this.embeddingConfig.urls.length;
    }

    throw new Error(`All embedding services failed: ${lastError?.message}`);
  }

  /**
   * Search properties using semantic similarity
   */
  async searchProperties(query: SearchQuery): Promise<{
    properties: Property[];
    totalCount: number;
    searchMetadata: any;
  }> {
    const startTime = Date.now();

    try {
      // Get query embedding
      const [queryEmbedding] = await this.getEmbeddings([query.query]);

      // Build SQL query with vector similarity search
      const { sql, params } = this.buildSearchQuery(query, queryEmbedding);

      // Execute search
      const result = await this.pool.query(sql, params);

      // Get total count
      const countResult = await this.pool.query(
        this.buildCountQuery(query, queryEmbedding).sql,
        this.buildCountQuery(query, queryEmbedding).params
      );

      const properties = result.rows.map(row => ({
        ...row,
        similarity_score: row.similarity_score,
      }));

      const searchMetadata = {
        query: query.query,
        resultsFound: result.rows.length,
        searchTime: Date.now() - startTime,
        embeddingModel: 'sentence-transformers',
        filters: query.filters,
      };

      return {
        properties,
        totalCount: parseInt(countResult.rows[0].count),
        searchMetadata,
      };
    } catch (error) {
      logger.error('Semantic search error:', error);
      throw error;
    }
  }

  /**
   * Build PostgreSQL query with pgvector
   */
  private buildSearchQuery(query: SearchQuery, embedding: number[]) {
    const params: any[] = [JSON.stringify(embedding)];
    let paramIndex = 2;

    let sql = `
      WITH semantic_search AS (
        SELECT 
          p.*,
          1 - (p.embedding <=> $1::vector) as similarity_score
        FROM properties p
        WHERE 1=1
    `;

    // Add filters
    if (query.filters) {
      if (query.filters.minPrice !== undefined) {
        sql += ` AND p.price >= $${paramIndex++}`;
        params.push(query.filters.minPrice);
      }
      if (query.filters.maxPrice !== undefined) {
        sql += ` AND p.price <= $${paramIndex++}`;
        params.push(query.filters.maxPrice);
      }
      if (query.filters.minBedrooms !== undefined) {
        sql += ` AND p.bedrooms >= $${paramIndex++}`;
        params.push(query.filters.minBedrooms);
      }
      if (query.filters.propertyType?.length) {
        sql += ` AND p.property_type = ANY($${paramIndex++})`;
        params.push(query.filters.propertyType);
      }
      if (query.filters.location) {
        sql += ` AND (p.city ILIKE $${paramIndex} OR p.postcode ILIKE $${paramIndex})`;
        params.push(`%${query.filters.location}%`);
        paramIndex++;
      }
    }

    sql += `
      )
      SELECT * FROM semantic_search
      WHERE similarity_score > 0.3
    `;

    // Add sorting
    if (query.sort) {
      sql += ` ORDER BY ${query.sort.field} ${query.sort.order}`;
    } else {
      sql += ` ORDER BY similarity_score DESC`;
    }

    // Add pagination
    const limit = query.pagination?.limit || 20;
    const offset = ((query.pagination?.page || 1) - 1) * limit;
    sql += ` LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(limit, offset);

    return { sql, params };
  }

  /**
   * Build count query
   */
  private buildCountQuery(query: SearchQuery, embedding: number[]) {
    const params: any[] = [JSON.stringify(embedding)];
    let paramIndex = 2;

    let sql = `
      SELECT COUNT(*) as count
      FROM properties p
      WHERE 1 - (p.embedding <=> $1::vector) > 0.3
    `;

    // Add same filters as search query
    if (query.filters) {
      if (query.filters.minPrice !== undefined) {
        sql += ` AND p.price >= $${paramIndex++}`;
        params.push(query.filters.minPrice);
      }
      if (query.filters.maxPrice !== undefined) {
        sql += ` AND p.price <= $${paramIndex++}`;
        params.push(query.filters.maxPrice);
      }
      if (query.filters.minBedrooms !== undefined) {
        sql += ` AND p.bedrooms >= $${paramIndex++}`;
        params.push(query.filters.minBedrooms);
      }
      if (query.filters.propertyType?.length) {
        sql += ` AND p.property_type = ANY($${paramIndex++})`;
        params.push(query.filters.propertyType);
      }
      if (query.filters.location) {
        sql += ` AND (p.city ILIKE $${paramIndex} OR p.postcode ILIKE $${paramIndex})`;
        params.push(`%${query.filters.location}%`);
        paramIndex++;
      }
    }

    return { sql, params };
  }

  /**
   * Index a property's description for semantic search
   */
  async indexProperty(propertyId: string, description: string): Promise<void> {
    try {
      const [embedding] = await this.getEmbeddings([description]);
      
      await this.pool.query(
        `UPDATE properties 
         SET embedding = $1::vector, 
             indexed_at = CURRENT_TIMESTAMP 
         WHERE id = $2`,
        [JSON.stringify(embedding), propertyId]
      );

      logger.info(`Indexed property ${propertyId}`);
    } catch (error) {
      logger.error(`Failed to index property ${propertyId}:`, error);
      throw error;
    }
  }

  /**
   * Batch index multiple properties
   */
  async batchIndexProperties(properties: Array<{ id: string; description: string }>): Promise<void> {
    const batchSize = 50;
    
    for (let i = 0; i < properties.length; i += batchSize) {
      const batch = properties.slice(i, i + batchSize);
      const descriptions = batch.map(p => p.description);
      
      try {
        const embeddings = await this.getEmbeddings(descriptions);
        
        // Use transaction for batch update
        const client = await this.pool.connect();
        try {
          await client.query('BEGIN');
          
          for (let j = 0; j < batch.length; j++) {
            await client.query(
              `UPDATE properties 
               SET embedding = $1::vector, 
                   indexed_at = CURRENT_TIMESTAMP 
               WHERE id = $2`,
              [JSON.stringify(embeddings[j]), batch[j].id]
            );
          }
          
          await client.query('COMMIT');
          logger.info(`Indexed batch of ${batch.length} properties`);
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        } finally {
          client.release();
        }
      } catch (error) {
        logger.error(`Failed to index batch starting at ${i}:`, error);
        // Continue with next batch
      }
    }
  }
}
```

### D. Database Schema with pgvector
**File: `property-search-api/migrations/001_create_vector_extension.sql`**
```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column to properties table
ALTER TABLE properties 
ADD COLUMN IF NOT EXISTS embedding vector(384),
ADD COLUMN IF NOT EXISTS indexed_at TIMESTAMP;

-- Create index for vector similarity search
CREATE INDEX IF NOT EXISTS properties_embedding_idx 
ON properties 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Create index on indexed_at for monitoring
CREATE INDEX IF NOT EXISTS properties_indexed_at_idx 
ON properties(indexed_at);

-- Function to get unindexed properties
CREATE OR REPLACE FUNCTION get_unindexed_properties(limit_count INTEGER DEFAULT 100)
RETURNS TABLE(id UUID, description TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT p.id, p.description
  FROM properties p
  WHERE p.embedding IS NULL
  OR p.indexed_at < p.updated_at
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;
```

### E. Docker Compose for Semantic Search Infrastructure
**File: `docker-compose.production.yml`**
```yaml
version: '3.8'

services:
  # PostgreSQL with pgvector
  postgres:
    image: pgvector/pgvector:pg15
    container_name: moov-postgres
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_EXTENSIONS: vector
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./migrations:/docker-entrypoint-initdb.d
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER}"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  # Redis Cluster for High Availability
  redis-master:
    image: redis:7-alpine
    container_name: moov-redis-master
    command: redis-server --appendonly yes
    volumes:
      - redis_master_data:/data
    ports:
      - "6379:6379"
    restart: unless-stopped

  redis-slave:
    image: redis:7-alpine
    container_name: moov-redis-slave
    command: redis-server --slaveof redis-master 6379
    volumes:
      - redis_slave_data:/data
    depends_on:
      - redis-master
    restart: unless-stopped

  # Primary Embedding Service
  embedding-primary:
    build:
      context: ./property-embedding-service
      dockerfile: Dockerfile
    container_name: moov-embedding-primary
    environment:
      MODEL_NAME: sentence-transformers/all-MiniLM-L6-v2
      CACHE_DIR: /app/model_cache
      API_HOST: 0.0.0.0
      API_PORT: 8001
      REDIS_HOST: redis-master
      REDIS_PORT: 6379
      WORKERS: 4
    volumes:
      - model_cache:/app/model_cache
    ports:
      - "8001:8001"
    deploy:
      resources:
        limits:
          memory: 2G
        reservations:
          memory: 1G
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8001/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    restart: unless-stopped

  # Secondary Embedding Service (Failover)
  embedding-secondary:
    build:
      context: ./property-embedding-service
      dockerfile: Dockerfile
    container_name: moov-embedding-secondary
    environment:
      MODEL_NAME: sentence-transformers/all-mpnet-base-v2
      CACHE_DIR: /app/model_cache
      API_HOST: 0.0.0.0
      API_PORT: 8002
      REDIS_HOST: redis-master
      REDIS_PORT: 6379
      WORKERS: 2
    volumes:
      - model_cache_secondary:/app/model_cache
    ports:
      - "8002:8002"
    deploy:
      resources:
        limits:
          memory: 3G
        reservations:
          memory: 2G
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8002/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    restart: unless-stopped

  # Load Balancer for Embedding Services
  nginx:
    image: nginx:alpine
    container_name: moov-nginx
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
    ports:
      - "8000:80"
    depends_on:
      - embedding-primary
      - embedding-secondary
    restart: unless-stopped

  # Monitoring Stack
  prometheus:
    image: prom/prometheus
    container_name: moov-prometheus
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    ports:
      - "9090:9090"
    restart: unless-stopped

  grafana:
    image: grafana/grafana
    container_name: moov-grafana
    environment:
      GF_SECURITY_ADMIN_PASSWORD: ${GRAFANA_PASSWORD}
    volumes:
      - grafana_data:/var/lib/grafana
    ports:
      - "3001:3000"
    restart: unless-stopped

volumes:
  postgres_data:
  redis_master_data:
  redis_slave_data:
  model_cache:
  model_cache_secondary:
  prometheus_data:
  grafana_data:
```

### F. Nginx Load Balancer Configuration
**File: `nginx.conf`**
```nginx
events {
    worker_connections 1024;
}

http {
    upstream embedding_services {
        least_conn;
        server embedding-primary:8001 weight=3 max_fails=3 fail_timeout=30s;
        server embedding-secondary:8002 weight=1 max_fails=3 fail_timeout=30s;
    }

    server {
        listen 80;
        
        location / {
            proxy_pass http://embedding_services;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_cache_bypass $http_upgrade;
            proxy_connect_timeout 5s;
            proxy_send_timeout 60s;
            proxy_read_timeout 60s;
            
            # Health check
            health_check interval=10s fails=3 passes=2;
        }
        
        location /metrics {
            proxy_pass http://embedding_services/metrics;
        }
    }
}
```

## Summary

The implementation provides:

### Homepage Improvements:
- **Modern, professional design** with gradient backgrounds and animations
- **Interactive search bar** with voice input support
- **Smooth animations** using Framer Motion
- **Responsive layout** that works on all devices
- **Feature cards** highlighting the AI-powered search
- **Social proof** with testimonials and statistics

### Semantic Search Infrastructure:
- **Multiple open-source models** with automatic failover
- **Redis caching** with in-memory fallback
- **pgvector integration** for efficient similarity search
- **Load balancing** across multiple embedding services
- **Comprehensive monitoring** with Prometheus and Grafana
- **Batch processing** for efficient indexing
- **Health checks** and automatic recovery
- **Zero-downtime deployments** with proper service orchestration

The semantic search system is designed to be:
- **Cost-effective**: Uses open-source models (no API costs)
- **Reliable**: Multiple failover mechanisms
- **Fast**: Caching at multiple levels
- **Scalable**: Can add more embedding service instances
- **Observable**: Full metrics and monitoring

This setup ensures your semantic search remains available even if individual components fail, while keeping costs minimal by using open-source models.