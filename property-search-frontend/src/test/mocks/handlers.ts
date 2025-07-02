import { http, HttpResponse } from 'msw';
import { Property } from '@/types/property';

const mockProperties: Property[] = [
  {
    id: '1',
    title: 'Modern 2-Bed Apartment',
    price: 450000,
    location: {
      address: '123 Main St',
      city: 'London',
      postcode: 'SW1A 1AA',
      coordinates: { lat: 51.5074, lng: -0.1278 },
    },
    bedrooms: 2,
    bathrooms: 1,
    squareFootage: 850,
    propertyType: 'apartment',
    images: ['/images/property1.jpg'],
    features: ['Garden', 'Parking'],
    description: 'A beautiful modern apartment',
    listedDate: new Date('2024-01-01'),
    agent: {
      id: 'agent1',
      name: 'John Doe',
      phone: '+44 20 1234 5678',
      email: 'john@example.com',
    },
  },
  {
    id: '2',
    title: 'Spacious House with Garden',
    price: 650000,
    location: {
      address: '456 Oak Avenue',
      city: 'London',
      postcode: 'SW2B 2BB',
      coordinates: { lat: 51.4994, lng: -0.1245 },
    },
    bedrooms: 3,
    bathrooms: 2,
    squareFootage: 1200,
    propertyType: 'house',
    images: ['/images/property2.jpg'],
    features: ['Garden', 'Garage', 'Fireplace'],
    description: 'A spacious family home with beautiful garden',
    listedDate: new Date('2024-01-15'),
    agent: {
      id: 'agent2',
      name: 'Jane Smith',
      phone: '+44 20 9876 5432',
      email: 'jane@example.com',
    },
  },
];

export const handlers = [
  // Property search endpoint
  http.get('http://localhost:3001/api/properties/search', ({ request }) => {
    const url = new URL(request.url);
    const query = url.searchParams.get('q');
    const minPrice = url.searchParams.get('minPrice');
    const maxPrice = url.searchParams.get('maxPrice');
    const bedrooms = url.searchParams.get('bedrooms');

    let filteredProperties = [...mockProperties];

    // Apply filters
    if (minPrice) {
      filteredProperties = filteredProperties.filter(p => p.price >= parseInt(minPrice));
    }
    if (maxPrice) {
      filteredProperties = filteredProperties.filter(p => p.price <= parseInt(maxPrice));
    }
    if (bedrooms) {
      filteredProperties = filteredProperties.filter(p => p.bedrooms >= parseInt(bedrooms));
    }

    // Add semantic scores for testing
    const propertiesWithScores = filteredProperties.map(property => ({
      ...property,
      semanticScore: Math.random() * 0.3 + 0.7, // Random score between 0.7-1.0
    }));

    return HttpResponse.json({
      success: true,
      data: propertiesWithScores,
      meta: {
        query,
        count: propertiesWithScores.length,
        totalCount: propertiesWithScores.length,
      },
    });
  }),

  // Semantic search analysis endpoint
  http.post('http://localhost:8000/analyze', async ({ request }) => {
    const body = await request.json() as { query: string };
    
    return HttpResponse.json({
      query: body.query,
      extractedFilters: {
        bedrooms: body.query.includes('2 bed') ? 2 : body.query.includes('3 bed') ? 3 : null,
        propertyType: body.query.includes('apartment') ? 'apartment' : 
                     body.query.includes('house') ? 'house' : null,
        location: body.query.includes('London') ? { city: 'London' } : null,
        features: body.query.includes('garden') ? ['garden'] : [],
      },
      confidence: 0.95,
      suggestions: [
        'Try searching for "modern apartment with balcony"',
        'Consider expanding your search to nearby areas',
      ],
    });
  }),

  // Property details endpoint
  http.get('http://localhost:3001/api/properties/:id', ({ params }) => {
    const { id } = params;
    const property = mockProperties.find(p => p.id === id);
    
    if (!property) {
      return HttpResponse.json(
        { success: false, error: 'Property not found' },
        { status: 404 }
      );
    }

    return HttpResponse.json({
      success: true,
      data: property,
    });
  }),

  // Chat endpoint
  http.post('http://localhost:3001/api/chat', async ({ request }) => {
    const body = await request.json() as { message: string; sessionId?: string };
    
    return HttpResponse.json({
      success: true,
      data: {
        response: `I understand you're looking for properties. Based on your message "${body.message}", I can help you find suitable options.`,
        sessionId: body.sessionId || 'test-session-123',
        suggestions: [
          'Show me 2-bedroom apartments',
          'What about houses with gardens?',
          'Properties under £500k',
        ],
      },
    });
  }),

  // Error simulation for testing
  http.get('http://localhost:3001/api/properties/error', () => {
    return HttpResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }),
];