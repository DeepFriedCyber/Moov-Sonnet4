export const validationConfig = {
  // Property search limits
  search: {
    maxQueryLength: 100,
    maxResults: 50,
    maxRadius: 50, // km
  },
  
  // Property data limits
  property: {
    maxImages: 20,
    maxFeatures: 50,
    maxPrice: 50000000, // £50M
    maxDescriptionLength: 2000,
  },
  
  // File upload limits
  upload: {
    maxImageSize: 10 * 1024 * 1024, // 10MB
    maxDocumentSize: 5 * 1024 * 1024, // 5MB
    allowedImageTypes: ['image/jpeg', 'image/png', 'image/webp'],
    allowedDocumentTypes: ['application/pdf'],
  },
  
  // User data limits
  user: {
    maxNameLength: 50,
    maxEmailLength: 255,
    minPasswordLength: 8,
    maxPasswordLength: 100,
  }
};