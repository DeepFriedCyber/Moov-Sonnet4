// TDD Tests for Enhanced SearchBar Component
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SearchBarEnhanced } from '../SearchBar.enhanced';

// Mock the semantic search hooks
vi.mock('@/hooks/useSemanticSearch', () => ({
  useSemanticSearchSuggestions: vi.fn(() => ({
    suggestions: ['Modern apartment with balcony', 'Family home with garden'],
    analysis: {
      intent: 'Looking for modern properties',
      extractedFilters: { propertyType: 'apartment' },
      confidence: 85
    },
    isLoading: false
  })),
  useQueryAnalysis: vi.fn(() => ({
    intent: 'Looking for 2 bedroom apartment in London',
    extractedFilters: {
      bedrooms: 2,
      propertyType: 'apartment',
      location: 'london'
    },
    suggestions: ['Near Transport', 'Modern Features'],
    confidence: 90,
    keywords: ['apartment', 'london'],
    sentiment: 'neutral'
  }))
}));

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => children,
}));

import { useSemanticSearchSuggestions, useQueryAnalysis } from '@/hooks/useSemanticSearch';

// Test wrapper
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe('SearchBarEnhanced', () => {
  const mockOnSearch = vi.fn();
  const mockOnFiltersChange = vi.fn();
  const user = userEvent.setup();

  const mockUseSemanticSearchSuggestions = useSemanticSearchSuggestions as any;
  const mockUseQueryAnalysis = useQueryAnalysis as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Functionality', () => {
    it('renders with default placeholder', () => {
      render(
        <SearchBarEnhanced onSearch={mockOnSearch} />,
        { wrapper: createWrapper() }
      );
      
      expect(screen.getByPlaceholderText(/Try:/)).toBeInTheDocument();
    });

    it('renders with custom placeholder', () => {
      const customPlaceholder = 'Find your dream home...';
      render(
        <SearchBarEnhanced 
          onSearch={mockOnSearch} 
          placeholder={customPlaceholder} 
        />,
        { wrapper: createWrapper() }
      );
      
      expect(screen.getByPlaceholderText(customPlaceholder)).toBeInTheDocument();
    });

    it('calls onSearch when form is submitted', async () => {
      render(
        <SearchBarEnhanced onSearch={mockOnSearch} />,
        { wrapper: createWrapper() }
      );
      
      const input = screen.getByTestId('search-input');
      const submitButton = screen.getByTestId('search-button');
      
      await user.type(input, 'luxury apartment');
      await user.click(submitButton);
      
      expect(mockOnSearch).toHaveBeenCalledWith('luxury apartment', {});
    });

    it('does not call onSearch with empty query', async () => {
      render(
        <SearchBarEnhanced onSearch={mockOnSearch} />,
        { wrapper: createWrapper() }
      );
      
      const submitButton = screen.getByTestId('search-button');
      await user.click(submitButton);
      
      expect(mockOnSearch).not.toHaveBeenCalled();
    });

    it('trims whitespace from query before submitting', async () => {
      render(
        <SearchBarEnhanced onSearch={mockOnSearch} />,
        { wrapper: createWrapper() }
      );
      
      const input = screen.getByTestId('search-input');
      const submitButton = screen.getByTestId('search-button');
      
      await user.type(input, '  luxury apartment  ');
      await user.click(submitButton);
      
      expect(mockOnSearch).toHaveBeenCalledWith('luxury apartment', {});
    });
  });

  describe('Loading State', () => {
    it('shows loading state when isLoading is true', () => {
      render(
        <SearchBarEnhanced onSearch={mockOnSearch} isLoading={true} />,
        { wrapper: createWrapper() }
      );
      
      expect(screen.getByLabelText('Searching...')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /searching/i })).toBeDisabled();
    });

    it('disables input when loading', () => {
      render(
        <SearchBarEnhanced onSearch={mockOnSearch} isLoading={true} />,
        { wrapper: createWrapper() }
      );
      
      const input = screen.getByTestId('search-input');
      expect(input).toBeDisabled();
    });

    it('shows loading spinner when searching', () => {
      render(
        <SearchBarEnhanced onSearch={mockOnSearch} isLoading={true} />,
        { wrapper: createWrapper() }
      );
      
      expect(screen.getByRole('button')).toContainHTML('animate-spin');
    });
  });

  describe('Error Handling', () => {
    it('displays error message when error prop is provided', () => {
      const errorMessage = 'Search failed. Please try again.';
      render(
        <SearchBarEnhanced onSearch={mockOnSearch} error={errorMessage} />,
        { wrapper: createWrapper() }
      );
      
      expect(screen.getByRole('alert')).toHaveTextContent(errorMessage);
    });

    it('focuses input when error is shown', () => {
      const errorMessage = 'Search failed. Please try again.';
      render(
        <SearchBarEnhanced onSearch={mockOnSearch} error={errorMessage} />,
        { wrapper: createWrapper() }
      );
      
      const input = screen.getByTestId('search-input');
      expect(input).toHaveFocus();
    });
  });

  describe('Semantic Search Integration', () => {
    it('shows AI indicator when query analysis is available', async () => {
      render(
        <SearchBarEnhanced onSearch={mockOnSearch} />,
        { wrapper: createWrapper() }
      );
      
      const input = screen.getByTestId('search-input');
      await user.type(input, '2 bedroom apartment');
      
      expect(screen.getByText('AI')).toBeInTheDocument();
    });

    it('displays semantic analysis when enabled', async () => {
      render(
        <SearchBarEnhanced 
          onSearch={mockOnSearch} 
          showSemanticAnalysis={true}
        />,
        { wrapper: createWrapper() }
      );
      
      const input = screen.getByTestId('search-input');
      await user.type(input, '2 bedroom apartment in london');
      
      expect(screen.getByText('AI Understanding')).toBeInTheDocument();
      expect(screen.getByText('90% confident')).toBeInTheDocument();
      expect(screen.getByText('Looking for 2 bedroom apartment in London')).toBeInTheDocument();
    });

    it('shows apply filters button when semantic filters are extracted', async () => {
      render(
        <SearchBarEnhanced 
          onSearch={mockOnSearch}
          onFiltersChange={mockOnFiltersChange}
          showSemanticAnalysis={true}
        />,
        { wrapper: createWrapper() }
      );
      
      const input = screen.getByTestId('search-input');
      await user.type(input, '2 bedroom apartment in london');
      
      const applyButton = screen.getByText('Apply Filters');
      expect(applyButton).toBeInTheDocument();
      
      await user.click(applyButton);
      
      expect(mockOnFiltersChange).toHaveBeenCalledWith({
        bedrooms: 2,
        propertyType: 'apartment',
        location: 'london'
      });
    });

    it('hides semantic analysis when disabled', async () => {
      render(
        <SearchBarEnhanced 
          onSearch={mockOnSearch} 
          showSemanticAnalysis={false}
        />,
        { wrapper: createWrapper() }
      );
      
      const input = screen.getByTestId('search-input');
      await user.type(input, '2 bedroom apartment in london');
      
      expect(screen.queryByText('AI Understanding')).not.toBeInTheDocument();
    });
  });

  describe('Suggestions', () => {
    it('shows suggestions dropdown when typing', async () => {
      render(
        <SearchBarEnhanced 
          onSearch={mockOnSearch}
          enableSuggestions={true}
        />,
        { wrapper: createWrapper() }
      );
      
      const input = screen.getByTestId('search-input');
      await user.type(input, 'apartment');
      await user.click(input); // Focus to show suggestions
      
      expect(screen.getByTestId('suggestions-dropdown')).toBeInTheDocument();
      expect(screen.getByText('Modern apartment with balcony')).toBeInTheDocument();
      expect(screen.getByText('Family home with garden')).toBeInTheDocument();
    });

    it('selects suggestion when clicked', async () => {
      render(
        <SearchBarEnhanced onSearch={mockOnSearch} />,
        { wrapper: createWrapper() }
      );
      
      const input = screen.getByTestId('search-input');
      await user.type(input, 'apartment');
      await user.click(input);
      
      const suggestion = screen.getByText('Modern apartment with balcony');
      await user.click(suggestion);
      
      expect(mockOnSearch).toHaveBeenCalledWith('Modern apartment with balcony', {});
    });

    it('navigates suggestions with keyboard', async () => {
      render(
        <SearchBarEnhanced onSearch={mockOnSearch} />,
        { wrapper: createWrapper() }
      );
      
      const input = screen.getByTestId('search-input');
      await user.type(input, 'apartment');
      
      // Arrow down to select first suggestion
      fireEvent.keyDown(input, { key: 'ArrowDown' });
      
      // Enter to select
      fireEvent.keyDown(input, { key: 'Enter' });
      
      expect(mockOnSearch).toHaveBeenCalledWith('Modern apartment with balcony', {});
    });

    it('closes suggestions on Escape key', async () => {
      render(
        <SearchBarEnhanced onSearch={mockOnSearch} />,
        { wrapper: createWrapper() }
      );
      
      const input = screen.getByTestId('search-input');
      await user.type(input, 'apartment');
      await user.click(input);
      
      expect(screen.getByTestId('suggestions-dropdown')).toBeInTheDocument();
      
      fireEvent.keyDown(input, { key: 'Escape' });
      
      await waitFor(() => {
        expect(screen.queryByTestId('suggestions-dropdown')).not.toBeInTheDocument();
      });
    });

    it('includes recent searches in suggestions', async () => {
      const recentSearches = ['luxury apartment', 'family home'];
      render(
        <SearchBarEnhanced 
          onSearch={mockOnSearch}
          recentSearches={recentSearches}
        />,
        { wrapper: createWrapper() }
      );
      
      const input = screen.getByTestId('search-input');
      await user.type(input, 'luxury');
      await user.click(input);
      
      expect(screen.getByText('luxury apartment')).toBeInTheDocument();
    });

    it('disables suggestions when enableSuggestions is false', async () => {
      mockUseSemanticSearchSuggestions.mockReturnValue({
        suggestions: [],
        analysis: null,
        isLoading: false
      });

      render(
        <SearchBarEnhanced 
          onSearch={mockOnSearch}
          enableSuggestions={false}
        />,
        { wrapper: createWrapper() }
      );
      
      const input = screen.getByTestId('search-input');
      await user.type(input, 'apartment');
      await user.click(input);
      
      expect(screen.queryByTestId('suggestions-dropdown')).not.toBeInTheDocument();
    });
  });

  describe('Filters Panel', () => {
    it('shows filters toggle button when showFilters is true', () => {
      render(
        <SearchBarEnhanced onSearch={mockOnSearch} showFilters={true} />,
        { wrapper: createWrapper() }
      );
      
      expect(screen.getByText('Filters')).toBeInTheDocument();
    });

    it('toggles filters panel when button is clicked', async () => {
      render(
        <SearchBarEnhanced onSearch={mockOnSearch} showFilters={true} />,
        { wrapper: createWrapper() }
      );
      
      const filtersButton = screen.getByText('Filters');
      
      // Panel should not be visible initially
      expect(screen.queryByTestId('filters-panel')).not.toBeInTheDocument();
      
      // Click to show panel
      await user.click(filtersButton);
      expect(screen.getByTestId('filters-panel')).toBeInTheDocument();
      
      // Click to hide panel
      await user.click(filtersButton);
      await waitFor(() => {
        expect(screen.queryByTestId('filters-panel')).not.toBeInTheDocument();
      });
    });

    it('shows active filter count', async () => {
      render(
        <SearchBarEnhanced 
          onSearch={mockOnSearch} 
          showFilters={true}
          defaultFilters={{ bedrooms: 2, propertyType: 'apartment' }}
        />,
        { wrapper: createWrapper() }
      );
      
      expect(screen.getByText('Filters (2)')).toBeInTheDocument();
    });

    it('shows clear filters button when filters are active', async () => {
      render(
        <SearchBarEnhanced 
          onSearch={mockOnSearch} 
          showFilters={true}
          defaultFilters={{ bedrooms: 2 }}
          onFiltersChange={mockOnFiltersChange}
        />,
        { wrapper: createWrapper() }
      );
      
      const clearButton = screen.getByText('Clear all');
      expect(clearButton).toBeInTheDocument();
      
      await user.click(clearButton);
      expect(mockOnFiltersChange).toHaveBeenCalledWith({});
    });

    it('updates filters when form inputs change', async () => {
      render(
        <SearchBarEnhanced 
          onSearch={mockOnSearch} 
          showFilters={true}
          onFiltersChange={mockOnFiltersChange}
        />,
        { wrapper: createWrapper() }
      );
      
      // Open filters panel
      const filtersButton = screen.getByText('Filters');
      await user.click(filtersButton);
      
      // Change bedrooms filter
      const bedroomsSelect = screen.getByDisplayValue('Any');
      await user.selectOptions(bedroomsSelect, '2');
      
      expect(mockOnFiltersChange).toHaveBeenCalledWith({ bedrooms: 2 });
    });

    it('includes filters in search submission', async () => {
      render(
        <SearchBarEnhanced 
          onSearch={mockOnSearch} 
          showFilters={true}
          defaultFilters={{ bedrooms: 2, propertyType: 'apartment' }}
        />,
        { wrapper: createWrapper() }
      );
      
      const input = screen.getByTestId('search-input');
      const submitButton = screen.getByTestId('search-button');
      
      await user.type(input, 'luxury apartment');
      await user.click(submitButton);
      
      expect(mockOnSearch).toHaveBeenCalledWith('luxury apartment', {
        bedrooms: 2,
        propertyType: 'apartment'
      });
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels', () => {
      render(
        <SearchBarEnhanced onSearch={mockOnSearch} />,
        { wrapper: createWrapper() }
      );
      
      const input = screen.getByTestId('search-input');
      expect(input).toHaveAttribute('aria-label', 'Search for properties');
    });

    it('has proper role for error messages', () => {
      render(
        <SearchBarEnhanced onSearch={mockOnSearch} error="Test error" />,
        { wrapper: createWrapper() }
      );
      
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('manages focus properly in suggestions', async () => {
      render(
        <SearchBarEnhanced onSearch={mockOnSearch} />,
        { wrapper: createWrapper() }
      );
      
      const input = screen.getByTestId('search-input');
      await user.type(input, 'apartment');
      
      // Focus should remain on input
      expect(input).toHaveFocus();
    });
  });

  describe('Performance', () => {
    it('debounces suggestions requests', async () => {
      vi.useFakeTimers();
      
      render(
        <SearchBarEnhanced onSearch={mockOnSearch} />,
        { wrapper: createWrapper() }
      );
      
      const input = screen.getByTestId('search-input');
      
      // Type multiple characters quickly
      await user.type(input, 'apart');
      
      // Should debounce the suggestions call
      expect(mockUseSemanticSearchSuggestions).toHaveBeenCalledWith({
        query: 'apart',
        debounceMs: 300,
        enabled: true
      });
      
      vi.useRealTimers();
    });

    it('limits number of suggestions displayed', async () => {
      mockUseSemanticSearchSuggestions.mockReturnValue({
        suggestions: Array(10).fill(0).map((_, i) => `Suggestion ${i}`),
        analysis: null,
        isLoading: false
      });

      render(
        <SearchBarEnhanced 
          onSearch={mockOnSearch}
          recentSearches={['Recent 1', 'Recent 2']}
        />,
        { wrapper: createWrapper() }
      );
      
      const input = screen.getByTestId('search-input');
      await user.type(input, 'test');
      await user.click(input);
      
      // Should limit to maximum 5 suggestions
      const suggestions = screen.getAllByRole('button');
      const suggestionButtons = suggestions.filter(btn => 
        btn.textContent?.includes('Suggestion') || btn.textContent?.includes('Recent')
      );
      expect(suggestionButtons.length).toBeLessThanOrEqual(5);
    });
  });

  describe('Integration', () => {
    it('integrates with semantic search hooks correctly', async () => {
      render(
        <SearchBarEnhanced onSearch={mockOnSearch} />,
        { wrapper: createWrapper() }
      );
      
      const input = screen.getByTestId('search-input');
      await user.type(input, 'apartment');
      
      expect(mockUseSemanticSearchSuggestions).toHaveBeenCalledWith({
        query: 'apartment',
        debounceMs: 300,
        enabled: true
      });
      
      expect(mockUseQueryAnalysis).toHaveBeenCalledWith('apartment');
    });

    it('handles hook errors gracefully', () => {
      mockUseSemanticSearchSuggestions.mockReturnValue({
        suggestions: [],
        analysis: null,
        isLoading: false
      });
      
      mockUseQueryAnalysis.mockReturnValue(null);

      render(
        <SearchBarEnhanced onSearch={mockOnSearch} />,
        { wrapper: createWrapper() }
      );
      
      // Should render without errors
      expect(screen.getByTestId('search-input')).toBeInTheDocument();
    });
  });
});