import React, { useState, useEffect, useRef } from 'react';
import {
  MoreHorizontal,
  Link2,
  EyeOff,
  VolumeX,
  Ban,
  Flag,
  Trash2,
  X,
} from 'lucide-react';
import type { ReelItem, ThreadReply } from '../types/quad';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { Button, MenuItem, Modal } from './ui';
import ReportModal from './ReportModal';

export interface ContentActionMenuProps {
  kind: 'reel' | 'reel_comment';
  reel?: ReelItem;
  comment?: ThreadReply;
  isOwn: boolean;
  canModerate?: boolean;
  onDeleteReel?: (reelId: string | number) => Promise<void>;
  onDeleteComment?: (comment: ThreadReply) => Promise<void>;
  onReportedComment?: (commentId: string | number) => void;
  onOpenChange?: (open: boolean) => void;
  buttonClassName?: string;
  iconSize?: number;
  align?: 'left' | 'right';
  placement?: 'top' | 'bottom';
  testId?: string;
}

export default function ContentActionMenu({
  kind,
  reel,
  comment,
  isOwn,
  canModerate = false,
  onDeleteReel,
  onDeleteComment,
  onReportedComment,
  onOpenChange,
  buttonClassName = 'min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full text-ink/70 hover:text-ink hover:bg-ink/8',
  iconSize = 20,
  align = 'right',
  placement = 'top',
  testId,
}: ContentActionMenuProps) {
  const { hideReel, muteAuthor, blockAuthor, submitReport, deleteReel } = useApp();
  const { showToast } = useToast();

  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'block' | 'delete' | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const anyOpen = menuOpen || confirmAction !== null || reportOpen;
  useEffect(() => {
    onOpenChange?.(anyOpen);
  }, [anyOpen, onOpenChange]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const handlePointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [menuOpen]);

  const targetUsername =
    kind === 'reel' ? reel?.username || '' : comment?.username || '';
  const isDeletedComment = Boolean(kind === 'reel_comment' && comment?.isDeleted);

  const handleCopyLink = async () => {
    setMenuOpen(false);
    if (!reel) return;
    const url = `${window.location.origin}/?reel=${encodeURIComponent(String(reel.id))}`;
    try {
      await navigator.clipboard.writeText(url);
      showToast('Reel link copied to clipboard', 'success');
    } catch {
      showToast(url, 'info');
    }
  };

  const handleHide = async () => {
    setMenuOpen(false);
    if (!reel) return;
    try {
      await hideReel(reel.id);
      showToast('Reel hidden from your campus feed', 'info');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not hide reel', 'error');
    }
  };

  const handleMuteUser = async () => {
    setMenuOpen(false);
    if (!targetUsername) return;
    try {
      await muteAuthor(targetUsername);
      showToast(`Muted @${targetUsername}`, 'info');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not mute user', 'error');
    }
  };

  const handleConfirmBlock = async () => {
    if (!targetUsername || busy) return;
    setBusy(true);
    try {
      await blockAuthor(targetUsername);
      setConfirmAction(null);
      showToast(`Blocked @${targetUsername}. Their content is hidden.`, 'info');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not block user', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (kind === 'reel' && reel) {
        if (onDeleteReel) {
          await onDeleteReel(reel.id);
        } else {
          await deleteReel(reel.id);
        }
        showToast('Reel deleted', 'info');
      } else if (kind === 'reel_comment' && comment && onDeleteComment) {
        await onDeleteComment(comment);
      }
      setConfirmAction(null);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not delete item', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmReport = async (reason: string, details: string) => {
    if (kind === 'reel' && reel) {
      const outcome = await submitReport({
        targetType: 'reel',
        targetId: String(reel.id),
        reason,
        details,
        contentSnippet: String(reel.caption || reel.tag || '').slice(0, 200),
      });
      setReportOpen(false);
      showToast(
        outcome.duplicate
          ? 'You already reported this'
          : 'Confidential report submitted to campus moderation',
        'info'
      );
      return;
    }
    if (kind === 'reel_comment' && comment) {
      const outcome = await submitReport({
        targetType: 'reel_comment',
        targetId: String(comment.id),
        reason,
        details,
        contentSnippet: String(comment.content || '').slice(0, 200),
      });
      setReportOpen(false);
      onReportedComment?.(comment.id);
      showToast(
        outcome.duplicate
          ? 'You already reported this'
          : 'Confidential report submitted to campus moderation',
        'info'
      );
    }
  };

  if (isDeletedComment) return null;

  return (
    <div
      ref={containerRef}
      className="relative inline-flex"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        data-testid={testId}
        onClick={(e) => {
          e.stopPropagation();
          setMenuOpen((prev) => !prev);
        }}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-label={kind === 'reel' ? 'More options for reel' : 'More options for comment'}
        className={`cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${buttonClassName}`}
      >
        <MoreHorizontal size={iconSize} />
      </button>

      {menuOpen && (
        <div
          role="menu"
          aria-label={kind === 'reel' ? 'Reel actions' : 'Comment actions'}
          onClick={(e) => e.stopPropagation()}
          className={`quad-action-menu-popover absolute z-50 rounded-[12px] bg-canvas border border-ink/12 shadow-xl p-1 text-left ${
            align === 'left' ? 'left-0' : 'right-0'
          } ${placement === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'}`}
        >
          {kind === 'reel' && (
            <MenuItem
              icon={Link2}
              label="Copy link"
              onClick={handleCopyLink}
            />
          )}

          {kind === 'reel' && !isOwn && (
            <>
              <MenuItem
                icon={EyeOff}
                label="Hide"
                description="Remove this reel from your feed"
                onClick={handleHide}
              />
              <MenuItem
                icon={VolumeX}
                label={`Mute @${targetUsername}`}
                description="Hide their reels and posts"
                onClick={handleMuteUser}
              />
              <div role="separator" className="my-1 border-t border-ink/12" />
              <MenuItem
                icon={Ban}
                label={`Block @${targetUsername}`}
                danger
                onClick={() => {
                  setMenuOpen(false);
                  setConfirmAction('block');
                }}
              />
              <MenuItem
                icon={Flag}
                label="Report"
                danger
                onClick={() => {
                  setMenuOpen(false);
                  setReportOpen(true);
                }}
              />
            </>
          )}

          {kind === 'reel_comment' && !isOwn && (
            <>
              <MenuItem
                icon={Flag}
                label={comment?.reportedByMe ? 'Reported' : 'Report'}
                danger
                onClick={() => {
                  setMenuOpen(false);
                  if (comment?.reportedByMe) {
                    showToast('You already reported this', 'info');
                  } else {
                    setReportOpen(true);
                  }
                }}
              />
              <MenuItem
                icon={VolumeX}
                label={`Mute @${targetUsername}`}
                onClick={handleMuteUser}
              />
              <div role="separator" className="my-1 border-t border-ink/12" />
              <MenuItem
                icon={Ban}
                label={`Block @${targetUsername}`}
                danger
                onClick={() => {
                  setMenuOpen(false);
                  setConfirmAction('block');
                }}
              />
              {canModerate && onDeleteComment && (
                <MenuItem
                  icon={Trash2}
                  label="Delete"
                  danger
                  onClick={() => {
                    setMenuOpen(false);
                    setConfirmAction('delete');
                  }}
                />
              )}
            </>
          )}

          {isOwn && (
            <>
              {kind === 'reel' && <div role="separator" className="my-1 border-t border-ink/12" />}
              <MenuItem
                icon={Trash2}
                label="Delete"
                danger
                onClick={() => {
                  setMenuOpen(false);
                  setConfirmAction('delete');
                }}
              />
            </>
          )}

          <div role="separator" className="my-1 border-t border-ink/12" />
          <MenuItem
            icon={X}
            label="Cancel"
            onClick={() => setMenuOpen(false)}
          />
        </div>
      )}

      {/* Block confirmation dialog */}
      <Modal
        isOpen={confirmAction === 'block'}
        onClose={() => !busy && setConfirmAction(null)}
        title={`Block @${targetUsername}?`}
        description="They will no longer see your posts or reels, and you won't see theirs. Blocking never sends an alert."
        size="sm"
      >
        <div className="flex justify-end gap-2 pt-3">
          <Button variant="ghost" onClick={() => setConfirmAction(null)} disabled={busy}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleConfirmBlock} disabled={busy}>
            {busy ? 'Blocking...' : 'Block'}
          </Button>
        </div>
      </Modal>

      {/* Delete confirmation dialog */}
      <Modal
        isOpen={confirmAction === 'delete'}
        onClose={() => !busy && setConfirmAction(null)}
        title={kind === 'reel' ? 'Delete this reel?' : 'Delete this comment?'}
        description={
          kind === 'reel'
            ? 'This permanently removes your reel and media from Quad.'
            : 'This removes your comment. Existing replies will remain intact.'
        }
        size="sm"
      >
        <div className="flex justify-end gap-2 pt-3">
          <Button variant="ghost" onClick={() => setConfirmAction(null)} disabled={busy}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleConfirmDelete} disabled={busy}>
            {busy ? 'Deleting...' : 'Delete'}
          </Button>
        </div>
      </Modal>

      {/* Shared confidential Report modal */}
      <ReportModal
        isOpen={reportOpen}
        targetLabel={
          kind === 'reel'
            ? `@${targetUsername}'s reel`
            : `@${targetUsername}'s comment`
        }
        snippet={kind === 'reel' ? reel?.caption : comment?.content}
        onClose={() => setReportOpen(false)}
        onConfirm={handleConfirmReport}
      />
    </div>
  );
}
