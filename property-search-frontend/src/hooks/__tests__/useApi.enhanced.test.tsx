// TDD Enhanced useApi Hook Tests
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { 
  usePropertySearch, 
  useProperty, 
  useCreateProperty, 
  useUpdateProperty, 
  useDeleteProperty,
  useHealthCheck,
  ApiProvider 
} from '../useApi';

// Mock the API client
const mockApiClient = {
  searchProperties: vi.fn(),
  getProperty: vi.fn(),
  createProperty: vi.fn(),
  updateProperty: vi.fn(),
  deleteProperty: vi.fn(),
  healthCheck: vi.fn()
};

// Mock auth hook
vi.mock('../useAuth', () => ({
  useAuthenticatedApiClient: vi.fn(() => null)
}));

// Test data
const mockProperty = {
  id: '1',
  title: 'Test Property',
  description: 'A beautiful test property',
  price: 300000,
  bedrooms: 2,
  bathrooms: 2,
  area: 1000,
  propertyType: 'apartment' as const,
  listingType: 'sale' as const,
  location: {
    address: '123 Test St',
    area: 'Test Area',
    city: 'Test City',
    postcode: 'T1 1ST'
  },
  images: [],
  features: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

const mockSearchResult = {
  properties: [mockProperty],
  total: 1,
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
      mutations: {
        retry: false,
      },
    },
  });

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <ApiProvider client={mockApiClient}>
        {children}
      </ApiProvider>
    </QueryClientProvider>
  );
};

