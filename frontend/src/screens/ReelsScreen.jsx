import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  Play,
  Volume2,
  VolumeX,
  Heart,
  MessageSquare,
  Share2,
  Bookmark,
  Music,
  Film,
  Send,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import {
  Avatar,
  Badge,
  Modal,
  Button,
  EmptyState,
  Skeleton,
} from '../components/ui';

/* ─── Individual 9:16 Reel Player Card ─── */
function ReelCard({
  reel,
  slideRef,
  isInView,
  isMuted,
  onToggleMute,
  liked,
  onToggleLike,
  saved,
  onToggleSave,
  onOpenComments,
  onShare,
  shareCountOffset = 0,
}) {
  const { dark } = useTheme();
  const shouldReduceMotion = useReducedMotion();
  const [userPaused, setUserPaused] = useState(false);
  const [showHeartPop, setShowHeartPop] = useState(false);
  const [progress, setProgress] = useState(0);
  const [loadedSrc, setLoadedSrc] = useState(null);
  const imgRef = useRef(null);
  const lastTapRef = useRef(0);

  const posterSrc = `/media/reel-${reel.posterKey || 'robotics'}-${
    dark ? 'dark' : 'light'
  }.svg`;
  const posterLoaded = loadedSrc === posterSrc;
  const isPlaying = isInView && !userPaused;

  useEffect(() => {
    if (imgRef.current && imgRef.current.complete) {
      setLoadedSrc(posterSrc);
    }
  }, [posterSrc]);

  // Simulated video playback progress bar: runs ONLY while >60% visible and not paused
  useEffect(() => {
    if (!isPlaying) return undefined;
    const interval = setInterval(() => {
      setProgress((prev) => (prev >= 100 ? 0 : prev + 1.25));
    }, 200);
    return () => clearInterval(interval);
  }, [isPlaying]);

  // Reset progress & pause state when scrolled off-screen
  useEffect(() => {
    if (!isInView) {
      const resetTimer = setTimeout(() => {
        setProgress(0);
        setUserPaused(false);
      }, 0);
      return () => clearTimeout(resetTimer);
    }
    return undefined;
  }, [isInView]);

  const handleVideoTap = (e) => {
    e.stopPropagation();
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      if (!liked) onToggleLike(reel.id);
      if (!shouldReduceMotion) {
        setShowHeartPop(true);
        setTimeout(() => setShowHeartPop(false), 600);
      }
    } else {
      setUserPaused((prev) => !prev);
    }
    lastTapRef.current = now;
  };

  return (
    <div
      ref={slideRef}
      data-reel-id={reel.id}
      className="h-full max-h-full aspect-[9/16] max-w-full rounded-[16px] bg-canvas border border-ink/12 overflow-hidden relative flex flex-col justify-between p-4 select-none text-ink"
    >
      {/* Interactive Poster / Video Viewport */}
      <div
        role="button"
        tabIndex={0}
        aria-label={
          isPlaying
            ? `Pause reel by @${reel.username}: ${reel.tag}`
            : `Play reel by @${reel.username}: ${reel.tag}`
        }
        onClick={handleVideoTap}
        onKeyDown={(e) => {
          if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            setUserPaused((prev) => !prev);
          }
        }}
        className="absolute inset-0 bg-ink/6 cursor-pointer overflow-hidden flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        {!posterLoaded && (
          <Skeleton variant="rect" className="w-full h-full absolute inset-0" />
        )}
        <img
          ref={imgRef}
          src={posterSrc}
          alt={reel.posterAlt || `${reel.tag} demonstration reel by @${reel.username}`}
          onLoad={() => setLoadedSrc(posterSrc)}
          onError={() => setLoadedSrc(posterSrc)}
          className={`w-full h-full object-cover ${
            shouldReduceMotion ? '' : 'transition-opacity duration-250'
          } ${posterLoaded ? 'opacity-100' : 'opacity-0'}`}
        />

        {/* Paused Overlay */}
        <AnimatePresence>
          {(!isPlaying || userPaused) && (
            <motion.div
              initial={shouldReduceMotion ? { opacity: 1 } : { scale: 0.9, opacity: 0 }}
              animate={shouldReduceMotion ? { opacity: 1 } : { scale: 1, opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: shouldReduceMotion ? 0 : 0.15, ease: [0.4, 0, 0.2, 1] }}
              className="absolute inset-0 flex items-center justify-center pointer-events-none bg-canvas/40"
            >
              <div className="w-16 h-16 rounded-full bg-canvas border border-ink/12 text-ink flex items-center justify-center">
                <Play size={24} fill="currentColor" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Double-tap Floating Ink Heart */}
        <AnimatePresence>
          {showHeartPop && !shouldReduceMotion && (
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1.25, opacity: 1 }}
              exit={{ scale: 1.5, opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
              className="absolute inset-0 flex items-center justify-center pointer-events-none z-30"
            >
              <Heart size={24} className="text-ink fill-ink w-16 h-16" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Top Controls: Tag + Duration & Mute Toggle */}
      <div className="relative z-20 flex items-center justify-between gap-2 pointer-events-auto">
        <div className="flex items-center gap-2">
          <Badge variant="status">{reel.tag}</Badge>
          <span className="px-2 py-1 rounded-full bg-canvas border border-ink/12 text-xs font-semibold text-ink">
            {reel.duration}
          </span>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleMute();
          }}
          aria-pressed={!isMuted}
          aria-label={isMuted ? 'Unmute reel audio' : 'Mute reel audio'}
          className="min-h-[44px] min-w-[44px] p-2 rounded-full bg-canvas border border-ink/12 text-ink hover:bg-ink/8 active:bg-ink/12 transition-colors duration-150 cursor-pointer flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
        </button>
      </div>

      {/* Bottom Creator Card + Right Action Rail */}
      <div className="relative z-20 flex items-end justify-between gap-3 pointer-events-auto pt-6">
        <div className="space-y-2 flex-1 min-w-0 bg-canvas p-3 rounded-[16px] border border-ink/12">
          <div className="flex items-center gap-2 min-w-0">
            <Avatar initials={reel.initials} size={40} />
            <div className="min-w-0">
              <p className="text-sm font-semibold tracking-tight text-ink truncate">
                @{reel.username}
              </p>
              <p className="text-xs text-ink/60 truncate">
                {reel.branch} • {reel.year} Year
              </p>
            </div>
          </div>

          <p className="text-xs text-ink leading-relaxed line-clamp-3 break-words">
            {reel.caption}
          </p>

          <div className="inline-flex items-center gap-2 px-2 py-1 rounded-full bg-ink/6 border border-ink/12 text-xs text-ink/60 max-w-full">
            <Music size={16} className="shrink-0" />
            <span className="truncate">Original Audio • {reel.tag}</span>
          </div>
        </div>

        {/* Right Action Rail: Like (filled Ink heart), Comment, Share, Save */}
        <div className="flex flex-col items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleLike(reel.id);
            }}
            aria-pressed={liked}
            aria-label={liked ? `Unlike reel, ${reel.likes + 1} likes` : `Like reel, ${reel.likes} likes`}
            className="min-h-[44px] min-w-[44px] flex flex-col items-center justify-center gap-1 cursor-pointer rounded-[8px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <div
              className={`w-11 h-11 rounded-full flex items-center justify-center transition-colors duration-150 border ${
                liked
                  ? 'bg-ink text-canvas border-ink'
                  : 'bg-canvas text-ink border-ink/12 hover:bg-ink/8'
              }`}
            >
              <Heart size={20} className={liked ? 'fill-current' : ''} />
            </div>
            <span className="px-2 py-1 rounded-full bg-canvas border border-ink/12 text-xs font-semibold text-ink leading-none">
              {liked ? reel.likes + 1 : reel.likes}
            </span>
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenComments(reel);
            }}
            aria-label={`View ${reel.comments} comments`}
            className="min-h-[44px] min-w-[44px] flex flex-col items-center justify-center gap-1 cursor-pointer rounded-[8px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <div className="w-11 h-11 rounded-full bg-canvas border border-ink/12 text-ink flex items-center justify-center hover:bg-ink/8 transition-colors duration-150">
              <MessageSquare size={20} />
            </div>
            <span className="px-2 py-1 rounded-full bg-canvas border border-ink/12 text-xs font-semibold text-ink leading-none">
              {reel.comments}
            </span>
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onShare(reel);
            }}
            aria-label={`Share reel, ${(reel.shares || 0) + shareCountOffset} shares`}
            className="min-h-[44px] min-w-[44px] flex flex-col items-center justify-center gap-1 cursor-pointer rounded-[8px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <div className="w-11 h-11 rounded-full bg-canvas border border-ink/12 text-ink flex items-center justify-center hover:bg-ink/8 transition-colors duration-150">
              <Share2 size={20} />
            </div>
            <span className="px-2 py-1 rounded-full bg-canvas border border-ink/12 text-xs font-semibold text-ink leading-none">
              {(reel.shares || 0) + shareCountOffset}
            </span>
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleSave(reel.id);
            }}
            aria-pressed={saved}
            aria-label={saved ? 'Remove saved reel' : 'Save reel'}
            className="min-h-[44px] min-w-[44px] flex flex-col items-center justify-center gap-1 cursor-pointer rounded-[8px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <div
              className={`w-11 h-11 rounded-full flex items-center justify-center transition-colors duration-150 border ${
                saved
                  ? 'bg-ink text-canvas border-ink'
                  : 'bg-canvas text-ink border-ink/12 hover:bg-ink/8'
              }`}
            >
              <Bookmark size={20} className={saved ? 'fill-current' : ''} />
            </div>
          </button>
        </div>
      </div>

      {/* Bottom Playback Progress Bar */}
      <div
        role="progressbar"
        aria-label="Reel playback progress"
        aria-valuenow={Math.round(progress)}
        aria-valuemin={0}
        aria-valuemax={100}
        className="absolute inset-x-0 bottom-0 h-1 bg-ink/12 overflow-hidden pointer-events-none z-20"
      >
        <div
          className={`h-full bg-accent ${
            shouldReduceMotion
              ? ''
              : 'transition-all duration-150 ease-[cubic-bezier(0.4,0,0.2,1)]'
          }`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

/* ─── Dedicated Campus Reels Screen ─── */
export default function ReelsScreen({ onNavigate: _onNavigate }) {
  const { state, markReelsSeen, toggleReelLike } = useApp();
  const { showToast } = useToast();
  const shouldReduceMotion = useReducedMotion();
  const reels = useMemo(() => state.reels || [], [state.reels]);

  const [visibleReelId, setVisibleReelId] = useState(reels[0]?.id ?? null);
  const [isPageVisible, setIsPageVisible] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [savedMap, setSavedMap] = useState({});
  const [shareCountMap, setShareCountMap] = useState({});
  const [commentReel, setCommentReel] = useState(null);
  const [commentInput, setCommentInput] = useState('');

  const containerRef = useRef(null);
  const slideRefs = useRef({});

  // Clear unseen badge once user opens the Reels screen
  useEffect(() => {
    markReelsSeen?.();
  }, [markReelsSeen]);

  // Pause simulated playback if browser tab leaves foreground
  useEffect(() => {
    const handleVisibility = () => {
      setIsPageVisible(!document.hidden);
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  // Autoplay only when >60% visible; pause automatically when scrolled off-screen
  useEffect(() => {
    const root = containerRef.current;
    if (!root || reels.length === 0) return undefined;

    if (typeof IntersectionObserver === 'undefined') {
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const reelId = entry.target.getAttribute('data-reel-id');
          if (entry.intersectionRatio > 0.6) {
            setVisibleReelId(reelId);
          } else {
            setVisibleReelId((prev) => (String(prev) === String(reelId) ? null : prev));
          }
        });
      },
      {
        root,
        threshold: [0, 0.25, 0.6, 0.75, 1.0],
      }
    );

    reels.forEach((r) => {
      const el = slideRefs.current[r.id];
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [reels]);

  const scrollToIndex = useCallback(
    (idx) => {
      const targetReel = reels[idx];
      if (!targetReel || !slideRefs.current[targetReel.id]) return;
      slideRefs.current[targetReel.id].scrollIntoView({
        behavior: shouldReduceMotion ? 'auto' : 'smooth',
        block: 'start',
      });
    },
    [reels, shouldReduceMotion]
  );

  // Keyboard navigation (ArrowUp/ArrowDown/J/K/M)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (commentReel) return;
      const activeIdx = reels.findIndex((r) => String(r.id) === String(visibleReelId));
      const current = activeIdx >= 0 ? activeIdx : 0;

      if (['ArrowDown', 'j', 'J'].includes(e.key)) {
        e.preventDefault();
        if (current < reels.length - 1) scrollToIndex(current + 1);
      } else if (['ArrowUp', 'k', 'K'].includes(e.key)) {
        e.preventDefault();
        if (current > 0) scrollToIndex(current - 1);
      } else if (e.key === 'm' || e.key === 'M') {
        setIsMuted((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [commentReel, reels, visibleReelId, scrollToIndex]);

  const toggleLike = async (id) => {
    await toggleReelLike(id);
  };

  const toggleSave = (id) => {
    setSavedMap((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleShare = (reel) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href).catch(() => {});
    }
    setShareCountMap((prev) => ({ ...prev, [reel.id]: (prev[reel.id] || 0) + 1 }));
    showToast(`Copied link to @${reel.username}'s reel`, 'success');
  };

  const handlePostComment = (e) => {
    e.preventDefault();
    if (!commentInput.trim()) return;
    showToast('Comment posted to reel', 'success');
    setCommentInput('');
  };

  if (reels.length === 0) {
    return (
      <div className="w-full max-w-2xl mx-auto py-12 px-4">
        <EmptyState
          icon={Film}
          title="No Campus Reels Yet"
          description="Technical demonstrations and campus videos shared by verified students will stream here."
        />
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col items-center justify-center">
      {/* Main Vertical 9:16 Snap-Scroll Player Container */}
      <div
        ref={containerRef}
        role="region"
        aria-label="Vertical Campus Reels feed"
        className="w-full h-[calc(100dvh-168px)] md:h-[calc(100dvh-136px)] min-h-[440px] max-h-[780px] overflow-y-scroll snap-y snap-mandatory no-scrollbar flex flex-col items-center"
        style={{ scrollSnapType: 'y mandatory', WebkitOverflowScrolling: 'touch' }}
      >
        {reels.map((reel) => (
          <div
            key={reel.id}
            className="w-full h-full shrink-0 snap-start snap-always flex items-center justify-center py-2 px-2"
          >
            <ReelCard
              reel={reel}
              slideRef={(el) => {
                slideRefs.current[reel.id] = el;
              }}
              isInView={isPageVisible && String(visibleReelId) === String(reel.id)}
              isMuted={isMuted}
              onToggleMute={() => setIsMuted((prev) => !prev)}
              liked={Boolean(reel.isLiked)}
              onToggleLike={toggleLike}
              saved={Boolean(savedMap[reel.id])}
              onToggleSave={toggleSave}
              onOpenComments={(r) => setCommentReel(r)}
              onShare={handleShare}
              shareCountOffset={shareCountMap[reel.id] || 0}
            />
          </div>
        ))}
      </div>

      {/* Comments Sheet Modal */}
      <Modal
        variant="sheet"
        isOpen={Boolean(commentReel)}
        onClose={() => setCommentReel(null)}
        title={`Comments (${commentReel?.comments || 0})`}
        description={commentReel ? `Discussion on @${commentReel.username}'s demo` : ''}
        size="lg"
      >
        <div className="space-y-4">
          <div className="max-h-[45vh] overflow-y-auto space-y-3 pr-1 text-xs">
            <div className="flex items-start gap-3 p-3 rounded-[8px] bg-ink/6 border border-ink/12">
              <Avatar initials="CF" size="sm" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-ink">@circuit_freak</p>
                <p className="text-ink/60 mt-1 leading-relaxed">
                  Did you test the latency when obstacle reflection is diffuse? What baud rate is the serial port?
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-[8px] bg-ink/6 border border-ink/12">
              <Avatar initials="ML" size="sm" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-ink">@mech_lead</p>
                <p className="text-ink/60 mt-1 leading-relaxed">
                  Awesome chassis rigidity. The damping on the motor mount is holding up well.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-[8px] bg-ink/6 border border-ink/12">
              <Avatar initials="QD" size="sm" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-ink">@quantum_dev</p>
                <p className="text-ink/60 mt-1 leading-relaxed">
                  Great work! Let's integrate with the campus mapping node this Friday.
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={handlePostComment} className="pt-3 border-t border-ink/12 flex items-center gap-2">
            <input
              type="text"
              placeholder="Add a verified campus comment..."
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
              Post
            </Button>
          </form>
        </div>
      </Modal>
    </div>
  );
}
