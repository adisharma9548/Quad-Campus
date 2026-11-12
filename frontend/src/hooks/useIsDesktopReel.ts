import { useState, useEffect } from 'react';

export const DESKTOP_REEL_MEDIA_QUERY = '(min-width: 1024px) and (hover: hover) and (pointer: fine)';
export const DESKTOP_REEL_BROAD_QUERY =
  '(min-width: 1024px) and ((hover: hover) or (any-hover: hover)) and ((pointer: fine) or (any-pointer: fine))';

function getMatchesDesktopReel(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  if (window.matchMedia(DESKTOP_REEL_MEDIA_QUERY).matches) {
    return true;
  }
  // Accommodates touch-screen laptops with mouse/trackpad pointer
  return window.matchMedia(DESKTOP_REEL_BROAD_QUERY).matches;
}

/**
 * Returns true when running on a hover-capable desktop viewport (>= 1024px wide
 * with a fine pointer) so Reels uses the clean-video Part F layout instead of
 * the phone/tablet Part B overlay controls.
 */
export function useIsDesktopReel(): boolean {
  const [isDesktop, setIsDesktop] = useState<boolean>(getMatchesDesktopReel);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return undefined;
    }
    const strictQuery = window.matchMedia(DESKTOP_REEL_MEDIA_QUERY);
    const broadQuery = window.matchMedia(DESKTOP_REEL_BROAD_QUERY);

    const updateMatch = () => {
      setIsDesktop(strictQuery.matches || broadQuery.matches);
    };

    updateMatch();

    strictQuery.addEventListener?.('change', updateMatch);
    broadQuery.addEventListener?.('change', updateMatch);
    return () => {
      strictQuery.removeEventListener?.('change', updateMatch);
      broadQuery.removeEventListener?.('change', updateMatch);
    };
  }, []);

  return isDesktop;
}
