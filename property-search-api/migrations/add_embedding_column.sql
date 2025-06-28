-- ============================================================================
-- Property Database Schema Update for Vector Embeddings
-- add_embedding_column.sql
-- ============================================================================

-- Add embedding column to properties table
ALTER TABLE properties 
ADD COLUMN IF NOT EXISTS embedding vector(384);

-- Add index for vector similarity search (requires pgvector extension)
CREATE INDEX IF NOT EXISTS properties_embedding_idx 
ON properties USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Add column to track when embedding was last updated
ALTER TABLE properties 
ADD COLUMN IF NOT EXISTS embedding_updated_at TIMESTAMP DEFAULT NOW();

-- Create function to auto-update embedding timestamp
CREATE OR REPLACE FUNCTION update_embedding_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.embedding IS DISTINCT FROM OLD.embedding THEN
        NEW.embedding_updated_at = NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_update_embedding_timestamp ON properties;
CREATE TRIGGER trigger_update_embedding_timestamp
    BEFORE UPDATE ON properties
    FOR EACH ROW
    EXECUTE FUNCTION update_embedding_timestamp();

-- Add performance indexes for common search patterns
CREATE INDEX IF NOT EXISTS properties_price_idx ON properties(price);
CREATE INDEX IF NOT EXISTS properties_bedrooms_idx ON properties(bedrooms);
CREATE INDEX IF NOT EXISTS properties_location_idx ON properties USING gin(to_tsvector('english', location));
CREATE INDEX IF NOT EXISTS properties_type_idx ON properties(property_type);

-- Create composite index for filtered searches
CREATE INDEX IF NOT EXISTS properties_search_composite_idx 
ON properties(property_type, bedrooms, price) 
WHERE embedding IS NOT NULL;