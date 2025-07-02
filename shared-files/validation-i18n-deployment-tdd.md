# TDD Implementation for Data Validation, i18n, Analytics & Deployment

## 1. Data Validation & Sanitization

### A. Validation Schema Tests

```typescript
// property-search-api/src/validation/schemas.test.ts
import { PropertySchema, SearchQuerySchema, UserSchema } from './schemas';
import { ValidationError } from './ValidationError';

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

      const result = PropertySchema.validate(validProperty);
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

      const result = PropertySchema.validate(invalidProperty);
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
        // ... other required fields
      };

      const result = PropertySchema.validate(propertyWithHtml);
      expect(result.value.title).toBe('Apartment');
      expect(result.value.description).toBe('<p>Nice apartment</p>');
    });

    it('should validate UK postcodes', () => {
      const validPostcodes = ['SW1A 1AA', 'E14 5AB', 'NW3 2RR', 'B1 1AA'];
      const invalidPostcodes = ['ABC 123', '12345', 'SW1A1AA', 'Z99 9ZZ'];

      validPostcodes.forEach(postcode => {
        const result = PropertySchema.validateField('location.postcode', postcode);
        expect(result.isValid).toBe(true);
      });

      invalidPostcodes.forEach(postcode => {
        const result = PropertySchema.validateField('location.postcode', postcode);
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

      const result = SearchQuerySchema.validate(query);
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
        const result = SearchQuerySchema.validate({ q: query });
        expect(result.value.q).not.toContain('DROP');
        expect(result.value.q).not.toContain('script');
        expect(result.value.q).not.toContain('--');
      });
    });

    it('should enforce search query limits', () => {
      const longQuery = 'a'.repeat(1000);
      const result = SearchQuerySchema.validate({ q: longQuery });
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'q',
          message: expect.stringContaining('maximum'),
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
        const result = UserSchema.validateField('email', email);
        expect(result.isValid).toBe(true);
      });

      invalidEmails.forEach(email => {
        const result = UserSchema.validateField('email', email);
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
        const result = UserSchema.validateField('phone', phone);
        expect(result.isValid).toBe(true);
      });
    });

    it('should hash passwords securely', async () => {
      const userData = {
        email: 'user@example.com',
        password: 'MySecurePassword123!',
        name: 'Test User',
      };

      const result = await UserSchema.validate(userData);
      expect(result.value.password).not.toBe(userData.password);
      expect(result.value.password).toMatch(/^\$2[aby]\$\d{2}\$/); // bcrypt format
    });
  });
});
```

### B. Validation Schema Implementation

