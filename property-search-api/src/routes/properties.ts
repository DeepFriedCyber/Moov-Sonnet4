import { Router } from 'express';
import { z } from 'zod';
import { getDatabase } from '../config/database';
import { logger } from '../utils/logger';
import { PropertyRateLimiter } from '../middleware/PropertyRateLimiter';
import { getRedisIORedisClient } from '../config/redisAdapter';
import { validatePropertySearch, PropertySearchParams } from '../validation/propertySearchValidation';
import { createValidationMiddleware, getValidatedQuery } from '../middleware/validationMiddleware';
import { PropertySchema } from '../validation/propertyDataValidation';
// Import type declarations to ensure they're loaded
import '../types/express';

const router = Router();

// Initialize rate limiter
let propertyLimiter: PropertyRateLimiter | null = null;

try {
    const redis = getRedisIORedisClient();
    propertyLimiter = new PropertyRateLimiter(redis);
} catch (error) {
    logger.warn('Rate limiting disabled - Redis not available:', error);
}

// Validation schemas
const propertyQuerySchema = z.object({
    page: z.string().optional().transform(val => val ? parseInt(val) : 1),
    limit: z.string().optional().transform(val => val ? parseInt(val) : 20),
    type: z.string().optional(),
    minPrice: z.string().optional().transform(val => val ? parseFloat(val) : undefined),
    maxPrice: z.string().optional().transform(val => val ? parseFloat(val) : undefined),
    location: z.string().optional(),
    bedrooms: z.string().optional().transform(val => val ? parseInt(val) : undefined),
});

// Add dedicated search endpoint with comprehensive validation
router.get('/search',
    propertyLimiter ? propertyLimiter.searchLimiter() : (req, res, next) => next(),
    validatePropertySearch,
    async (req, res): Promise<void> => {
        try {
            // Type-safe access to validated query parameters
            const query = getValidatedQuery<PropertySearchParams>(req);
            const db = getDatabase();

            let whereClause = 'WHERE 1=1';
            const params: any[] = [];
            let paramCount = 0;

            // Build dynamic WHERE clause using validated parameters
            if (query.query) {
                paramCount++;
                whereClause += ` AND (title ILIKE $${paramCount} OR description ILIKE $${paramCount} OR address ILIKE $${paramCount})`;
                params.push(`%${query.query}%`);
            }

            if (query.property_type) {
                paramCount++;
                whereClause += ` AND property_type = $${paramCount}`;
                params.push(query.property_type);
            }

            if (query.price_min) {
                paramCount++;
                whereClause += ` AND price >= $${paramCount}`;
                params.push(query.price_min);
            }

            if (query.price_max) {
                paramCount++;
                whereClause += ` AND price <= $${paramCount}`;
                params.push(query.price_max);
            }

            if (query.bedrooms) {
                paramCount++;
                whereClause += ` AND bedrooms = $${paramCount}`;
                params.push(query.bedrooms);
            }

            if (query.bathrooms) {
                paramCount++;
                whereClause += ` AND bathrooms = $${paramCount}`;
                params.push(query.bathrooms);
            }

            if (query.postcode) {
                paramCount++;
                whereClause += ` AND postcode = $${paramCount}`;
                params.push(query.postcode);
            }

            if (query.latitude && query.longitude && query.radius) {
                // Add geographic search using Haversine formula
                paramCount += 3;
                whereClause += ` AND (
                    6371 * acos(
                        cos(radians($${paramCount - 2})) * cos(radians(latitude)) * 
                        cos(radians(longitude) - radians($${paramCount - 1})) + 
                        sin(radians($${paramCount - 2})) * sin(radians(latitude))
                    )
                ) <= $${paramCount}`;
                params.push(query.latitude, query.longitude, query.radius);
            }

            if (query.features && Array.isArray(query.features) && query.features.length > 0) {
                paramCount++;
                whereClause += ` AND features @> $${paramCount}`;
                params.push(JSON.stringify(query.features));
            }

            // Get total count
            const countResult = await db.query(
                `SELECT COUNT(*) as total FROM properties ${whereClause}`,
                params
            );

            const total = parseInt(countResult.rows[0].total);

            // Get paginated properties with sorting
            const offset = (query.page - 1) * query.limit;
            paramCount++;
            params.push(query.limit);
            paramCount++;
            params.push(offset);

            let orderBy = 'ORDER BY created_at DESC';
            if (query.sort) {
                switch (query.sort) {
                    case 'price_asc':
                        orderBy = 'ORDER BY price ASC';
                        break;
                    case 'price_desc':
                        orderBy = 'ORDER BY price DESC';
                        break;
                    case 'date_desc':
                        orderBy = 'ORDER BY created_at DESC';
                        break;
                    case 'relevance':
                        // For relevance, we could implement a scoring system
                        orderBy = 'ORDER BY created_at DESC';
                        break;
                }
            }

            const propertiesResult = await db.query(
                `SELECT 
                    id, title, description, property_type, price, bedrooms, bathrooms,
                    size_sqft, address, city, county, postcode, latitude, longitude,
                    images, features, agent_contact, created_at, updated_at
                FROM properties 
                ${whereClause}
                ${orderBy}
                LIMIT $${paramCount - 1} OFFSET $${paramCount}`,
                params
            );

            const properties = propertiesResult.rows.map(property => ({
                ...property,
                images: property.images || [],
                features: property.features || []
            }));

            res.json({
                success: true,
                data: properties,
                pagination: {
                    page: query.page,
                    limit: query.limit,
                    total,
                    pages: Math.ceil(total / query.limit)
                },
                filters: {
                    query: query.query,
                    property_type: query.property_type,
                    price_range: query.price_min || query.price_max ? {
                        min: query.price_min,
                        max: query.price_max
                    } : null,
                    location: query.postcode || (query.latitude && query.longitude) ? {
                        postcode: query.postcode,
                        coordinates: query.latitude && query.longitude ? {
                            lat: query.latitude,
                            lng: query.longitude,
                            radius: query.radius
                        } : null
                    } : null
                }
            });

        } catch (error) {
            logger.error('Property search error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to search properties'
            });
        }
    }
);

