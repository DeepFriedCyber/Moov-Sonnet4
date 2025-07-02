export enum SearchIntent {
  PURCHASE = 'purchase',
  RENT = 'rent',
}

export interface SearchLocation {
  city?: string;
  postcode?: string;
  nearBy?: string[];
  transport?: string[];
  proximity?: {
    distance: number;
    unit: 'minutes' | 'mile' | 'km';
    mode?: 'walk' | 'drive' | 'public_transport';
  };
  coordinates?: {
    lat: number;
    lng: number;
    radius?: number;
  };
}

export interface SearchRooms {
  bedrooms?: number;
  bathrooms?: number;
}

export interface SearchBudget {
  minPrice?: number;
  maxPrice?: number;
  minRent?: number;
  maxRent?: number;
  rentPeriod?: 'week' | 'month';
}

export interface ParsedQuery {
  intent: SearchIntent;
  location: SearchLocation;
  propertyType?: string;
  features: string[];
  rooms: SearchRooms;
  budget: SearchBudget;
  lifestyle: string[];
  originalQuery: string;
  confidence: number;
}

export interface PropertyMatch {
  id: string;
  title: string;
  price: number;
  city: string;
  postcode?: string;
  features: string[];
  bedrooms: number;
  bathrooms: number;
  propertyType: string;
  listedDate: Date;
  similarity_score: number;
  relevanceScore?: number;
}

export interface SearchResult {
  properties: PropertyMatch[];
  query: ParsedQuery;
  totalCount: number;
  facets: SearchFacets;
}

export interface SearchFacets {
  priceRanges: Array<{
    min: number;
    max: number;
    count: number;
  }>;
  propertyTypes: Array<{
    type: string;
    count: number;
  }>;
  locations: Array<{
    city: string;
    count: number;
  }>;
  features: Array<{
    feature: string;
    count: number;
  }>;
}