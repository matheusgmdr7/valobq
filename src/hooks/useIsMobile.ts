'use client';

import { useEffect, useState } from 'react';

/** Detecta viewport mobile (inclui landscape em phones). */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      const minSide = Math.min(window.innerWidth, window.innerHeight);
      const touchDevice =
        window.matchMedia('(pointer: coarse)').matches ||
        window.matchMedia('(hover: none)').matches ||
        navigator.maxTouchPoints > 0;

      setIsMobile(
        minSide < 520 ||
          window.innerWidth < 768 ||
          (touchDevice && minSide < 720)
      );
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    const onOrientationChange = () => setTimeout(checkMobile, 150);
    window.addEventListener('orientationchange', onOrientationChange);
    return () => {
      window.removeEventListener('resize', checkMobile);
      window.removeEventListener('orientationchange', onOrientationChange);
    };
  }, []);

  return isMobile;
}
