// Smart POI Service with Efficient Data Management
import { POIRelevanceScorer } from './poiRelevanceScorer';

export interface Location {
    lat: number;
    lng: number;
}

export interface POI {
    id: string;
    name: string;
    category: string;
    rating?: number;
    reviewCount?: number;
    coordinates: Location;
    distance?: number;
    relevanceScore?: number;
}

export interface CachedPOIData {
    data: POI[];
    timestamp: number;
    ttl: number;
}

export interface BatchRequest {
    location: Location;
    category: string;
    radius: number;
    resolve: (pois: POI[]) => void;
}

export type POICategory = 'schools' | 'transport' | 'supermarkets' | 'restaurants' |
    'hospitals' | 'parks' | 'gyms' | 'nightlife' | 'shopping';

export class POIService {
    private cache: Map<string, CachedPOIData> = new Map();
    private batchRequestQueue: BatchRequest[] = [];
    private batchTimer: NodeJS.Timeout | null = null;
    private relevanceScorer: POIRelevanceScorer;
    private readonly BATCH_DELAY = 100; // 100ms batching window
    private readonly CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
    private readonly GROUPING_DISTANCE = 500; // 500m for grouping requests
    private readonly MAX_CONCURRENT_REQUESTS = 3;
    private activeRequests = 0;
    private requestQueue: (() => Promise<void>)[] = [];

    constructor(
        private externalAPI: any,
        private redis?: any
    ) {
        this.relevanceScorer = new POIRelevanceScorer();
    }

    async getNearbyPOIs(
        location: Location,
        category: POICategory,
        radius: number = 1000
    ): Promise<POI[]> {
        const cacheKey = this.generateCacheKey(location, category, radius);

        // Check local cache first
        const cached = this.cache.get(cacheKey);
        if (cached && !this.isCacheExpired(cached)) {
            return cached.data;
        }

        // Check Redis cache
        if (this.redis) {
            try {
                const redisCached = await this.redis.get(`poi:${cacheKey}`);
                if (redisCached) {
                    const parsedData = JSON.parse(redisCached);
                    if (!this.isCacheExpired(parsedData)) {
                        // Store in local cache for faster future access
                        this.cache.set(cacheKey, parsedData);
                        return parsedData.data;
                    }
                }
            } catch (error) {
                console.warn('Redis cache error:', error);
            }
        }

        // Add to batch queue for efficiency
        return this.addToBatchQueue(location, category, radius);
    }

    async batchGetPOIs(
        locations: Location[],
        categories: POICategory[]
    ): Promise<POI[][]> {
        const requests = locations.flatMap(location =>
            categories.map(category => ({ location, category, radius: 1000 }))
        );

        const results = await Promise.all(
            requests.map(req => this.getNearbyPOIs(req.location, req.category, req.radius))
        );

        // Reshape results back to [location][category] format
        const reshapedResults: POI[][] = [];
        for (let i = 0; i < locations.length; i++) {
            for (let j = 0; j < categories.length; j++) {
                const index = i * categories.length + j;
                reshapedResults.push(results[index]);
            }
        }

        return reshapedResults;
    }

    private addToBatchQueue(
        location: Location,
        category: POICategory,
        radius: number
    ): Promise<POI[]> {
        return new Promise((resolve) => {
            this.batchRequestQueue.push({ location, category, radius, resolve });

            // Process batch after short delay (allows grouping nearby requests)
            if (!this.batchTimer) {
                this.batchTimer = setTimeout(() => {
                    this.processBatchRequests();
                }, this.BATCH_DELAY);
            }
        });
    }

    async batchProcessRequests(requests?: BatchRequest[]): Promise<void> {
        const requestsToProcess = requests || [...this.batchRequestQueue];
        if (!requests) {
            this.batchRequestQueue = [];
            this.batchTimer = null;
        }

        if (requestsToProcess.length === 0) return;

        // Group requests by geographic proximity
        const requestGroups = this.groupRequestsByLocation(requestsToProcess, this.GROUPING_DISTANCE);

        // Process each group
        await Promise.all(requestGroups.map(group => this.processRequestGroup(group)));
    }

    private async processBatchRequests(): Promise<void> {
        await this.batchProcessRequests();
    }

    private async processRequestGroup(group: BatchRequest[]): Promise<void> {
        if (group.length === 0) return;

        // Wait for available slot if we're at max concurrent requests
        await this.waitForAvailableSlot();

        try {
            this.activeRequests++;

            const centerLocation = this.calculateCenter(group.map(r => r.location));
            const allCategories = [...new Set(group.map(r => r.category))];
            const maxRadius = Math.max(...group.map(r => r.radius));

            // Single API call for all categories at this location
            const poisByCategory = await this.externalAPI.getPOIsMultiCategory(
                centerLocation,
                allCategories,
                maxRadius
            );

            // Distribute results to all requesters
            group.forEach(request => {
                const relevantPOIs = this.filterPOIsForRequest(
                    poisByCategory[request.category] || [],
                    request
                );

                // Cache the result
                this.cacheResult(request, relevantPOIs);

                request.resolve(relevantPOIs);
            });

        } catch (error) {
            console.error('Error processing POI request group:', error);

            // Resolve all requests with empty arrays on error
            group.forEach(request => request.resolve([]));

        } finally {
            this.activeRequests--;
            this.processQueue();
        }
    }

    private async waitForAvailableSlot(): Promise<void> {
        if (this.activeRequests < this.MAX_CONCURRENT_REQUESTS) {
            return;
        }

        return new Promise<void>((resolve) => {
            this.requestQueue.push(async () => resolve());
        });
    }

