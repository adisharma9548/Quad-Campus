import type { FastifyReply, FastifyRequest } from 'fastify';
import type { DatabaseSync } from 'node:sqlite';
import { AUTH_SECRET, SECURITY_LIMITS } from '../config/constants.ts';
import type {
  AuthMiddleware,
  PeerUser,
  RateLimitRow,
  ResolvedSession,
  SelfUser,
  SessionRow,
  UserRow,
  ViewerRelations,
} from '../types.ts';
import { verifySessionToken } from '../utils/crypto.ts';

export function formatRelativeTime(createdAtMs: number, now: number = Date.now()): string {
  const diffSec = Math.max(0, Math.floor((now - Number(createdAtMs || now)) / 1000));
  if (diffSec < 60) return 'Just now';
  const mins = Math.floor(diffSec / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(createdAtMs).toLocaleDateString();
}

/**
 * Serialize full self user object for `/auth/session`, `/auth/login`, `/auth/signup`.
 * Contains private account settings; NEVER return to other users.
 */
export function toSelfUser(row: UserRow | null | undefined): SelfUser | null {
  if (!row) return null;
  let interests: string[] = [];
  try {
    interests = JSON.parse(row.interests_json || '[]') as string[];
  } catch {
    interests = [];
  }
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    role: row.role,
    status: row.status,
    fullName: row.full_name || '',
    dob: row.dob || '',
    department: row.department,
    year: row.year,
    section: row.section,
    branch: row.branch,
    bio: row.bio || '',
    avatarInitials: row.avatar_initials,
    interests,
    profilePublic: Boolean(row.profile_public),
    discoverableByBranch: Boolean(row.discoverable),
    directoryVisible: Boolean(row.discoverable),
    readReceipts: Boolean(row.read_receipts),
    activeStatus: Boolean(row.active_status),
    createdAt: row.created_at,
  };
}

/**
 * Serialize safe public user representation.
 * Strictly strips email, fullName, dob, section, and passwordHash.
 * Branch and year are omitted unless the user opted into discoverability.
 */
export function toPeerUser(row: UserRow | null | undefined): PeerUser | null {
  if (!row) return null;
  const canShowAcademics = Boolean(row.discoverable);
  return {
    id: row.id,
    username: row.username,
    initials: row.avatar_initials,
    bio: row.bio || '',
    branch: canShowAcademics ? row.branch : null,
    year: canShowAcademics ? row.year : null,
    profilePublic: Boolean(row.profile_public),
    discoverable: canShowAcademics,
    directoryVisible: canShowAcademics,
  };
}

/**
 * Collect the viewer's follow, group, block, mute, and dismissal graph in one fast lookup.
 */
