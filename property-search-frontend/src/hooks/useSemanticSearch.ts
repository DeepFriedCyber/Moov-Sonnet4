// TDD-Enhanced Semantic Search Hook
import { useState, useCallback, useMemo } from 'react';
import { useQuery, UseQueryOptions } from '@tanstack/react-query';
import { useApiClient } from './useApi';
import { SemanticSearchService, SearchResults, SemanticAnalysis } from '@/services/semanticSearchService';
import { Property } from '@/types';

export interface UseSemanticSearchOptions {
  query: string;
  page?: number;
  limit?: number;
  enabled?: boolean;
  fallbackToRegularSearch?: boolean;
}

export interface UseSemanticSearchResult {
  data: SearchResults | undefined;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
  analysis: SemanticAnalysis | undefined;
  suggestions: string[];
  isSemanticSearch: boolean;
}

export interface UseSemanticSearchSuggestionsOptions {
  query: string;
  debounceMs?: number;
  enabled?: boolean;
}

/**
 * Enhanced hook for semantic property search with TDD patterns
 */
export const useSemanticSearch = (
  options: UseSemanticSearchOptions,
  queryOptions?: Omit<UseQueryOptions<SearchResults, Error>, 'queryKey' | 'queryFn' | 'enabled'>
): UseSemanticSearchResult => {
  const { 
    query, 
    page = 1, 
    limit = 12, 
    enabled = true, 
    fallbackToRegularSearch = true 
  } = options;

  const apiClient = useApiClient();
  const semanticService = useMemo(() => new SemanticSearchService(), []);
  
  const [analysis, setAnalysis] = useState<SemanticAnalysis | undefined>();
  const [isSemanticSearch, setIsSemanticSearch] = useState(false);

  // Query key for caching
  const queryKey = useMemo(() => [
    'semantic-search',
    query,
    page,
    limit
  ], [query, page, limit]);

  // Main search function
  const searchFunction = useCallback(async (): Promise<SearchResults> => {
    if (!query.trim()) {
      throw new Error('Query cannot be empty');
    }

    try {
      // First, try to get properties from the API
      const apiSearchResult = await apiClient.searchProperties({
        query,
        pagination: { page, limit }
      });

      // Analyze the query for semantic understanding
      const semanticAnalysis = semanticService.analyzeQuery(query);
      setAnalysis(semanticAnalysis);

      // If we have properties from API, enhance them with semantic scoring
      if (apiSearchResult.properties && apiSearchResult.properties.length > 0) {
        setIsSemanticSearch(true);
        
        // Enhance properties with semantic analysis
        const enhancedProperties = semanticService.enhanceProperties(
          apiSearchResult.properties,
          query,
          semanticAnalysis
        );

        // Calculate new totals based on enhanced results
        const total = enhancedProperties.length;
        const totalPages = Math.ceil(total / limit);
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        const paginatedProperties = enhancedProperties.slice(startIndex, endIndex);

        const averageRelevance = paginatedProperties.reduce(
          (sum, p) => sum + (p.relevanceScore || 0), 0
        ) / paginatedProperties.length || 0;

        return {
          properties: paginatedProperties,
          total,
          page,
          totalPages,
          filters: semanticAnalysis.extractedFilters,
          searchTime: 0, // Will be calculated by the service
          averageRelevance: Math.round(averageRelevance),
          semanticAnalysis
        };
      } else if (fallbackToRegularSearch) {
        // Fallback to regular API search if no semantic enhancement possible
        setIsSemanticSearch(false);
        return {
          properties: apiSearchResult.properties || [],
          total: apiSearchResult.total || 0,
          page: apiSearchResult.page || page,
          totalPages: apiSearchResult.totalPages || 0,
          filters: semanticAnalysis.extractedFilters,
          searchTime: 0,
          averageRelevance: 0,
          semanticAnalysis
        };
      } else {
        throw new Error('No properties found and fallback disabled');
      }
    } catch (error) {
      // If API fails and fallback is enabled, try semantic search with mock data
      if (fallbackToRegularSearch && error instanceof Error) {
        console.warn('API search failed, falling back to semantic search:', error.message);
        
        // In a real implementation, you might have cached properties or a fallback dataset
        const fallbackProperties: Property[] = [];
        const semanticAnalysis = semanticService.analyzeQuery(query);
        setAnalysis(semanticAnalysis);
        setIsSemanticSearch(true);

        return await semanticService.performSemanticSearch(
          fallbackProperties,
          query,
          page,
          limit
        );
      }
      
      throw error;
    }
  }, [query, page, limit, apiClient, semanticService, fallbackToRegularSearch]);

  // Use React Query for caching and state management
  const queryResult = useQuery<SearchResults, Error>({
    queryKey,
    queryFn: searchFunction,
    enabled: enabled && query.trim().length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: (failureCount, error) => {
      // Don't retry if it's a validation error
      if (error.message.includes('empty') || error.message.includes('invalid')) {
        return false;
      }
      return failureCount < 2;
    },
    ...queryOptions,
  });

  // Generate suggestions based on current query
  const suggestions = useMemo(() => {
    if (!query.trim()) return [];
    return semanticService.generateSuggestions(query);
  }, [query, semanticService]);

  return {
    data: queryResult.data,
    isLoading: queryResult.isLoading,
    isError: queryResult.isError,
    error: queryResult.error,
    refetch: queryResult.refetch,
    analysis,
    suggestions,
    isSemanticSearch
  };
};

