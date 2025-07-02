# TDD Implementation for Mobile, Accessibility, API Documentation & Advanced Features

## 1. Mobile Responsiveness Testing

### A. Mobile Component Tests

```typescript
// property-search-frontend/src/components/PropertyGrid/PropertyGrid.mobile.test.tsx
import { render, screen } from '@testing-library/react';
import { PropertyGrid } from './PropertyGrid';
import { mockProperties } from '@/test/fixtures/properties';
import { setViewport, resetViewport } from '@/test/utils/viewport';

describe('PropertyGrid - Mobile Responsiveness', () => {
  afterEach(() => {
    resetViewport();
  });

  describe('Mobile Portrait (360x640)', () => {
    beforeEach(() => {
      setViewport(360, 640);
    });

    it('should display single column layout on mobile', () => {
      const { container } = render(
        <PropertyGrid properties={mockProperties} />
      );

      const grid = container.querySelector('[data-testid="property-grid"]');
      const computedStyle = window.getComputedStyle(grid!);
      
      expect(computedStyle.gridTemplateColumns).toBe('1fr');
    });

    it('should show mobile-optimized property cards', () => {
      render(<PropertyGrid properties={mockProperties} />);

      const cards = screen.getAllByTestId('property-card');
      cards.forEach(card => {
        const style = window.getComputedStyle(card);
        expect(parseInt(style.width)).toBeLessThan(360);
      });
    });

    it('should hide non-essential information on mobile', () => {
      render(<PropertyGrid properties={mockProperties} />);

      // Agent information should be hidden
      expect(screen.queryByTestId('agent-info')).not.toBeInTheDocument();
      
      // Extended features should be collapsed
      expect(screen.queryByTestId('extended-features')).not.toBeInTheDocument();
    });
  });

  describe('Tablet (768x1024)', () => {
    beforeEach(() => {
      setViewport(768, 1024);
    });

    it('should display two column layout on tablet', () => {
      const { container } = render(
        <PropertyGrid properties={mockProperties} />
      );

      const grid = container.querySelector('[data-testid="property-grid"]');
      const computedStyle = window.getComputedStyle(grid!);
      
      expect(computedStyle.gridTemplateColumns).toMatch(/repeat\(2/);
    });
  });

  describe('Desktop (1920x1080)', () => {
    beforeEach(() => {
      setViewport(1920, 1080);
    });

    it('should display multi-column layout on desktop', () => {
      const { container } = render(
        <PropertyGrid properties={mockProperties} />
      );

      const grid = container.querySelector('[data-testid="property-grid"]');
      const computedStyle = window.getComputedStyle(grid!);
      
      expect(computedStyle.gridTemplateColumns).toMatch(/repeat\((3|4)/);
    });
  });

  describe('Touch Interactions', () => {
    it('should handle swipe gestures on mobile', () => {
      setViewport(360, 640);
      
      const onSwipe = jest.fn();
      render(
        <PropertyGrid 
          properties={mockProperties}
          onSwipeLeft={onSwipe}
        />
      );

      const card = screen.getAllByTestId('property-card')[0];
      
      // Simulate swipe
      fireEvent.touchStart(card, { touches: [{ clientX: 300, clientY: 100 }] });
      fireEvent.touchMove(card, { touches: [{ clientX: 100, clientY: 100 }] });
      fireEvent.touchEnd(card, { changedTouches: [{ clientX: 100, clientY: 100 }] });

      expect(onSwipe).toHaveBeenCalled();
    });

    it('should have larger touch targets on mobile', () => {
      setViewport(360, 640);
      
      render(<PropertyGrid properties={mockProperties} />);

      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        const rect = button.getBoundingClientRect();
        // Minimum 44x44 pixels for touch targets
        expect(rect.width).toBeGreaterThanOrEqual(44);
        expect(rect.height).toBeGreaterThanOrEqual(44);
      });
    });
  });
});
```

### B. Mobile Hook Implementation

