import { renderHook, act } from '@testing-library/react';
import { usePropertyStore } from './propertyStore';
import { Property } from '@/types/property';

const mockProperty: Property = {
  id: '1',
  title: 'Test Property',
  price: 500000,
  location: {
    address: '123 Test St',
    city: 'London',
    postcode: 'SW1A 1AA',
    coordinates: { lat: 51.5074, lng: -0.1278 },
  },
  bedrooms: 2,
  bathrooms: 1,
  area: 850,
  propertyType: 'apartment',
  listingType: 'sale',
  images: [],
  features: [],
  description: 'Test description',
  listedDate: new Date(),
  agent: {
    id: 'agent1',
    name: 'Test Agent',
    phone: '123456789',
    email: 'agent@test.com',
  },
};

describe('PropertyStore', () => {
  beforeEach(() => {
    const { result } = renderHook(() => usePropertyStore());
    act(() => {
      result.current.clearAll();
    });
  });

  describe('properties management', () => {
    it('should add properties to the store', () => {
      const { result } = renderHook(() => usePropertyStore());

      act(() => {
        result.current.setProperties([mockProperty]);
      });

      expect(result.current.properties).toHaveLength(1);
      expect(result.current.properties[0]).toEqual(mockProperty);
    });

    it('should update existing property', () => {
      const { result } = renderHook(() => usePropertyStore());

      act(() => {
        result.current.setProperties([mockProperty]);
        result.current.updateProperty('1', { price: 550000 });
      });

      expect(result.current.properties[0].price).toBe(550000);
    });

    it('should append properties for pagination', () => {
      const { result } = renderHook(() => usePropertyStore());
      const additionalProperty = { ...mockProperty, id: '2', title: 'Second Property' };

      act(() => {
        result.current.setProperties([mockProperty]);
        result.current.appendProperties([additionalProperty]);
      });

      expect(result.current.properties).toHaveLength(2);
      expect(result.current.properties[1]).toEqual(additionalProperty);
    });

    it('should handle property pagination', () => {
      const { result } = renderHook(() => usePropertyStore());
      const properties = Array.from({ length: 50 }, (_, i) => ({
        ...mockProperty,
        id: `${i}`,
      }));

      act(() => {
        result.current.setProperties(properties);
        result.current.setTotalCount(50);
      });

      expect(result.current.properties).toHaveLength(50);
      expect(result.current.totalCount).toBe(50);
      expect(result.current.hasMore).toBe(false);
    });

    it('should calculate hasMore correctly', () => {
      const { result } = renderHook(() => usePropertyStore());

      act(() => {
        result.current.setProperties([mockProperty]);
        result.current.setTotalCount(10);
      });

      expect(result.current.hasMore).toBe(true);

      act(() => {
        result.current.setTotalCount(1);
      });

      expect(result.current.hasMore).toBe(false);
    });
  });

  describe('search state', () => {
    it('should manage search query and filters', () => {
      const { result } = renderHook(() => usePropertyStore());

      act(() => {
        result.current.setSearchQuery('modern apartment');
        result.current.setFilters({
          minPrice: 300000,
          maxPrice: 600000,
          bedrooms: 2,
        });
      });

      expect(result.current.searchQuery).toBe('modern apartment');
      expect(result.current.filters).toMatchObject({
        minPrice: 300000,
        maxPrice: 600000,
        bedrooms: 2,
      });
    });

    it('should reset pagination when search changes', () => {
      const { result } = renderHook(() => usePropertyStore());

      act(() => {
        result.current.nextPage();
        result.current.nextPage();
      });

      expect(result.current.currentPage).toBe(3);

      act(() => {
        result.current.setSearchQuery('new search');
      });

      expect(result.current.currentPage).toBe(1);
    });

    it('should reset pagination when filters change', () => {
      const { result } = renderHook(() => usePropertyStore());

      act(() => {
        result.current.nextPage();
        result.current.nextPage();
      });

      expect(result.current.currentPage).toBe(3);

      act(() => {
        result.current.setFilters({ bedrooms: 3 });
      });

      expect(result.current.currentPage).toBe(1);
    });

    it('should track loading states', () => {
      const { result } = renderHook(() => usePropertyStore());

      expect(result.current.isLoading).toBe(false);

      act(() => {
        result.current.setLoading(true);
      });

      expect(result.current.isLoading).toBe(true);
    });

    it('should handle search errors', () => {
      const { result } = renderHook(() => usePropertyStore());

      act(() => {
        result.current.setError('Search failed');
      });

      expect(result.current.error).toBe('Search failed');

      act(() => {
        result.current.setError(null);
      });

      expect(result.current.error).toBe(null);
    });

    it('should manage sort options', () => {
      const { result } = renderHook(() => usePropertyStore());

      act(() => {
        result.current.setSortBy('price_asc');
      });

      expect(result.current.sortBy).toBe('price_asc');

      act(() => {
        result.current.setSortBy('date');
      });

      expect(result.current.sortBy).toBe('date');
    });
  });

  describe('favorites management', () => {
    it('should add properties to favorites', () => {
      const { result } = renderHook(() => usePropertyStore());

      act(() => {
        result.current.addFavorite('1');
        result.current.addFavorite('2');
      });

      expect(result.current.favorites).toEqual(['1', '2']);
      expect(result.current.isFavorite('1')).toBe(true);
      expect(result.current.isFavorite('3')).toBe(false);
    });

    it('should remove properties from favorites', () => {
      const { result } = renderHook(() => usePropertyStore());

      act(() => {
        result.current.addFavorite('1');
        result.current.addFavorite('2');
        result.current.removeFavorite('1');
      });

      expect(result.current.favorites).toEqual(['2']);
    });

    it('should toggle favorites', () => {
      const { result } = renderHook(() => usePropertyStore());

      act(() => {
        result.current.toggleFavorite('1');
      });
      expect(result.current.isFavorite('1')).toBe(true);

      act(() => {
        result.current.toggleFavorite('1');
      });
      expect(result.current.isFavorite('1')).toBe(false);
    });

    it('should not add duplicate favorites', () => {
      const { result } = renderHook(() => usePropertyStore());

      act(() => {
        result.current.addFavorite('1');
        result.current.addFavorite('1');
      });

      expect(result.current.favorites).toEqual(['1']);
    });
  });

  describe('view history', () => {
    it('should track viewed properties', () => {
      const { result } = renderHook(() => usePropertyStore());

      act(() => {
        result.current.addToHistory(mockProperty);
      });

      expect(result.current.viewHistory).toHaveLength(1);
      expect(result.current.viewHistory[0]).toEqual(mockProperty);
    });

    it('should limit view history size', () => {
      const { result } = renderHook(() => usePropertyStore());
      const properties = Array.from({ length: 15 }, (_, i) => ({
        ...mockProperty,
        id: `${i}`,
      }));

      act(() => {
        properties.forEach(p => result.current.addToHistory(p));
      });

      // Should keep only last 10
      expect(result.current.viewHistory).toHaveLength(10);
      expect(result.current.viewHistory[0].id).toBe('14'); // Most recent first
    });

    it('should prevent duplicate entries in history', () => {
      const { result } = renderHook(() => usePropertyStore());

      act(() => {
        result.current.addToHistory(mockProperty);
        result.current.addToHistory(mockProperty);
      });

      expect(result.current.viewHistory).toHaveLength(1);
    });

    it('should move existing property to front when viewed again', () => {
      const { result } = renderHook(() => usePropertyStore());
      const property2 = { ...mockProperty, id: '2', title: 'Second Property' };

      act(() => {
        result.current.addToHistory(mockProperty);
        result.current.addToHistory(property2);
        result.current.addToHistory(mockProperty); // View first property again
      });

      expect(result.current.viewHistory).toHaveLength(2);
      expect(result.current.viewHistory[0]).toEqual(mockProperty); // Should be first
      expect(result.current.viewHistory[1]).toEqual(property2);
    });

    it('should clear view history', () => {
      const { result } = renderHook(() => usePropertyStore());

      act(() => {
        result.current.addToHistory(mockProperty);
        result.current.clearHistory();
      });

      expect(result.current.viewHistory).toHaveLength(0);
    });
  });

  describe('pagination', () => {
    it('should handle page navigation', () => {
      const { result } = renderHook(() => usePropertyStore());

      expect(result.current.currentPage).toBe(1);

      act(() => {
        result.current.nextPage();
      });

      expect(result.current.currentPage).toBe(2);

      act(() => {
        result.current.nextPage();
      });

      expect(result.current.currentPage).toBe(3);
    });

    it('should reset pagination', () => {
      const { result } = renderHook(() => usePropertyStore());

      act(() => {
        result.current.setProperties([mockProperty]);
        result.current.nextPage();
        result.current.nextPage();
      });

      expect(result.current.currentPage).toBe(3);
      expect(result.current.properties).toHaveLength(1);

      act(() => {
        result.current.resetPagination();
      });

      expect(result.current.currentPage).toBe(1);
      expect(result.current.properties).toHaveLength(0);
    });
  });

  describe('clear all', () => {
    it('should clear all state except persisted data', () => {
      const { result } = renderHook(() => usePropertyStore());

      act(() => {
        result.current.setProperties([mockProperty]);
        result.current.setSearchQuery('test');
        result.current.setFilters({ bedrooms: 2 });
        result.current.setLoading(true);
        result.current.setError('test error');
        result.current.addFavorite('1');
        result.current.nextPage();
      });

      act(() => {
        result.current.clearAll();
      });

      expect(result.current.properties).toHaveLength(0);
      expect(result.current.totalCount).toBe(0);
      expect(result.current.currentPage).toBe(1);
      expect(result.current.searchQuery).toBe('');
      expect(result.current.filters).toEqual({});
      expect(result.current.sortBy).toBe('relevance');
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBe(null);
      
      // Favorites should persist (handled by persist middleware)
      expect(result.current.favorites).toEqual(['1']);
    });
  });

  describe('computed values', () => {
    it('should calculate hasMore based on properties and total count', () => {
      const { result } = renderHook(() => usePropertyStore());

      // No properties, no total
      expect(result.current.hasMore).toBe(false);

      act(() => {
        result.current.setProperties([mockProperty]);
        result.current.setTotalCount(5);
      });

      // 1 property, 5 total
      expect(result.current.hasMore).toBe(true);

      act(() => {
        result.current.setTotalCount(1);
      });

      // 1 property, 1 total
      expect(result.current.hasMore).toBe(false);
    });
  });

  describe('persistence', () => {
    it('should persist favorites across sessions', () => {
      const { result } = renderHook(() => usePropertyStore());

      act(() => {
        result.current.addFavorite('1');
        result.current.addFavorite('2');
      });

      // Simulate page reload by creating new store instance
      const { result: newResult } = renderHook(() => usePropertyStore());

      expect(newResult.current.favorites).toEqual(['1', '2']);
    });

    it('should persist view history across sessions', () => {
      const { result } = renderHook(() => usePropertyStore());

      act(() => {
        result.current.addToHistory(mockProperty);
      });

      // Simulate page reload
      const { result: newResult } = renderHook(() => usePropertyStore());

      expect(newResult.current.viewHistory).toHaveLength(1);
      expect(newResult.current.viewHistory[0]).toEqual(mockProperty);
    });

    it('should persist filters and sort preferences', () => {
      const { result } = renderHook(() => usePropertyStore());

      act(() => {
        result.current.setFilters({ bedrooms: 2, minPrice: 300000 });
        result.current.setSortBy('price_asc');
      });

      // Simulate page reload
      const { result: newResult } = renderHook(() => usePropertyStore());

      expect(newResult.current.filters).toEqual({ bedrooms: 2, minPrice: 300000 });
      expect(newResult.current.sortBy).toBe('price_asc');
    });
  });
});