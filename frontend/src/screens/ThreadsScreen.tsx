import React, { useState, useEffect, useMemo } from 'react';
import {
  MessageSquare,
  Heart,
  Share2,
  Bookmark,
  Send,
  ShieldCheck,
  MoreHorizontal,
  MessagesSquare,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { Avatar, PrivacyBadge, Card, Button, EmptyState } from '../components/ui';
import ThreadCommentNode from '../components/ThreadCommentNode';
import ReportModal from '../components/ReportModal';
import { buildShareUrl, shareContent } from '../utils/shareUrl';
import type { ThreadReply, ThreadItem } from '../types/quad';

export default function ThreadsScreen({
  onNavigate: _onNavigate,
  targetThreadId,
}: {
  onNavigate?: (screen: string) => void;
  targetThreadId?: string | number | null;
}) {
  const {
    state,
    createThread,
    toggleThreadLike,
    toggleThreadSave,
    addThreadReply,
    loadMoreThreadReplies,
    loadMoreThreads,
    deleteThreadReply,
    reportThreadComment,
    undoThreadCommentReport,
  } = useApp();
  const { showToast } = useToast();
  const threadPosts = useMemo(() => state.threadPosts || [], [state.threadPosts]);
  const savedThreadIds = useMemo(
    () => new Set((state.savedThreadIds || []).map(String)),
    [state.savedThreadIds]
  );

  useEffect(() => {
    if (!targetThreadId) return;
    const el = document.getElementById(`thread-${targetThreadId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-2', 'ring-accent', 'transition-all');
      const timer = setTimeout(() => {
        el.classList.remove('ring-2', 'ring-accent');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [targetThreadId, threadPosts]);
  const [newThreadText, setNewThreadText] = useState('');
  const [activeReplyPostId, setActiveReplyPostId] = useState<string | number | null>(null);
  const [replyText, setReplyText] = useState('');
  const [highlightedCommentId, setHighlightedCommentId] = useState<string | null>(null);
  const [loadingMoreThreads, setLoadingMoreThreads] = useState(false);
  const [reportTarget, setReportTarget] = useState<{
    threadId: string | number;
    comment: ThreadReply;
  } | null>(null);

  const toggleLike = async (id: string | number) => {
    await toggleThreadLike(id);
  };

  const handlePostThread = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!newThreadText.trim()) return;
    try {
      await createThread(newThreadText.trim());
      setNewThreadText('');
      showToast('Discussion posted to campus thread', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to post discussion', 'error');
    }
  };

  const handleAddTopLevelReply = async (postId: string | number) => {
    const trimmed = replyText.trim();
    if (!trimmed) return;
    setReplyText('');
    setActiveReplyPostId(null);
    try {
      await addThreadReply(postId, trimmed, { parentCommentId: null });
      showToast('Reply added cleanly', 'success');
    } catch (err) {
      setReplyText(trimmed);
      setActiveReplyPostId(postId);
      showToast(err instanceof Error ? err.message : 'Unable to post reply', 'error');
    }
  };

  const handleNestedReplySubmit = async (
    threadId: string | number,
    parentCommentId: string | number,
    replyToUsername: string,
    text: string
  ) => {
    try {
      await addThreadReply(threadId, text, { parentCommentId, replyToUsername });
      showToast(`Replied to @${replyToUsername}`, 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to post reply', 'error');
      throw err;
    }
  };

  const handleDeleteComment = async (threadId: string | number, replyId: string | number) => {
    try {
      await deleteThreadReply(threadId, replyId);
      showToast('Comment removed', 'info');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not delete comment', 'error');
    }
  };

  const handleLoadMoreBranch = async (
    threadId: string | number,
    parentCommentId: string | number
  ) => {
    try {
      await loadMoreThreadReplies(threadId, parentCommentId);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to load replies', 'error');
    }
  };

  const handleJumpToComment = (targetId: string | number) => {
    const idStr = String(targetId);
    const el = document.getElementById(`thread-comment-${idStr}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedCommentId(idStr);
      window.setTimeout(() => {
        setHighlightedCommentId((curr) => (curr === idStr ? null : curr));
      }, 2000);
    } else {
      showToast('Parent comment is outside the current view', 'info');
    }
  };

  const handleLoadMoreThreads = async () => {
    if (loadingMoreThreads) return;
    setLoadingMoreThreads(true);
    try {
      await loadMoreThreads();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not load more discussions', 'error');
    } finally {
      setLoadingMoreThreads(false);
    }
  };

  const handleOpenReportComment = (threadId: string | number, comment: ThreadReply) => {
    if (comment.reportedByMe) {
      showToast('You already reported this', 'info');
      return;
    }
    setReportTarget({ threadId, comment });
  };

  const handleConfirmReport = async (reason: string, details: string) => {
    if (!reportTarget) return;
    try {
      const outcome = await reportThreadComment(
        reportTarget.threadId,
        reportTarget.comment,
        reason,
        details
      );
      setReportTarget(null);
      if (outcome === 'already_reported') {
        showToast('You already reported this', 'info');
      } else {
        showToast('Confidential report submitted to campus moderation', 'info');
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to submit report', 'error');
    }
  };

  const handleUndoReport = async (threadId: string | number, comment: ThreadReply) => {
    try {
      await undoThreadCommentReport(threadId, comment.id);
      showToast('Report withdrawn and comment restored', 'info');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to undo report', 'error');
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* Thread Composer Card */}
      <Card className="p-4 sm:p-6 bg-canvas border border-ink/12 rounded-[16px]">
        <form onSubmit={handlePostThread} className="space-y-4">
          <div className="flex items-start gap-3">
            <Avatar initials={state.userInitials || 'QD'} size="md" />
            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-bold text-ink truncate">
                  @{state.username || 'quantum_dev'}
                </span>
                <PrivacyBadge level="public" labelCustom="Campus Thread" size="sm" />
              </div>
              <textarea
                rows={2}
                value={newThreadText}
                onChange={(e) => setNewThreadText(e.target.value)}
                placeholder="Start a campus discussion or direct peer inquiry..."
                aria-label="New thread message"
                className="w-full px-3 py-2 rounded-[10px] text-sm bg-canvas border border-ink/12 text-ink placeholder:text-ink/60 focus:outline-none focus:ring-2 focus:ring-accent resize-y"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={!newThreadText.trim()}
              icon={Send}
            >
              Post Thread
            </Button>
          </div>
        </form>
      </Card>

      {/* Threads List */}
      {threadPosts.length === 0 ? (
        <EmptyState
          icon={MessagesSquare}
          title="No Discussions Active"
          description="Campus Q&A, study notes, and peer-to-peer technical threads will appear here."
        />
      ) : (
        <div className="space-y-4">
          {threadPosts.map((post: ThreadItem) => {
            const isLiked = Boolean(post.isLiked);
            return (
              <Card
                key={post.id}
                id={`thread-${post.id}`}
                className="p-4 sm:p-6 bg-canvas border border-ink/12 rounded-[16px] space-y-4 hover:border-ink/24 transition-colors"
              >
                {/* Parent Post Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar initials={post.initials} size="md" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-ink truncate">
                          @{post.username}
                        </span>
                        <ShieldCheck size={16} className="text-ink shrink-0" aria-label="Verified student" />
                        <span className="text-xs text-ink/60">• {post.timestamp}</span>
                      </div>
                      <span className="text-xs text-accent font-semibold">
                        Verified Peer
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    aria-label={`Thread options for @${post.username}`}
                    onClick={() => showToast('Use the ⋯ menu on any comment or reply to report', 'info')}
                    className="min-h-[44px] min-w-[44px] p-2 rounded-[8px] text-ink/60 hover:text-ink hover:bg-ink/8 active:bg-ink/12 transition-colors cursor-pointer flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    <MoreHorizontal size={20} />
                  </button>
                </div>

                {/* Thread Content */}
                <p className="text-sm text-ink leading-relaxed pl-0 sm:pl-12 font-normal break-words">
                  {post.content}
                </p>

                {/* Action Bar */}
                <div className="flex items-center gap-2 sm:gap-4 pl-0 sm:pl-12 pt-1 text-xs text-ink/60 flex-wrap">
                  <button
                    type="button"
                    onClick={() => toggleLike(post.id)}
                    aria-label={`${isLiked ? 'Unlike thread' : 'Like thread'} ${post.likes || 0}`}
                    className={`min-h-[44px] px-3 py-2 rounded-[8px] flex items-center gap-2 transition-all cursor-pointer active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                      isLiked ? 'text-ink font-bold bg-ink/6' : 'hover:text-ink hover:bg-ink/4'
                    }`}
                  >
                    <Heart size={16} className={isLiked ? 'fill-ink text-ink' : 'text-ink/60'} />
                    <span>{post.likes || 0}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const nextOpen = activeReplyPostId === post.id ? null : post.id;
                      setActiveReplyPostId(nextOpen);
                      setReplyText(nextOpen ? `@${post.username} ` : '');
                    }}
                    aria-label={`${post.replyCount || (post.replies?.length || 0)} replies, reply to @${post.username}`}
                    className="min-h-[44px] px-3 py-2 rounded-[8px] flex items-center gap-2 hover:text-ink hover:bg-ink/4 transition-colors cursor-pointer active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    <MessageSquare size={16} />
                    <span>{post.replyCount ?? (post.replies?.length || 0)} replies</span>
                  </button>

                  <button
                    type="button"
                    aria-label="Share thread link"
                    onClick={() => {
                      const url = buildShareUrl({ type: 'thread', id: post.id });
                      shareContent({
                        title: 'Campus Discussion on Quad',
                        text: post.content,
                        url,
                        onToast: (msg, variant) => showToast(msg, variant || 'success'),
                      });
                    }}
                    className="min-h-[44px] min-w-[44px] p-2 rounded-[8px] flex items-center justify-center hover:text-ink hover:bg-ink/4 transition-colors cursor-pointer active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    <Share2 size={16} />
                  </button>

                  <button
                    type="button"
                    aria-label={savedThreadIds.has(String(post.id)) ? 'Remove saved thread' : 'Save thread'}
                    aria-pressed={savedThreadIds.has(String(post.id))}
                    onClick={async () => {
                      try {
                        const res = await toggleThreadSave(post.id);
                        showToast(
                          res?.saved ? 'Thread saved to Personal Space' : 'Removed from Saved',
                          'success'
                        );
                      } catch {
                        showToast('Unable to save thread', 'error');
                      }
                    }}
                    className={`min-h-[44px] min-w-[44px] p-2 rounded-[8px] flex items-center justify-center transition-colors cursor-pointer active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                      savedThreadIds.has(String(post.id)) ? 'text-ink font-bold bg-ink/6' : 'hover:text-ink hover:bg-ink/4'
                    }`}
                  >
                    <Bookmark size={16} className={savedThreadIds.has(String(post.id)) ? 'fill-ink text-ink' : 'text-ink/60'} />
                  </button>
                </div>

                {/* Inline Reply Input to Thread */}
                {activeReplyPostId === post.id && (
                  <div className="pl-0 sm:pl-12 pt-2">
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleAddTopLevelReply(post.id);
                      }}
                      className="space-y-2"
                    >
                      <textarea
                        rows={2}
                        maxLength={2000}
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        onKeyDown={(e) => {
                          if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                            e.preventDefault();
                            handleAddTopLevelReply(post.id);
                          }
                        }}
                        placeholder={`Reply to @${post.username}...`}
                        aria-label={`Reply input for @${post.username}`}
                        className="w-full px-3 py-2 rounded-[8px] text-xs bg-canvas border border-ink/12 text-ink placeholder:text-ink/60 focus:outline-none focus:ring-2 focus:ring-accent resize-y"
                      />
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-ink/60">Ctrl+Enter to submit</span>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              setActiveReplyPostId(null);
                              setReplyText('');
                            }}
                          >
                            Cancel
                          </Button>
                          <Button
                            type="submit"
                            variant="primary"
                            size="sm"
                            disabled={!replyText.trim()}
                          >
                            Submit
                          </Button>
                        </div>
                      </div>
                    </form>
                  </div>
                )}

                {/* Nested Comments Tree */}
                {post.replies && post.replies.length > 0 && (
                  <div className="pl-2 sm:pl-12 pt-2 space-y-3">
                    {post.replies.map((reply: ThreadReply) => (
                      <ThreadCommentNode
                        key={reply.id}
                        threadId={post.id}
                        node={reply}
                        depth={0}
                        currentUsername={state.username}
                        highlightedId={highlightedCommentId}
                        onJumpToComment={handleJumpToComment}
                        onReplySubmit={handleNestedReplySubmit}
                        onDeleteComment={handleDeleteComment}
                        onLoadMoreReplies={handleLoadMoreBranch}
                        onReportComment={handleOpenReportComment}
                        onUndoReport={handleUndoReport}
                      />
                    ))}
                  </div>
                )}
              </Card>
            );
          })}

          {state.threadsHasMore && (
            <div className="flex justify-center pt-2">
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={handleLoadMoreThreads}
                disabled={loadingMoreThreads}
              >
                {loadingMoreThreads ? 'Loading discussions...' : 'Load more discussions'}
              </Button>
            </div>
          )}
        </div>
      )}

      <ReportModal
        isOpen={Boolean(reportTarget)}
        targetLabel={
          reportTarget ? `Comment by @${reportTarget.comment.username}` : undefined
        }
        snippet={reportTarget?.comment.content}
        onClose={() => setReportTarget(null)}
        onConfirm={handleConfirmReport}
      />
    </div>
  );
}
