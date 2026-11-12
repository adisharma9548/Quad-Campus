import type { FastifyReply, FastifyRequest } from 'fastify';

export type UserRole = 'student' | 'admin';
export type UserStatus = 'active' | 'suspended' | 'banned' | 'deleted';
export type PostType = 'Discussion' | 'Tip' | 'Question' | 'Update' | 'Resource' | 'Event';
export type PostSpace = 'public' | 'personal';
export type PostStatus = 'active' | 'flagged' | 'deleted';

export interface UserRow {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  full_name: string;
  dob: string;
  department: string;
  year: string;
  section: string;
  branch: string;
  bio: string;
  avatar_initials: string;
  interests_json: string;
  profile_public: number;
  discoverable: number;
  read_receipts: number;
  active_status: number;
  suspended_until: string | null;
  suspension_reason: string | null;
  banned_at: string | null;
  ban_reason: string | null;
  password_hash: string;
  created_at: string;
}

export interface SessionRow {
  id: string;
  user_id: string;
  role: UserRole;
  expires_at: number;
  last_active_at: number;
  reauth_until: number | null;
  created_at: string;
}

export interface LoginAttemptRow {
  identifier: string;
  count: number;
  first_attempt_at: number;
  locked_until: number;
}

export interface RateLimitRow {
  key: string;
  count: number;
  window_start: number;
}

export interface SelfUser {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  fullName: string;
  dob: string;
  department: string;
  year: string;
  section: string;
  branch: string;
  bio: string;
  avatarInitials: string;
  interests: string[];
  profilePublic: boolean;
  discoverableByBranch: boolean;
  directoryVisible?: boolean;
  readReceipts: boolean;
  activeStatus: boolean;
  createdAt: string;
}

export interface PeerUser {
  id: string;
  username: string;
  initials: string;
  bio: string;
  branch: string | null;
  year: string | null;
  profilePublic: boolean;
  discoverable: boolean;
  directoryVisible?: boolean;
}

export interface ViewerRelations {
  followingIds: Set<string>;
  outgoingRequestTargetIds: Set<string>;
  incomingRequestRequesterIds?: Set<string>;
  viewerMembershipByAuthor: Map<string, string>;
  blockedIds: Set<string>;
  blockedByIds: Set<string>;
  mutedIds: Set<string>;
  dismissedPostIds: Set<string>;
  dismissedTopics: string[];
}

export interface ResolvedSession {
  suspended: boolean;
  userRow: UserRow;
  sessionRow: SessionRow;
  token: string;
}

export type PreHandlerHook = (
  request: FastifyRequest,
  reply: FastifyReply
) => Promise<unknown>;

export interface AuthMiddleware {
  optionalAuth: PreHandlerHook;
  requireAuth: PreHandlerHook;
  requireAdmin: PreHandlerHook;
  requireAdminReauth: PreHandlerHook;
}

export interface PostAnswerDto {
  id: string;
  username: string;
  initials: string;
  text: string;
  timestamp: string;
}

export interface PostItem {
  id: string;
  authorId: string;
  authorStatus: UserStatus;
  type: string;
  title: string;
  username: string;
  authorUsername: string;
  initials: string;
  branch: string | null;
  authorBranch: string;
  year: string | null;
  authorYear: string;
  content: string;
  hashtags: string[];
  space: PostSpace;
  audience: string;
  groupName: string;
  timestamp: string;
  createdAtMs: number;
  createdAt: string;
  edited: boolean;
  editedAtMs: number | null;
  likes: number;
  likesCount: number;
  savesCount: number;
  comments: number;
  answersCount: number;
  shares: number;
  sharesCount: number;
  hasImage: boolean;
  mediaId: string | null;
  mediaUrl: string;
  mediaKey: string;
  location: string;
  imageAlt: string;
  bestAnswerId: string | null;
  isLiked: boolean;
  isSaved: boolean;
  status: PostStatus;
  answers: PostAnswerDto[];
  rankScore?: number;
  feedReason?: string;
}

export interface ReelItem {
  id: string;
  authorId: string;
  authorStatus: UserStatus;
  username: string;
  initials: string;
  caption: string;
  tag: string;
  duration: string;
  branch: string | null;
  year: string | null;
  unseen: boolean;
  isLiked: boolean;
  likes: number;
  likesCount: number;
  comments: number;
  commentsCount: number;
  shares: number;
  sharesCount: number;
  views: string;
  posterKey: string;
  posterAlt: string;
  mediaUrl: string;
  videoUrl: string;
  coverUrl: string;
  thumbnailUrl: string;
  durationSec: number | null;
  trimStart: number;
  trimEnd: number | null;
  width: number | null;
  height: number | null;
  fitMode: 'fit' | 'crop';
  audience: 'campus' | 'followers';
  commentsEnabled: boolean;
  mentions: string[];
  hashtags: string[];
  status: string;
  processingError?: string | null;
  createdAtMs: number;
  score?: number;
}

declare module 'fastify' {
  interface FastifyRequest {
    auth?: ResolvedSession | null;
  }
}
