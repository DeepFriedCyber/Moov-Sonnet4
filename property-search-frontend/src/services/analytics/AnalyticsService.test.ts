import { AnalyticsService } from './AnalyticsService';

// Mock localStorage
const mockLocalStorage = () => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
  };
};

describe('AnalyticsService', () => {
  let analytics: AnalyticsService;
  let mockGtag: jest.Mock;
  let mockDataLayer: any[];

  beforeEach(() => {
    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: mockLocalStorage(),
    });

    mockDataLayer = [];
    mockGtag = jest.fn((command, ...args) => {
      if (command === 'event') {
        mockDataLayer.push({ command, ...args[0] });
      }
    });
    
    (window as any).gtag = mockGtag;
    (window as any).dataLayer = mockDataLayer;

    // Mock document.createElement and appendChild
    document.createElement = jest.fn().mockReturnValue({
      async: true,
      src: '',
    });
    document.head.appendChild = jest.fn();

    analytics = new AnalyticsService({
      measurementId: 'G-TESTID123',
      enableDebug: false,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize Google Analytics', () => {
      expect(document.createElement).toHaveBeenCalledWith('script');
      expect(document.head.appendChild).toHaveBeenCalled();
      expect(mockGtag).toHaveBeenCalledWith('js', expect.any(Date));
      expect(mockGtag).toHaveBeenCalledWith('config', 'G-TESTID123', {
        debug_mode: false,
        anonymize_ip: undefined,
      });
    });

    it('should initialize with debug mode', () => {
      new AnalyticsService({
        measurementId: 'G-TESTID123',
        enableDebug: true,
      });

      expect(mockGtag).toHaveBeenCalledWith('config', 'G-TESTID123', {
        debug_mode: true,
        anonymize_ip: undefined,
      });
    });

    it('should initialize with IP anonymization', () => {
      new AnalyticsService({
        measurementId: 'G-TESTID123',
        anonymizeIp: true,
      });

      expect(mockGtag).toHaveBeenCalledWith('config', 'G-TESTID123', {
        debug_mode: undefined,
        anonymize_ip: true,
      });
    });
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
        page_referrer: undefined,
      });
    });

    it('should track virtual page views for SPA navigation', () => {
      // Mock window.location
      Object.defineProperty(window, 'location', {
        value: { origin: 'https://example.com' },
        writable: true,
      });

      analytics.trackVirtualPageView('/search', 'Search Results');

      expect(mockGtag).toHaveBeenCalledWith('event', 'page_view', {
        page_path: '/search',
        page_title: 'Search Results',
        page_location: 'https://example.com/search',
      });
    });

    it('should track page view with referrer', () => {
      analytics.trackPageView({
        path: '/properties/123',
        title: 'Property Details',
        referrer: 'https://google.com',
      });

      expect(mockGtag).toHaveBeenCalledWith('event', 'page_view', {
        page_path: '/properties/123',
        page_title: 'Property Details',
        page_referrer: 'https://google.com',
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

      expect(mockGtag).toHaveBeenCalledWith('event', 'search', {
        event_category: 'search',
        event_action: 'search_performed',
        search_term: 'modern apartment London',
        results_count: 25,
        filter_minPrice: 300000,
        filter_maxPrice: 500000,
        filter_bedrooms: 2,
      });
    });

    it('should track search events with duration', () => {
      analytics.trackSearch({
        searchQuery: 'apartment',
        resultsCount: 10,
        searchDuration: 150,
      });

      expect(mockGtag).toHaveBeenCalledWith('event', 'search', {
        event_category: 'search',
        event_action: 'search_performed',
        search_term: 'apartment',
        results_count: 10,
        timing_value: 150,
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

      expect(mockGtag).toHaveBeenCalledWith('event', 'view_item', {
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
        send_to: 'G-TESTID123/viewing_conversion',
        value: 450000,
        currency: 'GBP',
        transaction_id: expect.stringMatching(/^txn_\d+_[a-z0-9]+$/),
      });
    });

    it('should track engagement events', () => {
      analytics.trackEngagement('scroll_depth', {
        scroll_percentage: 75,
        page_path: '/properties/123',
      });

      expect(mockGtag).toHaveBeenCalledWith('event', 'engagement', {
        event_category: 'engagement',
        event_action: 'scroll_depth',
        scroll_percentage: 75,
        page_path: '/properties/123',
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
        items: [
          {
            item_id: '1',
            item_name: 'Apartment 1',
            price: 400000,
            index: 1,
            item_category: 'property',
          },
          {
            item_id: '2',
            item_name: 'Apartment 2',
            price: 450000,
            index: 2,
            item_category: 'property',
          },
        ],
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

    it('should track purchase begin', () => {
      analytics.trackPurchaseBegin({
        propertyId: 'prop-123',
        propertyTitle: 'Modern Apartment',
        price: 450000,
      });

      expect(mockGtag).toHaveBeenCalledWith('event', 'begin_checkout', {
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

      expect(mockGtag).toHaveBeenCalledWith('event', 'timing_complete', {
        name: 'dom_ready',
        value: 1000,
        event_category: 'performance',
      });
    });

    it('should track custom timing events', () => {
      jest.useFakeTimers();
      
      const timer = analytics.startTimer('search_api_call');
      
      // Simulate delay
      jest.advanceTimersByTime(150);
      
      timer.end();

      expect(mockGtag).toHaveBeenCalledWith('event', 'timing_complete', {
        name: 'search_api_call',
        value: expect.any(Number),
        event_category: 'performance',
      });

      jest.useRealTimers();
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
        userId: 'user-123',
      });
    });

    it('should set up automatic error tracking', () => {
      const addEventListenerSpy = jest.spyOn(window, 'addEventListener');
      
      new AnalyticsService({
        measurementId: 'G-TESTID123',
      });

      expect(addEventListenerSpy).toHaveBeenCalledWith('error', expect.any(Function));
      expect(addEventListenerSpy).toHaveBeenCalledWith('unhandledrejection', expect.any(Function));

      addEventListenerSpy.mockRestore();
    });
  });

  describe('Form and interaction tracking', () => {
    it('should track form submissions', () => {
      analytics.trackFormSubmission('contact_form', true);

      expect(mockGtag).toHaveBeenCalledWith('event', 'form_submit', {
        event_category: 'form',
        event_action: 'submit_success',
        form_name: 'contact_form',
      });
    });

    it('should track form submission errors', () => {
      analytics.trackFormSubmission('contact_form', false);

      expect(mockGtag).toHaveBeenCalledWith('event', 'form_submit', {
        event_category: 'form',
        event_action: 'submit_error',
        form_name: 'contact_form',
      });
    });

    it('should track video interactions', () => {
      analytics.trackVideoPlay('video-123', 'Property Tour');

      expect(mockGtag).toHaveBeenCalledWith('event', 'video_start', {
        event_category: 'video',
        video_title: 'Property Tour',
        video_id: 'video-123',
      });
    });

    it('should track file downloads', () => {
      analytics.trackDownload('brochure.pdf', 'pdf');

      expect(mockGtag).toHaveBeenCalledWith('event', 'file_download', {
        event_category: 'download',
        file_name: 'brochure.pdf',
        file_type: 'pdf',
      });
    });

    it('should track outbound links', () => {
      analytics.trackOutboundLink('https://external.com', 'External Link');

      expect(mockGtag).toHaveBeenCalledWith('event', 'click', {
        event_category: 'outbound',
        event_action: 'click',
        event_label: 'https://external.com',
        link_text: 'External Link',
      });
    });
  });

  describe('Social sharing', () => {
    it('should track social shares', () => {
      analytics.trackSocialShare('facebook', 'property', 'prop-123');

      expect(mockGtag).toHaveBeenCalledWith('event', 'share', {
        method: 'facebook',
        content_type: 'property',
        content_id: 'prop-123',
      });
    });
  });

  describe('Custom metrics', () => {
    it('should set custom dimensions', () => {
      analytics.setCustomDimension(1, 'premium_user');

      expect(mockGtag).toHaveBeenCalledWith('config', 'G-TESTID123', {
        'custom_map.dimension1': 'premium_user',
      });
    });

    it('should track custom metrics', () => {
      analytics.trackCustomMetric('search_filters_used', 3);

      expect(mockGtag).toHaveBeenCalledWith('event', 'custom_metric', {
        event_category: 'custom',
        metric_name: 'search_filters_used',
        metric_value: 3,
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

      // Should not track when consent is denied
      const pageViewCalls = mockGtag.mock.calls.filter(
        call => call[0] === 'event' && call[1] === 'page_view'
      );
      expect(pageViewCalls).toHaveLength(0);
    });

    it('should update consent settings', () => {
      analytics.updateConsent({
        analytics: true,
        marketing: false,
      });

      expect(mockGtag).toHaveBeenCalledWith('consent', 'update', {
        analytics_storage: 'granted',
        ad_storage: 'denied',
      });
    });

    it('should track when consent is granted', () => {
      analytics.updateConsent({
        analytics: true,
        marketing: true,
      });

      analytics.trackPageView({ path: '/test' });

      expect(mockGtag).toHaveBeenCalledWith('event', 'page_view', {
        page_path: '/test',
        page_title: undefined,
        page_referrer: undefined,
      });
    });
  });

  describe('Utility methods', () => {
    it('should format list names correctly', () => {
      const properties = [
        { id: '1', title: 'Test', price: 100000, position: 1 },
      ];

      analytics.trackPropertyImpressions(properties, 'search_results');

      expect(mockGtag).toHaveBeenCalledWith('event', 'view_item_list', 
        expect.objectContaining({
          item_list_name: 'Search Results',
        })
      );
    });

    it('should generate unique transaction IDs', () => {
      analytics.trackConversion({
        type: 'viewing_request',
        value: 100000,
      });

      analytics.trackConversion({
        type: 'contact_agent',
        value: 200000,
      });

      const calls = mockGtag.mock.calls.filter(call => call[1] === 'conversion');
      expect(calls[0][2].transaction_id).not.toBe(calls[1][2].transaction_id);
    });
  });

  describe('Error handling', () => {
    it('should handle missing window object gracefully', () => {
      const originalWindow = global.window;
      delete (global as any).window;

      expect(() => {
        new AnalyticsService({
          measurementId: 'G-TESTID123',
        });
      }).not.toThrow();

      global.window = originalWindow;
    });

    it('should handle missing performance API', () => {
      const originalPerformance = window.performance;
      delete (window as any).performance;

      expect(() => {
        analytics.trackPageLoadTime();
      }).not.toThrow();

      window.performance = originalPerformance;
    });
  });
});