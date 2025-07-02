# TDD Implementation for Semantic Search & Chatbot Features

## 1. Semantic Search Engine with TDD

### A. Search Query Parser Tests

```typescript
// property-search-api/src/services/search/QueryParser.test.ts
import { QueryParser } from './QueryParser';
import { SearchIntent, PropertyFeatures } from '@/types/search';

describe('QueryParser', () => {
  let parser: QueryParser;

  beforeEach(() => {
    parser = new QueryParser();
  });

  describe('intent detection', () => {
    it('should detect purchase intent', () => {
      const queries = [
        'buy house in London',
        'looking to purchase apartment',
        'want to buy property',
        'house for sale'
      ];

      queries.forEach(query => {
        const result = parser.parse(query);
        expect(result.intent).toBe(SearchIntent.PURCHASE);
      });
    });

    it('should detect rental intent', () => {
      const queries = [
        'rent apartment in Manchester',
        'flat to let',
        'looking for rental property',
        'house for rent'
      ];

      queries.forEach(query => {
        const result = parser.parse(query);
        expect(result.intent).toBe(SearchIntent.RENT);
      });
    });

    it('should default to purchase when intent is unclear', () => {
      const result = parser.parse('nice house with garden');
      expect(result.intent).toBe(SearchIntent.PURCHASE);
    });
  });

  describe('location extraction', () => {
    it('should extract city names', () => {
      const testCases = [
        { query: 'house in London', expected: { city: 'London' } },
        { query: 'Manchester apartment', expected: { city: 'Manchester' } },
        { query: 'property near Birmingham', expected: { city: 'Birmingham' } },
      ];

      testCases.forEach(({ query, expected }) => {
        const result = parser.parse(query);
        expect(result.location).toMatchObject(expected);
      });
    });

    it('should extract postcodes', () => {
      const testCases = [
        { query: 'house in SW1A 1AA', expected: { postcode: 'SW1A 1AA' } },
        { query: 'flat near E14 5AB', expected: { postcode: 'E14 5AB' } },
        { query: 'property in NW3', expected: { postcode: 'NW3' } },
      ];

      testCases.forEach(({ query, expected }) => {
        const result = parser.parse(query);
        expect(result.location).toMatchObject(expected);
      });
    });

    it('should extract area descriptions', () => {
      const testCases = [
        { query: 'house near Victoria station', expected: { nearBy: ['Victoria station'] } },
        { query: 'flat close to Hyde Park', expected: { nearBy: ['Hyde Park'] } },
        { query: 'property near good schools', expected: { nearBy: ['schools'] } },
      ];

      testCases.forEach(({ query, expected }) => {
        const result = parser.parse(query);
        expect(result.location.nearBy).toEqual(expect.arrayContaining(expected.nearBy));
      });
    });
  });

  describe('property type detection', () => {
    it('should identify property types', () => {
      const testCases = [
        { query: 'modern apartment', expected: 'apartment' },
        { query: 'detached house', expected: 'house' },
        { query: 'studio flat', expected: 'studio' },
        { query: 'townhouse with garage', expected: 'townhouse' },
        { query: 'cozy cottage', expected: 'cottage' },
      ];

      testCases.forEach(({ query, expected }) => {
        const result = parser.parse(query);
        expect(result.propertyType).toBe(expected);
      });
    });
  });

  describe('feature extraction', () => {
    it('should extract property features', () => {
      const query = 'modern apartment with balcony, parking, and gym';
      const result = parser.parse(query);

      expect(result.features).toContain('balcony');
      expect(result.features).toContain('parking');
      expect(result.features).toContain('gym');
    });

    it('should extract room requirements', () => {
      const testCases = [
        { query: '3 bedroom house', expected: { bedrooms: 3 } },
        { query: 'two bed flat', expected: { bedrooms: 2 } },
        { query: 'single bedroom apartment', expected: { bedrooms: 1 } },
        { query: 'house with 2 bathrooms', expected: { bathrooms: 2 } },
      ];

      testCases.forEach(({ query, expected }) => {
        const result = parser.parse(query);
        expect(result.rooms).toMatchObject(expected);
      });
    });

    it('should identify lifestyle preferences', () => {
      const query = 'family home near good schools with garden safe for children';
      const result = parser.parse(query);

      expect(result.lifestyle).toContain('family-friendly');
      expect(result.features).toContain('garden');
      expect(result.location.nearBy).toContain('schools');
    });
  });

  describe('budget extraction', () => {
    it('should extract price ranges', () => {
      const testCases = [
        { 
          query: 'house under 500k', 
          expected: { maxPrice: 500000 } 
        },
        { 
          query: 'apartment between 300k and 400k', 
          expected: { minPrice: 300000, maxPrice: 400000 } 
        },
        { 
          query: 'property around £250,000', 
          expected: { minPrice: 225000, maxPrice: 275000 } // ±10%
        },
      ];

      testCases.forEach(({ query, expected }) => {
        const result = parser.parse(query);
        expect(result.budget).toMatchObject(expected);
      });
    });

    it('should handle rental prices', () => {
      const testCases = [
        { 
          query: 'rent flat under £2000 per month', 
          expected: { maxRent: 2000, rentPeriod: 'month' } 
        },
        { 
          query: 'apartment £500 per week', 
          expected: { minRent: 450, maxRent: 550, rentPeriod: 'week' } 
        },
      ];

      testCases.forEach(({ query, expected }) => {
        const result = parser.parse(query);
        expect(result.budget).toMatchObject(expected);
      });
    });
  });
});
```

