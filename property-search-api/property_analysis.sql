-- Property Data Analysis Script
-- Run this after importing CSV data to get insights

-- ==============================================
-- PRICE ANALYSIS BY AREA
-- ==============================================
SELECT 
    CASE 
        WHEN postcode LIKE 'CW1%' THEN 'Crewe Central'
        WHEN postcode LIKE 'CW2%' THEN 'Crewe South'
        WHEN postcode LIKE 'CW10%' THEN 'Middlewich'
        WHEN postcode LIKE 'CW11%' THEN 'Sandbach'
        WHEN postcode LIKE 'CW4%' THEN 'Winsford'
        WHEN postcode LIKE 'ST7%' THEN 'Alsager'
        ELSE 'Other'
    END as area,
    COUNT(*) as property_count,
    ROUND(AVG(price)) as avg_price,
    ROUND(AVG(price_per_sqm)) as avg_price_per_sqm,
    MIN(price) as min_price,
    MAX(price) as max_price,
    ROUND(AVG(floor_area_sqm)) as avg_floor_area
FROM properties 
WHERE price > 0
GROUP BY 1
ORDER BY avg_price DESC;

-- ==============================================
-- PROPERTY TYPE ANALYSIS
-- ==============================================
SELECT 
    property_type,
    COUNT(*) as count,
    ROUND(AVG(price)) as avg_price,
    ROUND(AVG(floor_area_sqm)) as avg_size_sqm,
    ROUND(AVG(bedrooms)) as avg_bedrooms,
    ROUND(AVG(price_per_sqm)) as avg_price_per_sqm
FROM properties 
WHERE price > 0 AND property_type IS NOT NULL
GROUP BY property_type
ORDER BY count DESC;

-- ==============================================
-- PRICE DISTRIBUTION BY BEDROOMS
-- ==============================================
SELECT 
    bedrooms,
    COUNT(*) as count,
    ROUND(AVG(price)) as avg_price,
    ROUND(MIN(price)) as min_price,
    ROUND(MAX(price)) as max_price,
    ROUND(AVG(floor_area_sqm)) as avg_size_sqm
FROM properties 
WHERE price > 0 AND bedrooms IS NOT NULL
GROUP BY bedrooms
ORDER BY bedrooms;

-- ==============================================
-- MOST EXPENSIVE PROPERTIES
-- ==============================================
SELECT 
    title,
    address,
    price,
    bedrooms,
    property_type,
    floor_area_sqm,
    price_per_sqm,
    postcode
FROM properties 
WHERE price > 0
ORDER BY price DESC 
LIMIT 10;

-- ==============================================
-- PRICE PER SQUARE METER ANALYSIS
-- ==============================================
SELECT 
    property_type,
    COUNT(*) as count,
    ROUND(AVG(price_per_sqm)) as avg_price_per_sqm,
    ROUND(MIN(price_per_sqm)) as min_price_per_sqm,
    ROUND(MAX(price_per_sqm)) as max_price_per_sqm
FROM properties 
WHERE price_per_sqm > 0 AND property_type IS NOT NULL
GROUP BY property_type
ORDER BY avg_price_per_sqm DESC;

-- ==============================================
-- SALES BY MONTH (Recent Activity)
-- ==============================================
SELECT 
    TO_CHAR(last_sold, 'YYYY-MM') as sale_month,
    COUNT(*) as sales_count,
    ROUND(AVG(price)) as avg_price,
    ROUND(SUM(price)) as total_value
FROM properties 
WHERE last_sold IS NOT NULL
GROUP BY TO_CHAR(last_sold, 'YYYY-MM')
ORDER BY sale_month DESC;

-- ==============================================
-- BEST VALUE PROPERTIES (High area, reasonable price)
-- ==============================================
SELECT 
    title,
    address,
    price,
    floor_area_sqm,
    price_per_sqm,
    bedrooms,
    property_type
FROM properties 
WHERE price > 0 
  AND floor_area_sqm > 0 
  AND price_per_sqm < 2500  -- Below average price per sqm
  AND floor_area_sqm > 100   -- Good size
ORDER BY floor_area_sqm DESC, price_per_sqm ASC
LIMIT 15;

-- ==============================================
-- SUMMARY STATISTICS
-- ==============================================
SELECT 
    'Total Properties' as metric,
    COUNT(*)::text as value
FROM properties
UNION ALL
SELECT 
    'Average Price' as metric,
    '£' || ROUND(AVG(price))::text as value
FROM properties WHERE price > 0
UNION ALL
SELECT 
    'Price Range' as metric,
    '£' || MIN(price)::text || ' - £' || MAX(price)::text as value
FROM properties WHERE price > 0
UNION ALL
SELECT 
    'Average Size (sqm)' as metric,
    ROUND(AVG(floor_area_sqm))::text || ' sqm' as value
FROM properties WHERE floor_area_sqm > 0
UNION ALL
SELECT 
    'Average Price per sqm' as metric,
    '£' || ROUND(AVG(price_per_sqm))::text as value
FROM properties WHERE price_per_sqm > 0;