```typescript
// property-search-frontend/src/hooks/useMobileDetect.ts
import { useState, useEffect } from 'react';

interface MobileDetection {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  orientation: 'portrait' | 'landscape';
  viewport: {
    width: number;
    height: number;
  };
  deviceType: 'mobile' | 'tablet' | 'desktop';
}

export function useMobileDetect(): MobileDetection {
  const [detection, setDetection] = useState<MobileDetection>(() => {
    if (typeof window === 'undefined') {
      return {
        isMobile: false,
        isTablet: false,
        isDesktop: true,
        orientation: 'landscape',
        viewport: { width: 1920, height: 1080 },
        deviceType: 'desktop',
      };
    }

    return getDeviceInfo();
  });

  useEffect(() => {
    const handleResize = () => {
      setDetection(getDeviceInfo());
    };

    const handleOrientationChange = () => {
      setDetection(getDeviceInfo());
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleOrientationChange);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleOrientationChange);
    };
  }, []);

  return detection;
}

function getDeviceInfo(): MobileDetection {
  const width = window.innerWidth;
  const height = window.innerHeight;
  
  const isMobile = width < 768;
  const isTablet = width >= 768 && width < 1024;
  const isDesktop = width >= 1024;
  
  const orientation = width > height ? 'landscape' : 'portrait';
  
  let deviceType: 'mobile' | 'tablet' | 'desktop' = 'desktop';
  if (isMobile) deviceType = 'mobile';
  else if (isTablet) deviceType = 'tablet';

  return {
    isMobile,
    isTablet,
    isDesktop,
    orientation,
    viewport: { width, height },
    deviceType,
  };
}

// Touch detection hook
export function useTouchDetection() {
  const [isTouch, setIsTouch] = useState(false);

  useEffect(() => {
    const checkTouch = () => {
      setIsTouch(
        'ontouchstart' in window ||
        navigator.maxTouchPoints > 0 ||
        window.matchMedia('(pointer: coarse)').matches
      );
    };

    checkTouch();
    
    const mediaQuery = window.matchMedia('(pointer: coarse)');
    const handleChange = () => checkTouch();
    
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
    } else {
      mediaQuery.addListener(handleChange);
    }

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleChange);
      } else {
        mediaQuery.removeListener(handleChange);
      }
    };
  }, []);

  return isTouch;
}
```

## 2. Accessibility Testing & Implementation

### A. Accessibility Component Tests

```typescript
// property-search-frontend/src/components/PropertyCard/PropertyCard.a11y.test.tsx
import { render, screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import userEvent from '@testing-library/user-event';
import { PropertyCard } from './PropertyCard';
import { mockProperty } from '@/test/fixtures/properties';

expect.extend(toHaveNoViolations);

describe('PropertyCard - Accessibility', () => {
  it('should have no accessibility violations', async () => {
    const { container } = render(
      <PropertyCard property={mockProperty} />
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  describe('ARIA attributes', () => {
    it('should have proper ARIA labels', () => {
      render(<PropertyCard property={mockProperty} />);

      const card = screen.getByRole('article');
      expect(card).toHaveAttribute('aria-label', expect.stringContaining(mockProperty.title));

      const favoriteButton = screen.getByRole('button', { name: /favorite/i });
      expect(favoriteButton).toHaveAttribute('aria-pressed', 'false');

      const priceElement = screen.getByText(/£\d+/);
      expect(priceElement).toHaveAttribute('aria-label', expect.stringContaining('price'));
    });

    it('should announce state changes', async () => {
      const user = userEvent.setup();
      const onFavorite = jest.fn();
      
      render(
        <PropertyCard 
          property={mockProperty} 
          onFavorite={onFavorite}
        />
      );

      const favoriteButton = screen.getByRole('button', { name: /favorite/i });
      
      await user.click(favoriteButton);
      
      expect(favoriteButton).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByRole('status')).toHaveTextContent('Added to favorites');
    });
  });

  describe('Keyboard navigation', () => {
    it('should be fully keyboard navigable', async () => {
      const user = userEvent.setup();
      const onClick = jest.fn();
      const onFavorite = jest.fn();

      render(
        <PropertyCard 
          property={mockProperty}
          onClick={onClick}
          onFavorite={onFavorite}
        />
      );

      // Tab to card
      await user.tab();
      const card = screen.getByRole('article');
      expect(card).toHaveFocus();

      // Enter to activate
      await user.keyboard('{Enter}');
      expect(onClick).toHaveBeenCalled();

      // Tab to favorite button
      await user.tab();
      const favoriteButton = screen.getByRole('button', { name: /favorite/i });
      expect(favoriteButton).toHaveFocus();

      // Space to activate
      await user.keyboard(' ');
      expect(onFavorite).toHaveBeenCalled();
    });

    it('should trap focus in modal', async () => {
      const user = userEvent.setup();
      
      render(<PropertyCard property={mockProperty} showDetails />);

      const modal = screen.getByRole('dialog');
      const focusableElements = modal.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );

      // Tab through all elements
      for (let i = 0; i < focusableElements.length + 1; i++) {
        await user.tab();
      }

      // Should cycle back to first element
      expect(focusableElements[0]).toHaveFocus();
    });
  });

  describe('Screen reader support', () => {
    it('should have descriptive text for screen readers', () => {
      render(<PropertyCard property={mockProperty} />);

      // Image should have alt text
      const image = screen.getByRole('img');
      expect(image).toHaveAttribute('alt', expect.stringContaining(mockProperty.title));

      // Price should be readable
      const price = screen.getByText(/£450,000/);
      expect(price.textContent).toMatch(/£450,000/);

      // Features should be in a list
      const features = screen.getByRole('list', { name: /features/i });
      expect(features).toBeInTheDocument();
    });

    it('should use semantic HTML', () => {
      const { container } = render(<PropertyCard property={mockProperty} />);

      // Check for semantic elements
      expect(container.querySelector('article')).toBeInTheDocument();
      expect(container.querySelector('h3')).toBeInTheDocument();
      expect(container.querySelector('address')).toBeInTheDocument();
    });
  });

  describe('Color contrast', () => {
    it('should have sufficient color contrast', async () => {
      const { container } = render(<PropertyCard property={mockProperty} />);

      // Run axe contrast checks
      const results = await axe(container, {
        rules: {
          'color-contrast': { enabled: true },
        },
      });

      expect(results).toHaveNoViolations();
    });
  });

  describe('Focus indicators', () => {
    it('should have visible focus indicators', () => {
      const { container } = render(<PropertyCard property={mockProperty} />);

      const focusableElements = container.querySelectorAll(
        'button, a, [tabindex="0"]'
      );

      focusableElements.forEach(element => {
        element.focus();
        const styles = window.getComputedStyle(element);
        
        // Check for focus styles
        expect(
          styles.outline !== 'none' || 
          styles.boxShadow !== 'none' ||
          styles.border !== 'none'
        ).toBe(true);
      });
    });
  });
});
```

