// ===== TEST SUITE 1: Index Performance Testing (6 tests) =====
// property-search-api/src/__tests__/database/indexPerformance.test.ts
import { DatabaseIndexOptimizer } from '../../database/DatabaseIndexOptimizer';
import { AdvancedConnectionPool } from '../../database/AdvancedConnectionPool';
import { QueryPerformanceAnalyzer } from '../../database/QueryPerformanceAnalyzer';

describe('Database Index Performance', () => {
  let optimizer: DatabaseIndexOptimizer;
  let pool: AdvancedConnectionPool;
  let analyzer: QueryPerformanceAnalyzer;

  beforeAll(async () => {
    pool = new AdvancedConnectionPool({
      connectionString: process.env.TEST_DATABASE_URL!,
      minConnections: 1,
      maxConnections: 5
    });
    await pool.initialize();
    
    optimizer = new DatabaseIndexOptimizer(pool);
    analyzer = new QueryPerformanceAnalyzer(pool);
    
    // Set up test data
    await setupTestData();
  });

  afterAll(async () => {
    await pool.end();
  });

  test('should create all required indexes for property search', async () => {
    const indexesCreated = await optimizer.createPropertyIndexes();
    
    expect(indexesCreated).toContain('idx_properties_price');
    expect(indexesCreated).toContain('idx_properties_location');
    expect(indexesCreated).toContain('idx_properties_search_text');
    expect(indexesCreated).toContain('idx_properties_bedrooms_bathrooms');
    expect(indexesCreated).toContain('idx_properties_available_type');
    expect(indexesCreated).toContain('idx_property_embeddings_vector');
  });

  test('should dramatically improve property search query performance', async () => {
    // Test query performance before indexes
    const queryWithoutIndexes = `
      SELECT * FROM properties 
      WHERE price BETWEEN $1 AND $2 
      AND bedrooms >= $3 
      AND property_type = $4
      AND available = true
      ORDER BY price ASC
      LIMIT 20
    `;
    
    // Drop indexes to test baseline
    await optimizer.dropPropertyIndexes();
    const performanceBefore = await analyzer.measureQueryPerformance(
      queryWithoutIndexes, 
      [100000, 500000, 2, 'flat']
    );

    // Create indexes
    await optimizer.createPropertyIndexes();
    const performanceAfter = await analyzer.measureQueryPerformance(
      queryWithoutIndexes, 
      [100000, 500000, 2, 'flat']
    );

    // Should be at least 10x faster with indexes
    expect(performanceAfter.executionTime).toBeLessThan(performanceBefore.executionTime / 10);
    expect(performanceAfter.planningTime).toBeLessThan(performanceBefore.planningTime);
  });

  test('should optimize full-text search queries', async () => {
    const textSearchQuery = `
      SELECT p.*, ts_rank(search_vector, plainto_tsquery('english', $1)) as rank
      FROM properties p
      WHERE search_vector @@ plainto_tsquery('english', $1)
      ORDER BY rank DESC
      LIMIT 20
    `;

    const performance = await analyzer.measureQueryPerformance(
      textSearchQuery,
      ['london apartment modern']
    );

    // Text search should complete under 50ms with proper GIN index
    expect(performance.executionTime).toBeLessThan(50);
    expect(performance.indexesUsed).toContain('idx_properties_search_vector');
  });

  test('should optimize geographic proximity searches', async () => {
    const geoSearchQuery = `
      SELECT *, 
        ST_Distance(
          ST_Point(longitude, latitude)::geography,
          ST_Point($1, $2)::geography
        ) as distance
      FROM properties
      WHERE ST_DWithin(
        ST_Point(longitude, latitude)::geography,
        ST_Point($1, $2)::geography,
        $3 * 1000
      )
      ORDER BY distance
      LIMIT 20
    `;

    const performance = await analyzer.measureQueryPerformance(
      geoSearchQuery,
      [-0.1278, 51.5074, 5] // London coordinates, 5km radius
    );

    // Geographic search should be fast with spatial index
    expect(performance.executionTime).toBeLessThan(100);
    expect(performance.indexesUsed).toContain('idx_properties_location_gist');
  });

  test('should optimize vector similarity searches for semantic search', async () => {
    const vectorSearchQuery = `
      SELECT p.*, 
        1 - (pe.combined_embedding <=> $1::vector) as similarity_score
      FROM properties p
      JOIN property_embeddings pe ON p.id = pe.property_id
      WHERE 1 - (pe.combined_embedding <=> $1::vector) > 0.7
      ORDER BY pe.combined_embedding <=> $1::vector
      LIMIT 20
    `;

    // Generate test embedding vector (384 dimensions)
    const testEmbedding = Array(384).fill(0).map(() => Math.random());

    const performance = await analyzer.measureQueryPerformance(
      vectorSearchQuery,
      [JSON.stringify(testEmbedding)]
    );

    // Vector search should complete under 200ms with HNSW index
    expect(performance.executionTime).toBeLessThan(200);
    expect(performance.indexesUsed).toContain('idx_property_embeddings_hnsw');
  });

  test('should optimize complex composite queries', async () => {
    const complexQuery = `
      SELECT p.*, 
        ts_rank(search_vector, plainto_tsquery('english', $1)) as text_rank,
        ST_Distance(
          ST_Point(longitude, latitude)::geography,
          ST_Point($2, $3)::geography
        ) as distance
      FROM properties p
      WHERE price BETWEEN $4 AND $5
      AND bedrooms >= $6
      AND property_type = ANY($7)
      AND available = true
      AND search_vector @@ plainto_tsquery('english', $1)
      AND ST_DWithin(
        ST_Point(longitude, latitude)::geography,
        ST_Point($2, $3)::geography,
        $8 * 1000
      )
      ORDER BY text_rank DESC, distance ASC
      LIMIT 20
    `;

    const performance = await analyzer.measureQueryPerformance(
      complexQuery,
      [
        'modern apartment',    // $1 - search text
        -0.1278, 51.5074,     // $2, $3 - London coordinates
        200000, 800000,       // $4, $5 - price range
        2,                    // $6 - minimum bedrooms
        ['flat', 'house'],    // $7 - property types
        10                    // $8 - radius in km
      ]
    );

    // Complex query should still complete under 500ms with proper indexes
    expect(performance.executionTime).toBeLessThan(500);
    expect(performance.indexesUsed.length).toBeGreaterThan(3);
  });
});

