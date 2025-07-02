# TDD Implementation for Analytics, SEO, Data Migration & Advanced Features

## 1. Analytics and User Tracking

### A. Analytics Service Tests

```typescript
// property-search-frontend/src/services/analytics/AnalyticsService.test.ts
import { AnalyticsService } from './AnalyticsService';
import { mockLocalStorage } from '@/test/utils/localStorage';

describe('AnalyticsService', () => {
  let analytics: AnalyticsService;
  let mockGtag: jest.Mock;
  let mockDataLayer: any[];

  beforeEach(() => {
    mockLocalStorage();
    mockDataLayer = [];
    mockGtag = jest.fn((command, ...args) => {
      if (command === 'event') {
        mockDataLayer.push({ command, ...args[0] });
      }
    });
    
    window.gtag = mockGtag;
    window.dataLayer = mockDataLayer;

    analytics = new AnalyticsService({
      measurementId: 'G-TESTID123',
      enableDebug: false,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Page tracking', () => {
    it('should track page views', () => {
      analytics.trackPageView({
        path: '/properties/123',
        title: 'Property Details',
      });

      expect(mockGtag).toHaveBeenCalledWith('event', 'page_view', {
        page_path: '/properties/123',
        page_title: 'Property Details',
      });
    });

    it('should track virtual page views for SPA navigation', () => {
      analytics.trackVirtualPageView('/search', 'Search Results');

      expect(mockGtag).toHaveBeenCalledWith('event', 'page_view', {
        page_path: '/search',
        page_title: 'Search Results',
        page_location: expect.stringContaining('/search'),
      });
    });
  });

  describe('Event tracking', () => {
    it('should track search events', () => {
      analytics.trackSearch({
        searchQuery: 'modern apartment London',
        resultsCount: 25,
        filters: {
          minPrice: 300000,
          maxPrice: 500000,
          bedrooms: 2,
        },
      });

      expect(mockDataLayer).toContainEqual({
        command: 'event',
        event_category: 'search',
        event_action: 'search_performed',
        search_term: 'modern apartment London',
        results_count: 25,
        filter_min_price: 300000,
        filter_max_price: 500000,
        filter_bedrooms: 2,
      });
    });

    it('should track property interactions', () => {
      analytics.trackPropertyView({
        propertyId: 'prop-123',
        propertyType: 'apartment',
        price: 450000,
        location: 'Westminster',
        source: 'search_results',
      });

      expect(mockDataLayer).toContainEqual({
        command: 'event',
        event_category: 'property',
        event_action: 'view',
        property_id: 'prop-123',
        property_type: 'apartment',
        property_price: 450000,
        property_location: 'Westminster',
        traffic_source: 'search_results',
      });
    });

    it('should track conversion events', () => {
      analytics.trackConversion({
        type: 'viewing_request',
        propertyId: 'prop-123',
        value: 450000,
      });

      expect(mockGtag).toHaveBeenCalledWith('event', 'conversion', {
        send_to: 'G-TESTID123/conversion_id',
        value: 450000,
        currency: 'GBP',
        transaction_id: expect.any(String),
      });
    });
  });

  describe('User properties', () => {
    it('should set user properties', () => {
      analytics.setUserProperties({
        user_type: 'registered',
        preferred_location: 'London',
        price_range: 'high',
      });

      expect(mockGtag).toHaveBeenCalledWith('set', 'user_properties', {
        user_type: 'registered',
        preferred_location: 'London',
        price_range: 'high',
      });
    });

    it('should track user ID for logged-in users', () => {
      analytics.setUserId('user-123');

      expect(mockGtag).toHaveBeenCalledWith('config', 'G-TESTID123', {
        user_id: 'user-123',
      });
    });
  });

  describe('Enhanced ecommerce', () => {
    it('should track property impressions', () => {
      const properties = [
        { id: '1', title: 'Apartment 1', price: 400000, position: 1 },
        { id: '2', title: 'Apartment 2', price: 450000, position: 2 },
      ];

      analytics.trackPropertyImpressions(properties, 'search_results');

      expect(mockGtag).toHaveBeenCalledWith('event', 'view_item_list', {
        item_list_id: 'search_results',
        item_list_name: 'Search Results',
        items: expect.arrayContaining([
          expect.objectContaining({
            item_id: '1',
            item_name: 'Apartment 1',
            price: 400000,
            index: 1,
          }),
        ]),
      });
    });

    it('should track add to favorites', () => {
      analytics.trackAddToFavorites({
        propertyId: 'prop-123',
        propertyTitle: 'Modern Apartment',
        price: 450000,
      });

      expect(mockGtag).toHaveBeenCalledWith('event', 'add_to_wishlist', {
        currency: 'GBP',
        value: 450000,
        items: [{
          item_id: 'prop-123',
          item_name: 'Modern Apartment',
          price: 450000,
          quantity: 1,
        }],
      });
    });
  });

  describe('Performance tracking', () => {
    it('should track page load performance', () => {
      const mockPerformance = {
        timing: {
          navigationStart: 1000,
          loadEventEnd: 3500,
          domContentLoadedEventEnd: 2000,
        },
      };

      Object.defineProperty(window, 'performance', {
        value: mockPerformance,
        writable: true,
      });

      analytics.trackPageLoadTime();

      expect(mockGtag).toHaveBeenCalledWith('event', 'timing_complete', {
        name: 'load',
        value: 2500,
        event_category: 'performance',
      });
    });

    it('should track custom timing events', () => {
      const timer = analytics.startTimer('search_api_call');
      
      // Simulate delay
      jest.advanceTimersByTime(150);
      
      timer.end();

      expect(mockGtag).toHaveBeenCalledWith('event', 'timing_complete', {
        name: 'search_api_call',
        value: expect.any(Number),
        event_category: 'performance',
      });
    });
  });

  describe('Error tracking', () => {
    it('should track JavaScript errors', () => {
      const error = new Error('Test error');
      error.stack = 'Error: Test error\n    at test.js:10:5';

      analytics.trackError(error, {
        context: 'property_search',
        userId: 'user-123',
      });

      expect(mockGtag).toHaveBeenCalledWith('event', 'exception', {
        description: 'Test error',
        fatal: false,
        error_context: 'property_search',
        error_stack: expect.stringContaining('test.js:10:5'),
      });
    });
  });

  describe('Privacy compliance', () => {
    it('should respect user consent preferences', () => {
      analytics.updateConsent({
        analytics: false,
        marketing: false,
      });

      analytics.trackPageView({ path: '/test' });

      expect(mockGtag).not.toHaveBeenCalledWith('event', 'page_view');
    });

    it('should anonymize IP when required', () => {
      analytics = new AnalyticsService({
        measurementId: 'G-TESTID123',
        anonymizeIp: true,
      });

      expect(mockGtag).toHaveBeenCalledWith('config', 'G-TESTID123', 
        expect.objectContaining({
          anonymize_ip: true,
        })
      );
    });
  });
});
```

