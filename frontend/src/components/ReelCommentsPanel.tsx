import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { X, MessageCircle } from 'lucide-react';
import type { ReelCommentItem, ReelItem, ThreadReply } from '../types/quad';
import { IS_REAL_BACKEND, apiRequest } from '../services/apiClient';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import ThreadCommentNode from './ThreadCommentNode';
import { Avatar, Button } from './ui';
import {
  insertReplyIntoTree,
  replaceTempReplyInTree,
  removeReplyFromTree,
  mergeBranchChildren,
  setReplyReportedInTree,
  setReplyLikeInTree,
} from '../utils/threadTree';

const MAX_REEL_COMMENT_CHARS = 500;
const PAGE_LIMIT = 20;
type CommentSortMode = 'top' | 'newest';

interface CommentsApiResponse {
  items: ReelCommentItem[];
  total: number;
  totalCount: number;
  hasMore: boolean;
  nextOffset: number;
  nextCursor?: string | null;
  remainingCount?: number;
  commentsEnabled: boolean;
  sort?: CommentSortMode;
}

interface CommentThreadState {
  items: ReelCommentItem[];
  totalCount: number;
  hasMore: boolean;
  nextOffset: number;
  nextCursor: string | null;
  commentsEnabled: boolean;
}

export interface ReelCommentsPanelProps {
  reel: ReelItem | null;
  isOpen: boolean;
  onClose: () => void;
  /** 'split' = 340px right-hand card on >=1100px + bottom sheet below 1100px; 'embedded' = fits inside modal */
  mode?: 'split' | 'embedded';
}

