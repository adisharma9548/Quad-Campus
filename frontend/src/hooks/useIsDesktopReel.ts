import { useState, useEffect } from 'react';

export const DESKTOP_REEL_MEDIA_QUERY = '(min-width: 1024px) and (hover: hover) and (pointer: fine)';

function getMatchesDesktopReel(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia(DESKTOP_REEL_MEDIA_QUERY).matches;
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
    const mediaQuery = window.matchMedia(DESKTOP_REEL_MEDIA_QUERY);
    const updateMatch = () => setIsDesktop(mediaQuery.matches);

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', updateMatch);
      return () => mediaQuery.removeEventListener('change', updateMatch);
    }
    return undefined;
  }, []);

  return isDesktop;
}