```typescript
// property-search-api/src/validation/schemas.ts
import { z } from 'zod';
import DOMPurify from 'isomorphic-dompurify';
import bcrypt from 'bcrypt';

// Custom validators
const ukPostcodeRegex = /^[A-Z]{1,2}[0-9][A-Z0-9]? ?[0-9][A-Z]{2}$/i;
const ukPhoneRegex = /^(?:(?:\+44\s?|0)(?:7\d{3}|\d{2})\s?\d{3}\s?\d{4})$/;

// Sanitization functions
const sanitizeHtml = (value: string) => {
  return DOMPurify.sanitize(value, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'ul', 'ol', 'li'],
    ALLOWED_ATTR: [],
  });
};

const sanitizeSearchQuery = (value: string) => {
  // Remove SQL injection attempts
  return value
    .replace(/['";\\]/g, '')
    .replace(/--/g, '')
    .replace(/\/\*/g, '')
    .replace(/\*\//g, '')
    .replace(/\b(DROP|DELETE|INSERT|UPDATE|UNION|SELECT)\b/gi, '')
    .trim();
};

// Base schemas
export const CoordinatesSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const LocationSchema = z.object({
  address: z.string().min(1).max(200),
  city: z.string().min(1).max(100),
  postcode: z.string().regex(ukPostcodeRegex, 'Invalid UK postcode format'),
  area: z.string().max(100).optional(),
  coordinates: CoordinatesSchema,
});

export const PropertyFeaturesSchema = z.object({
  bedrooms: z.number().int().min(0).max(20),
  bathrooms: z.number().int().min(0).max(10),
  squareFootage: z.number().int().min(0).max(50000),
  amenities: z.array(z.string()).max(20).default([]),
});

export const ImageSchema = z.object({
  url: z.string().url(),
  alt: z.string().max(200),
  isPrimary: z.boolean().default(false),
});

// Main schemas
export const PropertySchema = z.object({
  title: z.string()
    .min(3, 'Title must be at least 3 characters')
    .max(200)
    .transform(sanitizeHtml),
  description: z.string()
    .min(10, 'Description must be at least 10 characters')
    .max(5000)
    .transform(sanitizeHtml),
  price: z.number()
    .int()
    .min(0, 'Price cannot be negative')
    .max(100000000, 'Price exceeds maximum'),
  propertyType: z.enum(['house', 'apartment', 'studio', 'townhouse', 'cottage']),
  location: LocationSchema,
  features: PropertyFeaturesSchema,
  images: z.array(ImageSchema).min(1).max(20),
  agent: z.object({
    name: z.string().max(100),
    email: z.string().email(),
    phone: z.string().regex(ukPhoneRegex, 'Invalid UK phone number'),
  }).optional(),
});

export const SearchQuerySchema = z.object({
  q: z.string()
    .min(1, 'Search query is required')
    .max(500, 'Search query too long')
    .transform(sanitizeSearchQuery),
  minPrice: z.coerce.number().int().min(0).optional(),
  maxPrice: z.coerce.number().int().min(0).optional(),
  bedrooms: z.coerce.number().int().min(0).max(20).optional(),
  bathrooms: z.coerce.number().int().min(0).max(10).optional(),
  propertyType: z.enum(['house', 'apartment', 'studio', 'townhouse', 'cottage']).optional(),
  radius: z.coerce.number().min(0).max(50).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
}).refine(data => {
  if (data.minPrice && data.maxPrice) {
    return data.minPrice <= data.maxPrice;
  }
  return true;
}, {
  message: 'Minimum price cannot exceed maximum price',
  path: ['minPrice'],
});

export const UserSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .transform(async (password) => {
      return await bcrypt.hash(password, 10);
    }),
  name: z.string().min(1).max(100).transform(sanitizeHtml),
  phone: z.string().regex(ukPhoneRegex).optional(),
  preferences: z.object({
    notifications: z.boolean().default(true),
    newsletter: z.boolean().default(false),
    searchAlerts: z.boolean().default(true),
  }).optional(),
});

// Validation wrapper
export class ValidationService {
  static validate<T>(schema: z.ZodSchema<T>, data: unknown): {
    isValid: boolean;
    value?: T;
    errors: Array<{ field: string; message: string }>;
  } {
    try {
      const value = schema.parse(data);
      return {
        isValid: true,
        value,
        errors: [],
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          isValid: false,
          errors: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
          })),
        };
      }
      throw error;
    }
  }

  static validateField<T>(
    schema: z.ZodSchema<T>,
    field: string,
    value: unknown
  ): { isValid: boolean; error?: string } {
    const fieldPath = field.split('.');
    let fieldSchema = schema;

    // Navigate to the specific field schema
    for (const path of fieldPath) {
      if (fieldSchema instanceof z.ZodObject) {
        fieldSchema = fieldSchema.shape[path];
      }
    }

    try {
      fieldSchema.parse(value);
      return { isValid: true };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          isValid: false,
          error: error.errors[0]?.message,
        };
      }
      throw error;
    }
  }
}

// Express middleware
import { Request, Response, NextFunction } from 'express';

export function validateRequest(schema: z.ZodSchema) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const result = ValidationService.validate(schema, {
      ...req.body,
      ...req.query,
      ...req.params,
    });

    if (!result.isValid) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request data',
          details: result.errors,
        },
      });
    }

    // Attach validated data to request
    req.validated = result.value;
    next();
  };
}
```

## 2. Error Boundary Implementation

### A. Error Boundary Tests

```typescript
// property-search-frontend/src/components/ErrorBoundary/ErrorBoundary.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ErrorBoundary } from './ErrorBoundary';
import { ErrorFallback } from './ErrorFallback';

// Component that throws an error
const ThrowError = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) {
    throw new Error('Test error');
  }
  return <div>No error</div>;
};

describe('ErrorBoundary', () => {
  // Suppress console.error for these tests
  const originalError = console.error;
  beforeAll(() => {
    console.error = jest.fn();
  });
  afterAll(() => {
    console.error = originalError;
  });

  it('should render children when there is no error', () => {
    render(
      <ErrorBoundary>
        <div>Test content</div>
      </ErrorBoundary>
    );

    expect(screen.getByText('Test content')).toBeInTheDocument();
  });

  it('should catch errors and display fallback', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    expect(screen.queryByText('No error')).not.toBeInTheDocument();
  });

  it('should allow error recovery', async () => {
    const user = userEvent.setup();
    let shouldThrow = true;

    const { rerender } = render(
      <ErrorBoundary>
        <ThrowError shouldThrow={shouldThrow} />
      </ErrorBoundary>
    );

    // Error is shown
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();

    // Click retry
    await user.click(screen.getByRole('button', { name: /try again/i }));

    // Update component to not throw
    shouldThrow = false;
    rerender(
      <ErrorBoundary>
        <ThrowError shouldThrow={shouldThrow} />
      </ErrorBoundary>
    );

    // Should recover
    expect(screen.getByText('No error')).toBeInTheDocument();
  });

  it('should log errors to error service', () => {
    const mockLogError = jest.fn();
    
    render(
      <ErrorBoundary onError={mockLogError}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(mockLogError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Test error',
      }),
      expect.objectContaining({
        componentStack: expect.any(String),
      })
    );
  });

  it('should show technical details in development', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText(/Error: Test error/)).toBeInTheDocument();
    expect(screen.getByText(/Component Stack:/)).toBeInTheDocument();

    process.env.NODE_ENV = originalEnv;
  });

  it('should handle async errors', async () => {
    const AsyncError = () => {
      React.useEffect(() => {
        setTimeout(() => {
          throw new Error('Async error');
        }, 0);
      }, []);
      return <div>Loading...</div>;
    };

    render(
      <ErrorBoundary>
        <AsyncError />
      </ErrorBoundary>
    );

    // Initially shows loading
    expect(screen.getByText('Loading...')).toBeInTheDocument();

    // Wait for async error
    await screen.findByText(/something went wrong/i);
  });
});
```

