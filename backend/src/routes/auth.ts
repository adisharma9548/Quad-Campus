import crypto from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { DatabaseSync } from 'node:sqlite';
import {
  AUTH_SECRET,
  DEFAULT_GROUPS,
  DEPARTMENT_MAP,
  INSTITUTION,
  OFFICIAL_DEPARTMENTS,
  RESERVED_USERNAMES,
  SECURITY_LIMITS,
  SHORT_YEAR,
  VALID_SECTIONS,
  VALID_YEARS,
} from '../config/constants.ts';
import { isEmailAllowed } from '../config/institution.ts';
import {
  checkRateLimit,
  getViewerRelations,
  toPeerUser,
  toSelfUser,
} from '../middleware/auth.ts';
import { canViewerSeePost } from '../algorithms/campusRanker.ts';
import { loadAllPostsWithStats, serializePostForResponse } from './feed.ts';
import { loadReelsWithStats } from './social.ts';
import { attachReelFollowStatus } from '../utils/reelCommentService.ts';
import { getDiscoverableUsers } from '../services/discovery.ts';
import type { AuthMiddleware, LoginAttemptRow, UserRow } from '../types.ts';
import { hashPassword, signSessionToken, verifyPasswordHash } from '../utils/crypto.ts';

function apiError(
  reply: FastifyReply,
  status: number,
  code: string,
  message: string,
  extra: Record<string, unknown> = {}
) {
  return reply.code(status).send({ error: { code, message, ...extra } });
}

function getClientKey(request: FastifyRequest): string {
  const fwd = request.headers['x-forwarded-for'];
  return request.ip || (Array.isArray(fwd) ? fwd[0] : fwd) || 'local';
}

interface SignupBody {
  email?: string;
  username?: string;
  department?: string;
  year?: string;
  section?: string;
  password?: string;
  fullName?: string;
  dob?: string;
  bio?: string;
  avatarInitials?: string;
  interests?: string[];
  following?: string[];
}

interface LoginBody {
  identifier?: string;
  password?: string;
}

interface UpdateMeBody {
  bio?: string;
  avatarInitials?: string;
  interests?: string[];
  profilePublic?: boolean;
  discoverableByBranch?: boolean;
  directoryVisible?: boolean;
  readReceipts?: boolean;
  [key: string]: unknown;
}

