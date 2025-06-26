import { validatePropertyData, PropertyCreateData } from '../../validation/propertyDataValidation';

describe('Property Data Validation', () => {
    const validPropertyData: PropertyCreateData = {
        title: 'Beautiful 2-bedroom flat in Central London',
        description: 'A stunning apartment with modern amenities and excellent transport links.',
        price: 450000,
        bedrooms: 2,
        bathrooms: 1,
        property_type: 'flat',
        postcode: 'SW1A 1AA',
        latitude: 51.5074,
        longitude: -0.1278,
        square_feet: 800,
        images: ['https://example.com/image1.jpg', 'https://example.com/image2.jpg'],
        features: ['parking', 'garden', 'balcony'],
        available: true,
        energy_rating: 'B',
        council_tax_band: 'D'
    };

    test('should validate correct property data', () => {
        const result = validatePropertyData(validPropertyData);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.price).toBe(450000);
            expect(result.data.property_type).toBe('flat');
        }
    });

    test('should reject property with invalid price range', () => {
        const invalidProperty = {
            ...validPropertyData,
            price: 100 // Too low for UK property market
        };

        const result = validatePropertyData(invalidProperty);
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues[0].message).toContain('Price must be at least £1,000');
        }
    });

    test('should validate property title length and content', () => {
        const testCases = [
            { title: 'A', valid: false }, // Too short
            { title: 'Valid Property Title', valid: true },
            { title: 'A'.repeat(201), valid: false }, // Too long
            { title: 'House FOR SALE!!!', valid: true }, // Valid with caps/punctuation
        ];

        testCases.forEach(testCase => {
            const property = { ...validPropertyData, title: testCase.title };
            const result = validatePropertyData(property);
            expect(result.success).toBe(testCase.valid);
        });
    });

    test('should validate UK coordinates bounds', () => {
        const testCases = [
            { lat: 51.5074, lng: -0.1278, valid: true }, // London
            { lat: 55.8642, lng: -4.2518, valid: true }, // Glasgow
            { lat: 90, lng: 0, valid: false }, // Outside UK
            { lat: 0, lng: 0, valid: false }, // Outside UK
            { lat: 49.9, lng: -5.7, valid: true }, // Cornwall (edge case)
            { lat: 60.9, lng: -1.3, valid: true }, // Shetland (edge case)
        ];

        testCases.forEach(testCase => {
            const property = {
                ...validPropertyData,
                latitude: testCase.lat,
                longitude: testCase.lng
            };
            const result = validatePropertyData(property);
            expect(result.success).toBe(testCase.valid);
        });
    });

    test('should validate property images array', () => {
        const testCases = [
            { images: [], valid: true }, // Empty array allowed
            { images: ['https://example.com/image.jpg'], valid: true },
            { images: Array(21).fill('https://example.com/image.jpg'), valid: false }, // Too many
            { images: ['invalid-url'], valid: false },
            { images: ['https://example.com/image.pdf'], valid: false }, // Wrong format
        ];

        testCases.forEach(testCase => {
            const property = { ...validPropertyData, images: testCase.images };
            const result = validatePropertyData(property);
            expect(result.success).toBe(testCase.valid);
        });
    });

    test('should validate property features array', () => {
        const validFeatures = [
            'parking', 'garden', 'balcony', 'gym', 'concierge',
            'lift', 'terrace', 'fireplace', 'storage'
        ];

        const testCases = [
            { features: validFeatures, valid: true },
            { features: ['invalid_feature'], valid: false },
            { features: Array(51).fill('parking'), valid: false }, // Too many
            { features: [], valid: true }, // Empty allowed
        ];

        testCases.forEach(testCase => {
            const property = { ...validPropertyData, features: testCase.features };
            const result = validatePropertyData(property);
            expect(result.success).toBe(testCase.valid);
        });
    });
});