### B. Error Boundary Implementation

```typescript
// property-search-frontend/src/components/ErrorBoundary/ErrorBoundary.tsx
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { ErrorFallback } from './ErrorFallback';
import { errorReportingService } from '@/services/errorReporting';

interface Props {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  isolate?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    const errorId = `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    return {
      hasError: true,
      error,
      errorId,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const { onError } = this.props;
    const { errorId } = this.state;

    // Log to error reporting service
    errorReportingService.logError(error, {
      errorId,
      componentStack: errorInfo.componentStack,
      props: this.props,
    });

    // Call custom error handler
    if (onError) {
      onError(error, errorInfo);
    }

    // Update state with error info
    this.setState({
      errorInfo,
    });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
    });
  };

  render() {
    const { hasError, error, errorInfo, errorId } = this.state;
    const { children, fallback, isolate } = this.props;

    if (hasError && error) {
      if (fallback) {
        return fallback(error, this.handleReset);
      }

      return (
        <ErrorFallback
          error={error}
          errorInfo={errorInfo}
          errorId={errorId}
          onReset={this.handleReset}
          isolate={isolate}
        />
      );
    }

    return children;
  }
}

// Hook for error handling
export function useErrorHandler() {
  return (error: Error) => {
    throw error; // Will be caught by nearest ErrorBoundary
  };
}

// Async error boundary
export function AsyncErrorBoundary({ children }: { children: ReactNode }) {
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      setError(new Error(event.reason));
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    
    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  if (error) {
    throw error;
  }

  return <>{children}</>;
}

// Error fallback component
// property-search-frontend/src/components/ErrorBoundary/ErrorFallback.tsx
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface ErrorFallbackProps {
  error: Error;
  errorInfo: ErrorInfo | null;
  errorId: string | null;
  onReset: () => void;
  isolate?: boolean;
}

export function ErrorFallback({
  error,
  errorInfo,
  errorId,
  onReset,
  isolate = false,
}: ErrorFallbackProps) {
  const router = useRouter();
  const isDevelopment = process.env.NODE_ENV === 'development';

  const handleGoHome = () => {
    router.push('/');
  };

  return (
    <div className={`
      ${isolate ? '' : 'min-h-screen'} 
      flex items-center justify-center p-4
    `}>
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
        <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full">
          <AlertTriangle className="w-6 h-6 text-red-600" />
        </div>
        
        <h1 className="mt-4 text-xl font-semibold text-center text-gray-900">
          Oops! Something went wrong
        </h1>
        
        <p className="mt-2 text-sm text-center text-gray-600">
          We're sorry for the inconvenience. Please try again or contact support if the problem persists.
        </p>

        {errorId && (
          <p className="mt-2 text-xs text-center text-gray-500">
            Error ID: {errorId}
          </p>
        )}

        {isDevelopment && (
          <details className="mt-4 p-4 bg-gray-100 rounded text-xs">
            <summary className="cursor-pointer font-medium">
              Technical Details
            </summary>
            <pre className="mt-2 whitespace-pre-wrap break-words">
              {error.toString()}
              {error.stack && (
                <>
                  {'\n\nStack Trace:\n'}
                  {error.stack}
                </>
              )}
              {errorInfo && (
                <>
                  {'\n\nComponent Stack:'}
                  {errorInfo.componentStack}
                </>
              )}
            </pre>
          </details>
        )}

        <div className="mt-6 flex gap-3">
          <button
            onClick={onReset}
            className="flex-1 inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </button>
          
          {!isolate && (
            <button
              onClick={handleGoHome}
              className="flex-1 inline-flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <Home className="w-4 h-4 mr-2" />
              Go Home
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Error reporting service
// property-search-frontend/src/services/errorReporting.ts
interface ErrorContext {
  errorId?: string;
  componentStack?: string;
  props?: any;
  userAgent?: string;
  url?: string;
  userId?: string;
}

class ErrorReportingService {
  private queue: Array<{ error: Error; context: ErrorContext }> = [];
  private isOnline = true;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.isOnline = true;
        this.flushQueue();
      });
      
      window.addEventListener('offline', () => {
        this.isOnline = false;
      });
    }
  }

  logError(error: Error, context: ErrorContext = {}) {
    const errorReport = {
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name,
      },
      context: {
        ...context,
        timestamp: new Date().toISOString(),
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
        url: typeof window !== 'undefined' ? window.location.href : undefined,
        userId: this.getUserId(),
      },
    };

    if (this.isOnline) {
      this.sendToServer(errorReport);
    } else {
      this.queue.push({ error, context });
    }

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Error logged:', errorReport);
    }
  }

  private async sendToServer(errorReport: any) {
    try {
      await fetch('/api/errors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(errorReport),
      });
    } catch (err) {
      console.error('Failed to send error report:', err);
    }
  }

  private flushQueue() {
    while (this.queue.length > 0) {
      const { error, context } = this.queue.shift()!;
      this.logError(error, context);
    }
  }

  private getUserId(): string | undefined {
    // Get user ID from your auth system
    return typeof window !== 'undefined' 
      ? localStorage.getItem('userId') || undefined
      : undefined;
  }
}

