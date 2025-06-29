// TDD-Enhanced Semantic Search Service
import { Property } from '@/types';

export interface SemanticAnalysis {
  intent: string;
  extractedFilters: SearchFilters;
  suggestions: string[];
  confidence: number;
  keywords: string[];
  sentiment: 'positive' | 'neutral' | 'negative';
}

export interface SearchFilters {
  query?: string;
  minPrice?: number;
  maxPrice?: number;
  bedrooms?: number;
  bathrooms?: number;
  propertyType?: Property['propertyType'];
  location?: string;
  minArea?: number;
  maxArea?: number;
  features?: string[];
}

export interface EnhancedProperty extends Property {
  relevanceScore?: number;
  matchReasons?: string[];
  matchKeywords?: string[];
  semanticScore?: number;
}

export interface SearchResults {
  properties: EnhancedProperty[];
  total: number;
  page: number;
  totalPages: number;
  filters: SearchFilters;
  searchTime: number;
  averageRelevance: number;
  semanticAnalysis?: SemanticAnalysis;
}

export class SemanticSearchService {
  private readonly LOCATION_KEYWORDS = [
    'london', 'manchester', 'birmingham', 'leeds', 'glasgow', 'liverpool',
    'bristol', 'sheffield', 'edinburgh', 'cardiff', 'belfast', 'newcastle',
    'nottingham', 'brighton', 'oxford', 'cambridge', 'bath', 'york',
    'central', 'downtown', 'city center', 'suburb', 'outskirts'
  ];

  private readonly PROPERTY_TYPE_KEYWORDS = {
    'house': ['house', 'home', 'detached', 'semi-detached', 'terraced', 'cottage', 'villa', 'mansion'],
    'apartment': ['apartment', 'flat', 'studio', 'penthouse', 'loft', 'maisonette'],
    'condo': ['condo', 'condominium', 'unit'],
    'townhouse': ['townhouse', 'townhome', 'row house']
  };

  private readonly FEATURE_KEYWORDS = {
    'garden': ['garden', 'yard', 'outdoor space', 'patio', 'terrace', 'balcony', 'deck'],
    'parking': ['parking', 'garage', 'driveway', 'car space', 'parking space'],
    'modern': ['modern', 'contemporary', 'new', 'recently renovated', 'updated', 'stylish'],
    'family': ['family', 'children', 'kids', 'school', 'playground', 'safe', 'quiet'],
    'luxury': ['luxury', 'premium', 'high-end', 'upscale', 'exclusive', 'prestigious'],
    'pet-friendly': ['pet', 'dog', 'cat', 'animal', 'pet-friendly'],
    'transport': ['transport', 'tube', 'train', 'bus', 'station', 'commute', 'transport links']
  };

  private readonly SIZE_KEYWORDS = {
    'small': ['small', 'cozy', 'compact', 'intimate', 'bijou'],
    'large': ['large', 'spacious', 'big', 'roomy', 'generous', 'expansive'],
    'huge': ['huge', 'massive', 'enormous', 'vast', 'grand']
  };

