// TDD-Enhanced Property Search Hook
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';
import { SemanticSearchService } from '@/services/semanticSearchService';
import { Property } from '@/types';

// Enhanced search parameters
export interface EnhancedSearchParams {
    query: string;
    filters?: {
        bedrooms?: number;
        bathrooms?: number;
        minPrice?: number;
        maxPrice?: number;
        propertyType?: Property['propertyType'];
        location?: string;
        features?: string[];
    };
    page?: number;
    limit?: number;
    enableSemanticSearch?: boolean;
    includeSuggestions?: boolean;
    saveSearch?: boolean;
    createAlert?: boolean;
    debounceMs?: number;
    enabled?: boolean;
}

// Enhanced property with semantic data
export interface EnhancedProperty extends Property {
    relevanceScore?: number;
    matchReasons?: string[];
    matchKeywords?: string[];
    semanticScore?: number;
}

// Search result with enhancements
export interface EnhancedSearchResult {
    properties: EnhancedProperty[];
    total: number;
    page: number;
    totalPages: number;
    searchTime?: number;
    suggestions?: string[];
    analysis?: {
        intent: string;
        extractedFilters: Record<string, any>;
        confidence: number;
        suggestions: string[];
    };
}

// Search statistics
export interface SearchStats {
    searchTime?: number;
    totalResults?: number;
    cacheHit?: boolean;
    isSemanticSearch: boolean;
    averageRelevance?: number;
    highRelevanceCount?: number;
}

// Hook return type
export interface UsePropertySearchEnhancedResult {
    data?: EnhancedSearchResult;
    isLoading: boolean;
    isError: boolean;
    isSuccess: boolean;
    isIdle: boolean;
    error: Error | null;
    refetch: () => void;
    analysis: EnhancedSearchResult['analysis'] | null;
    suggestions: string[];
    isSemanticSearch: boolean;
    searchStats?: SearchStats;
}

// Create semantic search service instance
const semanticSearchService = new SemanticSearchService();

/**
 * Enhanced property search hook with TDD patterns
 */
export function usePropertySearchEnhanced(
    params: EnhancedSearchParams
): UsePropertySearchEnhancedResult {
    const queryClient = useQueryClient();

    const {
        query,
        filters = {},
        page = 1,
        limit = 12,
        enableSemanticSearch = false,
        includeSuggestions = false,
        saveSearch = false,
        createAlert = false,
        debounceMs = 300,
        enabled = true
    } = params;

    // Generate query key for caching
    const queryKey = useMemo(() => [
        'property-search-enhanced',
        query,
        filters,
        page,
        limit,
        enableSemanticSearch,
        includeSuggestions
    ], [query, filters, page, limit, enableSemanticSearch, includeSuggestions]);

    // Semantic analysis (computed when semantic search is enabled)
    const analysis = useMemo(() => {
        if (!enableSemanticSearch || !query.trim()) return null;
        return semanticSearchService.analyzeQuery(query);
    }, [query, enableSemanticSearch]);

    // Search function
    const searchFunction = useCallback(async (): Promise<EnhancedSearchResult> => {
        if (!query.trim()) {
            throw new Error('Query cannot be empty');
        }

        // Prepare search parameters
        const searchParams = {
            query: query.trim(),
            page,
            limit,
            ...filters
        };

        // Add semantic filters if available
        if (enableSemanticSearch && analysis?.extractedFilters) {
            Object.assign(searchParams, analysis.extractedFilters);
        }

        // Perform the search
        const startTime = Date.now();
        const response = await apiClient.get('/properties/search', {
            params: searchParams
        });
        const searchTime = Date.now() - startTime;

        // Enhance properties with semantic data if enabled
        let enhancedProperties = response.properties;
        if (enableSemanticSearch && query.trim()) {
            enhancedProperties = semanticSearchService.enhanceProperties(
                response.properties,
                query
            );
        }

        // Build enhanced result
        const result: EnhancedSearchResult = {
            ...response,
            properties: enhancedProperties,
            searchTime,
            analysis: enableSemanticSearch ? analysis : undefined
        };

        // Add suggestions if requested
        if (includeSuggestions) {
            result.suggestions = semanticSearchService.generateSuggestions(query);
        }

        return result;
    }, [query, filters, page, limit, enableSemanticSearch, includeSuggestions, analysis]);

    // Main search query
    const searchQuery = useQuery({
        queryKey,
        queryFn: searchFunction,
        enabled: enabled && query.trim().length > 0,
        staleTime: 5 * 60 * 1000, // 5 minutes
        gcTime: 10 * 60 * 1000, // 10 minutes
        retry: (failureCount, error) => {
            // Don't retry validation errors
            if (error instanceof Error && error.message.includes('validation')) {
                return false;
            }
            return failureCount < 3;
        }
    });

    // Save search mutation
    const saveSearchMutation = useMutation({
        mutationFn: async (searchData: any) => {
            return apiClient.post('/searches/save', searchData);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['saved-searches'] });
        }
    });

    // Create alert mutation
    const createAlertMutation = useMutation({
        mutationFn: async (alertData: any) => {
            return apiClient.post('/alerts/create', alertData);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['search-alerts'] });
        }
    });

    // Auto-save search if requested and successful
    if (saveSearch && searchQuery.isSuccess && searchQuery.data) {
        saveSearchMutation.mutate({
            query,
            filters,
            timestamp: new Date().toISOString()
        });
    }

    // Auto-create alert if requested and successful
    if (createAlert && searchQuery.isSuccess && searchQuery.data) {
        createAlertMutation.mutate({
            query,
            filters,
            enabled: true,
            frequency: 'daily'
        });
    }

    // Compute search statistics
    const searchStats = useMemo((): SearchStats | undefined => {
        if (!searchQuery.data) return undefined;

        const stats: SearchStats = {
            searchTime: searchQuery.data.searchTime,
            totalResults: searchQuery.data.total,
            cacheHit: false, // Would be determined by cache headers
            isSemanticSearch: enableSemanticSearch
        };

        // Add semantic-specific stats
        if (enableSemanticSearch && searchQuery.data.properties.length > 0) {
            const relevanceScores = searchQuery.data.properties
                .map(p => p.relevanceScore)
                .filter((score): score is number => score !== undefined);

            if (relevanceScores.length > 0) {
                stats.averageRelevance = Math.round(
                    relevanceScores.reduce((sum, score) => sum + score, 0) / relevanceScores.length
                );
                stats.highRelevanceCount = relevanceScores.filter(score => score >= 80).length;
            }
        }

        return stats;
    }, [searchQuery.data, enableSemanticSearch]);

    // Extract suggestions
    const suggestions = useMemo(() => {
        const result: string[] = [];

        // Add suggestions from search result
        if (searchQuery.data?.suggestions) {
            result.push(...searchQuery.data.suggestions);
        }

        // Add suggestions from semantic analysis
        if (analysis?.suggestions) {
            result.push(...analysis.suggestions);
        }

        // Remove duplicates and limit
        return [...new Set(result)].slice(0, 5);
    }, [searchQuery.data?.suggestions, analysis?.suggestions]);

    return {
        data: searchQuery.data,
        isLoading: searchQuery.isLoading,
        isError: searchQuery.isError,
        isSuccess: searchQuery.isSuccess,
        isIdle: searchQuery.isIdle,
        error: searchQuery.error,
        refetch: searchQuery.refetch,
        analysis,
        suggestions,
        isSemanticSearch: enableSemanticSearch,
        searchStats
    };
}