export const errorReportingService = new ErrorReportingService();
```

## 3. Internationalization (i18n) Support

### A. i18n Tests

```typescript
// property-search-frontend/src/i18n/i18n.test.ts
import { I18nService } from './I18nService';
import { render, screen } from '@testing-library/react';
import { I18nProvider, useTranslation } from './hooks';

describe('I18nService', () => {
  let i18n: I18nService;

  beforeEach(() => {
    i18n = new I18nService({
      defaultLocale: 'en-GB',
      supportedLocales: ['en-GB', 'en-US', 'es', 'fr'],
    });
  });

  describe('Translation loading', () => {
    it('should load translations for locale', async () => {
      await i18n.loadTranslations('en-GB');
      
      const translation = i18n.t('property.bedrooms', { count: 2 });
      expect(translation).toBe('2 bedrooms');
    });

    it('should handle pluralization', () => {
      i18n.addTranslations('en-GB', {
        'property.bedrooms_one': '{{count}} bedroom',
        'property.bedrooms_other': '{{count}} bedrooms',
      });

      expect(i18n.t('property.bedrooms', { count: 1 })).toBe('1 bedroom');
      expect(i18n.t('property.bedrooms', { count: 3 })).toBe('3 bedrooms');
    });

    it('should fall back to default locale', async () => {
      await i18n.setLocale('fr');
      
      // If French translation missing, fall back to English
      const translation = i18n.t('missing.key', {}, 'Default text');
      expect(translation).toBe('Default text');
    });
  });

  describe('Number formatting', () => {
    it('should format prices for UK locale', () => {
      i18n.setLocale('en-GB');
      
      expect(i18n.formatNumber(450000, 'currency')).toBe('£450,000');
      expect(i18n.formatNumber(1234.56, 'decimal')).toBe('1,234.56');
    });

    it('should format prices for US locale', () => {
      i18n.setLocale('en-US');
      
      expect(i18n.formatNumber(450000, 'currency')).toBe('$450,000.00');
    });

    it('should format prices for Spanish locale', () => {
      i18n.setLocale('es');
      
      expect(i18n.formatNumber(450000, 'currency')).toBe('450.000 €');
    });
  });

  describe('Date formatting', () => {
    it('should format dates for different locales', () => {
      const date = new Date('2024-03-15T10:00:00Z');

      i18n.setLocale('en-GB');
      expect(i18n.formatDate(date, 'short')).toBe('15/03/2024');
      expect(i18n.formatDate(date, 'long')).toBe('15 March 2024');

      i18n.setLocale('en-US');
      expect(i18n.formatDate(date, 'short')).toBe('3/15/2024');
      expect(i18n.formatDate(date, 'long')).toBe('March 15, 2024');
    });

    it('should format relative time', () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      i18n.setLocale('en-GB');
      expect(i18n.formatRelativeTime(yesterday)).toBe('1 day ago');
      expect(i18n.formatRelativeTime(lastWeek)).toBe('1 week ago');
    });
  });

  describe('React integration', () => {
    const TestComponent = () => {
      const { t, formatNumber } = useTranslation();
      
      return (
        <div>
          <h1>{t('property.title')}</h1>
          <p>{formatNumber(450000, 'currency')}</p>
        </div>
      );
    };

    it('should provide translations via React context', () => {
      render(
        <I18nProvider locale="en-GB">
          <TestComponent />
        </I18nProvider>
      );

      expect(screen.getByText('Property Details')).toBeInTheDocument();
      expect(screen.getByText('£450,000')).toBeInTheDocument();
    });

    it('should update when locale changes', () => {
      const { rerender } = render(
        <I18nProvider locale="en-GB">
          <TestComponent />
        </I18nProvider>
      );

      expect(screen.getByText('£450,000')).toBeInTheDocument();

      rerender(
        <I18nProvider locale="en-US">
          <TestComponent />
        </I18nProvider>
      );

      expect(screen.getByText('$450,000.00')).toBeInTheDocument();
    });
  });
});
```

### B. i18n Implementation

```typescript
// property-search-frontend/src/i18n/I18nService.ts
import { EventEmitter } from 'events';

interface TranslationData {
  [key: string]: string | TranslationData;
}

interface I18nConfig {
  defaultLocale: string;
  supportedLocales: string[];
  fallbackLocale?: string;
}