// ===== TEST SUITE 2: Index Creation and Management (4 tests) =====
// property-search-api/src/__tests__/database/indexManagement.test.ts
import { IndexManager } from '../../database/IndexManager';

describe('Index Creation and Management', () => {
  let indexManager: IndexManager;
  let pool: AdvancedConnectionPool;

  beforeAll(async () => {
    pool = new AdvancedConnectionPool({
      connectionString: process.env.TEST_DATABASE_URL!
    });
    await pool.initialize();
    indexManager = new IndexManager(pool);
  });

  test('should create indexes concurrently without blocking', async () => {
    const startTime = Date.now();
    
    // Create multiple indexes concurrently
    await indexManager.createIndexesConcurrently([
      'idx_test_concurrent_1',
      'idx_test_concurrent_2', 
      'idx_test_concurrent_3'
    ]);
    
    const endTime = Date.now();
    
    // Should complete all indexes in reasonable time
    expect(endTime - startTime).toBeLessThan(30000); // 30 seconds max
    
    // Verify all indexes exist
    const indexes = await indexManager.listIndexes('properties');
    expect(indexes).toContain('idx_test_concurrent_1');
    expect(indexes).toContain('idx_test_concurrent_2');
    expect(indexes).toContain('idx_test_concurrent_3');
  });

  test('should detect missing indexes and suggest creation', async () => {
    // Drop some indexes
    await indexManager.dropIndex('idx_properties_price');
    
    const missingIndexes = await indexManager.detectMissingIndexes();
    
    expect(missingIndexes).toContain('idx_properties_price');
    
    const suggestions = await indexManager.getIndexSuggestions();
    expect(suggestions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          indexName: 'idx_properties_price',
          reason: 'Frequently used in WHERE clauses',
          impact: 'high'
        })
      ])
    );
  });

  test('should analyze index usage and recommend optimization', async () => {
    // Simulate some queries to generate usage stats
    await simulateQueryWorkload();
    
    const unusedIndexes = await indexManager.findUnusedIndexes();
    const recommendations = await indexManager.getOptimizationRecommendations();
    
    expect(recommendations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'create' | 'drop' | 'modify',
          indexName: expect.any(String),
          reason: expect.any(String),
          estimatedImpact: expect.any(String)
        })
      ])
    );
  });

  test('should validate index effectiveness', async () => {
    const testQuery = `
      SELECT * FROM properties 
      WHERE price BETWEEN $1 AND $2 
      ORDER BY created_at DESC 
      LIMIT 10
    `;
    
    const effectiveness = await indexManager.validateIndexEffectiveness(
      'idx_properties_price',
      testQuery,
      [100000, 500000]
    );
    
    expect(effectiveness).toMatchObject({
      indexUsed: true,
      scanType: 'index_scan' || 'bitmap_index_scan',
      rowsExamined: expect.any(Number),
      rowsReturned: expect.any(Number),
      selectivity: expect.any(Number),
      recommendation: expect.any(String)
    });
  });
});

