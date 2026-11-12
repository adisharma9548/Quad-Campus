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
  Loader2,
  AlertCircle,
  RotateCcw,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { resolveApiMediaUrl } from '../services/apiClient';
import {
  formatPlaybackSeconds,
  formatTotalSeconds,
  resolveReelDurationLabel,
} from '../utils/formatDuration';
import ReelCommentsPanel from '../components/ReelCommentsPanel';
import {
  Avatar,
  Button,
  EmptyState,
  Skeleton,
} from '../components/ui';

export interface ReelCardControls {
  togglePlay: () => void;
  seekBy: (deltaSec: number) => void;
  showControls?: () => void;
}

export interface ReelCardProps {
  reel: import('../types/quad').ReelItem;
  slideRef?: (el: HTMLDivElement | null) => void;
  isInView: boolean;
  isMuted: boolean;
  onToggleMute: () => void;
  liked: boolean;
  onToggleLike: (id: string | number) => void | Promise<void>;
  saved: boolean;
  onToggleSave: (id: string | number) => void;
  onOpenComments: (reel: import('../types/quad').ReelItem) => void;
  onShare: (reel: import('../types/quad').ReelItem) => void;
  onOpenProfile?: (username: string, fallbackPeer?: import('../types/quad').PeerUser) => void;
  shareCountOffset?: number;
  onRegisterControls?: (id: string | number, controls: ReelCardControls | null) => void;
}

