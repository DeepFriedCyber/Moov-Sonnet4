/**
 * Comprehensive Input Validation System Example
 * 
 * This example demonstrates how to use the Zod-based validation system
 * with Test-Driven Development (TDD) approach for property search APIs.
 */

import express from 'express';
import multer from 'multer';
import { validatePropertySearch } from '../validation/propertySearchValidation';
import { validatePropertyData } from '../validation/propertyDataValidation';
import { validateUserRegistration, validateUserLogin } from '../validation/userAuthValidation';
import { validateImageUpload, validateDocumentUpload } from '../validation/fileUploadValidation';
import { createValidationMiddleware } from '../middleware/validationMiddleware';
import { PropertySchema } from '../validation/propertyDataValidation';

const app = express();
app.use(express.json());

// Configure multer for file uploads
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
    }
});

// ===== PROPERTY SEARCH VALIDATION EXAMPLE =====

// Property search with comprehensive validation
app.get('/api/properties/search', validatePropertySearch, (req, res) => {
    // req.query is now validated and typed as PropertySearchParams
    const searchParams = req.query;

    console.log('Validated search parameters:', {
        query: searchParams.query,
        priceRange: {
            min: searchParams.price_min,
            max: searchParams.price_max
        },
        location: {
            postcode: searchParams.postcode,
            coordinates: searchParams.latitude && searchParams.longitude ? {
                lat: searchParams.latitude,
                lng: searchParams.longitude,
                radius: searchParams.radius
            } : null
        },
        filters: {
            bedrooms: searchParams.bedrooms,
            bathrooms: searchParams.bathrooms,
            propertyType: searchParams.property_type,
            features: searchParams.features
        },
        pagination: {
            page: searchParams.page,
            limit: searchParams.limit
        },
        sorting: searchParams.sort
    });

    // Simulate search results
    const mockResults = {
        properties: [
            {
                id: 1,
                title: 'Modern 2-bed flat in Central London',
                price: 450000,
                bedrooms: 2,
                bathrooms: 1,
                property_type: 'flat',
                postcode: 'SW1A 1AA'
            }
        ],
        pagination: {
            page: searchParams.page,
            limit: searchParams.limit,
            total: 1,
            pages: 1
        }
    };

    return res.json({
        success: true,
        data: mockResults,
        message: 'Search completed successfully'
    });
});

// ===== PROPERTY DATA VALIDATION EXAMPLE =====

// Create property with validation
app.post('/api/properties',
    createValidationMiddleware(PropertySchema, 'body'),
    (req, res) => {
        // req.body is now validated and typed as PropertyCreateData
        const propertyData = req.body;

        console.log('Validated property data:', {
            basic: {
                title: propertyData.title,
                description: propertyData.description,
                price: propertyData.price,
                propertyType: propertyData.property_type
            },
            details: {
                bedrooms: propertyData.bedrooms,
                bathrooms: propertyData.bathrooms,
                squareFeet: propertyData.square_feet
            },
            location: {
                postcode: propertyData.postcode,
                coordinates: {
                    lat: propertyData.latitude,
                    lng: propertyData.longitude
                }
            },
            media: {
                images: propertyData.images,
                imageCount: propertyData.images.length
            },
            features: propertyData.features,
            availability: propertyData.available,
            energyRating: propertyData.energy_rating,
            councilTaxBand: propertyData.council_tax_band
        });

        // Simulate property creation
        const newProperty = {
            id: Date.now(),
            ...propertyData,
            created_at: new Date().toISOString()
        };

        return res.status(201).json({
            success: true,
            data: newProperty,
            message: 'Property created successfully'
        });
    }
);

// ===== USER AUTHENTICATION VALIDATION EXAMPLE =====

// User registration with validation
app.post('/api/auth/register', (req, res) => {
    const validationResult = validateUserRegistration(req.body);

    if (!validationResult.success) {
        return res.status(400).json({
            success: false,
            error: 'Validation failed',
            details: validationResult.error.issues.map(issue =>
                `${issue.path.join('.')}: ${issue.message}`
            )
        });
    }

    const userData = validationResult.data;

    console.log('Validated user registration:', {
        email: userData.email,
        name: `${userData.firstName} ${userData.lastName}`,
        phone: userData.phone,
        termsAccepted: userData.termsAccepted,
        marketingOptIn: userData.marketingOptIn,
        passwordStrength: 'Strong (validated)',
        dateOfBirth: userData.dateOfBirth
    });

    // Simulate user creation
    const newUser = {
        id: Date.now(),
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        phone: userData.phone,
        created_at: new Date().toISOString()
    };

    return res.status(201).json({
        success: true,
        data: newUser,
        message: 'User registered successfully'
    });
});

