import React, { useEffect, useCallback, useRef } from 'react';

interface AccessibilityOptions {
  announceOnChange?: boolean;
  focusTrap?: boolean;
  escapeDeactivates?: boolean;
}

export function useAccessibility(options: AccessibilityOptions = {}) {
  const {
    announceOnChange = true,
    focusTrap = false,
    escapeDeactivates = true,
  } = options;

  const containerRef = useRef<HTMLElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Live region announcements
  const announce = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    if (!announceOnChange) return;

    const announcement = document.createElement('div');
    announcement.setAttribute('aria-live', priority);
    announcement.setAttribute('aria-atomic', 'true');
    announcement.className = 'sr-only';
    announcement.textContent = message;

    document.body.appendChild(announcement);

    // Remove after announcement
    setTimeout(() => {
      document.body.removeChild(announcement);
    }, 1000);
  }, [announceOnChange]);

  // Focus trap implementation
  const trapFocus = useCallback((container: HTMLElement) => {
    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          lastElement.focus();
          e.preventDefault();
        }
      } else {
        if (document.activeElement === lastElement) {
          firstElement.focus();
          e.preventDefault();
        }
      }
    };

    const handleEscapeKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && escapeDeactivates) {
        restoreFocus();
      }
    };

    container.addEventListener('keydown', handleTabKey);
    container.addEventListener('keydown', handleEscapeKey);

    // Focus first element
    if (firstElement) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      firstElement.focus();
    }

    return () => {
      container.removeEventListener('keydown', handleTabKey);
      container.removeEventListener('keydown', handleEscapeKey);
    };
  }, [escapeDeactivates]);

  // Restore focus to previous element
  const restoreFocus = useCallback(() => {
    if (previousFocusRef.current) {
      previousFocusRef.current.focus();
      previousFocusRef.current = null;
    }
  }, []);

  // Skip links for keyboard navigation
  const addSkipLinks = useCallback(() => {
    const skipLink = document.createElement('a');
    skipLink.href = '#main-content';
    skipLink.textContent = 'Skip to main content';
    skipLink.className = 'skip-link';
    skipLink.style.cssText = `
      position: absolute;
      top: -40px;
      left: 6px;
      background: #000;
      color: #fff;
      padding: 8px;
      text-decoration: none;
      z-index: 1000;
      transition: top 0.3s;
    `;

    skipLink.addEventListener('focus', () => {
      skipLink.style.top = '6px';
    });

    skipLink.addEventListener('blur', () => {
      skipLink.style.top = '-40px';
    });

    document.body.insertBefore(skipLink, document.body.firstChild);

    return () => {
      if (document.body.contains(skipLink)) {
        document.body.removeChild(skipLink);
      }
    };
  }, []);

  // Manage focus trap
  useEffect(() => {
    if (focusTrap && containerRef.current) {
      return trapFocus(containerRef.current);
    }
  }, [focusTrap, trapFocus]);

  // Add skip links on mount
  useEffect(() => {
    return addSkipLinks();
  }, [addSkipLinks]);

  return {
    containerRef,
    announce,
    restoreFocus,
    trapFocus,
  };
}

// Hook for managing ARIA attributes
export function useAriaAttributes() {
  const setAriaLabel = useCallback((element: HTMLElement | null, label: string) => {
    if (element) {
      element.setAttribute('aria-label', label);
    }
  }, []);

  const setAriaDescribedBy = useCallback((element: HTMLElement | null, id: string) => {
    if (element) {
      element.setAttribute('aria-describedby', id);
    }
  }, []);

  const setAriaExpanded = useCallback((element: HTMLElement | null, expanded: boolean) => {
    if (element) {
      element.setAttribute('aria-expanded', expanded.toString());
    }
  }, []);

  const setAriaPressed = useCallback((element: HTMLElement | null, pressed: boolean) => {
    if (element) {
      element.setAttribute('aria-pressed', pressed.toString());
    }
  }, []);

  const setAriaHidden = useCallback((element: HTMLElement | null, hidden: boolean) => {
    if (element) {
      element.setAttribute('aria-hidden', hidden.toString());
    }
  }, []);

  return {
    setAriaLabel,
    setAriaDescribedBy,
    setAriaExpanded,
    setAriaPressed,
    setAriaHidden,
  };
}

// Hook for keyboard navigation
export function useKeyboardNavigation() {
  const handleKeyDown = useCallback((
    event: React.KeyboardEvent,
    handlers: {
      onEnter?: () => void;
      onSpace?: () => void;
      onEscape?: () => void;
      onArrowUp?: () => void;
      onArrowDown?: () => void;
      onArrowLeft?: () => void;
      onArrowRight?: () => void;
    }
  ) => {
    switch (event.key) {
      case 'Enter':
        if (handlers.onEnter) {
          event.preventDefault();
          handlers.onEnter();
        }
        break;
      case ' ':
        if (handlers.onSpace) {
          event.preventDefault();
          handlers.onSpace();
        }
        break;
      case 'Escape':
        if (handlers.onEscape) {
          event.preventDefault();
          handlers.onEscape();
        }
        break;
      case 'ArrowUp':
        if (handlers.onArrowUp) {
          event.preventDefault();
          handlers.onArrowUp();
        }
        break;
      case 'ArrowDown':
        if (handlers.onArrowDown) {
          event.preventDefault();
          handlers.onArrowDown();
        }
        break;
      case 'ArrowLeft':
        if (handlers.onArrowLeft) {
          event.preventDefault();
          handlers.onArrowLeft();
        }
        break;
      case 'ArrowRight':
        if (handlers.onArrowRight) {
          event.preventDefault();
          handlers.onArrowRight();
        }
        break;
    }
  }, []);

  return { handleKeyDown };
}