### B. Accessibility Hook Implementation

```typescript
// property-search-frontend/src/hooks/useAccessibility.ts
import { useEffect, useCallback, useRef } from 'react';

interface AccessibilityOptions {
  announceOnChange?: boolean;
  focusTrap?: boolean;
  escapeDeactivates?: boolean;
}

export function useAccessibility(options: AccessibilityOptions = {}) {
  const {
    announceOnChange = true,
    focusTrap = false,
    escapeDeactivates = true,
  } = options;

  const containerRef = useRef<HTMLElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Live region announcements
  const announce = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    if (!announceOnChange) return;

    const announcement = document.createElement('div');
    announcement.setAttribute('role', 'status');
    announcement.setAttribute('aria-live', priority);
    announcement.setAttribute('aria-atomic', 'true');
    announcement.style.position = 'absolute';
    announcement.style.left = '-10000px';
    announcement.style.width = '1px';
    announcement.style.height = '1px';
    announcement.style.overflow = 'hidden';
    
    announcement.textContent = message;
    document.body.appendChild(announcement);

    setTimeout(() => {
      document.body.removeChild(announcement);
    }, 1000);
  }, [announceOnChange]);

  // Focus trap
  useEffect(() => {
    if (!focusTrap || !containerRef.current) return;

    const container = containerRef.current;
    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    
    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    // Store previous focus
    previousFocusRef.current = document.activeElement as HTMLElement;
    
    // Focus first element
    firstElement.focus();

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && escapeDeactivates) {
        previousFocusRef.current?.focus();
      }
    };

    container.addEventListener('keydown', handleTabKey);
    container.addEventListener('keydown', handleEscape);

    return () => {
      container.removeEventListener('keydown', handleTabKey);
      container.removeEventListener('keydown', handleEscape);
      previousFocusRef.current?.focus();
    };
  }, [focusTrap, escapeDeactivates]);

  return {
    containerRef,
    announce,
  };
}

// Skip navigation links
export function SkipNavigation() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-blue-600 text-white px-4 py-2 rounded"
    >
      Skip to main content
    </a>
  );
}

// Reduced motion hook
export function useReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    
    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

  return prefersReducedMotion;
}
```

## 3. API Documentation & Contract Testing

### A. OpenAPI Schema Tests

```typescript
// property-search-api/src/tests/contracts/openapi.test.ts
import { OpenAPIValidator } from 'express-openapi-validator';
import request from 'supertest';
import { app } from '../../app';
import { loadOpenAPISpec } from '../../docs/openapi';

describe('OpenAPI Contract Tests', () => {
  let validator: OpenAPIValidator;

  beforeAll(async () => {
    const spec = await loadOpenAPISpec();
    validator = new OpenAPIValidator({
      apiSpec: spec,
      validateRequests: true,
      validateResponses: true,
    });
  });

  describe('Property Search Endpoint', () => {
    it('should match OpenAPI schema for successful search', async () => {
      const response = await request(app)
        .get('/api/v1/properties/search')
        .query({
          q: 'modern apartment',
          minPrice: 300000,
          maxPrice: 500000,
          page: 1,
          limit: 20,
        })
        .expect(200);

      // Validate response against schema
      await validator.validateResponse(response);

      expect(response.body).toMatchObject({
        success: true,
        data: expect.arrayContaining([
          expect.objectContaining({
            id: expect.any(String),
            title: expect.any(String),
            price: expect.any(Number),
            location: expect.objectContaining({
              city: expect.any(String),
              postcode: expect.any(String),
            }),
          }),
        ]),
        meta: expect.objectContaining({
          page: 1,
          limit: 20,
          total: expect.any(Number),
        }),
      });
    });

    it('should return 400 for invalid parameters', async () => {
      const response = await request(app)
        .get('/api/v1/properties/search')
        .query({
          minPrice: 'invalid',
          page: -1,
        })
        .expect(400);

      await validator.validateResponse(response);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.objectContaining({
          code: 'VALIDATION_ERROR',
          message: expect.any(String),
          details: expect.arrayContaining([
            expect.objectContaining({
              field: expect.any(String),
              message: expect.any(String),
            }),
          ]),
        }),
      });
    });
  });

  describe('Property CRUD Operations', () => {
    it('should create property with valid schema', async () => {
      const newProperty = {
        title: 'Test Property',
        description: 'A test property',
        price: 450000,
        propertyType: 'apartment',
        location: {
          address: '123 Test St',
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
      };

      const response = await request(app)
        .post('/api/v1/properties')
        .send(newProperty)
        .set('Authorization', 'Bearer valid-token')
        .expect(201);

      await validator.validateResponse(response);

      expect(response.body.data).toMatchObject({
        id: expect.any(String),
        ...newProperty,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
    });
  });
});
```

