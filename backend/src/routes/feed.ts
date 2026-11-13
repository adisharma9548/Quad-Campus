import crypto from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { DatabaseSync } from 'node:sqlite';
import { POST_TYPES, SHORT_YEAR } from '../config/constants.ts';
import {
  canViewerSeePost,
  computeRealTrendingTopics,
  rankFeedPosts,
} from '../algorithms/campusRanker.ts';
import { formatRelativeTime, getViewerRelations } from '../middleware/auth.ts';
import type {
  AuthMiddleware,
  PostAnswerDto,
  PostItem,
  PostSpace,
  PostStatus,
  PostType,
  UserStatus,
} from '../types.ts';

interface JoinedPostRow {
  id: string;
  author_id: string;
  type: string;
  title: string;
  content: string;
  space: PostSpace;
  audience: string;
  group_name: string | null;
  hashtags_json: string | null;
  has_image: number;
  media_id: string | null;
  media_key: string | null;
  location: string | null;
  image_alt: string | null;
  best_answer_id: string | null;
  shares_count: number;
  status: PostStatus;
  edited_at_ms: number | null;
  created_at_ms: number;
  created_at: string;
  author_username: string;
  author_initials: string;
  author_branch: string;
  author_year: string;
  author_discoverable: number;
  author_status: UserStatus;
  likes_count: number;
  saves_count: number;
  answers_count: number;
}

interface JoinedAnswerRow {
  id: string;
  post_id: string;
  author_id: string;
  content: string;
  created_at_ms: number;
  username: string;
  avatar_initials: string;
}

export function loadAllPostsWithStats(db: DatabaseSync, viewerId: string | null): PostItem[] {
  const rows = db
    .prepare(`
      SELECT
        p.*,
        u.username AS author_username,
        u.avatar_initials AS author_initials,
        u.branch AS author_branch,
        u.year AS author_year,
        u.discoverable AS author_discoverable,
        u.status AS author_status,
        (SELECT COUNT(*) FROM post_likes pl WHERE pl.post_id = p.id) AS likes_count,
        (SELECT COUNT(*) FROM post_saves ps WHERE ps.post_id = p.id) AS saves_count,
        (SELECT COUNT(*) FROM post_answers pa WHERE pa.post_id = p.id) AS answers_count
      FROM posts p
      JOIN users u ON u.id = p.author_id
      WHERE p.status != 'deleted'
      ORDER BY p.created_at_ms DESC
    `)
    .all() as unknown as JoinedPostRow[];

  const likedIds = new Set<string>();
  const savedIds = new Set<string>();
  if (viewerId) {
    for (const r of db
      .prepare('SELECT post_id FROM post_likes WHERE user_id = ?')
      .all(viewerId) as Array<{ post_id: string }>) {
      likedIds.add(r.post_id);
    }
    for (const r of db
      .prepare('SELECT post_id FROM post_saves WHERE user_id = ?')
      .all(viewerId) as Array<{ post_id: string }>) {
      savedIds.add(r.post_id);
    }
  }

  const answersByPost = new Map<string, PostAnswerDto[]>();
  const answerRows = db
    .prepare(`
      SELECT a.*, u.username, u.avatar_initials
      FROM post_answers a
      JOIN users u ON u.id = a.author_id
      WHERE u.status != 'banned' AND u.status != 'deleted'
      ORDER BY a.created_at_ms ASC
    `)
    .all() as unknown as JoinedAnswerRow[];

  for (const a of answerRows) {
    if (!answersByPost.has(a.post_id)) answersByPost.set(a.post_id, []);
    answersByPost.get(a.post_id)!.push({
      id: a.id,
      username: a.username,
      initials: a.avatar_initials,
      text: a.content,
      timestamp: formatRelativeTime(a.created_at_ms),
    });
  }

  const now = Date.now();
  return rows.map((r) => {
    let hashtags: string[] = [];
    try {
      hashtags = JSON.parse(r.hashtags_json || '[]') as string[];
    } catch {
      hashtags = [];
    }
    const answers = answersByPost.get(r.id) || [];
    const showAcademics = Boolean(r.author_discoverable) || r.author_id === viewerId;

    return {
      id: r.id,
      authorId: r.author_id,
      authorStatus: r.author_status,
      type: r.type,
      title: r.title,
      username: r.author_username,
      authorUsername: r.author_username,
      initials: r.author_initials,
      branch: showAcademics ? r.author_branch : null,
      authorBranch: r.author_branch,
      year: showAcademics ? SHORT_YEAR(r.author_year) : null,
      authorYear: SHORT_YEAR(r.author_year),
      content: r.content,
      hashtags,
      space: r.space,
      audience: r.audience,
      groupName: r.group_name || '',
      timestamp: formatRelativeTime(r.created_at_ms, now),
      createdAtMs: r.created_at_ms,
      createdAt: r.created_at,
      edited: Boolean(r.edited_at_ms),
      editedAtMs: r.edited_at_ms || null,
      likes: Number(r.likes_count || 0),
      likesCount: Number(r.likes_count || 0),
      savesCount: Number(r.saves_count || 0),
      comments: answers.length,
      answersCount: answers.length,
      shares: Number(r.shares_count || 0),
      sharesCount: Number(r.shares_count || 0),
      hasImage: Boolean(r.has_image || r.media_id || r.media_key),
      mediaId: r.media_id || null,
      mediaUrl: r.media_id ? `/api/v1/media/${r.media_id}` : '',
      mediaKey: r.media_key || '',
      location: r.location || '',
      imageAlt: r.image_alt || '',
      bestAnswerId: r.best_answer_id || null,
      isLiked: likedIds.has(r.id),
      isSaved: savedIds.has(r.id),
      status: r.status,
      answers,
    };
  });
}

