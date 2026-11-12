import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Heart,
  MessageSquare,
  Share2,
  Bookmark,
  Music,
  Film,
  Send,
  Loader2,
  AlertCircle,
  RotateCcw,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { IS_REAL_BACKEND, apiRequest, resolveApiMediaUrl } from '../services/apiClient';
import {
  formatPlaybackSeconds,
  formatTotalSeconds,
  resolveReelDurationLabel,
} from '../utils/formatDuration';
import type { ReelCommentItem } from '../types/quad';
import {
  Avatar,
  Badge,
  Modal,
  Button,
  EmptyState,
  Skeleton,
} from '../components/ui';

export interface ReelCardControls {
  togglePlay: () => void;
  seekBy: (deltaSec: number) => void;
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
  shareCountOffset = 0,
  onRegisterControls,
}: ReelCardProps) {
  const shouldReduceMotion = useReducedMotion();
  const [userPaused, setUserPaused] = useState(false);
  const [flashIcon, setFlashIcon] = useState<'play' | 'pause' | null>(null);
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
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const bgVideoRef = useRef<HTMLVideoElement | null>(null);
  const seekTrackRef = useRef<HTMLDivElement | null>(null);
  const flashTimerRef = useRef<number | null>(null);
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

  // Reset pause state when scrolled off-screen
  useEffect(() => {
    if (!isInView) {
      const v = videoRef.current;
      if (v) v.pause();
      bgVideoRef.current?.pause();
      const resetTimer = setTimeout(() => {
        setUserPaused(false);
        setIsBuffering(false);
        setFlashIcon(null);
      }, 0);
      return () => clearTimeout(resetTimer);
    }
    return undefined;
  }, [isInView]);

  const triggerFlashIcon = useCallback((kind: 'play' | 'pause') => {
    if (flashTimerRef.current) {
      window.clearTimeout(flashTimerRef.current);
    }
    setFlashIcon(kind);
    flashTimerRef.current = window.setTimeout(() => {
      setFlashIcon(null);
      flashTimerRef.current = null;
    }, 450);
  }, []);

  useEffect(() => {
    return () => {
      if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current);
    };
  }, []);

  const togglePlayPause = useCallback(() => {
    if (!hasRealVideo || videoError) return;
    setUserPaused((prev) => {
      const nextPaused = !prev;
      triggerFlashIcon(nextPaused ? 'pause' : 'play');
      return nextPaused;
    });
  }, [hasRealVideo, triggerFlashIcon, videoError]);

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
    onRegisterControls(reel.id, { togglePlay: togglePlayPause, seekBy });
    return () => onRegisterControls(reel.id, null);
  }, [onRegisterControls, reel.id, seekBy, togglePlayPause]);

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

  return (
    <div
      ref={slideRef}
      data-reel-id={reel.id}
      onContextMenu={(e) => e.preventDefault()}
      className="h-full max-h-full aspect-[9/16] max-w-full rounded-[16px] bg-canvas border border-ink/12 overflow-hidden relative flex flex-col justify-between p-4 pb-6 select-none text-ink"
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

        {/* Paused Overlay */}
        <AnimatePresence>
          {hasRealVideo && !videoError && (!isPlaying || userPaused) && (
            <motion.div
              initial={shouldReduceMotion ? { opacity: 1 } : { scale: 0.9, opacity: 0 }}
              animate={shouldReduceMotion ? { opacity: 1 } : { scale: 1, opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: shouldReduceMotion ? 0 : 0.15, ease: [0.4, 0, 0.2, 1] }}
              className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none bg-canvas/40"
            >
              <div className="w-16 h-16 rounded-full bg-canvas border border-ink/12 text-ink flex items-center justify-center">
                <Play size={24} fill="currentColor" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Play / Pause Center Flash Feedback */}
        <AnimatePresence>
          {hasRealVideo && !videoError && flashIcon === 'play' && (
            <motion.div
              key="flash-play"
              initial={shouldReduceMotion ? { opacity: 1 } : { scale: 0.75, opacity: 0 }}
              animate={shouldReduceMotion ? { opacity: 1 } : { scale: 1, opacity: 1 }}
              exit={{ scale: 1.15, opacity: 0 }}
              transition={{ duration: shouldReduceMotion ? 0 : 0.2 }}
              className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none"
            >
              <div className="w-16 h-16 rounded-full bg-canvas/90 border border-ink/12 text-ink flex items-center justify-center">
                <Play size={24} fill="currentColor" />
              </div>
            </motion.div>
          )}
          {hasRealVideo && !videoError && flashIcon === 'pause' && (
            <motion.div
              key="flash-pause"
              initial={shouldReduceMotion ? { opacity: 1 } : { scale: 0.75, opacity: 0 }}
              animate={shouldReduceMotion ? { opacity: 1 } : { scale: 1, opacity: 1 }}
              exit={{ scale: 1.15, opacity: 0 }}
              transition={{ duration: shouldReduceMotion ? 0 : 0.2 }}
              className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none"
            >
              <div className="w-16 h-16 rounded-full bg-canvas/90 border border-ink/12 text-ink flex items-center justify-center">
                <Pause size={24} fill="currentColor" />
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

      {/* Top Controls: Tag + Real Synced Duration Pill & Mute Toggle */}
      <div className="relative z-20 flex items-center justify-between gap-2 pointer-events-none">
        <div className="flex items-center gap-2 pointer-events-auto">
          <Badge variant="status">{reel.tag}</Badge>
          {isProcessing ? (
            <span className="px-2 py-1 rounded-full bg-canvas border border-ink/12 text-xs font-semibold text-ink inline-flex items-center gap-1">
              <Loader2 size={12} className="animate-spin" aria-hidden="true" />
              <span>Processing</span>
            </span>
          ) : durationBadgeLabel ? (
            <span
              data-testid="reel-duration-pill"
              className="px-2 py-1 rounded-full bg-canvas border border-ink/12 text-xs font-semibold text-ink tabular-nums"
            >
              {hasRealVideo && (currentTimeSec > 0 || videoLoadedData)
                ? `${formatPlaybackSeconds(currentTimeSec)} / ${durationBadgeLabel}`
                : durationBadgeLabel}
            </span>
          ) : null}
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleMute();
          }}
          aria-pressed={!isMuted}
          aria-label={isMuted ? 'Unmute reel audio' : 'Mute reel audio'}
          className="pointer-events-auto min-h-[44px] min-w-[44px] p-2 rounded-full bg-canvas border border-ink/12 text-ink hover:bg-ink/8 active:bg-ink/12 transition-colors duration-150 cursor-pointer flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
        </button>
      </div>

      {/* Bottom Creator Card + Right Action Rail */}
      <div className="relative z-20 flex items-end justify-between gap-3 pointer-events-none pt-6">
        <div className="pointer-events-auto space-y-2 flex-1 min-w-0 bg-canvas p-3 rounded-[16px] border border-ink/12">
          <div className="flex items-center gap-2 min-w-0">
            <Avatar initials={reel.initials} size={40} />
            <div className="min-w-0">
              <p className="text-sm font-semibold tracking-tight text-ink truncate">
                @{reel.username}
              </p>
              <p className="text-xs text-ink/60 truncate">
                {reel.branch && reel.year
                  ? `${reel.branch} • ${reel.year} Year`
                  : 'Campus Member'}
              </p>
            </div>
          </div>

          {reel.caption && (
            <p className="text-xs text-ink leading-relaxed line-clamp-3 break-words">
              {reel.caption}
            </p>
          )}

          <div className="inline-flex items-center gap-2 px-2 py-1 rounded-full bg-ink/6 border border-ink/12 text-xs text-ink/60 max-w-full">
            <Music size={16} className="shrink-0" />
            <span className="truncate">Original Audio • {reel.tag}</span>
          </div>
        </div>

        {/* Right Action Rail: Like (filled Ink heart), Comment, Share, Save */}
        <div className="pointer-events-auto flex flex-col items-center gap-2 shrink-0">
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

      {/* Interactive Seek Bar */}
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
        className={`group absolute inset-x-0 bottom-0 h-6 flex items-end z-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
          hasRealVideo && totalSec > 0 ? 'cursor-pointer' : 'pointer-events-none'
        }`}
      >
        <div
          className={`w-full bg-ink/16 relative transition-[height] duration-150 ${
            isDraggingSeek ? 'h-2' : 'h-1.5 group-hover:h-2'
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
}: {
  onNavigate?: (screen: string) => void;
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
  const [commentReel, setCommentReel] = useState<import('../types/quad').ReelItem | null>(null);
  const [reelComments, setReelComments] = useState<ReelCommentItem[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentInput, setCommentInput] = useState('');

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

  // Keyboard shortcuts (Space, M, ArrowLeft/Right +-5s, ArrowUp/Down/J/K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (commentReel) return;
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
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        activeControls?.seekBy(5);
      } else if (['ArrowDown', 'j', 'J'].includes(e.key)) {
        e.preventDefault();
        if (current < reels.length - 1) scrollToIndex(current + 1);
      } else if (['ArrowUp', 'k', 'K'].includes(e.key)) {
        e.preventDefault();
        if (current > 0) scrollToIndex(current - 1);
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        setIsMuted((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeReelId, commentReel, reels, scrollToIndex]);

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

  useEffect(() => {
    if (!commentReel) {
      setReelComments([]);
      return;
    }
    if (!IS_REAL_BACKEND) return;
    let active = true;
    setCommentsLoading(true);
    apiRequest<{ items?: ReelCommentItem[] }>(`/reels/${encodeURIComponent(commentReel.id)}/comments`)
      .then((res) => {
        if (active) setReelComments(res?.items || []);
      })
      .catch(() => {
        if (active) setReelComments([]);
      })
      .finally(() => {
        if (active) setCommentsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [commentReel]);

  const handlePostComment = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!commentInput.trim() || !commentReel) return;
    if (commentReel.commentsEnabled === false) {
      showToast('Comments are turned off for this reel', 'info');
      return;
    }
    const content = commentInput.trim();
    if (!IS_REAL_BACKEND) {
      setReelComments((prev) => [
        ...prev,
        {
          id: `rc_${Date.now()}`,
          username: state.username || 'quantum_dev',
          initials: state.userInitials || 'QD',
          content,
          timestamp: 'Just now',
        },
      ]);
      showToast('Comment posted to reel', 'success');
      setCommentInput('');
      return;
    }
    try {
      const created = await apiRequest<ReelCommentItem>(
        `/reels/${encodeURIComponent(commentReel.id)}/comments`,
        { method: 'POST', body: { content } }
      );
      setReelComments((prev) => [...prev, created]);
      setCommentInput('');
      showToast('Comment posted to reel', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to post comment', 'error');
    }
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
              isInView={isPageVisible && String(activeReelId ?? '') === String(reel.id)}
              isMuted={isMuted}
              onToggleMute={() => setIsMuted((prev) => !prev)}
              liked={Boolean(reel.isLiked)}
              onToggleLike={toggleLike}
              saved={Boolean(savedMap[reel.id])}
              onToggleSave={toggleSave}
              onOpenComments={(r) => setCommentReel(r)}
              onShare={handleShare}
              shareCountOffset={shareCountMap[reel.id] || 0}
              onRegisterControls={registerCardControls}
            />
          </div>
        ))}
      </div>

      {/* Comments Sheet Modal */}
      <Modal
        variant="sheet"
        isOpen={Boolean(commentReel)}
        onClose={() => setCommentReel(null)}
        title={`Comments (${commentReel ? Math.max(commentReel.comments || 0, reelComments.length) : 0})`}
        description={commentReel ? `Discussion on @${commentReel.username}'s demo` : ''}
        size="lg"
      >
        <div className="space-y-4">
          <div className="max-h-[45vh] overflow-y-auto space-y-3 pr-1 text-xs">
            {commentsLoading ? (
              <p className="text-ink/60 py-4 text-center">Loading comments...</p>
            ) : reelComments.length === 0 ? (
              <p className="text-ink/60 py-4 text-center">
                {commentReel?.commentsEnabled === false
                  ? 'Comments are turned off for this reel.'
                  : 'No comments yet. Start the discussion below.'}
              </p>
            ) : (
              reelComments.map((c) => (
                <div
                  key={c.id}
                  className="flex items-start gap-3 p-3 rounded-[8px] bg-ink/6 border border-ink/12"
                >
                  <Avatar initials={c.initials} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-ink">@{c.username}</p>
                      <span className="text-ink/60">• {c.timestamp}</span>
                    </div>
                    <p className="text-ink/80 mt-1 leading-relaxed">{c.content}</p>
                  </div>
                </div>
              ))
            )}
          </div>

          {commentReel?.commentsEnabled === false ? (
            <div className="pt-3 border-t border-ink/12 text-center text-xs font-semibold text-ink/60">
              Comments have been turned off by @{commentReel.username}.
            </div>
          ) : (
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
          )}
        </div>
      </Modal>
    </div>
  );
}
