import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { useInstitution } from './context/ConfigContext';
import { NotificationBell } from './components/NotificationBell';
import { AppProvider, useApp } from './context/AppContext';
import { ToastProvider } from './context/ToastContext';

// Screens - Auth & Onboarding
import WelcomeScreen from './screens/auth/WelcomeScreen';
import SignUpScreen from './screens/auth/SignUpScreen';
import LoginScreen from './screens/auth/LoginScreen';
import ForgotPasswordScreen from './screens/auth/ForgotPasswordScreen';
import SplashScreen from './screens/SplashScreen';
import EduVerifyScreen from './screens/EduVerifyScreen';
import OnboardingScreen from './screens/OnboardingScreen';

// Screens - Core Features
import PublicFeedScreen from './screens/PublicFeedScreen';
import ReelsScreen from './screens/ReelsScreen';
import ThreadsScreen from './screens/ThreadsScreen';
import CreatePostScreen from './screens/CreatePostScreen';
import PersonalSpaceScreen from './screens/PersonalSpaceScreen';
import FollowRequestsScreen from './screens/FollowRequestsScreen';
import DiscoverScreen from './screens/DiscoverScreen';
import SettingsScreen from './screens/SettingsScreen';
import BlockReportScreen from './screens/BlockReportScreen';
import SafetyCenterScreen from './screens/SafetyCenterScreen';
import TermsPrivacyScreen from './screens/TermsPrivacyScreen';
import DesignSystemScreen from './screens/DesignSystemScreen';
import AdminRouteGuard from './components/AdminRouteGuard';
import NotFoundPage from './screens/NotFoundPage';

import { QuadLogo } from './components/QuadLogo';
import { Avatar, Badge, Modal, Spinner } from './components/ui';
import { NavigationRail } from './components/NavigationRail';
import { ThisWeekCard } from './components/ThisWeekCard';
import { PeerProfileModal } from './components/PeerProfileModal';
import { CreatePostModal } from './screens/CreatePostScreen';
import CreateReelModal from './components/CreateReelModal';
import { parseLocation, buildShareUrl } from './utils/shareUrl';

import {
  Compass,
  Play,
  Film,
  MessagesSquare,
  Search,
  PenSquare,
  Lock,
  UserPlus,
  ShieldCheck,
  ShieldAlert,
  Sliders,
  FileText,
  Layers,
  Sparkles,
  GraduationCap,
  UserCheck,
  ChevronDown,
  RotateCcw,
  ArrowRight,
  LogIn,
  LogOut,
  KeyRound,
  User,
  Plus,
  Check,
  Calendar,
  MapPin,
  type LucideIcon,
} from 'lucide-react';
import type { PeerUser, ThisWeekEvent } from './types/quad';

interface ScreenComponentProps {
  onNavigate: (
    screen: string,
    params?: {
      reel?: string | number;
      post?: string | number;
      user?: string;
      thread?: string | number;
      tab?: string;
      q?: string;
    }
  ) => void;
  onNext: (screen?: string) => void;
  onBack: () => void;
  onViewWeekItem?: (item: ThisWeekEvent) => void;
  onOpenCreateReel?: () => void;
  onOpenPeerProfile?: (username: string, fallbackPeer?: PeerUser) => void;
  initialReelId?: string | number | null;
  targetPostId?: string | number | null;
  targetThreadId?: string | number | null;
  initialTab?: string | null;
}

interface ScreenConfig {
  comp: React.ComponentType<ScreenComponentProps>;
  label: string;
  icon: LucideIcon;
  category: string;
  badge?: string | null;
  isAuth?: boolean;
  isSubView?: boolean;
}

const SCREENS: Record<string, ScreenConfig> = {
  feed: {
    comp: PublicFeedScreen,
    label: 'Public Feed',
    icon: Compass,
    category: 'Campus Spaces',
    badge: null,
  },
  discover: {
    comp: DiscoverScreen,
    label: 'Campus Directory',
    icon: Search,
    category: 'Campus Spaces',
    badge: 'Opt-in',
  },
  reels: {
    comp: ReelsScreen,
    label: 'Campus Reels',
    icon: Film,
    category: 'Campus Spaces',
    badge: 'New',
  },
  threads: {
    comp: ThreadsScreen,
    label: 'Discussions & Threads',
    icon: MessagesSquare,
    category: 'Campus Spaces',
    badge: null,
  },
  create: {
    comp: CreatePostScreen,
    label: 'Create Post',
    icon: PenSquare,
    category: 'Personal Vault',
    badge: null,
  },
  profile: {
    comp: PersonalSpaceScreen,
    label: 'Personal Space',
    icon: Lock,
    category: 'Personal Vault',
    badge: 'Private',
  },
  requests: {
    comp: FollowRequestsScreen,
    label: 'Follow Requests',
    icon: UserPlus,
    category: 'Personal Vault',
    badge: '4',
  },
  safety: {
    comp: SafetyCenterScreen,
    label: 'Safety Center & FAQ',
    icon: ShieldCheck,
    category: 'Safety & Trust',
    badge: null,
  },
  blockreport: {
    comp: BlockReportScreen,
    label: 'Block & Moderation',
    icon: ShieldAlert,
    category: 'Safety & Trust',
    badge: null,
  },
  settings: {
    comp: SettingsScreen,
    label: 'Privacy Settings',
    icon: Sliders,
    category: 'Safety & Trust',
    badge: null,
  },
  terms: {
    comp: TermsPrivacyScreen,
    label: 'Terms & Privacy Policy',
    icon: FileText,
    category: 'Governance',
    badge: 'Nov 2026',
  },
  designsystem: {
    comp: DesignSystemScreen,
    label: 'Design System Spec',
    icon: Layers,
    category: 'System',
    badge: 'Tokens',
  },
  // Auth & Onboarding Flow
  welcome: {
    comp: WelcomeScreen,
    label: 'Welcome to Quad',
    icon: Sparkles,
    category: 'Auth Onboarding',
    isAuth: true,
  },
  signup: {
    comp: SignUpScreen,
    label: 'Sign Up (Stepper)',
    icon: UserPlus,
    category: 'Auth Onboarding',
    isAuth: true,
  },
  login: {
    comp: LoginScreen,
    label: 'Log In',
    icon: LogIn,
    category: 'Auth Onboarding',
    isAuth: true,
  },
  forgot_password: {
    comp: ForgotPasswordScreen,
    label: 'Forgot Password',
    icon: KeyRound,
    category: 'Auth Onboarding',
    isAuth: true,
  },
  // Legacy Walkthrough Demo Screens
  splash: {
    comp: SplashScreen,
    label: 'Legacy Splash Demo',
    icon: Sparkles,
    category: 'Auth Onboarding',
    isAuth: true,
  },
  verify: {
    comp: EduVerifyScreen,
    label: 'Legacy Edu Verify Demo',
    icon: GraduationCap,
    category: 'Auth Onboarding',
    isAuth: true,
  },
  onboarding: {
    comp: OnboardingScreen,
    label: 'Legacy Identity Setup Demo',
    icon: UserCheck,
    category: 'Auth Onboarding',
    isAuth: true,
  },
};

