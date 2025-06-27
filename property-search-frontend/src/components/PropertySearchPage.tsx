// Complete Property Search Page with API Integration
'use client';

import React, { useState } from 'react';
import { usePropertySearch } from '@/hooks/useApi';
import { SearchBar } from './SearchBar';
import { Property } from '@/types';
import { AlertCircle, Search, MapPin, Bed, Bath, Square, Pound } from 'lucide-react';
import Image from 'next/image';

const EXAMPLE_SEARCHES = [
    'Pet-friendly flat with outdoor space',
    'Victorian house needing renovation',
    'New build near tech companies',
    'Modern apartment with balcony',
    'Family home with garden',
];

interface PropertyCardProps {
    property: Property & { similarity_score?: number };
    onPropertyClick?: (property: Property) => void;
}

const PropertyCard: React.FC<PropertyCardProps> = ({ property, onPropertyClick }) => {
    return (
        <div
            className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
            onClick={() => onPropertyClick?.(property)}
        >
            {/* Property Image */}
            <div className="h-48 bg-gray-200 flex items-center justify-center">
                {property.images.length > 0 ? (
                    <Image
                        src={property.images[0]}
                        alt={property.title}
                        width={400}
                        height={200}
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <div className="text-gray-400">No image available</div>
                )}
            </div>

            {/* Property Details */}
            <div className="p-4">
                <div className="flex justify-between items-start mb-2">
                    <h3 className="text-lg font-semibold line-clamp-2">{property.title}</h3>
                    {property.similarity_score && (
                        <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full ml-2">
                            {Math.round(property.similarity_score * 100)}% match
                        </span>
                    )}
                </div>

                <p className="text-gray-600 text-sm mb-3 line-clamp-2">{property.description}</p>

                {/* Price */}
                <div className="flex items-center mb-3">
                    <Pound className="w-4 h-4 text-green-600 mr-1" />
                    <span className="text-xl font-bold text-green-600">
                        {property.price.toLocaleString()}
                    </span>
                    <span className="text-gray-500 ml-1">
                        {property.listingType === 'rent' ? '/month' : ''}
                    </span>
                </div>

                {/* Property Features */}
                <div className="flex items-center gap-4 mb-3 text-sm text-gray-600">
                    <div className="flex items-center">
                        <Bed className="w-4 h-4 mr-1" />
                        <span>{property.bedrooms} bed</span>
                    </div>
                    <div className="flex items-center">
                        <Bath className="w-4 h-4 mr-1" />
                        <span>{property.bathrooms} bath</span>
                    </div>
                    <div className="flex items-center">
                        <Square className="w-4 h-4 mr-1" />
                        <span>{property.area} sq ft</span>
                    </div>
                </div>

                {/* Location */}
                <div className="flex items-center text-sm text-gray-600">
                    <MapPin className="w-4 h-4 mr-1" />
                    <span>{property.location.area}, {property.location.city}</span>
                </div>

                {/* Property Type & Listing Type */}
                <div className="flex gap-2 mt-3">
                    <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full capitalize">
                        {property.propertyType}
                    </span>
                    <span className="bg-purple-100 text-purple-800 text-xs px-2 py-1 rounded-full capitalize">
                        For {property.listingType}
                    </span>
                </div>
            </div>
        </div>
    );
};

interface ExampleSearchesProps {
    examples: string[];
    onSelect: (example: string) => void;
    title: string;
}

const ExampleSearches: React.FC<ExampleSearchesProps> = ({ examples, onSelect, title }) => {
    return (
        <div className="text-center">
            <p className="text-gray-600 mb-3">{title}</p>
            <div className="flex flex-wrap justify-center gap-2">
                {examples.map((example, index) => (
                    <button
                        key={index}
                        onClick={() => onSelect(example)}
                        className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
                    >
                        {example}
                    </button>
                ))}
            </div>
        </div>
    );
};

interface PropertyDetailModalProps {
    property: Property | null;
    onClose: () => void;
}

