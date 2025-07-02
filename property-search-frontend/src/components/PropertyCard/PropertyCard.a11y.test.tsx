import React from 'react';
import { render, screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { PropertyCard } from './PropertyCard';
import { Property } from '@/types/property';

expect.extend(toHaveNoViolations);

const mockProperty: Property = {
  id: '1',
  title: 'Beautiful Modern Apartment',
  price: 450000,
  location: {
    address: '123 Test Street',
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
  features: ['modern', 'balcony', 'parking'],
  description: 'A beautiful modern apartment in central London',
  listedDate: new Date('2024-01-15'),
  agent: {
    id: 'agent1',
    name: 'John Smith',
    phone: '+44 20 1234 5678',
    email: 'john.smith@example.com',
  },
};

describe('PropertyCard - Accessibility', () => {
  it('should have no accessibility violations', async () => {
    const { container } = render(
      <PropertyCard 
        property={mockProperty}
        onClick={vi.fn()}
        onFavorite={vi.fn()}
      />
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  describe('ARIA attributes', () => {
    it('should have proper ARIA labels', () => {
      render(
        <PropertyCard 
          property={mockProperty}
          onClick={vi.fn()}
          onFavorite={vi.fn()}
        />
      );

      const card = screen.getByRole('article');
      expect(card).toHaveAttribute('aria-label', expect.stringContaining(mockProperty.title));

      const favoriteButton = screen.getByRole('button', { name: /favorite/i });
      expect(favoriteButton).toHaveAttribute('aria-pressed', 'false');

      const priceElement = screen.getByText(/£450,000/);
      expect(priceElement).toHaveAttribute('aria-label', expect.stringContaining('price'));
    });

    it('should announce state changes', async () => {
      const user = userEvent.setup();
      const onFavorite = vi.fn();
      
      render(
        <PropertyCard 
          property={mockProperty} 
          onClick={vi.fn()}
          onFavorite={onFavorite}
        />
      );

      const favoriteButton = screen.getByRole('button', { name: /favorite/i });
      
      await user.click(favoriteButton);
      
      expect(favoriteButton).toHaveAttribute('aria-pressed', 'true');
      
      // Check for status announcement
      const statusElement = screen.getByRole('status');
      expect(statusElement).toHaveTextContent('Added to favorites');
    });

    it('should have proper ARIA labels for semantic score', () => {
      const propertyWithScore = {
        ...mockProperty,
        semanticScore: 0.95,
      };

      render(
        <PropertyCard 
          property={propertyWithScore}
          onClick={vi.fn()}
          onFavorite={vi.fn()}
        />
      );

      const scoreElement = screen.getByText('95% match');
      expect(scoreElement).toHaveAttribute('aria-label', 'Semantic match score: 95%');
    });

    it('should have descriptive alt text for images', () => {
      render(
        <PropertyCard 
          property={mockProperty}
          onClick={vi.fn()}
          onFavorite={vi.fn()}
        />
      );

      const image = screen.getByRole('img');
      expect(image).toHaveAttribute('alt', expect.stringContaining(mockProperty.title));
    });
  });

  describe('Keyboard navigation', () => {
    it('should be fully keyboard navigable', async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();
      const onFavorite = vi.fn();

      render(
        <PropertyCard 
          property={mockProperty}
          onClick={onClick}
          onFavorite={onFavorite}
        />
      );

      // Tab to card
      await user.tab();
      const card = screen.getByRole('article');
      expect(card).toHaveFocus();

      // Enter to activate
      await user.keyboard('{Enter}');
      expect(onClick).toHaveBeenCalled();

      // Tab to favorite button
      await user.tab();
      const favoriteButton = screen.getByRole('button', { name: /favorite/i });
      expect(favoriteButton).toHaveFocus();

      // Space to activate
      await user.keyboard(' ');
      expect(onFavorite).toHaveBeenCalled();
    });

    it('should handle escape key to close details', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();

      render(
        <PropertyCard 
          property={mockProperty}
          onClick={vi.fn()}
          onFavorite={vi.fn()}
          showDetails={true}
          onClose={onClose}
        />
      );

      await user.keyboard('{Escape}');
      expect(onClose).toHaveBeenCalled();
    });

    it('should trap focus in modal when details are shown', async () => {
      const user = userEvent.setup();
      
      render(
        <PropertyCard 
          property={mockProperty}
          onClick={vi.fn()}
          onFavorite={vi.fn()}
          showDetails={true}
        />
      );

      const modal = screen.getByRole('dialog');
      const focusableElements = modal.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );

      // Tab through all elements
      for (let i = 0; i < focusableElements.length + 1; i++) {
        await user.tab();
      }

      // Should cycle back to first element
      expect(focusableElements[0]).toHaveFocus();
    });

    it('should have visible focus indicators', () => {
      const { container } = render(
        <PropertyCard 
          property={mockProperty}
          onClick={vi.fn()}
          onFavorite={vi.fn()}
        />
      );

      const focusableElements = container.querySelectorAll(
        'button, a, [tabindex="0"]'
      );

      focusableElements.forEach(element => {
        element.focus();
        const styles = window.getComputedStyle(element);
        
        // Check for focus styles (outline, box-shadow, or border)
        const hasFocusStyle = 
          styles.outline !== 'none' || 
          styles.boxShadow !== 'none' ||
          styles.border !== 'none';
        
        expect(hasFocusStyle).toBe(true);
      });
    });
  });

  describe('Screen reader support', () => {
    it('should have descriptive text for screen readers', () => {
      render(
        <PropertyCard 
          property={mockProperty}
          onClick={vi.fn()}
          onFavorite={vi.fn()}
        />
      );

      // Image should have alt text
      const image = screen.getByRole('img');
      expect(image).toHaveAttribute('alt', expect.stringContaining(mockProperty.title));

      // Price should be readable
      const price = screen.getByText(/£450,000/);
      expect(price.textContent).toMatch(/£450,000/);

      // Features should be in a list
      const features = screen.getByRole('list', { name: /features/i });
      expect(features).toBeInTheDocument();
    });

    it('should use semantic HTML', () => {
      const { container } = render(
        <PropertyCard 
          property={mockProperty}
          onClick={vi.fn()}
          onFavorite={vi.fn()}
        />
      );

      // Check for semantic elements
      expect(container.querySelector('article')).toBeInTheDocument();
      expect(container.querySelector('h3')).toBeInTheDocument();
      expect(container.querySelector('address')).toBeInTheDocument();
    });

    it('should provide context for property details', () => {
      render(
        <PropertyCard 
          property={mockProperty}
          onClick={vi.fn()}
          onFavorite={vi.fn()}
        />
      );

      // Bedrooms should have context
      const bedroomsText = screen.getByText('2');
      const bedroomsContainer = bedroomsText.closest('[aria-label*="bedroom"]');
      expect(bedroomsContainer).toBeInTheDocument();

      // Bathrooms should have context
      const bathroomsText = screen.getByText('1');
      const bathroomsContainer = bathroomsText.closest('[aria-label*="bathroom"]');
      expect(bathroomsContainer).toBeInTheDocument();
    });

    it('should announce loading states', () => {
      render(
        <PropertyCard 
          property={mockProperty}
          onClick={vi.fn()}
          onFavorite={vi.fn()}
          loading={true}
        />
      );

      const loadingElement = screen.getByRole('status', { name: /loading/i });
      expect(loadingElement).toBeInTheDocument();
    });
  });

  describe('Color contrast', () => {
    it('should have sufficient color contrast', async () => {
      const { container } = render(
        <PropertyCard 
          property={mockProperty}
          onClick={vi.fn()}
          onFavorite={vi.fn()}
        />
      );

      // Run axe contrast checks
      const results = await axe(container, {
        rules: {
          'color-contrast': { enabled: true },
        },
      });

      expect(results).toHaveNoViolations();
    });

    it('should maintain contrast in different states', async () => {
      const { container, rerender } = render(
        <PropertyCard 
          property={mockProperty}
          onClick={vi.fn()}
          onFavorite={vi.fn()}
        />
      );

      // Test normal state
      let results = await axe(container);
      expect(results).toHaveNoViolations();

      // Test hover state (simulated with class)
      rerender(
        <PropertyCard 
          property={mockProperty}
          onClick={vi.fn()}
          onFavorite={vi.fn()}
          className="hover"
        />
      );

      results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('Touch accessibility', () => {
    it('should have minimum touch target sizes', () => {
      render(
        <PropertyCard 
          property={mockProperty}
          onClick={vi.fn()}
          onFavorite={vi.fn()}
          touchOptimized={true}
        />
      );

      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        const rect = button.getBoundingClientRect();
        // Minimum 44x44 pixels for touch targets (WCAG AA)
        expect(rect.width).toBeGreaterThanOrEqual(44);
        expect(rect.height).toBeGreaterThanOrEqual(44);
      });
    });

    it('should have adequate spacing between touch targets', () => {
      render(
        <PropertyCard 
          property={mockProperty}
          onClick={vi.fn()}
          onFavorite={vi.fn()}
          touchOptimized={true}
        />
      );

      const buttons = screen.getAllByRole('button');
      if (buttons.length > 1) {
        const firstButton = buttons[0].getBoundingClientRect();
        const secondButton = buttons[1].getBoundingClientRect();
        
        // Calculate distance between buttons
        const distance = Math.abs(firstButton.right - secondButton.left) || 
                        Math.abs(firstButton.bottom - secondButton.top);
        
        // Should have at least 8px spacing
        expect(distance).toBeGreaterThanOrEqual(8);
      }
    });
  });

  describe('Reduced motion support', () => {
    it('should respect prefers-reduced-motion', () => {
      // Mock prefers-reduced-motion
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation(query => ({
          matches: query === '(prefers-reduced-motion: reduce)',
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      });

      const { container } = render(
        <PropertyCard 
          property={mockProperty}
          onClick={vi.fn()}
          onFavorite={vi.fn()}
        />
      );

      // Check that animations are disabled or reduced
      const animatedElements = container.querySelectorAll('.transition, .animate');
      animatedElements.forEach(element => {
        const styles = window.getComputedStyle(element);
        // Should have reduced or no animation
        expect(
          styles.animationDuration === '0s' || 
          styles.transitionDuration === '0s' ||
          element.classList.contains('motion-reduce')
        ).toBe(true);
      });
    });
  });

  describe('High contrast mode support', () => {
    it('should work in high contrast mode', async () => {
      // Simulate high contrast mode
      document.body.style.filter = 'contrast(200%)';

      const { container } = render(
        <PropertyCard 
          property={mockProperty}
          onClick={vi.fn()}
          onFavorite={vi.fn()}
        />
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();

      // Clean up
      document.body.style.filter = '';
    });
  });

  describe('Language and internationalization', () => {
    it('should have proper lang attributes', () => {
      render(
        <PropertyCard 
          property={mockProperty}
          onClick={vi.fn()}
          onFavorite={vi.fn()}
        />
      );

      const card = screen.getByRole('article');
      expect(card).toHaveAttribute('lang', 'en');
    });

    it('should format currency appropriately', () => {
      render(
        <PropertyCard 
          property={mockProperty}
          onClick={vi.fn()}
          onFavorite={vi.fn()}
        />
      );

      const price = screen.getByText(/£450,000/);
      expect(price).toBeInTheDocument();
      
      // Should have proper currency formatting
      expect(price.textContent).toMatch(/£[\d,]+/);
    });
  });
});