  /**
   * Analyzes search query using semantic understanding
   */
  analyzeQuery(query: string): SemanticAnalysis {
    const queryLower = query.toLowerCase();
    const words = queryLower.split(/\s+/);
    const extractedFilters: SearchFilters = { query };
    const suggestions: string[] = [];
    const keywords: string[] = [];
    let intent = '';
    let confidence = 0;

    // Extract price range
    const priceMatch = query.match(/(?:£|pounds?|k)?\s*(\d+)(?:k|,000)?\s*[-–to]\s*(?:£|pounds?)?\s*(\d+)(?:k|,000)?/i);
    if (priceMatch) {
      const min = parseInt(priceMatch[1]) * (priceMatch[1].length <= 3 ? 1000 : 1);
      const max = parseInt(priceMatch[2]) * (priceMatch[2].length <= 3 ? 1000 : 1);
      extractedFilters.minPrice = Math.min(min, max);
      extractedFilters.maxPrice = Math.max(min, max);
      intent += `Budget between £${extractedFilters.minPrice.toLocaleString()}-£${extractedFilters.maxPrice.toLocaleString()}. `;
      keywords.push('budget', 'price-range');
      confidence += 25;
    }

    // Extract single price (under/over)
    const singlePriceMatch = query.match(/(?:under|below|less than|<)\s*(?:£|pounds?)?\s*(\d+)(?:k|,000)?/i);
    if (singlePriceMatch) {
      const price = parseInt(singlePriceMatch[1]) * (singlePriceMatch[1].length <= 3 ? 1000 : 1);
      extractedFilters.maxPrice = price;
      intent += `Budget under £${price.toLocaleString()}. `;
      keywords.push('budget', 'affordable');
      confidence += 20;
    }

    const overPriceMatch = query.match(/(?:over|above|more than|>)\s*(?:£|pounds?)?\s*(\d+)(?:k|,000)?/i);
    if (overPriceMatch) {
      const price = parseInt(overPriceMatch[1]) * (overPriceMatch[1].length <= 3 ? 1000 : 1);
      extractedFilters.minPrice = price;
      intent += `Budget over £${price.toLocaleString()}. `;
      keywords.push('budget', 'premium');
      confidence += 20;
    }

    // Extract bedrooms
    const bedroomMatch = query.match(/(\d+)\s*(?:bed|bedroom)/i);
    if (bedroomMatch) {
      extractedFilters.bedrooms = parseInt(bedroomMatch[1]);
      intent += `Looking for ${bedroomMatch[1]} bedroom property. `;
      keywords.push('bedrooms', `${bedroomMatch[1]}-bed`);
      confidence += 20;
    }

    // Extract bathrooms
    const bathroomMatch = query.match(/(\d+)\s*(?:bath|bathroom)/i);
    if (bathroomMatch) {
      extractedFilters.bathrooms = parseInt(bathroomMatch[1]);
      intent += `Needs ${bathroomMatch[1]} bathroom(s). `;
      keywords.push('bathrooms');
      confidence += 15;
    }

    // Extract property type
    for (const [type, typeKeywords] of Object.entries(this.PROPERTY_TYPE_KEYWORDS)) {
      if (typeKeywords.some(keyword => queryLower.includes(keyword))) {
        extractedFilters.propertyType = type as Property['propertyType'];
        intent += `Prefers ${type}. `;
        keywords.push(type, 'property-type');
        confidence += 20;
        break;
      }
    }

    // Extract location
    const locationFound = this.LOCATION_KEYWORDS.find(location => 
      queryLower.includes(location)
    );
    if (locationFound) {
      extractedFilters.location = locationFound;
      intent += `Interested in ${locationFound} area. `;
      keywords.push('location', locationFound);
      confidence += 25;
    }

    // Extract features and generate suggestions
    const features: string[] = [];
    for (const [feature, featureKeywords] of Object.entries(this.FEATURE_KEYWORDS)) {
      if (featureKeywords.some(keyword => queryLower.includes(keyword))) {
        features.push(feature);
        keywords.push(feature);
        confidence += 10;

        // Generate contextual suggestions
        switch (feature) {
          case 'family':
            suggestions.push('Near Schools', 'Safe Neighborhood', 'Playground Nearby');
            break;
          case 'modern':
            suggestions.push('Recently Renovated', 'Contemporary Design', 'Smart Home Features');
            break;
          case 'luxury':
            suggestions.push('Premium Finishes', 'Concierge Service', 'High-End Appliances');
            break;
          case 'pet-friendly':
            suggestions.push('Pet Policy', 'Dog Park Nearby', 'Pet Washing Station');
            break;
          case 'transport':
            suggestions.push('Tube Station', 'Bus Routes', 'Cycle Paths');
            break;
        }
      }
    }

    if (features.length > 0) {
      extractedFilters.features = features;
      intent += `Looking for properties with: ${features.join(', ')}. `;
    }

    // Extract size preferences
    for (const [size, sizeKeywords] of Object.entries(this.SIZE_KEYWORDS)) {
      if (sizeKeywords.some(keyword => queryLower.includes(keyword))) {
        keywords.push(size, 'size-preference');
        intent += `Prefers ${size} properties. `;
        confidence += 10;

        // Set area filters based on size preference
        switch (size) {
          case 'small':
            extractedFilters.maxArea = 800;
            break;
          case 'large':
            extractedFilters.minArea = 1500;
            break;
          case 'huge':
            extractedFilters.minArea = 2500;
            break;
        }
        break;
      }
    }

    // Determine sentiment
    const positiveWords = ['love', 'perfect', 'dream', 'amazing', 'beautiful', 'stunning'];
    const negativeWords = ['avoid', 'not', 'dislike', 'hate', 'terrible', 'awful'];
    
    const positiveCount = positiveWords.filter(word => queryLower.includes(word)).length;
    const negativeCount = negativeWords.filter(word => queryLower.includes(word)).length;
    
    let sentiment: 'positive' | 'neutral' | 'negative' = 'neutral';
    if (positiveCount > negativeCount) sentiment = 'positive';
    else if (negativeCount > positiveCount) sentiment = 'negative';

    // Add general suggestions if none found
    if (suggestions.length === 0) {
      suggestions.push('Virtual Tour', 'Floor Plans', 'Neighborhood Info');
    }

    return {
      intent: intent.trim() || 'General property search',
      extractedFilters,
      suggestions: [...new Set(suggestions)], // Remove duplicates
      confidence: Math.min(confidence, 100),
      keywords: [...new Set(keywords)], // Remove duplicates
      sentiment
    };
  }

