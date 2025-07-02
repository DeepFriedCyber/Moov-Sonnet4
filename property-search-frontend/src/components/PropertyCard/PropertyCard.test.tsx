import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { PropertyCard } from './PropertyCard';
import { Property } from '@/types/property';

const mockProperty: Property = {
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
};

describe('PropertyCard', () => {
    const mockOnClick = vi.fn();
    const mockOnFavorite = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render property information correctly', () => {
        render(
            <PropertyCard
                property={mockProperty}
                onClick={mockOnClick}
                onFavorite={mockOnFavorite}
            />
        );

        expect(screen.getByText('Modern 2-Bed Apartment')).toBeInTheDocument();
        expect(screen.getByText('£450,000')).toBeInTheDocument();
        expect(screen.getByText('London, SW1A 1AA')).toBeInTheDocument();
        expect(screen.getByText('2 beds')).toBeInTheDocument();
        expect(screen.getByText('1 bath')).toBeInTheDocument();
        expect(screen.getByText('850 sq ft')).toBeInTheDocument();
    });

    it('should handle click events', async () => {
        const user = userEvent.setup();
        render(
            <PropertyCard
                property={mockProperty}
                onClick={mockOnClick}
                onFavorite={mockOnFavorite}
            />
        );

        await user.click(screen.getByRole('article'));
        expect(mockOnClick).toHaveBeenCalledWith(mockProperty);
    });

    it('should handle favorite toggle', async () => {
        const user = userEvent.setup();
        render(
            <PropertyCard
                property={mockProperty}
                onClick={mockOnClick}
                onFavorite={mockOnFavorite}
            />
        );

        const favoriteButton = screen.getByRole('button', { name: /favorite/i });
        await user.click(favoriteButton);

        expect(mockOnFavorite).toHaveBeenCalledWith(mockProperty.id);
    });

    it('should display semantic match score when provided', () => {
        const propertyWithScore = {
            ...mockProperty,
            semanticScore: 0.95,
        };

        render(
            <PropertyCard
                property={propertyWithScore}
                onClick={mockOnClick}
                onFavorite={mockOnFavorite}
                showSemanticScore
            />
        );

        expect(screen.getByText('95% match')).toBeInTheDocument();
    });

    it('should lazy load images', async () => {
        const { container } = render(
            <PropertyCard
                property={mockProperty}
                onClick={mockOnClick}
                onFavorite={mockOnFavorite}
            />
        );

        const image = container.querySelector('img');
        expect(image).toHaveAttribute('loading', 'lazy');
    });

    it('should handle image loading errors gracefully', async () => {
        const { container } = render(
            <PropertyCard
                property={mockProperty}
                onClick={mockOnClick}
                onFavorite={mockOnFavorite}
            />
        );

        const image = container.querySelector('img');
        if (image) {
            fireEvent.error(image);
        }

        // Should show placeholder when image fails to load
        await waitFor(() => {
            expect(container.querySelector('[data-testid="image-placeholder"]')).toBeInTheDocument();
        });
    });

    it('should prevent event bubbling on favorite button click', async () => {
        const user = userEvent.setup();
        render(
            <PropertyCard
                property={mockProperty}
                onClick={mockOnClick}
                onFavorite={mockOnFavorite}
            />
        );

        const favoriteButton = screen.getByRole('button', { name: /favorite/i });
        await user.click(favoriteButton);

        expect(mockOnFavorite).toHaveBeenCalledWith(mockProperty.id);
        expect(mockOnClick).not.toHaveBeenCalled();
    });

    it('should apply custom className', () => {
        const { container } = render(
            <PropertyCard
                property={mockProperty}
                onClick={mockOnClick}
                onFavorite={mockOnFavorite}
                className="custom-class"
            />
        );

        expect(container.firstChild).toHaveClass('custom-class');
    });

    it('should have proper accessibility attributes', () => {
        render(
            <PropertyCard
                property={mockProperty}
                onClick={mockOnClick}
                onFavorite={mockOnFavorite}
            />
        );

        const article = screen.getByRole('article');
        expect(article).toHaveAttribute('aria-label', 'Property: Modern 2-Bed Apartment');

        const favoriteButton = screen.getByRole('button', { name: /favorite/i });
        expect(favoriteButton).toHaveAttribute('aria-label');
    });

    it('should format price correctly', () => {
        const expensiveProperty = {
            ...mockProperty,
            price: 1250000,
        };

        render(
            <PropertyCard
                property={expensiveProperty}
                onClick={mockOnClick}
                onFavorite={mockOnFavorite}
            />
        );

        expect(screen.getByText('£1,250,000')).toBeInTheDocument();
    });

    it('should handle missing optional data gracefully', () => {
        const minimalProperty = {
            ...mockProperty,
            images: [],
            features: [],
            squareFootage: undefined,
        };

        render(
            <PropertyCard
                property={minimalProperty}
                onClick={mockOnClick}
                onFavorite={mockOnFavorite}
            />
        );

        // Should still render without errors
        expect(screen.getByText('Modern 2-Bed Apartment')).toBeInTheDocument();
    });
});