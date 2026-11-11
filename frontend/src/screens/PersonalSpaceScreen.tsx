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
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { resolveApiMediaUrl } from '../services/apiClient';
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

export default function PersonalSpaceScreen({
  onNavigate,
}: {
  onNavigate: (screen: string) => void;
}) {
  const { state, toggleProfileVisibility, togglePostLike } = useApp();
  const { showToast } = useToast();
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [activeGroupFilter, setActiveGroupFilter] = useState('All');

  const isPublic = state.profilePublic || false;
  const username = state.username || 'quantum_dev';
  const initials = state.userInitials || 'QD';
  const personalPosts = state.personalPosts || [];
  const followRequests = state.followRequests || [];
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
    <div className="w-full max-w-3xl mx-auto py-6 px-4 space-y-6">
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
                  Verified College Network
                </Badge>
              </div>
              <p className="text-xs text-ink/60">
                Verified B.Tech Student • {state.branch || 'CSE'} ({state.year || '3rd'} Year)
              </p>
              <p className="text-xs text-ink max-w-md pt-1 leading-relaxed">
                {state.bio || 'CS junior exploring distributed systems and compilers.'}
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