### B. Semantic Search Service Implementation

```typescript
// property-search-api/src/services/search/SemanticSearchService.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { EmbeddingService } from '../embedding.service';
import { CacheService } from '../cache.service';
import { QueryParser } from './QueryParser';
import { SearchQuery, SearchResult, PropertyMatch } from '@/types/search';

@Injectable()
export class SemanticSearchService {
  constructor(
    private prisma: PrismaService,
    private embedding: EmbeddingService,
    private cache: CacheService,
    private queryParser: QueryParser
  ) {}

  async search(query: string, filters?: any): Promise<SearchResult> {
    // Check cache first
    const cacheKey = this.generateCacheKey(query, filters);
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    // Parse the natural language query
    const parsedQuery = this.queryParser.parse(query);
    
    // Generate embedding for semantic search
    const queryEmbedding = await this.embedding.generateEmbedding(query);
    
    // Build the search query
    const searchParams = this.buildSearchParams(parsedQuery, filters);
    
    // Execute semantic search
    const properties = await this.executeSemanticSearch(
      queryEmbedding,
      searchParams
    );

    // Re-rank results based on multiple factors
    const rankedResults = await this.reRankResults(
      properties,
      parsedQuery,
      queryEmbedding
    );

    // Cache the results
    const result: SearchResult = {
      properties: rankedResults,
      query: parsedQuery,
      totalCount: rankedResults.length,
      facets: await this.generateFacets(searchParams),
    };

    await this.cache.set(cacheKey, result, 300); // 5 minute cache
    
    return result;
  }

  private async executeSemanticSearch(
    embedding: number[],
    params: any
  ): Promise<PropertyMatch[]> {
    // Use pgvector for similarity search
    const query = `
      SELECT 
        p.*,
        p.embedding <=> $1::vector as distance,
        1 - (p.embedding <=> $1::vector) as similarity_score
      FROM properties p
      WHERE p.status = 'ACTIVE'
        ${params.city ? `AND p.city = $2` : ''}
        ${params.minPrice ? `AND p.price >= $3` : ''}
        ${params.maxPrice ? `AND p.price <= $4` : ''}
        ${params.propertyType ? `AND p.property_type = $5` : ''}
        ${params.bedrooms ? `AND p.bedrooms >= $6` : ''}
      ORDER BY distance
      LIMIT 50
    `;

    const results = await this.prisma.$queryRawUnsafe(
      query,
      embedding,
      params.city,
      params.minPrice,
      params.maxPrice,
      params.propertyType,
      params.bedrooms
    );

    return results.map(this.mapToPropertyMatch);
  }

  private async reRankResults(
    properties: PropertyMatch[],
    parsedQuery: any,
    queryEmbedding: number[]
  ): Promise<PropertyMatch[]> {
    // Multi-factor ranking
    return properties.map(property => {
      let score = property.similarity_score * 0.5; // Base semantic score

      // Location relevance
      if (parsedQuery.location) {
        if (property.city === parsedQuery.location.city) score += 0.1;
        if (property.postcode?.startsWith(parsedQuery.location.postcode?.substring(0, 3))) {
          score += 0.05;
        }
      }

      // Feature matching
      const matchedFeatures = parsedQuery.features.filter(
        feature => property.features.includes(feature)
      );
      score += matchedFeatures.length * 0.05;

      // Price relevance
      if (parsedQuery.budget) {
        const priceInRange = 
          property.price >= (parsedQuery.budget.minPrice || 0) &&
          property.price <= (parsedQuery.budget.maxPrice || Infinity);
        if (priceInRange) score += 0.1;
      }

      // Freshness boost
      const daysSinceListed = 
        (Date.now() - new Date(property.listedDate).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceListed < 7) score += 0.05;
      if (daysSinceListed < 1) score += 0.05;

      return {
        ...property,
        relevanceScore: Math.min(score, 1),
      };
    }).sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  private generateCacheKey(query: string, filters: any): string {
    return `search:${Buffer.from(JSON.stringify({ query, filters })).toString('base64')}`;
  }
}
```

