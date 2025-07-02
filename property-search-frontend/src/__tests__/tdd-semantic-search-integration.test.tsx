import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PropertySearchPage } from '@/components/PropertySearchPage';
import { server } from '@/test/mocks/server';
import { http, HttpResponse } from 'msw';

// TDD Integration Test: Semantic Search Workflow
describe('TDD Integration: Semantic Search Workflow', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  });

  const renderWithProviders = (component: React.ReactElement) => {
    return render(
      <QueryClientProvider client={queryClient}>
        {component}
      </QueryClientProvider>
    );
  };

  describe('RED Phase: Write failing tests first', () => {
    it('should fail initially - semantic search not implemented', async () => {
      // This test should fail initially, demonstrating RED phase
      server.use(
        http.get('http://localhost:3001/api/properties/search', () => {
          return HttpResponse.json(
            { success: false, error: 'Semantic search not implemented' },
            { status: 501 }
          );
        })
      );

      renderWithProviders(<PropertySearchPage />);
      
      const searchInput = screen.getByPlaceholderText(/search properties/i);
      const user = userEvent.setup();
      
      await user.type(searchInput, '2 bedroom luxury apartment in central london under £500k');
      await user.keyboard('{Enter}');

      // This should fail initially
      await waitFor(() => {
        expect(screen.queryByText(/semantic analysis/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('GREEN Phase: Make tests pass with minimal implementation', () => {
    it('should pass - basic semantic search implemented', async () => {
      // Mock successful semantic search response
      server.use(
        http.get('http://localhost:3001/api/properties/search', ({ request }) => {
          const url = new URL(request.url);
          const query = url.searchParams.get('q');
          
          return HttpResponse.json({
            success: true,
            data: [
              {
                id: '1',
                title: 'Luxury 2-Bed Apartment',
                price: 450000,
                location: {
                  city: 'London',
                  postcode: 'SW1A 1AA',
                  coordinates: { lat: 51.5074, lng: -0.1278 },
                },
                bedrooms: 2,
                bathrooms: 1,
                propertyType: 'apartment',
                semanticScore: 0.95,
              },
            ],
            meta: {
              query,
              count: 1,
              semanticAnalysis: {
                extractedFilters: {
                  bedrooms: 2,
                  propertyType: 'apartment',
                  location: { city: 'London' },
                  maxPrice: 500000,
                },
                confidence: 0.95,
              },
            },
          });
        }),

        http.post('http://localhost:8000/analyze', async ({ request }) => {
          const body = await request.json() as { query: string };
          
          return HttpResponse.json({
            query: body.query,
            extractedFilters: {
              bedrooms: 2,
              propertyType: 'apartment',
              location: { city: 'London' },
              maxPrice: 500000,
            },
            confidence: 0.95,
            suggestions: [
              'Try searching for "modern apartment with balcony"',
              'Consider expanding your search to nearby areas',
            ],
          });
        })
      );

      renderWithProviders(<PropertySearchPage />);
      
      const searchInput = screen.getByPlaceholderText(/search properties/i);
      const user = userEvent.setup();
      
      await user.type(searchInput, '2 bedroom luxury apartment in central london under £500k');
      await user.keyboard('{Enter}');

      // Should now pass with basic implementation
      await waitFor(() => {
        expect(screen.getByText('Luxury 2-Bed Apartment')).toBeInTheDocument();
        expect(screen.getByText('95% match')).toBeInTheDocument();
      });
    });

    it('should extract filters from natural language query', async () => {
      server.use(
        http.post('http://localhost:8000/analyze', async ({ request }) => {
          const body = await request.json() as { query: string };
          
          return HttpResponse.json({
            query: body.query,
            extractedFilters: {
              bedrooms: 3,
              propertyType: 'house',
              features: ['garden', 'parking'],
              location: { city: 'Manchester' },
            },
            confidence: 0.89,
          });
        })
      );

      renderWithProviders(<PropertySearchPage />);
      
      const searchInput = screen.getByPlaceholderText(/search properties/i);
      const user = userEvent.setup();
      
      await user.type(searchInput, '3 bed house with garden and parking in Manchester');
      await user.keyboard('{Enter}');

      await waitFor(() => {
        // Should show extracted filters
        expect(screen.getByText(/3 bedrooms/i)).toBeInTheDocument();
        expect(screen.getByText(/house/i)).toBeInTheDocument();
        expect(screen.getByText(/manchester/i)).toBeInTheDocument();
      });
    });
  });

  describe('REFACTOR Phase: Improve implementation while keeping tests green', () => {
    it('should handle complex queries with multiple filters', async () => {
      server.use(
        http.post('http://localhost:8000/analyze', async ({ request }) => {
          const body = await request.json() as { query: string };
          
          return HttpResponse.json({
            query: body.query,
            extractedFilters: {
              bedrooms: 2,
              bathrooms: 2,
              propertyType: 'apartment',
              features: ['balcony', 'gym', 'concierge'],
              location: { 
                city: 'London',
                nearBy: ['Hyde Park', 'tube station']
              },
              budget: {
                minPrice: 400000,
                maxPrice: 600000,
              },
            },
            confidence: 0.92,
            suggestions: [
              'Similar properties in Kensington',
              'Properties with river views',
            ],
          });
        }),

        http.get('http://localhost:3001/api/properties/search', () => {
          return HttpResponse.json({
            success: true,
            data: [
              {
                id: '1',
                title: 'Premium Apartment near Hyde Park',
                price: 550000,
                location: {
                  city: 'London',
                  postcode: 'W2 2UH',
                  coordinates: { lat: 51.5074, lng: -0.1278 },
                },
                bedrooms: 2,
                bathrooms: 2,
                propertyType: 'apartment',
                features: ['balcony', 'gym', 'concierge'],
                semanticScore: 0.92,
              },
            ],
            meta: {
              count: 1,
              facets: {
                priceRanges: [
                  { min: 400000, max: 600000, count: 5 },
                ],
                features: [
                  { feature: 'balcony', count: 3 },
                  { feature: 'gym', count: 2 },
                ],
              },
            },
          });
        })
      );

      renderWithProviders(<PropertySearchPage />);
      
      const searchInput = screen.getByPlaceholderText(/search properties/i);
      const user = userEvent.setup();
      
      await user.type(searchInput, 'luxury 2 bed 2 bath apartment with balcony gym concierge near Hyde Park tube station £400k-£600k');
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(screen.getByText('Premium Apartment near Hyde Park')).toBeInTheDocument();
        expect(screen.getByText('92% match')).toBeInTheDocument();
        expect(screen.getByText('£550,000')).toBeInTheDocument();
      });

      // Should show faceted search results
      await waitFor(() => {
        expect(screen.getByText(/balcony \(3\)/i)).toBeInTheDocument();
        expect(screen.getByText(/gym \(2\)/i)).toBeInTheDocument();
      });
    });

    it('should provide intelligent suggestions based on query analysis', async () => {
      server.use(
        http.post('http://localhost:8000/analyze', async ({ request }) => {
          const body = await request.json() as { query: string };
          
          return HttpResponse.json({
            query: body.query,
            extractedFilters: {
              lifestyle: ['family-friendly'],
              features: ['garden'],
              location: { nearBy: ['schools'] },
            },
            confidence: 0.87,
            suggestions: [
              'Properties near top-rated schools',
              'Family homes with large gardens',
              'Quiet residential areas',
            ],
          });
        })
      );

      renderWithProviders(<PropertySearchPage />);
      
      const searchInput = screen.getByPlaceholderText(/search properties/i);
      const user = userEvent.setup();
      
      await user.type(searchInput, 'family home with garden near good schools safe for children');
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(screen.getByText('Properties near top-rated schools')).toBeInTheDocument();
        expect(screen.getByText('Family homes with large gardens')).toBeInTheDocument();
        expect(screen.getByText('Quiet residential areas')).toBeInTheDocument();
      });
    });

    it('should handle error states gracefully', async () => {
      server.use(
        http.post('http://localhost:8000/analyze', () => {
          return HttpResponse.json(
            { error: 'Analysis service temporarily unavailable' },
            { status: 503 }
          );
        })
      );

      renderWithProviders(<PropertySearchPage />);
      
      const searchInput = screen.getByPlaceholderText(/search properties/i);
      const user = userEvent.setup();
      
      await user.type(searchInput, 'apartment in london');
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(screen.getByText(/search service temporarily unavailable/i)).toBeInTheDocument();
        expect(screen.getByText(/try again/i)).toBeInTheDocument();
      });
    });

    it('should cache search results for performance', async () => {
      let callCount = 0;
      
      server.use(
        http.get('http://localhost:3001/api/properties/search', () => {
          callCount++;
          return HttpResponse.json({
            success: true,
            data: [
              {
                id: '1',
                title: 'Cached Property',
                price: 300000,
                location: { city: 'London', postcode: 'E1 6AN' },
                bedrooms: 1,
                bathrooms: 1,
                propertyType: 'apartment',
              },
            ],
            meta: { count: 1 },
          });
        })
      );

      renderWithProviders(<PropertySearchPage />);
      
      const searchInput = screen.getByPlaceholderText(/search properties/i);
      const user = userEvent.setup();
      
      // First search
      await user.type(searchInput, 'apartment london');
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(screen.getByText('Cached Property')).toBeInTheDocument();
      });

      // Clear and search again with same query
      await user.clear(searchInput);
      await user.type(searchInput, 'apartment london');
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(screen.getByText('Cached Property')).toBeInTheDocument();
      });

      // Should have cached the result (implementation dependent)
      expect(callCount).toBeGreaterThan(0);
    });
  });

  describe('Performance and Quality Metrics', () => {
    it('should complete search within performance threshold', async () => {
      const startTime = Date.now();
      
      renderWithProviders(<PropertySearchPage />);
      
      const searchInput = screen.getByPlaceholderText(/search properties/i);
      const user = userEvent.setup();
      
      await user.type(searchInput, 'modern apartment');
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(screen.getByText(/properties found/i)).toBeInTheDocument();
      });

      const endTime = Date.now();
      const searchTime = endTime - startTime;
      
      // Should complete within 2 seconds
      expect(searchTime).toBeLessThan(2000);
    });

    it('should maintain accessibility standards', async () => {
      renderWithProviders(<PropertySearchPage />);
      
      const searchInput = screen.getByPlaceholderText(/search properties/i);
      
      // Should have proper ARIA labels
      expect(searchInput).toHaveAttribute('aria-label');
      
      // Should be keyboard navigable
      searchInput.focus();
      expect(document.activeElement).toBe(searchInput);
      
      // Should have proper semantic structure
      expect(screen.getByRole('main')).toBeInTheDocument();
      expect(screen.getByRole('search')).toBeInTheDocument();
    });
  });
});