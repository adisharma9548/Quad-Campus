import React from 'react';
import { Calendar } from 'lucide-react';
import { Card } from './ui';

export function ThisWeekCard({ items = [], compact = false, onViewItem }) {
  if (!items.length) return null;

  return (
    <Card
      padding={false}
      className={`bg-canvas border border-ink/12 rounded-[12px] ${
        compact ? 'p-3' : 'p-4'
      } space-y-3`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Calendar size={16} strokeWidth={2} className="text-ink shrink-0" aria-hidden="true" />
          <h3 className="text-sm font-semibold text-ink font-sans">
            This week
          </h3>
        </div>
      </div>

      <div className={compact ? 'grid grid-cols-3 gap-3' : 'space-y-2'}>
        {items.slice(0, 3).map((item) => (
          <div
            key={item.id}
            className={`${
              compact
                ? 'p-2 rounded-[8px] bg-ink/6 border border-ink/12 flex flex-col justify-between gap-1'
                : 'flex items-center justify-between gap-2 py-1 border-b border-ink/12 last:border-b-0 last:pb-0'
            }`}
          >
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-medium text-ink/60 truncate">
                {item.date}
              </p>
              <p className="text-xs font-semibold text-ink truncate mt-1 leading-snug">
                {item.title}
              </p>
            </div>

            <button
              type="button"
              onClick={() => onViewItem?.(item)}
              aria-label={`View ${item.title}`}
              className="min-h-[44px] min-w-[44px] px-2 inline-flex items-center justify-end text-xs font-semibold text-accent hover:underline cursor-pointer rounded-[8px] shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              View
            </button>
          </div>
        ))}
      </div>
    </Card>
  );
}

export default ThisWeekCard;
