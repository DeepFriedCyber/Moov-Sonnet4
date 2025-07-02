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

declare global {
    interface Window {
        gtag: (...args: any[]) => void;
        dataLayer: any[];
    }
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
        window.gtag = function () {
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

    private canTrack(): boolean {
        return this.isInitialized && this.consentGiven && typeof window !== 'undefined';
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

        window.gtag('event', 'search', eventData);
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

    trackPageLoadTime(): void {
        if (!this.canTrack() || !window.performance) return;

        const timing = window.performance.timing;
        const loadTime = timing.loadEventEnd - timing.navigationStart;
        const domReady = timing.domContentLoadedEventEnd - timing.navigationStart;

        window.gtag('event', 'timing_complete', {
            name: 'load',
            value: loadTime,
            event_category: 'performance',
        });

        window.gtag('event', 'timing_complete', {
            name: 'dom_ready',
            value: domReady,
            event_category: 'performance',
        });
    }

    startTimer(name: string): { end: () => void } {
        const startTime = performance.now();
        this.timers.set(name, startTime);

        return {
            end: () => {
                const endTime = performance.now();
                const duration = Math.round(endTime - startTime);

                window.gtag('event', 'timing_complete', {
                    name,
                    value: duration,
                    event_category: 'performance',
                });

                this.timers.delete(name);
            },
        };
    }

    trackError(error: Error, context?: Record<string, any>): void {
        if (!this.canTrack()) return;

        window.gtag('event', 'exception', {
            description: error.message,
            fatal: false,
            error_context: context?.context || 'unknown',
            error_stack: error.stack,
            ...context,
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

    updateConsent(consent: { analytics: boolean; marketing: boolean }): void {
        this.consentGiven = consent.analytics;

        if (this.canTrack()) {
            window.gtag('consent', 'update', {
                analytics_storage: consent.analytics ? 'granted' : 'denied',
                ad_storage: consent.marketing ? 'granted' : 'denied',
            });
        }
    }

    // Utility methods
    private formatListName(listName: string): string {
        return listName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }

    private getConversionId(type: ConversionData['type']): string {
        const conversionIds = {
            viewing_request: 'viewing_conversion',
            contact_agent: 'contact_conversion',
            save_search: 'search_save_conversion',
        };
        return conversionIds[type] || 'general_conversion';
    }

    private generateTransactionId(): string {
        return `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // Enhanced ecommerce tracking
    trackPurchaseBegin(data: {
        propertyId: string;
        propertyTitle: string;
        price: number;
    }): void {
        if (!this.canTrack()) return;

        window.gtag('event', 'begin_checkout', {
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

    trackFormSubmission(formName: string, success: boolean): void {
        if (!this.canTrack()) return;

        window.gtag('event', 'form_submit', {
            event_category: 'form',
            event_action: success ? 'submit_success' : 'submit_error',
            form_name: formName,
        });
    }

    trackVideoPlay(videoId: string, videoTitle: string): void {
        if (!this.canTrack()) return;

        window.gtag('event', 'video_start', {
            event_category: 'video',
            video_title: videoTitle,
            video_id: videoId,
        });
    }

    trackDownload(fileName: string, fileType: string): void {
        if (!this.canTrack()) return;

        window.gtag('event', 'file_download', {
            event_category: 'download',
            file_name: fileName,
            file_type: fileType,
        });
    }

    trackOutboundLink(url: string, linkText?: string): void {
        if (!this.canTrack()) return;

        window.gtag('event', 'click', {
            event_category: 'outbound',
            event_action: 'click',
            event_label: url,
            link_text: linkText,
        });
    }

    // Social sharing tracking
    trackSocialShare(platform: string, contentType: string, contentId: string): void {
        if (!this.canTrack()) return;

        window.gtag('event', 'share', {
            method: platform,
            content_type: contentType,
            content_id: contentId,
        });
    }

    // Custom dimensions and metrics
    setCustomDimension(index: number, value: string): void {
        if (!this.canTrack()) return;

        window.gtag('config', this.config.measurementId, {
            [`custom_map.dimension${index}`]: value,
        });
    }

    trackCustomMetric(name: string, value: number): void {
        if (!this.canTrack()) return;

        window.gtag('event', 'custom_metric', {
            event_category: 'custom',
            metric_name: name,
            metric_value: value,
        });
    }
}

// Singleton instance
let analyticsInstance: AnalyticsService | null = null;

export function getAnalyticsService(config?: AnalyticsConfig): AnalyticsService {
    if (!analyticsInstance && config) {
        analyticsInstance = new AnalyticsService(config);
    }

    if (!analyticsInstance) {
        throw new Error('Analytics service not initialized. Provide config on first call.');
    }

    return analyticsInstance;
}

// React hook for analytics
export function useAnalytics() {
    const analytics = analyticsInstance;

    if (!analytics) {
        throw new Error('Analytics service not initialized. Call getAnalyticsService first.');
    }

    return analytics;
}