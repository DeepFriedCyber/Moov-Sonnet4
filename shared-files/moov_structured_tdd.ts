// =============================================================================
// MOOV PROPERTY SEARCH - TDD STRUCTURED IMPLEMENTATION
// =============================================================================

// /src/types/property.ts
export interface Property {
  id: string;
  address: string;
  url?: string;
  lastSold: string;
  pricePaid: number;
  floorArea: number;
  pricePerSqMetre: number;
  type: PropertyType;
  beds: number;
  tenure: string;
  plotSize?: number;
  relevanceScore?: number;
  matchReasons?: string[];
  matchKeywords?: string[];
}

export type PropertyType = 'Detached' | 'Semi-D' | 'Terrace' | 'Flat' | 'Detached Bungalow' | 'Semi-D Bungalow' | 'Terrace Bungalow' | 'Other';

export interface SearchFilters {
  query?: string;
  minPrice?: number;
  maxPrice?: number;
  bedrooms?: number;
  propertyType?: PropertyType | 'any';
  location?: string;
  minFloorArea?: number;
  maxFloorArea?: number;
  minPlotSize?: number;
  maxPlotSize?: number;
}

export interface SearchResults {
  properties: Property[];
  total: number;
  page: number;
  totalPages: number;
  filters: SearchFilters;
  searchTime: number;
  averageRelevance: number;
}

export interface AIAnalysis {
  intent: string;
  extractedFilters: SearchFilters;
  suggestions: string[];
  confidence: number;
}

// =============================================================================
// /src/services/propertyService.ts
// =============================================================================

import Papa from 'papaparse';

export class PropertyService {
  private properties: Property[] = [];
  private isLoaded = false;

  async loadProperties(): Promise<void> {
    if (this.isLoaded) return;

    try {
      // In real implementation, this would be an API call
      const response = await fetch('/data/search_results4.csv');
      const csvText = await response.text();
      
      const parsed = Papa.parse(csvText, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true
      });

      this.properties = parsed.data.map((row: any, index: number) => ({
        id: `prop-${index}`,
        address: row.Address || '',
        url: row.URL || '',
        lastSold: row['Last sold'] || '',
        pricePaid: row['Price paid'] || 0,
        floorArea: row['Floor area'] || 0,
        pricePerSqMetre: row['£ per square metre'] || 0,
        type: row.Type || 'Other',
        beds: row.Beds || 0,
        tenure: row.Tenure || '',
        plotSize: row['Plot size'] || 0
      }));

      this.isLoaded = true;
    } catch (error) {
      throw new Error(`Failed to load properties: ${error.message}`);
    }
  }

  async searchProperties(filters: SearchFilters, page = 1, limit = 12): Promise<SearchResults> {
    await this.loadProperties();
    
    const startTime = Date.now();
    let filteredProperties = [...this.properties];

    // Apply filters
    if (filters.minPrice) {
      filteredProperties = filteredProperties.filter(p => p.pricePaid >= filters.minPrice!);
    }
    if (filters.maxPrice) {
      filteredProperties = filteredProperties.filter(p => p.pricePaid <= filters.maxPrice!);
    }
    if (filters.bedrooms) {
      filteredProperties = filteredProperties.filter(p => p.beds >= filters.bedrooms!);
    }
    if (filters.propertyType && filters.propertyType !== 'any') {
      filteredProperties = filteredProperties.filter(p => p.type === filters.propertyType);
    }
    if (filters.location) {
      const locationLower = filters.location.toLowerCase();
      filteredProperties = filteredProperties.filter(p => 
        p.address.toLowerCase().includes(locationLower)
      );
    }

    // Apply AI semantic search if query provided
    if (filters.query) {
      filteredProperties = this.applySemanticSearch(filteredProperties, filters.query);
    }

    // Sort by relevance score (if available) or price
    filteredProperties.sort((a, b) => {
      if (a.relevanceScore && b.relevanceScore) {
        return b.relevanceScore - a.relevanceScore;
      }
      return a.pricePaid - b.pricePaid;
    });

    // Pagination
    const total = filteredProperties.length;
    const totalPages = Math.ceil(total / limit);
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedProperties = filteredProperties.slice(startIndex, endIndex);

    const searchTime = Date.now() - startTime;
    const averageRelevance = paginatedProperties.reduce((sum, p) => sum + (p.relevanceScore || 0), 0) / paginatedProperties.length || 0;

    return {
      properties: paginatedProperties,
      total,
      page,
      totalPages,
      filters,
      searchTime,
      averageRelevance: Math.round(averageRelevance)
    };
  }

  private applySemanticSearch(properties: Property[], query: string): Property[] {
    const queryLower = query.toLowerCase();
    const keywords = queryLower.split(' ');

    return properties.map(property => {
      const searchText = `${property.address} ${property.type}`.toLowerCase();
      let score = 0;
      const matchedKeywords: string[] = [];
      const reasons: string[] = [];

      // Keyword matching
      keywords.forEach(keyword => {
        if (searchText.includes(keyword)) {
          score += 10;
          matchedKeywords.push(keyword);
        }
      });

      // Semantic understanding
      if (queryLower.includes('cozy') || queryLower.includes('small')) {
        if (property.floorArea && property.floorArea < 120) {
          score += 15;
          reasons.push('Cozy size perfect for intimate living');
          matchedKeywords.push('cozy');
        }
      }

      if (queryLower.includes('family') || queryLower.includes('large')) {
        if (property.beds >= 3) {
          score += 15;
          reasons.push('Perfect for families with multiple bedrooms');
          matchedKeywords.push('family-friendly');
        }
      }

      if (queryLower.includes('garden') || queryLower.includes('outdoor')) {
        if (property.plotSize && property.plotSize > 150) {
          score += 20;
          reasons.push('Excellent garden space for outdoor activities');
          matchedKeywords.push('garden');
        }
      }

      if (queryLower.includes('modern') || queryLower.includes('new')) {
        if (property.type.includes('Detached') && property.pricePerSqMetre > 2500) {
          score += 12;
          reasons.push('Modern property with contemporary features');
          matchedKeywords.push('modern');
        }
      }

      // Price range detection
      const priceMatch = query.match(/(\d+)[-\s]*(\d+)k/i);
      if (priceMatch) {
        const minPrice = parseInt(priceMatch[1]) * 1000;
        const maxPrice = parseInt(priceMatch[2]) * 1000;
        if (property.pricePaid >= minPrice && property.pricePaid <= maxPrice) {
          score += 25;
          reasons.push(`Within your ${priceMatch[1]}-${priceMatch[2]}k budget`);
          matchedKeywords.push('in-budget');
        }
      }

      // Location matching
      const locationTerms = ['sandbach', 'crewe', 'nantwich', 'middlewich'];
      locationTerms.forEach(location => {
        if (queryLower.includes(location) && property.address.toLowerCase().includes(location)) {
          score += 30;
          reasons.push(`Located in ${location} as requested`);
          matchedKeywords.push(location);
        }
      });

      return {
        ...property,
        relevanceScore: Math.min(score, 100),
        matchReasons: reasons,
        matchKeywords: matchedKeywords
      };
    }).filter(p => p.relevanceScore! > 0);
  }
}