### C. Semantic Search Tests

```typescript
// property-search-api/src/services/search/SemanticSearchService.test.ts
import { Test, TestingModule } from '@nestjs/testing';
import { SemanticSearchService } from './SemanticSearchService';
import { PrismaService } from '../prisma.service';
import { EmbeddingService } from '../embedding.service';
import { CacheService } from '../cache.service';

describe('SemanticSearchService', () => {
  let service: SemanticSearchService;
  let prisma: PrismaService;
  let embedding: EmbeddingService;
  let cache: CacheService;

  const mockProperties = [
    {
      id: '1',
      title: 'Modern apartment with balcony',
      price: 450000,
      city: 'London',
      features: ['balcony', 'parking'],
      embedding: [0.1, 0.2, 0.3],
      similarity_score: 0.95,
    },
    {
      id: '2',
      title: 'Spacious house with garden',
      price: 650000,
      city: 'London',
      features: ['garden', 'garage'],
      embedding: [0.2, 0.3, 0.4],
      similarity_score: 0.85,
    },
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SemanticSearchService,
        {
          provide: PrismaService,
          useValue: {
            $queryRawUnsafe: jest.fn(),
          },
        },
        {
          provide: EmbeddingService,
          useValue: {
            generateEmbedding: jest.fn(),
          },
        },
        {
          provide: CacheService,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<SemanticSearchService>(SemanticSearchService);
    prisma = module.get<PrismaService>(PrismaService);
    embedding = module.get<EmbeddingService>(EmbeddingService);
    cache = module.get<CacheService>(CacheService);
  });

  describe('search', () => {
    it('should return cached results when available', async () => {
      const cachedResult = { properties: mockProperties, totalCount: 2 };
      jest.spyOn(cache, 'get').mockResolvedValue(cachedResult);

      const result = await service.search('modern apartment');

      expect(result).toEqual(cachedResult);
      expect(embedding.generateEmbedding).not.toHaveBeenCalled();
      expect(prisma.$queryRawUnsafe).not.toHaveBeenCalled();
    });

    it('should perform semantic search when cache miss', async () => {
      jest.spyOn(cache, 'get').mockResolvedValue(null);
      jest.spyOn(embedding, 'generateEmbedding').mockResolvedValue([0.1, 0.2, 0.3]);
      jest.spyOn(prisma, '$queryRawUnsafe').mockResolvedValue(mockProperties);

      const result = await service.search('modern apartment with balcony');

      expect(embedding.generateEmbedding).toHaveBeenCalledWith('modern apartment with balcony');
      expect(prisma.$queryRawUnsafe).toHaveBeenCalled();
      expect(cache.set).toHaveBeenCalled();
      expect(result.properties).toHaveLength(2);
    });

    it('should apply filters correctly', async () => {
      jest.spyOn(cache, 'get').mockResolvedValue(null);
      jest.spyOn(embedding, 'generateEmbedding').mockResolvedValue([0.1, 0.2, 0.3]);
      jest.spyOn(prisma, '$queryRawUnsafe').mockResolvedValue([mockProperties[0]]);

      const filters = {
        minPrice: 400000,
        maxPrice: 500000,
        propertyType: 'apartment',
      };

      await service.search('apartment', filters);

      const queryCall = jest.spyOn(prisma, '$queryRawUnsafe').mock.calls[0];
      expect(queryCall[0]).toContain('p.price >= $3');
      expect(queryCall[0]).toContain('p.price <= $4');
      expect(queryCall[0]).toContain('p.property_type = $5');
    });

    it('should re-rank results based on multiple factors', async () => {
      const properties = [
        {
          ...mockProperties[0],
          listedDate: new Date(),
          similarity_score: 0.8,
        },
        {
          ...mockProperties[1],
          listedDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          similarity_score: 0.85,
        },
      ];

      jest.spyOn(cache, 'get').mockResolvedValue(null);
      jest.spyOn(embedding, 'generateEmbedding').mockResolvedValue([0.1, 0.2, 0.3]);
      jest.spyOn(prisma, '$queryRawUnsafe').mockResolvedValue(properties);

      const result = await service.search('modern apartment');

      // Property 1 should rank higher due to freshness despite lower similarity
      expect(result.properties[0].id).toBe('1');
      expect(result.properties[0].relevanceScore).toBeGreaterThan(0.8);
    });
  });
});
```

