import { ChatService } from './ChatService';
import { QueryParser } from '../search/QueryParser';

describe('ChatService TDD Implementation', () => {
  let chatService: ChatService;
  let mockPropertyService: any;
  let mockQueryParser: QueryParser;
  let mockSessionStore: any;

  beforeEach(() => {
    mockPropertyService = {
      searchBySemantic: jest.fn(),
      findById: jest.fn(),
    };

    mockQueryParser = new QueryParser();

    mockSessionStore = {
      get: jest.fn(),
      set: jest.fn(),
      delete: jest.fn(),
    };

    chatService = new ChatService(
      mockPropertyService,
      mockQueryParser,
      mockSessionStore
    );
  });

  describe('RED Phase: Initial failing tests', () => {
    it('should fail initially - chat processing not implemented', async () => {
      await expect(
        chatService.processMessage('Hello', 'session-1')
      ).rejects.toThrow('Chat processing not implemented');
    });

    it('should fail initially - intent recognition not working', async () => {
      await expect(
        chatService.recognizeIntent('Find me a house')
      ).rejects.toThrow('Intent recognition not implemented');
    });
  });

  describe('GREEN Phase: Basic implementation', () => {
    it('should process simple greeting messages', async () => {
      const result = await chatService.processMessage('Hello', 'session-1');

      expect(result).toEqual({
        response: expect.stringContaining('Hello'),
        sessionId: 'session-1',
        intent: 'greeting',
        suggestions: expect.arrayContaining([
          'Find properties',
          'Search by location',
          'Browse by price range',
        ]),
      });
    });

    it('should recognize property search intent', async () => {
      const intent = await chatService.recognizeIntent('Find me a 2 bedroom apartment in London');

      expect(intent).toEqual({
        type: 'property_search',
        confidence: expect.any(Number),
        extractedQuery: expect.objectContaining({
          bedrooms: 2,
          propertyType: 'apartment',
          location: expect.objectContaining({
            city: 'London',
          }),
        }),
      });
    });

    it('should handle property search requests', async () => {
      const mockProperties = [
        {
          id: '1',
          title: '2-Bed Apartment in London',
          price: 450000,
          location: { city: 'London', postcode: 'SW1A 1AA' },
          bedrooms: 2,
          bathrooms: 1,
        },
      ];

      mockPropertyService.searchBySemantic.mockResolvedValue(mockProperties);

      const result = await chatService.processMessage(
        'Find me a 2 bedroom apartment in London under £500k',
        'session-1'
      );

      expect(result).toEqual({
        response: expect.stringContaining('found'),
        sessionId: 'session-1',
        intent: 'property_search',
        propertyResults: mockProperties,
        suggestions: expect.arrayContaining([
          'View property details',
          'Search similar properties',
          'Refine search criteria',
        ]),
      });

      expect(mockPropertyService.searchBySemantic).toHaveBeenCalledWith(
        expect.any(Array), // embedding
        expect.objectContaining({
          bedrooms: 2,
          propertyType: 'apartment',
          maxPrice: 500000,
        })
      );
    });

    it('should maintain conversation context', async () => {
      const sessionContext = {
        lastQuery: 'apartment in London',
        preferences: { bedrooms: 2, location: 'London' },
        conversationHistory: [],
      };

      mockSessionStore.get.mockResolvedValue(sessionContext);

      const result = await chatService.processMessage(
        'Show me more like that',
        'session-1'
      );

      expect(result.response).toContain('based on your previous search');
      expect(mockSessionStore.set).toHaveBeenCalledWith(
        'session-1',
        expect.objectContaining({
          lastQuery: expect.any(String),
          conversationHistory: expect.arrayContaining([
            expect.objectContaining({
              message: 'Show me more like that',
              timestamp: expect.any(Date),
            }),
          ]),
        })
      );
    });
  });

  describe('REFACTOR Phase: Enhanced features', () => {
    it('should provide intelligent follow-up suggestions', async () => {
      const mockProperties = [
        {
          id: '1',
          title: 'Luxury Apartment',
          price: 800000,
          features: ['balcony', 'gym', 'concierge'],
        },
      ];

      mockPropertyService.searchBySemantic.mockResolvedValue(mockProperties);

      const result = await chatService.processMessage(
        'Find luxury apartments with amenities',
        'session-1'
      );

      expect(result.suggestions).toEqual(
        expect.arrayContaining([
          'Properties with similar amenities',
          'Luxury properties in other areas',
          'Properties with gym facilities',
          'Properties with concierge service',
        ])
      );
    });

    it('should handle complex multi-criteria searches', async () => {
      const result = await chatService.processMessage(
        'I need a family home with garden, near good schools, 3+ bedrooms, under £600k, in a safe neighborhood',
        'session-1'
      );

      expect(mockPropertyService.searchBySemantic).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({
          bedrooms: 3,
          maxPrice: 600000,
          features: expect.arrayContaining(['garden']),
          lifestyle: expect.arrayContaining(['family-friendly']),
          location: expect.objectContaining({
            nearBy: expect.arrayContaining(['schools']),
          }),
        })
      );

      expect(result.response).toContain('family-friendly properties');
    });

    it('should provide market insights and advice', async () => {
      const result = await chatService.processMessage(
        'What\'s the average price for 2 bedroom apartments in London?',
        'session-1'
      );

      expect(result).toEqual({
        response: expect.stringContaining('average price'),
        sessionId: 'session-1',
        intent: 'market_inquiry',
        marketData: expect.objectContaining({
          averagePrice: expect.any(Number),
          priceRange: expect.objectContaining({
            min: expect.any(Number),
            max: expect.any(Number),
          }),
          trends: expect.any(String),
        }),
        suggestions: expect.arrayContaining([
          'View properties in this price range',
          'Compare with other areas',
          'Set up price alerts',
        ]),
      });
    });

    it('should handle property comparison requests', async () => {
      const sessionContext = {
        viewedProperties: ['prop-1', 'prop-2'],
        conversationHistory: [],
      };

      mockSessionStore.get.mockResolvedValue(sessionContext);

      const mockProperty1 = {
        id: 'prop-1',
        title: 'Property A',
        price: 400000,
        bedrooms: 2,
      };

      const mockProperty2 = {
        id: 'prop-2',
        title: 'Property B',
        price: 450000,
        bedrooms: 2,
      };

      mockPropertyService.findById
        .mockResolvedValueOnce(mockProperty1)
        .mockResolvedValueOnce(mockProperty2);

      const result = await chatService.processMessage(
        'Compare the properties I viewed',
        'session-1'
      );

      expect(result).toEqual({
        response: expect.stringContaining('comparison'),
        sessionId: 'session-1',
        intent: 'property_comparison',
        comparison: expect.objectContaining({
          properties: [mockProperty1, mockProperty2],
          differences: expect.any(Array),
          recommendations: expect.any(String),
        }),
        suggestions: expect.arrayContaining([
          'Schedule viewings',
          'Get mortgage advice',
          'View similar properties',
        ]),
      });
    });

    it('should provide personalized recommendations', async () => {
      const sessionContext = {
        preferences: {
          budget: { max: 500000 },
          location: 'London',
          propertyType: 'apartment',
          features: ['balcony', 'parking'],
        },
        searchHistory: [
          { query: 'modern apartment', timestamp: new Date() },
          { query: 'properties with balcony', timestamp: new Date() },
        ],
      };

      mockSessionStore.get.mockResolvedValue(sessionContext);

      const result = await chatService.processMessage(
        'What would you recommend for me?',
        'session-1'
      );

      expect(result).toEqual({
        response: expect.stringContaining('based on your preferences'),
        sessionId: 'session-1',
        intent: 'recommendation_request',
        recommendations: expect.arrayContaining([
          expect.objectContaining({
            reason: expect.any(String),
            properties: expect.any(Array),
          }),
        ]),
        suggestions: expect.arrayContaining([
          'Refine preferences',
          'Set up alerts',
          'Schedule viewings',
        ]),
      });
    });

    it('should handle error scenarios gracefully', async () => {
      mockPropertyService.searchBySemantic.mockRejectedValue(
        new Error('Database connection failed')
      );

      const result = await chatService.processMessage(
        'Find me properties',
        'session-1'
      );

      expect(result).toEqual({
        response: expect.stringContaining('temporarily unable'),
        sessionId: 'session-1',
        intent: 'error',
        error: 'service_unavailable',
        suggestions: expect.arrayContaining([
          'Try again in a moment',
          'Contact support',
          'Browse featured properties',
        ]),
      });
    });

    it('should support natural language refinement', async () => {
      const sessionContext = {
        lastSearchResults: [
          { id: '1', price: 600000, bedrooms: 2 },
          { id: '2', price: 700000, bedrooms: 3 },
        ],
        lastQuery: 'apartments in London',
      };

      mockSessionStore.get.mockResolvedValue(sessionContext);

      const result = await chatService.processMessage(
        'Show me cheaper options',
        'session-1'
      );

      expect(mockPropertyService.searchBySemantic).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({
          maxPrice: 600000, // Should be lower than previous results
        })
      );

      expect(result.response).toContain('more affordable options');
    });
  });

  describe('Performance and Scalability', () => {
    it('should process messages within acceptable time', async () => {
      const startTime = Date.now();
      
      await chatService.processMessage('Find me a house', 'session-1');
      
      const endTime = Date.now();
      const processingTime = endTime - startTime;
      
      expect(processingTime).toBeLessThan(2000); // Should complete within 2 seconds
    });

    it('should handle concurrent sessions', async () => {
      const sessions = ['session-1', 'session-2', 'session-3'];
      
      const promises = sessions.map(sessionId =>
        chatService.processMessage('Find properties', sessionId)
      );
      
      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(3);
      results.forEach((result, index) => {
        expect(result.sessionId).toBe(sessions[index]);
      });
    });

    it('should limit session memory usage', async () => {
      const sessionId = 'session-1';
      
      // Send many messages to test memory limits
      for (let i = 0; i < 100; i++) {
        await chatService.processMessage(`Message ${i}`, sessionId);
      }
      
      const sessionData = await mockSessionStore.get(sessionId);
      
      // Should limit conversation history
      expect(sessionData.conversationHistory.length).toBeLessThanOrEqual(50);
    });
  });

  describe('Security and Privacy', () => {
    it('should sanitize user input', async () => {
      const maliciousInput = '<script>alert("xss")</script>Find properties';
      
      const result = await chatService.processMessage(maliciousInput, 'session-1');
      
      expect(result.response).not.toContain('<script>');
      expect(result.response).not.toContain('alert');
    });

    it('should not expose sensitive information', async () => {
      const result = await chatService.processMessage(
        'Show me all user data',
        'session-1'
      );
      
      expect(result.response).not.toContain('password');
      expect(result.response).not.toContain('email');
      expect(result.response).not.toContain('phone');
    });

    it('should validate session integrity', async () => {
      const invalidSessionId = 'invalid-session-<script>';
      
      const result = await chatService.processMessage(
        'Find properties',
        invalidSessionId
      );
      
      expect(result.sessionId).toMatch(/^[a-zA-Z0-9-]+$/);
      expect(result.sessionId).not.toContain('<script>');
    });
  });
});