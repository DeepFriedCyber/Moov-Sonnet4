// ===== FIX 1: Extend Express Request Type =====
// property-search-api/src/types/express.d.ts
import { PropertySearchParams } from '../validation/propertySearchValidation';
import { PropertyCreateData } from '../validation/propertyDataValidation';
import { UserRegistrationData, UserLoginData } from '../validation/userAuthValidation';

declare global {
  namespace Express {
    interface Request {
      // Validated query parameters
      validatedQuery?: PropertySearchParams;
      
      // Validated body data
      validatedBody?: PropertyCreateData | UserRegistrationData | UserLoginData;
      
      // User information (for authentication)
      user?: {
        id: string;
        email: string;
        tier: 'anonymous' | 'authenticated' | 'premium';
      };
      
      // Additional context
      correlationId?: string;
      startTime?: number;
    }
  }
}

// ===== FIX 2: Updated Property Search Validation =====
// property-search-api/src/validation/propertySearchValidation.ts
import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';
import { ValidationError } from './ValidationError';

// UK Postcode regex pattern
const UK_POSTCODE_REGEX = /^[A-Z]{1,2}[0-9][A-Z0-9]?\s?[0-9][A-Z]{2}$/i;

const PropertySearchSchema = z.object({
  query: z.string()
    .min(1, 'Search query is required')
    .max(100, 'Search query too long')
    .transform(str => str.trim())
    .refine(str => !/[<>]/.test(str), 'Invalid characters in search query'),
  
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

// FIXED: Updated validation middleware with proper TypeScript support
export const validatePropertySearch = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    // Parse and validate query parameters
    const validatedParams = PropertySearchSchema.parse(req.query);
    
    // Store validated params in a separate property to avoid TypeScript issues
    req.validatedQuery = validatedParams;
    
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

// ===== FIX 3: Updated Validation Middleware Factory =====
// property-search-api/src/middleware/validationMiddleware.ts
import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';
import { ValidationError } from '../validation/ValidationError';

// Generic validation middleware with proper TypeScript support
export const createValidationMiddleware = <T extends z.ZodType>(
  schema: T,
  source: 'body' | 'query' | 'params' = 'body'
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const data = req[source];
      const validatedData = schema.parse(data);
      
      // Store validated data in appropriate property
      if (source === 'body') {
        req.validatedBody = validatedData;
      } else if (source === 'query') {
        req.validatedQuery = validatedData;
      } else if (source === 'params') {
        // For params, we can safely assign since it's usually just string keys
        req.params = validatedData as any;
      }
      
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationError = new ValidationError(
          'Validation failed',
          error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`)
        );
        res.status(400).json(validationError.toJSON());
      } else {
        next(error);
      }
    }
  };
};

// Type-safe helper to get validated data
export const getValidatedQuery = <T>(req: Request): T => {
  if (!req.validatedQuery) {
    throw new Error('Query parameters not validated. Make sure to use validation middleware.');
  }
  return req.validatedQuery as T;
};

export const getValidatedBody = <T>(req: Request): T => {
  if (!req.validatedBody) {
    throw new Error('Body not validated. Make sure to use validation middleware.');
  }
  return req.validatedBody as T;
};

// ===== FIX 4: Updated Routes with Proper TypeScript =====
// property-search-api/src/routes/properties.ts
import { Router, Request, Response } from 'express';
import { validatePropertySearch, PropertySearchParams } from '../validation/propertySearchValidation';
import { createValidationMiddleware, getValidatedQuery, getValidatedBody } from '../middleware/validationMiddleware';
import { PropertySchema, PropertyCreateData } from '../validation/propertyDataValidation';
import { PropertyRateLimiter } from '../middleware/PropertyRateLimiter';
import { asyncErrorWrapper } from '../middleware/errorHandler';
import { redis } from '../config/redis';

const router = Router();
const propertyLimiter = new PropertyRateLimiter(redis);

// Property search endpoint with proper TypeScript support
router.get('/search', 
  propertyLimiter.searchLimiter(),
  validatePropertySearch,
  asyncErrorWrapper(async (req: Request, res: Response) => {
    // Type-safe access to validated query parameters
    const searchParams = getValidatedQuery<PropertySearchParams>(req);
    
    // Now you can use searchParams with full type safety
    const results = await searchProperties(searchParams);
    
    res.json({
      success: true,
      data: results,
      pagination: {
        page: searchParams.page,
        limit: searchParams.limit,
        total: results.length
      }
    });
  })
);

// Property creation endpoint
router.post('/',
  propertyLimiter.favoritesLimiter(),
  createValidationMiddleware(PropertySchema, 'body'),
  asyncErrorWrapper(async (req: Request, res: Response) => {
    // Type-safe access to validated body
    const propertyData = getValidatedBody<PropertyCreateData>(req);
    
    const newProperty = await createProperty(propertyData);
    
    res.status(201).json({
      success: true,
      data: newProperty
    });
  })
);

// Property details endpoint with URL parameter validation
const PropertyParamsSchema = z.object({
  id: z.string()
    .regex(/^\d+$/, 'Property ID must be a number')
    .transform(str => parseInt(str, 10))
});

router.get('/details/:id',
  propertyLimiter.detailsLimiter(),
  createValidationMiddleware(PropertyParamsSchema, 'params'),
  asyncErrorWrapper(async (req: Request, res: Response) => {
    const { id } = req.params; // This is now validated as a number
    
    const property = await getPropertyDetails(id);
    
    if (!property) {
      throw new PropertyNotFoundError(id.toString());
    }
    
    res.json({
      success: true,
      data: property
    });
  })
);

export { router as propertyRoutes };

// ===== FIX 5: Example Service Function with Type Safety =====
// property-search-api/src/services/propertyService.ts
import { PropertySearchParams } from '../validation/propertySearchValidation';
import { PropertyCreateData } from '../validation/propertyDataValidation';
import { AdvancedConnectionPool } from '../database/AdvancedConnectionPool';

export class PropertyService {
  constructor(private pool: AdvancedConnectionPool) {}

  async searchProperties(params: PropertySearchParams) {
    const connection = await this.pool.acquire();
    
    try {
      // Build query with type-safe parameters
      let sql = `
        SELECT p.*, 
               COUNT(*) OVER() as total_count
        FROM properties p
        WHERE 1=1
      `;
      
      const queryParams: any[] = [];
      let paramIndex = 1;

      // Type-safe parameter building
      if (params.query) {
        sql += ` AND (p.title ILIKE $${paramIndex} OR p.description ILIKE $${paramIndex})`;
        queryParams.push(`%${params.query}%`);
        paramIndex++;
      }

      if (params.price_min !== undefined) {
        sql += ` AND p.price >= $${paramIndex}`;
        queryParams.push(params.price_min);
        paramIndex++;
      }

      if (params.price_max !== undefined) {
        sql += ` AND p.price <= $${paramIndex}`;
        queryParams.push(params.price_max);
        paramIndex++;
      }

      if (params.bedrooms !== undefined) {
        sql += ` AND p.bedrooms >= $${paramIndex}`;
        queryParams.push(params.bedrooms);
        paramIndex++;
      }

      if (params.property_type) {
        sql += ` AND p.property_type = $${paramIndex}`;
        queryParams.push(params.property_type);
        paramIndex++;
      }

      if (params.postcode) {
        sql += ` AND p.postcode = $${paramIndex}`;
        queryParams.push(params.postcode);
        paramIndex++;
      }

      // Geographic search
      if (params.latitude && params.longitude && params.radius) {
        sql += ` AND ST_DWithin(
          ST_Point(p.longitude, p.latitude)::geography,
          ST_Point($${paramIndex}, $${paramIndex + 1})::geography,
          $${paramIndex + 2} * 1000
        )`;
        queryParams.push(params.longitude, params.latitude, params.radius);
        paramIndex += 3;
      }

      // Sorting
      const sortOrder = this.getSortOrder(params.sort || 'relevance');
      sql += ` ORDER BY ${sortOrder}`;

      // Pagination
      sql += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      queryParams.push(params.limit, (params.page - 1) * params.limit);

      const result = await connection.query(sql, queryParams);
      
      return {
        properties: result.rows,
        totalCount: result.rows[0]?.total_count || 0,
        page: params.page,
        limit: params.limit,
        totalPages: Math.ceil((result.rows[0]?.total_count || 0) / params.limit)
      };
      
    } finally {
      await this.pool.release(connection);
    }
  }

  async createProperty(data: PropertyCreateData) {
    const connection = await this.pool.acquire();
    
    try {
      const sql = `
        INSERT INTO properties (
          title, description, price, bedrooms, bathrooms, property_type,
          postcode, latitude, longitude, square_feet, images, features,
          available, energy_rating, council_tax_band, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW(), NOW()
        ) RETURNING *
      `;

      const params = [
        data.title,
        data.description,
        data.price,
        data.bedrooms,
        data.bathrooms,
        data.property_type,
        data.postcode,
        data.latitude,
        data.longitude,
        data.square_feet,
        JSON.stringify(data.images),
        JSON.stringify(data.features),
        data.available,
        data.energy_rating,
        data.council_tax_band
      ];

      const result = await connection.query(sql, params);
      return result.rows[0];
      
    } finally {
      await this.pool.release(connection);
    }
  }

  private getSortOrder(sort: PropertySearchParams['sort']): string {
    const sortOptions = {
      'price_asc': 'p.price ASC',
      'price_desc': 'p.price DESC',
      'date_desc': 'p.created_at DESC',
      'relevance': 'p.created_at DESC' // Default relevance sorting
    };
    
    return sortOptions[sort || 'relevance'];
  }
}

// ===== FIX 6: Updated Tests to Use New Type System =====
// property-search-api/src/__tests__/routes/properties.test.ts
import request from 'supertest';
import { app } from '../../app';
import { PropertySearchParams } from '../../validation/propertySearchValidation';

describe('Property Routes with TypeScript Integration', () => {
  test('should handle valid search parameters', async () => {
    const validParams = {
      query: 'london apartment',
      price_min: '100000',
      price_max: '500000',
      bedrooms: '2',
      page: '1',
      limit: '20'
    };

    const response = await request(app)
      .get('/api/properties/search')
      .query(validParams)
      .expect(200);

    expect(response.body).toMatchObject({
      success: true,
      data: expect.any(Object),
      pagination: {
        page: 1,
        limit: 20,
        total: expect.any(Number)
      }
    });
  });

  test('should return validation errors for invalid parameters', async () => {
    const invalidParams = {
      query: '', // Empty query
      price_min: 'invalid', // Not a number
      page: '0' // Invalid page number
    };

    const response = await request(app)
      .get('/api/properties/search')
      .query(invalidParams)
      .expect(400);

    expect(response.body).toMatchObject({
      error: 'Invalid search parameters',
      details: expect.arrayContaining([
        expect.stringContaining('query'),
        expect.stringContaining('price_min'),
        expect.stringContaining('page')
      ])
    });
  });

  test('should create property with valid data', async () => {
    const validPropertyData = {
      title: 'Beautiful 2-bedroom flat in Central London',
      description: 'A stunning apartment with modern amenities and excellent transport links.',
      price: 450000,
      bedrooms: 2,
      bathrooms: 1,
      property_type: 'flat',
      postcode: 'SW1A 1AA',
      latitude: 51.5074,
      longitude: -0.1278,
      square_feet: 800,
      images: ['https://example.com/image1.jpg'],
      features: ['parking', 'garden'],
      available: true,
      energy_rating: 'B',
      council_tax_band: 'D'
    };

    const response = await request(app)
      .post('/api/properties')
      .send(validPropertyData)
      .expect(201);

    expect(response.body).toMatchObject({
      success: true,
      data: expect.objectContaining({
        id: expect.any(Number),
        title: validPropertyData.title,
        price: validPropertyData.price
      })
    });
  });
});

// ===== FIX 7: TypeScript Configuration Update =====
// property-search-api/tsconfig.json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020"],
    "module": "commonjs",
    "rootDir": "./src",
    "outDir": "./dist",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "removeComments": false,
    "typeRoots": [
      "./node_modules/@types",
      "./src/types"
    ],
    "baseUrl": "./src",
    "paths": {
      "@/*": ["*"]
    }
  },
  "include": [
    "src/**/*",
    "src/types/**/*"
  ],
  "exclude": [
    "node_modules",
    "dist",
    "**/*.test.ts"
  ]
}

// ===== USAGE EXAMPLES =====
// Example 1: Using validated query parameters in a route handler
router.get('/search', validatePropertySearch, async (req, res) => {
  const params = getValidatedQuery<PropertySearchParams>(req);
  
  // Full type safety - IDE will show all available properties
  console.log(params.query);      // string
  console.log(params.price_min);  // number | undefined
  console.log(params.page);       // number (with default value)
  console.log(params.bedrooms);   // number | undefined
});

// Example 2: Using validated body data
router.post('/', createValidationMiddleware(PropertySchema), async (req, res) => {
  const propertyData = getValidatedBody<PropertyCreateData>(req);
  
  // Type-safe access to all validated properties
  console.log(propertyData.title);       // string
  console.log(propertyData.price);       // number
  console.log(propertyData.latitude);    // number
});

// Example 3: Type-safe service method calls
const propertyService = new PropertyService(connectionPool);

// This will have full type checking
const results = await propertyService.searchProperties({
  query: 'london',
  price_min: 100000,
  price_max: 500000,
  page: 1,
  limit: 20
});