const PropertyDetailModal: React.FC<PropertyDetailModalProps> = ({ property, onClose }) => {
    if (!property) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-screen overflow-y-auto">
                <div className="p-6">
                    <div className="flex justify-between items-start mb-4">
                        <h2 className="text-2xl font-bold">{property.title}</h2>
                        <button
                            onClick={onClose}
                            className="text-gray-500 hover:text-gray-700 text-xl"
                        >
                            ×
                        </button>
                    </div>

                    {/* Property Images */}
                    {property.images.length > 0 && (
                        <div className="mb-4">
                            <Image
                                src={property.images[0]}
                                alt={property.title}
                                width={600}
                                height={256}
                                className="w-full h-64 object-cover rounded-lg"
                            />
                        </div>
                    )}

                    {/* Property Details */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <h3 className="font-semibold mb-2">Description</h3>
                            <p className="text-gray-600 mb-4">{property.description}</p>

                            <h3 className="font-semibold mb-2">Details</h3>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span>Price:</span>
                                    <span className="font-semibold">£{property.price.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Bedrooms:</span>
                                    <span>{property.bedrooms}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Bathrooms:</span>
                                    <span>{property.bathrooms}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Area:</span>
                                    <span>{property.area} sq ft</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Type:</span>
                                    <span className="capitalize">{property.propertyType}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Listing:</span>
                                    <span className="capitalize">For {property.listingType}</span>
                                </div>
                            </div>
                        </div>

                        <div>
                            <h3 className="font-semibold mb-2">Location</h3>
                            <div className="text-sm space-y-1 mb-4">
                                <p>{property.location.address}</p>
                                <p>{property.location.area}, {property.location.city}</p>
                                <p>{property.location.postcode}</p>
                            </div>

                            {property.features.length > 0 && (
                                <>
                                    <h3 className="font-semibold mb-2">Features</h3>
                                    <div className="flex flex-wrap gap-2">
                                        {property.features.map((feature, index) => (
                                            <span
                                                key={index}
                                                className="bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded-full"
                                            >
                                                {feature}
                                            </span>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export const PropertySearchPage: React.FC = () => {
    const [searchQuery, setSearchQuery] = useState('');
    const [activeQuery, setActiveQuery] = useState('');
    const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);

    const { data, isLoading, isError, error } = usePropertySearch(
        { query: activeQuery },
        { enabled: !!activeQuery }
    );

    const handleSearch = async ({ query }: { query: string }) => {
        setActiveQuery(query);
    };

    const handleExampleSelect = (example: string) => {
        setSearchQuery(example);
        setActiveQuery(example);
    };

    const handlePropertyClick = (property: Property) => {
        setSelectedProperty(property);
    };

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="container mx-auto px-4 py-8">
                <div className="max-w-4xl mx-auto">
                    {/* Header */}
                    <div className="text-center mb-8">
                        <h1 className="text-4xl font-bold text-gray-900 mb-4">
                            Find Your Perfect Property
                        </h1>
                        <p className="text-lg text-gray-600">
                            Use natural language to describe your ideal home
                        </p>
                    </div>

                    {/* Search Interface */}
                    <div className="space-y-4 mb-8">
                        <SearchBar
                            onSearch={handleSearch}
                            value={searchQuery}
                            onChange={setSearchQuery}
                        />

                        <ExampleSearches
                            examples={EXAMPLE_SEARCHES}
                            onSelect={handleExampleSelect}
                            title="Try searching for:"
                        />
                    </div>

                    {/* Search Results */}
                    {activeQuery && (
                        <div className="space-y-6">
                            {/* Results Header */}
                            <div className="text-center">
                                <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                                    Search Results for &ldquo;{activeQuery}&rdquo;
                                </h2>
                            </div>

                            {/* Loading State */}
                            {isLoading && (
                                <div className="text-center py-8">
                                    <div className="flex items-center justify-center mb-4">
                                        <Search className="w-6 h-6 text-gray-400 animate-spin mr-2" />
                                        <span className="text-gray-600">Searching properties...</span>
                                    </div>
                                    <div className="space-y-4" data-testid="loading-skeleton">
                                        {[1, 2, 3].map(i => (
                                            <div key={i} className="h-48 bg-gray-200 rounded-lg animate-pulse" />
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Error State */}
                            {isError && (
                                <div className="bg-red-50 border border-red-200 rounded-lg p-6">
                                    <div className="flex items-start gap-3">
                                        <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                                        <div>
                                            <h3 className="font-semibold text-red-900">
                                                Error searching properties
                                            </h3>
                                            <p className="text-red-700 mt-1">
                                                {error?.message || 'An unexpected error occurred'}
                                            </p>
                                            <button
                                                onClick={() => setActiveQuery('')}
                                                className="mt-3 px-4 py-2 bg-red-100 text-red-700 rounded-md hover:bg-red-200 transition-colors"
                                            >
                                                Clear Search
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Results */}
                            {data && !isLoading && (
                                <>
                                    {/* Results Summary */}
                                    <div className="flex justify-between items-center text-sm text-gray-600 border-b pb-4">
                                        <span>
                                            {data.properties.length > 0
                                                ? `${data.properties.length} properties found`
                                                : 'No properties found'
                                            }
                                        </span>
                                        <span>Search completed in {data.searchTime}ms</span>
                                    </div>

                                    {/* Property Grid */}
                                    {data.properties.length > 0 ? (
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                            {data.properties.map((property) => (
                                                <PropertyCard
                                                    key={property.id}
                                                    property={property}
                                                    onPropertyClick={handlePropertyClick}
                                                />
                                            ))}
                                        </div>
                                    ) : (
                                        /* Empty State */
                                        <div className="text-center py-12">
                                            <Search className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                                            <h3 className="text-lg font-semibold text-gray-900 mb-2">
                                                No properties found
                                            </h3>
                                            <p className="text-gray-600 mb-4">
                                                Try adjusting your search criteria or browse our examples above.
                                            </p>
                                            <button
                                                onClick={() => setActiveQuery('')}
                                                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                                            >
                                                Start New Search
                                            </button>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}

                    {/* Property Detail Modal */}
                    <PropertyDetailModal
                        property={selectedProperty}
                        onClose={() => setSelectedProperty(null)}
                    />
                </div>
            </div>
        </div>
    );
};