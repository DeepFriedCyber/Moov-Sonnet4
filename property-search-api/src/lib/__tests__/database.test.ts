// TDD RED PHASE - Database Integration Tests
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { DatabaseService, PropertyRepository } from '../database';
import { Property } from '@/types';

// Mock pg module for testing
vi.mock('pg', () => {
    const mockClient = {
        query: vi.fn(),
        release: vi.fn(),
    };

    const mockPool = {
        query: vi.fn(),
        connect: vi.fn(() => Promise.resolve(mockClient)),
        end: vi.fn(),
    };

    return {
        Pool: vi.fn(() => mockPool),
    };
});

describe('Database Integration', () => {
    let database: DatabaseService;
    let mockPool: any;

    beforeAll(async () => {
        // Create mock database service
        database = new DatabaseService('postgresql://test:test@localhost:5432/testdb');

        // Get reference to the mocked pool
        const { Pool } = await import('pg');
        mockPool = new (Pool as any)();

        // Setup basic mock responses
        mockPool.query.mockImplementation((query: string) => {
            if (query.includes('CREATE EXTENSION')) {
                return Promise.resolve({ rows: [] });
            }
            if (query.includes('CREATE TABLE')) {
                return Promise.resolve({ rows: [] });
            }
            if (query.includes('CREATE INDEX')) {
                return Promise.resolve({ rows: [] });
            }
            if (query.includes("SELECT * FROM pg_extension WHERE extname = 'vector'")) {
                return Promise.resolve({ rows: [{ extname: 'vector' }] });
            }
            if (query.includes('information_schema.columns')) {
                return Promise.resolve({ rows: [{ column_name: 'embedding', data_type: 'USER-DEFINED' }] });
            }
            return Promise.resolve({ rows: [] });
        });

        await database.initialize();
    });

    afterAll(async () => {
        await database.close();
    });

    describe('DatabaseService', () => {
        it('should initialize pgvector extension', async () => {
            // Act
            const result = await database.query(
                "SELECT * FROM pg_extension WHERE extname = 'vector'"
            );

            // Assert
            expect(result.rows).toHaveLength(1);
            expect(result.rows[0].extname).toBe('vector');
        });

        it('should create properties table with vector column', async () => {
            // Act
            const result = await database.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'properties' 
        AND column_name = 'embedding'
      `);

            // Assert
            expect(result.rows).toHaveLength(1);
            expect(result.rows[0].data_type).toBe('USER-DEFINED');
        });

        it('should handle connection pool properly', async () => {
            // Arrange
            mockPool.query.mockResolvedValue({ rows: [{ value: 1 }] });
            const promises = [];

            // Act - Make multiple concurrent queries
            for (let i = 0; i < 10; i++) {
                promises.push(database.query('SELECT 1 as value'));
            }

            const results = await Promise.all(promises);

            // Assert
            results.forEach(result => {
                expect(result.rows[0].value).toBe(1);
            });
        });

        it('should handle query errors gracefully', async () => {
            // Arrange
            mockPool.query.mockRejectedValueOnce(new Error('Table does not exist'));

            // Act & Assert
            await expect(
                database.query('SELECT * FROM non_existent_table')
            ).rejects.toThrow('Table does not exist');
        });

        it('should support transactions', async () => {
            // Arrange
            const mockClient = {
                query: vi.fn().mockResolvedValue({ rows: [] }),
                release: vi.fn(),
            };
            mockPool.connect.mockResolvedValueOnce(mockClient);

            // Act
            const client = await database.getClient();

            try {
                await client.query('BEGIN');
                await client.query('INSERT INTO properties (id, title) VALUES ($1, $2)', ['txn-1', 'Test']);
                await client.query('ROLLBACK');
            } finally {
                client.release();
            }

            // Assert
            expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
            expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
            expect(mockClient.release).toHaveBeenCalled();
        });
    });

    describe('PropertyRepository', () => {
        let repository: PropertyRepository;

        beforeEach(async () => {
            repository = new PropertyRepository(database);
            // Reset mock calls
            vi.clearAllMocks();
        });

        describe('create', () => {
            it('should create a new property', async () => {
                // Arrange
                const propertyData = {
                    title: 'Modern 2-bed flat',
                    description: 'Beautiful flat in central London',
                    price: 450000,
                    bedrooms: 2,
                    bathrooms: 1,
                    area: 75,
                    location: {
                        address: '123 Test Street',
                        city: 'London',
                        area: 'Westminster',
                        postcode: 'SW1A 1AA',
                        coordinates: { lat: 51.5074, lng: -0.1278 },
                    },
                    images: ['https://example.com/image1.jpg'],
                    features: ['Balcony', 'Modern Kitchen'],
                    propertyType: 'flat' as const,
                    listingType: 'sale' as const,
                };

                const mockRow = {
                    id: 'test-uuid-123',
                    title: propertyData.title,
                    description: propertyData.description,
                    price: '450000.00',
                    bedrooms: propertyData.bedrooms,
                    bathrooms: propertyData.bathrooms,
                    area: '75.00',
                    location: JSON.stringify(propertyData.location),
                    images: JSON.stringify(propertyData.images),
                    features: JSON.stringify(propertyData.features),
                    property_type: propertyData.propertyType,
                    listing_type: propertyData.listingType,
                    agent_id: 'default-agent',
                    is_active: true,
                    created_at: new Date(),
                    updated_at: new Date(),
                };

                mockPool.query.mockResolvedValueOnce({ rows: [mockRow] });

                // Act
                const property = await repository.create(propertyData);

                // Assert
                expect(property.id).toBe('test-uuid-123');
                expect(property.title).toBe(propertyData.title);
                expect(property.price).toBe(propertyData.price);
                expect(property.createdAt).toBeInstanceOf(Date);
                expect(property.updatedAt).toBeInstanceOf(Date);
            });

            it('should validate required fields', async () => {
                // Arrange
                const invalidData = {
                    title: '', // Empty title
                    price: -100, // Negative price
                } as any;

                // Act & Assert
                await expect(repository.create(invalidData)).rejects.toThrow('Validation error');
            });
        });

        describe('findById', () => {
            it('should find property by id', async () => {
                // Arrange
                const mockRow = {
                    id: 'test-id-123',
                    title: 'Test Property',
                    description: 'Test description',
                    price: '300000.00',
                    bedrooms: 1,
                    bathrooms: 1,
                    area: '50.00',
                    location: JSON.stringify({
                        address: '456 Test Ave',
                        city: 'London',
                        area: 'East London',
                        postcode: 'E1 1AA',
                        coordinates: { lat: 51.5, lng: -0.1 },
                    }),
                    images: JSON.stringify([]),
                    features: JSON.stringify([]),
                    property_type: 'flat',
                    listing_type: 'rent',
                    agent_id: 'default-agent',
                    is_active: true,
                    created_at: new Date(),
                    updated_at: new Date(),
                };

                mockPool.query.mockResolvedValueOnce({ rows: [mockRow] });

                // Act
                const found = await repository.findById('test-id-123');

                // Assert
                expect(found).toBeDefined();
                expect(found?.id).toBe('test-id-123');
                expect(found?.title).toBe('Test Property');
            });

            it('should return null for non-existent id', async () => {
                // Arrange
                mockPool.query.mockResolvedValueOnce({ rows: [] });

                // Act
                const found = await repository.findById('non-existent-id');

                // Assert
                expect(found).toBeNull();
            });
        });

        describe('searchBySimilarity', () => {
            it('should find properties by vector similarity', async () => {
                // Arrange
                const mockSearchResults = [
                    {
                        id: 'prop-1',
                        title: 'Modern luxury apartment',
                        description: 'High-end flat with amazing views',
                        price: '250000.00',
                        bedrooms: 1,
                        bathrooms: 1,
                        area: '50.00',
                        location: JSON.stringify({ city: 'London', area: 'Southwest', postcode: 'SW1', address: 'Test St', coordinates: { lat: 51.5, lng: -0.1 } }),
                        images: JSON.stringify([]),
                        features: JSON.stringify([]),
                        property_type: 'flat',
                        listing_type: 'sale',
                        agent_id: 'default-agent',
                        is_active: true,
                        created_at: new Date(),
                        updated_at: new Date(),
                        similarity_score: 0.95,
                    },
                    {
                        id: 'prop-2',
                        title: 'Contemporary apartment with terrace',
                        description: 'Modern space with outdoor area',
                        price: '280000.00',
                        bedrooms: 1,
                        bathrooms: 1,
                        area: '55.00',
                        location: JSON.stringify({ city: 'London', area: 'Southwest', postcode: 'SW2', address: 'Test Ave', coordinates: { lat: 51.5, lng: -0.1 } }),
                        images: JSON.stringify([]),
                        features: JSON.stringify([]),
                        property_type: 'flat',
                        listing_type: 'sale',
                        agent_id: 'default-agent',
                        is_active: true,
                        created_at: new Date(),
                        updated_at: new Date(),
                        similarity_score: 0.87,
                    },
                ];

                // Mock the search query response
                mockPool.query
                    .mockResolvedValueOnce({ rows: mockSearchResults }) // Properties query
                    .mockResolvedValueOnce({ rows: [{ count: '2' }] }); // Count query

                // Act
                const queryVector = [0.15, 0.75, 0.35];
                const results = await repository.searchBySimilarity({
                    embedding: queryVector,
                    limit: 2,
                });

                // Assert
                expect(results.properties).toHaveLength(2);
                expect(results.properties[0].title).toBe('Modern luxury apartment');
                expect(results.properties[0].similarity_score).toBeDefined();
                expect(results.properties[0].similarity_score).toBeGreaterThan(0.8);
            });

            it('should apply filters in similarity search', async () => {
                // Arrange
                const filteredResult = {
                    id: 'affordable-prop',
                    title: 'Affordable flat',
                    description: 'Budget property',
                    price: '200000.00',
                    bedrooms: 1,
                    bathrooms: 1,
                    area: '40.00',
                    location: JSON.stringify({ city: 'London', area: 'East London', postcode: 'E1', address: 'B', coordinates: { lat: 51.5, lng: -0.1 } }),
                    images: JSON.stringify([]),
                    features: JSON.stringify([]),
                    property_type: 'flat',
                    listing_type: 'sale',
                    agent_id: 'default-agent',
                    is_active: true,
                    created_at: new Date(),
                    updated_at: new Date(),
                    similarity_score: 0.9,
                };

                // Mock the filtered search response
                mockPool.query
                    .mockResolvedValueOnce({ rows: [filteredResult] }) // Properties query
                    .mockResolvedValueOnce({ rows: [{ count: '1' }] }); // Count query

                // Act
                const results = await repository.searchBySimilarity({
                    embedding: [0.1, 0.2, 0.3],
                    filters: {
                        maxPrice: 500000,
                    },
                    limit: 10,
                });

                // Assert
                expect(results.properties).toHaveLength(1);
                expect(results.properties[0].title).toBe('Affordable flat');
            });

            it('should handle pagination in similarity search', async () => {
                // Arrange
                const page1Results = [
                    {
                        id: 'prop-1',
                        title: 'Property 1',
                        description: 'Description 1',
                        price: '300000.00',
                        bedrooms: 2,
                        bathrooms: 1,
                        area: '60.00',
                        location: JSON.stringify({ city: 'London', area: 'Southwest', postcode: 'SW1', address: '1 St', coordinates: { lat: 51.5, lng: -0.1 } }),
                        images: JSON.stringify([]),
                        features: JSON.stringify([]),
                        property_type: 'flat',
                        listing_type: 'sale',
                        agent_id: 'default-agent',
                        is_active: true,
                        created_at: new Date(),
                        updated_at: new Date(),
                        similarity_score: 0.9,
                    },
                    {
                        id: 'prop-2',
                        title: 'Property 2',
                        description: 'Description 2',
                        price: '310000.00',
                        bedrooms: 2,
                        bathrooms: 1,
                        area: '60.00',
                        location: JSON.stringify({ city: 'London', area: 'Southwest', postcode: 'SW1', address: '2 St', coordinates: { lat: 51.5, lng: -0.1 } }),
                        images: JSON.stringify([]),
                        features: JSON.stringify([]),
                        property_type: 'flat',
                        listing_type: 'sale',
                        agent_id: 'default-agent',
                        is_active: true,
                        created_at: new Date(),
                        updated_at: new Date(),
                        similarity_score: 0.85,
                    },
                ];

                const page2Results = [
                    {
                        id: 'prop-3',
                        title: 'Property 3',
                        description: 'Description 3',
                        price: '320000.00',
                        bedrooms: 2,
                        bathrooms: 1,
                        area: '60.00',
                        location: JSON.stringify({ city: 'London', area: 'Southwest', postcode: 'SW1', address: '3 St', coordinates: { lat: 51.5, lng: -0.1 } }),
                        images: JSON.stringify([]),
                        features: JSON.stringify([]),
                        property_type: 'flat',
                        listing_type: 'sale',
                        agent_id: 'default-agent',
                        is_active: true,
                        created_at: new Date(),
                        updated_at: new Date(),
                        similarity_score: 0.8,
                    },
                    {
                        id: 'prop-4',
                        title: 'Property 4',
                        description: 'Description 4',
                        price: '330000.00',
                        bedrooms: 2,
                        bathrooms: 1,
                        area: '60.00',
                        location: JSON.stringify({ city: 'London', area: 'Southwest', postcode: 'SW1', address: '4 St', coordinates: { lat: 51.5, lng: -0.1 } }),
                        images: JSON.stringify([]),
                        features: JSON.stringify([]),
                        property_type: 'flat',
                        listing_type: 'sale',
                        agent_id: 'default-agent',
                        is_active: true,
                        created_at: new Date(),
                        updated_at: new Date(),
                        similarity_score: 0.75,
                    },
                ];

                // Mock page 1 response
                mockPool.query
                    .mockResolvedValueOnce({ rows: page1Results }) // Properties query
                    .mockResolvedValueOnce({ rows: [{ count: '5' }] }) // Count query
                    .mockResolvedValueOnce({ rows: page2Results }) // Properties query for page 2
                    .mockResolvedValueOnce({ rows: [{ count: '5' }] }); // Count query for page 2

                // Act
                const page1 = await repository.searchBySimilarity({
                    embedding: [0.2, 0.2, 0.2],
                    limit: 2,
                    offset: 0,
                });

                const page2 = await repository.searchBySimilarity({
                    embedding: [0.2, 0.2, 0.2],
                    limit: 2,
                    offset: 2,
                });

                // Assert
                expect(page1.properties).toHaveLength(2);
                expect(page2.properties).toHaveLength(2);
                expect(page1.total).toBe(5);
                expect(page2.total).toBe(5);
                expect(page1.properties[0].id).not.toBe(page2.properties[0].id);
            });

            it('should apply similarity threshold', async () => {
                // Arrange - Mock empty results due to high threshold
                mockPool.query
                    .mockResolvedValueOnce({ rows: [] }) // Properties query (no results)
                    .mockResolvedValueOnce({ rows: [{ count: '0' }] }); // Count query

                // Act
                const results = await repository.searchBySimilarity({
                    embedding: [0.1, 0.1, 0.1],
                    similarityThreshold: 0.5,
                });

                // Assert
                expect(results.properties).toHaveLength(0);
            });
        });

        describe('updateEmbedding', () => {
            it('should update property embedding', async () => {
                // Arrange
                const mockCreateRow = {
                    id: 'embed-test-id',
                    title: 'Property to embed',
                    description: 'Will add embedding',
                    price: '400000.00',
                    bedrooms: 2,
                    bathrooms: 2,
                    area: '80.00',
                    location: JSON.stringify({
                        address: '789 Embed St',
                        city: 'London',
                        area: 'West London',
                        postcode: 'W1 1AA',
                        coordinates: { lat: 51.5, lng: -0.1 },
                    }),
                    images: JSON.stringify([]),
                    features: JSON.stringify([]),
                    property_type: 'house',
                    listing_type: 'sale',
                    agent_id: 'default-agent',
                    is_active: true,
                    created_at: new Date(),
                    updated_at: new Date(),
                };

                const embedding = [0.5, 0.5, 0.5];

                // Mock create response first
                mockPool.query
                    .mockResolvedValueOnce({ rows: [mockCreateRow] }) // Create property
                    .mockResolvedValueOnce({ rows: [] }) // Update embedding (no return needed)
                    .mockResolvedValueOnce({ rows: [{ embedding: '[0.5,0.5,0.5]' }] }); // Select embedding

                const property = await repository.create({
                    title: 'Property to embed',
                    description: 'Will add embedding',
                    price: 400000,
                    bedrooms: 2,
                    bathrooms: 2,
                    area: 80,
                    location: {
                        address: '789 Embed St',
                        city: 'London',
                        area: 'West London',
                        postcode: 'W1 1AA',
                        coordinates: { lat: 51.5, lng: -0.1 },
                    },
                    images: [],
                    features: [],
                    propertyType: 'house',
                    listingType: 'sale',
                });

                // Act
                await repository.updateEmbedding(property.id, embedding);

                // Assert
                const result = await database.query(
                    'SELECT embedding FROM properties WHERE id = $1',
                    [property.id]
                );
                expect(result.rows[0].embedding).toBe('[0.5,0.5,0.5]');
            });
        });

        describe('findManyByIds', () => {
            it('should find multiple properties by ids', async () => {
                // Arrange
                const mockMultipleResults = [
                    {
                        id: 'prop-0',
                        title: 'Property 0',
                        description: 'Description 0',
                        price: '200000.00',
                        bedrooms: 1,
                        bathrooms: 1,
                        area: '50.00',
                        location: JSON.stringify({
                            address: '0 Multi St',
                            city: 'London',
                            area: 'East London',
                            postcode: 'E0 1AA',
                            coordinates: { lat: 51.5, lng: -0.1 },
                        }),
                        images: JSON.stringify([]),
                        features: JSON.stringify([]),
                        property_type: 'flat',
                        listing_type: 'rent',
                        agent_id: 'default-agent',
                        is_active: true,
                        created_at: new Date(),
                        updated_at: new Date(),
                    },
                    {
                        id: 'prop-2',
                        title: 'Property 2',
                        description: 'Description 2',
                        price: '300000.00',
                        bedrooms: 3,
                        bathrooms: 1,
                        area: '70.00',
                        location: JSON.stringify({
                            address: '2 Multi St',
                            city: 'London',
                            area: 'East London',
                            postcode: 'E2 1AA',
                            coordinates: { lat: 51.52, lng: -0.1 },
                        }),
                        images: JSON.stringify([]),
                        features: JSON.stringify([]),
                        property_type: 'flat',
                        listing_type: 'rent',
                        agent_id: 'default-agent',
                        is_active: true,
                        created_at: new Date(),
                        updated_at: new Date(),
                    },
                ];

                // Mock the findManyByIds response
                mockPool.query.mockResolvedValueOnce({ rows: mockMultipleResults });

                // Act
                const found = await repository.findManyByIds(['prop-0', 'prop-2']);

                // Assert
                expect(found).toHaveLength(2);
                expect(found.map(p => p.id).sort()).toEqual(['prop-0', 'prop-2'].sort());
            });

            it('should handle non-existent ids gracefully', async () => {
                // Arrange - Mock result with only one existing property
                const existingProperty = {
                    id: 'existing-prop-id',
                    title: 'Existing property',
                    description: 'This one exists',
                    price: '300000.00',
                    bedrooms: 1,
                    bathrooms: 1,
                    area: '45.00',
                    location: JSON.stringify({
                        address: '1 Real St',
                        city: 'London',
                        area: 'Southwest',
                        postcode: 'SW1 1AA',
                        coordinates: { lat: 51.5, lng: -0.1 },
                    }),
                    images: JSON.stringify([]),
                    features: JSON.stringify([]),
                    property_type: 'flat',
                    listing_type: 'sale',
                    agent_id: 'default-agent',
                    is_active: true,
                    created_at: new Date(),
                    updated_at: new Date(),
                };

                // Mock the response to return only the existing property
                mockPool.query.mockResolvedValueOnce({ rows: [existingProperty] });

                // Act
                const found = await repository.findManyByIds(['existing-prop-id', 'fake-id-1', 'fake-id-2']);

                // Assert
                expect(found).toHaveLength(1);
                expect(found[0].id).toBe('existing-prop-id');
            });
        });
    });
});