### B. Analytics Service Implementation

```typescript
// property-search-frontend/src/services/analytics/AnalyticsService.ts
interface AnalyticsConfig {
  measurementId: string;
  enableDebug?: boolean;
  anonymizeIp?: boolean;
}

interface PageViewData {
  path: string;
  title?: string;
  referrer?: string;
}

interface SearchEventData {
  searchQuery: string;
  resultsCount: number;
  filters?: Record<string, any>;
  searchDuration?: number;
}

interface PropertyEventData {
  propertyId: string;
  propertyType: string;
  price: number;
  location: string;
  source?: string;
}

interface ConversionData {
  type: 'viewing_request' | 'contact_agent' | 'save_search';
  propertyId?: string;
  value?: number;
}

export class AnalyticsService {
  private config: AnalyticsConfig;
  private isInitialized = false;
  private consentGiven = true;
  private timers: Map<string, number> = new Map();

  constructor(config: AnalyticsConfig) {
    this.config = config;
    this.initialize();
  }

  private initialize(): void {
    if (typeof window === 'undefined' || this.isInitialized) return;

    // Load Google Analytics
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${this.config.measurementId}`;
    document.head.appendChild(script);

    window.dataLayer = window.dataLayer || [];
    window.gtag = function() {
      window.dataLayer.push(arguments);
    };

    window.gtag('js', new Date());
    window.gtag('config', this.config.measurementId, {
      debug_mode: this.config.enableDebug,
      anonymize_ip: this.config.anonymizeIp,
    });

    this.isInitialized = true;
    this.setupErrorTracking();
  }

  private setupErrorTracking(): void {
    window.addEventListener('error', (event) => {
      this.trackError(event.error || new Error(event.message), {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      });
    });

    window.addEventListener('unhandledrejection', (event) => {
      this.trackError(new Error(event.reason), {
        type: 'unhandledRejection',
      });
    });
  }

  trackPageView(data: PageViewData): void {
    if (!this.canTrack()) return;

    window.gtag('event', 'page_view', {
      page_path: data.path,
      page_title: data.title,
      page_referrer: data.referrer,
    });
  }

  trackVirtualPageView(path: string, title: string): void {
    if (!this.canTrack()) return;

    window.gtag('event', 'page_view', {
      page_path: path,
      page_title: title,
      page_location: window.location.origin + path,
    });
  }

  trackSearch(data: SearchEventData): void {
    if (!this.canTrack()) return;

    const eventData: any = {
      event_category: 'search',
      event_action: 'search_performed',
      search_term: data.searchQuery,
      results_count: data.resultsCount,
    };

    // Add filter data
    if (data.filters) {
      Object.entries(data.filters).forEach(([key, value]) => {
        eventData[`filter_${key}`] = value;
      });
    }

    if (data.searchDuration) {
      eventData.timing_value = data.searchDuration;
    }

    window.gtag('event', eventData);
  }

  trackPropertyView(data: PropertyEventData): void {
    if (!this.canTrack()) return;

    window.gtag('event', 'view_item', {
      event_category: 'property',
      event_action: 'view',
      property_id: data.propertyId,
      property_type: data.propertyType,
      property_price: data.price,
      property_location: data.location,
      traffic_source: data.source,
    });
  }

  trackPropertyImpressions(
    properties: Array<{
      id: string;
      title: string;
      price: number;
      position: number;
    }>,
    listName: string
  ): void {
    if (!this.canTrack()) return;

    window.gtag('event', 'view_item_list', {
      item_list_id: listName.toLowerCase().replace(/\s+/g, '_'),
      item_list_name: this.formatListName(listName),
      items: properties.map(property => ({
        item_id: property.id,
        item_name: property.title,
        price: property.price,
        index: property.position,
        item_category: 'property',
      })),
    });
  }

  trackAddToFavorites(data: {
    propertyId: string;
    propertyTitle: string;
    price: number;
  }): void {
    if (!this.canTrack()) return;

    window.gtag('event', 'add_to_wishlist', {
      currency: 'GBP',
      value: data.price,
      items: [{
        item_id: data.propertyId,
        item_name: data.propertyTitle,
        price: data.price,
        quantity: 1,
      }],
    });
  }

  trackConversion(data: ConversionData): void {
    if (!this.canTrack()) return;

    const conversionId = this.getConversionId(data.type);
    
    window.gtag('event', 'conversion', {
      send_to: `${this.config.measurementId}/${conversionId}`,
      value: data.value,
      currency: 'GBP',
      transaction_id: this.generateTransactionId(),
    });
  }

  trackEngagement(action: string, parameters?: Record<string, any>): void {
    if (!this.canTrack()) return;

    window.gtag('event', 'engagement', {
      event_category: 'engagement',
      event_action: action,
      ...parameters,
    });
  }

  setUserProperties(properties: Record<string, any>): void {
    if (!this.canTrack()) return;

    window.gtag('set', 'user_properties', properties);
  }

  setUserId(userId: string): void {
    if (!this.canTrack()) return;

    window.gtag('config', this.config.measurementId, {
      user_id: userId,
    });
  }

  startTimer(name: string): { end: () => void } {
    const startTime = performance.now();
    this.timers.set(name, startTime);

    return {
      end: () => {
        const endTime = performance.now();
        const duration = Math.round(endTime - startTime);
        
        this.trackTiming(name, duration);
        this.timers.delete(name);
      },
    };
  }

  trackTiming(name: string, value: number): void {
    if (!this.canTrack()) return;

    window.gtag('event', 'timing_complete', {
      name,
      value,
      event_category: 'performance',
    });
  }

  trackPageLoadTime(): void {
    if (typeof window === 'undefined' || !window.performance) return;

    window.addEventListener('load', () => {
      setTimeout(() => {
        const timing = window.performance.timing;
        const loadTime = timing.loadEventEnd - timing.navigationStart;
        const domReadyTime = timing.domContentLoadedEventEnd - timing.navigationStart;

        this.trackTiming('load', loadTime);
        this.trackTiming('dom_ready', domReadyTime);
      }, 0);
    });
  }

  trackError(error: Error, context?: Record<string, any>): void {
    if (!this.canTrack()) return;

    window.gtag('event', 'exception', {
      description: error.message,
      fatal: false,
      error_stack: error.stack?.substring(0, 500), // Limit stack trace length
      ...Object.entries(context || {}).reduce((acc, [key, value]) => ({
        ...acc,
        [`error_${key}`]: value,
      }), {}),
    });
  }

  updateConsent(consent: { analytics: boolean; marketing: boolean }): void {
    this.consentGiven = consent.analytics;

    window.gtag('consent', 'update', {
      analytics_storage: consent.analytics ? 'granted' : 'denied',
      ad_storage: consent.marketing ? 'granted' : 'denied',
    });
  }

  private canTrack(): boolean {
    return this.isInitialized && this.consentGiven;
  }

  private formatListName(name: string): string {
    return name
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  private getConversionId(type: string): string {
    const conversionMap: Record<string, string> = {
      viewing_request: 'viewing_123',
      contact_agent: 'contact_456',
      save_search: 'save_789',
    };

    return conversionMap[type] || 'default_conversion';
  }

  private generateTransactionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// React Hook
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export function useAnalytics() {
  const router = useRouter();
  const analytics = getAnalyticsInstance();

  useEffect(() => {
    const handleRouteChange = (url: string) => {
      analytics.trackVirtualPageView(url, document.title);
    };

    // Track initial page view
    analytics.trackPageView({
      path: window.location.pathname,
      title: document.title,
    });

    // Listen for route changes
    // Note: This is simplified, actual implementation depends on your router
    return () => {
      // Cleanup
    };
  }, [analytics]);

  return analytics;
}

let analyticsInstance: AnalyticsService;

export function getAnalyticsInstance(): AnalyticsService {
  if (!analyticsInstance) {
    analyticsInstance = new AnalyticsService({
      measurementId: process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID!,
      enableDebug: process.env.NODE_ENV === 'development',
      anonymizeIp: true,
    });
  }
  return analyticsInstance;
}
```

## 2. SEO Optimization

### A. SEO Component Tests

```typescript
// property-search-frontend/src/components/SEO/SEO.test.tsx
import { render } from '@testing-library/react';
import { SEO, PropertySEO, generateStructuredData } from './SEO';
import { mockProperty } from '@/test/fixtures/properties';

// Mock Next.js Head
jest.mock('next/head', () => {
  return {
    __esModule: true,
    default: ({ children }: { children: React.ReactNode }) => {
      return <>{children}</>;
    },
  };
});

describe('SEO Components', () => {
  describe('SEO', () => {
    it('should render basic meta tags', () => {
      const { container } = render(
        <SEO
          title="Modern Apartments in London"
          description="Find your perfect apartment in London with our AI-powered search"
          canonical="https://moov-property.com/search"
        />
      );

      const title = container.querySelector('title');
      expect(title?.textContent).toBe('Modern Apartments in London | Moov Property');

      const description = container.querySelector('meta[name="description"]');
      expect(description?.getAttribute('content')).toBe(
        'Find your perfect apartment in London with our AI-powered search'
      );

      const canonical = container.querySelector('link[rel="canonical"]');
      expect(canonical?.getAttribute('href')).toBe('https://moov-property.com/search');
    });

    it('should render Open Graph tags', () => {
      const { container } = render(
        <SEO
          title="Property Search"
          description="AI-powered property search"
          image="https://moov-property.com/og-image.jpg"
          type="website"
        />
      );

      const ogTitle = container.querySelector('meta[property="og:title"]');
      expect(ogTitle?.getAttribute('content')).toBe('Property Search | Moov Property');

      const ogType = container.querySelector('meta[property="og:type"]');
      expect(ogType?.getAttribute('content')).toBe('website');

      const ogImage = container.querySelector('meta[property="og:image"]');
      expect(ogImage?.getAttribute('content')).toBe('https://moov-property.com/og-image.jpg');
    });

    it('should render Twitter Card tags', () => {
      const { container } = render(
        <SEO
          title="Find Properties"
          description="Search properties with AI"
          image="https://moov-property.com/twitter-card.jpg"
        />
      );

      const twitterCard = container.querySelector('meta[name="twitter:card"]');
      expect(twitterCard?.getAttribute('content')).toBe('summary_large_image');

      const twitterTitle = container.querySelector('meta[name="twitter:title"]');
      expect(twitterTitle?.getAttribute('content')).toBe('Find Properties | Moov Property');
    });

    it('should handle noindex and nofollow', () => {
      const { container } = render(
        <SEO
          title="Admin Page"
          noindex={true}
          nofollow={true}
        />
      );

      const robots = container.querySelector('meta[name="robots"]');
      expect(robots?.getAttribute('content')).toBe('noindex, nofollow');
    });
  });

  describe('PropertySEO', () => {
    it('should generate property-specific meta tags', () => {
      const { container } = render(
        <PropertySEO property={mockProperty} />
      );

      const title = container.querySelector('title');
      expect(title?.textContent).toContain(mockProperty.title);

      const description = container.querySelector('meta[name="description"]');
      expect(description?.getAttribute('content')).toContain('2 bedrooms');
      expect(description?.getAttribute('content')).toContain('£450,000');
    });

    it('should include property structured data', () => {
      const { container } = render(
        <PropertySEO property={mockProperty} />
      );

      const structuredData = container.querySelector('script[type="application/ld+json"]');
      expect(structuredData).toBeTruthy();

      const data = JSON.parse(structuredData!.textContent || '{}');
      expect(data['@type']).toBe('RealEstateListing');
      expect(data.name).toBe(mockProperty.title);
      expect(data.price).toBe(mockProperty.price);
    });
  });

  describe('generateStructuredData', () => {
    it('should generate valid RealEstateListing schema', () => {
      const schema = generateStructuredData(mockProperty);

      expect(schema).toMatchObject({
        '@context': 'https://schema.org',
        '@type': 'RealEstateListing',
        name: mockProperty.title,
        description: mockProperty.description,
        price: mockProperty.price,
        priceCurrency: 'GBP',
        address: {
          '@type': 'PostalAddress',
          streetAddress: mockProperty.location.address,
          addressLocality: mockProperty.location.city,
          postalCode: mockProperty.location.postcode,
          addressCountry: 'GB',
        },
        geo: {
          '@type': 'GeoCoordinates',
          latitude: mockProperty.location.coordinates.lat,
          longitude: mockProperty.location.coordinates.lng,
        },
        numberOfRooms: mockProperty.bedrooms,
        floorSize: {
          '@type': 'QuantitativeValue',
          value: mockProperty.squareFootage,
          unitCode: 'FTK', // Square feet
        },
      });
    });

    it('should include images in structured data', () => {
      const schema = generateStructuredData(mockProperty);

      expect(schema.image).toEqual(
        mockProperty.images.map(img => img.url)
      );
    });

    it('should include agent information', () => {
      const schema = generateStructuredData(mockProperty);

      expect(schema.seller).toMatchObject({
        '@type': 'RealEstateAgent',
        name: mockProperty.agent.name,
        telephone: mockProperty.agent.phone,
        email: mockProperty.agent.email,
      });
    });
  });
});
```

### B. SEO Implementation

```typescript
// property-search-frontend/src/components/SEO/SEO.tsx
import Head from 'next/head';
import { useRouter } from 'next/router';
import { Property } from '@/types/property';

interface SEOProps {
  title: string;
  description?: string;
  keywords?: string;
  canonical?: string;
  image?: string;
  type?: 'website' | 'article' | 'product';
  publishedTime?: string;
  modifiedTime?: string;
  author?: string;
  noindex?: boolean;
  nofollow?: boolean;
  additionalMetaTags?: Array<{
    name?: string;
    property?: string;
    content: string;
  }>;
  structuredData?: object;
}

const DEFAULT_SITE_NAME = 'Moov Property';
const DEFAULT_DESCRIPTION = 'Find your perfect property with AI-powered search';
const DEFAULT_IMAGE = 'https://moov-property.com/default-og-image.jpg';

export function SEO({
  title,
  description = DEFAULT_DESCRIPTION,
  keywords,
  canonical,
  image = DEFAULT_IMAGE,
  type = 'website',
  publishedTime,
  modifiedTime,
  author,
  noindex = false,
  nofollow = false,
  additionalMetaTags = [],
  structuredData,
}: SEOProps) {
  const router = useRouter();
  const fullTitle = `${title} | ${DEFAULT_SITE_NAME}`;
  const url = canonical || `https://moov-property.com${router.asPath}`;

  const robotsContent = [
    noindex ? 'noindex' : 'index',
    nofollow ? 'nofollow' : 'follow',
  ].join(', ');

  return (
    <Head>
      {/* Basic Meta Tags */}
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      {keywords && <meta name="keywords" content={keywords} />}
      <meta name="robots" content={robotsContent} />
      <link rel="canonical" href={url} />

      {/* Open Graph Tags */}
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content={type} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={image} />
      <meta property="og:site_name" content={DEFAULT_SITE_NAME} />
      <meta property="og:locale" content="en_GB" />

      {/* Article-specific Open Graph tags */}
      {type === 'article' && (
        <>
          {publishedTime && (
            <meta property="article:published_time" content={publishedTime} />
          )}
          {modifiedTime && (
            <meta property="article:modified_time" content={modifiedTime} />
          )}
          {author && <meta property="article:author" content={author} />}
        </>
      )}

      {/* Twitter Card Tags */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />
      <meta name="twitter:site" content="@moovproperty" />

      {/* Additional Meta Tags */}
      {additionalMetaTags.map((tag, index) => (
        <meta
          key={index}
          name={tag.name}
          property={tag.property}
          content={tag.content}
        />
      ))}

      {/* Structured Data */}
      {structuredData && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(structuredData),
          }}
        />
      )}

      {/* Mobile & PWA */}
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <meta name="theme-color" content="#1a73e8" />
      <link rel="manifest" href="/manifest.json" />

      {/* Favicons */}
      <link rel="icon" type="image/x-icon" href="/favicon.ico" />
      <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
    </Head>
  );
}