export function registerAuthRoutes(
  app: FastifyInstance,
  db: DatabaseSync,
  auth: AuthMiddleware
): void {
  // ── 1. Student Registration (POST /api/v1/auth/signup) ─────────────────
  app.post<{ Body: SignupBody }>('/api/v1/auth/signup', async (request, reply) => {
    const body = request.body || {};
    const cleanEmail = String(body.email || '').trim().toLowerCase();
    const cleanUsername = String(body.username || '').trim().toLowerCase();
    const department = String(body.department || '').trim();
    const year = String(body.year || '').trim();
    const rawSection = String(body.section || '')
      .trim()
      .toUpperCase()
      .replace(/^SECTION\s+/i, '');
    const password = String(body.password || '');
    const fullName = String(body.fullName || '').trim();
    const dob = String(body.dob || '').trim();
    const bio = String(body.bio || '').trim();
    const interests = Array.isArray(body.interests) ? body.interests.slice(0, 12) : [];
    const following = Array.isArray(body.following) ? body.following.slice(0, 20) : [];

    // Reject phone numbers and require verified college email format
    if (/^\+?\d[\d\s-]{6,}$/.test(cleanEmail)) {
      return apiError(
        reply,
        400,
        'INVALID_COLLEGE_EMAIL',
        'Mobile numbers are strictly not accepted. Use your college-issued email address.'
      );
    }
    if (!cleanEmail || !isEmailAllowed(cleanEmail, INSTITUTION)) {
      return apiError(reply, 400, 'INVALID_COLLEGE_EMAIL', INSTITUTION.emailError);
    }

    const emailTaken = db.prepare('SELECT id FROM users WHERE email = ?').get(cleanEmail);
    if (emailTaken) {
      return apiError(
        reply,
        409,
        'EMAIL_EXISTS',
        'An account with this college email already exists.'
      );
    }

    if (!department) {
      return apiError(reply, 400, 'MISSING_DEPARTMENT', 'Department selection is compulsory.');
    }
    if (!OFFICIAL_DEPARTMENTS.includes(department)) {
      return apiError(
        reply,
        400,
        'INVALID_DEPARTMENT',
        `Select one of the available ${INSTITUTION.programLabel.toLowerCase()} options.`
      );
    }

    if (!year) {
      return apiError(
        reply,
        400,
        'MISSING_YEAR',
        'Academic year selection is compulsory.'
      );
    }
    if (!VALID_YEARS.includes(year)) {
      return apiError(
        reply,
        400,
        'INVALID_YEAR',
        `Academic year must be one of: ${VALID_YEARS.join(', ')}.`
      );
    }

    if (!rawSection) {
      return apiError(
        reply,
        400,
        'MISSING_SECTION',
        'Section selection is compulsory.'
      );
    }
    if (!VALID_SECTIONS.includes(rawSection)) {
      return apiError(reply, 400, 'INVALID_SECTION', `Section must be one of: ${VALID_SECTIONS.join(', ')}.`);
    }

    if (!/^[a-z0-9_]{3,20}$/.test(cleanUsername)) {
      return apiError(
        reply,
        400,
        'INVALID_USERNAME_FORMAT',
        'Username must be 3–20 lowercase letters, numbers, or underscores.'
      );
    }
    if (RESERVED_USERNAMES.has(cleanUsername)) {
      return apiError(
        reply,
        400,
        'RESERVED_USERNAME',
        'This username is reserved by the campus network.'
      );
    }
    if (db.prepare('SELECT id FROM users WHERE username = ?').get(cleanUsername)) {
      return apiError(reply, 409, 'USERNAME_TAKEN', 'This username is already taken.');
    }

    if (dob) {
      const birthDate = new Date(dob);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const m = today.getMonth() - birthDate.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age -= 1;
      if (Number.isNaN(age) || age < 13) {
        return apiError(
          reply,
          403,
          'AGE_GATE_BLOCKED',
          'Quad is restricted to students 13 and older.'
        );
      }
    }

    if (password.length < 8) {
      return apiError(
        reply,
        400,
        'WEAK_PASSWORD',
        'Password must be at least 8 characters long.'
      );
    }

    const passwordHash = await hashPassword(password);
    const id = 'usr_' + crypto.randomUUID().slice(0, 12);
    const shortBranch = DEPARTMENT_MAP[department] || INSTITUTION.programs[0]!.code;
    const initials =
      String(body.avatarInitials || '').trim().toUpperCase().slice(0, 2) ||
      (fullName
        ? fullName
            .split(/\s+/)
            .map((p) => p[0])
            .join('')
            .slice(0, 2)
            .toUpperCase()
        : cleanUsername.slice(0, 2).toUpperCase());
    const nowIso = new Date().toISOString();

    db.prepare(`
      INSERT INTO users (
        id, username, email, role, status, full_name, dob, department, year, section, branch,
        bio, avatar_initials, interests_json, profile_public, discoverable, password_hash, created_at
      ) VALUES (?, ?, ?, 'student', 'active', ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?)
    `).run(
      id,
      cleanUsername,
      cleanEmail,
      fullName,
      dob,
      department,
      year,
      rawSection,
      shortBranch,
      bio,
      initials,
      JSON.stringify(interests),
      passwordHash,
      nowIso
    );

    const insertGroup = db.prepare(
      'INSERT OR IGNORE INTO custom_groups (owner_id, name) VALUES (?, ?)'
    );
    for (const g of DEFAULT_GROUPS) insertGroup.run(id, g);

    const insertFollow = db.prepare(
      'INSERT OR IGNORE INTO follows (follower_id, followee_id, group_name, created_at) VALUES (?, ?, ?, ?)'
    );
    const findPeer = db.prepare("SELECT id FROM users WHERE username = ? AND status = 'active'");
    for (const handle of following) {
      const peer = findPeer.get(String(handle).trim().toLowerCase()) as
        | { id: string }
        | undefined;
      if (peer && peer.id !== id) insertFollow.run(id, peer.id, 'Others', nowIso);
    }

    const sid = 'ses_' + crypto.randomUUID();
    const now = Date.now();
    const expiresAt = now + SECURITY_LIMITS.STUDENT_SESSION_TTL_MS;
    db.prepare(
      'INSERT INTO sessions (id, user_id, role, expires_at, last_active_at, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(sid, id, 'student', expiresAt, now, nowIso);

    const token = signSessionToken({ sid, uid: id, role: 'student', exp: expiresAt }, AUTH_SECRET);
    const createdRow = db
      .prepare('SELECT * FROM users WHERE id = ?')
      .get(id) as unknown as UserRow;

    return reply.code(201).send({
      user: toSelfUser(createdRow),
      session: { token, role: 'student', expiresAt, createdAt: now },
    });
  });

  // ── 2. Login (POST /api/v1/auth/login) ─────────────────────────────────
  app.post<{ Body: LoginBody }>('/api/v1/auth/login', async (request, reply) => {
    const body = request.body || {};
    const cleanId = String(body.identifier || '').trim().toLowerCase();
    const password = String(body.password || '');

    if (!cleanId || !password) {
      return apiError(
        reply,
        400,
        'MISSING_CREDENTIALS',
        'Please enter both your identifier and password.'
      );
    }

    const now = Date.now();
    const attempt = db
      .prepare('SELECT * FROM login_attempts WHERE identifier = ?')
      .get(cleanId) as unknown as LoginAttemptRow | undefined;
    if (attempt?.locked_until && attempt.locked_until > now) {
      const remainingSecs = Math.ceil((attempt.locked_until - now) / 1000);
      return apiError(
        reply,
        429,
        'ACCOUNT_LOCKED',
        `Too many failed login attempts. Account temporarily locked for security. Try again in ${remainingSecs} seconds.`,
        {
          isLockedOut: true,
          lockoutRemainingSeconds: remainingSecs,
          consecutiveFailures: attempt.count,
        }
      );
    }

    const userRow = db
      .prepare('SELECT * FROM users WHERE username = ? OR email = ?')
      .get(cleanId, cleanId) as unknown as UserRow | undefined;

    const passwordValid = await verifyPasswordHash(password, userRow?.password_hash || '');

    if (!userRow || !passwordValid) {
      const resetWindow = !attempt || now - attempt.first_attempt_at > SECURITY_LIMITS.LOGIN_WINDOW_MS;
      const nextCount = resetWindow ? 1 : attempt.count + 1;
      const firstAt = resetWindow ? now : attempt.first_attempt_at;
      const lockedUntil =
        nextCount >= SECURITY_LIMITS.LOGIN_MAX_FAILURES
          ? now + SECURITY_LIMITS.LOGIN_LOCKOUT_MS
          : 0;

      db.prepare(
        'INSERT OR REPLACE INTO login_attempts (identifier, count, first_attempt_at, locked_until) VALUES (?, ?, ?, ?)'
      ).run(cleanId, nextCount, firstAt, lockedUntil);

      if (lockedUntil > now) {
        const remainingSecs = Math.ceil(SECURITY_LIMITS.LOGIN_LOCKOUT_MS / 1000);
        return apiError(
          reply,
          429,
          'ACCOUNT_LOCKED',
          `Too many failed login attempts. Account temporarily locked for security. Try again in ${remainingSecs} seconds.`,
          {
            isLockedOut: true,
            lockoutRemainingSeconds: remainingSecs,
            consecutiveFailures: nextCount,
          }
        );
      }

      return apiError(
        reply,
        401,
        'INVALID_CREDENTIALS',
        'Invalid credentials. Please verify your login details and try again.',
        { consecutiveFailures: nextCount }
      );
    }

    if (userRow.status === 'banned' || userRow.status === 'deleted') {
      return apiError(
        reply,
        403,
        'ACCOUNT_BANNED',
        'This account has been deactivated under campus safety guidelines.'
      );
    }
    if (userRow.status === 'suspended' && userRow.suspended_until) {
      if (Date.now() < new Date(userRow.suspended_until).getTime()) {
        return apiError(
          reply,
          403,
          'ACCOUNT_SUSPENDED',
          `Account temporarily suspended until ${new Date(userRow.suspended_until).toLocaleDateString()}.`
        );
      }
      db.prepare("UPDATE users SET status = 'active', suspended_until = NULL WHERE id = ?").run(
        userRow.id
      );
      userRow.status = 'active';
    }

    db.prepare('DELETE FROM login_attempts WHERE identifier = ?').run(cleanId);

    const isRoleAdmin = userRow.role === 'admin';
    const ttl = isRoleAdmin
      ? SECURITY_LIMITS.ADMIN_SESSION_TTL_MS
      : SECURITY_LIMITS.STUDENT_SESSION_TTL_MS;
    const expiresAt = now + ttl;
    const sid = 'ses_' + crypto.randomUUID();
    const nowIso = new Date(now).toISOString();

    db.prepare(
      'INSERT INTO sessions (id, user_id, role, expires_at, last_active_at, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(sid, userRow.id, userRow.role, expiresAt, now, nowIso);

    const token = signSessionToken(
      { sid, uid: userRow.id, role: userRow.role, exp: expiresAt },
      AUTH_SECRET
    );

    return {
      user: toSelfUser(userRow),
      session: { token, role: userRow.role, expiresAt, createdAt: now },
    };
  });

  // ── 3. Logout (POST /api/v1/auth/logout) ────────────────────────────────
  app.post('/api/v1/auth/logout', { preHandler: auth.optionalAuth }, async (request) => {
    if (request.auth?.sessionRow?.id) {
      db.prepare('DELETE FROM sessions WHERE id = ?').run(request.auth.sessionRow.id);
    }
    return { success: true, message: 'Session successfully terminated.' };
  });

  // ── 4. Session Restoration (GET /api/v1/auth/session) ──────────────────
  app.get('/api/v1/auth/session', { preHandler: auth.requireAuth }, async (request) => {
    const { userRow, sessionRow, token } = request.auth!;
    return {
      user: toSelfUser(userRow),
      session: {
        token,
        role: sessionRow.role,
        expiresAt: sessionRow.expires_at,
        createdAt: new Date(sessionRow.created_at).getTime(),
      },
    };
  });

  // ── 5. Re-authenticate Password (POST /api/v1/auth/verify-password) ────
  app.post<{ Body: { password?: string } }>(
    '/api/v1/auth/verify-password',
    { preHandler: auth.requireAuth },
    async (request, reply) => {
      const password = String(request.body?.password || '');
      if (!password) {
        return apiError(reply, 400, 'MISSING_PASSWORD', 'Password is required.');
      }

      const ok = await verifyPasswordHash(password, request.auth!.userRow.password_hash);
      if (!ok) {
        return apiError(
          reply,
          401,
          'INVALID_PASSWORD',
          'Incorrect password. Re-authentication failed.'
        );
      }

      const reauthUntil = Date.now() + SECURITY_LIMITS.REAUTH_TOKEN_TTL_MS;
      db.prepare('UPDATE sessions SET reauth_until = ? WHERE id = ?').run(
        reauthUntil,
        request.auth!.sessionRow.id
      );
      return { verified: true, expiresAt: reauthUntil };
    }
  );

  // ── 6. Forgot Password (POST /api/v1/auth/forgot-password) ─────────────
  app.post<{ Body: { identifier?: string } }>(
    '/api/v1/auth/forgot-password',
    async (request, reply) => {
      const clean = String(request.body?.identifier || '').trim().toLowerCase();
      if (!clean) {
        return apiError(
          reply,
          400,
          'INVALID_INPUT',
          'Please provide your campus username or college email.'
        );
      }

      const rl = checkRateLimit(
        db,
        `forgot:${getClientKey(request)}:${clean}`,
        SECURITY_LIMITS.PASSWORD_RESET_PER_HOUR,
        3600 * 1000
      );
      if (!rl.allowed) {
        return apiError(
          reply,
          429,
          'TOO_MANY_REQUESTS',
          `Please wait ${rl.retryAfterSec}s before requesting another password reset.`
        );
      }

      // Always return non-enumerating 200 success regardless of whether user exists
      return {
        success: true,
        message:
          'If an account exists with this credential, password reset instructions have been dispatched to your verified college inbox.',
      };
    }
  );

  // ── 7. Check Username Availability (GET /api/v1/users/check-username) ──
  app.get<{ Querystring: { q?: string } }>(
    '/api/v1/users/check-username',
    async (request, reply) => {
      const rl = checkRateLimit(
        db,
        `uname:${getClientKey(request)}`,
        SECURITY_LIMITS.USERNAME_CHECK_PER_MIN,
        60 * 1000
      );
      if (!rl.allowed) {
        return apiError(
          reply,
          429,
          'TOO_MANY_REQUESTS',
          'Rate limit exceeded for username availability checks.'
        );
      }

      const clean = String(request.query?.q || '').trim().toLowerCase();
      if (!clean || clean.length < 3 || !/^[a-z0-9_]+$/.test(clean)) {
        return { available: false };
      }

      if (RESERVED_USERNAMES.has(clean)) {
        return {
          available: false,
          suggestions: [`${clean}_campus`, `${clean}_student`, `${clean}_26`],
        };
      }

      const taken = db.prepare('SELECT id FROM users WHERE username = ?').get(clean);
      if (taken) {
        const candidates = [`${clean}_dev`, `${clean}_2026`, `${clean}_btech`, `campus_${clean}`];
        const suggestions = candidates.filter(
          (s) => !db.prepare('SELECT id FROM users WHERE username = ?').get(s)
        );
        return { available: false, suggestions };
      }

      return { available: true };
    }
  );

  // ── 8. Update Self Profile (PATCH /api/v1/users/me) ────────────────────
  app.patch<{ Body: UpdateMeBody }>(
    '/api/v1/users/me',
    { preHandler: auth.requireAuth },
    async (request, reply) => {
      const updates = request.body || {};
      const immutableKeys = [
        'department',
        'year',
        'section',
        'email',
        'username',
        'id',
        'role',
        'passwordHash',
      ];
      for (const k of immutableKeys) {
        if (Object.prototype.hasOwnProperty.call(updates, k)) {
          return apiError(
            reply,
            400,
            'IMMUTABLE_IDENTITY_FIELD',
            `Field "${k}" is permanently linked to your verified college identity and cannot be modified.`
          );
        }
      }

      const current = request.auth!.userRow;
      const nextBio = updates.bio !== undefined ? String(updates.bio).slice(0, 280) : current.bio;
      const nextInitials =
        updates.avatarInitials !== undefined
          ? String(updates.avatarInitials).trim().toUpperCase().slice(0, 2) ||
            current.avatar_initials
          : current.avatar_initials;
      const nextInterests =
        updates.interests !== undefined && Array.isArray(updates.interests)
          ? JSON.stringify(updates.interests.slice(0, 12))
          : current.interests_json;
      const nextProfilePublic =
        updates.profilePublic !== undefined
          ? updates.profilePublic
            ? 1
            : 0
          : current.profile_public;
      const rawDiscoverable =
        updates.directoryVisible !== undefined
          ? updates.directoryVisible
          : updates.discoverableByBranch;
      const nextDiscoverable =
        rawDiscoverable !== undefined ? (rawDiscoverable ? 1 : 0) : current.discoverable;
      const nextReadReceipts =
        updates.readReceipts !== undefined ? (updates.readReceipts ? 1 : 0) : current.read_receipts;

      db.prepare(`
        UPDATE users
        SET bio = ?, avatar_initials = ?, interests_json = ?, profile_public = ?, discoverable = ?, read_receipts = ?
        WHERE id = ?
      `).run(
        nextBio,
        nextInitials,
        nextInterests,
        nextProfilePublic,
        nextDiscoverable,
        nextReadReceipts,
        current.id
      );

      const updated = db
        .prepare('SELECT * FROM users WHERE id = ?')
        .get(current.id) as unknown as UserRow;
      return toSelfUser(updated);
    }
  );

  // ── 9. Export Own Data (GET /api/v1/users/me/export) ───────────────────
  app.get('/api/v1/users/me/export', { preHandler: auth.requireAuth }, async (request) => {
    const uid = request.auth!.userRow.id;
    const profile = toSelfUser(request.auth!.userRow);
    const posts = db
      .prepare(
        'SELECT id, type, title, content, space, audience, group_name, location, created_at FROM posts WHERE author_id = ? AND status != ?'
      )
      .all(uid, 'deleted');
    const followers = db
      .prepare(
        'SELECT u.username, f.group_name, f.created_at FROM follows f JOIN users u ON u.id = f.follower_id WHERE f.followee_id = ?'
      )
      .all(uid);
    const following = db
      .prepare(
        'SELECT u.username, f.created_at FROM follows f JOIN users u ON u.id = f.followee_id WHERE f.follower_id = ?'
      )
      .all(uid);

    return {
      exportedAt: new Date().toISOString(),
      profile,
      posts,
      followers,
      following,
    };
  });

  // ── 10. Delete Own Account (DELETE /api/v1/users/me) ───────────────────
  app.delete('/api/v1/users/me', { preHandler: auth.requireAuth }, async (request) => {
    const uid = request.auth!.userRow.id;
    db.prepare(
      "UPDATE users SET status = 'deleted', discoverable = 0, profile_public = 0 WHERE id = ?"
    ).run(uid);
    db.prepare(
      "UPDATE posts SET status = 'deleted', deleted_at = ?, deleted_reason = 'Account deleted by owner' WHERE author_id = ?"
    ).run(new Date().toISOString(), uid);
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(uid);
    return { success: true, message: 'Account and authored posts deleted.' };
  });

  // ── 11. Discovery Search & Mention Suggestions (GET /api/v1/users/search) ─
  app.get<{ Querystring: { q?: string; branch?: string; year?: string; limit?: string } }>(
    '/api/v1/users/search',
    { preHandler: auth.requireAuth },
    async (request) => {
      const items = getDiscoverableUsers(db, request.auth!.userRow.id, {
        q: String(request.query?.q || ''),
        branch: String(request.query?.branch || 'all'),
        year: String(request.query?.year || 'all'),
        limit: Number(request.query?.limit || 20),
      });
      return { items };
    }
  );

  // ── 12. Discovery Profile Page Lookup (GET /api/v1/users/:username/profile) ─
  app.get<{ Params: { username: string }; Querystring: { context?: string } }>(
    '/api/v1/users/:username/profile',
    { preHandler: auth.requireAuth },
    async (request, reply) => {
      const handle = String(request.params.username || '').trim().toLowerCase();
      const viewerRow = request.auth!.userRow;
      const target = db
        .prepare("SELECT * FROM users WHERE username = ? AND role = 'student' AND status = 'active'")
        .get(handle) as unknown as UserRow | undefined;

      if (!target) {
        return apiError(reply, 404, 'USER_NOT_FOUND', 'Student profile unavailable.');
      }

      const relations = getViewerRelations(db, viewerRow.id);
      if (relations.blockedIds.has(target.id) || relations.blockedByIds.has(target.id)) {
        return apiError(reply, 404, 'USER_NOT_FOUND', 'Student profile unavailable.');
      }

      const isSelf = target.id === viewerRow.id;
      const isFollowing = relations.followingIds.has(target.id);
      const isRequested = relations.outgoingRequestTargetIds.has(target.id);
      const isIncomingRequested = Boolean(relations.incomingRequestRequesterIds?.has(target.id));

      // Discovery lookups hide directoryVisible=false users; Feed/Thread profile visits still show public content.
      if (request.query?.context === 'discovery' && !isSelf && !isFollowing && !target.discoverable) {
        return apiError(reply, 404, 'USER_NOT_FOUND', 'Student profile unavailable.');
      }

      let interests: string[] = [];
      try {
        interests = JSON.parse(target.interests_json || '[]') as string[];
      } catch {
        interests = [];
      }

      const viewerForFilter = {
        id: viewerRow.id,
        branch: viewerRow.branch,
        year: viewerRow.year,
        interests: (() => {
          try {
            return JSON.parse(viewerRow.interests_json || '[]') as string[];
          } catch {
            return [];
          }
        })(),
      };

      const allPosts = loadAllPostsWithStats(db, viewerRow.id).filter(
        (p) => p.authorId === target.id && canViewerSeePost(p, viewerForFilter, relations)
      );
      const publicPosts = allPosts
        .filter((p) => p.space === 'public')
        .slice(0, 20)
        .map(serializePostForResponse);
      const canSeePersonal = isSelf || Boolean(target.profile_public) || isFollowing;
      const personalPosts = canSeePersonal
        ? allPosts.filter((p) => p.space === 'personal').slice(0, 20).map(serializePostForResponse)
        : [];

      const peerReels = attachReelFollowStatus(db, viewerRow.id, loadReelsWithStats(db, viewerRow.id))
        .filter((r) => {
          if (r.authorId !== target.id) return false;
          if (isSelf) return r.status !== 'deleted';
          if (r.status !== 'active') return false;
          if (r.audience === 'followers' && !isFollowing) return false;
          return true;
        })
        .slice(0, 24)
        .map(({ authorId: _a, authorStatus: _s, score: _sc, ...rest }) => rest);

      return {
        user: {
          ...toPeerUser(target),
          branch: target.discoverable || isSelf || isFollowing ? target.branch : null,
          year: target.discoverable || isSelf || isFollowing ? SHORT_YEAR(target.year) : null,
          interests,
          isSelf,
          isFollowing,
          isRequested,
          isIncomingRequested,
        },
        publicPosts,
        personalPosts,
        reels: peerReels,
      };
    }
  );

  // ── 13. Peer Public Profile Lookup (GET /api/v1/users/:username) ───────
  app.get<{ Params: { username: string }; Querystring: { context?: string } }>(
    '/api/v1/users/:username',
    { preHandler: auth.optionalAuth },
    async (request, reply) => {
      const handle = String(request.params.username || '').trim().toLowerCase();
      const target = db
        .prepare("SELECT * FROM users WHERE username = ? AND status != 'deleted' AND status != 'banned'")
        .get(handle) as unknown as UserRow | undefined;

      if (!target) {
        return apiError(reply, 404, 'USER_NOT_FOUND', 'User profile unavailable.');
      }

      const viewerId = request.auth?.userRow?.id || null;
      if (viewerId) {
        const relations = getViewerRelations(db, viewerId);
        if (relations.blockedIds.has(target.id) || relations.blockedByIds.has(target.id)) {
          return apiError(reply, 404, 'USER_NOT_FOUND', 'User profile unavailable.');
        }
        if (
          request.query?.context === 'discovery' &&
          target.id !== viewerId &&
          !relations.followingIds.has(target.id) &&
          !target.discoverable
        ) {
          return apiError(reply, 404, 'USER_NOT_FOUND', 'User profile unavailable.');
        }
      } else if (request.query?.context === 'discovery' && !target.discoverable) {
        return apiError(reply, 404, 'USER_NOT_FOUND', 'User profile unavailable.');
      }

      return toPeerUser(target);
    }
  );
}
