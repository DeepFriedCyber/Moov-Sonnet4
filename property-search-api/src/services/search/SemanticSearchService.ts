import { QueryParser } from './QueryParser';
import { SearchQuery, SearchResult, PropertyMatch, SearchFacets } from '@/types/search';
import { Logger } from '@/types/logger';
import { CACHE_TTL_SECONDS, SEARCH_RESULT_LIMIT, rankingWeights } from '@/config';

interface DatabaseService {
  query(sql: string, params: any[]): Promise<any[]>;
}

interface EmbeddingService {
  generateEmbedding(text: string): Promise<number[]>;
}

interface CacheService {
  get(key: string): Promise<any>;
  set(key: string, value: any, ttl: number): Promise<void>;
}



export class SemanticSearchService {
  constructor(
    private db: DatabaseService,
    private embedding: EmbeddingService,
    private cache: CacheService,
    private queryParser: QueryParser,
    private logger: Logger // Inject the logger
  ) { }

  async search(query: string, filters?: any): Promise<SearchResult> {
    // Check cache first (handle cache errors gracefully)
    const cacheKey = this.generateCacheKey(query, filters);
    let cached;
    try {
      cached = await this.cache.get(cacheKey);
      if (cached) return cached;
    } catch (error) {
      // Cache error - continue without cache
      console.warn('Cache get error:', error);
    }

    // Parse the natural language query
    const parsedQuery = this.queryParser.parse(query);

    // Generate embedding for semantic search
    const queryEmbedding = await this.embedding.generateEmbedding(query);

    // Build the search query
    const searchParams = this.buildSearchParams(parsedQuery, filters);

    // Execute semantic search
    const properties = await this.executeSemanticSearch(
      queryEmbedding,
      searchParams
    );

    // Re-rank results based on multiple factors
    const rankedResults = await this.reRankResults(
      properties,
      parsedQuery,
      queryEmbedding
    );

    // Generate facets for filtering
    const facets = await this.generateFacets(searchParams);

    // Cache the results
    const result: SearchResult = {
      properties: rankedResults,
      query: parsedQuery,
      totalCount: rankedResults.length,
      facets,
    };

    // Cache the results (handle cache errors gracefully)
    try {
      await this.cache.set(cacheKey, result, CACHE_TTL_SECONDS);
    } catch (error) {
      // Cache error - continue without caching
      console.warn('Cache set error:', error);
    }

    return result;
  }

  private async executeSemanticSearch(
    embedding: number[],
    params: any
  ): Promise<PropertyMatch[]> {
    // Build dynamic SQL query based on filters
    const conditions: string[] = ['p.status = $2'];
    const queryParams: any[] = [embedding, 'ACTIVE'];
    let paramIndex = 3;

    if (params.city) {
      conditions.push(`p.city = $${paramIndex}`);
      queryParams.push(params.city);
      paramIndex++;
    }

    if (params.minPrice) {
      conditions.push(`p.price >= $${paramIndex}`);
      queryParams.push(params.minPrice);
      paramIndex++;
    }

    if (params.maxPrice) {
      conditions.push(`p.price <= $${paramIndex}`);
      queryParams.push(params.maxPrice);
      paramIndex++;
    }

    if (params.propertyType) {
      conditions.push(`p.property_type = $${paramIndex}`);
      queryParams.push(params.propertyType);
      paramIndex++;
    }

    if (params.bedrooms) {
      conditions.push(`p.bedrooms >= $${paramIndex}`);
      queryParams.push(params.bedrooms);
      paramIndex++;
    }

    if (params.bathrooms) {
      conditions.push(`p.bathrooms >= $${paramIndex}`);
      queryParams.push(params.bathrooms);
      paramIndex++;
    }

    // Use pgvector for similarity search
    const sql = `
      SELECT 
        p.id,
        p.title,
        p.price,
        p.city,
        p.postcode,
        p.bedrooms,
        p.bathrooms,
        p.property_type,
        p.features,
        p.listed_date,
        p.embedding <=> $1::vector as distance,
        1 - (p.embedding <=> $1::vector) as similarity_score
      FROM properties p
      WHERE ${conditions.join(' AND ')}
      ORDER BY distance
      LIMIT ${SEARCH_RESULT_LIMIT}
    `;

    const results = await this.db.query(sql, queryParams);
    return results.map(this.mapToPropertyMatch);
  }

