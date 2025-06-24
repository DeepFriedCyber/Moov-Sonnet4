// TDD REFACTOR PHASE - Enhanced Database Integration Implementation
import { Pool, PoolClient } from 'pg';
import { Property } from '@/types';

// Import refactored modules
import {
    CreatePropertySchema,
    SearchOptionsSchema,
    DatabaseConfigSchema,
    type CreatePropertyData,
    type SearchOptions,
    type DatabaseConfig,
} from './schemas/database.schemas';

import {
    DatabaseError,
    ConnectionError,
    ValidationError,
    NotFoundError,
    QueryError,
    TransactionError,
} from './errors/database.errors';

import {
    type SearchResult,
    type IDatabaseService,
    type IPropertyRepository,
    type ITransaction,
    type DatabaseMetrics,
} from './interfaces/database.interfaces';

// Enhanced Database Service with better configuration and error handling
export class DatabaseService implements IDatabaseService {
    private pool: Pool;
    private config: DatabaseConfig;
    private metrics: DatabaseMetrics;
    private isInitialized = false;

    constructor(config: DatabaseConfig | string) {
        // Support both string and config object
        if (typeof config === 'string') {
            this.config = DatabaseConfigSchema.parse({ connectionString: config });
        } else {
            this.config = DatabaseConfigSchema.parse(config);
        }

        this.pool = new Pool({
            connectionString: this.config.connectionString,
            max: this.config.maxConnections,
            idleTimeoutMillis: this.config.idleTimeoutMillis,
            connectionTimeoutMillis: this.config.connectionTimeoutMillis,
            ssl: this.config.enableSSL,
        });

        this.metrics = {
            totalConnections: 0,
            activeConnections: 0,
            idleConnections: 0,
            totalQueries: 0,
            averageQueryTime: 0,
            slowQueries: 0,
            errors: 0,
        };

        this.setupEventHandlers();
    }

    private setupEventHandlers(): void {
        this.pool.on('connect', () => {
            this.metrics.totalConnections++;
        });

        this.pool.on('error', (err) => {
            this.metrics.errors++;
            console.error('Database pool error:', err);
        });
    }

    async initialize(): Promise<void> {
        if (this.isInitialized) return;

        try {
            // Create pgvector extension
            await this.query('CREATE EXTENSION IF NOT EXISTS vector');

            // Create properties table with optimized schema
            await this.query(`
        CREATE TABLE IF NOT EXISTS properties (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          title VARCHAR(255) NOT NULL,
          description TEXT,
          price DECIMAL(12,2) NOT NULL,
          bedrooms INTEGER NOT NULL,
          bathrooms INTEGER NOT NULL,
          area DECIMAL(10,2) NOT NULL,
          location JSONB NOT NULL,
          images JSONB NOT NULL DEFAULT '[]',
          features JSONB NOT NULL DEFAULT '[]',
          property_type VARCHAR(50) NOT NULL,
          listing_type VARCHAR(20) NOT NULL,
          embedding vector(384), -- Common embedding dimension
          indexed_at TIMESTAMP,
          agent_id VARCHAR(255),
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          -- Add constraints
          CONSTRAINT valid_price CHECK (price > 0),
          CONSTRAINT valid_bedrooms CHECK (bedrooms >= 0),
          CONSTRAINT valid_bathrooms CHECK (bathrooms >= 0),
          CONSTRAINT valid_area CHECK (area > 0)
        )
      `);

            // Create optimized indexes
            await this.query(`
        CREATE INDEX IF NOT EXISTS properties_embedding_idx 
        ON properties 
        USING ivfflat (embedding vector_cosine_ops)
        WITH (lists = 100)
      `);

            await this.query(`
        CREATE INDEX IF NOT EXISTS properties_price_idx ON properties (price);
      `);

            await this.query(`
        CREATE INDEX IF NOT EXISTS properties_bedrooms_idx ON properties (bedrooms);
      `);

            await this.query(`
        CREATE INDEX IF NOT EXISTS properties_location_idx ON properties USING GIN (location);
      `);

            await this.query(`
        CREATE INDEX IF NOT EXISTS properties_active_idx ON properties (is_active) WHERE is_active = true;
      `);

            // Create updated_at trigger
            await this.query(`
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
          NEW.updated_at = CURRENT_TIMESTAMP;
          RETURN NEW;
        END;
        $$ language 'plpgsql';
      `);

            await this.query(`
        DROP TRIGGER IF EXISTS update_properties_updated_at ON properties;
        CREATE TRIGGER update_properties_updated_at
          BEFORE UPDATE ON properties
          FOR EACH ROW
          EXECUTE FUNCTION update_updated_at_column();
      `);

            this.isInitialized = true;
        } catch (error) {
            throw new ConnectionError('Failed to initialize database', error);
        }
    }