export class I18nService extends EventEmitter {
  private currentLocale: string;
  private translations: Map<string, TranslationData> = new Map();
  private config: I18nConfig;
  private numberFormatters: Map<string, Intl.NumberFormat> = new Map();
  private dateFormatters: Map<string, Intl.DateTimeFormat> = new Map();
  private relativeTimeFormatter?: Intl.RelativeTimeFormat;

  constructor(config: I18nConfig) {
    super();
    this.config = config;
    this.currentLocale = config.defaultLocale;
    this.initializeFormatters();
  }

  async loadTranslations(locale: string): Promise<void> {
    if (this.translations.has(locale)) {
      return;
    }

    try {
      const response = await fetch(`/locales/${locale}.json`);
      const data = await response.json();
      this.translations.set(locale, data);
    } catch (error) {
      console.error(`Failed to load translations for ${locale}:`, error);
      
      // Fall back to default locale
      if (locale !== this.config.defaultLocale && !this.translations.has(this.config.defaultLocale)) {
        await this.loadTranslations(this.config.defaultLocale);
      }
    }
  }

  async setLocale(locale: string): Promise<void> {
    if (!this.config.supportedLocales.includes(locale)) {
      console.warn(`Locale ${locale} not supported, falling back to ${this.config.defaultLocale}`);
      locale = this.config.defaultLocale;
    }

    await this.loadTranslations(locale);
    this.currentLocale = locale;
    this.initializeFormatters();
    this.emit('localeChanged', locale);
  }

  t(key: string, params?: Record<string, any>, defaultValue?: string): string {
    const translation = this.getTranslation(key, this.currentLocale);
    
    if (!translation) {
      // Try fallback locale
      const fallbackTranslation = this.getTranslation(
        key,
        this.config.fallbackLocale || this.config.defaultLocale
      );
      
      if (!fallbackTranslation) {
        console.warn(`Translation missing for key: ${key}`);
        return defaultValue || key;
      }
      
      return this.interpolate(fallbackTranslation, params);
    }

    // Handle pluralization
    if (params?.count !== undefined && typeof translation === 'object') {
      const pluralKey = this.getPluralKey(params.count);
      const pluralTranslation = translation[pluralKey] || translation.other || translation.one;
      
      if (typeof pluralTranslation === 'string') {
        return this.interpolate(pluralTranslation, params);
      }
    }

    if (typeof translation === 'string') {
      return this.interpolate(translation, params);
    }

    return defaultValue || key;
  }

  private getTranslation(key: string, locale: string): string | TranslationData | undefined {
    const translations = this.translations.get(locale);
    if (!translations) return undefined;

    const keys = key.split('.');
    let current: any = translations;

    for (const k of keys) {
      if (current && typeof current === 'object' && k in current) {
        current = current[k];
      } else {
        return undefined;
      }
    }

    return current;
  }

  private interpolate(template: string, params?: Record<string, any>): string {
    if (!params) return template;

    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return params[key]?.toString() || match;
    });
  }

  private getPluralKey(count: number): string {
    // Simple English pluralization rules
    // For other languages, use Intl.PluralRules
    const pr = new Intl.PluralRules(this.currentLocale);
    const rule = pr.select(count);
    
    // Map plural rules to translation keys
    const ruleMap: Record<string, string> = {
      zero: 'zero',
      one: 'one',
      two: 'two',
      few: 'few',
      many: 'many',
      other: 'other',
    };

    return ruleMap[rule] || 'other';
  }

  formatNumber(
    value: number,
    style: 'decimal' | 'currency' | 'percent' = 'decimal',
    options?: Intl.NumberFormatOptions
  ): string {
    const key = `${this.currentLocale}-${style}`;
    
    if (!this.numberFormatters.has(key)) {
      const formatOptions: Intl.NumberFormatOptions = {
        style,
        ...options,
      };

      if (style === 'currency') {
        formatOptions.currency = this.getCurrencyForLocale(this.currentLocale);
        formatOptions.minimumFractionDigits = 0;
        formatOptions.maximumFractionDigits = 0;
      }

      this.numberFormatters.set(
        key,
        new Intl.NumberFormat(this.currentLocale, formatOptions)
      );
    }

    return this.numberFormatters.get(key)!.format(value);
  }

  formatDate(
    date: Date,
    style: 'short' | 'medium' | 'long' | 'full' = 'medium',
    options?: Intl.DateTimeFormatOptions
  ): string {
    const key = `${this.currentLocale}-${style}`;
    
    if (!this.dateFormatters.has(key)) {
      const styleOptions: Record<string, Intl.DateTimeFormatOptions> = {
        short: { dateStyle: 'short' },
        medium: { dateStyle: 'medium' },
        long: { dateStyle: 'long' },
        full: { dateStyle: 'full' },
      };

      this.dateFormatters.set(
        key,
        new Intl.DateTimeFormat(this.currentLocale, {
          ...styleOptions[style],
          ...options,
        })
      );
    }

    return this.dateFormatters.get(key)!.format(date);
  }

  formatRelativeTime(date: Date): string {
    if (!this.relativeTimeFormatter) {
      this.relativeTimeFormatter = new Intl.RelativeTimeFormat(this.currentLocale, {
        numeric: 'auto',
      });
    }

    const now = new Date();
    const diffInSeconds = Math.floor((date.getTime() - now.getTime()) / 1000);
    const absSeconds = Math.abs(diffInSeconds);

    const units: Array<[string, number]> = [
      ['year', 365 * 24 * 60 * 60],
      ['month', 30 * 24 * 60 * 60],
      ['week', 7 * 24 * 60 * 60],
      ['day', 24 * 60 * 60],
      ['hour', 60 * 60],
      ['minute', 60],
      ['second', 1],
    ];

    for (const [unit, secondsInUnit] of units) {
      if (absSeconds >= secondsInUnit) {
        const value = Math.floor(diffInSeconds / secondsInUnit);
        return this.relativeTimeFormatter.format(value, unit as Intl.RelativeTimeFormatUnit);
      }
    }

    return this.relativeTimeFormatter.format(0, 'second');
  }

  private getCurrencyForLocale(locale: string): string {
    const currencyMap: Record<string, string> = {
      'en-GB': 'GBP',
      'en-US': 'USD',
      'es': 'EUR',
      'fr': 'EUR',
    };

    return currencyMap[locale] || 'GBP';
  }

  private initializeFormatters(): void {
    this.numberFormatters.clear();
    this.dateFormatters.clear();
    this.relativeTimeFormatter = undefined;
  }

  getLocale(): string {
    return this.currentLocale;
  }

  getSupportedLocales(): string[] {
    return this.config.supportedLocales;
  }

  // For testing
  addTranslations(locale: string, translations: TranslationData): void {
    const existing = this.translations.get(locale) || {};
    this.translations.set(locale, { ...existing, ...translations });
  }
}

