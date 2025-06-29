# 🚀 Production Integration Guide

## Phase 2: Service Integration & API Connections

### 2.1 Property Search API Integration

#### Update Property Search Service
Create/update your property search service to use the enhanced embedding cache:

```typescript
// property-search-api/src/services/propertySearchService.ts
import axios from 'axios';

interface EmbeddingResponse {
  embeddings: number[][];
  model_used: string;
}

interface CacheStats {
  hit_rate_percent: number;
  cost_saved_dollars: number;
  time_saved_seconds: number;
}

export class EnhancedPropertySearchService {
  private embeddingServiceUrl: string;

  constructor() {
    this.embeddingServiceUrl = process.env.EMBEDDING_SERVICE_URL || 'http://localhost:8001';
  }

  async searchProperties(query: string, properties: Property[]): Promise<SearchResult[]> {
    try {
      // Get query embedding using enhanced cache
      const embeddingResponse = await axios.post<EmbeddingResponse>(
        `${this.embeddingServiceUrl}/embed`,
        { texts: [query] }
      );

      const queryEmbedding = embeddingResponse.data.embeddings[0];

      // Calculate similarities with property embeddings
      const results = properties.map(property => ({
        property,
        similarity: this.calculateSimilarity(queryEmbedding, property.embedding)
      }));

      // Sort by similarity and return top results
      return results
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, 20)
        .map(result => ({
          property: result.property,
          similarity: result.similarity,
          relevanceScore: this.calculateRelevanceScore(result.property, query)
        }));

    } catch (error) {
      console.error('Error in property search:', error);
      throw new Error('Property search failed');
    }
  }

  async getCacheStats(): Promise<CacheStats> {
    try {
      const response = await axios.get(`${this.embeddingServiceUrl}/cache/stats`);
      return response.data;
    } catch (error) {
      console.error('Error getting cache stats:', error);
      return { hit_rate_percent: 0, cost_saved_dollars: 0, time_saved_seconds: 0 };
    }
  }

  private calculateSimilarity(embedding1: number[], embedding2: number[]): number {
    // Cosine similarity calculation
    const dotProduct = embedding1.reduce((sum, a, i) => sum + a * embedding2[i], 0);
    const magnitude1 = Math.sqrt(embedding1.reduce((sum, a) => sum + a * a, 0));
    const magnitude2 = Math.sqrt(embedding2.reduce((sum, a) => sum + a * a, 0));
    return dotProduct / (magnitude1 * magnitude2);
  }

  private calculateRelevanceScore(property: Property, query: string): number {
    // Enhanced relevance scoring based on query intent
    let score = 0;
    const queryLower = query.toLowerCase();

    // Property type matching
    if (queryLower.includes(property.propertyType.toLowerCase())) score += 0.3;

    // Location matching
    if (queryLower.includes(property.location.city.toLowerCase())) score += 0.2;
    if (queryLower.includes(property.location.area.toLowerCase())) score += 0.2;

    // Feature matching
    property.features.forEach(feature => {
      if (queryLower.includes(feature.toLowerCase())) score += 0.1;
    });

    return Math.min(score, 1.0);
  }
}
```

#### Update Property Controller
```typescript
// property-search-api/src/controllers/propertyController.ts
import { Request, Response } from 'express';
import { EnhancedPropertySearchService } from '../services/propertySearchService';
import { POIService } from '../services/poiService';
import { ChatbotService } from '../services/chatbot/responseRouter';

export class PropertyController {
  private searchService: EnhancedPropertySearchService;
  private poiService: POIService;
  private chatbotService: ChatbotService;

  constructor() {
    this.searchService = new EnhancedPropertySearchService();
    this.poiService = new POIService();
    this.chatbotService = new ChatbotService();
  }

  async searchProperties(req: Request, res: Response) {
    try {
      const { query, filters } = req.body;
      
      // Enhanced semantic search with caching
      const searchResults = await this.searchService.searchProperties(query, filters);
      
      // Get cache performance stats
      const cacheStats = await this.searchService.getCacheStats();
      
      res.json({
        results: searchResults,
        performance: {
          cache_hit_rate: cacheStats.hit_rate_percent,
          cost_saved: cacheStats.cost_saved_dollars,
          time_saved: cacheStats.time_saved_seconds
        }
      });
      
    } catch (error) {
      console.error('Search error:', error);
      res.status(500).json({ error: 'Search failed' });
    }
  }

  async getPropertyDetails(req: Request, res: Response) {
    try {
      const { propertyId } = req.params;
      const property = await this.getPropertyById(propertyId);
      
      if (!property) {
        return res.status(404).json({ error: 'Property not found' });
      }

      // Get enhanced POI recommendations
      const poisByCategory = await this.poiService.getPOIsForProperty(property);
      
      res.json({
        property,
        nearbyPOIs: poisByCategory,
        poiStats: this.poiService.getCacheStats()
      });
      
    } catch (error) {
      console.error('Property details error:', error);
      res.status(500).json({ error: 'Failed to get property details' });
    }
  }

  async chatWithBot(req: Request, res: Response) {
    try {
      const { message, sessionId, context } = req.body;
      
      // Enhanced chatbot with cost optimization
      const response = await this.chatbotService.processMessage(message, sessionId, context);
      
      res.json(response);
      
    } catch (error) {
      console.error('Chatbot error:', error);
      res.status(500).json({ error: 'Chatbot service unavailable' });
    }
  }

  private async getPropertyById(id: string): Promise<Property | null> {
    // Your existing property retrieval logic
    return null; // Placeholder
  }
}
```

### 2.2 Frontend Integration