// ===== TEST SUITE 3: Query Optimization (3 tests) =====
// property-search-api/src/__tests__/database/queryOptimization.test.ts
import { QueryOptimizer } from '../../database/QueryOptimizer';

describe('Query Optimization', () => {
  let optimizer: QueryOptimizer;
  let pool: AdvancedConnectionPool;

  beforeAll(async () => {
    pool = new AdvancedConnectionPool({
      connectionString: process.env.TEST_DATABASE_URL!
    });
    await pool.initialize();
    optimizer = new QueryOptimizer(pool);
  });

  test('should suggest query improvements for slow property searches', async () => {
    const slowQuery = `
      SELECT * FROM properties p
      LEFT JOIN property_images pi ON p.id = pi.property_id
      WHERE p.title LIKE '%london%'
      AND p.price > 100000
      ORDER BY p.created_at DESC
    `;

    const suggestions = await optimizer.analyzeAndOptimize(slowQuery);
    
    expect(suggestions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'index',
          suggestion: expect.stringContaining('full-text search'),
          impact: 'high'
        }),
        expect.objectContaining({
          type: 'query_rewrite',
          suggestion: expect.stringContaining('ILIKE'),
          impact: 'medium'
        })
      ])
    );
  });

  test('should optimize property search with multiple filters', async () => {
    const originalQuery = `
      SELECT p.* FROM properties p
      WHERE p.price BETWEEN 200000 AND 800000
      AND p.bedrooms >= 2
      AND p.property_type IN ('house', 'flat')
      AND p.available = true
      AND (p.title LIKE '%garden%' OR p.description LIKE '%garden%')
      ORDER BY p.price ASC
    `;

    const optimizedQuery = await optimizer.optimizeQuery(originalQuery);
    
    expect(optimizedQuery).toContain('search_vector @@ plainto_tsquery');
    expect(optimizedQuery).toContain('CREATE INDEX IF NOT EXISTS');
    
    const performance = await optimizer.compareQueryPerformance(
      originalQuery, 
      optimizedQuery
    );
    
    expect(performance.optimizedExecutionTime).toBeLessThan(
      performance.originalExecutionTime
    );
  });

  test('should optimize pagination queries for large result sets', async () => {
    const paginationQuery = `
      SELECT * FROM properties
      WHERE available = true
      ORDER BY created_at DESC
      OFFSET 1000 LIMIT 20
    `;

    const optimization = await optimizer.optimizePagination(paginationQuery);
    
    expect(optimization.suggestedApproach).toBe('cursor_based');
    expect(optimization.optimizedQuery).toContain('WHERE created_at <');
    expect(optimization.indexRecommendation).toContain('created_at');
  });
});