### B. OpenAPI Schema Definition

```yaml
# property-search-api/src/docs/openapi.yaml
openapi: 3.0.3
info:
  title: Moov Property Search API
  description: |
    AI-powered property search platform API with semantic search capabilities
  version: 1.0.0
  contact:
    name: API Support
    email: api@moov-property.com
  license:
    name: MIT
    url: https://opensource.org/licenses/MIT

servers:
  - url: https://api.moov-property.com/v1
    description: Production server
  - url: https://staging-api.moov-property.com/v1
    description: Staging server
  - url: http://localhost:3001/api/v1
    description: Development server

tags:
  - name: Properties
    description: Property search and management
  - name: Chat
    description: AI chat assistant
  - name: Users
    description: User management
  - name: Analytics
    description: Analytics and metrics

paths:
  /properties/search:
    get:
      tags:
        - Properties
      summary: Search properties using semantic search
      description: |
        Search for properties using natural language queries. 
        The API uses AI to understand intent and return relevant matches.
      operationId: searchProperties
      parameters:
        - name: q
          in: query
          description: Natural language search query
          required: true
          schema:
            type: string
            minLength: 1
            maxLength: 500
          example: "modern apartment with balcony near Victoria station"
        
        - name: minPrice
          in: query
          description: Minimum price filter
          schema:
            type: integer
            minimum: 0
          example: 300000
        
        - name: maxPrice
          in: query
          description: Maximum price filter
          schema:
            type: integer
            minimum: 0
          example: 500000
        
        - name: bedrooms
          in: query
          description: Minimum number of bedrooms
          schema:
            type: integer
            minimum: 0
            maximum: 10
        
        - name: propertyType
          in: query
          description: Type of property
          schema:
            type: string
            enum: [house, apartment, studio, townhouse, cottage]
        
        - name: radius
          in: query
          description: Search radius in kilometers
          schema:
            type: number
            minimum: 0
            maximum: 50
        
        - name: page
          in: query
          description: Page number for pagination
          schema:
            type: integer
            minimum: 1
            default: 1
        
        - name: limit
          in: query
          description: Number of results per page
          schema:
            type: integer
            minimum: 1
            maximum: 100
            default: 20
      
      responses:
        '200':
          description: Successful search results
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/SearchResponse'
              examples:
                success:
                  $ref: '#/components/examples/SearchResponseExample'
        
        '400':
          description: Invalid request parameters
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
        
        '429':
          description: Rate limit exceeded
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
        
        '500':
          description: Internal server error
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'

  /properties/{id}:
    get:
      tags:
        - Properties
      summary: Get property details
      operationId: getProperty
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
            pattern: '^[a-zA-Z0-9-]+$'
      responses:
        '200':
          description: Property details
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/PropertyResponse'
        '404':
          description: Property not found
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'

  /chat/message:
    post:
      tags:
        - Chat
      summary: Send message to AI assistant
      operationId: sendChatMessage
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/ChatMessageRequest'
      responses:
        '200':
          description: Chat response
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ChatResponse'

components:
  schemas:
    Property:
      type: object
      required:
        - id
        - title
        - price
        - location
        - propertyType
        - features
      properties:
        id:
          type: string
          description: Unique property identifier
        title:
          type: string
          description: Property title
        description:
          type: string
          description: Detailed property description
        price:
          type: integer
          description: Property price in GBP
          minimum: 0
        propertyType:
          type: string
          enum: [house, apartment, studio, townhouse, cottage]
        location:
          $ref: '#/components/schemas/Location'
        features:
          $ref: '#/components/schemas/Features'
        images:
          type: array
          items:
            $ref: '#/components/schemas/Image'
        agent:
          $ref: '#/components/schemas/Agent'
        semanticScore:
          type: number
          description: Semantic match score (0-1)
          minimum: 0
          maximum: 1
        createdAt:
          type: string
          format: date-time
        updatedAt:
          type: string
          format: date-time

    Location:
      type: object
      required:
        - address
        - city
        - postcode
        - coordinates
      properties:
        address:
          type: string
        city:
          type: string
        postcode:
          type: string
          pattern: '^[A-Z]{1,2}[0-9][A-Z0-9]? ?[0-9][A-Z]{2}$'
        area:
          type: string
        coordinates:
          type: object
          required:
            - lat
            - lng
          properties:
            lat:
              type: number
              minimum: -90
              maximum: 90
            lng:
              type: number
              minimum: -180
              maximum: 180

    Features:
      type: object
      required:
        - bedrooms
        - bathrooms
        - squareFootage
      properties:
        bedrooms:
          type: integer
          minimum: 0
        bathrooms:
          type: integer
          minimum: 0
        squareFootage:
          type: integer
          minimum: 0
        amenities:
          type: array
          items:
            type: string

    SearchResponse:
      type: object
      required:
        - success
        - data
        - meta
      properties:
        success:
          type: boolean
        data:
          type: array
          items:
            $ref: '#/components/schemas/Property'
        meta:
          type: object
          required:
            - page
            - limit
            - total
          properties:
            page:
              type: integer
            limit:
              type: integer
            total:
              type: integer
            query:
              type: string
            executionTime:
              type: number

    ErrorResponse:
      type: object
      required:
        - success
        - error
      properties:
        success:
          type: boolean
          example: false
        error:
          type: object
          required:
            - code
            - message
          properties:
            code:
              type: string
              example: VALIDATION_ERROR
            message:
              type: string
            details:
              type: array
              items:
                type: object
                properties:
                  field:
                    type: string
                  message:
                    type: string

  examples:
    SearchResponseExample:
      value:
        success: true
        data:
          - id: "prop-123"
            title: "Modern 2-Bed Apartment with Balcony"
            price: 450000
            propertyType: "apartment"
            semanticScore: 0.95
            location:
              address: "123 Victoria Street"
              city: "London"
              postcode: "SW1A 1AA"
              area: "Westminster"
              coordinates:
                lat: 51.4994
                lng: -0.1406
            features:
              bedrooms: 2
              bathrooms: 1
              squareFootage: 850
              amenities: ["balcony", "parking", "gym"]
        meta:
          page: 1
          limit: 20
          total: 45
          query: "modern apartment with balcony near Victoria station"
          executionTime: 0.234

  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT

security:
  - bearerAuth: []
```

