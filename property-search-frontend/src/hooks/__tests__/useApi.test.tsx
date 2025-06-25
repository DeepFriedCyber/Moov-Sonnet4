// React Query Hook Tests
import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { usePropertySearch, useProperty, useCreateProperty, ApiProvider } from '../useApi';
import { ApiClient } from '@/lib/api-client';
import React from 'react';

// Mock the API client
vi.mock('@/lib/api-client');

describe('API Hooks', () => {
    const createWrapper = () => {
        const queryClient = new QueryClient({
            defaultOptions: {
                queries: { retry: false },
                mutations: { retry: false },
            },
        });

        const mockApiClient = {
            searchProperties: vi.fn(),
            getProperty: vi.fn(),
            createProperty: vi.fn(),
            updateProperty: vi.fn(),
            deleteProperty: vi.fn(),
            healthCheck: vi.fn(),
            setAuthToken: vi.fn(),
        } as any;

        const wrapper = ({ children }: { children: React.ReactNode }) => (
            <QueryClientProvider client={queryClient}>
                <ApiProvider client={mockApiClient}>
                    {children}
                </ApiProvider>
            </QueryClientProvider>
        );

        return { wrapper, mockApiClient, queryClient };
    };

    describe('usePropertySearch', () => {
        it('should search properties', async () => {
            // Arrange
            const { wrapper, mockApiClient } = createWrapper();
            const searchResults = {
                properties: [{
                    id: '1',
                    title: 'Test Property',
                    description: 'A test property',
                    price: 300000,
                    bedrooms: 2,
                    bathrooms: 1,
                    area: 70,
                    location: {
                        address: '123 Test St',
                        city: 'London',
                        area: 'Central',
                        postcode: 'SW1A 1AA',
                        coordinates: { lat: 51.5, lng: -0.1 },
                    },
                    images: [],
                    features: [],
                    propertyType: 'flat' as const,
                    listingType: 'sale' as const,
                    agentId: 'agent-1',
                    isActive: true,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                }],
                total: 1,
                page: 1,
                limit: 10,
                searchTime: 100,
            };

            mockApiClient.searchProperties.mockResolvedValueOnce(searchResults);

            // Act
            const { result } = renderHook(
                () => usePropertySearch({ query: 'test', enabled: true }),
                { wrapper }
            );

            // Assert
            expect(result.current.isLoading).toBe(true);

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(result.current.data).toEqual(searchResults);
            expect(mockApiClient.searchProperties).toHaveBeenCalledWith({ query: 'test' });
        });

        it('should not search when disabled', () => {
            // Arrange
            const { wrapper, mockApiClient } = createWrapper();

            // Act
            renderHook(
                () => usePropertySearch({ query: 'test', enabled: false }),
                { wrapper }
            );

            // Assert
            expect(mockApiClient.searchProperties).not.toHaveBeenCalled();
        });

        it('should not search when query is empty', () => {
            // Arrange
            const { wrapper, mockApiClient } = createWrapper();

            // Act
            renderHook(
                () => usePropertySearch({ query: '', enabled: true }),
                { wrapper }
            );

            // Assert
            expect(mockApiClient.searchProperties).not.toHaveBeenCalled();
        });

        it('should handle search errors', async () => {
            // Arrange
            const { wrapper, mockApiClient } = createWrapper();
            const error = new Error('Search failed');

            mockApiClient.searchProperties.mockRejectedValueOnce(error);

            // Act
            const { result } = renderHook(
                () => usePropertySearch({ query: 'test', enabled: true }),
                { wrapper }
            );

            // Assert
            await waitFor(() => {
                expect(result.current.isError).toBe(true);
            });

            expect(result.current.error).toBe(error);
        });

        it('should pass search filters correctly', async () => {
            // Arrange
            const { wrapper, mockApiClient } = createWrapper();
            const searchOptions = {
                query: 'modern flat',
                filters: {
                    maxPrice: 500000,
                    minBedrooms: 2,
                },
                sort: {
                    field: 'price' as const,
                    order: 'asc' as const,
                },
            };

            mockApiClient.searchProperties.mockResolvedValueOnce({
                properties: [],
                total: 0,
                page: 1,
                limit: 10,
                searchTime: 50,
            });

            // Act
            renderHook(
                () => usePropertySearch(searchOptions),
                { wrapper }
            );

            // Wait for the call to be made
            await waitFor(() => {
                expect(mockApiClient.searchProperties).toHaveBeenCalledWith(searchOptions);
            });
        });
    });

    describe('useProperty', () => {
        it('should fetch property by id', async () => {
            // Arrange
            const { wrapper, mockApiClient } = createWrapper();
            const property = {
                id: 'prop-123',
                title: 'Test Property',
                description: 'A test property',
                price: 300000,
                bedrooms: 2,
                bathrooms: 1,
                area: 70,
                location: {
                    address: '123 Test St',
                    city: 'London',
                    area: 'Central',
                    postcode: 'SW1A 1AA',
                    coordinates: { lat: 51.5, lng: -0.1 },
                },
                images: [],
                features: [],
                propertyType: 'house' as const,
                listingType: 'sale' as const,
                agentId: 'agent-1',
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            mockApiClient.getProperty.mockResolvedValueOnce(property);

            // Act
            const { result } = renderHook(
                () => useProperty('prop-123'),
                { wrapper }
            );

            // Assert
            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(result.current.data).toEqual(property);
            expect(mockApiClient.getProperty).toHaveBeenCalledWith('prop-123');
        });

        it('should not fetch when id is null', () => {
            // Arrange
            const { wrapper, mockApiClient } = createWrapper();

            // Act
            renderHook(() => useProperty(null), { wrapper });

            // Assert
            expect(mockApiClient.getProperty).not.toHaveBeenCalled();
        });

        it('should handle property not found', async () => {
            // Arrange
            const { wrapper, mockApiClient } = createWrapper();
            const error = new Error('Property not found');

            mockApiClient.getProperty.mockRejectedValueOnce(error);

            // Act
            const { result } = renderHook(
                () => useProperty('non-existent'),
                { wrapper }
            );

            // Assert
            await waitFor(() => {
                expect(result.current.isError).toBe(true);
            });

            expect(result.current.error).toBe(error);
        });
    });

    describe('useCreateProperty', () => {
        it('should create a new property', async () => {
            // Arrange
            const { wrapper, mockApiClient } = createWrapper();
            const propertyData = {
                title: 'New Property',
                description: 'Brand new listing',
                price: 350000,
                bedrooms: 3,
                bathrooms: 2,
                area: 90,
                location: {
                    address: '789 New St',
                    city: 'London',
                    area: 'North',
                    postcode: 'N1 1AA',
                    coordinates: { lat: 51.5, lng: -0.1 },
                },
                images: [],
                features: ['Parking'],
                propertyType: 'flat' as const,
                listingType: 'rent' as const,
                agentId: 'agent-1',
                isActive: true,
            };

            const createdProperty = {
                id: 'new-123',
                ...propertyData,
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            mockApiClient.createProperty.mockResolvedValueOnce(createdProperty);

            // Act
            const { result } = renderHook(
                () => useCreateProperty(),
                { wrapper }
            );

            // Trigger the mutation
            result.current.mutate(propertyData);

            // Assert
            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(result.current.data).toEqual(createdProperty);
            expect(mockApiClient.createProperty).toHaveBeenCalledWith(propertyData);
        });

        it('should handle creation errors', async () => {
            // Arrange
            const { wrapper, mockApiClient } = createWrapper();
            const error = new Error('Validation failed');

            mockApiClient.createProperty.mockRejectedValueOnce(error);

            // Act
            const { result } = renderHook(
                () => useCreateProperty(),
                { wrapper }
            );

            // Trigger the mutation
            result.current.mutate({} as any);

            // Assert
            await waitFor(() => {
                expect(result.current.isError).toBe(true);
            });

            expect(result.current.error).toBe(error);
        });
    });

    describe('context error handling', () => {
        it('should throw error when used outside ApiProvider', () => {
            // Arrange
            const queryClient = new QueryClient();
            const wrapper = ({ children }: { children: React.ReactNode }) => (
                <QueryClientProvider client={queryClient}>
                    {children}
                </QueryClientProvider>
            );

            // Act & Assert
            expect(() => {
                renderHook(() => usePropertySearch({ query: 'test' }), { wrapper });
            }).toThrow('useApiClient must be used within ApiProvider');
        });
    });
});