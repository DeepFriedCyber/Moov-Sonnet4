'use client';

import { motion } from 'framer-motion';
import { MapPin, Bed, Bath, Home } from 'lucide-react';
import Image from 'next/image';

const featuredProperties = [
    {
        id: 1,
        title: "Modern Flat in Central London",
        price: "£850,000",
        location: "London, SW1",
        bedrooms: 2,
        bathrooms: 2,
        image: "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=400&h=300&fit=crop",
        type: "Flat"
    },
    {
        id: 2,
        title: "Victorian Family Home",
        price: "£1,200,000",
        location: "London, N1",
        bedrooms: 4,
        bathrooms: 3,
        image: "https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=400&h=300&fit=crop",
        type: "House"
    },
    {
        id: 3,
        title: "Contemporary Apartment",
        price: "£650,000",
        location: "Manchester, M1",
        bedrooms: 1,
        bathrooms: 1,
        image: "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=400&h=300&fit=crop",
        type: "Studio"
    }
];

export default function PropertyShowcase() {
    return (
        <section className="py-24 bg-gray-50">
            <div className="container mx-auto px-4">
                <motion.div
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    className="text-center mb-16"
                >
                    <h2 className="text-4xl font-bold mb-4">Featured Properties</h2>
                    <p className="text-xl text-gray-600">Discover amazing homes found through AI search</p>
                </motion.div>

                <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
                    {featuredProperties.map((property, index) => (
                        <motion.div
                            key={property.id}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: index * 0.1 }}
                            whileHover={{ y: -5 }}
                            className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden"
                        >
                            <div className="relative h-48 overflow-hidden">
                                <Image
                                    src={property.image}
                                    alt={property.title}
                                    fill
                                    className="object-cover hover:scale-105 transition-transform duration-300"
                                />
                                <div className="absolute top-4 left-4">
                                    <span className="bg-blue-600 text-white px-3 py-1 rounded-full text-sm font-medium">
                                        {property.type}
                                    </span>
                                </div>
                            </div>

                            <div className="p-6">
                                <h3 className="text-xl font-semibold mb-2">{property.title}</h3>
                                <div className="flex items-center text-gray-600 mb-3">
                                    <MapPin className="w-4 h-4 mr-1" />
                                    <span className="text-sm">{property.location}</span>
                                </div>

                                <div className="flex items-center gap-4 mb-4 text-gray-600">
                                    <div className="flex items-center">
                                        <Bed className="w-4 h-4 mr-1" />
                                        <span className="text-sm">{property.bedrooms} bed</span>
                                    </div>
                                    <div className="flex items-center">
                                        <Bath className="w-4 h-4 mr-1" />
                                        <span className="text-sm">{property.bathrooms} bath</span>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between">
                                    <span className="text-2xl font-bold text-blue-600">{property.price}</span>
                                    <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                                        View Details
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}