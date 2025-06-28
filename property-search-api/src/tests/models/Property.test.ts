// ============================================================================
// Property Model Tests - TDD Approach
// ============================================================================

import { Property } from '../../models/Property';
import { sequelize } from '../../config/database';

describe('Property Model', () => {
  beforeAll(async () => {
    await sequelize.sync({ force: true });
  });

  afterEach(async () => {
    await Property.destroy({ where: {} });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  describe('Model Validation', () => {
    it('creates a valid property', async () => {
      const propertyData = {
        title: 'Beautiful 2BR Apartment',
        price: 450000,
        location: 'London, UK',
        propertyType: 'apartment' as const,
        bedrooms: 2,
        bathrooms: 1,
        area: 850,
        features: ['parking', 'balcony'],
        images: ['https://example.com/image1.jpg']
      };

      const property = await Property.create(propertyData);
      
      expect(property.id).toBeDefined();
      expect(property.title).toBe(propertyData.title);
      expect(property.price).toBe(propertyData.price);
      expect(property.location).toBe(propertyData.location);
      expect(property.isActive).toBe(true);
      expect(property.features).toEqual(propertyData.features);
    });

    it('validates required fields', async () => {
      await expect(Property.create({
        price: 300000,
        location: 'London'
        // Missing title
      } as any)).rejects.toThrow();
    });

    it('validates title length', async () => {
      await expect(Property.create({
        title: 'Te', // Too short
        price: 300000,
        location: 'London',
        propertyType: 'apartment'
      })).rejects.toThrow();

      await expect(Property.create({
        title: 'A'.repeat(101), // Too long
        price: 300000,
        location: 'London',
        propertyType: 'apartment'
      })).rejects.toThrow();
    });

    it('validates price is positive', async () => {
      await expect(Property.create({
        title: 'Test Property',
        price: -100,
        location: 'London',
        propertyType: 'apartment'
      })).rejects.toThrow();

      await expect(Property.create({
        title: 'Test Property',
        price: 0,
        location: 'London',
        propertyType: 'apartment'
      })).rejects.toThrow();
    });

    it('validates bedroom count range', async () => {
      await expect(Property.create({
        title: 'Test Property',
        price: 300000,
        location: 'London',
        propertyType: 'apartment',
        bedrooms: -1 // Negative
      })).rejects.toThrow();

      await expect(Property.create({
        title: 'Test Property',
        price: 300000,
        location: 'London',
        propertyType: 'apartment',
        bedrooms: 25 // Too many
      })).rejects.toThrow();
    });

    it('validates bathroom count', async () => {
      await expect(Property.create({
        title: 'Test Property',
        price: 300000,
        location: 'London',
        propertyType: 'apartment',
        bathrooms: -1 // Negative
      })).rejects.toThrow();

      await expect(Property.create({
        title: 'Test Property',
        price: 300000,
        location: 'London',
        propertyType: 'apartment',
        bathrooms: 25 // Too many
      })).rejects.toThrow();
    });

    it('validates latitude and longitude ranges', async () => {
      await expect(Property.create({
        title: 'Test Property',
        price: 300000,
        location: 'London',
        propertyType: 'apartment',
        latitude: 91 // Invalid latitude
      })).rejects.toThrow();

      await expect(Property.create({
        title: 'Test Property',
        price: 300000,
        location: 'London',
        propertyType: 'apartment',
        longitude: 181 // Invalid longitude
      })).rejects.toThrow();
    });

    it('validates property type enum', async () => {
      await expect(Property.create({
        title: 'Test Property',
        price: 300000,
        location: 'London',
        propertyType: 'invalid_type' as any
      })).rejects.toThrow();
    });

    it('validates images array', async () => {
      await expect(Property.create({
        title: 'Test Property',
        price: 300000,
        location: 'London',
        propertyType: 'apartment',
        images: 'not_an_array' as any
      })).rejects.toThrow();
    });

    it('validates features array', async () => {
      await expect(Property.create({
        title: 'Test Property',
        price: 300000,
        location: 'London',
        propertyType: 'apartment',
        features: 'not_an_array' as any
      })).rejects.toThrow();
    });
  });

  describe('Instance Methods', () => {
    let property: Property;

    beforeEach(async () => {
      property = await Property.create({
        title: 'Test Property',
        price: 300000,
        location: 'London',
        propertyType: 'apartment',
        area: 1000,
        features: ['parking', 'balcony', 'gym']
      });
    });

    it('calculates price per square foot correctly', () => {
      const pricePerSqFt = property.calculatePricePerSqFt();
      expect(pricePerSqFt).toBe(300); // 300000 / 1000
    });

    it('returns null for price per sqft when area is missing', async () => {
      const propertyWithoutArea = await Property.create({
        title: 'No Area Property',
        price: 300000,
        location: 'London',
        propertyType: 'apartment'
      });
      
      expect(propertyWithoutArea.calculatePricePerSqFt()).toBeNull();
    });

    it('checks if property is affordable', () => {
      expect(property.isAffordable(400000)).toBe(true);
      expect(property.isAffordable(200000)).toBe(false);
      expect(property.isAffordable(300000)).toBe(true);
    });

    it('checks if property has specific feature', () => {
      expect(property.hasFeature('parking')).toBe(true);
      expect(property.hasFeature('pool')).toBe(false);
      expect(property.hasFeature('gym')).toBe(true);
    });
  });

  describe('Static Methods', () => {
    beforeEach(async () => {
      // Create test properties
      await Property.bulkCreate([
        {
          title: 'Central London Flat',
          price: 500000,
          location: 'Central London',
          propertyType: 'apartment',
          latitude: 51.5074,
          longitude: -0.1278
        },
        {
          title: 'Suburb House',
          price: 300000,
          location: 'London Suburb',
          propertyType: 'house',
          latitude: 51.6074,
          longitude: -0.2278
        },
        {
          title: 'Manchester Apartment',
          price: 200000,
          location: 'Manchester',
          propertyType: 'apartment'
        }
      ]);
    });

    it('finds properties by location', async () => {
      const londonProperties = await Property.findByLocation('London');
      expect(londonProperties.length).toBe(2);
      
      const manchesterProperties = await Property.findByLocation('Manchester');
      expect(manchesterProperties.length).toBe(1);
    });

    it('finds properties by price range', async () => {
      const midRangeProperties = await Property.findByPriceRange(250000, 400000);
      expect(midRangeProperties.length).toBe(1);
      expect(midRangeProperties[0].price).toBe(300000);
      
      const expensiveProperties = await Property.findByPriceRange(400000, 600000);
      expect(expensiveProperties.length).toBe(1);
      expect(expensiveProperties[0].price).toBe(500000);
    });
  });

  describe('Model Hooks', () => {
    it('trims location before validation', async () => {
      const property = await Property.create({
        title: 'Test Property',
        price: 300000,
        location: '  London, UK  ', // With spaces
        propertyType: 'apartment'
      });
      
      expect(property.location).toBe('London, UK');
    });

    it('removes duplicate features before validation', async () => {
      const property = await Property.create({
        title: 'Test Property',
        price: 300000,
        location: 'London',
        propertyType: 'apartment',
        features: ['parking', 'balcony', 'parking', 'gym', 'balcony'] // Duplicates
      });
      
      expect(property.features).toEqual(['parking', 'balcony', 'gym']);
    });
  });

  describe('Database Indexes', () => {
    it('creates properties efficiently with indexed fields', async () => {
      const startTime = Date.now();
      
      // Create multiple properties to test index performance
      const properties = Array.from({ length: 100 }, (_, i) => ({
        title: `Property ${i}`,
        price: 200000 + (i * 1000),
        location: i % 2 === 0 ? 'London' : 'Manchester',
        propertyType: i % 2 === 0 ? 'apartment' : 'house',
        bedrooms: (i % 4) + 1,
        isActive: true
      }));
      
      await Property.bulkCreate(properties as any);
      
      // Query using indexed fields should be fast
      const queryStartTime = Date.now();
      const results = await Property.findAll({
        where: {
          price: { [sequelize.Op.between]: [250000, 350000] },
          location: 'London',
          bedrooms: 2,
          isActive: true
        }
      });
      const queryTime = Date.now() - queryStartTime;
      
      expect(results.length).toBeGreaterThan(0);
      expect(queryTime).toBeLessThan(100); // Should be fast with indexes
    });
  });
});