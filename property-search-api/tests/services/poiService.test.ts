// Places of Interest Service Tests
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { POIService } from '../../src/services/poiService';
import { POIRelevanceScorer } from '../../src/services/poiRelevanceScorer';
import { Property } from '@shared/types';

// Mock external API service
const mockExternalAPI = {
    getPOIsMultiCategory: jest.fn(),
    getPOIs: jest.fn()
};

// Mock Redis client
const mockRedis = {
    get: jest.fn(),
    setex: jest.fn(),
    del: jest.fn()
};

describe('Places of Interest Service', () => {
    let poiService: POIService;
    let relevanceScorer: POIRelevanceScorer;

    beforeEach(() => {
        jest.clearAllMocks();
        relevanceScorer = new POIRelevanceScorer();
        poiService = new POIService(mockExternalAPI, mockRedis);
    });

    describe('Data Efficiency', () => {
        it('should cache POI data for 24 hours', async () => {
            const location = { lat: 51.5074, lng: -0.1278 }; // London
            const mockPOIs = [
                { id: '1', name: 'Test School', category: 'schools', rating: 4.5 },
                { id: '2', name: 'Another School', category: 'schools', rating: 4.2 }
            ];

            // Mock Redis cache miss on first call
            mockRedis.get.mockResolvedValueOnce(null);
            mockExternalAPI.getPOIs.mockResolvedValueOnce(mockPOIs);

            // First call - should fetch from API
            const start1 = Date.now();
            const pois1 = await poiService.getNearbyPOIs(location, 'schools');
            const time1 = Date.now() - start1;

            expect(mockExternalAPI.getPOIs).toHaveBeenCalledTimes(1);
            expect(mockRedis.setex).toHaveBeenCalledWith(
                expect.stringContaining('poi:'),
                24 * 60 * 60, // 24 hours
                expect.any(String)
            );

            // Mock Redis cache hit on second call
            mockRedis.get.mockResolvedValueOnce(JSON.stringify(mockPOIs));

            // Second call - should use cache
            const start2 = Date.now();
            const pois2 = await poiService.getNearbyPOIs(location, 'schools');
            const time2 = Date.now() - start2;

            expect(time2).toBeLessThan(time1 / 10); // 10x faster from cache
            expect(pois1).toEqual(pois2);
            expect(mockExternalAPI.getPOIs).toHaveBeenCalledTimes(1); // No additional API calls
        });

        it('should batch POI requests efficiently', async () => {
            const properties = [
                { lat: 51.5074, lng: -0.1278 }, // London
                { lat: 51.5075, lng: -0.1279 }, // Very close to first
                { lat: 51.5076, lng: -0.1280 }, // Also close
                { lat: 51.5077, lng: -0.1281 }, // Still close
                { lat: 51.5078, lng: -0.1282 }  // Close enough to batch
            ];

            const mockPOIResponse = {
                schools: [{ id: '1', name: 'Test School', category: 'schools' }],
                transport: [{ id: '2', name: 'Test Station', category: 'transport' }]
            };

            mockExternalAPI.getPOIsMultiCategory.mockResolvedValueOnce(mockPOIResponse);

            const start = Date.now();
            const allPOIs = await poiService.batchGetPOIs(properties, ['schools', 'transport']);
            const duration = Date.now() - start;

            // Should make only 1 API call instead of 10 (5 properties × 2 categories)
            expect(mockExternalAPI.getPOIsMultiCategory).toHaveBeenCalledTimes(1);
            expect(allPOIs.length).toBe(10); // All POI data returned (5 properties × 2 categories)
            expect(duration).toBeLessThan(1000); // Should be fast due to batching
        });

        it('should group nearby requests geographically', async () => {
            const requests = [
                { location: { lat: 51.5074, lng: -0.1278 }, category: 'schools', radius: 1000 },
                { location: { lat: 51.5075, lng: -0.1279 }, category: 'transport', radius: 1000 },
                { location: { lat: 51.6074, lng: -0.2278 }, category: 'schools', radius: 1000 }, // Far away
            ];

            mockExternalAPI.getPOIsMultiCategory.mockResolvedValue({
                schools: [{ id: '1', name: 'School', category: 'schools' }],
                transport: [{ id: '2', name: 'Station', category: 'transport' }]
            });

            await poiService.batchProcessRequests(requests);

            // Should make 2 API calls - one for the close group, one for the far location
            expect(mockExternalAPI.getPOIsMultiCategory).toHaveBeenCalledTimes(2);
        });

        it('should handle cache expiration correctly', async () => {
            const location = { lat: 51.5074, lng: -0.1278 };
            const expiredCacheData = {
                data: [{ id: '1', name: 'Old School' }],
                timestamp: Date.now() - (25 * 60 * 60 * 1000), // 25 hours ago
                ttl: 24 * 60 * 60 * 1000 // 24 hours TTL
            };

            mockRedis.get.mockResolvedValueOnce(JSON.stringify(expiredCacheData));
            mockExternalAPI.getPOIs.mockResolvedValueOnce([
                { id: '2', name: 'New School', category: 'schools' }
            ]);

            const pois = await poiService.getNearbyPOIs(location, 'schools');

            // Should fetch fresh data due to expiration
            expect(mockExternalAPI.getPOIs).toHaveBeenCalledTimes(1);
            expect(pois[0].name).toBe('New School');
        });
    });

    describe('POI Relevance Scoring', () => {
        it('should score POIs by relevance to property type', () => {
            const familyHome: Property = {
                id: '1',
                title: 'Family House',
                propertyType: 'house',
                bedrooms: 4,
                bathrooms: 2,
                area: 150,
                price: 500000,
                location: {
                    address: '123 Test St',
                    city: 'London',
                    area: 'Test Area',
                    postcode: 'SW1A 1AA',
                    coordinates: { lat: 51.5, lng: -0.1 }
                },
                images: [],
                features: [],
                listingType: 'sale',
                agentId: 'agent-1',
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date(),
                description: 'A lovely family home'
            };

            const studio: Property = {
                ...familyHome,
                id: '2',
                title: 'Studio Apartment',
                propertyType: 'studio',
                bedrooms: 1,
                area: 35,
                price: 250000
            };

            const pois = [
                {
                    id: '1',
                    name: 'St Mary\'s Primary',
                    category: 'schools',
                    rating: 4.5,
                    reviewCount: 150,
                    coordinates: { lat: 51.5001, lng: -0.1001 }
                },
                {
                    id: '2',
                    name: 'Club Metro',
                    category: 'nightlife',
                    rating: 4.0,
                    reviewCount: 200,
                    coordinates: { lat: 51.5002, lng: -0.1002 }
                },
                {
                    id: '3',
                    name: 'Tesco',
                    category: 'supermarkets',
                    rating: 3.8,
                    reviewCount: 300,
                    coordinates: { lat: 51.5003, lng: -0.1003 }
                }
            ];

            const familyScores = pois.map(poi => ({
                poi,
                score: relevanceScorer.scorePOI(poi, familyHome, 200) // 200m distance
            })).sort((a, b) => b.score - a.score);

            const studioScores = pois.map(poi => ({
                poi,
                score: relevanceScorer.scorePOI(poi, studio, 200)
            })).sort((a, b) => b.score - a.score);

            // Family home should prioritize schools
            expect(familyScores[0].poi.category).toBe('schools');

            // Studio should prioritize convenience/entertainment over schools
            expect(studioScores[0].poi.category).not.toBe('schools');
            expect(['nightlife', 'supermarkets']).toContain(studioScores[0].poi.category);
        });

        it('should consider distance in scoring', () => {
            const property: Property = {
                id: '1',
                title: 'Test Property',
                propertyType: 'flat',
                bedrooms: 2,
                bathrooms: 1,
                area: 70,
                price: 300000,
                location: {
                    address: '123 Test St',
                    city: 'London',
                    area: 'Test Area',
                    postcode: 'SW1A 1AA',
                    coordinates: { lat: 51.5, lng: -0.1 }
                },
                images: [],
                features: [],
                listingType: 'sale',
                agentId: 'agent-1',
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date(),
                description: 'A test property'
            };

            const poi = {
                id: '1',
                name: 'Test School',
                category: 'schools',
                rating: 4.0,
                reviewCount: 100,
                coordinates: { lat: 51.5, lng: -0.1 }
            };

            const closeScore = relevanceScorer.scorePOI(poi, property, 100); // 100m
            const farScore = relevanceScorer.scorePOI(poi, property, 1000); // 1000m

            expect(closeScore).toBeGreaterThan(farScore);
        });

        it('should consider POI quality in scoring', () => {
            const property: Property = {
                id: '1',
                title: 'Test Property',
                propertyType: 'flat',
                bedrooms: 2,
                bathrooms: 1,
                area: 70,
                price: 300000,
                location: {
                    address: '123 Test St',
                    city: 'London',
                    area: 'Test Area',
                    postcode: 'SW1A 1AA',
                    coordinates: { lat: 51.5, lng: -0.1 }
                },
                images: [],
                features: [],
                listingType: 'sale',
                agentId: 'agent-1',
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date(),
                description: 'A test property'
            };

            const highQualityPOI = {
                id: '1',
                name: 'Excellent School',
                category: 'schools',
                rating: 5.0,
                reviewCount: 500,
                coordinates: { lat: 51.5, lng: -0.1 }
            };

            const lowQualityPOI = {
                id: '2',
                name: 'Poor School',
                category: 'schools',
                rating: 2.0,
                reviewCount: 10,
                coordinates: { lat: 51.5, lng: -0.1 }
            };

            const highScore = relevanceScorer.scorePOI(highQualityPOI, property, 200);
            const lowScore = relevanceScorer.scorePOI(lowQualityPOI, property, 200);

            expect(highScore).toBeGreaterThan(lowScore);
        });
    });

    describe('Error Handling', () => {
        it('should handle API failures gracefully', async () => {
            const location = { lat: 51.5074, lng: -0.1278 };

            mockRedis.get.mockResolvedValueOnce(null); // Cache miss
            mockExternalAPI.getPOIs.mockRejectedValueOnce(new Error('API Error'));

            const pois = await poiService.getNearbyPOIs(location, 'schools');

            expect(pois).toEqual([]); // Should return empty array instead of throwing
        });

        it('should handle Redis failures gracefully', async () => {
            const location = { lat: 51.5074, lng: -0.1278 };
            const mockPOIs = [{ id: '1', name: 'Test School', category: 'schools' }];

            mockRedis.get.mockRejectedValueOnce(new Error('Redis Error'));
            mockExternalAPI.getPOIs.mockResolvedValueOnce(mockPOIs);

            const pois = await poiService.getNearbyPOIs(location, 'schools');

            expect(pois).toEqual(mockPOIs); // Should still work without cache
        });
    });

    describe('Performance Optimization', () => {
        it('should debounce rapid requests', async () => {
            const location = { lat: 51.5074, lng: -0.1278 };

            mockRedis.get.mockResolvedValue(null);
            mockExternalAPI.getPOIs.mockResolvedValue([]);

            // Make multiple rapid requests
            const promises = Array(5).fill(null).map(() =>
                poiService.getNearbyPOIs(location, 'schools')
            );

            await Promise.all(promises);

            // Should batch these into fewer API calls
            expect(mockExternalAPI.getPOIs).toHaveBeenCalledTimes(1);
        });

        it('should limit concurrent API requests', async () => {
            const locations = Array(10).fill(null).map((_, i) => ({
                lat: 51.5074 + i * 0.01,
                lng: -0.1278 + i * 0.01
            }));

            mockRedis.get.mockResolvedValue(null);
            mockExternalAPI.getPOIs.mockImplementation(() =>
                new Promise(resolve => setTimeout(() => resolve([]), 100))
            );

            const start = Date.now();
            await Promise.all(locations.map(loc =>
                poiService.getNearbyPOIs(loc, 'schools')
            ));
            const duration = Date.now() - start;

            // Should complete in reasonable time due to concurrency limits
            expect(duration).toBeLessThan(2000); // Less than 2 seconds
        });
    });
});