// TDD Tests for Property Search Validation Utils
import { describe, it, expect, beforeEach } from 'vitest';
import {
    validateSearchQuery,
    validatePriceRange,
    validatePropertyFilters,
    sanitizeSearchInput,
    formatSearchQuery,
    SearchValidationError
} from '../validation';

describe('Property Search Validation - TDD Implementation', () => {
    describe('Search Query Validation', () => {
        describe('validateSearchQuery', () => {
            it('should accept valid search queries', () => {
                const validQueries = [
                    '2 bedroom apartment',
                    'house in london',
                    'luxury flat with garden',
                    'property under £500k',
                    'modern apartment near station'
                ];

                validQueries.forEach(query => {
                    const result = validateSearchQuery(query);
                    expect(result.isValid).toBe(true);
                    expect(result.errors).toHaveLength(0);
                });
            });

            it('should reject empty or whitespace-only queries', () => {
                const invalidQueries = ['', '   ', '\t\n', '  \t  '];

                invalidQueries.forEach(query => {
                    const result = validateSearchQuery(query);
                    expect(result.isValid).toBe(false);
                    expect(result.errors).toContain('Search query cannot be empty');
                });
            });

            it('should reject queries that are too short', () => {
                const shortQueries = ['a', 'x'];

                shortQueries.forEach(query => {
                    const result = validateSearchQuery(query);
                    expect(result.isValid).toBe(false);
                    expect(result.errors).toContain('Search query must be at least 2 characters long');
                });
            });

            it('should reject queries that are too long', () => {
                const longQuery = 'a'.repeat(501);

                const result = validateSearchQuery(longQuery);
                expect(result.isValid).toBe(false);
                expect(result.errors).toContain('Search query must be less than 500 characters');
            });

            it('should reject queries with only special characters', () => {
                const specialCharQueries = ['!!!', '@@@', '###', '***'];

                specialCharQueries.forEach(query => {
                    const result = validateSearchQuery(query);
                    expect(result.isValid).toBe(false);
                    expect(result.errors).toContain('Search query must contain at least one letter or number');
                });
            });

            it('should accept queries with mixed content', () => {
                const mixedQueries = [
                    '2-bed flat!',
                    'house @ £300k',
                    'apartment (central)',
                    'property - luxury'
                ];

                mixedQueries.forEach(query => {
                    const result = validateSearchQuery(query);
                    expect(result.isValid).toBe(true);
                });
            });

            it('should provide helpful error messages', () => {
                const result = validateSearchQuery('');

                expect(result.errors).toContain('Search query cannot be empty');
                expect(result.suggestions).toContain('Try searching for "2 bedroom apartment" or "house in London"');
            });
        });

        describe('sanitizeSearchInput', () => {
            it('should remove dangerous HTML tags', () => {
                const dangerousInput = '<script>alert("xss")</script>apartment';
                const sanitized = sanitizeSearchInput(dangerousInput);

                expect(sanitized).toBe('apartment');
                expect(sanitized).not.toContain('<script>');
            });

            it('should preserve safe content', () => {
                const safeInput = '2 bedroom apartment in London £300k-£500k';
                const sanitized = sanitizeSearchInput(safeInput);

                expect(sanitized).toBe(safeInput);
            });

            it('should normalize whitespace', () => {
                const messyInput = '  2   bedroom    apartment  ';
                const sanitized = sanitizeSearchInput(messyInput);

                expect(sanitized).toBe('2 bedroom apartment');
            });

            it('should handle special characters appropriately', () => {
                const specialInput = 'apartment £300k-£500k (2-bed)';
                const sanitized = sanitizeSearchInput(specialInput);

                expect(sanitized).toBe('apartment £300k-£500k (2-bed)');
            });

            it('should remove excessive punctuation', () => {
                const excessiveInput = 'apartment!!!!!! luxury??????';
                const sanitized = sanitizeSearchInput(excessiveInput);

                expect(sanitized).toBe('apartment! luxury?');
            });
        });

        describe('formatSearchQuery', () => {
            it('should capitalize first letter', () => {
                const query = 'apartment in london';
                const formatted = formatSearchQuery(query);

                expect(formatted).toBe('Apartment in london');
            });

            it('should preserve existing capitalization', () => {
                const query = 'Modern Apartment in London';
                const formatted = formatSearchQuery(query);

                expect(formatted).toBe('Modern Apartment in London');
            });

            it('should handle empty strings', () => {
                const formatted = formatSearchQuery('');

                expect(formatted).toBe('');
            });

            it('should format price ranges consistently', () => {
                const queries = [
                    '£300k-£500k apartment',
                    '300k-500k apartment',
                    '£300,000-£500,000 apartment'
                ];

                queries.forEach(query => {
                    const formatted = formatSearchQuery(query);
                    expect(formatted).toContain('£');
                });
            });
        });
    });

    describe('Price Range Validation', () => {
        describe('validatePriceRange', () => {
            it('should accept valid price ranges', () => {
                const validRanges = [
                    { min: 100000, max: 500000 },
                    { min: 0, max: 1000000 },
                    { min: 250000, max: 750000 }
                ];

                validRanges.forEach(range => {
                    const result = validatePriceRange(range.min, range.max);
                    expect(result.isValid).toBe(true);
                    expect(result.errors).toHaveLength(0);
                });
            });

            it('should reject negative prices', () => {
                const result = validatePriceRange(-100000, 500000);

                expect(result.isValid).toBe(false);
                expect(result.errors).toContain('Minimum price cannot be negative');
            });

            it('should reject when min price is greater than max price', () => {
                const result = validatePriceRange(600000, 400000);

                expect(result.isValid).toBe(false);
                expect(result.errors).toContain('Minimum price cannot be greater than maximum price');
            });

            it('should reject unrealistic price ranges', () => {
                const result = validatePriceRange(0, 100000000); // 100 million

                expect(result.isValid).toBe(false);
                expect(result.errors).toContain('Price range seems unrealistic');
            });

            it('should accept single price point (min = max)', () => {
                const result = validatePriceRange(300000, 300000);

                expect(result.isValid).toBe(true);
            });

            it('should provide price range suggestions', () => {
                const result = validatePriceRange(-100000, 500000);

                expect(result.suggestions).toContain('Try a range like £200,000 - £500,000');
            });
        });
    });

    describe('Property Filters Validation', () => {
        describe('validatePropertyFilters', () => {
            it('should accept valid filter combinations', () => {
                const validFilters = {
                    bedrooms: 2,
                    bathrooms: 1,
                    propertyType: 'apartment' as const,
                    minPrice: 200000,
                    maxPrice: 500000,
                    location: 'london'
                };

                const result = validatePropertyFilters(validFilters);
                expect(result.isValid).toBe(true);
                expect(result.errors).toHaveLength(0);
            });

            it('should reject invalid bedroom counts', () => {
                const invalidFilters = {
                    bedrooms: -1,
                    propertyType: 'apartment' as const
                };

                const result = validatePropertyFilters(invalidFilters);
                expect(result.isValid).toBe(false);
                expect(result.errors).toContain('Number of bedrooms must be 0 or greater');
            });

            it('should reject invalid bathroom counts', () => {
                const invalidFilters = {
                    bathrooms: -1,
                    propertyType: 'house' as const
                };

                const result = validatePropertyFilters(invalidFilters);
                expect(result.isValid).toBe(false);
                expect(result.errors).toContain('Number of bathrooms must be 0 or greater');
            });

            it('should reject unrealistic bedroom/bathroom combinations', () => {
                const unrealisticFilters = {
                    bedrooms: 1,
                    bathrooms: 10,
                    propertyType: 'apartment' as const
                };

                const result = validatePropertyFilters(unrealisticFilters);
                expect(result.isValid).toBe(false);
                expect(result.errors).toContain('Bathroom to bedroom ratio seems unrealistic');
            });

            it('should validate property types', () => {
                const invalidFilters = {
                    propertyType: 'castle' as any
                };

                const result = validatePropertyFilters(invalidFilters);
                expect(result.isValid).toBe(false);
                expect(result.errors).toContain('Invalid property type');
            });

            it('should accept empty filters', () => {
                const result = validatePropertyFilters({});
                expect(result.isValid).toBe(true);
            });

            it('should validate location format', () => {
                const invalidFilters = {
                    location: '123!@#$%^&*()',
                    propertyType: 'apartment' as const
                };

                const result = validatePropertyFilters(invalidFilters);
                expect(result.isValid).toBe(false);
                expect(result.errors).toContain('Location contains invalid characters');
            });
        });
    });

    describe('Error Handling', () => {
        describe('SearchValidationError', () => {
            it('should create proper error objects', () => {
                const error = new SearchValidationError('Test error', 'INVALID_QUERY');

                expect(error.message).toBe('Test error');
                expect(error.code).toBe('INVALID_QUERY');
                expect(error.name).toBe('SearchValidationError');
            });

            it('should include suggestions when provided', () => {
                const error = new SearchValidationError(
                    'Invalid query',
                    'INVALID_QUERY',
                    ['Try "2 bedroom apartment"', 'Try "house in London"']
                );

                expect(error.suggestions).toHaveLength(2);
                expect(error.suggestions).toContain('Try "2 bedroom apartment"');
            });

            it('should be instanceof Error', () => {
                const error = new SearchValidationError('Test', 'TEST');

                expect(error instanceof Error).toBe(true);
                expect(error instanceof SearchValidationError).toBe(true);
            });
        });
    });

    describe('Integration Tests', () => {
        it('should validate complete search form data', () => {
            const formData = {
                query: '2 bedroom apartment in london',
                filters: {
                    minPrice: 300000,
                    maxPrice: 600000,
                    bedrooms: 2,
                    propertyType: 'apartment' as const,
                    location: 'london'
                }
            };

            const queryValidation = validateSearchQuery(formData.query);
            const filtersValidation = validatePropertyFilters(formData.filters);
            const priceValidation = validatePriceRange(
                formData.filters.minPrice!,
                formData.filters.maxPrice!
            );

            expect(queryValidation.isValid).toBe(true);
            expect(filtersValidation.isValid).toBe(true);
            expect(priceValidation.isValid).toBe(true);
        });

        it('should handle complex validation scenarios', () => {
            const complexFormData = {
                query: sanitizeSearchInput('<script>alert("xss")</script>luxury apartment'),
                filters: {
                    minPrice: 0,
                    maxPrice: 2000000,
                    bedrooms: 3,
                    bathrooms: 2,
                    propertyType: 'apartment' as const,
                    location: 'central london'
                }
            };

            const queryValidation = validateSearchQuery(complexFormData.query);
            const filtersValidation = validatePropertyFilters(complexFormData.filters);

            expect(queryValidation.isValid).toBe(true);
            expect(filtersValidation.isValid).toBe(true);
            expect(complexFormData.query).toBe('luxury apartment');
        });
    });

    describe('Performance Tests', () => {
        it('should validate queries quickly', () => {
            const query = '2 bedroom apartment in central london under £500k';

            const start = Date.now();
            for (let i = 0; i < 1000; i++) {
                validateSearchQuery(query);
            }
            const end = Date.now();

            expect(end - start).toBeLessThan(100); // Should complete 1000 validations in under 100ms
        });

        it('should handle large filter objects efficiently', () => {
            const largeFilters = {
                bedrooms: 3,
                bathrooms: 2,
                propertyType: 'house' as const,
                minPrice: 300000,
                maxPrice: 800000,
                location: 'london',
                features: Array(100).fill('feature'),
                // Add many more properties
                ...Object.fromEntries(Array(50).fill(0).map((_, i) => [`prop${i}`, `value${i}`]))
            };

            const start = Date.now();
            validatePropertyFilters(largeFilters);
            const end = Date.now();

            expect(end - start).toBeLessThan(50); // Should validate quickly even with large objects
        });
    });
});