  private async reRankResults(
    properties: PropertyMatch[],
    parsedQuery: any,
    queryEmbedding: number[]
  ): Promise<PropertyMatch[]> {
    // Multi-factor ranking using configurable weights
    return properties.map(property => {
      const initialScore = property.similarity_score;
      let score = initialScore * rankingWeights.baseScore; // Base semantic score

      // Track individual boosts for debugging
      const boosts: Record<string, number> = {
        baseScore: initialScore * rankingWeights.baseScore
      };

      // Location relevance
      if (parsedQuery.location) {
        if (property.city === parsedQuery.location.city) {
          boosts.cityMatch = rankingWeights.cityMatch;
          score += rankingWeights.cityMatch;
        }
        if (property.postcode?.startsWith(parsedQuery.location.postcode?.substring(0, 3))) {
          boosts.postcodePrefixMatch = rankingWeights.postcodePrefixMatch;
          score += rankingWeights.postcodePrefixMatch;
        }
      }

      // Feature matching
      const matchedFeatures = parsedQuery.features.filter(
        (feature: string) => property.features.includes(feature)
      );
      if (matchedFeatures.length > 0) {
        boosts.featureMatch = matchedFeatures.length * rankingWeights.featureMatch;
        boosts.matchedFeatures = matchedFeatures;
        score += boosts.featureMatch;
      }

      // Price relevance
      if (parsedQuery.budget) {
        const priceInRange =
          property.price >= (parsedQuery.budget.minPrice || 0) &&
          property.price <= (parsedQuery.budget.maxPrice || Infinity);
        if (priceInRange) {
          boosts.priceInRange = rankingWeights.priceInRange;
          score += rankingWeights.priceInRange;
        }
      }

      // Room matching
      if (parsedQuery.rooms.bedrooms && property.bedrooms >= parsedQuery.rooms.bedrooms) {
        boosts.bedroomMatch = rankingWeights.bedroomMatch;
        score += rankingWeights.bedroomMatch;
      }
      if (parsedQuery.rooms.bathrooms && property.bathrooms >= parsedQuery.rooms.bathrooms) {
        boosts.bathroomMatch = rankingWeights.bathroomMatch;
        score += rankingWeights.bathroomMatch;
      }

      // Property type matching
      if (parsedQuery.propertyType && property.propertyType === parsedQuery.propertyType) {
        boosts.propertyTypeMatch = rankingWeights.propertyTypeMatch;
        score += rankingWeights.propertyTypeMatch;
      }

      // Freshness boost
      const daysSinceListed =
        (Date.now() - new Date(property.listedDate).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceListed < 7) {
        boosts.freshnessBoost = rankingWeights.freshnessBoost;
        score += rankingWeights.freshnessBoost;
      }
      if (daysSinceListed < 1) {
        boosts.superFreshnessBoost = rankingWeights.superFreshnessBoost;
        score += rankingWeights.superFreshnessBoost;
      }

      const finalScore = Math.min(score, 1);

      // Log detailed ranking information for debugging
      this.logger.debug(`Re-ranking property ID: ${property.id}`, {
        propertyId: property.id,
        initialScore,
        finalScore,
        boosts,
        property: {
          id: property.id,
          title: property.title,
          city: property.city,
          price: property.price,
          features: property.features,
          daysSinceListed: Math.round(daysSinceListed * 10) / 10
        }
      });

      return {
        ...property,
        relevanceScore: finalScore,
      };
    }).sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
  }

