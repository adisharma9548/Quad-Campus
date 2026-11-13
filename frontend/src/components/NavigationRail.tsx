import React, { useState, useEffect, useRef } from 'react';
import {
  Compass,
  Play,
  Search,
  MessagesSquare,
  UserPlus,
  Lock,
  Sliders,
  Pin,
  PinOff,
  Info,
  LogOut,
  ShieldCheck,
  ChevronRight,
  type LucideIcon,
} from 'lucide-react';
import { Avatar, Badge } from './ui';
import type { UserProfile } from '../types/quad';
import type { AppState } from '../context/AppContext';
import type { InstitutionConfig } from '../context/ConfigContext';

export interface NavigationRailProps {
  currentScreen: string;
  unseenReelsCount?: number;
  followRequestCount?: number;
  onNavigate: (screen: string) => void;
  user: UserProfile | null;
  state: AppState;
  institution: InstitutionConfig;
  onLogOut: () => Promise<void>;
  isPinned: boolean;
  onTogglePin: () => void;
  footer?: React.ReactNode;
  isReelsPage?: boolean;
}

interface NavItemDef {
  id: string;
  label: string;
  icon: LucideIcon;
  badge?: string | null;
  badgeVariant?: 'status' | 'accent' | 'count';
}

export function NavigationRail({
  currentScreen,
  unseenReelsCount = 0,
  followRequestCount = 0,
  onNavigate,
  user,
  state,
  institution,
  onLogOut,
  isPinned,
  onTogglePin,
  footer,
  isReelsPage: _isReelsPage = false,
}: NavigationRailProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);
  const infoRef = useRef<HTMLDivElement | null>(null);
  const hoverTimeoutRef = useRef<number | null>(null);

  const isExpanded = isPinned || isHovered;

  const currentUsername = user?.username || state.username || 'quantum_dev';
  const currentInitials = user?.avatarInitials || state.userInitials || 'QD';
  const currentUserHasUnseenReel = (state.reels || []).some(
    (r) => r.unseen && r.username === currentUsername
  );

  const branchYearLabel = [
    user?.branch || state.branch,
    (user?.year || state.year || '').replace(/\s*Year$/i, '') &&
      `${(user?.year || state.year || '').replace(/\s*Year$/i, '')} Year`,
  ]
    .filter(Boolean)
    .join(' • ');

  // Close menus on outside click or escape
  useEffect(() => {
    if (!accountMenuOpen && !infoOpen) return undefined;
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        accountMenuOpen &&
        accountMenuRef.current &&
        !accountMenuRef.current.contains(target)
      ) {
        setAccountMenuOpen(false);
      }
      if (infoOpen && infoRef.current && !infoRef.current.contains(target)) {
        setInfoOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setAccountMenuOpen(false);
        setInfoOpen(false);
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [accountMenuOpen, infoOpen]);

  const navItems: NavItemDef[] = [
    { id: 'feed', label: 'Feed', icon: Compass },
    {
      id: 'reels',
      label: 'Reels',
      icon: Play,
      badge: unseenReelsCount > 0 ? 'New' : null,
      badgeVariant: 'accent',
    },
    { id: 'discover', label: 'Directory', icon: Search },
    { id: 'threads', label: 'Threads', icon: MessagesSquare },
    {
      id: 'requests',
      label: 'Requests',
      icon: UserPlus,
      badge: followRequestCount > 0 ? String(followRequestCount) : null,
      badgeVariant: 'count',
    },
    { id: 'profile', label: 'Personal space', icon: Lock },
    { id: 'settings', label: 'Settings', icon: Sliders },
  ];

  const handleMouseEnter = () => {
    if (isPinned) return;
    if (hoverTimeoutRef.current) window.clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = window.setTimeout(() => {
      setIsHovered(true);
    }, 80);
  };

  const handleMouseLeave = () => {
    if (isPinned) return;
    if (hoverTimeoutRef.current) window.clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = window.setTimeout(() => {
      setIsHovered(false);
      setAccountMenuOpen(false);
      setInfoOpen(false);
    }, 120);
  };

  return (
    <aside
      aria-label="Campus navigation"
      className={`hidden md:block sticky top-0 self-start z-30 transition-all duration-200 ${
        isPinned ? 'w-[240px]' : 'w-[72px]'
      }`}
    >
      <div
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={`h-[100dvh] flex flex-col justify-between py-4 transition-all duration-200 bg-canvas border-r border-ink/12 select-none ${
          isExpanded ? 'w-[240px] px-3' : 'w-[72px] px-2 items-center'
        } ${
          !isPinned && isHovered
            ? 'absolute top-0 left-0 shadow-float z-40'
            : 'relative'
        }`}
      >
        {/* Navigation Route Items */}
        <div className="w-full shrink-0">
          <nav aria-label="Main menu" className="space-y-1 w-full">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = currentScreen === item.id;

              if (!isExpanded) {
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
                    {item.badge && (
                      <span
                        aria-hidden="true"
                        className={`absolute top-2 right-2 w-2 h-2 rounded-full ${
                          item.badgeVariant === 'accent' ? 'bg-accent' : 'bg-danger'
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
              }

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onNavigate(item.id)}
                  aria-current={active ? 'page' : undefined}
                  className={`w-full min-h-[44px] px-3 py-2 rounded-full text-sm flex items-center justify-between transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                    active
                      ? 'bg-ink text-canvas font-semibold shadow-sm'
                      : 'text-ink/70 hover:text-ink hover:bg-ink/8 font-medium'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Icon
                      size={20}
                      strokeWidth={active ? 2.2 : 1.8}
                      className="shrink-0"
                      aria-hidden="true"
                    />
                    <span className="truncate">{item.label}</span>
                  </div>

                  {item.badge && (
                    <span className="shrink-0">
                      <Badge
                        variant={item.badgeVariant || 'status'}
                        inverted={active && item.badgeVariant !== 'accent'}
                      >
                        {item.badge}
                      </Badge>
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Footer Area: User Account Button + Legal Info */}
        <div className="w-full shrink-0 pt-3 border-t border-ink/12 space-y-2">
          {/* User Account Button & Dropdown */}
          <div className="relative w-full" ref={accountMenuRef}>
            {!isExpanded ? (
              <button
                type="button"
                onClick={() => setAccountMenuOpen((prev) => !prev)}
                aria-label={`Account: @${currentUsername}`}
                aria-expanded={accountMenuOpen}
                className="group relative w-12 h-12 min-h-[44px] rounded-full flex items-center justify-center hover:bg-ink/8 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <Avatar
                  size={36}
                  initials={currentInitials}
                  username={currentUsername}
                  hasUnseenReel={currentUserHasUnseenReel}
                />
                <span
                  role="tooltip"
                  className="quad-slim-rail-tooltip px-3 py-1 rounded-[8px] bg-ink text-canvas text-xs font-semibold shadow-sm"
                >
                  @{currentUsername}
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setAccountMenuOpen((prev) => !prev)}
                aria-label="Account menu"
                aria-expanded={accountMenuOpen}
                className="w-full min-h-[44px] px-2 py-2 rounded-[12px] flex items-center gap-2 text-left hover:bg-ink/8 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <Avatar
                  size={36}
                  initials={currentInitials}
                  username={currentUsername}
                  hasUnseenReel={currentUserHasUnseenReel}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-ink truncate leading-tight">
                    @{currentUsername}
                  </p>
                  <p className="text-xs text-ink/60 truncate leading-tight mt-1">
                    {branchYearLabel || institution.appName}
                  </p>
                </div>
                <ChevronRight
                  size={16}
                  className={`text-ink/60 transition-transform duration-150 ${
                    accountMenuOpen ? 'rotate-90' : ''
                  }`}
                />
              </button>
            )}

            {/* Account Popover Menu */}
            {accountMenuOpen && (
              <div
                role="menu"
                aria-label="Account menu options"
                className="absolute left-full bottom-0 ml-2 w-64 bg-canvas rounded-[12px] border border-ink/12 shadow-float p-3 z-50 space-y-2 text-xs"
              >
                <div className="px-1 pb-2 border-b border-ink/12 space-y-1">
                  <p className="text-sm font-semibold text-ink truncate">
                    @{currentUsername}
                  </p>
                  {branchYearLabel && (
                    <p className="text-xs text-ink/60 truncate">{branchYearLabel}</p>
                  )}
                  <Badge variant="status" icon={ShieldCheck}>
                    {institution.networkLabel}
                  </Badge>
                </div>

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setAccountMenuOpen(false);
                    onNavigate('profile');
                  }}
                  className="w-full min-h-[44px] px-2 py-2 rounded-[8px] text-left text-xs font-semibold text-ink hover:bg-ink/8 flex items-center gap-2 cursor-pointer"
                >
                  <Lock size={16} />
                  <span>Personal space</span>
                </button>

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setAccountMenuOpen(false);
                    onNavigate('settings');
                  }}
                  className="w-full min-h-[44px] px-2 py-2 rounded-[8px] text-left text-xs font-semibold text-ink hover:bg-ink/8 flex items-center gap-2 cursor-pointer"
                >
                  <Sliders size={16} />
                  <span>Settings & Privacy</span>
                </button>

                <button
                  type="button"
                  role="menuitem"
                  onClick={async () => {
                    setAccountMenuOpen(false);
                    await onLogOut();
                    onNavigate('welcome');
                  }}
                  className="w-full min-h-[44px] px-2 py-2 rounded-[8px] text-left text-xs font-semibold text-danger hover:bg-ink/8 flex items-center gap-2 cursor-pointer"
                >
                  <LogOut size={16} />
                  <span>Log out</span>
                </button>
              </div>
            )}
          </div>

          {/* Rail Controls: Pin Toggle & Legal Info */}
          <div
            className={`relative flex items-center ${
              isExpanded ? 'justify-between px-2' : 'justify-center flex-col gap-1'
            }`}
          >
            <button
              type="button"
              onClick={onTogglePin}
              title={isPinned ? 'Unpin sidebar (collapse to rail)' : 'Pin sidebar open'}
              aria-label={isPinned ? 'Unpin sidebar' : 'Pin sidebar open'}
              aria-pressed={isPinned}
              className="group relative w-10 h-10 min-h-[40px] rounded-full flex items-center justify-center text-ink/60 hover:text-ink hover:bg-ink/8 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              {isPinned ? <PinOff size={18} /> : <Pin size={18} />}
              <span
                role="tooltip"
                className="quad-slim-rail-tooltip px-3 py-1 rounded-[8px] bg-ink text-canvas text-xs font-semibold shadow-sm"
              >
                {isPinned ? 'Unpin rail' : 'Pin rail open'}
              </span>
            </button>

            <div className="relative flex flex-col items-center" ref={infoRef}>
              <button
                type="button"
                onClick={() => setInfoOpen((prev) => !prev)}
                aria-label="Legal & app info"
                aria-expanded={infoOpen}
                className={`group relative w-10 h-10 min-h-[40px] rounded-full flex items-center justify-center transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                  infoOpen ? 'bg-ink text-canvas' : 'text-ink/60 hover:text-ink hover:bg-ink/8'
                }`}
              >
                <Info size={18} aria-hidden="true" />
                <span
                  role="tooltip"
                  className="quad-slim-rail-tooltip px-3 py-1 rounded-[8px] bg-ink text-canvas text-xs font-semibold shadow-sm"
                >
                  Info & Legal
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
                  className="absolute left-full bottom-0 ml-2 p-3 rounded-[12px] bg-canvas border border-ink/12 shadow-float z-50 text-xs text-ink/70 min-w-[200px]"
                >
                  {footer}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
