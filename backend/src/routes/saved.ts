import type { FastifyInstance } from 'fastify';
import type { DatabaseSync } from 'node:sqlite';
import type { AuthMiddleware } from '../middleware/auth.ts';
import { getViewerRelations, formatRelativeTime } from '../middleware/auth.ts';
import { canViewerSeePost } from '../algorithms/campusRanker.ts';
import { loadSinglePostWithStats } from './feed.ts';
import { loadReelsWithStats, type ReelItem } from './social.ts';
import { attachReelFollowStatus } from '../utils/reelCommentService.ts';

function loadSingleReelWithStats(
  db: DatabaseSync,
  reelId: string,
  viewerId: string | null
): ReelItem | null {
  const allReels = loadReelsWithStats(db, viewerId);
  const withFollow = attachReelFollowStatus(db, viewerId, allReels);
  const found = withFollow.find((r) => String(r.id) === String(reelId));
  if (!found || found.status === 'deleted') return null;
  return { ...found, isSaved: true };
}

interface SingleThreadPayload {
  id: string;
  authorId: string;
  authorStatus: string;
  username: string;
  initials: string;
  content: string;
  timestamp: string;
  timestampMs: number;
  likes: number;
  isLiked: boolean;
  isSaved: boolean;
  repliesCount: number;
  replies: unknown[];
}

function loadSingleThreadWithStats(
  db: DatabaseSync,
  threadId: string,
  viewerId: string | null
): SingleThreadPayload | null {
  const row = db
    .prepare(`
      SELECT t.*, u.username, u.avatar_initials AS initials, u.status AS author_status,
        (SELECT COUNT(*) FROM thread_likes tl WHERE tl.thread_id = t.id) AS likes_count,
        (SELECT COUNT(*) FROM thread_replies tr WHERE tr.thread_id = t.id AND tr.status != 'deleted') AS replies_count
      FROM threads t
      JOIN users u ON u.id = t.author_id
      WHERE t.id = ? AND t.status = 'active' AND u.status != 'banned' AND u.status != 'deleted'
    `)
    .get(threadId) as
    | {
        id: string;
        author_id: string;
        author_status: string;
        username: string;
        initials: string;
        content: string;
        created_at_ms: number;
        likes_count: number;
        replies_count: number;
      }
    | undefined;

  if (!row) return null;

  let isLiked = false;
  if (viewerId) {
    const likeRow = db
      .prepare('SELECT 1 FROM thread_likes WHERE thread_id = ? AND user_id = ?')
      .get(threadId, viewerId);
    isLiked = Boolean(likeRow);
  }

  return {
    id: row.id,
    authorId: row.author_id,
    authorStatus: row.author_status,
    username: row.username,
    initials: row.initials,
    content: row.content,
    timestamp: formatRelativeTime(row.created_at_ms),
    timestampMs: row.created_at_ms,
    likes: Number(row.likes_count || 0),
    isLiked,
    isSaved: true,
    repliesCount: Number(row.replies_count || 0),
    replies: [],
  };
}

