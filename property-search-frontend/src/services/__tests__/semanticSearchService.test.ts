// TDD Tests for Semantic Search Service
import { describe, it, expect, beforeEach } from 'vitest';
import { SemanticSearchService } from '../semanticSearchService';
import { Property } from '@/types';

// Mock property data
const mockProperties: Property[] = [
  {
    id: '1',
    title: 'Modern Luxury Apartment in Central London',
    description: 'Beautiful 2-bedroom apartment with stunning city views, recently renovated with modern fixtures',
    price: 450000,
    bedrooms: 2,
    bathrooms: 2,
    area: 1200,
    propertyType: 'apartment',
    listingType: 'sale',
    location: {
      address: '123 City Center',
      area: 'Central London',
      city: 'London',
      postcode: 'SW1A 1AA'
    },
    images: ['https://example.com/image1.jpg'],
    features: ['Balcony', 'Parking', 'Gym', 'Modern Kitchen'],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z'
  },
  {
    id: '2',
    title: 'Family Home with Large Garden',
    description: 'Spacious 4-bedroom house perfect for families, quiet neighborhood near excellent schools',
    price: 650000,
    bedrooms: 4,
    bathrooms: 3,
    area: 2000,
    propertyType: 'house',
    listingType: 'sale',
    location: {
      address: '456 Suburban Street',
      area: 'Suburbs',
      city: 'Manchester',
      postcode: 'M1 1AA'
    },
    images: ['https://example.com/image2.jpg'],
    features: ['Garden', 'Garage', 'Near Schools', 'Quiet Area'],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z'
  },
  {
    id: '3',
    title: 'Pet-Friendly Studio Flat',
    description: 'Cozy studio apartment with outdoor terrace, pet-friendly building with dog park nearby',
    price: 180000,
    bedrooms: 1,
    bathrooms: 1,
    area: 500,
    propertyType: 'apartment',
    listingType: 'sale',
    location: {
      address: '789 Pet Lane',
      area: 'East London',
      city: 'London',
      postcode: 'E1 1AA'
    },
    images: ['https://example.com/image3.jpg'],
    features: ['Pet-Friendly', 'Terrace', 'Dog Park'],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z'
  }
];

