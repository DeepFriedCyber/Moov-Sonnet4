import { Router } from 'express';
import { z } from 'zod';
import axios from 'axios';
import { getDatabase } from '../config/database';
import { logger } from '../utils/logger';

const router = Router();

// Validation schemas
const searchSchema = z.object({
    query: z.string().min(1),
    page: z.number().optional().default(1),
    limit: z.number().optional().default(20),
    filters: z.object({
        propertyType: z.string().optional(),
        minPrice: z.number().optional(),
        maxPrice: z.number().optional(),
        bedrooms: z.number().optional(),
        location: z.string().optional(),
    }).optional().default({})
});

// Semantic search endpoint
router.post('/semantic', async (req, res): Promise<void> => {
    try {
        const { query, page, limit, filters } = searchSchema.parse(req.body);
        const db = getDatabase();

        // Get all properties with basic filters
        let whereClause = 'WHERE 1=1';
        const params: any[] = [];
        let paramCount = 0;

        // Apply filters
        if (filters.propertyType) {
            paramCount++;
            whereClause += ` AND property_type = $${paramCount}`;
            params.push(filters.propertyType);
        }

        if (filters.minPrice) {
            paramCount++;
            whereClause += ` AND price >= $${paramCount}`;
            params.push(filters.minPrice);
        }

        if (filters.maxPrice) {
            paramCount++;
            whereClause += ` AND price <= $${paramCount}`;
            params.push(filters.maxPrice);
        }

        if (filters.bedrooms) {
            paramCount++;
            whereClause += ` AND bedrooms = $${paramCount}`;
            params.push(filters.bedrooms);
        }

        if (filters.location) {
            paramCount++;
            whereClause += ` AND (city ILIKE $${paramCount} OR county ILIKE $${paramCount} OR postcode ILIKE $${paramCount})`;
            params.push(`%${filters.location}%`);
        }

        // Get properties for semantic search
        const propertiesResult = await db.query(
            `SELECT 
        id, title, description, property_type, price, bedrooms, bathrooms,
        size_sqft, address, city, county, postcode, latitude, longitude,
        images, features, agent_contact, created_at, updated_at
       FROM properties 
       ${whereClause}
       ORDER BY created_at DESC`,
            params
        );

        const properties = propertiesResult.rows;

        if (properties.length === 0) {
            res.json({
                success: true,
                data: [],
                pagination: {
                    page,
                    limit,
                    total: 0,
                    pages: 0
                },
                searchQuery: query
            });
            return;
        }

        // Prepare data for embedding service
        const propertyTexts = properties.map(prop =>
            `${prop.title} ${prop.description} ${prop.property_type} ${prop.city} ${prop.county} ${prop.features?.join(' ') || ''}`
        );

        const propertyIds = properties.map(prop => prop.id);

        try {
            // Call embedding service for semantic search
            const embeddingServiceUrl = process.env.EMBEDDING_SERVICE_URL || 'http://localhost:8001';

            // Get embeddings for all properties
            const embeddingResponse = await axios.post(`${embeddingServiceUrl}/embed`, {
                texts: propertyTexts,
                model: 'primary'
            });

            const propertyEmbeddings = embeddingResponse.data.embeddings;

            // Perform semantic search
            const searchResponse = await axios.post(`${embeddingServiceUrl}/search`, {
                query,
                property_embeddings: propertyEmbeddings,
                property_ids: propertyIds,
                top_k: Math.min(100, properties.length) // Get more results for pagination
            });

            const searchResults = searchResponse.data.results;

            // Map results back to full property data
            const rankedProperties = searchResults.map((result: any) => {
                const property = properties.find(p => p.id === result.property_id);
                return {
                    ...property,
                    similarity_score: result.similarity,
                    images: property.images || [],
                    features: property.features || []
                };
            });

            // Apply pagination
            const total = rankedProperties.length;
            const offset = (page - 1) * limit;
            const paginatedProperties = rankedProperties.slice(offset, offset + limit);

            res.json({
                success: true,
                data: paginatedProperties,
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit)
                },
                searchQuery: query,
                searchType: 'semantic'
            });

        } catch (embeddingError) {
            logger.error('Embedding service error:', embeddingError);

            // Fallback to text search
            const textSearchResults = await performTextSearch(db, query, properties, page, limit);

            res.json({
                success: true,
                data: textSearchResults.data,
                pagination: textSearchResults.pagination,
                searchQuery: query,
                searchType: 'text_fallback',
                warning: 'Semantic search unavailable, using text search'
            });
        }

    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({
                success: false,
                error: 'Invalid search parameters',
                details: error.errors
            });
            return;
        }

        logger.error('Search error:', error);
        res.status(500).json({
            success: false,
            error: 'Search failed'
        });
    }
});

