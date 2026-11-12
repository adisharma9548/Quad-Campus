import type { DatabaseSync } from 'node:sqlite';
import { formatRelativeTime, getViewerRelations } from '../middleware/auth.ts';
import type { ReelItem } from '../types.ts';

export type ReelCommentSort = 'top' | 'newest';

export interface FormattedReelComment {
  id: string;
  reelId: string;
  parentCommentId: string | null;
  replyToUserId: string | null;
  replyToUsername: string | null;
  username: string;
  initials: string;
  content: string;
  timestamp: string;
  createdAt: string;
  likes: number;
  likedByMe: boolean;
  isDeleted: boolean;
  reportedByMe: boolean;
  hasMoreReplies: boolean;
  hiddenReplyCount: number;
  replies: FormattedReelComment[];
}

interface RawCommentRow {
  id: string;
  reel_id: string;
  author_id: string;
  parent_comment_id: string | null;
  reply_to_user_id: string | null;
  reply_to_username: string | null;
  content: string;
  status: string;
  created_at_ms: number;
  created_at: string;
  username: string | null;
  avatar_initials: string | null;
}

interface TopCursorPayload {
  mode: 'top_level';
  sort: ReelCommentSort;
  isUnreported: number;
  score: number;
  createdAtMs: number;
  id: string;
}

interface BranchCursorPayload {
  mode: 'branch';
  createdAtMs: number;
  id: string;
}

type CursorPayload = TopCursorPayload | BranchCursorPayload;

function encodeCursor(payload: CursorPayload): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

