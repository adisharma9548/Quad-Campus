import React, { useState, useRef, useEffect } from 'react';
import {
  CornerDownRight,
  MessageSquare,
  MoreHorizontal,
  Trash2,
  Flag,
  Send,
} from 'lucide-react';
import type { ThreadReply } from '../types/quad';
import { Avatar, Button } from './ui';
import { countDescendants } from '../utils/threadTree';

const MAX_VISUAL_INDENT_DEPTH = 8;

export interface ThreadCommentNodeProps {
  threadId: string | number;
  node: ThreadReply;
  depth?: number;
  currentUsername: string;
  highlightedId: string | null;
  onJumpToComment: (targetId: string | number) => void;
  onReplySubmit: (
    threadId: string | number,
    parentCommentId: string | number,
    replyToUsername: string,
    text: string
  ) => Promise<void>;
  onDeleteComment: (threadId: string | number, replyId: string | number) => Promise<void>;
  onLoadMoreReplies: (threadId: string | number, parentCommentId: string | number) => Promise<void>;
  onReportComment?: (threadId: string | number, comment: ThreadReply) => void;
  onUndoReport?: (threadId: string | number, comment: ThreadReply) => void;
}

export default function ThreadCommentNode({
  threadId,
  node,
  depth = 0,
  currentUsername,
  highlightedId,
  onJumpToComment,
  onReplySubmit,
  onDeleteComment,
  onLoadMoreReplies,
  onReportComment,
  onUndoReport,
}: ThreadCommentNodeProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isReplying, setIsReplying] = useState(false);
  const [replyDraft, setReplyDraft] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loadingBranch, setLoadingBranch] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const replyInputRef = useRef<HTMLTextAreaElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const isHighlighted = highlightedId !== null && String(highlightedId) === String(node.id);
  const isOwn =
    Boolean(currentUsername) &&
    node.username.toLowerCase() === currentUsername.toLowerCase() &&
    !node.isDeleted;
  const children = node.replies || [];
  const totalDescendants = countDescendants(node);
  const canIndentFurther = depth < MAX_VISUAL_INDENT_DEPTH;

  useEffect(() => {
    if (isReplying && replyInputRef.current) {
      const el = replyInputRef.current;
      el.focus();
      const len = el.value.length;
      el.setSelectionRange(len, len);
    }
  }, [isReplying]);

  useEffect(() => {
    if (!menuOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [menuOpen]);

  const openInlineReply = () => {
    if (isReplying) {
      setIsReplying(false);
      return;
    }
    setReplyDraft(`@${node.username} `);
    setIsReplying(true);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = replyDraft.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    try {
      await onReplySubmit(threadId, node.id, node.username, trimmed);
      setReplyDraft('');
      setIsReplying(false);
    } finally {
      setSubmitting(false);
    }
  };

  const handleLoadMore = async () => {
    if (loadingBranch) return;
    setLoadingBranch(true);
    try {
      await onLoadMoreReplies(threadId, node.id);
    } finally {
      setLoadingBranch(false);
    }
  };

  // Reported comment collapsed/blurred state (used in Part 4)
  if (node.reportedByMe && !node.isDeleted) {
    return (
      <div
        id={`thread-comment-${node.id}`}
        className={`rounded-[10px] border border-ink/12 bg-ink/4 p-3 flex items-center justify-between gap-3 ${
          isHighlighted ? 'ring-2 ring-accent bg-accent/10' : ''
        }`}
      >
        <p className="text-xs text-ink/60 blur-[2px] select-none truncate">
          Reported comment hidden from your view
        </p>
        {onUndoReport && (
          <button
            type="button"
            onClick={() => onUndoReport(threadId, node)}
            className="text-xs font-bold text-accent hover:underline cursor-pointer shrink-0 min-h-[32px] px-2"
          >
            Undo
          </button>
        )}
      </div>
    );
  }

  return (
    <div id={`thread-comment-${node.id}`} className="relative">
      <div
        className={`rounded-[10px] border transition-colors p-3 ${
          isHighlighted
            ? 'border-accent bg-accent/8 ring-2 ring-accent'
            : 'border-ink/12 bg-ink/4'
        }`}
      >
        {/* Header Row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            <Avatar initials={node.isDeleted ? 'DEL' : node.initials} size="sm" />
            <span className="text-xs font-bold text-ink truncate">
              {node.isDeleted ? '[deleted]' : `@${node.username}`}
            </span>
            <span className="text-xs text-ink/60">• {node.timestamp}</span>
            {node.replyToUsername && node.parentCommentId && (
              <button
                type="button"
                onClick={() => onJumpToComment(node.parentCommentId!)}
                className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded px-1"
                title={`Jump to @${node.replyToUsername}'s comment`}
              >
                <CornerDownRight size={12} aria-hidden="true" />
                <span>replying to @{node.replyToUsername}</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {(children.length > 0 || node.hasMoreReplies) && (
              <button
                type="button"
                onClick={() => setIsCollapsed((prev) => !prev)}
                aria-expanded={!isCollapsed}
                aria-label={isCollapsed ? `Expand ${totalDescendants} replies` : 'Collapse branch'}
                className="text-xs font-mono font-bold text-ink/60 hover:text-ink px-2 py-1 rounded hover:bg-ink/8 cursor-pointer"
              >
                {isCollapsed ? `[+ ${totalDescendants} ${totalDescendants === 1 ? 'reply' : 'replies'}]` : '[–]'}
              </button>
            )}

            {!node.isDeleted && (
              <div className="relative" ref={menuRef}>
                <button
                  type="button"
                  aria-label={`Comment options for @${node.username}`}
                  aria-expanded={menuOpen}
                  onClick={() => setMenuOpen((prev) => !prev)}
                  className="p-1 rounded-[8px] text-ink/60 hover:text-ink hover:bg-ink/8 cursor-pointer flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <MoreHorizontal size={16} />
                </button>
                {menuOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 top-8 z-30 w-40 rounded-[12px] border border-ink/12 bg-canvas shadow-lg py-1"
                  >
                    {isOwn ? (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setMenuOpen(false);
                          onDeleteComment(threadId, node.id);
                        }}
                        className="w-full px-3 py-2 text-left text-xs font-semibold text-danger hover:bg-danger/8 flex items-center gap-2 cursor-pointer"
                      >
                        <Trash2 size={14} />
                        <span>Delete</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setMenuOpen(false);
                          onReportComment?.(threadId, node);
                        }}
                        className="w-full px-3 py-2 text-left text-xs font-semibold text-ink hover:bg-ink/6 flex items-center gap-2 cursor-pointer"
                      >
                        <Flag size={14} />
                        <span>Report</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Body */}
        <p
          className={`mt-2 text-xs leading-relaxed break-words ${
            node.isDeleted ? 'italic text-ink/60' : 'text-ink'
          }`}
        >
          {node.isDeleted ? '[deleted]' : node.content}
        </p>

        {/* Actions Footer */}
        {!node.isDeleted && (
          <div className="mt-2 flex items-center gap-3">
            <button
              type="button"
              onClick={openInlineReply}
              className="inline-flex items-center gap-1 text-xs font-bold text-ink/60 hover:text-ink py-1 px-2 rounded hover:bg-ink/6 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <MessageSquare size={14} aria-hidden="true" />
              <span>Reply</span>
            </button>
          </div>
        )}

        {/* Inline Reply Box */}
        {isReplying && (
          <form
            onSubmit={handleSubmit}
            className="mt-3 pt-3 border-t border-ink/12 space-y-2"
          >
            <textarea
              ref={replyInputRef}
              rows={2}
              maxLength={2000}
              value={replyDraft}
              onChange={(e) => setReplyDraft(e.target.value)}
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              placeholder={`Reply to @${node.username}...`}
              aria-label={`Inline reply to @${node.username}`}
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
                    setIsReplying(false);
                    setReplyDraft('');
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  icon={Send}
                  disabled={!replyDraft.trim() || submitting}
                >
                  {submitting ? 'Sending...' : 'Submit'}
                </Button>
              </div>
            </div>
          </form>
        )}
      </div>

      {/* Nested Children */}
      {!isCollapsed && (children.length > 0 || node.hasMoreReplies) && (
        <div
          className={`mt-2 relative flex ${
            canIndentFurther ? 'ml-2 pl-3 sm:ml-3 sm:pl-4' : 'ml-0 pl-2'
          }`}
        >
          {/* Clickable vertical collapse connector line */}
          <button
            type="button"
            onClick={() => setIsCollapsed(true)}
            aria-label="Collapse thread branch"
            title="Click line to collapse branch"
            className="group absolute left-0 top-0 bottom-0 w-3 flex justify-center cursor-pointer focus-visible:outline-none"
          >
            <span className="w-[2px] h-full bg-ink/15 group-hover:bg-accent transition-colors rounded-full" />
          </button>

          <div className="flex-1 min-w-0 space-y-2">
            {children.map((child) => (
              <ThreadCommentNode
                key={child.id}
                threadId={threadId}
                node={child}
                depth={depth + 1}
                currentUsername={currentUsername}
                highlightedId={highlightedId}
                onJumpToComment={onJumpToComment}
                onReplySubmit={onReplySubmit}
                onDeleteComment={onDeleteComment}
                onLoadMoreReplies={onLoadMoreReplies}
                onReportComment={onReportComment}
                onUndoReport={onUndoReport}
              />
            ))}

            {node.hasMoreReplies && (
              <button
                type="button"
                onClick={handleLoadMore}
                disabled={loadingBranch}
                className="text-xs font-bold text-accent hover:underline py-1 px-2 rounded cursor-pointer disabled:opacity-60"
              >
                {loadingBranch
                  ? 'Loading replies...'
                  : `Load more replies${node.hiddenReplyCount ? ` (${node.hiddenReplyCount})` : ''}`}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
