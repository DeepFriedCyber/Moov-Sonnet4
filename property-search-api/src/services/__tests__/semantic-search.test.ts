// TDD RED PHASE - Semantic Search Service Tests
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import nock from 'nock';
import {
    SemanticSearchService,
    SearchOptions,
    EmbeddingServiceConfig
} from '../semantic-search';

describe('SemanticSearchService', () => {
    let service: SemanticSearchService;
    const config: EmbeddingServiceConfig = {
        embeddingUrls: ['http://primary:8001', 'http://secondary:8002'],
        timeout: 1000,
        retryAttempts: 2,
    };

    beforeEach(() => {
        service = new SemanticSearchService(config);
        nock.cleanAll();
    });

    afterEach(() => {
        nock.cleanAll();
    });

    describe('getEmbeddings', () => {
        it('should get embeddings from primary service', async () => {
            // Arrange
            const texts = ['Modern flat in London'];
            const mockEmbeddings = [[0.1, 0.2, 0.3]];

            nock('http://primary:8001')
                .post('/embed', { texts, model: 'primary' })
                .reply(200, {
                    embeddings: mockEmbeddings,
                    model_used: 'primary',
                    cached: false,
                });

            // Act
            const result = await service.getEmbeddings(texts);

            // Assert
            expect(result).toEqual(mockEmbeddings);
        });

        it('should failover to secondary service when primary fails', async () => {
            // Arrange
            const texts = ['Garden apartment'];
            const mockEmbeddings = [[0.4, 0.5, 0.6]];

            // Primary fails
            nock('http://primary:8001')
                .post('/embed')
                .times(2) // Will retry
                .reply(500, 'Internal Server Error');

            // Secondary succeeds
            nock('http://secondary:8002')
                .post('/embed', { texts, model: 'primary' })
                .reply(200, {
                    embeddings: mockEmbeddings,
                    model_used: 'secondary',
                    cached: false,
                });

            // Act
            const result = await service.getEmbeddings(texts);

            // Assert
            expect(result).toEqual(mockEmbeddings);
        });

        it('should retry on failure before failover', async () => {
            // Arrange
            const texts = ['Spacious house'];
            const mockEmbeddings = [[0.7, 0.8, 0.9]];

            // First attempt fails
            nock('http://primary:8001')
                .post('/embed')
                .reply(500, 'Temporary error');

            // Retry succeeds
            nock('http://primary:8001')
                .post('/embed')
                .reply(200, {
                    embeddings: mockEmbeddings,
                    model_used: 'primary',
                    cached: true,
                });

            // Act
            const result = await service.getEmbeddings(texts);

            // Assert
            expect(result).toEqual(mockEmbeddings);
        });

        it('should throw error when all services fail', async () => {
            // Arrange
            const texts = ['Test property'];

            // All attempts fail
            nock('http://primary:8001')
                .post('/embed')
                .times(2)
                .reply(500, 'Service unavailable');

            nock('http://secondary:8002')
                .post('/embed')
                .times(2)
                .reply(500, 'Service unavailable');

            // Act & Assert
            await expect(service.getEmbeddings(texts)).rejects.toThrow(
                'All embedding services failed'
            );
        });

        it('should handle network timeouts', async () => {
            // Arrange
            const texts = ['Timeout test'];
            const mockEmbeddings = [[1, 2, 3]];

            // Primary times out
            nock('http://primary:8001')
                .post('/embed')
                .times(2)
                .delayConnection(2000) // Longer than timeout
                .reply(200, { embeddings: mockEmbeddings });

            // Secondary works
            nock('http://secondary:8002')
                .post('/embed')
                .reply(200, { embeddings: mockEmbeddings });

            // Act
            const result = await service.getEmbeddings(texts);

            // Assert
            expect(result).toEqual(mockEmbeddings);
        });

        it('should rotate through services on subsequent calls', async () => {
            // Arrange
            const texts1 = ['First query'];
            const texts2 = ['Second query'];
            const embeddings1 = [[1, 1, 1]];
            const embeddings2 = [[2, 2, 2]];

            // Primary fails first time
            nock('http://primary:8001')
                .post('/embed', { texts: texts1, model: 'primary' })
                .times(2)
                .reply(500);

            // Secondary works first time
            nock('http://secondary:8002')
                .post('/embed', { texts: texts1, model: 'primary' })
                .reply(200, { embeddings: embeddings1 });

            // Secondary should be tried first on next call
            nock('http://secondary:8002')
                .post('/embed', { texts: texts2, model: 'primary' })
                .reply(200, { embeddings: embeddings2 });

            // Act
            const result1 = await service.getEmbeddings(texts1);
            const result2 = await service.getEmbeddings(texts2);

            // Assert
            expect(result1).toEqual(embeddings1);
            expect(result2).toEqual(embeddings2);
        });
    });

    describe('searchProperties', () => {
        const mockDatabase = {
            query: vi.fn(),
        };

        beforeEach(() => {
            service.setDatabase(mockDatabase);
            mockDatabase.query.mockClear();
        });

        it('should search properties with semantic similarity', async () => {
            // Arrange
            const searchOptions: SearchOptions = {
                query: 'Modern flat with balcony',
                filters: {
                    maxPrice: 500000,
                    minBedrooms: 2,
                },
                limit: 10,
            };

            const mockEmbedding = [0.1, 0.2, 0.3];
            const mockProperties = [
                {
                    id: '1',
                    similarity_score: 0.95,
                    title: 'Modern 2-bed flat with balcony'
                },
                {
                    id: '2',
                    similarity_score: 0.87,
                    title: 'Contemporary apartment with terrace'
                },
            ];

            nock('http://primary:8001')
                .post('/embed')
                .reply(200, { embeddings: [mockEmbedding] });

            mockDatabase.query.mockResolvedValueOnce({
                properties: mockProperties,
                total: 2,
            });

            // Act
            const result = await service.searchProperties(searchOptions);

            // Assert
            expect(result.properties).toEqual(mockProperties);
            expect(result.total).toBe(2);
            expect(result.searchTime).toBeGreaterThan(0);
            expect(mockDatabase.query).toHaveBeenCalledWith({
                embedding: mockEmbedding,
                filters: searchOptions.filters,
                limit: 10,
                offset: 0,
                similarityThreshold: 0.3,
            });
        });

        it('should handle empty search results', async () => {
            // Arrange
            const searchOptions: SearchOptions = {
                query: 'Unicorn property that does not exist',
            };

            nock('http://primary:8001')
                .post('/embed')
                .reply(200, { embeddings: [[0.1, 0.2, 0.3]] });

            mockDatabase.query.mockResolvedValueOnce({
                properties: [],
                total: 0,
            });

            // Act
            const result = await service.searchProperties(searchOptions);

            // Assert
            expect(result.properties).toEqual([]);
            expect(result.total).toBe(0);
        });

        it('should apply custom similarity threshold', async () => {
            // Arrange
            const searchOptions: SearchOptions = {
                query: 'Luxury penthouse',
                similarityThreshold: 0.8,
            };

            nock('http://primary:8001')
                .post('/embed')
                .reply(200, { embeddings: [[0.5, 0.5, 0.5]] });

            mockDatabase.query.mockResolvedValueOnce({
                properties: [],
                total: 0,
            });

            // Act
            await service.searchProperties(searchOptions);

            // Assert
            expect(mockDatabase.query).toHaveBeenCalledWith(
                expect.objectContaining({
                    similarityThreshold: 0.8,
                })
            );
        });

        it('should apply pagination parameters', async () => {
            // Arrange
            const searchOptions: SearchOptions = {
                query: 'City apartment',
                limit: 50,
                offset: 100,
            };

            nock('http://primary:8001')
                .post('/embed')
                .reply(200, { embeddings: [[0.3, 0.3, 0.3]] });

            mockDatabase.query.mockResolvedValueOnce({
                properties: [],
                total: 0,
            });

            // Act
            await service.searchProperties(searchOptions);

            // Assert
            expect(mockDatabase.query).toHaveBeenCalledWith(
                expect.objectContaining({
                    limit: 50,
                    offset: 100,
                })
            );
        });

        it('should throw error when database is not configured', async () => {
            // Arrange
            const serviceWithoutDb = new SemanticSearchService(config);
            const searchOptions: SearchOptions = {
                query: 'Any property',
            };

            // Act & Assert
            await expect(serviceWithoutDb.searchProperties(searchOptions))
                .rejects.toThrow('Database not configured');
        });

        it('should validate search options', async () => {
            // Arrange
            const invalidOptions = {
                query: '', // Empty query
                limit: -1, // Invalid limit
            } as SearchOptions;

            // Act & Assert
            await expect(service.searchProperties(invalidOptions))
                .rejects.toThrow();
        });
    });

    describe('caching', () => {
        it('should cache embedding results', async () => {
            // Arrange
            const texts = ['Cached query'];
            const mockEmbeddings = [[0.1, 0.2, 0.3]];

            // Only set up one response - if called twice, test will fail
            nock('http://primary:8001')
                .post('/embed', { texts, model: 'primary' })
                .once() // Important: only respond once
                .reply(200, {
                    embeddings: mockEmbeddings,
                    cached: false,
                });

            // Act
            const result1 = await service.getEmbeddings(texts);
            const result2 = await service.getEmbeddings(texts);

            // Assert
            expect(result1).toEqual(mockEmbeddings);
            expect(result2).toEqual(mockEmbeddings);
            // If nock was called twice, it would throw an error
        });

        it('should cache with different texts separately', async () => {
            // Arrange
            const texts1 = ['Query 1'];
            const texts2 = ['Query 2'];
            const embeddings1 = [[1, 1, 1]];
            const embeddings2 = [[2, 2, 2]];

            nock('http://primary:8001')
                .post('/embed', { texts: texts1, model: 'primary' })
                .reply(200, { embeddings: embeddings1 });

            nock('http://primary:8001')
                .post('/embed', { texts: texts2, model: 'primary' })
                .reply(200, { embeddings: embeddings2 });

            // Act
            const result1 = await service.getEmbeddings(texts1);
            const result2 = await service.getEmbeddings(texts2);

            // Assert
            expect(result1).toEqual(embeddings1);
            expect(result2).toEqual(embeddings2);
        });

        it('should expire cache after TTL', async () => {
            // Arrange
            vi.useFakeTimers();
            const texts = ['Expiring query'];
            const embeddings1 = [[1, 1, 1]];
            const embeddings2 = [[2, 2, 2]];

            nock('http://primary:8001')
                .post('/embed')
                .reply(200, { embeddings: embeddings1 });

            // Act
            const result1 = await service.getEmbeddings(texts);

            // Advance time past cache TTL (1 hour)
            vi.advanceTimersByTime(3600 * 1000 + 1);

            nock('http://primary:8001')
                .post('/embed')
                .reply(200, { embeddings: embeddings2 });

            const result2 = await service.getEmbeddings(texts);

            // Assert
            expect(result1).toEqual(embeddings1);
            expect(result2).toEqual(embeddings2);

            vi.useRealTimers();
        });
    });
});