// User login with validation
app.post('/api/auth/login', (req, res) => {
    const validationResult = validateUserLogin(req.body);

    if (!validationResult.success) {
        return res.status(400).json({
            success: false,
            error: 'Validation failed',
            details: validationResult.error.issues.map(issue =>
                `${issue.path.join('.')}: ${issue.message}`
            )
        });
    }

    const loginData = validationResult.data;

    console.log('Validated login attempt:', {
        email: loginData.email,
        rememberMe: loginData.rememberMe,
        timestamp: new Date().toISOString()
    });

    // Simulate successful login
    return res.json({
        success: true,
        data: {
            user: {
                id: 1,
                email: loginData.email,
                firstName: 'John',
                lastName: 'Doe'
            },
            token: 'mock-jwt-token'
        },
        message: 'Login successful'
    });
});

// ===== FILE UPLOAD VALIDATION EXAMPLE =====

// Image upload with validation
app.post('/api/upload/images',
    upload.array('images', 10),
    (req, res) => {
        const files = req.files as Express.Multer.File[];

        if (!files || files.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No files uploaded'
            });
        }

        const validationResults = files.map(file => {
            const result = validateImageUpload({
                originalname: file.originalname,
                mimetype: file.mimetype,
                size: file.size,
                buffer: file.buffer
            });

            return {
                filename: file.originalname,
                valid: result.success,
                errors: result.success ? [] : result.error.issues.map(issue => issue.message)
            };
        });

        const validFiles = validationResults.filter(result => result.valid);
        const invalidFiles = validationResults.filter(result => !result.valid);

        console.log('Image upload validation results:', {
            totalFiles: files.length,
            validFiles: validFiles.length,
            invalidFiles: invalidFiles.length,
            validFilenames: validFiles.map(f => f.filename),
            invalidFilenames: invalidFiles.map(f => ({
                filename: f.filename,
                errors: f.errors
            }))
        });

        if (invalidFiles.length > 0) {
            return res.status(400).json({
                success: false,
                error: 'Some files failed validation',
                details: {
                    validFiles: validFiles.length,
                    invalidFiles: invalidFiles.map(f => ({
                        filename: f.filename,
                        errors: f.errors
                    }))
                }
            });
        }

        // Simulate successful upload
        const uploadedFiles = validFiles.map(f => ({
            filename: f.filename,
            url: `https://example.com/uploads/${f.filename}`,
            uploadedAt: new Date().toISOString()
        }));

        return res.json({
            success: true,
            data: uploadedFiles,
            message: `${uploadedFiles.length} images uploaded successfully`
        });
    }
);

// Document upload with validation
app.post('/api/upload/documents',
    upload.single('document'),
    (req, res) => {
        const file = req.file;

        if (!file) {
            return res.status(400).json({
                success: false,
                error: 'No document uploaded'
            });
        }

        const validationResult = validateDocumentUpload({
            originalname: file.originalname,
            mimetype: file.mimetype,
            size: file.size,
            buffer: file.buffer
        });

        if (!validationResult.success) {
            return res.status(400).json({
                success: false,
                error: 'Document validation failed',
                details: validationResult.error.issues.map(issue => issue.message)
            });
        }

        console.log('Document upload validation successful:', {
            filename: file.originalname,
            mimetype: file.mimetype,
            size: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
            validatedAt: new Date().toISOString()
        });

        // Simulate successful upload
        return res.json({
            success: true,
            data: {
                filename: file.originalname,
                url: `https://example.com/documents/${file.originalname}`,
                uploadedAt: new Date().toISOString()
            },
            message: 'Document uploaded successfully'
        });
    }
);

// ===== VALIDATION TESTING ENDPOINTS =====

// Test different validation scenarios
app.post('/api/test/validation', (req, res) => {
    const { type, data } = req.body;

    let result;

    switch (type) {
        case 'property-search':
            result = { success: true, message: 'Use GET /api/properties/search with query params' };
            break;

        case 'property-data':
            result = validatePropertyData(data);
            break;

        case 'user-registration':
            result = validateUserRegistration(data);
            break;

        case 'user-login':
            result = validateUserLogin(data);
            break;

        default:
            result = { success: false, error: 'Unknown validation type' };
    }

    // Handle different error types properly
    let errors = null;
    if (!result.success) {
        if (result.error && typeof result.error === 'object' && 'issues' in result.error) {
            // ZodError with issues array
            errors = result.error.issues;
        } else {
            // String error or other error type
            errors = result.error;
        }
    }

    return res.json({
        success: result.success,
        data: result.success ? result.data : null,
        errors: errors,
        timestamp: new Date().toISOString()
    });
});

// Error handling middleware
app.use((error: unknown, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('Validation example error:', error);

    res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Something went wrong with the validation example'
    });
});

// Start the example server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`🔍 Validation example server running on port ${PORT}`);
    console.log(`\n📋 Available endpoints:`);
    console.log(`  GET  /api/properties/search?query=london&price_min=100000&price_max=500000`);
    console.log(`  POST /api/properties (with property data in body)`);
    console.log(`  POST /api/auth/register (with user registration data)`);
    console.log(`  POST /api/auth/login (with login credentials)`);
    console.log(`  POST /api/upload/images (with image files)`);
    console.log(`  POST /api/upload/documents (with document file)`);
    console.log(`  POST /api/test/validation (for testing validation scenarios)`);
    console.log(`\n🧪 Test the validation system with various inputs!`);
});

export default app;