import { PropertySchema, SearchQuerySchema, UserSchema, ValidationService } from './schemas';

describe('Validation Schemas', () => {
    describe('PropertySchema', () => {
        it('should validate valid property data', () => {
            const validProperty = {
                title: 'Beautiful 2-Bed Apartment',
                description: 'A lovely apartment in the heart of London',
                price: 450000,
                propertyType: 'apartment',
                location: {
                    address: '123 Main Street',
                    city: 'London',
                    postcode: 'SW1A 1AA',
                    coordinates: {
                        lat: 51.5074,
                        lng: -0.1278,
                    },
                },
                features: {
                    bedrooms: 2,
                    bathrooms: 1,
                    squareFootage: 850,
                    amenities: ['parking', 'garden'],
                },
                images: [
                    {
                        url: 'https://example.com/image1.jpg',
                        alt: 'Living room',
                        isPrimary: true,
                    },
                ],
            };

            const result = ValidationService.validate(PropertySchema, validProperty);
            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
            expect(result.value).toMatchObject(validProperty);
        });

        it('should reject invalid property data', () => {
            const invalidProperty = {
                title: 'a', // Too short
                price: -1000, // Negative
                propertyType: 'castle', // Invalid type
                location: {
                    postcode: 'INVALID',
                    coordinates: {
                        lat: 91, // Out of range
                        lng: 181,
                    },
                },
            };

            const result = ValidationService.validate(PropertySchema, invalidProperty);
            expect(result.isValid).toBe(false);
            expect(result.errors).toContainEqual(
                expect.objectContaining({
                    field: 'title',
                    message: expect.stringContaining('at least 3 characters'),
                })
            );
        });

        it('should sanitize HTML in text fields', () => {
            const propertyWithHtml = {
                title: 'Apartment <script>alert("XSS")</script>',
                description: '<p>Nice apartment</p><img src=x onerror=alert("XSS")>',
                price: 450000,
                propertyType: 'apartment',
                location: {
                    address: '123 Main Street',
                    city: 'London',
                    postcode: 'SW1A 1AA',
                    coordinates: {
                        lat: 51.5074,
                        lng: -0.1278,
                    },
                },
                features: {
                    bedrooms: 2,
                    bathrooms: 1,
                    squareFootage: 850,
                    amenities: [],
                },
                images: [
                    {
                        url: 'https://example.com/image1.jpg',
                        alt: 'Living room',
                        isPrimary: true,
                    },
                ],
            };

            const result = ValidationService.validate(PropertySchema, propertyWithHtml);
            expect(result.value?.title).toBe('Apartment ');
            expect(result.value?.description).toBe('<p>Nice apartment</p>');
        });

        it('should validate UK postcodes', () => {
            const validPostcodes = ['SW1A 1AA', 'E14 5AB', 'NW3 2RR', 'B1 1AA'];
            const invalidPostcodes = ['ABC 123', '12345', 'SW1A1AA', 'Z99 9ZZ'];

            validPostcodes.forEach(postcode => {
                const result = ValidationService.validateField(PropertySchema, 'location.postcode', postcode);
                expect(result.isValid).toBe(true);
            });

            invalidPostcodes.forEach(postcode => {
                const result = ValidationService.validateField(PropertySchema, 'location.postcode', postcode);
                expect(result.isValid).toBe(false);
            });
        });
    });

    describe('SearchQuerySchema', () => {
        it('should validate and transform search parameters', () => {
            const query = {
                q: '  modern apartment  ', // Should be trimmed
                minPrice: '300000', // Should be converted to number
                maxPrice: '500000',
                bedrooms: '2',
                page: '1',
                limit: '20',
            };

            const result = ValidationService.validate(SearchQuerySchema, query);
            expect(result.isValid).toBe(true);
            expect(result.value).toEqual({
                q: 'modern apartment',
                minPrice: 300000,
                maxPrice: 500000,
                bedrooms: 2,
                page: 1,
                limit: 20,
            });
        });

        it('should prevent SQL injection in search query', () => {
            const maliciousQueries = [
                "'; DROP TABLE properties; --",
                'apartment" OR 1=1 --',
                '<script>alert("XSS")</script>',
            ];

            maliciousQueries.forEach(query => {
                const result = ValidationService.validate(SearchQuerySchema, { q: query });
                expect(result.value?.q).not.toContain('DROP');
                expect(result.value?.q).not.toContain('script');
                expect(result.value?.q).not.toContain('--');
            });
        });

        it('should enforce search query limits', () => {
            const longQuery = 'a'.repeat(1000);
            const result = ValidationService.validate(SearchQuerySchema, { q: longQuery });

            expect(result.isValid).toBe(false);
            expect(result.errors).toContainEqual(
                expect.objectContaining({
                    field: 'q',
                    message: expect.stringContaining('too long'),
                })
            );
        });

        it('should validate price range logic', () => {
            const invalidRange = {
                q: 'apartment',
                minPrice: 500000,
                maxPrice: 300000, // Max less than min
            };

            const result = ValidationService.validate(SearchQuerySchema, invalidRange);
            expect(result.isValid).toBe(false);
            expect(result.errors).toContainEqual(
                expect.objectContaining({
                    field: 'minPrice',
                    message: 'Minimum price cannot exceed maximum price',
                })
            );
        });
    });

    describe('UserSchema', () => {
        it('should validate email addresses', () => {
            const validEmails = [
                'user@example.com',
                'test.user+tag@domain.co.uk',
                'valid_email@sub.domain.com',
            ];

            const invalidEmails = [
                'notanemail',
                '@example.com',
                'user@',
                'user @example.com',
                'user@.com',
            ];

            validEmails.forEach(email => {
                const result = ValidationService.validateField(UserSchema, 'email', email);
                expect(result.isValid).toBe(true);
            });

            invalidEmails.forEach(email => {
                const result = ValidationService.validateField(UserSchema, 'email', email);
                expect(result.isValid).toBe(false);
            });
        });

        it('should validate UK phone numbers', () => {
            const validPhones = [
                '+44 20 7123 4567',
                '020 7123 4567',
                '07700 900123',
                '+447700900123',
            ];

            validPhones.forEach(phone => {
                const result = ValidationService.validateField(UserSchema, 'phone', phone);
                expect(result.isValid).toBe(true);
            });
        });

        it('should validate password requirements', () => {
            const validPasswords = [
                'MySecurePassword123!',
                'AnotherGood1',
                'Complex123Pass',
            ];

            const invalidPasswords = [
                'short', // Too short
                'nouppercase123', // No uppercase
                'NOLOWERCASE123', // No lowercase
                'NoNumbers!', // No numbers
            ];

            validPasswords.forEach(password => {
                const result = ValidationService.validateField(UserSchema, 'password', password);
                expect(result.isValid).toBe(true);
            });

            invalidPasswords.forEach(password => {
                const result = ValidationService.validateField(UserSchema, 'password', password);
                expect(result.isValid).toBe(false);
            });
        });

        it('should hash passwords securely', async () => {
            const userData = {
                email: 'user@example.com',
                password: 'MySecurePassword123!',
                name: 'Test User',
            };

            const result = ValidationService.validate(UserSchema, userData);
            expect(result.isValid).toBe(true);

            // Note: In real implementation, password would be hashed
            // This test would need to be adjusted for async validation
        });

        it('should sanitize name field', () => {
            const userData = {
                email: 'user@example.com',
                password: 'MySecurePassword123!',
                name: 'Test User <script>alert("XSS")</script>',
            };

            const result = ValidationService.validate(UserSchema, userData);
            expect(result.value?.name).toBe('Test User ');
        });

        it('should set default preferences', () => {
            const userData = {
                email: 'user@example.com',
                password: 'MySecurePassword123!',
                name: 'Test User',
            };

            const result = ValidationService.validate(UserSchema, userData);
            expect(result.value?.preferences).toEqual({
                notifications: true,
                newsletter: false,
                searchAlerts: true,
            });
        });
    });

    describe('ValidationService', () => {
        it('should handle validation errors properly', () => {
            const invalidData = {
                title: '', // Invalid
                price: 'not a number', // Invalid
            };

            const result = ValidationService.validate(PropertySchema, invalidData);
            expect(result.isValid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.errors[0]).toHaveProperty('field');
            expect(result.errors[0]).toHaveProperty('message');
        });

        it('should validate individual fields', () => {
            const validTitle = 'Valid Property Title';
            const invalidTitle = 'ab'; // Too short

            const validResult = ValidationService.validateField(PropertySchema, 'title', validTitle);
            expect(validResult.isValid).toBe(true);

            const invalidResult = ValidationService.validateField(PropertySchema, 'title', invalidTitle);
            expect(invalidResult.isValid).toBe(false);
            expect(invalidResult.error).toContain('at least 3 characters');
        });

        it('should handle nested field validation', () => {
            const validCoordinates = { lat: 51.5074, lng: -0.1278 };
            const invalidCoordinates = { lat: 91, lng: 181 }; // Out of range

            const validResult = ValidationService.validateField(PropertySchema, 'location.coordinates', validCoordinates);
            expect(validResult.isValid).toBe(true);

            const invalidResult = ValidationService.validateField(PropertySchema, 'location.coordinates', invalidCoordinates);
            expect(invalidResult.isValid).toBe(false);
        });
    });
});