import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  VolumeX,
  UserX,
  Flag,
  EyeOff,
  Bookmark,
  Link2,
  Lock,
  Globe,
  Check,
  X,
  Send,
  AlertCircle,
  WifiOff,
  RefreshCw,
  Search,
  Pencil,
  Trash2,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { IS_REAL_BACKEND } from '../services/apiClient';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  Avatar,
  Button,
  Card,
  Modal,
  EmptyState,
  MenuItem,
  TextField,
} from '../components/ui';
import { PostCard, PostCardSkeleton } from '../components/PostCard';
import { ReelStrip } from '../components/ReelStrip';
import { ThisWeekCard } from '../components/ThisWeekCard';
import ReportModal from '../components/ReportModal';
import { buildShareUrl, shareContent } from '../utils/shareUrl';

const PRIVACY_BANNER_STORAGE_KEY = 'quad_feed_privacy_banner_dismissed';

export interface PublicFeedScreenProps {
  onNavigate: (screen: string) => void;
  onViewWeekItem?: (item: import('../types/quad').ThisWeekEvent) => void;
  isLoading?: boolean;
  hasError?: boolean;
  onRetry?: () => void;
  targetPostId?: string | number | null;
  initialTab?: string | null;
}

export default function PublicFeedScreen({
  onNavigate,
  onViewWeekItem,
  isLoading: propLoading = false,
  hasError = false,
  onRetry,
  targetPostId,
  initialTab,
}: PublicFeedScreenProps) {
  const {
    state,
    togglePostLike,
    togglePostSave,
    hidePost,
    muteAuthor,
    blockAuthor,
    submitReport,
    markBestAnswer,
    addPostAnswer,
    deletePost,
    editPost,
    refreshFeed,
  } = useApp();
  const { user } = useAuth();
  const { showToast } = useToast();

  const [sheetPost, setSheetPost] = useState<import('../types/quad').PostItem | null>(null);
  const [confirmBlockPost, setConfirmBlockPost] = useState<import('../types/quad').PostItem | null>(null);
  const [confirmReportPost, setConfirmReportPost] = useState<import('../types/quad').PostItem | null>(null);
  const [commentPostId, setCommentPostId] = useState<string | number | null>(null);
  const [commentInput, setCommentInput] = useState('');
  const [feedFilter, setFeedFilter] = useState<'all' | 'branch' | 'year'>(() => {
    if (initialTab === 'department' || initialTab === 'branch') return 'branch';
    if (initialTab === 'batch' || initialTab === 'year') return 'year';
    return 'all';
  });

  useEffect(() => {
    if (!targetPostId) return;
    const scrollTimer = setTimeout(() => {
      const el = document.getElementById(`post-${targetPostId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('ring-2', 'ring-accent');
        setTimeout(() => {
          el.classList.remove('ring-2', 'ring-accent');
        }, 2500);
      }
    }, 200);
    return () => clearTimeout(scrollTimer);
  }, [targetPostId, state.publicPosts]);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [actionDone, setActionDone] = useState<string | null>(null);
  const [localSavedIds, setLocalSavedIds] = useState<Set<string | number>>(() => new Set());
  const [hiddenPostIds, setHiddenPostIds] = useState<Set<string | number>>(() => new Set());
  const [errorCleared, setErrorCleared] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [editTarget, setEditTarget] = useState<import('../types/quad').PostItem | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editBusy, setEditBusy] = useState(false);
  const [confirmDeletePost, setConfirmDeletePost] = useState<import('../types/quad').PostItem | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const firstFetchSkipped = useRef(false);
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  const isLoading = propLoading || (state.isHydrating && (state.publicPosts || []).length === 0);
  const savedPostIds = useMemo(() => {
    if (Array.isArray(state.savedPostIds)) {
      return new Set([...state.savedPostIds, ...localSavedIds]);
    }
    return localSavedIds;
  }, [state.savedPostIds, localSavedIds]);

  const [bannerDismissed, setBannerDismissed] = useState(() => {
    try {
      return localStorage.getItem(PRIVACY_BANNER_STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  });

  const isError = hasError && !errorCleared;

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  const currentUsername = user?.username || state.username || '';
  const currentInitials = user?.avatarInitials || state.userInitials || '?';
  const userBranch = user?.branch || state.branch || '';
  const userYear = (user?.year || state.year || '').replace(/\s*Year/i, '').trim();

  // Picks up a search handed over from elsewhere (for example a trending tag in the side rail).
  useEffect(() => {
    const consume = () => {
      try {
        const pending = sessionStorage.getItem('quad_pending_search');
        if (pending) {
          sessionStorage.removeItem('quad_pending_search');
          setSearchInput(pending);
          setSearchQuery(pending);
        }
      } catch {
        // ignore storage errors
      }
    };
    consume();
    window.addEventListener('quad:pending-search', consume);
    return () => window.removeEventListener('quad:pending-search', consume);
  }, []);

  // Debounce the search box so we do not hit the API on every keystroke.
  useEffect(() => {
    const handle = window.setTimeout(() => setSearchQuery(searchInput.trim()), 300);
    return () => window.clearTimeout(handle);
  }, [searchInput]);

  // With a real backend, scope (branch/year) and search are applied on the server, which can see
  // every author's real branch and year. Client-side filtering below is only used in mock mode.
  useEffect(() => {
    if (!IS_REAL_BACKEND) return undefined;
    if (!firstFetchSkipped.current) {
      firstFetchSkipped.current = true;
      return undefined;
    }
    let cancelled = false;
    setIsSearching(true);
    refreshFeed({ scope: feedFilter, q: searchQuery || activeTag || undefined })
      .catch(() => {
        if (!cancelled) showToast('Could not load posts. Check your connection.', 'error');
      })
      .finally(() => {
        if (!cancelled) setIsSearching(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feedFilter, searchQuery, activeTag]);

  const posts = useMemo(() => state.publicPosts || [], [state.publicPosts]);
  const reels = useMemo(() => state.reels || [], [state.reels]);
  const thisWeekEvents = state.thisWeekEvents || [];

  const unseenReelAuthors = useMemo(() => {
    const authors = new Set();
    reels.forEach((r) => {
      if (r.unseen && r.username) authors.add(r.username);
    });
    return authors;
  }, [reels]);

  const commentPost = useMemo(
    () => posts.find((p) => p.id === commentPostId) || null,
    [posts, commentPostId]
  );

  const visiblePosts = useMemo(
    () => posts.filter((p) => !hiddenPostIds.has(p.id)),
    [posts, hiddenPostIds]
  );

  const filteredPosts = useMemo(() => {
    return visiblePosts.filter((post) => {
      if (!IS_REAL_BACKEND && feedFilter === 'branch') {
        const postBranch = (post.branch || '').toLowerCase();
        if (post.audience !== 'branch' && postBranch !== userBranch.toLowerCase()) {
          return false;
        }
      }
      if (!IS_REAL_BACKEND && feedFilter === 'year') {
        const postYear = (post.year || '').replace(/\s*Year/i, '').trim().toLowerCase();
        if (post.audience !== 'year' && postYear !== userYear.toLowerCase()) {
          return false;
        }
      }
      if (activeTag && !IS_REAL_BACKEND) {
        const tags = Array.isArray(post.hashtags) ? post.hashtags : [];
        if (!tags.some((t) => t.toLowerCase() === activeTag.toLowerCase())) {
          return false;
        }
      }
      return true;
    });
  }, [visiblePosts, feedFilter, activeTag, userBranch, userYear]);

  const handleDismissBanner = () => {
    setBannerDismissed(true);
    try {
      localStorage.setItem(PRIVACY_BANNER_STORAGE_KEY, '1');
    } catch {
      // ignore storage errors
    }
  };

  const toggleSavePost = async (post: import('../types/quad').PostItem | null) => {
    if (!post) return;
    try {
      const res = await togglePostSave(post.id);
      const willSave = res ? res.saved : !savedPostIds.has(post.id);
      setLocalSavedIds((prev) => {
        const next = new Set(prev);
        if (willSave) next.add(post.id);
        else next.delete(post.id);
        return next;
      });
      showToast(willSave ? 'Saved to your bookmarks' : 'Removed from bookmarks', willSave ? 'success' : 'info');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to update bookmark', 'error');
    }
  };

  const handleCopyLink = (post: import('../types/quad').PostItem | null) => {
    if (!post) return;
    const url = buildShareUrl({ type: 'post', id: post.id });
    const headline = post.title || '';
    const text = headline
      ? `${headline}\n\nPosted by @${post.username} on Quad`
      : `Post by @${post.username} on Quad`;

    shareContent({
      title: headline || `Post by @${post.username}`,
      text,
      url,
      onToast: (msg, variant) => showToast(msg, variant || 'success'),
    });
  };

  const handleHidePost = async (post: import('../types/quad').PostItem | null) => {
    if (!post) return;
    setHiddenPostIds((prev) => new Set(prev).add(post.id));
    setSheetPost(null);
    await hidePost(post.id);
    showToast('Post hidden from your feed', 'info');
  };

  const openEdit = (post: import('../types/quad').PostItem | null) => {
    if (!post) return;
    setEditTarget(post);
    setEditTitle(post.title || '');
    setEditContent(post.content || '');
    setSheetPost(null);
  };

  const handleSaveEdit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editTarget || editBusy) return;
    if (!editContent.trim()) {
      showToast('A post cannot be empty.', 'error');
      return;
    }
    setEditBusy(true);
    try {
      await editPost(editTarget.id, { title: editTitle.trim(), content: editContent.trim() });
      showToast('Post updated', 'success');
      setEditTarget(null);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to save changes', 'error');
    } finally {
      setEditBusy(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!confirmDeletePost || deleteBusy) return;
    setDeleteBusy(true);
    try {
      await deletePost(confirmDeletePost.id);
      showToast('Post deleted', 'success');
      setConfirmDeletePost(null);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to delete post', 'error');
    } finally {
      setDeleteBusy(false);
    }
  };

  const handleMuteUser = async (post: import('../types/quad').PostItem | null) => {
    if (!post) return;
    const targetUsername = post.username;
    await muteAuthor(targetUsername);
    setActionDone(`Muted @${targetUsername}`);
    setTimeout(() => {
      setActionDone(null);
      setSheetPost(null);
    }, 1000);
  };

  const handleExecuteBlock = async () => {
    if (!confirmBlockPost) return;
    const targetUsername = confirmBlockPost.username;
    setConfirmBlockPost(null);
    await blockAuthor(targetUsername, 'Blocked from campus feed');
    setActionDone(`Blocked @${targetUsername}`);
    setTimeout(() => {
      setActionDone(null);
      setSheetPost(null);
    }, 1000);
  };

  const handleExecuteReport = async (reason: string, details: string) => {
    if (!confirmReportPost) return;
    try {
      await submitReport({
        targetType: 'post',
        targetId: String(confirmReportPost.id),
        reason,
        details,
        contentSnippet: (confirmReportPost.content || '').slice(0, 180),
      });
      setConfirmReportPost(null);
      setSheetPost(null);
      showToast('Confidential report submitted to campus moderation', 'info');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to submit report';
      setConfirmReportPost(null);
      setSheetPost(null);
      showToast(msg, 'info');
    }
  };

  const handleCommentSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!commentInput.trim() || !commentPost) return;
    try {
      await addPostAnswer(commentPost.id, {
        id: `a-${Date.now()}`,
        username: currentUsername,
        initials: currentInitials,
        text: commentInput.trim(),
        timestamp: 'Just now',
      });
      showToast(
        commentPost.type === 'Question'
          ? 'Answer posted to question'
          : `Replied to @${commentPost.username}`,
        'success'
      );
      setCommentInput('');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to post reply', 'error');
    }
  };

  return (
    <div className="w-full space-y-4">
      {/* Offline banner when device connection drops */}
      {!isOnline && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center justify-between gap-3 rounded-[12px] p-3 bg-ink/6 border border-ink/12 text-xs text-ink"
        >
          <div className="flex items-center gap-2 min-w-0">
            <WifiOff size={16} className="text-ink shrink-0" aria-hidden="true" />
            <span className="font-medium">
              You appear to be offline. Showing cached campus posts.
            </span>
          </div>
          <Button
            variant="secondary"
            size="sm"
            icon={RefreshCw}
            onClick={() => {
              setIsOnline(typeof navigator !== 'undefined' ? navigator.onLine : true);
              onRetry?.();
            }}
          >
            Retry
          </Button>
        </div>
      )}

      {/* Compact "This week" summary above feed when right rail is hidden (1024-1099px) */}
      <div className="quad-compact-week">
        <ThisWeekCard
          compact
          items={thisWeekEvents}
          onViewItem={onViewWeekItem}
        />
      </div>

      {/* 1. Campus Reels Strip */}
      <ReelStrip
        reels={reels}
        isLoading={isLoading}
        onSelectReel={() => onNavigate?.('reels')}
        onSeeAll={() => onNavigate?.('reels')}
      />

      {/* Search posts, people's usernames, and #tags */}
      <div role="search" className="relative">
        <label htmlFor="feed-search" className="sr-only">
          Search posts, usernames, and tags
        </label>
        <Search
          size={16}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-ink/60 pointer-events-none"
          aria-hidden="true"
        />
        <input
          id="feed-search"
          type="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search posts, usernames, #tags"
          autoComplete="off"
          maxLength={80}
          className="w-full min-h-[44px] pl-12 pr-12 rounded-full bg-ink/6 border border-ink/12 text-sm text-ink placeholder:text-ink/60 focus:outline-none focus:ring-2 focus:ring-accent focus:bg-canvas"
        />
        {searchInput && (
          <button
            type="button"
            onClick={() => {
              setSearchInput('');
              setSearchQuery('');
            }}
            aria-label="Clear search"
            className="absolute right-1 top-1/2 -translate-y-1/2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full text-ink/60 hover:text-ink cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <X size={16} aria-hidden="true" />
          </button>
        )}
        <p className="sr-only" role="status" aria-live="polite">
          {isSearching ? 'Searching' : searchQuery ? `${filteredPosts.length} results` : ''}
        </p>
      </div>

      {/* 2. Filter Pills: All campus (ink-filled), My branch, My year (outlined) */}
      <div className="flex items-center justify-between gap-2 pb-3 border-b border-ink/12 flex-wrap">
        <div
          role="group"
          aria-label="Feed filters"
          className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1"
        >
          {([
            { id: 'all', label: 'All campus' },
            { id: 'branch', label: 'My branch' },
            { id: 'year', label: 'My year' },
          ] as const).map((tab) => {
            const active = feedFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFeedFilter(tab.id)}
                aria-pressed={active}
                className={`min-h-[44px] px-4 py-2 rounded-full text-xs font-semibold inline-flex items-center transition-colors duration-150 cursor-pointer border shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                  active
                    ? 'bg-ink text-canvas border-ink'
                    : 'bg-canvas text-ink border-ink/12 hover:bg-ink/8'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {activeTag && (
          <button
            type="button"
            onClick={() => setActiveTag(null)}
            aria-label={`Clear ${activeTag} filter`}
            className="min-h-[44px] px-3 py-2 rounded-full bg-ink/6 border border-ink/12 text-xs font-semibold text-accent inline-flex items-center gap-1 hover:bg-ink/8 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <span>{activeTag}</span>
            <X size={16} className="text-ink" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* 3. Post Cards Stream (12px gap) + Loading / Error / Empty states */}
      {isLoading ? (
        <div aria-label="Loading campus posts" className="space-y-3">
          {[1, 2, 3].map((idx) => (
            <PostCardSkeleton key={idx} />
          ))}
        </div>
      ) : isError ? (
        <Card padding={false} className="p-6 bg-canvas border border-ink/12 rounded-[12px]">
          <EmptyState
            icon={AlertCircle}
            title="Could not load posts"
            description="There was a temporary problem reaching your campus feed."
            action={
              <Button
                variant="secondary"
                size="md"
                icon={RefreshCw}
                onClick={() => {
                  setErrorCleared(true);
                  onRetry?.();
                }}
              >
                Retry
              </Button>
            }
          />
        </Card>
      ) : filteredPosts.length === 0 ? (
        <Card padding={false} className="p-4 bg-canvas border border-ink/12 rounded-[12px]">
          <EmptyState
            icon={Globe}
            title={
              visiblePosts.length === 0
                ? 'Your feed is quiet'
                : 'No matching posts'
            }
            description={
              activeTag
                ? `No posts found with ${activeTag}. Follow a few people or switch to All campus to see posts.`
                : 'Follow a few people or switch to All campus to see posts.'
            }
            action={
              <Button
                variant="secondary"
                size="md"
                onClick={() => {
                  setFeedFilter('all');
                  setActiveTag(null);
                  onNavigate?.('discover');
                }}
              >
                {feedFilter === 'all' && !activeTag ? 'Find peers' : 'All campus'}
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredPosts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              hasUnseenReel={unseenReelAuthors.has(post.username)}
              isSaved={savedPostIds.has(post.id)}
              onToggleSave={toggleSavePost}
              onToggleLike={(p) => togglePostLike(p.id)}
              onMore={setSheetPost}
              onHashtagClick={(tag) => setActiveTag((prev) => (prev === tag ? null : tag))}
              onCommentClick={(p) => setCommentPostId(p.id)}
              onShareClick={handleCopyLink}
            />
          ))}
        </div>
      )}

      {/* 4. Dismissible one-time privacy banner (persisted in localStorage) */}
      {!bannerDismissed && (
        <div
          role="region"
          aria-label="Pseudonymous feed privacy notice"
          className="flex items-start justify-between gap-3 rounded-[12px] p-3 bg-ink/6 border border-ink/12 text-xs text-ink leading-relaxed"
        >
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <Lock size={16} className="text-ink shrink-0 mt-1" aria-hidden="true" />
            <p className="font-medium">
              Posts show only your username. Real names, sections, roll numbers, and college emails are never shared on the feed.
            </p>
          </div>
          <button
            type="button"
            onClick={handleDismissBanner}
            aria-label="Dismiss privacy notice"
            className="min-h-[44px] min-w-[44px] -my-1 -mr-1 rounded-[8px] flex items-center justify-center text-ink/60 hover:text-ink hover:bg-ink/8 transition-colors cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* 5. Post ⋯ Menu Modal (Save, Copy link, Hide, Mute user, Block, Report) */}
      <Modal
        isOpen={Boolean(sheetPost)}
        onClose={() => {
          setSheetPost(null);
          setConfirmBlockPost(null);
          setConfirmReportPost(null);
          setActionDone(null);
        }}
        title={confirmBlockPost ? `Block @${confirmBlockPost.username}?` : 'Post options'}
        description={
          confirmBlockPost
            ? 'Blocked accounts cannot view your profile, find you in search, or interact with you.'
            : sheetPost
              ? `Actions for @${sheetPost.username}'s post`
              : ''
        }
        size="md"
      >
        {actionDone ? (
          <div className="py-6 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-ink/8 text-ink flex items-center justify-center mx-auto">
              <Check size={20} strokeWidth={2.5} />
            </div>
            <p className="text-sm font-semibold text-ink">{actionDone}</p>
            <p className="text-xs text-ink/60">
              Completed silently without notifying the other student.
            </p>
          </div>
        ) : confirmBlockPost ? (
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-end gap-3">
              <Button
                variant="secondary"
                size="md"
                onClick={() => setConfirmBlockPost(null)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="md"
                icon={UserX}
                onClick={handleExecuteBlock}
              >
                Confirm Block
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3 pt-1">
            <div className="divide-y divide-ink/12">
              <MenuItem
                icon={Bookmark}
                label={savedPostIds.has(sheetPost?.id ?? '') ? 'Remove from saved' : 'Save'}
                onClick={() => {
                  toggleSavePost(sheetPost);
                  setSheetPost(null);
                }}
              />
              <MenuItem
                icon={Link2}
                label="Copy link"
                onClick={() => {
                  handleCopyLink(sheetPost);
                  setSheetPost(null);
                }}
              />
              <MenuItem
                icon={EyeOff}
                label="Hide"
                description="Hide this post from your feed"
                onClick={() => handleHidePost(sheetPost)}
              />
              {sheetPost && currentUsername && sheetPost.username === currentUsername ? (
                <>
                  <MenuItem
                    icon={Pencil}
                    label="Edit post"
                    description="Fix a typo or update the details"
                    onClick={() => openEdit(sheetPost)}
                  />
                  <MenuItem
                    icon={Trash2}
                    label="Delete post"
                    description="Remove this post for everyone"
                    onClick={() => {
                      setConfirmDeletePost(sheetPost);
                      setSheetPost(null);
                    }}
                    danger
                  />
                </>
              ) : (
                <>
                  <MenuItem
                    icon={VolumeX}
                    label="Mute user"
                    description="Stop seeing posts from this user silently"
                    onClick={() => handleMuteUser(sheetPost)}
                  />
                  <MenuItem
                    icon={UserX}
                    label="Block"
                    description="Prevent them from viewing or interacting with you"
                    onClick={() => setConfirmBlockPost(sheetPost)}
                    danger
                  />
                  <MenuItem
                    icon={Flag}
                    label="Report"
                    description="Report harassment, impersonation, or safety concerns"
                    onClick={() => {
                      const target = sheetPost;
                      setSheetPost(null);
                      setConfirmReportPost(target);
                    }}
                    danger
                  />
                </>
              )}
            </div>

            <div className="pt-2">
              <Button
                variant="secondary"
                size="md"
                fullWidth
                onClick={() => setSheetPost(null)}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <ReportModal
        isOpen={Boolean(confirmReportPost)}
        targetLabel={
          confirmReportPost ? `Post by @${confirmReportPost.username}` : undefined
        }
        snippet={confirmReportPost?.content}
        onClose={() => setConfirmReportPost(null)}
        onConfirm={handleExecuteReport}
      />

      {/* Edit own post */}
      <Modal
        isOpen={Boolean(editTarget)}
        onClose={() => setEditTarget(null)}
        title="Edit post"
        description="Changes are visible to everyone who can see this post. It will be marked as edited."
        size="md"
      >
        <form onSubmit={handleSaveEdit} className="space-y-4 pt-2">
          <TextField
            label="Title"
            name="edit-title"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            maxLength={140}
          />
          <TextField
            label="Post"
            name="edit-content"
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            multiline
            rows={6}
            maxLength={2000}
            required
            helper={`${editContent.length}/2000`}
          />
          <div className="flex items-center justify-end gap-3">
            <Button variant="secondary" size="md" onClick={() => setEditTarget(null)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="md" loading={editBusy}>
              Save changes
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete own post */}
      <Modal
        isOpen={Boolean(confirmDeletePost)}
        onClose={() => setConfirmDeletePost(null)}
        title="Delete this post?"
        description="This removes the post for everyone. It cannot be undone."
        size="md"
      >
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button variant="secondary" size="md" onClick={() => setConfirmDeletePost(null)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            size="md"
            icon={Trash2}
            loading={deleteBusy}
            onClick={handleConfirmDelete}
          >
            Delete post
          </Button>
        </div>
      </Modal>

      {/* 6. Post Replies / Question Answers Sheet Modal */}
      <Modal
        variant="sheet"
        isOpen={Boolean(commentPost)}
        onClose={() => {
          setCommentPostId(null);
          setCommentInput('');
        }}
        title={
          commentPost
            ? commentPost.type === 'Question'
              ? `Answers (${(commentPost.answers || []).length})`
              : `Comments (${(commentPost.answers || []).length || commentPost.comments || 0})`
            : 'Replies'
        }
        description={
          commentPost ? `Campus conversation on @${commentPost.username}'s post` : ''
        }
        size="md"
      >
        {commentPost && (
          <div className="space-y-4">
            <div className="space-y-2 max-h-72 overflow-y-auto scrollbar-hover pr-1">
              {(commentPost.answers || []).length === 0 ? (
                <p className="text-xs text-ink/60 py-4 text-center">
                  No replies yet. Start a helpful campus discussion below.
                </p>
              ) : (
                (commentPost.answers || []).map((ans) => {
                  const isBest = commentPost.bestAnswerId === ans.id;
                  const canMarkBest =
                    commentPost.type === 'Question' &&
                    commentPost.username === currentUsername;

                  return (
                    <div
                      key={ans.id}
                      className={`p-3 rounded-[8px] border space-y-2 ${
                        isBest
                          ? 'bg-ink/6 border-ink'
                          : 'bg-ink/6 border-ink/12'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <Avatar
                            initials={ans.initials || 'ST'}
                            username={ans.username}
                            size="sm"
                          />
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-ink truncate">
                              @{ans.username}
                            </p>
                            <p className="text-[11px] text-ink/60">{ans.timestamp}</p>
                          </div>
                        </div>

                        {isBest && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-ink text-canvas font-sans text-[11px] font-semibold shrink-0">
                            <Check size={12} strokeWidth={2.5} aria-hidden="true" />
                            <span>Best answer</span>
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-ink leading-relaxed">{ans.text}</p>

                      {canMarkBest && (
                        <div className="pt-1">
                          <button
                            type="button"
                            onClick={() => markBestAnswer(commentPost.id, ans.id)}
                            className="min-h-[44px] px-3 py-1 rounded-[8px] bg-canvas border border-ink/12 hover:bg-ink/8 text-xs font-semibold text-ink inline-flex items-center gap-1 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                          >
                            <Check size={14} aria-hidden="true" />
                            <span>{isBest ? 'Unmark best answer' : 'Mark best answer'}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <form
              onSubmit={handleCommentSubmit}
              className="flex items-center gap-2 pt-2 border-t border-ink/12"
            >
              <input
                type="text"
                placeholder={
                  commentPost.type === 'Question'
                    ? 'Write an answer...'
                    : 'Write a campus reply...'
                }
                value={commentInput}
                onChange={(e) => setCommentInput(e.target.value)}
                className="flex-1 min-h-[44px] px-3 py-2 text-xs rounded-[8px] border border-ink/12 bg-canvas text-ink placeholder:text-ink/60 focus:outline-none focus:ring-2 focus:ring-accent"
              />
              <Button
                type="submit"
                variant="primary"
                size="md"
                icon={Send}
                disabled={!commentInput.trim()}
              >
                {commentPost.type === 'Question' ? 'Answer' : 'Reply'}
              </Button>
            </form>
          </div>
        )}
      </Modal>
    </div>
  );
}
