# TDD Strategy for Core Differentiators
## Semantic Search, Chatbot & Local Places of Interest

## **🎯 Cost-Optimized Excellence Strategy**

Your three differentiators need precision testing and smart cost management. Here's how to make them exceptional while keeping API costs low:

---

## **🔍 1. Semantic Search Optimization**

### **Current Architecture Assessment**
- **Strength**: Using `all-MiniLM-L6-v2` (lightweight, local model)
- **Opportunity**: Smart caching and query optimization
- **Cost Factor**: Embedding generation compute time

### **TDD Implementation for Semantic Search**

#### **A. Embedding Cache Strategy Testing**
```python
# property-embedding-service/tests/test_embedding_cache.py
import pytest
from src.services.embedding_cache import EmbeddingCache
from src.models.embedding_model import EmbeddingModel

class TestEmbeddingCache:
    def test_cache_hit_performance(self):
        """Test that cached embeddings return in <10ms"""
        cache = EmbeddingCache()
        query = "modern apartment London"
        
        # First call - cache miss
        start_time = time.time()
        embedding1 = cache.get_or_generate(query)
        first_call_time = time.time() - start_time
        
        # Second call - cache hit
        start_time = time.time()
        embedding2 = cache.get_or_generate(query)
        cache_hit_time = time.time() - start_time
        
        assert cache_hit_time < 0.01  # Under 10ms
        assert np.array_equal(embedding1, embedding2)
        assert first_call_time > cache_hit_time * 10  # Significant improvement
    
    def test_semantic_similarity_grouping(self):
        """Test that similar queries use same cached embedding"""
        cache = EmbeddingCache()
        
        queries = [
            "2 bedroom flat London",
            "2-bed apartment in London", 
            "two bedroom flat London"
        ]
        
        embeddings = [cache.get_or_generate(q) for q in queries]
        
        # These should be grouped and use similar embeddings
        for i in range(len(embeddings)):
            for j in range(i+1, len(embeddings)):
                similarity = cosine_similarity([embeddings[i]], [embeddings[j]])[0][0]
                assert similarity > 0.9  # Very high similarity threshold
```

#### **B. Query Optimization Testing**
```python
# property-embedding-service/tests/test_query_optimization.py
class TestQueryOptimization:
    def test_query_preprocessing_accuracy(self):
        """Test that query preprocessing improves search accuracy"""
        raw_queries = [
            "I want a flat near good schools in Manchester under 300k",
            "Looking for 2bed house with garden, quiet area, budget £450000",
            "Modern apartment, walking distance to tube, London Zone 2"
        ]
        
        for query in raw_queries:
            processed = query_processor.preprocess(query)
            
            # Should extract key components
            assert len(processed.keywords) >= 3
            assert processed.location is not None
            if "£" in query or "k" in query:
                assert processed.price_range is not None
    
    def test_embedding_similarity_threshold(self):
        """Test optimal similarity threshold for search results"""
        test_cases = [
            {
                "query": "luxury penthouse",
                "expected_matches": ["luxury apartment", "high-end flat"],
                "expected_non_matches": ["studio flat", "shared house"]
            }
        ]
        
        for case in test_cases:
            query_embedding = embedding_model.encode(case["query"])
            
            for match in case["expected_matches"]:
                match_embedding = embedding_model.encode(match)
                similarity = cosine_similarity([query_embedding], [match_embedding])[0][0]
                assert similarity > 0.6  # Minimum threshold for relevance
                
            for non_match in case["expected_non_matches"]:
                non_match_embedding = embedding_model.encode(non_match)
                similarity = cosine_similarity([query_embedding], [non_match_embedding])[0][0]
                assert similarity < 0.4  # Should be clearly different
```

