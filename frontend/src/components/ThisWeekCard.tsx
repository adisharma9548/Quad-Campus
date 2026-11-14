import React from 'react';
import { Calendar } from 'lucide-react';
import { Card } from './ui';
import type { ThisWeekEvent } from '../types/quad';

export interface ThisWeekCardProps {
  items?: ThisWeekEvent[];
  compact?: boolean;
  onViewItem?: (item: ThisWeekEvent) => void;
  onViewAll?: () => void;
}

function parseEventDate(dateStr?: string): { month: string; day: string } {
  if (!dateStr) return { month: 'EVT', day: '•' };
  const match = dateStr.match(/(?:(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[,\s]+)?([A-Za-z]{3,9})[\s,]+(\d{1,2})/i);
  if (match) {
    return {
      month: match[1].slice(0, 3).toUpperCase(),
      day: match[2],
    };
  }
  const directMatch = dateStr.match(/([A-Za-z]{3})\s*(\d{1,2})/i);
  if (directMatch) {
    return {
      month: directMatch[1].toUpperCase(),
      day: directMatch[2],
    };
  }
  return { month: 'EVT', day: '•' };
}

export function ThisWeekCard({
  items = [],
  compact = false,
  onViewItem,
  onViewAll,
}: ThisWeekCardProps) {
  if (!items.length) return null;

  if (compact) {
    return (
      <Card
        padding={false}
        className="bg-canvas border border-ink/12 rounded-[12px] p-3 space-y-3"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Calendar size={16} strokeWidth={2} className="text-ink shrink-0" aria-hidden="true" />
            <h3 className="text-sm font-semibold text-ink font-sans">
              This week
            </h3>
          </div>
          {onViewAll && (
            <button
              type="button"
              onClick={onViewAll}
              className="text-xs font-semibold text-accent hover:underline cursor-pointer"
            >
              Calendar
            </button>
          )}
        </div>

        <div className="grid grid-cols-3 gap-3">
          {items.slice(0, 3).map((item) => (
            <div
              key={item.id}
              onClick={() => onViewItem?.(item)}
              className="p-2 rounded-[8px] bg-ink/6 border border-ink/12 flex flex-col justify-between gap-1 cursor-pointer hover:bg-ink/8 transition-colors"
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
                onClick={(e) => {
                  e.stopPropagation();
                  onViewItem?.(item);
                }}
                aria-label={`View ${item.title}`}
                className="text-xs font-semibold text-accent hover:underline text-left cursor-pointer"
              >
                View
              </button>
            </div>
          ))}
        </div>
      </Card>
    );
  }

  return (
    <div className="rounded-[12px] border border-ink/12 p-4 bg-canvas space-y-3">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-bold tracking-wider text-ink/60 uppercase">
          THIS WEEK
        </span>
        <button
          type="button"
          onClick={() => {
            if (onViewAll) onViewAll();
            else if (items[0]) onViewItem?.(items[0]);
          }}
          className="text-xs font-semibold text-accent hover:underline cursor-pointer"
        >
          Calendar
        </button>
      </div>

      <div className="space-y-3">
        {items.slice(0, 3).map((item) => {
          const { month, day } = parseEventDate(item.date);
          const timePart = item.date.includes('•') ? item.date.split('•')[1].trim() : item.date;
          const subText = item.location ? `${item.location} · ${timePart}` : item.date;

          return (
            <div
              key={item.id}
              onClick={() => onViewItem?.(item)}
              className="flex items-start gap-3 group cursor-pointer"
            >
              <div className="w-10 h-10 rounded-[8px] bg-ink/6 border border-ink/12 flex flex-col items-center justify-center flex-shrink-0">
                <span className="text-[10px] font-bold text-ink/60 leading-none">
                  {month}
                </span>
                <span className="text-sm font-display font-bold text-ink leading-tight">
                  {day}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-sm font-medium text-ink group-hover:text-accent truncate transition-colors leading-snug">
                  {item.title}
                </h4>
                <p className="text-xs text-ink/60 truncate mt-1">
                  {subText}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default ThisWeekCard;
