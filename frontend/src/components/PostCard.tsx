import React, { useState, useRef, useEffect } from 'react';
import {
  Heart,
  MessageCircle,
  Share2,
  MoreHorizontal,
  Bookmark,
  MapPin,
  Check,
} from 'lucide-react';
import { Avatar, Card, Skeleton } from './ui';
import { TypeChip } from './TypeChip';
import { useTheme } from '../context/ThemeContext';
import { resolveApiMediaUrl } from '../services/apiClient';
import type { PostItem } from '../types/quad';

export interface PostCardPost extends PostItem {
  avatarUrl?: string;
}

export interface PostCardProps {
  post: PostCardPost;
  hasUnseenReel?: boolean;
  isSaved?: boolean;
  onToggleSave?: (post: PostCardPost) => void | Promise<unknown>;
  onToggleLike?: (post: PostCardPost) => void | Promise<unknown>;
  onMore?: (post: PostCardPost) => void;
  onHashtagClick?: (tag: string) => void;
  onCommentClick?: (post: PostCardPost) => void;
  onShareClick?: (post: PostCardPost) => void;
}

const AUDIENCE_LABELS: Record<string, string> = {
  branch: 'My branch',
  year: 'My year',
  followers: 'Followers only',
  group: 'Circle only',
};

export function PostCardSkeleton() {
  return (
    <Card
      padding={false}
      className="p-4 bg-canvas border border-ink/12 rounded-[12px] space-y-3"
    >
      <Skeleton variant="rect" width={88} height={24} className="rounded-full" />
      <div className="flex items-center gap-3">
        <Skeleton variant="circle" width={36} height={36} />
        <div className="space-y-1 flex-1">
          <Skeleton variant="rect" width={120} height={14} />
          <Skeleton variant="rect" width={72} height={12} />
        </div>
      </div>
      <div className="space-y-2">
        <Skeleton variant="rect" height={18} className="w-3/4" />
        <Skeleton variant="rect" height={14} className="w-full" />
        <Skeleton variant="rect" height={14} className="w-5/6" />
      </div>
      <div className="flex items-center gap-3 pt-3 border-t border-ink/12">
        <Skeleton variant="rect" width={56} height={28} />
        <Skeleton variant="rect" width={56} height={28} />
        <Skeleton variant="rect" width={56} height={28} />
      </div>
    </Card>
  );
}