// ===== IMPLEMENTATION: Database Index Optimizer =====
// property-search-api/src/database/DatabaseIndexOptimizer.ts
import { AdvancedConnectionPool } from './AdvancedConnectionPool';

export interface IndexDefinition {
  name: string;
  table: string;
  columns: string[];
  type: 'btree' | 'gin' | 'gist' | 'hash' | 'spgist' | 'brin';
  unique?: boolean;
  partial?: string; // WHERE clause for partial indexes
  concurrent?: boolean;
}

export class DatabaseIndexOptimizer {
  constructor(private pool: AdvancedConnectionPool) {}

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
        type: 'hnsw' as any, // pgvector HNSW index
      },
      {
        name: 'idx_property_embeddings_ivfflat',
        table: 'property_embeddings', 
        columns: ['combined_embedding'],
        type: 'ivfflat' as any, // pgvector IVFFlat index
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
    const connection = await this.pool.acquire();
    
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
      await this.pool.release(connection);
    }
  }

  private async createSearchVectorColumn(): Promise<void> {
    const connection = await this.pool.acquire();
    
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
      await this.pool.release(connection);
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

    const connection = await this.pool.acquire();
    
    try {
      for (const indexName of indexNames) {
        await connection.query(`DROP INDEX IF EXISTS ${indexName}`);
      }
    } finally {
      await this.pool.release(connection);
    }
  }
}

// ===== IMPLEMENTATION: Query Performance Analyzer =====
// property-search-api/src/database/QueryPerformanceAnalyzer.ts
export interface QueryPerformanceMetrics {
  executionTime: number;
  planningTime: number;
  totalTime: number;
  rowsReturned: number;
  indexesUsed: string[];
  scanTypes: string[];
  bufferHits: number;
  bufferReads: number;
  queryPlan: any;
}

export class QueryPerformanceAnalyzer {
  constructor(private pool: AdvancedConnectionPool) {}

  async measureQueryPerformance(
    query: string, 
    params: any[] = []
  ): Promise<QueryPerformanceMetrics> {
    const connection = await this.pool.acquire();
    
    try {
      // Enable timing and buffer statistics
      await connection.query('SET track_io_timing = on');
      await connection.query('SET shared_preload_libraries = \'pg_stat_statements\'');
      
      // Get query plan with execution statistics
      const explainQuery = `
        EXPLAIN (
          ANALYZE true,
          BUFFERS true,
          FORMAT json,
          TIMING true,
          VERBOSE true
        ) ${query}
      `;

      const result = await connection.query(explainQuery, params);
      const plan = result.rows[0]['QUERY PLAN'][0];

      return this.extractMetrics(plan);
    } finally {
      await this.pool.release(connection);
    }
  }

  private extractMetrics(plan: any): QueryPerformanceMetrics {
    const execution = plan['Execution Time'] || 0;
    const planning = plan['Planning Time'] || 0;
    
    const indexesUsed = this.extractIndexesFromPlan(plan.Plan);
    const scanTypes = this.extractScanTypes(plan.Plan);
    const bufferStats = this.extractBufferStats(plan.Plan);

    return {
      executionTime: execution,
      planningTime: planning,
      totalTime: execution + planning,
      rowsReturned: plan.Plan['Actual Rows'] || 0,
      indexesUsed,
      scanTypes,
      bufferHits: bufferStats.hits,
      bufferReads: bufferStats.reads,
      queryPlan: plan
    };
  }

  private extractIndexesFromPlan(plan: any): string[] {
    const indexes: string[] = [];
    
    const traverse = (node: any) => {
      if (node['Index Name']) {
        indexes.push(node['Index Name']);
      }
      
      if (node.Plans) {
        node.Plans.forEach(traverse);
      }
    };
    
    traverse(plan);
    return [...new Set(indexes)]; // Remove duplicates
  }

