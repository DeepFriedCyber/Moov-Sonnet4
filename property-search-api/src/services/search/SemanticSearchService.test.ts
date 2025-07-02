import { SemanticSearchService } from './SemanticSearchService';
import { QueryParser } from './QueryParser';
import { SearchIntent } from '@/types/search';

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
      query: jest.fn(),
    };

    mockEmbedding = {
      generateEmbedding: jest.fn(),
    };

    mockCache = {
      get: jest.fn(),
      set: jest.fn(),
    };

    queryParser = new QueryParser();
    
    service = new SemanticSearchService(
      mockDb,
      mockEmbedding,
      mockCache,
      queryParser
    );
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
      mockDb.query.mockResolvedValue(mockProperties);

      const result = await service.search('modern apartment with balcony');

      expect(mockEmbedding.generateEmbedding).toHaveBeenCalledWith('modern apartment with balcony');
      expect(mockDb.query).toHaveBeenCalled();
      expect(result.properties).toHaveLength(2);
      expect(result.query.originalQuery).toBe('modern apartment with balcony');
    });

    it('should apply filters correctly', async () => {
      mockCache.get.mockResolvedValue(null);
      mockEmbedding.generateEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);
      mockDb.query.mockResolvedValue(mockProperties);

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
      mockDb.query.mockResolvedValue(mockProperties);

      const result = await service.search('2 bedroom apartment with balcony in London under 500k');

      expect(result.properties[0].relevanceScore).toBeGreaterThan(0);
      expect(result.properties[0].relevanceScore).toBeLessThanOrEqual(1);
      
      // First property should have higher relevance due to matching criteria
      expect(result.properties[0].id).toBe('1'); // apartment with balcony
    });

    it('should cache search results', async () => {
      mockCache.get.mockResolvedValue(null);
      mockEmbedding.generateEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);
      mockDb.query.mockResolvedValue(mockProperties);

      await service.search('modern apartment');

      expect(mockCache.set).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          properties: expect.any(Array),
          totalCount: expect.any(Number),
        }),
        300
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
      mockDb.query.mockResolvedValue(mockProperties);

      // Should still work even if cache fails
      const result = await service.search('apartment');
      expect(result.properties).toHaveLength(2);
    });
  });

  describe('performance', () => {
    it('should complete search within reasonable time', async () => {
      mockCache.get.mockResolvedValue(null);
      mockEmbedding.generateEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);
      mockDb.query.mockResolvedValue(mockProperties);

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
      
      mockDb.query.mockResolvedValue(largeResultSet);

      await service.search('apartment');

      const sqlCall = mockDb.query.mock.calls[0];
      const sql = sqlCall[0];
      expect(sql).toContain('LIMIT 50');
    });
  });
});