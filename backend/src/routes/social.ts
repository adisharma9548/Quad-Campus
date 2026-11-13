import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import type { FastifyInstance } from 'fastify';
import type { DatabaseSync } from 'node:sqlite';
import { SECURITY_LIMITS, SHORT_YEAR, UPLOAD_DIR } from '../config/constants.ts';
import {
  canViewerSeePost,
  rankCampusReels,
} from '../algorithms/campusRanker.ts';
import { getDiscoverableUsers } from '../services/discovery.ts';
import { checkRateLimit, formatRelativeTime, getViewerRelations } from '../middleware/auth.ts';
import type { AuthMiddleware, PostSpace, PostStatus, ReelItem, UserRole, UserStatus } from '../types.ts';
import { sanitizeUploadedImage, type MediaSanitizeError } from '../utils/exifStripper.ts';
import {
  deleteReelUploadDir,
  probeVideo,
  resolveUploadPath,
  streamDiskMediaFile,
  transcodeReelVideo,
} from '../utils/videoProcessor.ts';
import { attachReelFollowStatus, queryReelComments } from '../utils/reelCommentService.ts';

interface JoinedReelRow {
  id: string;
  author_id: string;
  author_status: UserStatus;
  username: string;
  initials: string;
  caption: string;
  tag: string;
  duration: string;
  branch: string;
  year: string;
  discoverable: number;
  likes_count: number;
  comments_count: number;
  shares_count: number;
  views_count: number;
  poster_key: string | null;
  poster_alt: string | null;
  media_id: string | null;
  cover_media_id: string | null;
  video_path: string | null;
  thumbnail_path: string | null;
  cover_path: string | null;
  width: number | null;
  height: number | null;
  processing_error: string | null;
  duration_sec: number | null;
  trim_start: number | null;
  trim_end: number | null;
  fit_mode: string | null;
  audience: string | null;
  comments_enabled: number | null;
  mentions_json: string | null;
  hashtags_json: string | null;
  status: string;
  created_at_ms: number;
}

interface JoinedThreadRow {
  id: string;
  author_id: string;
  content: string;
  status: string;
  created_at_ms: number;
  username: string;
  initials: string;
  likes_count: number;
}

interface JoinedThreadReplyRow {
  id: string;
  thread_id: string;
  reel_id?: string;
  author_id: string;
  parent_comment_id: string | null;
  reply_to_user_id: string | null;
  reply_to_username: string | null;
  content: string;
  status: string;
  deleted_at: string | null;
  likes_count: number;
  created_at_ms: number;
  created_at: string;
  username: string;
  initials: string;
}

interface ThreadReplyDto {
  id: string;
  threadId: string;
  reelId?: string;
  parentCommentId: string | null;
  replyToUserId: string | null;
  replyToUsername: string | null;
  username: string;
  initials: string;
  content: string;
  body: string;
  timestamp: string;
  createdAt: string;
  likes: number;
  isDeleted: boolean;
  hasMoreReplies?: boolean;
  hiddenReplyCount?: number;
  reportedByMe?: boolean;
  replies: ThreadReplyDto[];
}

function sanitizePlainTextComment(raw: unknown): string {
  return String(raw ?? '')
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\r\n/g, '\n')
    .trim();
}

export function loadReelsWithStats(db: DatabaseSync, viewerId: string | null): ReelItem[] {
  const rows = viewerId
    ? (db
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
            (SELECT COUNT(*) FROM reel_comments rc WHERE rc.reel_id = r.id AND rc.status = 'active') AS comments_count,
            COALESCE((SELECT COUNT(*) FROM view_logs vl WHERE vl.target_type = 'reel' AND vl.target_id = r.id), 0) AS views_count
          FROM reels r
          JOIN users u ON u.id = r.author_id
          WHERE r.status = 'active'
             OR (r.status IN ('processing', 'failed') AND r.author_id = ?)
          ORDER BY r.created_at_ms DESC
        `)
        .all(viewerId) as unknown as JoinedReelRow[])
    : (db
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
            (SELECT COUNT(*) FROM reel_comments rc WHERE rc.reel_id = r.id AND rc.status = 'active') AS comments_count,
            COALESCE((SELECT COUNT(*) FROM view_logs vl WHERE vl.target_type = 'reel' AND vl.target_id = r.id), 0) AS views_count
          FROM reels r
          JOIN users u ON u.id = r.author_id
          WHERE r.status = 'active'
          ORDER BY r.created_at_ms DESC
        `)
        .all() as unknown as JoinedReelRow[]);

  const viewedIds = new Set<string>();
  const likedIds = new Set<string>();
  if (viewerId) {
    for (const v of db
      .prepare('SELECT reel_id FROM reel_views WHERE user_id = ?')
      .all(viewerId) as Array<{ reel_id: string }>) {
      viewedIds.add(v.reel_id);
    }
    for (const l of db
      .prepare('SELECT reel_id FROM reel_likes WHERE user_id = ?')
      .all(viewerId) as Array<{ reel_id: string }>) {
      likedIds.add(l.reel_id);
    }
  }

  return rows.map((r) => {
    const showAcademics = Boolean(r.discoverable) || r.author_id === viewerId;
    let parsedMentions: string[] = [];
    let parsedHashtags: string[] = [];
    try {
      parsedMentions = JSON.parse(r.mentions_json || '[]') as string[];
    } catch {
      parsedMentions = [];
    }
    try {
      parsedHashtags = JSON.parse(r.hashtags_json || '[]') as string[];
    } catch {
      parsedHashtags = [];
    }

    const durationSec =
      r.duration_sec !== null && r.duration_sec !== undefined && Number(r.duration_sec) > 0
        ? Number(r.duration_sec)
        : null;
    const duration =
      durationSec !== null ? formatDurationClock(durationSec) : r.duration && r.status === 'active' ? r.duration : '';

    const videoUrl = r.video_path
      ? `/api/v1/reels/${r.id}/video`
      : r.media_id
        ? `/api/v1/media/${r.media_id}`
        : '';
    const thumbnailUrl = r.thumbnail_path
      ? `/api/v1/reels/${r.id}/thumbnail`
      : r.cover_path
        ? `/api/v1/reels/${r.id}/cover`
        : r.cover_media_id
          ? `/api/v1/media/${r.cover_media_id}`
          : '';
    const coverUrl = r.cover_path
      ? `/api/v1/reels/${r.id}/cover`
      : r.cover_media_id
        ? `/api/v1/media/${r.cover_media_id}`
        : thumbnailUrl;

    const trimStart = Number(r.trim_start ?? 0);
    const trimEnd =
      r.trim_end !== null && r.trim_end !== undefined
        ? Number(r.trim_end)
        : durationSec;

    return {
      id: r.id,
      authorId: r.author_id,
      authorStatus: r.author_status,
      username: r.username,
      initials: r.initials,
      caption: r.caption,
      tag: r.tag,
      duration,
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
      mediaUrl: videoUrl,
      videoUrl,
      coverUrl,
      thumbnailUrl,
      durationSec,
      trimStart,
      trimEnd,
      width: r.width ?? null,
      height: r.height ?? null,
      fitMode: r.fit_mode === 'fit' ? 'fit' : 'crop',
      audience: r.audience === 'followers' ? 'followers' : 'campus',
      commentsEnabled: r.comments_enabled === undefined || r.comments_enabled === null ? true : Boolean(r.comments_enabled),
      mentions: parsedMentions,
      hashtags: parsedHashtags,
      status: r.status,
      processingError: r.processing_error ?? null,
      createdAtMs: r.created_at_ms,
    };
  });
}