  private extractScanTypes(plan: any): string[] {
    const scanTypes: string[] = [];
    
    const traverse = (node: any) => {
      if (node['Node Type']) {
        scanTypes.push(node['Node Type']);
      }
      
      if (node.Plans) {
        node.Plans.forEach(traverse);
      }
    };
    
    traverse(plan);
    return [...new Set(scanTypes)];
  }

  private extractBufferStats(plan: any): { hits: number; reads: number } {
    let hits = 0;
    let reads = 0;
    
    const traverse = (node: any) => {
      hits += node['Shared Hit Blocks'] || 0;
      reads += node['Shared Read Blocks'] || 0;
      
      if (node.Plans) {
        node.Plans.forEach(traverse);
      }
    };
    
    traverse(plan);
    return { hits, reads };
  }

  async compareQueries(
    query1: string,
    query2: string,
    params: any[] = []
  ): Promise<{
    query1: QueryPerformanceMetrics;
    query2: QueryPerformanceMetrics;
    improvement: number;
  }> {
    const [metrics1, metrics2] = await Promise.all([
      this.measureQueryPerformance(query1, params),
      this.measureQueryPerformance(query2, params)
    ]);

    const improvement = (
      (metrics1.totalTime - metrics2.totalTime) / metrics1.totalTime
    ) * 100;

    return { query1: metrics1, query2: metrics2, improvement };
  }
}

// ===== IMPLEMENTATION: Index Manager =====
// property-search-api/src/database/IndexManager.ts
export interface IndexInfo {
  indexName: string;
  tableName: string;
  columnNames: string[];
  indexType: string;
  isUnique: boolean;
  size: string;
  scans: number;
  tupleReads: number;
  tupleFetches: number;
}

export interface IndexSuggestion {
  indexName: string;
  tableName: string;
  columns: string[];
  reason: string;
  impact: 'low' | 'medium' | 'high';
  estimatedSize: string;
}

export class IndexManager {
  constructor(private pool: AdvancedConnectionPool) {}

  async listIndexes(tableName?: string): Promise<string[]> {
    const connection = await this.pool.acquire();
    
    try {
      let query = `
        SELECT indexname 
        FROM pg_indexes 
        WHERE schemaname = 'public'
      `;
      
      if (tableName) {
        query += ` AND tablename = $1`;
      }
      
      const result = await connection.query(query, tableName ? [tableName] : []);
      return result.rows.map(row => row.indexname);
    } finally {
      await this.pool.release(connection);
    }
  }

  async getIndexInfo(tableName: string): Promise<IndexInfo[]> {
    const connection = await this.pool.acquire();
    
    try {
      const query = `
        SELECT 
          i.indexname,
          i.tablename,
          array_agg(a.attname ORDER BY a.attnum) as column_names,
          am.amname as index_type,
          ix.indisunique as is_unique,
          pg_size_pretty(pg_relation_size(ix.indexrelid)) as size,
          COALESCE(s.idx_scan, 0) as scans,
          COALESCE(s.idx_tup_read, 0) as tuple_reads,
          COALESCE(s.idx_tup_fetch, 0) as tuple_fetches
        FROM pg_indexes i
        JOIN pg_class c ON c.relname = i.indexname
        JOIN pg_index ix ON ix.indexrelid = c.oid
        JOIN pg_class ct ON ct.oid = ix.indrelid
        JOIN pg_am am ON am.oid = c.relam
        JOIN pg_attribute a ON a.attrelid = ix.indrelid AND a.attnum = ANY(ix.indkey)
        LEFT JOIN pg_stat_user_indexes s ON s.indexrelid = ix.indexrelid
        WHERE i.tablename = $1 AND i.schemaname = 'public'
        GROUP BY i.indexname, i.tablename, am.amname, ix.indisunique, ix.indexrelid, s.idx_scan, s.idx_tup_read, s.idx_tup_fetch
        ORDER BY i.indexname
      `;
      
      const result = await connection.query(query, [tableName]);
      
      return result.rows.map(row => ({
        indexName: row.indexname,
        tableName: row.tablename,
        columnNames: row.column_names,
        indexType: row.index_type,
        isUnique: row.is_unique,
        size: row.size,
        scans: row.scans,
        tupleReads: row.tuple_reads,
        tupleFetches: row.tuple_fetches
      }));
    } finally {
      await this.pool.release(connection);
    }
  }

