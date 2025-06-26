// ===== TEST SUITE 1: Property Search Validation (5 tests) =====
// property-search-api/src/__tests__/validation/propertySearch.test.ts
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
    expect(response.body.params.price_min).toBe('100000');
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
    expect(response.body.details).toContain('price_max must be greater than price_min');
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
        expect.stringContaining('price_min'),
        expect.stringContaining('bedrooms')
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

    expect(response.body.params.page).toBe('1');
    expect(response.body.params.limit).toBe('20');
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
        expect(response.body.details).toContain('Invalid UK postcode format');
      }
    }
  });
});

// ===== TEST SUITE 2: Property Data Validation (6 tests) =====
// property-search-api/src/__tests__/validation/propertyData.test.ts
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
      expect(result.error.issues[0].message).toContain('minimum');
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

// ===== TEST SUITE 3: User Authentication Validation (4 tests) =====
// property-search-api/src/__tests__/validation/userAuth.test.ts
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

// ===== TEST SUITE 4: File Upload Validation (3 tests) =====
// property-search-api/src/__tests__/validation/fileUpload.test.ts
import { validateImageUpload, validateDocumentUpload } from '../../validation/fileUploadValidation';

describe('File Upload Validation', () => {
  test('should validate property image uploads', () => {
    const validImageFile = {
      originalname: 'property-photo.jpg',
      mimetype: 'image/jpeg',
      size: 2 * 1024 * 1024, // 2MB
      buffer: Buffer.from('fake-image-data')
    };

    const result = validateImageUpload(validImageFile);
    expect(result.success).toBe(true);

    // Test invalid cases
    const invalidCases = [
      { ...validImageFile, mimetype: 'text/plain' }, // Wrong type
      { ...validImageFile, size: 11 * 1024 * 1024 }, // Too large (>10MB)
      { ...validImageFile, originalname: 'file.exe' }, // Dangerous extension
    ];

    invalidCases.forEach(invalid => {
      const result = validateImageUpload(invalid);
      expect(result.success).toBe(false);
    });
  });

  test('should validate document uploads (EPC certificates, etc.)', () => {
    const validDocument = {
      originalname: 'epc-certificate.pdf',
      mimetype: 'application/pdf',
      size: 1 * 1024 * 1024, // 1MB
      buffer: Buffer.from('fake-pdf-data')
    };

    const result = validateDocumentUpload(validDocument);
    expect(result.success).toBe(true);
  });

  test('should reject potentially dangerous file uploads', () => {
    const dangerousFiles = [
      { originalname: 'script.js', mimetype: 'application/javascript' },
      { originalname: 'virus.exe', mimetype: 'application/x-msdownload' },
      { originalname: 'shell.php', mimetype: 'application/x-php' },
      { originalname: 'macro.docm', mimetype: 'application/vnd.ms-word.document.macroEnabled.12' },
    ];

    dangerousFiles.forEach(file => {
      const testFile = {
        ...file,
        size: 1024,
        buffer: Buffer.from('fake-data')
      };

      const imageResult = validateImageUpload(testFile);
      const docResult = validateDocumentUpload(testFile);

      expect(imageResult.success).toBe(false);
      expect(docResult.success).toBe(false);
    });
  });
});

// ===== IMPLEMENTATION: Property Search Validation =====
// property-search-api/src/validation/propertySearchValidation.ts
import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';
import { ValidationError } from './ValidationError';

// UK Postcode regex pattern
const UK_POSTCODE_REGEX = /^[A-Z]{1,2}[0-9][A-Z0-9]?\s?[0-9][A-Z]{2}$/i;

