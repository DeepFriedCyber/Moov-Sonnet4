// TDD Enhanced PropertySearchPage Tests
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PropertySearchPageEnhanced } from '../PropertySearchPage.enhanced';

// Mock the semantic search hooks
vi.mock('@/hooks/useSemanticSearch', () => ({
    useSemanticSearch: vi.fn(),
    useSemanticSearchStats: vi.fn(() => ({
        totalProperties: 0,
        averageRelevance: 0,
        highRelevanceCount: 0,
        searchTime: 0,
        hasSemanticAnalysis: false,
        topMatchReasons: []
    }))
}));

// Mock Next.js Image component
vi.mock('next/image', () => ({
    default: ({ src, alt, ...props }: any) => (
        <img src={src} alt={alt} {...props} />
    )
}));

import { useSemanticSearch } from '@/hooks/useSemanticSearch';

// Mock data
const mockProperties = [
    {
        id: '1',
        title: 'Modern Luxury Apartment',
        description: 'Beautiful 2-bedroom apartment with stunning city views',
        price: 450000,
        bedrooms: 2,
        bathrooms: 2,
        area: 1200,
        propertyType: 'apartment',
        listingType: 'sale',
        location: {
            address: '123 City Center',
            area: 'Downtown',
            city: 'London',
            postcode: 'SW1A 1AA'
        },
        images: ['https://example.com/image1.jpg'],
        features: ['Balcony', 'Parking', 'Gym'],
        similarity_score: 0.95
    },
    {
        id: '2',
        title: 'Family Home with Garden',
        description: 'Spacious 4-bedroom house perfect for families',
        price: 650000,
        bedrooms: 4,
        bathrooms: 3,
        area: 2000,
        propertyType: 'house',
        listingType: 'sale',
        location: {
            address: '456 Suburban Street',
            area: 'Suburbs',
            city: 'London',
            postcode: 'SW2B 2BB'
        },
        images: ['https://example.com/image2.jpg'],
        features: ['Garden', 'Garage', 'Near Schools'],
        similarity_score: 0.87
    }
];

const mockSearchResult = {
    properties: mockProperties,
    total: 2,
    page: 1,
    totalPages: 1
};

// Test wrapper with React Query
const createTestWrapper = () => {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: {
                retry: false,
            },
        },
    });

    return ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    );
};