// React integration
import React, { createContext, useContext, useState, useEffect } from 'react';

const I18nContext = createContext<I18nService | null>(null);

export function I18nProvider({
  children,
  locale,
}: {
  children: React.ReactNode;
  locale: string;
}) {
  const [i18n] = useState(() => new I18nService({
    defaultLocale: 'en-GB',
    supportedLocales: ['en-GB', 'en-US', 'es', 'fr'],
  }));

  useEffect(() => {
    i18n.setLocale(locale);
  }, [locale, i18n]);

  return (
    <I18nContext.Provider value={i18n}>
      {children}
    </I18nContext.Provider>
  );
}

export function useTranslation() {
  const i18n = useContext(I18nContext);
  
  if (!i18n) {
    throw new Error('useTranslation must be used within I18nProvider');
  }

  const [, forceUpdate] = useState({});

  useEffect(() => {
    const handleLocaleChange = () => forceUpdate({});
    i18n.on('localeChanged', handleLocaleChange);
    
    return () => {
      i18n.off('localeChanged', handleLocaleChange);
    };
  }, [i18n]);

  return {
    t: i18n.t.bind(i18n),
    formatNumber: i18n.formatNumber.bind(i18n),
    formatDate: i18n.formatDate.bind(i18n),
    formatRelativeTime: i18n.formatRelativeTime.bind(i18n),
    locale: i18n.getLocale(),
  };
}
```

## 4. Infrastructure as Code (Terraform)

### A. Terraform Configuration Tests

```hcl
# infrastructure/test/main.tf
terraform {
  required_providers {
    testing = {
      source = "terraform.io/builtin/testing"
    }
  }
}

# Test VPC configuration
run "vpc_configuration" {
  command = plan

  assert {
    condition     = aws_vpc.main.cidr_block == "10.0.0.0/16"
    error_message = "VPC CIDR block should be 10.0.0.0/16"
  }

  assert {
    condition     = aws_vpc.main.enable_dns_hostnames == true
    error_message = "VPC should have DNS hostnames enabled"
  }
}

# Test subnet configuration
run "subnet_availability" {
  command = plan

  assert {
    condition     = length(aws_subnet.public) >= 2
    error_message = "Should have at least 2 public subnets for HA"
  }

  assert {
    condition     = length(aws_subnet.private) >= 2
    error_message = "Should have at least 2 private subnets for HA"
  }
}

# Test RDS configuration
run "rds_high_availability" {
  command = plan

  assert {
    condition     = aws_db_instance.postgres.multi_az == true
    error_message = "RDS should be configured for Multi-AZ"
  }

  assert {
    condition     = aws_db_instance.postgres.backup_retention_period >= 7
    error_message = "RDS backup retention should be at least 7 days"
  }
}

# Test Auto Scaling configuration
run "auto_scaling_limits" {
  command = plan

  assert {
    condition     = aws_autoscaling_group.app.min_size >= 2
    error_message = "ASG minimum size should be at least 2 for HA"
  }

  assert {
    condition     = aws_autoscaling_group.app.max_size <= 10
    error_message = "ASG maximum size should not exceed 10 to control costs"
  }
}

