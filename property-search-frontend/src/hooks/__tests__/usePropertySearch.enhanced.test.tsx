// TDD Tests for Enhanced Property Search Hook
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { usePropertySearchEnhanced } from '../usePropertySearch.enhanced';
import { ApiError, NetworkError, RateLimitError } from '@/lib/api-error-handling';

// Mock the API client
vi.mock('@/lib/api-client', () => ({
    apiClient: {
        get: vi.fn(),
        post: vi.fn()
    }
}));

// Mock the semantic search service
vi.mock('@/services/semanticSearchService', () => ({
    SemanticSearchService: vi.fn().mockImplementation(() => ({
        analyzeQuery: vi.fn().mockReturnValue({
            intent: 'Looking for 2 bedroom apartment',
            extractedFilters: { bedrooms: 2, propertyType: 'apartment' },
            confidence: 85,
            suggestions: ['Modern apartment', 'City center location']
        })),
        enhanceProperties: vi.fn().mockImplementation((properties) =>
            properties.map((p: any) => ({
                ...p,
                relevanceScore: 85,
                matchReasons: ['Perfect bedroom match'],
                semanticScore: 0.9
            }))
        )
  }))
}));

import { apiClient } from '@/lib/api-client';

// Mock data
const mockProperties = [
    {
        id: '1',
        title: 'Modern Apartment',
        price: 450000,
        bedrooms: 2,
        bathrooms: 2,
        area: 1200,
        propertyType: 'apartment',
        listingType: 'sale',
        location: { area: 'Downtown', city: 'London', postcode: 'SW1A 1AA' },
        images: ['image1.jpg'],
        features: ['Balcony', 'Parking']
    }
];

const mockApiResponse = {
    properties: mockProperties,
    total: 1,
    page: 1,
    totalPages: 1,
    searchTime: 45
};

// Test wrapper
const createWrapper = () => {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: { retry: false },
        },
    });

    return ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    );
};

