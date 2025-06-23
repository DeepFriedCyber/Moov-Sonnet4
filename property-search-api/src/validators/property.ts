import { z } from 'zod';

export const searchPropertiesSchema = z.object({
    body: z.object({
        query: z.string().min(1).max(500),
        filters: z.object({
            minPrice: z.number().min(0).optional(),
            maxPrice: z.number().min(0).optional(),
            minBedrooms: z.number().min(0).max(10).optional(),
            maxBedrooms: z.number().min(0).max(10).optional(),
            propertyType: z.array(z.enum(['house', 'flat', 'bungalow', 'maisonette', 'studio'])).optional(),
            listingType: z.enum(['sale', 'rent']).optional(),
            location: z.string().optional(),
            radius: z.number().min(0).max(100).optional(),
            features: z.array(z.string()).optional(),
        }).optional(),
        sort: z.object({
            field: z.enum(['price', 'bedrooms', 'area', 'createdAt']),
            order: z.enum(['asc', 'desc']),
        }).optional(),
        pagination: z.object({
            page: z.number().min(1).default(1),
            limit: z.number().min(1).max(100).default(20),
        }).optional(),
    }),
});

export const createPropertySchema = z.object({
    body: z.object({
        title: z.string().min(1).max(200),
        description: z.string().min(1).max(5000),
        price: z.number().min(0),
        bedrooms: z.number().min(0).max(10),
        bathrooms: z.number().min(0).max(10),
        area: z.number().min(0),
        propertyType: z.enum(['house', 'flat', 'bungalow', 'maisonette', 'studio']),
        listingType: z.enum(['sale', 'rent']),
        location: z.object({
            address: z.string(),
            city: z.string(),
            area: z.string(),
            postcode: z.string().regex(/^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i),
            coordinates: z.object({
                lat: z.number().min(-90).max(90),
                lng: z.number().min(-180).max(180),
            }),
        }),
        images: z.array(z.string().url()).min(1).max(20),
        features: z.array(z.string()).max(50),
    }),
});

export const updatePropertySchema = z.object({
    params: z.object({
        id: z.string().uuid(),
    }),
    body: z.object({
        title: z.string().min(1).max(200).optional(),
        description: z.string().min(1).max(5000).optional(),
        price: z.number().min(0).optional(),
        bedrooms: z.number().min(0).max(10).optional(),
        bathrooms: z.number().min(0).max(10).optional(),
        area: z.number().min(0).optional(),
        propertyType: z.enum(['house', 'flat', 'bungalow', 'maisonette', 'studio']).optional(),
        listingType: z.enum(['sale', 'rent']).optional(),
        location: z.object({
            address: z.string(),
            city: z.string(),
            area: z.string(),
            postcode: z.string().regex(/^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i),
            coordinates: z.object({
                lat: z.number().min(-90).max(90),
                lng: z.number().min(-180).max(180),
            }),
        }).optional(),
        images: z.array(z.string().url()).min(1).max(20).optional(),
        features: z.array(z.string()).max(50).optional(),
        isActive: z.boolean().optional(),
    }),
});

export const getPropertySchema = z.object({
    params: z.object({
        id: z.string().uuid(),
    }),
});

// Validation middleware
export const validate = (schema: z.ZodSchema) => {
    return (req: any, res: any, next: any) => {
        try {
            schema.parse({
                body: req.body,
                query: req.query,
                params: req.params,
            });
            next();
        } catch (error) {
            if (error instanceof z.ZodError) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Validation error',
                    errors: error.errors,
                });
            }
            next(error);
        }
    };
};