  /**
   * Enhances properties with semantic scoring and matching
   */
  enhanceProperties(
    properties: Property[], 
    query: string, 
    analysis: SemanticAnalysis
  ): EnhancedProperty[] {
    const queryLower = query.toLowerCase();
    const queryWords = queryLower.split(/\s+/);

    return properties.map(property => {
      let relevanceScore = 0;
      const matchReasons: string[] = [];
      const matchKeywords: string[] = [];
      let semanticScore = 0;

      // Text matching score
      const searchableText = `${property.title} ${property.description} ${property.location.area} ${property.location.city}`.toLowerCase();
      
      queryWords.forEach(word => {
        if (searchableText.includes(word)) {
          relevanceScore += 5;
          matchKeywords.push(word);
        }
      });

      // Price matching
      if (analysis.extractedFilters.minPrice && property.price >= analysis.extractedFilters.minPrice) {
        relevanceScore += 15;
        matchReasons.push(`Within your minimum budget of £${analysis.extractedFilters.minPrice.toLocaleString()}`);
        matchKeywords.push('budget-match');
      }

      if (analysis.extractedFilters.maxPrice && property.price <= analysis.extractedFilters.maxPrice) {
        relevanceScore += 15;
        matchReasons.push(`Within your maximum budget of £${analysis.extractedFilters.maxPrice.toLocaleString()}`);
        matchKeywords.push('budget-match');
      }

      // Bedroom matching
      if (analysis.extractedFilters.bedrooms && property.bedrooms >= analysis.extractedFilters.bedrooms) {
        relevanceScore += 20;
        matchReasons.push(`Has ${property.bedrooms} bedrooms as requested`);
        matchKeywords.push('bedroom-match');
      }

      // Property type matching
      if (analysis.extractedFilters.propertyType && property.propertyType === analysis.extractedFilters.propertyType) {
        relevanceScore += 25;
        matchReasons.push(`Matches your preferred property type: ${property.propertyType}`);
        matchKeywords.push('type-match');
      }

      // Location matching
      if (analysis.extractedFilters.location) {
        const locationMatch = property.location.city.toLowerCase().includes(analysis.extractedFilters.location) ||
                             property.location.area.toLowerCase().includes(analysis.extractedFilters.location);
        if (locationMatch) {
          relevanceScore += 30;
          matchReasons.push(`Located in ${analysis.extractedFilters.location} as requested`);
          matchKeywords.push('location-match');
        }
      }

      // Feature matching
      if (analysis.extractedFilters.features) {
        analysis.extractedFilters.features.forEach(feature => {
          const featureKeywords = this.FEATURE_KEYWORDS[feature as keyof typeof this.FEATURE_KEYWORDS] || [];
          const hasFeature = featureKeywords.some(keyword => 
            searchableText.includes(keyword) || 
            property.features.some(f => f.toLowerCase().includes(keyword))
          );
          
          if (hasFeature) {
            relevanceScore += 15;
            matchReasons.push(`Has ${feature} features you're looking for`);
            matchKeywords.push(feature);
          }
        });
      }

      // Area matching
      if (analysis.extractedFilters.minArea && property.area >= analysis.extractedFilters.minArea) {
        relevanceScore += 10;
        matchReasons.push(`Spacious with ${property.area} sq ft`);
        matchKeywords.push('size-match');
      }

      if (analysis.extractedFilters.maxArea && property.area <= analysis.extractedFilters.maxArea) {
        relevanceScore += 10;
        matchReasons.push(`Cozy size with ${property.area} sq ft`);
        matchKeywords.push('size-match');
      }

      // Semantic understanding bonuses
      if (analysis.keywords.includes('luxury') && property.price > 500000) {
        semanticScore += 20;
        matchReasons.push('Premium property matching luxury criteria');
        matchKeywords.push('luxury-match');
      }

      if (analysis.keywords.includes('family') && property.bedrooms >= 3) {
        semanticScore += 15;
        matchReasons.push('Perfect for families with multiple bedrooms');
        matchKeywords.push('family-friendly');
      }

      if (analysis.keywords.includes('modern') && property.features.some(f => 
        f.toLowerCase().includes('modern') || f.toLowerCase().includes('new') || f.toLowerCase().includes('renovated')
      )) {
        semanticScore += 12;
        matchReasons.push('Modern property with contemporary features');
        matchKeywords.push('modern-match');
      }

      // Sentiment-based adjustments
      if (analysis.sentiment === 'positive') {
        semanticScore += 5;
      }

      const finalScore = Math.min(relevanceScore + semanticScore, 100);

      return {
        ...property,
        relevanceScore: finalScore,
        matchReasons: matchReasons.slice(0, 3), // Limit to top 3 reasons
        matchKeywords: [...new Set(matchKeywords)], // Remove duplicates
        semanticScore
      };
    }).filter(property => property.relevanceScore! > 0)
      .sort((a, b) => (b.relevanceScore! + b.semanticScore!) - (a.relevanceScore! + a.semanticScore!));
  }