describe('PropertySearchPageEnhanced - TDD Enhanced', () => {
    const mockUseSemanticSearch = useSemanticSearch as any;
    const user = userEvent.setup();

    beforeEach(() => {
        vi.clearAllMocks();
        mockUseSemanticSearch.mockReturnValue({
            data: null,
            isLoading: false,
            isError: false,
            error: null,
            analysis: null,
            suggestions: [],
            isSemanticSearch: false,
            refetch: vi.fn()
        });
    });

    describe('Initial Render', () => {
        it('renders the main heading', () => {
            render(<PropertySearchPageEnhanced />, { wrapper: createTestWrapper() });

            expect(screen.getByText('Find Your Perfect Property')).toBeInTheDocument();
        });

        it('renders the subtitle', () => {
            render(<PropertySearchPageEnhanced />, { wrapper: createTestWrapper() });

            expect(screen.getByText('Use natural language to describe your ideal home')).toBeInTheDocument();
        });

        it('renders the search bar', () => {
            render(<PropertySearchPageEnhanced />, { wrapper: createTestWrapper() });

            expect(screen.getByRole('textbox')).toBeInTheDocument();
        });

        it('renders example searches', () => {
            render(<PropertySearchPageEnhanced />, { wrapper: createTestWrapper() });

            expect(screen.getByText('Try searching for:')).toBeInTheDocument();
            expect(screen.getByText('Pet-friendly flat with balcony and parking')).toBeInTheDocument();
            expect(screen.getByText('Victorian house needing renovation')).toBeInTheDocument();
        });
    });

    describe('Search Functionality', () => {
        it('performs search when form is submitted', async () => {
            render(<PropertySearchPage />, { wrapper: createTestWrapper() });

            const searchInput = screen.getByRole('textbox');
            const searchButton = screen.getByRole('button', { name: /search/i });

            await user.type(searchInput, 'luxury apartment');
            await user.click(searchButton);

            expect(mockUsePropertySearch).toHaveBeenCalledWith(
                { query: 'luxury apartment' },
                { enabled: true }
            );
        });

        it('performs search when example is clicked', async () => {
            render(<PropertySearchPage />, { wrapper: createTestWrapper() });

            const exampleButton = screen.getByText('Pet-friendly flat with outdoor space');
            await user.click(exampleButton);

            expect(mockUsePropertySearch).toHaveBeenCalledWith(
                { query: 'Pet-friendly flat with outdoor space' },
                { enabled: true }
            );
        });

        it('updates search input when example is clicked', async () => {
            render(<PropertySearchPage />, { wrapper: createTestWrapper() });

            const searchInput = screen.getByRole('textbox');
            const exampleButton = screen.getByText('Modern apartment with balcony');

            await user.click(exampleButton);

            expect(searchInput).toHaveValue('Modern apartment with balcony');
        });
    });

    describe('Loading State', () => {
        it('shows loading state when search is in progress', () => {
            mockUsePropertySearch.mockReturnValue({
                data: null,
                isLoading: true,
                isError: false,
                error: null
            });

            render(<PropertySearchPage />, { wrapper: createTestWrapper() });

            // Trigger search to show loading
            const searchInput = screen.getByRole('textbox');
            fireEvent.change(searchInput, { target: { value: 'test search' } });

            expect(screen.getByText('Searching properties...')).toBeInTheDocument();
            expect(screen.getByTestId('loading-skeleton')).toBeInTheDocument();
        });

        it('shows loading spinner icon', () => {
            mockUsePropertySearch.mockReturnValue({
                data: null,
                isLoading: true,
                isError: false,
                error: null
            });

            render(<PropertySearchPage />, { wrapper: createTestWrapper() });

            // Trigger search
            const searchInput = screen.getByRole('textbox');
            fireEvent.change(searchInput, { target: { value: 'test search' } });

            expect(screen.getByText('Searching properties...')).toBeInTheDocument();
        });
    });

    describe('Error Handling', () => {
        it('displays error message when search fails', () => {
            const errorMessage = 'Failed to fetch properties';
            mockUsePropertySearch.mockReturnValue({
                data: null,
                isLoading: false,
                isError: true,
                error: { message: errorMessage }
            });

            render(<PropertySearchPage />, { wrapper: createTestWrapper() });

            // Trigger search to show error
            const searchInput = screen.getByRole('textbox');
            fireEvent.change(searchInput, { target: { value: 'test search' } });

            expect(screen.getByText('Search Error')).toBeInTheDocument();
            expect(screen.getByText(errorMessage)).toBeInTheDocument();
        });

        it('shows retry button on error', () => {
            mockUsePropertySearch.mockReturnValue({
                data: null,
                isLoading: false,
                isError: true,
                error: { message: 'Network error' }
            });

            render(<PropertySearchPage />, { wrapper: createTestWrapper() });

            // Trigger search
            const searchInput = screen.getByRole('textbox');
            fireEvent.change(searchInput, { target: { value: 'test search' } });

            expect(screen.getByText('Try Again')).toBeInTheDocument();
        });
    });

    describe('Search Results', () => {
        beforeEach(() => {
            mockUsePropertySearch.mockReturnValue({
                data: mockSearchResult,
                isLoading: false,
                isError: false,
                error: null
            });
        });

        it('displays search results header', () => {
            render(<PropertySearchPage />, { wrapper: createTestWrapper() });

            // Trigger search
            const searchInput = screen.getByRole('textbox');
            fireEvent.change(searchInput, { target: { value: 'luxury apartment' } });

            expect(screen.getByText('Search Results for "luxury apartment"')).toBeInTheDocument();
        });

        it('displays property cards for each result', () => {
            render(<PropertySearchPage />, { wrapper: createTestWrapper() });

            // Trigger search
            const searchInput = screen.getByRole('textbox');
            fireEvent.change(searchInput, { target: { value: 'test search' } });

            expect(screen.getByText('Modern Luxury Apartment')).toBeInTheDocument();
            expect(screen.getByText('Family Home with Garden')).toBeInTheDocument();
        });

        it('displays property details correctly', () => {
            render(<PropertySearchPage />, { wrapper: createTestWrapper() });

            // Trigger search
            const searchInput = screen.getByRole('textbox');
            fireEvent.change(searchInput, { target: { value: 'test search' } });

            // Check first property details
            expect(screen.getByText('£450,000')).toBeInTheDocument();
            expect(screen.getByText('2 bed')).toBeInTheDocument();
            expect(screen.getByText('2 bath')).toBeInTheDocument();
            expect(screen.getByText('1200 sq ft')).toBeInTheDocument();
            expect(screen.getByText('Downtown, London')).toBeInTheDocument();
        });

        it('displays similarity scores when available', () => {
            render(<PropertySearchPage />, { wrapper: createTestWrapper() });

            // Trigger search
            const searchInput = screen.getByRole('textbox');
            fireEvent.change(searchInput, { target: { value: 'test search' } });

            expect(screen.getByText('95% match')).toBeInTheDocument();
            expect(screen.getByText('87% match')).toBeInTheDocument();
        });

        it('displays property images when available', () => {
            render(<PropertySearchPage />, { wrapper: createTestWrapper() });

            // Trigger search
            const searchInput = screen.getByRole('textbox');
            fireEvent.change(searchInput, { target: { value: 'test search' } });

            const images = screen.getAllByRole('img');
            expect(images).toHaveLength(2);
            expect(images[0]).toHaveAttribute('src', 'https://example.com/image1.jpg');
        });

        it('shows no results message when search returns empty', () => {
            mockUsePropertySearch.mockReturnValue({
                data: { properties: [], total: 0, page: 1, totalPages: 0 },
                isLoading: false,
                isError: false,
                error: null
            });

            render(<PropertySearchPage />, { wrapper: createTestWrapper() });

            // Trigger search
            const searchInput = screen.getByRole('textbox');
            fireEvent.change(searchInput, { target: { value: 'nonexistent property' } });

            expect(screen.getByText('No Properties Found')).toBeInTheDocument();
        });
    });

    describe('Property Detail Modal', () => {
        beforeEach(() => {
            mockUsePropertySearch.mockReturnValue({
                data: mockSearchResult,
                isLoading: false,
                isError: false,
                error: null
            });
        });

        it('opens modal when property card is clicked', async () => {
            render(<PropertySearchPage />, { wrapper: createTestWrapper() });

            // Trigger search first
            const searchInput = screen.getByRole('textbox');
            fireEvent.change(searchInput, { target: { value: 'test search' } });

            // Click on property card
            const propertyCard = screen.getByText('Modern Luxury Apartment');
            await user.click(propertyCard);

            // Modal should be open with property details
            expect(screen.getByText('Modern Luxury Apartment')).toBeInTheDocument();
            expect(screen.getByText('Beautiful 2-bedroom apartment with stunning city views')).toBeInTheDocument();
        });

        it('closes modal when close button is clicked', async () => {
            render(<PropertySearchPage />, { wrapper: createTestWrapper() });

            // Trigger search and open modal
            const searchInput = screen.getByRole('textbox');
            fireEvent.change(searchInput, { target: { value: 'test search' } });

            const propertyCard = screen.getByText('Modern Luxury Apartment');
            await user.click(propertyCard);

            // Close modal
            const closeButton = screen.getByText('×');
            await user.click(closeButton);

            // Modal should be closed (property title should only appear in card, not modal)
            const propertyTitles = screen.getAllByText('Modern Luxury Apartment');
            expect(propertyTitles).toHaveLength(1); // Only in the card, not in modal
        });

        it('displays all property features in modal', async () => {
            render(<PropertySearchPage />, { wrapper: createTestWrapper() });

            // Trigger search and open modal
            const searchInput = screen.getByRole('textbox');
            fireEvent.change(searchInput, { target: { value: 'test search' } });

            const propertyCard = screen.getByText('Modern Luxury Apartment');
            await user.click(propertyCard);

            // Check features are displayed
            expect(screen.getByText('Balcony')).toBeInTheDocument();
            expect(screen.getByText('Parking')).toBeInTheDocument();
            expect(screen.getByText('Gym')).toBeInTheDocument();
        });
    });

    describe('Accessibility', () => {
        it('has proper heading hierarchy', () => {
            render(<PropertySearchPage />, { wrapper: createTestWrapper() });

            const mainHeading = screen.getByRole('heading', { level: 1 });
            expect(mainHeading).toHaveTextContent('Find Your Perfect Property');
        });

        it('has proper ARIA labels for interactive elements', () => {
            render(<PropertySearchPage />, { wrapper: createTestWrapper() });

            const searchInput = screen.getByRole('textbox');
            expect(searchInput).toHaveAttribute('aria-label', 'Search for properties');
        });

        it('provides proper focus management in modal', async () => {
            mockUsePropertySearch.mockReturnValue({
                data: mockSearchResult,
                isLoading: false,
                isError: false,
                error: null
            });

            render(<PropertySearchPage />, { wrapper: createTestWrapper() });

            // Trigger search and open modal
            const searchInput = screen.getByRole('textbox');
            fireEvent.change(searchInput, { target: { value: 'test search' } });

            const propertyCard = screen.getByText('Modern Luxury Apartment');
            await user.click(propertyCard);

            // Focus should be managed properly in modal
            const closeButton = screen.getByText('×');
            expect(closeButton).toBeInTheDocument();
        });
    });

    describe('Performance', () => {
        it('only triggers search when query is not empty', () => {
            render(<PropertySearchPage />, { wrapper: createTestWrapper() });

            // Should not trigger search initially
            expect(mockUsePropertySearch).toHaveBeenCalledWith(
                { query: '' },
                { enabled: false }
            );
        });

        it('enables search only when query has content', () => {
            render(<PropertySearchPage />, { wrapper: createTestWrapper() });

            const searchInput = screen.getByRole('textbox');
            fireEvent.change(searchInput, { target: { value: 'luxury apartment' } });

            expect(mockUsePropertySearch).toHaveBeenCalledWith(
                { query: 'luxury apartment' },
                { enabled: true }
            );
        });
    });

    describe('Integration', () => {
        it('integrates properly with React Query', () => {
            render(<PropertySearchPage />, { wrapper: createTestWrapper() });

            // Should use the mocked hook
            expect(mockUsePropertySearch).toHaveBeenCalled();
        });

        it('handles API client integration', () => {
            render(<PropertySearchPage />, { wrapper: createTestWrapper() });

            // Component should render without errors when API client is available
            expect(screen.getByText('Find Your Perfect Property')).toBeInTheDocument();
        });
    });
});