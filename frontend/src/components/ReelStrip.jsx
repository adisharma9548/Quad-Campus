import React from 'react';
import { Film, ChevronRight } from 'lucide-react';
import { EmptyState } from './ui';
import { ReelThumb, ReelThumbSkeleton } from './ReelThumb';

export function ReelStrip({
  reels = [],
  isLoading = false,
  onSelectReel,
  onSeeAll,
}) {
  return (
    <section aria-labelledby="campus-reels-heading" className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2
          id="campus-reels-heading"
          className="text-base font-semibold text-ink font-sans tracking-tight"
        >
          Campus reels
        </h2>
        <button
          type="button"
          onClick={onSeeAll}
          className="min-h-[44px] px-2 inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline cursor-pointer rounded-[8px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <span>See all</span>
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      </div>

      {isLoading ? (
        <div
          role="list"
          aria-label="Loading campus reels"
          className="flex items-stretch gap-3 overflow-x-auto snap-x snap-mandatory pb-1 no-scrollbar"
        >
          {[1, 2, 3, 4].map((idx) => (
            <ReelThumbSkeleton key={idx} />
          ))}
        </div>
      ) : reels.length === 0 ? (
        <div className="rounded-[12px] border border-ink/12 bg-canvas">
          <EmptyState
            icon={Film}
            title="No reels yet. Be the first to post one."
            description="Short campus clips and lab demos from verified peers will appear here."
          />
        </div>
      ) : (
        <div
          role="list"
          aria-label="Campus reels"
          className="flex items-stretch gap-3 overflow-x-auto snap-x snap-mandatory pb-1 no-scrollbar focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-[10px]"
        >
          {reels.map((reel) => (
            <ReelThumb
              key={reel.id}
              reel={reel}
              onClick={() => onSelectReel?.(reel)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export default ReelStrip;