## 2. AI Chatbot with TDD

### A. Conversation Context Manager

```typescript
// property-search-api/src/services/chat/ConversationContext.test.ts
import { ConversationContext } from './ConversationContext';
import { ChatMessage, UserPreferences } from '@/types/chat';

describe('ConversationContext', () => {
  let context: ConversationContext;

  beforeEach(() => {
    context = new ConversationContext('session-123');
  });

  describe('message management', () => {
    it('should add messages to context', () => {
      const message: ChatMessage = {
        role: 'user',
        content: 'Looking for a house',
        timestamp: new Date(),
      };

      context.addMessage(message);
      
      expect(context.getMessages()).toHaveLength(1);
      expect(context.getMessages()[0]).toEqual(message);
    });

    it('should maintain message order', () => {
      const messages: ChatMessage[] = [
        { role: 'user', content: 'Hello', timestamp: new Date() },
        { role: 'assistant', content: 'Hi there!', timestamp: new Date() },
        { role: 'user', content: 'Show me houses', timestamp: new Date() },
      ];

      messages.forEach(msg => context.addMessage(msg));

      const retrieved = context.getMessages();
      expect(retrieved).toHaveLength(3);
      expect(retrieved[0].content).toBe('Hello');
      expect(retrieved[2].content).toBe('Show me houses');
    });

    it('should limit context window', () => {
      // Add 15 messages (default limit is 10)
      for (let i = 0; i < 15; i++) {
        context.addMessage({
          role: 'user',
          content: `Message ${i}`,
          timestamp: new Date(),
        });
      }

      expect(context.getMessages()).toHaveLength(10);
      expect(context.getMessages()[0].content).toBe('Message 5');
    });
  });

  describe('preference extraction', () => {
    it('should extract location preferences', () => {
      context.addMessage({
        role: 'user',
        content: 'I want to live in North London, preferably Hampstead',
        timestamp: new Date(),
      });

      const preferences = context.getPreferences();
      
      expect(preferences.locations).toContain('North London');
      expect(preferences.locations).toContain('Hampstead');
    });

    it('should extract budget preferences', () => {
      context.addMessage({
        role: 'user',
        content: 'My budget is around 500k',
        timestamp: new Date(),
      });

      const preferences = context.getPreferences();
      
      expect(preferences.budget.min).toBe(450000);
      expect(preferences.budget.max).toBe(550000);
    });

    it('should extract property type preferences', () => {
      const messages = [
        'I need a house, not an apartment',
        'Must have at least 3 bedrooms',
        'Garden is essential',
      ];

      messages.forEach(content => {
        context.addMessage({ role: 'user', content, timestamp: new Date() });
      });

      const preferences = context.getPreferences();
      
      expect(preferences.propertyTypes).toContain('house');
      expect(preferences.propertyTypes).not.toContain('apartment');
      expect(preferences.minBedrooms).toBe(3);
      expect(preferences.requiredFeatures).toContain('garden');
    });

    it('should update preferences over conversation', () => {
      context.addMessage({
        role: 'user',
        content: 'Looking for something under 400k',
        timestamp: new Date(),
      });

      let preferences = context.getPreferences();
      expect(preferences.budget.max).toBe(400000);

      context.addMessage({
        role: 'user',
        content: 'Actually, I can go up to 450k',
        timestamp: new Date(),
      });

      preferences = context.getPreferences();
      expect(preferences.budget.max).toBe(450000);
    });
  });

  describe('search history', () => {
    it('should track property views', () => {
      context.trackPropertyView('prop-123');
      context.trackPropertyView('prop-456');
      
      expect(context.getViewedProperties()).toEqual(['prop-123', 'prop-456']);
    });

    it('should track search queries', () => {
      context.trackSearchQuery('modern apartment', { city: 'London' });
      
      const history = context.getSearchHistory();
      expect(history).toHaveLength(1);
      expect(history[0].query).toBe('modern apartment');
      expect(history[0].filters.city).toBe('London');
    });

    it('should prevent duplicate property views', () => {
      context.trackPropertyView('prop-123');
      context.trackPropertyView('prop-123');
      
      expect(context.getViewedProperties()).toEqual(['prop-123']);
    });
  });
});
```

