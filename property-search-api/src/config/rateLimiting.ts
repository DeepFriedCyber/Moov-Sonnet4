export const rateLimitConfig = {
  // Standard API endpoints
  default: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100
  },
  
  // Property search (resource intensive)
  propertySearch: {
    windowMs: 15 * 60 * 1000,
    maxRequests: {
      anonymous: 100,
      authenticated: 200,
      premium: 500
    }
  },
  
  // Property details (less intensive)
  propertyDetails: {
    windowMs: 15 * 60 * 1000,
    maxRequests: {
      anonymous: 500,
      authenticated: 1000,
      premium: 2000
    }
  },
  
  // Write operations (favorites, etc.)
  writeOperations: {
    windowMs: 5 * 60 * 1000, // 5 minutes
    maxRequests: 50
  },

  // Authentication endpoints
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5 // Very restrictive for failed auth attempts
  },

  // Admin endpoints
  admin: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 1000
  }
};