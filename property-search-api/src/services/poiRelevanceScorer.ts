// POI Relevance Scoring Algorithm
import { Property } from '@shared/types';
import { POI } from './poiService';

export class POIRelevanceScorer {
  private propertyTypeWeights = {
    'family_house': {
      'schools': 0.9,
      'parks': 0.8,
      'supermarkets': 0.7,
      'hospitals': 0.6,
      'transport': 0.5,
      'restaurants': 0.4,
      'gyms': 0.3,
      'shopping': 0.5,
      'nightlife': 0.1
    },
    'studio_apartment': {
      'transport': 0.9,
      'restaurants': 0.8,
      'nightlife': 0.7,
      'gyms': 0.6,
      'supermarkets': 0.6,
      'shopping': 0.5,
      'parks': 0.3,
      'schools': 0.2,
      'hospitals': 0.4
    },
    'luxury_apartment': {
      'fine_dining': 0.9,
      'cultural': 0.8,
      'premium_shopping': 0.7,
      'transport': 0.6,
      'gyms': 0.5,
      'restaurants': 0.6,
      'parks': 0.4,
      'schools': 0.4,
      'hospitals': 0.5
    },
    'standard_apartment': {
      'transport': 0.8,
      'supermarkets': 0.7,
      'restaurants': 0.6,
      'gyms': 0.5,
      'parks': 0.5,
      'schools': 0.4,
      'shopping': 0.5,
      'hospitals': 0.5,
      'nightlife': 0.4
    },
    'shared_house': {
      'transport': 0.9,
      'supermarkets': 0.8,
      'restaurants': 0.7,
      'nightlife': 0.6,
      'gyms': 0.5,
      'parks': 0.4,
      'schools': 0.2,
      'shopping': 0.5,
      'hospitals': 0.4
    }
  };

  // Age-based preferences (inferred from property characteristics)
  private ageGroupWeights = {
    'young_professional': {
      'nightlife': 1.2,
      'restaurants': 1.1,
      'gyms': 1.1,
      'transport': 1.2,
      'schools': 0.5
    },
    'family': {
      'schools': 1.3,
      'parks': 1.2,
      'hospitals': 1.1,
      'supermarkets': 1.1,
      'nightlife': 0.6
    },
    'retiree': {
      'hospitals': 1.3,
      'parks': 1.2,
      'transport': 1.1,
      'supermarkets': 1.1,
      'restaurants': 1.0,
      'nightlife': 0.4
    }
  };

  // Time-based relevance (some POIs are more relevant at certain times)
  private timeBasedWeights = {
    'morning': {
      'transport': 1.2,
      'supermarkets': 1.1,
      'gyms': 1.1
    },
    'evening': {
      'restaurants': 1.2,
      'nightlife': 1.3,
      'gyms': 1.1
    },
    'weekend': {
      'parks': 1.2,
      'shopping': 1.2,
      'restaurants': 1.1
    }
  };

  scorePOI(poi: POI, property: Property, distance: number): number {
    const propertyCategory = this.classifyProperty(property);
    const ageGroup = this.inferAgeGroup(property);
    
    // Base weight for POI category and property type
    const baseWeight = this.getBaseWeight(poi.category, propertyCategory);
    
    // Distance penalty (closer is better)
    const distanceScore = this.calculateDistanceScore(distance);
    
    // Quality score from POI rating
    const qualityScore = this.calculateQualityScore(poi);
    
    // Popularity score from review count
    const popularityScore = this.calculatePopularityScore(poi);
    
    // Age group modifier
    const ageModifier = this.getAgeGroupModifier(poi.category, ageGroup);
    
    // Price tier modifier (luxury properties prefer premium POIs)
    const priceTierModifier = this.getPriceTierModifier(poi, property);
    
    // Calculate final score
    const finalScore = (
      baseWeight * 0.35 +           // Property type relevance (35%)
      distanceScore * 0.25 +        // Distance (25%)
      qualityScore * 0.15 +         // Quality (15%)
      popularityScore * 0.10 +      // Popularity (10%)
      ageModifier * 0.10 +          // Age group preference (10%)
      priceTierModifier * 0.05      // Price tier (5%)
    );

    return Math.min(Math.max(finalScore, 0), 1); // Clamp between 0 and 1
  }

  private classifyProperty(property: Property): string {
    // Classify based on bedrooms, price, and type
    if (property.bedrooms >= 3 && property.propertyType === 'house') {
      return 'family_house';
    }
    
    if (property.bedrooms <= 1 || property.propertyType === 'studio') {
      return 'studio_apartment';
    }
    
    if (property.price > 800000) {
      return 'luxury_apartment';
    }
    
    // Check if it's likely a shared house (multiple bedrooms but lower price per bedroom)
    if (property.bedrooms >= 3 && property.price / property.bedrooms < 150000) {
      return 'shared_house';
    }
    
    return 'standard_apartment';
  }