function decodeCursor(raw: string | undefined | null): CursorPayload | null {
  if (!raw || typeof raw !== 'string') return null;
  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as CursorPayload;
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function attachReelFollowStatus(
  db: DatabaseSync,
  viewerId: string | null,
  reels: ReelItem[]
): ReelItem[] {
  if (reels.length === 0) return reels;
  if (!viewerId) {
    return reels.map((r) => ({ ...r, followStatus: 'none' }));
  }
  const relations = getViewerRelations(db, viewerId);
  return reels.map((reel) => {
    let followStatus: ReelItem['followStatus'] = 'none';
    if (reel.authorId === viewerId) {
      followStatus = 'self';
    } else if (relations.followingIds.has(reel.authorId)) {
      followStatus = 'following';
    } else if (relations.outgoingRequestTargetIds.has(reel.authorId)) {
      followStatus = 'requested';
    }
    return {
      ...reel,
      followStatus,
    };
  });
}

export function queryReelComments(
  db: DatabaseSync,
  options: {
    reelId: string;
    viewerId: string | null;
    commentsEnabled: boolean;
    sort?: string | null;
    parentId?: string | null;
    limit?: number;
    offset?: number;
    cursor?: string | null;
    maxDepth?: number;
  }
): {
  items: FormattedReelComment[];
  total: number;
  totalCount: number;
  hasMore: boolean;
  nextOffset: number;
  nextCursor: string | null;
  remainingCount: number;
  commentsEnabled: boolean;
  sort: ReelCommentSort;
} {
  const sort: ReelCommentSort =
    String(options.sort || 'top').toLowerCase() === 'newest' ? 'newest' : 'top';
  const parentId = options.parentId ? String(options.parentId) : null;
  const maxDepth = Math.max(0, Math.min(4, Number.isFinite(options.maxDepth) ? Number(options.maxDepth) : 2));
  const limit = Math.max(1, Math.min(50, Number.isFinite(options.limit) ? Number(options.limit) : 20));
  const offset = Math.max(0, Number.isFinite(options.offset) ? Number(options.offset) : 0);
  const parsedCursor = decodeCursor(options.cursor);

  const relations = getViewerRelations(db, options.viewerId);

  const rows = (db
    .prepare(
      `SELECT rc.id, rc.reel_id, rc.author_id, rc.parent_comment_id, rc.reply_to_user_id,
              rc.reply_to_username, rc.content, COALESCE(rc.status, 'active') AS status,
              rc.created_at_ms, rc.created_at,
              u.username, u.avatar_initials
       FROM reel_comments rc
       JOIN users u ON u.id = rc.author_id
       WHERE rc.reel_id = ? AND u.status != 'banned' AND u.status != 'deleted'
       ORDER BY rc.created_at_ms ASC, rc.id ASC`
    )
    .all(options.reelId) as unknown as RawCommentRow[]).filter(
    (r) =>
      !relations.blockedIds.has(r.author_id) &&
      !relations.blockedByIds.has(r.author_id) &&
      !relations.mutedIds.has(r.author_id)
  );

  const likeCounts = new Map<string, number>();
  for (const r of db
    .prepare(
      `SELECT l.comment_id, COUNT(*) AS cnt
       FROM reel_comment_likes l
       JOIN reel_comments rc ON rc.id = l.comment_id
       WHERE rc.reel_id = ?
       GROUP BY l.comment_id`
    )
    .all(options.reelId) as Array<{ comment_id: string; cnt: number }>) {
    likeCounts.set(r.comment_id, Number(r.cnt || 0));
  }

  const viewerLikedIds = new Set<string>();
  const viewerReportedIds = new Set<string>();
  if (options.viewerId) {
    for (const r of db
      .prepare(
        `SELECT l.comment_id
         FROM reel_comment_likes l
         JOIN reel_comments rc ON rc.id = l.comment_id
         WHERE rc.reel_id = ? AND l.user_id = ?`
      )
      .all(options.reelId, options.viewerId) as Array<{ comment_id: string }>) {
      viewerLikedIds.add(r.comment_id);
    }
    for (const r of db
      .prepare(
        `SELECT target_id FROM reports WHERE target_type = 'reel_comment' AND reporter_id = ?`
      )
      .all(options.viewerId) as Array<{ target_id: string }>) {
      viewerReportedIds.add(r.target_id);
    }
  }

  const pendingReportIds = new Set<string>();
  for (const r of db
    .prepare(
      `SELECT DISTINCT rep.target_id
       FROM reports rep
       JOIN reel_comments rc ON rc.id = rep.target_id
       WHERE rep.target_type = 'reel_comment' AND rep.status = 'pending' AND rc.reel_id = ?`
    )
    .all(options.reelId) as Array<{ target_id: string }>) {
    pendingReportIds.add(r.target_id);
  }

  const childrenMap = new Map<string | null, RawCommentRow[]>();
  let totalActiveCount = 0;
  for (const row of rows) {
    if (row.status === 'active') totalActiveCount += 1;
    const key = row.parent_comment_id || null;
    const list = childrenMap.get(key) || [];
    list.push(row);
    childrenMap.set(key, list);
  }

  // Memoize recursive active descendant count for ranking & collapsed counts
  const branchCountCache = new Map<string, number>();
  const countBranchDescendants = (id: string): number => {
    if (branchCountCache.has(id)) return branchCountCache.get(id)!;
    const children = childrenMap.get(id) || [];
    let count = 0;
    for (const child of children) {
      if (child.status === 'active') count += 1;
      count += countBranchDescendants(child.id);
    }
    branchCountCache.set(id, count);
    return count;
  };

  // Skip soft-deleted nodes with zero active descendants
  const isRenderable = (row: RawCommentRow): boolean =>
    row.status === 'active' || countBranchDescendants(row.id) > 0;

  const formatNode = (row: RawCommentRow, depth: number): FormattedReelComment => {
    const isDeleted = row.status !== 'active';
    const directChildren = (childrenMap.get(row.id) || []).filter(isRenderable);
    directChildren.sort((a, b) => a.created_at_ms - b.created_at_ms || a.id.localeCompare(b.id));

    const totalDescendants = countBranchDescendants(row.id);
    const shouldExpand = depth < maxDepth;
    const replies = shouldExpand
      ? directChildren.map((child) => formatNode(child, depth + 1))
      : [];

    const hasMoreReplies = !shouldExpand && directChildren.length > 0;
    const hiddenReplyCount = !shouldExpand ? totalDescendants : 0;

    return {
      id: row.id,
      reelId: row.reel_id,
      parentCommentId: row.parent_comment_id || null,
      replyToUserId: isDeleted ? null : row.reply_to_user_id || null,
      replyToUsername: isDeleted ? null : row.reply_to_username || null,
      username: isDeleted ? '[deleted]' : row.username || 'campus_peer',
      initials: isDeleted ? 'DEL' : row.avatar_initials || 'CP',
      content: isDeleted ? '[deleted]' : row.content,
      timestamp: formatRelativeTime(row.created_at_ms),
      createdAt: row.created_at,
      likes: isDeleted ? 0 : likeCounts.get(row.id) || 0,
      likedByMe: isDeleted ? false : viewerLikedIds.has(row.id),
      isDeleted,
      reportedByMe: isDeleted ? false : viewerReportedIds.has(row.id),
      hasMoreReplies,
      hiddenReplyCount,
      replies,
    };
  };

  const targetRows = (childrenMap.get(parentId) || []).filter(isRenderable);

  if (parentId === null) {
    const computeScore = (row: RawCommentRow) => {
      const likes = row.status === 'active' ? likeCounts.get(row.id) || 0 : 0;
      const replies = countBranchDescendants(row.id);
      return likes + 2 * replies;
    };
    const isRowUnreported = (row: RawCommentRow) => (pendingReportIds.has(row.id) ? 0 : 1);

    targetRows.sort((a, b) => {
      const unrepDiff = isRowUnreported(b) - isRowUnreported(a);
      if (unrepDiff !== 0) return unrepDiff;
      if (sort === 'top') {
        const scoreDiff = computeScore(b) - computeScore(a);
        if (scoreDiff !== 0) return scoreDiff;
      }
      if (b.created_at_ms !== a.created_at_ms) {
        return b.created_at_ms - a.created_at_ms;
      }
      return a.id.localeCompare(b.id);
    });

    let startRows = targetRows;
    if (
      parsedCursor &&
      parsedCursor.mode === 'top_level' &&
      parsedCursor.sort === sort
    ) {
      startRows = targetRows.filter((row) => {
        const u = isRowUnreported(row);
        if (u !== parsedCursor.isUnreported) return u < parsedCursor.isUnreported;
        if (sort === 'top') {
          const s = computeScore(row);
          if (s !== parsedCursor.score) return s < parsedCursor.score;
        }
        if (row.created_at_ms !== parsedCursor.createdAtMs) {
          return row.created_at_ms < parsedCursor.createdAtMs;
        }
        return row.id.localeCompare(parsedCursor.id) > 0;
      });
    } else if (offset > 0) {
      startRows = targetRows.slice(offset);
    }

    const pageRows = startRows.slice(0, limit);
    const hasMore = startRows.length > pageRows.length;
    const lastRow = pageRows[pageRows.length - 1];
    const nextCursor =
      hasMore && lastRow
        ? encodeCursor({
            mode: 'top_level',
            sort,
            isUnreported: isRowUnreported(lastRow),
            score: computeScore(lastRow),
            createdAtMs: lastRow.created_at_ms,
            id: lastRow.id,
          })
        : null;

    return {
      items: pageRows.map((row) => formatNode(row, 0)),
      total: targetRows.length,
      totalCount: totalActiveCount,
      hasMore,
      nextOffset: offset + pageRows.length,
      nextCursor,
      remainingCount: Math.max(0, startRows.length - pageRows.length),
      commentsEnabled: options.commentsEnabled,
      sort,
    };
  }

  // Child branch pagination: ALWAYS oldest first
  targetRows.sort((a, b) => a.created_at_ms - b.created_at_ms || a.id.localeCompare(b.id));
  let startRows = targetRows;
  if (parsedCursor && parsedCursor.mode === 'branch') {
    startRows = targetRows.filter((row) => {
      if (row.created_at_ms !== parsedCursor.createdAtMs) {
        return row.created_at_ms > parsedCursor.createdAtMs;
      }
      return row.id.localeCompare(parsedCursor.id) > 0;
    });
  } else if (offset > 0) {
    startRows = targetRows.slice(offset);
  }

  const pageRows = startRows.slice(0, limit);
  const hasMore = startRows.length > pageRows.length;
  const lastRow = pageRows[pageRows.length - 1];
  const nextCursor =
    hasMore && lastRow
      ? encodeCursor({
          mode: 'branch',
          createdAtMs: lastRow.created_at_ms,
          id: lastRow.id,
        })
      : null;

  return {
    items: pageRows.map((row) => formatNode(row, 1)),
    total: targetRows.length,
    totalCount: totalActiveCount,
    hasMore,
    nextOffset: offset + pageRows.length,
    nextCursor,
    remainingCount: Math.max(0, startRows.length - pageRows.length),
    commentsEnabled: options.commentsEnabled,
    sort,
  };
}
