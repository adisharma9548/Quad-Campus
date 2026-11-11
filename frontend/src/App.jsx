import React, { useState, useEffect } from 'react';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
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
import { SidebarItem } from './components/SidebarItem';
import { ThisWeekCard } from './components/ThisWeekCard';
import { CreatePostModal } from './screens/CreatePostScreen';

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
  Moon,
  Sun,
  ChevronDown,
  RotateCcw,
  ArrowRight,
  LogIn,
  LogOut,
  KeyRound,
  Bell,
  User,
  Plus,
  Check,
  Calendar,
  MapPin,
} from 'lucide-react';

const SCREENS = {
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

const APP_VERSION = '2.5.0';

// Auth flow screens for unauthenticated users
const AUTH_GUEST_SCREENS = ['welcome', 'signup', 'login', 'forgot_password'];

function AppShell() {
  const { user, isAuthenticated, isLoading, logOut } = useAuth();
  const [currentPath, setCurrentPath] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.location.pathname;
    }
    return '/';
  });
  const [currentScreen, setCurrentScreen] = useState(() => {
    if (typeof window !== 'undefined') {
      const normalized =
        window.location.pathname.length > 1
          ? window.location.pathname.replace(/\/+$/, '')
          : window.location.pathname;
      if (normalized === '/terms' || normalized === '/privacy') return 'terms';
      if (normalized === '/safety') return 'safety';
    }
    return 'welcome';
  });
  const [_history, setHistory] = useState(['welcome']);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedWeekItem, setSelectedWeekItem] = useState(null);
  const [requestedPeerIds, setRequestedPeerIds] = useState(new Set());
  const { dark, toggle } = useTheme();
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

  // Listen to browser navigation popstate
  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateToPath = (path) => {
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

  const navigate = (screen) => {
    if (screen === 'create') {
      setIsCreateModalOpen(true);
      setSwitcherOpen(false);
      setAvatarMenuOpen(false);
      return;
    }
    if (screen === 'reels') {
      markReelsSeen();
    }
    if (
      screen !== 'terms' &&
      screen !== 'safety' &&
      (currentPath === '/terms' || currentPath === '/privacy' || currentPath === '/safety')
    ) {
      navigateToPath('/');
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

  const togglePeerRequest = async (peer) => {
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

  const livePeers = (state.discoverableUsers || []).filter((u) => !u.isFollowing);
  const spotlightPeers =
    livePeers.length > 0
      ? livePeers.slice(0, 3)
      : [
          { id: 201, username: 'algo_ninja', initials: 'AN', branch: 'DS', year: '2nd' },
          { id: 202, username: 'kernel_kid', initials: 'KK', branch: 'IT', year: '2nd' },
          { id: 203, username: 'debug_queen', initials: 'DQ', branch: 'AI/ML', year: '4th' },
        ];

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
        onNavigate={(screen) => {
          navigateToPath('/');
          navigate(screen);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-canvas text-ink transition-colors duration-250 flex flex-col font-sans antialiased">
      {/* ═══════════ GLOBAL WEB TOPBAR ═══════════ */}
      <header className="sticky top-0 z-40 bg-canvas border-b border-ink/12 px-4 lg:px-8 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          {/* Left Brand Identity: Logo mark + "Quad" wordmark */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate(isAuthenticated ? 'feed' : 'welcome')}
              className="min-h-[44px] flex items-center gap-3 text-left cursor-pointer rounded-[8px] px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <QuadLogo size={32} />
              <span className="font-display font-bold text-lg tracking-tight text-ink leading-none">
                Quad
              </span>
            </button>
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

          {/* Right Global Actions: Circular theme toggle + Avatar menu + ONE accent Post pill button */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggle}
              className="min-h-[44px] min-w-[44px] rounded-full bg-canvas border border-ink/12 text-ink hover:bg-ink/8 transition-colors cursor-pointer flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              title="Toggle Light/Dark Theme"
              aria-label="Toggle Light or Dark Theme"
            >
              {dark ? <Sun size={20} /> : <Moon size={20} />}
            </button>

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
                  className="min-h-[44px] px-4 py-2 rounded-full bg-accent text-canvas text-xs font-semibold hover:opacity-90 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  Sign up
                </button>
              </>
            ) : (
              <>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setAvatarMenuOpen((prev) => !prev)}
                    aria-label="Open account menu"
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
                      className="absolute right-0 mt-2 w-60 bg-canvas rounded-[12px] border border-ink/12 p-3 z-50 space-y-2"
                    >
                      <div className="px-2 pb-2 border-b border-ink/12 space-y-1">
                        <p className="text-sm font-semibold text-ink truncate">
                          @{currentUsername}
                        </p>
                        <p className="text-xs text-ink/60 truncate">
                          {user?.branch || state.branch || 'CSE'} • {user?.year || state.year || '3rd'} Year
                        </p>
                        <Badge variant="status" icon={ShieldCheck}>
                          Verified College Network
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

                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(true)}
                  className="hidden md:inline-flex min-h-[44px] items-center gap-2 px-4 py-2 rounded-full bg-accent text-canvas text-xs font-semibold hover:opacity-90 transition-opacity cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <Plus size={16} strokeWidth={2.5} aria-hidden="true" />
                  <span>Post</span>
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ═══════════ MAIN CONTENT BODY ═══════════ */}
      <div className="flex-1 w-full max-w-7xl mx-auto px-4 lg:px-8 py-6">
        {/* If viewing Auth Screens, display centered web layout */}
        {isAuthScreen ? (
          ['welcome', 'signup', 'login', 'forgot_password'].includes(currentScreen) ? (
            <div className="w-full">
              <CurrentComponent
                onNext={(screen) => navigate(screen || getNextScreen(currentScreen))}
                onNavigate={navigate}
                onBack={goBack}
              />
            </div>
          ) : (
            <div className="max-w-xl mx-auto w-full my-4">
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
                  onNext={(screen) => navigate(screen || getNextScreen(currentScreen))}
                  onNavigate={navigate}
                  onBack={goBack}
                />
              </div>
            </div>
          )
        ) : !isAuthenticated ? (
          /* Public Guest View (Terms, Privacy, Safety): NEVER expose authenticated Feed sidebar or right rail */
          <main className="max-w-3xl mx-auto w-full my-2">
            <CurrentComponent
              onNext={(screen) => navigate(screen || getNextScreen(currentScreen))}
              onNavigate={navigate}
              onBack={goBack}
            />
          </main>
        ) : (
          /* Responsive Web App Layout (>=1280px 3-col, 1024-1279px 2-col, 768-1023px icon-sidebar + feed, <768px 1-col + bottom bar) */
          <div className="flex gap-6 lg:gap-8 items-start justify-center">
            {/* ──── COLUMN 1: LEFT NAVIGATION SIDEBAR (768-1023px icon-only, 1024px+ 220px) ──── */}
            <aside className="hidden md:flex md:w-20 lg:w-[220px] shrink-0 flex-col sticky top-20 self-start max-h-[calc(100dvh-6rem)] overflow-y-auto scrollbar-hover pt-1 pb-6">
              <nav aria-label="Primary campus navigation" className="space-y-1 w-full">
                <SidebarItem
                  icon={Compass}
                  label="Feed"
                  active={currentScreen === 'feed'}
                  onClick={() => navigate('feed')}
                />
                <SidebarItem
                  icon={Play}
                  label="Reels"
                  active={currentScreen === 'reels'}
                  badge={unseenReelsCount > 0 ? 'New' : null}
                  badgeVariant="accent"
                  onClick={() => navigate('reels')}
                />
                <SidebarItem
                  icon={Search}
                  label="Directory"
                  active={currentScreen === 'discover'}
                  onClick={() => navigate('discover')}
                />
                <SidebarItem
                  icon={MessagesSquare}
                  label="Threads"
                  active={currentScreen === 'threads'}
                  onClick={() => navigate('threads')}
                />
                <SidebarItem
                  icon={UserPlus}
                  label="Requests"
                  active={currentScreen === 'requests'}
                  badge={followRequestCount > 0 ? String(followRequestCount) : null}
                  badgeVariant="count"
                  onClick={() => navigate('requests')}
                />
                <SidebarItem
                  icon={Lock}
                  label="Personal space"
                  active={currentScreen === 'profile'}
                  onClick={() => navigate('profile')}
                />

                <div role="separator" className="my-2 border-t border-ink/12" />

                <SidebarItem
                  icon={Sliders}
                  label="Settings"
                  active={currentScreen === 'settings'}
                  onClick={() => navigate('settings')}
                />
              </nav>
            </aside>

            {/* ──── COLUMN 2: CENTER FEED COLUMN (max-w-640px centered) ──── */}
            <main className="flex-1 min-w-0 max-w-[640px] pb-12 mb-8 md:pb-6 md:mb-0">
              <CurrentComponent
                onNext={(screen) => navigate(screen || getNextScreen(currentScreen))}
                onNavigate={navigate}
                onBack={goBack}
                onViewWeekItem={setSelectedWeekItem}
              />

              {/* Single-place Footer when Right Rail is hidden (<1280px) */}
              <footer className="xl:hidden mt-8 pt-4 border-t border-ink/12 px-2 text-xs text-ink/60 space-y-2">
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => navigate('terms')}
                    className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center px-1 hover:underline cursor-pointer rounded-[8px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    Terms
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('terms')}
                    className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center px-1 hover:underline cursor-pointer rounded-[8px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    Privacy
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('safety')}
                    className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center px-1 hover:underline cursor-pointer rounded-[8px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    Help
                  </button>
                </div>
                <p className="text-xs text-ink/60">
                  Quad Web v{APP_VERSION} • Updated Nov 2026
                </p>
              </footer>
            </main>

            {/* ──── COLUMN 3: RIGHT CONTEXTUAL RAIL (>=1280px only, 280px) ──── */}
            <aside className="hidden xl:flex w-[280px] shrink-0 flex-col gap-4 sticky top-20 self-start max-h-[calc(100dvh-6rem)] overflow-y-auto scrollbar-hover pt-1 pb-6">
              {/* This week card */}
              <ThisWeekCard
                items={state.thisWeekEvents || []}
                onViewItem={setSelectedWeekItem}
              />

              {/* Who to follow */}
              <section
                aria-label="Who to follow"
                className="p-4 rounded-[12px] bg-canvas border border-ink/12 space-y-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-ink whitespace-nowrap">
                    Who to follow
                  </h3>
                  <button
                    type="button"
                    onClick={() => navigate('discover')}
                    className="min-h-[44px] px-1 text-xs font-semibold text-accent hover:underline cursor-pointer rounded-[8px] shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    Directory
                  </button>
                </div>

                <div className="space-y-2">
                  {spotlightPeers.map((peer) => {
                    const isFollowing = Boolean(peer.isFollowing);
                    const isRequested = Boolean(peer.isRequested) || requestedPeerIds.has(peer.id);
                    return (
                      <div
                        key={peer.id}
                        className="flex items-center justify-between gap-2 py-1"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <Avatar
                            initials={peer.initials}
                            username={peer.username}
                            size={36}
                          />
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-ink truncate">
                              @{peer.username}
                            </p>
                            <p className="text-xs text-ink/60 truncate">
                              {peer.branch} • {peer.year}
                            </p>
                          </div>
                        </div>

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
                  })}
                </div>
              </section>

              {/* Campus discussions */}
              <section
                aria-label="Campus discussions"
                className="p-4 rounded-[12px] bg-canvas border border-ink/12 space-y-2"
              >
                <div className="flex items-center gap-2">
                  <Sparkles size={16} className="text-ink shrink-0" aria-hidden="true" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-ink">
                    Campus discussions
                  </h3>
                </div>

                <div className="space-y-1">
                  {trendingTopics.map((topic) => (
                    <button
                      key={topic.tag}
                      type="button"
                      onClick={() => navigate('threads')}
                      className="w-full min-h-[44px] text-left px-2 py-2 rounded-[8px] hover:bg-ink/8 transition-colors flex items-center justify-between group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    >
                      <span className="text-[13px] font-medium text-accent group-hover:underline">
                        {topic.tag}
                      </span>
                      <span className="text-xs text-ink/60">
                        {topic.posts} posts
                      </span>
                    </button>
                  ))}
                </div>
              </section>

              {/* Footer: Terms, Privacy, Help (one place only) */}
              <footer className="px-2 text-xs text-ink/60 space-y-2">
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => navigate('terms')}
                    className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center hover:underline cursor-pointer rounded-[8px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    Terms
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('terms')}
                    className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center hover:underline cursor-pointer rounded-[8px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    Privacy
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('safety')}
                    className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center hover:underline cursor-pointer rounded-[8px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    Help
                  </button>
                </div>
                <p className="text-xs text-ink/60">
                  Quad Web v{APP_VERSION} • Updated Nov 2026
                </p>
              </footer>
            </aside>
          </div>
        )}
      </div>

      {/* ═══════════ MOBILE BOTTOM TAB BAR (< 768px): Feed, Reels, +, Alerts, Profile ═══════════ */}
      {isAuthenticated && !isAuthScreen && (
        <nav
          aria-label="Mobile bottom navigation"
          style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}
          className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-canvas border-t border-ink/12 px-2 pt-2 flex items-center justify-around"
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
              label: 'Alerts',
              icon: Bell,
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
                  className="min-h-[44px] min-w-[44px] px-4 rounded-full bg-accent text-canvas flex items-center justify-center cursor-pointer hover:opacity-90 active:scale-[0.98] transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
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
                  {item.badgeCount > 0 && item.id === 'reels' && (
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

      {/* Global Create Post Modal */}
      <CreatePostModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreated={() => {
          if (currentScreen !== 'feed') navigate('feed');
        }}
      />
    </div>
  );
}

function getNextScreen(current) {
  const flow = {
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