  private inferAgeGroup(property: Property): string {
    // Infer likely age group based on property characteristics
    if (property.bedrooms >= 3 || property.features.includes('garden')) {
      return 'family';
    }
    
    if (property.bedrooms <= 1 && property.price < 400000) {
      return 'young_professional';
    }
    
    if (property.propertyType === 'bungalow' || 
        property.features.includes('ground_floor') ||
        property.features.includes('no_stairs')) {
      return 'retiree';
    }
    
    return 'young_professional'; // Default assumption
  }

  private getBaseWeight(poiCategory: string, propertyCategory: string): number {
    const weights = this.propertyTypeWeights[propertyCategory];
    return weights?.[poiCategory] || 0.5; // Default weight if not found
  }

  private calculateDistanceScore(distance: number): number {
    // Distance penalty: 1.0 at 0m, 0.5 at 500m, 0.0 at 1000m+
    if (distance <= 0) return 1.0;
    if (distance >= 1000) return 0.0;
    
    return Math.max(0, 1 - (distance / 1000));
  }

  private calculateQualityScore(poi: POI): number {
    if (!poi.rating) return 0.6; // Default score if no rating
    
    // Normalize rating to 0-1 scale (assuming 5-star system)
    return Math.min(poi.rating / 5, 1);
  }

  private calculatePopularityScore(poi: POI): number {
    if (!poi.reviewCount) return 0.3; // Default score if no reviews
    
    // Logarithmic scale for review count (diminishing returns)
    // 100 reviews = 1.0, 10 reviews = 0.5, 1 review = 0.0
    return Math.min(Math.log10(poi.reviewCount) / 2, 1);
  }

  private getAgeGroupModifier(poiCategory: string, ageGroup: string): number {
    const modifiers = this.ageGroupWeights[ageGroup];
    return modifiers?.[poiCategory] || 1.0; // No modifier if not found
  }

  private getPriceTierModifier(poi: POI, property: Property): number {
    // Premium properties should prefer higher-quality POIs
    if (property.price > 1000000) {
      // Luxury tier - prefer highly rated POIs
      if (poi.rating && poi.rating >= 4.5) return 1.2;
      if (poi.rating && poi.rating < 3.5) return 0.8;
    } else if (property.price < 200000) {
      // Budget tier - less emphasis on premium POIs
      if (poi.rating && poi.rating >= 4.5) return 0.9;
      if (poi.rating && poi.rating >= 3.0) return 1.1;
    }
    
    return 1.0; // No modifier for mid-range properties
  }

  // Advanced scoring methods
  scorePOIsForProperty(pois: POI[], property: Property): POI[] {
    return pois
      .map(poi => ({
        ...poi,
        relevanceScore: this.scorePOI(poi, property, poi.distance || 0)
      }))
      .sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
  }

  getTopPOIsByCategory(
    pois: POI[], 
    property: Property, 
    category: string, 
    limit: number = 5
  ): POI[] {
    return pois
      .filter(poi => poi.category === category)
      .map(poi => ({
        ...poi,
        relevanceScore: this.scorePOI(poi, property, poi.distance || 0)
      }))
      .sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0))
      .slice(0, limit);
  }

  // Context-aware scoring (time of day, season, etc.)
  scoreWithContext(
    poi: POI, 
    property: Property, 
    distance: number, 
    context: { timeOfDay?: string; season?: string; dayOfWeek?: string } = {}
  ): number {
    let baseScore = this.scorePOI(poi, property, distance);
    
    // Apply time-based modifiers
    if (context.timeOfDay) {
      const timeWeights = this.timeBasedWeights[context.timeOfDay];
      const timeModifier = timeWeights?.[poi.category] || 1.0;
      baseScore *= timeModifier;
    }
    
    // Apply seasonal modifiers
    if (context.season === 'summer' && poi.category === 'parks') {
      baseScore *= 1.2;
    } else if (context.season === 'winter' && poi.category === 'gyms') {
      baseScore *= 1.1;
    }
    
    // Apply day-of-week modifiers
    if (context.dayOfWeek === 'weekend') {
      const weekendWeights = this.timeBasedWeights.weekend;
      const weekendModifier = weekendWeights?.[poi.category] || 1.0;
      baseScore *= weekendModifier;
    }
    
    return Math.min(baseScore, 1); // Ensure we don't exceed 1.0
  }

  // Diversity scoring to ensure variety in recommendations
  diversifyPOISelection(
    pois: POI[], 
    property: Property, 
    maxPerCategory: number = 3
  ): POI[] {
    const categoryCounts: { [key: string]: number } = {};
    const diversifiedPOIs: POI[] = [];
    
    // Sort by relevance first
    const sortedPOIs = this.scorePOIsForProperty(pois, property);
    
    for (const poi of sortedPOIs) {
      const currentCount = categoryCounts[poi.category] || 0;
      
      if (currentCount < maxPerCategory) {
        diversifiedPOIs.push(poi);
        categoryCounts[poi.category] = currentCount + 1;
      }
      
      // Stop if we have enough POIs
      if (diversifiedPOIs.length >= 20) break;
    }
    
    return diversifiedPOIs;
  }
}