## 4. Load Testing & Performance

### A. Load Test Implementation

```typescript
// property-search-api/src/tests/load/k6-load-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const searchSuccessRate = new Rate('search_success');

// Test configuration
export const options = {
  stages: [
    { duration: '2m', target: 100 },   // Ramp up to 100 users
    { duration: '5m', target: 100 },   // Stay at 100 users
    { duration: '2m', target: 200 },   // Ramp up to 200 users
    { duration: '5m', target: 200 },   // Stay at 200 users
    { duration: '2m', target: 0 },     // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],  // 95% of requests under 500ms
    errors: ['rate<0.05'],             // Error rate under 5%
    search_success: ['rate>0.95'],     // Search success rate over 95%
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';

// Search queries to use
const searchQueries = [
  'modern apartment London',
  'house with garden Manchester',
  'studio flat near station',
  'family home good schools',
  'luxury penthouse city center',
  '2 bedroom flat with parking',
  'victorian house renovation',
  'new build apartment Thames',
];

// Test scenarios
export default function () {
  // Scenario 1: Property Search
  const searchQuery = searchQueries[Math.floor(Math.random() * searchQueries.length)];
  const searchParams = {
    q: searchQuery,
    minPrice: Math.floor(Math.random() * 5) * 100000 + 200000,
    maxPrice: Math.floor(Math.random() * 5) * 100000 + 500000,
    page: 1,
    limit: 20,
  };

  const searchResponse = http.get(
    `${BASE_URL}/api/v1/properties/search?${new URLSearchParams(searchParams)}`,
    {
      headers: { 'Accept': 'application/json' },
      tags: { name: 'PropertySearch' },
    }
  );

  check(searchResponse, {
    'search status is 200': (r) => r.status === 200,
    'search response has data': (r) => {
      const body = JSON.parse(r.body);
      return body && body.data && Array.isArray(body.data);
    },
    'search response time < 500ms': (r) => r.timings.duration < 500,
  });

  errorRate.add(searchResponse.status !== 200);
  searchSuccessRate.add(searchResponse.status === 200);

  sleep(1);

  // Scenario 2: Property Details
  if (searchResponse.status === 200) {
    const properties = JSON.parse(searchResponse.body).data;
    if (properties.length > 0) {
      const propertyId = properties[0].id;
      
      const detailsResponse = http.get(
        `${BASE_URL}/api/v1/properties/${propertyId}`,
        {
          headers: { 'Accept': 'application/json' },
          tags: { name: 'PropertyDetails' },
        }
      );

      check(detailsResponse, {
        'details status is 200': (r) => r.status === 200,
        'details response time < 200ms': (r) => r.timings.duration < 200,
      });
    }
  }

  sleep(Math.random() * 3 + 1);

  // Scenario 3: Chat Message (10% of users)
  if (Math.random() < 0.1) {
    const chatResponse = http.post(
      `${BASE_URL}/api/v1/chat/message`,
      JSON.stringify({
        message: `Tell me more about ${searchQuery}`,
        sessionId: `session-${__VU}-${__ITER}`,
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        tags: { name: 'ChatMessage' },
      }
    );

    check(chatResponse, {
      'chat status is 200': (r) => r.status === 200,
      'chat response time < 2000ms': (r) => r.timings.duration < 2000,
    });
  }

  sleep(Math.random() * 2);
}

// Stress test scenario
export function stressTest() {
  const responses = http.batch([
    ['GET', `${BASE_URL}/api/v1/properties/search?q=test`],
    ['GET', `${BASE_URL}/api/v1/properties/search?q=apartment`],
    ['GET', `${BASE_URL}/api/v1/properties/search?q=house`],
  ]);

  responses.forEach(response => {
    check(response, {
      'batch request successful': (r) => r.status === 200,
    });
  });
}
```