#### React Component for Search with Cache Stats
```tsx
// frontend/src/components/EnhancedPropertySearch.tsx
import React, { useState, useEffect } from 'react';
import { searchProperties, getCacheStats } from '../services/api';

interface CacheStats {
  hit_rate_percent: number;
  cost_saved_dollars: number;
  time_saved_seconds: number;
  estimated_monthly_savings: number;
}

export const EnhancedPropertySearch: React.FC = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [cacheStats, setCacheStats] = useState<CacheStats | null>(null);

  useEffect(() => {
    // Load cache stats on component mount
    loadCacheStats();
  }, []);

  const loadCacheStats = async () => {
    try {
      const stats = await getCacheStats();
      setCacheStats(stats);
    } catch (error) {
      console.error('Failed to load cache stats:', error);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    try {
      const searchResults = await searchProperties(query);
      setResults(searchResults.results);
      
      // Update cache stats after search
      setCacheStats(searchResults.performance);
      
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="enhanced-property-search">
      <form onSubmit={handleSearch} className="search-form">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search properties... (e.g., 'luxury apartment London')"
          className="search-input"
        />
        <button type="submit" disabled={loading} className="search-button">
          {loading ? 'Searching...' : 'Search'}
        </button>
      </form>

      {/* Cache Performance Stats */}
      {cacheStats && (
        <div className="cache-stats">
          <h4>🚀 Performance Stats</h4>
          <div className="stats-grid">
            <div className="stat">
              <span className="stat-label">Cache Hit Rate:</span>
              <span className="stat-value">{cacheStats.hit_rate_percent.toFixed(1)}%</span>
            </div>
            <div className="stat">
              <span className="stat-label">Cost Saved:</span>
              <span className="stat-value">${cacheStats.cost_saved_dollars.toFixed(4)}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Time Saved:</span>
              <span className="stat-value">{cacheStats.time_saved_seconds.toFixed(2)}s</span>
            </div>
            <div className="stat">
              <span className="stat-label">Monthly Savings:</span>
              <span className="stat-value">${cacheStats.estimated_monthly_savings.toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Search Results */}
      <div className="search-results">
        {results.map((result: any) => (
          <PropertyCard key={result.property.id} property={result.property} />
        ))}
      </div>
    </div>
  );
};
```

### 2.3 Environment Configuration

#### Production Environment Variables
```bash
# property-embedding-service/.env.production
REDIS_URL=redis://your-redis-cluster:6379
EMBEDDING_MODEL=all-MiniLM-L6-v2
CACHE_TTL=604800  # 7 days
MAX_LOCAL_CACHE_SIZE=2000  # Increased for production
EMBEDDING_COST_PER_REQUEST=0.001
LOG_LEVEL=INFO
ENVIRONMENT=production

# property-search-api/.env.production
REDIS_URL=redis://your-redis-cluster:6379
EMBEDDING_SERVICE_URL=http://embedding-service:8001
POI_SERVICE_API_KEY=your-poi-api-key
CHATBOT_API_LIMIT=5
POI_CACHE_TTL=86400
TEMPLATE_CONFIDENCE_THRESHOLD=0.8
```

### 2.4 Docker Compose for Production

```yaml
# docker-compose.production.yml
version: '3.8'

services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes --maxmemory 2gb --maxmemory-policy allkeys-lru
    restart: unless-stopped

  embedding-service:
    build: ./property-embedding-service
    ports:
      - "8001:8001"
    environment:
      - REDIS_URL=redis://redis:6379
      - EMBEDDING_MODEL=all-MiniLM-L6-v2
      - CACHE_TTL=604800
      - MAX_LOCAL_CACHE_SIZE=2000
      - LOG_LEVEL=INFO
    depends_on:
      - redis
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8001/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  property-search-api:
    build: ./property-search-api
    ports:
      - "3000:3000"
    environment:
      - REDIS_URL=redis://redis:6379
      - EMBEDDING_SERVICE_URL=http://embedding-service:8001
      - NODE_ENV=production
    depends_on:
      - redis
      - embedding-service
    restart: unless-stopped

volumes:
  redis_data:
```

### 2.5 Monitoring & Analytics Setup

#### Prometheus Metrics Collection
```yaml
# monitoring/prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'embedding-service'
    static_configs:
      - targets: ['embedding-service:8001']
    metrics_path: '/metrics'
    scrape_interval: 30s

  - job_name: 'property-search-api'
    static_configs:
      - targets: ['property-search-api:3000']
    metrics_path: '/metrics'
    scrape_interval: 30s
```

#### Grafana Dashboard Configuration
```json
{
  "dashboard": {
    "title": "Property Search Performance",
    "panels": [
      {
        "title": "Cache Hit Rate",
        "type": "stat",
        "targets": [
          {
            "expr": "embedding_cache_hit_rate",
            "legendFormat": "Hit Rate %"
          }
        ]
      },
      {
        "title": "Cost Savings",
        "type": "stat",
        "targets": [
          {
            "expr": "embedding_cost_saved_dollars",
            "legendFormat": "$ Saved"
          }
        ]
      },
      {
        "title": "Response Times",
        "type": "graph",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, embedding_response_time_seconds)",
            "legendFormat": "95th percentile"
          }
        ]
      }
    ]
  }
}
```

## Next Steps: Phase 3 - Performance Monitoring

1. **Deploy monitoring stack** (Prometheus + Grafana)
2. **Set up alerting rules** for performance degradation
3. **Create performance dashboards** for business metrics
4. **Implement A/B testing** for optimization validation
5. **Set up automated scaling** based on cache performance

Would you like me to continue with Phase 3 (Performance Monitoring) or help you implement any specific part of Phase 2?