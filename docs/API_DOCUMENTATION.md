# 🔌 Moov Property Search - API Documentation

## 📋 Table of Contents

- [Overview](#overview)
- [Authentication](#authentication)
- [Base URLs](#base-urls)
- [Common Headers](#common-headers)
- [Error Handling](#error-handling)
- [Rate Limiting](#rate-limiting)
- [API Endpoints](#api-endpoints)
  - [Authentication](#authentication-endpoints)
  - [Properties](#properties-endpoints)
  - [Search](#search-endpoints)
  - [Chat](#chat-endpoints)
  - [Users](#users-endpoints)
  - [Webhooks](#webhooks-endpoints)
- [WebSocket Events](#websocket-events)
- [Data Models](#data-models)
- [Examples](#examples)

## 🎯 Overview

The Moov Property Search API provides RESTful endpoints for property search, user management, and real-time chat functionality. The API uses JSON for data exchange and supports both HTTP REST and WebSocket connections.

### API Version
- **Current Version**: v1
- **Base Path**: `/api`
- **Content Type**: `application/json`

## 🔐 Authentication

### Authentication Methods

#### JWT Bearer Token
Most endpoints require authentication using JWT Bearer tokens.

```http
Authorization: Bearer <jwt_token>
```

#### API Key (Optional)
For service-to-service communication:

```http
X-API-Key: <api_key>
```

### Token Lifecycle
- **Access Token**: 1 hour expiry
- **Refresh Token**: 30 days expiry
- **Token Refresh**: Use `/api/auth/refresh` endpoint

## 🌐 Base URLs

### Environments
- **Production**: `https://api.moov-property.com`
- **Staging**: `https://api-staging.moov-property.com`
- **Development**: `http://localhost:3001`

## 📤 Common Headers

### Request Headers
```http
Content-Type: application/json
Authorization: Bearer <jwt_token>
X-Client-Version: 1.0.0
X-Request-ID: <unique_request_id>
```

### Response Headers
```http
Content-Type: application/json
X-Rate-Limit-Remaining: 95
X-Rate-Limit-Reset: 1640995200
X-Request-ID: <request_id>
```

## ❌ Error Handling

### Error Response Format
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input parameters",
    "details": [
      {
        "field": "email",
        "message": "Invalid email format"
      }
    ],
    "request_id": "req_123456789"
  }
}
```

### HTTP Status Codes
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `422` - Validation Error
- `429` - Rate Limited
- `500` - Internal Server Error

### Common Error Codes
- `INVALID_TOKEN` - JWT token is invalid or expired
- `VALIDATION_ERROR` - Request validation failed
- `RESOURCE_NOT_FOUND` - Requested resource doesn't exist
- `RATE_LIMIT_EXCEEDED` - Too many requests
- `INSUFFICIENT_PERMISSIONS` - User lacks required permissions

## 🚦 Rate Limiting

### Limits
- **Authenticated Users**: 1000 requests/hour
- **Unauthenticated**: 100 requests/hour
- **Search Endpoints**: 500 requests/hour
- **Upload Endpoints**: 50 requests/hour

### Rate Limit Headers
```http
X-Rate-Limit-Limit: 1000
X-Rate-Limit-Remaining: 995
X-Rate-Limit-Reset: 1640995200
```

## 🔗 API Endpoints

### Authentication Endpoints

#### POST /api/auth/register
Register a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "firstName": "John",
  "lastName": "Doe",
  "phone": "+1234567890",
  "userType": "buyer" // "buyer", "seller", "agent"
}
```

**Response (201):**
```json
{
  "user": {
    "id": "user_123",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "userType": "buyer",
    "createdAt": "2024-01-01T00:00:00Z"
  },
  "tokens": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
    "expiresIn": 3600
  }
}
```

#### POST /api/auth/login
Authenticate user and get access tokens.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Response (200):**
```json
{
  "user": {
    "id": "user_123",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "userType": "buyer"
  },
  "tokens": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
    "expiresIn": 3600
  }
}
```

#### POST /api/auth/refresh
Refresh access token using refresh token.

**Request Body:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Response (200):**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "expiresIn": 3600
}
```

#### POST /api/auth/logout
Logout user and invalidate tokens.

**Headers:**
```http
Authorization: Bearer <access_token>
```

**Response (200):**
```json
{
  "message": "Successfully logged out"
}
```

#### POST /api/auth/forgot-password
Request password reset email.

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

**Response (200):**
```json
{
  "message": "Password reset email sent"
}
```

#### POST /api/auth/reset-password
Reset password using reset token.

**Request Body:**
```json
{
  "token": "reset_token_123",
  "newPassword": "newSecurePassword123"
}
```

**Response (200):**
```json
{
  "message": "Password successfully reset"
}
```

### Properties Endpoints

#### GET /api/properties
Get list of properties with filtering and pagination.

**Query Parameters:**
- `page` (number): Page number (default: 1)
- `limit` (number): Items per page (default: 20, max: 100)
- `location` (string): Location filter
- `minPrice` (number): Minimum price
- `maxPrice` (number): Maximum price
- `propertyType` (string): Property type filter
- `bedrooms` (number): Number of bedrooms
- `bathrooms` (number): Number of bathrooms
- `sortBy` (string): Sort field (price, createdAt, updatedAt)
- `sortOrder` (string): Sort order (asc, desc)

**Example Request:**
```http
GET /api/properties?location=New York&minPrice=100000&maxPrice=500000&bedrooms=2&page=1&limit=20
```

**Response (200):**
```json
{
  "properties": [
    {
      "id": "prop_123",
      "title": "Beautiful 2BR Apartment",
      "description": "Spacious apartment in downtown",
      "price": 350000,
      "location": {
        "address": "123 Main St",
        "city": "New York",
        "state": "NY",
        "zipCode": "10001",
        "coordinates": {
          "lat": 40.7128,
          "lng": -74.0060
        }
      },
      "propertyType": "apartment",
      "bedrooms": 2,
      "bathrooms": 1,
      "squareFootage": 1200,
      "images": [
        "https://example.com/image1.jpg",
        "https://example.com/image2.jpg"
      ],
      "features": ["parking", "gym", "pool"],
      "agent": {
        "id": "agent_123",
        "name": "Jane Smith",
        "email": "jane@example.com",
        "phone": "+1234567890"
      },
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-01-01T00:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8,
    "hasNext": true,
    "hasPrev": false
  }
}
```

#### GET /api/properties/:id
Get specific property details.

**Response (200):**
```json
{
  "property": {
    "id": "prop_123",
    "title": "Beautiful 2BR Apartment",
    "description": "Spacious apartment in downtown with modern amenities...",
    "price": 350000,
    "location": {
      "address": "123 Main St",
      "city": "New York",
      "state": "NY",
      "zipCode": "10001",
      "coordinates": {
        "lat": 40.7128,
        "lng": -74.0060
      }
    },
    "propertyType": "apartment",
    "bedrooms": 2,
    "bathrooms": 1,
    "squareFootage": 1200,
    "images": [
      "https://example.com/image1.jpg",
      "https://example.com/image2.jpg"
    ],
    "features": ["parking", "gym", "pool"],
    "agent": {
      "id": "agent_123",
      "name": "Jane Smith",
      "email": "jane@example.com",
      "phone": "+1234567890"
    },
    "virtualTour": "https://example.com/virtual-tour",
    "floorPlan": "https://example.com/floor-plan.pdf",
    "neighborhood": {
      "schools": [
        {
          "name": "Elementary School",
          "rating": 8,
          "distance": 0.5
        }
      ],
      "amenities": ["grocery", "restaurant", "hospital"],
      "walkScore": 85
    },
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-01T00:00:00Z"
  }
}
```

#### POST /api/properties
Create a new property listing (Agent/Admin only).

**Headers:**
```http
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "title": "Beautiful 2BR Apartment",
  "description": "Spacious apartment in downtown",
  "price": 350000,
  "location": {
    "address": "123 Main St",
    "city": "New York",
    "state": "NY",
    "zipCode": "10001"
  },
  "propertyType": "apartment",
  "bedrooms": 2,
  "bathrooms": 1,
  "squareFootage": 1200,
  "features": ["parking", "gym", "pool"]
}
```

**Response (201):**
```json
{
  "property": {
    "id": "prop_124",
    "title": "Beautiful 2BR Apartment",
    "status": "active",
    "createdAt": "2024-01-01T00:00:00Z"
  }
}
```

#### PUT /api/properties/:id
Update property listing (Agent/Admin only).

**Headers:**
```http
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "price": 375000,
  "description": "Updated description with new features"
}
```

**Response (200):**
```json
{
  "property": {
    "id": "prop_123",
    "title": "Beautiful 2BR Apartment",
    "price": 375000,
    "updatedAt": "2024-01-01T12:00:00Z"
  }
}
```

#### DELETE /api/properties/:id
Delete property listing (Agent/Admin only).

**Headers:**
```http
Authorization: Bearer <access_token>
```

**Response (200):**
```json
{
  "message": "Property successfully deleted"
}
```

### Search Endpoints

#### POST /api/search
Perform natural language property search.

**Request Body:**
```json
{
  "query": "2 bedroom apartment near Central Park under $400k",
  "filters": {
    "location": "New York",
    "maxPrice": 400000
  },
  "limit": 20,
  "offset": 0
}
```

**Response (200):**
```json
{
  "results": [
    {
      "property": {
        "id": "prop_123",
        "title": "Beautiful 2BR Apartment",
        "price": 350000,
        "location": {
          "address": "123 Main St",
          "city": "New York"
        },
        "bedrooms": 2,
        "bathrooms": 1
      },
      "relevanceScore": 0.95,
      "matchedFeatures": ["bedrooms", "location", "price"]
    }
  ],
  "searchMetadata": {
    "query": "2 bedroom apartment near Central Park under $400k",
    "totalResults": 25,
    "searchTime": 0.15,
    "suggestions": [
      "3 bedroom apartment near Central Park",
      "2 bedroom condo near Central Park"
    ]
  }
}
```

#### GET /api/search/suggestions
Get search suggestions based on partial query.

**Query Parameters:**
- `q` (string): Partial search query

**Example Request:**
```http
GET /api/search/suggestions?q=2 bedroom apart
```

**Response (200):**
```json
{
  "suggestions": [
    "2 bedroom apartment",
    "2 bedroom apartment downtown",
    "2 bedroom apartment with parking",
    "2 bedroom apartment near subway"
  ]
}
```

#### POST /api/search/similar
Find similar properties to a given property.

**Request Body:**
```json
{
  "propertyId": "prop_123",
  "limit": 10
}
```

**Response (200):**
```json
{
  "similarProperties": [
    {
      "property": {
        "id": "prop_124",
        "title": "Cozy 2BR Apartment",
        "price": 340000
      },
      "similarityScore": 0.88
    }
  ]
}
```

### Chat Endpoints

#### GET /api/chat/conversations
Get user's chat conversations.

**Headers:**
```http
Authorization: Bearer <access_token>
```

**Response (200):**
```json
{
  "conversations": [
    {
      "id": "conv_123",
      "propertyId": "prop_123",
      "participants": [
        {
          "id": "user_123",
          "name": "John Doe",
          "type": "buyer"
        },
        {
          "id": "agent_123",
          "name": "Jane Smith",
          "type": "agent"
        }
      ],
      "lastMessage": {
        "content": "Is the property still available?",
        "timestamp": "2024-01-01T12:00:00Z",
        "sender": "user_123"
      },
      "unreadCount": 2,
      "createdAt": "2024-01-01T10:00:00Z"
    }
  ]
}
```

#### GET /api/chat/conversations/:id/messages
Get messages from a conversation.

**Headers:**
```http
Authorization: Bearer <access_token>
```

**Query Parameters:**
- `page` (number): Page number
- `limit` (number): Messages per page

**Response (200):**
```json
{
  "messages": [
    {
      "id": "msg_123",
      "conversationId": "conv_123",
      "senderId": "user_123",
      "content": "Is the property still available?",
      "messageType": "text",
      "timestamp": "2024-01-01T12:00:00Z",
      "readBy": ["user_123"]
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 25
  }
}
```

#### POST /api/chat/conversations/:id/messages
Send a message in a conversation.

**Headers:**
```http
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "content": "Yes, I'm interested in scheduling a viewing.",
  "messageType": "text"
}
```

**Response (201):**
```json
{
  "message": {
    "id": "msg_124",
    "conversationId": "conv_123",
    "senderId": "user_123",
    "content": "Yes, I'm interested in scheduling a viewing.",
    "messageType": "text",
    "timestamp": "2024-01-01T12:05:00Z"
  }
}
```

### Users Endpoints

#### GET /api/users/profile
Get current user's profile.

**Headers:**
```http
Authorization: Bearer <access_token>
```

**Response (200):**
```json
{
  "user": {
    "id": "user_123",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "phone": "+1234567890",
    "userType": "buyer",
    "preferences": {
      "maxPrice": 500000,
      "preferredLocations": ["New York", "Brooklyn"],
      "propertyTypes": ["apartment", "condo"]
    },
    "savedProperties": ["prop_123", "prop_124"],
    "createdAt": "2024-01-01T00:00:00Z"
  }
}
```

#### PUT /api/users/profile
Update user profile.

**Headers:**
```http
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "firstName": "John",
  "lastName": "Smith",
  "phone": "+1234567891",
  "preferences": {
    "maxPrice": 600000,
    "preferredLocations": ["Manhattan", "Brooklyn"]
  }
}
```

**Response (200):**
```json
{
  "user": {
    "id": "user_123",
    "firstName": "John",
    "lastName": "Smith",
    "updatedAt": "2024-01-01T12:00:00Z"
  }
}
```

#### POST /api/users/saved-properties
Save a property to user's favorites.

**Headers:**
```http
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "propertyId": "prop_123"
}
```

**Response (201):**
```json
{
  "message": "Property saved successfully"
}
```

#### DELETE /api/users/saved-properties/:propertyId
Remove property from saved properties.

**Headers:**
```http
Authorization: Bearer <access_token>
```

**Response (200):**
```json
{
  "message": "Property removed from saved properties"
}
```

### Webhooks Endpoints

#### POST /api/webhooks/property-update
Webhook for property updates (Internal use).

**Request Body:**
```json
{
  "event": "property.updated",
  "propertyId": "prop_123",
  "changes": {
    "price": {
      "old": 350000,
      "new": 375000
    }
  },
  "timestamp": "2024-01-01T12:00:00Z"
}
```

## 🔌 WebSocket Events

### Connection
```javascript
const socket = io('wss://api.moov-property.com', {
  auth: {
    token: 'your_jwt_token'
  }
});
```

### Events

#### join_chat
Join a chat conversation.
```javascript
socket.emit('join_chat', {
  chatId: 'conv_123'
});
```

#### send_message
Send a message in a chat.
```javascript
socket.emit('send_message', {
  chatId: 'conv_123',
  content: 'Hello!',
  messageType: 'text'
});
```

#### new_message
Receive new messages.
```javascript
socket.on('new_message', (data) => {
  console.log('New message:', data);
});
```

#### property_update
Receive property updates.
```javascript
socket.on('property_update', (data) => {
  console.log('Property updated:', data);
});
```

## 📊 Data Models

### User Model
```typescript
interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  userType: 'buyer' | 'seller' | 'agent' | 'admin';
  preferences?: UserPreferences;
  savedProperties: string[];
  createdAt: string;
  updatedAt: string;
}

interface UserPreferences {
  maxPrice?: number;
  minPrice?: number;
  preferredLocations: string[];
  propertyTypes: string[];
  bedrooms?: number;
  bathrooms?: number;
}
```

### Property Model
```typescript
interface Property {
  id: string;
  title: string;
  description: string;
  price: number;
  location: Location;
  propertyType: 'apartment' | 'house' | 'condo' | 'townhouse';
  bedrooms: number;
  bathrooms: number;
  squareFootage?: number;
  images: string[];
  features: string[];
  agent: Agent;
  status: 'active' | 'pending' | 'sold' | 'inactive';
  createdAt: string;
  updatedAt: string;
}

interface Location {
  address: string;
  city: string;
  state: string;
  zipCode: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
}

interface Agent {
  id: string;
  name: string;
  email: string;
  phone: string;
  company?: string;
}
```

### Message Model
```typescript
interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  messageType: 'text' | 'image' | 'document';
  timestamp: string;
  readBy: string[];
}
```

## 💡 Examples

### JavaScript/TypeScript Client

```typescript
class MoovAPIClient {
  private baseURL: string;
  private token: string | null = null;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  async login(email: string, password: string) {
    const response = await fetch(`${this.baseURL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();
    this.token = data.tokens.accessToken;
    return data;
  }

  async searchProperties(query: string, filters?: any) {
    const response = await fetch(`${this.baseURL}/api/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`,
      },
      body: JSON.stringify({ query, filters }),
    });

    return response.json();
  }

  async getProperty(id: string) {
    const response = await fetch(`${this.baseURL}/api/properties/${id}`, {
      headers: {
        'Authorization': `Bearer ${this.token}`,
      },
    });

    return response.json();
  }
}

// Usage
const client = new MoovAPIClient('https://api.moov-property.com');
await client.login('user@example.com', 'password');
const results = await client.searchProperties('2 bedroom apartment in NYC');
```

### Python Client

```python
import requests
import json

class MoovAPIClient:
    def __init__(self, base_url):
        self.base_url = base_url
        self.token = None
        self.session = requests.Session()

    def login(self, email, password):
        response = self.session.post(
            f"{self.base_url}/api/auth/login",
            json={"email": email, "password": password}
        )
        data = response.json()
        self.token = data["tokens"]["accessToken"]
        self.session.headers.update({
            "Authorization": f"Bearer {self.token}"
        })
        return data

    def search_properties(self, query, filters=None):
        response = self.session.post(
            f"{self.base_url}/api/search",
            json={"query": query, "filters": filters or {}}
        )
        return response.json()

    def get_property(self, property_id):
        response = self.session.get(
            f"{self.base_url}/api/properties/{property_id}"
        )
        return response.json()

# Usage
client = MoovAPIClient("https://api.moov-property.com")
client.login("user@example.com", "password")
results = client.search_properties("2 bedroom apartment in NYC")
```

### cURL Examples

#### Login
```bash
curl -X POST https://api.moov-property.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123"
  }'
```

#### Search Properties
```bash
curl -X POST https://api.moov-property.com/api/search \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "query": "2 bedroom apartment near Central Park",
    "limit": 10
  }'
```

#### Get Property Details
```bash
curl -X GET https://api.moov-property.com/api/properties/prop_123 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 📞 Support

For API support and questions:
- **Email**: api-support@moov-property.com
- **Documentation**: https://docs.moov-property.com
- **Status Page**: https://status.moov-property.com

## 📄 License

This API documentation is proprietary to Moov Property Search. Unauthorized use is prohibited.