// Apply rate limiting to general listing endpoint
if (propertyLimiter) {
    router.use('/', propertyLimiter.searchLimiter());
}

// Get all properties with filters and pagination (legacy endpoint)
router.get('/', async (req, res): Promise<void> => {
    try {
        const query = propertyQuerySchema.parse(req.query);
        const db = getDatabase();

        let whereClause = 'WHERE 1=1';
        const params: any[] = [];
        let paramCount = 0;

        // Build dynamic WHERE clause
        if (query.type) {
            paramCount++;
            whereClause += ` AND property_type = $${paramCount}`;
            params.push(query.type);
        }

        if (query.minPrice) {
            paramCount++;
            whereClause += ` AND price >= $${paramCount}`;
            params.push(query.minPrice);
        }

        if (query.maxPrice) {
            paramCount++;
            whereClause += ` AND price <= $${paramCount}`;
            params.push(query.maxPrice);
        }

        if (query.location) {
            paramCount++;
            whereClause += ` AND (city ILIKE $${paramCount} OR county ILIKE $${paramCount} OR postcode ILIKE $${paramCount})`;
            params.push(`%${query.location}%`);
        }

        if (query.bedrooms) {
            paramCount++;
            whereClause += ` AND bedrooms = $${paramCount}`;
            params.push(query.bedrooms);
        }

        // Get total count
        const countResult = await db.query(
            `SELECT COUNT(*) as total FROM properties ${whereClause}`,
            params
        );

        const total = parseInt(countResult.rows[0].total);

        // Get paginated properties
        const offset = (query.page - 1) * query.limit;
        paramCount++;
        params.push(query.limit);
        paramCount++;
        params.push(offset);

        const propertiesResult = await db.query(
            `SELECT 
        id, title, description, property_type, price, bedrooms, bathrooms,
        size_sqft, address, city, county, postcode, latitude, longitude,
        images, features, agent_contact, created_at, updated_at
       FROM properties 
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramCount - 1} OFFSET $${paramCount}`,
            params
        );

        const properties = propertiesResult.rows.map(property => ({
            ...property,
            images: property.images || [],
            features: property.features || []
        }));

        res.json({
            success: true,
            data: properties,
            pagination: {
                page: query.page,
                limit: query.limit,
                total,
                pages: Math.ceil(total / query.limit)
            }
        });

    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({
                success: false,
                error: 'Invalid query parameters',
                details: error.errors
            });
            return;
        }

        logger.error('Properties fetch error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch properties'
        });
    }
});

