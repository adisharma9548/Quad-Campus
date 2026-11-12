import { useEffect, useMemo, useRef, useState } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import { useApp } from '../context/AppContext';

export interface NotificationBellProps {
  onNavigate: (screen: string) => void;
}

const KIND_DESTINATION: Record<string, string> = {
  follow_request: 'requests',
  answer: 'feed',
  follow_accepted: 'discover',
};

export function NotificationBell({ onNavigate }: NotificationBellProps) {
  const { state, markNotificationsRead } = useApp();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const items = useMemo(() => state.notifications || [], [state.notifications]);
  const unread = useMemo(
    () => items.filter((n) => !(n.isRead ?? n.read)).length,
    [items]
  );

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [open]);

  const label =
    unread > 0 ? `Notifications, ${unread} unread` : 'Notifications, none unread';

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="relative min-h-[44px] min-w-[44px] rounded-full bg-canvas border border-ink/12 text-ink hover:bg-ink/8 transition-colors cursor-pointer flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <Bell size={20} aria-hidden="true" />
        {unread > 0 && (
          <span
            aria-hidden="true"
            className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full bg-accent text-canvas text-[11px] font-bold leading-5 text-center"
          >
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="absolute right-0 mt-2 w-[min(22rem,calc(100vw-2rem))] max-h-[70vh] overflow-y-auto bg-canvas rounded-[12px] border border-ink/12 z-50"
        >
          <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-ink/12">
            <p className="text-sm font-semibold text-ink">Notifications</p>
            <button
              type="button"
              disabled={unread === 0}
              onClick={() => void markNotificationsRead()}
              className="min-h-[44px] px-3 rounded-[8px] inline-flex items-center gap-2 text-xs font-semibold text-accent hover:bg-ink/8 disabled:text-ink/40 disabled:hover:bg-transparent cursor-pointer disabled:cursor-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <CheckCheck size={16} aria-hidden="true" />
              Mark all as read
            </button>
          </div>

          {items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-ink/60">
              You&apos;re all caught up. New replies and follow requests show up here.
            </p>
          ) : (
            <ul className="divide-y divide-ink/12">
              {items.map((n, index) => {
                const isUnread = !(n.isRead ?? n.read);
                const destination = KIND_DESTINATION[String(n.kind || n.type || '')];
                const text = n.title || n.message || n.text || 'New activity';
                const content = (
                  <>
                    <span
                      aria-hidden="true"
                      className={`mt-2 w-2 h-2 rounded-full shrink-0 ${isUnread ? 'bg-accent' : 'bg-transparent'}`}
                    />
                    <span className="min-w-0 text-left">
                      <span className={`block text-sm text-ink ${isUnread ? 'font-semibold' : ''}`}>
                        {text}
                      </span>
                      {n.timestamp && (
                        <span className="block text-xs text-ink/60 mt-1">{n.timestamp}</span>
                      )}
                    </span>
                  </>
                );
                return (
                  <li key={String(n.id ?? index)}>
                    {destination ? (
                      <button
                        type="button"
                        onClick={() => {
                          setOpen(false);
                          onNavigate(destination);
                        }}
                        className="w-full min-h-[44px] px-4 py-3 flex items-start gap-3 hover:bg-ink/6 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
                      >
                        {content}
                      </button>
                    ) : (
                      <div className="px-4 py-3 flex items-start gap-3">{content}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export default NotificationBell;