### B. Chat Response Generator

```typescript
// property-search-api/src/services/chat/ChatResponseGenerator.test.ts
import { ChatResponseGenerator } from './ChatResponseGenerator';
import { PropertyService } from '../PropertyService';
import { ConversationContext } from './ConversationContext';

describe('ChatResponseGenerator', () => {
  let generator: ChatResponseGenerator;
  let propertyService: PropertyService;
  let context: ConversationContext;

  beforeEach(() => {
    propertyService = {
      search: jest.fn(),
      getById: jest.fn(),
      getSimilar: jest.fn(),
    } as any;

    context = new ConversationContext('session-123');
    generator = new ChatResponseGenerator(propertyService);
  });

  describe('greeting responses', () => {
    it('should generate appropriate greeting', async () => {
      const response = await generator.generateResponse(
        'Hello',
        context
      );

      expect(response.message).toMatch(/Hello|Hi|Welcome/i);
      expect(response.suggestedActions).toContainEqual({
        text: 'Start property search',
        action: 'SEARCH',
      });
    });

    it('should personalize greeting for returning users', async () => {
      context.addMessage({
        role: 'user',
        content: 'Show me houses in London',
        timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000),
      });

      const response = await generator.generateResponse(
        'Hi again',
        context
      );

      expect(response.message).toMatch(/Welcome back/i);
      expect(response.message).toMatch(/London/i);
    });
  });

  describe('property search responses', () => {
    it('should trigger search for property queries', async () => {
      const mockProperties = [
        { id: '1', title: 'House 1', price: 500000 },
        { id: '2', title: 'House 2', price: 450000 },
      ];

      jest.spyOn(propertyService, 'search').mockResolvedValue({
        properties: mockProperties,
        totalCount: 2,
      });

      const response = await generator.generateResponse(
        'Show me houses under 600k',
        context
      );

      expect(propertyService.search).toHaveBeenCalled();
      expect(response.properties).toHaveLength(2);
      expect(response.message).toMatch(/found 2 properties/i);
    });

    it('should refine search based on context', async () => {
      // First search
      context.addMessage({
        role: 'user',
        content: 'Houses in London',
        timestamp: new Date(),
      });

      jest.spyOn(propertyService, 'search').mockResolvedValue({
        properties: [],
        totalCount: 0,
      });

      // Refinement
      await generator.generateResponse(
        'Only show me ones with gardens',
        context
      );

      const searchCall = (propertyService.search as jest.Mock).mock.calls[0];
      expect(searchCall[0]).toMatch(/garden/i);
      expect(searchCall[1]).toMatchObject({
        city: 'London',
        features: expect.arrayContaining(['garden']),
      });
    });
  });

  describe('property details responses', () => {
    it('should provide detailed information when asked', async () => {
      const mockProperty = {
        id: '1',
        title: 'Beautiful House',
        description: 'A lovely property',
        price: 500000,
        features: ['garden', 'parking'],
      };

      context.trackPropertyView('1');
      jest.spyOn(propertyService, 'getById').mockResolvedValue(mockProperty);

      const response = await generator.generateResponse(
        'Tell me more about this property',
        context
      );

      expect(response.message).toMatch(/Beautiful House/);
      expect(response.message).toMatch(/garden/);
      expect(response.message).toMatch(/parking/);
    });

    it('should suggest similar properties', async () => {
      const similarProperties = [
        { id: '2', title: 'Similar House 1' },
        { id: '3', title: 'Similar House 2' },
      ];

      context.trackPropertyView('1');
      jest.spyOn(propertyService, 'getSimilar').mockResolvedValue(similarProperties);

      const response = await generator.generateResponse(
        'Show me similar properties',
        context
      );

      expect(propertyService.getSimilar).toHaveBeenCalledWith('1');
      expect(response.properties).toHaveLength(2);
      expect(response.message).toMatch(/similar properties/i);
    });
  });

  describe('booking and contact responses', () => {
    it('should handle viewing requests', async () => {
      context.trackPropertyView('1');
      
      const response = await generator.generateResponse(
        'I would like to book a viewing',
        context
      );

      expect(response.actionRequired).toBe('BOOK_VIEWING');
      expect(response.propertyId).toBe('1');
      expect(response.suggestedActions).toContainEqual({
        text: 'Choose viewing time',
        action: 'SELECT_TIME',
      });
    });

    it('should collect contact information when needed', async () => {
      const response = await generator.generateResponse(
        'I want to speak to an agent',
        context
      );

      expect(response.actionRequired).toBe('COLLECT_CONTACT');
      expect(response.message).toMatch(/contact details/i);
      expect(response.formFields).toContain('name');
      expect(response.formFields).toContain('email');
      expect(response.formFields).toContain('phone');
    });
  });

  describe('error handling', () => {
    it('should handle ambiguous queries gracefully', async () => {
      const response = await generator.generateResponse(
        'house',
        context
      );

      expect(response.message).toMatch(/Could you be more specific/i);
      expect(response.suggestedActions).toContainEqual(
        expect.objectContaining({
          text: expect.stringMatching(/location/i),
        })
      );
    });

    it('should handle no results found', async () => {
      jest.spyOn(propertyService, 'search').mockResolvedValue({
        properties: [],
        totalCount: 0,
      });

      const response = await generator.generateResponse(
        'Mansion under 50k in central London',
        context
      );

      expect(response.message).toMatch(/couldn't find/i);
      expect(response.suggestedActions).toContainEqual(
        expect.objectContaining({
          text: expect.stringMatching(/adjust.*criteria/i),
        })
      );
    });
  });
});
```

