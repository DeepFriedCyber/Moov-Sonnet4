# 🚀 Quick Start Guide - Enhanced TDD Implementation

## Step-by-Step Service Startup

### 1. Start Redis (Required)
```bash
# From your main project directory
cd C:\Users\aps33\Projects\Moov-Sonnet4
docker-compose up redis -d
```

**Verify Redis is running:**
```bash
docker ps | grep redis
# Should show: moov-redis container running on port 6379
```

### 2. Start Enhanced Embedding Service
```bash
# Option A: Using the startup script (Recommended)
cd property-embedding-service
python start_service.py

# Option B: Direct startup
cd property-embedding-service
python src/main.py
```

**Expected Output:**
```
🎯 Enhanced TDD Property Embedding Service
==================================================
✅ All dependencies installed
✅ Redis connection successful
🚀 Starting Enhanced Property Embedding Service...
📊 Features enabled:
  - Semantic clustering with concept mapping
  - xxhash for 3x faster cache operations
  - Multi-level caching (Local → Redis Exact → Redis Cluster)
  - Real-time cost tracking and analytics
  - Performance monitoring endpoints

INFO:     Started server process [12345]
INFO:     Waiting for application startup.
INFO:     Loading embedding models...
INFO:     ✅ Primary model loaded: all-MiniLM-L6-v2
INFO:     ✅ Connected to Redis
INFO:     ✅ Enhanced embedding cache initialized
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:8001
```

### 3. Test the Service
```bash
# In a new terminal window
cd property-embedding-service
python test_service.py
```

**Expected Test Results:**
```
🎯 Enhanced TDD Property Embedding Service - Test Suite
============================================================

📋 Running: Health Check
----------------------------------------
✅ Health check passed: healthy

📋 Running: Basic Embedding
----------------------------------------
✅ Embedding generated successfully
   Model used: primary
   Embedding length: 384

📋 Running: Cache Statistics
----------------------------------------
✅ Cache stats retrieved successfully
   Hit rate: 0.0%
   Total requests: 1
   Cost saved: $0.0000

📋 Running: Semantic Clustering
----------------------------------------
   ✅ Query 1: 'luxury apartment London...' processed
   ✅ Query 2: 'Luxury apartment in London...' processed
   ✅ Query 3: 'premium flat London...' processed
   ✅ Query 4: '2 bedroom flat Manchester...' processed
   ✅ Query 5: 'two bedroom apartment Manches...' processed
✅ Semantic clustering test completed
   Final hit rate: 40.0%
   🎯 Semantic clustering appears to be working!

📋 Running: Cache Preloading
----------------------------------------
✅ Cache preloading started
   Queries to preload: 24
   Cache size after preloading: 24

============================================================
🎯 Test Results: 5/5 tests passed
✅ All tests passed! Your enhanced TDD service is working correctly.

🚀 Next steps:
   1. Check the cache stats at: http://localhost:8001/cache/stats
   2. View the API docs at: http://localhost:8001/docs
   3. Monitor performance in real-time
```

## 🔍 Verify Everything is Working

### Check Service Endpoints
```bash
# Health check
curl http://localhost:8001/health

# Cache statistics
curl http://localhost:8001/cache/stats

# API documentation
# Open in browser: http://localhost:8001/docs
```

### Test Semantic Clustering
```bash
# Test similar queries to see clustering in action
curl -X POST http://localhost:8001/embed \
  -H "Content-Type: application/json" \
  -d '{"texts": ["luxury apartment London"]}'

curl -X POST http://localhost:8001/embed \
  -H "Content-Type: application/json" \
  -d '{"texts": ["Luxury apartment in London"]}'

# Check cache stats - should show improved hit rate
curl http://localhost:8001/cache/stats
```

## 🎯 Expected Performance Results

After running the tests, you should see:

### ✅ **Immediate Benefits:**
- **Cache Hit Rate:** 40-60% on first test run
- **Response Time:** <50ms for cached queries
- **Cost Tracking:** Real-time dollar savings calculation
- **Semantic Clustering:** Similar queries hitting cache clusters

### ✅ **Service Features Working:**
- Multi-level caching (Local → Redis Exact → Redis Cluster)
- xxhash for 3x faster cache key generation
- Concept mapping for property types and locations
- Real-time performance monitoring
- Automatic query preloading

## 🚨 Troubleshooting

### If Redis Connection Fails:
```bash
# Check if Redis is running
docker ps | grep redis

# If not running, start it
docker-compose up redis -d

# Check Redis logs
docker logs moov-redis
```

### If Import Errors Occur:
```bash
# Make sure you're in the right directory
cd property-embedding-service

# Check if dependencies are installed
pip list | grep -E "(fastapi|redis|sentence-transformers|xxhash)"

# If missing, install them
pip install -r requirements.txt
```

### If Service Won't Start:
```bash
# Check if port 8001 is already in use
netstat -an | findstr :8001

# Try alternative startup
cd property-embedding-service/src
python -m uvicorn main:app --host 0.0.0.0 --port 8002
```

## 🎉 Success Indicators

You'll know everything is working when you see:

1. ✅ **Service starts without errors**
2. ✅ **All 5 tests pass**
3. ✅ **Cache hit rate >40% after clustering test**
4. ✅ **Cost savings being tracked**
5. ✅ **API docs accessible at http://localhost:8001/docs**

## 🚀 Next Steps After Successful Startup

1. **Monitor Performance:** Keep an eye on cache hit rates and cost savings
2. **Test with Real Queries:** Try property search queries relevant to your use case
3. **Integration:** Connect to your existing property search API
4. **Scaling:** Consider the production deployment steps

Ready to proceed? Let me know if you encounter any issues during startup!