### B. Performance Monitoring Implementation

```typescript
// property-search-api/src/middleware/performance.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { performance, PerformanceObserver } from 'perf_hooks';
import { metrics } from '../services/metrics';
import { logger } from '../services/logger';

interface PerformanceMetrics {
  route: string;
  method: string;
  statusCode: number;
  duration: number;
  memoryUsage: NodeJS.MemoryUsage;
  timestamp: Date;
}

export class PerformanceMiddleware {
  private slowRequestThreshold = 1000; // 1 second
  private observer: PerformanceObserver;

  constructor() {
    // Set up performance observer
    this.observer = new PerformanceObserver((items) => {
      items.getEntries().forEach((entry) => {
        if (entry.duration > this.slowRequestThreshold) {
          logger.warn('Slow request detected', {
            name: entry.name,
            duration: entry.duration,
            type: entry.entryType,
          });
        }
      });
    });

    this.observer.observe({ entryTypes: ['measure'] });
  }

  public measurePerformance() {
    return (req: Request, res: Response, next: NextFunction) => {
      const start = performance.now();
      const startMemory = process.memoryUsage();

      // Add performance mark
      performance.mark(`${req.method}-${req.path}-start`);

      // Override end method
      const originalEnd = res.end;
      res.end = function(...args: any[]) {
        // Calculate metrics
        const duration = performance.now() - start;
        const endMemory = process.memoryUsage();
        
        performance.mark(`${req.method}-${req.path}-end`);
        performance.measure(
          `${req.method} ${req.path}`,
          `${req.method}-${req.path}-start`,
          `${req.method}-${req.path}-end`
        );

        // Record metrics
        const performanceMetrics: PerformanceMetrics = {
          route: req.route?.path || req.path,
          method: req.method,
          statusCode: res.statusCode,
          duration,
          memoryUsage: {
            rss: endMemory.rss - startMemory.rss,
            heapTotal: endMemory.heapTotal - startMemory.heapTotal,
            heapUsed: endMemory.heapUsed - startMemory.heapUsed,
            external: endMemory.external - startMemory.external,
            arrayBuffers: endMemory.arrayBuffers - startMemory.arrayBuffers,
          },
          timestamp: new Date(),
        };

        // Send to metrics service
        metrics.histogram('api_request_duration_ms', duration, {
          method: req.method,
          route: req.route?.path || req.path,
          status: res.statusCode.toString(),
        });

        // Log slow requests
        if (duration > 1000) {
          logger.warn('Slow request', performanceMetrics);
        }

        // Add performance headers
        res.setHeader('X-Response-Time', `${duration.toFixed(2)}ms`);
        res.setHeader('X-Server-Timing', `total;dur=${duration.toFixed(2)}`);

        return originalEnd.apply(res, args);
      };

      next();
    };
  }

  public resourceMonitoring() {
    return (req: Request, res: Response, next: NextFunction) => {
      const interval = setInterval(() => {
        const usage = process.cpuUsage();
        const memory = process.memoryUsage();

        metrics.gauge('process_cpu_user_seconds', usage.user / 1000000);
        metrics.gauge('process_cpu_system_seconds', usage.system / 1000000);
        metrics.gauge('process_memory_heap_used_bytes', memory.heapUsed);
        metrics.gauge('process_memory_heap_total_bytes', memory.heapTotal);
      }, 5000);

      res.on('finish', () => {
        clearInterval(interval);
      });

      next();
    };
  }
}

// Database query performance monitoring
export function monitorDatabasePerformance(prisma: any) {
  prisma.$use(async (params: any, next: any) => {
    const start = performance.now();
    
    const result = await next(params);
    
    const duration = performance.now() - start;
    
    metrics.histogram('database_query_duration_ms', duration, {
      model: params.model,
      action: params.action,
    });

    if (duration > 100) {
      logger.warn('Slow database query', {
        model: params.model,
        action: params.action,
        duration,
        args: params.args,
      });
    }

    return result;
  });
}
```

## 5. Feature Flags & A/B Testing

### A. Feature Flag Tests

