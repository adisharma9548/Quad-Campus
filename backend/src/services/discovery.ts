import type { DatabaseSync } from 'node:sqlite';
import { rankDiscoverablePeers, type RankedPeerItem } from '../algorithms/campusRanker.ts';
import { getViewerRelations } from '../middleware/auth.ts';
import type { UserRole, UserStatus } from '../types.ts';

export interface DiscoverableUsersFilters {
  q?: string;
  branch?: string;
  year?: string;
  limit?: number;
}

export interface DiscoverableUserItem extends RankedPeerItem {
  directoryVisible: true;
  interests: string[];
}

interface RawDiscoverUserRow {
  id: string;
  username: string;
  avatar_initials: string;
  role: UserRole;
  status: UserStatus;
  discoverable: number;
  branch: string;
  year: string;
  bio: string;
  interests_json: string | null;
}

/**
 * Single source of truth for campus discovery (Directory, Who to follow, and @mention autocomplete).
 * - Only returns active student accounts with `discoverable === 1` (`directoryVisible === true`).
 * - Excludes the current user (`currentUserId`), users already followed, bidirectional blocks,
 *   and users with pending follow requests in either direction.
 * - Note: current user's own `discoverable` setting NEVER prevents them from browsing others.
 */
export function getDiscoverableUsers(
  db: DatabaseSync,
  currentUserId: string | null,
  filters: DiscoverableUsersFilters = {}
): DiscoverableUserItem[] {
  const viewerRow = currentUserId
    ? (db
        .prepare('SELECT id, branch, year, interests_json FROM users WHERE id = ?')
        .get(currentUserId) as
        | { id: string; branch: string; year: string; interests_json: string | null }
        | undefined)
    : undefined;

  let viewerInterests: string[] = [];
  if (viewerRow?.interests_json) {
    try {
      viewerInterests = JSON.parse(viewerRow.interests_json) as string[];
    } catch {
      viewerInterests = [];
    }
  }

  const viewer = viewerRow
    ? {
        id: viewerRow.id,
        branch: viewerRow.branch,
        year: viewerRow.year,
        interests: viewerInterests,
      }
    : null;

  const relations = getViewerRelations(db, viewer?.id || null);

  const rawUsers = db
    .prepare(
      "SELECT id, username, avatar_initials, role, status, discoverable, branch, year, bio, interests_json FROM users WHERE role = 'student' AND status = 'active' AND discoverable = 1"
    )
    .all() as unknown as RawDiscoverUserRow[];

  const interestsById = new Map<string, string[]>();
  const candidates = rawUsers.map((u) => {
    let interests: string[] = [];
    try {
      interests = JSON.parse(u.interests_json || '[]') as string[];
    } catch {
      interests = [];
    }
    interestsById.set(u.id, interests);
    return {
      id: u.id,
      username: u.username,
      avatarInitials: u.avatar_initials,
      role: u.role,
      status: u.status,
      discoverable: u.discoverable,
      branch: u.branch,
      year: u.year,
      bio: u.bio,
      interests,
    };
  });

  const ranked = rankDiscoverablePeers({
    candidates,
    viewer,
    relations,
    query: String(filters.q || ''),
    branchFilter: String(filters.branch || 'all') || 'all',
    yearFilter: String(filters.year || 'all') || 'all',
    limit: Math.max(1, Math.min(100, Number(filters.limit || 30))),
  });

  return ranked.map((item) => ({
    ...item,
    directoryVisible: true as const,
    interests: interestsById.get(item.id) || [],
  }));
}
