import { DatabaseService } from '../lib/database';

export interface IndexDefinition {
    name: string;
    table: string;
    columns: string[];
    type: 'btree' | 'gin' | 'gist' | 'hash' | 'spgist' | 'brin' | 'hnsw' | 'ivfflat';
    unique?: boolean;
    partial?: string; // WHERE clause for partial indexes
    concurrent?: boolean;
}

export class DatabaseIndexOptimizer {
    constructor(private database: DatabaseService) { }

    async createPropertyIndexes(): Promise<string[]> {
        const indexes: IndexDefinition[] = [
            // Basic property search indexes
            {
                name: 'idx_properties_price',
                table: 'properties',
                columns: ['price'],
                type: 'btree'
            },
            {
                name: 'idx_properties_bedrooms',
                table: 'properties',
                columns: ['bedrooms'],
                type: 'btree'
            },
            {
                name: 'idx_properties_property_type',
                table: 'properties',
                columns: ['property_type'],
                type: 'btree'
            },
            {
                name: 'idx_properties_available',
                table: 'properties',
                columns: ['available'],
                type: 'btree',
                partial: 'available = true' // Only index available properties
            },

            // Composite indexes for common query patterns
            {
                name: 'idx_properties_available_type_price',
                table: 'properties',
                columns: ['available', 'property_type', 'price'],
                type: 'btree'
            },
            {
                name: 'idx_properties_bedrooms_bathrooms',
                table: 'properties',
                columns: ['bedrooms', 'bathrooms'],
                type: 'btree'
            },
            {
                name: 'idx_properties_price_bedrooms',
                table: 'properties',
                columns: ['price', 'bedrooms'],
                type: 'btree'
            },

            // Geographic search indexes
            {
                name: 'idx_properties_location_gist',
                table: 'properties',
                columns: ['ST_Point(longitude, latitude)'],
                type: 'gist'
            },
            {
                name: 'idx_properties_postcode',
                table: 'properties',
                columns: ['postcode'],
                type: 'btree'
            },

            // Full-text search indexes
            {
                name: 'idx_properties_search_vector',
                table: 'properties',
                columns: ['search_vector'],
                type: 'gin'
            },
            {
                name: 'idx_properties_title_gin',
                table: 'properties',
                columns: ['to_tsvector(\'english\', title)'],
                type: 'gin'
            },

            // Performance indexes
            {
                name: 'idx_properties_created_at',
                table: 'properties',
                columns: ['created_at'],
                type: 'btree'
            },
            {
                name: 'idx_properties_updated_at',
                table: 'properties',
                columns: ['updated_at'],
                type: 'btree'
            },

            // Vector similarity indexes for semantic search
            {
                name: 'idx_property_embeddings_hnsw',
                table: 'property_embeddings',
                columns: ['combined_embedding'],
                type: 'hnsw',
            },
            {
                name: 'idx_property_embeddings_ivfflat',
                table: 'property_embeddings',
                columns: ['combined_embedding'],
                type: 'ivfflat',
            }
        ];

        const createdIndexes: string[] = [];

        for (const index of indexes) {
            try {
                await this.createIndex(index);
                createdIndexes.push(index.name);
                console.log(`✅ Created index: ${index.name}`);
            } catch (error) {
                console.error(`❌ Failed to create index ${index.name}:`, error);
            }
        }

        // Create search vector column and trigger if not exists
        await this.createSearchVectorColumn();

        return createdIndexes;
    }

    private async createIndex(index: IndexDefinition): Promise<void> {
        const connection = await this.database.getClientWithRetry(3, 1000);

        try {
            let sql = `CREATE INDEX ${index.concurrent ? 'CONCURRENTLY' : ''} `;
            sql += `IF NOT EXISTS ${index.name} `;
            sql += `ON ${index.table} `;

            // Handle different index types
            if (index.type === 'hnsw') {
                sql += `USING hnsw (${index.columns.join(', ')} vector_cosine_ops)`;
            } else if (index.type === 'ivfflat') {
                sql += `USING ivfflat (${index.columns.join(', ')} vector_cosine_ops) WITH (lists = 100)`;
            } else {
                sql += `USING ${index.type} (${index.columns.join(', ')})`;
            }

            if (index.partial) {
                sql += ` WHERE ${index.partial}`;
            }

            await connection.query(sql);
        } finally {
            connection.release();
        }
    }

    private async createSearchVectorColumn(): Promise<void> {
        const connection = await this.database.getClientWithRetry(3, 1000);

        try {
            // Add tsvector column for full-text search
            await connection.query(`
        ALTER TABLE properties 
        ADD COLUMN IF NOT EXISTS search_vector tsvector
      `);

            // Create trigger to automatically update search vector
            await connection.query(`
        CREATE OR REPLACE FUNCTION update_properties_search_vector()
        RETURNS trigger AS $$
        BEGIN
          NEW.search_vector := 
            setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
            setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'B') ||
            setweight(to_tsvector('english', COALESCE(NEW.postcode, '')), 'C') ||
            setweight(to_tsvector('english', 
              COALESCE(array_to_string(NEW.features, ' '), '')
            ), 'D');
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
      `);

            await connection.query(`
        DROP TRIGGER IF EXISTS trigger_update_properties_search_vector ON properties;
        CREATE TRIGGER trigger_update_properties_search_vector
        BEFORE INSERT OR UPDATE ON properties
        FOR EACH ROW EXECUTE FUNCTION update_properties_search_vector();
      `);

            // Update existing records
            await connection.query(`
        UPDATE properties SET search_vector = 
          setweight(to_tsvector('english', COALESCE(title, '')), 'A') ||
          setweight(to_tsvector('english', COALESCE(description, '')), 'B') ||
          setweight(to_tsvector('english', COALESCE(postcode, '')), 'C') ||
          setweight(to_tsvector('english', 
            COALESCE(array_to_string(features, ' '), '')
          ), 'D')
        WHERE search_vector IS NULL;
      `);

        } finally {
            connection.release();
        }
    }

    async dropPropertyIndexes(): Promise<void> {
        const indexNames = [
            'idx_properties_price',
            'idx_properties_bedrooms',
            'idx_properties_property_type',
            'idx_properties_available',
            'idx_properties_available_type_price',
            'idx_properties_bedrooms_bathrooms',
            'idx_properties_location_gist',
            'idx_properties_search_vector',
            'idx_property_embeddings_hnsw',
            'idx_property_embeddings_ivfflat'
        ];

        const connection = await this.database.getClientWithRetry(3, 1000);

        try {
            for (const indexName of indexNames) {
                await connection.query(`DROP INDEX IF EXISTS ${indexName}`);
            }
        } finally {
            connection.release();
        }
    }
}