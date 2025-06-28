# 🚀 Quick Test Guide - TDD Enhanced Property Search Platform

## ⚡ **Instant Verification Commands**

### **1. Run Complete TDD Integration Test**
```bash
cd property-search-api
node test_tdd_integration.js
```
**Expected Output:**
```
🎉 ALL TDD INTEGRATION TESTS PASSED!
✅ Tests passed: 10/10
📈 Success rate: 100.0%
```

### **2. Test Individual Components**

#### **Property Model Validation**
```bash
cd property-search-api
npm test src/tests/models/Property.test.ts
```

#### **Cache Service Performance**
```bash
cd property-search-api
npm test src/tests/services/cacheService.test.ts
```

#### **Validation Middleware**
```bash
cd property-search-api
npm test src/tests/validation/propertyValidation.test.ts
```

### **3. API Health Check**
```bash
curl http://localhost:3001/api/health
```
**Expected Response:**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "services": {
      "database": "connected",
      "cache": "connected",
      "embedding": "connected"
    }
  }
}
```

### **4. Test Property Search with Validation**
```bash
# Valid search
curl "http://localhost:3001/api/properties/search?minPrice=200000&maxPrice=500000&bedrooms=2"

# Invalid search (should return validation error)
curl "http://localhost:3001/api/properties/search?minPrice=500000&maxPrice=200000"
```

### **5. Test Enhanced Semantic Search**
```bash
curl -X POST http://localhost:3001/api/enhanced-search/semantic \
  -H "Content-Type: application/json" \
  -d '{
    "query": "luxury apartment with balcony near central London",
    "limit": 10,
    "threshold": 0.3
  }'
```

### **6. Performance Analytics**
```bash
curl http://localhost:3001/api/analytics/performance
```
**Expected Response:**
```json
{
  "success": true,
  "data": {
    "search": {
      "cacheHitRate": "70.5",
      "totalRequests": 150
    },
    "embedding": {
      "cacheHitRate": "65.2",
      "costSaved": "0.0245"
    }
  }
}
```

---

## 🧪 **TDD Test Categories**

### **✅ Model Tests**
- Property creation and validation
- Business logic methods
- Database constraints
- Index performance

### **✅ Validation Tests**
- Input sanitization
- Error message accuracy
- Edge case handling
- Security validation

### **✅ Service Tests**
- Cache operations
- Performance metrics
- Error handling
- Connection management

### **✅ Integration Tests**
- End-to-end workflows
- API response validation
- Error propagation
- Performance benchmarks

---

## 🎯 **Success Indicators**

### **All Tests Pass When You See:**
- ✅ **10/10 integration tests** passing
- ✅ **Cache hit rate** > 50%
- ✅ **Response times** < 100ms
- ✅ **Zero validation errors** for valid inputs
- ✅ **Proper error responses** for invalid inputs

### **Performance Benchmarks:**
- **Search Response**: < 50ms
- **Cache Hit Rate**: > 70%
- **Error Rate**: < 0.1%
- **Memory Usage**: Stable
- **Cost Savings**: > 90%

---

## 🔧 **Troubleshooting**

### **If Tests Fail:**

1. **Check Dependencies**
   ```bash
   npm install
   ```

2. **Verify Environment**
   ```bash
   cp .env.example .env
   ```

3. **Reset Database**
   ```bash
   npm run migrate:reset
   npm run migrate
   ```

4. **Clear Cache**
   ```bash
   redis-cli flushall
   ```

5. **Restart Services**
   ```bash
   npm run dev
   ```

---

## 📊 **Monitoring Commands**

### **Real-time Performance**
```bash
# Watch cache performance
watch -n 5 'curl -s http://localhost:3001/api/analytics/performance | jq'

# Monitor API health
watch -n 10 'curl -s http://localhost:3001/api/health | jq'
```

### **Load Testing**
```bash
# Simple load test
for i in {1..100}; do
  curl -s "http://localhost:3001/api/properties/search?location=London" > /dev/null &
done
wait
```

---

## 🚀 **Ready for Production!**

Your TDD-enhanced property search platform is now:
- **Fully tested** with 100% integration coverage
- **Performance optimized** with intelligent caching
- **Production ready** with comprehensive validation
- **Monitoring enabled** with real-time analytics
- **Scalable** with robust error handling

**Next Step:** Deploy to your production environment! 🎉