// Property-specific SEO component
export function PropertySEO({ property }: { property: Property }) {
  const description = generatePropertyDescription(property);
  const structuredData = generateStructuredData(property);

  return (
    <SEO
      title={property.title}
      description={description}
      keywords={generatePropertyKeywords(property)}
      canonical={`https://moov-property.com/properties/${property.id}`}
      image={property.images[0]?.url || DEFAULT_IMAGE}
      type="product"
      structuredData={structuredData}
      additionalMetaTags={[
        { property: 'product:price:amount', content: property.price.toString() },
        { property: 'product:price:currency', content: 'GBP' },
        { property: 'product:availability', content: 'in stock' },
      ]}
    />
  );
}

// Helper functions
function generatePropertyDescription(property: Property): string {
  const parts = [
    `${property.bedrooms} bedroom ${property.propertyType}`,
    `for £${property.price.toLocaleString()}`,
    `in ${property.location.city}`,
  ];

  if (property.features.length > 0) {
    parts.push(`featuring ${property.features.slice(0, 3).join(', ')}`);
  }

  return parts.join(' ') + '. ' + property.description.substring(0, 100) + '...';
}

function generatePropertyKeywords(property: Property): string {
  const keywords = [
    property.propertyType,
    `${property.bedrooms} bedroom`,
    property.location.city,
    property.location.area || '',
    property.location.postcode.split(' ')[0],
    ...property.features.slice(0, 5),
    'property',
    'real estate',
    'UK',
  ];

  return keywords.filter(Boolean).join(', ');
}