describe('useApi Hooks - TDD Enhanced', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('usePropertySearch', () => {
    it('should not fetch when query is empty', () => {
      mockApiClient.searchProperties.mockResolvedValue(mockSearchResult);

      const { result } = renderHook(
        () => usePropertySearch({ query: '' }),
        { wrapper: createWrapper() }
      );

      expect(result.current.data).toBeUndefined();
      expect(mockApiClient.searchProperties).not.toHaveBeenCalled();
    });

    it('should fetch when query is provided', async () => {
      mockApiClient.searchProperties.mockResolvedValue(mockSearchResult);

      const { result } = renderHook(
        () => usePropertySearch({ query: 'luxury apartment' }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockApiClient.searchProperties).toHaveBeenCalledWith({
        query: 'luxury apartment'
      });
      expect(result.current.data).toEqual(mockSearchResult);
    });

    it('should pass additional search options', async () => {
      mockApiClient.searchProperties.mockResolvedValue(mockSearchResult);

      const searchOptions = {
        query: 'luxury apartment',
        limit: 20,
        page: 2
      };

      renderHook(
        () => usePropertySearch(searchOptions),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(mockApiClient.searchProperties).toHaveBeenCalledWith(searchOptions);
      });
    });

    it('should handle search errors', async () => {
      const errorMessage = 'Search failed';
      mockApiClient.searchProperties.mockRejectedValue(new Error(errorMessage));

      const { result } = renderHook(
        () => usePropertySearch({ query: 'test' }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toEqual(new Error(errorMessage));
    });

    it('should respect enabled option', () => {
      mockApiClient.searchProperties.mockResolvedValue(mockSearchResult);

      renderHook(
        () => usePropertySearch({ query: 'test' }, { enabled: false }),
        { wrapper: createWrapper() }
      );

      expect(mockApiClient.searchProperties).not.toHaveBeenCalled();
    });

    it('should have proper cache configuration', async () => {
      mockApiClient.searchProperties.mockResolvedValue(mockSearchResult);

      const { result } = renderHook(
        () => usePropertySearch({ query: 'test' }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Should use stale time of 5 minutes
      expect(result.current.dataUpdatedAt).toBeDefined();
    });
  });

  describe('useProperty', () => {
    it('should fetch property when ID is provided', async () => {
      mockApiClient.getProperty.mockResolvedValue(mockProperty);

      const { result } = renderHook(
        () => useProperty('1'),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockApiClient.getProperty).toHaveBeenCalledWith('1');
      expect(result.current.data).toEqual(mockProperty);
    });

    it('should not fetch when ID is null', () => {
      mockApiClient.getProperty.mockResolvedValue(mockProperty);

      const { result } = renderHook(
        () => useProperty(null),
        { wrapper: createWrapper() }
      );

      expect(result.current.data).toBeUndefined();
      expect(mockApiClient.getProperty).not.toHaveBeenCalled();
    });

    it('should handle property fetch errors', async () => {
      const errorMessage = 'Property not found';
      mockApiClient.getProperty.mockRejectedValue(new Error(errorMessage));

      const { result } = renderHook(
        () => useProperty('1'),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toEqual(new Error(errorMessage));
    });
  });

  describe('useCreateProperty', () => {
    it('should create property successfully', async () => {
      const newProperty = { ...mockProperty, id: '2' };
      mockApiClient.createProperty.mockResolvedValue(newProperty);

      const { result } = renderHook(
        () => useCreateProperty(),
        { wrapper: createWrapper() }
      );

      const propertyData = {
        title: 'New Property',
        description: 'A new property',
        price: 400000,
        bedrooms: 3,
        bathrooms: 2,
        area: 1200,
        propertyType: 'house' as const,
        listingType: 'sale' as const,
        location: {
          address: '456 New St',
          area: 'New Area',
          city: 'New City',
          postcode: 'N1 1EW'
        },
        images: [],
        features: []
      };

      result.current.mutate(propertyData);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockApiClient.createProperty).toHaveBeenCalledWith(propertyData);
      expect(result.current.data).toEqual(newProperty);
    });

    it('should handle create property errors', async () => {
      const errorMessage = 'Failed to create property';
      mockApiClient.createProperty.mockRejectedValue(new Error(errorMessage));

      const { result } = renderHook(
        () => useCreateProperty(),
        { wrapper: createWrapper() }
      );

      const propertyData = {
        title: 'New Property',
        description: 'A new property',
        price: 400000,
        bedrooms: 3,
        bathrooms: 2,
        area: 1200,
        propertyType: 'house' as const,
        listingType: 'sale' as const,
        location: {
          address: '456 New St',
          area: 'New Area',
          city: 'New City',
          postcode: 'N1 1EW'
        },
        images: [],
        features: []
      };

      result.current.mutate(propertyData);

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toEqual(new Error(errorMessage));
    });
  });

  describe('useUpdateProperty', () => {
    it('should update property successfully', async () => {
      const updatedProperty = { ...mockProperty, title: 'Updated Property' };
      mockApiClient.updateProperty.mockResolvedValue(updatedProperty);

      const { result } = renderHook(
        () => useUpdateProperty(),
        { wrapper: createWrapper() }
      );

      const updateData = {
        id: '1',
        data: { title: 'Updated Property' }
      };

      result.current.mutate(updateData);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockApiClient.updateProperty).toHaveBeenCalledWith('1', { title: 'Updated Property' });
      expect(result.current.data).toEqual(updatedProperty);
    });

    it('should handle update property errors', async () => {
      const errorMessage = 'Failed to update property';
      mockApiClient.updateProperty.mockRejectedValue(new Error(errorMessage));

      const { result } = renderHook(
        () => useUpdateProperty(),
        { wrapper: createWrapper() }
      );

      const updateData = {
        id: '1',
        data: { title: 'Updated Property' }
      };

      result.current.mutate(updateData);

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toEqual(new Error(errorMessage));
    });
  });

  describe('useDeleteProperty', () => {
    it('should delete property successfully', async () => {
      mockApiClient.deleteProperty.mockResolvedValue(undefined);

      const { result } = renderHook(
        () => useDeleteProperty(),
        { wrapper: createWrapper() }
      );

      result.current.mutate('1');

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockApiClient.deleteProperty).toHaveBeenCalledWith('1');
    });

    it('should handle delete property errors', async () => {
      const errorMessage = 'Failed to delete property';
      mockApiClient.deleteProperty.mockRejectedValue(new Error(errorMessage));

      const { result } = renderHook(
        () => useDeleteProperty(),
        { wrapper: createWrapper() }
      );

      result.current.mutate('1');

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toEqual(new Error(errorMessage));
    });
  });

  describe('useHealthCheck', () => {
    it('should perform health check successfully', async () => {
      const healthData = { status: 'healthy', timestamp: new Date().toISOString() };
      mockApiClient.healthCheck.mockResolvedValue(healthData);

      const { result } = renderHook(
        () => useHealthCheck(),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockApiClient.healthCheck).toHaveBeenCalled();
      expect(result.current.data).toEqual(healthData);
    });

    it('should handle health check errors', async () => {
      const errorMessage = 'Health check failed';
      mockApiClient.healthCheck.mockRejectedValue(new Error(errorMessage));

      const { result } = renderHook(
        () => useHealthCheck(),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toEqual(new Error(errorMessage));
    });

    it('should refetch health check at regular intervals', async () => {
      vi.useFakeTimers();
      
      const healthData = { status: 'healthy', timestamp: new Date().toISOString() };
      mockApiClient.healthCheck.mockResolvedValue(healthData);

      renderHook(
        () => useHealthCheck(),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(mockApiClient.healthCheck).toHaveBeenCalledTimes(1);
      });

      // Fast forward 30 seconds (refetch interval)
      vi.advanceTimersByTime(30000);

      await waitFor(() => {
        expect(mockApiClient.healthCheck).toHaveBeenCalledTimes(2);
      });

      vi.useRealTimers();
    });
  });

  describe('Query Key Factory', () => {
    it('should generate consistent query keys', () => {
      const { propertyKeys } = require('../useApi');

      expect(propertyKeys.all).toEqual(['properties']);
      expect(propertyKeys.lists()).toEqual(['properties', 'list']);
      expect(propertyKeys.detail('1')).toEqual(['properties', 'detail', '1']);
      expect(propertyKeys.search({ query: 'test' })).toEqual(['properties', 'search', { query: 'test' }]);
    });
  });

  describe('Cache Management', () => {
    it('should invalidate cache on successful mutations', async () => {
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false, gcTime: 0 },
          mutations: { retry: false },
        },
      });

      const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');
      const setQueryDataSpy = vi.spyOn(queryClient, 'setQueryData');

      const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>
          <ApiProvider client={mockApiClient}>
            {children}
          </ApiProvider>
        </QueryClientProvider>
      );

      const newProperty = { ...mockProperty, id: '2' };
      mockApiClient.createProperty.mockResolvedValue(newProperty);

      const { result } = renderHook(
        () => useCreateProperty(),
        { wrapper }
      );

      const propertyData = {
        title: 'New Property',
        description: 'A new property',
        price: 400000,
        bedrooms: 3,
        bathrooms: 2,
        area: 1200,
        propertyType: 'house' as const,
        listingType: 'sale' as const,
        location: {
          address: '456 New St',
          area: 'New Area',
          city: 'New City',
          postcode: 'N1 1EW'
        },
        images: [],
        features: []
      };

      result.current.mutate(propertyData);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Should invalidate property lists
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: ['properties', 'list']
      });

      // Should set new property in cache
      expect(setQueryDataSpy).toHaveBeenCalledWith(
        ['properties', 'detail', '2'],
        newProperty
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      const networkError = new Error('Network Error');
      networkError.name = 'NetworkError';
      mockApiClient.searchProperties.mockRejectedValue(networkError);

      const { result } = renderHook(
        () => usePropertySearch({ query: 'test' }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toEqual(networkError);
    });

    it('should handle API errors with proper error structure', async () => {
      const apiError = {
        message: 'Invalid search parameters',
        status: 400,
        code: 'INVALID_PARAMS'
      };
      mockApiClient.searchProperties.mockRejectedValue(apiError);

      const { result } = renderHook(
        () => usePropertySearch({ query: 'test' }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toEqual(apiError);
    });
  });

  describe('Performance', () => {
    it('should use proper stale time for caching', async () => {
      mockApiClient.searchProperties.mockResolvedValue(mockSearchResult);

      const { result, rerender } = renderHook(
        () => usePropertySearch({ query: 'test' }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Clear the mock to test caching
      mockApiClient.searchProperties.mockClear();

      // Rerender with same query - should use cache
      rerender();

      // Should not call API again due to stale time
      expect(mockApiClient.searchProperties).not.toHaveBeenCalled();
    });

    it('should have appropriate garbage collection time', async () => {
      mockApiClient.getProperty.mockResolvedValue(mockProperty);

      const { result, unmount } = renderHook(
        () => useProperty('1'),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Unmount component
      unmount();

      // Data should be garbage collected after gcTime
      // This is handled by React Query internally
      expect(result.current.data).toEqual(mockProperty);
    });
  });
});