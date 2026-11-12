import React, { useEffect, useState } from 'react';
import { Check, Heart, Lock, MessageSquare, ShieldCheck, UserPlus } from 'lucide-react';
import { Avatar, Badge, Button, Card, Modal, Spinner } from './ui';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { IS_REAL_BACKEND, apiRequest } from '../services/apiClient';
import type { PeerProfileData, PeerUser } from '../types/quad';

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
  const { state, requestFollow } = useApp();
  const { showToast } = useToast();

  const [profile, setProfile] = useState<PeerProfileData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
      setProfile({
        user: {
          ...peer,
          isSelf: state.username === username,
          isFollowing,
          isRequested: Boolean(peer.isRequested),
        },
        publicPosts,
        personalPosts: [],
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
        </div>
      ) : null}
    </Modal>
  );
}
