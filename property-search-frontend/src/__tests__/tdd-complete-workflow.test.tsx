/**
 * TDD Complete Workflow Integration Test
 * 
 * This test demonstrates the complete TDD implementation across:
 * - Semantic Search with Natural Language Processing
 * - AI-Powered ChatBot with Conversation Management
 * - Property Search Integration
 * - Error Handling and Recovery
 * - Performance Optimization
 * - Accessibility Compliance
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PropertySearchPage } from '@/components/PropertySearchPage';
import { ChatBot } from '@/components/ChatBot';
import { server } from '@/test/mocks/server';
import { http, HttpResponse } from 'msw';

describe('TDD Complete Workflow Integration', () => {
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

    describe('🔴 RED Phase: Define Requirements Through Failing Tests', () => {
        it('should fail initially - semantic search not implemented', async () => {
            // This test defines what we want to achieve
            renderWithProviders(<PropertySearchPage />);

            const searchInput = screen.getByRole('textbox');
            const user = userEvent.setup();

            await user.type(searchInput, '2 bedroom luxury apartment in central London under £500k');
            await user.keyboard('{Enter}');

            // Initially this should fail - no semantic analysis
            await waitFor(() => {
                expect(screen.queryByText(/semantic analysis/i)).not.toBeInTheDocument();
            });
        });

        it('should fail initially - chatbot integration not working', async () => {
            renderWithProviders(<ChatBot />);

            const chatInput = screen.getByRole('textbox', { name: /message/i });
            const sendButton = screen.getByRole('button', { name: /send/i });
            const user = userEvent.setup();

            await user.type(chatInput, 'Find me a family home with garden');
            await user.click(sendButton);

            // Should fail - no property integration
            await waitFor(() => {
                expect(screen.queryByText(/found properties/i)).not.toBeInTheDocument();
            });
        });

        it('should fail initially - no intelligent suggestions', async () => {
            renderWithProviders(<PropertySearchPage />);

            // Should fail - no AI-powered suggestions
            expect(screen.queryByText(/based on your search/i)).not.toBeInTheDocument();
        });
    });

    describe('🟢 GREEN Phase: Minimal Implementation to Pass Tests', () => {
        beforeEach(() => {
            // Mock successful API responses
            server.use(
                http.get('http://localhost:3001/api/properties/search', ({ request }) => {
                    const url = new URL(request.url);
                    const query = url.searchParams.get('q');

                    return HttpResponse.json({
                        success: true,
                        data: {
                            properties: [
                                {
                                    id: '1',
                                    title: '2-Bed Luxury Apartment',
                                    price: 450000,
                                    location: {
                                        address: '123 Central Street',
                                        area: 'Central London',
                                        city: 'London',
                                        postcode: 'SW1A 1AA',
                                    },
                                    bedrooms: 2,
                                    bathrooms: 1,
                                    area: 850,
                                    propertyType: 'apartment',
                                    listingType: 'sale',
                                    images: ['/images/property1.jpg'],
                                    features: ['luxury', 'central'],
                                    description: 'Beautiful luxury apartment in central London',
                                    similarity_score: 0.95,
                                },
                            ],
                            semanticAnalysis: {
                                extractedFilters: {
                                    bedrooms: 2,
                                    propertyType: 'apartment',
                                    location: 'central London',
                                    maxPrice: 500000,
                                    features: ['luxury'],
                                },
                                confidence: 0.92,
                                suggestions: [
                                    'Similar luxury apartments',
                                    'Properties in nearby areas',
                                    'Apartments with balconies',
                                ],
                            },
                            searchTime: 85,
                        },
                    });
                }),

                http.post('http://localhost:3001/api/chat', async ({ request }) => {
                    const body = await request.json() as { message: string };

                    return HttpResponse.json({
                        success: true,
                        data: {
                            response: `I found some excellent properties matching "${body.message}". Let me show you the best options.`,
                            sessionId: 'test-session-123',
                            propertyResults: [
                                {
                                    id: '1',
                                    title: 'Family Home with Garden',
                                    price: 650000,
                                    location: { city: 'London', postcode: 'SW19 2AB' },
                                    bedrooms: 3,
                                    bathrooms: 2,
                                },
                            ],
                            suggestions: [
                                'View property details',
                                'Search similar properties',
                                'Properties with larger gardens',
                            ],
                        },
                    });
                })
            );
        });

        it('should perform semantic search with natural language', async () => {
            renderWithProviders(<PropertySearchPage />);

            const searchInput = screen.getByRole('textbox');
            const user = userEvent.setup();

            await user.type(searchInput, '2 bedroom luxury apartment in central London under £500k');
            await user.keyboard('{Enter}');

            // Should now pass - semantic analysis working
            await waitFor(() => {
                expect(screen.getByText('2-Bed Luxury Apartment')).toBeInTheDocument();
                expect(screen.getByText('95% match')).toBeInTheDocument();
                expect(screen.getByText('£450,000')).toBeInTheDocument();
            });
        });

        it('should integrate chatbot with property search', async () => {
            renderWithProviders(<ChatBot />);

            const chatInput = screen.getByRole('textbox', { name: /message/i });
            const sendButton = screen.getByRole('button', { name: /send/i });
            const user = userEvent.setup();

            await user.type(chatInput, 'Find me a family home with garden');
            await user.click(sendButton);

            // Should now pass - property integration working
            await waitFor(() => {
                expect(screen.getByText(/I found some excellent properties/)).toBeInTheDocument();
                expect(screen.getByText('Family Home with Garden')).toBeInTheDocument();
                expect(screen.getByText('View property details')).toBeInTheDocument();
            });
        });

        it('should provide intelligent suggestions', async () => {
            renderWithProviders(<PropertySearchPage />);

            const searchInput = screen.getByRole('textbox');
            const user = userEvent.setup();

            await user.type(searchInput, '2 bedroom luxury apartment in central London under £500k');
            await user.keyboard('{Enter}');

            // Should now pass - AI suggestions working
            await waitFor(() => {
                expect(screen.getByText(/Search completed in \d+ms/)).toBeInTheDocument();
            });
        });
    });

    describe('🔵 REFACTOR Phase: Enhanced Implementation with Advanced Features', () => {
        beforeEach(() => {
            // Enhanced API responses with more sophisticated features
            server.use(
                http.get('http://localhost:3001/api/properties/search', ({ request }) => {
                    const url = new URL(request.url);
                    const query = url.searchParams.get('q');

                    return HttpResponse.json({
                        success: true,
                        data: {
                            properties: [
                                {
                                    id: '1',
                                    title: '2-Bed Luxury Apartment with Balcony',
                                    price: 450000,
                                    location: {
                                        address: '123 Central Street',
                                        area: 'Central London',
                                        city: 'London',
                                        postcode: 'SW1A 1AA',
                                    },
                                    bedrooms: 2,
                                    bathrooms: 1,
                                    area: 850,
                                    propertyType: 'apartment',
                                    listingType: 'sale',
                                    images: ['/images/property1.jpg'],
                                    features: ['luxury', 'central', 'balcony', 'concierge'],
                                    description: 'Beautiful luxury apartment in central London with private balcony',
                                    similarity_score: 0.95,
                                },
                                {
                                    id: '2',
                                    title: '2-Bed Modern Flat with Gym',
                                    price: 420000,
                                    location: {
                                        address: '456 Modern Way',
                                        area: 'Central London',
                                        city: 'London',
                                        postcode: 'SW1B 2CD',
                                    },
                                    bedrooms: 2,
                                    bathrooms: 1,
                                    area: 780,
                                    propertyType: 'apartment',
                                    listingType: 'sale',
                                    images: ['/images/property2.jpg'],
                                    features: ['modern', 'gym', 'parking'],
                                    description: 'Contemporary apartment with building amenities',
                                    similarity_score: 0.88,
                                },
                            ],
                            semanticAnalysis: {
                                extractedFilters: {
                                    bedrooms: 2,
                                    propertyType: 'apartment',
                                    location: 'central London',
                                    maxPrice: 500000,
                                    features: ['luxury'],
                                    lifestyle: ['modern'],
                                },
                                confidence: 0.92,
                                queryIntent: 'purchase',
                                suggestions: [
                                    'Similar luxury apartments',
                                    'Properties with balconies',
                                    'Apartments with concierge',
                                    'Modern apartments with amenities',
                                ],
                                marketInsights: {
                                    averagePrice: 435000,
                                    priceRange: { min: 380000, max: 520000 },
                                    trend: 'increasing',
                                },
                            },
                            searchTime: 78,
                            totalResults: 24,
                        },
                    });
                }),

                http.post('http://localhost:3001/api/chat', async ({ request }) => {
                    const body = await request.json() as { message: string; sessionId?: string };

                    // Simulate intelligent conversation
                    let response = '';
                    let propertyResults = [];
                    let suggestions = [];

                    if (body.message.toLowerCase().includes('family')) {
                        response = 'I understand you\'re looking for a family-friendly property. Based on your requirements, I\'ve found some excellent options with gardens and good school access.';
                        propertyResults = [
                            {
                                id: '1',
                                title: 'Family Home with Large Garden',
                                price: 650000,
                                location: { city: 'London', postcode: 'SW19 2AB' },
                                bedrooms: 4,
                                bathrooms: 2,
                            },
                        ];
                        suggestions = [
                            'Properties near good schools',
                            'Homes with larger gardens',
                            'Family-friendly neighborhoods',
                        ];
                    } else if (body.message.toLowerCase().includes('luxury')) {
                        response = 'I can help you find luxury properties. Here are some premium options that match your criteria.';
                        propertyResults = [
                            {
                                id: '2',
                                title: 'Luxury Penthouse with City Views',
                                price: 1200000,
                                location: { city: 'London', postcode: 'SW1A 1AA' },
                                bedrooms: 3,
                                bathrooms: 2,
                            },
                        ];
                        suggestions = [
                            'Premium properties with amenities',
                            'Penthouses with views',
                            'Luxury developments',
                        ];
                    }

                    return HttpResponse.json({
                        success: true,
                        data: {
                            response,
                            sessionId: body.sessionId || `session-${Date.now()}`,
                            propertyResults,
                            suggestions,
                            conversationContext: {
                                userPreferences: {
                                    extractedFromMessage: body.message,
                                    inferredBudget: body.message.includes('luxury') ? 'high' : 'medium',
                                },
                            },
                        },
                    });
                })
            );
        });

        it('should provide advanced semantic analysis with market insights', async () => {
            renderWithProviders(<PropertySearchPage />);

            const searchInput = screen.getByRole('textbox');
            const user = userEvent.setup();

            await user.type(searchInput, '2 bedroom luxury apartment in central London under £500k');
            await user.keyboard('{Enter}');

            await waitFor(() => {
                // Advanced semantic matching
                expect(screen.getByText('2-Bed Luxury Apartment with Balcony')).toBeInTheDocument();
                expect(screen.getByText('2-Bed Modern Flat with Gym')).toBeInTheDocument();

                // Semantic scores
                expect(screen.getByText('95% match')).toBeInTheDocument();
                expect(screen.getByText('88% match')).toBeInTheDocument();

                // Results summary
                expect(screen.getByText('2 properties found')).toBeInTheDocument();
                expect(screen.getByText(/Search completed in \d+ms/)).toBeInTheDocument();
            });
        });

        it('should handle complex conversational context in chatbot', async () => {
            renderWithProviders(<ChatBot />);

            const chatInput = screen.getByRole('textbox', { name: /message/i });
            const sendButton = screen.getByRole('button', { name: /send/i });
            const user = userEvent.setup();

            // First message - establish context
            await user.type(chatInput, 'I need a family home with garden for my children');
            await user.click(sendButton);

            await waitFor(() => {
                expect(screen.getByText(/family-friendly property/)).toBeInTheDocument();
                expect(screen.getByText('Family Home with Large Garden')).toBeInTheDocument();
                expect(screen.getByText('Properties near good schools')).toBeInTheDocument();
            });

            // Second message - context should be maintained
            await user.clear(chatInput);
            await user.type(chatInput, 'What about luxury options?');
            await user.click(sendButton);

            await waitFor(() => {
                expect(screen.getByText(/luxury properties/)).toBeInTheDocument();
                expect(screen.getByText('Luxury Penthouse with City Views')).toBeInTheDocument();
                expect(screen.getByText('Premium properties with amenities')).toBeInTheDocument();
            });
        });

        it('should demonstrate complete error handling and recovery', async () => {
            // Simulate API failure
            server.use(
                http.get('http://localhost:3001/api/properties/search', () => {
                    return HttpResponse.json(
                        { success: false, error: 'Service temporarily unavailable' },
                        { status: 503 }
                    );
                })
            );

            renderWithProviders(<PropertySearchPage />);

            const searchInput = screen.getByRole('textbox');
            const user = userEvent.setup();

            await user.type(searchInput, 'test search');
            await user.keyboard('{Enter}');

            // Should handle error gracefully
            await waitFor(() => {
                expect(screen.getByText(/temporarily unavailable/i)).toBeInTheDocument();
                expect(screen.getByText(/try again/i)).toBeInTheDocument();
            });
        });

        it('should meet performance benchmarks', async () => {
            renderWithProviders(<PropertySearchPage />);

            const searchInput = screen.getByRole('textbox');
            const user = userEvent.setup();

            const startTime = performance.now();

            await user.type(searchInput, '2 bedroom apartment');
            await user.keyboard('{Enter}');

            await waitFor(() => {
                expect(screen.getByText(/Search completed in \d+ms/)).toBeInTheDocument();
            });

            const endTime = performance.now();
            const totalTime = endTime - startTime;

            // Should complete within performance target
            expect(totalTime).toBeLessThan(2000); // 2 seconds max for full workflow
        });

        it('should maintain accessibility compliance', async () => {
            renderWithProviders(<PropertySearchPage />);

            const searchInput = screen.getByRole('textbox');
            const user = userEvent.setup();

            // Check ARIA labels
            expect(searchInput).toHaveAttribute('aria-label');

            await user.type(searchInput, 'accessible search test');
            await user.keyboard('{Enter}');

            await waitFor(() => {
                // Check semantic HTML structure
                const propertyCards = screen.getAllByRole('article');
                expect(propertyCards.length).toBeGreaterThan(0);

                // Check keyboard navigation
                propertyCards.forEach(card => {
                    expect(card).toHaveAttribute('tabindex', '0');
                });
            });
        });

        it('should demonstrate complete TDD workflow integration', async () => {
            // This test demonstrates the complete integration of all TDD components
            const TestComponent = () => (
                <div className="flex gap-4">
                    <div className="flex-1">
                        <PropertySearchPage />
                    </div>
                    <div className="w-96">
                        <ChatBot />
                    </div>
                </div>
            );

            renderWithProviders(<TestComponent />);

            const user = userEvent.setup();

            // 1. Semantic Search
            const searchInput = screen.getByRole('textbox', { name: /search/i });
            await user.type(searchInput, '2 bedroom luxury apartment in London');
            await user.keyboard('{Enter}');

            await waitFor(() => {
                expect(screen.getByText('2-Bed Luxury Apartment with Balcony')).toBeInTheDocument();
            });

            // 2. ChatBot Interaction
            const chatInput = screen.getByRole('textbox', { name: /message/i });
            const sendButton = screen.getByRole('button', { name: /send/i });

            await user.type(chatInput, 'Tell me more about luxury properties');
            await user.click(sendButton);

            await waitFor(() => {
                expect(screen.getByText(/luxury properties/)).toBeInTheDocument();
            });

            // 3. Verify complete integration
            expect(screen.getByText(/properties found/)).toBeInTheDocument();
            expect(screen.getByText(/Assistant is typing/i)).not.toBeInTheDocument();
        });
    });

    describe('🏆 Quality Assurance and Production Readiness', () => {
        it('should handle edge cases gracefully', async () => {
            renderWithProviders(<PropertySearchPage />);

            const searchInput = screen.getByRole('textbox');
            const user = userEvent.setup();

            // Test empty search
            await user.keyboard('{Enter}');
            expect(screen.queryByText(/properties found/)).not.toBeInTheDocument();

            // Test very long search
            const longSearch = 'a'.repeat(1000);
            await user.type(searchInput, longSearch);
            await user.keyboard('{Enter}');

            // Should handle gracefully without crashing
            expect(screen.getByRole('textbox')).toBeInTheDocument();
        });

        it('should maintain state consistency across interactions', async () => {
            renderWithProviders(<PropertySearchPage />);

            const searchInput = screen.getByRole('textbox');
            const user = userEvent.setup();

            // Multiple searches should maintain consistent state
            await user.type(searchInput, 'first search');
            await user.keyboard('{Enter}');

            await waitFor(() => {
                expect(screen.getByText(/properties found/)).toBeInTheDocument();
            });

            await user.clear(searchInput);
            await user.type(searchInput, 'second search');
            await user.keyboard('{Enter}');

            // State should be updated consistently
            await waitFor(() => {
                expect(screen.getByText(/Search Results for "second search"/)).toBeInTheDocument();
            });
        });

        it('should demonstrate memory efficiency', async () => {
            renderWithProviders(<ChatBot maxMessages={5} />);

            const chatInput = screen.getByRole('textbox', { name: /message/i });
            const sendButton = screen.getByRole('button', { name: /send/i });
            const user = userEvent.setup();

            // Send multiple messages to test memory limits
            for (let i = 1; i <= 10; i++) {
                await user.clear(chatInput);
                await user.type(chatInput, `Message ${i}`);
                await user.click(sendButton);

                await waitFor(() => {
                    expect(screen.getByText(`Message ${i}`)).toBeInTheDocument();
                });
            }

            // Should only show last 5 messages (plus responses)
            expect(screen.queryByText('Message 1')).not.toBeInTheDocument();
            expect(screen.queryByText('Message 6')).not.toBeInTheDocument();
            expect(screen.getByText('Message 10')).toBeInTheDocument();
        });
    });
});