export default function ReelCommentsPanel({
  reel,
  isOpen,
  onClose,
  mode = 'split',
}: ReelCommentsPanelProps) {
  const { state, updateReelCommentCount } = useApp();
  const { showToast } = useToast();

  const [sortBy, setSortBy] = useState<CommentSortMode>('top');
  const [cacheByKey, setCacheByKey] = useState<Record<string, CommentThreadState>>({});
  const [draftsByReel, setDraftsByReel] = useState<Record<string, string>>({});
  const [loadingCacheKey, setLoadingCacheKey] = useState<string | null>(null);
  const [errorByKey, setErrorByKey] = useState<Record<string, string>>({});
  const [loadingMore, setLoadingMore] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [childMenuOpen, setChildMenuOpen] = useState(false);
  const [mobileViewportMetrics, setMobileViewportMetrics] = useState<{
    maxSheetPx?: number;
    keyboardInsetPx: number;
  }>({ keyboardInsetPx: 0 });
  const highlightTimerRef = useRef<number | null>(null);

  const reelKey = reel ? String(reel.id) : '';
  const cacheKey = reelKey ? `${reelKey}:${sortBy}` : '';
  const reelDefaultCommentsEnabled = reel?.commentsEnabled !== false;
  const reelDefaultCount = Math.max(0, Number(reel?.comments ?? 0));
  const cachedEntry = cacheKey ? cacheByKey[cacheKey] : undefined;
  const currentEntry: CommentThreadState = useMemo(
    () =>
      cachedEntry || {
        items: [],
        totalCount: reelDefaultCount,
        hasMore: false,
        nextOffset: 0,
        nextCursor: null,
        commentsEnabled: reelDefaultCommentsEnabled,
      },
    [cachedEntry, reelDefaultCommentsEnabled, reelDefaultCount]
  );
  const draft = draftsByReel[reelKey] || '';
  const isLoadingInitial = Boolean(cacheKey && loadingCacheKey === cacheKey && !cacheByKey[cacheKey]);
  const loadError = cacheKey ? errorByKey[cacheKey] || '' : '';
  const isReelOwner = Boolean(
    reel && state.username && reel.username.toLowerCase() === state.username.toLowerCase()
  );

  // Track mobile visualViewport height so bottom sheet fits cleanly above soft keyboard
  useEffect(() => {
    if (!isOpen || mode !== 'split' || typeof window === 'undefined' || !window.visualViewport) {
      return undefined;
    }
    const vv = window.visualViewport;
    const syncViewport = () => {
      const keyboardInset = Math.max(0, Math.round(window.innerHeight - (vv.height + vv.offsetTop)));
      setMobileViewportMetrics({
        maxSheetPx: Math.max(240, Math.round(vv.height * 0.6)),
        keyboardInsetPx: keyboardInset,
      });
    };
    syncViewport();
    vv.addEventListener('resize', syncViewport);
    vv.addEventListener('scroll', syncViewport);
    return () => {
      vv.removeEventListener('resize', syncViewport);
      vv.removeEventListener('scroll', syncViewport);
    };
  }, [isOpen, mode]);

  const fetchCommentsPage = useCallback(
    async (
      targetReelId: string | number,
      targetSort: CommentSortMode,
      fallbackCommentsEnabled: boolean,
      cursor: string | null = null,
      append = false
    ) => {
      const key = `${String(targetReelId)}:${targetSort}`;
      if (!IS_REAL_BACKEND) {
        setCacheByKey((prev) => ({
          ...prev,
          [key]: prev[key] || {
            items: [],
            totalCount: 0,
            hasMore: false,
            nextOffset: 0,
            nextCursor: null,
            commentsEnabled: fallbackCommentsEnabled,
          },
        }));
        return;
      }

      if (!append) {
        setLoadingCacheKey(key);
        setErrorByKey((prev) => {
          if (!prev[key]) return prev;
          const next = { ...prev };
          delete next[key];
          return next;
        });
      }

      try {
        const cursorParam = cursor ? `&cursor=${encodeURIComponent(cursor)}` : '';
        const res = await apiRequest<CommentsApiResponse>(
          `/reels/${encodeURIComponent(String(targetReelId))}/comments?sort=${targetSort}&limit=${PAGE_LIMIT}&maxDepth=0${cursorParam}`
        );
        setCacheByKey((prev) => {
          const prevItems = append && prev[key] ? prev[key].items : [];
          const existingIds = new Set(prevItems.map((c) => String(c.id)));
          const mergedItems = append
            ? [...prevItems, ...(res.items || []).filter((c) => !existingIds.has(String(c.id)))]
            : res.items || [];
          return {
            ...prev,
            [key]: {
              items: mergedItems,
              totalCount: res.totalCount ?? mergedItems.length,
              hasMore: Boolean(res.hasMore),
              nextOffset: res.nextOffset ?? mergedItems.length,
              nextCursor: res.nextCursor ?? null,
              commentsEnabled: res.commentsEnabled !== false,
            },
          };
        });
        if (typeof res.totalCount === 'number') {
          updateReelCommentCount(targetReelId, res.totalCount);
        }
      } catch (err) {
        if (!append) {
          setErrorByKey((prev) => ({
            ...prev,
            [key]: err instanceof Error ? err.message : 'Unable to load comments.',
          }));
        } else {
          showToast(err instanceof Error ? err.message : 'Could not load more comments', 'error');
        }
      } finally {
        if (!append) {
          setLoadingCacheKey((curr) => (curr === key ? null : curr));
        }
      }
    },
    [showToast, updateReelCommentCount]
  );

  // Lazy-load comments when opened, switching reels, or switching Top/Newest
  useEffect(() => {
    if (!isOpen || !reelKey) return;
    const timer = window.setTimeout(() => {
      void fetchCommentsPage(reelKey, sortBy, reelDefaultCommentsEnabled, null, false);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchCommentsPage, isOpen, reelDefaultCommentsEnabled, reelKey, sortBy]);

  // Escape closes comments panel only when inner comment menu/modal isn't open
  useEffect(() => {
    if (!isOpen || childMenuOpen) return undefined;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (document.querySelector('[role="menu"], [role="dialog"]')) return;
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [childMenuOpen, isOpen, onClose]);

  useEffect(() => {
    return () => {
      if (highlightTimerRef.current) {
        window.clearTimeout(highlightTimerRef.current);
      }
    };
  }, []);

  const handleJumpToComment = useCallback((targetId: string | number) => {
    const el = document.getElementById(`reel-comment-${targetId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    setHighlightedId(String(targetId));
    if (highlightTimerRef.current) window.clearTimeout(highlightTimerRef.current);
    highlightTimerRef.current = window.setTimeout(() => {
      setHighlightedId(null);
      highlightTimerRef.current = null;
    }, 1600);
  }, []);

  const submitNewCommentOrReply = useCallback(
    async (
      targetReelId: string | number,
      parentCommentId: string | number | null,
      replyToUsername: string | null,
      rawText: string
    ) => {
      const content = rawText.trim();
      if (!content) return;
      if (content.length > MAX_REEL_COMMENT_CHARS) {
        showToast(`Comments cannot exceed ${MAX_REEL_COMMENT_CHARS} characters.`, 'error');
        return;
      }

      const activeKey = `${String(targetReelId)}:${sortBy}`;
      const tempId = `temp_rc_${Date.now()}_${Math.random().toString(16).slice(2, 6)}`;
      const optimisticNode: ReelCommentItem = {
        id: tempId,
        reelId: targetReelId,
        threadId: targetReelId,
        parentCommentId: parentCommentId ? String(parentCommentId) : null,
        replyToUsername: replyToUsername || '',
        username: state.username || 'quantum_dev',
        initials: state.userInitials || 'QD',
        content,
        body: content,
        timestamp: 'Just now',
        likes: 0,
        likedByMe: false,
        isDeleted: false,
        replies: [],
      };

      const prevSnapshot = cacheByKey[activeKey];
      setCacheByKey((prev) => {
        const cur = prev[activeKey] || currentEntry;
        const nextItems = parentCommentId
          ? (insertReplyIntoTree(cur.items, parentCommentId, optimisticNode) as ReelCommentItem[])
          : [optimisticNode, ...cur.items];
        return {
          ...prev,
          [activeKey]: {
            ...cur,
            items: nextItems,
            totalCount: cur.totalCount + 1,
          },
        };
      });
      updateReelCommentCount(targetReelId, currentEntry.totalCount + 1);

      if (!IS_REAL_BACKEND) {
        showToast(parentCommentId ? 'Reply posted' : 'Comment posted', 'success');
        return;
      }

      try {
        const created = await apiRequest<ReelCommentItem & { commentsCount?: number }>(
          `/reels/${encodeURIComponent(String(targetReelId))}/comments`,
          {
            method: 'POST',
            body: {
              content,
              ...(parentCommentId ? { parentCommentId: String(parentCommentId) } : {}),
            },
          }
        );
        const serverCount =
          typeof created.commentsCount === 'number'
            ? created.commentsCount
            : currentEntry.totalCount + 1;
        setCacheByKey((prev) => {
          const cur = prev[activeKey] || currentEntry;
          return {
            ...prev,
            [activeKey]: {
              ...cur,
              items: replaceTempReplyInTree(cur.items, tempId, created) as ReelCommentItem[],
              totalCount: serverCount,
            },
          };
        });
        updateReelCommentCount(targetReelId, serverCount);
      } catch (err) {
        // Rollback optimistic insertion cleanly
        setCacheByKey((prev) => {
          if (prevSnapshot) {
            return { ...prev, [activeKey]: prevSnapshot };
          }
          const cur = prev[activeKey];
          if (!cur) return prev;
          return {
            ...prev,
            [activeKey]: {
              ...cur,
              items: removeReplyFromTree(cur.items, tempId).nodes as ReelCommentItem[],
              totalCount: Math.max(0, cur.totalCount - 1),
            },
          };
        });
        updateReelCommentCount(
          targetReelId,
          prevSnapshot ? prevSnapshot.totalCount : Math.max(0, currentEntry.totalCount)
        );
        const msg = err instanceof Error ? err.message : 'Unable to post comment';
        showToast(msg, 'error');
        throw err;
      }
    },
    [
      cacheByKey,
      currentEntry,
      showToast,
      sortBy,
      state.userInitials,
      state.username,
      updateReelCommentCount,
    ]
  );

  const handlePostTopLevel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reel || !draft.trim() || submitting || !currentEntry.commentsEnabled) return;
    const savedDraft = draft;
    setSubmitting(true);
    setDraftsByReel((prev) => ({ ...prev, [reelKey]: '' }));
    try {
      await submitNewCommentOrReply(reel.id, null, null, savedDraft);
    } catch {
      // Restore draft if post failed
      setDraftsByReel((prev) => ({ ...prev, [reelKey]: savedDraft }));
    } finally {
      setSubmitting(false);
    }
  };

  const handleReplySubmit = useCallback(
    async (
      targetReelId: string | number,
      parentCommentId: string | number,
      replyToUsername: string,
      text: string
    ) => {
      await submitNewCommentOrReply(targetReelId, parentCommentId, replyToUsername, text);
    },
    [submitNewCommentOrReply]
  );

  const handleDeleteComment = useCallback(
    async (targetReelId: string | number, commentId: string | number) => {
      const activeKey = `${String(targetReelId)}:${sortBy}`;
      const prevSnapshot = cacheByKey[activeKey];
      if (!IS_REAL_BACKEND) {
        setCacheByKey((prev) => {
          const cur = prev[activeKey];
          if (!cur) return prev;
          return {
            ...prev,
            [activeKey]: {
              ...cur,
              items: removeReplyFromTree(cur.items, commentId).nodes as ReelCommentItem[],
              totalCount: Math.max(0, cur.totalCount - 1),
            },
          };
        });
        showToast('Comment deleted', 'info');
        return;
      }

      try {
        const res = await apiRequest<{
          deleted: boolean;
          softDeleted: boolean;
          commentsCount: number;
        }>(
          `/reels/${encodeURIComponent(String(targetReelId))}/comments/${encodeURIComponent(String(commentId))}`,
          { method: 'DELETE' }
        );
        const markSoftDeleted = (nodes: ReelCommentItem[]): ReelCommentItem[] =>
          nodes.map((n) => ({
            ...n,
            ...(String(n.id) === String(commentId)
              ? { isDeleted: true, content: '[deleted]', body: '[deleted]', username: '[deleted]' }
              : {}),
            replies: n.replies ? markSoftDeleted(n.replies as ReelCommentItem[]) : [],
          }));

        setCacheByKey((prev) => {
          const cur = prev[activeKey];
          if (!cur) return prev;
          const nextItems = res.softDeleted
            ? markSoftDeleted(cur.items)
            : (removeReplyFromTree(cur.items, commentId).nodes as ReelCommentItem[]);
          return {
            ...prev,
            [activeKey]: {
              ...cur,
              items: nextItems,
              totalCount: res.commentsCount,
            },
          };
        });
        updateReelCommentCount(targetReelId, res.commentsCount);
        showToast('Comment removed', 'info');
      } catch (err) {
        if (prevSnapshot) {
          setCacheByKey((prev) => ({ ...prev, [activeKey]: prevSnapshot }));
        }
        showToast(err instanceof Error ? err.message : 'Unable to delete comment', 'error');
      }
    },
    [cacheByKey, showToast, sortBy, updateReelCommentCount]
  );

  const handleLoadMoreReplies = useCallback(
    async (
      targetReelId: string | number,
      parentCommentId: string | number,
      cursor?: string | null
    ) => {
      if (!IS_REAL_BACKEND) return;
      const activeKey = `${String(targetReelId)}:${sortBy}`;
      try {
        const cursorParam = cursor ? `&cursor=${encodeURIComponent(cursor)}` : '';
        const res = await apiRequest<CommentsApiResponse>(
          `/reels/${encodeURIComponent(String(targetReelId))}/comments?parentId=${encodeURIComponent(
            String(parentCommentId)
          )}&limit=5&maxDepth=1${cursorParam}`
        );
        setCacheByKey((prev) => {
          const cur = prev[activeKey];
          if (!cur) return prev;
          return {
            ...prev,
            [activeKey]: {
              ...cur,
              items: mergeBranchChildren(cur.items, parentCommentId, res.items || [], {
                append: Boolean(cursor),
                hasMore: Boolean(res.hasMore),
                remainingCount: res.remainingCount,
                nextCursor: res.nextCursor,
              }) as ReelCommentItem[],
            },
          };
        });
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Could not load more replies', 'error');
      }
    },
    [showToast, sortBy]
  );

  const handleToggleCommentLike = useCallback(
    async (targetReelId: string | number, commentId: string | number) => {
      const activeKey = `${String(targetReelId)}:${sortBy}`;
      const snapshot = cacheByKey[activeKey];
      const findNode = (nodes: ThreadReply[]): ThreadReply | undefined => {
        for (const n of nodes) {
          if (String(n.id) === String(commentId)) return n;
          if (n.replies) {
            const found = findNode(n.replies);
            if (found) return found;
          }
        }
        return undefined;
      };
      const existing = snapshot ? findNode(snapshot.items) : undefined;
      const prevLiked = Boolean(existing?.likedByMe);
      const prevLikes = Math.max(0, Number(existing?.likes ?? 0));
      const optimisticLiked = !prevLiked;
      const optimisticLikes = Math.max(0, prevLikes + (optimisticLiked ? 1 : -1));

      setCacheByKey((prev) => {
        const cur = prev[activeKey];
        if (!cur) return prev;
        return {
          ...prev,
          [activeKey]: {
            ...cur,
            items: setReplyLikeInTree(
              cur.items,
              commentId,
              optimisticLiked,
              optimisticLikes
            ) as ReelCommentItem[],
          },
        };
      });

      if (!IS_REAL_BACKEND) return;

      try {
        const res = await apiRequest<{ liked: boolean; likes: number }>(
          `/reels/${encodeURIComponent(String(targetReelId))}/comments/${encodeURIComponent(
            String(commentId)
          )}/like`,
          { method: 'POST' }
        );
        setCacheByKey((prev) => {
          const cur = prev[activeKey];
          if (!cur) return prev;
          return {
            ...prev,
            [activeKey]: {
              ...cur,
              items: setReplyLikeInTree(
                cur.items,
                commentId,
                res.liked,
                res.likes
              ) as ReelCommentItem[],
            },
          };
        });
      } catch (err) {
        setCacheByKey((prev) => {
          const cur = prev[activeKey];
          if (!cur) return prev;
          return {
            ...prev,
            [activeKey]: {
              ...cur,
              items: setReplyLikeInTree(
                cur.items,
                commentId,
                prevLiked,
                prevLikes
              ) as ReelCommentItem[],
            },
          };
        });
        showToast(err instanceof Error ? err.message : 'Could not update like', 'error');
      }
    },
    [cacheByKey, showToast, sortBy]
  );

  const handleReportedComment = useCallback(
    (commentId: string | number) => {
      if (!cacheKey) return;
      setCacheByKey((prev) => {
        const cur = prev[cacheKey];
        if (!cur) return prev;
        return {
          ...prev,
          [cacheKey]: {
            ...cur,
            items: setReplyReportedInTree(cur.items, commentId, true) as ReelCommentItem[],
          },
        };
      });
    },
    [cacheKey]
  );

  if (!isOpen || !reel) return null;

  const panelBody = (
    <div
      data-testid="reel-comments-panel"
      onWheel={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
      className="flex flex-col h-full w-full bg-canvas border border-ink/12 rounded-[16px] overflow-hidden shadow-lg"
    >
      {/* Header: X left, centered Comments title, plain-text Top/Newest sort right */}
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-ink/12 shrink-0">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close comments panel"
          className="min-h-[44px] min-w-[44px] -ml-2 rounded-full text-ink/70 hover:text-ink hover:bg-ink/8 transition-colors cursor-pointer flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <X size={18} />
        </button>

        <h3 className="font-display text-sm font-bold text-ink truncate">
          Comments{' '}
          <span className="font-normal text-ink/50 tabular-nums">({currentEntry.totalCount})</span>
        </h3>

        <div className="flex items-center gap-2 shrink-0 text-xs">
          <button
            type="button"
            aria-pressed={sortBy === 'top'}
            onClick={() => setSortBy('top')}
            className={`cursor-pointer py-1 transition-colors rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
              sortBy === 'top' ? 'font-bold text-ink' : 'font-medium text-ink/50 hover:text-ink'
            }`}
          >
            Top
          </button>
          <span className="text-ink/25" aria-hidden="true">/</span>
          <button
            type="button"
            aria-pressed={sortBy === 'newest'}
            onClick={() => setSortBy('newest')}
            className={`cursor-pointer py-1 transition-colors rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
              sortBy === 'newest' ? 'font-bold text-ink' : 'font-medium text-ink/50 hover:text-ink'
            }`}
          >
            Newest
          </button>
        </div>
      </div>

      {/* Scrollable Comment Tree (zero visible scrollbars + overscroll-contain) */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain no-scrollbar p-4 space-y-1">
        {isLoadingInitial ? (
          <div className="space-y-3 py-2" aria-label="Loading comments">
            {[0, 1, 2].map((idx) => (
              <div key={idx} className="py-2 space-y-2 animate-pulse">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-ink/10" />
                  <div className="h-3 w-24 rounded bg-ink/10" />
                </div>
                <div className="h-3 w-full rounded bg-ink/10" />
                <div className="h-3 w-3/4 rounded bg-ink/10" />
              </div>
            ))}
          </div>
        ) : loadError ? (
          <div className="py-8 text-center space-y-3">
            <p className="text-xs text-ink/70">{loadError}</p>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                void fetchCommentsPage(reel.id, sortBy, reelDefaultCommentsEnabled, null, false);
              }}
            >
              Try again
            </Button>
          </div>
        ) : currentEntry.items.length === 0 ? (
          <div className="py-8 text-center space-y-2">
            <MessageCircle size={24} className="mx-auto text-ink/40" aria-hidden="true" />
            <p className="text-xs font-medium text-ink/60">
              {currentEntry.commentsEnabled === false
                ? 'Comments are turned off for this reel.'
                : 'No comments yet. Start the conversation.'}
            </p>
          </div>
        ) : (
          <>
            {currentEntry.items.map((comment) => (
              <ThreadCommentNode
                key={comment.id}
                threadId={reel.id}
                node={comment}
                depth={0}
                currentUsername={state.username || ''}
                highlightedId={highlightedId}
                onJumpToComment={handleJumpToComment}
                onReplySubmit={handleReplySubmit}
                onDeleteComment={handleDeleteComment}
                onLoadMoreReplies={handleLoadMoreReplies}
                onToggleLike={handleToggleCommentLike}
                onReportedComment={handleReportedComment}
                onActionMenuOpenChange={setChildMenuOpen}
                canDeleteComment={() => isReelOwner || state.role === 'admin'}
                variant="reel"
                domIdPrefix="reel-comment"
                maxLength={MAX_REEL_COMMENT_CHARS}
              />
            ))}

            {currentEntry.hasMore && (
              <div className="pt-2 text-center">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={loadingMore}
                  onClick={async () => {
                    if (loadingMore) return;
                    setLoadingMore(true);
                    try {
                      await fetchCommentsPage(
                        reel.id,
                        sortBy,
                        reelDefaultCommentsEnabled,
                        currentEntry.nextCursor,
                        true
                      );
                    } finally {
                      setLoadingMore(false);
                    }
                  }}
                >
                  {loadingMore ? 'Loading...' : 'Load more comments'}
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Fixed Bottom Composer (current user avatar + rounded input + plain-text Post when non-empty) */}
      {currentEntry.commentsEnabled === false ? (
        <div className="px-4 py-3 border-t border-ink/12 bg-ink/4 text-center text-xs font-semibold text-ink/60 shrink-0">
          Comments are turned off for this reel.
        </div>
      ) : (
        <form
          onSubmit={handlePostTopLevel}
          className="px-4 py-3 border-t border-ink/12 bg-canvas shrink-0 space-y-1"
        >
          <div className="flex items-center gap-2">
            <Avatar initials={state.userInitials || 'QD'} size="sm" />
            <textarea
              rows={1}
              maxLength={MAX_REEL_COMMENT_CHARS}
              placeholder="Add a comment..."
              aria-label="Add a comment on this reel"
              value={draft}
              onChange={(e) => {
                const nextVal = e.target.value;
                setDraftsByReel((prev) => ({ ...prev, [reelKey]: nextVal }));
              }}
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                  e.preventDefault();
                  void handlePostTopLevel(e);
                }
              }}
              className="flex-1 min-h-[36px] max-h-24 px-3 py-2 text-xs rounded-full border border-ink/12 bg-ink/4 text-ink placeholder:text-ink/50 focus:outline-none focus:ring-2 focus:ring-accent resize-none"
            />
            {draft.trim().length > 0 && (
              <button
                type="submit"
                disabled={submitting}
                className="text-xs font-bold text-accent hover:underline cursor-pointer px-2 py-2 shrink-0 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded"
              >
                {submitting ? 'Posting...' : 'Post'}
              </button>
            )}
          </div>
          {draft.length >= 400 && (
            <p className="text-right text-xs text-ink/60">
              {draft.length}/{MAX_REEL_COMMENT_CHARS}
            </p>
          )}
        </form>
      )}
    </div>
  );

  if (mode === 'embedded') {
    return (
      <div className="w-full lg:w-[340px] shrink-0 h-[56vh] lg:h-[68vh] lg:max-h-[640px]">
        {panelBody}
      </div>
    );
  }

  return (
    <>
      {/* Desktop: 340px right-hand comments card below floating header */}
      <div className="quad-reel-comments-desktop quad-reel-comments-desktop-slot min-h-[440px]">
        {panelBody}
      </div>

      {/* Narrow (<1024px or touch): <= ~60% slide-up bottom sheet adjusted for visualViewport */}
      <div
        className="quad-reel-comments-mobile-wrap fixed inset-0 z-50 items-end justify-center p-0 sm:p-4"
        style={{
          paddingBottom:
            mobileViewportMetrics.keyboardInsetPx > 0
              ? `${mobileViewportMetrics.keyboardInsetPx}px`
              : undefined,
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div
          className="quad-reel-comments-mobile-sheet w-full max-w-lg rounded-t-[16px] sm:rounded-[16px] overflow-hidden"
          style={
            mobileViewportMetrics.maxSheetPx
              ? { maxHeight: `${mobileViewportMetrics.maxSheetPx}px` }
              : undefined
          }
          onClick={(e) => e.stopPropagation()}
        >
          {panelBody}
        </div>
      </div>
    </>
  );
}