// Public unauthenticated screens
const PUBLIC_SCREENS = [
  'welcome',
  'signup',
  'login',
  'forgot_password',
  'terms',
  'safety',
  'designsystem',
  'splash',
  'verify',
  'onboarding',
];

const APP_VERSION = '2.7.0';

// Auth flow screens for unauthenticated users
const AUTH_GUEST_SCREENS = ['welcome', 'signup', 'login', 'forgot_password'];

function AppShell() {
  const { user, isAuthenticated, isLoading, logOut } = useAuth();
  const institution = useInstitution();
  const initialRoute = useMemo(() => parseLocation(), []);
  const [currentPath, setCurrentPath] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.location.pathname;
    }
    return '/';
  });
  const [currentScreen, setCurrentScreen] = useState(() => initialRoute.screen || 'welcome');
  const [deepLinkReelId, setDeepLinkReelId] = useState<string | null>(initialRoute.reelId || null);
  const [deepLinkPostId, setDeepLinkPostId] = useState<string | null>(initialRoute.postId || null);
  const [deepLinkThreadId, setDeepLinkThreadId] = useState<string | null>(initialRoute.threadId || null);
  const [_deepLinkUsername, setDeepLinkUsername] = useState<string | null>(initialRoute.username || null);
  const [deepLinkTab, setDeepLinkTab] = useState<string | null>(initialRoute.tab || null);
  const [_history, setHistory] = useState<string[]>(['welcome']);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const [postMenuOpen, setPostMenuOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isCreateReelModalOpen, setIsCreateReelModalOpen] = useState(false);
  const postMenuRef = useRef<HTMLDivElement | null>(null);
  const [selectedWeekItem, setSelectedWeekItem] = useState<ThisWeekEvent | null>(null);
  const [requestedPeerIds, setRequestedPeerIds] = useState<Set<string | number>>(() => new Set());
  const [selectedProfilePeer, setSelectedProfilePeer] = useState<PeerUser | null>(null);
  const [reelsControlsVisible, setReelsControlsVisible] = useState(true);
  const [isSidebarPinned, setIsSidebarPinned] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('quad_sidebar_pinned');
      if (stored !== null) {
        return stored === 'true';
      }
      return window.innerWidth >= 1280;
    }
    return true;
  });

  const toggleSidebarPin = useCallback(() => {
    setIsSidebarPinned((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem('quad_sidebar_pinned', String(next));
      }
      return next;
    });
  }, []);

  const { state, markReelsSeen, requestFollow } = useApp();
  const showDevSwitcher =
    import.meta.env.DEV &&
    (import.meta.env.VITE_DEV_SWITCHER === 'true' ||
      (typeof window !== 'undefined' && window.location.search.includes('dev=1')));
  const unseenReelsCount = (state.reels || []).filter((r) => r.unseen).length;
  const followRequestCount = (state.followRequests || []).length;
  const currentUsername = user?.username || state.username || 'quantum_dev';
  const currentInitials = user?.avatarInitials || state.userInitials || 'QD';
  const currentUserHasUnseenReel = (state.reels || []).some(
    (r) => r.unseen && r.username === currentUsername
  );

  // Close header + Post dropdown on outside click or Escape
  useEffect(() => {
    if (!postMenuOpen) return undefined;
    const onDown = (e: MouseEvent) => {
      if (postMenuRef.current && !postMenuRef.current.contains(e.target as Node)) {
        setPostMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPostMenuOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [postMenuOpen]);

  // Listen to browser navigation popstate
  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
      const parsed = parseLocation();
      setCurrentScreen(parsed.screen);
      setDeepLinkReelId(parsed.reelId || null);
      setDeepLinkPostId(parsed.postId || null);
      setDeepLinkThreadId(parsed.threadId || null);
      setDeepLinkUsername(parsed.username || null);
      setDeepLinkTab(parsed.tab || null);

      if (parsed.username && parsed.username !== currentUsername) {
        setSelectedProfilePeer({
          id: parsed.username,
          username: parsed.username,
          initials: parsed.username.slice(0, 2).toUpperCase(),
          branch: null,
          year: null,
        });
      } else if (!parsed.username) {
        setSelectedProfilePeer(null);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [currentUsername]);

  // Sync Reels mobile tabbar visibility with Reels player controls
  useEffect(() => {
    const onControlsEvent = (event: Event) => {
      const custom = event as CustomEvent<boolean>;
      setReelsControlsVisible(Boolean(custom.detail));
    };
    window.addEventListener('quad:reels-controls-visible', onControlsEvent as EventListener);
    return () => {
      window.removeEventListener('quad:reels-controls-visible', onControlsEvent as EventListener);
    };
  }, []);

  const navigateToPath = (path: string) => {
    if (typeof window !== 'undefined' && window.history) {
      window.history.pushState({}, '', path);
      setCurrentPath(path);
    }
  };

  // Route Guards
  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated && !PUBLIC_SCREENS.includes(currentScreen)) {
      setCurrentScreen('welcome');
      setHistory(['welcome']);
    } else if (isAuthenticated && AUTH_GUEST_SCREENS.includes(currentScreen)) {
      setCurrentScreen('feed');
      setHistory(['feed']);
    }
  }, [isAuthenticated, isLoading, currentScreen]);

  const navigate = (
    screen: string,
    params?: {
      reel?: string | number;
      post?: string | number;
      user?: string;
      thread?: string | number;
      tab?: string;
      q?: string;
    }
  ) => {
    if (screen === 'create') {
      setIsCreateModalOpen(true);
      setSwitcherOpen(false);
      setAvatarMenuOpen(false);
      return;
    }
    if (screen === 'reels') {
      markReelsSeen();
    }

    setDeepLinkReelId(params?.reel ? String(params.reel) : null);
    setDeepLinkPostId(params?.post ? String(params.post) : null);
    setDeepLinkThreadId(params?.thread ? String(params.thread) : null);
    setDeepLinkTab(params?.tab || null);
    setDeepLinkUsername(params?.user || null);

    if (params?.user && params.user !== currentUsername) {
      setSelectedProfilePeer({
        id: params.user,
        username: params.user,
        initials: params.user.slice(0, 2).toUpperCase(),
        branch: null,
        year: null,
      });
    }

    const newUrl = buildShareUrl({
      screen,
      type: params?.reel
        ? 'reel'
        : params?.post
        ? 'post'
        : params?.user
        ? 'user'
        : params?.thread
        ? 'thread'
        : undefined,
      id: params?.reel || params?.post || params?.thread,
      username: params?.user,
      tab: params?.tab,
      q: params?.q,
    });

    if (typeof window !== 'undefined' && window.history) {
      window.history.pushState({}, '', newUrl);
      setCurrentPath(window.location.pathname);
    }

    setHistory((prev) => [...prev, screen]);
    setCurrentScreen(screen);
    setSwitcherOpen(false);
    setAvatarMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const goBack = () => {
    const fallback = isAuthenticated ? 'feed' : 'welcome';
    if (currentPath === '/terms' || currentPath === '/privacy' || currentPath === '/safety') {
      navigateToPath('/');
    }
    if (_history.length <= 1) {
      setCurrentScreen(fallback);
      setHistory([fallback]);
      return;
    }
    const newHistory = _history.slice(0, -1);
    const prevScreen = newHistory[newHistory.length - 1] || fallback;
    setHistory(newHistory);
    setCurrentScreen(prevScreen);
  };

  const restartFlow = () => {
    setHistory(['splash']);
    setCurrentScreen('splash');
    setSwitcherOpen(false);
    setAvatarMenuOpen(false);
  };

  const togglePeerRequest = async (peer: PeerUser) => {
    setRequestedPeerIds((prev) => {
      const next = new Set(prev);
      next.add(peer.id);
      return next;
    });
    if (requestFollow && peer?.username) {
      await requestFollow(peer.username);
    }
  };

  const CurrentComponent = SCREENS[currentScreen]?.comp || PublicFeedScreen;
  const isAuthScreen = SCREENS[currentScreen]?.isAuth;
  const isReelsPage = currentScreen === 'reels' && isAuthenticated && !isAuthScreen;

  const spotlightPeers = useMemo(() => {
    const source = (state.whoToFollow && state.whoToFollow.length > 0
      ? state.whoToFollow
      : state.discoverableUsers) || [];
    const seen = new Set<string>();
    const followingSet = new Set((state.following || []).map((f) => f.username.toLowerCase()));
    const blockedSet = new Set((state.blockedUsers || []).map((b) => b.username.toLowerCase()));
    const incomingReqSet = new Set((state.followRequests || []).map((r) => r.username.toLowerCase()));
    const selfHandle = currentUsername.toLowerCase();

    return source
      .filter((u) => {
        const handle = (u.username || '').toLowerCase();
        if (!handle || seen.has(handle)) return false;
        seen.add(handle);
        if (handle === selfHandle) return false;
        if (u.directoryVisible === false || u.discoverable === false) return false;
        if (u.isFollowing || followingSet.has(handle)) return false;
        if (u.isRequested || requestedPeerIds.has(u.id) || incomingReqSet.has(handle)) return false;
        if (blockedSet.has(handle)) return false;
        return true;
      })
      .slice(0, 3);
  }, [
    state.whoToFollow,
    state.discoverableUsers,
    state.following,
    state.blockedUsers,
    state.followRequests,
    currentUsername,
    requestedPeerIds,
  ]);

  const trendingTopics =
    state.trendingTopics && state.trendingTopics.length > 0
      ? state.trendingTopics
      : [
          { tag: '#EndSemPrep', posts: 12 },
          { tag: '#HackathonTeams', posts: 8 },
          { tag: '#RoboticsLab', posts: 5 },
          { tag: '#Algorithms', posts: 4 },
        ];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-canvas text-ink flex flex-col items-center justify-center p-4">
        <QuadLogo size={64} className="animate-pulse mb-4" />
        <Spinner size="md" />
        <p className="text-xs text-ink/60 mt-3 font-medium">Verifying campus session...</p>
      </div>
    );
  }

  const normalizedPath =
    currentPath.length > 1 ? currentPath.replace(/\/+$/, '') : currentPath;

  // Stealth Route Guard for /admin endpoint
  if (normalizedPath === '/admin') {
    return (
      <AdminRouteGuard
        onNavigate={(screen) => {
          navigateToPath('/');
          navigate(screen);
        }}
      />
    );
  }

  // Standard 404 for unknown or non-existent URLs
  if (
    normalizedPath !== '/' &&
    normalizedPath !== '' &&
    normalizedPath !== '/index.html' &&
    normalizedPath !== '/terms' &&
    normalizedPath !== '/privacy' &&
    normalizedPath !== '/safety'
  ) {
    return (
      <NotFoundPage
        onNavigate={(screen: string) => {
          navigateToPath('/');
          navigate(screen);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-canvas text-ink transition-colors duration-250 flex flex-col font-sans antialiased">
      {/* ═══════════ GLOBAL WEB TOPBAR ═══════════ */}
      <header
        className={
          isReelsPage
            ? 'quad-floating-header--reels px-4 lg:px-6 py-3'
            : 'fixed top-0 left-0 right-0 h-16 px-6 flex items-center justify-between bg-canvas z-40 border-b border-ink/12'
        }
      >
        <div className="flex items-center gap-3">
          {/* Brand Anchor: Quad Logo + Quad Wordmark + Campus Node Badge */}
          <button
            type="button"
            onClick={() => navigate(isAuthenticated ? 'feed' : 'welcome')}
            className="min-h-[44px] flex items-center gap-3 text-left cursor-pointer rounded-[8px] pr-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <QuadLogo size={32} />
            <span className="font-display font-bold text-xl tracking-tight text-ink leading-none">
              Quad
            </span>
          </button>
          <span className="hidden md:inline-flex items-center px-2 py-1 rounded-full text-[11px] font-medium bg-ink/6 text-ink/60 ml-1 border border-ink/8">
            {institution.networkLabel || 'North Campus Node'}
          </span>
        </div>

        {/* Center Screen Switcher Menu (Gated strictly on explicit dev flag) */}
        {showDevSwitcher && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setSwitcherOpen(!switcherOpen)}
              className="min-h-[44px] flex items-center gap-2 px-3 py-2 rounded-full bg-canvas border border-ink/12 hover:border-ink/24 text-xs font-semibold text-ink transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <span>Screen: {SCREENS[currentScreen]?.label}</span>
              <ChevronDown
                size={16}
                className={`transition-transform duration-150 text-ink/60 ${
                  switcherOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {switcherOpen && (
              <div className="absolute top-full right-0 sm:left-1/2 sm:-translate-x-1/2 mt-2 w-72 sm:w-80 bg-canvas rounded-[12px] border border-ink/12 p-3 z-50 max-h-[480px] overflow-y-auto scrollbar-hover">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-ink/12 px-1">
                  <p className="text-xs font-bold uppercase tracking-wider text-ink/60">
                    Jump to Screen (Dev)
                  </p>
                  <button
                    type="button"
                    onClick={restartFlow}
                    className="min-h-[44px] px-2 text-xs text-accent font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw size={16} />
                    <span>Restart</span>
                  </button>
                </div>

                <div className="space-y-1">
                  {Object.entries(SCREENS).map(([key, item]) => {
                    const isActive = currentScreen === key;
                    const IconComp = item.icon || Compass;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => navigate(key)}
                        className={`w-full min-h-[44px] text-left px-3 py-2 rounded-[8px] text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer ${
                          isActive
                            ? 'bg-ink text-canvas'
                            : 'text-ink/60 hover:text-ink hover:bg-ink/8'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <IconComp size={16} className={isActive ? 'text-canvas' : 'text-ink/60'} />
                          <span>{item.label}</span>
                        </div>
                        {item.badge && (
                          <Badge variant="status" inverted={isActive}>
                            {item.badge}
                          </Badge>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Right Controls: Notification bell & Primary Solid Pill Action */}
        <div className="flex items-center gap-3">
          {!isAuthenticated ? (
            <>
              <button
                type="button"
                onClick={() => navigate('login')}
                className="min-h-[44px] px-4 py-2 rounded-full border border-ink/12 bg-canvas text-ink text-xs font-semibold hover:bg-ink/8 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                Log in
              </button>
              <button
                type="button"
                onClick={() => navigate('signup')}
                className="min-h-[44px] px-4 py-2 rounded-full bg-accent text-canvas text-xs font-semibold hover:brightness-90 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                Sign up
              </button>
            </>
          ) : (
            <>
              {/* Notification Bell */}
              <NotificationBell onNavigate={navigate} />

              {/* Mobile-only avatar menu */}
              <div className="relative md:hidden">
                <button
                  type="button"
                  onClick={() => setAvatarMenuOpen((prev) => !prev)}
                  aria-label={`${currentInitials}, account menu`}
                  aria-expanded={avatarMenuOpen}
                  className="min-h-[44px] min-w-[44px] rounded-full flex items-center justify-center hover:bg-ink/8 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <Avatar
                    initials={currentInitials}
                    username={currentUsername}
                    hasUnseenReel={currentUserHasUnseenReel}
                    size={36}
                  />
                </button>

                {avatarMenuOpen && (
                  <div
                    role="menu"
                    aria-label="Account menu"
                    className="absolute right-0 mt-2 w-60 bg-canvas rounded-[12px] border border-ink/12 shadow-float p-3 z-50 space-y-2"
                  >
                    <div className="px-2 pb-2 border-b border-ink/12 space-y-1">
                      <p className="text-sm font-semibold text-ink truncate">
                        @{currentUsername}
                      </p>
                      <p className="text-xs text-ink/60 truncate">
                        {[user?.branch || state.branch, (user?.year || state.year || '').replace(/\s*Year$/i, '') && `${(user?.year || state.year || '').replace(/\s*Year$/i, '')} Year`].filter(Boolean).join(' • ')}
                      </p>
                      <Badge variant="status" icon={ShieldCheck}>
                        {institution.networkLabel}
                      </Badge>
                    </div>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => navigate('profile')}
                      className="w-full min-h-[44px] px-2 py-2 rounded-[8px] text-left text-xs font-semibold text-ink hover:bg-ink/8 flex items-center gap-2 cursor-pointer"
                    >
                      <Lock size={16} />
                      <span>Personal space</span>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => navigate('settings')}
                      className="w-full min-h-[44px] px-2 py-2 rounded-[8px] text-left text-xs font-semibold text-ink hover:bg-ink/8 flex items-center gap-2 cursor-pointer"
                    >
                      <Sliders size={16} />
                      <span>Settings & Privacy</span>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={async () => {
                        setAvatarMenuOpen(false);
                        await logOut();
                        navigate('welcome');
                      }}
                      className="w-full min-h-[44px] px-2 py-2 rounded-[8px] text-left text-xs font-semibold text-danger hover:bg-ink/8 flex items-center gap-2 cursor-pointer"
                    >
                      <LogOut size={16} />
                      <span>Log out</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Primary Action: Solid Blue + Post with Dropdown Segment */}
              <div className="relative hidden md:block" ref={postMenuRef}>
                <div className="inline-flex rounded-[8px] bg-accent overflow-hidden min-h-[44px]">
                  <button
                    type="button"
                    onClick={() => {
                      setPostMenuOpen(false);
                      setIsCreateModalOpen(true);
                    }}
                    className="flex items-center gap-2 px-4 py-2 text-canvas text-sm font-medium hover:brightness-95 active:scale-[0.98] transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-canvas"
                  >
                    <Plus size={18} strokeWidth={2.5} aria-hidden="true" />
                    <span>Post</span>
                  </button>
                  <button
                    type="button"
                    aria-label="Create reel or thread"
                    aria-haspopup="menu"
                    aria-expanded={postMenuOpen}
                    onClick={() => {
                      setPostMenuOpen((prev) => !prev);
                      setAvatarMenuOpen(false);
                      setSwitcherOpen(false);
                    }}
                    className="px-2 py-2 text-canvas/90 hover:text-canvas hover:brightness-95 border-l border-canvas/20 flex items-center justify-center active:scale-[0.98] transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-canvas"
                  >
                    <ChevronDown size={18} aria-hidden="true" className={postMenuOpen ? 'rotate-180 transition-transform' : 'transition-transform'} />
                  </button>
                </div>

                {postMenuOpen && (
                  <div
                    role="menu"
                    aria-label="Create content menu"
                    className="absolute right-0 mt-2 w-44 bg-canvas rounded-[12px] border border-ink/12 p-1 z-50 shadow-lg space-y-1"
                  >
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setPostMenuOpen(false);
                        setIsCreateModalOpen(true);
                      }}
                      className="w-full min-h-[40px] px-3 py-2 rounded-[8px] text-left text-xs font-semibold text-ink hover:bg-ink/8 flex items-center gap-2 cursor-pointer"
                    >
                      <PenSquare size={15} />
                      <span>Post</span>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setPostMenuOpen(false);
                        setIsCreateReelModalOpen(true);
                      }}
                      className="w-full min-h-[40px] px-3 py-2 rounded-[8px] text-left text-xs font-semibold text-ink hover:bg-ink/8 flex items-center gap-2 cursor-pointer"
                    >
                      <Film size={15} />
                      <span>Reel</span>
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </header>

      {/* ═══════════ MAIN CONTENT BODY ═══════════ */}
      <div className={isReelsPage ? 'flex-1 w-full mx-0 px-0 py-0' : 'flex-1 w-full'}>
        {/* If viewing Auth Screens, display centered web layout */}
        {isAuthScreen ? (
          ['welcome', 'signup', 'login', 'forgot_password'].includes(currentScreen) ? (
            <div className="w-full quad-auth-page-wrapper">
              <CurrentComponent
                onNext={(screen?: string) => navigate(screen || getNextScreen(currentScreen))}
                onNavigate={navigate}
                onBack={goBack}
              />
            </div>
          ) : (
            <div className="max-w-xl mx-auto w-full my-4 quad-auth-page-wrapper px-4">
              {/* Context Notice for legacy walkthroughs */}
              <div className="mb-4 flex items-center justify-between px-2 text-xs text-ink/60">
                <span className="flex items-center gap-2 font-medium">
                  <Lock size={16} className="text-accent" />
                  Student Enrollment & Onboarding Stage
                </span>
                <button
                  onClick={() => navigate('feed')}
                  className="text-accent font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <span>Skip to Feed</span>
                  <ArrowRight size={16} />
                </button>
              </div>

              <div className="bg-canvas rounded-[12px] border border-ink/12 overflow-hidden p-6 sm:p-8">
                <CurrentComponent
                  onNext={(screen?: string) => navigate(screen || getNextScreen(currentScreen))}
                  onNavigate={navigate}
                  onBack={goBack}
                />
              </div>
            </div>
          )
        ) : !isAuthenticated ? (
          /* Public Guest View (Terms, Privacy, Safety): NEVER expose authenticated Feed sidebar or right rail */
          <main className="max-w-3xl mx-auto w-full my-2 quad-auth-page-wrapper px-4">
            <CurrentComponent
              onNext={(screen?: string) => navigate(screen || getNextScreen(currentScreen))}
              onNavigate={navigate}
              onBack={goBack}
            />
          </main>
        ) : (
          /* Responsive Web App Layout (Reference Layout: Fixed Left Rail, Centered Feed, Fixed Right Rail) */
          <div className="relative min-h-screen">
            {/* ──── COLUMN 1: UNIFIED NAVIGATION RAIL (72px collapsed / 240px hover) ──── */}
            <NavigationRail
              currentScreen={currentScreen}
              unseenReelsCount={unseenReelsCount}
              followRequestCount={followRequestCount}
              onNavigate={navigate}
              user={user}
              state={state}
              institution={institution}
              onLogOut={logOut}
              isPinned={isSidebarPinned}
              onTogglePin={toggleSidebarPin}
              onOpenCreatePost={() => setIsCreateModalOpen(true)}
              onOpenCreateReel={() => setIsCreateReelModalOpen(true)}
              footer={<QuadLegalFooter onNavigate={navigate} />}
              isReelsPage={isReelsPage}
            />

            {currentScreen === 'feed' ? (
              /* ──── MAIN FEED LAYOUT (Reference Design: Centered Feed + Fixed Right Rail) ──── */
              <div className="quad-feed-layout">
                <main className="quad-feed-main-col py-6 px-4">
                  <CurrentComponent
                    onNext={(screen?: string) => navigate(screen || getNextScreen(currentScreen))}
                    onNavigate={navigate}
                    onBack={goBack}
                    onViewWeekItem={setSelectedWeekItem}
                    onOpenCreateReel={() => setIsCreateReelModalOpen(true)}
                    initialReelId={deepLinkReelId}
                    targetPostId={deepLinkPostId}
                    targetThreadId={deepLinkThreadId}
                    initialTab={deepLinkTab}
                    onOpenPeerProfile={(targetUsername, fallbackPeer) => {
                      navigate('profile', { user: targetUsername });
                      setSelectedProfilePeer(
                        fallbackPeer || {
                          id: targetUsername,
                          username: targetUsername,
                          initials: targetUsername.slice(0, 2).toUpperCase(),
                          branch: null,
                          year: null,
                        }
                      );
                    }}
                  />
                </main>

                {/* ──── RIGHT CONTEXTUAL RAIL (Fixed 340px column, Desktop only) ──── */}
                <aside
                  aria-label="Campus Contextual Sidebar"
                  className="quad-feed-right-sidebar border-l border-ink/12 bg-canvas p-4 overflow-y-auto space-y-6 hidden lg:block select-none"
                >
                  {/* CARD 1: THIS WEEK */}
                  <ThisWeekCard
                    items={state.thisWeekEvents || []}
                    onViewItem={setSelectedWeekItem}
                  />

                  {/* CARD 2: WHO TO FOLLOW (Peer Suggestions) */}
                  <section
                    aria-label="Who to follow"
                    className="rounded-xl border border-ink/12 p-4 bg-canvas space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold tracking-wider text-ink/60 uppercase">
                        WHO TO FOLLOW
                      </span>
                      <button
                        type="button"
                        onClick={() => navigate('discover')}
                        className="min-h-[44px] px-1 text-xs font-semibold text-accent hover:underline cursor-pointer rounded-[8px] shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      >
                        Directory
                      </button>
                    </div>

                    <div className="space-y-3">
                      {spotlightPeers.length === 0 ? (
                        <p className="text-xs text-ink/60 py-2">
                          No new suggestions right now.
                        </p>
                      ) : (
                        spotlightPeers.map((peer) => {
                          const isFollowing = Boolean(peer.isFollowing);
                          const isRequested = Boolean(peer.isRequested) || requestedPeerIds.has(peer.id);
                          return (
                            <div
                              key={peer.id}
                              className="flex items-center justify-between gap-2 py-1 rounded-[8px] hover:bg-ink/6 px-1 transition-colors"
                            >
                              <button
                                type="button"
                                onClick={() => setSelectedProfilePeer(peer)}
                                className="flex items-center gap-3 min-w-0 flex-1 text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-[8px]"
                              >
                                <Avatar
                                  initials={peer.initials}
                                  username={peer.username}
                                  size={36}
                                />
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1">
                                    <p className="text-xs font-semibold text-ink truncate">
                                      @{peer.username}
                                    </p>
                                    <ShieldCheck size={14} className="text-accent shrink-0" aria-hidden="true" />
                                  </div>
                                  <p className="text-xs text-ink/60 truncate">
                                    {[peer.branch, peer.year].filter(Boolean).join(' • ')}
                                  </p>
                                </div>
                              </button>

                              <button
                                type="button"
                                disabled={isFollowing || isRequested}
                                onClick={() => togglePeerRequest(peer)}
                                aria-pressed={isFollowing || isRequested}
                                className={`min-h-[44px] px-3 py-2 rounded-[8px] text-xs font-semibold inline-flex items-center gap-1 transition-colors duration-150 cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-default ${
                                  isFollowing || isRequested
                                    ? 'bg-canvas text-ink border border-ink/12'
                                    : 'bg-ink/8 hover:bg-ink/12 text-ink'
                                }`}
                              >
                                {(isFollowing || isRequested) && (
                                  <Check size={14} className="text-ink shrink-0" />
                                )}
                                <span>
                                  {isFollowing ? 'Following' : isRequested ? 'Requested' : 'Follow'}
                                </span>
                              </button>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </section>

                  {/* CARD 3: CAMPUS DISCUSSIONS */}
                  <section
                    aria-label="Campus discussions"
                    className="rounded-xl border border-ink/12 p-4 bg-canvas space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Sparkles size={16} className="text-ink shrink-0" aria-hidden="true" />
                        <span className="text-xs font-bold tracking-wider text-ink/60 uppercase">
                          CAMPUS DISCUSSIONS
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      {trendingTopics.map((topic) => (
                        <button
                          key={topic.tag}
                          type="button"
                          onClick={() => {
                            try {
                              sessionStorage.setItem('quad_pending_search', topic.tag);
                            } catch {
                              // storage unavailable: the feed simply opens unfiltered
                            }
                            navigate('feed');
                            window.dispatchEvent(new Event('quad:pending-search'));
                          }}
                          className="w-full min-h-[44px] text-left px-2 py-2 rounded-[8px] hover:bg-ink/8 transition-colors flex items-center justify-between group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                        >
                          <span className="text-[13px] font-medium text-accent group-hover:underline">
                            {topic.tag}
                          </span>
                          <span className="text-xs text-ink/60">
                            {topic.posts} {topic.posts === 1 ? 'post' : 'posts'}
                          </span>
                        </button>
                      ))}
                    </div>
                  </section>

                  {/* Subtle Legal & Honor Code Footer */}
                  <footer className="pt-4 border-t border-ink/8 text-xs text-ink/50 leading-relaxed px-2">
                    <QuadLegalFooter onNavigate={navigate} />
                  </footer>
                </aside>
              </div>
            ) : isReelsPage ? (
              /* ──── REELS FULL VIEWPORT LAYOUT ──── */
              <div className="w-full quad-main--reels min-h-screen">
                <CurrentComponent
                  onNext={(screen?: string) => navigate(screen || getNextScreen(currentScreen))}
                  onNavigate={navigate}
                  onBack={goBack}
                  onViewWeekItem={setSelectedWeekItem}
                  onOpenCreateReel={() => setIsCreateReelModalOpen(true)}
                  initialReelId={deepLinkReelId}
                  targetPostId={deepLinkPostId}
                  targetThreadId={deepLinkThreadId}
                  initialTab={deepLinkTab}
                  onOpenPeerProfile={(targetUsername, fallbackPeer) => {
                    navigate('profile', { user: targetUsername });
                    setSelectedProfilePeer(
                      fallbackPeer || {
                        id: targetUsername,
                        username: targetUsername,
                        initials: targetUsername.slice(0, 2).toUpperCase(),
                        branch: null,
                        year: null,
                      }
                    );
                  }}
                />
              </div>
            ) : (
              /* ──── OTHER AUTHENTICATED PAGES (Directory, Threads, Profile, Settings, etc.) ──── */
              <div className="quad-subpage-layout">
                <main className="max-w-4xl w-full mx-auto py-6 px-4">
                  <CurrentComponent
                    onNext={(screen?: string) => navigate(screen || getNextScreen(currentScreen))}
                    onNavigate={navigate}
                    onBack={goBack}
                    onViewWeekItem={setSelectedWeekItem}
                    onOpenCreateReel={() => setIsCreateReelModalOpen(true)}
                    initialReelId={deepLinkReelId}
                    targetPostId={deepLinkPostId}
                    targetThreadId={deepLinkThreadId}
                    initialTab={deepLinkTab}
                    onOpenPeerProfile={(targetUsername, fallbackPeer) => {
                      navigate('profile', { user: targetUsername });
                      setSelectedProfilePeer(
                        fallbackPeer || {
                          id: targetUsername,
                          username: targetUsername,
                          initials: targetUsername.slice(0, 2).toUpperCase(),
                          branch: null,
                          year: null,
                        }
                      );
                    }}
                  />
                  <footer className="mt-8 pt-4 border-t border-ink/12 px-2">
                    <QuadLegalFooter onNavigate={navigate} />
                  </footer>
                </main>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ═══════════ MOBILE BOTTOM TAB BAR (< 768px): Feed, Reels, +, Requests, Profile ═══════════ */}
      {isAuthenticated && !isAuthScreen && (
        <nav
          aria-label="Mobile bottom navigation"
          style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}
          className={`md:hidden fixed bottom-0 inset-x-0 z-40 px-2 pt-2 flex items-center justify-around ${
            isReelsPage
              ? `quad-mobile-tabbar--reels ${!reelsControlsVisible ? 'quad-mobile-tabbar--hidden' : ''}`
              : 'bg-canvas border-t border-ink/12'
          }`}
        >
          {[
            { id: 'feed', label: 'Feed', icon: Compass },
            {
              id: 'reels',
              label: 'Reels',
              icon: Play,
              badgeCount: unseenReelsCount,
            },
            { id: 'create', label: 'Create post', icon: Plus, primary: true },
            {
              id: 'requests',
              label: 'Requests',
              icon: UserPlus,
              badgeCount: followRequestCount,
            },
            { id: 'profile', label: 'Profile', icon: User },
          ].map((item) => {
            const isActive = currentScreen === item.id;
            const Icon = item.icon;
            if (item.primary) {
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setIsCreateModalOpen(true)}
                  aria-label="Create post"
                  className="min-h-[44px] min-w-[44px] px-4 rounded-full bg-accent text-canvas flex items-center justify-center cursor-pointer hover:brightness-90 active:scale-[0.98] transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <Plus size={20} strokeWidth={2.5} />
                </button>
              );
            }
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => navigate(item.id)}
                aria-label={item.label}
                aria-current={isActive ? 'page' : undefined}
                className={`relative min-h-[44px] min-w-[44px] flex flex-col items-center justify-center gap-1 px-2 py-1 rounded-[8px] text-[11px] font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                  isActive
                    ? 'text-ink font-semibold'
                    : 'text-ink/55 hover:text-ink'
                }`}
              >
                <span className="relative">
                  <Icon
                    size={20}
                    strokeWidth={isActive ? 2.5 : 2}
                    fill="none"
                  />
                  {(item.badgeCount ?? 0) > 0 && item.id === 'reels' && (
                    <span
                      aria-hidden="true"
                      className="absolute -top-0.5 -right-1 w-2 h-2 rounded-full bg-accent"
                    />
                  )}
                </span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      )}

      {/* This Week Item Detail Modal */}
      <Modal
        isOpen={Boolean(selectedWeekItem)}
        onClose={() => setSelectedWeekItem(null)}
        title={selectedWeekItem?.title || 'Campus Update'}
        description={selectedWeekItem?.date || ''}
        size="md"
      >
        {selectedWeekItem && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="status" icon={Calendar}>
                {selectedWeekItem.type || 'Campus'}
              </Badge>
              {selectedWeekItem.location && (
                <Badge variant="status" icon={MapPin}>
                  {selectedWeekItem.location}
                </Badge>
              )}
            </div>
            <p className="text-sm text-ink leading-relaxed">
              {selectedWeekItem.details}
            </p>
            <div className="flex justify-end pt-2 border-t border-ink/12">
              <button
                type="button"
                onClick={() => setSelectedWeekItem(null)}
                className="min-h-[44px] px-4 py-2 rounded-[8px] bg-ink/8 hover:bg-ink/12 text-xs font-semibold text-ink cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Who to Follow Peer Profile Modal */}
      <PeerProfileModal
        username={selectedProfilePeer?.username || null}
        fallbackPeer={selectedProfilePeer}
        onClose={() => {
          setSelectedProfilePeer(null);
          setDeepLinkUsername(null);
          if (typeof window !== 'undefined' && window.history) {
            window.history.pushState({}, '', buildShareUrl({ screen: currentScreen }));
          }
        }}
      />

      {/* Global Create Post Modal */}
      <CreatePostModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreated={() => {
          if (currentScreen !== 'feed') navigate('feed');
        }}
      />

      {/* Global Create Reel Modal */}
      <CreateReelModal
        isOpen={isCreateReelModalOpen}
        onClose={() => setIsCreateReelModalOpen(false)}
        onCreated={() => {
          navigate('reels');
        }}
      />
    </div>
  );
}

function QuadLegalFooter({ onNavigate }: { onNavigate: (screen: string) => void }) {
  return (
    <div className="text-xs text-ink/60 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onNavigate('terms')}
          className="min-h-[44px] inline-flex items-center px-1 hover:underline cursor-pointer rounded-[8px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          Terms
        </button>
        <span aria-hidden="true">·</span>
        <button
          type="button"
          onClick={() => onNavigate('terms')}
          className="min-h-[44px] inline-flex items-center px-1 hover:underline cursor-pointer rounded-[8px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          Privacy
        </button>
        <span aria-hidden="true">·</span>
        <button
          type="button"
          onClick={() => onNavigate('safety')}
          className="min-h-[44px] inline-flex items-center px-1 hover:underline cursor-pointer rounded-[8px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          Help
        </button>
      </div>
      <p className="text-xs text-ink/60">
        Quad Web v{APP_VERSION} • Updated Nov 2026
      </p>
    </div>
  );
}

function getNextScreen(current: string): string {
  const flow: Record<string, string> = {
    splash: 'verify',
    verify: 'onboarding',
    onboarding: 'feed',
  };
  return flow[current] || 'feed';
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppProvider>
          <ToastProvider>
            <AppShell />
          </ToastProvider>
        </AppProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