```typescript
// property-search-frontend/src/services/featureFlags/FeatureFlags.test.ts
import { FeatureFlagService } from './FeatureFlagService';
import { renderHook } from '@testing-library/react';
import { useFeatureFlag, useABTest } from './hooks';

describe('FeatureFlagService', () => {
  let service: FeatureFlagService;

  beforeEach(() => {
    service = new FeatureFlagService({
      apiKey: 'test-key',
      environment: 'test',
    });
  });

  describe('Feature flag evaluation', () => {
    it('should evaluate simple boolean flags', async () => {
      service.setFlags({
        'new-search-ui': {
          enabled: true,
          rolloutPercentage: 100,
        },
      });

      const isEnabled = await service.isEnabled('new-search-ui');
      expect(isEnabled).toBe(true);
    });

    it('should respect rollout percentages', async () => {
      service.setFlags({
        'experimental-feature': {
          enabled: true,
          rolloutPercentage: 50,
        },
      });

      const results = new Set();
      for (let i = 0; i < 1000; i++) {
        const userId = `user-${i}`;
        const isEnabled = await service.isEnabled('experimental-feature', { userId });
        results.add(isEnabled);
      }

      // Should have both true and false results
      expect(results.has(true)).toBe(true);
      expect(results.has(false)).toBe(true);
    });

    it('should handle user targeting', async () => {
      service.setFlags({
        'premium-feature': {
          enabled: true,
          targets: {
            users: ['user-123', 'user-456'],
            segments: ['premium'],
          },
        },
      });

      expect(await service.isEnabled('premium-feature', { userId: 'user-123' })).toBe(true);
      expect(await service.isEnabled('premium-feature', { userId: 'user-789' })).toBe(false);
      expect(await service.isEnabled('premium-feature', { 
        userId: 'user-999',
        segments: ['premium'] 
      })).toBe(true);
    });
  });

  describe('A/B testing', () => {
    it('should assign users to variants consistently', async () => {
      service.setExperiments({
        'search-algorithm': {
          enabled: true,
          variants: [
            { key: 'control', weight: 50 },
            { key: 'semantic', weight: 50 },
          ],
        },
      });

      const userId = 'user-123';
      const variant1 = await service.getVariant('search-algorithm', userId);
      const variant2 = await service.getVariant('search-algorithm', userId);

      // Same user should always get same variant
      expect(variant1).toBe(variant2);
      expect(['control', 'semantic']).toContain(variant1);
    });

    it('should distribute variants according to weights', async () => {
      service.setExperiments({
        'button-color': {
          enabled: true,
          variants: [
            { key: 'blue', weight: 70 },
            { key: 'green', weight: 30 },
          ],
        },
      });

      const variantCounts = { blue: 0, green: 0 };
      
      for (let i = 0; i < 1000; i++) {
        const variant = await service.getVariant('button-color', `user-${i}`);
        if (variant) {
          variantCounts[variant as keyof typeof variantCounts]++;
        }
      }

      // Check distribution is roughly correct (within 5% margin)
      expect(variantCounts.blue).toBeGreaterThan(650);
      expect(variantCounts.blue).toBeLessThan(750);
      expect(variantCounts.green).toBeGreaterThan(250);
      expect(variantCounts.green).toBeLessThan(350);
    });
  });

  describe('React hooks', () => {
    it('should provide feature flag state via hook', () => {
      const { result } = renderHook(() => useFeatureFlag('new-feature'));

      expect(result.current.isEnabled).toBe(false);
      expect(result.current.isLoading).toBe(true);
    });

    it('should provide A/B test variant via hook', () => {
      const { result } = renderHook(() => useABTest('experiment-1'));

      expect(result.current.variant).toBe(null);
      expect(result.current.isLoading).toBe(true);
    });
  });
});
```

### B. Feature Flag Service Implementation