#### **C. Smart Caching Implementation**
```python
# property-embedding-service/src/services/embedding_cache.py
import hashlib
import numpy as np
from typing import Optional, Dict
import redis
import pickle

class EmbeddingCache:
    def __init__(self, redis_client: redis.Redis):
        self.redis = redis_client
        self.local_cache: Dict[str, np.ndarray] = {}
        self.cache_hits = 0
        self.cache_misses = 0
    
    def get_cache_key(self, query: str) -> str:
        """Generate consistent cache key for semantically similar queries"""
        # Normalize query for better cache hits
        normalized = query.lower().strip()
        # Remove common words that don't affect semantic meaning
        stop_words = {'the', 'a', 'an', 'in', 'on', 'at', 'to', 'for'}
        words = [w for w in normalized.split() if w not in stop_words]
        normalized = ' '.join(sorted(words))  # Sort for consistency
        
        return hashlib.md5(normalized.encode()).hexdigest()
    
    def get_or_generate(self, query: str) -> np.ndarray:
        cache_key = self.get_cache_key(query)
        
        # Try local cache first (fastest)
        if cache_key in self.local_cache:
            self.cache_hits += 1
            return self.local_cache[cache_key]
        
        # Try Redis cache
        cached_embedding = self.redis.get(f"embedding:{cache_key}")
        if cached_embedding:
            embedding = pickle.loads(cached_embedding)
            self.local_cache[cache_key] = embedding  # Store locally too
            self.cache_hits += 1
            return embedding
        
        # Generate new embedding
        embedding = self.embedding_model.encode(query)
        
        # Cache in both local and Redis
        self.local_cache[cache_key] = embedding
        self.redis.setex(f"embedding:{cache_key}", 3600, pickle.dumps(embedding))
        self.cache_misses += 1
        
        return embedding
```

---

## **💬 2. Chatbot Intelligence & Cost Optimization**

### **Smart Conversation Management**

#### **A. Context-Aware Response Testing**
```typescript
// property-search-api/tests/services/chatbot.test.ts
describe('Chatbot Intelligence', () => {
  describe('Property-Focused Conversations', () => {
    it('should maintain property search context', async () => {
      const conversation = new ChatbotConversation()
      
      // Initial property interest
      const response1 = await conversation.respond(
        "I'm looking for a 2-bedroom flat in London"
      )
      expect(response1.intent).toBe('property_search')
      expect(response1.extractedCriteria.bedrooms).toBe(2)
      expect(response1.extractedCriteria.location).toBe('London')
      
      // Follow-up question should maintain context
      const response2 = await conversation.respond(
        "What about the transport links?"
      )
      expect(response2.context.propertyType).toBe('flat')
      expect(response2.context.location).toBe('London')
      expect(response2.suggestedActions).toContain('show_transport_info')
    })
    
    it('should escalate complex queries efficiently', async () => {
      const conversation = new ChatbotConversation()
      
      const response = await conversation.respond(
        "I need help with mortgage applications and legal advice for buying"
      )
      
      expect(response.shouldEscalate).toBe(true)
      expect(response.escalationReason).toBe('requires_human_expertise')
      expect(response.suggestedActions).toContain('connect_to_agent')
    })
  })
  
  describe('Cost Optimization', () => {
    it('should use template responses for common queries', async () => {
      const commonQueries = [
        "What are your opening hours?",
        "How does the property search work?",
        "Do you charge fees?"
      ]
      
      for (const query of commonQueries) {
        const response = await chatbot.respond(query)
        expect(response.usedTemplate).toBe(true)
        expect(response.apiCost).toBe(0)  // No external API calls
      }
    })
  })
})
```

#### **B. Intelligent Response Routing**
```typescript
// property-search-api/src/services/chatbot/responseRouter.ts
export class ResponseRouter {
  private templateResponses: Map<string, ChatResponse>
  private contextAnalyzer: ContextAnalyzer
  private apiCallTracker: ApiCallTracker
  
  async route(message: string, context: ConversationContext): Promise<ChatResponse> {
    // Step 1: Check for template matches (zero cost)
    const templateMatch = this.findTemplateMatch(message)
    if (templateMatch && templateMatch.confidence > 0.8) {
      return this.enhanceTemplateResponse(templateMatch, context)
    }
    
    // Step 2: Property-specific intent detection (local processing)
    const propertyIntent = this.detectPropertyIntent(message)
    if (propertyIntent.confidence > 0.7) {
      return this.handlePropertyIntent(propertyIntent, context)
    }
    
    // Step 3: Only use external API for complex queries
    if (this.shouldUseExternalAPI(message, context)) {
      return this.callExternalAPI(message, context)
    }
    
    // Step 4: Fallback to guided response
    return this.createGuidedResponse(message, context)
  }
  
  private shouldUseExternalAPI(message: string, context: ConversationContext): boolean {
    // Use API only for:
    // - Complex property valuation questions
    // - Legal/financial advice (before escalation)
    // - Highly specific local area questions
    
    const apiTriggers = [
      'valuation', 'worth', 'market price',
      'legal', 'solicitor', 'conveyancing',
      'mortgage', 'lending', 'finance'
    ]
    
    const hasApiTrigger = apiTriggers.some(trigger => 
      message.toLowerCase().includes(trigger)
    )
    
    const recentApiCalls = this.apiCallTracker.getRecentCalls(context.sessionId)
    const withinBudget = recentApiCalls < 5  // Limit API calls per session
    
    return hasApiTrigger && withinBudget
  }
}
```