const PropertySearchSchema = z.object({
  query: z.string()
    .min(1, 'Search query is required')
    .max(100, 'Search query too long')
    .transform(str => str.trim())
    .refine(str => !/[<>]/.test(str), 'Invalid characters in search query'),
  
  price_min: z.coerce.number()
    .min(1000, 'Minimum price must be at least £1,000')
    .max(50000000, 'Minimum price too high')
    .optional(),
  
  price_max: z.coerce.number()
    .min(1000, 'Maximum price must be at least £1,000')
    .max(50000000, 'Maximum price cannot exceed £50M')
    .optional(),
  
  bedrooms: z.coerce.number()
    .min(0, 'Bedrooms cannot be negative')
    .max(20, 'Too many bedrooms specified')
    .optional(),
  
  bathrooms: z.coerce.number()
    .min(0, 'Bathrooms cannot be negative')
    .max(10, 'Too many bathrooms specified')
    .optional(),
  
  property_type: z.enum(['house', 'flat', 'studio', 'commercial', 'land'])
    .optional(),
  
  postcode: z.string()
    .regex(UK_POSTCODE_REGEX, 'Invalid UK postcode format')
    .transform(str => str.toUpperCase().replace(/\s+/g, ' ').trim())
    .optional(),
  
  latitude: z.coerce.number()
    .min(49.5, 'Latitude outside UK bounds')
    .max(61, 'Latitude outside UK bounds')
    .optional(),
  
  longitude: z.coerce.number()
    .min(-8, 'Longitude outside UK bounds')
    .max(2, 'Longitude outside UK bounds')
    .optional(),
  
  radius: z.coerce.number()
    .min(0.1, 'Radius too small')
    .max(50, 'Radius too large (max 50km)')
    .default(5)
    .optional(),
  
  page: z.coerce.number()
    .min(1, 'Page must be at least 1')
    .max(100, 'Page number too high')
    .default(1),
  
  limit: z.coerce.number()
    .min(1, 'Limit must be at least 1')
    .max(50, 'Limit cannot exceed 50')
    .default(20),
  
  sort: z.enum(['price_asc', 'price_desc', 'date_desc', 'relevance'])
    .default('relevance')
    .optional(),
  
  features: z.array(z.enum([
    'parking', 'garden', 'balcony', 'gym', 'concierge', 
    'lift', 'terrace', 'fireplace', 'storage', 'pet_friendly'
  ])).optional()
}).refine((data) => {
  // Custom validation: price_max must be greater than price_min
  if (data.price_min && data.price_max && data.price_min >= data.price_max) {
    return false;
  }
  return true;
}, {
  message: 'price_max must be greater than price_min',
  path: ['price_max']
});

export type PropertySearchParams = z.infer<typeof PropertySearchSchema>;