    async query(text: string, params?: any[]): Promise<any> {
        const startTime = Date.now();

        try {
            this.metrics.totalQueries++;
            const result = await this.pool.query(text, params);

            const queryTime = Date.now() - startTime;
            this.updateQueryMetrics(queryTime);

            return result;
        } catch (error) {
            this.metrics.errors++;
            throw new QueryError('Query execution failed', text, error);
        }
    }

    private updateQueryMetrics(queryTime: number): void {
        // Update average query time
        this.metrics.averageQueryTime =
            (this.metrics.averageQueryTime * (this.metrics.totalQueries - 1) + queryTime) /
            this.metrics.totalQueries;

        // Track slow queries (>1 second)
        if (queryTime > 1000) {
            this.metrics.slowQueries++;
        }
    }

    async getClient(): Promise<PoolClient> {
        try {
            const client = await this.pool.connect();
            this.metrics.activeConnections++;

            // Wrap release to update metrics
            const originalRelease = client.release;
            client.release = (err?: Error | boolean) => {
                this.metrics.activeConnections--;
                this.metrics.idleConnections++;
                return originalRelease.call(client, err);
            };

            return client;
        } catch (error) {
            throw new ConnectionError('Failed to get database client', error);
        }
    }

    async healthCheck(): Promise<boolean> {
        try {
            await this.query('SELECT 1');
            return true;
        } catch {
            return false;
        }
    }

    async close(): Promise<void> {
        await this.pool.end();
    }

    getMetrics(): DatabaseMetrics {
        return { ...this.metrics };
    }

    async withTransaction<T>(callback: (tx: ITransaction) => Promise<T>): Promise<T> {
        const client = await this.getClient();

        try {
            await client.query('BEGIN');

            const transaction: ITransaction = {
                query: async (text: string, params?: any[]) => {
                    return await client.query(text, params);
                },
                commit: async () => {
                    await client.query('COMMIT');
                },
                rollback: async () => {
                    await client.query('ROLLBACK');
                },
            };

            const result = await callback(transaction);
            await transaction.commit();
            return result;
        } catch (error) {
            await client.query('ROLLBACK');
            throw new TransactionError('Transaction failed', error);
        } finally {
            client.release();
        }
    }
}

// Enhanced Property Repository with better error handling and validation
export class PropertyRepository implements IPropertyRepository {
    constructor(private db: IDatabaseService) { }

