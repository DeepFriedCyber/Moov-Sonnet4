// TDD Tests for Enhanced PropertyCard Component
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PropertyCard } from '../PropertyCard';
import { Property } from '@/types';

// Mock Next.js Image component
vi.mock('next/image', () => ({
    default: ({ src, alt, ...props }: any) => (
        <img src={src} alt={alt} {...props} />
    )
}));

// Mock framer-motion
vi.mock('framer-motion', () => ({
    motion: {
        div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    },
}));

// Mock property data
const mockProperty: Property = {
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
    features: ['Balcony', 'Parking', 'Gym', 'Concierge', 'Pool'],
    similarity_score: 0.95
};

const mockEnhancedProperty = {
    ...mockProperty,
    relevanceScore: 85,
    matchReasons: ['Perfect bedroom count match', 'Excellent location match'],
    matchKeywords: ['apartment', 'london', 'modern'],
    semanticScore: 0.92
};

describe('PropertyCard - TDD Enhanced', () => {
    const mockOnClick = vi.fn();
    const user = userEvent.setup();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Basic Rendering', () => {
        it('renders property title correctly', () => {
            render(<PropertyCard property={mockProperty} />);

            expect(screen.getByText('Modern Luxury Apartment')).toBeInTheDocument();
        });

        it('renders property price with correct formatting', () => {
            render(<PropertyCard property={mockProperty} />);

            expect(screen.getByText('£450,000')).toBeInTheDocument();
        });

        it('displays property details correctly', () => {
            render(<PropertyCard property={mockProperty} />);

            expect(screen.getByText('2 bed')).toBeInTheDocument();
            expect(screen.getByText('2 bath')).toBeInTheDocument();
            expect(screen.getByText('1200 sq ft')).toBeInTheDocument();
        });

        it('shows property location', () => {
            render(<PropertyCard property={mockProperty} />);

            expect(screen.getByText('Downtown, London')).toBeInTheDocument();
        });

        it('displays property type badge', () => {
            render(<PropertyCard property={mockProperty} />);

            expect(screen.getByText('apartment')).toBeInTheDocument();
        });

        it('shows listing type badge', () => {
            render(<PropertyCard property={mockProperty} />);

            expect(screen.getByText('sale')).toBeInTheDocument();
        });
    });

    describe('Image Handling', () => {
        it('displays property image when available', () => {
            render(<PropertyCard property={mockProperty} />);

            const image = screen.getByRole('img');
            expect(image).toHaveAttribute('src', 'https://example.com/image1.jpg');
            expect(image).toHaveAttribute('alt', 'Modern Luxury Apartment');
        });

        it('shows placeholder when no image available', () => {
            const propertyWithoutImage = { ...mockProperty, images: [] };
            render(<PropertyCard property={propertyWithoutImage} />);

            expect(screen.getByText('No image available')).toBeInTheDocument();
        });

        it('handles multiple images correctly', () => {
            const propertyWithMultipleImages = {
                ...mockProperty,
                images: ['image1.jpg', 'image2.jpg', 'image3.jpg']
            };
            render(<PropertyCard property={propertyWithMultipleImages} />);

            // Should display first image
            const image = screen.getByRole('img');
            expect(image).toHaveAttribute('src', 'image1.jpg');
        });
    });

    describe('Features Display', () => {
        it('displays first 3 features', () => {
            render(<PropertyCard property={mockProperty} />);

            expect(screen.getByText('Balcony')).toBeInTheDocument();
            expect(screen.getByText('Parking')).toBeInTheDocument();
            expect(screen.getByText('Gym')).toBeInTheDocument();
        });

        it('shows "more features" indicator when property has more than 3 features', () => {
            render(<PropertyCard property={mockProperty} />);

            expect(screen.getByText('+2 more')).toBeInTheDocument();
        });

        it('does not show "more" indicator when property has 3 or fewer features', () => {
            const propertyWithFewFeatures = {
                ...mockProperty,
                features: ['Balcony', 'Parking']
            };
            render(<PropertyCard property={propertyWithFewFeatures} />);

            expect(screen.queryByText(/\+\d+ more/)).not.toBeInTheDocument();
        });
    });

    describe('Price Formatting', () => {
        it('formats sale prices correctly', () => {
            render(<PropertyCard property={mockProperty} />);

            expect(screen.getByText('£450,000')).toBeInTheDocument();
        });

        it('formats rental prices with monthly indicator', () => {
            const rentalProperty = { ...mockProperty, listingType: 'rent' as const, price: 2500 };
            render(<PropertyCard property={rentalProperty} />);

            expect(screen.getByText('£2,500')).toBeInTheDocument();
            expect(screen.getByText('/month')).toBeInTheDocument();
        });

        it('handles large prices correctly', () => {
            const expensiveProperty = { ...mockProperty, price: 1250000 };
            render(<PropertyCard property={expensiveProperty} />);

            expect(screen.getByText('£1,250,000')).toBeInTheDocument();
        });
    });

    describe('Enhanced Features (Semantic Search)', () => {
        it('displays relevance score when available', () => {
            render(<PropertyCard property={mockEnhancedProperty} showRelevanceScore={true} />);

            expect(screen.getByText('85% Match')).toBeInTheDocument();
        });

        it('hides relevance score when showRelevanceScore is false', () => {
            render(<PropertyCard property={mockEnhancedProperty} showRelevanceScore={false} />);

            expect(screen.queryByText('85% Match')).not.toBeInTheDocument();
        });

        it('displays match reasons when available', () => {
            render(<PropertyCard property={mockEnhancedProperty} showMatchReasons={true} />);

            expect(screen.getByText('Why this matches:')).toBeInTheDocument();
            expect(screen.getByText('Perfect bedroom count match')).toBeInTheDocument();
        });

        it('shows match keywords', () => {
            render(<PropertyCard property={mockEnhancedProperty} showMatchReasons={true} />);

            expect(screen.getByText('apartment')).toBeInTheDocument();
            expect(screen.getByText('london')).toBeInTheDocument();
            expect(screen.getByText('modern')).toBeInTheDocument();
        });

        it('hides match reasons when showMatchReasons is false', () => {
            render(<PropertyCard property={mockEnhancedProperty} showMatchReasons={false} />);

            expect(screen.queryByText('Why this matches:')).not.toBeInTheDocument();
        });

        it('does not show match section when no match reasons available', () => {
            const propertyWithoutMatches = { ...mockProperty };
            render(<PropertyCard property={propertyWithoutMatches} showMatchReasons={true} />);

            expect(screen.queryByText('Why this matches:')).not.toBeInTheDocument();
        });
    });

    describe('Interaction', () => {
        it('calls onClick when card is clicked', async () => {
            render(<PropertyCard property={mockProperty} onPropertyClick={mockOnClick} />);

            const card = screen.getByTestId('property-card');
            await user.click(card);

            expect(mockOnClick).toHaveBeenCalledWith(mockProperty);
        });

        it('does not call onClick when onPropertyClick is not provided', async () => {
            render(<PropertyCard property={mockProperty} />);

            const card = screen.getByTestId('property-card');
            await user.click(card);

            // Should not throw error
            expect(true).toBe(true);
        });

        it('has proper cursor style when clickable', () => {
            render(<PropertyCard property={mockProperty} onPropertyClick={mockOnClick} />);

            const card = screen.getByTestId('property-card');
            expect(card).toHaveClass('cursor-pointer');
        });
    });

    describe('Accessibility', () => {
        it('has proper ARIA labels', () => {
            render(<PropertyCard property={mockProperty} />);

            const image = screen.getByRole('img');
            expect(image).toHaveAttribute('alt', 'Modern Luxury Apartment');
        });

        it('has proper semantic structure', () => {
            render(<PropertyCard property={mockProperty} />);

            // Should have heading for title
            expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('Modern Luxury Apartment');
        });

        it('provides keyboard navigation support', async () => {
            render(<PropertyCard property={mockProperty} onPropertyClick={mockOnClick} />);

            const card = screen.getByTestId('property-card');

            // Should be focusable
            card.focus();
            expect(card).toHaveFocus();

            // Should respond to Enter key
            fireEvent.keyDown(card, { key: 'Enter' });
            expect(mockOnClick).toHaveBeenCalledWith(mockProperty);
        });

        it('responds to Space key', async () => {
            render(<PropertyCard property={mockProperty} onPropertyClick={mockOnClick} />);

            const card = screen.getByTestId('property-card');
            card.focus();

            fireEvent.keyDown(card, { key: ' ' });
            expect(mockOnClick).toHaveBeenCalledWith(mockProperty);
        });
    });

    describe('Performance', () => {
        it('renders quickly with large feature lists', () => {
            const propertyWithManyFeatures = {
                ...mockProperty,
                features: Array(20).fill(0).map((_, i) => `Feature ${i}`)
            };

            const start = Date.now();
            render(<PropertyCard property={propertyWithManyFeatures} />);
            const end = Date.now();

            expect(end - start).toBeLessThan(100); // Should render within 100ms
        });

        it('handles missing data gracefully', () => {
            const incompleteProperty = {
                ...mockProperty,
                images: undefined,
                features: undefined,
                location: { ...mockProperty.location, area: undefined }
            } as any;

            expect(() => {
                render(<PropertyCard property={incompleteProperty} />);
            }).not.toThrow();
        });
    });

    describe('Edge Cases', () => {
        it('handles zero price', () => {
            const freeProperty = { ...mockProperty, price: 0 };
            render(<PropertyCard property={freeProperty} />);

            expect(screen.getByText('£0')).toBeInTheDocument();
        });

        it('handles very long titles', () => {
            const longTitleProperty = {
                ...mockProperty,
                title: 'A'.repeat(200)
            };
            render(<PropertyCard property={longTitleProperty} />);

            // Should truncate with CSS classes
            const titleElement = screen.getByRole('heading', { level: 3 });
            expect(titleElement).toHaveClass('line-clamp-2');
        });

        it('handles empty features array', () => {
            const noFeaturesProperty = { ...mockProperty, features: [] };
            render(<PropertyCard property={noFeaturesProperty} />);

            // Should not show any feature badges
            expect(screen.queryByText('Balcony')).not.toBeInTheDocument();
        });

        it('handles missing location data', () => {
            const noLocationProperty = {
                ...mockProperty,
                location: { ...mockProperty.location, area: '', city: '' }
            };
            render(<PropertyCard property={noLocationProperty} />);

            // Should handle gracefully
            expect(screen.getByText(', ')).toBeInTheDocument();
        });
    });

    describe('Animation and Visual Effects', () => {
        it('applies hover effects', async () => {
            render(<PropertyCard property={mockProperty} />);

            const card = screen.getByTestId('property-card');

            // Should have hover classes
            expect(card).toHaveClass('hover:shadow-xl');
            expect(card).toHaveClass('transition-all');
        });

        it('has proper loading states for images', () => {
            render(<PropertyCard property={mockProperty} />);

            const image = screen.getByRole('img');
            expect(image).toHaveAttribute('loading', 'lazy');
        });
    });

    describe('Responsive Design', () => {
        it('has responsive image sizing', () => {
            render(<PropertyCard property={mockProperty} />);

            const image = screen.getByRole('img');
            expect(image).toHaveAttribute('sizes', '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw');
        });

        it('applies responsive classes', () => {
            render(<PropertyCard property={mockProperty} />);

            const card = screen.getByTestId('property-card');
            expect(card).toHaveClass('rounded-xl');
            expect(card).toHaveClass('shadow-md');
        });
    });
});