function formatDurationClock(totalSec: number): string {
  const safe = Math.max(0, Math.round(totalSec));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

function extractTagsAndMentions(text: string): { hashtags: string[]; mentions: string[] } {
  const hashtags = Array.from(
    new Set(
      (text.match(/#([a-zA-Z0-9_]{2,40})/g) || []).map((t) => t.slice(1).toLowerCase())
    )
  ).slice(0, 15);
  const mentions = Array.from(
    new Set(
      (text.match(/@([a-zA-Z0-9_]{2,32})/g) || []).map((m) => m.slice(1).toLowerCase())
    )
  ).slice(0, 15);
  return { hashtags, mentions };
}

export interface SocialRouteOptions {
  uploadDir?: string;
  trackBackgroundTask?: (task: Promise<unknown>) => void;
  isAppClosing?: () => boolean;
}

export function registerSocialRoutes(
  app: FastifyInstance,
  db: DatabaseSync,
  auth: AuthMiddleware,
  options: SocialRouteOptions = {}
): void {
  const uploadDir = options.uploadDir ? path.resolve(options.uploadDir) : UPLOAD_DIR;
  const trackBackgroundTask = options.trackBackgroundTask || ((task: Promise<unknown>) => { void task; });
  const isAppClosing = options.isAppClosing || (() => false);

  const canViewerAccessReelMedia = (
    reelRow: { id: string; author_id: string; status: string; audience: string | null },
    viewerRow: { id: string; role?: UserRole } | null
  ): boolean => {
    if (reelRow.status === 'deleted') {
      if (viewerRow?.role === 'admin') {
        const pendingReport = db
          .prepare("SELECT 1 FROM reports WHERE target_type = 'reel' AND target_id = ? AND status = 'pending' LIMIT 1")
          .get(reelRow.id);
        return Boolean(pendingReport);
      }
      return false;
    }

    if (reelRow.status === 'processing' || reelRow.status === 'failed') {
      return Boolean(viewerRow && (viewerRow.id === reelRow.author_id || viewerRow.role === 'admin'));
    }

    if (reelRow.status !== 'active') return false;

    const author = db
      .prepare('SELECT status FROM users WHERE id = ?')
      .get(reelRow.author_id) as { status: UserStatus } | undefined;
    if (author?.status === 'banned' || author?.status === 'deleted') return false;

    const relations = getViewerRelations(db, viewerRow?.id || null);
    if (relations.blockedIds.has(reelRow.author_id) || relations.blockedByIds.has(reelRow.author_id)) {
      return false;
    }

    if (reelRow.audience === 'followers') {
      if (!viewerRow) return false;
      if (viewerRow.id !== reelRow.author_id && viewerRow.role !== 'admin' && !relations.followingIds.has(reelRow.author_id)) {
        return false;
      }
    }

    return true;
  };

  // ── 1. Reels (Ranked, Uploadable MP4/MOV, Paginated, Comments) ─────────
  const listReelsHandler = async (request: import('fastify').FastifyRequest) => {
    const query = (request.query || {}) as { limit?: string | number; offset?: string | number };
    const viewerRow = request.auth?.userRow || null;
    const viewer = viewerRow
      ? {
          id: viewerRow.id,
          interests: JSON.parse(viewerRow.interests_json || '[]') as string[],
        }
      : null;
    const relations = getViewerRelations(db, viewer?.id || null);
    const raw = attachReelFollowStatus(db, viewer?.id || null, loadReelsWithStats(db, viewer?.id || null));
    const ranked = rankCampusReels({ reels: raw, viewer, relations });
    const total = ranked.length;
    const hasExplicitLimit = query.limit !== undefined;
    const limit = hasExplicitLimit
      ? Math.min(Math.max(Number(query.limit || 10), 1), 50)
      : total || 50;
    const offset = Math.max(Number(query.offset || 0), 0);
    const sliced = ranked.slice(offset, offset + limit);
    const nextOffset = offset + sliced.length;

    return {
      items: sliced.map(({ authorId: _a, authorStatus: _s, score: _sc, ...rest }) => rest),
      total,
      hasMore: nextOffset < total,
      nextOffset,
    };
  };

  app.get('/api/v1/reels', { preHandler: auth.optionalAuth }, listReelsHandler);
  app.get('/api/reels', { preHandler: auth.optionalAuth }, listReelsHandler);

  const getSingleReelHandler = async (
    request: import('fastify').FastifyRequest<{ Params: { id: string } }>,
    reply: import('fastify').FastifyReply
  ) => {
    const reelId = String(request.params.id);
    const viewerRow = request.auth?.userRow || null;
    const row = db
      .prepare('SELECT id, author_id, status, audience FROM reels WHERE id = ?')
      .get(reelId) as { id: string; author_id: string; status: string; audience: string | null } | undefined;
    if (!row || !canViewerAccessReelMedia(row, viewerRow)) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Reel not found.' } });
    }
    const item = attachReelFollowStatus(
      db,
      viewerRow?.id || null,
      loadReelsWithStats(db, viewerRow?.id || null)
    ).find((r) => r.id === reelId);
    if (!item) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Reel not found.' } });
    }
    const { authorId: _a, authorStatus: _s, ...publicReel } = item;
    return publicReel;
  };

  app.get<{ Params: { id: string } }>('/api/v1/reels/:id', { preHandler: auth.optionalAuth }, getSingleReelHandler);
  app.get<{ Params: { id: string } }>('/api/reels/:id', { preHandler: auth.optionalAuth }, getSingleReelHandler);

  const createReelHandler = async (
    request: import('fastify').FastifyRequest,
    reply: import('fastify').FastifyReply
  ) => {
    const viewer = request.auth!.userRow;
    const reqWithMultipart = request as typeof request & {
      isMultipart?: () => boolean;
      parts?: () => AsyncIterableIterator<{
        type: 'file' | 'field';
        fieldname: string;
        mimetype?: string;
        filename?: string;
        value?: unknown;
        file?: NodeJS.ReadableStream & { truncated?: boolean };
        toBuffer?: () => Promise<Buffer>;
      }>;
    };

    const id = 'reel_' + crypto.randomUUID().slice(0, 10);
    let caption = '';
    let tag = 'Campus Reel';
    let trimStart = 0;
    let trimEnd = NaN;
    let fitMode: 'fit' | 'crop' = 'crop';
    let audience: 'campus' | 'followers' = 'campus';
    let commentsEnabled = true;
    let rawVideoPath: string | null = null;
    let videoTruncated = false;
    let coverBuffer: Buffer | null = null;

    const cleanupTempUpload = async () => {
      await deleteReelUploadDir(uploadDir, id).catch(() => {});
    };

    try {
      if (reqWithMultipart.isMultipart && reqWithMultipart.isMultipart() && reqWithMultipart.parts) {
        for await (const part of reqWithMultipart.parts()) {
          if (part.type === 'file') {
            if (part.fieldname === 'video') {
              const extRaw = path.extname(String(part.filename || '')).toLowerCase();
              const safeExt = ['.mp4', '.mov', '.m4v', '.webm'].includes(extRaw) ? extRaw : '.mp4';
              const absDir = path.join(uploadDir, 'reels', id);
              await fsp.mkdir(absDir, { recursive: true });
              const targetPath = path.join(absDir, `raw${safeExt}`);
              if (part.file) {
                await pipeline(part.file, fs.createWriteStream(targetPath));
                if (part.file.truncated) {
                  videoTruncated = true;
                }
              } else if (part.toBuffer) {
                const buf = await part.toBuffer();
                await fsp.writeFile(targetPath, buf);
              }
              rawVideoPath = targetPath;
            } else if (part.fieldname === 'cover' && part.toBuffer) {
              coverBuffer = await part.toBuffer();
            }
          } else {
            const val = String(part.value ?? '').trim();
            switch (part.fieldname) {
              case 'caption':
                caption = val;
                break;
              case 'tag':
                tag = val || tag;
                break;
              case 'trimStart':
                trimStart = Number(val);
                break;
              case 'trimEnd':
                trimEnd = Number(val);
                break;
              case 'fitMode':
                fitMode = val === 'fit' ? 'fit' : 'crop';
                break;
              case 'audience':
                audience = val === 'followers' ? 'followers' : 'campus';
                break;
              case 'commentsEnabled':
                commentsEnabled = val !== 'false' && val !== '0';
                break;
              case 'coverDataUrl': {
                const m = val.match(/^data:[^;]+;base64,(.+)$/);
                if (m) coverBuffer = Buffer.from(m[1], 'base64');
                break;
              }
            }
          }
        }
      } else {
        const body = (request.body || {}) as Record<string, unknown>;
        caption = String(body.caption || '').trim();
        tag = String(body.tag || 'Campus Reel').trim().slice(0, 40) || 'Campus Reel';
        if (body.trimStart !== undefined) trimStart = Number(body.trimStart);
        if (body.trimEnd !== undefined) trimEnd = Number(body.trimEnd);
        fitMode = body.fitMode === 'fit' ? 'fit' : 'crop';
        audience = body.audience === 'followers' ? 'followers' : 'campus';
        commentsEnabled = body.commentsEnabled === undefined ? true : Boolean(body.commentsEnabled);
      }

      if (videoTruncated) {
        await cleanupTempUpload();
        return reply.code(400).send({
          error: {
            code: 'FILE_TOO_LARGE',
            message: `Video exceeds maximum upload limit of ${Math.round(SECURITY_LIMITS.MAX_REEL_UPLOAD_BYTES / (1024 * 1024))} MB.`,
          },
        });
      }

      if (!rawVideoPath) {
        await cleanupTempUpload();
        return reply
          .code(400)
          .send({ error: { code: 'VIDEO_REQUIRED', message: 'Please upload a valid MP4 or MOV video for your reel.' } });
      }

      const rawStat = await fsp.stat(rawVideoPath);
      if (rawStat.size <= 0 || rawStat.size > SECURITY_LIMITS.MAX_REEL_UPLOAD_BYTES) {
        await cleanupTempUpload();
        return reply.code(400).send({
          error: {
            code: rawStat.size <= 0 ? 'INVALID_VIDEO' : 'FILE_TOO_LARGE',
            message:
              rawStat.size <= 0
                ? 'Uploaded video file is empty.'
                : `Video exceeds maximum upload limit of ${Math.round(SECURITY_LIMITS.MAX_REEL_UPLOAD_BYTES / (1024 * 1024))} MB.`,
          },
        });
      }

      if (caption.length > SECURITY_LIMITS.REEL_CAPTION_MAX_CHARS) {
        await cleanupTempUpload();
        return reply.code(400).send({
          error: {
            code: 'CAPTION_TOO_LONG',
            message: `Caption exceeds maximum of ${SECURITY_LIMITS.REEL_CAPTION_MAX_CHARS} characters.`,
          },
        });
      }

      if (coverBuffer) {
        try {
          coverBuffer = sanitizeUploadedImage(coverBuffer, SECURITY_LIMITS.MAX_UPLOAD_BYTES).buffer;
        } catch (err) {
          await cleanupTempUpload();
          const mediaErr = err as Partial<MediaSanitizeError>;
          return reply.code(mediaErr.status || 400).send({
            error: {
              code: mediaErr.code || 'INVALID_COVER',
              message: mediaErr.message || 'Cover image is invalid.',
            },
          });
        }
      }

      let probe;
      try {
        probe = await probeVideo(rawVideoPath);
      } catch (err) {
        await cleanupTempUpload();
        return reply.code(400).send({
          error: {
            code: 'INVALID_VIDEO_FORMAT',
            message: (err as Error).message || 'Uploaded file could not be decoded as a valid video.',
          },
        });
      }

      if (probe.durationSec > SECURITY_LIMITS.MAX_REEL_DURATION_SEC + 0.5) {
        await cleanupTempUpload();
        return reply.code(400).send({
          error: {
            code: 'VIDEO_TOO_LONG',
            message: `Reels must be ${SECURITY_LIMITS.MAX_REEL_DURATION_SEC} seconds or shorter.`,
          },
        });
      }

      const safeTrimStart = Number.isFinite(trimStart) ? Math.max(0, Math.min(trimStart, probe.durationSec)) : 0;
      const safeTrimEnd =
        Number.isFinite(trimEnd) && trimEnd > safeTrimStart
          ? Math.min(trimEnd, probe.durationSec)
          : Math.min(probe.durationSec, SECURITY_LIMITS.MAX_REEL_DURATION_SEC);
      const trimmedSpan = Math.max(0, safeTrimEnd - safeTrimStart);

      if (trimmedSpan > SECURITY_LIMITS.MAX_REEL_DURATION_SEC + 0.5) {
        await cleanupTempUpload();
        return reply.code(400).send({
          error: {
            code: 'TRIM_TOO_LONG',
            message: `Trimmed clip cannot exceed ${SECURITY_LIMITS.MAX_REEL_DURATION_SEC} seconds.`,
          },
        });
      }
      if (
        probe.durationSec >= SECURITY_LIMITS.MIN_REEL_DURATION_SEC &&
        trimmedSpan < SECURITY_LIMITS.MIN_REEL_DURATION_SEC - 0.1
      ) {
        await cleanupTempUpload();
        return reply.code(400).send({
          error: {
            code: 'TRIM_TOO_SHORT',
            message: `Reels must be at least ${SECURITY_LIMITS.MIN_REEL_DURATION_SEC} seconds long.`,
          },
        });
      }

      const { hashtags, mentions } = extractTagsAndMentions(caption);
      if (hashtags.length > 0 && tag === 'Campus Reel') {
        tag = hashtags[0].slice(0, 40);
      }

      // Mentions strictly respect Part 2 Directory visibility rules
      const discoverablePeers = getDiscoverableUsers(db, viewer.id, { limit: 200 });
      const discoverableMap = new Map(discoverablePeers.map((p) => [p.username.toLowerCase(), p]));
      const allowedMentions = mentions.filter((uname) => discoverableMap.has(uname));

      const now = Date.now();
      const nowIso = new Date(now).toISOString();
      db.prepare(`
        INSERT INTO reels (
          id, author_id, caption, tag, duration, poster_key, poster_alt,
          media_id, cover_media_id, video_path, thumbnail_path, cover_path,
          width, height, processing_error, duration_sec, trim_start, trim_end,
          fit_mode, audience, comments_enabled, mentions_json, hashtags_json,
          status, created_at_ms, created_at
        )
        VALUES (?, ?, ?, ?, '', 'robotics', ?, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, ?, ?, ?, ?, ?, ?, ?, 'processing', ?, ?)
      `).run(
        id,
        viewer.id,
        caption.slice(0, SECURITY_LIMITS.REEL_CAPTION_MAX_CHARS),
        tag.slice(0, 40),
        `Campus reel by @${viewer.username}`,
        safeTrimStart,
        safeTrimEnd,
        fitMode,
        audience,
        commentsEnabled ? 1 : 0,
        JSON.stringify(allowedMentions),
        JSON.stringify(hashtags),
        now,
        nowIso
      );

      // Offload heavy FFmpeg transcode from the HTTP request thread
      const bgTask = (async () => {
        try {
          const result = await transcodeReelVideo({
            uploadDir,
            reelId: id,
            rawInputPath: rawVideoPath!,
            fitMode,
            trimStart: safeTrimStart,
            trimEnd: safeTrimEnd,
            hasAudio: probe.hasAudio,
            customCoverBuffer: coverBuffer,
          });

          if (isAppClosing()) return;
          const existing = db.prepare('SELECT status FROM reels WHERE id = ?').get(id) as
            | { status: string }
            | undefined;
          if (!existing || existing.status === 'deleted') {
            await cleanupTempUpload();
            return;
          }

          const finalClock = formatDurationClock(result.durationSec);
          db.prepare(`
            UPDATE reels
            SET status = 'active',
                video_path = ?,
                thumbnail_path = ?,
                cover_path = ?,
                duration_sec = ?,
                duration = ?,
                width = ?,
                height = ?,
                processing_error = NULL
            WHERE id = ? AND status = 'processing'
          `).run(
            result.videoRelPath,
            result.thumbnailRelPath,
            result.coverRelPath,
            result.durationSec,
            finalClock,
            result.width,
            result.height,
            id
          );

          if (allowedMentions.length > 0) {
            const insertNotif = db.prepare(
              'INSERT INTO notifications (id, recipient_id, actor_username, kind, title, target_type, target_id, created_at_ms, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
            );
            for (const uname of allowedMentions) {
              const peer = discoverableMap.get(uname);
              if (peer && String(peer.id) !== viewer.id) {
                insertNotif.run(
                  'n_' + crypto.randomUUID().slice(0, 10),
                  String(peer.id),
                  viewer.username,
                  'reel_mention',
                  `@${viewer.username} mentioned you in a reel`,
                  'reel',
                  id,
                  Date.now(),
                  new Date().toISOString()
                );
              }
            }
          }
        } catch (err) {
          app.log.error({ err, reelId: id }, 'Background reel transcode failed');
          if (!isAppClosing()) {
            try {
              db.prepare(
                "UPDATE reels SET status = 'failed', processing_error = ? WHERE id = ? AND status = 'processing'"
              ).run(String((err as Error).message || 'Video transcoding failed.').slice(0, 300), id);
            } catch {
              // ignore DB errors during shutdown
            }
          }
        } finally {
          if (rawVideoPath) {
            await fsp.unlink(rawVideoPath).catch(() => {});
          }
        }
      })();
      trackBackgroundTask(bgTask);

      const created = attachReelFollowStatus(db, viewer.id, loadReelsWithStats(db, viewer.id)).find(
        (r) => r.id === id
      );
      if (!created) {
        return reply.code(500).send({ error: { code: 'CREATE_FAILED', message: 'Unable to load created reel.' } });
      }
      const { authorId: _a, authorStatus: _s, ...publicReel } = created;
      return reply.code(201).send(publicReel);
    } catch (err) {
      await cleanupTempUpload();
      throw err;
    }
  };

  app.post('/api/v1/reels', { preHandler: auth.requireAuth }, createReelHandler);
  app.post('/api/reels', { preHandler: auth.requireAuth }, createReelHandler);

  const registerReelDiskMediaRoute = (
    subpath: 'video' | 'thumbnail' | 'cover',
    column: 'video_path' | 'thumbnail_path' | 'cover_path',
    mimeType: string
  ) => {
    const handler = async (
      request: import('fastify').FastifyRequest<{ Params: { id: string } }>,
      reply: import('fastify').FastifyReply
    ) => {
      const reelId = String(request.params.id);
      const reelRow = db
        .prepare('SELECT id, author_id, status, audience, video_path, thumbnail_path, cover_path FROM reels WHERE id = ?')
        .get(reelId) as
        | {
            id: string;
            author_id: string;
            status: string;
            audience: string | null;
            video_path: string | null;
            thumbnail_path: string | null;
            cover_path: string | null;
          }
        | undefined;
      if (!reelRow) {
        return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Reel media not found.' } });
      }
      const viewerRow = request.auth?.userRow || null;
      if (!canViewerAccessReelMedia(reelRow, viewerRow)) {
        return reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'Media access restricted.' } });
      }
      const relPath =
        reelRow[column] ||
        (column === 'cover_path' ? reelRow.thumbnail_path : column === 'thumbnail_path' ? reelRow.cover_path : null);
      const absPath = resolveUploadPath(uploadDir, relPath);
      if (!absPath) {
        return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Media file not found.' } });
      }
      return streamDiskMediaFile(request, reply, absPath, mimeType);
    };

    app.get<{ Params: { id: string } }>(`/api/v1/reels/:id/${subpath}`, { preHandler: auth.optionalAuth }, handler);
    app.get<{ Params: { id: string } }>(`/api/reels/:id/${subpath}`, { preHandler: auth.optionalAuth }, handler);
  };

  registerReelDiskMediaRoute('video', 'video_path', 'video/mp4');
  registerReelDiskMediaRoute('thumbnail', 'thumbnail_path', 'image/jpeg');
  registerReelDiskMediaRoute('cover', 'cover_path', 'image/jpeg');

  const hideReelHandler = async (
    request: import('fastify').FastifyRequest<{ Params: { id: string } }>,
    reply: import('fastify').FastifyReply
  ) => {
    const viewer = request.auth!.userRow;
    const rl = checkRateLimit(db, `reel_hide:${viewer.id}`, 60, 60_000);
    if (!rl.allowed) {
      return reply.code(429).send({ error: { code: 'RATE_LIMITED', message: 'Slow down a moment.' } });
    }
    const reelId = String(request.params.id);
    const reel = db
      .prepare("SELECT id, author_id, status FROM reels WHERE id = ? AND status = 'active'")
      .get(reelId) as { id: string; author_id: string; status: string } | undefined;
    if (!reel) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Reel not found.' } });
    }
    if (reel.author_id === viewer.id) {
      return reply.code(400).send({
        error: { code: 'SELF_ACTION', message: 'You cannot hide your own reel.' },
      });
    }
    db.prepare(
      'INSERT OR IGNORE INTO dismissed_reels (user_id, reel_id, created_at) VALUES (?, ?, ?)'
    ).run(viewer.id, reelId, new Date().toISOString());
    return { ok: true, hidden: true };
  };

  const unhideReelHandler = async (
    request: import('fastify').FastifyRequest<{ Params: { id: string } }>
  ) => {
    const viewer = request.auth!.userRow;
    const reelId = String(request.params.id);
    db.prepare('DELETE FROM dismissed_reels WHERE user_id = ? AND reel_id = ?').run(viewer.id, reelId);
    return { ok: true, hidden: false };
  };

  app.post<{ Params: { id: string } }>('/api/v1/reels/:id/hide', { preHandler: auth.requireAuth }, hideReelHandler);
  app.post<{ Params: { id: string } }>('/api/reels/:id/hide', { preHandler: auth.requireAuth }, hideReelHandler);
  app.delete<{ Params: { id: string } }>('/api/v1/reels/:id/hide', { preHandler: auth.requireAuth }, unhideReelHandler);
  app.delete<{ Params: { id: string } }>('/api/reels/:id/hide', { preHandler: auth.requireAuth }, unhideReelHandler);

  const toggleReelCommentLikeHandler = async (
    request: import('fastify').FastifyRequest<{ Params: { id: string; commentId: string } }>,
    reply: import('fastify').FastifyReply
  ) => {
    const viewer = request.auth!.userRow;
    const rl = checkRateLimit(db, `reel_comment_like:${viewer.id}`, 80, 60_000);
    if (!rl.allowed) {
      return reply.code(429).send({ error: { code: 'RATE_LIMITED', message: 'Slow down a moment.' } });
    }
    const reelId = String(request.params.id);
    const commentId = String(request.params.commentId);
    const reelRow = db
      .prepare('SELECT id, author_id, status, audience FROM reels WHERE id = ?')
      .get(reelId) as { id: string; author_id: string; status: string; audience: string | null } | undefined;
    if (!reelRow || reelRow.status !== 'active') {
      return reply.code(404).send({ error: { code: 'REEL_NOT_FOUND', message: 'Reel not found.' } });
    }
    const blocked = db
      .prepare(
        'SELECT 1 FROM blocks WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)'
      )
      .get(viewer.id, reelRow.author_id, reelRow.author_id, viewer.id);
    if (blocked) {
      return reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'Reel access restricted.' } });
    }
    if (reelRow.audience === 'followers' && reelRow.author_id !== viewer.id && viewer.role !== 'admin') {
      const follows = db
        .prepare('SELECT 1 FROM follows WHERE follower_id = ? AND followee_id = ?')
        .get(viewer.id, reelRow.author_id);
      if (!follows) {
        return reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'Reel access restricted.' } });
      }
    }
    const commentRow = db
      .prepare('SELECT id, status FROM reel_comments WHERE id = ? AND reel_id = ?')
      .get(commentId, reelId) as { id: string; status: string } | undefined;
    if (!commentRow || commentRow.status !== 'active') {
      return reply.code(404).send({ error: { code: 'COMMENT_NOT_FOUND', message: 'Comment not found.' } });
    }
    const existing = db
      .prepare('SELECT 1 FROM reel_comment_likes WHERE comment_id = ? AND user_id = ?')
      .get(commentId, viewer.id);
    let liked = false;
    if (existing) {
      db.prepare('DELETE FROM reel_comment_likes WHERE comment_id = ? AND user_id = ?').run(
        commentId,
        viewer.id
      );
      liked = false;
    } else {
      db.prepare(
        'INSERT INTO reel_comment_likes (comment_id, user_id, created_at) VALUES (?, ?, ?)'
      ).run(commentId, viewer.id, new Date().toISOString());
      liked = true;
    }
    const countRow = db
      .prepare('SELECT COUNT(*) AS cnt FROM reel_comment_likes WHERE comment_id = ?')
      .get(commentId) as { cnt: number };
    return {
      ok: true,
      commentId,
      liked,
      likes: Number(countRow?.cnt || 0),
    };
  };

  app.post<{ Params: { id: string; commentId: string } }>(
    '/api/v1/reels/:id/comments/:commentId/like',
    { preHandler: auth.requireAuth },
    toggleReelCommentLikeHandler
  );
  app.post<{ Params: { id: string; commentId: string } }>(
    '/api/reels/:id/comments/:commentId/like',
    { preHandler: auth.requireAuth },
    toggleReelCommentLikeHandler
  );

  const resolveActiveReelForCommentAccess = (
    reelId: string,
    viewerRow: { id: string; role?: UserRole } | null
  ):
    | {
        reel: {
          id: string;
          author_id: string;
          status: string;
          audience: string | null;
          comments_enabled: number | null;
        };
      }
    | { status: 404 | 403; code: string; message: string } => {
    const reelRow = db
      .prepare('SELECT id, author_id, status, audience, comments_enabled FROM reels WHERE id = ?')
      .get(reelId) as
      | {
          id: string;
          author_id: string;
          status: string;
          audience: string | null;
          comments_enabled: number | null;
        }
      | undefined;
    if (!reelRow || reelRow.status !== 'active') {
      return { status: 404, code: 'NOT_FOUND', message: 'Reel not found.' };
    }
    if (!canViewerAccessReelMedia(reelRow, viewerRow)) {
      return {
        status: 403,
        code: 'FORBIDDEN',
        message: 'You do not have permission to view or comment on this reel.',
      };
    }
    return { reel: reelRow };
  };

  const countActiveReelComments = (reelId: string): number => {
    const row = db
      .prepare("SELECT COUNT(*) AS c FROM reel_comments WHERE reel_id = ? AND status = 'active'")
      .get(reelId) as { c: number } | undefined;
    return Number(row?.c || 0);
  };

  const getReelCommentsHandler = async (
    request: import('fastify').FastifyRequest<{
      Params: { id: string };
      Querystring: {
        sort?: string;
        limit?: string | number;
        offset?: string | number;
        cursor?: string;
        maxDepth?: string | number;
        parentId?: string;
      };
    }>,
    reply: import('fastify').FastifyReply
  ) => {
    const reelId = String(request.params.id);
    const viewerRow = request.auth?.userRow || null;
    const access = resolveActiveReelForCommentAccess(reelId, viewerRow);
    if ('status' in access) {
      return reply.code(access.status).send({ error: { code: access.code, message: access.message } });
    }
    const reelRow = access.reel;
    const limit = Math.min(50, Math.max(1, Number(request.query?.limit ?? 20) || 20));
    const offset = Math.max(0, Number(request.query?.offset ?? 0) || 0);
    const parsedMaxDepth = Number(request.query?.maxDepth);
    const maxDepth = Number.isFinite(parsedMaxDepth)
      ? Math.min(5, Math.max(0, parsedMaxDepth))
      : DEFAULT_THREAD_REPLY_DEPTH;
    const parentId = String(request.query?.parentId || '').trim() || null;
    const commentsEnabled = reelRow.comments_enabled === null ? true : Boolean(reelRow.comments_enabled);

    return queryReelComments(db, {
      reelId: reelRow.id,
      viewerId: viewerRow?.id || null,
      commentsEnabled,
      sort: request.query?.sort || 'top',
      parentId,
      limit,
      offset,
      cursor: request.query?.cursor || null,
      maxDepth,
    });
  };

  app.get<{
    Params: { id: string };
    Querystring: {
      sort?: string;
      limit?: string | number;
      offset?: string | number;
      cursor?: string;
      maxDepth?: string | number;
      parentId?: string;
    };
  }>('/api/v1/reels/:id/comments', { preHandler: auth.optionalAuth }, getReelCommentsHandler);
  app.get<{
    Params: { id: string };
    Querystring: {
      sort?: string;
      limit?: string | number;
      offset?: string | number;
      cursor?: string;
      maxDepth?: string | number;
      parentId?: string;
    };
  }>('/api/reels/:id/comments', { preHandler: auth.optionalAuth }, getReelCommentsHandler);

  const createReelCommentHandler = async (
    request: import('fastify').FastifyRequest<{
      Params: { id: string };
      Body: { content?: string; body?: string; parentCommentId?: string | null };
    }>,
    reply: import('fastify').FastifyReply
  ) => {
    const viewer = request.auth!.userRow;
    const rate = checkRateLimit(
      db,
      `reel_comment:${viewer.id}`,
      SECURITY_LIMITS.REEL_COMMENTS_PER_MIN,
      60_000
    );
    if (!rate.allowed) {
      return reply.code(429).send({
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many comments sent quickly. Please wait a moment.',
        },
      });
    }

    const reelId = String(request.params.id);
    const access = resolveActiveReelForCommentAccess(reelId, viewer);
    if ('status' in access) {
      return reply.code(access.status).send({ error: { code: access.code, message: access.message } });
    }
    const reelRow = access.reel;

    if (reelRow.comments_enabled === 0) {
      return reply.code(403).send({
        error: { code: 'COMMENTS_DISABLED', message: 'Comments are turned off for this reel.' },
      });
    }

    const content = sanitizePlainTextComment(request.body?.content ?? request.body?.body);
    if (!content) {
      return reply
        .code(400)
        .send({ error: { code: 'EMPTY_COMMENT', message: 'Comment cannot be empty.' } });
    }
    if (content.length > SECURITY_LIMITS.REEL_COMMENT_MAX_CHARS) {
      return reply.code(400).send({
        error: {
          code: 'COMMENT_TOO_LONG',
          message: `Comments cannot exceed ${SECURITY_LIMITS.REEL_COMMENT_MAX_CHARS} characters.`,
        },
      });
    }

    const parentCommentId = request.body?.parentCommentId
      ? String(request.body.parentCommentId).trim()
      : null;
    let replyToUserId: string | null = null;
    let replyToUsername = '';

    if (parentCommentId) {
      const parentRow = db
        .prepare(
          `SELECT rc.id, rc.reel_id, rc.author_id, COALESCE(rc.status, 'active') AS status, u.username
           FROM reel_comments rc
           JOIN users u ON u.id = rc.author_id
           WHERE rc.id = ?`
        )
        .get(parentCommentId) as
        | {
            id: string;
            reel_id: string;
            author_id: string;
            status: string;
            username: string;
          }
        | undefined;
      if (!parentRow) {
        return reply
          .code(404)
          .send({ error: { code: 'PARENT_NOT_FOUND', message: 'Parent comment not found.' } });
      }
      if (parentRow.reel_id !== reelId) {
        return reply.code(400).send({
          error: { code: 'INVALID_PARENT', message: 'Parent comment belongs to a different reel.' },
        });
      }
      if (parentRow.status === 'deleted') {
        return reply.code(400).send({
          error: { code: 'PARENT_DELETED', message: 'Cannot reply to a deleted comment.' },
        });
      }
      replyToUserId = parentRow.author_id;
      replyToUsername = parentRow.username;
    }

    const id = 'rc_' + crypto.randomUUID().slice(0, 10);
    const now = Date.now();
    const createdAt = new Date(now).toISOString();
    db.prepare(
      `INSERT INTO reel_comments
         (id, reel_id, author_id, parent_comment_id, reply_to_user_id, reply_to_username, content, status, created_at_ms, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`
    ).run(id, reelId, viewer.id, parentCommentId, replyToUserId, replyToUsername, content, now, createdAt);

    const insertNotif = db.prepare(
      'INSERT INTO notifications (id, recipient_id, actor_username, kind, title, target_type, target_id, created_at_ms, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    if (replyToUserId && replyToUserId !== viewer.id) {
      insertNotif.run(
        'n_' + crypto.randomUUID().slice(0, 10),
        replyToUserId,
        viewer.username,
        'reel_comment_reply',
        `@${viewer.username} replied to your comment on a reel`,
        'reel',
        reelId,
        now,
        createdAt
      );
    }
    if (reelRow.author_id !== viewer.id && reelRow.author_id !== replyToUserId) {
      insertNotif.run(
        'n_' + crypto.randomUUID().slice(0, 10),
        reelRow.author_id,
        viewer.username,
        'reel_comment',
        `@${viewer.username} commented on your reel`,
        'reel',
        reelId,
        now,
        createdAt
      );
    }

    const commentsCount = countActiveReelComments(reelId);
    return reply.code(201).send({
      id,
      reelId,
      threadId: reelId,
      parentCommentId,
      replyToUserId,
      replyToUsername,
      username: viewer.username,
      initials: viewer.avatar_initials,
      content,
      body: content,
      timestamp: 'Just now',
      createdAt,
      likes: 0,
      isDeleted: false,
      hasMoreReplies: false,
      hiddenReplyCount: 0,
      reportedByMe: false,
      replies: [],
      commentsCount,
    });
  };

  app.post<{
    Params: { id: string };
    Body: { content?: string; body?: string; parentCommentId?: string | null };
  }>('/api/v1/reels/:id/comments', { preHandler: auth.requireAuth }, createReelCommentHandler);
  app.post<{
    Params: { id: string };
    Body: { content?: string; body?: string; parentCommentId?: string | null };
  }>('/api/reels/:id/comments', { preHandler: auth.requireAuth }, createReelCommentHandler);

  const deleteReelCommentHandler = async (
    request: import('fastify').FastifyRequest<{ Params: { id: string; commentId: string } }>,
    reply: import('fastify').FastifyReply
  ) => {
    const viewer = request.auth!.userRow;
    const reelId = String(request.params.id);
    const commentId = String(request.params.commentId);

    const access = resolveActiveReelForCommentAccess(reelId, viewer);
    if ('status' in access) {
      return reply.code(access.status).send({ error: { code: access.code, message: access.message } });
    }
    const reelRow = access.reel;

    const commentRow = db
      .prepare("SELECT id, reel_id, author_id, COALESCE(status, 'active') AS status FROM reel_comments WHERE id = ? AND reel_id = ?")
      .get(commentId, reelId) as
      | { id: string; reel_id: string; author_id: string; status: string }
      | undefined;
    if (!commentRow || commentRow.status === 'deleted') {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Comment not found.' } });
    }

    const canDelete =
      commentRow.author_id === viewer.id ||
      reelRow.author_id === viewer.id ||
      viewer.role === 'admin';
    if (!canDelete) {
      return reply.code(403).send({
        error: { code: 'FORBIDDEN', message: 'You can only delete your own comments or comments on your reel.' },
      });
    }

    const hasChildren = Boolean(
      db.prepare('SELECT 1 FROM reel_comments WHERE parent_comment_id = ? LIMIT 1').get(commentId)
    );
    const hasPendingReport = Boolean(
      db
        .prepare("SELECT 1 FROM reports WHERE target_type = 'reel_comment' AND target_id = ? AND status = 'pending' LIMIT 1")
        .get(commentId)
    );

    if (hasChildren || hasPendingReport) {
      db.prepare(
        "UPDATE reel_comments SET status = 'deleted', content = '[deleted]', deleted_at = ? WHERE id = ?"
      ).run(new Date().toISOString(), commentId);
    } else {
      db.prepare('DELETE FROM reel_comments WHERE id = ?').run(commentId);
    }

    return {
      deleted: true,
      softDeleted: hasChildren || hasPendingReport,
      id: commentId,
      commentsCount: countActiveReelComments(reelId),
    };
  };

  app.delete<{ Params: { id: string; commentId: string } }>(
    '/api/v1/reels/:id/comments/:commentId',
    { preHandler: auth.requireAuth },
    deleteReelCommentHandler
  );
  app.delete<{ Params: { id: string; commentId: string } }>(
    '/api/reels/:id/comments/:commentId',
    { preHandler: auth.requireAuth },
    deleteReelCommentHandler
  );

  const reelViewHandler = async (
    request: import('fastify').FastifyRequest<{ Params: { id: string } }>,
    reply: import('fastify').FastifyReply
  ) => {
    const reelId = String(request.params.id);
    const viewer = request.auth!.userRow;
    const reelRow = db
      .prepare('SELECT id, author_id, status, audience FROM reels WHERE id = ?')
      .get(reelId) as { id: string; author_id: string; status: string; audience: string | null } | undefined;
    if (!reelRow || !canViewerAccessReelMedia(reelRow, viewer)) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Reel not found.' } });
    }

    const nowMs = Date.now();
    const lastView = db
      .prepare(
        "SELECT viewed_at_ms FROM view_logs WHERE target_type = 'reel' AND target_id = ? AND user_id = ? ORDER BY viewed_at_ms DESC LIMIT 1"
      )
      .get(reelId, viewer.id) as { viewed_at_ms: number } | undefined;

    let counted = false;
    if (!lastView || nowMs - lastView.viewed_at_ms >= 30_000) {
      const logId = 'vw_' + crypto.randomUUID().slice(0, 10);
      db.prepare(
        "INSERT INTO view_logs (id, target_type, target_id, user_id, viewed_at_ms, created_at) VALUES (?, 'reel', ?, ?, ?, ?)"
      ).run(logId, reelId, viewer.id, nowMs, new Date(nowMs).toISOString());
      counted = true;
    }

    db.prepare('INSERT OR IGNORE INTO reel_views (reel_id, user_id, viewed_at) VALUES (?, ?, ?)').run(
      reelId,
      viewer.id,
      new Date(nowMs).toISOString()
    );

    const viewsCountRow = db
      .prepare("SELECT COUNT(*) AS count FROM view_logs WHERE target_type = 'reel' AND target_id = ?")
      .get(reelId) as { count: number };

    return { seen: true, counted, viewsCount: Number(viewsCountRow.count) };
  };

  app.post<{ Params: { id: string } }>(
    '/api/v1/reels/:id/view',
    { preHandler: auth.requireAuth },
    reelViewHandler
  );
  app.post<{ Params: { id: string } }>(
    '/api/reels/:id/view',
    { preHandler: auth.requireAuth },
    reelViewHandler
  );

  app.post('/api/v1/reels/mark-all-seen', { preHandler: auth.requireAuth }, async (request) => {
    const uid = request.auth!.userRow.id;
    const nowIso = new Date().toISOString();
    const activeIds = db
      .prepare("SELECT id FROM reels WHERE status = 'active'")
      .all() as Array<{ id: string }>;
    const stmt = db.prepare(
      'INSERT OR IGNORE INTO reel_views (reel_id, user_id, viewed_at) VALUES (?, ?, ?)'
    );
    for (const r of activeIds) stmt.run(r.id, uid, nowIso);
    return { markedAllSeen: true };
  });

  const reelLikeHandler = async (
    request: import('fastify').FastifyRequest<{ Params: { id: string } }>,
    reply: import('fastify').FastifyReply
  ) => {
    const reelId = String(request.params.id);
    const viewer = request.auth!.userRow;
    const reelRow = db
      .prepare('SELECT id, author_id, status, audience FROM reels WHERE id = ?')
      .get(reelId) as { id: string; author_id: string; status: string; audience: string | null } | undefined;
    if (!reelRow || !canViewerAccessReelMedia(reelRow, viewer)) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Reel not found.' } });
    }

    const uid = viewer.id;
    const exists = db
      .prepare('SELECT 1 FROM reel_likes WHERE reel_id = ? AND user_id = ?')
      .get(reelId, uid);
    if (exists) {
      db.prepare('DELETE FROM reel_likes WHERE reel_id = ? AND user_id = ?').run(reelId, uid);
    } else {
      db.prepare('INSERT INTO reel_likes (reel_id, user_id, created_at) VALUES (?, ?, ?)').run(
        reelId,
        uid,
        new Date().toISOString()
      );
    }
    const likesRow = db
      .prepare('SELECT COUNT(*) AS count FROM reel_likes WHERE reel_id = ?')
      .get(reelId) as { count: number };
    return { liked: !exists, likes: Number(likesRow.count) };
  };

  app.post<{ Params: { id: string } }>(
    '/api/v1/reels/:id/like',
    { preHandler: auth.requireAuth },
    reelLikeHandler
  );
  app.post<{ Params: { id: string } }>(
    '/api/reels/:id/like',
    { preHandler: auth.requireAuth },
    reelLikeHandler
  );

  const deleteReelHandler = async (
    request: import('fastify').FastifyRequest<{ Params: { id: string } }>,
    reply: import('fastify').FastifyReply
  ) => {
    const reelId = String(request.params.id);
    const viewer = request.auth!.userRow;
    const reelRow = db
      .prepare(
        'SELECT id, author_id, status, media_id, cover_media_id FROM reels WHERE id = ?'
      )
      .get(reelId) as
      | {
          id: string;
          author_id: string;
          status: string;
          media_id: string | null;
          cover_media_id: string | null;
        }
      | undefined;

    if (!reelRow || reelRow.status === 'deleted') {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Reel not found.' } });
    }
    if (reelRow.author_id !== viewer.id && viewer.role !== 'admin') {
      return reply.code(403).send({
        error: { code: 'FORBIDDEN', message: 'You can only delete your own reels.' },
      });
    }

    const openReport = db
      .prepare(
        `SELECT 1 FROM reports
         WHERE status = 'pending'
           AND (
             (target_type = 'reel' AND target_id = ?)
             OR (target_type = 'reel_comment' AND target_id IN (SELECT id FROM reel_comments WHERE reel_id = ?))
           )
         LIMIT 1`
      )
      .get(reelId, reelId);
    const retainForModeration = Boolean(openReport);

    db.prepare('DELETE FROM reel_likes WHERE reel_id = ?').run(reelId);
    if (retainForModeration) {
      db.prepare(
        "UPDATE reel_comments SET status = 'deleted', content = '[deleted]', deleted_at = ? WHERE reel_id = ? AND status = 'active' AND id NOT IN (SELECT target_id FROM reports WHERE target_type = 'reel_comment' AND status = 'pending')"
      ).run(new Date().toISOString(), reelId);
    } else {
      db.prepare('DELETE FROM reel_comments WHERE reel_id = ?').run(reelId);
    }
    db.prepare('DELETE FROM reel_views WHERE reel_id = ?').run(reelId);
    db.prepare("DELETE FROM notifications WHERE target_type = 'reel' AND target_id = ?").run(reelId);

    if (retainForModeration) {
      db.prepare("UPDATE reels SET status = 'deleted' WHERE id = ?").run(reelId);
    } else {
      db.prepare(
        "UPDATE reels SET status = 'deleted', video_path = NULL, thumbnail_path = NULL, cover_path = NULL, media_id = NULL, cover_media_id = NULL WHERE id = ?"
      ).run(reelId);
      const assetIds = [reelRow.media_id, reelRow.cover_media_id].filter((x): x is string => Boolean(x));
      for (const assetId of assetIds) {
        db.prepare('DELETE FROM media_assets WHERE id = ?').run(assetId);
      }
      await deleteReelUploadDir(uploadDir, reelId).catch(() => {});
    }

    return {
      deleted: true,
      id: reelId,
      retainedForModeration: retainForModeration,
    };
  };

  app.delete<{ Params: { id: string } }>('/api/v1/reels/:id', { preHandler: auth.requireAuth }, deleteReelHandler);
  app.delete<{ Params: { id: string } }>('/api/reels/:id', { preHandler: auth.requireAuth }, deleteReelHandler);

  // ── 2. Threads & Connected Nested Replies ──────────────────────────────
  const DEFAULT_THREAD_REPLY_DEPTH = 2; // 0-indexed: loads levels 0, 1, 2 initially

  const filterVisibleReplyTree = (
    rows: JoinedThreadReplyRow[],
    relations: ReturnType<typeof getViewerRelations>
  ): {
    childrenByParent: Map<string, JoinedThreadReplyRow[]>;
    rowById: Map<string, JoinedThreadReplyRow>;
  } => {
    const rawChildren = new Map<string, JoinedThreadReplyRow[]>();
    const rowById = new Map<string, JoinedThreadReplyRow>();
    for (const row of rows) {
      rowById.set(row.id, row);
      const key = row.parent_comment_id || '__root__';
      if (!rawChildren.has(key)) rawChildren.set(key, []);
      rawChildren.get(key)!.push(row);
    }

    const isBlockedAuthor = (authorId: string) =>
      relations.blockedIds.has(authorId) ||
      relations.blockedByIds.has(authorId) ||
      relations.mutedIds.has(authorId);

    // Keep a node if it is active & visible, OR if it has any visible descendant
    const keepMemo = new Map<string, boolean>();
    const shouldKeep = (id: string): boolean => {
      if (keepMemo.has(id)) return keepMemo.get(id)!;
      const row = rowById.get(id);
      if (!row) return false;
      const kids = rawChildren.get(id) || [];
      const hasVisibleChild = kids.some((k) => shouldKeep(k.id));
      const selfVisible = row.status !== 'deleted' && !isBlockedAuthor(row.author_id);
      const keep = selfVisible || hasVisibleChild;
      keepMemo.set(id, keep);
      return keep;
    };

    const childrenByParent = new Map<string, JoinedThreadReplyRow[]>();
    for (const [parentKey, list] of rawChildren.entries()) {
      const kept = list.filter((r) => shouldKeep(r.id));
      if (kept.length > 0) {
        childrenByParent.set(parentKey, kept);
      }
    }
    return { childrenByParent, rowById };
  };

  const countSubtreeReplies = (
    parentId: string,
    childrenByParent: Map<string, JoinedThreadReplyRow[]>
  ): number => {
    const kids = childrenByParent.get(parentId) || [];
    let total = kids.length;
    for (const k of kids) {
      total += countSubtreeReplies(k.id, childrenByParent);
    }
    return total;
  };

  const getReportedThreadCommentIds = (
    viewerId: string | null,
    targetType: 'thread_comment' | 'reel_comment' = 'thread_comment'
  ): Set<string> => {
    const reported = new Set<string>();
    if (!viewerId) return reported;
    const rows = db
      .prepare(
        "SELECT target_id FROM reports WHERE reporter_id = ? AND target_type = ? AND status != 'dismissed'"
      )
      .all(viewerId, targetType) as Array<{ target_id: string }>;
    for (const r of rows) reported.add(r.target_id);
    return reported;
  };

  const buildReplySubtree = (
    parentKey: string,
    childrenByParent: Map<string, JoinedThreadReplyRow[]>,
    relations: ReturnType<typeof getViewerRelations>,
    depth: number,
    maxDepth: number,
    reportedIds: Set<string> = new Set()
  ): ThreadReplyDto[] => {
    const list = childrenByParent.get(parentKey) || [];
    return list.map((rep) => {
      const isHiddenAuthor =
        relations.blockedIds.has(rep.author_id) ||
        relations.blockedByIds.has(rep.author_id) ||
        relations.mutedIds.has(rep.author_id);
      const isDeleted = rep.status === 'deleted' || isHiddenAuthor;
      const directChildren = childrenByParent.get(rep.id) || [];
      const canExpandChildren = depth < maxDepth;
      const nestedReplies = canExpandChildren
        ? buildReplySubtree(rep.id, childrenByParent, relations, depth + 1, maxDepth, reportedIds)
        : [];
      const hiddenCount =
        !canExpandChildren && directChildren.length > 0
          ? countSubtreeReplies(rep.id, childrenByParent)
          : 0;

      return {
        id: rep.id,
        threadId: rep.thread_id,
        ...(rep.reel_id ? { reelId: rep.reel_id } : {}),
        parentCommentId: rep.parent_comment_id,
        replyToUserId: rep.reply_to_user_id,
        replyToUsername: rep.reply_to_username,
        username: isDeleted ? '[deleted]' : rep.username,
        initials: isDeleted ? 'DEL' : rep.initials,
        content: isDeleted ? '[deleted]' : rep.content,
        body: isDeleted ? '[deleted]' : rep.content,
        timestamp: formatRelativeTime(rep.created_at_ms),
        createdAt: rep.created_at,
        likes: isDeleted ? 0 : Number(rep.likes_count || 0),
        isDeleted,
        hasMoreReplies: hiddenCount > 0,
        hiddenReplyCount: hiddenCount,
        reportedByMe: reportedIds.has(rep.id),
        replies: nestedReplies,
      };
    });
  };

  app.get<{ Querystring: { limit?: string | number; offset?: string | number; maxDepth?: string | number } }>(
    '/api/v1/threads',
    { preHandler: auth.optionalAuth },
    async (request) => {
      const viewerId = request.auth?.userRow?.id || null;
      const relations = getViewerRelations(db, viewerId);
      const limit = Math.min(Math.max(Number(request.query?.limit || 15), 1), 50);
      const offset = Math.max(Number(request.query?.offset || 0), 0);
      const maxDepth = Math.min(
        Math.max(
          request.query?.maxDepth !== undefined
            ? Number(request.query.maxDepth)
            : DEFAULT_THREAD_REPLY_DEPTH,
          0
        ),
        25
      );

      const rows = db
        .prepare(`
          SELECT t.*, u.username, u.avatar_initials AS initials, u.status AS author_status,
            (SELECT COUNT(*) FROM thread_likes tl WHERE tl.thread_id = t.id) AS likes_count
          FROM threads t
          JOIN users u ON u.id = t.author_id
          WHERE t.status = 'active' AND u.status != 'banned' AND u.status != 'deleted'
          ORDER BY t.created_at_ms DESC
        `)
        .all() as unknown as JoinedThreadRow[];

      const visibleThreads = rows.filter(
        (t) =>
          !relations.blockedIds.has(t.author_id) &&
          !relations.blockedByIds.has(t.author_id) &&
          !relations.mutedIds.has(t.author_id)
      );

      const pageThreads = visibleThreads.slice(offset, offset + limit);
      const pageThreadIds = new Set(pageThreads.map((t) => t.id));

      const likedIds = new Set<string>();
      if (viewerId) {
        for (const l of db
          .prepare('SELECT thread_id FROM thread_likes WHERE user_id = ?')
          .all(viewerId) as Array<{ thread_id: string }>) {
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
        .all() as unknown as JoinedThreadReplyRow[];

      const rawByThread = new Map<string, JoinedThreadReplyRow[]>();
      for (const rep of replyRows) {
        if (!pageThreadIds.has(rep.thread_id)) continue;
        if (!rawByThread.has(rep.thread_id)) rawByThread.set(rep.thread_id, []);
        rawByThread.get(rep.thread_id)!.push(rep);
      }

      const reportedIds = getReportedThreadCommentIds(viewerId);
      const items = pageThreads.map((t) => {
        const threadReplyRows = rawByThread.get(t.id) || [];
        const { childrenByParent } = filterVisibleReplyTree(threadReplyRows, relations);
        const totalReplyCount = countSubtreeReplies('__root__', childrenByParent);
        const replies = buildReplySubtree('__root__', childrenByParent, relations, 0, maxDepth, reportedIds);
        return {
          id: t.id,
          username: t.username,
          initials: t.initials,
          content: t.content,
          timestamp: formatRelativeTime(t.created_at_ms),
          likes: Number(t.likes_count || 0),
          isLiked: likedIds.has(t.id),
          replyCount: totalReplyCount,
          replies,
        };
      });

      const nextOffset = offset + pageThreads.length;
      return {
        items,
        total: visibleThreads.length,
        hasMore: nextOffset < visibleThreads.length,
        nextOffset,
      };
    }
  );

  app.get<{
    Params: { id: string };
    Querystring: { parentId?: string; maxDepth?: string | number; limit?: string | number; offset?: string | number };
  }>('/api/v1/threads/:id/replies', { preHandler: auth.optionalAuth }, async (request, reply) => {
    const tid = String(request.params.id);
    const thread = db
      .prepare("SELECT id FROM threads WHERE id = ? AND status = 'active'")
      .get(tid);
    if (!thread) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Thread not found.' } });
    }

    const viewerId = request.auth?.userRow?.id || null;
    const relations = getViewerRelations(db, viewerId);
    const parentId = request.query?.parentId ? String(request.query.parentId) : '__root__';
    const maxDepth = Math.min(Math.max(Number(request.query?.maxDepth ?? 3), 0), 25);
    const limit = Math.min(Math.max(Number(request.query?.limit || 50), 1), 100);
    const offset = Math.max(Number(request.query?.offset || 0), 0);

    const rows = db
      .prepare(`
        SELECT tr.*, u.username, u.avatar_initials AS initials, u.status AS author_status
        FROM thread_replies tr
        JOIN users u ON u.id = tr.author_id
        WHERE tr.thread_id = ? AND u.status != 'banned' AND u.status != 'deleted'
        ORDER BY tr.created_at_ms ASC
      `)
      .all(tid) as unknown as JoinedThreadReplyRow[];

    if (parentId !== '__root__' && !rows.some((r) => r.id === parentId)) {
      return reply
        .code(404)
        .send({ error: { code: 'PARENT_NOT_FOUND', message: 'Parent comment not found in this thread.' } });
    }

    const { childrenByParent } = filterVisibleReplyTree(rows, relations);
    const reportedIds = getReportedThreadCommentIds(viewerId);
    const fullSubtree = buildReplySubtree(parentId, childrenByParent, relations, 0, maxDepth, reportedIds);
    const items = fullSubtree.slice(offset, offset + limit);

    return {
      threadId: tid,
      parentId: parentId === '__root__' ? null : parentId,
      items,
      total: fullSubtree.length,
      hasMore: offset + items.length < fullSubtree.length,
    };
  });

  app.post<{ Body: { content?: string } }>(
    '/api/v1/threads',
    { preHandler: auth.requireAuth },
    async (request, reply) => {
      const content = String(request.body?.content || '').trim();
      if (!content) {
        return reply
          .code(400)
          .send({ error: { code: 'EMPTY_THREAD', message: 'Thread content cannot be empty.' } });
      }
      const viewer = request.auth!.userRow;
      const id = 'thread_' + crypto.randomUUID().slice(0, 10);
      const now = Date.now();
      db.prepare(
        'INSERT INTO threads (id, author_id, content, status, created_at_ms, created_at) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(id, viewer.id, content.slice(0, 1000), 'active', now, new Date(now).toISOString());
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
    }
  );

  app.post<{ Params: { id: string } }>(
    '/api/v1/threads/:id/like',
    { preHandler: auth.requireAuth },
    async (request, reply) => {
      const tid = String(request.params.id);
      const uid = request.auth!.userRow.id;
      const thread = db
        .prepare('SELECT id, author_id, status FROM threads WHERE id = ?')
        .get(tid) as { id: string; author_id: string; status: string } | undefined;
      if (!thread || thread.status !== 'active') {
        return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Thread not found.' } });
      }

      const author = db
        .prepare('SELECT status FROM users WHERE id = ?')
        .get(thread.author_id) as { status: UserStatus } | undefined;
      if (!author || author.status === 'banned' || author.status === 'deleted') {
        return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Thread not found.' } });
      }

      const relations = getViewerRelations(db, uid);
      if (relations.blockedIds.has(thread.author_id) || relations.blockedByIds.has(thread.author_id)) {
        return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Thread not found.' } });
      }

      const exists = db
        .prepare('SELECT 1 FROM thread_likes WHERE thread_id = ? AND user_id = ?')
        .get(tid, uid);
      if (exists) {
        db.prepare('DELETE FROM thread_likes WHERE thread_id = ? AND user_id = ?').run(tid, uid);
      } else {
        db.prepare('INSERT INTO thread_likes (thread_id, user_id, created_at) VALUES (?, ?, ?)').run(
          tid,
          uid,
          new Date().toISOString()
        );
      }
      const likesRow = db
        .prepare('SELECT COUNT(*) AS count FROM thread_likes WHERE thread_id = ?')
        .get(tid) as { count: number };
      return { liked: !exists, likes: Number(likesRow.count) };
    }
  );

  app.post<{
    Params: { id: string };
    Body: { content?: string; body?: string; parentCommentId?: string | null };
  }>('/api/v1/threads/:id/replies', { preHandler: auth.requireAuth }, async (request, reply) => {
    const viewer = request.auth!.userRow;
    const rateKey = `thread_reply:${viewer.id}`;
    const rate = checkRateLimit(db, rateKey, SECURITY_LIMITS.THREAD_REPLIES_PER_MIN, 60_000);
    if (!rate.allowed) {
      return reply.code(429).send({
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many replies in a short time. Please wait a moment before replying again.',
        },
      });
    }

    const tid = String(request.params.id);
    const thread = db
      .prepare("SELECT id, author_id FROM threads WHERE id = ? AND status = 'active'")
      .get(tid) as { id: string; author_id: string } | undefined;
    if (!thread) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Thread not found.' } });
    }

    const threadAuthor = db
      .prepare('SELECT status FROM users WHERE id = ?')
      .get(thread.author_id) as { status: UserStatus } | undefined;
    if (!threadAuthor || threadAuthor.status === 'banned' || threadAuthor.status === 'deleted') {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Thread not found.' } });
    }

    const relations = getViewerRelations(db, viewer.id);
    if (relations.blockedIds.has(thread.author_id) || relations.blockedByIds.has(thread.author_id)) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Thread not found.' } });
    }

    const rawBody = String(request.body?.body ?? request.body?.content ?? '').trim();
    if (!rawBody) {
      return reply
        .code(400)
        .send({ error: { code: 'EMPTY_REPLY', message: 'Reply cannot be empty.' } });
    }
    if (rawBody.length > SECURITY_LIMITS.THREAD_REPLY_MAX_CHARS) {
      return reply.code(400).send({
        error: {
          code: 'REPLY_TOO_LONG',
          message: `Reply exceeds maximum length of ${SECURITY_LIMITS.THREAD_REPLY_MAX_CHARS} characters.`,
        },
      });
    }

    const parentCommentId = request.body?.parentCommentId
      ? String(request.body.parentCommentId).trim()
      : null;

    let replyToUserId: string | null = null;
    let replyToUsername: string | null = null;

    if (parentCommentId) {
      const parentRow = db
        .prepare(
          `SELECT tr.id, tr.thread_id, tr.author_id, tr.status, u.username AS author_username
           FROM thread_replies tr
           JOIN users u ON u.id = tr.author_id
           WHERE tr.id = ?`
        )
        .get(parentCommentId) as
        | {
            id: string;
            thread_id: string;
            author_id: string;
            status: string;
            author_username: string;
          }
        | undefined;

      if (!parentRow) {
        return reply
          .code(404)
          .send({ error: { code: 'PARENT_NOT_FOUND', message: 'Parent comment not found.' } });
      }
      if (parentRow.thread_id !== tid) {
        return reply.code(400).send({
          error: {
            code: 'INVALID_PARENT',
            message: 'Parent comment belongs to a different thread.',
          },
        });
      }
      if (parentRow.status === 'deleted') {
        return reply.code(400).send({
          error: {
            code: 'PARENT_DELETED',
            message: 'Cannot reply to a deleted comment.',
          },
        });
      }
      replyToUserId = parentRow.author_id;
      replyToUsername = parentRow.author_username;
    }

    const id = 'tr_' + crypto.randomUUID().slice(0, 10);
    const now = Date.now();
    const createdAt = new Date(now).toISOString();

    db.prepare(
      `INSERT INTO thread_replies
        (id, thread_id, author_id, parent_comment_id, reply_to_user_id, reply_to_username, content, status, likes_count, created_at_ms, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'active', 0, ?, ?)`
    ).run(id, tid, viewer.id, parentCommentId, replyToUserId, replyToUsername, rawBody, now, createdAt);

    // Notify the user being replied to (and thread owner if distinct)
    const insertNotif = db.prepare(
      'INSERT INTO notifications (id, recipient_id, actor_username, kind, title, target_type, target_id, created_at_ms, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    if (replyToUserId && replyToUserId !== viewer.id) {
      insertNotif.run(
        'n_' + crypto.randomUUID().slice(0, 10),
        replyToUserId,
        viewer.username,
        'thread_reply',
        `@${viewer.username} replied to your comment`,
        'thread',
        tid,
        now,
        createdAt
      );
    }
    if (thread.author_id !== viewer.id && thread.author_id !== replyToUserId) {
      insertNotif.run(
        'n_' + crypto.randomUUID().slice(0, 10),
        thread.author_id,
        viewer.username,
        'thread_reply',
        `@${viewer.username} replied on your thread`,
        'thread',
        tid,
        now,
        createdAt
      );
    }

    return reply.code(201).send({
      id,
      threadId: tid,
      parentCommentId,
      replyToUserId,
      replyToUsername,
      username: viewer.username,
      initials: viewer.avatar_initials,
      content: rawBody,
      body: rawBody,
      timestamp: 'Just now',
      createdAt,
      likes: 0,
      isDeleted: false,
      hasMoreReplies: false,
      hiddenReplyCount: 0,
      replies: [],
    });
  });

  app.delete<{ Params: { threadId: string; replyId: string } }>(
    '/api/v1/threads/:threadId/replies/:replyId',
    { preHandler: auth.requireAuth },
    async (request, reply) => {
      const tid = String(request.params.threadId);
      const rid = String(request.params.replyId);
      const viewer = request.auth!.userRow;

      const row = db
        .prepare('SELECT id, thread_id, author_id, status FROM thread_replies WHERE id = ? AND thread_id = ?')
        .get(rid, tid) as { id: string; thread_id: string; author_id: string; status: string } | undefined;

      if (!row) {
        return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Reply not found.' } });
      }
      if (row.author_id !== viewer.id && viewer.role !== 'admin') {
        return reply.code(403).send({
          error: { code: 'FORBIDDEN', message: 'You can only delete your own comments.' },
        });
      }

      const hasChild = db
        .prepare('SELECT 1 FROM thread_replies WHERE parent_comment_id = ? LIMIT 1')
        .get(rid);
      const nowIso = new Date().toISOString();

      if (hasChild) {
        db.prepare(
          "UPDATE thread_replies SET status = 'deleted', content = '[deleted]', deleted_at = ? WHERE id = ?"
        ).run(nowIso, rid);
        return { deleted: true, softDeleted: true, id: rid, content: '[deleted]' };
      }

      db.prepare('DELETE FROM thread_replies WHERE id = ?').run(rid);
      return { deleted: true, softDeleted: false, id: rid };
    }
  );

  // ── 3. Opt-In Campus Directory & Who To Follow (Single Source of Truth) ──
  app.get<{ Querystring: { q?: string; branch?: string; year?: string; limit?: string | number } }>(
    '/api/v1/directory',
    { preHandler: auth.optionalAuth },
    async (request) => {
      const items = getDiscoverableUsers(db, request.auth?.userRow?.id || null, {
        q: String(request.query?.q || ''),
        branch: String(request.query?.branch || 'all'),
        year: String(request.query?.year || 'all'),
        limit: Number(request.query?.limit || 30),
        excludeConnected: false,
      });

      return { items };
    }
  );

  app.get<{ Querystring: { q?: string; branch?: string; year?: string; limit?: string | number } }>(
    '/api/v1/who-to-follow',
    { preHandler: auth.requireAuth },
    async (request) => {
      const items = getDiscoverableUsers(db, request.auth!.userRow.id, {
        q: String(request.query?.q || ''),
        branch: String(request.query?.branch || 'all'),
        year: String(request.query?.year || 'all'),
        limit: Number(request.query?.limit || 3),
        excludeConnected: true,
      });

      return { items };
    }
  );

  // ── 4. Social Overview (Followers, Following, Requests, Groups, Safety) ──
  app.get('/api/v1/social/overview', { preHandler: auth.requireAuth }, async (request) => {
    const uid = request.auth!.userRow.id;

    const followerRows = db
      .prepare(`
        SELECT u.id, u.username, u.avatar_initials AS initials, u.branch, u.year, u.discoverable, f.group_name
        FROM follows f
        JOIN users u ON u.id = f.follower_id
        WHERE f.followee_id = ? AND u.status = 'active'
      `)
      .all(uid) as Array<{
      id: string;
      username: string;
      initials: string;
      branch: string;
      year: string;
      discoverable: number;
      group_name: string | null;
    }>;

    const followers = followerRows.map((r) => ({
      id: r.id,
      username: r.username,
      initials: r.initials,
      branch: r.discoverable ? r.branch : null,
      year: r.discoverable ? SHORT_YEAR(r.year) : null,
      groups: r.group_name ? [r.group_name] : ['Others'],
    }));

    const followingRows = db
      .prepare(`
        SELECT u.id, u.username, u.avatar_initials AS initials, u.branch, u.year, u.discoverable
        FROM follows f
        JOIN users u ON u.id = f.followee_id
        WHERE f.follower_id = ? AND u.status = 'active'
      `)
      .all(uid) as Array<{
      id: string;
      username: string;
      initials: string;
      branch: string;
      year: string;
      discoverable: number;
    }>;

    const following = followingRows.map((r) => ({
      id: r.id,
      username: r.username,
      initials: r.initials,
      branch: r.discoverable ? r.branch : null,
      year: r.discoverable ? SHORT_YEAR(r.year) : null,
    }));

    const reqRows = db
      .prepare(`
        SELECT fr.id, u.id AS user_id, u.username, u.avatar_initials AS initials, u.branch, u.year, u.discoverable, fr.created_at_ms
        FROM follow_requests fr
        JOIN users u ON u.id = fr.requester_id
        WHERE fr.target_id = ? AND fr.status = 'pending' AND u.status = 'active'
        ORDER BY fr.created_at_ms DESC
      `)
      .all(uid) as Array<{
      id: string;
      user_id: string;
      username: string;
      initials: string;
      branch: string;
      year: string;
      discoverable: number;
      created_at_ms: number;
    }>;

    const followRequests = reqRows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      username: r.username,
      initials: r.initials,
      branch: r.discoverable ? r.branch : null,
      year: r.discoverable ? SHORT_YEAR(r.year) : null,
      timestamp: formatRelativeTime(r.created_at_ms),
    }));

    const groupRows = db
      .prepare('SELECT name FROM custom_groups WHERE owner_id = ?')
      .all(uid) as Array<{ name: string }>;
    const followerGroups: Record<string, string[]> = { Others: [] };
    for (const g of groupRows) followerGroups[g.name] = [];
    for (const f of followers) {
      const grp = f.groups[0] || 'Others';
      if (!followerGroups[grp]) followerGroups[grp] = [];
      followerGroups[grp].push(f.username);
    }

    const blockedRows = db
      .prepare(`
        SELECT b.blocked_id AS id, u.username, u.avatar_initials AS initials, b.created_at, b.reason
        FROM blocks b
        JOIN users u ON u.id = b.blocked_id
        WHERE b.blocker_id = ?
      `)
      .all(uid) as Array<{
      id: string;
      username: string;
      initials: string;
      created_at: string;
      reason: string;
    }>;

    const blockedUsers = blockedRows.map((r) => ({
      id: r.id,
      username: r.username,
      initials: r.initials,
      blockedAt: new Date(r.created_at).toLocaleDateString(),
      reason: r.reason,
    }));

    const mutedRows = db
      .prepare(`
        SELECT m.muted_id AS id, u.username, u.avatar_initials AS initials, m.created_at
        FROM mutes m
        JOIN users u ON u.id = m.muted_id
        WHERE m.muter_id = ?
      `)
      .all(uid) as Array<{
      id: string;
      username: string;
      initials: string;
      created_at: string;
    }>;

    const mutedUsers = mutedRows.map((r) => ({
      id: r.id,
      username: r.username,
      initials: r.initials,
      mutedAt: new Date(r.created_at).toLocaleDateString(),
    }));

    const notifRows = db
      .prepare(`
        SELECT id, actor_username AS actor, kind, title, target_type AS targetType, target_id AS targetId, is_read AS isRead, created_at_ms
        FROM notifications
        WHERE recipient_id = ?
        ORDER BY created_at_ms DESC
        LIMIT 30
      `)
      .all(uid) as Array<{
      id: string;
      actor: string;
      kind: string;
      title: string;
      targetType: string;
      targetId: string;
      isRead: number;
      created_at_ms: number;
    }>;

    const notifications = notifRows.map((n) => ({
      ...n,
      isRead: Boolean(n.isRead),
      timestamp: formatRelativeTime(n.created_at_ms),
    }));

    const savedPostIds = (
      db.prepare('SELECT post_id FROM post_saves WHERE user_id = ?').all(uid) as Array<{
        post_id: string;
      }>
    ).map((r) => r.post_id);

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
  app.post<{ Body: { targetUsername?: string; targetUserId?: string } }>(
    '/api/v1/follow-requests',
    { preHandler: auth.requireAuth },
    async (request, reply) => {
      const requester = request.auth!.userRow;
      const targetHandle = String(request.body?.targetUsername || '').trim().toLowerCase();
      const target = (
        targetHandle
          ? db
              .prepare("SELECT id, username, profile_public FROM users WHERE username = ? AND status = 'active'")
              .get(targetHandle)
          : db
              .prepare("SELECT id, username, profile_public FROM users WHERE id = ? AND status = 'active'")
              .get(String(request.body?.targetUserId || ''))
      ) as { id: string; username: string; profile_public: number } | undefined;

      if (!target || target.id === requester.id) {
        return reply
          .code(404)
          .send({ error: { code: 'USER_NOT_FOUND', message: 'Student account not found.' } });
      }

      const blocked = db
        .prepare(
          'SELECT 1 FROM blocks WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)'
        )
        .get(requester.id, target.id, target.id, requester.id);
      if (blocked) {
        return reply
          .code(403)
          .send({ error: { code: 'UNAVAILABLE', message: 'Cannot connect with this account.' } });
      }

      const already = db
        .prepare('SELECT 1 FROM follows WHERE follower_id = ? AND followee_id = ?')
        .get(requester.id, target.id);
      if (already) return { status: 'following' };

      const now = Date.now();
      const nowIso = new Date(now).toISOString();
      if (target.profile_public) {
        db.prepare(
          'INSERT OR IGNORE INTO follows (follower_id, followee_id, group_name, created_at) VALUES (?, ?, ?, ?)'
        ).run(requester.id, target.id, 'Others', nowIso);
        return { status: 'following' };
      }

      const reqId = 'req_' + crypto.randomUUID().slice(0, 10);
      db.prepare(`
        INSERT INTO follow_requests (id, requester_id, target_id, status, created_at_ms, created_at)
        VALUES (?, ?, ?, 'pending', ?, ?)
        ON CONFLICT(requester_id, target_id) DO UPDATE SET status = 'pending', created_at_ms = excluded.created_at_ms
      `).run(reqId, requester.id, target.id, now, nowIso);

      db.prepare(
        'INSERT INTO notifications (id, recipient_id, actor_username, kind, title, target_type, target_id, created_at_ms, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(
        'n_' + crypto.randomUUID().slice(0, 10),
        target.id,
        requester.username,
        'follow_request',
        `@${requester.username} requested to follow your Personal Space`,
        'request',
        reqId,
        now,
        nowIso
      );

      return { status: 'requested', id: reqId };
    }
  );

  app.post<{ Params: { id: string }; Body: { action?: string; groupName?: string } }>(
    '/api/v1/follow-requests/:id/respond',
    { preHandler: auth.requireAuth },
    async (request, reply) => {
      const uid = request.auth!.userRow.id;
      const reqRow = db
        .prepare('SELECT * FROM follow_requests WHERE id = ? AND target_id = ?')
        .get(request.params.id, uid) as
        | { id: string; requester_id: string }
        | undefined;
      if (!reqRow) {
        return reply
          .code(404)
          .send({ error: { code: 'NOT_FOUND', message: 'Follow request not found.' } });
      }

      const action = request.body?.action === 'accept' ? 'accept' : 'decline';
      const groupName = String(request.body?.groupName || 'Others').trim() || 'Others';

      if (action === 'accept') {
        db.prepare("UPDATE follow_requests SET status = 'accepted' WHERE id = ?").run(reqRow.id);
        const acceptedAt = Date.now();
        db.prepare(
          'INSERT INTO notifications (id, recipient_id, actor_username, kind, title, target_type, target_id, created_at_ms, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
        ).run(
          'n_' + crypto.randomUUID().slice(0, 10),
          reqRow.requester_id,
          request.auth!.userRow.username,
          'follow_accepted',
          `@${request.auth!.userRow.username} accepted your follow request`,
          'user',
          request.auth!.userRow.username,
          acceptedAt,
          new Date(acceptedAt).toISOString()
        );
        db.prepare(
          'INSERT OR REPLACE INTO follows (follower_id, followee_id, group_name, created_at) VALUES (?, ?, ?, ?)'
        ).run(reqRow.requester_id, uid, groupName, new Date().toISOString());
        if (groupName !== 'Others') {
          db.prepare('INSERT OR IGNORE INTO custom_groups (owner_id, name) VALUES (?, ?)').run(
            uid,
            groupName
          );
        }
        return { accepted: true, groupName };
      }

      db.prepare("UPDATE follow_requests SET status = 'declined' WHERE id = ?").run(reqRow.id);
      return { declined: true };
    }
  );

  // Silent follower removal (Prompt 455-456: never notifies removed follower)
  app.delete<{ Params: { username: string } }>(
    '/api/v1/followers/:username',
    { preHandler: auth.requireAuth },
    async (request) => {
      const target = db
        .prepare('SELECT id FROM users WHERE username = ?')
        .get(String(request.params.username).toLowerCase()) as { id: string } | undefined;
      if (target) {
        db.prepare('DELETE FROM follows WHERE follower_id = ? AND followee_id = ?').run(
          target.id,
          request.auth!.userRow.id
        );
      }
      return { removed: true };
    }
  );

  app.delete<{ Params: { username: string } }>(
    '/api/v1/following/:username',
    { preHandler: auth.requireAuth },
    async (request) => {
      const target = db
        .prepare('SELECT id FROM users WHERE username = ?')
        .get(String(request.params.username).toLowerCase()) as { id: string } | undefined;
      if (target) {
        db.prepare('DELETE FROM follows WHERE follower_id = ? AND followee_id = ?').run(
          request.auth!.userRow.id,
          target.id
        );
      }
      return { unfollowed: true };
    }
  );

  app.put<{ Body: { username?: string; groupName?: string } }>(
    '/api/v1/groups/assign',
    { preHandler: auth.requireAuth },
    async (request, reply) => {
      const uid = request.auth!.userRow.id;
      const username = String(request.body?.username || '').trim().toLowerCase();
      const groupName = String(request.body?.groupName || 'Others').trim();
      const peer = db
        .prepare('SELECT id FROM users WHERE username = ?')
        .get(username) as { id: string } | undefined;
      if (!peer) {
        return reply
          .code(404)
          .send({ error: { code: 'NOT_FOUND', message: 'Follower not found.' } });
      }
      db.prepare('UPDATE follows SET group_name = ? WHERE follower_id = ? AND followee_id = ?').run(
        groupName,
        peer.id,
        uid
      );
      if (groupName !== 'Others') {
        db.prepare('INSERT OR IGNORE INTO custom_groups (owner_id, name) VALUES (?, ?)').run(
          uid,
          groupName
        );
      }
      return { updated: true, username, groupName };
    }
  );

  // ── 6. Blocks, Mutes & Safety Reporting ────────────────────────────────
  app.post<{ Body: { username?: string; reason?: string } }>(
    '/api/v1/blocks',
    { preHandler: auth.requireAuth },
    async (request, reply) => {
      const blockerId = request.auth!.userRow.id;
      const targetHandle = String(request.body?.username || '').trim().toLowerCase();
      const reason = String(request.body?.reason || 'User privacy preference').slice(0, 200);
      const target = db
        .prepare('SELECT id FROM users WHERE username = ?')
        .get(targetHandle) as { id: string } | undefined;
      if (!target) {
        return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'User not found.' } });
      }
      if (target.id === blockerId) {
        return reply.code(400).send({ error: { code: 'SELF_ACTION', message: 'You cannot block yourself.' } });
      }
      // Block never notifies the blocked person; also tears down bidirectional follows cleanly
      db.prepare(
        'INSERT OR REPLACE INTO blocks (blocker_id, blocked_id, reason, created_at) VALUES (?, ?, ?, ?)'
      ).run(blockerId, target.id, reason, new Date().toISOString());
      db.prepare(
        'DELETE FROM follows WHERE (follower_id = ? AND followee_id = ?) OR (follower_id = ? AND followee_id = ?)'
      ).run(blockerId, target.id, target.id, blockerId);
      return { blocked: true, username: targetHandle };
    }
  );

  app.delete<{ Params: { username: string } }>(
    '/api/v1/blocks/:username',
    { preHandler: auth.requireAuth },
    async (request) => {
      const target = db
        .prepare('SELECT id FROM users WHERE username = ?')
        .get(String(request.params.username).toLowerCase()) as { id: string } | undefined;
      if (target) {
        db.prepare('DELETE FROM blocks WHERE blocker_id = ? AND blocked_id = ?').run(
          request.auth!.userRow.id,
          target.id
        );
      }
      return { unblocked: true };
    }
  );

  app.post<{ Body: { username?: string } }>(
    '/api/v1/mutes',
    { preHandler: auth.requireAuth },
    async (request, reply) => {
      const muterId = request.auth!.userRow.id;
      const targetHandle = String(request.body?.username || '').trim().toLowerCase();
      const target = db
        .prepare('SELECT id FROM users WHERE username = ?')
        .get(targetHandle) as { id: string } | undefined;
      if (!target) {
        return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'User not found.' } });
      }
      if (target.id === muterId) {
        return reply.code(400).send({ error: { code: 'SELF_ACTION', message: 'You cannot mute yourself.' } });
      }
      db.prepare('INSERT OR REPLACE INTO mutes (muter_id, muted_id, created_at) VALUES (?, ?, ?)').run(
        muterId,
        target.id,
        new Date().toISOString()
      );
      return { muted: true, username: targetHandle };
    }
  );

  app.delete<{ Params: { username: string } }>(
    '/api/v1/mutes/:username',
    { preHandler: auth.requireAuth },
    async (request) => {
      const target = db
        .prepare('SELECT id FROM users WHERE username = ?')
        .get(String(request.params.username).toLowerCase()) as { id: string } | undefined;
      if (target) {
        db.prepare('DELETE FROM mutes WHERE muter_id = ? AND muted_id = ?').run(
          request.auth!.userRow.id,
          target.id
        );
      }
      return { unmuted: true };
    }
  );

  app.post<{
    Body: {
      targetType?: string;
      targetId?: string;
      targetUsername?: string;
      reason?: string;
      details?: string;
      contentSnippet?: string;
    };
  }>('/api/v1/reports', { preHandler: auth.requireAuth }, async (request, reply) => {
    const reporter = request.auth!.userRow;
    const body = request.body || {};
    const targetType = [
      'post',
      'comment',
      'user',
      'reel',
      'thread',
      'thread_comment',
      'reel_comment',
    ].includes(
      body.targetType || ''
    )
      ? String(body.targetType)
      : 'user';
    const targetId = String(body.targetId || body.targetUsername || '').trim();
    const reason = String(body.reason || 'Harassment or bullying').trim().slice(0, 120);
    const details = String(body.details || '').trim().slice(0, 600);
    let snippet = String(body.contentSnippet || '').trim().slice(0, 240);
    let targetContext = '';

    if (!targetId) {
      return reply
        .code(400)
        .send({ error: { code: 'MISSING_TARGET', message: 'Report target is required.' } });
    }

    if (targetType === 'thread_comment' || targetType === 'reel_comment') {
      const commentRow = (
        targetType === 'reel_comment'
          ? db
              .prepare(
                `SELECT rc.id, rc.reel_id AS parent_id, rc.author_id, rc.content, rc.status, u.username AS author_username
                 FROM reel_comments rc
                 JOIN users u ON u.id = rc.author_id
                 WHERE rc.id = ?`
              )
              .get(targetId)
          : db
              .prepare(
                `SELECT tr.id, tr.thread_id AS parent_id, tr.author_id, tr.content, tr.status, u.username AS author_username
                 FROM thread_replies tr
                 JOIN users u ON u.id = tr.author_id
                 WHERE tr.id = ?`
              )
              .get(targetId)
      ) as
        | {
            id: string;
            parent_id: string;
            author_id: string;
            content: string;
            status: string;
            author_username: string;
          }
        | undefined;

      if (!commentRow || commentRow.status === 'deleted') {
        return reply
          .code(404)
          .send({ error: { code: 'TARGET_NOT_FOUND', message: 'Comment not found.' } });
      }
      if (commentRow.author_id === reporter.id) {
        return reply
          .code(400)
          .send({ error: { code: 'SELF_REPORT', message: 'You cannot report your own comment.' } });
      }
      if (!snippet) {
        snippet = String(commentRow.content || '').slice(0, 240);
      }
      targetContext = JSON.stringify(
        targetType === 'reel_comment'
          ? {
              reelId: commentRow.parent_id,
              commentId: commentRow.id,
              authorUsername: commentRow.author_username,
            }
          : {
              threadId: commentRow.parent_id,
              commentId: commentRow.id,
              authorUsername: commentRow.author_username,
            }
      );
    }

    const existing = db
      .prepare('SELECT id FROM reports WHERE reporter_id = ? AND target_type = ? AND target_id = ?')
      .get(reporter.id, targetType, targetId) as { id: string } | undefined;

    if (existing) {
      return reply.code(409).send({
        error: {
          code: 'DUPLICATE_REPORT',
          message: 'You already reported this',
        },
      });
    }

    const id = 'rep_' + crypto.randomUUID().slice(0, 10);
    db.prepare(`
      INSERT INTO reports (id, reporter_id, target_type, target_id, reason, details, content_snippet, target_context, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
    `).run(
      id,
      reporter.id,
      targetType,
      targetId,
      reason,
      details,
      snippet,
      targetContext,
      new Date().toISOString()
    );

    return reply.code(201).send({
      id,
      status: 'pending',
      message: 'Confidential report received. Our safety team will review it.',
    });
  });

  app.delete<{ Params: { targetType: string; targetId: string } }>(
    '/api/v1/reports/target/:targetType/:targetId',
    { preHandler: auth.requireAuth },
    async (request, reply) => {
      const reporter = request.auth!.userRow;
      const targetType = String(request.params.targetType || '').trim();
      const targetId = String(request.params.targetId || '').trim();
      const existing = db
        .prepare(
          "SELECT id FROM reports WHERE reporter_id = ? AND target_type = ? AND target_id = ? AND status = 'pending'"
        )
        .get(reporter.id, targetType, targetId) as { id: string } | undefined;

      if (!existing) {
        return reply.code(404).send({
          error: { code: 'NOT_FOUND', message: 'No pending report found to undo.' },
        });
      }

      db.prepare('DELETE FROM reports WHERE id = ?').run(existing.id);
      return { undone: true, id: existing.id };
    }
  );

  app.post('/api/v1/notifications/read-all', { preHandler: auth.requireAuth }, async (request) => {
    db.prepare('UPDATE notifications SET is_read = 1 WHERE recipient_id = ?').run(
      request.auth!.userRow.id
    );
    return { success: true };
  });

  // ── 7. EXIF-Stripping Upload & Access-Controlled Media Serving ─────────
  app.post<{ Body: { dataUrl?: string } }>(
    '/api/v1/media/upload',
    { preHandler: auth.requireAuth },
    async (request, reply) => {
      let rawBuffer: Buffer | null = null;

      const reqWithMultipart = request as typeof request & {
        isMultipart?: () => boolean;
        file?: () => Promise<{ toBuffer: () => Promise<Buffer> } | undefined>;
      };

      if (reqWithMultipart.isMultipart && reqWithMultipart.isMultipart()) {
        const part = reqWithMultipart.file ? await reqWithMultipart.file() : undefined;
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
          request.auth!.userRow.id,
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
        const mediaErr = err as Partial<MediaSanitizeError>;
        return reply.code(mediaErr.status || 400).send({
          error: {
            code: mediaErr.code || 'UPLOAD_FAILED',
            message: mediaErr.message || 'Image upload failed.',
          },
        });
      }
    }
  );

  app.get<{ Params: { id: string } }>(
    '/api/v1/media/:id',
    { preHandler: auth.optionalAuth },
    async (request, reply) => {
      const asset = db
        .prepare('SELECT * FROM media_assets WHERE id = ?')
        .get(request.params.id) as
        | { id: string; uploader_id: string; mime_type: string; data: Uint8Array }
        | undefined;
      if (!asset) {
        return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Media not found.' } });
      }

      const viewerRow = request.auth?.userRow || null;
      const viewer = viewerRow ? { id: viewerRow.id } : null;
      const attachedPost = db
        .prepare('SELECT * FROM posts WHERE media_id = ?')
        .get(asset.id) as
        | {
            id: string;
            author_id: string;
            space: PostSpace;
            audience: string;
            group_name: string | null;
            status: PostStatus;
          }
        | undefined;

      if (attachedPost) {
        const author = db
          .prepare('SELECT status FROM users WHERE id = ?')
          .get(attachedPost.author_id) as { status: UserStatus } | undefined;
        const relations = getViewerRelations(db, viewer?.id || null);
        const postObj = {
          id: attachedPost.id,
          authorId: attachedPost.author_id,
          authorStatus: author?.status || 'active',
          space: attachedPost.space,
          audience: attachedPost.audience,
          groupName: attachedPost.group_name || '',
          status: attachedPost.status,
        };
        if (!canViewerSeePost(postObj, viewer, relations)) {
          return reply
            .code(403)
            .send({ error: { code: 'FORBIDDEN', message: 'Media access restricted.' } });
        }
      } else {
        const attachedReel = db
          .prepare('SELECT id, author_id, status, audience FROM reels WHERE media_id = ? OR cover_media_id = ?')
          .get(asset.id, asset.id) as
          | { id: string; author_id: string; status: string; audience: string | null }
          | undefined;
        if (attachedReel) {
          if (!canViewerAccessReelMedia(attachedReel, viewerRow)) {
            return reply
              .code(403)
              .send({ error: { code: 'FORBIDDEN', message: 'Media access restricted.' } });
          }
        } else if (
          !viewerRow ||
          (asset.uploader_id !== viewerRow.id && viewerRow.role !== 'admin')
        ) {
          return reply
            .code(403)
            .send({ error: { code: 'FORBIDDEN', message: 'Media access restricted.' } });
        }
      }

      const fullBuf = Buffer.from(asset.data);
      const totalLen = fullBuf.length;
      const rangeHeader = request.headers.range;

      reply.header('X-Content-Type-Options', 'nosniff');
      reply.header('Cache-Control', 'private, max-age=3600');
      reply.header('Accept-Ranges', 'bytes');

      if (typeof rangeHeader === 'string' && rangeHeader.startsWith('bytes=')) {
        const [startRaw, endRaw] = rangeHeader.replace('bytes=', '').split('-');
        const start = startRaw ? Number.parseInt(startRaw, 10) : 0;
        const end = endRaw ? Number.parseInt(endRaw, 10) : totalLen - 1;
        if (
          Number.isFinite(start) &&
          Number.isFinite(end) &&
          start >= 0 &&
          end < totalLen &&
          start <= end
        ) {
          const chunk = fullBuf.subarray(start, end + 1);
          reply.code(206);
          reply.header('Content-Type', asset.mime_type);
          reply.header('Content-Range', `bytes ${start}-${end}/${totalLen}`);
          reply.header('Content-Length', chunk.length);
          return reply.send(chunk);
        }
        return reply.code(416).header('Content-Range', `bytes */${totalLen}`).send();
      }

      reply.header('Content-Type', asset.mime_type);
      reply.header('Content-Length', totalLen);
      return reply.send(fullBuf);
    }
  );
}
