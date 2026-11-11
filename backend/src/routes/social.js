import crypto from 'node:crypto';
import { SECURITY_LIMITS, SHORT_YEAR } from '../config/constants.js';
import {
  canViewerSeePost,
  rankCampusReels,
  rankDiscoverablePeers,
} from '../algorithms/campusRanker.js';
import { formatRelativeTime, getViewerRelations } from '../middleware/auth.js';
import { sanitizeUploadedImage } from '../utils/exifStripper.js';

function loadReelsWithStats(db, viewerId) {
  const rows = db
    .prepare(`
      SELECT
        r.*,
        u.username,
        u.avatar_initials AS initials,
        u.branch,
        u.year,
        u.discoverable,
        u.status AS author_status,
        (SELECT COUNT(*) FROM reel_likes rl WHERE rl.reel_id = r.id) AS likes_count,
        (SELECT COUNT(*) FROM reel_comments rc WHERE rc.reel_id = r.id) AS comments_count,
        (SELECT COUNT(*) FROM reel_views rv WHERE rv.reel_id = r.id) AS views_count
      FROM reels r
      JOIN users u ON u.id = r.author_id
      WHERE r.status = 'active'
      ORDER BY r.created_at_ms DESC
    `)
    .all();

  const viewedIds = new Set();
  const likedIds = new Set();
  if (viewerId) {
    for (const v of db.prepare('SELECT reel_id FROM reel_views WHERE user_id = ?').all(viewerId)) {
      viewedIds.add(v.reel_id);
    }
    for (const l of db.prepare('SELECT reel_id FROM reel_likes WHERE user_id = ?').all(viewerId)) {
      likedIds.add(l.reel_id);
    }
  }

  return rows.map((r) => {
    const showAcademics = Boolean(r.discoverable) || r.author_id === viewerId;
    return {
      id: r.id,
      authorId: r.author_id,
      authorStatus: r.author_status,
      username: r.username,
      initials: r.initials,
      caption: r.caption,
      tag: r.tag,
      duration: r.duration,
      branch: showAcademics ? r.branch : null,
      year: showAcademics ? SHORT_YEAR(r.year) : null,
      unseen: viewerId ? !viewedIds.has(r.id) : true,
      isLiked: likedIds.has(r.id),
      likes: Number(r.likes_count || 0),
      likesCount: Number(r.likes_count || 0),
      comments: Number(r.comments_count || 0),
      commentsCount: Number(r.comments_count || 0),
      shares: Number(r.shares_count || 0),
      sharesCount: Number(r.shares_count || 0),
      views: String(r.views_count || 0),
      posterKey: r.poster_key || 'robotics',
      posterAlt: r.poster_alt || `Campus reel by @${r.username}`,
      mediaUrl: r.media_id ? `/api/v1/media/${r.media_id}` : '',
      status: r.status,
      createdAtMs: r.created_at_ms,
    };
  });
}

