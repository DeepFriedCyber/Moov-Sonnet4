import React, { useState, useEffect } from 'react';

interface MobileDetection {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  orientation: 'portrait' | 'landscape';
  viewport: {
    width: number;
    height: number;
  };
  deviceType: 'mobile' | 'tablet' | 'desktop';
}

export function useMobileDetect(): MobileDetection {
  const [detection, setDetection] = useState<MobileDetection>(() => {
    if (typeof window === 'undefined') {
      return {
        isMobile: false,
        isTablet: false,
        isDesktop: true,
        orientation: 'landscape',
        viewport: { width: 1920, height: 1080 },
        deviceType: 'desktop',
      };
    }

    return getDeviceInfo();
  });

  useEffect(() => {
    const handleResize = () => {
      setDetection(getDeviceInfo());
    };

    const handleOrientationChange = () => {
      setDetection(getDeviceInfo());
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleOrientationChange);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleOrientationChange);
    };
  }, []);

  return detection;
}

function getDeviceInfo(): MobileDetection {
  const width = window.innerWidth;
  const height = window.innerHeight;
  
  const isMobile = width < 768;
  const isTablet = width >= 768 && width < 1024;
  const isDesktop = width >= 1024;
  
  const orientation = width > height ? 'landscape' : 'portrait';
  
  let deviceType: 'mobile' | 'tablet' | 'desktop' = 'desktop';
  if (isMobile) deviceType = 'mobile';
  else if (isTablet) deviceType = 'tablet';

  return {
    isMobile,
    isTablet,
    isDesktop,
    orientation,
    viewport: { width, height },
    deviceType,
  };
}

// Touch detection hook
export function useTouchDetection() {
  const [isTouch, setIsTouch] = useState(false);

  useEffect(() => {
    const checkTouch = () => {
      setIsTouch(
        'ontouchstart' in window ||
        navigator.maxTouchPoints > 0 ||
        window.matchMedia('(pointer: coarse)').matches
      );
    };

    checkTouch();
    
    const mediaQuery = window.matchMedia('(pointer: coarse)');
    const handleChange = () => checkTouch();
    
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
    } else {
      // @ts-ignore - fallback for older browsers
      mediaQuery.addListener(handleChange);
    }

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleChange);
      } else {
        // @ts-ignore - fallback for older browsers
        mediaQuery.removeListener(handleChange);
      }
    };
  }, []);

  return isTouch;
}