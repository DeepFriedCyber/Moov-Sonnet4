// src/components/homepage/__tests__/HeroSection.test.tsx
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HeroSection } from '../HeroSection';

describe('HeroSection', () => {
    it('should render hero content', () => {
        // Arrange
        const mockOnSearch = vi.fn();

        // Act
        render(<HeroSection onSearch={mockOnSearch} />);

        // Assert
        expect(screen.getByText('Find Your Perfect Home')).toBeInTheDocument();
        expect(screen.getByText('With Natural Language')).toBeInTheDocument();
        expect(screen.getByText(/Simply describe your dream property/i)).toBeInTheDocument();
    });

    it('should display AI badge', () => {
        // Arrange
        const mockOnSearch = vi.fn();

        // Act
        render(<HeroSection onSearch={mockOnSearch} />);

        // Assert
        expect(screen.getByText('AI-Powered Property Search')).toBeInTheDocument();
    });

    it('should handle search submission', async () => {
        // Arrange
        const mockOnSearch = vi.fn();
        const user = userEvent.setup();

        // Act
        render(<HeroSection onSearch={mockOnSearch} />);

        const searchInput = screen.getByPlaceholderText(/Modern flat near tube station/i);
        await user.type(searchInput, 'Garden flat in zone 2');
        await user.keyboard('{Enter}');

        // Assert
        expect(mockOnSearch).toHaveBeenCalledWith('Garden flat in zone 2');
    });

    it('should display statistics', () => {
        // Arrange
        const mockOnSearch = vi.fn();

        // Act
        render(<HeroSection onSearch={mockOnSearch} />);

        // Assert
        expect(screen.getByText('50,000+')).toBeInTheDocument();
        expect(screen.getByText('Properties Listed')).toBeInTheDocument();
        expect(screen.getByText('10,000+')).toBeInTheDocument();
        expect(screen.getByText('Happy Customers')).toBeInTheDocument();
        expect(screen.getByText('100%')).toBeInTheDocument();
        expect(screen.getByText('UK Coverage')).toBeInTheDocument();
    });

    it('should handle example search clicks', async () => {
        // Arrange
        const mockOnSearch = vi.fn();
        const user = userEvent.setup();

        // Act
        render(<HeroSection onSearch={mockOnSearch} />);

        const exampleButton = screen.getByText('Pet-friendly flat with outdoor space');
        await user.click(exampleButton);

        // Assert
        expect(mockOnSearch).toHaveBeenCalledWith('Pet-friendly flat with outdoor space');
    });
});