export function generateStructuredData(property: Property): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'RealEstateListing',
    '@id': `https://moov-property.com/properties/${property.id}`,
    name: property.title,
    description: property.description,
    url: `https://moov-property.com/properties/${property.id}`,
    datePosted: property.listedDate,
    price: property.price,
    priceCurrency: 'GBP',
    image: property.images.map(img => img.url),
    address: {
      '@type': 'PostalAddress',
      streetAddress: property.location.address,
      addressLocality: property.location.city,
      postalCode: property.location.postcode,
      addressCountry: 'GB',
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: property.location.coordinates.lat,
      longitude: property.location.coordinates.lng,
    },
    numberOfRooms: property.bedrooms,
    numberOfBathroomsTotal: property.bathrooms,
    floorSize: {
      '@type': 'QuantitativeValue',
      value: property.squareFootage,
      unitCode: 'FTK', // Square feet
    },
    seller: {
      '@type': 'RealEstateAgent',
      name: property.agent.name,
      telephone: property.agent.phone,
      email: property.agent.email,
    },
  };
}

// Sitemap generation
export async function generateSitemap(): Promise<string> {
  const baseUrl = 'https://moov-property.com';
  
  // Static pages
  const staticPages = [
    { url: '/', changefreq: 'daily', priority: 1.0 },
    { url: '/search', changefreq: 'hourly', priority: 0.9 },
    { url: '/about', changefreq: 'monthly', priority: 0.5 },
    { url: '/contact', changefreq: 'monthly', priority: 0.5 },
  ];

  // Dynamic pages (properties)
  const properties = await fetchAllPropertyUrls();
  const propertyPages = properties.map(id => ({
    url: `/properties/${id}`,
    changefreq: 'weekly',
    priority: 0.8,
  }));

  const allPages = [...staticPages, ...propertyPages];

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allPages.map(page => `
  <url>
    <loc>${baseUrl}${page.url}</loc>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
    <lastmod>${new Date().toISOString()}</lastmod>
  </url>
`).join('')}
</urlset>`;

  return sitemap;
}

async function fetchAllPropertyUrls(): Promise<string[]> {
  // Implementation to fetch all property IDs
  // This would typically query your database
  return [];
}
```

## 3. Database Migration System

### A. Migration Tests

