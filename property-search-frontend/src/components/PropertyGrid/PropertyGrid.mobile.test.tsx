import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { PropertyGrid } from './PropertyGrid';
import { Property } from '@/types/property';

// Mock the hooks
vi.mock('@/hooks/useMobileDetect', () => ({
    useMobileDetect: vi.fn(),
    useTouchDetection: vi.fn(),
}));

vi.mock('@/hooks/useAccessibility', () => ({
    useAccessibility: vi.fn(() => ({
        announce: vi.fn(),
    })),
}));

const mockProperties: Property[] = [
    {
        id: '1',
        title: 'Modern Apartment',
        price: 450000,
        location: {
            address: '123 Test St',
            city: 'London',
            postcode: 'SW1A 1AA',
            coordinates: { lat: 51.5074, lng: -0.1278 },
        },
        bedrooms: 2,
        bathrooms: 1,
        area: 850,
        propertyType: 'apartment',
        listingType: 'sale',
        images: ['/test-image.jpg'],
        features: ['modern', 'balcony'],
        description: 'Beautiful modern apartment',
        listedDate: new Date(),
        agent: {
            id: 'agent1',
            name: 'Test Agent',
            phone: '123456789',
            email: 'agent@test.com',
        },
    },
    {
        id: '2',
        title: 'Family House',
        price: 650000,
        location: {
            address: '456 Family Ave',
            city: 'London',
            postcode: 'SW2B 2BB',
            coordinates: { lat: 51.5074, lng: -0.1278 },
        },
        bedrooms: 3,
        bathrooms: 2,
        area: 1200,
        propertyType: 'house',
        listingType: 'sale',
        images: ['/test-house.jpg'],
        features: ['garden', 'parking'],
        description: 'Perfect family home',
        listedDate: new Date(),
        agent: {
            id: 'agent2',
            name: 'Family Agent',
            phone: '987654321',
            email: 'family@test.com',
        },
    },
];

// Viewport utilities
const setViewport = (width: number, height: number) => {
    Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: width,
    });
    Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: height,
    });
};

const resetViewport = () => {
    setViewport(1920, 1080);
};