  async findUnusedIndexes(): Promise<IndexInfo[]> {
    const indexes = await this.getIndexInfo('properties');
    
    // Consider an index unused if it has very few scans relative to table size
    return indexes.filter(index => 
      index.scans < 10 && // Less than 10 scans
      !index.indexName.includes('pkey') && // Not primary key
      !index.isUnique // Not unique constraint
    );
  }

  async getIndexSuggestions(): Promise<IndexSuggestion[]> {
    const connection = await this.pool.acquire();
    
    try {
      // Analyze query patterns to suggest indexes
      const query = `
        SELECT 
          schemaname,
          tablename,
          calls,
          total_time,
          mean_time,
          query
        FROM pg_stat_statements pss
        JOIN pg_stat_user_tables pst ON pss.query LIKE '%' || pst.relname || '%'
        WHERE pst.relname = 'properties'
        AND calls > 10
        ORDER BY total_time DESC
        LIMIT 20
      `;
      
      const result = await connection.query(query);
      const suggestions: IndexSuggestion[] = [];
      
      // Analyze queries for missing indexes
      for (const row of result.rows) {
        const querySuggestions = this.analyzeQueryForIndexes(row.query);
        suggestions.push(...querySuggestions);
      }
      
      return this.deduplicateSuggestions(suggestions);
    } finally {
      await this.pool.release(connection);
    }
  }

  private analyzeQueryForIndexes(query: string): IndexSuggestion[] {
    const suggestions: IndexSuggestion[] = [];
    
    // Pattern matching for common index opportunities
    const patterns = [
      {
        pattern: /WHERE.*price\s+BETWEEN/gi,
        suggestion: {
          indexName: 'idx_properties_price_range',
          tableName: 'properties',
          columns: ['price'],
          reason: 'Frequently used in range queries',
          impact: 'high' as const,
          estimatedSize: '< 1MB'
        }
      },
      {
        pattern: /WHERE.*bedrooms\s*>=?/gi,
        suggestion: {
          indexName: 'idx_properties_bedrooms_filter',
          tableName: 'properties', 
          columns: ['bedrooms'],
          reason: 'Frequently used in WHERE clauses',
          impact: 'medium' as const,
          estimatedSize: '< 500KB'
        }
      },
      {
        pattern: /ORDER BY.*created_at/gi,
        suggestion: {
          indexName: 'idx_properties_created_at_sort',
          tableName: 'properties',
          columns: ['created_at'],
          reason: 'Frequently used for sorting',
          impact: 'medium' as const,
          estimatedSize: '< 1MB'
        }
      }
    ];
    
    for (const { pattern, suggestion } of patterns) {
      if (pattern.test(query)) {
        suggestions.push(suggestion);
      }
    }
    
    return suggestions;
  }

