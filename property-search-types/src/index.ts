// Property types
export interface Property {
  id: string;
  title: string;
  description: string;
  price: number;
  bedrooms: number;
  bathrooms: number;
  propertyType: 'House' | 'Flat' | 'Bungalow' | 'Maisonette' | 'Studio';
  location: {
    address: string;
    area: string;
    postcode: string;
    lat: number;
    lng: number;
  };
  images: string[];
  features: string[];
  agentId: string;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
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

// Search types
export interface SearchQuery {
  text: string;
  location: string;
  filters: PropertyFilters;
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
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
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
