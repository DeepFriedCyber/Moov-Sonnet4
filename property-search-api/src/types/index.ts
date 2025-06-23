// Property types
export interface Property {
    id: string;
    title: string;
    description: string;
    price: number;
    bedrooms: number;
    bathrooms: number;
    area: number; // Square footage/meters
    propertyType: 'house' | 'flat' | 'bungalow' | 'maisonette' | 'studio';
    listingType: 'sale' | 'rent';
    location: {
        address: string;
        city: string;
        area: string;
        postcode: string;
        coordinates: {
            lat: number;
            lng: number;
        };
    };
    images: string[];
    features: string[];
    agentId: string;
    createdAt: Date;
    updatedAt: Date;
    isActive: boolean;
}

// Search types  
export interface SearchQuery {
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

export interface PropertyFilters {
    minPrice?: number;
    maxPrice?: number;
    bedrooms?: number;
    bathrooms?: number;
    propertyType?: string;
    features?: string[];
}

export interface SearchResult {
    properties: Property[];
    total: number;
    page: number;
    limit: number;
    semanticScore?: number;
}

// User types
export interface User {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: 'user' | 'agent' | 'admin';
    createdAt: Date;
    updatedAt: Date;
}

export interface Agent extends User {
    role: 'agent';
    company: string;
    phone: string;
    licenseNumber?: string;
    subscriptionTier: 'basic' | 'pro' | 'enterprise';
    subscriptionStatus: 'active' | 'inactive' | 'cancelled';
}

// Chat types
export interface ChatMessage {
    id: string;
    chatId: string;
    senderId: string;
    senderType: 'user' | 'bot' | 'agent';
    message: string;
    messageType: 'text' | 'property_card' | 'location' | 'image';
    metadata?: any;
    timestamp: Date;
}

export interface ChatSession {
    id: string;
    userId: string;
    propertyId?: string;
    agentId?: string;
    status: 'active' | 'transferred' | 'closed';
    context: ChatContext;
    createdAt: Date;
    updatedAt: Date;
}

export interface ChatContext {
    currentProperty?: string;
    searchCriteria?: SearchQuery;
    userPreferences?: any;
    conversationStage: 'greeting' | 'searching' | 'viewing_property' | 'booking_viewing' | 'agent_handoff';
}

// API Response types
export interface ApiResponse<T = any> {
    status: 'success' | 'error';
    data?: T;
    error?: {
        message: string;
        code?: string;
        details?: any;
    };
    meta?: {
        page?: number;
        totalPages?: number;
        totalItems?: number;
        timestamp?: string;
    };
}

export interface PaginatedResponse<T> {
    data: T[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}

// Error types
export interface AppError {
    statusCode: number;
    message: string;
    isOperational: boolean;
    stack?: string;
}

// Health check types
export interface HealthStatus {
    status: 'healthy' | 'unhealthy';
    timestamp: string;
    services: {
        database: 'connected' | 'disconnected';
        redis: 'connected' | 'disconnected';
        embeddingService: 'connected' | 'disconnected';
    };
    version: string;
}