export function PostCard({
  post,
  hasUnseenReel = false,
  isSaved = false,
  onToggleSave,
  onToggleLike,
  onMore,
  onHashtagClick,
  onCommentClick,
  onShareClick,
}: PostCardProps) {
  const { dark } = useTheme();
  const [localLiked, setLocalLiked] = useState(Boolean(post.isLiked));
  const [localDelta, setLocalDelta] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const liked = onToggleLike ? Boolean(post.isLiked) : localLiked;
  const likeCount = onToggleLike
    ? post.likes || 0
    : Math.max(0, (post.likes || 0) + localDelta);

  const postType = post.type || 'Discussion';
  const isQuestion = postType === 'Question';
  const isResolved = isQuestion && Boolean(post.bestAnswerId);

  const nonDefaultAudience =
    post.audience && post.audience !== 'public'
      ? AUDIENCE_LABELS[post.audience] || post.audience
      : null;

  const isLongBody = (post.content || '').length > 190;
  const displayHeadline =
    post.title || (post.content || '').split('\n')[0].slice(0, 96);

  const mediaSrc: string | null = post.hasImage
    ? post.mediaUrl
      ? resolveApiMediaUrl(post.mediaUrl)
      : `/media/post-${post.mediaKey || 'library'}-${dark ? 'dark' : 'light'}.svg`
    : null;
  const mediaLoaded = Boolean(mediaSrc && loadedSrc === mediaSrc);

  useEffect(() => {
    if (mediaSrc && imgRef.current && imgRef.current.complete) {
      setLoadedSrc(mediaSrc);
    }
  }, [mediaSrc]);

  const handleLike = async () => {
    if (onToggleLike) {
      await onToggleLike(post);
      return;
    }
    const nextLiked = !localLiked;
    setLocalLiked(nextLiked);
    setLocalDelta((prev) => prev + (nextLiked ? 1 : -1));
  };

  const commentCount = Array.isArray(post.answers)
    ? post.answers.length
    : post.comments || 0;

  return (
    <Card
      padding={false}
      className="p-4 bg-canvas border border-ink/12 rounded-[12px] hover:border-ink/24 transition-colors duration-150 space-y-3"
    >
      {/* Top Post Type Chip + Resolved Chip for Question Posts */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <TypeChip type={postType} />
          {isResolved && (
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-ink text-canvas font-sans text-[11px] font-semibold leading-none">
              <Check size={12} strokeWidth={2.5} aria-hidden="true" />
              <span>Resolved</span>
            </span>
          )}
        </div>
      </div>

      {/* Author Row: 36px Avatar, @username semibold, 1 meta line, ⋯ menu */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Avatar
            initials={post.initials || 'ST'}
            username={post.username}
            src={post.avatarUrl}
            hasUnseenReel={hasUnseenReel}
            size={36}
          />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink tracking-tight truncate">
              @{post.username}
            </p>
            <p className="text-xs text-ink/60 flex items-center gap-1 flex-wrap">
              <span>{post.timestamp}</span>
              {post.edited && (
                <>
                  <span aria-hidden="true">•</span>
                  <span>edited</span>
                </>
              )}
              {nonDefaultAudience && (
                <>
                  <span aria-hidden="true">•</span>
                  <span>{nonDefaultAudience}</span>
                </>
              )}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onMore?.(post)}
          className="min-h-[44px] min-w-[44px] p-2 rounded-[8px] hover:bg-ink/8 active:bg-ink/12 transition-colors duration-150 text-ink/60 hover:text-ink cursor-pointer flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          aria-label={`Post actions menu for @${post.username}`}
        >
          <MoreHorizontal size={20} />
        </button>
      </div>

      {/* Headline (16px semibold) + Body (14px, 4-line clamp) + Hashtags (13px) */}
      <div className="space-y-2">
        {displayHeadline && (
          <h3 className="text-base font-semibold text-ink leading-snug break-words">
            {displayHeadline}
          </h3>
        )}

        <div>
          <p
            className={`text-sm font-normal leading-relaxed text-ink/80 break-words ${
              !expanded && isLongBody ? 'line-clamp-4' : ''
            }`}
          >
            {post.content}
          </p>
          {isLongBody && (
            <button
              type="button"
              onClick={() => setExpanded((prev) => !prev)}
              className="min-h-[44px] inline-flex items-center text-xs font-semibold text-accent hover:underline cursor-pointer rounded-[8px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              {expanded ? 'Show less' : 'Read more'}
            </button>
          )}
        </div>

        {/* Dedicated Hashtags Row: 13px accent links */}
        {Array.isArray(post.hashtags) && post.hashtags.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {post.hashtags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => onHashtagClick?.(tag)}
                className="min-h-[44px] inline-flex items-center px-2 py-1 rounded-[8px] text-[13px] font-medium text-accent hover:bg-ink/8 hover:underline cursor-pointer transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                {tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Optional 16:9 Media Container + Skeleton + alt text + Location chip */}
      {post.hasImage && (
        <div className="relative aspect-video w-full rounded-[8px] overflow-hidden border border-ink/12 bg-ink/6">
          {!mediaLoaded && (
            <Skeleton variant="rect" className="w-full h-full absolute inset-0" />
          )}
          <img
            ref={imgRef}
            src={mediaSrc ?? undefined}
            alt={post.imageAlt || post.location || 'Campus post attachment'}
            onLoad={() => setLoadedSrc(mediaSrc)}
            onError={() => setLoadedSrc(mediaSrc)}
            className={`w-full h-full object-cover transition-opacity duration-250 ${
              mediaLoaded ? 'opacity-100' : 'opacity-0'
            }`}
          />
          {post.location && (
            <div className="absolute bottom-3 left-3 inline-flex items-center gap-1 px-3 py-1 rounded-full bg-canvas border border-ink/12 text-xs font-medium text-ink">
              <MapPin size={14} className="text-ink shrink-0" aria-hidden="true" />
              <span>{post.location}</span>
            </div>
          )}
        </div>
      )}

      {/* Action Row: Like (filled Ink heart), Comment / Answers, Share; Bookmark right */}
      <div className="flex items-center justify-between pt-2 border-t border-ink/12 text-xs font-sans">
        <div className="flex items-center gap-1 sm:gap-2">
          <button
            type="button"
            onClick={handleLike}
            aria-label={liked ? `Unlike post, ${likeCount} likes` : `Like post, ${likeCount} likes`}
            aria-pressed={liked}
            className={`min-h-[44px] min-w-[44px] px-3 py-2 rounded-[8px] inline-flex items-center gap-2 transition-colors duration-150 cursor-pointer active:bg-ink/8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
              liked
                ? 'text-ink font-semibold bg-ink/6'
                : 'text-ink/60 hover:text-ink hover:bg-ink/8'
            }`}
          >
            <Heart
              size={16}
              className={liked ? 'fill-ink text-ink' : 'text-ink/60'}
              aria-hidden="true"
            />
            <span>{likeCount}</span>
          </button>

          <button
            type="button"
            onClick={() => onCommentClick?.(post)}
            aria-label={
              isQuestion
                ? `View ${commentCount} answers`
                : `Comment on post, ${commentCount} comments`
            }
            className="min-h-[44px] min-w-[44px] px-3 py-2 rounded-[8px] inline-flex items-center gap-2 text-ink/60 hover:text-ink hover:bg-ink/8 active:bg-ink/12 transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <MessageCircle size={16} aria-hidden="true" />
            <span>
              {isQuestion ? `${commentCount} answers` : commentCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => onShareClick?.(post)}
            aria-label={`Share post, ${post.shares || 0} shares`}
            className="min-h-[44px] min-w-[44px] px-3 py-2 rounded-[8px] inline-flex items-center gap-2 text-ink/60 hover:text-ink hover:bg-ink/8 active:bg-ink/12 transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <Share2 size={16} aria-hidden="true" />
            <span>{post.shares || 0}</span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => onToggleSave?.(post)}
          aria-label={isSaved ? 'Remove bookmark' : 'Bookmark post'}
          aria-pressed={isSaved}
          className={`min-h-[44px] min-w-[44px] p-2 rounded-[8px] transition-colors duration-150 cursor-pointer flex items-center justify-center active:bg-ink/12 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
            isSaved
              ? 'text-ink bg-ink/6'
              : 'text-ink/60 hover:text-ink hover:bg-ink/8'
          }`}
        >
          <Bookmark
            size={16}
            className={isSaved ? 'fill-ink text-ink' : 'text-ink/60'}
            aria-hidden="true"
          />
        </button>
      </div>
    </Card>
  );
}

export default PostCard;
