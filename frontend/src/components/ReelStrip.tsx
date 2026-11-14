import React from 'react';
import { Play, ChevronRight, Plus, Video } from 'lucide-react';
import { ReelThumb, ReelThumbSkeleton } from './ReelThumb';
import type { ReelItem } from '../types/quad';

export interface ReelStripProps {
  reels?: ReelItem[];
  isLoading?: boolean;
  onSelectReel?: (reel: ReelItem) => void;
  onSeeAll?: () => void;
  onOpenCreateReel?: () => void;
}

export function ReelStrip({
  reels = [],
  isLoading = false,
  onSelectReel,
  onSeeAll,
  onOpenCreateReel,
}: ReelStripProps) {
  return (
    <section aria-label="Campus Reels" className="mb-6 pb-4 border-b border-ink/8">
      {/* Header Row */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <Play size={18} className="text-accent fill-accent" aria-hidden="true" />
          <h3 className="text-sm font-bold text-ink font-sans">Campus Reels</h3>
          <span className="px-2 py-1 rounded-full text-[10px] font-semibold bg-accent/10 text-accent uppercase tracking-tight">
            LIVE DISPATCHES
          </span>
        </div>
        <button
          type="button"
          onClick={onSeeAll}
          className="text-xs font-semibold text-accent hover:underline flex items-center gap-1 cursor-pointer"
        >
          <span>Watch all</span>
          <ChevronRight size={14} aria-hidden="true" />
        </button>
      </div>

      {/* Horizontal Cards Reel Container */}
      <div className="relative">
        <div className="flex items-center gap-3 overflow-x-auto pb-2 no-scrollbar">
          {/* 1. Create Reel Card */}
          <div
            onClick={onOpenCreateReel}
            className="flex-shrink-0 w-[116px] h-[188px] rounded-[12px] border-2 border-dashed border-ink/20 hover:border-accent bg-ink/2 hover:bg-accent/5 cursor-pointer transition-all flex flex-col justify-between p-3 group/create active:scale-[0.98]"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onOpenCreateReel?.();
              }
            }}
            aria-label="Create new campus reel"
          >
            <div className="w-9 h-9 rounded-full bg-canvas border border-ink/12 flex items-center justify-center text-accent group-hover/create:bg-accent group-hover/create:text-canvas transition-colors">
              <Video size={18} aria-hidden="true" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1 text-xs font-bold text-ink group-hover/create:text-accent mb-1">
                <Plus size={14} aria-hidden="true" />
                <span>Create Reel</span>
              </div>
              <p className="text-[10px] text-ink/50 leading-tight">
                Record lab demo or clip
              </p>
            </div>
          </div>

          {/* Skeletons or Reel Items */}
          {isLoading ? (
            <>
              {[1, 2, 3, 4].map((idx) => (
                <ReelThumbSkeleton key={idx} />
              ))}
            </>
          ) : (
            reels.map((reel) => (
              <ReelThumb
                key={reel.id}
                reel={reel}
                onClick={() => onSelectReel?.(reel)}
              />
            ))
          )}
        </div>
      </div>
    </section>
  );
}

export default ReelStrip;
