// REFACTORED SearchBar Component - Enhanced Architecture
'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';

// Enhanced type definitions with better documentation
export interface SearchFilters {
    priceMin?: number;
    priceMax?: number;
    bedrooms?: number;
    bathrooms?: number;
    propertyType?: 'house' | 'apartment' | 'condo' | 'townhouse' | string;
    location?: string;
}

export interface SearchBarProps {
    onSearch: (query: string, filters: SearchFilters) => void;
    onFiltersChange?: (filters: SearchFilters) => void;
    placeholder?: string;
    isLoading?: boolean;
    showFilters?: boolean;
    defaultFilters?: SearchFilters;
    recentSearches?: string[];
    error?: string;
}

// Constants for better maintainability
const SEARCH_DEFAULTS = {
    PLACEHOLDER: 'Search properties...',
    RECENT_SEARCH_DELAY: 150,
    PROPERTY_TYPES: [
        { value: '', label: 'Any Type' },
        { value: 'house', label: 'House' },
        { value: 'apartment', label: 'Apartment' },
        { value: 'condo', label: 'Condo' },
        { value: 'townhouse', label: 'Townhouse' },
    ],
} as const;

// Custom hooks for better separation of concerns
function useSearchState(defaultFilters: SearchFilters) {
    const [query, setQuery] = useState('');
    const [filters, setFilters] = useState<SearchFilters>(defaultFilters);
    const [showFiltersPanel, setShowFiltersPanel] = useState(false);
    const [showRecentSearches, setShowRecentSearches] = useState(false);

    const resetState = useCallback(() => {
        setQuery('');
        setShowFiltersPanel(false);
        setShowRecentSearches(false);
    }, []);

    return {
        query,
        setQuery,
        filters,
        setFilters,
        showFiltersPanel,
        setShowFiltersPanel,
        showRecentSearches,
        setShowRecentSearches,
        resetState,
    };
}

function useErrorState(error?: string) {
    const [currentError, setCurrentError] = useState(error);

    useEffect(() => {
        setCurrentError(error);
    }, [error]);

    const clearError = useCallback(() => {
        setCurrentError(undefined);
    }, []);

    return { currentError, clearError };
}

// Main SearchBar component with improved architecture
export function SearchBar({
    onSearch,
    onFiltersChange,
    placeholder = SEARCH_DEFAULTS.PLACEHOLDER,
    isLoading = false,
    showFilters = false,
    defaultFilters = {},
    recentSearches = [],
    error,
}: SearchBarProps) {
    const inputRef = useRef<HTMLInputElement>(null);
    const {
        query,
        setQuery,
        filters,
        setFilters,
        showFiltersPanel,
        setShowFiltersPanel,
        showRecentSearches,
        setShowRecentSearches,
    } = useSearchState(defaultFilters);
    const { currentError, clearError } = useErrorState(error);

    // Clear error when query changes
    useEffect(() => {
        if (query && currentError) {
            clearError();
        }
    }, [query, currentError, clearError]);

    // Memoized handlers for performance
    const handleSubmit = useCallback(
        (e: React.FormEvent) => {
            e.preventDefault();
            const trimmedQuery = query.trim();
            if (trimmedQuery) {
                onSearch(trimmedQuery, filters);
            }
        },
        [query, filters, onSearch]
    );

    const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setQuery(e.target.value);
    }, [setQuery]);

    const handleInputFocus = useCallback(() => {
        if (recentSearches.length > 0) {
            setShowRecentSearches(true);
        }
    }, [recentSearches.length, setShowRecentSearches]);

    const handleInputBlur = useCallback(() => {
        // Delay hiding to allow clicking on recent searches
        setTimeout(() => setShowRecentSearches(false), SEARCH_DEFAULTS.RECENT_SEARCH_DELAY);
    }, [setShowRecentSearches]);

    const handleRecentSearchClick = useCallback(
        (searchTerm: string) => {
            setQuery(searchTerm);
            setShowRecentSearches(false);
        },
        [setQuery, setShowRecentSearches]
    );

    const handleFiltersToggle = useCallback(() => {
        setShowFiltersPanel(prev => !prev);
    }, [setShowFiltersPanel]);

    const handleFilterChange = useCallback(
        (filterKey: keyof SearchFilters, value: any) => {
            const newFilters = { ...filters, [filterKey]: value };
            setFilters(newFilters);
            if (onFiltersChange) {
                onFiltersChange(newFilters);
            }
        },
        [filters, setFilters, onFiltersChange]
    );

    // Memoized computed values
    const searchButtonLabel = useMemo(
        () => (isLoading ? 'Searching' : 'Submit search'),
        [isLoading]
    );

    const searchButtonText = useMemo(
        () => (isLoading ? 'Searching' : 'Search'),
        [isLoading]
    );

    return (
        <SearchBarContainer>
            <ErrorDisplay error={currentError} />
            <SearchForm onSubmit={handleSubmit}>
                <SearchInputContainer>
                    <SearchInput
                        ref={inputRef}
                        value={query}
                        onChange={handleInputChange}
                        onFocus={handleInputFocus}
                        onBlur={handleInputBlur}
                        placeholder={placeholder}
                        disabled={isLoading}
                    />
                    <RecentSearchesDropdown
                        show={showRecentSearches}
                        searches={recentSearches}
                        onSelect={handleRecentSearchClick}
                    />
                </SearchInputContainer>
                <SearchActions>
                    {showFilters && (
                        <FiltersToggleButton onClick={handleFiltersToggle} />
                    )}
                    <SearchSubmitButton
                        isLoading={isLoading}
                        label={searchButtonLabel}
                        text={searchButtonText}
                    />
                </SearchActions>
            </SearchForm>
            {showFilters && showFiltersPanel && (
                <FiltersPanel
                    filters={filters}
                    onChange={handleFilterChange}
                />
            )}
        </SearchBarContainer>
    );
}