describe('PropertyGrid - Mobile Responsiveness', () => {
    const { useMobileDetect, useTouchDetection } = require('@/hooks/useMobileDetect');

    afterEach(() => {
        resetViewport();
        vi.clearAllMocks();
    });

    describe('Mobile Portrait (360x640)', () => {
        beforeEach(() => {
            setViewport(360, 640);
            useMobileDetect.mockReturnValue({
                isMobile: true,
                isTablet: false,
                isDesktop: false,
                deviceType: 'mobile',
                orientation: 'portrait',
                viewport: { width: 360, height: 640 },
            });
            useTouchDetection.mockReturnValue(true);
        });

        it('should display single column layout on mobile', () => {
            const { container } = render(
                <PropertyGrid properties={mockProperties} />
            );

            const grid = container.querySelector('[data-testid="property-grid"]');
            expect(grid).toHaveClass('grid-cols-1');
        });

        it('should show mobile-optimized property cards', () => {
            render(<PropertyGrid properties={mockProperties} />);

            const cards = screen.getAllByTestId('property-card');
            expect(cards).toHaveLength(2);

            // Cards should be present and properly sized for mobile
            cards.forEach(card => {
                expect(card).toBeInTheDocument();
            });
        });

        it('should hide non-essential information on mobile', () => {
            render(<PropertyGrid properties={mockProperties} />);

            // Agent information should be hidden on mobile
            expect(screen.queryByTestId('agent-info')).not.toBeInTheDocument();

            // Extended features should be collapsed on mobile
            expect(screen.queryByTestId('extended-features')).not.toBeInTheDocument();
        });

        it('should show loading skeleton with appropriate count for mobile', () => {
            render(<PropertyGrid properties={[]} loading={true} />);

            const skeletons = screen.getAllByRole('status', { hidden: true });
            // Should show 3 skeleton items for mobile
            expect(skeletons).toHaveLength(3);
        });
    });

    describe('Tablet (768x1024)', () => {
        beforeEach(() => {
            setViewport(768, 1024);
            useMobileDetect.mockReturnValue({
                isMobile: false,
                isTablet: true,
                isDesktop: false,
                deviceType: 'tablet',
                orientation: 'portrait',
                viewport: { width: 768, height: 1024 },
            });
            useTouchDetection.mockReturnValue(true);
        });

        it('should display two column layout on tablet', () => {
            const { container } = render(
                <PropertyGrid properties={mockProperties} />
            );

            const grid = container.querySelector('[data-testid="property-grid"]');
            expect(grid).toHaveClass('grid-cols-2');
        });

        it('should show loading skeleton with appropriate count for tablet', () => {
            render(<PropertyGrid properties={[]} loading={true} />);

            const skeletons = screen.getAllByRole('status', { hidden: true });
            // Should show 6 skeleton items for tablet
            expect(skeletons).toHaveLength(6);
        });
    });

    describe('Desktop (1920x1080)', () => {
        beforeEach(() => {
            setViewport(1920, 1080);
            useMobileDetect.mockReturnValue({
                isMobile: false,
                isTablet: false,
                isDesktop: true,
                deviceType: 'desktop',
                orientation: 'landscape',
                viewport: { width: 1920, height: 1080 },
            });
            useTouchDetection.mockReturnValue(false);
        });

        it('should display multi-column layout on desktop', () => {
            const { container } = render(
                <PropertyGrid properties={mockProperties} />
            );

            const grid = container.querySelector('[data-testid="property-grid"]');
            expect(grid).toHaveClass('grid-cols-3');
            expect(grid).toHaveClass('xl:grid-cols-4');
        });

        it('should show loading skeleton with appropriate count for desktop', () => {
            render(<PropertyGrid properties={[]} loading={true} />);

            const skeletons = screen.getAllByRole('status', { hidden: true });
            // Should show 12 skeleton items for desktop
            expect(skeletons).toHaveLength(12);
        });
    });

    describe('Touch Interactions', () => {
        beforeEach(() => {
            setViewport(360, 640);
            useMobileDetect.mockReturnValue({
                isMobile: true,
                isTablet: false,
                isDesktop: false,
                deviceType: 'mobile',
                orientation: 'portrait',
                viewport: { width: 360, height: 640 },
            });
            useTouchDetection.mockReturnValue(true);
        });

        it('should handle swipe gestures on mobile', () => {
            const onSwipeLeft = vi.fn();
            const onSwipeRight = vi.fn();

            render(
                <PropertyGrid
                    properties={mockProperties}
                    onSwipeLeft={onSwipeLeft}
                    onSwipeRight={onSwipeRight}
                />
            );

            const cards = screen.getAllByTestId('property-card');
            const firstCard = cards[0];

            // Simulate swipe left
            fireEvent.touchStart(firstCard, {
                touches: [{ clientX: 300, clientY: 100 }]
            });
            fireEvent.touchMove(firstCard, {
                touches: [{ clientX: 100, clientY: 100 }]
            });
            fireEvent.touchEnd(firstCard, {
                changedTouches: [{ clientX: 100, clientY: 100 }]
            });

            expect(onSwipeLeft).toHaveBeenCalledWith(mockProperties[0]);
        });

        it('should handle swipe right gestures', () => {
            const onSwipeRight = vi.fn();

            render(
                <PropertyGrid
                    properties={mockProperties}
                    onSwipeRight={onSwipeRight}
                />
            );

            const cards = screen.getAllByTestId('property-card');
            const firstCard = cards[0];

            // Simulate swipe right
            fireEvent.touchStart(firstCard, {
                touches: [{ clientX: 100, clientY: 100 }]
            });
            fireEvent.touchMove(firstCard, {
                touches: [{ clientX: 300, clientY: 100 }]
            });
            fireEvent.touchEnd(firstCard, {
                changedTouches: [{ clientX: 300, clientY: 100 }]
            });

            expect(onSwipeRight).toHaveBeenCalledWith(mockProperties[0]);
        });

        it('should not trigger swipe for small movements', () => {
            const onSwipeLeft = vi.fn();

            render(
                <PropertyGrid
                    properties={mockProperties}
                    onSwipeLeft={onSwipeLeft}
                />
            );

            const cards = screen.getAllByTestId('property-card');
            const firstCard = cards[0];

            // Simulate small movement (less than threshold)
            fireEvent.touchStart(firstCard, {
                touches: [{ clientX: 150, clientY: 100 }]
            });
            fireEvent.touchMove(firstCard, {
                touches: [{ clientX: 130, clientY: 100 }]
            });
            fireEvent.touchEnd(firstCard, {
                changedTouches: [{ clientX: 130, clientY: 100 }]
            });

            expect(onSwipeLeft).not.toHaveBeenCalled();
        });

        it('should have touch-optimized styling on touch devices', () => {
            const { container } = render(
                <PropertyGrid properties={mockProperties} />
            );

            const cardContainers = container.querySelectorAll('.touch-manipulation');
            expect(cardContainers.length).toBeGreaterThan(0);
        });
    });

    describe('Accessibility', () => {
        beforeEach(() => {
            useMobileDetect.mockReturnValue({
                isMobile: false,
                isTablet: false,
                isDesktop: true,
                deviceType: 'desktop',
                orientation: 'landscape',
                viewport: { width: 1920, height: 1080 },
            });
            useTouchDetection.mockReturnValue(false);
        });

        it('should have proper ARIA labels', () => {
            render(<PropertyGrid properties={mockProperties} />);

            const grid = screen.getByRole('main');
            expect(grid).toHaveAttribute('aria-label', '2 properties found');
        });

        it('should announce property interactions', async () => {
            const { useAccessibility } = require('@/hooks/useAccessibility');
            const mockAnnounce = vi.fn();
            useAccessibility.mockReturnValue({ announce: mockAnnounce });

            const onPropertyClick = vi.fn();
            const user = userEvent.setup();

            render(
                <PropertyGrid
                    properties={mockProperties}
                    onPropertyClick={onPropertyClick}
                />
            );

            const cards = screen.getAllByTestId('property-card');
            await user.click(cards[0]);

            expect(mockAnnounce).toHaveBeenCalledWith(
                'Viewing details for Modern Apartment',
                'polite'
            );
        });

        it('should show empty state with proper accessibility', () => {
            render(<PropertyGrid properties={[]} />);

            const emptyState = screen.getByRole('status', { name: /no properties found/i });
            expect(emptyState).toBeInTheDocument();

            const heading = screen.getByText('No properties found');
            expect(heading).toBeInTheDocument();
        });

        it('should have proper loading state accessibility', () => {
            render(<PropertyGrid properties={[]} loading={true} />);

            const loadingGrid = screen.getByRole('status', { name: /loading properties/i });
            expect(loadingGrid).toBeInTheDocument();
        });
    });

    describe('Performance', () => {
        it('should handle large property lists efficiently', () => {
            const largePropertyList = Array.from({ length: 100 }, (_, index) => ({
                ...mockProperties[0],
                id: `property-${index}`,
                title: `Property ${index}`,
            }));

            const startTime = performance.now();
            render(<PropertyGrid properties={largePropertyList} />);
            const endTime = performance.now();

            // Should render within reasonable time (less than 100ms)
            expect(endTime - startTime).toBeLessThan(100);
        });

        it('should optimize re-renders', () => {
            const { rerender } = render(<PropertyGrid properties={mockProperties} />);

            // Re-render with same props should not cause unnecessary work
            const startTime = performance.now();
            rerender(<PropertyGrid properties={mockProperties} />);
            const endTime = performance.now();

            expect(endTime - startTime).toBeLessThan(50);
        });
    });
});