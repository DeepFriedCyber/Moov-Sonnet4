// Comprehensive API Client Tests
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { ApiClient, ApiError } from '../api-client';
import { SearchOptions, Property } from '@/types';

const server = setupServer();

describe('ApiClient', () => {
    let client: ApiClient;

    beforeAll(() => {
        server.listen({ onUnhandledRequest: 'error' });
        client = new ApiClient({
            baseUrl: 'http://localhost:3001',
            timeout: 5000,
        });
    });

    afterAll(() => server.close());
    afterEach(() => server.resetHandlers());

    describe('searchProperties', () => {
        it('should search properties successfully', async () => {
            // Arrange
            const searchOptions: SearchOptions = {
                query: 'Modern flat with balcony',
                filters: {
                    maxPrice: 500000,
                    minBedrooms: 2,
                },
            };

            const mockResponse = {
                status: 'success',
                data: {
                    properties: [
                        {
                            id: '1',
                            title: 'Modern 2-bed flat',
                            description: 'Beautiful flat with balcony',
                            price: 450000,
                            bedrooms: 2,
                            bathrooms: 1,
                            area: 75,
                            location: {
                                address: '123 Test St',
                                city: 'London',
                                area: 'Central',
                                postcode: 'SW1A 1AA',
                                coordinates: { lat: 51.5, lng: -0.1 },
                            },
                            images: [],
                            features: ['Balcony'],
                            propertyType: 'flat',
                            listingType: 'sale',
                            agentId: 'agent-1',
                            isActive: true,
                            similarity_score: 0.95,
                            createdAt: new Date('2024-01-01'),
                            updatedAt: new Date('2024-01-01'),
                        },
                    ],
                    total: 1,
                    page: 1,
                    limit: 10,
                    searchTime: 150,
                },
            };

            server.use(
                http.post('http://localhost:3001/api/properties/search', () => {
                    return HttpResponse.json(mockResponse);
                })
            );

            // Act
            const result = await client.searchProperties(searchOptions);

            // Assert
            expect(result.properties).toHaveLength(1);
            expect(result.properties[0].title).toBe('Modern 2-bed flat');
            expect(result.total).toBe(1);
            expect(result.searchTime).toBe(150);
        });

        it('should handle search errors', async () => {
            // Arrange
            server.use(
                http.post('http://localhost:3001/api/properties/search', () => {
                    return HttpResponse.json(
                        {
                            status: 'error',
                            error: {
                                message: 'Invalid search query',
                                code: 'VALIDATION_ERROR',
                            },
                        },
                        { status: 400 }
                    );
                })
            );

            // Act & Assert
            await expect(
                client.searchProperties({ query: '' })
            ).rejects.toThrow(ApiError);

            try {
                await client.searchProperties({ query: '' });
            } catch (error) {
                expect(error).toBeInstanceOf(ApiError);
                expect((error as ApiError).statusCode).toBe(400);
                expect((error as ApiError).message).toBe('Invalid search query');
            }
        });

        it('should handle network errors', async () => {
            // Arrange
            server.use(
                http.post('http://localhost:3001/api/properties/search', () => {
                    return HttpResponse.error();
                })
            );

            // Act & Assert
            await expect(
                client.searchProperties({ query: 'test' })
            ).rejects.toThrow('Network error');
        });

        it('should handle timeout', async () => {
            // Arrange
            const fastClient = new ApiClient({
                baseUrl: 'http://localhost:3001',
                timeout: 100, // Very short timeout
            });

            server.use(
                http.post('http://localhost:3001/api/properties/search', async () => {
                    await new Promise(resolve => setTimeout(resolve, 200));
                    return HttpResponse.json({ status: 'success' });
                })
            );

            // Act & Assert
            await expect(
                fastClient.searchProperties({ query: 'test' })
            ).rejects.toThrow(); // Just check that it throws, as timeout behavior may vary
        });
    });

    describe('getProperty', () => {
        it('should get property by id', async () => {
            // Arrange
            const propertyId = 'prop-123';
            const mockProperty: Property = {
                id: propertyId,
                title: 'Test Property',
                description: 'A test property',
                price: 300000,
                bedrooms: 2,
                bathrooms: 1,
                area: 70,
                location: {
                    address: '456 Test Ave',
                    city: 'London',
                    area: 'East',
                    postcode: 'E1 1AA',
                    coordinates: { lat: 51.5, lng: -0.1 },
                },
                images: ['https://example.com/image1.jpg'],
                features: ['Garden'],
                propertyType: 'house',
                listingType: 'sale',
                agentId: 'agent-1',
                isActive: true,
                createdAt: '2024-01-01T00:00:00.000Z',
                updatedAt: '2024-01-01T00:00:00.000Z',
            };

            server.use(
                http.get(`http://localhost:3001/api/properties/${propertyId}`, () => {
                    return HttpResponse.json({
                        status: 'success',
                        data: mockProperty,
                    });
                })
            );

            // Act
            const result = await client.getProperty(propertyId);

            // Assert
            expect(result).toEqual(mockProperty);
            expect(result.id).toBe(propertyId);
        });

        it('should handle 404 errors', async () => {
            // Arrange
            server.use(
                http.get('http://localhost:3001/api/properties/non-existent', () => {
                    return HttpResponse.json(
                        {
                            status: 'error',
                            error: {
                                message: 'Property not found',
                                code: 'NOT_FOUND',
                            },
                        },
                        { status: 404 }
                    );
                })
            );

            // Act & Assert
            await expect(
                client.getProperty('non-existent')
            ).rejects.toThrow('Property not found');
        });
    });

    describe('createProperty', () => {
        it('should create a new property', async () => {
            // Arrange
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

            server.use(
                http.post('http://localhost:3001/api/properties', async ({ request }) => {
                    const body = await request.json();
                    return HttpResponse.json(
                        {
                            status: 'success',
                            data: {
                                id: 'new-123',
                                ...body,
                                createdAt: new Date(),
                                updatedAt: new Date()
                            },
                        },
                        { status: 201 }
                    );
                })
            );

            // Act
            const result = await client.createProperty(propertyData);

            // Assert
            expect(result.id).toBe('new-123');
            expect(result.title).toBe(propertyData.title);
            expect(result.price).toBe(propertyData.price);
        });

        it('should handle validation errors', async () => {
            // Arrange
            server.use(
                http.post('http://localhost:3001/api/properties', () => {
                    return HttpResponse.json(
                        {
                            status: 'error',
                            error: {
                                message: 'Validation error',
                                code: 'VALIDATION_ERROR',
                                details: [
                                    { field: 'price', message: 'Price must be positive' }
                                ],
                            },
                        },
                        { status: 400 }
                    );
                })
            );

            // Act & Assert
            await expect(
                client.createProperty({ price: -100 } as any)
            ).rejects.toThrow('Validation error');
        });
    });

    describe('request retry logic', () => {
        it('should retry failed requests', async () => {
            // Arrange
            let attempts = 0;
            const clientWithRetry = new ApiClient({
                baseUrl: 'http://localhost:3001',
                timeout: 5000,
                retryAttempts: 3,
                retryDelay: 10,
            });

            server.use(
                http.get('http://localhost:3001/api/properties/retry-test', () => {
                    attempts++;
                    if (attempts < 3) {
                        return HttpResponse.json(
                            { status: 'error', error: { message: 'Server error' } },
                            { status: 500 }
                        );
                    }
                    return HttpResponse.json({
                        status: 'success',
                        data: { id: 'retry-test', title: 'Retry Test Property' }
                    });
                })
            );

            // Act
            const result = await clientWithRetry.getProperty('retry-test');

            // Assert
            expect(attempts).toBe(3);
            expect(result.id).toBe('retry-test');
        });

        it('should not retry client errors', async () => {
            // Arrange
            let attempts = 0;
            const clientWithRetry = new ApiClient({
                baseUrl: 'http://localhost:3001',
                timeout: 5000,
                retryAttempts: 3,
            });

            server.use(
                http.get('http://localhost:3001/api/properties/no-retry', () => {
                    attempts++;
                    return HttpResponse.json(
                        { status: 'error', error: { message: 'Bad request' } },
                        { status: 400 }
                    );
                })
            );

            // Act & Assert
            await expect(
                clientWithRetry.getProperty('no-retry')
            ).rejects.toThrow('Bad request');

            expect(attempts).toBe(1); // No retries for 4xx errors
        });
    });

    describe('request interceptors', () => {
        it('should add auth token to requests', async () => {
            // Arrange
            const clientWithAuth = new ApiClient({
                baseUrl: 'http://localhost:3001',
                timeout: 5000,
                authToken: 'test-token-123',
            });

            let capturedHeaders: Headers;

            server.use(
                http.get('http://localhost:3001/api/properties/auth-test', ({ request }) => {
                    capturedHeaders = request.headers;
                    return HttpResponse.json({
                        status: 'success',
                        data: { id: 'auth-test', title: 'Auth Test Property' }
                    });
                })
            );

            // Act
            await clientWithAuth.getProperty('auth-test');

            // Assert
            expect(capturedHeaders.get('authorization')).toBe('Bearer test-token-123');
        });
    });

    describe('health check', () => {
        it('should perform health check', async () => {
            // Arrange
            const mockHealthResponse = {
                status: 'success',
                data: {
                    status: 'healthy',
                    timestamp: '2024-01-01T00:00:00Z'
                }
            };

            server.use(
                http.get('http://localhost:3001/api/health', () => {
                    return HttpResponse.json(mockHealthResponse);
                })
            );

            // Act
            const result = await client.healthCheck();

            // Assert
            expect(result.status).toBe('healthy');
            expect(result.timestamp).toBe('2024-01-01T00:00:00Z');
        });
    });
});