/**
 * Hook for search suggestions only (lightweight)
 */
export function useSearchSuggestions(query: string, enabled = true) {
    return useQuery({
        queryKey: ['search-suggestions', query],
        queryFn: async () => {
            if (!query.trim()) return [];
            return semanticSearchService.generateSuggestions(query);
        },
        enabled: enabled && query.length > 1,
        staleTime: 2 * 60 * 1000, // 2 minutes
        gcTime: 5 * 60 * 1000 // 5 minutes
    });
}

/**
 * Hook for query analysis only
 */
export function useQueryAnalysis(query: string, enabled = true) {
    return useQuery({
        queryKey: ['query-analysis', query],
        queryFn: async () => {
            if (!query.trim()) return null;
            return semanticSearchService.analyzeQuery(query);
        },
        enabled: enabled && query.length > 2,
        staleTime: 5 * 60 * 1000, // 5 minutes
        gcTime: 10 * 60 * 1000 // 10 minutes
    });
}

/**
 * Hook for saved searches
 */
export function useSavedSearches() {
    return useQuery({
        queryKey: ['saved-searches'],
        queryFn: async () => {
            return apiClient.get('/searches/saved');
        },
        staleTime: 10 * 60 * 1000, // 10 minutes
        gcTime: 30 * 60 * 1000 // 30 minutes
    });
}

/**
 * Hook for search alerts
 */
export function useSearchAlerts() {
    return useQuery({
        queryKey: ['search-alerts'],
        queryFn: async () => {
            return apiClient.get('/alerts');
        },
        staleTime: 10 * 60 * 1000, // 10 minutes
        gcTime: 30 * 60 * 1000 // 30 minutes
    });
}

/**
 * Hook for search analytics
 */
export function useSearchAnalytics(timeframe = '7d') {
    return useQuery({
        queryKey: ['search-analytics', timeframe],
        queryFn: async () => {
            return apiClient.get('/analytics/search', {
                params: { timeframe }
            });
        },
        staleTime: 30 * 60 * 1000, // 30 minutes
        gcTime: 60 * 60 * 1000 // 1 hour
    });
}

/**
 * Utility hook for search performance monitoring
 */
export function useSearchPerformance() {
    const queryClient = useQueryClient();

    const getSearchMetrics = useCallback(() => {
        const cache = queryClient.getQueryCache();
        const searchQueries = cache.findAll({
            queryKey: ['property-search-enhanced']
        });

        const metrics = {
            totalSearches: searchQueries.length,
            cacheHitRate: 0,
            averageSearchTime: 0,
            errorRate: 0
        };

        if (searchQueries.length > 0) {
            const successful = searchQueries.filter(q => q.state.status === 'success');
            const errors = searchQueries.filter(q => q.state.status === 'error');

            metrics.cacheHitRate = (successful.length / searchQueries.length) * 100;
            metrics.errorRate = (errors.length / searchQueries.length) * 100;

            // Calculate average search time from successful queries
            const searchTimes = successful
                .map(q => q.state.data?.searchTime)
                .filter((time): time is number => typeof time === 'number');

            if (searchTimes.length > 0) {
                metrics.averageSearchTime = searchTimes.reduce((sum, time) => sum + time, 0) / searchTimes.length;
            }
        }

        return metrics;
    }, [queryClient]);

    return { getSearchMetrics };
}