#### **C. Local Knowledge Base Testing**
```typescript
// property-search-api/tests/services/knowledgeBase.test.ts
describe('Local Knowledge Base', () => {
  it('should answer property FAQs without API calls', () => {
    const kb = new PropertyKnowledgeBase()
    
    const faqs = [
      "What documents do I need to rent?",
      "How long does the buying process take?",
      "What is stamp duty?",
      "Do I need a deposit to rent?"
    ]
    
    faqs.forEach(question => {
      const answer = kb.getAnswer(question)
      expect(answer).toBeDefined()
      expect(answer.confidence).toBeGreaterThan(0.8)
      expect(answer.source).toBe('local_knowledge')
    })
  })
})
```

---

## **📍 3. Local Places of Interest Optimization**

### **Smart POI Data Management**

#### **A. Efficient POI Data Testing**
```typescript
// property-search-api/tests/services/poiService.test.ts
describe('Places of Interest Service', () => {
  describe('Data Efficiency', () => {
    it('should cache POI data for 24 hours', async () => {
      const poiService = new POIService()
      const location = { lat: 51.5074, lng: -0.1278 } // London
      
      // First call - should fetch from API
      const start1 = Date.now()
      const pois1 = await poiService.getNearbyPOIs(location, 'schools')
      const time1 = Date.now() - start1
      
      // Second call - should use cache
      const start2 = Date.now()
      const pois2 = await poiService.getNearbyPOIs(location, 'schools')
      const time2 = Date.now() - start2
      
      expect(time2).toBeLessThan(time1 / 10)  // 10x faster from cache
      expect(pois1).toEqual(pois2)
    })
    
    it('should batch POI requests efficiently', async () => {
      const properties = generateTestProperties(5)  // 5 nearby properties
      
      const start = Date.now()
      const allPOIs = await poiService.batchGetPOIs(properties, ['schools', 'transport'])
      const duration = Date.now() - start
      
      // Should make only 1-2 API calls instead of 10 (5 properties × 2 categories)
      expect(mockApiService.callCount).toBeLessThanOrEqual(2)
      expect(allPOIs.length).toBe(10)  // All POI data returned
    })
  })
  
  describe('POI Relevance Scoring', () => {
    it('should score POIs by relevance to property type', () => {
      const familyHome = { type: 'house', bedrooms: 4 }
      const studio = { type: 'studio', bedrooms: 1 }
      
      const pois = [
        { type: 'primary_school', name: 'St Mary\'s Primary' },
        { type: 'nightclub', name: 'Club Metro' },
        { type: 'supermarket', name: 'Tesco' }
      ]
      
      const familyScores = poiService.scorePOIsForProperty(pois, familyHome)
      const studioScores = poiService.scorePOIsForProperty(pois, studio)
      
      // Family home should prioritize schools
      expect(familyScores[0].type).toBe('primary_school')
      
      // Studio should prioritize entertainment/convenience
      expect(studioScores[0].type).toBeOneOf(['nightclub', 'supermarket'])
    })
  })
})
```