# Test security groups
run "security_group_rules" {
  command = plan

  assert {
    condition     = aws_security_group_rule.app_ingress_https.from_port == 443
    error_message = "App should accept HTTPS traffic on port 443"
  }

  assert {
    condition     = aws_security_group_rule.rds_ingress.from_port == 5432
    error_message = "RDS should accept PostgreSQL traffic on port 5432"
  }
}
```

### B. Main Terraform Configuration

```hcl
# infrastructure/main.tf
terraform {
  required_version = ">= 1.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    bucket = "moov-property-terraform-state"
    key    = "prod/terraform.tfstate"
    region = "eu-west-2"
    
    dynamodb_table = "moov-property-terraform-locks"
    encrypt        = true
  }
}

provider "aws" {
  region = var.aws_region
  
  default_tags {
    tags = {
      Project     = "moov-property"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

# VPC Configuration
resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name = "${var.project_name}-vpc-${var.environment}"
  }
}

# Public Subnets
resource "aws_subnet" "public" {
  count = length(var.availability_zones)

  vpc_id                  = aws_vpc.main.id
  cidr_block              = cidrsubnet(var.vpc_cidr, 8, count.index)
  availability_zone       = var.availability_zones[count.index]
  map_public_ip_on_launch = true

  tags = {
    Name = "${var.project_name}-public-${var.availability_zones[count.index]}"
    Type = "public"
  }
}

# Private Subnets
resource "aws_subnet" "private" {
  count = length(var.availability_zones)

  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(var.vpc_cidr, 8, count.index + 100)
  availability_zone = var.availability_zones[count.index]

  tags = {
    Name = "${var.project_name}-private-${var.availability_zones[count.index]}"
    Type = "private"
  }
}

# Internet Gateway
resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name = "${var.project_name}-igw"
  }
}

# NAT Gateways
resource "aws_eip" "nat" {
  count = var.enable_nat_gateway ? length(var.availability_zones) : 0

  domain = "vpc"

  tags = {
    Name = "${var.project_name}-nat-eip-${count.index}"
  }
}

resource "aws_nat_gateway" "main" {
  count = var.enable_nat_gateway ? length(var.availability_zones) : 0

  allocation_id = aws_eip.nat[count.index].id
  subnet_id     = aws_subnet.public[count.index].id

  tags = {
    Name = "${var.project_name}-nat-${count.index}"
  }
}

# RDS PostgreSQL with pgvector
resource "aws_db_subnet_group" "postgres" {
  name       = "${var.project_name}-db-subnet-group"
  subnet_ids = aws_subnet.private[*].id

  tags = {
    Name = "${var.project_name}-db-subnet-group"
  }
}

resource "aws_db_parameter_group" "postgres" {
  name   = "${var.project_name}-postgres-params"
  family = "postgres15"

  parameter {
    name  = "shared_preload_libraries"
    value = "vector"
  }
}

resource "aws_db_instance" "postgres" {
  identifier     = "${var.project_name}-postgres"
  engine         = "postgres"
  engine_version = "15.4"
  instance_class = var.db_instance_type

  allocated_storage       = var.db_allocated_storage
  max_allocated_storage   = var.db_max_allocated_storage
  storage_encrypted       = true
  storage_type            = "gp3"

  db_name  = "moov_property"
  username = var.db_username
  password = var.db_password

  vpc_security_group_ids = [aws_security_group.rds.id]
  db_subnet_group_name   = aws_db_subnet_group.postgres.name
  parameter_group_name   = aws_db_parameter_group.postgres.name

  backup_retention_period = var.db_backup_retention_period
  backup_window          = "03:00-04:00"
  maintenance_window     = "sun:04:00-sun:05:00"

  multi_az               = var.environment == "production"
  deletion_protection    = var.environment == "production"
  skip_final_snapshot    = var.environment != "production"

  enabled_cloudwatch_logs_exports = ["postgresql"]

  tags = {
    Name = "${var.project_name}-postgres"
  }
}

# ElastiCache Redis
resource "aws_elasticache_subnet_group" "redis" {
  name       = "${var.project_name}-redis-subnet-group"
  subnet_ids = aws_subnet.private[*].id
}

resource "aws_elasticache_replication_group" "redis" {
  replication_group_id = "${var.project_name}-redis"
  description          = "Redis cluster for ${var.project_name}"
  
  engine               = "redis"
  node_type            = var.redis_node_type
  parameter_group_name = "default.redis7"
  port                 = 6379

  subnet_group_name          = aws_elasticache_subnet_group.redis.name
  security_group_ids         = [aws_security_group.redis.id]

  num_cache_clusters         = var.redis_num_cache_nodes
  automatic_failover_enabled = var.redis_num_cache_nodes > 1

  at_rest_encryption_enabled = true
  transit_encryption_enabled = true

  snapshot_retention_limit = var.environment == "production" ? 5 : 1
  snapshot_window         = "03:00-05:00"

  tags = {
    Name = "${var.project_name}-redis"
  }
}