export function getViewerRelations(db: DatabaseSync, viewerId: string | null): ViewerRelations {
  const followingIds = new Set<string>();
  const outgoingRequestTargetIds = new Set<string>();
  const incomingRequestRequesterIds = new Set<string>();
  const viewerMembershipByAuthor = new Map<string, string>();
  const blockedIds = new Set<string>();
  const blockedByIds = new Set<string>();
  const mutedIds = new Set<string>();
  const dismissedPostIds = new Set<string>();
  const dismissedReelIds = new Set<string>();
  const dismissedTopics = new Set<string>();

  if (!viewerId) {
    return {
      followingIds,
      outgoingRequestTargetIds,
      incomingRequestRequesterIds,
      viewerMembershipByAuthor,
      blockedIds,
      blockedByIds,
      mutedIds,
      dismissedPostIds,
      dismissedReelIds,
      dismissedTopics: [],
    };
  }

  for (const r of db
    .prepare('SELECT followee_id, group_name FROM follows WHERE follower_id = ?')
    .all(viewerId) as Array<{ followee_id: string; group_name: string | null }>) {
    followingIds.add(r.followee_id);
    viewerMembershipByAuthor.set(r.followee_id, r.group_name || 'Others');
  }
  for (const r of db
    .prepare("SELECT target_id FROM follow_requests WHERE requester_id = ? AND status = 'pending'")
    .all(viewerId) as Array<{ target_id: string }>) {
    outgoingRequestTargetIds.add(r.target_id);
  }
  for (const r of db
    .prepare("SELECT requester_id FROM follow_requests WHERE target_id = ? AND status = 'pending'")
    .all(viewerId) as Array<{ requester_id: string }>) {
    incomingRequestRequesterIds.add(r.requester_id);
  }
  for (const r of db
    .prepare('SELECT blocked_id FROM blocks WHERE blocker_id = ?')
    .all(viewerId) as Array<{ blocked_id: string }>) {
    blockedIds.add(r.blocked_id);
  }
  for (const r of db
    .prepare('SELECT blocker_id FROM blocks WHERE blocked_id = ?')
    .all(viewerId) as Array<{ blocker_id: string }>) {
    blockedByIds.add(r.blocker_id);
  }
  for (const r of db
    .prepare('SELECT muted_id FROM mutes WHERE muter_id = ?')
    .all(viewerId) as Array<{ muted_id: string }>) {
    mutedIds.add(r.muted_id);
  }
  const dismissedRows = db
    .prepare(
      `SELECT d.post_id, p.hashtags_json FROM dismissed_posts d
       JOIN posts p ON p.id = d.post_id
       WHERE d.user_id = ?`
    )
    .all(viewerId) as Array<{ post_id: string; hashtags_json: string | null }>;

  for (const r of dismissedRows) {
    dismissedPostIds.add(r.post_id);
    try {
      for (const tag of JSON.parse(r.hashtags_json || '[]') as string[]) {
        dismissedTopics.add(tag);
      }
    } catch {
      // ignore malformed tag list
    }
  }

  for (const r of db
    .prepare('SELECT reel_id FROM dismissed_reels WHERE user_id = ?')
    .all(viewerId) as Array<{ reel_id: string }>) {
    dismissedReelIds.add(r.reel_id);
  }

  return {
    followingIds,
    outgoingRequestTargetIds,
    incomingRequestRequesterIds,
    viewerMembershipByAuthor,
    blockedIds,
    blockedByIds,
    mutedIds,
    dismissedPostIds,
    dismissedReelIds,
    dismissedTopics: Array.from(dismissedTopics),
  };
}

function sendAuthError(
  reply: FastifyReply,
  status: number,
  code: string,
  message: string,
  extra: Record<string, unknown> = {}
) {
  return reply.code(status).send({
    error: { code, message, ...extra },
  });
}

export function extractBearerToken(request: FastifyRequest): string {
  const auth = request.headers.authorization || '';
  if (auth.startsWith('Bearer ')) {
    return auth.slice(7).trim();
  }
  const query = request.query as Record<string, unknown> | undefined;
  // Support media token query param only on GET media endpoint
  if (query?.token && request.url.startsWith('/api/v1/media/')) {
    return String(query.token);
  }
  return '';
}

export function resolveActiveSession(
  db: DatabaseSync,
  request: FastifyRequest
): ResolvedSession | null {
  const token = extractBearerToken(request);
  if (!token) return null;

  const decoded = verifySessionToken(token, AUTH_SECRET);
  if (!decoded) return null;

  const sessionRow = db
    .prepare('SELECT * FROM sessions WHERE id = ?')
    .get(decoded.sid) as unknown as SessionRow | undefined;
  if (!sessionRow) return null;

  const now = Date.now();
  if (now > sessionRow.expires_at) {
    db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionRow.id);
    return null;
  }

  if (
    sessionRow.role === 'admin' &&
    now - sessionRow.last_active_at > SECURITY_LIMITS.ADMIN_INACTIVITY_MS
  ) {
    db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionRow.id);
    return null;
  }

  const userRow = db
    .prepare('SELECT * FROM users WHERE id = ?')
    .get(sessionRow.user_id) as unknown as UserRow | undefined;
  if (!userRow || userRow.status === 'banned' || userRow.status === 'deleted') {
    db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionRow.id);
    return null;
  }

  if (userRow.status === 'suspended' && userRow.suspended_until) {
    if (Date.now() < new Date(userRow.suspended_until).getTime()) {
      return { suspended: true, userRow, sessionRow, token };
    }
    db.prepare("UPDATE users SET status = 'active', suspended_until = NULL WHERE id = ?").run(
      userRow.id
    );
    userRow.status = 'active';
  }

  db.prepare('UPDATE sessions SET last_active_at = ? WHERE id = ?').run(now, sessionRow.id);
  sessionRow.last_active_at = now;

  return { suspended: false, userRow, sessionRow, token };
}

