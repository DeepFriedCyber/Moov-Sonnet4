// Comprehensive PropertySearchPage Tests
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PropertySearchPage } from '../PropertySearchPage';
import { ApiProvider } from '@/hooks/useApi';
import { Property } from '@/types';

// Mock SearchBar component
vi.mock('../SearchBar', () => ({
    SearchBar: ({ onSearch, value, onChange }: any) => (
        <div>
            <input
                data-testid="search-input"
                placeholder="Describe your ideal property..."
                value={value}
                onChange={(e) => onChange(e.target.value)}
            />
            <button
                data-testid="search-button"
                onClick={() => onSearch({ query: value })}
            >
                Search
            </button>
        </div>
    ),
}));

const mockProperties: (Property & { similarity_score?: number })[] = [
    {
        id: '1',
        title: 'Modern 2-bed flat',
        description: 'Beautiful flat with balcony in central London',
        price: 450000,
        bedrooms: 2,
        bathrooms: 1,
        area: 75,
        location: {
            address: '123 Test St',
            city: 'London',
            area: 'Central',
            postcode: 'SW1A 1AA',
            coordinates: { lat: 51.5, lng: -0.1 },
        },
        images: ['https://example.com/image1.jpg'],
        features: ['Balcony', 'Modern'],
        propertyType: 'flat',
        listingType: 'sale',
        agentId: 'agent-1',
        isActive: true,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        similarity_score: 0.95,
    },
    {
        id: '2',
        title: 'Spacious family house',
        description: 'Large house with garden perfect for families',
        price: 650000,
        bedrooms: 4,
        bathrooms: 2,
        area: 120,
        location: {
            address: '456 Family Ave',
            city: 'London',
            area: 'Suburbs',
            postcode: 'SW2 2BB',
            coordinates: { lat: 51.4, lng: -0.2 },
        },
        images: [],
        features: ['Garden', 'Parking'],
        propertyType: 'house',
        listingType: 'sale',
        agentId: 'agent-2',
        isActive: true,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        similarity_score: 0.87,
    },
];

const createWrapper = (mockApiClient: any) => {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false },
        },
    });

    return ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>
            <ApiProvider client={mockApiClient}>
                {children}
            </ApiProvider>
        </QueryClientProvider>
    );
};

