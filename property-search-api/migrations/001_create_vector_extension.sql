-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column to properties table
ALTER TABLE properties 
ADD COLUMN IF NOT EXISTS embedding vector(384),
ADD COLUMN IF NOT EXISTS indexed_at TIMESTAMP;

-- Create index for vector similarity search
CREATE INDEX IF NOT EXISTS properties_embedding_idx 
ON properties 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Create index on indexed_at for monitoring
CREATE INDEX IF NOT EXISTS properties_indexed_at_idx 
ON properties(indexed_at);

-- Function to get unindexed properties
CREATE OR REPLACE FUNCTION get_unindexed_properties(limit_count INTEGER DEFAULT 100)
RETURNS TABLE(id UUID, description TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT p.id, p.description
  FROM properties p
  WHERE p.embedding IS NULL
  OR p.indexed_at < p.updated_at
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;