  private deduplicateSuggestions(suggestions: IndexSuggestion[]): IndexSuggestion[] {
    const seen = new Set<string>();
    return suggestions.filter(suggestion => {
      const key = `${suggestion.tableName}.${suggestion.columns.join('.')}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  async createIndexesConcurrently(indexNames: string[]): Promise<void> {
    const promises = indexNames.map(async (indexName) => {
      const connection = await this.pool.acquire();
      try {
        await connection.query(`
          CREATE INDEX CONCURRENTLY IF NOT EXISTS ${indexName}
          ON properties (created_at)
        `);
      } finally {
        await this.pool.release(connection);
      }
    });
    
    await Promise.all(promises);
  }

  async dropIndex(indexName: string): Promise<void> {
    const connection = await this.pool.acquire();
    
    try {
      await connection.query(`DROP INDEX IF EXISTS ${indexName}`);
    } finally {
      await this.pool.release(connection);
    }
  }

  async detectMissingIndexes(): Promise<string[]> {
    const currentIndexes = await this.listIndexes('properties');
    const requiredIndexes = [
      'idx_properties_price',
      'idx_properties_bedrooms',
      'idx_properties_property_type',
      'idx_properties_available',
      'idx_properties_search_vector'
    ];
    
    return requiredIndexes.filter(required => 
      !currentIndexes.includes(required)
    );
  }

  async validateIndexEffectiveness(
    indexName: string,
    testQuery: string,
    params: any[] = []
  ): Promise<{
    indexUsed: boolean;
    scanType: string;
    rowsExamined: number;
    rowsReturned: number;
    selectivity: number;
    recommendation: string;
  }> {
    const analyzer = new QueryPerformanceAnalyzer(this.pool);
    const metrics = await analyzer.measureQueryPerformance(testQuery, params);
    
    const indexUsed = metrics.indexesUsed.includes(indexName);
    const selectivity = metrics.rowsReturned / (metrics.rowsReturned + 1000); // Rough estimate
    
    let recommendation = 'Index is working effectively';
    if (!indexUsed) {
      recommendation = 'Index is not being used - consider query optimization';
    } else if (selectivity > 0.1) {
      recommendation = 'Index has low selectivity - consider adding filters';
    }
    
    return {
      indexUsed,
      scanType: metrics.scanTypes[0] || 'unknown',
      rowsExamined: metrics.rowsReturned * 2, // Estimate
      rowsReturned: metrics.rowsReturned,
      selectivity,
      recommendation
    };
  }

  async getOptimizationRecommendations(): Promise<Array<{
    type: 'create' | 'drop' | 'modify';
    indexName: string;
    reason: string;
    estimatedImpact: string;
  }>> {
    const [unused, missing, suggestions] = await Promise.all([
      this.findUnusedIndexes(),
      this.detectMissingIndexes(),
      this.getIndexSuggestions()
    ]);

    const recommendations = [];

    // Recommend dropping unused indexes
    for (const index of unused) {
      recommendations.push({
        type: 'drop' as const,
        indexName: index.indexName,
        reason: `Index has only ${index.scans} scans - rarely used`,
        estimatedImpact: 'Reduce storage and maintenance overhead'
      });
    }

    // Recommend creating missing indexes
    for (const indexName of missing) {
      recommendations.push({
        type: 'create' as const,
        indexName,
        reason: 'Required for optimal query performance',
        estimatedImpact: 'Significant performance improvement'
      });
    }

    return recommendations;
  }
}

// ===== IMPLEMENTATION: Migration for Index Creation =====
// property-search-api/src/database/migrations/005_create_property_indexes.ts
export async function up(pool: AdvancedConnectionPool): Promise<void> {
  console.log('Creating property search indexes...');
  
  const optimizer = new DatabaseIndexOptimizer(pool);
  const createdIndexes = await optimizer.createPropertyIndexes();
  
  console.log(`✅ Created ${createdIndexes.length} indexes:`, createdIndexes);
}

export async function down(pool: AdvancedConnectionPool): Promise<void> {
  console.log('Dropping property search indexes...');
  
  const optimizer = new DatabaseIndexOptimizer(pool);
  await optimizer.dropPropertyIndexes();
  
  console.log('✅ Dropped property search indexes');
}

// ===== INTEGRATION: Use in Property Service =====
// property-search-api/src/services/OptimizedPropertyService.ts
import { PropertySearchParams } from '../validation/propertySearchValidation';
import { AdvancedConnectionPool } from '../database/AdvancedConnectionPool';
import { QueryPerformanceAnalyzer } from '../database/QueryPerformanceAnalyzer';

export class OptimizedPropertyService {
  private analyzer: QueryPerformanceAnalyzer;

  constructor(private pool: AdvancedConnectionPool) {
    this.analyzer = new QueryPerformanceAnalyzer(pool);
  }

  async searchProperties(params: PropertySearchParams) {
    const connection = await this.pool.acquire();
    
    try {
      // Use optimized query with proper indexes
      const query = this.buildOptimizedSearchQuery(params);
      const queryParams = this.buildQueryParams(params);
      
      // Monitor performance in development
      if (process.env.NODE_ENV === 'development') {
        const metrics = await this.analyzer.measureQueryPerformance(query, queryParams);
        if (metrics.executionTime > 100) {
          console.warn(`Slow query detected (${metrics.executionTime}ms):`, {
            query: query.substring(0, 100) + '...',
            indexes: metrics.indexesUsed
          });
        }
      }
      
      const result = await connection.query(query, queryParams);
      
      return this.formatSearchResults(result.rows, params);
    } finally {
      await this.pool.release(connection);
    }
  }

  private buildOptimizedSearchQuery(params: PropertySearchParams): string {
    let query = `
      SELECT 
        p.*,
        ts_rank(p.search_vector, plainto_tsquery('english', $1)) as text_rank,
        COUNT(*) OVER() as total_count
      FROM properties p
      WHERE p.available = true
    `;

    let paramIndex = 2;

    // Full-text search using GIN index
    if (params.query) {
      query += ` AND p.search_vector @@ plainto_tsquery('english', $1)`;
    }

    // Price range using B-tree index
    if (params.price_min !== undefined) {
      query += ` AND p.price >= $${paramIndex}`;
      paramIndex++;
    }

    if (params.price_max !== undefined) {
      query += ` AND p.price <= $${paramIndex}`;
      paramIndex++;
    }

    // Property type using B-tree index
    if (params.property_type) {
      query += ` AND p.property_type = $${paramIndex}`;
      paramIndex++;
    }

    // Bedrooms using B-tree index
    if (params.bedrooms !== undefined) {
      query += ` AND p.bedrooms >= $${paramIndex}`;
      paramIndex++;
    }

    // Geographic search using GiST index
    if (params.latitude && params.longitude && params.radius) {
      query += ` AND ST_DWithin(
        ST_Point(p.longitude, p.latitude)::geography,
        ST_Point($${paramIndex}, $${paramIndex + 1})::geography,
        $${paramIndex + 2} * 1000
      )`;
      paramIndex += 3;
    }

    // Optimized sorting
    query += this.buildOptimizedOrderBy(params);
    
    // Pagination
    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;

    return query;
  }

  private buildOptimizedOrderBy(params: PropertySearchParams): string {
    switch (params.sort) {
      case 'price_asc':
        return ' ORDER BY p.price ASC';
      case 'price_desc':
        return ' ORDER BY p.price DESC';
      case 'date_desc':
        return ' ORDER BY p.created_at DESC';
      case 'relevance':
      default:
        return params.query 
          ? ' ORDER BY text_rank DESC, p.created_at DESC'
          : ' ORDER BY p.created_at DESC';
    }
  }

  private buildQueryParams(params: PropertySearchParams): any[] {
    const queryParams: any[] = [params.query || ''];
    
    if (params.price_min !== undefined) queryParams.push(params.price_min);
    if (params.price_max !== undefined) queryParams.push(params.price_max);
    if (params.property_type) queryParams.push(params.property_type);
    if (params.bedrooms !== undefined) queryParams.push(params.bedrooms);
    
    if (params.latitude && params.longitude && params.radius) {
      queryParams.push(params.longitude, params.latitude, params.radius);
    }
    
    queryParams.push(params.limit, (params.page - 1) * params.limit);
    
    return queryParams;
  }

  private formatSearchResults(rows: any[], params: PropertySearchParams) {
    return {
      properties: rows,
      totalCount: rows[0]?.total_count || 0,
      page: params.page,
      limit: params.limit,
      totalPages: Math.ceil((rows[0]?.total_count || 0) / params.limit),
      executionTime: Date.now() // Add performance tracking
    };
  }
}

// ===== HELPER: Test Data Setup =====
async function setupTestData(): Promise<void> {
  // Implementation to create test properties for performance testing
  // This would insert sample property data for testing index effectiveness
}

async function simulateQueryWorkload(): Promise<void> {
  // Implementation to simulate typical query patterns
  // This would run various property search queries to generate usage statistics
}
