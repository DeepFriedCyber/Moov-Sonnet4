// React Query hooks for API integration
'use client';

import React, { createContext, useContext, ReactNode } from 'react';
import {
  useQuery,
  useMutation,
  useQueryClient,
  UseQueryOptions,
  UseMutationOptions
} from '@tanstack/react-query';
import { ApiClient, ApiError, PropertySearchResult, SearchOptions } from '@/lib/api-client';
import { useAuthenticatedApiClient } from './useAuth';
import { Property } from '@/types';

// Types
type PropertyCreateData = Omit<Property, 'id' | 'createdAt' | 'updatedAt'>;
type PropertyUpdateData = Partial<Omit<Property, 'id' | 'createdAt' | 'updatedAt'>>;

interface ApiContextValue {
  client: ApiClient;
}

// Context
const ApiContext = createContext<ApiContextValue | null>(null);

// Provider
interface ApiProviderProps {
  client: ApiClient;
  children: ReactNode;
}

export const ApiProvider = ({ client, children }: ApiProviderProps) => {
  const value: ApiContextValue = { client };

  return (
    <ApiContext.Provider value={value}>
      {children}
    </ApiContext.Provider>
  );
};

// Hook to access API client
const useApiClient = (): ApiClient => {
  const context = useContext(ApiContext);
  if (!context) {
    throw new Error('useApiClient must be used within ApiProvider');
  }
  return context.client;
};

// Enhanced hook that prefers authenticated client when available
export const useApiClientEnhanced = (): ApiClient => {
  const authenticatedClient = useAuthenticatedApiClient();
  const context = useContext(ApiContext);

  // Prefer authenticated client if available, fallback to context client
  if (authenticatedClient) {
    return authenticatedClient;
  }

  if (!context) {
    throw new Error('useApiClientEnhanced must be used within ApiProvider or with authentication');
  }

  return context.client;
};

// Query key factory
export const propertyKeys = {
  all: ['properties'] as const,
  lists: () => [...propertyKeys.all, 'list'] as const,
  list: (filters: Record<string, unknown>) => [...propertyKeys.lists(), filters] as const,
  details: () => [...propertyKeys.all, 'detail'] as const,
  detail: (id: string) => [...propertyKeys.details(), id] as const,
  search: (params: SearchOptions) => [...propertyKeys.all, 'search', params] as const,
};

// Search Hook
interface UsePropertySearchOptions extends Omit<SearchOptions, 'query'> {
  query: string;
  enabled?: boolean;
}

export const usePropertySearch = (
  options: UsePropertySearchOptions,
  queryOptions?: Omit<
    UseQueryOptions<PropertySearchResult, ApiError>,
    'queryKey' | 'queryFn' | 'enabled'
  >
) => {
  const client = useApiClient();
  const { enabled = true, query, ...searchOptions } = options;

  const searchParams: SearchOptions = { query, ...searchOptions };

  return useQuery<PropertySearchResult, ApiError>({
    queryKey: propertyKeys.search(searchParams),
    queryFn: () => client.searchProperties(searchParams),
    enabled: enabled && query.length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (was cacheTime in v4)
    ...queryOptions,
  });
};

// Get Property Hook
export const useProperty = (
  id: string | null,
  queryOptions?: Omit<
    UseQueryOptions<Property, ApiError>,
    'queryKey' | 'queryFn' | 'enabled'
  >
) => {
  const client = useApiClient();

  return useQuery<Property, ApiError>({
    queryKey: id ? propertyKeys.detail(id) : [],
    queryFn: () => {
      if (!id) throw new Error('Property ID is required');
      return client.getProperty(id);
    },
    enabled: !!id,
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    ...queryOptions,
  });
};

// Create Property Hook
export const useCreateProperty = (
  mutationOptions?: UseMutationOptions<Property, ApiError, PropertyCreateData>
) => {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation<Property, ApiError, PropertyCreateData>({
    mutationFn: (data) => client.createProperty(data),
    onSuccess: (data) => {
      // Invalidate property lists to refetch data
      queryClient.invalidateQueries({ queryKey: propertyKeys.lists() });
      // Optionally set the new property in cache
      queryClient.setQueryData(propertyKeys.detail(data.id), data);
    },
    ...mutationOptions,
  });
};

// Update Property Hook
export const useUpdateProperty = (
  mutationOptions?: UseMutationOptions<Property, ApiError, { id: string; data: PropertyUpdateData }>
) => {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation<Property, ApiError, { id: string; data: PropertyUpdateData }>({
    mutationFn: ({ id, data }) => client.updateProperty(id, data),
    onSuccess: (data, variables) => {
      // Update the property in cache
      queryClient.setQueryData(propertyKeys.detail(variables.id), data);
      // Invalidate property lists
      queryClient.invalidateQueries({ queryKey: propertyKeys.lists() });
    },
    ...mutationOptions,
  });
};

// Delete Property Hook
export const useDeleteProperty = (
  mutationOptions?: UseMutationOptions<void, ApiError, string>
) => {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation<void, ApiError, string>({
    mutationFn: (id) => client.deleteProperty(id),
    onSuccess: (_, id) => {
      // Remove property from cache
      queryClient.removeQueries({ queryKey: propertyKeys.detail(id) });
      // Invalidate property lists
      queryClient.invalidateQueries({ queryKey: propertyKeys.lists() });
    },
    ...mutationOptions,
  });
};

// Utility hook for prefetching
export const usePrefetchProperty = () => {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return (id: string) => {
    return queryClient.prefetchQuery({
      queryKey: propertyKeys.detail(id),
      queryFn: () => client.getProperty(id),
      staleTime: 10 * 60 * 1000,
    });
  };
};

// Health check hook
export const useHealthCheck = (
  queryOptions?: Omit<
    UseQueryOptions<{ status: string; timestamp: string }, ApiError>,
    'queryKey' | 'queryFn'
  >
) => {
  const client = useApiClient();

  return useQuery<{ status: string; timestamp: string }, ApiError>({
    queryKey: ['health_check'],
    queryFn: () => client.healthCheck(),
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 60 * 1000, // 1 minute
    refetchInterval: 30 * 1000, // Refetch every 30 seconds
    ...queryOptions,
  });
};

// Export the API client hook for direct access if needed
export { useApiClient };