// Apply rate limiting to details endpoint
if (propertyLimiter) {
    router.use('/:id', propertyLimiter.detailsLimiter());
}

// Get single property by ID
router.get('/:id', async (req, res): Promise<void> => {
    try {
        const propertyId = req.params.id;
        const db = getDatabase();

        const result = await db.query(
            `SELECT 
        id, title, description, property_type, price, bedrooms, bathrooms,
        size_sqft, address, city, county, postcode, latitude, longitude,
        images, features, agent_contact, created_at, updated_at
       FROM properties 
       WHERE id = $1`,
            [propertyId]
        );

        if (result.rows.length === 0) {
            res.status(404).json({
                success: false,
                error: 'Property not found'
            });
            return;
        }

        const property = result.rows[0];
        property.images = property.images || [];
        property.features = property.features || [];

        res.json({
            success: true,
            data: property
        });

    } catch (error) {
        logger.error('Property fetch error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch property'
        });
    }
});

// Get property statistics
router.get('/stats/summary', async (req, res): Promise<void> => {
    try {
        const db = getDatabase();

        const result = await db.query(`
      SELECT 
        COUNT(*) as total_properties,
        AVG(price) as average_price,
        MIN(price) as min_price,
        MAX(price) as max_price,
        COUNT(DISTINCT property_type) as property_types,
        COUNT(DISTINCT city) as cities
      FROM properties
    `);

        const typeStats = await db.query(`
      SELECT property_type, COUNT(*) as count
      FROM properties
      GROUP BY property_type
      ORDER BY count DESC
    `);

        const priceRanges = await db.query(`
      SELECT 
        CASE 
          WHEN price < 200000 THEN 'Under £200k'
          WHEN price < 400000 THEN '£200k - £400k'
          WHEN price < 600000 THEN '£400k - £600k'
          WHEN price < 800000 THEN '£600k - £800k'
          ELSE 'Over £800k'
        END as price_range,
        COUNT(*) as count
      FROM properties
      GROUP BY price_range
      ORDER BY MIN(price)
    `);

        res.json({
            success: true,
            data: {
                summary: result.rows[0],
                propertyTypes: typeStats.rows,
                priceRanges: priceRanges.rows
            }
        });

    } catch (error) {
        logger.error('Property stats error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch property statistics'
        });
    }
});

// Get similar properties
router.get('/:id/similar', async (req, res): Promise<void> => {
    try {
        const propertyId = req.params.id;
        const db = getDatabase();

        // First, get the current property details
        const currentProperty = await db.query(
            'SELECT property_type, price, bedrooms, city FROM properties WHERE id = $1',
            [propertyId]
        );

        if (currentProperty.rows.length === 0) {
            res.status(404).json({
                success: false,
                error: 'Property not found'
            });
            return;
        }

        const { property_type, price, bedrooms, city } = currentProperty.rows[0];

        // Find similar properties
        const result = await db.query(
            `SELECT 
        id, title, property_type, price, bedrooms, bathrooms,
        address, city, images, created_at
       FROM properties 
       WHERE id != $1
         AND property_type = $2
         AND bedrooms = $3
         AND price BETWEEN $4 AND $5
         AND city = $6
       ORDER BY ABS(price - $7) ASC
       LIMIT 5`,
            [
                propertyId,
                property_type,
                bedrooms,
                price * 0.8, // 20% below
                price * 1.2, // 20% above
                city,
                price
            ]
        );

        const properties = result.rows.map(property => ({
            ...property,
            images: property.images || []
        }));

        res.json({
            success: true,
            data: properties
        });

    } catch (error) {
        logger.error('Similar properties error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch similar properties'
        });
    }
});

