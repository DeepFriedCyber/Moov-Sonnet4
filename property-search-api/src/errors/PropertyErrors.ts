import { AppError } from './AppError';

export class PropertySearchError extends AppError {
    public readonly searchType: string;
    public readonly suggestions: string[];
    public readonly fallback?: string;

    constructor(message: string, searchType: string, suggestions: string[] = []) {
        super(message, 503);
        this.searchType = searchType;
        this.suggestions = suggestions.length > 0 ? suggestions : this.getDefaultSuggestions();
        this.fallback = this.getFallbackOption(searchType);
    }

    private getDefaultSuggestions(): string[] {
        return [
            'Try again in a few moments',
            'Use fewer search filters',
            'Contact support if the issue persists'
        ];
    }

    private getFallbackOption(searchType: string): string | undefined {
        const fallbacks: Record<string, string> = {
            'embedding_service_error': 'basic_text_search',
            'meilisearch_down': 'database_search',
            'timeout': 'cached_results'
        };
        return fallbacks[searchType];
    }

    toJSON() {
        return {
            ...super.toJSON(),
            searchType: this.searchType,
            suggestions: this.suggestions,
            ...(this.fallback && { fallback: this.fallback })
        };
    }
}

export class PropertyNotFoundError extends AppError {
    public readonly propertyId: string;
    public readonly suggestions: string[];

    constructor(propertyId: string) {
        super('Property not found', 404);
        this.propertyId = propertyId;
        this.suggestions = [
            'Check the property ID is correct',
            'The property may have been sold or removed',
            'Browse similar properties in the area'
        ];
    }

    toJSON() {
        return {
            ...super.toJSON(),
            propertyId: this.propertyId,
            suggestions: this.suggestions
        };
    }
}

export class PropertyValidationError extends AppError {
    public readonly field: string;
    public readonly value: any;
    public readonly constraint: string;

    constructor(field: string, value: any, constraint: string) {
        super(`Invalid value for ${field}`, 400);
        this.field = field;
        this.value = value;
        this.constraint = constraint;
    }

    toJSON() {
        return {
            ...super.toJSON(),
            field: this.field,
            value: this.value,
            constraint: this.constraint
        };
    }
}