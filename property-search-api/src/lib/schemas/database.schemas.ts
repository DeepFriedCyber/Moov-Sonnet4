// Database schemas for validation and type safety
import { z } from 'zod';

// Property creation schema
export const CreatePropertySchema = z.object({
    title: z.string().min(1, 'Title is required'),
    description: z.string(),
    price: z.number().positive('Price must be positive'),
    bedrooms: z.number().int().min(0, 'Bedrooms must be non-negative'),
    bathrooms: z.number().int().min(0, 'Bathrooms must be non-negative'),
    area: z.number().positive('Area must be positive'),
    location: z.object({
        address: z.string().min(1, 'Address is required'),
        city: z.string().min(1, 'City is required'),
        area: z.string().min(1, 'Area is required'),
        postcode: z.string().min(1, 'Postcode is required'),
        coordinates: z.object({
            lat: z.number().min(-90).max(90, 'Latitude must be between -90 and 90'),
            lng: z.number().min(-180).max(180, 'Longitude must be between -180 and 180'),
        }),
    }),
    images: z.array(z.string().url('Invalid image URL')).default([]),
    features: z.array(z.string()).default([]),
    propertyType: z.enum(['house', 'flat', 'bungalow', 'maisonette', 'studio']),
    listingType: z.enum(['sale', 'rent']),
});

// Search options schema
export const SearchOptionsSchema = z.object({
    embedding: z.array(z.number()).min(1, 'Embedding vector is required'),
    filters: z.object({
        minPrice: z.number().positive().optional(),
        maxPrice: z.number().positive().optional(),
        minBedrooms: z.number().int().min(0).optional(),
        maxBedrooms: z.number().int().min(0).optional(),
        propertyTypes: z.array(z.string()).optional(),
        location: z.string().optional(),
    }).optional(),
    limit: z.number().int().min(1).max(100).default(20),
    offset: z.number().int().min(0).default(0),
    similarityThreshold: z.number().min(0).max(1).default(0.3),
});

// Database configuration schema
export const DatabaseConfigSchema = z.object({
    connectionString: z.string().min(1, 'Connection string is required'),
    maxConnections: z.number().int().min(1).default(20),
    idleTimeoutMillis: z.number().int().min(1000).default(30000),
    connectionTimeoutMillis: z.number().int().min(1000).default(5000),
    enableSSL: z.boolean().default(false),
    retryAttempts: z.number().int().min(0).default(3),
    retryDelay: z.number().int().min(100).default(1000),
});

// Type exports
export type CreatePropertyData = z.infer<typeof CreatePropertySchema>;
export type SearchOptions = z.infer<typeof SearchOptionsSchema>;
export type DatabaseConfig = z.infer<typeof DatabaseConfigSchema>;