// Create new property with comprehensive validation
router.post('/',
    propertyLimiter ? propertyLimiter.favoritesLimiter() : (req, res, next) => next(),
    createValidationMiddleware(PropertySchema, 'body'),
    async (req, res): Promise<void> => {
        try {
            // req.body is now validated and typed as PropertyCreateData
            const propertyData = req.body;
            const db = getDatabase();

            const result = await db.query(
                `INSERT INTO properties (
                    title, description, property_type, price, bedrooms, bathrooms,
                    size_sqft, address, city, county, postcode, latitude, longitude,
                    images, features, available, energy_rating, council_tax_band,
                    lease_remaining, service_charge, agent_contact, created_at, updated_at
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, NOW(), NOW()
                ) RETURNING *`,
                [
                    propertyData.title,
                    propertyData.description,
                    propertyData.property_type,
                    propertyData.price,
                    propertyData.bedrooms,
                    propertyData.bathrooms,
                    propertyData.square_feet || null,
                    propertyData.postcode, // Using postcode as address for now
                    'Unknown', // city - would need geocoding
                    'Unknown', // county - would need geocoding
                    propertyData.postcode,
                    propertyData.latitude,
                    propertyData.longitude,
                    JSON.stringify(propertyData.images),
                    JSON.stringify(propertyData.features),
                    propertyData.available,
                    propertyData.energy_rating || null,
                    propertyData.council_tax_band || null,
                    propertyData.lease_remaining || null,
                    propertyData.service_charge || null,
                    'system@example.com' // Default agent contact
                ]
            );

            const newProperty = result.rows[0];
            newProperty.images = newProperty.images || [];
            newProperty.features = newProperty.features || [];

            res.status(201).json({
                success: true,
                data: newProperty,
                message: 'Property created successfully'
            });

        } catch (error) {
            logger.error('Property creation error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to create property'
            });
        }
    }
);

// Update property with validation
router.put('/:id',
    propertyLimiter ? propertyLimiter.favoritesLimiter() : (req, res, next) => next(),
    createValidationMiddleware(PropertySchema.partial(), 'body'), // Allow partial updates
    async (req, res): Promise<void> => {
        try {
            const propertyId = req.params.id;
            const updates = req.body;
            const db = getDatabase();

            // Check if property exists
            const existingProperty = await db.query(
                'SELECT id FROM properties WHERE id = $1',
                [propertyId]
            );

            if (existingProperty.rows.length === 0) {
                res.status(404).json({
                    success: false,
                    error: 'Property not found'
                });
                return;
            }

            // Build dynamic update query
            const updateFields = [];
            const params = [];
            let paramCount = 0;

            Object.entries(updates).forEach(([key, value]) => {
                if (value !== undefined) {
                    paramCount++;
                    updateFields.push(`${key} = $${paramCount}`);
                    if (key === 'images' || key === 'features') {
                        params.push(JSON.stringify(value));
                    } else {
                        params.push(value);
                    }
                }
            });

            if (updateFields.length === 0) {
                res.status(400).json({
                    success: false,
                    error: 'No valid fields to update'
                });
                return;
            }

            paramCount++;
            params.push(propertyId);
            updateFields.push('updated_at = NOW()');

            const result = await db.query(
                `UPDATE properties SET ${updateFields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
                params
            );

            const updatedProperty = result.rows[0];
            updatedProperty.images = updatedProperty.images || [];
            updatedProperty.features = updatedProperty.features || [];

            res.json({
                success: true,
                data: updatedProperty,
                message: 'Property updated successfully'
            });

        } catch (error) {
            logger.error('Property update error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to update property'
            });
        }
    }
);

export default router;