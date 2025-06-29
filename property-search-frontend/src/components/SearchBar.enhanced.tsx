// TDD-Enhanced SearchBar with Semantic Search Integration
'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Search, Sparkles, Filter, X, TrendingUp } from 'lucide-react';
import { useSemanticSearchSuggestions, useQueryAnalysis } from '@/hooks/useSemanticSearch';
import { motion, AnimatePresence } from 'framer-motion';

// Enhanced type definitions
export interface SearchFilters {
  priceMin?: number;
  priceMax?: number;
  bedrooms?: number;
  bathrooms?: number;
  propertyType?: 'house' | 'apartment' | 'condo' | 'townhouse' | string;
  location?: string;
  features?: string[];
}

export interface SearchBarEnhancedProps {
  onSearch: (query: string, filters: SearchFilters) => void;
  onFiltersChange?: (filters: SearchFilters) => void;
  placeholder?: string;
  isLoading?: boolean;
  showFilters?: boolean;
  defaultFilters?: SearchFilters;
  recentSearches?: string[];
  error?: string;
  className?: string;
  showSemanticAnalysis?: boolean;
  enableSuggestions?: boolean;
}

// Constants
const SEARCH_DEFAULTS = {
  PLACEHOLDER: 'Try: "2 bed apartment in London under £400k" or "family home with garden"',
  DEBOUNCE_MS: 300,
  MAX_SUGGESTIONS: 5,
  PROPERTY_TYPES: [
    { value: '', label: 'Any Type' },
    { value: 'house', label: 'House' },
    { value: 'apartment', label: 'Apartment' },
    { value: 'condo', label: 'Condo' },
    { value: 'townhouse', label: 'Townhouse' },
  ],
  FEATURES: [
    'Garden', 'Parking', 'Balcony', 'Modern', 'Pet-Friendly', 
    'Near Transport', 'Gym', 'Concierge', 'Security'
  ]
} as const;