// Extracted sub-components for better modularity
const SearchBarContainer: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="search-bar">{children}</div>
);

const ErrorDisplay: React.FC<{ error?: string }> = ({ error }) => {
    if (!error) return null;
    return (
        <div role="alert" className="error-message">
            {error}
        </div>
    );
};

const SearchForm: React.FC<{ onSubmit: (e: React.FormEvent) => void; children: React.ReactNode }> = ({
    onSubmit,
    children,
}) => (
    <form onSubmit={onSubmit} className="search-form">
        {children}
    </form>
);

const SearchInputContainer: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="search-input-container">{children}</div>
);

const SearchInput = React.forwardRef<
    HTMLInputElement,
    {
        value: string;
        onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
        onFocus: () => void;
        onBlur: () => void;
        placeholder: string;
        disabled: boolean;
    }
>(({ value, onChange, onFocus, onBlur, placeholder, disabled }, ref) => (
    <input
        ref={ref}
        type="text"
        value={value}
        onChange={onChange}
        onFocus={onFocus}
        onBlur={onBlur}
        placeholder={placeholder}
        disabled={disabled}
        aria-label="Search for properties"
        className="search-input"
    />
));

const RecentSearchesDropdown: React.FC<{
    show: boolean;
    searches: string[];
    onSelect: (search: string) => void;
}> = ({ show, searches, onSelect }) => {
    if (!show || searches.length === 0) return null;

    return (
        <div data-testid="recent-searches" className="recent-searches-dropdown">
            {searches.map((search, index) => (
                <button
                    key={index}
                    type="button"
                    onClick={() => onSelect(search)}
                    className="recent-search-item"
                >
                    {search}
                </button>
            ))}
        </div>
    );
};

const SearchActions: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="search-actions">{children}</div>
);

const FiltersToggleButton: React.FC<{ onClick: () => void }> = ({ onClick }) => (
    <button type="button" onClick={onClick} className="filters-button">
        Filters
    </button>
);

const SearchSubmitButton: React.FC<{
    isLoading: boolean;
    label: string;
    text: string;
}> = ({ isLoading, label, text }) => (
    <button
        type="submit"
        disabled={isLoading}
        aria-label={label}
        aria-busy={isLoading}
        className="search-button"
    >
        {isLoading && (
            <span data-testid="loading-spinner" className="loading-spinner">
                ⏳
            </span>
        )}
        {text}
    </button>
);

const FiltersPanel: React.FC<{
    filters: SearchFilters;
    onChange: (key: keyof SearchFilters, value: any) => void;
}> = ({ filters, onChange }) => (
    <div data-testid="filters-panel" className="filters-panel">
        <FilterGroup
            id="price-min"
            label="Minimum Price"
            type="number"
            value={filters.priceMin || ''}
            onChange={(value) => onChange('priceMin', Number(value) || undefined)}
            placeholder="Min price"
        />
        <FilterGroup
            id="price-max"
            label="Maximum Price"
            type="number"
            value={filters.priceMax || ''}
            onChange={(value) => onChange('priceMax', Number(value) || undefined)}
            placeholder="Max price"
        />
        <FilterGroup
            id="bedrooms"
            label="Bedrooms"
            type="number"
            value={filters.bedrooms || ''}
            onChange={(value) => onChange('bedrooms', Number(value) || undefined)}
            placeholder="Bedrooms"
        />
        <FilterGroup
            id="bathrooms"
            label="Bathrooms"
            type="number"
            value={filters.bathrooms || ''}
            onChange={(value) => onChange('bathrooms', Number(value) || undefined)}
            placeholder="Bathrooms"
        />
        <PropertyTypeSelect
            value={filters.propertyType || ''}
            onChange={(value) => onChange('propertyType', value || undefined)}
        />
        <FilterGroup
            id="location"
            label="Location"
            type="text"
            value={filters.location || ''}
            onChange={(value) => onChange('location', value || undefined)}
            placeholder="Location"
        />
    </div>
);

const FilterGroup: React.FC<{
    id: string;
    label: string;
    type: 'text' | 'number';
    value: string | number;
    onChange: (value: string) => void;
    placeholder: string;
}> = ({ id, label, type, value, onChange, placeholder }) => (
    <div className="filter-group">
        <label htmlFor={id}>{label}</label>
        <input
            id={id}
            type={type}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
        />
    </div>
);

const PropertyTypeSelect: React.FC<{
    value: string;
    onChange: (value: string) => void;
}> = ({ value, onChange }) => (
    <div className="filter-group">
        <label htmlFor="property-type">Property Type</label>
        <select
            id="property-type"
            value={value}
            onChange={(e) => onChange(e.target.value)}
        >
            {SEARCH_DEFAULTS.PROPERTY_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                    {type.label}
                </option>
            ))}
        </select>
    </div>
);

// Add display names for better debugging
SearchInput.displayName = 'SearchInput';