import React from 'react';
import {
  Compass,
  Play,
  Search,
  MessagesSquare,
  UserPlus,
  Bell,
  Lock,
  Sliders,
  LogOut,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';
import { Avatar } from './ui';
import type { UserProfile } from '../types/quad';
import type { AppState } from '../context/AppContext';
import type { InstitutionConfig } from '../context/ConfigContext';

export interface NavigationRailProps {
  currentScreen: string;
  unseenReelsCount?: number;
  followRequestCount?: number;
  notificationCount?: number;
  onNavigate: (screen: string) => void;
  user: UserProfile | null;
  state: AppState;
  institution: InstitutionConfig;
  onLogOut: () => Promise<void>;
  isPinned?: boolean;
  onTogglePin?: () => void;
  onOpenCreatePost?: () => void;
  onOpenCreateReel?: () => void;
  footer?: React.ReactNode;
  isReelsPage?: boolean;
}

interface NavItemDef {
  id: string;
  label: string;
  icon: LucideIcon;
  badge?: string | number | null;
}

export function NavigationRail({
  currentScreen,
  unseenReelsCount = 0,
  followRequestCount = 0,
  notificationCount = 0,
  onNavigate,
  user,
  state,
  institution: _institution,
  onLogOut,
  isReelsPage = false,
}: NavigationRailProps) {
  const currentUsername = user?.username || state.username || 'quantum_dev';
  const currentInitials = user?.avatarInitials || state.userInitials || 'QD';
  const currentUserHasUnseenReel = (state.reels || []).some(
    (r) => r.unseen && r.username === currentUsername
  );

  const branchYearLabel = [
    user?.branch || state.branch,
    (user?.year || state.year || '').replace(/\s*Year$/i, '') &&
      `${(user?.year || state.year || '').replace(/\s*Year$/i, '')} '26`,
  ]
    .filter(Boolean)
    .join(' · ');

  const navItems: NavItemDef[] = [
    { id: 'feed', label: 'Feed', icon: Compass },
    {
      id: 'reels',
      label: 'Reels',
      icon: Play,
      badge: unseenReelsCount > 0 ? 'dot' : null,
    },
    { id: 'discover', label: 'Directory', icon: Search },
    { id: 'threads', label: 'Threads', icon: MessagesSquare },
    {
      id: 'requests',
      label: 'Requests',
      icon: UserPlus,
      badge: followRequestCount > 0 ? followRequestCount : null,
    },
    {
      id: 'notifications',
      label: 'Notifications',
      icon: Bell,
      badge: notificationCount > 0 ? notificationCount : null,
    },
    { id: 'profile', label: 'Personal Space', icon: Lock },
    { id: 'settings', label: 'Settings', icon: Sliders },
  ];

  return (
    <aside
      aria-label="Sidebar Navigation"
      className={`hidden md:flex fixed top-16 left-0 bottom-0 z-50 w-[72px] hover:w-[240px] transition-all duration-300 ease-in-out bg-canvas border-r border-ink/12 group overflow-x-hidden flex-col justify-between py-4 px-3 select-none ${
        isReelsPage ? 'quad-aside--reels' : ''
      }`}
    >
      {/* Top Nav Items Rail */}
      <nav aria-label="Sidebar Navigation Items" className="flex flex-col space-y-1 w-full">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = currentScreen === item.id;
          const isReel = item.id === 'reels';
          const hasDot = isReel && unseenReelsCount > 0;
          const countBadge = typeof item.badge === 'number' && item.badge > 0 ? item.badge : null;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              title={item.label}
              className={`rounded-[8px] flex items-center h-11 px-3 w-full gap-3 transition-all flex-shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                active
                  ? 'bg-ink text-canvas font-medium'
                  : 'text-ink/55 hover:bg-ink/8 hover:text-ink'
              }`}
            >
              {/* Icon with potential collapsed badge */}
              <div className="relative flex items-center justify-center flex-shrink-0">
                <Icon size={20} strokeWidth={active ? 2.4 : 1.8} aria-hidden="true" />
                {hasDot && (
                  <span
                    aria-hidden="true"
                    className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-accent rounded-full"
                  />
                )}
                {countBadge && (
                  <span
                    aria-hidden="true"
                    className="absolute -top-1 -right-1.5 w-2 h-2 bg-accent rounded-full md:group-hover:hidden"
                  />
                )}
              </div>

              {/* Expanded Label & Pill Badge */}
              <div className="flex items-center justify-between w-full opacity-0 group-hover:opacity-100 transition-opacity duration-200 min-w-0">
                <span className="whitespace-nowrap text-sm font-medium truncate">
                  {item.label}
                </span>

                {hasDot && (
                  <span
                    aria-hidden="true"
                    className="w-1.5 h-1.5 bg-accent rounded-full shrink-0 ml-1"
                  />
                )}

                {countBadge && (
                  <span className="bg-accent text-canvas text-[11px] font-bold px-2 py-1 rounded-full shrink-0 ml-1">
                    {countBadge}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </nav>

      {/* Bottom Account Block (Dual-State: 40px icon collapsed / Profile panel expanded) */}
      <div className="pt-3 border-t border-ink/12 w-full">
        <button
          type="button"
          onClick={() => onNavigate('profile')}
          className="flex items-center gap-3 w-full overflow-hidden p-1 rounded-[8px] hover:bg-ink/4 transition-colors cursor-pointer text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {/* 40px Avatar */}
          <Avatar
            size={40}
            initials={currentInitials}
            username={currentUsername}
            hasUnseenReel={currentUserHasUnseenReel}
            className="flex-shrink-0"
          />

          {/* Expanded Profile Data */}
          <div className="flex-col min-w-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 hidden group-hover:flex">
            <div className="flex items-center gap-1">
              <span className="text-sm font-semibold text-ink truncate">
                @{currentUsername}
              </span>
              <ShieldCheck
                size={14}
                className="text-accent shrink-0"
                aria-hidden="true"
              />
            </div>
            <span className="text-xs text-ink/60 truncate">
              {branchYearLabel || 'Verified Peer'}
            </span>
          </div>
        </button>

        {/* Extended Quick Links in Expanded State */}
        <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 hidden group-hover:flex flex-col mt-2 space-y-1 pt-2 border-t border-ink/8">
          <button
            type="button"
            onClick={() => onNavigate('settings')}
            className="px-2 py-1 text-xs text-ink/70 hover:text-ink hover:bg-ink/6 rounded-[6px] flex items-center justify-between transition-colors cursor-pointer text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <span className="flex items-center gap-2">
              <Sliders size={16} className="shrink-0" aria-hidden="true" />
              <span>Settings & Privacy</span>
            </span>
          </button>
          <button
            type="button"
            onClick={async () => {
              await onLogOut();
              onNavigate('welcome');
            }}
            className="px-2 py-1 text-xs text-ink/70 hover:text-danger hover:bg-danger/8 rounded-[6px] flex items-center justify-between transition-colors cursor-pointer text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <span className="flex items-center gap-2">
              <LogOut size={16} className="shrink-0" aria-hidden="true" />
              <span>Log out</span>
            </span>
          </button>
        </div>
      </div>
    </aside>
  );
}

export default NavigationRail;