export const validatePropertySearch = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    const validatedParams = PropertySearchSchema.parse(req.query);
    req.query = validatedParams as any;
    next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      const validationError = new ValidationError(
        'Invalid search parameters',
        error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`)
      );
      res.status(400).json(validationError.toJSON());
    } else {
      next(error);
    }
  }
};

// ===== IMPLEMENTATION: Property Data Validation =====
// property-search-api/src/validation/propertyDataValidation.ts
import { z } from 'zod';

const PropertySchema = z.object({
  title: z.string()
    .min(5, 'Title must be at least 5 characters')
    .max(200, 'Title cannot exceed 200 characters')
    .refine(str => !/[<>]/.test(str), 'Invalid characters in title'),
  
  description: z.string()
    .min(10, 'Description must be at least 10 characters')
    .max(2000, 'Description cannot exceed 2000 characters')
    .refine(str => !/[<>]/.test(str), 'Invalid characters in description'),
  
  price: z.number()
    .min(1000, 'Price must be at least £1,000')
    .max(50000000, 'Price cannot exceed £50M'),
  
  bedrooms: z.number()
    .min(0, 'Bedrooms cannot be negative')
    .max(20, 'Too many bedrooms'),
  
  bathrooms: z.number()
    .min(0, 'Bathrooms cannot be negative')
    .max(10, 'Too many bathrooms'),
  
  property_type: z.enum(['house', 'flat', 'studio', 'commercial', 'land']),
  
  postcode: z.string()
    .regex(UK_POSTCODE_REGEX, 'Invalid UK postcode format')
    .transform(str => str.toUpperCase().replace(/\s+/g, ' ').trim()),
  
  latitude: z.number()
    .min(49.5, 'Latitude outside UK bounds')
    .max(61, 'Latitude outside UK bounds'),
  
  longitude: z.number()
    .min(-8, 'Longitude outside UK bounds')
    .max(2, 'Longitude outside UK bounds'),
  
  square_feet: z.number()
    .min(50, 'Property too small')
    .max(50000, 'Property too large')
    .optional(),
  
  images: z.array(z.string().url('Invalid image URL'))
    .max(20, 'Too many images (max 20)')
    .refine(
      urls => urls.every(url => /\.(jpg|jpeg|png|webp)$/i.test(url)),
      'All images must be in JPG, PNG, or WebP format'
    )
    .default([]),
  
  features: z.array(z.enum([
    'parking', 'garden', 'balcony', 'gym', 'concierge', 
    'lift', 'terrace', 'fireplace', 'storage', 'pet_friendly',
    'furnished', 'unfurnished', 'new_build', 'period_property'
  ]))
    .max(50, 'Too many features (max 50)')
    .default([]),
  
  available: z.boolean().default(true),
  
  energy_rating: z.enum(['A', 'B', 'C', 'D', 'E', 'F', 'G'])
    .optional(),
  
  council_tax_band: z.enum(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'])
    .optional(),
  
  lease_remaining: z.number()
    .min(0, 'Lease years cannot be negative')
    .max(999, 'Lease years too high')
    .optional(),
  
  service_charge: z.number()
    .min(0, 'Service charge cannot be negative')
    .max(50000, 'Service charge too high')
    .optional()
});

export type PropertyCreateData = z.infer<typeof PropertySchema>;

export const validatePropertyData = (data: unknown) => {
  return PropertySchema.safeParse(data);
};

// ===== IMPLEMENTATION: User Authentication Validation =====
// property-search-api/src/validation/userAuthValidation.ts
const UK_PHONE_REGEX = /^(\+44\s?|0)(7\d{3}\s?\d{3}\s?\d{3}|[1-9]\d{8,9})$/;

const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .max(100, 'Password too long')
  .refine(
    password => /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/.test(password),
    'Password must contain uppercase, lowercase, number, and special character'
  );

const UserRegistrationSchema = z.object({
  email: z.string()
    .email('Invalid email format')
    .max(255, 'Email too long')
    .transform(str => str.toLowerCase().trim()),
  
  password: passwordSchema,
  
  confirmPassword: z.string(),
  
  firstName: z.string()
    .min(1, 'First name is required')
    .max(50, 'First name too long')
    .refine(str => /^[a-zA-Z\s-']+$/.test(str), 'Invalid characters in first name'),
  
  lastName: z.string()
    .min(1, 'Last name is required')
    .max(50, 'Last name too long')
    .refine(str => /^[a-zA-Z\s-']+$/.test(str), 'Invalid characters in last name'),
  
  phone: z.string()
    .regex(UK_PHONE_REGEX, 'Invalid UK phone number format')
    .transform(str => str.replace(/\s/g, '')),
  
  termsAccepted: z.boolean()
    .refine(val => val === true, 'You must accept the terms and conditions'),
  
  marketingOptIn: z.boolean().default(false),
  
  dateOfBirth: z.string()
    .datetime()
    .optional()
    .refine(date => {
      if (!date) return true;
      const age = new Date().getFullYear() - new Date(date).getFullYear();
      return age >= 18;
    }, 'You must be at least 18 years old')
}).refine(data => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword']
});

const UserLoginSchema = z.object({
  email: z.string()
    .email('Invalid email format')
    .transform(str => str.toLowerCase().trim()),
  
  password: z.string()
    .min(1, 'Password is required'),
  
  rememberMe: z.boolean().default(false)
});

export type UserRegistrationData = z.infer<typeof UserRegistrationSchema>;
export type UserLoginData = z.infer<typeof UserLoginSchema>;

export const validateUserRegistration = (data: unknown) => {
  return UserRegistrationSchema.safeParse(data);
};

export const validateUserLogin = (data: unknown) => {
  return UserLoginSchema.safeParse(data);
};

// ===== IMPLEMENTATION: File Upload Validation =====
// property-search-api/src/validation/fileUploadValidation.ts
const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg', 
  'image/png',
  'image/webp'
];

const ALLOWED_DOCUMENT_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];

const DANGEROUS_EXTENSIONS = [
  '.exe', '.bat', '.cmd', '.com', '.pif', '.scr', '.vbs',
  '.js', '.jar', '.php', '.asp', '.aspx', '.jsp'
];

interface UploadedFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

const ImageUploadSchema = z.object({
  originalname: z.string()
    .refine(
      name => !DANGEROUS_EXTENSIONS.some(ext => name.toLowerCase().endsWith(ext)),
      'File type not allowed'
    )
    .refine(
      name => /\.(jpg|jpeg|png|webp)$/i.test(name),
      'Only JPG, PNG, and WebP images are allowed'
    ),
  
  mimetype: z.enum(ALLOWED_IMAGE_TYPES as [string, ...string[]], {
    errorMap: () => ({ message: 'Invalid image type' })
  }),
  
  size: z.number()
    .max(10 * 1024 * 1024, 'Image must be less than 10MB')
    .min(1024, 'Image file is too small'),
  
  buffer: z.instanceof(Buffer)
});

const DocumentUploadSchema = z.object({
  originalname: z.string()
    .refine(
      name => !DANGEROUS_EXTENSIONS.some(ext => name.toLowerCase().endsWith(ext)),
      'File type not allowed'
    )
    .refine(
      name => /\.(pdf|doc|docx)$/i.test(name),
      'Only PDF and Word documents are allowed'
    ),
  
  mimetype: z.enum(ALLOWED_DOCUMENT_TYPES as [string, ...string[]], {
    errorMap: () => ({ message: 'Invalid document type' })
  }),
  
  size: z.number()
    .max(5 * 1024 * 1024, 'Document must be less than 5MB')
    .min(1024, 'Document file is too small'),
  
  buffer: z.instanceof(Buffer)
});

export const validateImageUpload = (file: UploadedFile) => {
  return ImageUploadSchema.safeParse(file);
};

export const validateDocumentUpload = (file: UploadedFile) => {
  return DocumentUploadSchema.safeParse(file);
};

// ===== IMPLEMENTATION: Validation Error Class =====
// property-search-api/src/validation/ValidationError.ts
export class ValidationError extends Error {
  public readonly details: string[];
  public readonly statusCode: number;

  constructor(message: string, details: string[] = []) {
    super(message);
    this.name = 'ValidationError';
    this.details = details;
    this.statusCode = 400;
  }

  toJSON() {
    return {
      error: this.message,
      details: this.details,
      statusCode: this.statusCode,
      timestamp: new Date().toISOString()
    };
  }
}

// ===== IMPLEMENTATION: Validation Middleware Factory =====
// property-search-api/src/middleware/validationMiddleware.ts
import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';
import { ValidationError } from '../validation/ValidationError';

export const createValidationMiddleware = <T extends z.ZodType>(
  schema: T,
  source: 'body' | 'query' | 'params' = 'body'
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const data = req[source];
      const validatedData = schema.parse(data);
      req[source] = validatedData;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationError = new ValidationError(
          'Validation failed',
          error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`)
        );
        res.status(400).json(validationError.toJSON());
      } else {
        next(error);
      }
    }
  };
};

