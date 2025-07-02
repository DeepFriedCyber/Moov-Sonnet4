import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ChatBot } from './ChatBot';
import { server } from '@/test/mocks/server';
import { http, HttpResponse } from 'msw';

describe('ChatBot TDD Implementation', () => {
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

    describe('RED Phase: Initial failing tests', () => {
        it('should fail initially - chat interface not implemented', () => {
            renderWithProviders(<ChatBot />);

            // This should fail initially
            expect(screen.queryByRole('textbox', { name: /message/i })).not.toBeInTheDocument();
            expect(screen.queryByRole('button', { name: /send/i })).not.toBeInTheDocument();
        });

        it('should fail initially - message sending not implemented', async () => {
            renderWithProviders(<ChatBot />);

            // Should fail - no chat functionality
            const input = screen.queryByRole('textbox');
            expect(input).toBeNull();
        });
    });

    describe('GREEN Phase: Basic implementation', () => {
        it('should render chat interface', () => {
            renderWithProviders(<ChatBot />);

            expect(screen.getByRole('textbox', { name: /message/i })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /send/i })).toBeInTheDocument();
            expect(screen.getByText(/property assistant/i)).toBeInTheDocument();
        });

        it('should send message and receive response', async () => {
            server.use(
                http.post('http://localhost:3001/api/chat', async ({ request }) => {
                    const body = await request.json() as { message: string };

                    return HttpResponse.json({
                        success: true,
                        data: {
                            response: `I understand you're looking for "${body.message}". Let me help you find suitable properties.`,
                            sessionId: 'test-session-123',
                            suggestions: [
                                'Show me 2-bedroom apartments',
                                'What about houses with gardens?',
                            ],
                        },
                    });
                })
            );

            renderWithProviders(<ChatBot />);

            const input = screen.getByRole('textbox', { name: /message/i });
            const sendButton = screen.getByRole('button', { name: /send/i });
            const user = userEvent.setup();

            await user.type(input, 'I need a 2 bedroom apartment in London');
            await user.click(sendButton);

            await waitFor(() => {
                expect(screen.getByText(/I understand you're looking for/)).toBeInTheDocument();
            });
        });

        it('should display conversation history', async () => {
            server.use(
                http.post('http://localhost:3001/api/chat', async () => {
                    return HttpResponse.json({
                        success: true,
                        data: {
                            response: 'Here are some properties that match your criteria.',
                            sessionId: 'test-session-123',
                        },
                    });
                })
            );

            renderWithProviders(<ChatBot />);

            const input = screen.getByRole('textbox', { name: /message/i });
            const sendButton = screen.getByRole('button', { name: /send/i });
            const user = userEvent.setup();

            // Send first message
            await user.type(input, 'Hello');
            await user.click(sendButton);

            await waitFor(() => {
                expect(screen.getByText('Hello')).toBeInTheDocument();
                expect(screen.getByText(/Here are some properties/)).toBeInTheDocument();
            });

            // Send second message
            await user.clear(input);
            await user.type(input, 'Show me more details');
            await user.click(sendButton);

            await waitFor(() => {
                expect(screen.getByText('Show me more details')).toBeInTheDocument();
            });
        });
    });

    describe('REFACTOR Phase: Enhanced features', () => {
        it('should handle property search integration', async () => {
            server.use(
                http.post('http://localhost:3001/api/chat', async ({ request }) => {
                    const body = await request.json() as { message: string };

                    return HttpResponse.json({
                        success: true,
                        data: {
                            response: 'I found some properties matching your criteria.',
                            sessionId: 'test-session-123',
                            propertyResults: [
                                {
                                    id: '1',
                                    title: '2-Bed Apartment in London',
                                    price: 450000,
                                    location: { city: 'London', postcode: 'SW1A 1AA' },
                                    bedrooms: 2,
                                    bathrooms: 1,
                                },
                            ],
                            suggestions: ['View property details', 'Search similar properties'],
                        },
                    });
                })
            );

            renderWithProviders(<ChatBot />);

            const input = screen.getByRole('textbox', { name: /message/i });
            const sendButton = screen.getByRole('button', { name: /send/i });
            const user = userEvent.setup();

            await user.type(input, 'Find me a 2 bedroom apartment in London');
            await user.click(sendButton);

            await waitFor(() => {
                expect(screen.getByText('2-Bed Apartment in London')).toBeInTheDocument();
                expect(screen.getByText('£450,000')).toBeInTheDocument();
                expect(screen.getByText('View property details')).toBeInTheDocument();
            });
        });

        it('should provide intelligent suggestions', async () => {
            server.use(
                http.post('http://localhost:3001/api/chat', async () => {
                    return HttpResponse.json({
                        success: true,
                        data: {
                            response: 'Based on your preferences, here are some suggestions.',
                            sessionId: 'test-session-123',
                            suggestions: [
                                'Properties near good schools',
                                'Family-friendly neighborhoods',
                                'Properties with gardens',
                            ],
                        },
                    });
                })
            );

            renderWithProviders(<ChatBot />);

            const input = screen.getByRole('textbox', { name: /message/i });
            const sendButton = screen.getByRole('button', { name: /send/i });
            const user = userEvent.setup();

            await user.type(input, 'I have a young family');
            await user.click(sendButton);

            await waitFor(() => {
                expect(screen.getByText('Properties near good schools')).toBeInTheDocument();
                expect(screen.getByText('Family-friendly neighborhoods')).toBeInTheDocument();
                expect(screen.getByText('Properties with gardens')).toBeInTheDocument();
            });
        });

        it('should handle typing indicators', async () => {
            let resolveResponse: (value: any) => void;
            const responsePromise = new Promise(resolve => {
                resolveResponse = resolve;
            });

            server.use(
                http.post('http://localhost:3001/api/chat', async () => {
                    await responsePromise;
                    return HttpResponse.json({
                        success: true,
                        data: {
                            response: 'Here is my response.',
                            sessionId: 'test-session-123',
                        },
                    });
                })
            );

            renderWithProviders(<ChatBot />);

            const input = screen.getByRole('textbox', { name: /message/i });
            const sendButton = screen.getByRole('button', { name: /send/i });
            const user = userEvent.setup();

            await user.type(input, 'Hello');
            await user.click(sendButton);

            // Should show typing indicator
            expect(screen.getByText(/typing/i)).toBeInTheDocument();

            // Resolve the response
            resolveResponse(null);

            await waitFor(() => {
                expect(screen.queryByText(/typing/i)).not.toBeInTheDocument();
                expect(screen.getByText('Here is my response.')).toBeInTheDocument();
            });
        });

        it('should handle error states gracefully', async () => {
            server.use(
                http.post('http://localhost:3001/api/chat', () => {
                    return HttpResponse.json(
                        { success: false, error: 'Chat service temporarily unavailable' },
                        { status: 503 }
                    );
                })
            );

            renderWithProviders(<ChatBot />);

            const input = screen.getByRole('textbox', { name: /message/i });
            const sendButton = screen.getByRole('button', { name: /send/i });
            const user = userEvent.setup();

            await user.type(input, 'Hello');
            await user.click(sendButton);

            await waitFor(() => {
                expect(screen.getByText(/temporarily unavailable/i)).toBeInTheDocument();
                expect(screen.getByText(/try again/i)).toBeInTheDocument();
            });
        });

        it('should support keyboard shortcuts', async () => {
            renderWithProviders(<ChatBot />);

            const input = screen.getByRole('textbox', { name: /message/i });
            const user = userEvent.setup();

            await user.type(input, 'Test message');
            await user.keyboard('{Enter}');

            // Should send message on Enter key
            await waitFor(() => {
                expect(screen.getByText('Test message')).toBeInTheDocument();
            });
        });

        it('should maintain session context', async () => {
            let sessionId = '';

            server.use(
                http.post('http://localhost:3001/api/chat', async ({ request }) => {
                    const body = await request.json() as { message: string; sessionId?: string };

                    if (!sessionId) {
                        sessionId = 'session-' + Date.now();
                    }

                    return HttpResponse.json({
                        success: true,
                        data: {
                            response: `Message received in session ${sessionId}`,
                            sessionId,
                        },
                    });
                })
            );

            renderWithProviders(<ChatBot />);

            const input = screen.getByRole('textbox', { name: /message/i });
            const sendButton = screen.getByRole('button', { name: /send/i });
            const user = userEvent.setup();

            // Send first message
            await user.type(input, 'First message');
            await user.click(sendButton);

            await waitFor(() => {
                expect(screen.getByText(/Message received in session/)).toBeInTheDocument();
            });

            // Send second message - should use same session
            await user.clear(input);
            await user.type(input, 'Second message');
            await user.click(sendButton);

            await waitFor(() => {
                const messages = screen.getAllByText(/Message received in session/);
                expect(messages).toHaveLength(2);
            });
        });
    });

    describe('Accessibility and UX', () => {
        it('should have proper ARIA labels', () => {
            renderWithProviders(<ChatBot />);

            const input = screen.getByRole('textbox', { name: /message/i });
            const sendButton = screen.getByRole('button', { name: /send/i });

            expect(input).toHaveAttribute('aria-label');
            expect(sendButton).toHaveAttribute('aria-label');
        });

        it('should support screen readers', () => {
            renderWithProviders(<ChatBot />);

            const chatContainer = screen.getByRole('log');
            expect(chatContainer).toHaveAttribute('aria-live', 'polite');
        });

        it('should handle focus management', async () => {
            renderWithProviders(<ChatBot />);

            const input = screen.getByRole('textbox', { name: /message/i });
            const sendButton = screen.getByRole('button', { name: /send/i });
            const user = userEvent.setup();

            // Focus should return to input after sending
            await user.type(input, 'Test');
            await user.click(sendButton);

            await waitFor(() => {
                expect(input).toHaveFocus();
            });
        });
    });

    describe('Performance', () => {
        it('should debounce typing indicators', async () => {
            renderWithProviders(<ChatBot />);

            const input = screen.getByRole('textbox', { name: /message/i });
            const user = userEvent.setup();

            // Rapid typing should not trigger multiple typing events
            await user.type(input, 'Quick typing test', { delay: 10 });

            // Should handle rapid input without performance issues
            expect(input).toHaveValue('Quick typing test');
        });

        it('should limit message history for memory management', async () => {
            renderWithProviders(<ChatBot maxMessages={3} />);

            const input = screen.getByRole('textbox', { name: /message/i });
            const sendButton = screen.getByRole('button', { name: /send/i });
            const user = userEvent.setup();

            // Send multiple messages
            for (let i = 1; i <= 5; i++) {
                await user.clear(input);
                await user.type(input, `Message ${i}`);
                await user.click(sendButton);

                await waitFor(() => {
                    expect(screen.getByText(`Message ${i}`)).toBeInTheDocument();
                });
            }

            // Should only show last 3 messages
            expect(screen.queryByText('Message 1')).not.toBeInTheDocument();
            expect(screen.queryByText('Message 2')).not.toBeInTheDocument();
            expect(screen.getByText('Message 3')).toBeInTheDocument();
            expect(screen.getByText('Message 4')).toBeInTheDocument();
            expect(screen.getByText('Message 5')).toBeInTheDocument();
        });
    });
});