/**
 * Hook for generating search suggestions with debouncing
 */
export const useSemanticSearchSuggestions = (
  options: UseSemanticSearchSuggestionsOptions
) => {
  const { query, debounceMs = 300, enabled = true } = options;
  const [debouncedQuery, setDebouncedQuery] = useState(query);
  const semanticService = useMemo(() => new SemanticSearchService(), []);

  // Debounce the query
  useState(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, debounceMs);

    return () => clearTimeout(timer);
  });

  // Generate suggestions
  const suggestions = useMemo(() => {
    if (!enabled || !debouncedQuery.trim()) return [];
    return semanticService.generateSuggestions(debouncedQuery);
  }, [debouncedQuery, enabled, semanticService]);

  // Analyze query for additional context
  const analysis = useMemo(() => {
    if (!enabled || !debouncedQuery.trim()) return null;
    return semanticService.analyzeQuery(debouncedQuery);
  }, [debouncedQuery, enabled, semanticService]);

  return {
    suggestions,
    analysis,
    isLoading: query !== debouncedQuery,
    query: debouncedQuery
  };
};

/**
 * Hook for analyzing search queries without performing search
 */
export const useQueryAnalysis = (query: string) => {
  const semanticService = useMemo(() => new SemanticSearchService(), []);

  const analysis = useMemo(() => {
    if (!query.trim()) return null;
    return semanticService.analyzeQuery(query);
  }, [query, semanticService]);

  return analysis;
};

/**
 * Hook for enhancing existing properties with semantic scoring
 */
export const usePropertyEnhancement = (
  properties: Property[],
  query: string,
  enabled: boolean = true
) => {
  const semanticService = useMemo(() => new SemanticSearchService(), []);

  const enhancedProperties = useMemo(() => {
    if (!enabled || !query.trim() || !properties.length) {
      return properties.map(p => ({ ...p, relevanceScore: 0 }));
    }

    const analysis = semanticService.analyzeQuery(query);
    return semanticService.enhanceProperties(properties, query, analysis);
  }, [properties, query, enabled, semanticService]);

  const analysis = useMemo(() => {
    if (!enabled || !query.trim()) return null;
    return semanticService.analyzeQuery(query);
  }, [query, enabled, semanticService]);

  return {
    enhancedProperties,
    analysis
  };
};

/**
 * Utility hook for semantic search statistics
 */
export const useSemanticSearchStats = (searchResults: SearchResults | undefined) => {
  return useMemo(() => {
    if (!searchResults) {
      return {
        totalProperties: 0,
        averageRelevance: 0,
        highRelevanceCount: 0,
        searchTime: 0,
        hasSemanticAnalysis: false,
        topMatchReasons: []
      };
    }

    const highRelevanceCount = searchResults.properties.filter(
      p => (p.relevanceScore || 0) > 70
    ).length;

    const topMatchReasons = searchResults.properties
      .flatMap(p => p.matchReasons || [])
      .reduce((acc, reason) => {
        acc[reason] = (acc[reason] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

    const sortedReasons = Object.entries(topMatchReasons)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([reason]) => reason);

    return {
      totalProperties: searchResults.total,
      averageRelevance: searchResults.averageRelevance,
      highRelevanceCount,
      searchTime: searchResults.searchTime,
      hasSemanticAnalysis: !!searchResults.semanticAnalysis,
      topMatchReasons: sortedReasons
    };
  }, [searchResults]);
};

// Export types for external use
export type {
  UseSemanticSearchOptions,
  UseSemanticSearchResult,
  UseSemanticSearchSuggestionsOptions
};