### C. Chat Service Implementation

```typescript
// property-search-api/src/services/chat/ChatService.ts
import { Injectable } from '@nestjs/common';
import { ConversationContext } from './ConversationContext';
import { ChatResponseGenerator } from './ChatResponseGenerator';
import { PropertyService } from '../PropertyService';
import { AnalyticsService } from '../AnalyticsService';
import { ChatRequest, ChatResponse } from '@/types/chat';

@Injectable()
export class ChatService {
  private contexts: Map<string, ConversationContext> = new Map();

  constructor(
    private propertyService: PropertyService,
    private responseGenerator: ChatResponseGenerator,
    private analytics: AnalyticsService
  ) {}

  async processMessage(request: ChatRequest): Promise<ChatResponse> {
    // Get or create conversation context
    const context = this.getOrCreateContext(request.sessionId);
    
    // Add user message to context
    context.addMessage({
      role: 'user',
      content: request.message,
      timestamp: new Date(),
    });

    // Track analytics
    await this.analytics.trackChatMessage(request.sessionId, request.message);

    try {
      // Generate response
      const response = await this.responseGenerator.generateResponse(
        request.message,
        context
      );

      // Add assistant response to context
      context.addMessage({
        role: 'assistant',
        content: response.message,
        timestamp: new Date(),
      });

      // Handle any required actions
      if (response.actionRequired) {
        await this.handleAction(response.actionRequired, context, response);
      }

      return response;
    } catch (error) {
      console.error('Chat processing error:', error);
      return this.generateErrorResponse();
    }
  }

  private getOrCreateContext(sessionId: string): ConversationContext {
    if (!this.contexts.has(sessionId)) {
      this.contexts.set(sessionId, new ConversationContext(sessionId));
    }
    return this.contexts.get(sessionId)!;
  }

  private async handleAction(
    action: string,
    context: ConversationContext,
    response: ChatResponse
  ): Promise<void> {
    switch (action) {
      case 'BOOK_VIEWING':
        // Initialize viewing booking process
        response.additionalData = {
          availableSlots: await this.getAvailableViewingSlots(response.propertyId!),
        };
        break;
      
      case 'COLLECT_CONTACT':
        // Set up contact form
        response.formFields = ['name', 'email', 'phone', 'message'];
        break;
      
      case 'SAVE_SEARCH':
        // Save the current search criteria
        const preferences = context.getPreferences();
        await this.saveSearchAlert(context.sessionId, preferences);
        break;
    }
  }

  private generateErrorResponse(): ChatResponse {
    return {
      message: "I'm sorry, I encountered an error processing your request. Please try again.",
      suggestedActions: [
        { text: 'Start over', action: 'RESTART' },
        { text: 'Contact support', action: 'SUPPORT' },
      ],
    };
  }

  async getConversationSummary(sessionId: string): Promise<any> {
    const context = this.contexts.get(sessionId);
    if (!context) return null;

    return {
      preferences: context.getPreferences(),
      viewedProperties: context.getViewedProperties(),
      searchHistory: context.getSearchHistory(),
      messageCount: context.getMessages().length,
    };
  }
}
```

