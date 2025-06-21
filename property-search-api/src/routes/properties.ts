import { Router } from 'express';
import { z } from 'zod';
import { getDatabase } from '../config/database';
import { logger } from '../utils/logger';

const router = Router();

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

// Get all properties with filters and pagination
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

export default router;