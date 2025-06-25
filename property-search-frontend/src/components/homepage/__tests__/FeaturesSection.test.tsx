// src/components/homepage/__tests__/FeaturesSection.test.tsx
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FeaturesSection } from '../FeaturesSection';

describe('FeaturesSection', () => {
  it('should render section title', () => {
    // Act
    render(<FeaturesSection />);

    // Assert
    expect(screen.getByText('Why Choose Moov?')).toBeInTheDocument();
    expect(screen.getByText('Experience the future of property search with cutting-edge AI technology')).toBeInTheDocument();
  });

  it('should display all feature cards', () => {
    // Act
    render(<FeaturesSection />);

    // Assert
    expect(screen.getByText('Natural Language Search')).toBeInTheDocument();
    expect(screen.getByText(/Describe your ideal home in plain English/i)).toBeInTheDocument();

    expect(screen.getByText('AI-Powered Matching')).toBeInTheDocument();
    expect(screen.getByText(/Our AI understands context/i)).toBeInTheDocument();

    expect(screen.getByText('Verified Listings')).toBeInTheDocument();
    expect(screen.getByText(/All properties are verified/i)).toBeInTheDocument();
  });

  it('should render feature icons', () => {
    // Act
    const { container } = render(<FeaturesSection />);

    // Assert
    // Check for SVG icons
    expect(container.querySelector('[data-testid="search-icon"]')).toBeInTheDocument();
    expect(container.querySelector('[data-testid="sparkles-icon"]')).toBeInTheDocument();
    expect(container.querySelector('[data-testid="shield-icon"]')).toBeInTheDocument();
  });
});