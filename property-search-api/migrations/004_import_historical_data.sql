-- Customized Historical Property Data Import Script
-- For search_results(4).csv - Crewe/Cheshire property data
-- Place this in: property-search-api/migrations/004_import_historical_data.sql

-- Create temporary table matching your CSV structure
CREATE TEMP TABLE temp_historical_properties (
    address TEXT,
    url TEXT,
    last_sold TEXT,
    price_paid INTEGER,
    floor_area INTEGER,
    price_per_sqm INTEGER,
    property_type TEXT,
    beds INTEGER,
    tenure TEXT,
    plot_size INTEGER
);

-- Import your CSV data
-- COPY temp_historical_properties FROM '/path/to/search_results(4).csv' WITH CSV HEADER;

-- Clean and insert into main properties table
INSERT INTO properties (
    title,
    description,
    price,
    bedrooms,
    bathrooms,
    property_type,
    address,
    postcode,
    latitude,
    longitude,
    floor_area_sqm,
    plot_size_sqm,
    price_per_sqm,
    tenure,
    images,
    features,
    agent_id,
    is_active,
    last_sold_date,
    source_url,
    created_at,
    updated_at
)
SELECT 
    -- Generate attractive titles
    CASE 
        WHEN beds IS NOT NULL AND beds > 0 THEN 
            beds || ' bedroom ' || 
            CASE 
                WHEN LOWER(property_type) LIKE '%detached%' THEN 'detached house'
                WHEN LOWER(property_type) LIKE '%semi%' THEN 'semi-detached house'
                WHEN LOWER(property_type) LIKE '%terrace%' THEN 'terraced house'
                WHEN LOWER(property_type) LIKE '%flat%' THEN 'flat'
                WHEN LOWER(property_type) LIKE '%bungalow%' THEN 'bungalow'
                ELSE 'property'
            END
        ELSE 'Beautiful property'
    END || ' in ' || 
    CASE 
        WHEN address LIKE '%CW1%' THEN 'Crewe'
        WHEN address LIKE '%CW2%' THEN 'Crewe'
        WHEN address LIKE '%CW10%' THEN 'Middlewich'
        WHEN address LIKE '%CW11%' THEN 'Sandbach'
        WHEN address LIKE '%CW4%' THEN 'Winsford'
        WHEN address LIKE '%ST7%' THEN 'Alsager'
        ELSE 'Cheshire'
    END as title,
    
    -- Generate rich descriptions for semantic search
    'Beautiful ' || 
    CASE 
        WHEN beds IS NOT NULL AND beds > 0 THEN beds || ' bedroom '
        ELSE ''
    END ||
    CASE 
        WHEN LOWER(property_type) LIKE '%detached%' THEN 'detached house'
        WHEN LOWER(property_type) LIKE '%semi%' THEN 'semi-detached house'
        WHEN LOWER(property_type) LIKE '%terrace%' THEN 'terraced house'
        WHEN LOWER(property_type) LIKE '%flat%' THEN 'flat'
        WHEN LOWER(property_type) LIKE '%bungalow%' THEN 'bungalow'
        ELSE 'property'
    END ||
    CASE 
        WHEN floor_area IS NOT NULL AND floor_area > 0 THEN 
            ' with ' || floor_area || ' square metres of living space'
        ELSE ''
    END ||
    CASE 
        WHEN plot_size IS NOT NULL AND plot_size > 0 THEN 
            ' and a ' || plot_size || ' square metre plot'
        ELSE ''
    END ||
    '. Located in ' ||
    CASE 
        WHEN address LIKE '%CW1%' THEN 'Crewe, a vibrant town with excellent transport links'
        WHEN address LIKE '%CW2%' THEN 'Crewe, close to the town center and amenities'
        WHEN address LIKE '%CW10%' THEN 'Middlewich, a charming market town'
        WHEN address LIKE '%CW11%' THEN 'Sandbach, known for its historic market square'
        WHEN address LIKE '%CW4%' THEN 'Winsford, a growing town with good facilities'
        WHEN address LIKE '%ST7%' THEN 'Alsager, a popular residential area'
        ELSE 'a desirable Cheshire location'
    END ||
    CASE 
        WHEN tenure = 'Freehold' THEN '. Freehold property offering complete ownership.'
        WHEN tenure = 'Leasehold' THEN '. Leasehold property.'
        ELSE '.'
    END as description,
    
    price_paid as price,
    COALESCE(beds, 1) as bedrooms,
    
    -- Estimate bathrooms based on bedrooms
    CASE 
        WHEN beds >= 4 THEN 2
        WHEN beds >= 2 THEN 1
        ELSE 1
    END as bathrooms,
    
    -- Standardize property types
    CASE 
        WHEN LOWER(property_type) LIKE '%flat%' THEN 'Flat'
        WHEN LOWER(property_type) LIKE '%detached%' AND LOWER(property_type) LIKE '%bungalow%' THEN 'Bungalow'
        WHEN LOWER(property_type) LIKE '%semi%' AND LOWER(property_type) LIKE '%bungalow%' THEN 'Bungalow'
        WHEN LOWER(property_type) LIKE '%terrace%' AND LOWER(property_type) LIKE '%bungalow%' THEN 'Bungalow'
        WHEN LOWER(property_type) LIKE '%bungalow%' THEN 'Bungalow'
        WHEN LOWER(property_type) LIKE '%detached%' THEN 'House'
        WHEN LOWER(property_type) LIKE '%semi%' THEN 'House'
        WHEN LOWER(property_type) LIKE '%terrace%' THEN 'House'
        WHEN LOWER(property_type) = 'other' THEN 'House'
        ELSE 'House'
    END as property_type,
    
    address as address,
    
    -- Extract postcode
    UPPER(TRIM(REGEXP_REPLACE(address, '^.*, ([A-Z]{1,2}[0-9]{1,2}[A-Z]? [0-9][A-Z]{2}).*$', '\1'))) as postcode,
    
    NULL as latitude,  -- Will be geocoded later
    NULL as longitude, -- Will be geocoded later
    floor_area as floor_area_sqm,
    plot_size as plot_size_sqm,
    price_per_sqm as price_per_sqm,
    tenure as tenure,
    
    -- Generate placeholder images (you can replace with actual property photos)
    ARRAY[
        'https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800&h=600&fit=crop',
        'https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=800&h=600&fit=crop'
    ] as images,
    
    -- Generate features based on property data
    ARRAY_REMOVE(ARRAY[
        CASE WHEN tenure = 'Freehold' THEN 'Freehold' ELSE NULL END,
        CASE WHEN plot_size > 200 THEN 'Large Garden' ELSE NULL END,
        CASE WHEN plot_size > 0 THEN 'Garden' ELSE NULL END,
        CASE WHEN floor_area > 100 THEN 'Spacious' ELSE NULL END,
        CASE WHEN LOWER(property_type) LIKE '%detached%' THEN 'Detached' ELSE NULL END,
        CASE WHEN beds >= 4 THEN 'Family Home' ELSE NULL END,
        CASE WHEN address LIKE '%CW1%' OR address LIKE '%CW2%' THEN 'Near Train Station' ELSE NULL END,
        'Residential Area'
    ], NULL) as features,
    
    -- Assign to demo agent (you'll need to create this agent first)
    (SELECT id FROM users WHERE role = 'agent' LIMIT 1) as agent_id,
    true as is_active,
    
    -- Parse last sold date
    CASE 
        WHEN last_sold ~ '^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) [0-9]{4}$' THEN
            TO_DATE(last_sold, 'Mon YYYY')
        ELSE 
            NOW() - (random() * interval '365 days')
    END as last_sold_date,
    
    url as source_url,
    
    -- Set created_at based on last_sold date
    CASE 
        WHEN last_sold ~ '^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) [0-9]{4}$' THEN
            TO_DATE(last_sold, 'Mon YYYY')
        ELSE 
            NOW() - (random() * interval '365 days')
    END as created_at,
    
    NOW() as updated_at
    
FROM temp_historical_properties
WHERE address IS NOT NULL 
  AND address != ''
  AND address != 'Address'  -- Skip header rows
  AND price_paid IS NOT NULL 
  AND price_paid > 0
  AND price_paid < 10000000  -- Filter out obvious data errors
ORDER BY price_paid DESC;

-- Create geocoding tasks for all properties
INSERT INTO geocoding_queue (property_id, address, postcode)
SELECT id, address, postcode 
FROM properties 
WHERE latitude IS NULL OR longitude IS NULL;

-- Create sample agent if doesn't exist
INSERT INTO users (email, first_name, last_name, role, company, phone, subscription_tier, subscription_status, created_at, updated_at)
SELECT 
    'demo.agent@propertyplatform.co.uk',
    'Demo',
    'Agent',
    'agent',
    'Cheshire Properties Ltd',
    '+44 1270 123456',
    'pro',
    'active',
    NOW(),
    NOW()
WHERE NOT EXISTS (SELECT 1 FROM users WHERE role = 'agent');

-- Update agent_id for properties without one
UPDATE properties 
SET agent_id = (SELECT id FROM users WHERE role = 'agent' LIMIT 1)
WHERE agent_id IS NULL;

-- Create property statistics summary
CREATE TEMP TABLE import_summary AS
SELECT 
    COUNT(*) as total_properties,
    AVG(price) as avg_price,
    MIN(price) as min_price,
    MAX(price) as max_price,
    COUNT(DISTINCT postcode) as unique_postcodes,
    COUNT(DISTINCT property_type) as property_types
FROM properties;

-- Display import summary
SELECT 
    'Import completed successfully!' as status,
    total_properties || ' properties imported' as properties,
    '£' || ROUND(avg_price) || ' average price' as pricing,
    unique_postcodes || ' different postcodes' as locations,
    property_types || ' property types' as types
FROM import_summary;