import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { SemanticSearchService } from './SemanticSearchService';
import { QueryParser } from './QueryParser';
import { SearchIntent } from '@/types/search';
import { Logger } from '@/types/logger';
import * as config from '@/config';

// Mock logger for testing
const mockLogger: Logger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

describe('SemanticSearchService', () => {
  let service: SemanticSearchService;
  let mockDb: any;
  let mockEmbedding: any;
  let mockCache: any;
  let queryParser: QueryParser;

  const mockProperties = [
    {
      id: '1',
      title: 'Modern apartment with balcony',
      price: 450000,
      city: 'London',
      postcode: 'SW1A 1AA',
      bedrooms: 2,
      bathrooms: 1,
      property_type: 'apartment',
      features: ['balcony', 'parking'],
      listed_date: new Date('2024-01-01'),
      distance: 0.05,
      similarity_score: 0.95,
    },
    {
      id: '2',
      title: 'Spacious house with garden',
      price: 650000,
      city: 'London',
      postcode: 'SW2B 2BB',
      bedrooms: 3,
      bathrooms: 2,
      property_type: 'house',
      features: ['garden', 'garage'],
      listed_date: new Date('2024-01-15'),
      distance: 0.15,
      similarity_score: 0.85,
    },
  ];

  beforeEach(() => {
    mockDb = {
      query: vi.fn(),
    };

    mockEmbedding = {
      generateEmbedding: vi.fn(),
    };

    mockCache = {
      get: vi.fn(),
      set: vi.fn(),
    };

    queryParser = new QueryParser();

    service = new SemanticSearchService(
      mockDb,
      mockEmbedding,
      mockCache,
      queryParser,
      mockLogger
    );

    // Clear mock calls before each test
    mockLogger.debug.mockClear();
    mockLogger.info.mockClear();
    mockLogger.warn.mockClear();
    mockLogger.error.mockClear();
  });

  describe('search', () => {
    it('should return cached results when available', async () => {
      const cachedResult = {
        properties: mockProperties,
        totalCount: 2,
        query: queryParser.parse('modern apartment'),
        facets: {
          priceRanges: [],
          propertyTypes: [],
          locations: [],
          features: [],
        },
      };
      mockCache.get.mockResolvedValue(cachedResult);

      const result = await service.search('modern apartment');

      expect(result).toEqual(cachedResult);
      expect(mockEmbedding.generateEmbedding).not.toHaveBeenCalled();
      expect(mockDb.query).not.toHaveBeenCalled();
    });

    it('should perform semantic search when cache miss', async () => {
      mockCache.get.mockResolvedValue(null);
      mockEmbedding.generateEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);
      mockDb.query
        .mockResolvedValueOnce(mockProperties) // Main search
        .mockResolvedValueOnce([{ range: '£400k - £600k', count: '5' }]) // Price ranges
        .mockResolvedValueOnce([{ type: 'apartment', count: '10' }]) // Property types
        .mockResolvedValueOnce([{ city: 'London', count: '15' }]) // Locations
        .mockResolvedValueOnce([{ feature: 'balcony', count: '8' }]); // Features

      const result = await service.search('modern apartment with balcony');

      expect(mockEmbedding.generateEmbedding).toHaveBeenCalledWith('modern apartment with balcony');
      expect(mockDb.query).toHaveBeenCalled();
      expect(result.properties).toHaveLength(2);
      expect(result.query.originalQuery).toBe('modern apartment with balcony');
    });

    it('should apply filters correctly', async () => {
      mockCache.get.mockResolvedValue(null);
      mockEmbedding.generateEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);
      mockDb.query
        .mockResolvedValueOnce(mockProperties) // Main search
        .mockResolvedValueOnce([{ range: '£400k - £600k', count: '5' }]) // Price ranges
        .mockResolvedValueOnce([{ type: 'apartment', count: '10' }]) // Property types
        .mockResolvedValueOnce([{ city: 'London', count: '15' }]) // Locations
        .mockResolvedValueOnce([{ feature: 'balcony', count: '8' }]); // Features

      const filters = {
        minPrice: 300000,
        maxPrice: 500000,
        bedrooms: 2,
        propertyType: 'apartment',
      };

      await service.search('modern apartment', filters);

      const sqlCall = mockDb.query.mock.calls[0];
      const sql = sqlCall[0];
      const params = sqlCall[1];

      expect(sql).toContain('p.price >= $');
      expect(sql).toContain('p.price <= $');
      expect(sql).toContain('p.bedrooms >= $');
      expect(sql).toContain('p.property_type = $');

      expect(params).toContain(300000);
      expect(params).toContain(500000);
      expect(params).toContain(2);
      expect(params).toContain('apartment');
    });

    it('should re-rank results based on multiple factors', async () => {
      mockCache.get.mockResolvedValue(null);
      mockEmbedding.generateEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);
      mockDb.query
        .mockResolvedValueOnce(mockProperties) // Main search
        .mockResolvedValueOnce([{ range: '£400k - £600k', count: '5' }]) // Price ranges
        .mockResolvedValueOnce([{ type: 'apartment', count: '10' }]) // Property types
        .mockResolvedValueOnce([{ city: 'London', count: '15' }]) // Locations
        .mockResolvedValueOnce([{ feature: 'balcony', count: '8' }]); // Features

      const result = await service.search('2 bedroom apartment with balcony in London under 500k');

      expect(result.properties[0].relevanceScore).toBeGreaterThan(0);
      expect(result.properties[0].relevanceScore).toBeLessThanOrEqual(1);

      // First property should have higher relevance due to matching criteria
      expect(result.properties[0].id).toBe('1'); // apartment with balcony
    });

    it('should cache search results', async () => {
      mockCache.get.mockResolvedValue(null);
      mockEmbedding.generateEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);
      mockDb.query
        .mockResolvedValueOnce(mockProperties) // Main search
        .mockResolvedValueOnce([{ range: '£400k - £600k', count: '5' }]) // Price ranges
        .mockResolvedValueOnce([{ type: 'apartment', count: '10' }]) // Property types
        .mockResolvedValueOnce([{ city: 'London', count: '15' }]) // Locations
        .mockResolvedValueOnce([{ feature: 'balcony', count: '8' }]); // Features

      await service.search('modern apartment');

      expect(mockCache.set).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          properties: expect.any(Array),
          totalCount: expect.any(Number),
        }),
        expect.any(Number) // TTL from config
      );
    });

    it('should handle empty results gracefully', async () => {
      mockCache.get.mockResolvedValue(null);
      mockEmbedding.generateEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);
      mockDb.query.mockResolvedValue([]);

      const result = await service.search('nonexistent property type');

      expect(result.properties).toHaveLength(0);
      expect(result.totalCount).toBe(0);
    });

    it('should generate facets for filtering', async () => {
      mockCache.get.mockResolvedValue(null);
      mockEmbedding.generateEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);
      mockDb.query
        .mockResolvedValueOnce(mockProperties) // Main search
        .mockResolvedValueOnce([{ range: '£400k - £600k', count: '5' }]) // Price ranges
        .mockResolvedValueOnce([{ type: 'apartment', count: '10' }]) // Property types
        .mockResolvedValueOnce([{ city: 'London', count: '15' }]) // Locations
        .mockResolvedValueOnce([{ feature: 'balcony', count: '8' }]); // Features

      const result = await service.search('apartment in London');

      expect(result.facets).toBeDefined();
      expect(result.facets.priceRanges).toHaveLength(1);
      expect(result.facets.propertyTypes).toHaveLength(1);
      expect(result.facets.locations).toHaveLength(1);
      expect(result.facets.features).toHaveLength(1);
    });
  });

  describe('error handling', () => {
    it('should handle database errors gracefully', async () => {
      mockCache.get.mockResolvedValue(null);
      mockEmbedding.generateEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);
      mockDb.query.mockRejectedValue(new Error('Database connection failed'));

      await expect(service.search('apartment')).rejects.toThrow('Database connection failed');
    });

    it('should handle embedding service errors', async () => {
      mockCache.get.mockResolvedValue(null);
      mockEmbedding.generateEmbedding.mockRejectedValue(new Error('Embedding service unavailable'));

      await expect(service.search('apartment')).rejects.toThrow('Embedding service unavailable');
    });

    it('should handle cache errors gracefully', async () => {
      mockCache.get.mockRejectedValue(new Error('Cache unavailable'));
      mockEmbedding.generateEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);
      mockDb.query
        .mockResolvedValueOnce(mockProperties) // Main search
        .mockResolvedValueOnce([{ range: '£400k - £600k', count: '5' }]) // Price ranges
        .mockResolvedValueOnce([{ type: 'apartment', count: '10' }]) // Property types
        .mockResolvedValueOnce([{ city: 'London', count: '15' }]) // Locations
        .mockResolvedValueOnce([{ feature: 'balcony', count: '8' }]); // Features

      // Should still work even if cache fails
      const result = await service.search('apartment');
      expect(result.properties).toHaveLength(2);
    });
  });

  describe('performance', () => {
    it('should complete search within reasonable time', async () => {
      mockCache.get.mockResolvedValue(null);
      mockEmbedding.generateEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);
      mockDb.query
        .mockResolvedValueOnce(mockProperties) // Main search
        .mockResolvedValueOnce([{ range: '£400k - £600k', count: '5' }]) // Price ranges
        .mockResolvedValueOnce([{ type: 'apartment', count: '10' }]) // Property types
        .mockResolvedValueOnce([{ city: 'London', count: '15' }]) // Locations
        .mockResolvedValueOnce([{ feature: 'balcony', count: '8' }]); // Features

      const startTime = Date.now();
      await service.search('apartment');
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should limit results to prevent memory issues', async () => {
      mockCache.get.mockResolvedValue(null);
      mockEmbedding.generateEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);

      // Create large result set
      const largeResultSet = Array.from({ length: 100 }, (_, i) => ({
        ...mockProperties[0],
        id: `property-${i}`,
      }));

      mockDb.query
        .mockResolvedValueOnce(largeResultSet) // Main search
        .mockResolvedValueOnce([{ range: '£400k - £600k', count: '5' }]) // Price ranges
        .mockResolvedValueOnce([{ type: 'apartment', count: '10' }]) // Property types
        .mockResolvedValueOnce([{ city: 'London', count: '15' }]) // Locations
        .mockResolvedValueOnce([{ feature: 'balcony', count: '8' }]); // Features

      await service.search('apartment');

      const sqlCall = mockDb.query.mock.calls[0];
      const sql = sqlCall[0];
      expect(sql).toContain('LIMIT'); // Should contain LIMIT with configured value
    });
  });

  describe('Configuration', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      // Reset modules to ensure config is re-evaluated for each test
      vi.resetModules();
      process.env = { ...originalEnv };
    });

    afterAll(() => {
      process.env = originalEnv;
    });

    it('should use default values when environment variables are not set', async () => {
      // Arrange: Ensure env vars are undefined
      delete process.env.CACHE_TTL_SECONDS;
      delete process.env.SEARCH_RESULT_LIMIT;

      // We need to re-import the service to get the updated config
      const { SemanticSearchService } = await import('./SemanticSearchService');
      const service = new SemanticSearchService(mockDb, mockEmbedding, mockCache, queryParser, mockLogger);

      mockCache.get.mockResolvedValue(null);
      mockDb.query
        .mockResolvedValueOnce([]) // Main search
        .mockResolvedValueOnce([{ range: '£400k - £600k', count: '5' }]) // Price ranges
        .mockResolvedValueOnce([{ type: 'apartment', count: '10' }]) // Property types
        .mockResolvedValueOnce([{ city: 'London', count: '15' }]) // Locations
        .mockResolvedValueOnce([{ feature: 'balcony', count: '8' }]); // Features

      // Act
      await service.search('test query');

      // Assert
      const sql = mockDb.query.mock.calls[0][0];
      expect(sql).toContain('LIMIT 50'); // Default limit
      expect(mockCache.set).toHaveBeenCalledWith(expect.any(String), expect.any(Object), 300); // Default TTL
    });

    it('should use values from environment variables when they are set', async () => {
      // Arrange: Set custom env vars
      process.env.CACHE_TTL_SECONDS = '600';
      process.env.SEARCH_RESULT_LIMIT = '25';

      const { SemanticSearchService } = await import('./SemanticSearchService');
      const service = new SemanticSearchService(mockDb, mockEmbedding, mockCache, queryParser, mockLogger);

      mockCache.get.mockResolvedValue(null);
      mockDb.query
        .mockResolvedValueOnce([]) // Main search
        .mockResolvedValueOnce([{ range: '£400k - £600k', count: '5' }]) // Price ranges
        .mockResolvedValueOnce([{ type: 'apartment', count: '10' }]) // Property types
        .mockResolvedValueOnce([{ city: 'London', count: '15' }]) // Locations
        .mockResolvedValueOnce([{ feature: 'balcony', count: '8' }]); // Features

      // Act
      await service.search('test query');

      // Assert
      const sql = mockDb.query.mock.calls[0][0];
      expect(sql).toContain('LIMIT 25'); // Custom limit from env
      expect(mockCache.set).toHaveBeenCalledWith(expect.any(String), expect.any(Object), 600); // Custom TTL from env
    });

    it('should handle invalid environment variable values gracefully', async () => {
      // Arrange: Set invalid env vars
      process.env.CACHE_TTL_SECONDS = 'invalid';
      process.env.SEARCH_RESULT_LIMIT = 'not-a-number';

      const { SemanticSearchService } = await import('./SemanticSearchService');
      const service = new SemanticSearchService(mockDb, mockEmbedding, mockCache, queryParser, mockLogger);

      mockCache.get.mockResolvedValue(null);
      mockDb.query
        .mockResolvedValueOnce([]) // Main search
        .mockResolvedValueOnce([{ range: '£400k - £600k', count: '5' }]) // Price ranges
        .mockResolvedValueOnce([{ type: 'apartment', count: '10' }]) // Property types
        .mockResolvedValueOnce([{ city: 'London', count: '15' }]) // Locations
        .mockResolvedValueOnce([{ feature: 'balcony', count: '8' }]); // Features

      // Act
      await service.search('test query');

      // Assert - should fall back to NaN which becomes 0 for parseInt with invalid strings
      const sql = mockDb.query.mock.calls[0][0];
      expect(sql).toContain('LIMIT'); // Should still have a limit
      expect(mockCache.set).toHaveBeenCalledWith(expect.any(String), expect.any(Object), expect.any(Number));
    });

    it('should use different configurations for different environments', async () => {
      // Test production environment
      process.env.NODE_ENV = 'production';
      process.env.CACHE_TTL_SECONDS = '1800'; // 30 minutes for production
      process.env.SEARCH_RESULT_LIMIT = '100';

      const { SemanticSearchService } = await import('./SemanticSearchService');
      const service = new SemanticSearchService(mockDb, mockEmbedding, mockCache, queryParser, mockLogger);

      mockCache.get.mockResolvedValue(null);
      mockDb.query
        .mockResolvedValueOnce([]) // Main search
        .mockResolvedValueOnce([{ range: '£400k - £600k', count: '5' }]) // Price ranges
        .mockResolvedValueOnce([{ type: 'apartment', count: '10' }]) // Property types
        .mockResolvedValueOnce([{ city: 'London', count: '15' }]) // Locations
        .mockResolvedValueOnce([{ feature: 'balcony', count: '8' }]); // Features

      // Act
      await service.search('test query');

      // Assert
      const sql = mockDb.query.mock.calls[0][0];
      expect(sql).toContain('LIMIT 100');
      expect(mockCache.set).toHaveBeenCalledWith(expect.any(String), expect.any(Object), 1800);
    });


  });

  describe('Re-ranking Logic', () => {
    it('should prioritize feature matches when feature weight is high', async () => {
      // Arrange: Two properties, one with better semantic score, one with a key feature
      const properties = [
        {
          id: '1',
          title: 'Nice flat',
          similarity_score: 0.9,
          features: [],
          city: 'London',
          postcode: 'SW1A 1AA',
          price: 400000,
          bedrooms: 2,
          bathrooms: 1,
          propertyType: 'apartment',
          listedDate: new Date().toISOString()
        },
        {
          id: '2',
          title: 'Okay flat',
          similarity_score: 0.7,
          features: ['garden'],
          city: 'London',
          postcode: 'SW1A 1AA',
          price: 400000,
          bedrooms: 2,
          bathrooms: 1,
          propertyType: 'apartment',
          listedDate: new Date().toISOString()
        },
      ];

      // Mock the environment to heavily weigh features
      const originalEnv = process.env;
      process.env.RANKING_WEIGHTS = JSON.stringify({
        baseScore: 0.1, // diminish semantic score importance
        featureMatch: 0.9, // heavily boost feature matches
        cityMatch: 0,
        postcodePrefixMatch: 0,
        priceInRange: 0,
        bedroomMatch: 0,
        bathroomMatch: 0,
        propertyTypeMatch: 0,
        freshnessBoost: 0,
        superFreshnessBoost: 0,
      });

      // Reset modules to pick up new config
      vi.resetModules();
      const { SemanticSearchService } = await import('./SemanticSearchService');
      const service = new SemanticSearchService(mockDb, mockEmbedding, mockCache, queryParser, mockLogger);

      mockCache.get.mockResolvedValue(null);
      mockDb.query
        .mockResolvedValueOnce(properties) // Main search
        .mockResolvedValueOnce([{ range: '£400k - £600k', count: '5' }]) // Price ranges
        .mockResolvedValueOnce([{ type: 'apartment', count: '10' }]) // Property types
        .mockResolvedValueOnce([{ city: 'London', count: '15' }]) // Locations
        .mockResolvedValueOnce([{ feature: 'garden', count: '8' }]); // Features

      mockEmbedding.generateEmbedding.mockResolvedValue([0.1]);

      // Mock the query parser to return features
      const mockQueryParser = {
        parse: vi.fn().mockReturnValue({
          originalQuery: 'flat with a garden',
          features: ['garden'],
          location: { city: 'London' },
          budget: {},
          rooms: {},
          propertyType: null
        })
      };

      const serviceWithMockParser = new SemanticSearchService(mockDb, mockEmbedding, mockCache, mockQueryParser, mockLogger);

      // Act: Search for the specific feature
      const result = await serviceWithMockParser.search('flat with a garden');

      // Assert: The property with the garden should now be ranked first, despite a lower semantic score
      expect(result.properties[0].id).toBe('2');
      expect(result.properties[0].relevanceScore).toBeGreaterThan(result.properties[1].relevanceScore);

      // Restore environment
      process.env = originalEnv;
    });
  });

  describe('Logging', () => {
    it('should log the details of the re-ranking calculation', async () => {
      // Arrange
      const mockProperties = [
        {
          id: '1',
          title: 'Modern apartment',
          similarity_score: 0.8,
          features: ['parking', 'balcony'],
          city: 'London',
          postcode: 'SW1A 1AA',
          price: 500000,
          bedrooms: 2,
          bathrooms: 1,
          propertyType: 'apartment',
          listedDate: new Date().toISOString()
        },
        {
          id: '2',
          title: 'Cozy flat',
          similarity_score: 0.6,
          features: ['garden'],
          city: 'Manchester',
          postcode: 'M1 1AA',
          price: 300000,
          bedrooms: 1,
          bathrooms: 1,
          propertyType: 'apartment',
          listedDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() // 2 days ago
        }
      ];

      mockCache.get.mockResolvedValue(null);
      mockDb.query
        .mockResolvedValueOnce(mockProperties) // Main search
        .mockResolvedValueOnce([{ range: '£400k - £600k', count: '5' }]) // Price ranges
        .mockResolvedValueOnce([{ type: 'apartment', count: '10' }]) // Property types
        .mockResolvedValueOnce([{ city: 'London', count: '15' }]) // Locations
        .mockResolvedValueOnce([{ feature: 'parking', count: '8' }]); // Features

      mockEmbedding.generateEmbedding.mockResolvedValue([0.1]);

      // Act
      await service.search('modern apartment');

      // Assert
      // Check that the logger was called for each property
      expect(mockLogger.debug).toHaveBeenCalledTimes(mockProperties.length);

      // Check the log message for the first property for content and structure
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Re-ranking property ID: 1'), // Ensure it identifies the property
        expect.objectContaining({ // Ensure it logs structured data
          propertyId: '1',
          initialScore: expect.any(Number),
          finalScore: expect.any(Number),
          boosts: expect.any(Object),
          property: expect.objectContaining({
            id: '1',
            title: 'Modern apartment',
            city: 'London',
            price: 500000,
            features: ['parking', 'balcony']
          })
        })
      );

      // Check that boosts are properly logged
      const firstCall = mockLogger.debug.mock.calls[0];
      const logData = firstCall[1];
      expect(logData.boosts).toHaveProperty('baseScore');
      expect(logData.boosts.baseScore).toBeGreaterThan(0);

      // Check that the initial and final scores are different (showing re-ranking occurred)
      expect(logData.finalScore).not.toBe(logData.initialScore);
    });

    it('should use a no-op logger when needed', async () => {
      // Arrange: Create service with a no-op logger
      const noOpLogger: Logger = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      };

      const serviceWithNoOpLogger = new SemanticSearchService(
        mockDb,
        mockEmbedding,
        mockCache,
        queryParser,
        noOpLogger
      );

      const mockProperties = [
        {
          id: '1',
          title: 'Test property',
          similarity_score: 0.8,
          features: [],
          city: 'London',
          postcode: 'SW1A 1AA',
          price: 500000,
          bedrooms: 2,
          bathrooms: 1,
          propertyType: 'apartment',
          listedDate: new Date().toISOString()
        }
      ];

      mockCache.get.mockResolvedValue(null);
      mockDb.query
        .mockResolvedValueOnce(mockProperties) // Main search
        .mockResolvedValueOnce([]) // Price ranges
        .mockResolvedValueOnce([]) // Property types
        .mockResolvedValueOnce([]) // Locations
        .mockResolvedValueOnce([]); // Features

      mockEmbedding.generateEmbedding.mockResolvedValue([0.1]);

      // Act
      await serviceWithNoOpLogger.search('test query');

      // Assert: The no-op logger should have been called (but we can verify it's separate from main mock)
      expect(noOpLogger.debug).toHaveBeenCalled();
      // Verify the main mock logger was not affected
      expect(mockLogger.debug).not.toHaveBeenCalled();
    });
  });
});