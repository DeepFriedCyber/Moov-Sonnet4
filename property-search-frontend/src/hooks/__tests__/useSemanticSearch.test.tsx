// TDD Tests for Semantic Search Hook
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { 
  useSemanticSearch, 
  useSemanticSearchSuggestions, 
  useQueryAnalysis,
  usePropertyEnhancement,
  useSemanticSearchStats
} from '../useSemanticSearch';
import { Property } from '@/types';

// Mock the API client
const mockApiClient = {
  searchProperties: vi.fn()
};

// Mock the useApiClient hook
vi.mock('../useApi', () => ({
  useApiClient: () => mockApiClient
}));

// Mock data
const mockProperties: Property[] = [
  {
    id: '1',
    title: 'Modern Luxury Apartment',
    description: 'Beautiful 2-bedroom apartment with stunning city views',
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
    features: ['Balcony', 'Parking', 'Gym'],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z'
  },
  {
    id: '2',
    title: 'Family Home with Garden',
    description: 'Spacious 4-bedroom house perfect for families',
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
    features: ['Garden', 'Garage', 'Near Schools'],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z'
  }
];

const mockApiSearchResult = {
  properties: mockProperties,
  total: 2,
  page: 1,
  totalPages: 1
};

// Test wrapper
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe('useSemanticSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApiClient.searchProperties.mockResolvedValue(mockApiSearchResult);
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('Basic Functionality', () => {
    it('should not search when query is empty', () => {
      const { result } = renderHook(
        () => useSemanticSearch({ query: '' }),
        { wrapper: createWrapper() }
      );

      expect(result.current.data).toBeUndefined();
      expect(mockApiClient.searchProperties).not.toHaveBeenCalled();
    });

    it('should perform search when query is provided', async () => {
      const { result } = renderHook(
        () => useSemanticSearch({ query: 'modern apartment' }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockApiClient.searchProperties).toHaveBeenCalledWith({
        query: 'modern apartment',
        pagination: { page: 1, limit: 12 }
      });
      expect(result.current.data).toBeDefined();
      expect(result.current.isSemanticSearch).toBe(true);
    });

    it('should enhance properties with semantic scoring', async () => {
      const { result } = renderHook(
        () => useSemanticSearch({ query: 'luxury apartment in london' }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data?.properties[0].relevanceScore).toBeGreaterThan(0);
      expect(result.current.data?.properties[0].matchReasons).toBeDefined();
      expect(result.current.data?.properties[0].matchKeywords).toBeDefined();
    });

    it('should include semantic analysis in results', async () => {
      const { result } = renderHook(
        () => useSemanticSearch({ query: '2 bedroom apartment £300k-£500k' }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.analysis).toBeDefined();
      expect(result.current.analysis?.extractedFilters.bedrooms).toBe(2);
      expect(result.current.analysis?.extractedFilters.minPrice).toBe(300000);
      expect(result.current.analysis?.extractedFilters.maxPrice).toBe(500000);
    });

    it('should generate suggestions based on query', async () => {
      const { result } = renderHook(
        () => useSemanticSearch({ query: 'apartment' }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.suggestions).toBeDefined();
      expect(Array.isArray(result.current.suggestions)).toBe(true);
    });
  });

  describe('Pagination', () => {
    it('should handle pagination parameters', async () => {
      const { result } = renderHook(
        () => useSemanticSearch({ 
          query: 'apartment', 
          page: 2, 
          limit: 5 
        }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockApiClient.searchProperties).toHaveBeenCalledWith({
        query: 'apartment',
        pagination: { page: 2, limit: 5 }
      });
    });

    it('should calculate pagination correctly for enhanced results', async () => {
      const { result } = renderHook(
        () => useSemanticSearch({ 
          query: 'apartment', 
          page: 1, 
          limit: 1 
        }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data?.properties.length).toBeLessThanOrEqual(1);
      expect(result.current.data?.page).toBe(1);
      expect(result.current.data?.totalPages).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      const errorMessage = 'API Error';
      mockApiClient.searchProperties.mockRejectedValue(new Error(errorMessage));

      const { result } = renderHook(
        () => useSemanticSearch({ 
          query: 'apartment',
          fallbackToRegularSearch: false 
        }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error?.message).toBe(errorMessage);
    });

    it('should fallback to semantic search when API fails', async () => {
      mockApiClient.searchProperties.mockRejectedValue(new Error('API Error'));

      const { result } = renderHook(
        () => useSemanticSearch({ 
          query: 'apartment',
          fallbackToRegularSearch: true 
        }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isSemanticSearch).toBe(true);
      expect(result.current.data).toBeDefined();
    });

    it('should handle empty query validation', async () => {
      const { result } = renderHook(
        () => useSemanticSearch({ query: '   ' }),
        { wrapper: createWrapper() }
      );

      expect(result.current.data).toBeUndefined();
      expect(mockApiClient.searchProperties).not.toHaveBeenCalled();
    });

    it('should not retry on validation errors', async () => {
      mockApiClient.searchProperties.mockRejectedValue(new Error('Query cannot be empty'));

      const { result } = renderHook(
        () => useSemanticSearch({ query: 'test' }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      // Should not retry validation errors
      expect(mockApiClient.searchProperties).toHaveBeenCalledTimes(1);
    });
  });

  describe('Caching', () => {
    it('should cache results for same query', async () => {
      const wrapper = createWrapper();

      // First render
      const { result: result1 } = renderHook(
        () => useSemanticSearch({ query: 'apartment' }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result1.current.isLoading).toBe(false);
      });

      // Second render with same query
      const { result: result2 } = renderHook(
        () => useSemanticSearch({ query: 'apartment' }),
        { wrapper }
      );

      // Should use cached result
      expect(result2.current.isLoading).toBe(false);
      expect(mockApiClient.searchProperties).toHaveBeenCalledTimes(1);
    });

    it('should have different cache keys for different queries', async () => {
      const wrapper = createWrapper();

      // First query
      renderHook(
        () => useSemanticSearch({ query: 'apartment' }),
        { wrapper }
      );

      await waitFor(() => {
        expect(mockApiClient.searchProperties).toHaveBeenCalledTimes(1);
      });

      // Second query
      renderHook(
        () => useSemanticSearch({ query: 'house' }),
        { wrapper }
      );

      await waitFor(() => {
        expect(mockApiClient.searchProperties).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Options', () => {
    it('should respect enabled option', () => {
      const { result } = renderHook(
        () => useSemanticSearch({ 
          query: 'apartment',
          enabled: false 
        }),
        { wrapper: createWrapper() }
      );

      expect(result.current.data).toBeUndefined();
      expect(mockApiClient.searchProperties).not.toHaveBeenCalled();
    });

    it('should use fallback when no properties returned', async () => {
      mockApiClient.searchProperties.mockResolvedValue({
        properties: [],
        total: 0,
        page: 1,
        totalPages: 0
      });

      const { result } = renderHook(
        () => useSemanticSearch({ 
          query: 'apartment',
          fallbackToRegularSearch: true 
        }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toBeDefined();
      expect(result.current.isSemanticSearch).toBe(false);
    });
  });
});

describe('useSemanticSearchSuggestions', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should generate suggestions for query', () => {
    const { result } = renderHook(
      () => useSemanticSearchSuggestions({ query: 'apart' })
    );

    expect(result.current.suggestions).toBeDefined();
    expect(Array.isArray(result.current.suggestions)).toBe(true);
  });

  it('should debounce query changes', () => {
    const { result, rerender } = renderHook(
      ({ query }) => useSemanticSearchSuggestions({ query }),
      { initialProps: { query: 'a' } }
    );

    expect(result.current.isLoading).toBe(true);

    // Change query quickly
    rerender({ query: 'ap' });
    rerender({ query: 'apa' });
    rerender({ query: 'apar' });

    expect(result.current.isLoading).toBe(true);

    // Fast forward debounce time
    vi.advanceTimersByTime(300);

    expect(result.current.isLoading).toBe(false);
    expect(result.current.query).toBe('apar');
  });

  it('should provide analysis with suggestions', () => {
    const { result } = renderHook(
      () => useSemanticSearchSuggestions({ query: '2 bedroom apartment' })
    );

    vi.advanceTimersByTime(300);

    expect(result.current.analysis).toBeDefined();
    expect(result.current.analysis?.extractedFilters.bedrooms).toBe(2);
  });

  it('should respect enabled option', () => {
    const { result } = renderHook(
      () => useSemanticSearchSuggestions({ 
        query: 'apartment',
        enabled: false 
      })
    );

    expect(result.current.suggestions).toEqual([]);
    expect(result.current.analysis).toBeNull();
  });
});

describe('useQueryAnalysis', () => {
  it('should analyze query and return semantic information', () => {
    const { result } = renderHook(
      () => useQueryAnalysis('2 bedroom apartment in london £300k-£500k')
    );

    expect(result.current).toBeDefined();
    expect(result.current?.extractedFilters.bedrooms).toBe(2);
    expect(result.current?.extractedFilters.location).toBe('london');
    expect(result.current?.extractedFilters.minPrice).toBe(300000);
    expect(result.current?.extractedFilters.maxPrice).toBe(500000);
  });

  it('should return null for empty query', () => {
    const { result } = renderHook(
      () => useQueryAnalysis('')
    );

    expect(result.current).toBeNull();
  });

  it('should update analysis when query changes', () => {
    const { result, rerender } = renderHook(
      ({ query }) => useQueryAnalysis(query),
      { initialProps: { query: '2 bedroom apartment' } }
    );

    expect(result.current?.extractedFilters.bedrooms).toBe(2);

    rerender({ query: '3 bedroom house' });

    expect(result.current?.extractedFilters.bedrooms).toBe(3);
    expect(result.current?.extractedFilters.propertyType).toBe('house');
  });
});

describe('usePropertyEnhancement', () => {
  it('should enhance properties with relevance scores', () => {
    const { result } = renderHook(
      () => usePropertyEnhancement(mockProperties, 'luxury apartment in london')
    );

    expect(result.current.enhancedProperties[0].relevanceScore).toBeGreaterThan(0);
    expect(result.current.analysis).toBeDefined();
  });

  it('should return properties with zero relevance when disabled', () => {
    const { result } = renderHook(
      () => usePropertyEnhancement(mockProperties, 'apartment', false)
    );

    result.current.enhancedProperties.forEach(property => {
      expect(property.relevanceScore).toBe(0);
    });
    expect(result.current.analysis).toBeNull();
  });

  it('should handle empty properties array', () => {
    const { result } = renderHook(
      () => usePropertyEnhancement([], 'apartment')
    );

    expect(result.current.enhancedProperties).toEqual([]);
    expect(result.current.analysis).toBeDefined();
  });

  it('should update when properties or query change', () => {
    const { result, rerender } = renderHook(
      ({ properties, query }) => usePropertyEnhancement(properties, query),
      { 
        initialProps: { 
          properties: [mockProperties[0]], 
          query: 'apartment' 
        } 
      }
    );

    const initialScore = result.current.enhancedProperties[0].relevanceScore;

    rerender({ 
      properties: [mockProperties[0]], 
      query: 'luxury apartment in london' 
    });

    const newScore = result.current.enhancedProperties[0].relevanceScore;
    expect(newScore).toBeGreaterThan(initialScore || 0);
  });
});

describe('useSemanticSearchStats', () => {
  const mockSearchResults = {
    properties: [
      {
        ...mockProperties[0],
        relevanceScore: 85,
        matchReasons: ['Perfect location', 'Within budget']
      },
      {
        ...mockProperties[1],
        relevanceScore: 65,
        matchReasons: ['Good size', 'Within budget']
      }
    ],
    total: 2,
    page: 1,
    totalPages: 1,
    filters: {},
    searchTime: 150,
    averageRelevance: 75,
    semanticAnalysis: {
      intent: 'Test search',
      extractedFilters: {},
      suggestions: [],
      confidence: 80,
      keywords: [],
      sentiment: 'neutral' as const
    }
  };

  it('should calculate statistics correctly', () => {
    const { result } = renderHook(
      () => useSemanticSearchStats(mockSearchResults)
    );

    expect(result.current.totalProperties).toBe(2);
    expect(result.current.averageRelevance).toBe(75);
    expect(result.current.highRelevanceCount).toBe(1); // Only one property > 70
    expect(result.current.searchTime).toBe(150);
    expect(result.current.hasSemanticAnalysis).toBe(true);
    expect(result.current.topMatchReasons).toContain('Within budget');
  });

  it('should handle undefined search results', () => {
    const { result } = renderHook(
      () => useSemanticSearchStats(undefined)
    );

    expect(result.current.totalProperties).toBe(0);
    expect(result.current.averageRelevance).toBe(0);
    expect(result.current.highRelevanceCount).toBe(0);
    expect(result.current.searchTime).toBe(0);
    expect(result.current.hasSemanticAnalysis).toBe(false);
    expect(result.current.topMatchReasons).toEqual([]);
  });

  it('should sort match reasons by frequency', () => {
    const resultsWithRepeatedReasons = {
      ...mockSearchResults,
      properties: [
        {
          ...mockProperties[0],
          relevanceScore: 85,
          matchReasons: ['Within budget', 'Perfect location']
        },
        {
          ...mockProperties[1],
          relevanceScore: 75,
          matchReasons: ['Within budget', 'Good size']
        }
      ]
    };

    const { result } = renderHook(
      () => useSemanticSearchStats(resultsWithRepeatedReasons)
    );

    expect(result.current.topMatchReasons[0]).toBe('Within budget');
  });
});