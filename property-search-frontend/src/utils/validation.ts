// TDD-Driven Property Search Validation Utils
import { Property } from '@/types';

// Validation result interface
export interface ValidationResult {
    isValid: boolean;
    errors: string[];
    warnings?: string[];
    suggestions?: string[];
}

// Custom error class for search validation
export class SearchValidationError extends Error {
    public code: string;
    public suggestions?: string[];

    constructor(message: string, code: string, suggestions?: string[]) {
        super(message);
        this.name = 'SearchValidationError';
        this.code = code;
        this.suggestions = suggestions;
    }
}

// Property filter interface
export interface PropertyFilters {
    bedrooms?: number;
    bathrooms?: number;
    propertyType?: Property['propertyType'];
    minPrice?: number;
    maxPrice?: number;
    location?: string;
    features?: string[];
    [key: string]: any; // Allow additional properties
}

/**
 * Validates search query input
 */
export function validateSearchQuery(query: string): ValidationResult {
    const errors: string[] = [];
    const suggestions: string[] = [];

    // Check if query is empty or whitespace only
    if (!query || query.trim().length === 0) {
        errors.push('Search query cannot be empty');
        suggestions.push('Try searching for "2 bedroom apartment" or "house in London"');
        return { isValid: false, errors, suggestions };
    }

    // Check minimum length
    if (query.trim().length < 2) {
        errors.push('Search query must be at least 2 characters long');
        suggestions.push('Add more details like "2 bed flat" or "house London"');
    }

    // Check maximum length
    if (query.length > 500) {
        errors.push('Search query must be less than 500 characters');
        suggestions.push('Try to be more concise in your search');
    }

    // Check if query contains at least one alphanumeric character
    if (!/[a-zA-Z0-9]/.test(query)) {
        errors.push('Search query must contain at least one letter or number');
        suggestions.push('Include property details like "apartment", "house", or "2 bedroom"');
    }

    return {
        isValid: errors.length === 0,
        errors,
        suggestions: suggestions.length > 0 ? suggestions : undefined
    };
}

/**
 * Sanitizes search input to prevent XSS and normalize content
 */
export function sanitizeSearchInput(input: string): string {
    if (!input) return '';

    // Remove HTML tags and script content
    let sanitized = input.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    sanitized = sanitized.replace(/<[^>]*>/g, '');

    // Remove script-like content that might not be in tags
    sanitized = sanitized.replace(/javascript:/gi, '');
    sanitized = sanitized.replace(/on\w+\s*=/gi, '');

    // Normalize whitespace
    sanitized = sanitized.replace(/\s+/g, ' ').trim();

    // Remove excessive punctuation (more than 2 consecutive)
    sanitized = sanitized.replace(/([!?.]){3,}/g, '$1');

    return sanitized;
}

/**
 * Formats search query for display
 */
export function formatSearchQuery(query: string): string {
    if (!query) return '';

    // Capitalize first letter
    const formatted = query.charAt(0).toUpperCase() + query.slice(1);

    // Ensure price formats are consistent
    return formatted.replace(/(\d+)k/gi, '£$1,000')
        .replace(/£(\d+),(\d+)/g, '£$1,$2');
}

/**
 * Validates price range
 */
export function validatePriceRange(minPrice?: number, maxPrice?: number): ValidationResult {
    const errors: string[] = [];
    const suggestions: string[] = [];

    // If no prices provided, it's valid
    if (minPrice === undefined && maxPrice === undefined) {
        return { isValid: true, errors: [] };
    }

    // Check for negative prices
    if (minPrice !== undefined && minPrice < 0) {
        errors.push('Minimum price cannot be negative');
        suggestions.push('Try a range like £200,000 - £500,000');
    }

    if (maxPrice !== undefined && maxPrice < 0) {
        errors.push('Maximum price cannot be negative');
        suggestions.push('Try a range like £200,000 - £500,000');
    }

    // Check if min > max
    if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
        errors.push('Minimum price cannot be greater than maximum price');
        suggestions.push('Make sure minimum price is less than maximum price');
    }

    // Check for unrealistic ranges
    if (maxPrice !== undefined && maxPrice > 50000000) { // 50 million
        errors.push('Price range seems unrealistic');
        suggestions.push('Try a more reasonable price range like £200,000 - £2,000,000');
    }

    return {
        isValid: errors.length === 0,
        errors,
        suggestions: suggestions.length > 0 ? suggestions : undefined
    };
}

/**
 * Validates property filters
 */
export function validatePropertyFilters(filters: PropertyFilters): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Validate bedrooms
    if (filters.bedrooms !== undefined) {
        if (filters.bedrooms < 0) {
            errors.push('Number of bedrooms must be 0 or greater');
        }
        if (filters.bedrooms > 20) {
            warnings.push('Very high number of bedrooms - are you sure?');
        }
    }

    // Validate bathrooms
    if (filters.bathrooms !== undefined) {
        if (filters.bathrooms < 0) {
            errors.push('Number of bathrooms must be 0 or greater');
        }
        if (filters.bathrooms > 15) {
            warnings.push('Very high number of bathrooms - are you sure?');
        }
    }

    // Validate bedroom/bathroom ratio
    if (filters.bedrooms !== undefined && filters.bathrooms !== undefined) {
        if (filters.bedrooms > 0 && filters.bathrooms > filters.bedrooms * 3) {
            errors.push('Bathroom to bedroom ratio seems unrealistic');
            suggestions.push('Typically properties have 1-2 bathrooms per bedroom');
        }
    }

    // Validate property type
    if (filters.propertyType !== undefined) {
        const validTypes = ['apartment', 'house', 'flat', 'studio', 'penthouse', 'townhouse'];
        if (!validTypes.includes(filters.propertyType)) {
            errors.push('Invalid property type');
            suggestions.push(`Valid types are: ${validTypes.join(', ')}`);
        }
    }

    // Validate location
    if (filters.location !== undefined) {
        // Check for invalid characters (basic validation)
        if (!/^[a-zA-Z0-9\s,.-]+$/.test(filters.location)) {
            errors.push('Location contains invalid characters');
            suggestions.push('Use only letters, numbers, spaces, commas, periods, and hyphens');
        }

        if (filters.location.length > 100) {
            errors.push('Location name is too long');
        }
    }

    // Validate price range if both are present
    if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
        const priceValidation = validatePriceRange(filters.minPrice, filters.maxPrice);
        errors.push(...priceValidation.errors);
        if (priceValidation.suggestions) {
            suggestions.push(...priceValidation.suggestions);
        }
    }

    return {
        isValid: errors.length === 0,
        errors,
        warnings: warnings.length > 0 ? warnings : undefined,
        suggestions: suggestions.length > 0 ? suggestions : undefined
    };
}

