'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { MapPin, Bed, Bath, Square, Calendar, Phone, Mail, Heart } from 'lucide-react';
import Image from 'next/image';
import { ErrorBoundary } from '@/components/ErrorBoundary';

interface Property {
    id: string;
    title: string;
    description: string;
    price: number;
    bedrooms: number;
    bathrooms: number;
    area: number;
    propertyType: string;
    listingType: string;
    location: {
        address: string;
        city: string;
        area: string;
        postcode: string;
        coordinates: {
            lat: number;
            lng: number;
        };
    };
    images: string[];
    features: string[];
    agentId: string;
    createdAt: string;
    updatedAt: string;
    isActive: boolean;
}

export default function PropertyDetailPage() {
    const params = useParams();
    const [property, setProperty] = useState<Property | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isFavorite, setIsFavorite] = useState(false);

    useEffect(() => {
        if (params.id) {
            fetchProperty(params.id as string);
        }
    }, [params.id]);

    const fetchProperty = async (id: string) => {
        try {
            setLoading(true);
            const response = await fetch(`/api/properties/${id}`);
            if (!response.ok) {
                throw new Error('Property not found');
            }
            const data = await response.json();
            setProperty(data.data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load property');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    if (error || !property) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <h1 className="text-2xl font-bold text-gray-900 mb-4">Property Not Found</h1>
                    <p className="text-gray-600">{error || 'The property you\'re looking for doesn\'t exist.'}</p>
                </div>
            </div>
        );
    }

    return (
        <ErrorBoundary>
            <div className="min-h-screen bg-gray-50">
                {/* Image Gallery */}
                <div className="relative h-96 md:h-[500px]">
                    <Image
                        src={property.images[0] || 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&h=500&fit=crop'}
                        alt={property.title}
                        fill
                        className="object-cover"
                    />
                    <div className="absolute top-4 right-4">
                        <button
                            onClick={() => setIsFavorite(!isFavorite)}
                            className={`p-3 rounded-full ${isFavorite ? 'bg-red-500 text-white' : 'bg-white text-gray-600'
                                } hover:scale-110 transition-all duration-200 shadow-lg`}
                        >
                            <Heart className={`w-6 h-6 ${isFavorite ? 'fill-current' : ''}`} />
                        </button>
                    </div>
                </div>

                <div className="container mx-auto px-4 py-8">
                    <div className="grid lg:grid-cols-3 gap-8">
                        {/* Main Content */}
                        <div className="lg:col-span-2">
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="bg-white rounded-xl shadow-lg p-6 mb-6"
                            >
                                <div className="flex items-center justify-between mb-4">
                                    <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                                        {property.propertyType}
                                    </span>
                                    <span className="text-3xl font-bold text-blue-600">
                                        £{property.price.toLocaleString()}
                                    </span>
                                </div>

                                <h1 className="text-3xl font-bold text-gray-900 mb-4">{property.title}</h1>

                                <div className="flex items-center text-gray-600 mb-6">
                                    <MapPin className="w-5 h-5 mr-2" />
                                    <span>{property.location.address}, {property.location.city}</span>
                                </div>

                                <div className="grid grid-cols-3 gap-4 mb-6">
                                    <div className="flex items-center">
                                        <Bed className="w-5 h-5 mr-2 text-gray-500" />
                                        <span className="font-medium">{property.bedrooms} Bedrooms</span>
                                    </div>
                                    <div className="flex items-center">
                                        <Bath className="w-5 h-5 mr-2 text-gray-500" />
                                        <span className="font-medium">{property.bathrooms} Bathrooms</span>
                                    </div>
                                    <div className="flex items-center">
                                        <Square className="w-5 h-5 mr-2 text-gray-500" />
                                        <span className="font-medium">{property.area} sq ft</span>
                                    </div>
                                </div>

                                <div className="prose max-w-none">
                                    <h3 className="text-xl font-semibold mb-3">Description</h3>
                                    <p className="text-gray-700 leading-relaxed">{property.description}</p>
                                </div>

                                {property.features.length > 0 && (
                                    <div className="mt-6">
                                        <h3 className="text-xl font-semibold mb-3">Features</h3>
                                        <div className="grid grid-cols-2 gap-2">
                                            {property.features.map((feature, index) => (
                                                <div key={index} className="flex items-center">
                                                    <div className="w-2 h-2 bg-blue-600 rounded-full mr-3"></div>
                                                    <span className="text-gray-700">{feature}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </motion.div>
                        </div>

                        {/* Sidebar */}
                        <div className="lg:col-span-1">
                            <motion.div
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="bg-white rounded-xl shadow-lg p-6 sticky top-4"
                            >
                                <h3 className="text-xl font-semibold mb-4">Contact Agent</h3>

                                <div className="space-y-4">
                                    <button className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors">
                                        <Phone className="w-5 h-5" />
                                        Call Agent
                                    </button>

                                    <button className="w-full flex items-center justify-center gap-2 border border-blue-600 text-blue-600 py-3 px-4 rounded-lg hover:bg-blue-50 transition-colors">
                                        <Mail className="w-5 h-5" />
                                        Send Message
                                    </button>
                                </div>

                                <div className="mt-6 pt-6 border-t border-gray-200">
                                    <div className="flex items-center text-sm text-gray-500">
                                        <Calendar className="w-4 h-4 mr-2" />
                                        <span>Listed {new Date(property.createdAt).toLocaleDateString()}</span>
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                    </div>
                </div>
            </div>
        </ErrorBoundary>
    );
}