describe('usePropertySearchEnhanced - TDD Implementation', () => {
    const mockApiGet = apiClient.get as any;
    const mockApiPost = apiClient.post as any;

    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('Basic Search Functionality', () => {
        it('should perform basic property search', async () => {
            mockApiGet.mockResolvedValue(mockApiResponse);

            const { result } = renderHook(
                () => usePropertySearchEnhanced({
                    query: '2 bedroom apartment',
                    enabled: true
                }),
                { wrapper: createWrapper() }
            );

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(result.current.data).toBeDefined();
            expect(result.current.data?.properties).toHaveLength(1);
            expect(mockApiGet).toHaveBeenCalledWith('/properties/search', expect.any(Object));
        });

        it('should not search when disabled', () => {
            const { result } = renderHook(
                () => usePropertySearchEnhanced({
                    query: '2 bedroom apartment',
                    enabled: false
                }),
                { wrapper: createWrapper() }
            );

            expect(result.current.isIdle).toBe(true);
            expect(mockApiGet).not.toHaveBeenCalled();
        });

        it('should not search with empty query', () => {
            const { result } = renderHook(
                () => usePropertySearchEnhanced({
                    query: '',
                    enabled: true
                }),
                { wrapper: createWrapper() }
            );

            expect(result.current.isIdle).toBe(true);
            expect(mockApiGet).not.toHaveBeenCalled();
        });

        it('should include filters in search request', async () => {
            mockApiGet.mockResolvedValue(mockApiResponse);

            const filters = {
                bedrooms: 2,
                minPrice: 300000,
                maxPrice: 600000,
                propertyType: 'apartment' as const
            };

            renderHook(
                () => usePropertySearchEnhanced({
                    query: 'apartment',
                    filters,
                    enabled: true
                }),
                { wrapper: createWrapper() }
            );

            await waitFor(() => {
                expect(mockApiGet).toHaveBeenCalledWith(
                    '/properties/search',
                    expect.objectContaining({
                        params: expect.objectContaining({
                            query: 'apartment',
                            bedrooms: 2,
                            minPrice: 300000,
                            maxPrice: 600000,
                            propertyType: 'apartment'
                        })
                    })
                );
            });
        });
    });

    describe('Semantic Search Enhancement', () => {
        it('should enhance search with semantic analysis', async () => {
            mockApiGet.mockResolvedValue(mockApiResponse);

            const { result } = renderHook(
                () => usePropertySearchEnhanced({
                    query: '2 bedroom apartment in london',
                    enableSemanticSearch: true,
                    enabled: true
                }),
                { wrapper: createWrapper() }
            );

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(result.current.analysis).toBeDefined();
            expect(result.current.analysis?.intent).toBe('Looking for 2 bedroom apartment');
            expect(result.current.analysis?.confidence).toBe(85);
            expect(result.current.isSemanticSearch).toBe(true);
        });

        it('should enhance properties with relevance scores', async () => {
            mockApiGet.mockResolvedValue(mockApiResponse);

            const { result } = renderHook(
                () => usePropertySearchEnhanced({
                    query: '2 bedroom apartment',
                    enableSemanticSearch: true,
                    enabled: true
                }),
                { wrapper: createWrapper() }
            );

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            const properties = result.current.data?.properties;
            expect(properties?.[0]).toHaveProperty('relevanceScore', 85);
            expect(properties?.[0]).toHaveProperty('matchReasons');
            expect(properties?.[0]).toHaveProperty('semanticScore');
        });

        it('should provide semantic suggestions', async () => {
            mockApiGet.mockResolvedValue(mockApiResponse);

            const { result } = renderHook(
                () => usePropertySearchEnhanced({
                    query: 'apartment',
                    enableSemanticSearch: true,
                    enabled: true
                }),
                { wrapper: createWrapper() }
            );

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(result.current.suggestions).toContain('Modern apartment');
            expect(result.current.suggestions).toContain('City center location');
        });

        it('should work without semantic enhancement', async () => {
            mockApiGet.mockResolvedValue(mockApiResponse);

            const { result } = renderHook(
                () => usePropertySearchEnhanced({
                    query: 'apartment',
                    enableSemanticSearch: false,
                    enabled: true
                }),
                { wrapper: createWrapper() }
            );

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(result.current.analysis).toBeNull();
            expect(result.current.isSemanticSearch).toBe(false);
            expect(result.current.suggestions).toEqual([]);
        });
    });

    describe('Pagination', () => {
        it('should handle pagination correctly', async () => {
            const paginatedResponse = {
                ...mockApiResponse,
                page: 2,
                totalPages: 3
            };
            mockApiGet.mockResolvedValue(paginatedResponse);

            renderHook(
                () => usePropertySearchEnhanced({
                    query: 'apartment',
                    page: 2,
                    limit: 10,
                    enabled: true
                }),
                { wrapper: createWrapper() }
            );

            await waitFor(() => {
                expect(mockApiGet).toHaveBeenCalledWith(
                    '/properties/search',
                    expect.objectContaining({
                        params: expect.objectContaining({
                            page: 2,
                            limit: 10
                        })
                    })
                );
            });
        });

        it('should use default pagination values', async () => {
            mockApiGet.mockResolvedValue(mockApiResponse);

            renderHook(
                () => usePropertySearchEnhanced({
                    query: 'apartment',
                    enabled: true
                }),
                { wrapper: createWrapper() }
            );

            await waitFor(() => {
                expect(mockApiGet).toHaveBeenCalledWith(
                    '/properties/search',
                    expect.objectContaining({
                        params: expect.objectContaining({
                            page: 1,
                            limit: 12
                        })
                    })
                );
            });
        });
    });

    describe('Error Handling', () => {
        it('should handle API errors gracefully', async () => {
            const apiError = new ApiError('Search failed', 500, 'INTERNAL_ERROR');
            mockApiGet.mockRejectedValue(apiError);

            const { result } = renderHook(
                () => usePropertySearchEnhanced({
                    query: 'apartment',
                    enabled: true
                }),
                { wrapper: createWrapper() }
            );

            await waitFor(() => {
                expect(result.current.isError).toBe(true);
            });

            expect(result.current.error).toBe(apiError);
            expect(result.current.data).toBeUndefined();
        });

        it('should handle network errors', async () => {
            const networkError = new NetworkError('Connection failed');
            mockApiGet.mockRejectedValue(networkError);

            const { result } = renderHook(
                () => usePropertySearchEnhanced({
                    query: 'apartment',
                    enabled: true
                }),
                { wrapper: createWrapper() }
            );

            await waitFor(() => {
                expect(result.current.isError).toBe(true);
            });

            expect(result.current.error).toBe(networkError);
        });

        it('should handle rate limit errors', async () => {
            const rateLimitError = new RateLimitError('Too many requests', 60);
            mockApiGet.mockRejectedValue(rateLimitError);

            const { result } = renderHook(
                () => usePropertySearchEnhanced({
                    query: 'apartment',
                    enabled: true
                }),
                { wrapper: createWrapper() }
            );

            await waitFor(() => {
                expect(result.current.isError).toBe(true);
            });

            expect(result.current.error).toBe(rateLimitError);
        });

        it('should provide error recovery methods', async () => {
            mockApiGet.mockRejectedValueOnce(new NetworkError('Connection failed'))
                .mockResolvedValue(mockApiResponse);

            const { result } = renderHook(
                () => usePropertySearchEnhanced({
                    query: 'apartment',
                    enabled: true
                }),
                { wrapper: createWrapper() }
            );

            await waitFor(() => {
                expect(result.current.isError).toBe(true);
            });

            // Retry the search
            result.current.refetch();

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(result.current.data).toBeDefined();
        });
    });

    describe('Caching and Performance', () => {
        it('should cache search results', async () => {
            mockApiGet.mockResolvedValue(mockApiResponse);

            const { result, rerender } = renderHook(
                (props) => usePropertySearchEnhanced(props),
                {
                    wrapper: createWrapper(),
                    initialProps: { query: 'apartment', enabled: true }
                }
            );

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            // Same query should use cache
            rerender({ query: 'apartment', enabled: true });

            expect(mockApiGet).toHaveBeenCalledTimes(1);
        });

        it('should invalidate cache on different queries', async () => {
            mockApiGet.mockResolvedValue(mockApiResponse);

            const { result, rerender } = renderHook(
                (props) => usePropertySearchEnhanced(props),
                {
                    wrapper: createWrapper(),
                    initialProps: { query: 'apartment', enabled: true }
                }
            );

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            // Different query should make new request
            rerender({ query: 'house', enabled: true });

            await waitFor(() => {
                expect(mockApiGet).toHaveBeenCalledTimes(2);
            });
        });

        it('should debounce rapid query changes', async () => {
            mockApiGet.mockResolvedValue(mockApiResponse);

            const { rerender } = renderHook(
                (props) => usePropertySearchEnhanced(props),
                {
                    wrapper: createWrapper(),
                    initialProps: { query: 'a', enabled: true, debounceMs: 300 }
                }
            );

            // Rapid changes
            rerender({ query: 'ap', enabled: true, debounceMs: 300 });
            rerender({ query: 'apa', enabled: true, debounceMs: 300 });
            rerender({ query: 'apar', enabled: true, debounceMs: 300 });
            rerender({ query: 'apart', enabled: true, debounceMs: 300 });

            // Fast-forward through debounce delay
            vi.advanceTimersByTime(300);

            await waitFor(() => {
                expect(mockApiGet).toHaveBeenCalledTimes(1);
            });
        });
    });

    describe('Search Statistics', () => {
        it('should track search performance metrics', async () => {
            const responseWithStats = {
                ...mockApiResponse,
                searchTime: 45,
                totalResults: 150,
                cacheHit: false
            };
            mockApiGet.mockResolvedValue(responseWithStats);

            const { result } = renderHook(
                () => usePropertySearchEnhanced({
                    query: 'apartment',
                    enabled: true
                }),
                { wrapper: createWrapper() }
            );

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(result.current.searchStats).toEqual({
                searchTime: 45,
                totalResults: 150,
                cacheHit: false,
                isSemanticSearch: false
            });
        });

        it('should include semantic search stats', async () => {
            mockApiGet.mockResolvedValue(mockApiResponse);

            const { result } = renderHook(
                () => usePropertySearchEnhanced({
                    query: 'luxury apartment',
                    enableSemanticSearch: true,
                    enabled: true
                }),
                { wrapper: createWrapper() }
            );

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(result.current.searchStats?.isSemanticSearch).toBe(true);
            expect(result.current.searchStats?.averageRelevance).toBeGreaterThan(0);
        });
    });

    describe('Advanced Features', () => {
        it('should support search suggestions', async () => {
            mockApiGet.mockResolvedValue({
                ...mockApiResponse,
                suggestions: ['2 bedroom apartment', 'luxury flat', 'modern house']
            });

            const { result } = renderHook(
                () => usePropertySearchEnhanced({
                    query: 'apart',
                    includeSuggestions: true,
                    enabled: true
                }),
                { wrapper: createWrapper() }
            );

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(result.current.data?.suggestions).toContain('2 bedroom apartment');
        });

        it('should support saved searches', async () => {
            mockApiGet.mockResolvedValue(mockApiResponse);

            const { result } = renderHook(
                () => usePropertySearchEnhanced({
                    query: 'apartment',
                    saveSearch: true,
                    enabled: true
                }),
                { wrapper: createWrapper() }
            );

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            // Should call save search API
            expect(mockApiPost).toHaveBeenCalledWith('/searches/save', expect.any(Object));
        });

        it('should support search alerts', async () => {
            mockApiGet.mockResolvedValue(mockApiResponse);

            const { result } = renderHook(
                () => usePropertySearchEnhanced({
                    query: 'apartment',
                    createAlert: true,
                    enabled: true
                }),
                { wrapper: createWrapper() }
            );

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(mockApiPost).toHaveBeenCalledWith('/alerts/create', expect.any(Object));
        });
    });

    describe('Integration Tests', () => {
        it('should handle complete search workflow', async () => {
            mockApiGet.mockResolvedValue(mockApiResponse);

            const { result } = renderHook(
                () => usePropertySearchEnhanced({
                    query: '2 bedroom luxury apartment in central london under £500k',
                    enableSemanticSearch: true,
                    includeSuggestions: true,
                    page: 1,
                    limit: 12,
                    enabled: true
                }),
                { wrapper: createWrapper() }
            );

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            // Should have all enhanced features
            expect(result.current.data?.properties).toBeDefined();
            expect(result.current.analysis).toBeDefined();
            expect(result.current.suggestions).toBeDefined();
            expect(result.current.isSemanticSearch).toBe(true);
            expect(result.current.searchStats).toBeDefined();
        });

        it('should handle search with all filters', async () => {
            mockApiGet.mockResolvedValue(mockApiResponse);

            const complexFilters = {
                bedrooms: 2,
                bathrooms: 2,
                minPrice: 300000,
                maxPrice: 600000,
                propertyType: 'apartment' as const,
                location: 'london',
                features: ['parking', 'balcony']
            };

            renderHook(
                () => usePropertySearchEnhanced({
                    query: 'luxury apartment',
                    filters: complexFilters,
                    enableSemanticSearch: true,
                    enabled: true
                }),
                { wrapper: createWrapper() }
            );

            await waitFor(() => {
                expect(mockApiGet).toHaveBeenCalledWith(
                    '/properties/search',
                    expect.objectContaining({
                        params: expect.objectContaining(complexFilters)
                    })
                );
            });
        });
    });

    describe('Performance Tests', () => {
        it('should handle large result sets efficiently', async () => {
            const largeResultSet = {
                properties: Array(100).fill(mockProperties[0]),
                total: 1000,
                page: 1,
                totalPages: 10,
                searchTime: 120
            };
            mockApiGet.mockResolvedValue(largeResultSet);

            const start = Date.now();

            const { result } = renderHook(
                () => usePropertySearchEnhanced({
                    query: 'apartment',
                    enableSemanticSearch: true,
                    enabled: true
                }),
                { wrapper: createWrapper() }
            );

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            const end = Date.now();

            expect(end - start).toBeLessThan(1000); // Should process quickly
            expect(result.current.data?.properties).toHaveLength(100);
        });
    });
});