export function loadSinglePostWithStats(db: DatabaseSync, postId: string, viewerId: string | null): PostItem | null {
  const row = db
    .prepare(`
      SELECT
        p.*,
        u.username AS author_username,
        u.avatar_initials AS author_initials,
        u.branch AS author_branch,
        u.year AS author_year,
        u.discoverable AS author_discoverable,
        u.status AS author_status,
        (SELECT COUNT(*) FROM post_likes pl WHERE pl.post_id = p.id) AS likes_count,
        (SELECT COUNT(*) FROM post_saves ps WHERE ps.post_id = p.id) AS saves_count,
        (SELECT COUNT(*) FROM post_answers pa WHERE pa.post_id = p.id) AS answers_count
      FROM posts p
      JOIN users u ON u.id = p.author_id
      WHERE p.id = ? AND p.status != 'deleted'
    `)
    .get(postId) as unknown as JoinedPostRow | undefined;

  if (!row) return null;

  let isLiked = false;
  let isSaved = false;
  if (viewerId) {
    const likeRow = db.prepare('SELECT 1 FROM post_likes WHERE post_id = ? AND user_id = ?').get(postId, viewerId);
    isLiked = Boolean(likeRow);
    const saveRow = db.prepare('SELECT 1 FROM post_saves WHERE post_id = ? AND user_id = ?').get(postId, viewerId);
    isSaved = Boolean(saveRow);
  }

  const answerRows = db
    .prepare(`
      SELECT a.*, u.username, u.avatar_initials
      FROM post_answers a
      JOIN users u ON u.id = a.author_id
      WHERE a.post_id = ? AND u.status != 'banned' AND u.status != 'deleted'
      ORDER BY a.created_at_ms ASC
    `)
    .all(postId) as unknown as JoinedAnswerRow[];

  const answers: PostAnswerDto[] = answerRows.map((a) => ({
    id: a.id,
    username: a.username,
    initials: a.avatar_initials,
    text: a.content,
    timestamp: formatRelativeTime(a.created_at_ms),
  }));

  let hashtags: string[] = [];
  try {
    hashtags = JSON.parse(row.hashtags_json || '[]');
  } catch {
    hashtags = [];
  }

  const showAcademics = Boolean(row.author_discoverable) || row.author_id === viewerId;
  const now = Date.now();

  return {
    id: row.id,
    authorId: row.author_id,
    authorStatus: row.author_status,
    type: row.type,
    title: row.title,
    username: row.author_username,
    authorUsername: row.author_username,
    initials: row.author_initials,
    branch: showAcademics ? row.author_branch : null,
    authorBranch: row.author_branch,
    year: showAcademics ? SHORT_YEAR(row.author_year) : null,
    authorYear: SHORT_YEAR(row.author_year),
    content: row.content,
    hashtags,
    space: row.space,
    audience: row.audience,
    groupName: row.group_name || '',
    timestamp: formatRelativeTime(row.created_at_ms, now),
    createdAtMs: row.created_at_ms,
    createdAt: row.created_at,
    edited: Boolean(row.edited_at_ms),
    editedAtMs: row.edited_at_ms || null,
    likes: Number(row.likes_count || 0),
    likesCount: Number(row.likes_count || 0),
    savesCount: Number(row.saves_count || 0),
    comments: answers.length,
    answersCount: answers.length,
    shares: Number(row.shares_count || 0),
    sharesCount: Number(row.shares_count || 0),
    hasImage: Boolean(row.has_image || row.media_id || row.media_key),
    mediaId: row.media_id || null,
    mediaUrl: row.media_id ? `/api/v1/media/${row.media_id}` : '',
    mediaKey: row.media_key || '',
    location: row.location || '',
    imageAlt: row.image_alt || '',
    bestAnswerId: row.best_answer_id || null,
    isLiked,
    isSaved,
    status: row.status,
    answers,
  };
}

