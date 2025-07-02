import React, { useState, useCallback } from 'react';
import { Property } from '@/types/property';
import { PropertyCard } from '@/components/PropertyCard';
import { useMobileDetect, useTouchDetection } from '@/hooks/useMobileDetect';
import { useAccessibility } from '@/hooks/useAccessibility';
import { cn } from '@/lib/utils';

interface PropertyGridProps {
  properties: Property[];
  onPropertyClick?: (property: Property) => void;
  onPropertyFavorite?: (propertyId: string) => void;
  onSwipeLeft?: (property: Property) => void;
  onSwipeRight?: (property: Property) => void;
  className?: string;
  loading?: boolean;
}

export function PropertyGrid({
  properties,
  onPropertyClick,
  onPropertyFavorite,
  onSwipeLeft,
  onSwipeRight,
  className,
  loading = false,
}: PropertyGridProps) {
  const { deviceType, isMobile, isTablet } = useMobileDetect();
  const isTouch = useTouchDetection();
  const { announce } = useAccessibility();

  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [touchEnd, setTouchEnd] = useState<{ x: number; y: number } | null>(null);

  // Handle touch events for swipe gestures
  const handleTouchStart = useCallback((e: React.TouchEvent, property: Property) => {
    if (!isTouch) return;
    
    const touch = e.touches[0];
    setTouchStart({ x: touch.clientX, y: touch.clientY });
    setTouchEnd(null);
  }, [isTouch]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStart) return;
    
    const touch = e.touches[0];
    setTouchEnd({ x: touch.clientX, y: touch.clientY });
  }, [touchStart]);

  const handleTouchEnd = useCallback((property: Property) => {
    if (!touchStart || !touchEnd) return;

    const deltaX = touchStart.x - touchEnd.x;
    const deltaY = touchStart.y - touchEnd.y;
    const minSwipeDistance = 50;

    // Only trigger swipe if horizontal movement is greater than vertical
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > minSwipeDistance) {
      if (deltaX > 0) {
        // Swipe left
        onSwipeLeft?.(property);
        announce('Property swiped left', 'polite');
      } else {
        // Swipe right
        onSwipeRight?.(property);
        announce('Property swiped right', 'polite');
      }
    }

    setTouchStart(null);
    setTouchEnd(null);
  }, [touchStart, touchEnd, onSwipeLeft, onSwipeRight, announce]);

  const handlePropertyClick = useCallback((property: Property) => {
    onPropertyClick?.(property);
    announce(`Viewing details for ${property.title}`, 'polite');
  }, [onPropertyClick, announce]);

  const handlePropertyFavorite = useCallback((propertyId: string) => {
    onPropertyFavorite?.(propertyId);
    const property = properties.find(p => p.id === propertyId);
    if (property) {
      announce(`${property.title} added to favorites`, 'polite');
    }
  }, [onPropertyFavorite, properties, announce]);

  // Determine grid columns based on device type
  const getGridColumns = () => {
    if (isMobile) return 'grid-cols-1';
    if (isTablet) return 'grid-cols-2';
    return 'grid-cols-3 xl:grid-cols-4';
  };

  // Determine card size based on device type
  const getCardSize = () => {
    if (isMobile) return 'mobile';
    if (isTablet) return 'tablet';
    return 'desktop';
  };

  if (loading) {
    return (
      <div 
        className={cn(
          'grid gap-4 p-4',
          getGridColumns(),
          className
        )}
        data-testid="property-grid"
        role="status"
        aria-label="Loading properties"
      >
        {Array.from({ length: isMobile ? 3 : isTablet ? 6 : 12 }).map((_, index) => (
          <div
            key={index}
            className="animate-pulse bg-gray-200 rounded-lg"
            style={{ height: isMobile ? '300px' : '350px' }}
            aria-hidden="true"
          />
        ))}
      </div>
    );
  }

  if (properties.length === 0) {
    return (
      <div 
        className="flex flex-col items-center justify-center py-12 text-center"
        role="status"
        aria-label="No properties found"
      >
        <div className="text-gray-400 mb-4">
          <svg
            className="w-16 h-16 mx-auto"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1}
              d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
            />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          No properties found
        </h3>
        <p className="text-gray-500 max-w-md">
          Try adjusting your search criteria or browse our featured properties.
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'grid gap-4 p-4',
        getGridColumns(),
        className
      )}
      data-testid="property-grid"
      role="main"
      aria-label={`${properties.length} properties found`}
    >
      {properties.map((property) => (
        <div
          key={property.id}
          className={cn(
            'transition-transform duration-200',
            isTouch && 'touch-manipulation',
            isMobile && 'max-w-full'
          )}
          onTouchStart={(e) => handleTouchStart(e, property)}
          onTouchMove={handleTouchMove}
          onTouchEnd={() => handleTouchEnd(property)}
        >
          <PropertyCard
            property={property}
            onClick={() => handlePropertyClick(property)}
            onFavorite={() => handlePropertyFavorite(property.id)}
            size={getCardSize() as 'mobile' | 'tablet' | 'desktop'}
            showExtendedFeatures={!isMobile}
            showAgentInfo={!isMobile}
            touchOptimized={isTouch}
            data-testid="property-card"
          />
        </div>
      ))}
    </div>
  );
}