  /**
   * Performs complete semantic search with analysis and enhancement
   */
  async performSemanticSearch(
    properties: Property[],
    query: string,
    page: number = 1,
    limit: number = 12
  ): Promise<SearchResults> {
    const startTime = Date.now();
    
    // Analyze the query
    const analysis = this.analyzeQuery(query);
    
    // Enhance properties with semantic scoring
    const enhancedProperties = this.enhanceProperties(properties, query, analysis);
    
    // Apply pagination
    const total = enhancedProperties.length;
    const totalPages = Math.ceil(total / limit);
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedProperties = enhancedProperties.slice(startIndex, endIndex);
    
    const searchTime = Date.now() - startTime;
    const averageRelevance = paginatedProperties.reduce(
      (sum, p) => sum + (p.relevanceScore || 0), 0
    ) / paginatedProperties.length || 0;

    return {
      properties: paginatedProperties,
      total,
      page,
      totalPages,
      filters: analysis.extractedFilters,
      searchTime,
      averageRelevance: Math.round(averageRelevance),
      semanticAnalysis: analysis
    };
  }

  /**
   * Generates search suggestions based on partial query
   */
  generateSuggestions(partialQuery: string): string[] {
    const queryLower = partialQuery.toLowerCase();
    const suggestions: string[] = [];

    // Location-based suggestions
    this.LOCATION_KEYWORDS.forEach(location => {
      if (location.startsWith(queryLower) || queryLower.includes(location.substring(0, 3))) {
        suggestions.push(`Properties in ${location}`);
      }
    });

    // Property type suggestions
    Object.entries(this.PROPERTY_TYPE_KEYWORDS).forEach(([type, keywords]) => {
      if (keywords.some(keyword => keyword.startsWith(queryLower))) {
        suggestions.push(`${type.charAt(0).toUpperCase() + type.slice(1)}s for sale`);
      }
    });

    // Feature-based suggestions
    Object.keys(this.FEATURE_KEYWORDS).forEach(feature => {
      if (feature.startsWith(queryLower)) {
        suggestions.push(`Properties with ${feature}`);
      }
    });

    // Common search patterns
    if (queryLower.includes('bed')) {
      suggestions.push('2 bedroom apartment', '3 bedroom house', '4 bedroom family home');
    }

    if (queryLower.includes('£') || queryLower.includes('price')) {
      suggestions.push('Under £300k', '£300k - £500k', 'Over £500k');
    }

    return suggestions.slice(0, 5); // Limit to 5 suggestions
  }
}