describe('PropertySearchPage', () => {
    let mockApiClient: any;

    beforeEach(() => {
        mockApiClient = {
            searchProperties: vi.fn(),
            getProperty: vi.fn(),
            createProperty: vi.fn(),
            updateProperty: vi.fn(),
            deleteProperty: vi.fn(),
            healthCheck: vi.fn(),
            setAuthToken: vi.fn(),
        };
    });

    it('should render search interface', () => {
        const wrapper = createWrapper(mockApiClient);

        render(<PropertySearchPage />, { wrapper });

        expect(screen.getByText('Find Your Perfect Property')).toBeInTheDocument();
        expect(screen.getByText('Use natural language to describe your ideal home')).toBeInTheDocument();
        expect(screen.getByTestId('search-input')).toBeInTheDocument();
        expect(screen.getByText('Try searching for:')).toBeInTheDocument();
    });

    it('should display example search buttons', () => {
        const wrapper = createWrapper(mockApiClient);

        render(<PropertySearchPage />, { wrapper });

        expect(screen.getByText('Pet-friendly flat with outdoor space')).toBeInTheDocument();
        expect(screen.getByText('Victorian house needing renovation')).toBeInTheDocument();
        expect(screen.getByText('New build near tech companies')).toBeInTheDocument();
    });

    it('should search when example is clicked', async () => {
        const user = userEvent.setup();
        const wrapper = createWrapper(mockApiClient);

        mockApiClient.searchProperties.mockResolvedValue({
            properties: mockProperties,
            total: 2,
            page: 1,
            limit: 10,
            searchTime: 150,
        });

        render(<PropertySearchPage />, { wrapper });

        const exampleButton = screen.getByText('Pet-friendly flat with outdoor space');
        await user.click(exampleButton);

        await waitFor(() => {
            expect(mockApiClient.searchProperties).toHaveBeenCalledWith({
                query: 'Pet-friendly flat with outdoor space',
            });
        });
    });

    it('should perform search and display results', async () => {
        const user = userEvent.setup();
        const wrapper = createWrapper(mockApiClient);

        mockApiClient.searchProperties.mockResolvedValue({
            properties: mockProperties,
            total: 2,
            page: 1,
            limit: 10,
            searchTime: 150,
        });

        render(<PropertySearchPage />, { wrapper });

        const searchInput = screen.getByTestId('search-input');
        const searchButton = screen.getByTestId('search-button');

        await user.type(searchInput, 'Modern flat with balcony');
        await user.click(searchButton);

        // Check loading state
        expect(screen.getByText('Searching properties...')).toBeInTheDocument();
        expect(screen.getByTestId('loading-skeleton')).toBeInTheDocument();

        // Wait for results
        await waitFor(() => {
            expect(screen.getByText('Search Results for "Modern flat with balcony"')).toBeInTheDocument();
        });

        // Check results summary
        expect(screen.getByText('2 properties found')).toBeInTheDocument();
        expect(screen.getByText('Search completed in 150ms')).toBeInTheDocument();

        // Check property cards
        expect(screen.getByText('Modern 2-bed flat')).toBeInTheDocument();
        expect(screen.getByText('Spacious family house')).toBeInTheDocument();
        expect(screen.getByText('95% match')).toBeInTheDocument();
        expect(screen.getByText('87% match')).toBeInTheDocument();
    });

    it('should show loading state while searching', async () => {
        const user = userEvent.setup();
        const wrapper = createWrapper(mockApiClient);

        mockApiClient.searchProperties.mockImplementation(() =>
            new Promise(resolve => setTimeout(resolve, 100))
        );

        render(<PropertySearchPage />, { wrapper });

        const searchInput = screen.getByTestId('search-input');
        const searchButton = screen.getByTestId('search-button');

        await user.type(searchInput, 'Test search');
        await user.click(searchButton);

        expect(screen.getByText('Searching properties...')).toBeInTheDocument();
        expect(screen.getByTestId('loading-skeleton')).toBeInTheDocument();
    });

    it('should handle search errors', async () => {
        const user = userEvent.setup();
        const wrapper = createWrapper(mockApiClient);

        mockApiClient.searchProperties.mockRejectedValue(
            new Error('Search service unavailable')
        );

        render(<PropertySearchPage />, { wrapper });

        const searchInput = screen.getByTestId('search-input');
        const searchButton = screen.getByTestId('search-button');

        await user.type(searchInput, 'Test search');
        await user.click(searchButton);

        await waitFor(() => {
            expect(screen.getByText('Error searching properties')).toBeInTheDocument();
            expect(screen.getByText('Search service unavailable')).toBeInTheDocument();
        });

        // Test clear search button
        const clearButton = screen.getByText('Clear Search');
        await user.click(clearButton);

        expect(screen.queryByText('Error searching properties')).not.toBeInTheDocument();
    });

    it('should show empty state for no results', async () => {
        const user = userEvent.setup();
        const wrapper = createWrapper(mockApiClient);

        mockApiClient.searchProperties.mockResolvedValue({
            properties: [],
            total: 0,
            page: 1,
            limit: 10,
            searchTime: 50,
        });

        render(<PropertySearchPage />, { wrapper });

        const searchInput = screen.getByTestId('search-input');
        const searchButton = screen.getByTestId('search-button');

        await user.type(searchInput, 'Unicorn property');
        await user.click(searchButton);

        await waitFor(() => {
            expect(screen.getByText('No properties found')).toBeInTheDocument();
            expect(screen.getByText('Try adjusting your search criteria or browse our examples above.')).toBeInTheDocument();
        });

        // Test start new search button
        const newSearchButton = screen.getByText('Start New Search');
        await user.click(newSearchButton);

        expect(screen.queryByText('No properties found')).not.toBeInTheDocument();
    });

    it('should display property details correctly', async () => {
        const user = userEvent.setup();
        const wrapper = createWrapper(mockApiClient);

        mockApiClient.searchProperties.mockResolvedValue({
            properties: mockProperties,
            total: 2,
            page: 1,
            limit: 10,
            searchTime: 150,
        });

        render(<PropertySearchPage />, { wrapper });

        const searchInput = screen.getByTestId('search-input');
        const searchButton = screen.getByTestId('search-button');

        await user.type(searchInput, 'Modern flat');
        await user.click(searchButton);

        await waitFor(() => {
            expect(screen.getByText('Modern 2-bed flat')).toBeInTheDocument();
        });

        // Check property details
        expect(screen.getByText('£450,000')).toBeInTheDocument();
        expect(screen.getByText('2 bed')).toBeInTheDocument();
        expect(screen.getByText('1 bath')).toBeInTheDocument();
        expect(screen.getByText('75 sq ft')).toBeInTheDocument();
        expect(screen.getByText('Central, London')).toBeInTheDocument();
        expect(screen.getByText('flat')).toBeInTheDocument();
        expect(screen.getByText('For sale')).toBeInTheDocument();
    });

    it('should open property detail modal when property is clicked', async () => {
        const user = userEvent.setup();
        const wrapper = createWrapper(mockApiClient);

        mockApiClient.searchProperties.mockResolvedValue({
            properties: mockProperties,
            total: 1,
            page: 1,
            limit: 10,
            searchTime: 150,
        });

        render(<PropertySearchPage />, { wrapper });

        const searchInput = screen.getByTestId('search-input');
        const searchButton = screen.getByTestId('search-button');

        await user.type(searchInput, 'Modern flat');
        await user.click(searchButton);

        await waitFor(() => {
            expect(screen.getByText('Modern 2-bed flat')).toBeInTheDocument();
        });

        // Click on property card
        const propertyCard = screen.getByText('Modern 2-bed flat').closest('div');
        if (propertyCard) {
            await user.click(propertyCard);
        }

        // Check modal content
        await waitFor(() => {
            expect(screen.getAllByText('Modern 2-bed flat')).toHaveLength(2); // One in card, one in modal
            expect(screen.getByText('Description')).toBeInTheDocument();
            expect(screen.getByText('Beautiful flat with balcony in central London')).toBeInTheDocument();
            expect(screen.getByText('Features')).toBeInTheDocument();
            expect(screen.getByText('Balcony')).toBeInTheDocument();
            expect(screen.getByText('Modern')).toBeInTheDocument();
        });

        // Close modal
        const closeButton = screen.getByText('×');
        await user.click(closeButton);

        await waitFor(() => {
            expect(screen.getAllByText('Modern 2-bed flat')).toHaveLength(1); // Only in card
        });
    });

    it('should handle properties without images', async () => {
        const user = userEvent.setup();
        const wrapper = createWrapper(mockApiClient);

        mockApiClient.searchProperties.mockResolvedValue({
            properties: [mockProperties[1]], // House without images
            total: 1,
            page: 1,
            limit: 10,
            searchTime: 150,
        });

        render(<PropertySearchPage />, { wrapper });

        const searchInput = screen.getByTestId('search-input');
        const searchButton = screen.getByTestId('search-button');

        await user.type(searchInput, 'Family house');
        await user.click(searchButton);

        await waitFor(() => {
            expect(screen.getByText('Spacious family house')).toBeInTheDocument();
            expect(screen.getByText('No image available')).toBeInTheDocument();
        });
    });

    it('should update search input when example is selected', async () => {
        const user = userEvent.setup();
        const wrapper = createWrapper(mockApiClient);

        mockApiClient.searchProperties.mockResolvedValue({
            properties: [],
            total: 0,
            page: 1,
            limit: 10,
            searchTime: 50,
        });

        render(<PropertySearchPage />, { wrapper });

        const exampleButton = screen.getByText('Modern apartment with balcony');
        await user.click(exampleButton);

        const searchInput = screen.getByTestId('search-input') as HTMLInputElement;
        expect(searchInput.value).toBe('Modern apartment with balcony');
    });
});