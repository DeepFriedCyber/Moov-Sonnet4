// TDD-Enhanced Property Search Page with Semantic Search
'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, 
  MapPin, 
  Bed, 
  Bath, 
  Square, 
  Pound, 
  AlertCircle, 
  TrendingUp,
  Sparkles,
  Filter,
  BarChart3,
  Clock
} from 'lucide-react';
import Image from 'next/image';
import { SearchBarEnhanced } from './SearchBar.enhanced';
import { useSemanticSearch, useSemanticSearchStats } from '@/hooks/useSemanticSearch';
import { Property } from '@/types';

// Enhanced interfaces
interface SearchFilters {
  priceMin?: number;
  priceMax?: number;
  bedrooms?: number;
  bathrooms?: number;
  propertyType?: Property['propertyType'];
  location?: string;
  features?: string[];
}

interface PropertyCardEnhancedProps {
  property: Property & { 
    relevanceScore?: number;
    matchReasons?: string[];
    matchKeywords?: string[];
    semanticScore?: number;
  };
  onPropertyClick?: (property: Property) => void;
  showRelevanceScore?: boolean;
  showMatchReasons?: boolean;
}

interface SearchStatsProps {
  searchResults: any;
  searchTime?: number;
  isSemanticSearch?: boolean;
}

// Enhanced Property Card Component
const PropertyCardEnhanced: React.FC<PropertyCardEnhancedProps> = ({ 
  property, 
  onPropertyClick,
  showRelevanceScore = true,
  showMatchReasons = true
}) => {
  const handleClick = useCallback(() => {
    onPropertyClick?.(property);
  }, [property, onPropertyClick]);

  const formatPrice = useCallback((price: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      maximumFractionDigits: 0
    }).format(price);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -5 }}
      className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-xl transition-all duration-300 cursor-pointer group"
      onClick={handleClick}
      data-testid="property-card"
    >
      {/* Relevance Badge */}
      {showRelevanceScore && property.relevanceScore && property.relevanceScore > 0 && (
        <div className="absolute top-4 right-4 z-10">
          <div className="bg-gradient-to-r from-green-500 to-emerald-500 text-white px-3 py-1 rounded-full text-sm font-semibold shadow-lg">
            {Math.round(property.relevanceScore)}% Match
          </div>
        </div>
      )}

      {/* Property Image */}
      <div className="relative h-48 bg-gray-200">
        {property.images && property.images.length > 0 ? (
          <Image
            src={property.images[0]}
            alt={property.title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400">
            <div className="text-center">
              <MapPin className="h-8 w-8 mx-auto mb-2" />
              <span className="text-sm">No image available</span>
            </div>
          </div>
        )}
      </div>

      {/* Property Content */}
      <div className="p-6">
        {/* Title and Price */}
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2 group-hover:text-blue-600 transition-colors">
            {property.title}
          </h3>
          <div className="flex items-center justify-between">
            <div className="flex items-center text-green-600">
              <Pound className="h-5 w-5 mr-1" />
              <span className="text-xl font-bold">
                {formatPrice(property.price)}
              </span>
              {property.listingType === 'rent' && (
                <span className="text-gray-500 ml-1 text-sm">/month</span>
              )}
            </div>
            <div className="flex items-center gap-1 text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
              <span className="capitalize">{property.listingType}</span>
            </div>
          </div>
        </div>

        {/* Property Details */}
        <div className="flex items-center gap-4 mb-4 text-sm text-gray-600">
          <div className="flex items-center">
            <Bed className="h-4 w-4 mr-1" />
            <span>{property.bedrooms} bed</span>
          </div>
          <div className="flex items-center">
            <Bath className="h-4 w-4 mr-1" />
            <span>{property.bathrooms} bath</span>
          </div>
          <div className="flex items-center">
            <Square className="h-4 w-4 mr-1" />
            <span>{property.area} sq ft</span>
          </div>
        </div>

        {/* Location */}
        <div className="flex items-center text-sm text-gray-600 mb-4">
          <MapPin className="h-4 w-4 mr-1" />
          <span>{property.location.area}, {property.location.city}</span>
        </div>

        {/* Property Type & Features */}
        <div className="flex flex-wrap gap-2 mb-4">
          <span className="bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded-full capitalize">
            {property.propertyType}
          </span>
          {property.features.slice(0, 2).map((feature, index) => (
            <span
              key={index}
              className="bg-blue-50 text-blue-700 text-xs px-2 py-1 rounded-full"
            >
              {feature}
            </span>
          ))}
          {property.features.length > 2 && (
            <span className="bg-gray-50 text-gray-500 text-xs px-2 py-1 rounded-full">
              +{property.features.length - 2} more
            </span>
          )}
        </div>

        {/* AI Match Reasons */}
        {showMatchReasons && property.matchReasons && property.matchReasons.length > 0 && (
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-3 rounded-lg border border-blue-100">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-900">Why this matches:</span>
            </div>
            <p className="text-sm text-gray-700 mb-2">
              {property.matchReasons[0]}
            </p>
            {property.matchKeywords && property.matchKeywords.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {property.matchKeywords.slice(0, 3).map((keyword, index) => (
                  <span
                    key={index}
                    className="bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded-full"
                  >
                    {keyword}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
};

// Search Statistics Component
const SearchStats: React.FC<SearchStatsProps> = ({ 
  searchResults, 
  searchTime, 
  isSemanticSearch 
}) => {
  const stats = useSemanticSearchStats(searchResults);

  if (!searchResults) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-blue-600" />
            <div>
              <div className="text-sm text-gray-600">Total Results</div>
              <div className="text-lg font-semibold">{stats.totalProperties}</div>
            </div>
          </div>
          
          {isSemanticSearch && (
            <>
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-600" />
                <div>
                  <div className="text-sm text-gray-600">Avg Relevance</div>
                  <div className="text-lg font-semibold">{stats.averageRelevance}%</div>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-purple-600" />
                <div>
                  <div className="text-sm text-gray-600">High Matches</div>
                  <div className="text-lg font-semibold">{stats.highRelevanceCount}</div>
                </div>
              </div>
            </>
          )}
          
          {searchTime && (
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-gray-600" />
              <div>
                <div className="text-sm text-gray-600">Search Time</div>
                <div className="text-lg font-semibold">{searchTime}ms</div>
              </div>
            </div>
          )}
        </div>

        {isSemanticSearch && (
          <div className="flex items-center gap-2 bg-gradient-to-r from-blue-50 to-purple-50 px-3 py-2 rounded-full">
            <Sparkles className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-medium text-blue-900">AI-Enhanced Results</span>
          </div>
        )}
      </div>
    </motion.div>
  );
};

// Main Enhanced Property Search Page
export const PropertySearchPageEnhanced: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFilters, setSearchFilters] = useState<SearchFilters>({});
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  // Semantic search hook
  const { 
    data: searchResults, 
    isLoading, 
    isError, 
    error, 
    analysis,
    suggestions,
    isSemanticSearch,
    refetch
  } = useSemanticSearch({
    query: searchQuery,
    page: currentPage,
    limit: 12,
    enabled: searchQuery.length > 0
  });

  // Example searches for quick access
  const exampleSearches = useMemo(() => [
    'Modern 2-bed apartment in Central London under £500k',
    'Family home with garden near good schools',
    'Pet-friendly flat with balcony and parking',
    'Luxury penthouse with city views',
    'Victorian house needing renovation'
  ], []);

  // Event handlers
  const handleSearch = useCallback((query: string, filters: SearchFilters) => {
    setSearchQuery(query);
    setSearchFilters(filters);
    setCurrentPage(1);
  }, []);

  const handleFiltersChange = useCallback((filters: SearchFilters) => {
    setSearchFilters(filters);
  }, []);

  const handleExampleSearch = useCallback((example: string) => {
    setSearchQuery(example);
    setCurrentPage(1);
  }, []);

  const handlePropertyClick = useCallback((property: Property) => {
    setSelectedProperty(property);
  }, []);

  const handleLoadMore = useCallback(() => {
    if (searchResults && currentPage < searchResults.totalPages) {
      setCurrentPage(prev => prev + 1);
    }
  }, [searchResults, currentPage]);

  const handleRetry = useCallback(() => {
    refetch();
  }, [refetch]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-8"
          >
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              Find Your Perfect Property
            </h1>
            <p className="text-lg text-gray-600 mb-2">
              Use natural language to describe your ideal home
            </p>
            <div className="flex items-center justify-center gap-2 text-sm text-blue-600">
              <Sparkles className="h-4 w-4" />
              <span>Powered by AI semantic search</span>
            </div>
          </motion.div>

          {/* Enhanced Search Bar */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-8"
          >
            <SearchBarEnhanced
              onSearch={handleSearch}
              onFiltersChange={handleFiltersChange}
              isLoading={isLoading}
              showFilters={true}
              defaultFilters={searchFilters}
              error={isError ? error?.message : undefined}
              showSemanticAnalysis={true}
              enableSuggestions={true}
              className="mb-6"
            />
          </motion.div>

          {/* Example Searches */}
          {!searchQuery && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-center mb-8"
            >
              <p className="text-gray-600 mb-4">Try searching for:</p>
              <div className="flex flex-wrap justify-center gap-3">
                {exampleSearches.map((example, index) => (
                  <button
                    key={index}
                    onClick={() => handleExampleSearch(example)}
                    className="px-4 py-2 text-sm bg-white border border-gray-200 rounded-full 
                             hover:border-blue-300 hover:bg-blue-50 transition-colors"
                    data-testid={`example-search-${index}`}
                  >
                    {example}
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* Search Results */}
          {searchQuery && (
            <div className="space-y-6">
              {/* Results Header */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center"
              >
                <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                  Search Results for &ldquo;{searchQuery}&rdquo;
                </h2>
                {analysis && (
                  <p className="text-gray-600">
                    {analysis.intent}
                  </p>
                )}
              </motion.div>

              {/* Search Statistics */}
              <SearchStats 
                searchResults={searchResults}
                searchTime={searchResults?.searchTime}
                isSemanticSearch={isSemanticSearch}
              />

              {/* Loading State */}
              {isLoading && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center py-12"
                  data-testid="loading-state"
                >
                  <div className="flex items-center justify-center mb-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    <Sparkles className="h-6 w-6 text-blue-600 ml-3 animate-pulse" />
                  </div>
                  <p className="text-gray-600">AI is analyzing your search and finding the best matches...</p>
                </motion.div>
              )}

              {/* Error State */}
              {isError && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="bg-red-50 border border-red-200 rounded-lg p-6"
                  data-testid="error-state"
                >
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-6 w-6 text-red-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-red-900 mb-2">Search Error</h3>
                      <p className="text-red-700 mb-4">
                        {error?.message || 'Something went wrong while searching for properties.'}
                      </p>
                      <button
                        onClick={handleRetry}
                        className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
                      >
                        Try Again
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Results Grid */}
              {searchResults && searchResults.properties.length > 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                  data-testid="results-grid"
                >
                  {searchResults.properties.map((property, index) => (
                    <motion.div
                      key={property.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                    >
                      <PropertyCardEnhanced
                        property={property}
                        onPropertyClick={handlePropertyClick}
                        showRelevanceScore={isSemanticSearch}
                        showMatchReasons={isSemanticSearch}
                      />
                    </motion.div>
                  ))}
                </motion.div>
              )}

              {/* Load More Button */}
              {searchResults && searchResults.page < searchResults.totalPages && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center"
                >
                  <button
                    onClick={handleLoadMore}
                    disabled={isLoading}
                    className="bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 
                             disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                    data-testid="load-more-button"
                  >
                    {isLoading ? 'Loading...' : 'Load More Properties'}
                  </button>
                </motion.div>
              )}

              {/* No Results */}
              {searchResults && searchResults.properties.length === 0 && !isLoading && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center py-12"
                  data-testid="no-results"
                >
                  <Search className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">No Properties Found</h3>
                  <p className="text-gray-600 mb-6">
                    We couldn&apos;t find any properties matching your search criteria.
                  </p>
                  <div className="space-y-2">
                    <p className="text-sm text-gray-500">Try:</p>
                    <ul className="text-sm text-gray-600 space-y-1">
                      <li>• Using different keywords</li>
                      <li>• Expanding your price range</li>
                      <li>• Removing some filters</li>
                      <li>• Searching in nearby areas</li>
                    </ul>
                  </div>
                </motion.div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Property Detail Modal would go here */}
      {selectedProperty && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-screen overflow-y-auto">
            {/* Modal content would be implemented here */}
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-2xl font-bold">{selectedProperty.title}</h2>
                <button
                  onClick={() => setSelectedProperty(null)}
                  className="text-gray-500 hover:text-gray-700 text-xl"
                >
                  ×
                </button>
              </div>
              {/* Additional modal content */}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PropertySearchPageEnhanced;