describe('SemanticSearchService', () => {
  let service: SemanticSearchService;

  beforeEach(() => {
    service = new SemanticSearchService();
  });

  describe('analyzeQuery', () => {
    describe('Price Extraction', () => {
      it('should extract price range from query', () => {
        const analysis = service.analyzeQuery('2 bed apartment £200k-£400k');
        
        expect(analysis.extractedFilters.minPrice).toBe(200000);
        expect(analysis.extractedFilters.maxPrice).toBe(400000);
        expect(analysis.intent).toContain('Budget between £200,000-£400,000');
        expect(analysis.keywords).toContain('budget');
        expect(analysis.confidence).toBeGreaterThan(0);
      });

      it('should extract maximum price with "under" keyword', () => {
        const analysis = service.analyzeQuery('house under £300k');
        
        expect(analysis.extractedFilters.maxPrice).toBe(300000);
        expect(analysis.intent).toContain('Budget under £300,000');
        expect(analysis.keywords).toContain('affordable');
      });

      it('should extract minimum price with "over" keyword', () => {
        const analysis = service.analyzeQuery('luxury apartment over £500k');
        
        expect(analysis.extractedFilters.minPrice).toBe(500000);
        expect(analysis.intent).toContain('Budget over £500,000');
        expect(analysis.keywords).toContain('premium');
      });

      it('should handle different price formats', () => {
        const testCases = [
          { query: '£200,000 to £400,000', min: 200000, max: 400000 },
          { query: '200k-400k', min: 200000, max: 400000 },
          { query: '200 to 400 thousand', min: 200000, max: 400000 }
        ];

        testCases.forEach(({ query, min, max }) => {
          const analysis = service.analyzeQuery(query);
          expect(analysis.extractedFilters.minPrice).toBe(min);
          expect(analysis.extractedFilters.maxPrice).toBe(max);
        });
      });
    });

    describe('Bedroom Extraction', () => {
      it('should extract bedroom count from query', () => {
        const analysis = service.analyzeQuery('3 bedroom house');
        
        expect(analysis.extractedFilters.bedrooms).toBe(3);
        expect(analysis.intent).toContain('Looking for 3 bedroom property');
        expect(analysis.keywords).toContain('bedrooms');
      });

      it('should handle different bedroom formats', () => {
        const testCases = [
          { query: '2 bed apartment', bedrooms: 2 },
          { query: '4 bedroom family home', bedrooms: 4 },
          { query: 'one bedroom flat', bedrooms: 1 }
        ];

        testCases.forEach(({ query, bedrooms }) => {
          const analysis = service.analyzeQuery(query);
          expect(analysis.extractedFilters.bedrooms).toBe(bedrooms);
        });
      });
    });

    describe('Property Type Extraction', () => {
      it('should extract apartment type', () => {
        const analysis = service.analyzeQuery('modern apartment with balcony');
        
        expect(analysis.extractedFilters.propertyType).toBe('apartment');
        expect(analysis.intent).toContain('Prefers apartment');
        expect(analysis.keywords).toContain('apartment');
      });

      it('should extract house type', () => {
        const analysis = service.analyzeQuery('family house with garden');
        
        expect(analysis.extractedFilters.propertyType).toBe('house');
        expect(analysis.intent).toContain('Prefers house');
        expect(analysis.keywords).toContain('house');
      });

      it('should handle property type synonyms', () => {
        const testCases = [
          { query: 'flat in london', type: 'apartment' },
          { query: 'detached home', type: 'house' },
          { query: 'studio apartment', type: 'apartment' }
        ];

        testCases.forEach(({ query, type }) => {
          const analysis = service.analyzeQuery(query);
          expect(analysis.extractedFilters.propertyType).toBe(type);
        });
      });
    });

    describe('Location Extraction', () => {
      it('should extract location from query', () => {
        const analysis = service.analyzeQuery('apartment in london');
        
        expect(analysis.extractedFilters.location).toBe('london');
        expect(analysis.intent).toContain('Interested in london area');
        expect(analysis.keywords).toContain('location');
      });

      it('should handle multiple location keywords', () => {
        const testCases = [
          'house in manchester',
          'flat near central london',
          'property in birmingham'
        ];

        testCases.forEach(query => {
          const analysis = service.analyzeQuery(query);
          expect(analysis.extractedFilters.location).toBeDefined();
          expect(analysis.keywords).toContain('location');
        });
      });
    });

    describe('Feature Extraction', () => {
      it('should extract garden feature', () => {
        const analysis = service.analyzeQuery('house with garden');
        
        expect(analysis.extractedFilters.features).toContain('garden');
        expect(analysis.keywords).toContain('garden');
        expect(analysis.suggestions).toContain('Near Schools');
      });

      it('should extract pet-friendly feature', () => {
        const analysis = service.analyzeQuery('pet-friendly apartment');
        
        expect(analysis.extractedFilters.features).toContain('pet-friendly');
        expect(analysis.keywords).toContain('pet-friendly');
        expect(analysis.suggestions).toContain('Pet Policy');
      });

      it('should extract modern feature', () => {
        const analysis = service.analyzeQuery('modern apartment');
        
        expect(analysis.extractedFilters.features).toContain('modern');
        expect(analysis.keywords).toContain('modern');
        expect(analysis.suggestions).toContain('Recently Renovated');
      });

      it('should extract multiple features', () => {
        const analysis = service.analyzeQuery('modern family home with garden and parking');
        
        expect(analysis.extractedFilters.features).toContain('modern');
        expect(analysis.extractedFilters.features).toContain('family');
        expect(analysis.extractedFilters.features).toContain('garden');
        expect(analysis.extractedFilters.features).toContain('parking');
      });
    });

    describe('Size Preferences', () => {
      it('should extract small size preference', () => {
        const analysis = service.analyzeQuery('cozy apartment');
        
        expect(analysis.extractedFilters.maxArea).toBe(800);
        expect(analysis.keywords).toContain('small');
        expect(analysis.intent).toContain('Prefers small properties');
      });

      it('should extract large size preference', () => {
        const analysis = service.analyzeQuery('spacious house');
        
        expect(analysis.extractedFilters.minArea).toBe(1500);
        expect(analysis.keywords).toContain('large');
        expect(analysis.intent).toContain('Prefers large properties');
      });
    });

    describe('Sentiment Analysis', () => {
      it('should detect positive sentiment', () => {
        const analysis = service.analyzeQuery('I love beautiful modern apartments');
        
        expect(analysis.sentiment).toBe('positive');
      });

      it('should detect negative sentiment', () => {
        const analysis = service.analyzeQuery('avoid noisy areas, not interested in old properties');
        
        expect(analysis.sentiment).toBe('negative');
      });

      it('should default to neutral sentiment', () => {
        const analysis = service.analyzeQuery('2 bedroom apartment');
        
        expect(analysis.sentiment).toBe('neutral');
      });
    });

    describe('Confidence Scoring', () => {
      it('should have higher confidence with more extracted information', () => {
        const simpleQuery = service.analyzeQuery('apartment');
        const complexQuery = service.analyzeQuery('2 bed modern apartment in london £200k-£400k with garden');
        
        expect(complexQuery.confidence).toBeGreaterThan(simpleQuery.confidence);
      });

      it('should cap confidence at 100', () => {
        const analysis = service.analyzeQuery('luxury 4 bedroom detached house in central london £500k-£1m with garden parking modern features');
        
        expect(analysis.confidence).toBeLessThanOrEqual(100);
      });
    });
  });

  describe('enhanceProperties', () => {
    it('should enhance properties with relevance scores', () => {
      const query = 'modern apartment in london';
      const analysis = service.analyzeQuery(query);
      const enhanced = service.enhanceProperties(mockProperties, query, analysis);
      
      expect(enhanced[0].relevanceScore).toBeGreaterThan(0);
      expect(enhanced[0].matchReasons).toBeDefined();
      expect(enhanced[0].matchKeywords).toBeDefined();
    });

    it('should score properties based on price matching', () => {
      const query = 'apartment under £500k';
      const analysis = service.analyzeQuery(query);
      const enhanced = service.enhanceProperties(mockProperties, query, analysis);
      
      const londonApartment = enhanced.find(p => p.id === '1');
      expect(londonApartment?.matchReasons).toContain(expect.stringContaining('budget'));
      expect(londonApartment?.matchKeywords).toContain('budget-match');
    });

    it('should score properties based on bedroom matching', () => {
      const query = '2 bedroom apartment';
      const analysis = service.analyzeQuery(query);
      const enhanced = service.enhanceProperties(mockProperties, query, analysis);
      
      const apartment = enhanced.find(p => p.bedrooms === 2);
      expect(apartment?.matchReasons).toContain(expect.stringContaining('2 bedrooms'));
      expect(apartment?.matchKeywords).toContain('bedroom-match');
    });

    it('should score properties based on location matching', () => {
      const query = 'apartment in london';
      const analysis = service.analyzeQuery(query);
      const enhanced = service.enhanceProperties(mockProperties, query, analysis);
      
      const londonProperties = enhanced.filter(p => p.location.city.toLowerCase() === 'london');
      londonProperties.forEach(property => {
        expect(property.matchReasons).toContain(expect.stringContaining('london'));
        expect(property.matchKeywords).toContain('location-match');
      });
    });

    it('should score properties based on feature matching', () => {
      const query = 'pet-friendly apartment';
      const analysis = service.analyzeQuery(query);
      const enhanced = service.enhanceProperties(mockProperties, query, analysis);
      
      const petFriendlyProperty = enhanced.find(p => p.features.some(f => f.toLowerCase().includes('pet')));
      expect(petFriendlyProperty?.matchReasons).toContain(expect.stringContaining('pet-friendly'));
      expect(petFriendlyProperty?.matchKeywords).toContain('pet-friendly');
    });

    it('should apply semantic bonuses correctly', () => {
      const query = 'luxury apartment';
      const analysis = service.analyzeQuery(query);
      const enhanced = service.enhanceProperties(mockProperties, query, analysis);
      
      const luxuryProperty = enhanced.find(p => p.price > 400000);
      expect(luxuryProperty?.semanticScore).toBeGreaterThan(0);
      expect(luxuryProperty?.matchReasons).toContain(expect.stringContaining('luxury'));
    });

    it('should sort properties by combined relevance and semantic scores', () => {
      const query = 'modern apartment in london';
      const analysis = service.analyzeQuery(query);
      const enhanced = service.enhanceProperties(mockProperties, query, analysis);
      
      // Should be sorted in descending order of total score
      for (let i = 0; i < enhanced.length - 1; i++) {
        const currentScore = (enhanced[i].relevanceScore || 0) + (enhanced[i].semanticScore || 0);
        const nextScore = (enhanced[i + 1].relevanceScore || 0) + (enhanced[i + 1].semanticScore || 0);
        expect(currentScore).toBeGreaterThanOrEqual(nextScore);
      }
    });

    it('should filter out properties with zero relevance', () => {
      const query = 'completely unrelated search term xyz123';
      const analysis = service.analyzeQuery(query);
      const enhanced = service.enhanceProperties(mockProperties, query, analysis);
      
      enhanced.forEach(property => {
        expect(property.relevanceScore).toBeGreaterThan(0);
      });
    });

    it('should limit match reasons to top 3', () => {
      const query = '2 bedroom modern luxury apartment in london £400k-£500k with parking garden';
      const analysis = service.analyzeQuery(query);
      const enhanced = service.enhanceProperties(mockProperties, query, analysis);
      
      enhanced.forEach(property => {
        expect(property.matchReasons?.length).toBeLessThanOrEqual(3);
      });
    });
  });

  describe('performSemanticSearch', () => {
    it('should return complete search results', async () => {
      const query = 'modern apartment in london';
      const results = await service.performSemanticSearch(mockProperties, query);
      
      expect(results.properties).toBeDefined();
      expect(results.total).toBeGreaterThan(0);
      expect(results.page).toBe(1);
      expect(results.totalPages).toBeGreaterThan(0);
      expect(results.filters.query).toBe(query);
      expect(results.searchTime).toBeGreaterThan(0);
      expect(results.averageRelevance).toBeGreaterThanOrEqual(0);
      expect(results.semanticAnalysis).toBeDefined();
    });

    it('should handle pagination correctly', async () => {
      const query = 'apartment';
      const page1 = await service.performSemanticSearch(mockProperties, query, 1, 2);
      const page2 = await service.performSemanticSearch(mockProperties, query, 2, 2);
      
      expect(page1.page).toBe(1);
      expect(page2.page).toBe(2);
      expect(page1.properties.length).toBeLessThanOrEqual(2);
      expect(page2.properties.length).toBeLessThanOrEqual(2);
      
      // Properties should be different between pages
      const page1Ids = page1.properties.map(p => p.id);
      const page2Ids = page2.properties.map(p => p.id);
      expect(page1Ids).not.toEqual(page2Ids);
    });

    it('should calculate average relevance correctly', async () => {
      const query = 'apartment';
      const results = await service.performSemanticSearch(mockProperties, query);
      
      const expectedAverage = Math.round(
        results.properties.reduce((sum, p) => sum + (p.relevanceScore || 0), 0) / results.properties.length
      );
      
      expect(results.averageRelevance).toBe(expectedAverage);
    });

    it('should include semantic analysis in results', async () => {
      const query = '2 bedroom apartment in london £300k-£500k';
      const results = await service.performSemanticSearch(mockProperties, query);
      
      expect(results.semanticAnalysis).toBeDefined();
      expect(results.semanticAnalysis?.extractedFilters.bedrooms).toBe(2);
      expect(results.semanticAnalysis?.extractedFilters.location).toBe('london');
      expect(results.semanticAnalysis?.extractedFilters.minPrice).toBe(300000);
      expect(results.semanticAnalysis?.extractedFilters.maxPrice).toBe(500000);
    });
  });

  describe('generateSuggestions', () => {
    it('should generate location-based suggestions', () => {
      const suggestions = service.generateSuggestions('lon');
      
      expect(suggestions).toContain('Properties in london');
    });

    it('should generate property type suggestions', () => {
      const suggestions = service.generateSuggestions('apart');
      
      expect(suggestions.some(s => s.includes('apartment'))).toBe(true);
    });

    it('should generate feature-based suggestions', () => {
      const suggestions = service.generateSuggestions('gard');
      
      expect(suggestions).toContain('Properties with garden');
    });

    it('should generate bedroom suggestions', () => {
      const suggestions = service.generateSuggestions('bed');
      
      expect(suggestions).toContain('2 bedroom apartment');
      expect(suggestions).toContain('3 bedroom house');
    });

    it('should generate price suggestions', () => {
      const suggestions = service.generateSuggestions('£');
      
      expect(suggestions).toContain('Under £300k');
      expect(suggestions).toContain('£300k - £500k');
      expect(suggestions).toContain('Over £500k');
    });

    it('should limit suggestions to 5', () => {
      const suggestions = service.generateSuggestions('a');
      
      expect(suggestions.length).toBeLessThanOrEqual(5);
    });

    it('should return empty array for no matches', () => {
      const suggestions = service.generateSuggestions('xyz123');
      
      expect(suggestions).toEqual([]);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty query', () => {
      const analysis = service.analyzeQuery('');
      
      expect(analysis.intent).toBe('General property search');
      expect(analysis.confidence).toBe(0);
      expect(analysis.extractedFilters.query).toBe('');
    });

    it('should handle query with only whitespace', () => {
      const analysis = service.analyzeQuery('   ');
      
      expect(analysis.intent).toBe('General property search');
      expect(analysis.confidence).toBe(0);
    });

    it('should handle empty properties array', async () => {
      const results = await service.performSemanticSearch([], 'apartment');
      
      expect(results.properties).toEqual([]);
      expect(results.total).toBe(0);
      expect(results.totalPages).toBe(0);
    });

    it('should handle invalid price formats gracefully', () => {
      const analysis = service.analyzeQuery('apartment £abc-£def');
      
      expect(analysis.extractedFilters.minPrice).toBeUndefined();
      expect(analysis.extractedFilters.maxPrice).toBeUndefined();
    });

    it('should handle very long queries', () => {
      const longQuery = 'a'.repeat(1000) + ' apartment in london';
      const analysis = service.analyzeQuery(longQuery);
      
      expect(analysis.extractedFilters.location).toBe('london');
      expect(analysis.extractedFilters.propertyType).toBe('apartment');
    });
  });

  describe('Performance', () => {
    it('should complete search within reasonable time', async () => {
      const startTime = Date.now();
      await service.performSemanticSearch(mockProperties, 'modern apartment in london');
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeLessThan(100); // Should complete within 100ms
    });

    it('should handle large property datasets efficiently', async () => {
      // Create a larger dataset
      const largeDataset = Array(1000).fill(null).map((_, index) => ({
        ...mockProperties[0],
        id: `property-${index}`,
        title: `Property ${index}`,
        price: 200000 + (index * 1000)
      }));

      const startTime = Date.now();
      const results = await service.performSemanticSearch(largeDataset, 'apartment');
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeLessThan(500); // Should complete within 500ms
      expect(results.properties.length).toBeGreaterThan(0);
    });
  });
});