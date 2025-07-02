import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ErrorBoundary, withErrorBoundary } from './ErrorBoundary';
import { ErrorFallback } from './ErrorFallback';

// Component that throws an error
const ThrowError = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) {
    throw new Error('Test error');
  }
  return <div>No error</div>;
};

// Mock console.error to avoid noise in tests
const originalError = console.error;
beforeAll(() => {
  console.error = jest.fn();
});

afterAll(() => {
  console.error = originalError;
});

describe('ErrorBoundary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render children when there is no error', () => {
    render(
      <ErrorBoundary>
        <div>Test content</div>
      </ErrorBoundary>
    );

    expect(screen.getByText('Test content')).toBeInTheDocument();
  });

  it('should render error fallback when error occurs', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Oops! Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('Try Again')).toBeInTheDocument();
  });

  it('should call onError callback when error occurs', () => {
    const onError = jest.fn();
    
    render(
      <ErrorBoundary onError={onError}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(onError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        componentStack: expect.any(String),
      })
    );
  });

  it('should reset error when resetError is called', async () => {
    const user = userEvent.setup();
    
    const { rerender } = render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Oops! Something went wrong')).toBeInTheDocument();

    const tryAgainButton = screen.getByText('Try Again');
    await user.click(tryAgainButton);

    // Re-render with no error
    rerender(
      <ErrorBoundary>
        <ThrowError shouldThrow={false} />
      </ErrorBoundary>
    );

    expect(screen.getByText('No error')).toBeInTheDocument();
  });

  it('should use custom fallback component', () => {
    const CustomFallback = () => <div>Custom error message</div>;
    
    render(
      <ErrorBoundary fallback={CustomFallback}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Custom error message')).toBeInTheDocument();
  });

  it('should generate unique error ID', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    const errorIdElement = screen.getByText(/Error ID:/);
    expect(errorIdElement).toBeInTheDocument();
    expect(errorIdElement.textContent).toMatch(/Error ID: error_\d+_[a-z0-9]+/);
  });

  it('should reset error when children change', () => {
    const { rerender } = render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Oops! Something went wrong')).toBeInTheDocument();

    // Change children
    rerender(
      <ErrorBoundary>
        <div>New content</div>
      </ErrorBoundary>
    );

    expect(screen.getByText('New content')).toBeInTheDocument();
  });

  describe('withErrorBoundary HOC', () => {
    it('should wrap component with error boundary', () => {
      const TestComponent = () => <div>Test component</div>;
      const WrappedComponent = withErrorBoundary(TestComponent);

      render(<WrappedComponent />);

      expect(screen.getByText('Test component')).toBeInTheDocument();
    });

    it('should catch errors in wrapped component', () => {
      const WrappedComponent = withErrorBoundary(ThrowError);

      render(<WrappedComponent shouldThrow={true} />);

      expect(screen.getByText('Oops! Something went wrong')).toBeInTheDocument();
    });

    it('should pass through props to wrapped component', () => {
      const TestComponent = ({ message }: { message: string }) => <div>{message}</div>;
      const WrappedComponent = withErrorBoundary(TestComponent);

      render(<WrappedComponent message="Hello World" />);

      expect(screen.getByText('Hello World')).toBeInTheDocument();
    });
  });

  describe('Error reporting', () => {
    beforeEach(() => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should report error to API', async () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      // Wait for error reporting
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(fetch).toHaveBeenCalledWith('/api/errors/report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: expect.stringContaining('"message":"Test error"'),
      });
    });

    it('should include user context in error report', async () => {
      // Mock localStorage
      const mockUser = { id: 'user-123', name: 'Test User' };
      Storage.prototype.getItem = jest.fn(() => JSON.stringify(mockUser));

      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(fetch).toHaveBeenCalledWith('/api/errors/report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: expect.stringContaining('"userId":"user-123"'),
      });
    });

    it('should handle error reporting failure gracefully', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(consoleSpy).toHaveBeenCalledWith('Failed to report error:', expect.any(Error));
      consoleSpy.mockRestore();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      const errorContainer = screen.getByRole('main', { hidden: true });
      expect(errorContainer).toBeInTheDocument();
    });

    it('should be keyboard navigable', async () => {
      const user = userEvent.setup();
      
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      const tryAgainButton = screen.getByText('Try Again');
      const goHomeButton = screen.getByText('Go Home');

      // Tab navigation
      await user.tab();
      expect(tryAgainButton).toHaveFocus();

      await user.tab();
      expect(goHomeButton).toHaveFocus();
    });

    it('should support screen readers', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      const heading = screen.getByRole('heading', { level: 1 });
      expect(heading).toHaveTextContent('Oops! Something went wrong');

      const description = screen.getByText(/We're sorry, but something unexpected happened/);
      expect(description).toBeInTheDocument();
    });
  });

  describe('Error details', () => {
    it('should show/hide technical details', async () => {
      const user = userEvent.setup();
      
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      const toggleButton = screen.getByText('Show technical details');
      await user.click(toggleButton);

      expect(screen.getByText('Hide technical details')).toBeInTheDocument();
      expect(screen.getByText(/Error:/)).toBeInTheDocument();
      expect(screen.getByText(/Stack:/)).toBeInTheDocument();
    });

    it('should copy error details to clipboard', async () => {
      const user = userEvent.setup();
      
      // Mock clipboard API
      Object.assign(navigator, {
        clipboard: {
          writeText: jest.fn().mockResolvedValue(undefined),
        },
      });

      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      // Show details first
      await user.click(screen.getByText('Show technical details'));
      
      const copyButton = screen.getByText('Copy Details');
      await user.click(copyButton);

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        expect.stringContaining('"message":"Test error"')
      );

      expect(screen.getByText('Copied!')).toBeInTheDocument();
    });

    it('should open email client for bug report', async () => {
      const user = userEvent.setup();
      
      // Mock window.open
      window.open = jest.fn();

      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      // Show details first
      await user.click(screen.getByText('Show technical details'));
      
      const reportButton = screen.getByText('Report Bug');
      await user.click(reportButton);

      expect(window.open).toHaveBeenCalledWith(
        expect.stringContaining('mailto:support@example.com')
      );
    });
  });

  describe('Navigation', () => {
    it('should navigate to home page', async () => {
      const user = userEvent.setup();
      
      // Mock window.location
      delete (window as any).location;
      window.location = { href: '' } as any;

      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      const goHomeButton = screen.getByText('Go Home');
      await user.click(goHomeButton);

      expect(window.location.href).toBe('/');
    });
  });

  describe('Performance', () => {
    it('should not cause memory leaks', () => {
      const { unmount } = render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      // Should unmount without errors
      expect(() => unmount()).not.toThrow();
    });

    it('should handle rapid error occurrences', () => {
      const { rerender } = render(
        <ErrorBoundary>
          <ThrowError shouldThrow={false} />
        </ErrorBoundary>
      );

      // Trigger multiple errors rapidly
      for (let i = 0; i < 10; i++) {
        rerender(
          <ErrorBoundary>
            <ThrowError shouldThrow={true} />
          </ErrorBoundary>
        );
      }

      expect(screen.getByText('Oops! Something went wrong')).toBeInTheDocument();
    });
  });
});