// Simple API Integration Demo Page
'use client';

import React, { useState } from 'react';
import { usePropertySearch, useProperty, useCreateProperty, useHealthCheck } from '@/hooks/useApi';
import { Property } from '@/types';

export const ApiDemoPage: React.FC = () => {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedPropertyId, setSelectedPropertyId] = useState<string>('');
    const [isCreating, setIsCreating] = useState(false);

    // API Hooks
    const {
        data: searchResults,
        isLoading: isSearching,
        error: searchError,
        refetch: searchAgain
    } = usePropertySearch(
        { query: searchQuery },
        { enabled: !!searchQuery }
    );

    const {
        data: property,
        isLoading: isLoadingProperty,
        error: propertyError
    } = useProperty(selectedPropertyId);

    const {
        data: healthStatus,
        isLoading: isLoadingHealth
    } = useHealthCheck();

    const {
        mutate: createProperty,
        isPending: isCreatingProperty,
        error: createError,
        data: createdProperty
    } = useCreateProperty();

    // Event Handlers
    const handleSearch = () => {
        if (searchQuery.trim()) {
            searchAgain();
        }
    };

    const handleCreateProperty = () => {
        const newProperty = {
            title: 'Demo Property',
            description: 'A property created via API demo',
            price: 350000,
            bedrooms: 2,
            bathrooms: 1,
            area: 80,
            location: {
                address: '123 Demo Street',
                city: 'London',
                area: 'Demo Area',
                postcode: 'D1 1AA',
                coordinates: { lat: 51.5, lng: -0.1 },
            },
            images: [],
            features: ['Demo Feature'],
            propertyType: 'flat' as const,
            listingType: 'sale' as const,
            agentId: 'demo-agent',
            isActive: true,
        };

        createProperty(newProperty);
    };

    return (
        <div className="max-w-4xl mx-auto p-6 space-y-8">
            <h1 className="text-3xl font-bold">API Integration Demo</h1>

            {/* Health Check Section */}
            <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold mb-4">API Health Status</h2>
                {isLoadingHealth ? (
                    <p>Checking API health...</p>
                ) : healthStatus ? (
                    <div className="bg-green-50 p-4 rounded">
                        <p className="text-green-800">
                            ✅ API Status: {healthStatus.status}
                        </p>
                        <p className="text-sm text-green-600">
                            Last checked: {healthStatus.timestamp}
                        </p>
                    </div>
                ) : (
                    <div className="bg-red-50 p-4 rounded">
                        <p className="text-red-800">❌ API Health check failed</p>
                    </div>
                )}
            </div>

            {/* Search Section */}
            <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold mb-4">Property Search</h2>

                <div className="flex gap-2 mb-4">
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Enter search query (e.g., 'modern flat with balcony')"
                        className="flex-1 p-2 border rounded"
                    />
                    <button
                        onClick={handleSearch}
                        disabled={!searchQuery.trim() || isSearching}
                        className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
                    >
                        {isSearching ? 'Searching...' : 'Search'}
                    </button>
                </div>

                {/* Quick Examples */}
                <div className="mb-4">
                    <p className="text-sm text-gray-600 mb-2">Quick examples:</p>
                    <div className="flex flex-wrap gap-2">
                        {[
                            'modern 2-bedroom flat',
                            'house with garden',
                            'luxury apartment',
                            'pet-friendly property'
                        ].map((example) => (
                            <button
                                key={example}
                                onClick={() => setSearchQuery(example)}
                                className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded"
                            >
                                {example}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Search Results */}
                {searchError && (
                    <div className="bg-red-50 border border-red-200 p-4 rounded mb-4">
                        <p className="text-red-800">Search Error: {searchError.message}</p>
                    </div>
                )}

                {searchResults && (
                    <div className="bg-gray-50 p-4 rounded">
                        <h3 className="font-semibold mb-2">
                            Search Results ({searchResults.properties.length} properties)
                        </h3>
                        <p className="text-sm text-gray-600 mb-3">
                            Search completed in {searchResults.searchTime}ms
                        </p>

                        {searchResults.properties.length > 0 ? (
                            <div className="space-y-2">
                                {searchResults.properties.map((prop) => (
                                    <div
                                        key={prop.id}
                                        className="bg-white p-3 rounded border cursor-pointer hover:bg-gray-50"
                                        onClick={() => setSelectedPropertyId(prop.id)}
                                    >
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <h4 className="font-medium">{prop.title}</h4>
                                                <p className="text-sm text-gray-600">{prop.description}</p>
                                                <p className="text-sm text-blue-600">£{prop.price.toLocaleString()}</p>
                                            </div>
                                            {(prop as any).similarity_score && (
                                                <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded">
                                                    {Math.round((prop as any).similarity_score * 100)}% match
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-gray-600">No properties found for this search.</p>
                        )}
                    </div>
                )}
            </div>

            {/* Property Detail Section */}
            <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold mb-4">Property Details</h2>

                <div className="flex gap-2 mb-4">
                    <input
                        type="text"
                        value={selectedPropertyId}
                        onChange={(e) => setSelectedPropertyId(e.target.value)}
                        placeholder="Enter property ID"
                        className="flex-1 p-2 border rounded"
                    />
                    <button
                        onClick={() => setSelectedPropertyId(selectedPropertyId)}
                        disabled={!selectedPropertyId || isLoadingProperty}
                        className="px-4 py-2 bg-green-600 text-white rounded disabled:opacity-50"
                    >
                        {isLoadingProperty ? 'Loading...' : 'Get Property'}
                    </button>
                </div>

                {propertyError && (
                    <div className="bg-red-50 border border-red-200 p-4 rounded mb-4">
                        <p className="text-red-800">Property Error: {propertyError.message}</p>
                    </div>
                )}

                {property && (
                    <div className="bg-gray-50 p-4 rounded">
                        <h3 className="font-semibold mb-3">{property.title}</h3>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <p><strong>ID:</strong> {property.id}</p>
                                <p><strong>Price:</strong> £{property.price.toLocaleString()}</p>
                                <p><strong>Bedrooms:</strong> {property.bedrooms}</p>
                                <p><strong>Bathrooms:</strong> {property.bathrooms}</p>
                                <p><strong>Area:</strong> {property.area} sq ft</p>
                            </div>
                            <div>
                                <p><strong>Type:</strong> {property.propertyType}</p>
                                <p><strong>Listing:</strong> {property.listingType}</p>
                                <p><strong>Location:</strong> {property.location.city}</p>
                                <p><strong>Agent:</strong> {property.agentId}</p>
                                <p><strong>Active:</strong> {property.isActive ? 'Yes' : 'No'}</p>
                            </div>
                        </div>
                        <div className="mt-3">
                            <p><strong>Description:</strong></p>
                            <p className="text-gray-700">{property.description}</p>
                        </div>
                        {property.features.length > 0 && (
                            <div className="mt-3">
                                <p><strong>Features:</strong></p>
                                <div className="flex flex-wrap gap-1 mt-1">
                                    {property.features.map((feature, index) => (
                                        <span
                                            key={index}
                                            className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded"
                                        >
                                            {feature}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Create Property Section */}
            <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold mb-4">Create Property</h2>

                <button
                    onClick={handleCreateProperty}
                    disabled={isCreatingProperty}
                    className="px-4 py-2 bg-purple-600 text-white rounded disabled:opacity-50"
                >
                    {isCreatingProperty ? 'Creating...' : 'Create Demo Property'}
                </button>

                {createError && (
                    <div className="bg-red-50 border border-red-200 p-4 rounded mt-4">
                        <p className="text-red-800">Create Error: {createError.message}</p>
                    </div>
                )}

                {createdProperty && (
                    <div className="bg-green-50 border border-green-200 p-4 rounded mt-4">
                        <h3 className="font-semibold text-green-800 mb-2">
                            ✅ Property Created Successfully!
                        </h3>
                        <p className="text-green-700">
                            <strong>ID:</strong> {createdProperty.id}<br />
                            <strong>Title:</strong> {createdProperty.title}<br />
                            <strong>Price:</strong> £{createdProperty.price.toLocaleString()}
                        </p>
                        <button
                            onClick={() => setSelectedPropertyId(createdProperty.id)}
                            className="mt-2 px-3 py-1 bg-green-600 text-white text-sm rounded"
                        >
                            View Created Property
                        </button>
                    </div>
                )}
            </div>

            {/* API Usage Examples */}
            <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold mb-4">API Usage Examples</h2>

                <div className="space-y-4 text-sm">
                    <div>
                        <h3 className="font-medium mb-2">1. Search Properties:</h3>
                        <code className="bg-gray-100 p-2 rounded block">
                            {`const { data, isLoading, error } = usePropertySearch({ query: 'modern flat' });`}
                        </code>
                    </div>

                    <div>
                        <h3 className="font-medium mb-2">2. Get Property by ID:</h3>
                        <code className="bg-gray-100 p-2 rounded block">
                            {`const { data: property } = useProperty('property-id-123');`}
                        </code>
                    </div>

                    <div>
                        <h3 className="font-medium mb-2">3. Create Property:</h3>
                        <code className="bg-gray-100 p-2 rounded block">
                            {`const { mutate: createProperty } = useCreateProperty();
createProperty(propertyData);`}
                        </code>
                    </div>

                    <div>
                        <h3 className="font-medium mb-2">4. Health Check:</h3>
                        <code className="bg-gray-100 p-2 rounded block">
                            {`const { data: health } = useHealthCheck();`}
                        </code>
                    </div>
                </div>
            </div>
        </div>
    );
};