/* ─── Individual 9:16 Reel Player Card ─── */
export function ReelCard({
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
  onOpenProfile,
  shareCountOffset = 0,
  onRegisterControls,
}: ReelCardProps) {
  const shouldReduceMotion = useReducedMotion();
  const [userPaused, setUserPaused] = useState(false);
  const [showHeartPop, setShowHeartPop] = useState(false);
  const [currentTimeSec, setCurrentTimeSec] = useState(0);
  const [videoDurationSec, setVideoDurationSec] = useState<number | null>(
    typeof reel.durationSec === 'number' && Number.isFinite(reel.durationSec) && reel.durationSec > 0
      ? reel.durationSec
      : null
  );
  const [videoLoadedData, setVideoLoadedData] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [isDraggingSeek, setIsDraggingSeek] = useState(false);
  const [isPlayerHovered, setIsPlayerHovered] = useState(false);
  const [isFocusWithin, setIsFocusWithin] = useState(false);
  const [controlsAwake, setControlsAwake] = useState(true);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const bgVideoRef = useRef<HTMLVideoElement | null>(null);
  const seekTrackRef = useRef<HTMLDivElement | null>(null);
  const hideControlsTimerRef = useRef<number | null>(null);
  const lastTapRef = useRef(0);

  const isProcessing = reel.status === 'processing';
  const isFailed = reel.status === 'failed';
  const hasRealVideo = !isProcessing && !isFailed && Boolean(reel.videoUrl || reel.mediaUrl);
  const resolvedVideoSrc = hasRealVideo
    ? resolveApiMediaUrl(reel.videoUrl || reel.mediaUrl)
    : '';
  const resolvedCoverSrc =
    reel.coverUrl || reel.thumbnailUrl
      ? resolveApiMediaUrl(reel.coverUrl || reel.thumbnailUrl)
      : '';
  const totalSec =
    videoDurationSec && videoDurationSec > 0
      ? videoDurationSec
      : typeof reel.durationSec === 'number' && Number.isFinite(reel.durationSec) && reel.durationSec > 0
        ? reel.durationSec
        : 0;
  const durationBadgeLabel =
    totalSec > 0 ? formatTotalSeconds(totalSec) : resolveReelDurationLabel(reel);
  const progress =
    hasRealVideo && totalSec > 0
      ? Math.min(100, Math.max(0, (currentTimeSec / totalSec) * 100))
      : 0;
  const isPlaying = hasRealVideo && isInView && !userPaused && !videoError;

  // Sync play/pause & mute directly with the real <video> element
  useEffect(() => {
    if (!hasRealVideo) return undefined;
    const v = videoRef.current;
    if (!v) return undefined;
    v.muted = isMuted;
    if (isPlaying) {
      v.play().catch(() => {});
      if (bgVideoRef.current) {
        if (Math.abs(bgVideoRef.current.currentTime - v.currentTime) > 0.35) {
          bgVideoRef.current.currentTime = v.currentTime;
        }
        bgVideoRef.current.play().catch(() => {});
      }
    } else {
      v.pause();
      bgVideoRef.current?.pause();
    }
    return undefined;
  }, [hasRealVideo, isMuted, isPlaying]);

  // Smooth frame-accurate timeline & live timestamp sync while playing
  useEffect(() => {
    if (!isPlaying) return undefined;
    let rafId = 0;
    const syncFrame = () => {
      const v = videoRef.current;
      if (v) {
        if (Number.isFinite(v.duration) && v.duration > 0) {
          setVideoDurationSec(v.duration);
        }
        setCurrentTimeSec(v.currentTime);
        if (
          bgVideoRef.current &&
          Math.abs(bgVideoRef.current.currentTime - v.currentTime) > 0.35
        ) {
          bgVideoRef.current.currentTime = v.currentTime;
        }
      }
      rafId = window.requestAnimationFrame(syncFrame);
    };
    rafId = window.requestAnimationFrame(syncFrame);
    return () => window.cancelAnimationFrame(rafId);
  }, [isPlaying]);

  const clearHideControlsTimer = useCallback(() => {
    if (hideControlsTimerRef.current) {
      window.clearTimeout(hideControlsTimerRef.current);
      hideControlsTimerRef.current = null;
    }
  }, []);

  const wakeControls = useCallback(() => {
    setControlsAwake(true);
    clearHideControlsTimer();
    if (isPlaying && isInView) {
      hideControlsTimerRef.current = window.setTimeout(() => {
        setControlsAwake(false);
        hideControlsTimerRef.current = null;
      }, 3000);
    }
  }, [clearHideControlsTimer, isInView, isPlaying]);

  const handleOpenAuthorProfile = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onOpenProfile?.(reel.username, {
        id: reel.authorId || reel.username,
        username: reel.username,
        initials: reel.initials,
        branch: reel.branch ?? null,
        year: reel.year ?? null,
      });
    },
    [onOpenProfile, reel.authorId, reel.branch, reel.initials, reel.username, reel.year]
  );

  // Auto-hide controls 3 seconds after playback starts or idle
  useEffect(() => {
    clearHideControlsTimer();
    if (!isPlaying || !isInView) return undefined;
    hideControlsTimerRef.current = window.setTimeout(() => {
      setControlsAwake(false);
      hideControlsTimerRef.current = null;
    }, 3000);
    return () => clearHideControlsTimer();
  }, [clearHideControlsTimer, isInView, isPlaying]);

  // Reset pause state & overlay timers when scrolled off-screen
  useEffect(() => {
    if (!isInView) {
      const v = videoRef.current;
      if (v) v.pause();
      bgVideoRef.current?.pause();
      clearHideControlsTimer();
      const resetTimer = setTimeout(() => {
        setUserPaused(false);
        setIsBuffering(false);
        setIsPlayerHovered(false);
        setIsFocusWithin(false);
        setControlsAwake(true);
      }, 0);
      return () => clearTimeout(resetTimer);
    }
    return undefined;
  }, [clearHideControlsTimer, isInView]);

  useEffect(() => {
    return () => {
      clearHideControlsTimer();
    };
  }, [clearHideControlsTimer]);

  const togglePlayPause = useCallback(() => {
    if (!hasRealVideo || videoError) return;
    wakeControls();
    setUserPaused((prev) => !prev);
  }, [hasRealVideo, videoError, wakeControls]);

  const seekToTime = useCallback(
    (targetTime: number) => {
      const v = videoRef.current;
      if (!hasRealVideo || !v) return;
      const maxDur =
        Number.isFinite(v.duration) && v.duration > 0 ? v.duration : totalSec;
      if (maxDur <= 0) return;
      const clamped = Math.max(0, Math.min(maxDur, targetTime));
      v.currentTime = clamped;
      if (bgVideoRef.current) {
        bgVideoRef.current.currentTime = clamped;
      }
      setCurrentTimeSec(clamped);
    },
    [hasRealVideo, totalSec]
  );

  const seekBy = useCallback(
    (deltaSec: number) => {
      const v = videoRef.current;
      if (!hasRealVideo || !v) return;
      seekToTime(v.currentTime + deltaSec);
    },
    [hasRealVideo, seekToTime]
  );

  const seekFromClientX = useCallback(
    (clientX: number) => {
      const track = seekTrackRef.current;
      const v = videoRef.current;
      if (!track || !hasRealVideo || !v) return;
      const rect = track.getBoundingClientRect();
      if (rect.width <= 0) return;
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const maxDur =
        Number.isFinite(v.duration) && v.duration > 0 ? v.duration : totalSec;
      if (maxDur <= 0) return;
      seekToTime(ratio * maxDur);
    },
    [hasRealVideo, seekToTime, totalSec]
  );

  useEffect(() => {
    if (!onRegisterControls) return undefined;
    onRegisterControls(reel.id, {
      togglePlay: togglePlayPause,
      seekBy,
      showControls: wakeControls,
    });
    return () => onRegisterControls(reel.id, null);
  }, [onRegisterControls, reel.id, seekBy, togglePlayPause, wakeControls]);

  const handleRetryVideo = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    const v = videoRef.current;
    setVideoError(false);
    setVideoLoadedData(false);
    setIsBuffering(true);
    if (v) {
      v.load();
      if (isInView && !userPaused) {
        v.play().catch(() => {});
      }
    }
  };

  const handleVideoTap = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    wakeControls();
    if (!hasRealVideo || videoError) return;
    const now = Date.now();
    if (now - lastTapRef.current < 280) {
      if (!liked) onToggleLike(reel.id);
      if (!shouldReduceMotion) {
        setShowHeartPop(true);
        setTimeout(() => setShowHeartPop(false), 600);
      }
    }
    togglePlayPause();
    lastTapRef.current = now;
  };

  const controlsVisible = !isPlaying || isFocusWithin || isDraggingSeek || controlsAwake;
  useEffect(() => {
    if (!isInView) return undefined;
    window.dispatchEvent(new CustomEvent('quad:reels-controls-visible', { detail: controlsVisible }));
    return undefined;
  }, [controlsVisible, isInView]);

  useEffect(() => {
    return () => {
      window.dispatchEvent(new CustomEvent('quad:reels-controls-visible', { detail: true }));
    };
  }, []);

  const extraHashtags = (reel.hashtags || []).filter(
    (tag) => !(reel.caption || '').toLowerCase().includes(`#${tag.toLowerCase()}`)
  );
  const timeDisplay =
    hasRealVideo && durationBadgeLabel
      ? `${formatPlaybackSeconds(currentTimeSec)} / ${durationBadgeLabel}`
      : '';

  return (
    <div
      ref={slideRef}
      data-reel-id={reel.id}
      onContextMenu={(e) => e.preventDefault()}
      onMouseEnter={() => {
        setIsPlayerHovered(true);
        wakeControls();
      }}
      onMouseLeave={() => {
        setIsPlayerHovered(false);
      }}
      onMouseMove={wakeControls}
      onPointerDown={wakeControls}
      onFocusCapture={() => {
        setIsFocusWithin(true);
        wakeControls();
      }}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          setIsFocusWithin(false);
        }
      }}
      className="quad-reel-phone-stage h-full max-h-full aspect-[9/16] max-w-full rounded-[16px] bg-canvas border border-ink/12 overflow-hidden relative flex flex-col justify-end p-4 pb-4 select-none text-ink"
    >
      {/* Interactive Video Stage (prevents native right-click video menu) */}
      <div
        role="button"
        tabIndex={0}
        aria-label={
          isProcessing
            ? `Reel by @${reel.username} is still processing`
            : isPlaying
              ? `Pause reel by @${reel.username}: ${reel.tag}`
              : `Play reel by @${reel.username}: ${reel.tag}`
        }
        onContextMenu={(e) => e.preventDefault()}
        onClick={handleVideoTap}
        onKeyDown={(e) => {
          if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            togglePlayPause();
          }
        }}
        className="absolute inset-0 bg-ink/6 cursor-pointer overflow-hidden flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        {hasRealVideo ? (
          <>
            {reel.fitMode === 'fit' && (
              <video
                ref={bgVideoRef}
                src={resolvedVideoSrc}
                muted
                playsInline
                loop
                preload="metadata"
                controls={false}
                controlsList="nodownload noplaybackrate noremoteplayback"
                disablePictureInPicture
                disableRemotePlayback
                aria-hidden="true"
                onContextMenu={(e) => e.preventDefault()}
                className="w-full h-full object-cover scale-110 blur-xl opacity-60 absolute inset-0 pointer-events-none"
              />
            )}
            <video
              ref={videoRef}
              src={resolvedVideoSrc}
              muted={isMuted}
              playsInline
              loop
              preload="metadata"
              controls={false}
              controlsList="nodownload noplaybackrate noremoteplayback"
              disablePictureInPicture
              disableRemotePlayback
              onContextMenu={(e) => e.preventDefault()}
              onLoadedMetadata={() => {
                const v = videoRef.current;
                if (v && Number.isFinite(v.duration) && v.duration > 0) {
                  setVideoDurationSec(v.duration);
                }
              }}
              onLoadedData={() => {
                setVideoLoadedData(true);
                setIsBuffering(false);
                setVideoError(false);
              }}
              onWaiting={() => {
                if (isInView && !userPaused) setIsBuffering(true);
              }}
              onCanPlay={() => setIsBuffering(false)}
              onPlaying={() => setIsBuffering(false)}
              onError={() => {
                setIsBuffering(false);
                setVideoError(true);
              }}
              onTimeUpdate={() => {
                const v = videoRef.current;
                if (!v) return;
                setCurrentTimeSec(v.currentTime);
              }}
              onSeeked={() => {
                const v = videoRef.current;
                if (v) setCurrentTimeSec(v.currentTime);
              }}
              className={`relative z-10 w-full h-full pointer-events-none ${
                reel.fitMode === 'fit' ? 'object-contain' : 'object-cover'
              }`}
            />
            {resolvedCoverSrc && (
              <img
                src={resolvedCoverSrc}
                alt={reel.posterAlt || `${reel.tag} cover frame`}
                className={`absolute inset-0 z-10 w-full h-full ${
                  reel.fitMode === 'fit' ? 'object-contain' : 'object-cover'
                } pointer-events-none transition-opacity duration-200 ${
                  videoLoadedData ? 'opacity-0' : 'opacity-100'
                }`}
              />
            )}
          </>
        ) : resolvedCoverSrc ? (
          <img
            src={resolvedCoverSrc}
            alt={reel.posterAlt || `${reel.tag} by @${reel.username}`}
            className="w-full h-full object-cover pointer-events-none"
          />
        ) : (
          <Skeleton variant="rect" className="w-full h-full absolute inset-0 pointer-events-none" />
        )}

        {/* Processing / Failed State */}
        {(isProcessing || isFailed) && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 px-6 text-center bg-canvas/85 pointer-events-none">
            {isProcessing ? (
              <>
                <Loader2 size={28} className="animate-spin text-accent" aria-hidden="true" />
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-ink">Processing your reel...</p>
                  <p className="text-xs text-ink/60">
                    Optimizing video for smooth playback. Only visible to you until ready.
                  </p>
                </div>
              </>
            ) : (
              <>
                <AlertCircle size={28} className="text-danger" aria-hidden="true" />
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-ink">Video processing failed</p>
                  <p className="text-xs text-ink/60">
                    {reel.processingError || 'Please remove this upload and try another file.'}
                  </p>
                </div>
              </>
            )}
          </div>
        )}

        {/* Buffering Spinner */}
        {hasRealVideo && isBuffering && !videoError && !userPaused && isInView && (
          <div
            aria-label="Buffering video"
            className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none"
          >
            <div className="w-12 h-12 rounded-full bg-canvas/85 border border-ink/12 flex items-center justify-center">
              <Loader2 size={22} className="animate-spin text-ink" />
            </div>
          </div>
        )}

        {/* Playback Error + Retry Overlay */}
        {hasRealVideo && videoError && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 px-6 text-center bg-canvas/85 pointer-events-auto">
            <AlertCircle size={28} className="text-danger" aria-hidden="true" />
            <p className="text-sm font-semibold text-ink">Unable to load this video</p>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              icon={RotateCcw}
              onClick={handleRetryVideo}
            >
              Try again
            </Button>
          </div>
        )}

        {/* Paused Overlay: ONLY one translucent centered Play button, zero grey veil/wash */}
        {/* Paused Overlay Cluster: Mute stacked cleanly above centered Play (no circles, no tint) */}
        <AnimatePresence>
          {hasRealVideo && !videoError && !isPlaying && !isBuffering && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: shouldReduceMotion ? 0 : 0.12 }}
              className="quad-reel-pause-cluster absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 pointer-events-none"
            >
              <button
                type="button"
                data-testid="reel-paused-mute"
                onClick={(e) => {
                  e.stopPropagation();
                  wakeControls();
                  onToggleMute();
                }}
                aria-pressed={!isMuted}
                aria-label={isMuted ? 'Unmute reel audio' : 'Mute reel audio'}
                className="pointer-events-auto min-h-[44px] min-w-[44px] flex items-center justify-center quad-reel-overlay-icon cursor-pointer rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                {isMuted ? <VolumeX size={30} /> : <Volume2 size={30} />}
              </button>

              <div
                data-testid="reel-paused-play"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center quad-reel-overlay-icon"
              >
                <Play size={58} fill="currentColor" className="ml-1" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Double-tap Floating Heart */}
        <AnimatePresence>
          {showHeartPop && !shouldReduceMotion && (
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1.25, opacity: 1 }}
              exit={{ scale: 1.5, opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
              className="absolute inset-0 flex items-center justify-center pointer-events-none z-30"
            >
              <Heart size={24} className="text-coral fill-coral w-16 h-16 quad-reel-overlay-icon" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Subtle Bottom Gradient Behind Text Only */}
      <div
        aria-hidden="true"
        className={`absolute inset-x-0 bottom-0 h-44 pointer-events-none z-10 quad-reel-overlay-scrim-bottom quad-reel-overlay-fade transition-opacity duration-150 ${
          controlsVisible ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* Bottom-left Transparent Author/Caption Block + Right Translucent Action Rail */}
      <div
        className={`relative z-20 flex items-end justify-between gap-3 pointer-events-none quad-reel-overlay-fade transition-opacity duration-150 ${
          controlsVisible ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {/* Bottom-left Author & Caption Block (transparent, clickable @username, Original Audio only) */}
        <div
          className={`space-y-2 flex-1 min-w-0 mb-1 ${
            controlsVisible ? 'pointer-events-auto' : 'pointer-events-none'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={handleOpenAuthorProfile}
              aria-label={`View @${reel.username}'s profile`}
              className="shrink-0 rounded-full cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <Avatar initials={reel.initials} size={40} />
            </button>
            <div className="min-w-0">
              <button
                type="button"
                onClick={handleOpenAuthorProfile}
                className="block max-w-full text-left text-sm font-semibold tracking-tight quad-reel-overlay-text truncate hover:underline cursor-pointer rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                @{reel.username}
              </button>
              <p className="text-xs quad-reel-overlay-text-muted truncate">
                {reel.branch && reel.year
                  ? `${reel.branch} • ${reel.year} Year`
                  : 'Campus Member'}
              </p>
            </div>
          </div>

          {(reel.caption || extraHashtags.length > 0) && (
            <p className="text-xs quad-reel-overlay-text leading-relaxed line-clamp-3 break-words">
              {reel.caption}
              {extraHashtags.length > 0 && (
                <span className="ml-1 font-semibold">
                  {extraHashtags.map((t) => `#${t}`).join(' ')}
                </span>
              )}
            </p>
          )}

          <div className="inline-flex items-center gap-2 text-xs quad-reel-overlay-text-muted max-w-full">
            <Music size={14} className="shrink-0" aria-hidden="true" />
            <span className="truncate">Original Audio</span>
          </div>
        </div>

        {/* Right Action Rail (bare transparent white icons, zero circles/fills): Like, Comment, Share, Save */}
        <div
          className={`flex flex-col items-center gap-3 shrink-0 pr-1 ${
            controlsVisible ? 'pointer-events-auto' : 'pointer-events-none'
          }`}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              wakeControls();
              onToggleLike(reel.id);
            }}
            aria-pressed={liked}
            aria-label={liked ? `Unlike reel, ${reel.likes + 1} likes` : `Like reel, ${reel.likes} likes`}
            className="min-h-[44px] min-w-[44px] flex flex-col items-center justify-center gap-1 cursor-pointer rounded-[8px] quad-reel-overlay-icon focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent pointer-events-auto"
          >
            <Heart
              size={26}
              className={liked ? 'text-coral fill-coral' : ''}
            />
            <span className="text-xs font-semibold quad-reel-overlay-text leading-none tabular-nums">
              {liked ? reel.likes + 1 : reel.likes}
            </span>
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              wakeControls();
              onOpenComments(reel);
            }}
            aria-label={`View ${reel.comments} comments`}
            className="min-h-[44px] min-w-[44px] flex flex-col items-center justify-center gap-1 cursor-pointer rounded-[8px] quad-reel-overlay-icon focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent pointer-events-auto"
          >
            <MessageSquare size={26} />
            <span className="text-xs font-semibold quad-reel-overlay-text leading-none tabular-nums">
              {reel.comments}
            </span>
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              wakeControls();
              onShare(reel);
            }}
            aria-label={`Share reel, ${(reel.shares || 0) + shareCountOffset} shares`}
            className="min-h-[44px] min-w-[44px] flex flex-col items-center justify-center gap-1 cursor-pointer rounded-[8px] quad-reel-overlay-icon focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent pointer-events-auto"
          >
            <Share2 size={26} />
            <span className="text-xs font-semibold quad-reel-overlay-text leading-none tabular-nums">
              {(reel.shares || 0) + shareCountOffset}
            </span>
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              wakeControls();
              onToggleSave(reel.id);
            }}
            aria-pressed={saved}
            aria-label={saved ? 'Remove saved reel' : 'Save reel'}
            className="min-h-[44px] min-w-[44px] flex flex-col items-center justify-center gap-1 cursor-pointer rounded-[8px] quad-reel-overlay-icon focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent pointer-events-auto"
          >
            <Bookmark size={26} className={saved ? 'fill-current' : ''} />
          </button>
        </div>
      </div>

      {/* Hover/Drag Current / Total Time Readout Above Progress Bar */}
      {timeDisplay && (isPlayerHovered || isDraggingSeek) && (
        <div
          data-testid="reel-hover-time"
          className="quad-reel-time-hover absolute right-3 z-30 pointer-events-none text-[11px] font-semibold quad-reel-overlay-text tabular-nums leading-none"
        >
          {timeDisplay}
        </div>
      )}

      {/* Always-Visible Thin Interactive Seek Bar */}
      <div
        ref={seekTrackRef}
        role="slider"
        tabIndex={hasRealVideo && totalSec > 0 ? 0 : -1}
        aria-label="Seek reel playback position"
        aria-valuemin={0}
        aria-valuemax={Math.max(0, Math.round(totalSec))}
        aria-valuenow={Math.round(currentTimeSec)}
        aria-valuetext={`${formatPlaybackSeconds(currentTimeSec)}${durationBadgeLabel ? ` of ${durationBadgeLabel}` : ''}`}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => {
          if (!hasRealVideo || totalSec <= 0) return;
          e.stopPropagation();
          wakeControls();
          e.currentTarget.setPointerCapture(e.pointerId);
          setIsDraggingSeek(true);
          seekFromClientX(e.clientX);
        }}
        onPointerMove={(e) => {
          if (!isDraggingSeek) return;
          e.stopPropagation();
          seekFromClientX(e.clientX);
        }}
        onPointerUp={(e) => {
          if (!isDraggingSeek) return;
          e.stopPropagation();
          if (e.currentTarget.hasPointerCapture(e.pointerId)) {
            e.currentTarget.releasePointerCapture(e.pointerId);
          }
          setIsDraggingSeek(false);
        }}
        onPointerCancel={() => setIsDraggingSeek(false)}
        onKeyDown={(e) => {
          if (!hasRealVideo || totalSec <= 0) return;
          wakeControls();
          if (e.key === 'ArrowLeft') {
            e.preventDefault();
            e.stopPropagation();
            seekBy(-5);
          } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            e.stopPropagation();
            seekBy(5);
          } else if (e.key === 'Home') {
            e.preventDefault();
            e.stopPropagation();
            seekToTime(0);
          } else if (e.key === 'End') {
            e.preventDefault();
            e.stopPropagation();
            seekToTime(totalSec);
          }
        }}
        className={`quad-reel-seekbar-wrap group absolute inset-x-0 h-6 flex items-end z-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
          hasRealVideo && totalSec > 0 ? 'cursor-pointer' : 'pointer-events-none'
        }`}
      >
        <div
          className={`w-full quad-reel-progress-track relative transition-[height] duration-150 ${
            isDraggingSeek ? 'h-2' : 'h-1 group-hover:h-2'
          }`}
        >
          <div
            className="h-full bg-accent relative"
            style={{ width: `${progress}%` }}
          >
            {hasRealVideo && totalSec > 0 && (
              <span
                className={`absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-3 h-3 rounded-full bg-canvas border-2 border-accent transition-opacity duration-150 ${
                  isDraggingSeek ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100'
                }`}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const REEL_MUTE_STORAGE_KEY = 'quad_reels_muted';

function readInitialSessionMute(): boolean {
  try {
    const stored = window.sessionStorage.getItem(REEL_MUTE_STORAGE_KEY);
    if (stored === 'false') return false;
    if (stored === 'true') return true;
  } catch {
    // ignore storage access issues
  }
  return true;
}

/* ─── Dedicated Campus Reels Screen ─── */
export default function ReelsScreen({
  onNavigate: _onNavigate,
  onOpenPeerProfile,
}: {
  onNavigate?: (screen: string) => void;
  onOpenPeerProfile?: (username: string, fallbackPeer?: import('../types/quad').PeerUser) => void;
}) {
  const { state, markReelsSeen, toggleReelLike } = useApp();
  const { showToast } = useToast();
  const shouldReduceMotion = useReducedMotion();
  const reels = useMemo(() => state.reels || [], [state.reels]);

  const [visibleReelId, setVisibleReelId] = useState<string | number | null>(
    reels[0]?.id ?? null
  );
  const [isPageVisible, setIsPageVisible] = useState(true);
  const [isMuted, setIsMuted] = useState<boolean>(readInitialSessionMute);
  const [savedMap, setSavedMap] = useState<Record<string | number, boolean>>({});
  const [shareCountMap, setShareCountMap] = useState<Record<string | number, number>>({});
  const [commentsOpen, setCommentsOpen] = useState(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const slideRefs = useRef<Record<string | number, HTMLDivElement | null>>({});
  const cardControlsRef = useRef<Record<string, ReelCardControls>>({});

  const registerCardControls = useCallback(
    (id: string | number, controls: ReelCardControls | null) => {
      const key = String(id);
      if (controls) {
        cardControlsRef.current[key] = controls;
      } else {
        delete cardControlsRef.current[key];
      }
    },
    []
  );

  // Persist mute preference for this browser session across reels
  useEffect(() => {
    try {
      window.sessionStorage.setItem(REEL_MUTE_STORAGE_KEY, String(isMuted));
    } catch {
      // ignore storage errors
    }
  }, [isMuted]);

  // Clear unseen badge once user opens the Reels screen
  useEffect(() => {
    markReelsSeen?.();
  }, [markReelsSeen]);

  // Pause active playback if browser tab leaves foreground
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
    (idx: number) => {
      const targetReel = reels[idx];
      if (!targetReel || !slideRefs.current[targetReel.id]) return;
      slideRefs.current[targetReel.id]?.scrollIntoView({
        behavior: shouldReduceMotion ? 'auto' : 'smooth',
        block: 'start',
      });
    },
    [reels, shouldReduceMotion]
  );

  const activeReelId = visibleReelId ?? reels[0]?.id ?? null;
  const activeReel = useMemo(
    () => reels.find((r) => String(r.id) === String(activeReelId)) || reels[0] || null,
    [activeReelId, reels]
  );

  // Keyboard shortcuts (Space, M, ArrowLeft/Right +-5s, ArrowUp/Down/J/K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) {
        return;
      }

      const activeIdx = reels.findIndex((r) => String(r.id) === String(activeReelId));
      const current = activeIdx >= 0 ? activeIdx : 0;
      const activeControls = activeReelId !== null ? cardControlsRef.current[String(activeReelId)] : undefined;

      if (e.key === ' ') {
        if (tag === 'BUTTON' && target?.getAttribute('role') !== 'button') return;
        e.preventDefault();
        activeControls?.togglePlay();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        activeControls?.seekBy(-5);
        activeControls?.showControls?.();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        activeControls?.seekBy(5);
        activeControls?.showControls?.();
      } else if (['ArrowDown', 'j', 'J'].includes(e.key)) {
        e.preventDefault();
        if (current < reels.length - 1) scrollToIndex(current + 1);
      } else if (['ArrowUp', 'k', 'K'].includes(e.key)) {
        e.preventDefault();
        if (current > 0) scrollToIndex(current - 1);
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        activeControls?.showControls?.();
        setIsMuted((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeReelId, reels, scrollToIndex]);

  const toggleLike = async (id: string | number) => {
    await toggleReelLike(id);
  };

  const toggleSave = (id: string | number) => {
    setSavedMap((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleShare = (reel: import('../types/quad').ReelItem) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href).catch(() => {});
    }
    setShareCountMap((prev) => ({ ...prev, [reel.id]: (prev[reel.id] || 0) + 1 }));
    showToast(`Copied link to @${reel.username}'s reel`, 'success');
  };

  if (reels.length === 0) {
    return (
      <div className="w-full py-12">
        <EmptyState
          icon={Film}
          title="No Campus Reels Yet"
          description="Technical demonstrations and campus videos shared by verified students will stream here."
        />
      </div>
    );
  }

  return (
    <div className="w-full flex items-start justify-center gap-6">
      {/* Main Vertical 9:16 Snap-Scroll Player Container */}
      <div
        ref={containerRef}
        role="region"
        aria-label="Vertical Campus Reels feed"
        className="flex-1 min-w-0 quad-reel-viewport overflow-y-scroll snap-y snap-mandatory no-scrollbar flex flex-col items-center"
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
              isInView={isPageVisible && String(activeReelId ?? '') === String(reel.id)}
              isMuted={isMuted}
              onToggleMute={() => setIsMuted((prev) => !prev)}
              liked={Boolean(reel.isLiked)}
              onToggleLike={toggleLike}
              saved={Boolean(savedMap[reel.id])}
              onToggleSave={toggleSave}
              onOpenComments={(r) => {
                if (commentsOpen && String(activeReel?.id) === String(r.id)) {
                  setCommentsOpen(false);
                } else {
                  setVisibleReelId(r.id);
                  setCommentsOpen(true);
                }
              }}
              onShare={handleShare}
              onOpenProfile={onOpenPeerProfile}
              shareCountOffset={shareCountMap[reel.id] || 0}
              onRegisterControls={registerCardControls}
            />
          </div>
        ))}
      </div>

      {/* Desktop right-hand comments panel (340px) & responsive narrow bottom sheet */}
      <ReelCommentsPanel
        reel={activeReel}
        isOpen={commentsOpen}
        onClose={() => setCommentsOpen(false)}
        mode="split"
      />
    </div>
  );
}
