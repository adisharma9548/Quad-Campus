import React, { useState, useRef, useEffect } from 'react';
import { Eye, Film, Loader2 } from 'lucide-react';
import { Skeleton } from './ui';
import { resolveApiMediaUrl } from '../services/apiClient';
import { resolveReelDurationLabel } from '../utils/formatDuration';
import type { ReelItem } from '../types/quad';

export function ReelThumbSkeleton() {
  return (
    <div
      role="listitem"
      className="w-[116px] h-[188px] shrink-0 snap-start rounded-[12px] border border-ink/12 bg-ink/6 p-3 flex flex-col justify-between animate-pulse"
      aria-hidden="true"
    >
      <div className="flex items-center justify-between">
        <Skeleton variant="rect" width={32} height={16} className="rounded-full" />
        <Skeleton variant="rect" width={28} height={16} className="rounded-[4px]" />
      </div>
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Skeleton variant="circle" width={20} height={20} />
          <Skeleton variant="rect" width={56} height={10} className="rounded-[4px]" />
        </div>
        <Skeleton variant="rect" height={12} className="w-full rounded-[4px]" />
        <Skeleton variant="rect" width={36} height={10} className="rounded-[4px]" />
      </div>
    </div>
  );
}

export interface ReelThumbProps {
  reel: ReelItem;
  onClick?: (reel: ReelItem) => void;
}

export function ReelThumb({ reel, onClick }: ReelThumbProps) {
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const rawPoster = reel.coverUrl || reel.thumbnailUrl || reel.posterUrl || '';
  const posterSrc = rawPoster ? resolveApiMediaUrl(rawPoster) : null;
  const loaded = !posterSrc || loadedSrc === posterSrc;
  const durationLabel = resolveReelDurationLabel(reel);
  const isProcessing = reel.status === 'processing';
  const authorInitial = (reel.username || 'Q')[0].toUpperCase();

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
      className={`relative flex-shrink-0 w-[116px] h-[188px] rounded-[12px] overflow-hidden cursor-pointer group/card border bg-ink active:scale-[0.98] transition-all text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
        reel.unseen ? 'border-accent' : 'border-ink/12 hover:border-ink/24'
      }`}
    >
      {/* Background Poster Image */}
      {posterSrc && !loaded && (
        <Skeleton variant="rect" className="w-full h-full absolute inset-0" />
      )}
      {posterSrc ? (
        <img
          ref={imgRef}
          src={posterSrc}
          alt={reel.posterAlt || `${reel.tag || 'Campus'} reel cover by @${reel.username}`}
          onLoad={() => setLoadedSrc(posterSrc)}
          onError={() => setLoadedSrc(posterSrc)}
          className={`absolute inset-0 w-full h-full object-cover group-hover/card:scale-105 transition-transform duration-300 opacity-90 ${
            loaded ? 'opacity-90' : 'opacity-0'
          }`}
        />
      ) : (
        <div className="absolute inset-0 w-full h-full flex items-center justify-center bg-ink text-canvas/30">
          <Film size={28} aria-hidden="true" />
        </div>
      )}

      {/* Dark Scrim Gradient */}
      <div
        className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-black/30 pointer-events-none"
        aria-hidden="true"
      />

      {/* Top Status & Duration Row */}
      <div className="relative z-10 p-2 flex items-center justify-between w-full">
        {reel.unseen ? (
          <span className="inline-flex items-center px-1 py-1 rounded-full bg-accent text-canvas text-[9px] font-bold tracking-tight">
            NEW
          </span>
        ) : (
          <span className="px-1 py-1 rounded bg-black/60 text-canvas/90 text-[10px] font-medium">
            Watched
          </span>
        )}

        {isProcessing ? (
          <span className="px-1 py-1 rounded bg-black/60 backdrop-blur-sm text-canvas text-[10px] font-medium inline-flex items-center gap-1">
            <Loader2 size={10} className="animate-spin" aria-hidden="true" />
          </span>
        ) : durationLabel ? (
          <span className="px-1 py-1 rounded bg-black/60 backdrop-blur-sm text-canvas text-[10px] font-medium">
            {durationLabel}
          </span>
        ) : null}
      </div>

      {/* Bottom Overlay: Handle, Caption & Views */}
      <div className="absolute bottom-0 inset-x-0 p-2 z-10">
        <div className="flex items-center gap-1 mb-1">
          <div className="w-5 h-5 rounded-full bg-accent text-canvas flex items-center justify-center text-[10px] font-bold border border-canvas/60 flex-shrink-0">
            {authorInitial}
          </div>
          <span className="text-canvas text-[11px] font-semibold truncate leading-none">
            @{reel.username}
          </span>
        </div>

        <p className="text-canvas/90 text-[11px] line-clamp-1 leading-snug font-medium">
          {reel.tag || reel.caption || 'Campus clip'}
        </p>

        <div className="flex items-center gap-1 text-canvas/70 text-[10px] mt-1">
          <Eye size={12} aria-hidden="true" />
          <span>{reel.views ?? '0'}</span>
        </div>
      </div>
    </button>
  );
}

export default ReelThumb;
