import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { X, MessageCircle, Send } from 'lucide-react';
import type { ReelCommentItem, ReelItem, ThreadReply } from '../types/quad';
import { IS_REAL_BACKEND, apiRequest } from '../services/apiClient';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import ThreadCommentNode from './ThreadCommentNode';
import ReportModal from './ReportModal';
import { Button } from './ui';
import {
  insertReplyIntoTree,
  replaceTempReplyInTree,
  removeReplyFromTree,
  mergeBranchChildren,
  setReplyReportedInTree,
} from '../utils/threadTree';

const MAX_REEL_COMMENT_CHARS = 500;
const PAGE_LIMIT = 20;

interface CommentsApiResponse {
  items: ReelCommentItem[];
  total: number;
  totalCount: number;
  hasMore: boolean;
  nextOffset: number;
  commentsEnabled: boolean;
}

interface CommentThreadState {
  items: ReelCommentItem[];
  totalCount: number;
  hasMore: boolean;
  nextOffset: number;
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
  const { state, submitReport, updateReelCommentCount } = useApp();
  const { showToast } = useToast();

  const [cacheByReel, setCacheByReel] = useState<Record<string, CommentThreadState>>({});
  const [draftsByReel, setDraftsByReel] = useState<Record<string, string>>({});
  const [loadingReelId, setLoadingReelId] = useState<string | null>(null);
  const [errorByReel, setErrorByReel] = useState<Record<string, string>>({});
  const [loadingMore, setLoadingMore] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [reportTarget, setReportTarget] = useState<ThreadReply | null>(null);
  const highlightTimerRef = useRef<number | null>(null);

  const reelKey = reel ? String(reel.id) : '';
  const reelDefaultCommentsEnabled = reel?.commentsEnabled !== false;
  const reelDefaultCount = Math.max(0, Number(reel?.comments ?? 0));
  const cachedEntry = reelKey ? cacheByReel[reelKey] : undefined;
  const currentEntry: CommentThreadState = useMemo(
    () =>
      cachedEntry || {
        items: [],
        totalCount: reelDefaultCount,
        hasMore: false,
        nextOffset: 0,
        commentsEnabled: reelDefaultCommentsEnabled,
      },
    [cachedEntry, reelDefaultCommentsEnabled, reelDefaultCount]
  );
  const draft = draftsByReel[reelKey] || '';
  const isLoadingInitial = Boolean(reelKey && loadingReelId === reelKey && !cacheByReel[reelKey]);
  const loadError = reelKey ? errorByReel[reelKey] || '' : '';
  const isReelOwner = Boolean(
    reel && state.username && reel.username.toLowerCase() === state.username.toLowerCase()
  );