    async create(data: CreatePropertyData): Promise<Property> {
        try {
            const validated = CreatePropertySchema.parse(data);

            const result = await this.db.query(
                `INSERT INTO properties (
          title, description, price, bedrooms, bathrooms, area, location, 
          images, features, property_type, listing_type, agent_id, is_active
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
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
                    'default-agent',
                    true,
                ]
            );

            return this.mapRowToProperty(result.rows[0]);
        } catch (error) {
            if (error instanceof Error && error.name === 'ZodError') {
                throw new ValidationError('Property validation failed', (error as any).errors);
            }
            throw new DatabaseError('Failed to create property', undefined, error);
        }
    }

    async findById(id: string): Promise<Property | null> {
        try {
            const result = await this.db.query(
                'SELECT * FROM properties WHERE id = $1 AND is_active = true',
                [id]
            );

            if (result.rows.length === 0) {
                return null;
            }

            return this.mapRowToProperty(result.rows[0]);
        } catch (error) {
            throw new DatabaseError('Failed to find property by id', undefined, error);
        }
    }

    async findManyByIds(ids: string[]): Promise<Property[]> {
        if (ids.length === 0) return [];

        try {
            const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
            const result = await this.db.query(
                `SELECT * FROM properties WHERE id IN (${placeholders}) AND is_active = true`,
                ids
            );

            return result.rows.map(row => this.mapRowToProperty(row));
        } catch (error) {
            throw new DatabaseError('Failed to find properties by ids', undefined, error);
        }
    }

    async searchBySimilarity(options: SearchOptions): Promise<SearchResult> {
        try {
            const validated = SearchOptionsSchema.parse(options);
            const startTime = Date.now();

            const {
                embedding,
                filters = {},
                limit,
                offset,
                similarityThreshold,
            } = validated;

            let paramIndex = 2;
            const params: any[] = [JSON.stringify(embedding)];
            const whereConditions = [
                `1 - (embedding <=> $1::vector) >= ${similarityThreshold}`,
                'is_active = true'
            ];

            // Build dynamic WHERE conditions
            if (filters.minPrice) {
                whereConditions.push(`price >= $${paramIndex++}`);
                params.push(filters.minPrice);
            }
            if (filters.maxPrice) {
                whereConditions.push(`price <= $${paramIndex++}`);
                params.push(filters.maxPrice);
            }
            if (filters.minBedrooms) {
                whereConditions.push(`bedrooms >= $${paramIndex++}`);
                params.push(filters.minBedrooms);
            }
            if (filters.maxBedrooms) {
                whereConditions.push(`bedrooms <= $${paramIndex++}`);
                params.push(filters.maxBedrooms);
            }
            if (filters.propertyTypes && filters.propertyTypes.length > 0) {
                whereConditions.push(`property_type = ANY($${paramIndex++})`);
                params.push(filters.propertyTypes);
            }
            if (filters.location) {
                whereConditions.push(`location->>'city' ILIKE $${paramIndex++}`);
                params.push(`%${filters.location}%`);
            }

            const whereClause = whereConditions.join(' AND ');

            // Get properties with similarity scores
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

            const searchTime = Date.now() - startTime;

            return {
                properties: propertiesResult.rows.map(row => ({
                    ...this.mapRowToProperty(row),
                    similarity_score: parseFloat(row.similarity_score),
                })),
                total: parseInt(countResult.rows[0].count),
                searchTime,
            };
        } catch (error) {
            if (error instanceof Error && error.name === 'ZodError') {
                throw new ValidationError('Search options validation failed', (error as any).errors);
            }
            throw new DatabaseError('Failed to search properties', undefined, error);
        }
    }

    async updateEmbedding(id: string, embedding: number[]): Promise<void> {
        try {
            const result = await this.db.query(
                'UPDATE properties SET embedding = $1::vector, indexed_at = CURRENT_TIMESTAMP WHERE id = $2',
                [JSON.stringify(embedding), id]
            );

            if (result.rowCount === 0) {
                throw new NotFoundError('Property', id);
            }
        } catch (error) {
            if (error instanceof NotFoundError) throw error;
            throw new DatabaseError('Failed to update property embedding', undefined, error);
        }
    }

    async update(id: string, data: Partial<CreatePropertyData>): Promise<Property> {
        try {
            // Build dynamic update query
            const updates: string[] = [];
            const params: any[] = [];
            let paramIndex = 1;

            Object.entries(data).forEach(([key, value]) => {
                if (value !== undefined) {
                    const columnName = key === 'propertyType' ? 'property_type' :
                        key === 'listingType' ? 'listing_type' : key;

                    if (typeof value === 'object' && value !== null) {
                        updates.push(`${columnName} = $${paramIndex++}::jsonb`);
                        params.push(JSON.stringify(value));
                    } else {
                        updates.push(`${columnName} = $${paramIndex++}`);
                        params.push(value);
                    }
                }
            });

            if (updates.length === 0) {
                throw new ValidationError('No valid fields to update');
            }

            params.push(id);
            const result = await this.db.query(
                `UPDATE properties SET ${updates.join(', ')} WHERE id = $${paramIndex} AND is_active = true RETURNING *`,
                params
            );

            if (result.rows.length === 0) {
                throw new NotFoundError('Property', id);
            }

            return this.mapRowToProperty(result.rows[0]);
        } catch (error) {
            if (error instanceof NotFoundError || error instanceof ValidationError) throw error;
            throw new DatabaseError('Failed to update property', undefined, error);
        }
    }

    async delete(id: string): Promise<boolean> {
        try {
            const result = await this.db.query(
                'UPDATE properties SET is_active = false WHERE id = $1 AND is_active = true',
                [id]
            );

            return result.rowCount > 0;
        } catch (error) {
            throw new DatabaseError('Failed to delete property', undefined, error);
        }
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

// Re-export for backward compatibility
export { CreatePropertyData, SearchOptions, SearchResult, DatabaseConfig };