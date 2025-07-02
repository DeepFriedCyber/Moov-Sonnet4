import { QueryParser } from './QueryParser';
import { SearchIntent } from '@/types/search';

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

  describe('local points of interest extraction', () => {
    it('should extract local points of interest', () => {
      const parser = new QueryParser();
      const query = 'I need a flat near a primary school and a park';
      const result = parser.parse(query);

      expect(result.location.nearBy).toEqual(expect.arrayContaining(['primary school', 'park']));
    });

    it('should identify multiple types of local amenities', () => {
      const testCases = [
        {
          query: 'house near hospital and shopping center',
          expected: ['hospital', 'shopping center']
        },
        {
          query: 'apartment close to tube station and gym',
          expected: ['tube station', 'gym']
        },
        {
          query: 'property near good schools and restaurants',
          expected: ['schools', 'restaurants']
        },
        {
          query: 'flat walking distance to university and library',
          expected: ['university', 'library']
        }
      ];

      testCases.forEach(({ query, expected }) => {
        const result = parser.parse(query);
        expect(result.location.nearBy).toEqual(expect.arrayContaining(expected));
      });
    });

    it('should handle complex proximity expressions', () => {
      const testCases = [
        {
          query: 'house within 5 minutes walk of train station',
          expected: { nearBy: ['train station'], proximity: { distance: 5, unit: 'minutes', mode: 'walk' } }
        },
        {
          query: 'apartment 10 minutes drive from city center',
          expected: { nearBy: ['city center'], proximity: { distance: 10, unit: 'minutes', mode: 'drive' } }
        },
        {
          query: 'property within 1 mile of beach',
          expected: { nearBy: ['beach'], proximity: { distance: 1, unit: 'mile' } }
        }
      ];

      testCases.forEach(({ query, expected }) => {
        const result = parser.parse(query);
        expect(result.location).toMatchObject(expected);
      });
    });

    it('should recognize transport links', () => {
      const query = 'flat near Victoria station, bus stop, and underground';
      const result = parser.parse(query);

      expect(result.location.nearBy).toEqual(expect.arrayContaining([
        'Victoria station',
        'bus stop',
        'underground'
      ]));
      expect(result.location.transport).toEqual(expect.arrayContaining([
        'station',
        'bus',
        'underground'
      ]));
    });

    it('should identify family-oriented amenities', () => {
      const query = 'family home near primary school, playground, and nursery';
      const result = parser.parse(query);

      expect(result.location.nearBy).toEqual(expect.arrayContaining([
        'primary school',
        'playground',
        'nursery'
      ]));
      expect(result.lifestyle).toContain('family-friendly');
    });

    it('should extract lifestyle-specific points of interest', () => {
      const testCases = [
        {
          query: 'apartment near nightlife and bars',
          expected: { nearBy: ['nightlife', 'bars'], lifestyle: ['nightlife'] }
        },
        {
          query: 'house close to golf course and country club',
          expected: { nearBy: ['golf course', 'country club'], lifestyle: ['luxury'] }
        },
        {
          query: 'flat near co-working spaces and cafes',
          expected: { nearBy: ['co-working spaces', 'cafes'], lifestyle: ['professional'] }
        }
      ];

      testCases.forEach(({ query, expected }) => {
        const result = parser.parse(query);
        expect(result.location.nearBy).toEqual(expect.arrayContaining(expected.nearBy));
        expect(result.lifestyle).toEqual(expect.arrayContaining(expected.lifestyle));
      });
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