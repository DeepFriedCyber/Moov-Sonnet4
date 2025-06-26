import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';
import { ValidationError } from './ValidationError';
// Import type declarations to ensure they're loaded
import '../types/express';

// UK Postcode regex pattern
const UK_POSTCODE_REGEX = /^[A-Z]{1,2}[0-9][A-Z0-9]?\s?[0-9][A-Z]{2}$/i;

const PropertySearchSchema = z.object({
    query: z.string()
        .min(1, 'Search query cannot be empty')
        .max(100, 'Search query too long')
        .transform(str => str.trim())
        .refine(str => !/[<>]/.test(str), 'Invalid characters in search query')
        .optional(),

    price_min: z.coerce.number()
        .min(1000, 'Minimum price must be at least £1,000')
        .max(50000000, 'Minimum price too high')
        .optional(),

    price_max: z.coerce.number()
        .min(1000, 'Maximum price must be at least £1,000')
        .max(50000000, 'Maximum price cannot exceed £50M')
        .optional(),

    bedrooms: z.coerce.number()
        .min(0, 'Bedrooms cannot be negative')
        .max(20, 'Too many bedrooms specified')
        .optional(),

    bathrooms: z.coerce.number()
        .min(0, 'Bathrooms cannot be negative')
        .max(10, 'Too many bathrooms specified')
        .optional(),

    property_type: z.enum(['house', 'flat', 'studio', 'commercial', 'land'])
        .optional(),

    postcode: z.string()
        .regex(UK_POSTCODE_REGEX, 'Invalid UK postcode format')
        .transform(str => str.toUpperCase().replace(/\s+/g, ' ').trim())
        .optional(),

    latitude: z.coerce.number()
        .min(49.5, 'Latitude outside UK bounds')
        .max(61, 'Latitude outside UK bounds')
        .optional(),

    longitude: z.coerce.number()
        .min(-8, 'Longitude outside UK bounds')
        .max(2, 'Longitude outside UK bounds')
        .optional(),

    radius: z.coerce.number()
        .min(0.1, 'Radius too small')
        .max(50, 'Radius too large (max 50km)')
        .default(5)
        .optional(),

    page: z.coerce.number()
        .min(1, 'Page must be at least 1')
        .max(100, 'Page number too high')
        .default(1),

    limit: z.coerce.number()
        .min(1, 'Limit must be at least 1')
        .max(50, 'Limit cannot exceed 50')
        .default(20),

    sort: z.enum(['price_asc', 'price_desc', 'date_desc', 'relevance'])
        .default('relevance')
        .optional(),

    features: z.array(z.enum([
        'parking', 'garden', 'balcony', 'gym', 'concierge',
        'lift', 'terrace', 'fireplace', 'storage', 'pet_friendly'
    ])).optional()
}).refine((data) => {
    // Custom validation: price_max must be greater than price_min
    if (data.price_min && data.price_max && data.price_min >= data.price_max) {
        return false;
    }
    return true;
}, {
    message: 'price_max must be greater than price_min',
    path: ['price_max']
});

export type PropertySearchParams = z.infer<typeof PropertySearchSchema>;

export const validatePropertySearch = (
    req: Request,
    res: Response,
    next: NextFunction
): void => {
    try {
        // Parse and validate query parameters
        const validatedParams = PropertySearchSchema.parse(req.query);

        // Store validated params in a separate property to avoid TypeScript issues
        (req as any).validatedQuery = validatedParams;

        next();
    } catch (error) {
        if (error instanceof z.ZodError) {
            const validationError = new ValidationError(
                'Invalid search parameters',
                error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`)
            );
            res.status(400).json(validationError.toJSON());
        } else {
            next(error);
        }
    }
};