  private buildSearchParams(parsedQuery: any, filters: any = {}): any {
    return {
      city: parsedQuery.location.city || filters.city,
      minPrice: parsedQuery.budget.minPrice || filters.minPrice,
      maxPrice: parsedQuery.budget.maxPrice || filters.maxPrice,
      propertyType: parsedQuery.propertyType || filters.propertyType,
      bedrooms: parsedQuery.rooms.bedrooms || filters.bedrooms,
      bathrooms: parsedQuery.rooms.bathrooms || filters.bathrooms,
      features: [...parsedQuery.features, ...(filters.features || [])],
    };
  }

  private async generateFacets(searchParams: any): Promise<SearchFacets> {
    // Generate facets for filtering UI
    const [priceRanges, propertyTypes, locations, features] = await Promise.all([
      this.getPriceRangeFacets(),
      this.getPropertyTypeFacets(),
      this.getLocationFacets(),
      this.getFeatureFacets(),
    ]);

    return {
      priceRanges,
      propertyTypes,
      locations,
      features,
    };
  }

  private async getPriceRangeFacets() {
    const sql = `
      SELECT 
        CASE 
          WHEN price < 200000 THEN 'Under £200k'
          WHEN price < 400000 THEN '£200k - £400k'
          WHEN price < 600000 THEN '£400k - £600k'
          WHEN price < 800000 THEN '£600k - £800k'
          WHEN price < 1000000 THEN '£800k - £1M'
          ELSE 'Over £1M'
        END as range,
        COUNT(*) as count
      FROM properties 
      WHERE status = 'ACTIVE'
      GROUP BY range
      ORDER BY MIN(price)
    `;

    const results = await this.db.query(sql, []);
    return results.map(r => ({
      min: this.extractMinPrice(r.range),
      max: this.extractMaxPrice(r.range),
      count: parseInt(r.count),
    }));
  }

  private async getPropertyTypeFacets() {
    const sql = `
      SELECT property_type as type, COUNT(*) as count
      FROM properties 
      WHERE status = 'ACTIVE'
      GROUP BY property_type
      ORDER BY count DESC
    `;

    const results = await this.db.query(sql, []);
    return results.map(r => ({
      type: r.type,
      count: parseInt(r.count),
    }));
  }

  private async getLocationFacets() {
    const sql = `
      SELECT city, COUNT(*) as count
      FROM properties 
      WHERE status = 'ACTIVE'
      GROUP BY city
      ORDER BY count DESC
      LIMIT 20
    `;

    const results = await this.db.query(sql, []);
    return results.map(r => ({
      city: r.city,
      count: parseInt(r.count),
    }));
  }

  private async getFeatureFacets() {
    const sql = `
      SELECT 
        unnest(features) as feature,
        COUNT(*) as count
      FROM properties 
      WHERE status = 'ACTIVE'
      GROUP BY feature
      ORDER BY count DESC
      LIMIT 20
    `;

    const results = await this.db.query(sql, []);
    return results.map(r => ({
      feature: r.feature,
      count: parseInt(r.count),
    }));
  }

  private mapToPropertyMatch(row: any): PropertyMatch {
    return {
      id: row.id,
      title: row.title,
      price: row.price,
      city: row.city,
      postcode: row.postcode,
      features: row.features || [],
      bedrooms: row.bedrooms,
      bathrooms: row.bathrooms,
      propertyType: row.property_type,
      listedDate: row.listed_date,
      similarity_score: parseFloat(row.similarity_score),
    };
  }

  private extractMinPrice(range: string): number {
    if (range.includes('Under')) return 0;
    const match = range.match(/£(\d+)k/);
    return match ? parseInt(match[1]) * 1000 : 0;
  }

  private extractMaxPrice(range: string): number {
    if (range.includes('Over')) return Infinity;
    const matches = range.match(/£(\d+)k/g);
    if (matches && matches.length > 1) {
      const match = matches[1].match(/£(\d+)k/);
      return match ? parseInt(match[1]) * 1000 : Infinity;
    }
    return Infinity;
  }

  private generateCacheKey(query: string, filters: any): string {
    return `search:${Buffer.from(JSON.stringify({ query, filters })).toString('base64')}`;
  }
}