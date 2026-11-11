import React, { useState, useRef, useEffect } from 'react';
import { Play, Eye } from 'lucide-react';
import { Skeleton } from './ui';
import { useTheme } from '../context/ThemeContext';
import type { ReelItem } from '../types/quad';

export function ReelThumbSkeleton() {
  return (
    <div
      role="listitem"
      className="w-[124px] sm:w-[144px] shrink-0 snap-start rounded-[10px] border border-ink/12 bg-canvas overflow-hidden"
      aria-hidden="true"
    >
      <div className="aspect-[3/4] w-full relative bg-ink/6 p-3 flex flex-col justify-between">
        <Skeleton variant="circle" width={40} height={40} className="m-auto" />
        <Skeleton variant="rect" height={34} className="w-full" />
      </div>
    </div>
  );
}

export interface ReelThumbProps {
  reel: ReelItem;
  onClick?: (reel: ReelItem) => void;
}

export function ReelThumb({ reel, onClick }: ReelThumbProps) {
  const { dark } = useTheme();
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const posterSrc = reel.posterUrl || (reel.posterKey
    ? `/media/reel-${reel.posterKey}-${dark ? 'dark' : 'light'}.svg`
    : null);
  const loaded = !posterSrc || loadedSrc === posterSrc;

  useEffect(() => {
    if (posterSrc && imgRef.current && imgRef.current.complete) {
      setLoadedSrc(posterSrc);
    }
  }, [posterSrc]);

  return (
    <button
      type="button"
      role="listitem"
      onClick={() => onClick?.(reel)}
      aria-label={`Play reel by @${reel.username}: ${reel.tag || 'campus clip'}, ${reel.views || '0'} views${reel.unseen ? ', unseen' : ''}`}
      className={`w-[124px] sm:w-[144px] shrink-0 snap-start rounded-[10px] overflow-hidden bg-ink/6 active:scale-[0.98] transition-colors duration-150 relative group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas text-left ${
        reel.unseen
          ? 'border-2 border-accent'
          : 'border border-ink/12 hover:border-ink/24'
      }`}
    >
      <div className="aspect-[3/4] w-full relative bg-ink/6">
        {posterSrc && !loaded && (
          <Skeleton variant="rect" className="w-full h-full absolute inset-0" />
        )}
        {posterSrc && (
          <img
            ref={imgRef}
            src={posterSrc}
            alt={reel.posterAlt || `${reel.tag || 'Campus'} reel poster by @${reel.username}`}
            onLoad={() => setLoadedSrc(posterSrc)}
            onError={() => setLoadedSrc(posterSrc)}
            className={`w-full h-full object-cover transition-opacity duration-250 ${
              loaded ? 'opacity-100' : 'opacity-0'
            }`}
          />
        )}

        {/* Centered Play Icon */}
        <div
          aria-hidden="true"
          className="absolute inset-0 bottom-10 flex items-center justify-center pointer-events-none"
        >
          <div className="w-10 h-10 rounded-full bg-canvas border border-ink/12 text-ink flex items-center justify-center group-hover:scale-105 transition-transform duration-150">
            <Play size={16} strokeWidth={2} className="text-ink" />
          </div>
        </div>

        {/* Bottom Label Strip */}
        <div className="absolute inset-x-0 bottom-0 px-2 py-2 bg-canvas border-t border-ink/12">
          <p className="text-xs font-semibold text-ink truncate leading-tight">
            @{reel.username}
          </p>
          <p className="text-[11px] text-ink/60 flex items-center gap-1 mt-1 leading-none">
            <Eye size={12} className="text-ink/60 shrink-0" aria-hidden="true" />
            <span>{reel.views || '1.2K'}</span>
          </p>
        </div>
      </div>
    </button>
  );
}

export default ReelThumb;
