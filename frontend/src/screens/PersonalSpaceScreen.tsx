import React, { useState } from 'react';
import {
  Lock,
  Globe,
  Edit3,
  AlertTriangle,
  ShieldCheck,
  ChevronRight,
  Eye,
  Heart,
  MessageSquare,
  Shield,
  FileText,
  Film,
  MoreHorizontal,
  Play,
  Trash2,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useInstitution } from '../context/ConfigContext';
import { useToast } from '../context/ToastContext';
import { resolveApiMediaUrl } from '../services/apiClient';
import { resolveReelDurationLabel } from '../utils/formatDuration';
import { ReelCard } from './ReelsScreen';
import ReelCommentsPanel from '../components/ReelCommentsPanel';
import type { ReelItem } from '../types/quad';
import {
  Avatar,
  Badge,
  PrivacyBadge,
  Card,
  Button,
  ShieldBanner,
  Modal,
  EmptyState,
} from '../components/ui';

const REEL_MUTE_STORAGE_KEY = 'quad_reels_muted';

export default function PersonalSpaceScreen({
  onNavigate,
  onOpenCreateReel,
  onOpenPeerProfile,
}: {
  onNavigate: (screen: string) => void;
  onOpenCreateReel?: () => void;
  onOpenPeerProfile?: (username: string, fallbackPeer?: import('../types/quad').PeerUser) => void;
}) {
  const { state, toggleProfileVisibility, togglePostLike, toggleReelLike, deleteReel } = useApp();
  const institution = useInstitution();
  const { showToast } = useToast();
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [activeGroupFilter, setActiveGroupFilter] = useState('All');
  const [activeTab, setActiveTab] = useState<'posts' | 'reels'>('posts');
  const [openReelMenuId, setOpenReelMenuId] = useState<string | null>(null);
  const [deleteConfirmReel, setDeleteConfirmReel] = useState<ReelItem | null>(null);
  const [isDeletingReel, setIsDeletingReel] = useState(false);
  const [viewingReelId, setViewingReelId] = useState<string | number | null>(null);
  const [reelCommentsOpen, setReelCommentsOpen] = useState(false);
  const [savedReels, setSavedReels] = useState<Record<string, boolean>>({});
  const [shareOffsets, setShareOffsets] = useState<Record<string, number>>({});
  const [isMuted, setIsMuted] = useState<boolean>(() => {
    try {
      const stored = sessionStorage.getItem(REEL_MUTE_STORAGE_KEY);
      return stored === null ? true : stored === '1';
    } catch {
      return true;
    }
  });

  const isPublic = state.profilePublic || false;
  const username = state.username || 'quantum_dev';
  const initials = state.userInitials || 'QD';
  const personalPosts = state.personalPosts || [];
  const followRequests = state.followRequests || [];
  const myReels = (state.reels || []).filter(
    (r) => r.username === username && r.status !== 'deleted'
  );
  const viewingReel =
    viewingReelId !== null
      ? myReels.find((r) => String(r.id) === String(viewingReelId)) || null
      : null;

  const handleToggleMute = () => {
    setIsMuted((prev) => {
      const next = !prev;
      try {
        sessionStorage.setItem(REEL_MUTE_STORAGE_KEY, next ? '1' : '0');
      } catch {
        // Ignore storage errors
      }
      return next;
    });
  };

  const handleConfirmDeleteReel = async () => {
    if (!deleteConfirmReel || isDeletingReel) return;
    const target = deleteConfirmReel;
    setIsDeletingReel(true);
    try {
      await deleteReel(target.id);
      if (viewingReelId !== null && String(viewingReelId) === String(target.id)) {
        setViewingReelId(null);
      }
      setDeleteConfirmReel(null);
      showToast('Reel deleted permanently', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to delete reel', 'error');
    } finally {
      setIsDeletingReel(false);
    }
  };
  const groupsMap = state.followerGroups || {};

  const followerGroups = [
    { name: 'All', count: state.followersCount ?? (state.followers || []).length },
    { name: 'Close Friends', count: (groupsMap['Close Friends'] || []).length },
    { name: 'My Branch', count: (groupsMap['My Branch'] || []).length },
    { name: 'My Year', count: (groupsMap['My Year'] || []).length },
    { name: 'Classmates', count: (groupsMap.Classmates || []).length },
  ];

  const handleToggle = async () => {
    if (!isPublic) {
      setShowWarningModal(true);
    } else {
      await toggleProfileVisibility(false);
      showToast('Personal Space switched back to Private Vault', 'info');
    }
  };

  const confirmPublic = async () => {
    await toggleProfileVisibility(true);
    setShowWarningModal(false);
    showToast('Personal Space set to Public Mode (verified campus only)', 'info');
  };

  const filteredPosts =
    activeGroupFilter === 'All'
      ? personalPosts
      : personalPosts.filter((p) => {
          const target = (p.groupName || p.audienceLabel || p.audience || '').toLowerCase();
          return (
            target === activeGroupFilter.toLowerCase() ||
            target === 'approved circles' ||
            target === 'approved followers'
          );
        });

  return (
    <div className="w-full space-y-6">
      {/* Profile Overview Card */}
      <Card className="p-4 sm:p-6 bg-canvas border border-ink/12 rounded-[16px] space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Avatar
              initials={initials}
              username={username}
              size="xl"
              showBadge
              badgeType={isPublic ? 'public' : 'private'}
            />
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-bold text-ink font-display truncate">
                  @{username}
                </h2>
                <PrivacyBadge
                  level={isPublic ? 'public' : 'private'}
                  labelCustom={isPublic ? 'Public Space' : 'Private Vault'}
                  size="sm"
                />
                <Badge variant="status" icon={ShieldCheck}>
                  {institution.networkLabel}
                </Badge>
              </div>
              <p className="text-xs text-ink/60">
                Verified member{state.branch ? ` • ${state.branch}` : ''}{state.year ? ` (${state.year.replace(/\s*Year$/i, '')} Year)` : ''}
              </p>
              <p className="text-xs text-ink max-w-md pt-1 leading-relaxed">
                {state.bio || 'Add a short bio in Settings.'}
              </p>
            </div>
          </div>

          <div className="flex sm:flex-col items-center sm:items-end gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon={Edit3}
              onClick={() => onNavigate('settings')}
            >
              Privacy Settings
            </Button>
            <Badge variant="status">Section: Private</Badge>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-4 py-4 border-y border-ink/12 text-center">
          <div>
            <p className="text-lg font-bold text-ink font-display">
              {personalPosts.length}
            </p>
            <p className="text-xs text-ink/60 font-medium">Vault Posts</p>
          </div>
          <div>
            <p className="text-lg font-bold text-ink font-display">
              {state.followersCount ?? 0}
            </p>
            <p className="text-xs text-ink/60 font-medium">Approved Followers</p>
          </div>
          <div>
            <p className="text-lg font-bold text-ink font-display">
              {state.followingCount ?? 0}
            </p>
            <p className="text-xs text-ink/60 font-medium">Following</p>
          </div>
        </div>

        {/* Pending Follow Requests Notice Bar */}
        {followRequests.length > 0 && (
          <button
            type="button"
            onClick={() => onNavigate('requests')}
            className="w-full p-4 rounded-[16px] bg-ink/6 border border-ink/12 flex items-center justify-between text-left hover:bg-ink/8 active:bg-ink/12 transition-colors cursor-pointer min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-[8px] bg-ink text-canvas flex items-center justify-center font-bold text-xs font-display shrink-0">
                {followRequests.length}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-ink truncate">
                  Pending Follow Requests Waiting
                </p>
                <p className="text-xs text-ink/60 truncate">
                  Review peer requests and assign them to your private visibility circles
                </p>
              </div>
            </div>
            <ChevronRight size={16} className="text-ink shrink-0" />
          </button>
        )}
      </Card>

      {/* Public vs Private Mode Switcher */}
      <Card className="p-4 sm:p-6 bg-canvas border border-ink/12 rounded-[16px]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-sm font-bold text-ink flex items-center gap-2">
              {isPublic ? <Globe size={16} className="text-ink" /> : <Lock size={16} className="text-ink" />}
              <span>{isPublic ? 'Public Profile Mode' : 'Private Profile Mode (Default)'}</span>
            </p>
            <p className="text-xs text-ink/60 leading-relaxed max-w-lg">
              {isPublic
                ? 'Any verified student on campus can view your personal space posts.'
                : 'Only students you personally approve and place into circles can see these posts.'}
            </p>
          </div>

          <Button
            variant={isPublic ? 'outline' : 'primary'}
            size="sm"
            onClick={handleToggle}
          >
            {isPublic ? 'Switch to Private Vault' : 'Make Profile Public'}
          </Button>
        </div>
      </Card>

      {/* Banner */}
      {isPublic ? (
        <ShieldBanner
          type="info"
          icon={Globe}
          message="Public Space Enabled: Any student on campus can view your personal posts. Your real name, section, and college email remain permanently protected."
        />
      ) : (
        <ShieldBanner
          type="info"
          icon={Lock}
          message="Private Vault: Content is visible only to approved followers tagged into your circles (Close Friends, Classmates, My Branch, My Year)."
        />
      )}

      {/* Section Switcher: Vault Posts | Reels */}
      <div
        role="tablist"
        aria-label="Personal space sections"
        className="flex items-center gap-2 border-b border-ink/12 pb-3"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'posts'}
          onClick={() => setActiveTab('posts')}
          className={`min-h-[40px] px-4 py-2 rounded-full text-xs font-semibold transition-all cursor-pointer border inline-flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
            activeTab === 'posts'
              ? 'bg-ink text-canvas border-ink font-bold'
              : 'bg-canvas text-ink/70 border-ink/12 hover:bg-ink/6 hover:text-ink'
          }`}
        >
          <FileText size={14} aria-hidden="true" />
          <span>Vault Posts ({personalPosts.length})</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'reels'}
          onClick={() => {
            setActiveTab('reels');
            setOpenReelMenuId(null);
          }}
          className={`min-h-[40px] px-4 py-2 rounded-full text-xs font-semibold transition-all cursor-pointer border inline-flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
            activeTab === 'reels'
              ? 'bg-ink text-canvas border-ink font-bold'
              : 'bg-canvas text-ink/70 border-ink/12 hover:bg-ink/6 hover:text-ink'
          }`}
        >
          <Film size={14} aria-hidden="true" />
          <span>Reels ({myReels.length})</span>
        </button>
      </div>

      {activeTab === 'posts' ? (
        <>
          {/* Circle Filters */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-xs font-bold uppercase tracking-wider text-ink/60">
                Audience Circle Views
              </h3>
              <span className="text-xs text-ink/60">Filtered by circle</span>
            </div>

            <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
              {followerGroups.map((g) => (
                <button
                  key={g.name}
                  type="button"
                  onClick={() => setActiveGroupFilter(g.name)}
                  className={`min-h-[44px] px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer border active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                    activeGroupFilter === g.name
                      ? 'bg-ink text-canvas border-ink font-bold'
                      : 'bg-canvas text-ink/60 border-ink/12 hover:bg-ink/8 hover:text-ink'
                  }`}
                >
                  {g.name} ({g.count})
                </button>
              ))}
            </div>
          </div>

          {/* Personal Posts Stream */}
          {filteredPosts.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="Vault Stream Empty"
              description={`No personal posts found for circle "${activeGroupFilter}". Create a post to share privately with approved peers.`}
            />
          ) : (
            <div className="space-y-4">
              {filteredPosts.map((post) => (
                <Card
                  key={post.id}
                  className="p-4 sm:p-6 bg-canvas border border-ink/12 rounded-[16px] space-y-4 hover:border-ink/24 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <PrivacyBadge
                      level="group"
                      labelCustom={`Visible to: ${post.groupName || post.audienceLabel || post.audience}`}
                      size="sm"
                    />
                    <span className="text-xs text-ink/60">{post.timestamp}</span>
                  </div>
                  <p className="text-sm text-ink leading-relaxed font-normal break-words">
                    {post.content}
                  </p>
                  {post.hasImage && post.mediaUrl && (
                    <div className="aspect-video w-full rounded-[8px] overflow-hidden border border-ink/12 bg-ink/6">
                      <img
                        src={resolveApiMediaUrl(post.mediaUrl)}
                        alt={post.imageAlt || post.location || 'Private circle attachment'}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <div className="flex items-center gap-4 pt-3 border-t border-ink/12 text-xs text-ink/60">
                    <button
                      type="button"
                      onClick={() => togglePostLike(post.id)}
                      className="min-h-[44px] inline-flex items-center gap-2 font-medium text-ink hover:text-accent cursor-pointer"
                    >
                      <Heart
                        size={16}
                        className={post.isLiked ? 'fill-ink text-ink' : 'text-ink'}
                      />{' '}
                      {post.likes || 0}
                    </button>
                    <span className="flex items-center gap-2 font-medium">
                      <MessageSquare size={16} /> {post.comments || 0}
                    </span>
                    <span className="ml-auto text-xs text-ink font-semibold flex items-center gap-2">
                      <Shield size={16} className="text-accent" />
                      <span>Circle Protected</span>
                    </span>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="space-y-4">
          {myReels.length === 0 ? (
            <EmptyState
              icon={Film}
              title="You haven't posted any reels yet"
              description="Share short campus project demos, lab walkthroughs, or event highlights with verified peers."
              action={
                <Button
                  variant="primary"
                  size="sm"
                  icon={Film}
                  onClick={() => {
                    if (onOpenCreateReel) {
                      onOpenCreateReel();
                    } else {
                      onNavigate('reels');
                    }
                  }}
                >
                  Upload Reel
                </Button>
              }
            />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {myReels.map((reel) => {
                const idStr = String(reel.id);
                const thumbSrc = resolveApiMediaUrl(reel.coverUrl || reel.thumbnailUrl);
                const durationLabel = resolveReelDurationLabel(reel);
                const isMenuOpen = openReelMenuId === idStr;
                const statusBadge =
                  reel.status === 'processing'
                    ? 'Processing'
                    : reel.status === 'failed'
                    ? 'Failed'
                    : durationLabel;

                return (
                  <div
                    key={idStr}
                    className="relative aspect-[9/16] rounded-[12px] overflow-hidden border border-ink/12 bg-ink/8 group"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setOpenReelMenuId(null);
                        setViewingReelId(reel.id);
                      }}
                      className="w-full h-full block text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      aria-label={reel.caption ? `Open reel: ${reel.caption}` : 'Open reel'}
                    >
                      {thumbSrc ? (
                        <img
                          src={thumbSrc}
                          alt={reel.caption || 'Reel thumbnail'}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-ink/10">
                          <Film size={24} className="text-ink/40" aria-hidden="true" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-black/20 pointer-events-none" />
                      {statusBadge && (
                        <span
                          className={`absolute top-2 left-2 px-2 py-1 rounded-[6px] text-[10px] font-bold tracking-wide pointer-events-none ${
                            reel.status === 'failed'
                              ? 'bg-danger text-canvas'
                              : 'bg-black/70 text-white'
                          }`}
                        >
                          {statusBadge}
                        </span>
                      )}
                      <div className="absolute bottom-2 left-2 right-2 space-y-1 pointer-events-none">
                        <div className="flex items-center gap-1 text-[11px] font-semibold text-white">
                          <Play size={12} className="fill-white text-white" aria-hidden="true" />
                          <span>{reel.views ?? '0'}</span>
                        </div>
                        {reel.caption && (
                          <p className="text-[11px] text-white/90 line-clamp-2 leading-snug">
                            {reel.caption}
                          </p>
                        )}
                      </div>
                    </button>

                    {/* Top-right Actions Menu */}
                    <div className="absolute top-2 right-2 z-10">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenReelMenuId((prev) => (prev === idStr ? null : idStr));
                        }}
                        aria-label="Reel options"
                        aria-expanded={isMenuOpen}
                        className="w-8 h-8 rounded-full bg-black/65 text-white hover:bg-black/85 flex items-center justify-center cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      >
                        <MoreHorizontal size={16} aria-hidden="true" />
                      </button>
                      {isMenuOpen && (
                        <div
                          className="absolute right-0 mt-1 w-32 rounded-[10px] bg-canvas border border-ink/12 shadow-lg py-1 z-20"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setOpenReelMenuId(null);
                              setDeleteConfirmReel(reel);
                            }}
                            className="w-full px-3 py-2 text-left text-xs font-semibold text-danger hover:bg-ink/6 flex items-center gap-2 cursor-pointer"
                          >
                            <Trash2 size={14} aria-hidden="true" />
                            <span>Delete</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Reel Viewer Modal */}
      <Modal
        isOpen={Boolean(viewingReel)}
        onClose={() => {
          setReelCommentsOpen(false);
          setViewingReelId(null);
        }}
        title={viewingReel ? `@${viewingReel.username}'s Reel` : 'Reel'}
        size={reelCommentsOpen ? 'xl' : 'lg'}
      >
        {viewingReel && (
          <div className="space-y-3">
            <div className="flex flex-col lg:flex-row items-center justify-center gap-4">
              <div className="h-[68vh] max-h-[640px] flex-1 min-w-0 flex items-center justify-center">
                <ReelCard
                  reel={viewingReel}
                  isInView
                  isMuted={isMuted}
                  onToggleMute={handleToggleMute}
                  liked={Boolean(viewingReel.isLiked)}
                  onToggleLike={async (id) => {
                    await toggleReelLike(id);
                  }}
                  saved={Boolean(savedReels[String(viewingReel.id)])}
                  onToggleSave={(id) => {
                    const key = String(id);
                    setSavedReels((prev) => ({ ...prev, [key]: !prev[key] }));
                  }}
                  onOpenComments={() => setReelCommentsOpen((prev) => !prev)}
                  onOpenProfile={onOpenPeerProfile}
                  onShare={(reel) => {
                    const shareUrl = `${window.location.origin}/?screen=reels&reel=${encodeURIComponent(
                      String(reel.id)
                    )}`;
                    if (navigator.clipboard?.writeText) {
                      navigator.clipboard.writeText(shareUrl).catch(() => {});
                    }
                    setShareOffsets((prev) => ({
                      ...prev,
                      [String(reel.id)]: (prev[String(reel.id)] || 0) + 1,
                    }));
                    showToast(`Copied link to @${reel.username}'s reel`, 'success');
                  }}
                  shareCountOffset={shareOffsets[String(viewingReel.id)] || 0}
                  layoutContext="modal"
                  isCommentsOpen={reelCommentsOpen}
                />
              </div>
              <ReelCommentsPanel
                reel={viewingReel}
                isOpen={reelCommentsOpen}
                onClose={() => setReelCommentsOpen(false)}
                mode="embedded"
              />
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-ink/12">
              <span className="text-xs text-ink/60">
                {resolveReelDurationLabel(viewingReel)
                  ? `Duration: ${resolveReelDurationLabel(viewingReel)}`
                  : viewingReel.status === 'processing'
                  ? 'Processing video...'
                  : 'Campus Reel'}
              </span>
              <Button
                variant="destructive"
                size="sm"
                icon={Trash2}
                onClick={() => setDeleteConfirmReel(viewingReel)}
              >
                Delete Reel
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Reel Confirmation Modal */}
      <Modal
        isOpen={Boolean(deleteConfirmReel)}
        onClose={() => {
          if (!isDeletingReel) setDeleteConfirmReel(null);
        }}
        title="Delete Reel"
        description="Delete this reel? This can't be undone."
      >
        <div className="space-y-4">
          {deleteConfirmReel?.caption && (
            <div className="p-3 rounded-[10px] bg-ink/4 border border-ink/12">
              <p className="text-xs text-ink/80 line-clamp-2">{deleteConfirmReel.caption}</p>
            </div>
          )}
          <div className="flex gap-3 justify-end">
            <Button
              variant="secondary"
              disabled={isDeletingReel}
              onClick={() => setDeleteConfirmReel(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              loading={isDeletingReel}
              onClick={handleConfirmDeleteReel}
            >
              Delete
            </Button>
          </div>
        </div>
      </Modal>

      {/* Standard Foundation Modal for Confirmation */}
      <Modal
        isOpen={showWarningModal}
        onClose={() => setShowWarningModal(false)}
        title="Make Personal Space Public?"
        description="Review privacy impacts before switching profile visibility:"
        size="md"
      >
        <div className="space-y-4 pt-1">
          <div className="w-12 h-12 rounded-[16px] bg-ink/6 text-ink flex items-center justify-center mx-auto border border-ink/12">
            <AlertTriangle size={24} className="text-accent" />
          </div>

          <div className="space-y-3 text-xs">
            <div className="p-4 rounded-[16px] bg-ink/6 border border-ink/12 text-ink flex items-start gap-3">
              <Eye size={16} className="shrink-0 mt-1 text-accent" />
              <span className="leading-relaxed">
                <strong>What becomes visible:</strong> Any verified student on campus can view your personal posts and follow you without requiring follow-request approval.
              </span>
            </div>
            <div className="p-4 rounded-[16px] bg-ink/6 border border-ink/12 text-ink flex items-start gap-3">
              <ShieldCheck size={16} className="shrink-0 mt-1 text-accent" />
              <span className="leading-relaxed">
                <strong>What remains protected:</strong> Your real name, section, roll number, and college email are NEVER revealed under any circumstances.
              </span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              variant="secondary"
              size="md"
              onClick={() => setShowWarningModal(false)}
            >
              Keep Private
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={confirmPublic}
            >
              Confirm Public
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
