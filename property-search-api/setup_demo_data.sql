-- Setup Demo Property Data for Analysis
-- This script creates the properties table and prepares for CSV import

-- Create properties table matching analysis script requirements
CREATE TABLE IF NOT EXISTS properties (
    id SERIAL PRIMARY KEY,
    title VARCHAR(500),
    address TEXT NOT NULL,
    url TEXT,
    postcode VARCHAR(10),
    last_sold DATE,
    price INTEGER NOT NULL,
    floor_area_sqm INTEGER,
    price_per_sqm INTEGER,
    property_type VARCHAR(50),
    bedrooms INTEGER,
    tenure VARCHAR(20),
    plot_size INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_properties_postcode ON properties(postcode);
CREATE INDEX IF NOT EXISTS idx_properties_type ON properties(property_type);
CREATE INDEX IF NOT EXISTS idx_properties_price ON properties(price);
CREATE INDEX IF NOT EXISTS idx_properties_bedrooms ON properties(bedrooms);

-- Add any additional constraints
ALTER TABLE properties 
ADD CONSTRAINT chk_price_positive CHECK (price > 0),
ADD CONSTRAINT chk_bedrooms_valid CHECK (bedrooms >= 0 AND bedrooms <= 20);