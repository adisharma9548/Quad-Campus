/**
 * Quad Campus Ranking & Recommendation Engine (`campusRanker.ts`)
 *
 * Design principles (per Quad Master UX & Privacy Policy):
 * 1. Privacy & Safety First: Blocked accounts (bidirectional), muted authors,
 *    banned/suspended accounts, dismissed ("Not interested") posts, and unauthorized
 *    Personal Space / private-group audiences are strictly filtered BEFORE scoring.
 * 2. Constructive Quality Over Compulsive Retention: Sublinear log-damped engagement
 *    weights meaningful discussion (answers, saves) above passive likes, and gives
 *    unanswered Question posts an early peer-help lift so questions get resolved.
 * 3. No Filter Bubbles / Greedy Author & Type Diversity: Caps repetitive bursts by
 *    a single creator and encourages post-format diversity (Question/Tip/Resource/Event/etc.).
 * 4. Academic Privacy Boundary: Never uses or leaks a user's private `section`.
 */

import { SHORT_YEAR } from '../config/constants.ts';
import type { PostSpace, PostStatus, ReelItem, UserRole, UserStatus, ViewerRelations } from '../types.ts';

const HOUR_MS = 3600 * 1000;
const HALF_LIFE_TAU_HOURS = 8;
const DECAY_EXPONENT = 1.35;

export interface RankerViewer {
  id: string;
  branch?: string | null;
  year?: string | null;
  interests?: string[];
}

export interface RankablePost {
  id: string;
  authorId: string;
  authorStatus: UserStatus;
  authorBranch?: string;
  authorYear?: string;
  authorUsername?: string;
  type: string;
  title?: string;
  content?: string;
  hashtags?: string[];
  space: PostSpace;
  audience: string;
  groupName?: string;
  status: PostStatus;
  likesCount?: number;
  answersCount?: number;
  savesCount?: number;
  sharesCount?: number;
  bestAnswerId?: string | null;
  createdAtMs: number;
}

export interface DiscoverablePeerCandidate {
  id: string;
  username: string;
  email?: string;
  role: UserRole;
  status: UserStatus;
  department?: string;
  branch: string;
  year: string;
  section?: string;
  discoverable: boolean | number;
  avatarInitials: string;
  bio?: string;
  interests?: string[];
}

export interface RankedPeerItem {
  id: string;
  username: string;
  initials: string;
  branch: string;
  year: string;
  bio: string;
  isFollowing: boolean;
  isRequested: boolean;
  score: number;
}

export type MinimalPostVisibilityInput = Pick<
  RankablePost,
  'id' | 'authorId' | 'authorStatus' | 'space' | 'audience' | 'groupName' | 'status'
>;

