// TDD GREEN PHASE - Minimal SearchBar Implementation
'use client';

import React, { useState, useRef, useEffect } from 'react';

// Types
export interface SearchFilters {
  priceMin?: number;
  priceMax?: number;
  bedrooms?: number;
  bathrooms?: number;
  propertyType?: string;
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

export function SearchBar({
  onSearch,
  onFiltersChange,
  placeholder = 'Search properties...',
  isLoading = false,
  showFilters = false,
  defaultFilters = {},
  recentSearches = [],
  error,
}: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<SearchFilters>(defaultFilters);
  const [showFiltersPanel, setShowFiltersPanel] = useState(false);
  const [showRecentSearches, setShowRecentSearches] = useState(false);
  const [currentError, setCurrentError] = useState(error);
  const inputRef = useRef<HTMLInputElement>(null);

  // Clear error when query changes
  useEffect(() => {
    if (query && currentError) {
      setCurrentError(undefined);
    }
  }, [query, currentError]);

  // Update error when prop changes
  useEffect(() => {
    setCurrentError(error);
  }, [error]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedQuery = query.trim();
    if (trimmedQuery) {
      onSearch(trimmedQuery, filters);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
  };

  const handleInputFocus = () => {
    if (recentSearches.length > 0) {
      setShowRecentSearches(true);
    }
  };

  const handleInputBlur = () => {
    // Delay hiding to allow clicking on recent searches
    setTimeout(() => setShowRecentSearches(false), 150);
  };

  const handleRecentSearchClick = (searchTerm: string) => {
    setQuery(searchTerm);
    setShowRecentSearches(false);
  };

  const handleFiltersToggle = () => {
    setShowFiltersPanel(!showFiltersPanel);
  };

  const handleFilterChange = (filterKey: keyof SearchFilters, value: any) => {
    const newFilters = { ...filters, [filterKey]: value };
    setFilters(newFilters);
    if (onFiltersChange) {
      onFiltersChange(newFilters);
    }
  };

  return (
    <div className="search-bar">
      {/* Error Display */}
      {currentError && (
        <div role="alert" className="error-message">
          {currentError}
        </div>
      )}

      {/* Main Search Form */}
      <form onSubmit={handleSubmit} className="search-form">
        <div className="search-input-container">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleInputChange}
            onFocus={handleInputFocus}
            onBlur={handleInputBlur}
            placeholder={placeholder}
            disabled={isLoading}
            aria-label="Search for properties"
            className="search-input"
          />

          {/* Recent Searches Dropdown */}
          {showRecentSearches && recentSearches.length > 0 && (
            <div data-testid="recent-searches" className="recent-searches-dropdown">
              {recentSearches.map((search, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => handleRecentSearchClick(search)}
                  className="recent-search-item"
                >
                  {search}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="search-actions">
          {/* Filters Toggle Button */}
          {showFilters && (
            <button
              type="button"
              onClick={handleFiltersToggle}
              className="filters-button"
            >
              Filters
            </button>
          )}

          {/* Search Button */}
          <button
            type="submit"
            disabled={isLoading}
            aria-label={isLoading ? "Searching" : "Submit search"}
            aria-busy={isLoading}
            className="search-button"
          >
            {isLoading ? (
              <>
                <span data-testid="loading-spinner" className="loading-spinner">
                  ⏳
                </span>
                Searching
              </>
            ) : (
              'Search'
            )}
          </button>
        </div>
      </form>

      {/* Filters Panel */}
      {showFilters && showFiltersPanel && (
        <div data-testid="filters-panel" className="filters-panel">
          <div className="filter-group">
            <label htmlFor="price-min">Minimum Price</label>
            <input
              id="price-min"
              type="number"
              value={filters.priceMin || ''}
              onChange={(e) => handleFilterChange('priceMin', Number(e.target.value) || undefined)}
              placeholder="Min price"
            />
          </div>

          <div className="filter-group">
            <label htmlFor="price-max">Maximum Price</label>
            <input
              id="price-max"
              type="number"
              value={filters.priceMax || ''}
              onChange={(e) => handleFilterChange('priceMax', Number(e.target.value) || undefined)}
              placeholder="Max price"
            />
          </div>

          <div className="filter-group">
            <label htmlFor="bedrooms">Bedrooms</label>
            <input
              id="bedrooms"
              type="number"
              value={filters.bedrooms || ''}
              onChange={(e) => handleFilterChange('bedrooms', Number(e.target.value) || undefined)}
              placeholder="Bedrooms"
            />
          </div>

          <div className="filter-group">
            <label htmlFor="bathrooms">Bathrooms</label>
            <input
              id="bathrooms"
              type="number"
              value={filters.bathrooms || ''}
              onChange={(e) => handleFilterChange('bathrooms', Number(e.target.value) || undefined)}
              placeholder="Bathrooms"
            />
          </div>

          <div className="filter-group">
            <label htmlFor="property-type">Property Type</label>
            <select
              id="property-type"
              value={filters.propertyType || ''}
              onChange={(e) => handleFilterChange('propertyType', e.target.value || undefined)}
            >
              <option value="">Any Type</option>
              <option value="house">House</option>
              <option value="apartment">Apartment</option>
              <option value="condo">Condo</option>
              <option value="townhouse">Townhouse</option>
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="location">Location</label>
            <input
              id="location"
              type="text"
              value={filters.location || ''}
              onChange={(e) => handleFilterChange('location', e.target.value || undefined)}
              placeholder="Location"
            />
          </div>
        </div>
      )}
    </div>
  );
}