export function registerSavedRoutes(
  app: FastifyInstance,
  db: DatabaseSync,
  auth: AuthMiddleware
): void {
  // ── 1. Save an item (post, reel, or thread) ──────────────────────────────────
  app.post<{ Params: { type: string; id: string } }>(
    '/api/v1/saved/:type/:id',
    { preHandler: auth.requireAuth },
    async (request, reply) => {
      const viewer = request.auth!.userRow;
      const type = request.params.type.trim().toLowerCase();
      const targetId = String(request.params.id);

      if (!['post', 'reel', 'thread'].includes(type)) {
        return reply.code(400).send({
          error: { code: 'INVALID_TYPE', message: 'Target type must be post, reel, or thread.' },
        });
      }

      const relations = getViewerRelations(db, viewer.id);

      if (type === 'post') {
        const post = loadSinglePostWithStats(db, targetId, viewer.id);
        if (!post || !canViewerSeePost(post, { id: viewer.id }, relations)) {
          return reply.code(404).send({
            error: { code: 'NOT_FOUND', message: 'Post not found or inaccessible.' },
          });
        }
      } else if (type === 'reel') {
        const reelRow = db
          .prepare('SELECT id, author_id, status, audience FROM reels WHERE id = ?')
          .get(targetId) as
          | { id: string; author_id: string; status: string; audience: string | null }
          | undefined;

        if (!reelRow || reelRow.status !== 'active') {
          return reply.code(404).send({
            error: { code: 'NOT_FOUND', message: 'Reel not found or deleted.' },
          });
        }

        if (
          relations.blockedIds.has(reelRow.author_id) ||
          relations.blockedByIds.has(reelRow.author_id)
        ) {
          return reply.code(404).send({
            error: { code: 'NOT_FOUND', message: 'Reel not found.' },
          });
        }

        if (
          reelRow.audience === 'followers' &&
          viewer.id !== reelRow.author_id &&
          viewer.role !== 'admin' &&
          !relations.followingIds.has(reelRow.author_id)
        ) {
          return reply.code(404).send({
            error: { code: 'NOT_FOUND', message: 'Reel not found.' },
          });
        }
      } else if (type === 'thread') {
        const threadRow = db
          .prepare('SELECT id, author_id, status FROM threads WHERE id = ?')
          .get(targetId) as { id: string; author_id: string; status: string } | undefined;

        if (!threadRow || threadRow.status !== 'active') {
          return reply.code(404).send({
            error: { code: 'NOT_FOUND', message: 'Thread not found or deleted.' },
          });
        }

        if (
          relations.blockedIds.has(threadRow.author_id) ||
          relations.blockedByIds.has(threadRow.author_id)
        ) {
          return reply.code(404).send({
            error: { code: 'NOT_FOUND', message: 'Thread not found.' },
          });
        }
      }

      const saveId = `save_${viewer.id}_${type}_${targetId}`;
      const nowIso = new Date().toISOString();

      db.prepare(`
        INSERT OR IGNORE INTO saved_items (id, user_id, target_type, target_id, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(saveId, viewer.id, type, targetId, nowIso);

      if (type === 'post') {
        db.prepare(`
          INSERT OR IGNORE INTO post_saves (post_id, user_id, created_at)
          VALUES (?, ?, ?)
        `).run(targetId, viewer.id, nowIso);
      }

      return { saved: true, type, id: targetId };
    }
  );

  // ── 2. Remove saved item ───────────────────────────────────────────────────
  app.delete<{ Params: { type: string; id: string } }>(
    '/api/v1/saved/:type/:id',
    { preHandler: auth.requireAuth },
    async (request, reply) => {
      const viewer = request.auth!.userRow;
      const type = request.params.type.trim().toLowerCase();
      const targetId = String(request.params.id);

      if (!['post', 'reel', 'thread'].includes(type)) {
        return reply.code(400).send({
          error: { code: 'INVALID_TYPE', message: 'Target type must be post, reel, or thread.' },
        });
      }

      db.prepare(
        'DELETE FROM saved_items WHERE user_id = ? AND target_type = ? AND target_id = ?'
      ).run(viewer.id, type, targetId);

      if (type === 'post') {
        db.prepare('DELETE FROM post_saves WHERE user_id = ? AND post_id = ?').run(
          viewer.id,
          targetId
        );
      }

      return { saved: false, type, id: targetId };
    }
  );

  // ── 3. List saved items ────────────────────────────────────────────────────
  app.get<{
    Querystring: {
      type?: string;
      cursor?: string;
      limit?: string | number;
    };
  }>(
    '/api/v1/saved',
    { preHandler: auth.requireAuth },
    async (request) => {
      const viewer = request.auth!.userRow;
      const filterType = request.query?.type?.trim().toLowerCase();
      const limit = Math.min(Math.max(Number(request.query?.limit || 20), 1), 50);
      const cursor = request.query?.cursor ? String(request.query.cursor) : null;

      let query = 'SELECT id, target_type, target_id, created_at FROM saved_items WHERE user_id = ?';
      const params: unknown[] = [viewer.id];

      if (filterType && ['post', 'reel', 'thread'].includes(filterType)) {
        query += ' AND target_type = ?';
        params.push(filterType);
      }
      if (cursor) {
        query += ' AND created_at < ?';
        params.push(cursor);
      }
      query += ' ORDER BY created_at DESC LIMIT ?';
      params.push(limit + 1);

      const rows = db.prepare(query).all(...params) as Array<{
        id: string;
        target_type: 'post' | 'reel' | 'thread';
        target_id: string;
        created_at: string;
      }>;

      const hasMore = rows.length > limit;
      const pageRows = hasMore ? rows.slice(0, limit) : rows;
      const nextCursor = hasMore && pageRows.length > 0 ? pageRows[pageRows.length - 1].created_at : null;

      const relations = getViewerRelations(db, viewer.id);
      const items: Array<{
        id: string;
        type: 'post' | 'reel' | 'thread';
        targetId: string;
        savedAt: string;
        post?: unknown;
        reel?: unknown;
        thread?: unknown;
      }> = [];

      for (const r of pageRows) {
        if (r.target_type === 'post') {
          const post = loadSinglePostWithStats(db, r.target_id, viewer.id);
          if (!post || !canViewerSeePost(post, { id: viewer.id }, relations)) {
            db.prepare('DELETE FROM saved_items WHERE id = ?').run(r.id);
            continue;
          }
          items.push({
            id: r.id,
            type: 'post',
            targetId: r.target_id,
            savedAt: r.created_at,
            post: { ...post, isSaved: true },
          });
        } else if (r.target_type === 'reel') {
          const reel = loadSingleReelWithStats(db, r.target_id, viewer.id);
          if (!reel) {
            db.prepare('DELETE FROM saved_items WHERE id = ?').run(r.id);
            continue;
          }
          items.push({
            id: r.id,
            type: 'reel',
            targetId: r.target_id,
            savedAt: r.created_at,
            reel,
          });
        } else if (r.target_type === 'thread') {
          const thread = loadSingleThreadWithStats(db, r.target_id, viewer.id);
          if (!thread) {
            db.prepare('DELETE FROM saved_items WHERE id = ?').run(r.id);
            continue;
          }
          items.push({
            id: r.id,
            type: 'thread',
            targetId: r.target_id,
            savedAt: r.created_at,
            thread,
          });
        }
      }

      return { items, nextCursor };
    }
  );
}