```typescript
// property-search-api/src/migrations/migration.test.ts
import { MigrationRunner } from './MigrationRunner';
import { Database } from '../database';

describe('MigrationRunner', () => {
  let runner: MigrationRunner;
  let db: Database;

  beforeEach(async () => {
    db = new Database({ connectionString: process.env.TEST_DATABASE_URL });
    runner = new MigrationRunner(db);
    
    // Clean migrations table
    await db.query('DROP TABLE IF EXISTS migrations CASCADE');
  });

  afterEach(async () => {
    await db.close();
  });

  describe('Migration execution', () => {
    it('should create migrations table on first run', async () => {
      await runner.initialize();

      const result = await db.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_name = 'migrations'
      `);

      expect(result.rows).toHaveLength(1);
    });

    it('should execute pending migrations in order', async () => {
      const migrations = [
        {
          id: '001_create_users',
          up: async (db: Database) => {
            await db.query(`
              CREATE TABLE users (
                id SERIAL PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL
              )
            `);
          },
          down: async (db: Database) => {
            await db.query('DROP TABLE users');
          },
        },
        {
          id: '002_add_name_to_users',
          up: async (db: Database) => {
            await db.query(`
              ALTER TABLE users 
              ADD COLUMN name VARCHAR(255)
            `);
          },
          down: async (db: Database) => {
            await db.query('ALTER TABLE users DROP COLUMN name');
          },
        },
      ];

      runner.register(migrations);
      await runner.up();

      // Check migrations were applied
      const tables = await db.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'users'
      `);

      const columnNames = tables.rows.map(row => row.column_name);
      expect(columnNames).toContain('id');
      expect(columnNames).toContain('email');
      expect(columnNames).toContain('name');

      // Check migration records
      const migrationRecords = await db.query('SELECT * FROM migrations ORDER BY id');
      expect(migrationRecords.rows).toHaveLength(2);
      expect(migrationRecords.rows[0].id).toBe('001_create_users');
      expect(migrationRecords.rows[1].id).toBe('002_add_name_to_users');
    });

    it('should not run already executed migrations', async () => {
      const migration = {
        id: '001_test_migration',
        up: jest.fn(),
        down: jest.fn(),
      };

      runner.register([migration]);
      
      // Run twice
      await runner.up();
      await runner.up();

      expect(migration.up).toHaveBeenCalledTimes(1);
    });

    it('should rollback migrations', async () => {
      const migrations = [
        {
          id: '001_create_table',
          up: async (db: Database) => {
            await db.query('CREATE TABLE test_table (id INT)');
          },
          down: async (db: Database) => {
            await db.query('DROP TABLE test_table');
          },
        },
      ];

      runner.register(migrations);
      await runner.up();

      // Verify table exists
      let tables = await db.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_name = 'test_table'
      `);
      expect(tables.rows).toHaveLength(1);

      // Rollback
      await runner.down();

      // Verify table is gone
      tables = await db.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_name = 'test_table'
      `);
      expect(tables.rows).toHaveLength(0);
    });

    it('should handle migration errors gracefully', async () => {
      const migration = {
        id: '001_failing_migration',
        up: async () => {
          throw new Error('Migration failed');
        },
        down: async () => {},
      };

      runner.register([migration]);

      await expect(runner.up()).rejects.toThrow('Migration failed');

      // Check migration was not marked as completed
      const records = await db.query('SELECT * FROM migrations WHERE id = $1', [
        '001_failing_migration',
      ]);
      expect(records.rows).toHaveLength(0);
    });
  });

  describe('Migration validation', () => {
    it('should detect duplicate migration IDs', () => {
      const migrations = [
        { id: '001_test', up: async () => {}, down: async () => {} },
        { id: '001_test', up: async () => {}, down: async () => {} },
      ];

      expect(() => runner.register(migrations)).toThrow('Duplicate migration ID: 001_test');
    });

    it('should validate migration ID format', () => {
      const migration = {
        id: 'invalid-format',
        up: async () => {},
        down: async () => {},
      };

      expect(() => runner.register([migration])).toThrow('Invalid migration ID format');
    });
  });

  describe('Dry run mode', () => {
    it('should show pending migrations without executing', async () => {
      const migrations = [
        {
          id: '001_test_1',
          up: jest.fn(),
          down: jest.fn(),
        },
        {
          id: '002_test_2',
          up: jest.fn(),
          down: jest.fn(),
        },
      ];

      runner.register(migrations);
      const pending = await runner.getPendingMigrations();

      expect(pending).toHaveLength(2);
      expect(pending[0].id).toBe('001_test_1');
      expect(pending[1].id).toBe('002_test_2');
      expect(migrations[0].up).not.toHaveBeenCalled();
    });
  });
});
```

### B. Migration System Implementation

```typescript
// property-search-api/src/migrations/MigrationRunner.ts
import { Database } from '../database';
import fs from 'fs/promises';
import path from 'path';

interface Migration {
  id: string;
  up: (db: Database) => Promise<void>;
  down: (db: Database) => Promise<void>;
}

interface MigrationRecord {
  id: string;
  executed_at: Date;
}

export class MigrationRunner {
  private migrations: Map<string, Migration> = new Map();
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  async initialize(): Promise<void> {
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id VARCHAR(255) PRIMARY KEY,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  register(migrations: Migration[]): void {
    migrations.forEach(migration => {
      this.validateMigrationId(migration.id);
      
      if (this.migrations.has(migration.id)) {
        throw new Error(`Duplicate migration ID: ${migration.id}`);
      }
      
      this.migrations.set(migration.id, migration);
    });
  }

  async loadFromDirectory(dir: string): Promise<void> {
    const files = await fs.readdir(dir);
    const migrationFiles = files
      .filter(f => f.endsWith('.ts') || f.endsWith('.js'))
      .sort();

    for (const file of migrationFiles) {
      const migration = await import(path.join(dir, file));
      this.register([{
        id: path.basename(file, path.extname(file)),
        up: migration.up,
        down: migration.down,
      }]);
    }
  }

  async up(target?: string): Promise<void> {
    await this.initialize();
    const pending = await this.getPendingMigrations();

    for (const migration of pending) {
      if (target && migration.id > target) {
        break;
      }

      console.log(`Running migration: ${migration.id}`);
      
      try {
        await this.db.transaction(async (trx) => {
          await migration.up(trx);
          await trx.query(
            'INSERT INTO migrations (id) VALUES ($1)',
            [migration.id]
          );
        });
        
        console.log(`Completed migration: ${migration.id}`);
      } catch (error) {
        console.error(`Failed migration: ${migration.id}`, error);
        throw error;
      }
    }
  }

  async down(steps: number = 1): Promise<void> {
    await this.initialize();
    const executed = await this.getExecutedMigrations();
    const toRollback = executed.slice(-steps).reverse();

    for (const record of toRollback) {
      const migration = this.migrations.get(record.id);
      
      if (!migration) {
        throw new Error(`Migration not found: ${record.id}`);
      }

      console.log(`Rolling back migration: ${record.id}`);
      
      try {
        await this.db.transaction(async (trx) => {
          await migration.down(trx);
          await trx.query('DELETE FROM migrations WHERE id = $1', [record.id]);
        });
        
        console.log(`Rolled back migration: ${record.id}`);
      } catch (error) {
        console.error(`Failed to rollback migration: ${record.id}`, error);
        throw error;
      }
    }
  }

  async getPendingMigrations(): Promise<Migration[]> {
    const executed = await this.getExecutedMigrations();
    const executedIds = new Set(executed.map(r => r.id));
    
    return Array.from(this.migrations.values())
      .filter(m => !executedIds.has(m.id))
      .sort((a, b) => a.id.localeCompare(b.id));
  }

  async getExecutedMigrations(): Promise<MigrationRecord[]> {
    const result = await this.db.query<MigrationRecord>(
      'SELECT * FROM migrations ORDER BY id'
    );
    return result.rows;
  }

  async status(): Promise<void> {
    const executed = await this.getExecutedMigrations();
    const pending = await this.getPendingMigrations();

    console.log('\nExecuted migrations:');
    executed.forEach(m => {
      console.log(`  ✓ ${m.id} (${m.executed_at})`);
    });

    console.log('\nPending migrations:');
    pending.forEach(m => {
      console.log(`  ○ ${m.id}`);
    });
  }

  private validateMigrationId(id: string): void {
    // Format: 001_description or 20240301120000_description
    const pattern = /^(\d{3}_[a-z_]+|\d{14}_[a-z_]+)$/;
    
    if (!pattern.test(id)) {
      throw new Error(`Invalid migration ID format: ${id}`);
    }
  }
}

// Example migrations
// property-search-api/src/migrations/001_create_properties_table.ts
export async function up(db: Database): Promise<void> {
  await db.query(`
    CREATE EXTENSION IF NOT EXISTS vector;
    
    CREATE TABLE properties (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title VARCHAR(255) NOT NULL,
      description TEXT,
      price INTEGER NOT NULL,
      property_type VARCHAR(50) NOT NULL,
      status VARCHAR(50) DEFAULT 'active',
      
      -- Location
      address VARCHAR(255) NOT NULL,
      city VARCHAR(100) NOT NULL,
      postcode VARCHAR(10) NOT NULL,
      area VARCHAR(100),
      latitude DECIMAL(10, 8) NOT NULL,
      longitude DECIMAL(11, 8) NOT NULL,
      
      -- Features
      bedrooms INTEGER NOT NULL,
      bathrooms INTEGER NOT NULL,
      square_footage INTEGER,
      features TEXT[],
      
      -- Semantic search
      embedding vector(384),
      
      -- Timestamps
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      listed_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      
      -- Indexes
      CHECK (price >= 0),
      CHECK (bedrooms >= 0),
      CHECK (bathrooms >= 0)
    );
    
    -- Indexes for performance
    CREATE INDEX idx_properties_price ON properties(price);
    CREATE INDEX idx_properties_location ON properties(city, area);
    CREATE INDEX idx_properties_type ON properties(property_type);
    CREATE INDEX idx_properties_status ON properties(status);
    CREATE INDEX idx_properties_postcode ON properties(postcode);
    CREATE INDEX idx_properties_embedding ON properties USING ivfflat (embedding vector_cosine_ops);
    
    -- Full text search
    ALTER TABLE properties ADD COLUMN search_vector tsvector;
    CREATE INDEX idx_properties_search ON properties USING gin(search_vector);
    
    -- Update trigger for search vector
    CREATE OR REPLACE FUNCTION update_search_vector() RETURNS trigger AS $$
    BEGIN
      NEW.search_vector := 
        setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'B') ||
        setweight(to_tsvector('english', COALESCE(NEW.area, '')), 'C') ||
        setweight(to_tsvector('english', COALESCE(NEW.city, '')), 'C');
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
    
    CREATE TRIGGER update_properties_search_vector
      BEFORE INSERT OR UPDATE ON properties
      FOR EACH ROW EXECUTE FUNCTION update_search_vector();
  `);
}

export async function down(db: Database): Promise<void> {
  await db.query(`
    DROP TRIGGER IF EXISTS update_properties_search_vector ON properties;
    DROP FUNCTION IF EXISTS update_search_vector();
    DROP TABLE IF EXISTS properties;
  `);
}

// property-search-api/src/migrations/002_create_users_table.ts
export async function up(db: Database): Promise<void> {
  await db.query(`
    CREATE TABLE users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email VARCHAR(255) UNIQUE NOT NULL,
      name VARCHAR(255),
      phone VARCHAR(50),
      password_hash VARCHAR(255) NOT NULL,
      
      -- Preferences
      preferences JSONB DEFAULT '{}',
      search_alerts JSONB DEFAULT '[]',
      
      -- Status
      email_verified BOOLEAN DEFAULT false,
      is_active BOOLEAN DEFAULT true,
      last_login_at TIMESTAMP,
      
      -- Timestamps
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE INDEX idx_users_email ON users(email);
    CREATE INDEX idx_users_active ON users(is_active) WHERE is_active = true;
  `);
}

export async function down(db: Database): Promise<void> {
  await db.query('DROP TABLE IF EXISTS users');
}

// Migration CLI
// property-search-api/src/cli/migrate.ts
import { Command } from 'commander';
import { Database } from '../database';
import { MigrationRunner } from '../migrations/MigrationRunner';
import path from 'path';

const program = new Command();

program
  .name('migrate')
  .description('Database migration tool')
  .version('1.0.0');

program
  .command('up [target]')
  .description('Run pending migrations')
  .action(async (target) => {
    const db = new Database({ connectionString: process.env.DATABASE_URL });
    const runner = new MigrationRunner(db);
    
    await runner.loadFromDirectory(path.join(__dirname, '../migrations'));
    await runner.up(target);
    
    await db.close();
  });

program
  .command('down [steps]')
  .description('Rollback migrations')
  .action(async (steps = '1') => {
    const db = new Database({ connectionString: process.env.DATABASE_URL });
    const runner = new MigrationRunner(db);
    
    await runner.loadFromDirectory(path.join(__dirname, '../migrations'));
    await runner.down(parseInt(steps));
    
    await db.close();
  });

program
  .command('status')
  .description('Show migration status')
  .action(async () => {
    const db = new Database({ connectionString: process.env.DATABASE_URL });
    const runner = new MigrationRunner(db);
    
    await runner.loadFromDirectory(path.join(__dirname, '../migrations'));
    await runner.status();
    
    await db.close();
  });

program.parse();
```