  const fetchCommentsPage = useCallback(
    async (
      targetReelId: string | number,
      fallbackCommentsEnabled: boolean,
      offset = 0,
      append = false
    ) => {
      const key = String(targetReelId);
      if (!IS_REAL_BACKEND) {
        setCacheByReel((prev) => ({
          ...prev,
          [key]: prev[key] || {
            items: [],
            totalCount: 0,
            hasMore: false,
            nextOffset: 0,
            commentsEnabled: fallbackCommentsEnabled,
          },
        }));
        return;
      }

      if (!append) {
        setLoadingReelId(key);
        setErrorByReel((prev) => {
          if (!prev[key]) return prev;
          const next = { ...prev };
          delete next[key];
          return next;
        });
      }

      try {
        const res = await apiRequest<CommentsApiResponse>(
          `/reels/${encodeURIComponent(key)}/comments?limit=${PAGE_LIMIT}&offset=${offset}&maxDepth=2`
        );
        setCacheByReel((prev) => {
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
              commentsEnabled: res.commentsEnabled !== false,
            },
          };
        });
        if (typeof res.totalCount === 'number') {
          updateReelCommentCount(targetReelId, res.totalCount);
        }
      } catch (err) {
        if (!append) {
          setErrorByReel((prev) => ({
            ...prev,
            [key]: err instanceof Error ? err.message : 'Unable to load comments.',
          }));
        } else {
          showToast(err instanceof Error ? err.message : 'Could not load more comments', 'error');
        }
      } finally {
        if (!append) {
          setLoadingReelId((curr) => (curr === key ? null : curr));
        }
      }
    },
    [showToast, updateReelCommentCount]
  );

  // Lazy-load comments only when opened or when switching active reels while open
  useEffect(() => {
    if (!isOpen || !reelKey) return;
    const timer = window.setTimeout(() => {
      void fetchCommentsPage(reelKey, reelDefaultCommentsEnabled, 0, false);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchCommentsPage, isOpen, reelDefaultCommentsEnabled, reelKey]);

  // Escape closes comments panel when ReportModal is not open
  useEffect(() => {
    if (!isOpen || reportTarget) return undefined;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose, reportTarget]);

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

      const key = String(targetReelId);
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
        isDeleted: false,
        replies: [],
      };

      const prevSnapshot = cacheByReel[key];
      setCacheByReel((prev) => {
        const cur = prev[key] || currentEntry;
        const nextItems = parentCommentId
          ? (insertReplyIntoTree(cur.items, parentCommentId, optimisticNode) as ReelCommentItem[])
          : [...cur.items, optimisticNode];
        return {
          ...prev,
          [key]: {
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
          `/reels/${encodeURIComponent(key)}/comments`,
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
        setCacheByReel((prev) => {
          const cur = prev[key] || currentEntry;
          return {
            ...prev,
            [key]: {
              ...cur,
              items: replaceTempReplyInTree(cur.items, tempId, created) as ReelCommentItem[],
              totalCount: serverCount,
            },
          };
        });
        updateReelCommentCount(targetReelId, serverCount);
      } catch (err) {
        // Rollback optimistic insertion cleanly
        setCacheByReel((prev) => {
          if (prevSnapshot) {
            return { ...prev, [key]: prevSnapshot };
          }
          const cur = prev[key];
          if (!cur) return prev;
          return {
            ...prev,
            [key]: {
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
      cacheByReel,
      currentEntry,
      showToast,
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
      const key = String(targetReelId);
      const prevSnapshot = cacheByReel[key];
      if (!IS_REAL_BACKEND) {
        setCacheByReel((prev) => {
          const cur = prev[key];
          if (!cur) return prev;
          return {
            ...prev,
            [key]: {
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
          `/reels/${encodeURIComponent(key)}/comments/${encodeURIComponent(String(commentId))}`,
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

        setCacheByReel((prev) => {
          const cur = prev[key];
          if (!cur) return prev;
          const nextItems = res.softDeleted
            ? markSoftDeleted(cur.items)
            : (removeReplyFromTree(cur.items, commentId).nodes as ReelCommentItem[]);
          return {
            ...prev,
            [key]: {
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
          setCacheByReel((prev) => ({ ...prev, [key]: prevSnapshot }));
        }
        showToast(err instanceof Error ? err.message : 'Unable to delete comment', 'error');
      }
    },
    [cacheByReel, showToast, updateReelCommentCount]
  );

  const handleLoadMoreReplies = useCallback(
    async (targetReelId: string | number, parentCommentId: string | number) => {
      if (!IS_REAL_BACKEND) return;
      const key = String(targetReelId);
      try {
        const res = await apiRequest<CommentsApiResponse>(
          `/reels/${encodeURIComponent(key)}/comments?parentId=${encodeURIComponent(
            String(parentCommentId)
          )}&maxDepth=2`
        );
        setCacheByReel((prev) => {
          const cur = prev[key];
          if (!cur) return prev;
          return {
            ...prev,
            [key]: {
              ...cur,
              items: mergeBranchChildren(
                cur.items,
                parentCommentId,
                res.items || []
              ) as ReelCommentItem[],
            },
          };
        });
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Could not load more replies', 'error');
      }
    },
    [showToast]
  );

  const handleOpenReportComment = useCallback(
    (_targetReelId: string | number, comment: ThreadReply) => {
      if (comment.reportedByMe) {
        showToast('You already reported this', 'info');
        return;
      }
      setReportTarget(comment);
    },
    [showToast]
  );

  const handleConfirmReport = async (reason: string, details: string) => {
    if (!reportTarget || !reel) return;
    const reportedId = reportTarget.id;
    const key = String(reel.id);

    setCacheByReel((prev) => {
      const cur = prev[key];
      if (!cur) return prev;
      return {
        ...prev,
        [key]: {
          ...cur,
          items: setReplyReportedInTree(cur.items, reportedId, true) as ReelCommentItem[],
        },
      };
    });

    try {
      const outcome = await submitReport({
        targetType: 'reel_comment',
        targetId: String(reportedId),
        reason,
        details,
        contentSnippet: String(reportTarget.content || '').slice(0, 200),
      });
      setReportTarget(null);
      if (outcome.duplicate) {
        showToast('You already reported this', 'info');
      } else {
        showToast('Confidential report submitted to campus moderation', 'info');
      }
    } catch (err) {
      setCacheByReel((prev) => {
        const cur = prev[key];
        if (!cur) return prev;
        return {
          ...prev,
          [key]: {
            ...cur,
            items: setReplyReportedInTree(cur.items, reportedId, false) as ReelCommentItem[],
          },
        };
      });
      showToast(err instanceof Error ? err.message : 'Failed to submit report', 'error');
    }
  };

  if (!isOpen || !reel) return null;

  const panelBody = (
    <div
      data-testid="reel-comments-panel"
      onWheel={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
      className="flex flex-col h-full w-full bg-canvas border border-ink/12 rounded-[16px] overflow-hidden shadow-lg"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-ink/12 shrink-0">
        <div className="min-w-0">
          <h3 className="font-display text-sm font-bold text-ink truncate">
            Comments ({currentEntry.totalCount})
          </h3>
          <p className="text-xs text-ink/60 truncate">On @{reel.username}&apos;s reel</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close comments panel"
          className="p-2 rounded-full text-ink/60 hover:text-ink hover:bg-ink/8 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <X size={18} />
        </button>
      </div>

      {/* Scrollable Comment Tree */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 space-y-3">
        {isLoadingInitial ? (
          <div className="space-y-3 py-2" aria-label="Loading comments">
            {[0, 1, 2].map((idx) => (
              <div key={idx} className="rounded-[10px] border border-ink/10 p-3 space-y-2 animate-pulse">
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
                void fetchCommentsPage(reel.id, reelDefaultCommentsEnabled, 0, false);
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
                onReportComment={handleOpenReportComment}
                canDeleteComment={() => isReelOwner || state.role === 'admin'}
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
                        reelDefaultCommentsEnabled,
                        currentEntry.nextOffset,
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

      {/* Bottom Composer */}
      {currentEntry.commentsEnabled === false ? (
        <div className="px-4 py-3 border-t border-ink/12 bg-ink/4 text-center text-xs font-semibold text-ink/60 shrink-0">
          Comments are turned off for this reel.
        </div>
      ) : (
        <form
          onSubmit={handlePostTopLevel}
          className="p-3 border-t border-ink/12 bg-canvas shrink-0 space-y-2"
        >
          <div className="flex items-end gap-2">
            <textarea
              rows={2}
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
              className="flex-1 min-h-[44px] max-h-24 px-3 py-2 text-xs rounded-[8px] border border-ink/12 bg-ink/4 text-ink placeholder:text-ink/60 focus:outline-none focus:ring-2 focus:ring-accent resize-none"
            />
            <Button
              type="submit"
              variant="primary"
              size="md"
              icon={Send}
              disabled={!draft.trim() || submitting}
            >
              {submitting ? '...' : 'Post'}
            </Button>
          </div>
          {draft.length >= 400 && (
            <p className="text-right text-xs text-ink/60">
              {draft.length}/{MAX_REEL_COMMENT_CHARS}
            </p>
          )}
        </form>
      )}

      {/* Report Modal for reel comments */}
      <ReportModal
        isOpen={Boolean(reportTarget)}
        targetLabel={reportTarget ? `@${reportTarget.username}'s comment` : 'comment'}
        snippet={reportTarget?.content}
        onClose={() => setReportTarget(null)}
        onConfirm={handleConfirmReport}
      />
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
      {/* Desktop (>=1100px): 340px right-hand comments card */}
      <div className="quad-reel-comments-desktop h-[calc(100dvh-136px)] min-h-[440px] max-h-[780px]">
        {panelBody}
      </div>

      {/* Narrow (<1100px): slide-up bottom sheet */}
      <div
        className="quad-reel-comments-mobile-wrap fixed inset-0 z-50 items-end justify-center p-0 sm:p-4"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div
          className="w-full max-w-lg h-[74dvh] max-h-[620px] rounded-t-[16px] sm:rounded-[16px] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {panelBody}
        </div>
      </div>
    </>
  );
}
