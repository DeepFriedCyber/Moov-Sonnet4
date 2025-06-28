// ============================================================================
// Property Validation Layer with TDD Approach
// ============================================================================

import Joi from 'joi';
import { Request, Response, NextFunction } from 'express';
import { AppError } from '../middleware/errorHandler';

// Property creation schema
const propertySchema = Joi.object({
    title: Joi.string()
        .min(3)
        .max(100)
        .required()
        .messages({
            'string.min': 'Title must be at least 3 characters long',
            'string.max': 'Title cannot exceed 100 characters',
            'any.required': 'Title is required'
        }),

    description: Joi.string()
        .max(1000)
        .allow('')
        .optional()
        .messages({
            'string.max': 'Description cannot exceed 1000 characters'
        }),

    price: Joi.number()
        .positive()
        .precision(2)
        .required()
        .messages({
            'number.positive': 'Price must be a positive number',
            'any.required': 'Price is required'
        }),

    location: Joi.string()
        .min(2)
        .max(200)
        .required()
        .messages({
            'string.min': 'Location must be at least 2 characters long',
            'string.max': 'Location cannot exceed 200 characters',
            'any.required': 'Location is required'
        }),

    latitude: Joi.number()
        .min(-90)
        .max(90)
        .optional()
        .messages({
            'number.min': 'Latitude must be between -90 and 90',
            'number.max': 'Latitude must be between -90 and 90'
        }),

    longitude: Joi.number()
        .min(-180)
        .max(180)
        .optional()
        .messages({
            'number.min': 'Longitude must be between -180 and 180',
            'number.max': 'Longitude must be between -180 and 180'
        }),

    bedrooms: Joi.number()
        .integer()
        .min(0)
        .max(20)
        .optional()
        .messages({
            'number.integer': 'Bedrooms must be a whole number',
            'number.min': 'Bedrooms cannot be negative',
            'number.max': 'Bedrooms cannot exceed 20'
        }),

    bathrooms: Joi.number()
        .positive()
        .max(20)
        .optional()
        .messages({
            'number.positive': 'Bathrooms must be a positive number',
            'number.max': 'Bathrooms cannot exceed 20'
        }),

    area: Joi.number()
        .integer()
        .positive()
        .optional()
        .messages({
            'number.integer': 'Area must be a whole number',
            'number.positive': 'Area must be a positive number'
        }),

    propertyType: Joi.string()
        .valid('apartment', 'house', 'studio', 'commercial')
        .required()
        .messages({
            'any.only': 'Property type must be one of: apartment, house, studio, commercial',
            'any.required': 'Property type is required'
        }),

    images: Joi.array()
        .items(Joi.string().uri())
        .max(20)
        .default([])
        .messages({
            'array.max': 'Cannot have more than 20 images',
            'string.uri': 'Each image must be a valid URL'
        }),

    features: Joi.array()
        .items(Joi.string().max(50))
        .max(30)
        .default([])
        .messages({
            'array.max': 'Cannot have more than 30 features',
            'string.max': 'Each feature cannot exceed 50 characters'
        }),

    isActive: Joi.boolean()
        .default(true)
});

// Property update schema (all fields optional except id)
const propertyUpdateSchema = propertySchema.fork(
    ['title', 'price', 'location', 'propertyType'],
    (schema) => schema.optional()
);

