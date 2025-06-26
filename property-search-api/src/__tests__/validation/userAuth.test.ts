import { validateUserRegistration, validateUserLogin } from '../../validation/userAuthValidation';

describe('User Authentication Validation', () => {
    test('should validate user registration data', () => {
        const validRegistration = {
            email: 'user@example.com',
            password: 'SecurePassword123!',
            confirmPassword: 'SecurePassword123!',
            firstName: 'John',
            lastName: 'Doe',
            phone: '+44 7700 900123',
            termsAccepted: true,
            marketingOptIn: false
        };

        const result = validateUserRegistration(validRegistration);
        expect(result.success).toBe(true);
    });

    test('should reject weak passwords', () => {
        const weakPasswords = [
            'password', // Common word
            '12345678', // Only numbers
            'Password', // Missing special char
            'Pass1!', // Too short
            'PASSWORD123!', // No lowercase
        ];

        weakPasswords.forEach(password => {
            const registration = {
                email: 'user@example.com',
                password,
                confirmPassword: password,
                firstName: 'John',
                lastName: 'Doe',
                phone: '+44 7700 900123',
                termsAccepted: true
            };

            const result = validateUserRegistration(registration);
            expect(result.success).toBe(false);
        });
    });

    test('should validate UK phone number formats', () => {
        const phoneTests = [
            { phone: '+44 7700 900123', valid: true },
            { phone: '07700 900123', valid: true },
            { phone: '+447700900123', valid: true },
            { phone: '077009001234', valid: false }, // Too long
            { phone: '+1 555 123 4567', valid: false }, // US number
            { phone: 'invalid', valid: false },
        ];

        phoneTests.forEach(test => {
            const registration = {
                email: 'user@example.com',
                password: 'SecurePassword123!',
                confirmPassword: 'SecurePassword123!',
                firstName: 'John',
                lastName: 'Doe',
                phone: test.phone,
                termsAccepted: true
            };

            const result = validateUserRegistration(registration);
            expect(result.success).toBe(test.valid);
        });
    });

    test('should validate login credentials', () => {
        const validLogin = {
            email: 'user@example.com',
            password: 'SecurePassword123!',
            rememberMe: true
        };

        const result = validateUserLogin(validLogin);
        expect(result.success).toBe(true);

        // Test invalid cases
        const invalidCases = [
            { ...validLogin, email: 'invalid-email' },
            { ...validLogin, password: '' },
            { email: '', password: 'password' }
        ];

        invalidCases.forEach(invalid => {
            const result = validateUserLogin(invalid);
            expect(result.success).toBe(false);
        });
    });
});