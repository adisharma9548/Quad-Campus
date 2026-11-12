export type PostType =
  | 'Question'
  | 'Tip'
  | 'Update'
  | 'Event'
  | 'Resource'
  | 'Discussion';

export type ScreenId =
  | 'feed'
  | 'discover'
  | 'reels'
  | 'threads'
  | 'create'
  | 'profile'
  | 'requests'
  | 'safety'
  | 'blockreport'
  | 'settings'
  | 'terms'
  | 'designsystem'
  | 'welcome'
  | 'signup'
  | 'login'
  | 'forgot_password'
  | 'splash'
  | 'verify'
  | 'onboarding';

export type NavigateFn = (screen: ScreenId | string) => void;

export interface PostAnswer {
  id: string;
  username: string;
  initials: string;
  text: string;
  timestamp: string;
}

export interface PostItem {
  id: string | number;
  type?: PostType | string;
  title?: string;
  content: string;
  username: string;
  initials?: string;
  branch?: string;
  year?: string;
  space?: 'public' | 'personal' | string;
  audience?: string;
  audienceLabel?: string;
  groupName?: string;
  timestamp: string;
  createdAt?: string | number;
  edited?: boolean;
  likes: number;
  isLiked?: boolean;
  comments?: number;
  shares?: number;
  hashtags?: string[];
  hasImage?: boolean;
  mediaId?: string | number | null;
  mediaUrl?: string;
  mediaKey?: string;
  location?: string;
  imageAlt?: string;
  answers?: PostAnswer[];
  bestAnswerId?: string | null;
}

export interface ReelItem {
  id: string | number;
  username: string;
  initials: string;
  branch?: string;
  year?: string;
  tag: string;
  duration: string;
  caption: string;
  views?: string | number;
  likes: number;
  isLiked?: boolean;
  comments: number;
  shares?: number;
  unseen?: boolean;
  posterKey?: string;
  posterUrl?: string;
  posterAlt?: string;
  mediaUrl?: string;
  videoUrl?: string;
  coverUrl?: string;
  durationSec?: number;
  trimStart?: number;
  trimEnd?: number;
  fitMode?: 'fit' | 'crop';
  audience?: 'campus' | 'followers';
  commentsEnabled?: boolean;
  mentions?: string[];
  hashtags?: string[];
}

export interface ReelCommentItem {
  id: string;
  username: string;
  initials: string;
  content: string;
  timestamp: string;
}

export interface SignUpPayload {
  email: string;
  password: string;
  fullName: string;
  dob: string;
  department: string;
  year: string;
  section: string;
  username: string;
  bio?: string;
  avatarInitials?: string;
  interests?: string[];
  following?: string[];
}

export interface LoginCredentials {
  identifier: string;
  password: string;
}

export interface UsernameCheckResult {
  available: boolean;
  suggestions?: string[];
  message?: string;
}

export interface ThreadReply {
  id: string | number;
  threadId?: string | number;
  parentCommentId?: string | number | null;
  replyToUserId?: string | null;
  replyToUsername?: string | null;
  username: string;
  initials: string;
  content: string;
  body?: string;
  timestamp: string;
  createdAt?: string;
  likes?: number;
  isDeleted?: boolean;
  hasMoreReplies?: boolean;
  hiddenReplyCount?: number;
  reportedByMe?: boolean;
  replies?: ThreadReply[];
}

export interface ThreadItem {
  id: string | number;
  username: string;
  initials: string;
  content: string;
  timestamp: string;
  likes: number;
  isLiked?: boolean;
  replyCount?: number;
  replies?: ThreadReply[];
}

export interface PeerUser {
  id: string | number;
  username: string;
  initials: string;
  branch: string | null;
  year: string | null;
  bio?: string;
  interests?: string[];
  profilePublic?: boolean;
  discoverable?: boolean;
  directoryVisible?: boolean;
  isFollowing?: boolean;
  isRequested?: boolean;
}

export interface PeerProfileData {
  user: PeerUser & {
    isSelf?: boolean;
    isIncomingRequested?: boolean;
  };
  publicPosts: PostItem[];
  personalPosts: PostItem[];
}

export interface FollowRequestItem {
  id: string | number;
  username: string;
  initials?: string;
  branch?: string;
  year?: string;
  timestamp: string;
}

export interface FollowerItem {
  id: string | number;
  username: string;
  initials: string;
  group?: string;
  branch?: string;
  year?: string;
}

export interface BlockedUserItem {
  id: string | number;
  username: string;
  initials: string;
  blockedAt?: string;
  reason?: string;
}

export interface MutedUserItem {
  id: string | number;
  username: string;
}

export interface ThisWeekEvent {
  id: string | number;
  title: string;
  date: string;
  type?: string;
  location?: string;
  details?: string;
}

export interface TrendingTopic {
  tag: string;
  posts: number;
}

export type UserRole = 'student' | 'admin';
export type AccountStatus = 'active' | 'suspended' | 'banned';

export interface UserProfile {
  id: string;
  email: string;
  username: string;
  fullName?: string;
  dob?: string;
  department?: string;
  branch: string;
  year: string;
  section?: string;
  bio?: string;
  avatarInitials: string;
  interests?: string[];
  following?: string[];
  role: UserRole;
  status?: AccountStatus;
  suspendedUntil?: number | null;
  profilePublic?: boolean;
  discoverableByBranch?: boolean;
  directoryVisible?: boolean;
  readReceipts?: boolean;
  activeStatus?: boolean;
  createdAt?: number | string;
}

export interface UserSession {
  token: string;
  userId: string;
  username?: string;
  role: UserRole;
  expiresAt: number;
}

export interface AuthResult {
  user: UserProfile;
  session: UserSession;
}

export interface AdminMetrics {
  totalUsers: number;
  activeUsers: number;
  suspendedUsers: number;
  bannedUsers: number;
  pendingReports: number;
  activePosts: number;
}

export interface AdminReport {
  id: string;
  targetType: string;
  targetId: string;
  reporterHandle: string;
  reason: string;
  details?: string;
  contentSnippet?: string;
  targetContext?: {
    threadId?: string;
    commentId?: string;
    authorUsername?: string;
  } | null;
  status: string;
  createdAt: number | string;
}

export interface AdminPostItem {
  id: string;
  authorHandle: string;
  department: string;
  content: string;
  likes: number;
  reportsCount: number;
  status: string;
  createdAt: number | string;
}

export interface AuditLogEntry {
  id: string;
  adminUser: string;
  action: string;
  targetType: string;
  targetId: string;
  details: string;
  timestamp: number | string;
}