export function registerSocialRoutes(app, db, auth) {
  // ── 1. Reels (Ranked & Per-User Seen Tracking) ─────────────────────────
  app.get('/api/v1/reels', { preHandler: auth.optionalAuth }, async (request) => {
    const viewer = request.auth?.userRow || null;
    const relations = getViewerRelations(db, viewer?.id || null);
    const raw = loadReelsWithStats(db, viewer?.id || null);
    const ranked = rankCampusReels({ reels: raw, viewer, relations });

    return {
      items: ranked.map(({ authorId: _a, authorStatus: _s, score: _sc, ...rest }) => rest),
    };
  });

  app.post('/api/v1/reels', { preHandler: auth.requireAuth }, async (request, reply) => {
    const viewer = request.auth.userRow;
    const caption = String(request.body?.caption || '').trim();
    const tag = String(request.body?.tag || 'Campus Reel').trim().slice(0, 40);
    const duration = String(request.body?.duration || '0:30').trim().slice(0, 12);

    if (!caption) {
      return reply.code(400).send({ error: { code: 'EMPTY_CAPTION', message: 'Reel caption is required.' } });
    }

    const id = 'reel_' + crypto.randomUUID().slice(0, 10);
    const now = Date.now();
    const nowIso = new Date(now).toISOString();
    db.prepare(`
      INSERT INTO reels (id, author_id, caption, tag, duration, poster_key, poster_alt, status, created_at_ms, created_at)
      VALUES (?, ?, ?, ?, ?, 'robotics', ?, 'active', ?, ?)
    `).run(id, viewer.id, caption.slice(0, 500), tag, duration, `Campus reel by @${viewer.username}`, now, nowIso);

    const created = loadReelsWithStats(db, viewer.id).find((r) => r.id === id);
    return reply.code(201).send(created);
  });

  app.post('/api/v1/reels/:id/view', { preHandler: auth.requireAuth }, async (request) => {
    db.prepare('INSERT OR IGNORE INTO reel_views (reel_id, user_id, viewed_at) VALUES (?, ?, ?)').run(
      String(request.params.id),
      request.auth.userRow.id,
      new Date().toISOString()
    );
    return { seen: true };
  });

  app.post('/api/v1/reels/mark-all-seen', { preHandler: auth.requireAuth }, async (request) => {
    const uid = request.auth.userRow.id;
    const nowIso = new Date().toISOString();
    const activeIds = db.prepare("SELECT id FROM reels WHERE status = 'active'").all();
    const stmt = db.prepare('INSERT OR IGNORE INTO reel_views (reel_id, user_id, viewed_at) VALUES (?, ?, ?)');
    for (const r of activeIds) stmt.run(r.id, uid, nowIso);
    return { markedAllSeen: true };
  });

  app.post('/api/v1/reels/:id/like', { preHandler: auth.requireAuth }, async (request) => {
    const reelId = String(request.params.id);
    const uid = request.auth.userRow.id;
    const exists = db.prepare('SELECT 1 FROM reel_likes WHERE reel_id = ? AND user_id = ?').get(reelId, uid);
    if (exists) {
      db.prepare('DELETE FROM reel_likes WHERE reel_id = ? AND user_id = ?').run(reelId, uid);
    } else {
      db.prepare('INSERT INTO reel_likes (reel_id, user_id, created_at) VALUES (?, ?, ?)').run(
        reelId,
        uid,
        new Date().toISOString()
      );
    }
    const likes = db.prepare('SELECT COUNT(*) AS count FROM reel_likes WHERE reel_id = ?').get(reelId).count;
    return { liked: !exists, likes };
  });

  // ── 2. Threads & Connected Replies ─────────────────────────────────────
  app.get('/api/v1/threads', { preHandler: auth.optionalAuth }, async (request) => {
    const viewerId = request.auth?.userRow?.id || null;
    const relations = getViewerRelations(db, viewerId);

    const rows = db
      .prepare(`
        SELECT t.*, u.username, u.avatar_initials AS initials, u.status AS author_status,
          (SELECT COUNT(*) FROM thread_likes tl WHERE tl.thread_id = t.id) AS likes_count
        FROM threads t
        JOIN users u ON u.id = t.author_id
        WHERE t.status = 'active' AND u.status != 'banned' AND u.status != 'deleted'
        ORDER BY t.created_at_ms DESC
      `)
      .all();

    const likedIds = new Set();
    if (viewerId) {
      for (const l of db.prepare('SELECT thread_id FROM thread_likes WHERE user_id = ?').all(viewerId)) {
        likedIds.add(l.thread_id);
      }
    }

    const replyRows = db
      .prepare(`
        SELECT tr.*, u.username, u.avatar_initials AS initials, u.status AS author_status
        FROM thread_replies tr
        JOIN users u ON u.id = tr.author_id
        WHERE u.status != 'banned' AND u.status != 'deleted'
        ORDER BY tr.created_at_ms ASC
      `)
      .all();

    const repliesByThread = new Map();
    for (const rep of replyRows) {
      if (relations.blockedIds.has(rep.author_id) || relations.blockedByIds.has(rep.author_id) || relations.mutedIds.has(rep.author_id)) {
        continue;
      }
      if (!repliesByThread.has(rep.thread_id)) repliesByThread.set(rep.thread_id, []);
      repliesByThread.get(rep.thread_id).push({
        id: rep.id,
        username: rep.username,
        initials: rep.initials,
        content: rep.content,
        timestamp: formatRelativeTime(rep.created_at_ms),
        likes: rep.likes_count,
      });
    }

    const items = rows
      .filter((t) => !relations.blockedIds.has(t.author_id) && !relations.blockedByIds.has(t.author_id) && !relations.mutedIds.has(t.author_id))
      .map((t) => {
        const replies = repliesByThread.get(t.id) || [];
        return {
          id: t.id,
          username: t.username,
          initials: t.initials,
          content: t.content,
          timestamp: formatRelativeTime(t.created_at_ms),
          likes: Number(t.likes_count || 0),
          isLiked: likedIds.has(t.id),
          replyCount: replies.length,
          replies,
        };
      });

    return { items };
  });

  app.post('/api/v1/threads', { preHandler: auth.requireAuth }, async (request, reply) => {
    const content = String(request.body?.content || '').trim();
    if (!content) {
      return reply.code(400).send({ error: { code: 'EMPTY_THREAD', message: 'Thread content cannot be empty.' } });
    }
    const viewer = request.auth.userRow;
    const id = 'thread_' + crypto.randomUUID().slice(0, 10);
    const now = Date.now();
    db.prepare('INSERT INTO threads (id, author_id, content, status, created_at_ms, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
      id,
      viewer.id,
      content.slice(0, 1000),
      'active',
      now,
      new Date(now).toISOString()
    );
    return reply.code(201).send({
      id,
      username: viewer.username,
      initials: viewer.avatar_initials,
      content: content.slice(0, 1000),
      timestamp: 'Just now',
      likes: 0,
      isLiked: false,
      replyCount: 0,
      replies: [],
    });
  });

  app.post('/api/v1/threads/:id/like', { preHandler: auth.requireAuth }, async (request) => {
    const tid = String(request.params.id);
    const uid = request.auth.userRow.id;
    const exists = db.prepare('SELECT 1 FROM thread_likes WHERE thread_id = ? AND user_id = ?').get(tid, uid);
    if (exists) {
      db.prepare('DELETE FROM thread_likes WHERE thread_id = ? AND user_id = ?').run(tid, uid);
    } else {
      db.prepare('INSERT INTO thread_likes (thread_id, user_id, created_at) VALUES (?, ?, ?)').run(
        tid,
        uid,
        new Date().toISOString()
      );
    }
    const likes = db.prepare('SELECT COUNT(*) AS count FROM thread_likes WHERE thread_id = ?').get(tid).count;
    return { liked: !exists, likes };
  });

  app.post('/api/v1/threads/:id/replies', { preHandler: auth.requireAuth }, async (request, reply) => {
    const tid = String(request.params.id);
    const thread = db.prepare("SELECT id, author_id FROM threads WHERE id = ? AND status = 'active'").get(tid);
    if (!thread) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Thread not found.' } });

    const content = String(request.body?.content || '').trim();
    if (!content) {
      return reply.code(400).send({ error: { code: 'EMPTY_REPLY', message: 'Reply cannot be empty.' } });
    }
    const viewer = request.auth.userRow;
    const id = 'tr_' + crypto.randomUUID().slice(0, 10);
    const now = Date.now();
    db.prepare(
      'INSERT INTO thread_replies (id, thread_id, author_id, content, likes_count, created_at_ms, created_at) VALUES (?, ?, ?, ?, 0, ?, ?)'
    ).run(id, tid, viewer.id, content.slice(0, 1000), now, new Date(now).toISOString());

    return reply.code(201).send({
      id,
      username: viewer.username,
      initials: viewer.avatar_initials,
      content: content.slice(0, 1000),
      timestamp: 'Just now',
      likes: 0,
    });
  });

  // ── 3. Opt-In Campus Directory (GET /api/v1/directory) ─────────────────
  app.get('/api/v1/directory', { preHandler: auth.optionalAuth }, async (request) => {
    const viewer = request.auth?.userRow || null;
    const relations = getViewerRelations(db, viewer?.id || null);

    const rows = db.prepare('SELECT * FROM users').all().map((u) => {
      let interests = [];
      try {
        interests = JSON.parse(u.interests_json || '[]');
      } catch {
        interests = [];
      }
      return {
        id: u.id,
        username: u.username,
        avatarInitials: u.avatar_initials,
        role: u.role,
        status: u.status,
        discoverable: Boolean(u.discoverable),
        branch: u.branch,
        year: u.year,
        bio: u.bio,
        interests,
      };
    });

    const items = rankDiscoverablePeers({
      candidates: rows,
      viewer,
      relations,
      query: String(request.query?.q || ''),
      branchFilter: String(request.query?.branch || 'all'),
      yearFilter: String(request.query?.year || 'all'),
      limit: Number(request.query?.limit || 30),
    });

    return { items };
  });

  // ── 4. Social Overview (Followers, Following, Requests, Groups, Safety) ──
  app.get('/api/v1/social/overview', { preHandler: auth.requireAuth }, async (request) => {
    const uid = request.auth.userRow.id;

    const followers = db
      .prepare(`
        SELECT u.id, u.username, u.avatar_initials AS initials, u.branch, u.year, u.discoverable, f.group_name
        FROM follows f
        JOIN users u ON u.id = f.follower_id
        WHERE f.followee_id = ? AND u.status = 'active'
      `)
      .all(uid)
      .map((r) => ({
        id: r.id,
        username: r.username,
        initials: r.initials,
        branch: r.discoverable ? r.branch : null,
        year: r.discoverable ? SHORT_YEAR(r.year) : null,
        groups: r.group_name ? [r.group_name] : ['Others'],
      }));

    const following = db
      .prepare(`
        SELECT u.id, u.username, u.avatar_initials AS initials, u.branch, u.year, u.discoverable
        FROM follows f
        JOIN users u ON u.id = f.followee_id
        WHERE f.follower_id = ? AND u.status = 'active'
      `)
      .all(uid)
      .map((r) => ({
        id: r.id,
        username: r.username,
        initials: r.initials,
        branch: r.discoverable ? r.branch : null,
        year: r.discoverable ? SHORT_YEAR(r.year) : null,
      }));

    const followRequests = db
      .prepare(`
        SELECT fr.id, u.id AS user_id, u.username, u.avatar_initials AS initials, u.branch, u.year, u.discoverable, fr.created_at_ms
        FROM follow_requests fr
        JOIN users u ON u.id = fr.requester_id
        WHERE fr.target_id = ? AND fr.status = 'pending' AND u.status = 'active'
        ORDER BY fr.created_at_ms DESC
      `)
      .all(uid)
      .map((r) => ({
        id: r.id,
        userId: r.user_id,
        username: r.username,
        initials: r.initials,
        branch: r.discoverable ? r.branch : null,
        year: r.discoverable ? SHORT_YEAR(r.year) : null,
        timestamp: formatRelativeTime(r.created_at_ms),
      }));

    const groupRows = db.prepare('SELECT name FROM custom_groups WHERE owner_id = ?').all(uid);
    const followerGroups = { Others: [] };
    for (const g of groupRows) followerGroups[g.name] = [];
    for (const f of followers) {
      const grp = f.groups[0] || 'Others';
      if (!followerGroups[grp]) followerGroups[grp] = [];
      followerGroups[grp].push(f.username);
    }

    const blockedUsers = db
      .prepare(`
        SELECT b.blocked_id AS id, u.username, u.avatar_initials AS initials, b.created_at, b.reason
        FROM blocks b
        JOIN users u ON u.id = b.blocked_id
        WHERE b.blocker_id = ?
      `)
      .all(uid)
      .map((r) => ({
        id: r.id,
        username: r.username,
        initials: r.initials,
        blockedAt: new Date(r.created_at).toLocaleDateString(),
        reason: r.reason,
      }));

    const mutedUsers = db
      .prepare(`
        SELECT m.muted_id AS id, u.username, u.avatar_initials AS initials, m.created_at
        FROM mutes m
        JOIN users u ON u.id = m.muted_id
        WHERE m.muter_id = ?
      `)
      .all(uid)
      .map((r) => ({
        id: r.id,
        username: r.username,
        initials: r.initials,
        mutedAt: new Date(r.created_at).toLocaleDateString(),
      }));

    const notifications = db
      .prepare(`
        SELECT id, actor_username AS actor, kind, title, target_type AS targetType, target_id AS targetId, is_read AS isRead, created_at_ms
        FROM notifications
        WHERE recipient_id = ?
        ORDER BY created_at_ms DESC
        LIMIT 30
      `)
      .all(uid)
      .map((n) => ({
        ...n,
        isRead: Boolean(n.isRead),
        timestamp: formatRelativeTime(n.created_at_ms),
      }));

    const savedPostIds = db
      .prepare('SELECT post_id FROM post_saves WHERE user_id = ?')
      .all(uid)
      .map((r) => r.post_id);

    return {
      followers,
      followersCount: followers.length,
      following,
      followingCount: following.length,
      followRequests,
      followerGroups,
      blockedUsers,
      mutedUsers,
      notifications,
      savedPostIds,
    };
  });

  // ── 5. Follow Requests, Groups & Silent Removal ────────────────────────
  app.post('/api/v1/follow-requests', { preHandler: auth.requireAuth }, async (request, reply) => {
    const requester = request.auth.userRow;
    const targetHandle = String(request.body?.targetUsername || '').trim().toLowerCase();
    const target = targetHandle
      ? db.prepare("SELECT id, username, profile_public FROM users WHERE username = ? AND status = 'active'").get(targetHandle)
      : db.prepare("SELECT id, username, profile_public FROM users WHERE id = ? AND status = 'active'").get(String(request.body?.targetUserId || ''));

    if (!target || target.id === requester.id) {
      return reply.code(404).send({ error: { code: 'USER_NOT_FOUND', message: 'Student account not found.' } });
    }

    const blocked = db
      .prepare('SELECT 1 FROM blocks WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)')
      .get(requester.id, target.id, target.id, requester.id);
    if (blocked) {
      return reply.code(403).send({ error: { code: 'UNAVAILABLE', message: 'Cannot connect with this account.' } });
    }

    const already = db.prepare('SELECT 1 FROM follows WHERE follower_id = ? AND followee_id = ?').get(requester.id, target.id);
    if (already) return { status: 'following' };

    const now = Date.now();
    const nowIso = new Date(now).toISOString();
    if (target.profile_public) {
      db.prepare('INSERT OR IGNORE INTO follows (follower_id, followee_id, group_name, created_at) VALUES (?, ?, ?, ?)').run(
        requester.id,
        target.id,
        'Others',
        nowIso
      );
      return { status: 'following' };
    }

    const reqId = 'req_' + crypto.randomUUID().slice(0, 10);
    db.prepare(`
      INSERT INTO follow_requests (id, requester_id, target_id, status, created_at_ms, created_at)
      VALUES (?, ?, ?, 'pending', ?, ?)
      ON CONFLICT(requester_id, target_id) DO UPDATE SET status = 'pending', created_at_ms = excluded.created_at_ms
    `).run(reqId, requester.id, target.id, now, nowIso);

    return { status: 'requested', id: reqId };
  });

  app.post('/api/v1/follow-requests/:id/respond', { preHandler: auth.requireAuth }, async (request, reply) => {
    const uid = request.auth.userRow.id;
    const reqRow = db.prepare('SELECT * FROM follow_requests WHERE id = ? AND target_id = ?').get(request.params.id, uid);
    if (!reqRow) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Follow request not found.' } });
    }

    const action = request.body?.action === 'accept' ? 'accept' : 'decline';
    const groupName = String(request.body?.groupName || 'Others').trim() || 'Others';

    if (action === 'accept') {
      db.prepare("UPDATE follow_requests SET status = 'accepted' WHERE id = ?").run(reqRow.id);
      db.prepare('INSERT OR REPLACE INTO follows (follower_id, followee_id, group_name, created_at) VALUES (?, ?, ?, ?)').run(
        reqRow.requester_id,
        uid,
        groupName,
        new Date().toISOString()
      );
      if (groupName !== 'Others') {
        db.prepare('INSERT OR IGNORE INTO custom_groups (owner_id, name) VALUES (?, ?)').run(uid, groupName);
      }
      return { accepted: true, groupName };
    }

    db.prepare("UPDATE follow_requests SET status = 'declined' WHERE id = ?").run(reqRow.id);
    return { declined: true };
  });

  // Silent follower removal (Prompt 455-456: never notifies removed follower)
  app.delete('/api/v1/followers/:username', { preHandler: auth.requireAuth }, async (request) => {
    const target = db.prepare('SELECT id FROM users WHERE username = ?').get(String(request.params.username).toLowerCase());
    if (target) {
      db.prepare('DELETE FROM follows WHERE follower_id = ? AND followee_id = ?').run(target.id, request.auth.userRow.id);
    }
    return { removed: true };
  });

  app.delete('/api/v1/following/:username', { preHandler: auth.requireAuth }, async (request) => {
    const target = db.prepare('SELECT id FROM users WHERE username = ?').get(String(request.params.username).toLowerCase());
    if (target) {
      db.prepare('DELETE FROM follows WHERE follower_id = ? AND followee_id = ?').run(request.auth.userRow.id, target.id);
    }
    return { unfollowed: true };
  });

  app.put('/api/v1/groups/assign', { preHandler: auth.requireAuth }, async (request, reply) => {
    const uid = request.auth.userRow.id;
    const username = String(request.body?.username || '').trim().toLowerCase();
    const groupName = String(request.body?.groupName || 'Others').trim();
    const peer = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (!peer) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Follower not found.' } });
    db.prepare('UPDATE follows SET group_name = ? WHERE follower_id = ? AND followee_id = ?').run(groupName, peer.id, uid);
    if (groupName !== 'Others') {
      db.prepare('INSERT OR IGNORE INTO custom_groups (owner_id, name) VALUES (?, ?)').run(uid, groupName);
    }
    return { updated: true, username, groupName };
  });

  // ── 6. Blocks, Mutes & Safety Reporting ────────────────────────────────
  app.post('/api/v1/blocks', { preHandler: auth.requireAuth }, async (request, reply) => {
    const blockerId = request.auth.userRow.id;
    const targetHandle = String(request.body?.username || '').trim().toLowerCase();
    const reason = String(request.body?.reason || 'User privacy preference').slice(0, 200);
    const target = db.prepare('SELECT id FROM users WHERE username = ?').get(targetHandle);
    if (!target || target.id === blockerId) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'User not found.' } });
    }
    // Block never notifies the blocked person; also tears down bidirectional follows cleanly
    db.prepare('INSERT OR REPLACE INTO blocks (blocker_id, blocked_id, reason, created_at) VALUES (?, ?, ?, ?)').run(
      blockerId,
      target.id,
      reason,
      new Date().toISOString()
    );
    db.prepare('DELETE FROM follows WHERE (follower_id = ? AND followee_id = ?) OR (follower_id = ? AND followee_id = ?)').run(
      blockerId,
      target.id,
      target.id,
      blockerId
    );
    return { blocked: true, username: targetHandle };
  });

  app.delete('/api/v1/blocks/:username', { preHandler: auth.requireAuth }, async (request) => {
    const target = db.prepare('SELECT id FROM users WHERE username = ?').get(String(request.params.username).toLowerCase());
    if (target) {
      db.prepare('DELETE FROM blocks WHERE blocker_id = ? AND blocked_id = ?').run(request.auth.userRow.id, target.id);
    }
    return { unblocked: true };
  });

  app.post('/api/v1/mutes', { preHandler: auth.requireAuth }, async (request, reply) => {
    const muterId = request.auth.userRow.id;
    const targetHandle = String(request.body?.username || '').trim().toLowerCase();
    const target = db.prepare('SELECT id FROM users WHERE username = ?').get(targetHandle);
    if (!target || target.id === muterId) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'User not found.' } });
    }
    db.prepare('INSERT OR REPLACE INTO mutes (muter_id, muted_id, created_at) VALUES (?, ?, ?)').run(
      muterId,
      target.id,
      new Date().toISOString()
    );
    return { muted: true, username: targetHandle };
  });

  app.delete('/api/v1/mutes/:username', { preHandler: auth.requireAuth }, async (request) => {
    const target = db.prepare('SELECT id FROM users WHERE username = ?').get(String(request.params.username).toLowerCase());
    if (target) {
      db.prepare('DELETE FROM mutes WHERE muter_id = ? AND muted_id = ?').run(request.auth.userRow.id, target.id);
    }
    return { unmuted: true };
  });

  app.post('/api/v1/reports', { preHandler: auth.requireAuth }, async (request, reply) => {
    const reporter = request.auth.userRow;
    const body = request.body || {};
    const targetType = ['post', 'comment', 'user', 'reel', 'thread'].includes(body.targetType)
      ? body.targetType
      : 'user';
    const targetId = String(body.targetId || body.targetUsername || '').trim();
    const reason = String(body.reason || 'Harassment or Bullying').trim();
    const details = String(body.details || '').trim().slice(0, 600);
    const snippet = String(body.contentSnippet || '').trim().slice(0, 240);

    if (!targetId) {
      return reply.code(400).send({ error: { code: 'MISSING_TARGET', message: 'Report target is required.' } });
    }

    const id = 'rep_' + crypto.randomUUID().slice(0, 10);
    db.prepare(`
      INSERT INTO reports (id, reporter_id, target_type, target_id, reason, details, content_snippet, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)
    `).run(id, reporter.id, targetType, targetId, reason, details, snippet, new Date().toISOString());

    return reply.code(201).send({
      id,
      status: 'pending',
      message: 'Confidential report received. Our safety team will review it.',
    });
  });

  app.post('/api/v1/notifications/read-all', { preHandler: auth.requireAuth }, async (request) => {
    db.prepare('UPDATE notifications SET is_read = 1 WHERE recipient_id = ?').run(request.auth.userRow.id);
    return { success: true };
  });

  // ── 7. EXIF-Stripping Upload & Access-Controlled Media Serving ─────────
  app.post('/api/v1/media/upload', { preHandler: auth.requireAuth }, async (request, reply) => {
    let rawBuffer = null;

    if (request.isMultipart && request.isMultipart()) {
      const part = await request.file();
      if (part) rawBuffer = await part.toBuffer();
    } else if (request.body?.dataUrl) {
      const match = String(request.body.dataUrl).match(/^data:[^;]+;base64,(.+)$/);
      if (match) rawBuffer = Buffer.from(match[1], 'base64');
    }

    try {
      const cleaned = sanitizeUploadedImage(rawBuffer, SECURITY_LIMITS.MAX_UPLOAD_BYTES);
      const id = 'med_' + crypto.randomUUID().slice(0, 12);
      db.prepare(`
        INSERT INTO media_assets (id, uploader_id, mime_type, extension, data, exif_stripped, stripped_bytes, created_at)
        VALUES (?, ?, ?, ?, ?, 1, ?, ?)
      `).run(
        id,
        request.auth.userRow.id,
        cleaned.mimeType,
        cleaned.extension,
        cleaned.buffer,
        cleaned.strippedBytes,
        new Date().toISOString()
      );

      return reply.code(201).send({
        mediaId: id,
        url: `/api/v1/media/${id}`,
        mimeType: cleaned.mimeType,
        exifStripped: true,
        strippedBytes: cleaned.strippedBytes,
      });
    } catch (err) {
      return reply.code(err.status || 400).send({
        error: { code: err.code || 'UPLOAD_FAILED', message: err.message },
      });
    }
  });

  app.get('/api/v1/media/:id', { preHandler: auth.optionalAuth }, async (request, reply) => {
    const asset = db.prepare('SELECT * FROM media_assets WHERE id = ?').get(request.params.id);
    if (!asset) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Media not found.' } });
    }

    const viewer = request.auth?.userRow || null;
    const attachedPost = db.prepare('SELECT * FROM posts WHERE media_id = ?').get(asset.id);
    if (attachedPost) {
      const author = db.prepare('SELECT status FROM users WHERE id = ?').get(attachedPost.author_id);
      const relations = getViewerRelations(db, viewer?.id || null);
      const postObj = {
        id: attachedPost.id,
        authorId: attachedPost.author_id,
        authorStatus: author?.status || 'active',
        space: attachedPost.space,
        audience: attachedPost.audience,
        groupName: attachedPost.group_name,
        status: attachedPost.status,
      };
      if (!canViewerSeePost(postObj, viewer, relations)) {
        return reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'Media access restricted.' } });
      }
    } else {
      const attachedReel = db.prepare('SELECT * FROM reels WHERE media_id = ?').get(asset.id);
      if (attachedReel) {
        const author = db.prepare('SELECT status FROM users WHERE id = ?').get(attachedReel.author_id);
        const relations = getViewerRelations(db, viewer?.id || null);
        if (
          attachedReel.status !== 'active' ||
          author?.status === 'banned' ||
          relations.blockedIds.has(attachedReel.author_id) ||
          relations.blockedByIds.has(attachedReel.author_id)
        ) {
          return reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'Media access restricted.' } });
        }
      } else if (!viewer || (asset.uploader_id !== viewer.id && viewer.role !== 'admin')) {
        return reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'Media access restricted.' } });
      }
    }

    reply.header('Content-Type', asset.mime_type);
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('Cache-Control', 'private, max-age=3600');
    return reply.send(Buffer.from(asset.data));
  });
}
