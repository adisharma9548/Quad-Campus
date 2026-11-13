import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { API_BASE_URL, ApiError, IS_REAL_BACKEND, apiRequest, getAuthToken } from '../services/apiClient';
import {
  insertReplyIntoTree,
  mergeBranchChildren,
  removeReplyFromTree,
  replaceTempReplyInTree,
  setReplyReportedInTree,
} from '../utils/threadTree';
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
  threadsHasMore?: boolean;
  discoverableUsers: PeerUser[];
  whoToFollow: PeerUser[];
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
  refreshWhoToFollow: (limit?: number) => Promise<void>;
  refreshSocialOverview: () => Promise<void>;
  uploadMediaImage: (fileOrDataUrl: File | string) => Promise<UploadMediaResult>;
  createPost: (payload: CreatePostPayload) => Promise<PostItem>;
  togglePostLike: (postId: string | number) => Promise<{ likes: number; liked: boolean } | null>;
  togglePostSave: (postId: string | number) => Promise<{ saved: boolean } | null>;
  hidePost: (postId: string | number) => Promise<void>;
  hideReel: (reelId: string | number) => Promise<void>;
  unhideReel: (reelId: string | number) => Promise<void>;
  muteAuthor: (username: string) => Promise<void>;
  unmuteAuthor: (username: string) => Promise<void>;
  blockAuthor: (username: string, reason?: string) => Promise<void>;
  unblockAuthor: (usernameOrId: string | number) => Promise<void>;
  submitReport: (payload: ReportPayload) => Promise<{ status: string; [key: string]: unknown }>;
  createReel: (
    formData: FormData,
    options?: {
      onProgress?: (percent: number) => void;
      signal?: AbortSignal;
    }
  ) => Promise<AppReelItem>;
  searchMentionUsers: (query: string) => Promise<PeerUser[]>;
  markReelsSeen: () => Promise<void>;
  recordReelView: (reelId: string | number) => Promise<void>;
  toggleReelLike: (reelId: string | number) => Promise<{ likes: number; liked: boolean } | null>;
  updateReelCommentCount: (reelId: string | number, nextCount: number) => void;
  markBestAnswer: (postId: string | number, answerId: string) => Promise<void>;
  markNotificationsRead: () => Promise<void>;
  deletePost: (postId: string | number) => Promise<void>;
  deleteReel: (reelId: string | number) => Promise<void>;
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
  addThreadReply: (
    threadId: string | number,
    content: string,
    options?: { parentCommentId?: string | number | null; replyToUsername?: string | null }
  ) => Promise<AppThreadReply>;
  loadMoreThreadReplies: (threadId: string | number, parentCommentId: string | number) => Promise<void>;
  loadMoreThreads: () => Promise<void>;
  deleteThreadReply: (threadId: string | number, replyId: string | number) => Promise<void>;
  reportThreadComment: (
    threadId: string | number,
    comment: AppThreadReply,
    reason: string,
    details?: string
  ) => Promise<'reported' | 'already_reported'>;
  undoThreadCommentReport: (threadId: string | number, replyId: string | number) => Promise<void>;
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
    threadsHasMore: false,
    discoverableUsers: [],
    whoToFollow: [],
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
  reels: [],
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
          threadId: 401,
          parentCommentId: null,
          username: 'binary_bard',
          initials: 'BB',
          content: 'Hand-rolling gives you much better custom compiler error spans for diagnostics. The visitor pattern gets verbose very quickly in C++.',
          timestamp: '20m ago',
          likes: 8,
          replies: [
            {
              id: 4012,
              threadId: 401,
              parentCommentId: 4011,
              replyToUsername: 'binary_bard',
              username: 'compiler_fan',
              initials: 'CF',
              content: 'Good call! Pratt parsing for expressions + recursive descent for statements felt super clean.',
              timestamp: '12m ago',
              likes: 4,
              replies: [],
            },
          ],
        },
      ],
    },
  ],
  discoverableUsers: [
    {
      id: 1,
      username: 'tech_titan',
      initials: 'TT',
      branch: 'CSE',
      year: '3rd',
      bio: 'Backend infrastructure & systems',
      directoryVisible: true,
    },
  ],
  whoToFollow: [
    {
      id: 1,
      username: 'tech_titan',
      initials: 'TT',
      branch: 'CSE',
      year: '3rd',
      bio: 'Backend infrastructure & systems',
      directoryVisible: true,
    },
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
      const [feedRes, personalRes, reelsRes, threadsRes, directoryRes, whoRes, socialRes, eventsRes] =
        await Promise.all([
          apiRequest<{ items?: PostItem[]; trendingTopics?: TrendingTopic[] }>('/feed?limit=40'),
          apiRequest<{ items?: AppPersonalPost[] }>('/feed/personal'),
          apiRequest<{ items?: AppReelItem[] }>('/reels'),
          apiRequest<{ items?: ThreadItem[]; hasMore?: boolean }>('/threads?limit=15&offset=0'),
          apiRequest<{ items?: PeerUser[] }>('/directory?limit=40'),
          apiRequest<{ items?: PeerUser[] }>('/who-to-follow?limit=3').catch(() => ({ items: [] })),
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
        threadsHasMore: Boolean(threadsRes?.hasMore),
        discoverableUsers: directoryRes?.items || [],
        whoToFollow: whoRes?.items || [],
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

  const refreshWhoToFollow = useCallback(async (limit = 3) => {
    if (!IS_REAL_BACKEND) return;
    const res = await apiRequest<{ items?: PeerUser[] }>(`/who-to-follow?limit=${limit}`);
    setState((prev) => ({ ...prev, whoToFollow: res?.items || [] }));
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
    const clean = username.toLowerCase();
    setState((prev) => ({
      ...prev,
      publicPosts: (prev.publicPosts || []).filter((p) => p.username.toLowerCase() !== clean),
      reels: (prev.reels || []).filter((r) => r.username.toLowerCase() !== clean),
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
    const clean = username.toLowerCase();
    setState((prev) => ({
      ...prev,
      publicPosts: (prev.publicPosts || []).filter((p) => p.username.toLowerCase() !== clean),
      reels: (prev.reels || []).filter((r) => r.username.toLowerCase() !== clean),
      discoverableUsers: (prev.discoverableUsers || []).filter((u) => u.username.toLowerCase() !== clean),
      whoToFollow: (prev.whoToFollow || []).filter((u) => u.username.toLowerCase() !== clean),
    }));
    if (IS_REAL_BACKEND) {
      await apiRequest('/blocks', { method: 'POST', body: { username, reason } });
      await Promise.all([
        refreshSocialOverview(),
        refreshFeed(),
        refreshDirectory(),
        refreshWhoToFollow(),
      ]);
    }
  }, [refreshDirectory, refreshFeed, refreshSocialOverview, refreshWhoToFollow]);

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
    await Promise.all([
      refreshSocialOverview(),
      refreshFeed(),
      refreshDirectory(),
      refreshWhoToFollow(),
    ]);
  }, [refreshDirectory, refreshFeed, refreshSocialOverview, refreshWhoToFollow, state.blockedUsers]);

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

  const createReel = useCallback(
    async (
      formData: FormData,
      options?: { onProgress?: (percent: number) => void; signal?: AbortSignal }
    ): Promise<AppReelItem> => {
      if (!IS_REAL_BACKEND) {
        const caption = String(formData.get('caption') || '');
        const rawDur = Number(formData.get('durationSec'));
        const trimStartVal = Number(formData.get('trimStart') || 0);
        const trimEndVal = Number(formData.get('trimEnd') || (Number.isFinite(rawDur) ? rawDur : 0));
        const realSec =
          Number.isFinite(trimEndVal) && trimEndVal > trimStartVal
            ? Math.max(0, trimEndVal - trimStartVal)
            : Number.isFinite(rawDur) && rawDur > 0
              ? rawDur
              : undefined;
        const formattedDur =
          realSec !== undefined && realSec > 0
            ? `${Math.floor(Math.round(realSec) / 60)}:${Math.round(realSec) % 60 < 10 ? '0' : ''}${Math.round(realSec) % 60}`
            : '';
        const mockReel: AppReelItem = {
          id: Date.now(),
          username: state.username || 'quantum_dev',
          initials: state.userInitials || 'QD',
          branch: state.branch || 'CSE',
          year: (state.year || '3rd').replace(/\s*Year$/i, ''),
          caption,
          tag: 'Campus Reel',
          duration: formattedDur,
          durationSec: realSec,
          trimStart: trimStartVal,
          trimEnd: Number.isFinite(trimEndVal) ? trimEndVal : undefined,
          fitMode: formData.get('fitMode') === 'fit' ? 'fit' : 'crop',
          audience: formData.get('audience') === 'followers' ? 'followers' : 'campus',
          commentsEnabled: formData.get('commentsEnabled') !== 'false',
          views: '0',
          likes: 0,
          comments: 0,
          shares: 0,
          unseen: false,
        };
        options?.onProgress?.(100);
        setState((prev) => ({ ...prev, reels: [mockReel, ...(prev.reels || [])] }));
        return mockReel;
      }

      const created = await new Promise<AppReelItem>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${API_BASE_URL}/reels`);
        xhr.withCredentials = true;
        const token = getAuthToken();
        if (token) {
          xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        }

        const handleAbortSignal = () => {
          xhr.abort();
        };
        if (options?.signal) {
          if (options.signal.aborted) {
            xhr.abort();
            reject(new ApiError('Upload cancelled', 'UPLOAD_CANCELLED', 0));
            return;
          }
          options.signal.addEventListener('abort', handleAbortSignal, { once: true });
        }

        xhr.upload.onprogress = (ev) => {
          if (ev.lengthComputable && ev.total > 0) {
            const pct = Math.min(99, Math.round((ev.loaded / ev.total) * 100));
            options?.onProgress?.(pct);
          }
        };

        xhr.onabort = () => {
          options?.signal?.removeEventListener('abort', handleAbortSignal);
          reject(new ApiError('Upload cancelled', 'UPLOAD_CANCELLED', 0));
        };

        xhr.onerror = () => {
          options?.signal?.removeEventListener('abort', handleAbortSignal);
          reject(new ApiError('Network error while uploading reel.', 'NETWORK_ERROR', 0));
        };

        xhr.onload = () => {
          options?.signal?.removeEventListener('abort', handleAbortSignal);
          let payload: Record<string, unknown> = {};
          try {
            payload = JSON.parse(xhr.responseText || '{}') as Record<string, unknown>;
          } catch {
            payload = {};
          }
          if (xhr.status >= 200 && xhr.status < 300) {
            options?.onProgress?.(100);
            resolve(payload as unknown as AppReelItem);
          } else {
            const errObj = (payload.error || {}) as { message?: string; code?: string };
            reject(
              new ApiError(
                errObj.message || 'Reel upload failed.',
                errObj.code || 'UPLOAD_FAILED',
                xhr.status
              )
            );
          }
        };

        xhr.send(formData);
      });

      setState((prev) => ({
        ...prev,
        reels: [created, ...(prev.reels || []).filter((r) => String(r.id) !== String(created.id))],
      }));
      return created;
    },
    [state.branch, state.userInitials, state.username, state.year]
  );

  // Poll any processing reels belonging to the uploader until FFmpeg transcode finishes
  useEffect(() => {
    if (!IS_REAL_BACKEND) return;
    const processingIds = (state.reels || [])
      .filter((r) => r.status === 'processing')
      .map((r) => String(r.id));
    if (processingIds.length === 0) return;

    let cancelled = false;
    const poll = async () => {
      for (const id of processingIds) {
        if (cancelled) return;
        try {
          const updated = await apiRequest<AppReelItem>(`/reels/${encodeURIComponent(id)}`);
          if (!cancelled && updated && updated.id) {
            setState((prev) => ({
              ...prev,
              reels: (prev.reels || []).map((r) => (String(r.id) === String(id) ? { ...r, ...updated } : r)),
            }));
          }
        } catch {
          // ignore transient polling errors
        }
      }
    };

    const timer = window.setInterval(() => {
      void poll();
    }, 1200);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [state.reels]);

  const searchMentionUsers = useCallback(
    async (query: string): Promise<PeerUser[]> => {
      const q = query.trim().toLowerCase();
      if (!IS_REAL_BACKEND) {
        return (state.discoverableUsers || [])
          .filter((u) => !q || u.username.toLowerCase().includes(q))
          .slice(0, 6);
      }
      const res = await apiRequest<{ items?: PeerUser[] }>(
        `/users/search?q=${encodeURIComponent(q)}&limit=6`
      );
      return res?.items || [];
    },
    [state.discoverableUsers]
  );

  const recordReelView = useCallback(async (reelId: string | number) => {
    if (!IS_REAL_BACKEND) return;
    try {
      const res = await apiRequest<{ seen: boolean; counted: boolean; viewsCount: number }>(
        `/reels/${reelId}/view`,
        { method: 'POST' }
      );
      if (res && typeof res.viewsCount === 'number') {
        setState((prev) => ({
          ...prev,
          reels: (prev.reels || []).map((r) =>
            String(r.id) === String(reelId)
              ? { ...r, views: String(res.viewsCount), unseen: false }
              : r
          ),
        }));
      }
    } catch {
      // ignore transient view reporting error
    }
  }, []);

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

  const updateReelCommentCount = useCallback((reelId: string | number, nextCount: number) => {
    const safeCount = Math.max(0, Number(nextCount) || 0);
    setState((prev) => ({
      ...prev,
      reels: (prev.reels || []).map((r) =>
        String(r.id) === String(reelId)
          ? { ...r, comments: safeCount, commentsCount: safeCount }
          : r
      ),
    }));
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

  const deleteReel = useCallback(async (reelId: string | number) => {
    const idStr = String(reelId);
    let previousReels: AppReelItem[] = [];
    setState((prev) => {
      previousReels = prev.reels || [];
      return {
        ...prev,
        reels: previousReels.filter((r) => String(r.id) !== idStr),
      };
    });
    try {
      if (IS_REAL_BACKEND) {
        await apiRequest(`/reels/${encodeURIComponent(idStr)}`, { method: 'DELETE' });
      }
    } catch (err) {
      setState((prev) => ({
        ...prev,
        reels: previousReels,
      }));
      throw err;
    }
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
      await updateProfile({
        discoverableByBranch: Boolean(enabled),
        directoryVisible: Boolean(enabled),
      });
      await Promise.all([refreshDirectory(), refreshWhoToFollow()]);
    }
  }, [refreshDirectory, refreshWhoToFollow, updateProfile, user]);

  const updatePrivacySetting = useCallback(async (patch: Partial<AppState> & Partial<UserProfile>) => {
    setState((prev) => ({ ...prev, ...patch }));
    if (IS_REAL_BACKEND && user) {
      await updateProfile(patch);
      if (patch.discoverableByBranch !== undefined || patch.directoryVisible !== undefined) {
        await Promise.all([refreshDirectory(), refreshWhoToFollow()]);
      }
    }
  }, [refreshDirectory, refreshWhoToFollow, updateProfile, user]);

  const hideReel = useCallback(async (reelId: string | number) => {
    setState((prev) => ({
      ...prev,
      reels: (prev.reels || []).filter((r) => String(r.id) !== String(reelId)),
    }));
    if (IS_REAL_BACKEND) {
      await apiRequest(`/reels/${encodeURIComponent(String(reelId))}/hide`, { method: 'POST' });
    }
  }, []);

  const unhideReel = useCallback(async (reelId: string | number) => {
    if (IS_REAL_BACKEND) {
      await apiRequest(`/reels/${encodeURIComponent(String(reelId))}/hide`, { method: 'DELETE' });
      const res = await apiRequest<{ items?: ReelItem[] }>('/reels');
      if (Array.isArray(res.items)) {
        setState((prev) => ({ ...prev, reels: res.items! }));
      }
    }
  }, []);

  const requestFollow = useCallback(async (username: string) => {
    const cleanTarget = username.toLowerCase();
    if (!IS_REAL_BACKEND) {
      setState((prev) => ({
        ...prev,
        discoverableUsers: (prev.discoverableUsers || []).filter((u) => u.username !== username),
        whoToFollow: (prev.whoToFollow || []).filter((u) => u.username !== username),
        reels: (prev.reels || []).map((r) =>
          r.username.toLowerCase() === cleanTarget ? { ...r, followStatus: 'requested' } : r
        ),
      }));
      return { status: 'requested' };
    }
    const res = await apiRequest<{ status: string; [key: string]: unknown }>('/follow-requests', {
      method: 'POST',
      body: { targetUsername: username },
    });
    const nextFollowStatus: 'following' | 'requested' =
      res.status === 'following' ? 'following' : 'requested';
    setState((prev) => ({
      ...prev,
      discoverableUsers: (prev.discoverableUsers || []).filter((u) => u.username !== username),
      whoToFollow: (prev.whoToFollow || []).filter((u) => u.username !== username),
      reels: (prev.reels || []).map((r) =>
        r.username.toLowerCase() === cleanTarget ? { ...r, followStatus: nextFollowStatus } : r
      ),
    }));
    await Promise.all([
      res.status === 'following' ? refreshSocialOverview() : Promise.resolve(),
      refreshDirectory(),
      refreshWhoToFollow(),
    ]);
    return res;
  }, [refreshDirectory, refreshSocialOverview, refreshWhoToFollow]);

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
      await Promise.all([refreshSocialOverview(), refreshDirectory(), refreshWhoToFollow()]);
    },
    [refreshDirectory, refreshSocialOverview, refreshWhoToFollow]
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
      await Promise.all([refreshDirectory(), refreshWhoToFollow()]);
    }
  }, [refreshDirectory, refreshWhoToFollow]);

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

  const addThreadReply = useCallback(
    async (
      threadId: string | number,
      content: string,
      options?: { parentCommentId?: string | number | null; replyToUsername?: string | null }
    ): Promise<AppThreadReply> => {
      const parentCommentId = options?.parentCommentId ?? null;
      const replyToUsername = options?.replyToUsername ?? null;

      if (!IS_REAL_BACKEND) {
        const reply: AppThreadReply = {
          id: Date.now(),
          threadId,
          parentCommentId,
          replyToUsername,
          username: state.username || 'quantum_dev',
          initials: state.userInitials || 'QD',
          content,
          body: content,
          timestamp: 'Just now',
          likes: 0,
          replies: [],
        };
        setState((prev) => ({
          ...prev,
          threadPosts: (prev.threadPosts || []).map((t) =>
            t.id === threadId
              ? {
                  ...t,
                  replyCount: (t.replyCount || 0) + 1,
                  replies: insertReplyIntoTree(t.replies || [], parentCommentId, reply),
                }
              : t
          ),
        }));
        return reply;
      }

      const tempId = `temp_reply_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const optimisticReply: AppThreadReply = {
        id: tempId,
        threadId,
        parentCommentId,
        replyToUsername,
        username: state.username || 'student',
        initials: state.userInitials || 'ST',
        content,
        body: content,
        timestamp: 'Sending...',
        likes: 0,
        replies: [],
      };

      setState((prev) => ({
        ...prev,
        threadPosts: (prev.threadPosts || []).map((t) =>
          t.id === threadId
            ? {
                ...t,
                replyCount: (t.replyCount || 0) + 1,
                replies: insertReplyIntoTree(t.replies || [], parentCommentId, optimisticReply),
              }
            : t
        ),
      }));

      try {
        const created = await apiRequest<AppThreadReply>(
          `/threads/${encodeURIComponent(threadId)}/replies`,
          {
            method: 'POST',
            body: { content, body: content, parentCommentId },
          }
        );
        setState((prev) => ({
          ...prev,
          threadPosts: (prev.threadPosts || []).map((t) =>
            t.id === threadId
              ? {
                  ...t,
                  replies: replaceTempReplyInTree(t.replies || [], tempId, created),
                }
              : t
          ),
        }));
        return created;
      } catch (err) {
        // Rollback optimistic reply on failure
        setState((prev) => ({
          ...prev,
          threadPosts: (prev.threadPosts || []).map((t) =>
            t.id === threadId
              ? {
                  ...t,
                  replyCount: Math.max(0, (t.replyCount || 1) - 1),
                  replies: removeReplyFromTree(t.replies || [], tempId).nodes,
                }
              : t
          ),
        }));
        throw err;
      }
    },
    [state.userInitials, state.username]
  );

  const loadMoreThreadReplies = useCallback(
    async (threadId: string | number, parentCommentId: string | number): Promise<void> => {
      if (!IS_REAL_BACKEND) return;
      const res = await apiRequest<{ items?: AppThreadReply[] }>(
        `/threads/${encodeURIComponent(threadId)}/replies?parentId=${encodeURIComponent(parentCommentId)}&maxDepth=3`
      );
      setState((prev) => ({
        ...prev,
        threadPosts: (prev.threadPosts || []).map((t) =>
          t.id === threadId
            ? {
                ...t,
                replies: mergeBranchChildren(t.replies || [], parentCommentId, res?.items || []),
              }
            : t
        ),
      }));
    },
    []
  );

  const loadMoreThreads = useCallback(async (): Promise<void> => {
    if (!IS_REAL_BACKEND) return;
    const offset = state.threadPosts?.length || 0;
    const res = await apiRequest<{ items?: ThreadItem[]; hasMore?: boolean }>(
      `/threads?limit=15&offset=${offset}`
    );
    setState((prev) => {
      const existingIds = new Set((prev.threadPosts || []).map((t) => String(t.id)));
      const incoming = (res?.items || []).filter((t) => !existingIds.has(String(t.id)));
      return {
        ...prev,
        threadPosts: [...(prev.threadPosts || []), ...incoming],
        threadsHasMore: Boolean(res?.hasMore),
      };
    });
  }, [state.threadPosts]);

  const deleteThreadReply = useCallback(
    async (threadId: string | number, replyId: string | number): Promise<void> => {
      const previousThreads = state.threadPosts;
      setState((prev) => ({
        ...prev,
        threadPosts: (prev.threadPosts || []).map((t) => {
          if (t.id !== threadId) return t;
          const res = removeReplyFromTree(t.replies || [], replyId);
          return {
            ...t,
            replyCount:
              res.changed && !res.softDeleted
                ? Math.max(0, (t.replyCount || 1) - 1)
                : t.replyCount,
            replies: res.nodes,
          };
        }),
      }));

      if (!IS_REAL_BACKEND) return;

      try {
        await apiRequest(
          `/threads/${encodeURIComponent(threadId)}/replies/${encodeURIComponent(replyId)}`,
          { method: 'DELETE' }
        );
      } catch (err) {
        setState((prev) => ({ ...prev, threadPosts: previousThreads }));
        throw err;
      }
    },
    [state.threadPosts]
  );

  const reportThreadComment = useCallback(
    async (
      threadId: string | number,
      comment: AppThreadReply,
      reason: string,
      details?: string
    ): Promise<'reported' | 'already_reported'> => {
      if (comment.reportedByMe) {
        return 'already_reported';
      }

      if (!IS_REAL_BACKEND) {
        setState((prev) => ({
          ...prev,
          threadPosts: (prev.threadPosts || []).map((t) =>
            t.id === threadId
              ? { ...t, replies: setReplyReportedInTree(t.replies || [], comment.id, true) }
              : t
          ),
        }));
        return 'reported';
      }

      try {
        await submitReport({
          targetType: 'thread_comment',
          targetId: String(comment.id),
          reason,
          details,
          contentSnippet: (comment.content || '').slice(0, 180),
        });
        setState((prev) => ({
          ...prev,
          threadPosts: (prev.threadPosts || []).map((t) =>
            t.id === threadId
              ? { ...t, replies: setReplyReportedInTree(t.replies || [], comment.id, true) }
              : t
          ),
        }));
        return 'reported';
      } catch (err) {
        const msg = err instanceof Error ? err.message : '';
        if (msg.toLowerCase().includes('already reported')) {
          setState((prev) => ({
            ...prev,
            threadPosts: (prev.threadPosts || []).map((t) =>
              t.id === threadId
                ? { ...t, replies: setReplyReportedInTree(t.replies || [], comment.id, true) }
                : t
            ),
          }));
          return 'already_reported';
        }
        throw err;
      }
    },
    [submitReport]
  );

  const undoThreadCommentReport = useCallback(
    async (threadId: string | number, replyId: string | number): Promise<void> => {
      setState((prev) => ({
        ...prev,
        threadPosts: (prev.threadPosts || []).map((t) =>
          t.id === threadId
            ? { ...t, replies: setReplyReportedInTree(t.replies || [], replyId, false) }
            : t
        ),
      }));

      if (!IS_REAL_BACKEND) return;

      try {
        await apiRequest(`/reports/target/thread_comment/${encodeURIComponent(replyId)}`, {
          method: 'DELETE',
        });
      } catch (err) {
        setState((prev) => ({
          ...prev,
          threadPosts: (prev.threadPosts || []).map((t) =>
            t.id === threadId
              ? { ...t, replies: setReplyReportedInTree(t.replies || [], replyId, true) }
              : t
          ),
        }));
        throw err;
      }
    },
    []
  );

  return (
    <AppContext.Provider
      value={{
        state,
        updateState,
        hydrateFromBackend,
        refreshFeed,
        refreshDirectory,
        refreshWhoToFollow,
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
        createReel,
        searchMentionUsers,
        markReelsSeen,
        recordReelView,
        toggleReelLike,
        updateReelCommentCount,
        markBestAnswer,
        markNotificationsRead,
        deletePost,
        deleteReel,
        editPost,
        addPostAnswer,
        toggleProfileVisibility,
        toggleDiscoverability,
        updatePrivacySetting,
        requestFollow,
        respondFollowRequest,
        removeFollower,
        unfollowUser,
        hideReel,
        unhideReel,
        createThread,
        toggleThreadLike,
        addThreadReply,
        loadMoreThreadReplies,
        loadMoreThreads,
        deleteThreadReply,
        reportThreadComment,
        undoThreadCommentReport,
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
