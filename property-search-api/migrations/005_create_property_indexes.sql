-- Migration: Create Property Search Indexes
-- This migration creates comprehensive indexes for optimal property search performance

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS vector;

-- Basic property search indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_properties_price 
ON properties(price);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_properties_bedrooms 
ON properties(bedrooms);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_properties_bathrooms 
ON properties(bathrooms);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_properties_property_type 
ON properties(property_type);

-- Partial index for available properties only (more efficient)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_properties_available 
ON properties(available) WHERE available = true;

-- Composite indexes for common query patterns
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_properties_available_type_price 
ON properties(available, property_type, price);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_properties_bedrooms_bathrooms 
ON properties(bedrooms, bathrooms);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_properties_price_bedrooms 
ON properties(price, bedrooms);

-- Geographic search indexes (requires PostGIS)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_properties_location_gist 
ON properties USING GIST(ST_Point(longitude, latitude));

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_properties_postcode 
ON properties(postcode);

-- Add tsvector column for full-text search if not exists
ALTER TABLE properties 
ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Create function to update search vector
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

-- Create trigger to automatically update search vector
DROP TRIGGER IF EXISTS trigger_update_properties_search_vector ON properties;
CREATE TRIGGER trigger_update_properties_search_vector
BEFORE INSERT OR UPDATE ON properties
FOR EACH ROW EXECUTE FUNCTION update_properties_search_vector();

-- Update existing records with search vector
UPDATE properties SET search_vector = 
  setweight(to_tsvector('english', COALESCE(title, '')), 'A') ||
  setweight(to_tsvector('english', COALESCE(description, '')), 'B') ||
  setweight(to_tsvector('english', COALESCE(postcode, '')), 'C') ||
  setweight(to_tsvector('english', 
    COALESCE(array_to_string(features, ' '), '')
  ), 'D')
WHERE search_vector IS NULL;

-- Full-text search indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_properties_search_vector 
ON properties USING GIN(search_vector);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_properties_title_gin 
ON properties USING GIN(to_tsvector('english', title));

-- Performance indexes for sorting and filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_properties_created_at 
ON properties(created_at);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_properties_updated_at 
ON properties(updated_at);

-- Create property_embeddings table if not exists (for semantic search)
CREATE TABLE IF NOT EXISTS property_embeddings (
  id SERIAL PRIMARY KEY,
  property_id INTEGER REFERENCES properties(id) ON DELETE CASCADE,
  combined_embedding vector(384), -- Assuming 384-dimensional embeddings
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Vector similarity indexes for semantic search (requires pgvector extension)
-- Note: These might fail if pgvector is not properly installed
DO $$
BEGIN
  -- Try to create HNSW index
  BEGIN
    EXECUTE 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_property_embeddings_hnsw 
             ON property_embeddings USING hnsw (combined_embedding vector_cosine_ops)';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not create HNSW index: %', SQLERRM;
  END;
  
  -- Try to create IVFFlat index
  BEGIN
    EXECUTE 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_property_embeddings_ivfflat 
             ON property_embeddings USING ivfflat (combined_embedding vector_cosine_ops) 
             WITH (lists = 100)';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not create IVFFlat index: %', SQLERRM;
  END;
END $$;

-- Create index on property_embeddings foreign key
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_property_embeddings_property_id 
ON property_embeddings(property_id);

-- Analyze tables to update statistics
ANALYZE properties;
ANALYZE property_embeddings;