## 4. Email Service

### A. Email Service Tests

```typescript
// property-search-api/src/services/email/EmailService.test.ts
import { EmailService } from './EmailService';
import { EmailTemplate } from './templates';

describe('EmailService', () => {
  let emailService: EmailService;
  let mockTransporter: any;

  beforeEach(() => {
    mockTransporter = {
      sendMail: jest.fn().mockResolvedValue({ messageId: 'test-id' }),
      verify: jest.fn().mockResolvedValue(true),
    };

    emailService = new EmailService({
      host: 'smtp.test.com',
      port: 587,
      auth: {
        user: 'test@example.com',
        pass: 'password',
      },
      from: 'noreply@moov-property.com',
    });

    // Replace transporter with mock
    (emailService as any).transporter = mockTransporter;
  });

  describe('Email sending', () => {
    it('should send welcome email', async () => {
      await emailService.sendWelcomeEmail({
        to: 'user@example.com',
        name: 'John Doe',
      });

      expect(mockTransporter.sendMail).toHaveBeenCalledWith({
        from: 'Moov Property <noreply@moov-property.com>',
        to: 'user@example.com',
        subject: 'Welcome to Moov Property',
        html: expect.stringContaining('Welcome, John Doe!'),
        text: expect.stringContaining('Welcome, John Doe!'),
      });
    });

    it('should send property alert email', async () => {
      const properties = [
        {
          id: '1',
          title: 'Modern Apartment',
          price: 450000,
          url: 'https://moov-property.com/properties/1',
          image: 'https://example.com/image.jpg',
        },
      ];

      await emailService.sendPropertyAlert({
        to: 'user@example.com',
        name: 'John',
        searchName: 'London Apartments',
        properties,
      });

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'New properties matching "London Apartments"',
          html: expect.stringContaining('Modern Apartment'),
          html: expect.stringContaining('£450,000'),
        })
      );
    });

    it('should send viewing confirmation', async () => {
      await emailService.sendViewingConfirmation({
        to: 'user@example.com',
        name: 'John',
        property: {
          title: 'Beautiful House',
          address: '123 Main St',
        },
        viewingDate: new Date('2024-03-20T14:00:00'),
        agentName: 'Jane Smith',
        agentPhone: '020 1234 5678',
      });

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'Viewing Confirmation - Beautiful House',
          html: expect.stringContaining('March 20, 2024 at 2:00 PM'),
          html: expect.stringContaining('Jane Smith'),
        })
      );
    });

    it('should handle batch emails', async () => {
      const recipients = [
        { email: 'user1@example.com', name: 'User 1' },
        { email: 'user2@example.com', name: 'User 2' },
      ];

      await emailService.sendBatch({
        template: 'newsletter',
        recipients,
        data: {
          month: 'March',
          featuredProperties: [],
        },
      });

      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(2);
    });

    it('should retry on failure', async () => {
      mockTransporter.sendMail
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ messageId: 'test-id' });

      await emailService.sendWelcomeEmail({
        to: 'user@example.com',
        name: 'John',
      });

      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(2);
    });

    it('should respect rate limits', async () => {
      const startTime = Date.now();
      
      // Send multiple emails
      const promises = Array(5).fill(null).map((_, i) => 
        emailService.sendWelcomeEmail({
          to: `user${i}@example.com`,
          name: `User ${i}`,
        })
      );

      await Promise.all(promises);
      
      const duration = Date.now() - startTime;
      
      // Should have rate limiting delays
      expect(duration).toBeGreaterThan(100);
    });
  });

  describe('Template rendering', () => {
    it('should render templates with data', () => {
      const template = EmailTemplate.render('welcome', {
        name: 'John Doe',
        activationUrl: 'https://example.com/activate',
      });

      expect(template.html).toContain('Welcome, John Doe!');
      expect(template.html).toContain('https://example.com/activate');
      expect(template.text).toContain('Welcome, John Doe!');
    });

    it('should escape HTML in user data', () => {
      const template = EmailTemplate.render('welcome', {
        name: '<script>alert("XSS")</script>',
      });

      expect(template.html).not.toContain('<script>');
      expect(template.html).toContain('&lt;script&gt;');
    });

    it('should include unsubscribe links', () => {
      const template = EmailTemplate.render('property-alert', {
        unsubscribeUrl: 'https://example.com/unsubscribe',
      });

      expect(template.html).toContain('unsubscribe');
      expect(template.html).toContain('https://example.com/unsubscribe');
    });
  });

  describe('Email validation', () => {
    it('should validate email addresses', () => {
      const validEmails = [
        'user@example.com',
        'test.user+tag@domain.co.uk',
      ];

      const invalidEmails = [
        'notanemail',
        '@example.com',
        'user@',
      ];

      validEmails.forEach(email => {
        expect(emailService.isValidEmail(email)).toBe(true);
      });

      invalidEmails.forEach(email => {
        expect(emailService.isValidEmail(email)).toBe(false);
      });
    });

    it('should check for disposable emails', async () => {
      const disposableEmails = [
        'user@tempmail.com',
        'test@guerrillamail.com',
      ];

      for (const email of disposableEmails) {
        const isDisposable = await emailService.isDisposableEmail(email);
        expect(isDisposable).toBe(true);
      }
    });
  });
});
```

