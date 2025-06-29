// Re-export types from the shared package
export * from '@shared/types';

// Import Property type for reference
import type { Property } from '@shared/types';

// Additional frontend-specific types
export interface SearchOptions {
  query: string;
  filters?: {
    minPrice?: number;
    maxPrice?: number;
    minBedrooms?: number;
    maxBedrooms?: number;
    propertyType?: Property['propertyType'][];
    listingType?: Property['listingType'];
    location?: string;
    radius?: number; // in miles
    features?: string[];
  };
  sort?: {
    field: 'price' | 'bedrooms' | 'area' | 'createdAt';
    order: 'asc' | 'desc';
  };
  pagination?: {
    page: number;
    limit: number;
  };
}