export function serializePostForResponse(post: PostItem) {
  const {
    authorId: _aid,
    authorStatus: _as,
    authorBranch: _ab,
    authorYear: _ay,
    authorUsername: _au,
    likesCount: _lc,
    savesCount: _sc,
    answersCount: _ac,
    sharesCount: _shc,
    ...publicPost
  } = post;
  return publicPost;
}

interface FeedQuery {
  scope?: string;
  tab?: string;
  q?: string;
  cursor?: string | number;
  limit?: string | number;
}

interface CreatePostBody {
  space?: PostSpace;
  type?: string;
  title?: string;
  content?: string;
  location?: string;
  imageAlt?: string;
  mediaId?: string;
  idempotencyKey?: string;
  audience?: string;
  groupName?: string;
  hashtags?: string[];
}

export function registerFeedRoutes(
  app: FastifyInstance,
  db: DatabaseSync,
  auth: AuthMiddleware
): void {
  // ── 1. Ranked Public Feed (GET /api/v1/feed) ───────────────────────────
  app.get<{ Querystring: FeedQuery }>(
    '/api/v1/feed',
    { preHandler: auth.optionalAuth },
    async (request) => {
      const viewerRow = request.auth?.userRow || null;
      const viewer = viewerRow
        ? {
            id: viewerRow.id,
            branch: viewerRow.branch,
            year: viewerRow.year,
            interests: JSON.parse(viewerRow.interests_json || '[]') as string[],
          }
        : null;
      const relations = getViewerRelations(db, viewer?.id || null);
      const allPosts = loadAllPostsWithStats(db, viewer?.id || null);

      const scope = String(request.query?.scope || 'all');
      const tab = String(request.query?.tab || 'for_you');
      const query = String(request.query?.q || '');
      const cursor = Number(request.query?.cursor || 0);
      const limit = Number(request.query?.limit || 20);

      const ranked = rankFeedPosts({
        posts: allPosts,
        viewer,
        relations,
        scope,
        tab,
        query,
        cursor,
        limit,
      });

      const trendingTopics = computeRealTrendingTopics(allPosts, viewer, relations, 5);

      return {
        items: ranked.items.map(serializePostForResponse),
        total: ranked.total,
        nextCursor: ranked.nextCursor,
        trendingTopics,
      };
    }
  );

  // ── 2. Personal Space Feed (GET /api/v1/feed/personal) ─────────────────
  app.get<{ Querystring: { group?: string } }>(
    '/api/v1/feed/personal',
    { preHandler: auth.requireAuth },
    async (request) => {
      const viewerRow = request.auth!.userRow;
      const viewer = { id: viewerRow.id, branch: viewerRow.branch, year: viewerRow.year };
      const relations = getViewerRelations(db, viewer.id);
      const allPosts = loadAllPostsWithStats(db, viewer.id);
      const groupFilter = String(request.query?.group || 'all');

      const visiblePersonal = allPosts.filter((post) => {
        if (post.space !== 'personal') return false;
        if (!canViewerSeePost(post, viewer, relations)) return false;
        if (groupFilter !== 'all') {
          const postTarget =
            post.groupName || (post.audience === 'followers' ? 'Followers' : '');
          return postTarget.toLowerCase() === groupFilter.toLowerCase();
        }
        return true;
      });

      return {
        items: visiblePersonal.map((p) => ({
          ...serializePostForResponse(p),
          audienceLabel: p.groupName || 'Approved Followers',
        })),
      };
    }
  );

  // ── 3. Single Permission-Checked Post (GET /api/v1/posts/:id) ──────────
  app.get<{ Params: { id: string } }>(
    '/api/v1/posts/:id',
    { preHandler: auth.optionalAuth },
    async (request, reply) => {
      const viewerRow = request.auth?.userRow || null;
      const viewer = viewerRow ? { id: viewerRow.id } : null;
      const relations = getViewerRelations(db, viewer?.id || null);
      const found = loadSinglePostWithStats(db, request.params.id, viewer?.id || null);

      if (!found || !canViewerSeePost(found, viewer, relations)) {
        return reply.code(404).send({
          error: { code: 'NOT_FOUND', message: 'Post unavailable or access restricted.' },
        });
      }

      return serializePostForResponse(found);
    }
  );

  // ── 4. Create Post (POST /api/v1/posts) ────────────────────────────────
  app.post<{ Body: CreatePostBody }>(
    '/api/v1/posts',
    { preHandler: auth.requireAuth },
    async (request, reply) => {
      const viewer = request.auth!.userRow;
      const body = request.body || {};
      const space: PostSpace = body.space === 'personal' ? 'personal' : 'public';
      const rawType = String(body.type || 'Discussion');
      const type: PostType = (POST_TYPES as readonly string[]).includes(rawType)
        ? (rawType as PostType)
        : 'Discussion';
      const title = String(body.title || '').trim().slice(0, 140);
      const content = String(body.content || '').trim();
      const location = String(body.location || '').trim().slice(0, 80);
      const imageAlt = String(body.imageAlt || '').trim().slice(0, 220);
      const mediaId = body.mediaId ? String(body.mediaId).trim() : null;
      const idempotencyKey =
        request.headers['idempotency-key'] || body.idempotencyKey
          ? String(request.headers['idempotency-key'] || body.idempotencyKey).slice(0, 80)
          : null;

      if (!content) {
        return reply.code(400).send({
          error: { code: 'EMPTY_CONTENT', message: 'Write a post message before publishing.' },
        });
      }
      if (content.length > 2000) {
        return reply.code(400).send({
          error: { code: 'CONTENT_TOO_LONG', message: 'Posts are capped at 2000 characters.' },
        });
      }

      if (idempotencyKey) {
        const existing = db
          .prepare('SELECT id FROM posts WHERE author_id = ? AND idempotency_key = ?')
          .get(viewer.id, idempotencyKey) as { id: string } | undefined;
        if (existing) {
          const all = loadAllPostsWithStats(db, viewer.id);
          const dup = all.find((p) => p.id === existing.id);
          if (dup) return reply.code(200).send(serializePostForResponse(dup));
        }
      }

      if (mediaId) {
        const owned = db
          .prepare('SELECT id FROM media_assets WHERE id = ? AND uploader_id = ?')
          .get(mediaId, viewer.id);
        if (!owned) {
          return reply.code(400).send({
            error: { code: 'INVALID_MEDIA', message: 'Referenced media attachment is invalid.' },
          });
        }
      }

      // Server validates audience vs space to prevent accidental public widening from Personal Space
      let audience = String(body.audience || (space === 'personal' ? 'group' : 'public'));
      let groupName = String(body.groupName || '').trim();
      if (space === 'personal') {
        if (audience !== 'followers' && audience !== 'group') {
          audience = groupName ? 'group' : 'followers';
        }
        if (audience === 'group' && !groupName) groupName = 'Close Friends';
      } else if (!['public', 'branch', 'year'].includes(audience)) {
        audience = 'public';
      }

      const explicitTags = Array.isArray(body.hashtags) ? body.hashtags : [];
      const inlineTags = content.match(/#[a-zA-Z0-9_]{2,30}/g) || [];
      const hashtags = Array.from(
        new Set(
          [...explicitTags, ...inlineTags]
            .map((t) => String(t).trim())
            .filter(Boolean)
            .map((t) => (t.startsWith('#') ? t : `#${t}`))
        )
      ).slice(0, 6);

      const id = 'post_' + crypto.randomUUID().slice(0, 10);
      const now = Date.now();
      const nowIso = new Date(now).toISOString();

      db.prepare(`
        INSERT INTO posts (
          id, author_id, type, title, content, space, audience, group_name, hashtags_json,
          has_image, media_id, location, image_alt, status, idempotency_key, created_at_ms, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)
      `).run(
        id,
        viewer.id,
        type,
        title,
        content,
        space,
        audience,
        groupName,
        JSON.stringify(hashtags),
        mediaId ? 1 : 0,
        mediaId,
        location,
        imageAlt,
        idempotencyKey,
        now,
        nowIso
      );

      const all = loadAllPostsWithStats(db, viewer.id);
      const created = all.find((p) => p.id === id)!;
      return reply.code(201).send(serializePostForResponse(created));
    }
  );

    // ── Record Post View (Decision 11: 30s throttle per user per post) ──
  app.post<{ Params: { id: string } }>(
    '/api/v1/posts/:id/view',
    { preHandler: auth.requireAuth },
    async (request, reply) => {
      const viewer = request.auth!.userRow;
      const relations = getViewerRelations(db, viewer.id);
      const post = loadSinglePostWithStats(db, request.params.id, viewer.id);
      if (!post || !canViewerSeePost(post, { id: viewer.id }, relations)) {
        return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Post not found.' } });
      }

      const nowMs = Date.now();
      const lastView = db
        .prepare(
          "SELECT viewed_at_ms FROM view_logs WHERE target_type = 'post' AND target_id = ? AND user_id = ? ORDER BY viewed_at_ms DESC LIMIT 1"
        )
        .get(post.id, viewer.id) as { viewed_at_ms: number } | undefined;

      let counted = false;
      if (!lastView || nowMs - lastView.viewed_at_ms >= 30_000) {
        const logId = 'vw_' + crypto.randomUUID().slice(0, 10);
        db.prepare(
          "INSERT INTO view_logs (id, target_type, target_id, user_id, viewed_at_ms, created_at) VALUES (?, 'post', ?, ?, ?, ?)"
        ).run(logId, post.id, viewer.id, nowMs, new Date(nowMs).toISOString());
        counted = true;
      }

      const viewsCountRow = db
        .prepare("SELECT COUNT(*) AS count FROM view_logs WHERE target_type = 'post' AND target_id = ?")
        .get(post.id) as { count: number };

      return { counted, viewsCount: Number(viewsCountRow.count) };
    }
  );

  // ── 5. Post Interactions: Like / Save / Hide / Answer / Best Answer ────
  app.post<{ Params: { id: string } }>(
    '/api/v1/posts/:id/like',
    { preHandler: auth.requireAuth },
    async (request, reply) => {
      const viewer = request.auth!.userRow;
      const relations = getViewerRelations(db, viewer.id);
      const post = loadSinglePostWithStats(db, request.params.id, viewer.id);
      if (!post || !canViewerSeePost(post, { id: viewer.id }, relations)) {
        return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Post not found.' } });
      }

      const exists = db
        .prepare('SELECT 1 FROM post_likes WHERE post_id = ? AND user_id = ?')
        .get(post.id, viewer.id);
      if (exists) {
        db.prepare('DELETE FROM post_likes WHERE post_id = ? AND user_id = ?').run(
          post.id,
          viewer.id
        );
      } else {
        db.prepare('INSERT INTO post_likes (post_id, user_id, created_at) VALUES (?, ?, ?)').run(
          post.id,
          viewer.id,
          new Date().toISOString()
        );
      }
      const likesRow = db
        .prepare('SELECT COUNT(*) AS count FROM post_likes WHERE post_id = ?')
        .get(post.id) as { count: number };
      return { liked: !exists, likes: Number(likesRow.count) };
    }
  );

  app.post<{ Params: { id: string } }>(
    '/api/v1/posts/:id/save',
    { preHandler: auth.requireAuth },
    async (request, reply) => {
      const viewer = request.auth!.userRow;
      const relations = getViewerRelations(db, viewer.id);
      const post = loadSinglePostWithStats(db, request.params.id, viewer.id);
      if (!post || !canViewerSeePost(post, { id: viewer.id }, relations)) {
        return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Post not found.' } });
      }

      const exists = db
        .prepare('SELECT 1 FROM post_saves WHERE post_id = ? AND user_id = ?')
        .get(post.id, viewer.id);
      if (exists) {
        db.prepare('DELETE FROM post_saves WHERE post_id = ? AND user_id = ?').run(
          post.id,
          viewer.id
        );
      } else {
        db.prepare('INSERT INTO post_saves (post_id, user_id, created_at) VALUES (?, ?, ?)').run(
          post.id,
          viewer.id,
          new Date().toISOString()
        );
      }
      const savesRow = db
        .prepare('SELECT COUNT(*) AS count FROM post_saves WHERE post_id = ?')
        .get(post.id) as { count: number };
      return { saved: !exists, saves: Number(savesRow.count) };
    }
  );

  app.post<{ Params: { id: string } }>(
    '/api/v1/posts/:id/hide',
    { preHandler: auth.requireAuth },
    async (request) => {
      db.prepare(
        'INSERT OR IGNORE INTO dismissed_posts (user_id, post_id, created_at) VALUES (?, ?, ?)'
      ).run(request.auth!.userRow.id, String(request.params.id), new Date().toISOString());
      return { hidden: true };
    }
  );

  app.post<{ Params: { id: string }; Body: { text?: string } }>(
    '/api/v1/posts/:id/answers',
    { preHandler: auth.requireAuth },
    async (request, reply) => {
      const viewer = request.auth!.userRow;
      const relations = getViewerRelations(db, viewer.id);
      const post = loadSinglePostWithStats(db, request.params.id, viewer.id);
      if (!post || !canViewerSeePost(post, { id: viewer.id }, relations)) {
        return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Post not found.' } });
      }

      const text = String(request.body?.text || '').trim();
      if (!text) {
        return reply
          .code(400)
          .send({ error: { code: 'EMPTY_REPLY', message: 'Reply text cannot be empty.' } });
      }

      const id = 'ans_' + crypto.randomUUID().slice(0, 10);
      const now = Date.now();
      const nowIso = new Date(now).toISOString();
      db.prepare(
        'INSERT INTO post_answers (id, post_id, author_id, content, created_at_ms, created_at) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(id, post.id, viewer.id, text.slice(0, 1500), now, nowIso);

      if (post.authorId !== viewer.id) {
        db.prepare(
          'INSERT INTO notifications (id, recipient_id, actor_username, kind, title, target_type, target_id, created_at_ms, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
        ).run(
          'n_' + crypto.randomUUID().slice(0, 10),
          post.authorId,
          viewer.username,
          'answer',
          // Never leak private Personal Space text in notifications!
          post.space === 'personal'
            ? `@${viewer.username} replied to a Personal Space post`
            : `@${viewer.username} replied to your ${post.type}`,
          'post',
          post.id,
          now,
          nowIso
        );
      }

      return reply.code(201).send({
        id,
        username: viewer.username,
        initials: viewer.avatar_initials,
        text: text.slice(0, 1500),
        timestamp: 'Just now',
      });
    }
  );

  app.post<{ Params: { id: string }; Body: { answerId?: string | null } }>(
    '/api/v1/posts/:id/best-answer',
    { preHandler: auth.requireAuth },
    async (request, reply) => {
      const viewer = request.auth!.userRow;
      const post = db
        .prepare('SELECT id, author_id, best_answer_id FROM posts WHERE id = ?')
        .get(request.params.id) as
        | { id: string; author_id: string; best_answer_id: string | null }
        | undefined;
      if (!post) {
        return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Post not found.' } });
      }
      if (post.author_id !== viewer.id) {
        return reply.code(403).send({
          error: { code: 'FORBIDDEN', message: 'Only the question author can mark Best Answer.' },
        });
      }

      const answerId = request.body?.answerId ? String(request.body.answerId) : null;
      const nextBest = post.best_answer_id === answerId ? null : answerId;
      db.prepare('UPDATE posts SET best_answer_id = ? WHERE id = ?').run(nextBest, post.id);
      return { bestAnswerId: nextBest };
    }
  );

  // ── Edit own post (PATCH /api/v1/posts/:id) ───────────────────────────
  app.patch<{ Params: { id: string }; Body: { title?: string; content?: string; hashtags?: string[] } }>(
    '/api/v1/posts/:id',
    { preHandler: auth.requireAuth },
    async (request, reply) => {
      const viewer = request.auth!.userRow;
      const post = db
        .prepare("SELECT id, author_id, content, title, hashtags_json FROM posts WHERE id = ? AND status != 'deleted'")
        .get(request.params.id) as
        | { id: string; author_id: string; content: string; title: string; hashtags_json: string | null }
        | undefined;
      if (!post) {
        return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Post not found.' } });
      }
      if (post.author_id !== viewer.id) {
        return reply.code(403).send({
          error: { code: 'FORBIDDEN', message: 'Only the author can edit this post.' },
        });
      }
      const body = request.body || {};
      const content = body.content === undefined ? post.content : String(body.content).trim();
      const title = body.title === undefined ? post.title : String(body.title).trim().slice(0, 140);
      if (!content) {
        return reply.code(400).send({
          error: { code: 'EMPTY_CONTENT', message: 'A post cannot be empty.' },
        });
      }
      if (content.length > 2000) {
        return reply.code(400).send({
          error: { code: 'CONTENT_TOO_LONG', message: 'Posts are capped at 2000 characters.' },
        });
      }
      const explicitTags = Array.isArray(body.hashtags) ? body.hashtags : [];
      const inlineTags = content.match(/#[a-zA-Z0-9_]{2,30}/g) || [];
      const hashtags = Array.from(
        new Set(
          [...explicitTags, ...inlineTags]
            .map((t) => String(t).trim())
            .filter(Boolean)
            .map((t) => (t.startsWith('#') ? t : `#${t}`))
        )
      ).slice(0, 6);

      db.prepare(
        'UPDATE posts SET title = ?, content = ?, hashtags_json = ?, edited_at_ms = ? WHERE id = ?'
      ).run(title, content, JSON.stringify(hashtags), Date.now(), post.id);

      const updated = loadAllPostsWithStats(db, viewer.id).find((p) => p.id === post.id)!;
      return serializePostForResponse(updated);
    }
  );

  app.delete<{ Params: { id: string } }>(
    '/api/v1/posts/:id',
    { preHandler: auth.requireAuth },
    async (request, reply) => {
      const viewer = request.auth!.userRow;
      const post = db
        .prepare('SELECT id, author_id FROM posts WHERE id = ?')
        .get(request.params.id) as { id: string; author_id: string } | undefined;
      if (!post) {
        return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Post not found.' } });
      }
      // Authors only. Administrators must use /api/v1/admin/posts/:id, which enforces
      // password re-authentication and writes an audit log entry.
      if (post.author_id !== viewer.id) {
        return reply.code(403).send({
          error: { code: 'FORBIDDEN', message: 'Only the author can delete this post.' },
        });
      }
      db.prepare(
        "UPDATE posts SET status = 'deleted', deleted_at = ?, deleted_reason = 'Deleted by author' WHERE id = ?"
      ).run(new Date().toISOString(), post.id);
      return { deleted: true, id: post.id };
    }
  );

  app.get('/api/v1/events/this-week', async () => {
    const rows = db
      .prepare(
        'SELECT id, date_label AS date, title, location, type, details FROM this_week_events ORDER BY sort_order ASC'
      )
      .all();
    return { items: rows };
  });
}