// =============================================================================
// /src/services/aiService.ts
// =============================================================================

export class AIService {
  analyzeSearchQuery(query: string): AIAnalysis {
    const queryLower = query.toLowerCase();
    const extractedFilters: SearchFilters = {};
    const suggestions: string[] = [];
    let intent = '';

    // Extract bedrooms
    const bedroomMatch = query.match(/(\d+)\s*bed/i);
    if (bedroomMatch) {
      extractedFilters.bedrooms = parseInt(bedroomMatch[1]);
      intent += `Looking for ${bedroomMatch[1]} bedroom property. `;
    }

    // Extract price range
    const priceMatch = query.match(/(\d+)[-\s]*(\d+)k/i);
    if (priceMatch) {
      extractedFilters.minPrice = parseInt(priceMatch[1]) * 1000;
      extractedFilters.maxPrice = parseInt(priceMatch[2]) * 1000;
      intent += `Budget between £${priceMatch[1]}k-£${priceMatch[2]}k. `;
    }

    // Extract location
    const locations = ['sandbach', 'crewe', 'nantwich', 'middlewich'];
    locations.forEach(location => {
      if (queryLower.includes(location)) {
        extractedFilters.location = location;
        intent += `Interested in ${location} area. `;
      }
    });

    // Extract property type
    if (queryLower.includes('house') || queryLower.includes('detached')) {
      extractedFilters.propertyType = 'Detached';
      intent += 'Prefers detached houses. ';
    } else if (queryLower.includes('flat') || queryLower.includes('apartment')) {
      extractedFilters.propertyType = 'Flat';
      intent += 'Looking for flat/apartment. ';
    }

    // Generate contextual suggestions
    if (queryLower.includes('family')) {
      suggestions.push('Near Schools', 'Large Garden', 'Quiet Area');
    }
    if (queryLower.includes('modern')) {
      suggestions.push('New Build', 'Contemporary Features', 'Energy Efficient');
    }
    if (queryLower.includes('house')) {
      suggestions.push('Driveway', 'Garage', 'Private Garden');
    }

    const confidence = Object.keys(extractedFilters).length * 20;

    return {
      intent: intent.trim() || 'General property search',
      extractedFilters,
      suggestions,
      confidence: Math.min(confidence, 100)
    };
  }
}

