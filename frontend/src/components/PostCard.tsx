import React, { useState, useRef, useEffect } from 'react';
import {
  Heart,
  MessageCircle,
  Send,
  MoreHorizontal,
  Bookmark,
  MapPin,
  Check,
  Lock,
  Globe,
} from 'lucide-react';
import { Avatar, Skeleton } from './ui';
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
  public: 'Campus Public',
};

export function PostCardSkeleton() {
  return (
    <article
      aria-hidden="true"
      className="rounded-[12px] border border-ink/12 bg-canvas p-4 animate-pulse"
    >
      {/* Author Skeleton Row */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-ink/6" />
          <div className="space-y-1">
            <div className="w-24 h-3 rounded bg-ink/6" />
            <div className="w-32 h-2 rounded bg-ink/6" />
          </div>
        </div>
        <div className="w-6 h-6 rounded bg-ink/6" />
      </div>

      {/* Text Placeholders */}
      <div className="space-y-2 mb-4">
        <div className="w-3/4 h-4 rounded bg-ink/6" />
        <div className="w-full h-3 rounded bg-ink/6" />
        <div className="w-5/6 h-3 rounded bg-ink/6" />
      </div>

      {/* 16:9 Skeleton Block */}
      <div className="aspect-video w-full rounded-[8px] bg-ink/6 mb-3" />

      {/* Action Bar Placeholders */}
      <div className="flex items-center justify-between pt-2 border-t border-ink/8">
        <div className="flex items-center gap-4">
          <div className="w-12 h-6 rounded bg-ink/6" />
          <div className="w-12 h-6 rounded bg-ink/6" />
          <div className="w-12 h-6 rounded bg-ink/6" />
        </div>
        <div className="w-6 h-6 rounded bg-ink/6" />
      </div>
    </article>
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
  const [expanded, setExpanded] = useState(false);
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const [isLikeAnimating, setIsLikeAnimating] = useState(false);
  const [isBookmarkAnimating, setIsBookmarkAnimating] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const liked = Boolean(post.isLiked);
  const likeCount = Math.max(0, post.likes || 0);

  const postType = post.type || 'Discussion';
  const isQuestion = postType === 'Question';
  const isResolved = isQuestion && Boolean(post.bestAnswerId);

  const audienceLabel = AUDIENCE_LABELS[post.audience || 'public'] || post.audience || 'Campus Public';
  const isPrivateAudience = post.audience && post.audience !== 'public';

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
    if (!liked) {
      setIsLikeAnimating(true);
      window.setTimeout(() => setIsLikeAnimating(false), 380);
    }
    if (onToggleLike) {
      await onToggleLike(post);
    }
  };

  const handleBookmark = async () => {
    if (!isSaved) {
      setIsBookmarkAnimating(true);
      window.setTimeout(() => setIsBookmarkAnimating(false), 340);
    }
    if (onToggleSave) {
      await onToggleSave(post);
    }
  };

  const commentCount = Array.isArray(post.answers)
    ? post.answers.length
    : post.comments || 0;

  return (
    <article
      id={`post-${post.id}`}
      className="rounded-[12px] border border-ink/12 bg-canvas p-4 transition-all hover:border-ink/20"
    >
      {/* 1. Card Header / Author Info */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <Avatar
            initials={post.initials || 'ST'}
            username={post.username}
            src={post.avatarUrl}
            hasUnseenReel={hasUnseenReel}
            size="author"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-ink truncate">
                @{post.username}
              </span>
              <span className="text-xs text-ink/60 shrink-0">
                · {post.timestamp}
              </span>
              {post.edited && (
                <span className="text-xs text-ink/60 shrink-0">· edited</span>
              )}
            </div>

            {/* Audience chip */}
            <div className="inline-flex items-center gap-1 text-[11px] text-ink/60 mt-1">
              {isPrivateAudience ? (
                <Lock size={12} className="shrink-0" aria-hidden="true" />
              ) : (
                <Globe size={12} className="shrink-0" aria-hidden="true" />
              )}
              <span>Visible to: {audienceLabel}</span>
            </div>
          </div>
        </div>

        {/* Contextual Menu Button */}
        <button
          type="button"
          onClick={() => onMore?.(post)}
          aria-label={`More options for @${post.username}'s post`}
          className="w-8 h-8 rounded-[8px] flex items-center justify-center text-ink/50 hover:text-ink hover:bg-ink/6 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <MoreHorizontal size={18} aria-hidden="true" />
        </button>
      </div>

      {/* 2. Type Label */}
      <div className="mb-2">
        <TypeChip type={postType} />
      </div>

      {/* 3. Post Content: Headline & Body */}
      {displayHeadline && (
        <h2 className="text-base text-ink font-semibold mb-1 leading-snug break-words">
          {displayHeadline}
        </h2>
      )}

      <p className="text-sm text-ink/60 mb-2 leading-relaxed break-words">
        {post.content}
        {isLongBody && (
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className="text-accent text-sm font-medium hover:underline ml-1 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {expanded ? 'Show less' : 'Read more'}
          </button>
        )}
      </p>

      {/* 4. Blue Hashtags */}
      {Array.isArray(post.hashtags) && post.hashtags.length > 0 && (
        <div className="flex flex-wrap gap-2 text-xs text-accent font-medium mb-3">
          {post.hashtags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => onHashtagClick?.(tag)}
              className="hover:underline cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              {tag.startsWith('#') ? tag : `#${tag}`}
            </button>
          ))}
        </div>
      )}

      {/* 5. 16:9 Image Preview Container with subtle Location Pill */}
      {post.hasImage && (
        <div className="relative aspect-video w-full rounded-[8px] overflow-hidden border border-ink/12 mb-3 bg-ink/3">
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
            <div className="absolute bottom-2 left-2 px-2 py-1 rounded-[6px] bg-canvas/90 backdrop-blur-sm border border-ink/12 flex items-center gap-1 text-xs text-ink">
              <MapPin size={12} className="text-ink/60 shrink-0" aria-hidden="true" />
              <span>{post.location}</span>
            </div>
          )}
        </div>
      )}

      {/* 6. Quiet Action Row */}
      <div className="flex items-center justify-between pt-2 border-t border-ink/8 text-xs font-sans">
        <div className="flex items-center gap-1 sm:gap-4">
          {/* Heart Button */}
          <button
            type="button"
            onClick={handleLike}
            aria-label={liked ? `Unlike, ${likeCount} likes` : `Like, ${likeCount} likes`}
            aria-pressed={liked}
            className={`flex items-center gap-1 px-3 py-2 rounded-[8px] min-h-[44px] transition-colors cursor-pointer active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
              liked
                ? 'text-like font-medium bg-like/8'
                : 'text-ink/55 hover:text-ink hover:bg-ink/6'
            }`}
          >
            <Heart
              size={16}
              className={`${liked ? 'fill-like text-like' : 'text-ink/55'} ${
                isLikeAnimating ? 'animate-heart-pop' : ''
              }`}
              aria-hidden="true"
            />
            <span className={isLikeAnimating ? 'animate-number-pulse text-like font-bold' : ''}>
              {likeCount}
            </span>
          </button>

          {/* Comment Button with Resolved Badge */}
          <button
            type="button"
            onClick={() => onCommentClick?.(post)}
            aria-label={
              isQuestion
                ? `View ${commentCount} answers`
                : `View ${commentCount} comments`
            }
            className="flex items-center gap-1 px-3 py-2 rounded-[8px] text-ink/55 hover:text-ink hover:bg-ink/6 min-h-[44px] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <MessageCircle size={16} aria-hidden="true" />
            <span>
              {isQuestion ? `${commentCount} answers` : commentCount}
            </span>
            {isResolved && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium quad-resolved-badge ml-1">
                <Check size={12} strokeWidth={2.5} aria-hidden="true" />
                <span>Resolved</span>
              </span>
            )}
          </button>

          {/* Share Button */}
          <button
            type="button"
            onClick={() => onShareClick?.(post)}
            aria-label={`Share, ${post.shares || 0} shares`}
            className="flex items-center gap-1 px-3 py-2 rounded-[8px] text-ink/55 hover:text-ink hover:bg-ink/6 min-h-[44px] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <Send size={16} aria-hidden="true" />
            <span>{post.shares || 0}</span>
          </button>
        </div>

        {/* Bookmark Button (on right) */}
        <button
          type="button"
          onClick={handleBookmark}
          aria-label={isSaved ? 'Remove from bookmarks' : 'Save bookmark'}
          aria-pressed={isSaved}
          className={`w-11 h-11 flex items-center justify-center rounded-[8px] transition-all cursor-pointer active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
            isSaved
              ? 'text-ink bg-ink/6'
              : 'text-ink/55 hover:text-ink hover:bg-ink/6'
          }`}
        >
          <Bookmark
            size={16}
            className={`${isSaved ? 'fill-ink text-ink' : 'text-ink/55'} ${
              isBookmarkAnimating ? 'animate-bookmark-pop' : ''
            }`}
            aria-hidden="true"
          />
        </button>
      </div>
    </article>
  );
}

export default PostCard;
