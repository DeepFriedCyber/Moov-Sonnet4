import request from 'supertest';
import express from 'express';
import { validatePropertySearch, PropertySearchParams } from '../../validation/propertySearchValidation';
import { ValidationError } from '../../validation/ValidationError';

describe('Property Search Validation', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    
    app.get('/api/properties/search', validatePropertySearch, (req, res) => {
      res.json({ success: true, params: req.query });
    });
  });

  test('should accept valid search parameters', async () => {
    const validParams = {
      query: 'london apartment',
      price_min: '100000',
      price_max: '500000',
      bedrooms: '2',
      bathrooms: '1',
      property_type: 'flat',
      page: '1',
      limit: '20'
    };

    const response = await request(app)
      .get('/api/properties/search')
      .query(validParams)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.params.price_min).toBe(100000);
  });

  test('should reject invalid price ranges', async () => {
    const invalidParams = {
      query: 'london',
      price_min: '500000',
      price_max: '100000' // max less than min
    };

    const response = await request(app)
      .get('/api/properties/search')
      .query(invalidParams)
      .expect(400);

    expect(response.body.error).toBe('Validation failed');
    expect(response.body.details).toEqual(
      expect.arrayContaining([
        expect.stringContaining('price_max must be greater than price_min')
      ])
    );
  });

  test('should sanitize and validate query string', async () => {
    const maliciousParams = {
      query: '<script>alert("xss")</script>SELECT * FROM properties--',
      price_min: 'not_a_number',
      bedrooms: '999'
    };

    const response = await request(app)
      .get('/api/properties/search')
      .query(maliciousParams)
      .expect(400);

    expect(response.body.details).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Invalid characters in search query')
      ])
    );
  });

  test('should apply default values for optional parameters', async () => {
    const minimalParams = {
      query: 'manchester'
    };

    const response = await request(app)
      .get('/api/properties/search')
      .query(minimalParams)
      .expect(200);

    expect(response.body.params.page).toBe(1);
    expect(response.body.params.limit).toBe(20);
  });

  test('should validate UK postcode format', async () => {
    const testCases = [
      { postcode: 'SW1A 1AA', valid: true },
      { postcode: 'M1 1AA', valid: true },
      { postcode: 'B33 8TH', valid: true },
      { postcode: 'W1A 0AX', valid: true },
      { postcode: 'invalid', valid: false },
      { postcode: '12345', valid: false },
      { postcode: 'SW1A1AA', valid: true }, // Without space
    ];

    for (const testCase of testCases) {
      const response = await request(app)
        .get('/api/properties/search')
        .query({ query: 'test', postcode: testCase.postcode });

      if (testCase.valid) {
        expect(response.status).toBe(200);
      } else {
        expect(response.status).toBe(400);
        expect(response.body.details).toEqual(
          expect.arrayContaining([
            expect.stringContaining('Invalid UK postcode format')
          ])
        );
      }
    }
  });
});