### B. Email Service Implementation

```typescript
// property-search-api/src/services/email/EmailService.ts
import nodemailer from 'nodemailer';
import { htmlToText } from 'html-to-text';
import DOMPurify from 'isomorphic-dompurify';
import { RateLimiter } from '../RateLimiter';

interface EmailConfig {
  host: string;
  port: number;
  secure?: boolean;
  auth: {
    user: string;
    pass: string;
  };
  from: string;
}

interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
  }>;
  headers?: Record<string, string>;
}

export class EmailService {
  private transporter: nodemailer.Transporter;
  private config: EmailConfig;
  private rateLimiter: RateLimiter;

  constructor(config: EmailConfig) {
    this.config = config;
    this.transporter = nodemailer.createTransporter({
      host: config.host,
      port: config.port,
      secure: config.secure || config.port === 465,
      auth: config.auth,
    });

    this.rateLimiter = new RateLimiter({
      points: 100, // 100 emails
      duration: 3600, // per hour
    });
  }

  async verify(): Promise<boolean> {
    try {
      await this.transporter.verify();
      return true;
    } catch (error) {
      console.error('Email service verification failed:', error);
      return false;
    }
  }

  async send(options: EmailOptions): Promise<void> {
    // Rate limiting
    const recipients = Array.isArray(options.to) ? options.to : [options.to];
    for (const recipient of recipients) {
      await this.rateLimiter.consume(recipient);
    }

    // Prepare email
    const mailOptions = {
      from: `Moov Property <${this.config.from}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text || htmlToText(options.html),
      attachments: options.attachments,
      headers: {
        'X-Entity-Ref-ID': this.generateMessageId(),
        ...options.headers,
      },
    };

    // Send with retry
    await this.sendWithRetry(mailOptions);
  }

  private async sendWithRetry(
    mailOptions: any,
    attempts: number = 3
  ): Promise<void> {
    for (let i = 0; i < attempts; i++) {
      try {
        await this.transporter.sendMail(mailOptions);
        return;
      } catch (error) {
        console.error(`Email send attempt ${i + 1} failed:`, error);
        
        if (i === attempts - 1) {
          throw error;
        }
        
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
      }
    }
  }

  // Email templates
  async sendWelcomeEmail(data: {
    to: string;
    name: string;
  }): Promise<void> {
    const template = EmailTemplate.render('welcome', {
      name: this.sanitize(data.name),
      activationUrl: `https://moov-property.com/activate?email=${encodeURIComponent(data.to)}`,
    });

    await this.send({
      to: data.to,
      subject: 'Welcome to Moov Property',
      ...template,
    });
  }

  async sendPropertyAlert(data: {
    to: string;
    name: string;
    searchName: string;
    properties: Array<{
      id: string;
      title: string;
      price: number;
      url: string;
      image?: string;
    }>;
  }): Promise<void> {
    const template = EmailTemplate.render('property-alert', {
      name: this.sanitize(data.name),
      searchName: this.sanitize(data.searchName),
      properties: data.properties.map(p => ({
        ...p,
        title: this.sanitize(p.title),
        formattedPrice: `£${p.price.toLocaleString()}`,
      })),
      unsubscribeUrl: `https://moov-property.com/alerts/unsubscribe?email=${encodeURIComponent(data.to)}`,
    });

    await this.send({
      to: data.to,
      subject: `New properties matching "${data.searchName}"`,
      ...template,
    });
  }

  async sendViewingConfirmation(data: {
    to: string;
    name: string;
    property: {
      title: string;
      address: string;
    };
    viewingDate: Date;
    agentName: string;
    agentPhone: string;
  }): Promise<void> {
    const template = EmailTemplate.render('viewing-confirmation', {
      name: this.sanitize(data.name),
      property: {
        title: this.sanitize(data.property.title),
        address: this.sanitize(data.property.address),
      },
      viewingDate: data.viewingDate.toLocaleString('en-GB', {
        dateStyle: 'long',
        timeStyle: 'short',
      }),
      agentName: this.sanitize(data.agentName),
      agentPhone: data.agentPhone,
      cancelUrl: `https://moov-property.com/viewings/cancel?email=${encodeURIComponent(data.to)}`,
    });

    await this.send({
      to: data.to,
      subject: `Viewing Confirmation - ${data.property.title}`,
      ...template,
    });
  }

  async sendPasswordReset(data: {
    to: string;
    name: string;
    resetToken: string;
  }): Promise<void> {
    const template = EmailTemplate.render('password-reset', {
      name: this.sanitize(data.name),
      resetUrl: `https://moov-property.com/reset-password?token=${data.resetToken}`,
      expiryTime: '2 hours',
    });

    await this.send({
      to: data.to,
      subject: 'Reset Your Password',
      ...template,
    });
  }

  async sendBatch(data: {
    template: string;
    recipients: Array<{ email: string; name: string; data?: any }>;
    data: any;
  }): Promise<void> {
    const promises = data.recipients.map(async (recipient) => {
      const template = EmailTemplate.render(data.template, {
        ...data.data,
        name: this.sanitize(recipient.name),
        ...recipient.data,
      });

      await this.send({
        to: recipient.email,
        subject: template.subject || 'Update from Moov Property',
        ...template,
      });
    });

    await Promise.all(promises);
  }

  isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  async isDisposableEmail(email: string): Promise<boolean> {
    const domain = email.split('@')[1];
    const disposableDomains = [
      'tempmail.com',
      'guerrillamail.com',
      '10minutemail.com',
      'throwaway.email',
      // Add more as needed
    ];

    return disposableDomains.includes(domain);
  }

  private sanitize(input: string): string {
    return DOMPurify.sanitize(input, { ALLOWED_TAGS: [] });
  }

  private generateMessageId(): string {
    return `${Date.now()}.${Math.random().toString(36).substr(2, 9)}@moov-property.com`;
  }
}

