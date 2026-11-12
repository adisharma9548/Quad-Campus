import React, { useState, useEffect, useRef } from 'react';
import {
  Compass,
  Play,
  Search,
  MessagesSquare,
  UserPlus,
  Lock,
  Sliders,
  Info,
  type LucideIcon,
} from 'lucide-react';

interface SlimRailNavProps {
  currentScreen: string;
  unseenReelsCount?: number;
  followRequestCount?: number;
  onNavigate: (screen: string) => void;
  footer?: React.ReactNode;
}

interface RailEntry {
  id: string;
  label: string;
  icon: LucideIcon;
  hasDot?: boolean;
  dotTone?: 'accent' | 'coral';
}

export function SlimRailNav({
  currentScreen,
  unseenReelsCount = 0,
  followRequestCount = 0,
  onNavigate,
  footer,
}: SlimRailNavProps) {
  const [infoOpen, setInfoOpen] = useState(false);
  const infoRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!infoOpen) return undefined;
    const onPointerDown = (e: MouseEvent) => {
      if (infoRef.current && !infoRef.current.contains(e.target as Node)) {
        setInfoOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setInfoOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [infoOpen]);

  const items: RailEntry[] = [
    { id: 'feed', label: 'Feed', icon: Compass },
    {
      id: 'reels',
      label: 'Reels',
      icon: Play,
      hasDot: unseenReelsCount > 0,
      dotTone: 'accent',
    },
    { id: 'discover', label: 'Directory', icon: Search },
    { id: 'threads', label: 'Threads', icon: MessagesSquare },
    {
      id: 'requests',
      label: 'Requests',
      icon: UserPlus,
      hasDot: followRequestCount > 0,
      dotTone: 'coral',
    },
    { id: 'profile', label: 'Personal space', icon: Lock },
    { id: 'settings', label: 'Settings', icon: Sliders },
  ];

  const isLegalActive = currentScreen === 'terms' || currentScreen === 'safety';

  return (
    <div className="flex flex-col items-center justify-between h-full w-full">
      <nav aria-label="Reels primary navigation" className="flex flex-col items-center gap-2">
        {items.map((item) => {
          const Icon = item.icon;
          const active = currentScreen === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              aria-label={item.label}
              aria-current={active ? 'page' : undefined}
              className={`group relative w-12 h-12 min-h-[44px] rounded-full flex items-center justify-center transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                active
                  ? 'bg-ink text-canvas shadow-sm'
                  : 'text-ink/70 hover:text-ink hover:bg-ink/8'
              }`}
            >
              <Icon size={20} strokeWidth={active ? 2.2 : 1.8} aria-hidden="true" />
              {item.hasDot && (
                <span
                  aria-hidden="true"
                  className={`absolute top-2 right-2 w-2 h-2 rounded-full ${
                    item.dotTone === 'coral' ? 'bg-coral' : 'bg-accent'
                  }`}
                />
              )}
              <span
                role="tooltip"
                className="quad-slim-rail-tooltip px-3 py-1 rounded-[8px] bg-ink text-canvas text-xs font-semibold shadow-sm"
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>

      <div ref={infoRef} className="relative flex flex-col items-center">
        <button
          type="button"
          onClick={() => setInfoOpen((v) => !v)}
          aria-label="Legal & app info"
          aria-expanded={infoOpen}
          className={`group relative w-12 h-12 min-h-[44px] rounded-full flex items-center justify-center transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
            infoOpen || isLegalActive
              ? 'bg-ink text-canvas'
              : 'text-ink/60 hover:text-ink hover:bg-ink/8'
          }`}
        >
          <Info size={18} aria-hidden="true" />
          <span
            role="tooltip"
            className="quad-slim-rail-tooltip px-3 py-1 rounded-[8px] bg-ink text-canvas text-xs font-semibold shadow-sm"
          >
            Info &amp; Legal
          </span>
        </button>

        {infoOpen && (
          <div
            role="dialog"
            aria-label="Quad legal and version info"
            onClick={(e) => {
              const target = e.target as HTMLElement;
              if (target.closest('button, a')) {
                setInfoOpen(false);
              }
            }}
            className="quad-slim-info-popover absolute left-full bottom-0 ml-2 p-3 rounded-[12px] bg-canvas border border-ink/12 shadow-lg z-50 text-xs text-ink/70"
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