export function createAuthMiddleware(db: DatabaseSync): AuthMiddleware {
  const optionalAuth = async (request: FastifyRequest): Promise<void> => {
    const resolved = resolveActiveSession(db, request);
    if (resolved && !resolved.suspended) {
      request.auth = resolved;
    } else {
      request.auth = null;
    }
  };

  const requireAuth = async (request: FastifyRequest, reply: FastifyReply) => {
    const resolved = resolveActiveSession(db, request);
    if (!resolved) {
      return sendAuthError(
        reply,
        401,
        'UNAUTHORIZED',
        'Authentication session missing or expired.'
      );
    }
    if (resolved.suspended) {
      return sendAuthError(
        reply,
        403,
        'ACCOUNT_SUSPENDED',
        'Your account is currently suspended under campus guidelines.'
      );
    }
    request.auth = resolved;
  };

  const requireAdmin = async (request: FastifyRequest, reply: FastifyReply) => {
    const resolved = resolveActiveSession(db, request);
    if (!resolved) {
      return sendAuthError(reply, 401, 'UNAUTHORIZED', 'Admin session missing or expired.');
    }
    if (
      resolved.suspended ||
      resolved.userRow.role !== 'admin' ||
      resolved.sessionRow.role !== 'admin'
    ) {
      return sendAuthError(reply, 403, 'FORBIDDEN', 'Administrator privilege required.');
    }
    request.auth = resolved;
  };

  const requireAdminReauth = async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.auth) {
      return sendAuthError(reply, 401, 'UNAUTHORIZED', 'Admin session missing or expired.');
    }
    const { sessionRow } = request.auth;
    if (!sessionRow.reauth_until || Date.now() > sessionRow.reauth_until) {
      return sendAuthError(
        reply,
        403,
        'REAUTH_REQUIRED',
        'High-privilege destructive actions require recent password re-authentication.'
      );
    }
  };

  return { optionalAuth, requireAuth, requireAdmin, requireAdminReauth };
}

export type RateLimitCheckResult =
  | { allowed: true; remaining: number }
  | { allowed: false; retryAfterSec: number };

/**
 * Simple persistent SQLite sliding-window rate limiter.
 */
export function checkRateLimit(
  db: DatabaseSync,
  key: string,
  maxCount: number,
  windowMs: number
): RateLimitCheckResult {
  const now = Date.now();
  const row = db
    .prepare('SELECT count, window_start FROM rate_limits WHERE key = ?')
    .get(key) as unknown as Pick<RateLimitRow, 'count' | 'window_start'> | undefined;
  if (!row || now - row.window_start > windowMs) {
    db.prepare(
      'INSERT OR REPLACE INTO rate_limits (key, count, window_start) VALUES (?, 1, ?)'
    ).run(key, now);
    return { allowed: true, remaining: maxCount - 1 };
  }
  if (row.count >= maxCount) {
    const retryAfterSec = Math.max(1, Math.ceil((row.window_start + windowMs - now) / 1000));
    return { allowed: false, retryAfterSec };
  }
  db.prepare('UPDATE rate_limits SET count = count + 1 WHERE key = ?').run(key);
  return { allowed: true, remaining: maxCount - row.count - 1 };
}
