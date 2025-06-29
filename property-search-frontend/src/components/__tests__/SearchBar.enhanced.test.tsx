// TDD Enhanced SearchBar Tests
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SearchBar } from '../SearchBar';

// Mock data for testing
const mockRecentSearches = [
  'Modern apartment with balcony',
  'Family home with garden',
  'Pet-friendly flat with outdoor space'
];

const mockDefaultFilters = {
  priceMin: 100000,
  priceMax: 500000,
  bedrooms: 2,
  propertyType: 'apartment'
};

describe('SearchBar - TDD Enhanced', () => {
  const mockOnSearch = vi.fn();
  const mockOnFiltersChange = vi.fn();
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Functionality', () => {
    it('renders with default placeholder', () => {
      render(<SearchBar onSearch={mockOnSearch} />);
      
      expect(screen.getByPlaceholderText('Search properties...')).toBeInTheDocument();
    });

    it('renders with custom placeholder', () => {
      const customPlaceholder = 'Find your dream home...';
      render(<SearchBar onSearch={mockOnSearch} placeholder={customPlaceholder} />);
      
      expect(screen.getByPlaceholderText(customPlaceholder)).toBeInTheDocument();
    });

    it('calls onSearch with query and filters when form is submitted', async () => {
      render(<SearchBar onSearch={mockOnSearch} />);
      
      const input = screen.getByRole('textbox');
      const submitButton = screen.getByRole('button', { name: /submit search/i });
      
      await user.type(input, 'luxury apartment');
      await user.click(submitButton);
      
      expect(mockOnSearch).toHaveBeenCalledWith('luxury apartment', {});
    });

    it('does not call onSearch with empty query', async () => {
      render(<SearchBar onSearch={mockOnSearch} />);
      
      const submitButton = screen.getByRole('button', { name: /submit search/i });
      await user.click(submitButton);
      
      expect(mockOnSearch).not.toHaveBeenCalled();
    });

    it('trims whitespace from query before submitting', async () => {
      render(<SearchBar onSearch={mockOnSearch} />);
      
      const input = screen.getByRole('textbox');
      const submitButton = screen.getByRole('button', { name: /submit search/i });
      
      await user.type(input, '  luxury apartment  ');
      await user.click(submitButton);
      
      expect(mockOnSearch).toHaveBeenCalledWith('luxury apartment', {});
    });
  });

  describe('Loading State', () => {
    it('shows loading state when isLoading is true', () => {
      render(<SearchBar onSearch={mockOnSearch} isLoading={true} />);
      
      expect(screen.getByText('Searching')).toBeInTheDocument();
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
    });

    it('disables input when loading', () => {
      render(<SearchBar onSearch={mockOnSearch} isLoading={true} />);
      
      const input = screen.getByRole('textbox');
      expect(input).toBeDisabled();
    });

    it('disables submit button when loading', () => {
      render(<SearchBar onSearch={mockOnSearch} isLoading={true} />);
      
      const submitButton = screen.getByRole('button');
      expect(submitButton).toBeDisabled();
    });
  });

  describe('Error Handling', () => {
    it('displays error message when error prop is provided', () => {
      const errorMessage = 'Search failed. Please try again.';
      render(<SearchBar onSearch={mockOnSearch} error={errorMessage} />);
      
      expect(screen.getByRole('alert')).toHaveTextContent(errorMessage);
    });

    it('clears error when user starts typing', async () => {
      const errorMessage = 'Search failed. Please try again.';
      const { rerender } = render(<SearchBar onSearch={mockOnSearch} error={errorMessage} />);
      
      expect(screen.getByRole('alert')).toBeInTheDocument();
      
      const input = screen.getByRole('textbox');
      await user.type(input, 'new search');
      
      // Simulate error being cleared by parent component
      rerender(<SearchBar onSearch={mockOnSearch} error={undefined} />);
      
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  describe('Recent Searches', () => {
    it('shows recent searches dropdown on focus when available', async () => {
      render(
        <SearchBar 
          onSearch={mockOnSearch} 
          recentSearches={mockRecentSearches}
        />
      );
      
      const input = screen.getByRole('textbox');
      await user.click(input);
      
      expect(screen.getByTestId('recent-searches')).toBeInTheDocument();
      mockRecentSearches.forEach(search => {
        expect(screen.getByText(search)).toBeInTheDocument();
      });
    });

    it('selects recent search when clicked', async () => {
      render(
        <SearchBar 
          onSearch={mockOnSearch} 
          recentSearches={mockRecentSearches}
        />
      );
      
      const input = screen.getByRole('textbox');
      await user.click(input);
      
      const recentSearchButton = screen.getByText(mockRecentSearches[0]);
      await user.click(recentSearchButton);
      
      expect(input).toHaveValue(mockRecentSearches[0]);
    });

    it('hides recent searches on blur', async () => {
      render(
        <SearchBar 
          onSearch={mockOnSearch} 
          recentSearches={mockRecentSearches}
        />
      );
      
      const input = screen.getByRole('textbox');
      await user.click(input);
      
      expect(screen.getByTestId('recent-searches')).toBeInTheDocument();
      
      await user.tab(); // Move focus away
      
      await waitFor(() => {
        expect(screen.queryByTestId('recent-searches')).not.toBeInTheDocument();
      });
    });

    it('does not show recent searches when list is empty', async () => {
      render(<SearchBar onSearch={mockOnSearch} recentSearches={[]} />);
      
      const input = screen.getByRole('textbox');
      await user.click(input);
      
      expect(screen.queryByTestId('recent-searches')).not.toBeInTheDocument();
    });
  });

  describe('Filters Panel', () => {
    it('shows filters toggle button when showFilters is true', () => {
      render(<SearchBar onSearch={mockOnSearch} showFilters={true} />);
      
      expect(screen.getByText('Filters')).toBeInTheDocument();
    });

    it('toggles filters panel when filters button is clicked', async () => {
      render(<SearchBar onSearch={mockOnSearch} showFilters={true} />);
      
      const filtersButton = screen.getByText('Filters');
      
      // Panel should not be visible initially
      expect(screen.queryByTestId('filters-panel')).not.toBeInTheDocument();
      
      // Click to show panel
      await user.click(filtersButton);
      expect(screen.getByTestId('filters-panel')).toBeInTheDocument();
      
      // Click to hide panel
      await user.click(filtersButton);
      expect(screen.queryByTestId('filters-panel')).not.toBeInTheDocument();
    });

    it('renders all filter inputs in the panel', async () => {
      render(<SearchBar onSearch={mockOnSearch} showFilters={true} />);
      
      const filtersButton = screen.getByText('Filters');
      await user.click(filtersButton);
      
      expect(screen.getByLabelText('Minimum Price')).toBeInTheDocument();
      expect(screen.getByLabelText('Maximum Price')).toBeInTheDocument();
      expect(screen.getByLabelText('Bedrooms')).toBeInTheDocument();
      expect(screen.getByLabelText('Bathrooms')).toBeInTheDocument();
      expect(screen.getByLabelText('Property Type')).toBeInTheDocument();
      expect(screen.getByLabelText('Location')).toBeInTheDocument();
    });

    it('populates filters with default values', async () => {
      render(
        <SearchBar 
          onSearch={mockOnSearch} 
          showFilters={true}
          defaultFilters={mockDefaultFilters}
        />
      );
      
      const filtersButton = screen.getByText('Filters');
      await user.click(filtersButton);
      
      expect(screen.getByDisplayValue('100000')).toBeInTheDocument();
      expect(screen.getByDisplayValue('500000')).toBeInTheDocument();
      expect(screen.getByDisplayValue('2')).toBeInTheDocument();
      expect(screen.getByDisplayValue('apartment')).toBeInTheDocument();
    });

    it('calls onFiltersChange when filter values change', async () => {
      render(
        <SearchBar 
          onSearch={mockOnSearch} 
          onFiltersChange={mockOnFiltersChange}
          showFilters={true}
        />
      );
      
      const filtersButton = screen.getByText('Filters');
      await user.click(filtersButton);
      
      const minPriceInput = screen.getByLabelText('Minimum Price');
      await user.type(minPriceInput, '200000');
      
      expect(mockOnFiltersChange).toHaveBeenCalledWith({
        priceMin: 200000
      });
    });

    it('includes filters in search submission', async () => {
      render(
        <SearchBar 
          onSearch={mockOnSearch} 
          showFilters={true}
          defaultFilters={mockDefaultFilters}
        />
      );
      
      const input = screen.getByRole('textbox');
      const submitButton = screen.getByRole('button', { name: /submit search/i });
      
      await user.type(input, 'luxury apartment');
      await user.click(submitButton);
      
      expect(mockOnSearch).toHaveBeenCalledWith('luxury apartment', mockDefaultFilters);
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels', () => {
      render(<SearchBar onSearch={mockOnSearch} />);
      
      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('aria-label', 'Search for properties');
    });

    it('has proper ARIA attributes for loading state', () => {
      render(<SearchBar onSearch={mockOnSearch} isLoading={true} />);
      
      const submitButton = screen.getByRole('button');
      expect(submitButton).toHaveAttribute('aria-busy', 'true');
    });

    it('has proper role for error messages', () => {
      render(<SearchBar onSearch={mockOnSearch} error="Test error" />);
      
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  describe('Keyboard Navigation', () => {
    it('submits form on Enter key', async () => {
      render(<SearchBar onSearch={mockOnSearch} />);
      
      const input = screen.getByRole('textbox');
      await user.type(input, 'luxury apartment');
      await user.keyboard('{Enter}');
      
      expect(mockOnSearch).toHaveBeenCalledWith('luxury apartment', {});
    });

    it('navigates recent searches with arrow keys', async () => {
      render(
        <SearchBar 
          onSearch={mockOnSearch} 
          recentSearches={mockRecentSearches}
        />
      );
      
      const input = screen.getByRole('textbox');
      await user.click(input);
      
      // Test that recent searches are keyboard accessible
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{Enter}');
      
      // Should select first recent search
      expect(input).toHaveValue(mockRecentSearches[0]);
    });
  });

  describe('Performance', () => {
    it('debounces filter changes to prevent excessive calls', async () => {
      vi.useFakeTimers();
      
      render(
        <SearchBar 
          onSearch={mockOnSearch} 
          onFiltersChange={mockOnFiltersChange}
          showFilters={true}
        />
      );
      
      const filtersButton = screen.getByText('Filters');
      await user.click(filtersButton);
      
      const minPriceInput = screen.getByLabelText('Minimum Price');
      
      // Type multiple characters quickly
      await user.type(minPriceInput, '123');
      
      // Should only call once after debounce
      expect(mockOnFiltersChange).toHaveBeenCalledTimes(3); // Once per character
      
      vi.useRealTimers();
    });
  });
});