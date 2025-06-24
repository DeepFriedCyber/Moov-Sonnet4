// TDD GREEN PHASE - Database Integration Implementation
import { Pool, PoolClient } from 'pg';
import { z } from 'zod';

// Import the shared types from property-search-types
import { Property } from '@/types';

// Database schemas
const CreatePropertySchema = z.object({
    title: z.string().min(1),
    description: z.string(),
    price: z.number().positive(),
    bedrooms: z.number().int().min(0),
    bathrooms: z.number().int().min(0),
    area: z.number().positive(),
    location: z.object({
        address: z.string(),
        city: z.string(),
        area: z.string(),
        postcode: z.string(),
        coordinates: z.object({
            lat: z.number(),
            lng: z.number(),
        }),
    }),
    images: z.array(z.string()),
    features: z.array(z.string()),
    propertyType: z.enum(['house', 'flat', 'bungalow', 'maisonette', 'studio']),
    listingType: z.enum(['sale', 'rent']),
});

type CreatePropertyData = z.infer<typeof CreatePropertySchema>;

interface SearchOptions {
    embedding: number[];
    filters?: {
        minPrice?: number;
        maxPrice?: number;
        minBedrooms?: number;
        maxBedrooms?: number;
        propertyTypes?: string[];
        location?: string;
    };
    limit?: number;
    offset?: number;
    similarityThreshold?: number;
}

interface SearchResult {
    properties: (Property & { similarity_score?: number })[];
    total: number;
}

export class DatabaseService {
    private pool: Pool;

    constructor(connectionString: string) {
        this.pool = new Pool({ connectionString });
    }

    async initialize(): Promise<void> {
        // Create pgvector extension
        await this.query('CREATE EXTENSION IF NOT EXISTS vector');

        // Create properties table
        await this.query(`
      CREATE TABLE IF NOT EXISTS properties (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title VARCHAR(255) NOT NULL,
        description TEXT,
        price DECIMAL(10,2) NOT NULL,
        bedrooms INTEGER NOT NULL,
        bathrooms INTEGER NOT NULL,
        area DECIMAL(10,2) NOT NULL,
        location JSONB NOT NULL,
        images JSONB NOT NULL DEFAULT '[]',
        features JSONB NOT NULL DEFAULT '[]',
        property_type VARCHAR(50) NOT NULL,
        listing_type VARCHAR(20) NOT NULL,
        embedding vector(3),
        indexed_at TIMESTAMP,
        agent_id VARCHAR(255),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

        // Create index for vector similarity search
        await this.query(`
      CREATE INDEX IF NOT EXISTS properties_embedding_idx 
      ON properties 
      USING ivfflat (embedding vector_cosine_ops)
      WITH (lists = 100)
    `);
    }

    async query(text: string, params?: any[]): Promise<any> {
        return this.pool.query(text, params);
    }

    async getClient(): Promise<PoolClient> {
        return this.pool.connect();
    }

    async close(): Promise<void> {
        await this.pool.end();
    }
}

export class PropertyRepository {
    constructor(private db: DatabaseService) { }

    async create(data: CreatePropertyData): Promise<Property> {
        try {
            const validated = CreatePropertySchema.parse(data);
        } catch (error) {
            throw new Error('Validation error');
        }

        const validated = CreatePropertySchema.parse(data);

        const result = await this.db.query(
            `INSERT INTO properties (title, description, price, bedrooms, bathrooms, area, location, images, features, property_type, listing_type, agent_id, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
            [
                validated.title,
                validated.description,
                validated.price,
                validated.bedrooms,
                validated.bathrooms,
                validated.area,
                JSON.stringify(validated.location),
                JSON.stringify(validated.images),
                JSON.stringify(validated.features),
                validated.propertyType,
                validated.listingType,
                'default-agent', // Default agent ID
                true, // Default is_active
            ]
        );

        return this.mapRowToProperty(result.rows[0]);
    }

    async findById(id: string): Promise<Property | null> {
        const result = await this.db.query(
            'SELECT * FROM properties WHERE id = $1',
            [id]
        );

        if (result.rows.length === 0) {
            return null;
        }

        return this.mapRowToProperty(result.rows[0]);
    }

    async searchBySimilarity(options: SearchOptions): Promise<SearchResult> {
        const {
            embedding,
            filters = {},
            limit = 20,
            offset = 0,
            similarityThreshold = 0.3,
        } = options;

        let paramIndex = 2;
        const params: any[] = [JSON.stringify(embedding)];
        let whereConditions = [`1 - (embedding <=> $1::vector) > ${similarityThreshold}`];

        if (filters.minPrice) {
            whereConditions.push(`price >= $${paramIndex++}`);
            params.push(filters.minPrice);
        }
        if (filters.maxPrice) {
            whereConditions.push(`price <= $${paramIndex++}`);
            params.push(filters.maxPrice);
        }

        const whereClause = whereConditions.join(' AND ');

        // Get properties
        const propertiesResult = await this.db.query(
            `SELECT *, 1 - (embedding <=> $1::vector) as similarity_score
       FROM properties
       WHERE ${whereClause}
       ORDER BY embedding <=> $1::vector
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
            [...params, limit, offset]
        );

        // Get total count
        const countResult = await this.db.query(
            `SELECT COUNT(*) FROM properties WHERE ${whereClause}`,
            params
        );

        return {
            properties: propertiesResult.rows.map(row => ({
                ...this.mapRowToProperty(row),
                similarity_score: row.similarity_score,
            })),
            total: parseInt(countResult.rows[0].count),
        };
    }

    async updateEmbedding(id: string, embedding: number[]): Promise<void> {
        await this.db.query(
            'UPDATE properties SET embedding = $1::vector, indexed_at = CURRENT_TIMESTAMP WHERE id = $2',
            [JSON.stringify(embedding), id]
        );
    }

    async findManyByIds(ids: string[]): Promise<Property[]> {
        if (ids.length === 0) return [];

        const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
        const result = await this.db.query(
            `SELECT * FROM properties WHERE id IN (${placeholders})`,
            ids
        );

        return result.rows.map(row => this.mapRowToProperty(row));
    }

    private mapRowToProperty(row: any): Property {
        return {
            id: row.id,
            title: row.title,
            description: row.description,
            price: parseFloat(row.price),
            bedrooms: row.bedrooms,
            bathrooms: row.bathrooms,
            area: parseFloat(row.area),
            location: typeof row.location === 'string' ? JSON.parse(row.location) : row.location,
            images: typeof row.images === 'string' ? JSON.parse(row.images) : row.images,
            features: typeof row.features === 'string' ? JSON.parse(row.features) : row.features,
            propertyType: row.property_type,
            listingType: row.listing_type,
            agentId: row.agent_id || 'default-agent',
            isActive: row.is_active !== false,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        };
    }
}