// ===== INTEGRATION: Apply to Routes =====
// property-search-api/src/routes/properties.ts
import { Router } from 'express';
import { validatePropertySearch } from '../validation/propertySearchValidation';
import { createValidationMiddleware } from '../middleware/validationMiddleware';
import { PropertySchema } from '../validation/propertyDataValidation';

const router = Router();

// Apply validation to property routes
router.get('/search', validatePropertySearch, async (req, res) => {
  try {
    // req.query is now validated and typed
    const results = await searchProperties(req.query);
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: 'Search failed' });
  }
});

router.post('/', 
  createValidationMiddleware(PropertySchema), 
  async (req, res) => {
    try {
      // req.body is now validated and typed
      const property = await createProperty(req.body);
      res.status(201).json(property);
    } catch (error) {
      res.status(500).json({ error: 'Failed to create property' });
    }
  }
);

export { router as propertyRoutes };

// ===== CONFIGURATION: Validation Rules =====
// property-search-api/src/config/validation.ts
export const validationConfig = {
  // Property search limits
  search: {
    maxQueryLength: 100,
    maxResults: 50,
    maxRadius: 50, // km
  },
  
  // Property data limits
  property: {
    maxImages: 20,
    maxFeatures: 50,
    maxPrice: 50000000, // £50M
    maxDescriptionLength: 2000,
  },
  
  // File upload limits
  upload: {
    maxImageSize: 10 * 1024 * 1024, // 10MB
    maxDocumentSize: 5 * 1024 * 1024, // 5MB
    allowedImageTypes: ['image/jpeg', 'image/png', 'image/webp'],
    allowedDocumentTypes: ['application/pdf'],
  },
  
  // User data limits
  user: {
    maxNameLength: 50,
    maxEmailLength: 255,
    minPasswordLength: 8,
    maxPasswordLength: 100,
  }
};
