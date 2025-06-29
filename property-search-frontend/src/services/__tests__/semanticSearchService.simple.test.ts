// Simple TDD Tests for Semantic Search Service
import { describe, it, expect } from 'vitest';
import { SemanticSearchService } from '../semanticSearchService';

describe('SemanticSearchService - Core Functionality', () => {
    const service = new SemanticSearchService();

    describe('Query Analysis', () => {
        it('should extract bedrooms from query', () => {
            const analysis = service.analyzeQuery('2 bedroom apartment');

            expect(analysis.extractedFilters.bedrooms).toBe(2);
            expect(analysis.intent).toContain('2 bedroom');
        });

        it('should extract price range', () => {
            const analysis = service.analyzeQuery('apartment £200k-£400k');

            expect(analysis.extractedFilters.minPrice).toBe(200000);
            expect(analysis.extractedFilters.maxPrice).toBe(400000);
        });

        it('should extract property type', () => {
            const analysis = service.analyzeQuery('modern apartment');

            expect(analysis.extractedFilters.propertyType).toBe('apartment');
        });

        it('should extract location', () => {
            const analysis = service.analyzeQuery('house in london');

            expect(analysis.extractedFilters.location).toBe('london');
        });

        it('should handle empty query', () => {
            const analysis = service.analyzeQuery('');

            expect(analysis.intent).toBe('General property search');
            expect(analysis.confidence).toBe(0);
        });
    });

    describe('Suggestions', () => {
        it('should generate location suggestions', () => {
            const suggestions = service.generateSuggestions('lon');

            expect(suggestions).toContain('Properties in london');
        });

        it('should generate bedroom suggestions', () => {
            const suggestions = service.generateSuggestions('bed');

            expect(suggestions).toContain('2 bedroom apartment');
        });

        it('should limit suggestions', () => {
            const suggestions = service.generateSuggestions('a');

            expect(suggestions.length).toBeLessThanOrEqual(5);
        });
    });

    describe('Performance', () => {
        it('should analyze query quickly', () => {
            const start = Date.now();
            service.analyzeQuery('2 bedroom apartment in london £300k-£500k');
            const end = Date.now();

            expect(end - start).toBeLessThan(50); // Should complete within 50ms
        });
    });
});