# ECS Cluster
resource "aws_ecs_cluster" "main" {
  name = "${var.project_name}-cluster"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = {
    Name = "${var.project_name}-cluster"
  }
}

# Application Load Balancer
resource "aws_lb" "main" {
  name               = "${var.project_name}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = aws_subnet.public[*].id

  enable_deletion_protection = var.environment == "production"
  enable_http2              = true

  tags = {
    Name = "${var.project_name}-alb"
  }
}

# ECS Task Definitions
resource "aws_ecs_task_definition" "api" {
  family                   = "${var.project_name}-api"
  requires_compatibilities = ["FARGATE"]
  network_mode            = "awsvpc"
  cpu                     = var.api_cpu
  memory                  = var.api_memory
  execution_role_arn      = aws_iam_role.ecs_execution.arn
  task_role_arn           = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([
    {
      name  = "api"
      image = "${aws_ecr_repository.api.repository_url}:${var.api_image_tag}"
      
      portMappings = [
        {
          containerPort = 3001
          protocol      = "tcp"
        }
      ]

      environment = [
        {
          name  = "NODE_ENV"
          value = var.environment
        },
        {
          name  = "PORT"
          value = "3001"
        }
      ]

      secrets = [
        {
          name      = "DATABASE_URL"
          valueFrom = aws_secretsmanager_secret.db_connection.arn
        },
        {
          name      = "REDIS_URL"
          valueFrom = aws_secretsmanager_secret.redis_connection.arn
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.api.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "ecs"
        }
      }

      healthCheck = {
        command     = ["CMD-SHELL", "curl -f http://localhost:3001/health || exit 1"]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 60
      }
    }
  ])
}

# Auto Scaling
resource "aws_appautoscaling_target" "api" {
  max_capacity       = var.api_max_count
  min_capacity       = var.api_min_count
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.api.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

resource "aws_appautoscaling_policy" "api_cpu" {
  name               = "${var.project_name}-api-cpu-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.api.resource_id
  scalable_dimension = aws_appautoscaling_target.api.scalable_dimension
  service_namespace  = aws_appautoscaling_target.api.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    target_value = 70.0
  }
}

# CloudFront Distribution
resource "aws_cloudfront_distribution" "main" {
  enabled             = true
  is_ipv6_enabled     = true
  comment             = "${var.project_name} CDN"
  default_root_object = "index.html"

  origin {
    domain_name = aws_lb.main.dns_name
    origin_id   = "alb"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  origin {
    domain_name = aws_s3_bucket.static_assets.bucket_regional_domain_name
    origin_id   = "s3"

    s3_origin_config {
      origin_access_identity = aws_cloudfront_origin_access_identity.main.cloudfront_access_identity_path
    }
  }

  default_cache_behavior {
    allowed_methods  = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "alb"

    forwarded_values {
      query_string = true
      headers      = ["Host", "Origin", "Accept", "Authorization"]

      cookies {
        forward = "all"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 0
    max_ttl                = 0
  }

  ordered_cache_behavior {
    path_pattern     = "/static/*"
    allowed_methods  = ["GET", "HEAD"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "s3"

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 86400
    max_ttl                = 31536000
    compress               = true
  }

  price_class = "PriceClass_100"

  restrictions {
    geo_restriction {
      restriction_type = "whitelist"
      locations        = ["GB", "US", "FR", "ES", "DE"]
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }

  tags = {
    Name = "${var.project_name}-cdn"
  }
}

# Monitoring and Alerts
resource "aws_sns_topic" "alerts" {
  name = "${var.project_name}-alerts"
}

resource "aws_cloudwatch_metric_alarm" "api_cpu_high" {
  alarm_name          = "${var.project_name}-api-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ECS"
  period              = "300"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "This metric monitors API CPU utilization"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    ServiceName = aws_ecs_service.api.name
    ClusterName = aws_ecs_cluster.main.name
  }
}

# Outputs
output "alb_dns_name" {
  value       = aws_lb.main.dns_name
  description = "DNS name of the load balancer"
}

output "cloudfront_domain_name" {
  value       = aws_cloudfront_distribution.main.domain_name
  description = "CloudFront distribution domain name"
}

output "rds_endpoint" {
  value       = aws_db_instance.postgres.endpoint
  description = "RDS instance endpoint"
  sensitive   = true
}

output "redis_endpoint" {
  value       = aws_elasticache_replication_group.redis.primary_endpoint_address
  description = "Redis primary endpoint"
  sensitive   = true
}
```

## Summary

This comprehensive implementation provides:

1. **Data Validation & Sanitization** using Zod schemas with HTML sanitization and SQL injection prevention
2. **Error Boundary Implementation** with error reporting and recovery mechanisms
3. **Internationalization (i18n)** support for multiple locales with proper formatting
4. **Infrastructure as Code** using Terraform with comprehensive AWS resource configuration

All implementations follow TDD principles with extensive test coverage, ensuring reliability, security, and maintainability across all layers of the application.