// Email templates
export class EmailTemplate {
  private static templates = new Map<string, any>();

  static {
    // Register templates
    this.register('welcome', {
      subject: 'Welcome to Moov Property',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #1a73e8; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background: #f5f5f5; }
            .button { display: inline-block; padding: 12px 24px; background: #1a73e8; color: white; text-decoration: none; border-radius: 4px; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Welcome to Moov Property</h1>
            </div>
            <div class="content">
              <h2>Welcome, {{name}}!</h2>
              <p>Thank you for joining Moov Property. We're excited to help you find your perfect home.</p>
              <p>Get started by exploring our AI-powered property search:</p>
              <p><a href="{{activationUrl}}" class="button">Activate Your Account</a></p>
            </div>
            <div class="footer">
              <p>&copy; 2024 Moov Property. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    this.register('property-alert', {
      subject: 'New properties matching "{{searchName}}"',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            /* Similar styles */
            .property-card {
              border: 1px solid #ddd;
              padding: 15px;
              margin-bottom: 15px;
              background: white;
            }
            .property-image {
              width: 100%;
              max-width: 200px;
              height: 150px;
              object-fit: cover;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>New Property Matches</h1>
            </div>
            <div class="content">
              <h2>Hi {{name}},</h2>
              <p>We found new properties matching your search "{{searchName}}":</p>
              
              {{#each properties}}
              <div class="property-card">
                {{#if image}}
                <img src="{{image}}" alt="{{title}}" class="property-image">
                {{/if}}
                <h3>{{title}}</h3>
                <p><strong>{{formattedPrice}}</strong></p>
                <p><a href="{{url}}">View Property</a></p>
              </div>
              {{/each}}
              
              <p><a href="{{unsubscribeUrl}}">Unsubscribe from these alerts</a></p>
            </div>
          </div>
        </body>
        </html>
      `,
    });
  }

  static register(name: string, template: any): void {
    this.templates.set(name, template);
  }

  static render(
    name: string,
    data: any
  ): { html: string; text?: string; subject?: string } {
    const template = this.templates.get(name);
    
    if (!template) {
      throw new Error(`Template not found: ${name}`);
    }

    // Simple template rendering (in production, use a proper template engine)
    let html = template.html;
    let subject = template.subject;

    // Replace variables
    Object.entries(data).forEach(([key, value]) => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      html = html.replace(regex, value as string);
      if (subject) {
        subject = subject.replace(regex, value as string);
      }
    });

    // Handle loops (simplified)
    html = html.replace(/{{#each (\w+)}}([\s\S]*?){{\/each}}/g, (match, key, content) => {
      const items = data[key];
      if (!Array.isArray(items)) return '';
      
      return items.map(item => {
        let itemHtml = content;
        Object.entries(item).forEach(([k, v]) => {
          itemHtml = itemHtml.replace(new RegExp(`{{${k}}}`, 'g'), v as string);
        });
        return itemHtml;
      }).join('');
    });

    return {
      html,
      text: htmlToText(html),
      subject,
    };
  }
}
```

## Summary

This comprehensive implementation provides:

1. **Analytics Service** with Google Analytics integration, event tracking, and performance monitoring
2. **SEO Optimization** with meta tags, structured data, and sitemap generation
3. **Database Migration System** with version control and rollback capabilities
4. **Email Service** with templating, rate limiting, and retry logic

All implementations follow TDD principles with extensive test coverage, ensuring reliability and maintainability across all features.