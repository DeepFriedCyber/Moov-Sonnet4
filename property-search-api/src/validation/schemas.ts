import { z } from 'zod';
import DOMPurify from 'isomorphic-dompurify';
import bcrypt from 'bcrypt';

// Custom validators
const ukPostcodeRegex = /^[A-Z]{1,2}[0-9][A-Z0-9]? ?[0-9][A-Z]{2}$/i;
const ukPhoneRegex = /^(?:(?:\+44\s?|0)(?:7\d{3}|\d{2})\s?\d{3}\s?\d{4})$/;

// Sanitization functions
const sanitizeHtml = (value: string) => {
  return DOMPurify.sanitize(value, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'ul', 'ol', 'li'],
    ALLOWED_ATTR: [],
  });
};

const sanitizeSearchQuery = (value: string) => {
  // Remove SQL injection attempts
  return value
    .replace(/['";\\]/g, '')
    .replace(/--/g, '')
    .replace(/\/\*/g, '')
    .replace(/\*\//g, '')
    .replace(/\b(DROP|DELETE|INSERT|UPDATE|UNION|SELECT)\b/gi, '')
    .trim();
};

// Base schemas
export const CoordinatesSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const LocationSchema = z.object({
  address: z.string().min(1).max(200),
  city: z.string().min(1).max(100),
  postcode: z.string().regex(ukPostcodeRegex, 'Invalid UK postcode format'),
  area: z.string().max(100).optional(),
  coordinates: CoordinatesSchema,
});

export const PropertyFeaturesSchema = z.object({
  bedrooms: z.number().int().min(0).max(20),
  bathrooms: z.number().int().min(0).max(10),
  squareFootage: z.number().int().min(0).max(50000),
  amenities: z.array(z.string()).max(20).default([]),
});

export const ImageSchema = z.object({
  url: z.string().url(),
  alt: z.string().max(200),
  isPrimary: z.boolean().default(false),
});

// Main schemas
export const PropertySchema = z.object({
  title: z.string()
    .min(3, 'Title must be at least 3 characters')
    .max(200)
    .transform(sanitizeHtml),
  description: z.string()
    .min(10, 'Description must be at least 10 characters')
    .max(5000)
    .transform(sanitizeHtml),
  price: z.number()
    .int()
    .min(0, 'Price cannot be negative')
    .max(100000000, 'Price exceeds maximum'),
  propertyType: z.enum(['house', 'apartment', 'studio', 'townhouse', 'cottage']),
  location: LocationSchema,
  features: PropertyFeaturesSchema,
  images: z.array(ImageSchema).min(1).max(20),
  agent: z.object({
    name: z.string().max(100),
    email: z.string().email(),
    phone: z.string().regex(ukPhoneRegex, 'Invalid UK phone number'),
  }).optional(),
});

export const SearchQuerySchema = z.object({
  q: z.string()
    .min(1, 'Search query is required')
    .max(500, 'Search query too long')
    .transform(sanitizeSearchQuery),
  minPrice: z.coerce.number().int().min(0).optional(),
  maxPrice: z.coerce.number().int().min(0).optional(),
  bedrooms: z.coerce.number().int().min(0).max(20).optional(),
  bathrooms: z.coerce.number().int().min(0).max(10).optional(),
  propertyType: z.enum(['house', 'apartment', 'studio', 'townhouse', 'cottage']).optional(),
  radius: z.coerce.number().min(0).max(50).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
}).refine(data => {
  if (data.minPrice && data.maxPrice) {
    return data.minPrice <= data.maxPrice;
  }
  return true;
}, {
  message: 'Minimum price cannot exceed maximum price',
  path: ['minPrice'],
});

export const UserSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .transform(async (password) => {
      return await bcrypt.hash(password, 10);
    }),
  name: z.string().min(1).max(100).transform(sanitizeHtml),
  phone: z.string().regex(ukPhoneRegex).optional(),
  preferences: z.object({
    notifications: z.boolean().default(true),
    newsletter: z.boolean().default(false),
    searchAlerts: z.boolean().default(true),
  }).optional(),
});

// Validation wrapper
export class ValidationService {
  static validate<T>(schema: z.ZodSchema<T>, data: unknown): {
    isValid: boolean;
    value?: T;
    errors: Array<{ field: string; message: string }>;
  } {
    try {
      const value = schema.parse(data);
      return {
        isValid: true,
        value,
        errors: [],
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          isValid: false,
          errors: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
          })),
        };
      }
      throw error;
    }
  }

  static validateField<T>(
    schema: z.ZodSchema<T>,
    field: string,
    value: unknown
  ): { isValid: boolean; error?: string } {
    const fieldPath = field.split('.');
    let fieldSchema = schema;

    // Navigate to the specific field schema
    for (const path of fieldPath) {
      if (fieldSchema instanceof z.ZodObject) {
        fieldSchema = (fieldSchema as any).shape[path];
      }
    }

    try {
      fieldSchema.parse(value);
      return { isValid: true };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          isValid: false,
          error: error.errors[0]?.message,
        };
      }
      throw error;
    }
  }
}

// Express middleware
import { Request, Response, NextFunction } from 'express';

export function validateRequest(schema: z.ZodSchema) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const result = ValidationService.validate(schema, {
      ...req.body,
      ...req.query,
      ...req.params,
    });

    if (!result.isValid) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request data',
          details: result.errors,
        },
      });
    }

    // Attach validated data to request
    (req as any).validated = result.value;
    next();
  };
}