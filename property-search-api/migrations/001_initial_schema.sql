-- Initial Database Schema for Property Search Platform
-- Creates the core tables needed for the application

-- Users table (agents, customers, admins)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'customer', -- 'customer', 'agent', 'admin'
    company VARCHAR(200),
    phone VARCHAR(20),
    subscription_tier VARCHAR(20) DEFAULT 'basic', -- 'basic', 'pro', 'enterprise'
    subscription_status VARCHAR(20) DEFAULT 'active', -- 'active', 'inactive', 'cancelled'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Properties table (main property listings)
CREATE TABLE IF NOT EXISTS properties (
    id SERIAL PRIMARY KEY,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    price INTEGER NOT NULL,
    bedrooms INTEGER,
    bathrooms INTEGER,
    property_type VARCHAR(50) NOT NULL, -- 'House', 'Flat', 'Bungalow', etc.
    address TEXT NOT NULL,
    postcode VARCHAR(10),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    floor_area_sqm INTEGER,
    plot_size_sqm INTEGER,
    price_per_sqm INTEGER,
    tenure VARCHAR(20), -- 'Freehold', 'Leasehold'
    images TEXT[], -- Array of image URLs
    features TEXT[], -- Array of property features
    agent_id INTEGER REFERENCES users(id),
    is_active BOOLEAN DEFAULT true,
    last_sold_date DATE,
    source_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Geocoding queue for properties that need geocoding
CREATE TABLE IF NOT EXISTS geocoding_queue (
    id SERIAL PRIMARY KEY,
    property_id INTEGER REFERENCES properties(id) ON DELETE CASCADE,
    address TEXT NOT NULL,
    postcode VARCHAR(10),
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    error_message TEXT,
    attempts INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Property views/analytics
CREATE TABLE IF NOT EXISTS property_views (
    id SERIAL PRIMARY KEY,
    property_id INTEGER REFERENCES properties(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    ip_address INET,
    user_agent TEXT,
    viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Saved properties (user favorites)
CREATE TABLE IF NOT EXISTS saved_properties (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    property_id INTEGER REFERENCES properties(id) ON DELETE CASCADE,
    saved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, property_id)
);

-- Property search history
CREATE TABLE IF NOT EXISTS search_history (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    search_query TEXT,
    filters JSONB, -- Store search filters as JSON
    results_count INTEGER,
    ip_address INET,
    searched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_properties_postcode ON properties(postcode);
CREATE INDEX IF NOT EXISTS idx_properties_type ON properties(property_type);
CREATE INDEX IF NOT EXISTS idx_properties_price ON properties(price);
CREATE INDEX IF NOT EXISTS idx_properties_bedrooms ON properties(bedrooms);
CREATE INDEX IF NOT EXISTS idx_properties_active ON properties(is_active);
CREATE INDEX IF NOT EXISTS idx_properties_agent ON properties(agent_id);
CREATE INDEX IF NOT EXISTS idx_properties_location ON properties(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_properties_created ON properties(created_at);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

CREATE INDEX IF NOT EXISTS idx_geocoding_status ON geocoding_queue(status);
CREATE INDEX IF NOT EXISTS idx_geocoding_property ON geocoding_queue(property_id);

CREATE INDEX IF NOT EXISTS idx_property_views_property ON property_views(property_id);
CREATE INDEX IF NOT EXISTS idx_property_views_user ON property_views(user_id);
CREATE INDEX IF NOT EXISTS idx_property_views_date ON property_views(viewed_at);

CREATE INDEX IF NOT EXISTS idx_saved_properties_user ON saved_properties(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_properties_property ON saved_properties(property_id);

CREATE INDEX IF NOT EXISTS idx_search_history_user ON search_history(user_id);
CREATE INDEX IF NOT EXISTS idx_search_history_date ON search_history(searched_at);

-- Add constraints
ALTER TABLE properties 
ADD CONSTRAINT chk_price_positive CHECK (price > 0),
ADD CONSTRAINT chk_bedrooms_valid CHECK (bedrooms >= 0 AND bedrooms <= 50),
ADD CONSTRAINT chk_bathrooms_valid CHECK (bathrooms >= 0 AND bathrooms <= 20);

ALTER TABLE users
ADD CONSTRAINT chk_role_valid CHECK (role IN ('customer', 'agent', 'admin')),
ADD CONSTRAINT chk_subscription_tier_valid CHECK (subscription_tier IN ('basic', 'pro', 'enterprise')),
ADD CONSTRAINT chk_subscription_status_valid CHECK (subscription_status IN ('active', 'inactive', 'cancelled'));

-- Insert initial admin user
INSERT INTO users (email, first_name, last_name, role, subscription_tier, subscription_status)
VALUES ('admin@propertyplatform.co.uk', 'Admin', 'User', 'admin', 'enterprise', 'active')
ON CONFLICT (email) DO NOTHING;