## 3. End-to-End Test Suite

```typescript
// e2e/tests/property-search-flow.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Property Search Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should perform semantic search and show results', async ({ page }) => {
    // Enter search query
    await page.fill('[data-testid="search-input"]', 'modern apartment with balcony near Victoria station');
    await page.click('[data-testid="search-button"]');

    // Wait for results
    await page.waitForSelector('[data-testid="property-card"]');

    // Verify results are displayed
    const propertyCards = await page.$$('[data-testid="property-card"]');
    expect(propertyCards.length).toBeGreaterThan(0);

    // Check semantic match indicators
    const matchScores = await page.$$('[data-testid="match-score"]');
    expect(matchScores.length).toBeGreaterThan(0);

    // Verify first result relevance
    const firstMatchScore = await page.textContent('[data-testid="match-score"]:first-child');
    expect(parseInt(firstMatchScore!.replace('%', ''))).toBeGreaterThan(70);
  });

  test('should interact with chatbot for property recommendations', async ({ page }) => {
    // Open chat
    await page.click('[data-testid="chat-button"]');
    await page.waitForSelector('[data-testid="chat-window"]');

    // Send message
    await page.fill('[data-testid="chat-input"]', 'I need a 2 bedroom flat under 400k');
    await page.keyboard.press('Enter');

    // Wait for response
    await page.waitForSelector('[data-testid="chat-message-assistant"]');

    // Verify properties are shown
    await page.waitForSelector('[data-testid="chat-property-suggestion"]');
    const suggestions = await page.$$('[data-testid="chat-property-suggestion"]');
    expect(suggestions.length).toBeGreaterThan(0);

    // Refine search
    await page.fill('[data-testid="chat-input"]', 'Only show ones with parking');
    await page.keyboard.press('Enter');

    // Wait for refined results
    await page.waitForTimeout(1000);
    
    // Verify all results have parking
    const propertyFeatures = await page.$$eval(
      '[data-testid="chat-property-suggestion"] [data-testid="property-features"]',
      elements => elements.map(el => el.textContent)
    );
    
    propertyFeatures.forEach(features => {
      expect(features).toContain('Parking');
    });
  });

  test('should save search and set up alerts', async ({ page }) => {
    // Perform search
    await page.fill('[data-testid="search-input"]', 'family house with garden in North London');
    await page.click('[data-testid="search-button"]');
    
    await page.waitForSelector('[data-testid="property-card"]');

    // Save search
    await page.click('[data-testid="save-search-button"]');
    
    // Fill alert preferences
    await page.fill('[data-testid="alert-name"]', 'Dream Home Search');
    await page.selectOption('[data-testid="alert-frequency"]', 'daily');
    await page.click('[data-testid="save-alert-button"]');

    // Verify confirmation
    await expect(page.locator('[data-testid="alert-confirmation"]')).toBeVisible();
    await expect(page.locator('[data-testid="alert-confirmation"]')).toContainText('Alert saved');
  });

  test('should handle property viewing booking', async ({ page }) => {
    // Search and select property
    await page.fill('[data-testid="search-input"]', 'apartment');
    await page.click('[data-testid="search-button"]');
    
    await page.waitForSelector('[data-testid="property-card"]');
    await page.click('[data-testid="property-card"]:first-child');

    // Wait for property details
    await page.waitForSelector('[data-testid="property-details"]');

    // Click book viewing
    await page.click('[data-testid="book-viewing-button"]');

    // Select time slot
    await page.waitForSelector('[data-testid="viewing-calendar"]');
    await page.click('[data-testid="time-slot"]:first-child');

    // Fill contact details
    await page.fill('[data-testid="viewing-name"]', 'John Doe');
    await page.fill('[data-testid="viewing-email"]', 'john@example.com');
    await page.fill('[data-testid="viewing-phone"]', '+44 20 1234 5678');

    // Submit booking
    await page.click('[data-testid="confirm-viewing-button"]');

    // Verify confirmation
    await expect(page.locator('[data-testid="viewing-confirmation"]')).toBeVisible();
  });
});
```