function normalizeTokens(values: readonly string[] = []): Set<string> {
  const tokens = new Set<string>();
  for (const val of values) {
    if (!val) continue;
    for (const part of String(val)
      .toLowerCase()
      .replace(/^#/, '')
      .split(/[^a-z0-9+]+/)) {
      if (part.length >= 2) tokens.add(part);
    }
  }
  return tokens;
}

function computeInterestJaccard(
  viewerInterests: readonly string[] = [],
  postHashtags: readonly string[] = [],
  title: string = '',
  content: string = ''
): number {
  const viewerSet = normalizeTokens(viewerInterests);
  if (viewerSet.size === 0) return 0;

  const contentTokens = normalizeTokens([
    ...(Array.isArray(postHashtags) ? postHashtags : []),
    ...String(title || '').split(/\s+/).slice(0, 12),
    ...String(content || '').split(/\s+/).slice(0, 20),
  ]);
  if (contentTokens.size === 0) return 0;

  let overlap = 0;
  for (const t of viewerSet) {
    if (contentTokens.has(t)) overlap += 1;
  }
  if (overlap === 0) return 0;
  const union = viewerSet.size + contentTokens.size - overlap;
  return overlap / Math.max(1, union);
}

/**
 * Determine whether `viewer` is allowed to read `post`.
 * Enforces space/audience permissions and bidirectional block rules.
 */
export function canViewerSeePost(
  post: MinimalPostVisibilityInput | null | undefined,
  viewer: RankerViewer | null | undefined,
  relations: ViewerRelations
): boolean {
  if (!post || post.status === 'deleted') return false;
  if (post.authorStatus === 'banned') return false;
  if (relations.blockedIds.has(post.authorId) || relations.blockedByIds.has(post.authorId)) {
    return false;
  }
  if (relations.mutedIds.has(post.authorId)) {
    return false;
  }
  if (relations.dismissedPostIds.has(post.id)) {
    return false;
  }

  // Personal Space posts never leak to unapproved viewers or the Public Feed
  if (post.space === 'personal') {
    if (!viewer) return false;
    if (post.authorId === viewer.id) return true;
    const assignedGroup = relations.viewerMembershipByAuthor.get(post.authorId);
    if (!assignedGroup) return false;
    if (post.audience === 'followers') return true;
    if (post.audience === 'group' && post.groupName) {
      return assignedGroup.toLowerCase() === post.groupName.toLowerCase();
    }
    return false;
  }

  // Public feed posts: check scope audience restrictions
  if (post.audience === 'followers') {
    if (!viewer) return false;
    return post.authorId === viewer.id || relations.followingIds.has(post.authorId);
  }
  if (post.audience === 'group') {
    if (!viewer) return false;
    if (post.authorId === viewer.id) return true;
    const assignedGroup = relations.viewerMembershipByAuthor.get(post.authorId);
    return Boolean(
      assignedGroup &&
        post.groupName &&
        assignedGroup.toLowerCase() === post.groupName.toLowerCase()
    );
  }

  return true;
}

export interface RankFeedPostsOptions<T extends RankablePost> {
  posts: T[];
  viewer: RankerViewer | null;
  relations: ViewerRelations;
  scope?: string;
  tab?: string;
  query?: string;
  cursor?: number;
  limit?: number;
  now?: number;
}

export interface RankedFeedResult<T extends RankablePost> {
  items: Array<T & { rankScore: number; feedReason: string }>;
  total: number;
  nextCursor: number | null;
}

/**
 * Score and rank Public Feed posts with deterministic pagination & greedy diversity.
 */
export function rankFeedPosts<T extends RankablePost>({
  posts,
  viewer,
  relations,
  scope = 'all',
  tab = 'for_you',
  query = '',
  cursor = 0,
  limit = 20,
  now = Date.now(),
}: RankFeedPostsOptions<T>): RankedFeedResult<T> {
  const viewerBranch = viewer?.branch || '';
  const viewerYear = SHORT_YEAR(viewer?.year);
  const viewerInterests = Array.isArray(viewer?.interests) ? viewer.interests : [];
  const cleanQuery = (query || '').trim().toLowerCase();

  // Stage 1: Privacy, moderation, scope, and search filtering
  const candidates: Array<{ post: T; baseScore: number; source: string }> = [];
  for (const post of posts) {
    if (post.space !== 'public') continue;
    if (!canViewerSeePost(post, viewer, relations)) continue;

    if (tab === 'following' && viewer) {
      if (post.authorId !== viewer.id && !relations.followingIds.has(post.authorId)) {
        continue;
      }
    }

    if (scope === 'branch' && viewerBranch) {
      if (post.authorBranch !== viewerBranch && post.audience !== 'branch') {
        continue;
      }
    } else if (scope === 'year' && viewerYear) {
      if (SHORT_YEAR(post.authorYear) !== viewerYear && post.audience !== 'year') {
        continue;
      }
    }

    if (cleanQuery) {
      const hay = `${post.title || ''} ${post.content || ''} ${post.authorUsername || ''} ${(post.hashtags || []).join(' ')}`.toLowerCase();
      if (!hay.includes(cleanQuery)) continue;
    }

    // Stage 2: Multi-signal utility score
    const ageHours = Math.max(0, (now - post.createdAtMs) / HOUR_MS);
    const recencyDecay = 1 / Math.pow(1 + ageHours / HALF_LIFE_TAU_HOURS, DECAY_EXPONENT);

    const weightedEngagement =
      (post.answersCount || 0) * 2.2 +
      (post.savesCount || 0) * 1.8 +
      (post.sharesCount || 0) * 1.4 +
      (post.likesCount || 0) * 1.0;
    const qualitySignal = Math.log1p(Math.max(0, weightedEngagement));

    // Peer-help boost for unresolved Questions within first 18h; completion boost once resolved
    let questionBoost = 0;
    if (post.type === 'Question') {
      if (post.bestAnswerId) questionBoost = 0.35;
      else if (ageHours <= 18) questionBoost = 0.48;
    }

    const interestAffinity =
      computeInterestJaccard(viewerInterests, post.hashtags, post.title || '', post.content || '') *
      2.6;

    // Academic context affinity (strictly department + year; never touches section)
    let academicAffinity = 0;
    if (viewerBranch && post.authorBranch === viewerBranch) academicAffinity += 0.35;
    if (viewerYear && SHORT_YEAR(post.authorYear) === viewerYear) academicAffinity += 0.25;

    const isFollowed = viewer && relations.followingIds.has(post.authorId);
    const socialProximity = isFollowed ? 1.15 : post.authorId === viewer?.id ? 0.85 : 0;

    // Suppress repeated recommendations on topics from recently dismissed posts
    const dismissedOverlap = computeInterestJaccard(
      relations.dismissedTopics || [],
      post.hashtags,
      post.title || '',
      ''
    );
    const feedbackFactor = dismissedOverlap > 0.2 ? 0.6 : 1.0;

    const flaggedFactor = post.status === 'flagged' ? 0.2 : 1.0;
    const baseScore =
      recencyDecay *
      (1.0 + qualitySignal + questionBoost + interestAffinity + academicAffinity + socialProximity) *
      feedbackFactor *
      flaggedFactor;

    candidates.push({
      post,
      baseScore,
      source: isFollowed ? 'following' : academicAffinity > 0.3 ? 'campus_context' : 'discovery',
    });
  }

  // Initial sort before greedy diversity pass
  candidates.sort((a, b) => b.baseScore - a.baseScore || b.post.createdAtMs - a.post.createdAtMs);

  // Stage 3: Greedy author & post-type diversity re-ranking
  const ranked: Array<T & { rankScore: number; feedReason: string }> = [];
  const pool = candidates.slice(0, 150);
  const authorCounts = new Map<string, number>();
  let lastType: string | null = null;
  let lastSource: string | null = null;

  while (pool.length > 0) {
    let bestIdx = 0;
    let bestAdjusted = -Infinity;

    for (let i = 0; i < pool.length; i += 1) {
      const item = pool[i];
      const priorByAuthor = authorCounts.get(item.post.authorId) || 0;
      const authorPenalty = Math.pow(0.55, priorByAuthor);
      const typeVariety = lastType && item.post.type !== lastType ? 1.1 : 1.0;
      // Gently interleave discovery and following so feed stays varied without losing signal
      const sourceBalance = lastSource && item.source !== lastSource ? 1.05 : 1.0;
      const adjusted = item.baseScore * authorPenalty * typeVariety * sourceBalance;

      if (adjusted > bestAdjusted) {
        bestAdjusted = adjusted;
        bestIdx = i;
      }
    }

    const chosen = pool.splice(bestIdx, 1)[0];
    ranked.push({
      ...chosen.post,
      rankScore: Number(bestAdjusted.toFixed(4)),
      feedReason: chosen.source,
    });
    authorCounts.set(chosen.post.authorId, (authorCounts.get(chosen.post.authorId) || 0) + 1);
    lastType = chosen.post.type;
    lastSource = chosen.source;
  }

  if (candidates.length > 150) {
    for (const item of candidates.slice(150)) {
      ranked.push({
        ...item.post,
        rankScore: Number(item.baseScore.toFixed(4)),
        feedReason: item.source,
      });
    }
  }

  const start = Math.max(0, Number(cursor) || 0);
  const safeLimit = Math.min(50, Math.max(1, Number(limit) || 20));
  const items = ranked.slice(start, start + safeLimit);
  const nextCursor = start + safeLimit < ranked.length ? start + safeLimit : null;

  return {
    items,
    total: ranked.length,
    nextCursor,
  };
}

export interface RankPeersOptions {
  candidates: DiscoverablePeerCandidate[];
  viewer: RankerViewer | null;
  relations: ViewerRelations;
  query?: string;
  branchFilter?: string;
  yearFilter?: string;
  limit?: number;
}

/**
 * Rank discoverable students for Campus Directory & "Who to follow".
 * Respects `discoverable === 1`, blocks, status, and never inspects `section` or `email`.
 */
export function rankDiscoverablePeers({
  candidates,
  viewer,
  relations,
  query = '',
  branchFilter = 'all',
  yearFilter = 'all',
  limit = 20,
}: RankPeersOptions): RankedPeerItem[] {
  const cleanQuery = (query || '').trim().toLowerCase();
  const viewerInterests = Array.isArray(viewer?.interests) ? viewer.interests : [];
  const scored: RankedPeerItem[] = [];

  for (const peer of candidates) {
    if (peer.role !== 'student' || peer.status !== 'active') continue;
    if (viewer && peer.id === viewer.id) continue;
    if (!peer.discoverable) continue;
    if (relations.blockedIds.has(peer.id) || relations.blockedByIds.has(peer.id)) continue;

    const peerYearShort = SHORT_YEAR(peer.year);
    if (branchFilter !== 'all' && peer.branch !== branchFilter) continue;
    if (yearFilter !== 'all' && peerYearShort !== yearFilter) continue;

    if (cleanQuery) {
      const text = `${peer.username} ${peer.bio || ''} ${peer.branch} ${peerYearShort} ${(peer.interests || []).join(' ')}`.toLowerCase();
      if (!text.includes(cleanQuery)) continue;
    }

    const sharedInterestScore = computeInterestJaccard(
      viewerInterests,
      peer.interests || [],
      peer.bio || '',
      ''
    );
    const sameBranchScore = viewer?.branch && peer.branch === viewer.branch ? 0.45 : 0;
    const sameYearScore = viewer?.year && peerYearShort === SHORT_YEAR(viewer.year) ? 0.3 : 0;
    const alreadyFollowingPenalty = relations.followingIds.has(peer.id) ? 0.35 : 1.0;

    const score =
      (1.0 + sharedInterestScore * 3.0 + sameBranchScore + sameYearScore) *
      alreadyFollowingPenalty;
    scored.push({
      id: peer.id,
      username: peer.username,
      initials: peer.avatarInitials,
      branch: peer.branch,
      year: peerYearShort,
      bio: peer.bio || '',
      isFollowing: relations.followingIds.has(peer.id),
      isRequested: relations.outgoingRequestTargetIds.has(peer.id),
      score,
    });
  }

  scored.sort((a, b) => b.score - a.score || a.username.localeCompare(b.username));
  return scored.slice(0, Math.max(1, limit));
}

export type RankableReel = Pick<
  ReelItem,
  | 'id'
  | 'authorId'
  | 'authorStatus'
  | 'status'
  | 'unseen'
  | 'likesCount'
  | 'commentsCount'
  | 'sharesCount'
  | 'caption'
  | 'tag'
  | 'createdAtMs'
>;

export interface RankReelsOptions<T extends RankableReel> {
  reels: T[];
  viewer: RankerViewer | null;
  relations: ViewerRelations;
  now?: number;
}

/**
 * Rank short-form Campus Reels: surfaces unseen eligible reels first,
 * then orders by recency + constructive engagement without deceptive loops.
 */
export function rankCampusReels<T extends RankableReel>({
  reels,
  viewer,
  relations,
  now = Date.now(),
}: RankReelsOptions<T>): Array<T & { score: number }> {
  const scored: Array<T & { score: number }> = [];
  for (const reel of reels) {
    if (reel.status !== 'active' || reel.authorStatus === 'banned') continue;
    if (relations.blockedIds.has(reel.authorId) || relations.blockedByIds.has(reel.authorId)) {
      continue;
    }
    if (relations.mutedIds.has(reel.authorId)) continue;

    const ageHours = Math.max(0, (now - reel.createdAtMs) / HOUR_MS);
    const recency = 1 / Math.pow(1 + ageHours / 12, 1.25);
    const engagement = Math.log1p(
      (reel.likesCount || 0) * 1.1 +
        (reel.commentsCount || 0) * 2.0 +
        (reel.sharesCount || 0) * 1.4
    );
    const interestMatch =
      computeInterestJaccard(viewer?.interests || [], [reel.tag], reel.caption, '') * 2.0;
    const unseenBoost = reel.unseen ? 10.0 : 0;

    const score = unseenBoost + recency * (1 + engagement + interestMatch);
    scored.push({ ...reel, score });
  }

  scored.sort((a, b) => b.score - a.score || b.createdAtMs - a.createdAtMs);
  return scored;
}

/**
 * Compute real tag counts strictly from visible active public posts (never private posts).
 */
export function computeRealTrendingTopics(
  posts: readonly RankablePost[],
  viewer: RankerViewer | null,
  relations: ViewerRelations,
  limit: number = 5
): Array<{ tag: string; posts: number }> {
  const counts = new Map<string, number>();
  for (const post of posts) {
    if (post.space !== 'public' || post.status !== 'active') continue;
    if (!canViewerSeePost(post, viewer, relations)) continue;
    for (const tag of post.hashtags || []) {
      const normalized = tag.startsWith('#') ? tag : `#${tag}`;
      counts.set(normalized, (counts.get(normalized) || 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .map(([tag, postsCount]) => ({ tag, posts: postsCount }))
    .sort((a, b) => b.posts - a.posts || a.tag.localeCompare(b.tag))
    .slice(0, limit);
}