    private processQueue(): void {
        if (this.requestQueue.length > 0 && this.activeRequests < this.MAX_CONCURRENT_REQUESTS) {
            const nextRequest = this.requestQueue.shift();
            if (nextRequest) {
                nextRequest();
            }
        }
    }

    private groupRequestsByLocation(
        requests: BatchRequest[],
        groupingDistance: number
    ): BatchRequest[][] {
        const groups: BatchRequest[][] = [];
        const processed = new Set<number>();

        for (let i = 0; i < requests.length; i++) {
            if (processed.has(i)) continue;

            const group = [requests[i]];
            processed.add(i);

            // Find nearby requests to group together
            for (let j = i + 1; j < requests.length; j++) {
                if (processed.has(j)) continue;

                const distance = this.calculateDistance(
                    requests[i].location,
                    requests[j].location
                );

                if (distance <= groupingDistance) {
                    group.push(requests[j]);
                    processed.add(j);
                }
            }

            groups.push(group);
        }

        return groups;
    }

    private calculateCenter(locations: Location[]): Location {
        const lat = locations.reduce((sum, loc) => sum + loc.lat, 0) / locations.length;
        const lng = locations.reduce((sum, loc) => sum + loc.lng, 0) / locations.length;
        return { lat, lng };
    }

    private calculateDistance(loc1: Location, loc2: Location): number {
        // Haversine formula for distance calculation
        const R = 6371000; // Earth's radius in meters
        const dLat = this.toRadians(loc2.lat - loc1.lat);
        const dLng = this.toRadians(loc2.lng - loc1.lng);

        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(this.toRadians(loc1.lat)) * Math.cos(this.toRadians(loc2.lat)) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);

        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    private toRadians(degrees: number): number {
        return degrees * (Math.PI / 180);
    }

    private filterPOIsForRequest(pois: POI[], request: BatchRequest): POI[] {
        return pois
            .map(poi => ({
                ...poi,
                distance: this.calculateDistance(request.location, poi.coordinates)
            }))
            .filter(poi => poi.distance! <= request.radius)
            .sort((a, b) => a.distance! - b.distance!);
    }

    private cacheResult(request: BatchRequest, pois: POI[]): void {
        const cacheKey = this.generateCacheKey(request.location, request.category, request.radius);
        const cacheData: CachedPOIData = {
            data: pois,
            timestamp: Date.now(),
            ttl: this.CACHE_TTL
        };

        // Store in local cache
        this.cache.set(cacheKey, cacheData);

        // Store in Redis cache
        if (this.redis) {
            try {
                this.redis.setex(
                    `poi:${cacheKey}`,
                    Math.floor(this.CACHE_TTL / 1000), // Redis expects seconds
                    JSON.stringify(cacheData)
                );
            } catch (error) {
                console.warn('Failed to cache in Redis:', error);
            }
        }
    }

    private generateCacheKey(location: Location, category: string, radius: number): string {
        // Round coordinates to reduce cache key variations
        const roundedLat = Math.round(location.lat * 1000) / 1000;
        const roundedLng = Math.round(location.lng * 1000) / 1000;
        return `${roundedLat},${roundedLng},${category},${radius}`;
    }

    private isCacheExpired(cached: CachedPOIData): boolean {
        return Date.now() - cached.timestamp > cached.ttl;
    }

    // Enhanced methods for property-specific POI recommendations
    async getPOIsForProperty(
        property: any,
        categories: POICategory[] = ['schools', 'transport', 'supermarkets', 'parks']
    ): Promise<{ category: string; pois: POI[] }[]> {
        const location = property.location.coordinates;

        // Get POIs for all categories
        const poisByCategory = await Promise.all(
            categories.map(async category => ({
                category,
                pois: await this.getNearbyPOIs(location, category)
            }))
        );

        // Score and sort POIs by relevance to property
        return poisByCategory.map(({ category, pois }) => ({
            category,
            pois: pois
                .map(poi => ({
                    ...poi,
                    relevanceScore: this.relevanceScorer.scorePOI(poi, property, poi.distance || 0)
                }))
                .sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0))
                .slice(0, 10) // Top 10 most relevant POIs per category
        }));
    }

    async getTopPOIsForProperty(
        property: any,
        limit: number = 20
    ): Promise<POI[]> {
        const allCategories: POICategory[] = [
            'schools', 'transport', 'supermarkets', 'restaurants',
            'hospitals', 'parks', 'gyms', 'shopping'
        ];

        const poisByCategory = await this.getPOIsForProperty(property, allCategories);

        // Flatten and get top POIs across all categories
        const allPOIs = poisByCategory.flatMap(({ pois }) => pois);

        return allPOIs
            .sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0))
            .slice(0, limit);
    }

    // Utility methods
    clearCache(): void {
        this.cache.clear();

        if (this.redis) {
            // Clear Redis POI cache (be careful in production!)
            this.redis.eval(`
        for i, name in ipairs(redis.call('KEYS', 'poi:*')) do
          redis.call('DEL', name)
        end
      `, 0);
        }
    }

    getCacheStats(): any {
        const localCacheSize = this.cache.size;
        const activeRequestsCount = this.activeRequests;
        const queuedRequestsCount = this.requestQueue.length;

        return {
            localCacheSize,
            activeRequestsCount,
            queuedRequestsCount,
            batchQueueSize: this.batchRequestQueue.length
        };
    }
}