/**
 * Validates complete search form data
 */
export function validateSearchForm(query: string, filters: PropertyFilters): ValidationResult {
    const queryValidation = validateSearchQuery(query);
    const filtersValidation = validatePropertyFilters(filters);

    const allErrors = [...queryValidation.errors, ...filtersValidation.errors];
    const allSuggestions = [
        ...(queryValidation.suggestions || []),
        ...(filtersValidation.suggestions || [])
    ];

    return {
        isValid: allErrors.length === 0,
        errors: allErrors,
        warnings: filtersValidation.warnings,
        suggestions: allSuggestions.length > 0 ? allSuggestions : undefined
    };
}

/**
 * Validates and sanitizes user input for search
 */
export function processSearchInput(rawQuery: string, rawFilters: PropertyFilters) {
    // Sanitize query
    const sanitizedQuery = sanitizeSearchInput(rawQuery);

    // Validate sanitized input
    const validation = validateSearchForm(sanitizedQuery, rawFilters);

    if (!validation.isValid) {
        throw new SearchValidationError(
            validation.errors.join('; '),
            'VALIDATION_FAILED',
            validation.suggestions
        );
    }

    return {
        query: formatSearchQuery(sanitizedQuery),
        filters: rawFilters,
        validation
    };
}

/**
 * Helper function to get validation error messages for UI display
 */
export function getValidationErrorMessage(error: unknown): string {
    if (error instanceof SearchValidationError) {
        return error.message;
    }

    if (error instanceof Error) {
        return error.message;
    }

    return 'An unexpected validation error occurred';
}

/**
 * Helper function to check if a search query looks like it might be semantic
 */
export function isSemanticQuery(query: string): boolean {
    const semanticIndicators = [
        'near', 'close to', 'walking distance', 'minutes from',
        'family', 'luxury', 'modern', 'traditional', 'spacious',
        'quiet', 'busy', 'central', 'suburban',
        'with', 'without', 'including', 'excluding',
        'perfect for', 'ideal for', 'suitable for'
    ];

    const lowerQuery = query.toLowerCase();
    return semanticIndicators.some(indicator => lowerQuery.includes(indicator));
}

/**
 * Extract structured data from natural language query
 */
export function extractQueryStructure(query: string) {
    const structure = {
        bedrooms: null as number | null,
        propertyType: null as string | null,
        location: null as string | null,
        priceRange: null as { min?: number; max?: number } | null,
        features: [] as string[],
        sentiment: 'neutral' as 'positive' | 'negative' | 'neutral'
    };

    const lowerQuery = query.toLowerCase();

    // Extract bedrooms
    const bedroomMatch = lowerQuery.match(/(\d+)\s*(?:bed|bedroom)/);
    if (bedroomMatch) {
        structure.bedrooms = parseInt(bedroomMatch[1]);
    }

    // Extract property type
    const propertyTypes = ['apartment', 'flat', 'house', 'studio', 'penthouse'];
    for (const type of propertyTypes) {
        if (lowerQuery.includes(type)) {
            structure.propertyType = type;
            break;
        }
    }

    // Extract location (simple pattern)
    const locationMatch = lowerQuery.match(/(?:in|near|at)\s+([a-zA-Z\s]+?)(?:\s|$|,)/);
    if (locationMatch) {
        structure.location = locationMatch[1].trim();
    }

    // Extract price range
    const priceMatch = lowerQuery.match(/£?(\d+)k?(?:\s*-\s*£?(\d+)k?)?/);
    if (priceMatch) {
        const min = parseInt(priceMatch[1]) * (priceMatch[1].includes('k') ? 1000 : 1);
        const max = priceMatch[2] ? parseInt(priceMatch[2]) * (priceMatch[2].includes('k') ? 1000 : 1) : undefined;
        structure.priceRange = { min, max };
    }

    // Extract features
    const featureKeywords = ['garden', 'parking', 'balcony', 'gym', 'pool', 'lift', 'concierge'];
    structure.features = featureKeywords.filter(feature => lowerQuery.includes(feature));

    // Determine sentiment
    const positiveWords = ['luxury', 'beautiful', 'stunning', 'perfect', 'amazing'];
    const negativeWords = ['cheap', 'basic', 'simple', 'budget'];

    if (positiveWords.some(word => lowerQuery.includes(word))) {
        structure.sentiment = 'positive';
    } else if (negativeWords.some(word => lowerQuery.includes(word))) {
        structure.sentiment = 'negative';
    }

    return structure;
}