// TDD RED PHASE - SearchBar Component Tests
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SearchBar, SearchBarProps, SearchFilters } from './SearchBar';

// Mock components and hooks
const mockOnSearch = vi.fn();
const mockOnFiltersChange = vi.fn();

describe('SearchBar Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('Basic Rendering', () => {
        it('should render search input with placeholder', () => {
            // Arrange & Act
            render(<SearchBar onSearch={mockOnSearch} />);

            // Assert
            const input = screen.getByPlaceholderText(/search properties/i);
            expect(input).toBeInTheDocument();
            expect(input).toHaveAttribute('type', 'text');
        });

        it('should render search button', () => {
            // Arrange & Act
            render(<SearchBar onSearch={mockOnSearch} />);

            // Assert
            const button = screen.getByRole('button', { name: /search/i });
            expect(button).toBeInTheDocument();
            expect(button).toHaveAttribute('type', 'submit');
        });

        it('should render with custom placeholder', () => {
            // Arrange
            const customPlaceholder = 'Find your dream home...';

            // Act
            render(<SearchBar onSearch={mockOnSearch} placeholder={customPlaceholder} />);

            // Assert
            const input = screen.getByPlaceholderText(customPlaceholder);
            expect(input).toBeInTheDocument();
        });
    });

    describe('Search Functionality', () => {
        it('should call onSearch when form is submitted', async () => {
            // Arrange
            const user = userEvent.setup();
            const searchTerm = 'luxury apartment';
            render(<SearchBar onSearch={mockOnSearch} />);

            const input = screen.getByPlaceholderText(/search properties/i);
            const button = screen.getByRole('button', { name: /search/i });

            // Act
            await user.type(input, searchTerm);
            await user.click(button);

            // Assert
            expect(mockOnSearch).toHaveBeenCalledOnce();
            expect(mockOnSearch).toHaveBeenCalledWith(searchTerm, {});
        });

        it('should call onSearch when Enter key is pressed', async () => {
            // Arrange
            const user = userEvent.setup();
            const searchTerm = 'downtown condo';
            render(<SearchBar onSearch={mockOnSearch} />);

            const input = screen.getByPlaceholderText(/search properties/i);

            // Act
            await user.type(input, searchTerm);
            await user.keyboard('{Enter}');

            // Assert
            expect(mockOnSearch).toHaveBeenCalledOnce();
            expect(mockOnSearch).toHaveBeenCalledWith(searchTerm, {});
        });

        it('should trim whitespace from search term', async () => {
            // Arrange
            const user = userEvent.setup();
            const searchTerm = '  beachfront villa  ';
            const trimmedTerm = 'beachfront villa';
            render(<SearchBar onSearch={mockOnSearch} />);

            const input = screen.getByPlaceholderText(/search properties/i);

            // Act
            await user.type(input, searchTerm);
            await user.keyboard('{Enter}');

            // Assert
            expect(mockOnSearch).toHaveBeenCalledWith(trimmedTerm, {});
        });

        it('should not call onSearch with empty string', async () => {
            // Arrange
            const user = userEvent.setup();
            render(<SearchBar onSearch={mockOnSearch} />);

            const button = screen.getByRole('button', { name: /search/i });

            // Act
            await user.click(button);

            // Assert
            expect(mockOnSearch).not.toHaveBeenCalled();
        });
    });

    describe('Loading State', () => {
        it('should show loading state when isLoading is true', () => {
            // Arrange & Act
            render(<SearchBar onSearch={mockOnSearch} isLoading={true} />);

            // Assert
            const button = screen.getByRole('button', { name: /searching/i });
            expect(button).toBeInTheDocument();
            expect(button).toBeDisabled();
        });

        it('should disable input when loading', () => {
            // Arrange & Act
            render(<SearchBar onSearch={mockOnSearch} isLoading={true} />);

            // Assert
            const input = screen.getByPlaceholderText(/search properties/i);
            expect(input).toBeDisabled();
        });

        it('should show loading spinner when loading', () => {
            // Arrange & Act
            render(<SearchBar onSearch={mockOnSearch} isLoading={true} />);

            // Assert
            const spinner = screen.getByTestId('loading-spinner');
            expect(spinner).toBeInTheDocument();
        });
    });

    describe('Search Filters', () => {
        it('should render filters toggle button when showFilters is true', () => {
            // Arrange & Act
            render(<SearchBar onSearch={mockOnSearch} showFilters={true} />);

            // Assert
            const filtersButton = screen.getByRole('button', { name: /filters/i });
            expect(filtersButton).toBeInTheDocument();
        });

        it('should toggle filters panel when filters button is clicked', async () => {
            // Arrange
            const user = userEvent.setup();
            render(<SearchBar onSearch={mockOnSearch} showFilters={true} />);

            const filtersButton = screen.getByRole('button', { name: /filters/i });

            // Act
            await user.click(filtersButton);

            // Assert
            const filtersPanel = screen.getByTestId('filters-panel');
            expect(filtersPanel).toBeInTheDocument();
        });

        it('should call onFiltersChange when filters are updated', async () => {
            // Arrange
            const user = userEvent.setup();
            render(
                <SearchBar
                    onSearch={mockOnSearch}
                    onFiltersChange={mockOnFiltersChange}
                    showFilters={true}
                />
            );

            const filtersButton = screen.getByRole('button', { name: /filters/i });
            await user.click(filtersButton);

            // Act
            const priceMinInput = screen.getByLabelText(/minimum price/i);
            await user.type(priceMinInput, '100000');

            // Assert
            await waitFor(() => {
                expect(mockOnFiltersChange).toHaveBeenCalled();
            });
        });

        it('should include filters in search when filters are active', async () => {
            // Arrange
            const user = userEvent.setup();
            const searchTerm = 'modern house';
            const filters: SearchFilters = {
                priceMin: 100000,
                priceMax: 500000,
                bedrooms: 3,
                bathrooms: 2,
                propertyType: 'house',
                location: 'downtown',
            };

            render(
                <SearchBar
                    onSearch={mockOnSearch}
                    onFiltersChange={mockOnFiltersChange}
                    showFilters={true}
                    defaultFilters={filters}
                />
            );

            const input = screen.getByPlaceholderText(/search properties/i);
            const button = screen.getByRole('button', { name: /search/i });

            // Act
            await user.type(input, searchTerm);
            await user.click(button);

            // Assert
            expect(mockOnSearch).toHaveBeenCalledWith(searchTerm, filters);
        });
    });

    describe('Recent Searches', () => {
        it('should show recent searches dropdown when input is focused', async () => {
            // Arrange
            const user = userEvent.setup();
            const recentSearches = ['luxury apartment', 'beachfront villa', 'downtown condo'];

            render(
                <SearchBar
                    onSearch={mockOnSearch}
                    recentSearches={recentSearches}
                />
            );

            const input = screen.getByPlaceholderText(/search properties/i);

            // Act
            await user.click(input);

            // Assert
            const dropdown = screen.getByTestId('recent-searches');
            expect(dropdown).toBeInTheDocument();

            recentSearches.forEach(search => {
                expect(screen.getByText(search)).toBeInTheDocument();
            });
        });

        it('should populate input when recent search is clicked', async () => {
            // Arrange
            const user = userEvent.setup();
            const recentSearches = ['luxury apartment'];

            render(
                <SearchBar
                    onSearch={mockOnSearch}
                    recentSearches={recentSearches}
                />
            );

            const input = screen.getByPlaceholderText(/search properties/i);
            await user.click(input);

            // Act
            const recentSearch = screen.getByText(recentSearches[0]);
            await user.click(recentSearch);

            // Assert
            expect(input).toHaveValue(recentSearches[0]);
        });
    });

    describe('Accessibility', () => {
        it('should have proper ARIA labels', () => {
            // Arrange & Act
            render(<SearchBar onSearch={mockOnSearch} />);

            // Assert
            const input = screen.getByLabelText(/search for properties/i);
            expect(input).toBeInTheDocument();

            const button = screen.getByLabelText(/submit search/i);
            expect(button).toBeInTheDocument();
        });

        it('should support keyboard navigation', async () => {
            // Arrange
            const user = userEvent.setup();
            render(<SearchBar onSearch={mockOnSearch} />);

            const input = screen.getByPlaceholderText(/search properties/i);

            // Act & Assert
            await user.tab();
            expect(input).toHaveFocus();

            await user.tab();
            const button = screen.getByRole('button', { name: /search/i });
            expect(button).toHaveFocus();
        });

        it('should announce loading state to screen readers', () => {
            // Arrange & Act
            render(<SearchBar onSearch={mockOnSearch} isLoading={true} />);

            // Assert
            const button = screen.getByRole('button', { name: /searching/i });
            expect(button).toHaveAttribute('aria-busy', 'true');
        });
    });

    describe('Error Handling', () => {
        it('should display error message when error prop is provided', () => {
            // Arrange
            const errorMessage = 'Search failed. Please try again.';

            // Act
            render(<SearchBar onSearch={mockOnSearch} error={errorMessage} />);

            // Assert
            const error = screen.getByText(errorMessage);
            expect(error).toBeInTheDocument();
            expect(error).toHaveAttribute('role', 'alert');
        });

        it('should clear error when new search is initiated', async () => {
            // Arrange
            const user = userEvent.setup();
            const errorMessage = 'Search failed. Please try again.';

            render(<SearchBar onSearch={mockOnSearch} error={errorMessage} />);

            const input = screen.getByPlaceholderText(/search properties/i);

            // Act
            await user.type(input, 'new search');

            // Assert
            expect(screen.queryByText(errorMessage)).not.toBeInTheDocument();
        });
    });
});