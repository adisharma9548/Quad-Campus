import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { IS_REAL_BACKEND, apiRequest } from '../services/apiClient';
import type {
  BlockedUserItem,
  FollowRequestItem,
  FollowerItem,
  MutedUserItem,
  PeerUser,
  PostAnswer,
  PostItem,
  ReelItem,
  ThisWeekEvent,
  ThreadItem,
  ThreadReply,
  TrendingTopic,
  UserProfile,
} from '../types/quad';

export interface AppFollowerItem extends FollowerItem {
  groups?: string[];
}

export interface AppMutedUserItem extends MutedUserItem {
  initials?: string;
  mutedAt?: string;
}

export interface AppPersonalPost extends PostItem {
  privacyLevel?: string;
}

export interface AppReelItem extends ReelItem {
  likesCount?: number;
}

export interface AppThreadReply extends ThreadReply {
  likes?: number;
}

export interface AppNotificationItem {
  id?: string | number;
  type?: string;
  title?: string;
  message?: string;
  text?: string;
  timestamp?: string;
  createdAt?: string;
  read?: boolean;
  isRead?: boolean;
  kind?: string;
  actor?: string;
  [key: string]: unknown;
}

export interface AppState {
  user: UserProfile | null;
  isAuthenticated: boolean;
  onboardingComplete: boolean;
  isHydrating: boolean;
  username: string;
  userInitials: string;
  branch: string;
  year: string;
  section: string;
  bio: string;
  profilePublic: boolean;
  discoverableByBranch: boolean;
  readReceipts: boolean;
  activeStatus: boolean;
  stripLocation: boolean;
  followersCount: number;
  followingCount: number;
  followers: AppFollowerItem[];
  following: AppFollowerItem[];
  followRequests: FollowRequestItem[];
  followerGroups: Record<string, string[]>;
  blockedUsers: BlockedUserItem[];
  mutedUsers: AppMutedUserItem[];
  notifications: AppNotificationItem[];
  savedPostIds: Array<string | number>;
  trendingTopics: TrendingTopic[];
  thisWeekEvents: ThisWeekEvent[];
  publicPosts: PostItem[];
  personalPosts: AppPersonalPost[];
  reels: AppReelItem[];
  threadPosts: Array<ThreadItem & { replies?: AppThreadReply[] }>;
  discoverableUsers: PeerUser[];
  [key: string]: unknown;
}

export interface RefreshFeedParams {
  limit?: number;
  scope?: string;
  tab?: string;
  q?: string;
}

export interface RefreshDirectoryParams {
  q?: string;
  branch?: string;
  year?: string;
}

export interface UploadMediaResult {
  mediaId: string | number | null;
  url: string;
  exifStripped?: boolean;
  strippedBytes?: number;
}

export interface CreatePostPayload extends Partial<PostItem> {
  content: string;
  space?: 'public' | 'personal' | string;
}

export interface ReportPayload {
  targetType: string;
  targetId: string | number;
  reason: string;
  details?: string;
  contentSnippet?: string;
}

interface SocialOverviewResponse {
  followers?: AppFollowerItem[];
  followersCount?: number;
  following?: AppFollowerItem[];
  followingCount?: number;
  followRequests?: FollowRequestItem[];
  followerGroups?: Record<string, string[]>;
  blockedUsers?: BlockedUserItem[];
  mutedUsers?: AppMutedUserItem[];
  notifications?: AppNotificationItem[];
  savedPostIds?: Array<string | number>;
}