export function SearchBarEnhanced({
  onSearch,
  onFiltersChange,
  placeholder = SEARCH_DEFAULTS.PLACEHOLDER,
  isLoading = false,
  showFilters = true,
  defaultFilters = {},
  recentSearches = [],
  error,
  className = '',
  showSemanticAnalysis = true,
  enableSuggestions = true
}: SearchBarEnhancedProps) {
  // State management
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<SearchFilters>(defaultFilters);
  const [showFiltersPanel, setShowFiltersPanel] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [focusedSuggestion, setFocusedSuggestion] = useState(-1);
  
  // Refs
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Semantic search hooks
  const { 
    suggestions, 
    analysis: suggestionAnalysis, 
    isLoading: suggestionsLoading 
  } = useSemanticSearchSuggestions({
    query,
    debounceMs: SEARCH_DEFAULTS.DEBOUNCE_MS,
    enabled: enableSuggestions && query.length > 2
  });

  const queryAnalysis = useQueryAnalysis(query);

  // Memoized values
  const allSuggestions = useMemo(() => {
    const semanticSuggestions = suggestions.slice(0, 3);
    const recentSuggestions = recentSearches
      .filter(search => search.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 2);
    
    return [...semanticSuggestions, ...recentSuggestions]
      .slice(0, SEARCH_DEFAULTS.MAX_SUGGESTIONS);
  }, [suggestions, recentSearches, query]);

  const hasActiveFilters = useMemo(() => {
    return Object.values(filters).some(value => 
      value !== undefined && value !== '' && 
      (Array.isArray(value) ? value.length > 0 : true)
    );
  }, [filters]);

  // Event handlers
  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const trimmedQuery = query.trim();
    if (trimmedQuery) {
      onSearch(trimmedQuery, filters);
      setShowSuggestions(false);
    }
  }, [query, filters, onSearch]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newQuery = e.target.value;
    setQuery(newQuery);
    setShowSuggestions(newQuery.length > 0);
    setFocusedSuggestion(-1);
  }, []);

  const handleInputFocus = useCallback(() => {
    if (query.length > 0 || recentSearches.length > 0) {
      setShowSuggestions(true);
    }
  }, [query, recentSearches]);

  const handleInputBlur = useCallback((e: React.FocusEvent) => {
    // Don't hide suggestions if clicking on them
    if (!suggestionsRef.current?.contains(e.relatedTarget as Node)) {
      setTimeout(() => setShowSuggestions(false), 150);
    }
  }, []);

  const handleSuggestionClick = useCallback((suggestion: string) => {
    setQuery(suggestion);
    setShowSuggestions(false);
    onSearch(suggestion, filters);
    inputRef.current?.focus();
  }, [filters, onSearch]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!showSuggestions || allSuggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setFocusedSuggestion(prev => 
          prev < allSuggestions.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusedSuggestion(prev => 
          prev > 0 ? prev - 1 : allSuggestions.length - 1
        );
        break;
      case 'Enter':
        if (focusedSuggestion >= 0) {
          e.preventDefault();
          handleSuggestionClick(allSuggestions[focusedSuggestion]);
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        setFocusedSuggestion(-1);
        break;
    }
  }, [showSuggestions, allSuggestions, focusedSuggestion, handleSuggestionClick]);

  const handleFilterChange = useCallback((key: keyof SearchFilters, value: any) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onFiltersChange?.(newFilters);
  }, [filters, onFiltersChange]);

  const handleClearFilters = useCallback(() => {
    setFilters({});
    onFiltersChange?.({});
  }, [onFiltersChange]);

  const handleApplySemanticFilters = useCallback(() => {
    if (queryAnalysis?.extractedFilters) {
      const newFilters = { ...filters, ...queryAnalysis.extractedFilters };
      setFilters(newFilters);
      onFiltersChange?.(newFilters);
    }
  }, [queryAnalysis, filters, onFiltersChange]);

  // Effects
  useEffect(() => {
    if (error && inputRef.current) {
      inputRef.current.focus();
    }
  }, [error]);

  return (
    <div className={`relative w-full max-w-4xl mx-auto ${className}`}>
      {/* Error Display */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm"
            role="alert"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Search Container */}
      <div className="relative">
        <form onSubmit={handleSubmit} className="relative">
          {/* Search Input */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={handleInputChange}
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={isLoading}
              className="w-full pl-12 pr-32 py-4 text-lg border-2 border-gray-200 rounded-xl 
                       focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none
                       disabled:bg-gray-50 disabled:cursor-not-allowed
                       transition-all duration-200"
              aria-label="Search for properties"
              data-testid="search-input"
            />

            {/* AI Indicator */}
            {queryAnalysis && (
              <div className="absolute inset-y-0 right-20 flex items-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="flex items-center gap-1 bg-gradient-to-r from-blue-500 to-purple-500 
                           text-white px-2 py-1 rounded-full text-xs font-medium"
                >
                  <Sparkles className="h-3 w-3" />
                  AI
                </motion.div>
              </div>
            )}

            {/* Search Button */}
            <button
              type="submit"
              disabled={isLoading || !query.trim()}
              className="absolute inset-y-0 right-2 px-4 bg-blue-600 text-white rounded-lg
                       hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed
                       transition-colors duration-200 font-medium"
              aria-label={isLoading ? 'Searching...' : 'Search'}
              data-testid="search-button"
            >
              {isLoading ? (
                <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
              ) : (
                'Search'
              )}
            </button>
          </div>
        </form>

        {/* Suggestions Dropdown */}
        <AnimatePresence>
          {showSuggestions && allSuggestions.length > 0 && (
            <motion.div
              ref={suggestionsRef}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 
                       rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto"
              data-testid="suggestions-dropdown"
            >
              {allSuggestions.map((suggestion, index) => (
                <button
                  key={suggestion}
                  onClick={() => handleSuggestionClick(suggestion)}
                  className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors
                           ${index === focusedSuggestion ? 'bg-blue-50 border-l-2 border-blue-500' : ''}
                           ${index === allSuggestions.length - 1 ? '' : 'border-b border-gray-100'}`}
                >
                  <div className="flex items-center gap-2">
                    {recentSearches.includes(suggestion) ? (
                      <TrendingUp className="h-4 w-4 text-gray-400" />
                    ) : (
                      <Search className="h-4 w-4 text-gray-400" />
                    )}
                    <span className="text-gray-900">{suggestion}</span>
                  </div>
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Semantic Analysis Display */}
      <AnimatePresence>
        {showSemanticAnalysis && queryAnalysis && query.length > 3 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-900">AI Understanding</span>
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                    {queryAnalysis.confidence}% confident
                  </span>
                </div>
                <p className="text-sm text-gray-700 mb-3">{queryAnalysis.intent}</p>
                
                {queryAnalysis.suggestions.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {queryAnalysis.suggestions.slice(0, 3).map((suggestion, index) => (
                      <span
                        key={index}
                        className="text-xs bg-white text-gray-600 px-2 py-1 rounded-full border"
                      >
                        {suggestion}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              
              {Object.keys(queryAnalysis.extractedFilters).length > 1 && (
                <button
                  onClick={handleApplySemanticFilters}
                  className="ml-4 text-xs bg-blue-600 text-white px-3 py-1 rounded-full 
                           hover:bg-blue-700 transition-colors"
                >
                  Apply Filters
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filters Section */}
      {showFilters && (
        <div className="mt-4">
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={() => setShowFiltersPanel(!showFiltersPanel)}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <Filter className="h-4 w-4" />
              <span className="text-sm font-medium">
                Filters {hasActiveFilters && `(${Object.keys(filters).length})`}
              </span>
            </button>
            
            {hasActiveFilters && (
              <button
                onClick={handleClearFilters}
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
              >
                <X className="h-3 w-3" />
                Clear all
              </button>
            )}
          </div>

          <AnimatePresence>
            {showFiltersPanel && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg"
                data-testid="filters-panel"
              >
                {/* Price Range */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Price Range</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      placeholder="Min"
                      value={filters.priceMin || ''}
                      onChange={(e) => handleFilterChange('priceMin', Number(e.target.value) || undefined)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500"
                    />
                    <input
                      type="number"
                      placeholder="Max"
                      value={filters.priceMax || ''}
                      onChange={(e) => handleFilterChange('priceMax', Number(e.target.value) || undefined)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Bedrooms */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Bedrooms</label>
                  <select
                    value={filters.bedrooms || ''}
                    onChange={(e) => handleFilterChange('bedrooms', Number(e.target.value) || undefined)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">Any</option>
                    {[1, 2, 3, 4, 5].map(num => (
                      <option key={num} value={num}>{num}+ bed</option>
                    ))}
                  </select>
                </div>

                {/* Property Type */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Property Type</label>
                  <select
                    value={filters.propertyType || ''}
                    onChange={(e) => handleFilterChange('propertyType', e.target.value || undefined)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500"
                  >
                    {SEARCH_DEFAULTS.PROPERTY_TYPES.map(type => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

export default SearchBarEnhanced;