## 4. Performance Testing

```typescript
// property-search-api/src/tests/performance/search.perf.test.ts
import { performance } from 'perf_hooks';
import request from 'supertest';
import { app } from '../../app';

describe('Search Performance Tests', () => {
  const searches = [
    'modern apartment London',
    'house with garden Manchester',
    'studio flat near station Birmingham',
    'family home good schools Leeds',
    'luxury penthouse city center Liverpool',
  ];

  it('should handle concurrent searches efficiently', async () => {
    const concurrentRequests = 50;
    const startTime = performance.now();

    const promises = Array(concurrentRequests).fill(null).map((_, i) => 
      request(app)
        .get('/api/properties/search')
        .query({ q: searches[i % searches.length] })
    );

    const responses = await Promise.all(promises);
    const endTime = performance.now();

    // All requests should succeed
    responses.forEach(response => {
      expect(response.status).toBe(200);
    });

    // Total time should be reasonable (less than 5 seconds for 50 requests)
    const totalTime = endTime - startTime;
    expect(totalTime).toBeLessThan(5000);

    // Average response time should be under 500ms
    const avgTime = totalTime / concurrentRequests;
    expect(avgTime).toBeLessThan(500);
  });

  it('should utilize cache effectively', async () => {
    const query = 'apartment with balcony';
    
    // First request (cache miss)
    const start1 = performance.now();
    const response1 = await request(app)
      .get('/api/properties/search')
      .query({ q: query });
    const time1 = performance.now() - start1;

    // Second request (cache hit)
    const start2 = performance.now();
    const response2 = await request(app)
      .get('/api/properties/search')
      .query({ q: query });
    const time2 = performance.now() - start2;

    expect(response1.status).toBe(200);
    expect(response2.status).toBe(200);
    expect(response2.headers['x-cache-hit']).toBe('true');
    
    // Cached response should be at least 10x faster
    expect(time2).toBeLessThan(time1 / 10);
  });

  it('should handle large result sets efficiently', async () => {
    const startTime = performance.now();
    
    const response = await request(app)
      .get('/api/properties/search')
      .query({ 
        q: 'property',
        limit: 100 
      });

    const endTime = performance.now();

    expect(response.status).toBe(200);
    expect(response.body.data.length).toBeLessThanOrEqual(100);
    
    // Should complete within 2 seconds even for large results
    expect(endTime - startTime).toBeLessThan(2000);
  });
});
```

## Summary

This TDD implementation provides:

1. **Comprehensive Test Coverage** for semantic search and chatbot features
2. **Well-structured Services** with clear separation of concerns
3. **Performance Optimizations** including caching and efficient queries
4. **End-to-End Testing** covering real user workflows
5. **Robust Error Handling** throughout the application

The semantic search implementation uses:
- Natural language query parsing
- Vector similarity search with pgvector
- Multi-factor ranking algorithms
- Intelligent caching strategies

The chatbot implementation features:
- Contextual conversation management
- Preference learning and tracking
- Action-oriented responses
- Integration with property search

All components follow TDD principles with tests written first, ensuring high quality and maintainability.