#### **B. Smart POI Data Strategy**
```typescript
// property-search-api/src/services/poiService.ts
export class POIService {
  private cache: Map<string, CachedPOIData> = new Map()
  private batchRequestQueue: BatchRequest[] = []
  private batchTimer: NodeJS.Timeout | null = null
  
  async getNearbyPOIs(
    location: Location, 
    category: POICategory,
    radius: number = 1000
  ): Promise<POI[]> {
    const cacheKey = `${location.lat},${location.lng},${category},${radius}`
    
    // Check cache first
    const cached = this.cache.get(cacheKey)
    if (cached && !this.isCacheExpired(cached)) {
      return cached.data
    }
    
    // Add to batch queue for efficiency
    return this.addToBatchQueue(location, category, radius)
  }
  
  private addToBatchQueue(
    location: Location, 
    category: POICategory, 
    radius: number
  ): Promise<POI[]> {
    return new Promise((resolve) => {
      this.batchRequestQueue.push({ location, category, radius, resolve })
      
      // Process batch after short delay (allows grouping nearby requests)
      if (!this.batchTimer) {
        this.batchTimer = setTimeout(() => {
          this.processBatchRequests()
        }, 100)  // 100ms batching window
      }
    })
  }
  
  private async processBatchRequests(): Promise<void> {
    const requests = [...this.batchRequestQueue]
    this.batchRequestQueue = []
    this.batchTimer = null
    
    // Group requests by geographic proximity
    const requestGroups = this.groupRequestsByLocation(requests, 500) // 500m grouping
    
    for (const group of requestGroups) {
      const centerLocation = this.calculateCenter(group.map(r => r.location))
      const allCategories = [...new Set(group.map(r => r.category))]
      
      // Single API call for all categories at this location
      const poisByCategory = await this.externalAPI.getPOIsMultiCategory(
        centerLocation,
        allCategories,
        Math.max(...group.map(r => r.radius))
      )
      
      // Distribute results to all requesters
      group.forEach(request => {
        const relevantPOIs = this.filterPOIsForRequest(
          poisByCategory[request.category] || [],
          request
        )
        
        // Cache the result
        const cacheKey = `${request.location.lat},${request.location.lng},${request.category},${request.radius}`
        this.cache.set(cacheKey, {
          data: relevantPOIs,
          timestamp: Date.now(),
          ttl: 24 * 60 * 60 * 1000  // 24 hours
        })
        
        request.resolve(relevantPOIs)
      })
    }
  }
}
```

#### **C. POI Relevance Algorithm**
```typescript
// property-search-api/src/services/poiRelevanceScorer.ts
export class POIRelevanceScorer {
  private propertyTypeWeights = {
    'family_house': {
      'schools': 0.9,
      'parks': 0.8,
      'supermarkets': 0.7,
      'hospitals': 0.6,
      'nightlife': 0.1
    },
    'studio_apartment': {
      'transport': 0.9,
      'restaurants': 0.8,
      'nightlife': 0.7,
      'gyms': 0.6,
      'schools': 0.2
    },
    'luxury_apartment': {
      'fine_dining': 0.9,
      'cultural': 0.8,
      'premium_shopping': 0.7,
      'transport': 0.6,
      'schools': 0.4
    }
  }
  
  scorePOI(poi: POI, property: Property, distance: number): number {
    const propertyCategory = this.classifyProperty(property)
    const poiTypeWeight = this.propertyTypeWeights[propertyCategory]?.[poi.category] || 0.5
    
    // Distance penalty (closer is better)
    const distanceScore = Math.max(0, 1 - (distance / 1000))  // 1km max useful distance
    
    // Quality score from POI rating
    const qualityScore = (poi.rating || 3) / 5  // Normalize to 0-1
    
    // Popularity score from review count
    const popularityScore = Math.min(1, (poi.reviewCount || 0) / 100)  // Cap at 100 reviews
    
    return poiTypeWeight * 0.4 + 
           distanceScore * 0.3 + 
           qualityScore * 0.2 + 
           popularityScore * 0.1
  }
  
  private classifyProperty(property: Property): string {
    if (property.bedrooms >= 3) return 'family_house'
    if (property.bedrooms <= 1) return 'studio_apartment'
    if (property.price > 800000) return 'luxury_apartment'
    return 'standard_apartment'
  }
}
```

---

## **💰 Cost Optimization Summary**

### **API Call Reduction Strategies**

#### **Semantic Search Savings**
- **90% reduction** in embedding generation through smart caching
- **Query normalization** groups similar searches
- **Local model** eliminates external API dependency

#### **Chatbot Savings**
- **Template responses** for 70% of common queries
- **Local knowledge base** for property FAQs
- **API call limiting** per session (max 5 calls)
- **Intelligent escalation** to human agents when needed

#### **POI Data Savings**
- **24-hour caching** reduces repeated location lookups
- **Batch requests** group nearby queries (up to 80% reduction)
- **Relevance scoring** prioritizes valuable POI data
- **Geographic clustering** minimizes API boundary crossings

### **Expected Cost Reductions**
- **Embedding API calls**: 90% reduction
- **Chatbot API calls**: 70% reduction  
- **POI API calls**: 80% reduction
- **Overall API costs**: 75-85% reduction

### **Quality Improvements**
- **Faster response times** through caching
- **More relevant results** through context awareness
- **Better user experience** with instant common responses
- **Smarter POI recommendations** based on property type

This strategy maximizes your differentiators while keeping costs minimal through intelligent caching, batching, and local processing!