// Property search schema
const propertySearchSchema = Joi.object({
    query: Joi.string()
        .max(200)
        .optional()
        .messages({
            'string.max': 'Search query cannot exceed 200 characters'
        }),

    minPrice: Joi.number()
        .positive()
        .optional()
        .messages({
            'number.positive': 'Minimum price must be positive'
        }),

    maxPrice: Joi.number()
        .positive()
        .optional()
        .messages({
            'number.positive': 'Maximum price must be positive'
        }),

    bedrooms: Joi.number()
        .integer()
        .min(0)
        .max(20)
        .optional()
        .messages({
            'number.integer': 'Bedrooms must be a whole number',
            'number.min': 'Bedrooms cannot be negative',
            'number.max': 'Bedrooms cannot exceed 20'
        }),

    bathrooms: Joi.number()
        .positive()
        .max(20)
        .optional()
        .messages({
            'number.positive': 'Bathrooms must be positive',
            'number.max': 'Bathrooms cannot exceed 20'
        }),

    location: Joi.string()
        .max(200)
        .optional()
        .messages({
            'string.max': 'Location cannot exceed 200 characters'
        }),

    propertyType: Joi.string()
        .valid('apartment', 'house', 'studio', 'commercial')
        .optional()
        .messages({
            'any.only': 'Property type must be one of: apartment, house, studio, commercial'
        }),

    features: Joi.array()
        .items(Joi.string().max(50))
        .max(10)
        .optional()
        .messages({
            'array.max': 'Cannot filter by more than 10 features',
            'string.max': 'Each feature cannot exceed 50 characters'
        }),

    page: Joi.number()
        .integer()
        .min(1)
        .default(1)
        .messages({
            'number.integer': 'Page must be a whole number',
            'number.min': 'Page must be at least 1'
        }),

    limit: Joi.number()
        .integer()
        .min(1)
        .max(100)
        .default(20)
        .messages({
            'number.integer': 'Limit must be a whole number',
            'number.min': 'Limit must be at least 1',
            'number.max': 'Limit cannot exceed 100'
        }),

    sortBy: Joi.string()
        .valid('price', 'createdAt', 'bedrooms', 'area', 'title')
        .default('createdAt')
        .messages({
            'any.only': 'Sort by must be one of: price, createdAt, bedrooms, area, title'
        }),

    sortOrder: Joi.string()
        .valid('asc', 'desc')
        .default('desc')
        .messages({
            'any.only': 'Sort order must be either asc or desc'
        })
}).custom((value, helpers) => {
    // Custom validation: maxPrice should be greater than minPrice
    if (value.minPrice && value.maxPrice && value.minPrice >= value.maxPrice) {
        return helpers.error('custom.priceRange');
    }
    return value;
}).messages({
    'custom.priceRange': 'Maximum price must be greater than minimum price'
});

// Generic validation middleware factory
export const validateSchema = (schema: Joi.ObjectSchema, source: 'body' | 'query' | 'params' = 'body') => {
    return (req: Request, res: Response, next: NextFunction) => {
        const data = req[source];
        const { error, value } = schema.validate(data, {
            abortEarly: false,
            stripUnknown: true,
            convert: true
        });

        if (error) {
            const message = error.details.map(detail => detail.message).join(', ');
            return next(new AppError(message, 400, 'VALIDATION_ERROR'));
        }

        // Replace the original data with validated and converted data
        req[source] = value;
        next();
    };
};

// Specific validation middlewares
export const validateCreateProperty = validateSchema(propertySchema, 'body');
export const validateUpdateProperty = validateSchema(propertyUpdateSchema, 'body');
export const validatePropertySearch = validateSchema(propertySearchSchema, 'query');

// ID validation
export const validatePropertyId = validateSchema(
    Joi.object({
        id: Joi.string()
            .uuid()
            .required()
            .messages({
                'string.uuid': 'Property ID must be a valid UUID',
                'any.required': 'Property ID is required'
            })
    }),
    'params'
);

// Bulk operations validation
export const validateBulkPropertyIds = validateSchema(
    Joi.object({
        ids: Joi.array()
            .items(Joi.string().uuid())
            .min(1)
            .max(100)
            .required()
            .messages({
                'array.min': 'At least one property ID is required',
                'array.max': 'Cannot process more than 100 properties at once',
                'string.uuid': 'Each property ID must be a valid UUID',
                'any.required': 'Property IDs are required'
            })
    }),
    'body'
);

// Enhanced search validation
export const validateEnhancedSearch = validateSchema(
    Joi.object({
        query: Joi.string()
            .min(1)
            .max(500)
            .required()
            .messages({
                'string.min': 'Search query cannot be empty',
                'string.max': 'Search query cannot exceed 500 characters',
                'any.required': 'Search query is required'
            }),

        filters: Joi.object({
            minPrice: Joi.number().positive().optional(),
            maxPrice: Joi.number().positive().optional(),
            bedrooms: Joi.number().integer().min(0).max(20).optional(),
            bathrooms: Joi.number().positive().max(20).optional(),
            location: Joi.string().max(200).optional(),
            propertyType: Joi.string().valid('apartment', 'house', 'studio', 'commercial').optional(),
            features: Joi.array().items(Joi.string().max(50)).max(10).optional()
        }).optional(),

        limit: Joi.number()
            .integer()
            .min(1)
            .max(100)
            .default(20)
            .messages({
                'number.integer': 'Limit must be a whole number',
                'number.min': 'Limit must be at least 1',
                'number.max': 'Limit cannot exceed 100'
            }),

        threshold: Joi.number()
            .min(0)
            .max(1)
            .default(0.3)
            .messages({
                'number.min': 'Similarity threshold must be between 0 and 1',
                'number.max': 'Similarity threshold must be between 0 and 1'
            })
    }),
    'body'
);

export default {
    validateCreateProperty,
    validateUpdateProperty,
    validatePropertySearch,
    validatePropertyId,
    validateBulkPropertyIds,
    validateEnhancedSearch,
    validateSchema
};