```typescript
// property-search-frontend/src/services/featureFlags/FeatureFlagService.ts
import { EventEmitter } from 'events';
import murmurhash from 'murmurhash';

interface FeatureFlag {
  enabled: boolean;
  rolloutPercentage?: number;
  targets?: {
    users?: string[];
    segments?: string[];
  };
  metadata?: Record<string, any>;
}

interface Experiment {
  enabled: boolean;
  variants: Array<{
    key: string;
    weight: number;
  }>;
  goals?: string[];
}

interface UserContext {
  userId?: string;
  segments?: string[];
  properties?: Record<string, any>;
}

export class FeatureFlagService extends EventEmitter {
  private flags: Map<string, FeatureFlag> = new Map();
  private experiments: Map<string, Experiment> = new Map();
  private apiKey: string;
  private environment: string;
  private pollingInterval?: NodeJS.Timeout;

  constructor(config: {
    apiKey: string;
    environment: string;
    pollingInterval?: number;
  }) {
    super();
    this.apiKey = config.apiKey;
    this.environment = config.environment;

    if (config.pollingInterval) {
      this.startPolling(config.pollingInterval);
    }
  }

  async initialize(): Promise<void> {
    await this.fetchFlags();
  }

  private async fetchFlags(): Promise<void> {
    try {
      const response = await fetch(`/api/feature-flags`, {
        headers: {
          'X-API-Key': this.apiKey,
          'X-Environment': this.environment,
        },
      });

      if (response.ok) {
        const data = await response.json();
        this.updateFlags(data);
      }
    } catch (error) {
      console.error('Failed to fetch feature flags:', error);
    }
  }

  private updateFlags(data: any): void {
    // Update flags
    Object.entries(data.flags || {}).forEach(([key, flag]) => {
      this.flags.set(key, flag as FeatureFlag);
    });

    // Update experiments
    Object.entries(data.experiments || {}).forEach(([key, experiment]) => {
      this.experiments.set(key, experiment as Experiment);
    });

    this.emit('flags-updated');
  }

  async isEnabled(
    flagKey: string,
    context: UserContext = {}
  ): Promise<boolean> {
    const flag = this.flags.get(flagKey);
    
    if (!flag || !flag.enabled) {
      return false;
    }

    // Check user targeting
    if (flag.targets) {
      if (flag.targets.users && context.userId) {
        if (flag.targets.users.includes(context.userId)) {
          return true;
        }
      }

      if (flag.targets.segments && context.segments) {
        const hasTargetedSegment = context.segments.some(
          segment => flag.targets!.segments!.includes(segment)
        );
        if (hasTargetedSegment) {
          return true;
        }
      }

      // If targeting is defined but user doesn't match, check rollout
      if (flag.targets.users || flag.targets.segments) {
        if (!flag.rolloutPercentage) {
          return false;
        }
      }
    }

    // Check rollout percentage
    if (flag.rolloutPercentage !== undefined && flag.rolloutPercentage < 100) {
      const hash = this.hash(`${flagKey}:${context.userId || 'anonymous'}`);
      const bucket = (hash % 100) + 1;
      return bucket <= flag.rolloutPercentage;
    }

    return true;
  }

  async getVariant(
    experimentKey: string,
    userId: string
  ): Promise<string | null> {
    const experiment = this.experiments.get(experimentKey);
    
    if (!experiment || !experiment.enabled) {
      return null;
    }

    // Calculate cumulative weights
    let totalWeight = 0;
    const cumulativeWeights = experiment.variants.map(variant => {
      totalWeight += variant.weight;
      return {
        key: variant.key,
        weight: totalWeight,
      };
    });

    // Hash user ID with experiment key for consistent assignment
    const hash = this.hash(`${experimentKey}:${userId}`);
    const bucket = (hash % totalWeight) + 1;

    // Find variant based on bucket
    for (const variant of cumulativeWeights) {
      if (bucket <= variant.weight) {
        return variant.key;
      }
    }

    return experiment.variants[0]?.key || null;
  }

  private hash(input: string): number {
    return murmurhash.v3(input);
  }

  private startPolling(interval: number): void {
    this.pollingInterval = setInterval(() => {
      this.fetchFlags();
    }, interval);
  }

  destroy(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }
    this.removeAllListeners();
  }

  // For testing
  setFlags(flags: Record<string, FeatureFlag>): void {
    this.flags.clear();
    Object.entries(flags).forEach(([key, flag]) => {
      this.flags.set(key, flag);
    });
  }

  setExperiments(experiments: Record<string, Experiment>): void {
    this.experiments.clear();
    Object.entries(experiments).forEach(([key, experiment]) => {
      this.experiments.set(key, experiment);
    });
  }
}

// React hooks
import { useState, useEffect } from 'react';

export function useFeatureFlag(flagKey: string, context?: UserContext) {
  const [isEnabled, setIsEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkFlag = async () => {
      const service = getFeatureFlagService();
      const enabled = await service.isEnabled(flagKey, context);
      setIsEnabled(enabled);
      setIsLoading(false);
    };

    checkFlag();

    const handleUpdate = () => checkFlag();
    const service = getFeatureFlagService();
    service.on('flags-updated', handleUpdate);

    return () => {
      service.off('flags-updated', handleUpdate);
    };
  }, [flagKey, context]);

  return { isEnabled, isLoading };
}

export function useABTest(experimentKey: string, userId?: string) {
  const [variant, setVariant] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const getVariant = async () => {
      const service = getFeatureFlagService();
      const userIdentifier = userId || getUserId();
      const assignedVariant = await service.getVariant(experimentKey, userIdentifier);
      setVariant(assignedVariant);
      setIsLoading(false);
    };

    getVariant();
  }, [experimentKey, userId]);

  return { variant, isLoading };
}

// Singleton instance
let service: FeatureFlagService;

export function getFeatureFlagService(): FeatureFlagService {
  if (!service) {
    service = new FeatureFlagService({
      apiKey: process.env.NEXT_PUBLIC_FF_API_KEY!,
      environment: process.env.NEXT_PUBLIC_ENVIRONMENT!,
      pollingInterval: 60000, // 1 minute
    });
    service.initialize();
  }
  return service;
}

function getUserId(): string {
  // Get or generate user ID from localStorage
  let userId = localStorage.getItem('userId');
  if (!userId) {
    userId = `anon-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('userId', userId);
  }
  return userId;
}
```

## Summary

This comprehensive implementation provides:

1. **Mobile Responsiveness Testing** with viewport-specific tests and touch interaction handling
2. **Accessibility Testing** following WCAG guidelines with ARIA support and keyboard navigation
3. **API Documentation** using OpenAPI 3.0 with contract testing
4. **Load Testing** using k6 for performance validation under stress
5. **Feature Flags & A/B Testing** for controlled rollouts and experimentation

All implementations follow TDD principles with tests written first, ensuring high quality and maintainability across all platforms and use cases.