// =============================================================================
// /src/hooks/usePropertySearch.ts
// =============================================================================

import { useState, useEffect, useCallback } from 'react';
import { PropertyService } from '../services/propertyService';
import { AIService } from '../services/aiService';

export const usePropertySearch = () => {
  const [searchResults, setSearchResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysis | null>(null);

  const propertyService = new PropertyService();
  const aiService = new AIService();

  const search = useCallback(async (filters: SearchFilters, page = 1) => {
    setLoading(true);
    setError(null);

    try {
      // Analyze query with AI if provided
      if (filters.query) {
        const analysis = aiService.analyzeSearchQuery(filters.query);
        setAiAnalysis(analysis);
        
        // Merge AI-extracted filters with existing filters
        filters = { ...filters, ...analysis.extractedFilters };
      }

      const results = await propertyService.searchProperties(filters, page);
      setSearchResults(results);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (!searchResults || loading) return;

    const nextPage = searchResults.page + 1;
    if (nextPage > searchResults.totalPages) return;

    setLoading(true);
    try {
      const moreResults = await propertyService.searchProperties(
        searchResults.filters,
        nextPage
      );

      setSearchResults(prev => ({
        ...moreResults,
        properties: [...prev!.properties, ...moreResults.properties]
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load more');
    } finally {
      setLoading(false);
    }
  }, [searchResults, loading]);

  return {
    searchResults,
    aiAnalysis,
    loading,
    error,
    search,
    loadMore
  };
};

// =============================================================================
// /src/components/PropertyCard/PropertyCard.tsx
// =============================================================================

import React from 'react';
import { Property } from '../../types/property';
import styles from './PropertyCard.module.css';

interface PropertyCardProps {
  property: Property;
  onClick?: (property: Property) => void;
}

export const PropertyCard: React.FC<PropertyCardProps> = ({ property, onClick }) => {
  const handleClick = () => {
    onClick?.(property);
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      maximumFractionDigits: 0
    }).format(price);
  };

  const getPropertyIcon = (type: string) => {
    const icons = {
      'Detached': '🏡',
      'Semi-D': '🏘️',
      'Terrace': '🏠',
      'Flat': '🏢',
      'Detached Bungalow': '🏡',
      'Semi-D Bungalow': '🏘️',
      'Terrace Bungalow': '🏠',
      'Other': '🏠'
    };
    return icons[type as keyof typeof icons] || '🏠';
  };

  return (
    <div 
      className={styles.propertyCard} 
      onClick={handleClick}
      data-testid="property-card"
    >
      {property.relevanceScore && (
        <div className={styles.relevanceBadge}>
          {property.relevanceScore}% Match
        </div>
      )}
      
      <div className={styles.propertyImage}>
        {getPropertyIcon(property.type)} {property.type}
      </div>
      
      <div className={styles.propertyContent}>
        <h3 className={styles.propertyTitle}>{property.address}</h3>
        <div className={styles.propertyPrice}>{formatPrice(property.pricePaid)}</div>
        
        <div className={styles.propertyDetails}>
          <span>🛏️ {property.beds} bed</span>
          <span>🏠 {property.type}</span>
          <span>📐 {property.floorArea} sq m</span>
          {property.plotSize && <span>🌳 {property.plotSize} sq m plot</span>}
        </div>
        
        <div className={styles.propertyLocation}>
          📍 {property.address.split(',').slice(-2).join(',')}
        </div>
        
        {property.matchReasons && property.matchReasons.length > 0 && (
          <div className={styles.aiMatchReason}>
            <div className={styles.matchReasonTitle}>Why this matches your search:</div>
            <div className={styles.matchReasonText}>
              {property.matchReasons[0]}
            </div>
            {property.matchKeywords && (
              <div className={styles.matchKeywords}>
                {property.matchKeywords.map((keyword, index) => (
                  <span key={index} className={styles.keywordHighlight}>
                    {keyword}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// =============================================================================
// /src/components/SearchForm/SearchForm.tsx
// =============================================================================

import React, { useState } from 'react';
import { SearchFilters } from '../../types/property';
import styles from './SearchForm.module.css';

interface SearchFormProps {
  onSearch: (filters: SearchFilters) => void;
  loading?: boolean;
  initialFilters?: SearchFilters;
}

export const SearchForm: React.FC<SearchFormProps> = ({ 
  onSearch, 
  loading = false,
  initialFilters = {}
}) => {
  const [filters, setFilters] = useState<SearchFilters>(initialFilters);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(filters);
  };

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilters(prev => ({ ...prev, query: e.target.value }));
  };

  const handleFilterChange = (key: keyof SearchFilters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const quickSearches = [
    '2 bed flat central Crewe under 150k',
    'family home with garden Middlewich',
    '3 bed terrace near schools Nantwich',
    '4 bed house Sandbach between 200-400k'
  ];

  return (
    <div className={styles.searchSection}>
      <h1 className={styles.searchTitle}>Find Your Perfect Home</h1>
      <p className={styles.searchSubtitle}>
        Describe what you're looking for and let our AI find the best matches
      </p>
      
      <form onSubmit={handleSubmit} className={styles.searchForm}>
        <div className={styles.mainSearchContainer}>
          <span className={styles.searchIcon}>🔍</span>
          <input
            type="text"
            className={styles.mainSearchInput}
            placeholder="Try: '4 bed house Sandbach between 200-400k' or 'cozy 2-bed near good schools with garden'"
            value={filters.query || ''}
            onChange={handleQueryChange}
            data-testid="search-input"
          />
          <span className={styles.aiIndicator}>AI</span>
          <button 
            type="submit" 
            className={styles.searchBtn}
            disabled={loading}
            data-testid="search-button"
          >
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>
      </form>

      <div className={styles.quickSuggestions}>
        {quickSearches.map((search, index) => (
          <button
            key={index}
            className={styles.suggestionChip}
            onClick={() => {
              setFilters(prev => ({ ...prev, query: search }));
              onSearch({ ...filters, query: search });
            }}
            data-testid={`quick-search-${index}`}
          >
            {search}
          </button>
        ))}
      </div>
    </div>
  );
};

// =============================================================================
// /src/components/PropertyList/PropertyList.tsx
// =============================================================================

import React from 'react';
import { Property } from '../../types/property';
import { PropertyCard } from '../PropertyCard/PropertyCard';
import styles from './PropertyList.module.css';

interface PropertyListProps {
  properties: Property[];
  loading?: boolean;
  onPropertyClick?: (property: Property) => void;
  onLoadMore?: () => void;
  hasMore?: boolean;
}

export const PropertyList: React.FC<PropertyListProps> = ({
  properties,
  loading = false,
  onPropertyClick,
  onLoadMore,
  hasMore = false
}) => {
  if (loading && properties.length === 0) {
    return (
      <div className={styles.loading} data-testid="loading">
        <div className={styles.loadingSpinner}></div>
        AI analyzing your search criteria...
      </div>
    );
  }

  return (
    <div className={styles.propertyList}>
      <div className={styles.propertiesGrid} data-testid="properties-grid">
        {properties.map((property) => (
          <PropertyCard
            key={property.id}
            property={property}
            onClick={onPropertyClick}
          />
        ))}
      </div>

      {hasMore && (
        <div className={styles.loadMore}>
          <button
            className={styles.loadMoreBtn}
            onClick={onLoadMore}
            disabled={loading}
            data-testid="load-more-button"
          >
            {loading ? 'Loading...' : 'Load More Properties'}
          </button>
        </div>
      )}
    </div>
  );
};

// =============================================================================
// TESTS - /src/components/PropertyCard/PropertyCard.test.tsx
// =============================================================================

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { PropertyCard } from './PropertyCard';
import { Property } from '../../types/property';

const mockProperty: Property = {
  id: '1',
  address: '123 Test Street, Test Town, TS1 1AA',
  pricePaid: 250000,
  floorArea: 100,
  pricePerSqMetre: 2500,
  type: 'Detached',
  beds: 3,
  tenure: 'Freehold',
  lastSold: 'Mar 2025',
  plotSize: 200,
  relevanceScore: 95,
  matchReasons: ['Perfect size for family living'],
  matchKeywords: ['family', 'detached']
};

describe('PropertyCard', () => {
  it('renders property information correctly', () => {
    render(<PropertyCard property={mockProperty} />);
    
    expect(screen.getByText('123 Test Street, Test Town, TS1 1AA')).toBeInTheDocument();
    expect(screen.getByText('£250,000')).toBeInTheDocument();
    expect(screen.getByText('🛏️ 3 bed')).toBeInTheDocument();
    expect(screen.getByText('95% Match')).toBeInTheDocument();
  });

  it('calls onClick when card is clicked', () => {
    const onClickMock = jest.fn();
    render(<PropertyCard property={mockProperty} onClick={onClickMock} />);
    
    fireEvent.click(screen.getByTestId('property-card'));
    expect(onClickMock).toHaveBeenCalledWith(mockProperty);
  });

  it('displays match reasons when available', () => {
    render(<PropertyCard property={mockProperty} />);
    
    expect(screen.getByText('Perfect size for family living')).toBeInTheDocument();
    expect(screen.getByText('family')).toBeInTheDocument();
    expect(screen.getByText('detached')).toBeInTheDocument();
  });

  it('handles missing optional properties gracefully', () => {
    const minimalProperty: Property = {
      id: '2',
      address: 'Minimal Property',
      pricePaid: 100000,
      floorArea: 50,
      pricePerSqMetre: 2000,
      type: 'Flat',
      beds: 1,
      tenure: 'Leasehold',
      lastSold: 'Jan 2025'
    };

    render(<PropertyCard property={minimalProperty} />);
    
    expect(screen.getByText('Minimal Property')).toBeInTheDocument();
    expect(screen.queryByText(/Match/)).not.toBeInTheDocument();
  });
});

// =============================================================================
// TESTS - /src/hooks/usePropertySearch.test.tsx
// =============================================================================

import { renderHook, act } from '@testing-library/react';
import { usePropertySearch } from './usePropertySearch';

// Mock the services
jest.mock('../services/propertyService');
jest.mock('../services/aiService');

describe('usePropertySearch', () => {
  it('performs search with filters', async () => {
    const { result } = renderHook(() => usePropertySearch());
    
    const filters = {
      query: '3 bed house',
      minPrice: 200000,
      maxPrice: 400000
    };

    await act(async () => {
      await result.current.search(filters);
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.searchResults).toBeDefined();
  });

  it('handles search errors gracefully', async () => {
    const { result } = renderHook(() => usePropertySearch());
    
    // Mock service to throw error
    const originalError = console.error;
    console.error = jest.fn();

    await act(async () => {
      await result.current.search({ query: 'invalid' });
    });

    expect(result.current.error).toBeDefined();
    expect(result.current.loading).toBe(false);
    
    console.error = originalError;
  });

  it('loads more results correctly', async () => {
    const { result } = renderHook(() => usePropertySearch());
    
    // First search
    await act(async () => {
      await result.current.search({ query: 'test' });
    });

    const initialCount = result.current.searchResults?.properties.length || 0;

    // Load more
    await act(async () => {
      await result.current.loadMore();
    });

    const finalCount = result.current.searchResults?.properties.length || 0;
    expect(finalCount).toBeGreaterThan(initialCount);
  });
});

// =============================================================================
// TESTS - /src/services/propertyService.test.ts
// =============================================================================

import { PropertyService } from './propertyService';

describe('PropertyService', () => {
  let service: PropertyService;

  beforeEach(() => {
    service = new PropertyService();
    
    // Mock fetch for CSV data
    global.fetch = jest.fn(() =>
      Promise.resolve({
        text: () => Promise.resolve(`Address,Price paid,Beds,Type,Floor area,Plot size
"123 Test St, TS1 1AA",250000,3,Detached,100,200
"456 Another St, TS2 2BB",180000,2,Terrace,80,150`)
      })
    ) as jest.Mock;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('loads and parses property data correctly', async () => {
    await service.loadProperties();
    
    const results = await service.searchProperties({});
    expect(results.properties).toHaveLength(2);
    expect(results.properties[0].address).toBe('123 Test St, TS1 1AA');
  });

  it('filters properties by price range', async () => {
    const results = await service.searchProperties({
      minPrice: 200000,
      maxPrice: 300000
    });

    expect(results.properties).toHaveLength(1);
    expect(results.properties[0].pricePaid).toBe(250000);
  });

  it('filters properties by location', async () => {
    const results = await service.searchProperties({
      location: 'TS1'
    });

    expect(results.properties).toHaveLength(1);
    expect(results.properties[0].address).toContain('TS1');
  });

  it('applies semantic search correctly', async () => {
    const results = await service.searchProperties({
      query: 'family detached house'
    });

    const familyProperty = results.properties.find(p => 
      p.matchKeywords?.includes('family-friendly')
    );
    expect(familyProperty).toBeDefined();
  });

  it('handles pagination correctly', async () => {
    const page1 = await service.searchProperties({}, 1, 1);
    const page2 = await service.searchProperties({}, 2, 1);

    expect(page1.properties).toHaveLength(1);
    expect(page2.properties).toHaveLength(1);
    expect(page1.properties[0].id).not.toBe(page2.properties[0].id);
  });
});

// =============================================================================
// INTEGRATION TEST - /src/components/PropertySearchPage.integration.test.tsx
// =============================================================================

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PropertySearchPage } from '../PropertySearchPage';

// Mock the CSV data
global.fetch = jest.fn(() =>
  Promise.resolve({
    text: () => Promise.resolve(`Address,Price paid,Beds,Type,Floor area,Plot size
"123 Family St, Sandbach, CW11 1AA",350000,4,Detached,150,300
"456 Cozy Lane, Crewe, CW1 2BB",180000,2,Terrace,80,150`)
  })
) as jest.Mock;

describe('PropertySearchPage Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('completes full search flow', async () => {
    render(<PropertySearchPage />);
    
    // Enter search query
    const searchInput = screen.getByTestId('search-input');
    fireEvent.change(searchInput, { 
      target: { value: '4 bed house Sandbach between 200-400k' } 
    });
    
    // Submit search
    const searchButton = screen.getByTestId('search-button');
    fireEvent.click(searchButton);
    
    // Wait for results
    await waitFor(() => {
      expect(screen.getByTestId('properties-grid')).toBeInTheDocument();
    });
    
    // Verify AI analysis
    expect(screen.getByText(/Looking for 4 bedroom property/)).toBeInTheDocument();
    
    // Verify property results
    expect(screen.getByText('123 Family St, Sandbach, CW11 1AA')).toBeInTheDocument();
    expect(screen.getByText('96% Match')).toBeInTheDocument();
  });

  it('handles load more functionality', async () => {
    render(<PropertySearchPage />);
    
    // Perform initial search
    const searchInput = screen.getByTestId('search-input');
    fireEvent.change(searchInput, { target: { value: 'house' } });
    fireEvent.click(screen.getByTestId('search-button'));
    
    await waitFor(() => {
      expect(screen.getByTestId('properties-grid')).toBeInTheDocument();
    });
    
    // Click load more
    const loadMoreButton = screen.getByTestId('load-more-button');
    fireEvent.click(loadMoreButton);
    
    await waitFor(() => {
      expect(loadMoreButton).toHaveTextContent('Loading...');
    });
  });

  it('handles quick search suggestions', async () => {
    render(<PropertySearchPage />);
    
    // Click a quick search
    const quickSearch = screen.getByTestId('quick-search-0');
    fireEvent.click(quickSearch);
    
    // Verify search input is populated
    const searchInput = screen.getByTestId('search-input');
    expect(searchInput).toHaveValue('2 bed flat central Crewe under 150k');
    
    // Verify search is triggered
    await waitFor(() => {
      expect(screen.getByTestId('properties-grid')).toBeInTheDocument();
    });
  });
});

// =============================================================================
// FILE STRUCTURE SUMMARY
// =============================================================================

/*
/src
├── components/
│   ├── PropertyCard/
│   │   ├── PropertyCard.tsx
│   │   ├── PropertyCard.module.css
│   │   └── PropertyCard.test.tsx
│   ├── SearchForm/
│   │   ├── SearchForm.tsx
│   │   ├── SearchForm.module.css
│   │   └── SearchForm.test.tsx
│   ├── PropertyList/
│   │   ├── PropertyList.tsx
│   │   ├── PropertyList.module.css
│   │   └── PropertyList.test.tsx
│   └── PropertySearchPage/
│       ├── PropertySearchPage.tsx
│       ├── PropertySearchPage.module.css
│       └── PropertySearchPage.integration.test.tsx
├── hooks/
│   ├── usePropertySearch.ts
│   └── usePropertySearch.test.tsx
├── services/
│   ├── propertyService.ts
│   ├── propertyService.test.ts
│   ├── aiService.ts
│   └── aiService.test.ts
├── types/
│   └── property.ts
├── utils/
│   ├── testUtils.tsx
│   └── formatters.ts
└── data/
    └── search_results4.csv

/tests
├── __mocks__/
│   └── fileMock.js
├── setup.ts
└── integration/
    └── searchFlow.test.tsx
*/