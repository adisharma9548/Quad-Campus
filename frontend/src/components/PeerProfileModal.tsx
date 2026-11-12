import React, { useEffect, useState } from 'react';
import {
  Check,
  Film,
  Heart,
  Lock,
  MessageSquare,
  Play,
  ShieldCheck,
  UserPlus,
} from 'lucide-react';
import { Avatar, Badge, Button, Card, Modal, Spinner } from './ui';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { IS_REAL_BACKEND, apiRequest, resolveApiMediaUrl } from '../services/apiClient';
import { resolveReelDurationLabel } from '../utils/formatDuration';
import { ReelCard } from '../screens/ReelsScreen';
import ReelCommentsPanel from './ReelCommentsPanel';
import type { PeerProfileData, PeerUser } from '../types/quad';

const REEL_MUTE_STORAGE_KEY = 'quad_reels_muted';

interface PeerProfileModalProps {
  username: string | null;
  fallbackPeer?: PeerUser | null;
  onClose: () => void;
}

export function PeerProfileModal({
  username,
  fallbackPeer,
  onClose,
}: PeerProfileModalProps) {
  const { state, requestFollow, toggleReelLike } = useApp();
  const { showToast } = useToast();

  const [profile, setProfile] = useState<PeerProfileData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
  const [requestBusy, setRequestBusy] = useState(false);

  useEffect(() => {
    if (!username) {
      setProfile(null);
      setError(null);
      return;
    }

    if (!IS_REAL_BACKEND) {
      const peer =
        fallbackPeer ||
        (state.discoverableUsers || []).find((u) => u.username === username) ||
        (state.whoToFollow || []).find((u) => u.username === username);
      if (!peer) {
        setError('This student profile is not available.');
        setProfile(null);
        return;
      }
      const isFollowing = (state.following || []).some((f) => f.username === username) || Boolean(peer.isFollowing);
      const publicPosts = (state.publicPosts || []).filter((p) => p.username === username);
      const peerReels = (state.reels || []).filter(
        (r) =>
          r.username === username &&
          (state.username === username || (r.status || 'active') === 'active')
      );
      setProfile({
        user: {
          ...peer,
          isSelf: state.username === username,
          isFollowing,
          isRequested: Boolean(peer.isRequested),
        },
        publicPosts,
        personalPosts: [],
        reels: peerReels,
      });
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    apiRequest<PeerProfileData>(`/users/${encodeURIComponent(username)}/profile`)
      .then((res) => {
        if (!cancelled) {
          setProfile(res);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setProfile(null);
          setError(
            err instanceof Error ? err.message : 'Student profile is hidden or unavailable.'
          );
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [username, fallbackPeer, state.discoverableUsers, state.following, state.publicPosts, state.username, state.whoToFollow]);

  const handleFollowAction = async () => {
    if (!profile?.user?.username || requestBusy) return;
    setRequestBusy(true);
    try {
      const res = await requestFollow(profile.user.username);
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              user: {
                ...prev.user,
                isFollowing: res.status === 'following',
                isRequested: res.status === 'requested',
              },
            }
          : prev
      );
      showToast(
        res.status === 'following'
          ? `Now following @${profile.user.username}`
          : `Follow request sent to @${profile.user.username}`,
        'success'
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to send follow request', 'error');
    } finally {
      setRequestBusy(false);
    }
  };

  const user = profile?.user || fallbackPeer || null;
  const isFollowing = Boolean(profile?.user?.isFollowing);
  const isRequested = Boolean(profile?.user?.isRequested);
  const isSelf = Boolean(profile?.user?.isSelf);
  const canSeePersonal = Boolean(isSelf || profile?.user?.profilePublic || isFollowing);

  return (
    <Modal
      isOpen={Boolean(username)}
      onClose={onClose}
      title={user ? `@${user.username}` : 'Student Profile'}
      description="Verified campus profile • Personal email and section stay hidden"
      size="lg"
    >
      {loading ? (
        <div className="py-12 flex flex-col items-center justify-center gap-3">
          <Spinner size="md" />
          <p className="text-xs text-ink/60 font-medium">Loading campus profile...</p>
        </div>
      ) : error ? (
        <div className="py-6 space-y-4 text-center">
          <p className="text-sm font-semibold text-ink">{error}</p>
          <div className="flex justify-center">
            <Button variant="secondary" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      ) : user ? (
        <div className="space-y-4">
          {/* Header summary */}
          <Card className="p-4 bg-canvas border border-ink/12 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <Avatar initials={user.initials || 'ST'} username={user.username} size="lg" />
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base font-bold text-ink truncate">@{user.username}</h3>
                    <Badge variant="status" icon={ShieldCheck}>
                      Verified Peer
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {user.branch && (
                      <span className="text-[11px] font-semibold px-2 py-1 rounded-full bg-ink/6 text-ink border border-ink/12">
                        {user.branch}
                      </span>
                    )}
                    {user.year && (
                      <span className="text-[11px] font-semibold px-2 py-1 rounded-full bg-ink/6 text-ink border border-ink/12">
                        {user.year} Year
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {!isSelf && (
                <Button
                  variant={isFollowing || isRequested ? 'secondary' : 'primary'}
                  size="sm"
                  icon={isFollowing || isRequested ? Check : UserPlus}
                  disabled={isFollowing || isRequested || requestBusy}
                  loading={requestBusy}
                  onClick={handleFollowAction}
                >
                  {isFollowing ? 'Following' : isRequested ? 'Requested' : 'Follow'}
                </Button>
              )}
            </div>

            {user.bio && <p className="text-xs text-ink/80 leading-relaxed">{user.bio}</p>}

            {Array.isArray(user.interests) && user.interests.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {user.interests.map((tag) => (
                  <span
                    key={tag}
                    className="text-[11px] font-medium px-2 py-1 rounded-full bg-ink/6 text-ink/80 border border-ink/12"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </Card>

          {/* Personal space privacy gate */}
          <div className="p-3 rounded-[12px] bg-ink/6 border border-ink/12 flex items-start gap-3">
            <Lock size={16} className="text-ink shrink-0 mt-1" aria-hidden="true" />
            <div className="text-xs space-y-1">
              <p className="font-semibold text-ink">
                {canSeePersonal
                  ? 'Personal Space Access Active'
                  : 'Private Personal Space'}
              </p>
              <p className="text-ink/60 leading-relaxed">
                {canSeePersonal
                  ? 'You can view shared updates permitted for your circle below.'
                  : 'Personal Space posts stay private unless this student approves your follow request or sets Personal Space to Public.'}
              </p>
            </div>
          </div>

          {/* Public campus posts */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-ink/60 px-1">
              Public Campus Posts ({(profile?.publicPosts || []).length})
            </h4>
            {(profile?.publicPosts || []).length === 0 ? (
              <Card className="p-4 bg-canvas border border-ink/12 text-center">
                <p className="text-xs text-ink/60">No public campus posts shared yet.</p>
              </Card>
            ) : (
              <div className="space-y-3 max-h-[38vh] overflow-y-auto pr-1">
                {(profile?.publicPosts || []).map((post) => (
                  <Card key={post.id} className="p-4 bg-canvas border border-ink/12 space-y-2">
                    <div className="flex items-center justify-between gap-2 text-xs text-ink/60">
                      <span className="font-semibold text-ink">{post.type || 'Post'}</span>
                      <span>{post.timestamp}</span>
                    </div>
                    {post.title && (
                      <h5 className="text-sm font-bold text-ink leading-snug">{post.title}</h5>
                    )}
                    <p className="text-xs text-ink/80 leading-relaxed whitespace-pre-line">
                      {post.content}
                    </p>
                    <div className="flex items-center gap-4 pt-1 text-xs text-ink/60">
                      <span className="inline-flex items-center gap-1">
                        <Heart size={13} aria-hidden="true" />
                        {post.likes}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <MessageSquare size={13} aria-hidden="true" />
                        {post.comments}
                      </span>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Campus Reels */}
          {(profile?.reels || []).length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-ink/60 px-1 flex items-center gap-1">
                <Film size={13} aria-hidden="true" />
                <span>Reels ({(profile?.reels || []).length})</span>
              </h4>
              <div className="grid grid-cols-3 gap-3">
                {(profile?.reels || []).map((reel) => {
                  const thumbSrc = resolveApiMediaUrl(reel.coverUrl || reel.thumbnailUrl);
                  const durationLabel = resolveReelDurationLabel(reel);
                  return (
                    <button
                      key={String(reel.id)}
                      type="button"
                      onClick={() => setViewingReelId(reel.id)}
                      className="relative aspect-[9/16] rounded-[10px] overflow-hidden border border-ink/12 bg-ink/8 text-left cursor-pointer group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      aria-label={reel.caption ? `Watch reel: ${reel.caption}` : 'Watch reel'}
                    >
                      {thumbSrc ? (
                        <img
                          src={thumbSrc}
                          alt={reel.caption || 'Reel thumbnail'}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-ink/10">
                          <Film size={18} className="text-ink/40" aria-hidden="true" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-black/15 pointer-events-none" />
                      {durationLabel && (
                        <span className="absolute top-2 left-2 px-2 py-1 rounded-[5px] text-[10px] font-bold bg-black/70 text-white pointer-events-none">
                          {durationLabel}
                        </span>
                      )}
                      <div className="absolute bottom-2 left-2 right-2 flex items-center gap-1 text-[10px] font-semibold text-white pointer-events-none">
                        <Play size={11} className="fill-white text-white" aria-hidden="true" />
                        <span>{reel.views ?? '0'}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : null}

      {/* Peer Reel Viewer Modal */}
      {(() => {
        const activeReels = profile?.reels || [];
        const baseReel =
          viewingReelId !== null
            ? activeReels.find((r) => String(r.id) === String(viewingReelId)) || null
            : null;
        const globalMatch = baseReel
          ? (state.reels || []).find((r) => String(r.id) === String(baseReel.id))
          : null;
        const viewingReel = baseReel ? { ...baseReel, ...(globalMatch || {}) } : null;

        return (
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
              <div className="flex flex-col lg:flex-row items-center justify-center gap-4">
                <div className="h-[68vh] max-h-[640px] flex-1 min-w-0 flex items-center justify-center">
                  <ReelCard
                    reel={viewingReel}
                    isInView
                    isMuted={isMuted}
                    onToggleMute={handleToggleMute}
                    liked={Boolean(viewingReel.isLiked)}
                    onToggleLike={async (id) => {
                      const res = await toggleReelLike(id);
                      if (res) {
                        setProfile((prev) =>
                          prev
                            ? {
                                ...prev,
                                reels: (prev.reels || []).map((r) =>
                                  String(r.id) === String(id)
                                    ? { ...r, likes: res.likes, isLiked: res.liked }
                                    : r
                                ),
                              }
                            : prev
                        );
                      }
                    }}
                    saved={Boolean(savedReels[String(viewingReel.id)])}
                    onToggleSave={(id) => {
                      const key = String(id);
                      setSavedReels((prev) => ({ ...prev, [key]: !prev[key] }));
                    }}
                    onOpenComments={() => setReelCommentsOpen((prev) => !prev)}
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
            )}
          </Modal>
        );
      })()}
    </Modal>
  );
}
