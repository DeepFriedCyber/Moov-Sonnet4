// Database interfaces for better type safety and structure

import { Property } from '@/types';
import { CreatePropertyData, SearchOptions, DatabaseConfig } from '../schemas/database.schemas';

// Search result interface
export interface SearchResult {
    properties: (Property & { similarity_score?: number })[];
    total: number;
    searchTime?: number;
    facets?: SearchFacets;
}

// Search facets for advanced filtering
export interface SearchFacets {
    priceRanges: { min: number; max: number; count: number }[];
    bedroomCounts: { bedrooms: number; count: number }[];
    propertyTypes: { type: string; count: number }[];
    locations: { area: string; count: number }[];
}

// Database service interface
export interface IDatabaseService {
    initialize(): Promise<void>;
    query(text: string, params?: any[]): Promise<any>;
    getClient(): Promise<any>;
    close(): Promise<void>;
    healthCheck(): Promise<boolean>;
}

// Property repository interface
export interface IPropertyRepository {
    create(data: CreatePropertyData): Promise<Property>;
    findById(id: string): Promise<Property | null>;
    findManyByIds(ids: string[]): Promise<Property[]>;
    searchBySimilarity(options: SearchOptions): Promise<SearchResult>;
    updateEmbedding(id: string, embedding: number[]): Promise<void>;
    delete(id: string): Promise<boolean>;
    update(id: string, data: Partial<CreatePropertyData>): Promise<Property>;
}

// Transaction interface
export interface ITransaction {
    query(text: string, params?: any[]): Promise<any>;
    commit(): Promise<void>;
    rollback(): Promise<void>;
}

// Database metrics interface
export interface DatabaseMetrics {
    totalConnections: number;
    activeConnections: number;
    idleConnections: number;
    totalQueries: number;
    averageQueryTime: number;
    slowQueries: number;
    errors: number;
}

// Migration interface
export interface IMigration {
    version: string;
    description: string;
    up(): Promise<void>;
    down(): Promise<void>;
}