export interface AppContextValue {
  state: AppState;
  updateState: (updates: Partial<AppState>) => void;
  hydrateFromBackend: () => Promise<void>;
  refreshFeed: (params?: RefreshFeedParams) => Promise<void>;
  refreshDirectory: (params?: RefreshDirectoryParams) => Promise<void>;
  refreshSocialOverview: () => Promise<void>;
  uploadMediaImage: (fileOrDataUrl: File | string) => Promise<UploadMediaResult>;
  createPost: (payload: CreatePostPayload) => Promise<PostItem>;
  togglePostLike: (postId: string | number) => Promise<{ likes: number; liked: boolean } | null>;
  togglePostSave: (postId: string | number) => Promise<{ saved: boolean } | null>;
  hidePost: (postId: string | number) => Promise<void>;
  muteAuthor: (username: string) => Promise<void>;
  unmuteAuthor: (username: string) => Promise<void>;
  blockAuthor: (username: string, reason?: string) => Promise<void>;
  unblockAuthor: (usernameOrId: string | number) => Promise<void>;
  submitReport: (payload: ReportPayload) => Promise<{ status: string; [key: string]: unknown }>;
  markReelsSeen: () => Promise<void>;
  toggleReelLike: (reelId: string | number) => Promise<{ likes: number; liked: boolean } | null>;
  markBestAnswer: (postId: string | number, answerId: string) => Promise<void>;
  markNotificationsRead: () => Promise<void>;
  deletePost: (postId: string | number) => Promise<void>;
  editPost: (
    postId: string | number,
    patch: { title?: string; content: string }
  ) => Promise<PostItem>;
  addPostAnswer: (postId: string | number, replyOrText: string | PostAnswer) => Promise<PostAnswer>;
  toggleProfileVisibility: (makePublic: boolean) => Promise<void>;
  toggleDiscoverability: (enabled: boolean) => Promise<void>;
  updatePrivacySetting: (patch: Partial<AppState> & Partial<UserProfile>) => Promise<void>;
  requestFollow: (username: string) => Promise<{ status: string; [key: string]: unknown }>;
  respondFollowRequest: (
    requestId: string | number,
    action: 'accept' | 'decline' | string,
    groupName?: string
  ) => Promise<void>;
  removeFollower: (username: string) => Promise<void>;
  unfollowUser: (username: string) => Promise<void>;
  createThread: (content: string) => Promise<ThreadItem>;
  toggleThreadLike: (threadId: string | number) => Promise<{ likes: number; liked: boolean } | null>;
  addThreadReply: (threadId: string | number, content: string) => Promise<AppThreadReply>;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

function buildEmptyState(): AppState {
  return {
    user: null,
    isAuthenticated: false,
    onboardingComplete: true,
    isHydrating: IS_REAL_BACKEND,
    username: '',
    userInitials: 'QD',
    branch: '',
    year: '',
    section: '',
    bio: '',
    profilePublic: false,
    discoverableByBranch: false,
    readReceipts: false,
    activeStatus: false,
    stripLocation: true,
    followersCount: 0,
    followingCount: 0,
    followers: [],
    following: [],
    followRequests: [],
    followerGroups: {
      'Close Friends': [],
      'My Branch': [],
      'My Year': [],
      Classmates: [],
      Others: [],
    },
    blockedUsers: [],
    mutedUsers: [],
    notifications: [],
    savedPostIds: [],
    trendingTopics: [],
    thisWeekEvents: [],
    publicPosts: [],
    personalPosts: [],
    reels: [],
    threadPosts: [],
    discoverableUsers: [],
  };
}

const mockInitialState: AppState = {
  user: null,
  isAuthenticated: true,
  onboardingComplete: true,
  isHydrating: false,
  username: 'quantum_dev',
  userInitials: 'QD',
  branch: 'CSE',
  year: '3rd',
  section: 'B',
  bio: 'CS junior exploring distributed systems and compilers. Building quiet software on campus.',
  profilePublic: false,
  discoverableByBranch: false,
  readReceipts: false,
  activeStatus: false,
  stripLocation: true,
  followersCount: 18,
  followingCount: 14,
  followers: [
    { id: 101, username: 'cyber_sage', initials: 'CS', branch: 'CSE', year: '3rd', groups: ['Close Friends', 'My Branch'] },
    { id: 102, username: 'algo_ninja', initials: 'AN', branch: 'AI/ML', year: '3rd', groups: ['My Year'] },
    { id: 103, username: 'kernel_kid', initials: 'KK', branch: 'IT', year: '2nd', groups: ['Classmates'] },
  ],
  following: [
    { id: 201, username: 'debug_queen', initials: 'DQ', branch: 'CSE', year: '4th' },
    { id: 202, username: 'chai_coder', initials: 'CC', branch: 'IoT', year: '3rd' },
  ],
  followRequests: [
    { id: 1, username: 'cyber_sage', initials: 'CS', branch: 'CSE', year: '3rd', timestamp: '2h ago' },
    { id: 2, username: 'debug_queen', initials: 'DQ', branch: 'AI/ML', year: '4th', timestamp: '5h ago' },
    { id: 3, username: 'algo_ninja', initials: 'AN', branch: 'DS', year: '2nd', timestamp: '1d ago' },
    { id: 4, username: 'pixel_punk', initials: 'PP', branch: 'ME', year: '3rd', timestamp: '2d ago' },
  ],
  followerGroups: {
    'Close Friends': ['cyber_sage'],
    'My Branch': ['cyber_sage'],
    'My Year': ['algo_ninja'],
    Classmates: ['kernel_kid'],
    Others: [],
  },
  blockedUsers: [
    { id: 1, username: 'toxic_troll', initials: 'TT', blockedAt: '2 weeks ago', reason: 'Unwanted messaging' },
    { id: 2, username: 'spam_bot_99', initials: 'SB', blockedAt: '1 month ago', reason: 'Assignment promo spam' },
    { id: 3, username: 'creepy_dm', initials: 'CD', blockedAt: '3 months ago', reason: 'Stalking attempt' },
  ],
  mutedUsers: [{ id: 11, username: 'noise_maker', initials: 'NM', mutedAt: '1 week ago' }],
  savedPostIds: [],
  notifications: [],
  trendingTopics: [],
  thisWeekEvents: [
    {
      id: 'tw-1',
      date: 'Thu, Nov 14 • 5:30 PM',
      title: 'Compiler Design Lab Viva & CFG Checkoff',
      location: 'CS Lab 2, Academic Block A',
      type: 'Lab Exam',
      details: 'Bring lab manual and git commit hash for lexical & LL(1) parser milestones. Pseudonymous seating list posted inside Department noticeboard.',
    },
    {
      id: 'tw-2',
      date: 'Fri, Nov 15 • 11:59 PM',
      title: 'Inter-College Hardware Hackathon Team Freeze',
      location: 'Innovation Workbench Portal',
      type: 'Deadline',
      details: 'Final cutoff for 4-student cross-branch team registration and hardware BOM requisition forms.',
    },
    {
      id: 'tw-3',
      date: 'Sat, Nov 16 • 6:00 PM',
      title: 'Edge AI & Autonomous Rover Live Bench Demo',
      location: 'Seminar Bay B',
      type: 'Event',
      details: 'Open campus showcase by 3rd and 4th year Systems & Robotics peers. No photography rule enforced for unblurred faces.',
    },
  ],
  publicPosts: [
    {
      id: 1,
      type: 'Discussion',
      title: 'Topological ordering makes DSA lab graph recursion click',
      username: 'code_wizard',
      initials: 'CW',
      branch: 'CSE',
      year: '3rd',
      content:
        'Just wrapped up the DSA lab session in CS Lab 2. The directed acyclic graph recursion problem was surprisingly clean once you compute in-degrees up front and maintain a Kahn queue instead of chasing recursive cycle states. Sharing my whiteboard trace notes with the batch — happy to walk through edge cases after the 4 PM tutorial if anyone is stuck on disconnected components or weighted tie-breaking.',
      hashtags: ['#DSA', '#Algorithms', '#CSELab'],
      audience: 'public',
      timestamp: '25m ago',
      likes: 24,
      comments: 6,
      shares: 3,
      hasImage: false,
      answers: [
        { id: 'c1', username: 'algo_ninja', initials: 'AN', text: 'Kahn queue avoids stack overflow on skewed DAGs during timed evals.', timestamp: '18m ago' },
      ],
    },
  ],
  personalPosts: [
    {
      id: 101,
      username: 'quantum_dev',
      initials: 'QD',
      content: 'Finally finished drafting the capstone architecture document. Kept the distributed consensus model lightweight and stateless.',
      audience: 'Close Friends',
      timestamp: '1h ago',
      likes: 7,
      comments: 3,
      privacyLevel: 'group',
    },
  ],
  reels: [
    {
      id: 301,
      username: 'robo_racer',
      initials: 'RR',
      caption: 'Autonomous obstacle avoidance rover testing in the Mechanical workshop. 120ms latency on the onboard LIDAR.',
      likes: 142,
      comments: 29,
      shares: 18,
      views: '1.4K',
      duration: '0:34',
      tag: 'Robotics Lab',
      branch: 'ME',
      year: '4th',
      unseen: true,
      posterKey: 'robotics',
      posterAlt: 'Autonomous campus rover prototype diagram from Mechanical workshop Robotics Lab',
    },
  ],
  threadPosts: [
    {
      id: 401,
      username: 'compiler_fan',
      initials: 'CF',
      content: 'Question for 3rd/4th years: When designing a recursive descent parser for the language design elective, is it better to hand-roll the AST nodes or generate them via visitor pattern?',
      timestamp: '35m ago',
      likes: 18,
      replyCount: 4,
      replies: [
        {
          id: 4011,
          username: 'binary_bard',
          initials: 'BB',
          content: 'Hand-rolling gives you much better custom compiler error spans for diagnostics. The visitor pattern gets verbose very quickly in C++.',
          timestamp: '20m ago',
          likes: 8,
        },
      ],
    },
  ],
  discoverableUsers: [
    { id: 1, username: 'tech_titan', initials: 'TT', branch: 'CSE', year: '3rd', bio: 'Backend infrastructure & systems' },
  ],
};

function shortYear(year = ''): string {
  return String(year).replace(/\s*Year$/i, '').trim() || '3rd';
}

export function AppProvider({ children }: { children: ReactNode }) {
  const { user, updateProfile } = useAuth();
  const [state, setState] = useState<AppState>(() =>
    __AUTH_REAL__ ? buildEmptyState() : mockInitialState
  );

  const updateState = useCallback((updates: Partial<AppState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  }, []);

  const hydrateFromBackend = useCallback(async () => {
    if (!IS_REAL_BACKEND) return;
    await Promise.resolve();
    if (!user) {
      setState({ ...buildEmptyState(), isHydrating: false });
      return;
    }

    setState((prev) => ({
      ...prev,
      isHydrating: true,
      user,
      isAuthenticated: true,
      username: user.username,
      userInitials: user.avatarInitials || user.username.slice(0, 2).toUpperCase(),
      branch: user.branch || 'CSE',
      year: shortYear(user.year),
      section: user.section || '',
      bio: user.bio || '',
      profilePublic: Boolean(user.profilePublic),
      discoverableByBranch: Boolean(user.discoverableByBranch),
      readReceipts: Boolean(user.readReceipts),
      activeStatus: Boolean(user.activeStatus),
    }));

    try {
      const [feedRes, personalRes, reelsRes, threadsRes, directoryRes, socialRes, eventsRes] =
        await Promise.all([
          apiRequest<{ items?: PostItem[]; trendingTopics?: TrendingTopic[] }>('/feed?limit=40'),
          apiRequest<{ items?: AppPersonalPost[] }>('/feed/personal'),
          apiRequest<{ items?: AppReelItem[] }>('/reels'),
          apiRequest<{ items?: ThreadItem[] }>('/threads'),
          apiRequest<{ items?: PeerUser[] }>('/directory?limit=40'),
          apiRequest<SocialOverviewResponse>('/social/overview'),
          apiRequest<{ items?: ThisWeekEvent[] }>('/events/this-week'),
        ]);

      setState((prev) => ({
        ...prev,
        isHydrating: false,
        publicPosts: feedRes?.items || [],
        trendingTopics: feedRes?.trendingTopics || [],
        personalPosts: personalRes?.items || [],
        reels: reelsRes?.items || [],
        threadPosts: threadsRes?.items || [],
        discoverableUsers: directoryRes?.items || [],
        thisWeekEvents: eventsRes?.items || [],
        followers: socialRes?.followers || [],
        followersCount: socialRes?.followersCount ?? 0,
        following: socialRes?.following || [],
        followingCount: socialRes?.followingCount ?? 0,
        followRequests: socialRes?.followRequests || [],
        followerGroups: socialRes?.followerGroups || prev.followerGroups,
        blockedUsers: socialRes?.blockedUsers || [],
        mutedUsers: socialRes?.mutedUsers || [],
        notifications: socialRes?.notifications || [],
        savedPostIds: socialRes?.savedPostIds || [],
      }));
    } catch (err) {
      console.warn('Backend data hydration failed:', err);
      setState((prev) => ({ ...prev, isHydrating: false }));
    }
  }, [user]);

  useEffect(() => {
    if (!IS_REAL_BACKEND) return undefined;
    let active = true;
    Promise.resolve().then(() => {
      if (active) hydrateFromBackend();
    });
    return () => {
      active = false;
    };
  }, [hydrateFromBackend]);

  const refreshSocialOverview = useCallback(async () => {
    if (!IS_REAL_BACKEND || !user) return;
    const socialRes = await apiRequest<SocialOverviewResponse>('/social/overview');
    setState((prev) => ({
      ...prev,
      followers: socialRes?.followers || [],
      followersCount: socialRes?.followersCount ?? 0,
      following: socialRes?.following || [],
      followingCount: socialRes?.followingCount ?? 0,
      followRequests: socialRes?.followRequests || [],
      followerGroups: socialRes?.followerGroups || prev.followerGroups,
      blockedUsers: socialRes?.blockedUsers || [],
      mutedUsers: socialRes?.mutedUsers || [],
      notifications: socialRes?.notifications || [],
      savedPostIds: socialRes?.savedPostIds || [],
    }));
  }, [user]);

  const refreshFeed = useCallback(async (params: RefreshFeedParams = {}) => {
    if (!IS_REAL_BACKEND) return;
    const qs = new URLSearchParams();
    qs.set('limit', String(params.limit || 40));
    if (params.scope) qs.set('scope', params.scope);
    if (params.tab) qs.set('tab', params.tab);
    if (params.q) qs.set('q', params.q);
    const feedRes = await apiRequest<{ items?: PostItem[]; trendingTopics?: TrendingTopic[] }>(
      `/feed?${qs.toString()}`
    );
    setState((prev) => ({
      ...prev,
      publicPosts: feedRes?.items || [],
      trendingTopics: feedRes?.trendingTopics || [],
    }));
  }, []);

  const refreshDirectory = useCallback(async (params: RefreshDirectoryParams = {}) => {
    if (!IS_REAL_BACKEND) return;
    const qs = new URLSearchParams();
    if (params.q) qs.set('q', params.q);
    if (params.branch) qs.set('branch', params.branch);
    if (params.year) qs.set('year', params.year);
    const res = await apiRequest<{ items?: PeerUser[] }>(`/directory?${qs.toString()}`);
    setState((prev) => ({ ...prev, discoverableUsers: res?.items || [] }));
  }, []);

  const uploadMediaImage = useCallback(async (fileOrDataUrl: File | string): Promise<UploadMediaResult> => {
    if (!IS_REAL_BACKEND) {
      return { mediaId: null, url: '', exifStripped: true, strippedBytes: 0 };
    }
    if (typeof fileOrDataUrl === 'string') {
      return apiRequest<UploadMediaResult>('/media/upload', {
        method: 'POST',
        body: { dataUrl: fileOrDataUrl },
      });
    }
    const formData = new FormData();
    formData.append('file', fileOrDataUrl);
    return apiRequest<UploadMediaResult>('/media/upload', {
      method: 'POST',
      formData,
    });
  }, []);

  const createPost = useCallback(
    async (payload: CreatePostPayload): Promise<PostItem> => {
      if (!IS_REAL_BACKEND) {
        const space = payload.space === 'personal' ? 'personal' : 'public';
        const mockPost: PostItem = {
          ...payload,
          id: Date.now(),
          content: payload.content,
          username: state.username || 'quantum_dev',
          initials: state.userInitials || 'QD',
          branch: state.branch || 'CSE',
          year: state.year || '3rd',
          timestamp: 'Just now',
          likes: 0,
          comments: 0,
          shares: 0,
        };
        setState((prev) => ({
          ...prev,
          publicPosts: space === 'public' ? [mockPost, ...(prev.publicPosts || [])] : prev.publicPosts,
          personalPosts: space === 'personal' ? [mockPost, ...(prev.personalPosts || [])] : prev.personalPosts,
        }));
        return mockPost;
      }

      const idempotencyKey = `post_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const created = await apiRequest<PostItem>('/posts', {
        method: 'POST',
        headers: { 'Idempotency-Key': idempotencyKey },
        body: payload,
      });

      setState((prev) => {
        if (payload.space === 'personal') {
          const item: AppPersonalPost = {
            ...created,
            audienceLabel: created.groupName || 'Approved Followers',
          };
          return { ...prev, personalPosts: [item, ...(prev.personalPosts || [])] };
        }
        return { ...prev, publicPosts: [created, ...(prev.publicPosts || [])] };
      });
      return created;
    },
    [state.branch, state.userInitials, state.username, state.year]
  );

  const togglePostLike = useCallback(async (postId: string | number) => {
    if (!IS_REAL_BACKEND) {
      setState((prev) => ({
        ...prev,
        publicPosts: (prev.publicPosts || []).map((p) => {
          if (p.id !== postId) return p;
          const nextLiked = !p.isLiked;
          return { ...p, isLiked: nextLiked, likes: Math.max(0, (p.likes || 0) + (nextLiked ? 1 : -1)) };
        }),
        personalPosts: (prev.personalPosts || []).map((p) => {
          if (p.id !== postId) return p;
          const nextLiked = !p.isLiked;
          return { ...p, isLiked: nextLiked, likes: Math.max(0, (p.likes || 0) + (nextLiked ? 1 : -1)) };
        }),
      }));
      return null;
    }
    const res = await apiRequest<{ likes: number; liked: boolean }>(
      `/posts/${encodeURIComponent(postId)}/like`,
      { method: 'POST' }
    );
    setState((prev) => ({
      ...prev,
      publicPosts: (prev.publicPosts || []).map((p) =>
        p.id === postId ? { ...p, likes: res.likes, isLiked: res.liked } : p
      ),
      personalPosts: (prev.personalPosts || []).map((p) =>
        p.id === postId ? { ...p, likes: res.likes, isLiked: res.liked } : p
      ),
    }));
    return res;
  }, []);

  const togglePostSave = useCallback(async (postId: string | number) => {
    if (!IS_REAL_BACKEND) {
      setState((prev) => {
        const exists = (prev.savedPostIds || []).includes(postId);
        return {
          ...prev,
          savedPostIds: exists
            ? (prev.savedPostIds || []).filter((id) => id !== postId)
            : [...(prev.savedPostIds || []), postId],
        };
      });
      return null;
    }
    const res = await apiRequest<{ saved: boolean }>(
      `/posts/${encodeURIComponent(postId)}/save`,
      { method: 'POST' }
    );
    setState((prev) => ({
      ...prev,
      savedPostIds: res.saved
        ? Array.from(new Set([...(prev.savedPostIds || []), postId]))
        : (prev.savedPostIds || []).filter((id) => id !== postId),
    }));
    return res;
  }, []);

  const hidePost = useCallback(async (postId: string | number) => {
    setState((prev) => ({
      ...prev,
      publicPosts: (prev.publicPosts || []).filter((p) => p.id !== postId),
    }));
    if (IS_REAL_BACKEND) {
      await apiRequest(`/posts/${encodeURIComponent(postId)}/hide`, { method: 'POST' });
    }
  }, []);

  const muteAuthor = useCallback(async (username: string) => {
    setState((prev) => ({
      ...prev,
      publicPosts: (prev.publicPosts || []).filter((p) => p.username !== username),
    }));
    if (IS_REAL_BACKEND) {
      await apiRequest('/mutes', { method: 'POST', body: { username } });
      refreshSocialOverview();
    }
  }, [refreshSocialOverview]);

  const unmuteAuthor = useCallback(async (username: string) => {
    setState((prev) => ({
      ...prev,
      mutedUsers: (prev.mutedUsers || []).filter((u) => u.username !== username),
    }));
    if (IS_REAL_BACKEND) {
      await apiRequest(`/mutes/${encodeURIComponent(username)}`, { method: 'DELETE' });
      refreshFeed();
    }
  }, [refreshFeed]);

  const blockAuthor = useCallback(async (username: string, reason = 'User privacy preference') => {
    setState((prev) => ({
      ...prev,
      publicPosts: (prev.publicPosts || []).filter((p) => p.username !== username),
      discoverableUsers: (prev.discoverableUsers || []).filter((u) => u.username !== username),
    }));
    if (IS_REAL_BACKEND) {
      await apiRequest('/blocks', { method: 'POST', body: { username, reason } });
      await Promise.all([refreshSocialOverview(), refreshFeed()]);
    }
  }, [refreshFeed, refreshSocialOverview]);

  const unblockAuthor = useCallback(async (usernameOrId: string | number) => {
    if (!IS_REAL_BACKEND) {
      setState((prev) => ({
        ...prev,
        blockedUsers: (prev.blockedUsers || []).filter(
          (u) => u.username !== usernameOrId && u.id !== usernameOrId
        ),
      }));
      return;
    }
    const target = state.blockedUsers.find(
      (u) => u.username === usernameOrId || u.id === usernameOrId
    );
    const uname = target?.username || String(usernameOrId);
    await apiRequest(`/blocks/${encodeURIComponent(uname)}`, { method: 'DELETE' });
    await Promise.all([refreshSocialOverview(), refreshFeed(), refreshDirectory()]);
  }, [refreshDirectory, refreshFeed, refreshSocialOverview, state.blockedUsers]);

  const submitReport = useCallback(
    async ({ targetType, targetId, reason, details, contentSnippet }: ReportPayload) => {
      if (!IS_REAL_BACKEND) return { status: 'pending' };
      return apiRequest<{ status: string; [key: string]: unknown }>('/reports', {
        method: 'POST',
        body: { targetType, targetId, reason, details, contentSnippet },
      });
    },
    []
  );

  const markReelsSeen = useCallback(async () => {
    const hasUnseen = (state.reels || []).some((r) => r.unseen);
    if (!hasUnseen) return;
    setState((prev) => ({
      ...prev,
      reels: (prev.reels || []).map((r) => (r.unseen ? { ...r, unseen: false } : r)),
    }));
    if (IS_REAL_BACKEND && user) {
      try {
        await apiRequest('/reels/mark-all-seen', { method: 'POST' });
      } catch {
        // ignore transient error
      }
    }
  }, [state.reels, user]);

  const toggleReelLike = useCallback(async (reelId: string | number) => {
    if (!IS_REAL_BACKEND) return null;
    const res = await apiRequest<{ likes: number; liked: boolean }>(
      `/reels/${encodeURIComponent(reelId)}/like`,
      { method: 'POST' }
    );
    setState((prev) => ({
      ...prev,
      reels: (prev.reels || []).map((r) =>
        r.id === reelId ? { ...r, likes: res.likes, likesCount: res.likes, isLiked: res.liked } : r
      ),
    }));
    return res;
  }, []);

  const markNotificationsRead = useCallback(async () => {
    setState((prev) => ({
      ...prev,
      notifications: (prev.notifications || []).map((n) => ({ ...n, isRead: true, read: true })),
    }));
    if (IS_REAL_BACKEND) {
      await apiRequest('/notifications/read-all', { method: 'POST' });
    }
  }, []);

  const deletePost = useCallback(async (postId: string | number) => {
    if (IS_REAL_BACKEND) {
      await apiRequest(`/posts/${encodeURIComponent(postId)}`, { method: 'DELETE' });
    }
    setState((prev) => ({
      ...prev,
      publicPosts: (prev.publicPosts || []).filter((p) => p.id !== postId),
      personalPosts: (prev.personalPosts || []).filter((p) => p.id !== postId),
    }));
  }, []);

  const editPost = useCallback(
    async (
      postId: string | number,
      patch: { title?: string; content: string }
    ): Promise<PostItem> => {
      let updated: PostItem | null = null;
      if (IS_REAL_BACKEND) {
        updated = await apiRequest<PostItem>(`/posts/${encodeURIComponent(postId)}`, {
          method: 'PATCH',
          body: patch,
        });
      }
      const apply = <T extends PostItem>(p: T): T =>
        p.id === postId
          ? ({ ...p, ...(updated || { title: patch.title ?? p.title, content: patch.content }), edited: true } as T)
          : p;
      setState((prev) => ({
        ...prev,
        publicPosts: (prev.publicPosts || []).map(apply),
        personalPosts: (prev.personalPosts || []).map(apply),
      }));
      return (updated || ({ id: postId, ...patch } as unknown as PostItem));
    },
    []
  );

  const markBestAnswer = useCallback(async (postId: string | number, answerId: string) => {
    if (IS_REAL_BACKEND) {
      const res = await apiRequest<{ bestAnswerId: string | null }>(
        `/posts/${encodeURIComponent(postId)}/best-answer`,
        {
          method: 'POST',
          body: { answerId },
        }
      );
      setState((prev) => ({
        ...prev,
        publicPosts: (prev.publicPosts || []).map((p) =>
          p.id === postId ? { ...p, bestAnswerId: res.bestAnswerId } : p
        ),
      }));
      return;
    }
    setState((prev) => ({
      ...prev,
      publicPosts: (prev.publicPosts || []).map((p) =>
        p.id === postId
          ? { ...p, bestAnswerId: p.bestAnswerId === answerId ? null : answerId }
          : p
      ),
    }));
  }, []);

  const addPostAnswer = useCallback(
    async (postId: string | number, replyOrText: string | PostAnswer): Promise<PostAnswer> => {
      if (IS_REAL_BACKEND) {
        const text = typeof replyOrText === 'string' ? replyOrText : replyOrText?.text || '';
        const created = await apiRequest<PostAnswer>(
          `/posts/${encodeURIComponent(postId)}/answers`,
          {
            method: 'POST',
            body: { text },
          }
        );
        setState((prev) => ({
          ...prev,
          publicPosts: (prev.publicPosts || []).map((p) => {
            if (p.id !== postId) return p;
            const existing = Array.isArray(p.answers) ? p.answers : [];
            return { ...p, answers: [...existing, created], comments: existing.length + 1 };
          }),
        }));
        return created;
      }

      const answerObj: PostAnswer =
        typeof replyOrText === 'string'
          ? {
              id: String(Date.now()),
              username: state.username || 'quantum_dev',
              initials: state.userInitials || 'QD',
              text: replyOrText,
              timestamp: 'Just now',
            }
          : replyOrText;

      setState((prev) => ({
        ...prev,
        publicPosts: (prev.publicPosts || []).map((p) => {
          if (p.id !== postId) return p;
          const existing = Array.isArray(p.answers) ? p.answers : [];
          return {
            ...p,
            answers: [...existing, answerObj],
            comments: existing.length + 1,
          };
        }),
      }));
      return answerObj;
    },
    [state.userInitials, state.username]
  );

  const toggleProfileVisibility = useCallback(async (makePublic: boolean) => {
    setState((prev) => ({ ...prev, profilePublic: Boolean(makePublic) }));
    if (IS_REAL_BACKEND && user) {
      await updateProfile({ profilePublic: Boolean(makePublic) });
    }
  }, [updateProfile, user]);

  const toggleDiscoverability = useCallback(async (enabled: boolean) => {
    setState((prev) => ({ ...prev, discoverableByBranch: Boolean(enabled) }));
    if (IS_REAL_BACKEND && user) {
      await updateProfile({ discoverableByBranch: Boolean(enabled) });
      refreshDirectory();
    }
  }, [refreshDirectory, updateProfile, user]);

  const updatePrivacySetting = useCallback(async (patch: Partial<AppState> & Partial<UserProfile>) => {
    setState((prev) => ({ ...prev, ...patch }));
    if (IS_REAL_BACKEND && user) {
      await updateProfile(patch);
    }
  }, [updateProfile, user]);

  const requestFollow = useCallback(async (username: string) => {
    if (!IS_REAL_BACKEND) return { status: 'requested' };
    const res = await apiRequest<{ status: string; [key: string]: unknown }>('/follow-requests', {
      method: 'POST',
      body: { targetUsername: username },
    });
    setState((prev) => ({
      ...prev,
      discoverableUsers: (prev.discoverableUsers || []).map((u) =>
        u.username === username
          ? {
              ...u,
              isRequested: res.status === 'requested',
              isFollowing: res.status === 'following',
            }
          : u
      ),
    }));
    if (res.status === 'following') refreshSocialOverview();
    return res;
  }, [refreshSocialOverview]);

  const respondFollowRequest = useCallback(
    async (
      requestId: string | number,
      action: 'accept' | 'decline' | string,
      groupName = 'Close Friends'
    ) => {
      if (!IS_REAL_BACKEND) {
        setState((prev) => {
          const req = (prev.followRequests || []).find((r) => r.id === requestId);
          const remaining = (prev.followRequests || []).filter((r) => r.id !== requestId);
          if (action !== 'accept' || !req) {
            return { ...prev, followRequests: remaining };
          }
          const acceptedFollower: AppFollowerItem = {
            id: req.id,
            username: req.username,
            initials: req.initials || req.username.slice(0, 2).toUpperCase(),
            branch: req.branch,
            year: req.year,
            group: groupName,
            groups: [groupName],
          };
          return {
            ...prev,
            followRequests: remaining,
            followers: [...(prev.followers || []), acceptedFollower],
            followersCount: (prev.followersCount || 0) + 1,
          };
        });
        return;
      }
      await apiRequest(`/follow-requests/${encodeURIComponent(requestId)}/respond`, {
        method: 'POST',
        body: { action, groupName },
      });
      await refreshSocialOverview();
    },
    [refreshSocialOverview]
  );

  const removeFollower = useCallback(async (username: string) => {
    setState((prev) => ({
      ...prev,
      followers: (prev.followers || []).filter((f) => f.username !== username),
      followersCount: Math.max(0, (prev.followersCount || 1) - 1),
    }));
    if (IS_REAL_BACKEND) {
      await apiRequest(`/followers/${encodeURIComponent(username)}`, { method: 'DELETE' });
    }
  }, []);

  const unfollowUser = useCallback(async (username: string) => {
    setState((prev) => ({
      ...prev,
      following: (prev.following || []).filter((f) => f.username !== username),
      followingCount: Math.max(0, (prev.followingCount || 1) - 1),
    }));
    if (IS_REAL_BACKEND) {
      await apiRequest(`/following/${encodeURIComponent(username)}`, { method: 'DELETE' });
    }
  }, []);

  const createThread = useCallback(async (content: string): Promise<ThreadItem> => {
    if (!IS_REAL_BACKEND) {
      const mockThread: ThreadItem = {
        id: Date.now(),
        username: state.username || 'quantum_dev',
        initials: state.userInitials || 'QD',
        content,
        timestamp: 'Just now',
        likes: 0,
        replyCount: 0,
        replies: [],
      };
      setState((prev) => ({ ...prev, threadPosts: [mockThread, ...(prev.threadPosts || [])] }));
      return mockThread;
    }
    const created = await apiRequest<ThreadItem>('/threads', { method: 'POST', body: { content } });
    setState((prev) => ({ ...prev, threadPosts: [created, ...(prev.threadPosts || [])] }));
    return created;
  }, [state.userInitials, state.username]);

  const toggleThreadLike = useCallback(async (threadId: string | number) => {
    if (!IS_REAL_BACKEND) return null;
    const res = await apiRequest<{ likes: number; liked: boolean }>(
      `/threads/${encodeURIComponent(threadId)}/like`,
      { method: 'POST' }
    );
    setState((prev) => ({
      ...prev,
      threadPosts: (prev.threadPosts || []).map((t) =>
        t.id === threadId ? { ...t, likes: res.likes, isLiked: res.liked } : t
      ),
    }));
    return res;
  }, []);

  const addThreadReply = useCallback(async (threadId: string | number, content: string): Promise<AppThreadReply> => {
    if (!IS_REAL_BACKEND) {
      const reply: AppThreadReply = {
        id: Date.now(),
        username: state.username || 'quantum_dev',
        initials: state.userInitials || 'QD',
        content,
        timestamp: 'Just now',
        likes: 0,
      };
      setState((prev) => ({
        ...prev,
        threadPosts: (prev.threadPosts || []).map((t) =>
          t.id === threadId
            ? { ...t, replyCount: (t.replyCount || 0) + 1, replies: [...(t.replies || []), reply] }
            : t
        ),
      }));
      return reply;
    }
    const created = await apiRequest<AppThreadReply>(
      `/threads/${encodeURIComponent(threadId)}/replies`,
      {
        method: 'POST',
        body: { content },
      }
    );
    setState((prev) => ({
      ...prev,
      threadPosts: (prev.threadPosts || []).map((t) =>
        t.id === threadId
          ? { ...t, replyCount: (t.replyCount || 0) + 1, replies: [...(t.replies || []), created] }
          : t
      ),
    }));
    return created;
  }, [state.userInitials, state.username]);

  return (
    <AppContext.Provider
      value={{
        state,
        updateState,
        hydrateFromBackend,
        refreshFeed,
        refreshDirectory,
        refreshSocialOverview,
        uploadMediaImage,
        createPost,
        togglePostLike,
        togglePostSave,
        hidePost,
        muteAuthor,
        unmuteAuthor,
        blockAuthor,
        unblockAuthor,
        submitReport,
        markReelsSeen,
        toggleReelLike,
        markBestAnswer,
        markNotificationsRead,
        deletePost,
        editPost,
        addPostAnswer,
        toggleProfileVisibility,
        toggleDiscoverability,
        updatePrivacySetting,
        requestFollow,
        respondFollowRequest,
        removeFollower,
        unfollowUser,
        createThread,
        toggleThreadLike,
        addThreadReply,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export const useApp = (): AppContextValue => {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error('useApp must be used inside AppProvider');
  }
  return ctx;
};