// Traditional text search endpoint
router.post('/text', async (req, res): Promise<void> => {
    try {
        const { query, page, limit, filters } = searchSchema.parse(req.body);
        const db = getDatabase();

        // Build WHERE clause with filters and text search
        let whereClause = 'WHERE (title ILIKE $1 OR description ILIKE $1 OR city ILIKE $1 OR county ILIKE $1)';
        const params: any[] = [`%${query}%`];
        let paramCount = 1;

        // Apply filters
        if (filters.propertyType) {
            paramCount++;
            whereClause += ` AND property_type = $${paramCount}`;
            params.push(filters.propertyType);
        }

        if (filters.minPrice) {
            paramCount++;
            whereClause += ` AND price >= $${paramCount}`;
            params.push(filters.minPrice);
        }

        if (filters.maxPrice) {
            paramCount++;
            whereClause += ` AND price <= $${paramCount}`;
            params.push(filters.maxPrice);
        }

        if (filters.bedrooms) {
            paramCount++;
            whereClause += ` AND bedrooms = $${paramCount}`;
            params.push(filters.bedrooms);
        }

        if (filters.location) {
            paramCount++;
            whereClause += ` AND (city ILIKE $${paramCount} OR county ILIKE $${paramCount} OR postcode ILIKE $${paramCount})`;
            params.push(`%${filters.location}%`);
        }

        // Get total count
        const countResult = await db.query(
            `SELECT COUNT(*) as total FROM properties ${whereClause}`,
            params
        );

        const total = parseInt(countResult.rows[0].total);

        // Get paginated results
        const offset = (page - 1) * limit;
        paramCount++;
        params.push(limit);
        paramCount++;
        params.push(offset);

        const propertiesResult = await db.query(
            `SELECT 
        id, title, description, property_type, price, bedrooms, bathrooms,
        size_sqft, address, city, county, postcode, latitude, longitude,
        images, features, agent_contact, created_at, updated_at
       FROM properties 
       ${whereClause}
       ORDER BY 
         CASE 
           WHEN title ILIKE $1 THEN 1
           WHEN description ILIKE $1 THEN 2
           WHEN city ILIKE $1 THEN 3
           ELSE 4
         END,
         created_at DESC
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
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            },
            searchQuery: query,
            searchType: 'text'
        });

    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({
                success: false,
                error: 'Invalid search parameters',
                details: error.errors
            });
            return;
        }

        logger.error('Text search error:', error);
        res.status(500).json({
            success: false,
            error: 'Text search failed'
        });
    }
});

// Helper function for text search fallback
async function performTextSearch(db: any, query: string, properties: any[], page: number, limit: number) {
    const searchTerm = query.toLowerCase();

    // Simple text matching with scoring
    const scoredProperties = properties.map(property => {
        let score = 0;
        const title = property.title?.toLowerCase() || '';
        const description = property.description?.toLowerCase() || '';
        const city = property.city?.toLowerCase() || '';
        const county = property.county?.toLowerCase() || '';
        const features = property.features?.join(' ').toLowerCase() || '';

        // Score based on matches
        if (title.includes(searchTerm)) score += 5;
        if (description.includes(searchTerm)) score += 3;
        if (city.includes(searchTerm)) score += 4;
        if (county.includes(searchTerm)) score += 2;
        if (features.includes(searchTerm)) score += 1;

        return {
            ...property,
            search_score: score,
            images: property.images || [],
            features: property.features || []
        };
    })
        .filter(property => property.search_score > 0)
        .sort((a, b) => b.search_score - a.search_score);

    // Apply pagination
    const total = scoredProperties.length;
    const offset = (page - 1) * limit;
    const paginatedProperties = scoredProperties.slice(offset, offset + limit);

    return {
        data: paginatedProperties,
        pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit)
        }
    };
}

export default router;