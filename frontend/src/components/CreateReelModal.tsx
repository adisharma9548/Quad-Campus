import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  X,
  Upload,
  Film,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Scissors,
  Image as ImageIcon,
  Globe,
  Users,
  MessageSquareOff,
  Check,
  AlertCircle,
  RotateCcw,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { Button, Avatar } from './ui';
import type { PeerUser } from '../types/quad';

const MAX_REEL_BYTES = 100 * 1024 * 1024;
const MAX_REEL_SECONDS = 90;
const MIN_CLIP_SECONDS = 3;
const CAPTION_MAX = 2200;

const SUGGESTED_CAMPUS_TAGS = [
  'Robotics',
  'Systems',
  'AI_ML',
  'IoT',
  'CampusReel',
  'BTechLife',
  'Algorithms',
  'Electronics',
  'Placements',
  'HostelDiaries',
];

function formatTimeSec(sec: number): string {
  const safe = Math.max(0, Math.round(sec));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

function isSupportedVideoFile(file: File): boolean {
  const name = file.name.toLowerCase();
  const type = (file.type || '').toLowerCase();
  return (
    type === 'video/mp4' ||
    type === 'video/quicktime' ||
    name.endsWith('.mp4') ||
    name.endsWith('.mov')
  );
}

export interface CreateReelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: () => void;
}

export default function CreateReelModal({
  isOpen,
  onClose,
  onCreated,
}: CreateReelModalProps) {
  const { state, createReel, searchMentionUsers } = useApp();
  const { showToast } = useToast();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [videoError, setVideoError] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);

  const [durationSec, setDurationSec] = useState<number>(15);
  const [videoDims, setVideoDims] = useState<{ w: number; h: number }>({ w: 9, h: 16 });
  const [fitMode, setFitMode] = useState<'fit' | 'crop'>('crop');

  const [trimStart, setTrimStart] = useState<number>(0);
  const [trimEnd, setTrimEnd] = useState<number>(15);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [isMuted, setIsMuted] = useState<boolean>(true);

  const [filmstripFrames, setFilmstripFrames] = useState<string[]>([]);
  const [selectedFrameIdx, setSelectedFrameIdx] = useState<number>(0);
  const [customCoverFile, setCustomCoverFile] = useState<File | null>(null);
  const [customCoverPreview, setCustomCoverPreview] = useState<string>('');

  const [caption, setCaption] = useState('');
  const [audience, setAudience] = useState<'campus' | 'followers'>('campus');
  const [commentsDisabled, setCommentsDisabled] = useState(false);

  const [autocompleteMode, setAutocompleteMode] = useState<'mention' | 'hashtag' | null>(null);
  const [autocompleteQuery, setAutocompleteQuery] = useState('');
  const [mentionSuggestions, setMentionSuggestions] = useState<PeerUser[]>([]);

  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState('');
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const coverInputRef = useRef<HTMLInputElement | null>(null);
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);
  const bgVideoRef = useRef<HTMLVideoElement | null>(null);
  const trimBarRef = useRef<HTMLDivElement | null>(null);
  const draggingHandleRef = useRef<'start' | 'end' | null>(null);
  const abortCtrlRef = useRef<AbortController | null>(null);

  const aspectRatio = videoDims.h > 0 ? videoDims.w / videoDims.h : 9 / 16;
  const isNineSixteen = Math.abs(aspectRatio - 9 / 16) <= 0.06;
  const hasProgress = Boolean(videoFile) || caption.trim().length > 0;

  const minSpan = Math.min(MIN_CLIP_SECONDS, durationSec || MIN_CLIP_SECONDS);

  const resetAll = useCallback(() => {
    abortCtrlRef.current?.abort();
    abortCtrlRef.current = null;
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    if (customCoverPreview) URL.revokeObjectURL(customCoverPreview);
    setStep(1);
    setVideoFile(null);
    setVideoUrl('');
    setVideoError('');
    setIsDragging(false);
    setDurationSec(15);
    setVideoDims({ w: 9, h: 16 });
    setFitMode('crop');
    setTrimStart(0);
    setTrimEnd(15);
    setIsPlaying(true);
    setIsMuted(true);
    setFilmstripFrames([]);
    setSelectedFrameIdx(0);
    setCustomCoverFile(null);
    setCustomCoverPreview('');
    setCaption('');
    setAudience('campus');
    setCommentsDisabled(false);
    setAutocompleteMode(null);
    setAutocompleteQuery('');
    setMentionSuggestions([]);
    setUploading(false);
    setUploadProgress(0);
    setUploadError('');
    setShowDiscardConfirm(false);
  }, [customCoverPreview, videoUrl]);

  const requestClose = useCallback(() => {
    if (uploading) return;
    if (hasProgress) {
      setShowDiscardConfirm(true);
    } else {
      resetAll();
      onClose();
    }
  }, [hasProgress, onClose, resetAll, uploading]);

  // Esc key handling
  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (showDiscardConfirm) {
          setShowDiscardConfirm(false);
        } else {
          requestClose();
        }
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, requestClose, showDiscardConfirm]);

  // Cleanup URLs on unmount
  useEffect(() => {
    return () => {
      if (videoUrl) URL.revokeObjectURL(videoUrl);
      if (customCoverPreview) URL.revokeObjectURL(customCoverPreview);
    };
  }, [customCoverPreview, videoUrl]);

  // Extract up to 6 cover thumbnails from video frames
  const generateFilmstrip = useCallback(async (srcUrl: string, dur: number, startSec: number, endSec: number) => {
    if (typeof document === 'undefined' || !srcUrl || dur <= 0) return;
    const vid = document.createElement('video');
    vid.muted = true;
    vid.playsInline = true;
    vid.preload = 'auto';
    vid.src = srcUrl;

    await new Promise<void>((resolve) => {
      const done = () => resolve();
      vid.onloadeddata = done;
      vid.onerror = done;
      setTimeout(done, 1500);
    });

    const w = vid.videoWidth || 180;
    const h = vid.videoHeight || 320;
    if (!w || !h) return;

    const canvas = document.createElement('canvas');
    const targetW = 144;
    const targetH = Math.max(96, Math.round((targetW * h) / w));
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const span = Math.max(0.5, endSec - startSec);
    const frameCount = 6;
    const captures: string[] = [];

    for (let i = 0; i < frameCount; i++) {
      const seekTime = Math.min(dur - 0.05, Math.max(0, startSec + (span * i) / Math.max(1, frameCount - 1)));
      try {
        await new Promise<void>((resolve) => {
          const onSeeked = () => {
            vid.removeEventListener('seeked', onSeeked);
            resolve();
          };
          vid.addEventListener('seeked', onSeeked);
          vid.currentTime = seekTime;
          setTimeout(() => {
            vid.removeEventListener('seeked', onSeeked);
            resolve();
          }, 450);
        });
        ctx.drawImage(vid, 0, 0, targetW, targetH);
        captures.push(canvas.toDataURL('image/jpeg', 0.72));
      } catch {
        break;
      }
    }

    if (captures.length > 0) {
      setFilmstripFrames(captures);
      setSelectedFrameIdx(0);
    }
  }, []);

  const processSelectedFile = async (file: File) => {
    setVideoError('');
    if (!isSupportedVideoFile(file)) {
      setVideoError('Only MP4 (.mp4) and MOV (.mov) videos are supported.');
      return;
    }
    if (file.size > MAX_REEL_BYTES) {
      setVideoError('Video is too large. Maximum allowed size is 100 MB.');
      return;
    }

    const nextUrl = URL.createObjectURL(file);
    const probe = document.createElement('video');
    probe.preload = 'metadata';
    probe.src = nextUrl;

    const metaResult = await new Promise<{ ok: boolean; duration: number; w: number; h: number }>((resolve) => {
      const finish = (ok: boolean) => {
        resolve({
          ok,
          duration: Number.isFinite(probe.duration) ? probe.duration : 0,
          w: probe.videoWidth || 0,
          h: probe.videoHeight || 0,
        });
      };
      probe.onloadedmetadata = () => finish(true);
      probe.onerror = () => finish(false);
      setTimeout(() => finish(false), 3000);
    });

    if (!metaResult.ok || metaResult.duration <= 0) {
      URL.revokeObjectURL(nextUrl);
      setVideoError('Unable to read video metadata. Please choose a valid MP4 or MOV file.');
      return;
    }
    if (metaResult.duration > MAX_REEL_SECONDS) {
      URL.revokeObjectURL(nextUrl);
      setVideoError(
        `Video is ${Math.ceil(metaResult.duration)}s long. Reels can be at most 90 seconds.`
      );
      return;
    }

    if (videoUrl) URL.revokeObjectURL(videoUrl);
    const dur = Math.min(MAX_REEL_SECONDS, metaResult.duration);
    const w = metaResult.w || 720;
    const h = metaResult.h || 1280;
    const aspect = w / h;
    const initialFit = Math.abs(aspect - 9 / 16) <= 0.06 ? 'crop' : 'fit';

    setVideoFile(file);
    setVideoUrl(nextUrl);
    setDurationSec(dur);
    setVideoDims({ w, h });
    setFitMode(initialFit);
    setTrimStart(0);
    setTrimEnd(dur);
    setFilmstripFrames([]);
    setSelectedFrameIdx(0);
    void generateFilmstrip(nextUrl, dur, 0, dur);
  };

  // Sync Step 2 video preview looping within [trimStart, trimEnd]
  useEffect(() => {
    if (step !== 2 || !previewVideoRef.current) return;
    const v = previewVideoRef.current;
    v.muted = isMuted;
    if (isPlaying) {
      v.play().catch(() => {});
    } else {
      v.pause();
    }
    if (bgVideoRef.current) {
      bgVideoRef.current.muted = true;
      bgVideoRef.current.currentTime = v.currentTime;
      if (isPlaying) bgVideoRef.current.play().catch(() => {});
      else bgVideoRef.current.pause();
    }
  }, [step, isPlaying, isMuted]);

  const handleVideoTimeUpdate = () => {
    const v = previewVideoRef.current;
    if (!v) return;
    if (v.currentTime < trimStart) {
      v.currentTime = trimStart;
    } else if (v.currentTime >= trimEnd) {
      v.currentTime = trimStart;
    }
    if (bgVideoRef.current && Math.abs(bgVideoRef.current.currentTime - v.currentTime) > 0.25) {
      bgVideoRef.current.currentTime = v.currentTime;
    }
  };

  // Draggable dual trim handles
  useEffect(() => {
    const onPointerMove = (e: PointerEvent) => {
      const handle = draggingHandleRef.current;
      const bar = trimBarRef.current;
      if (!handle || !bar || durationSec <= 0) return;
      const rect = bar.getBoundingClientRect();
      const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / Math.max(1, rect.width)));
      const nextTime = Number((ratio * durationSec).toFixed(1));

      if (handle === 'start') {
        const clamped = Math.min(nextTime, trimEnd - minSpan);
        setTrimStart(Math.max(0, clamped));
        if (previewVideoRef.current) previewVideoRef.current.currentTime = Math.max(0, clamped);
      } else {
        const clamped = Math.max(nextTime, trimStart + minSpan);
        const bounded = Math.min(durationSec, Math.min(trimStart + MAX_REEL_SECONDS, clamped));
        setTrimEnd(bounded);
      }
    };
    const onPointerUp = () => {
      draggingHandleRef.current = null;
    };
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [durationSec, minSpan, trimEnd, trimStart]);

  // Autocomplete @mentions & #hashtags in Step 3
  const handleCaptionChange = (value: string) => {
    setCaption(value);
    const matchMention = value.match(/(?:^|\s)@([a-zA-Z0-9_]*)$/);
    if (matchMention) {
      const q = matchMention[1];
      setAutocompleteMode('mention');
      setAutocompleteQuery(q);
      searchMentionUsers(q)
        .then((users) => setMentionSuggestions(users))
        .catch(() => setMentionSuggestions([]));
      return;
    }
    const matchTag = value.match(/(?:^|\s)#([a-zA-Z0-9_]*)$/);
    if (matchTag) {
      setAutocompleteMode('hashtag');
      setAutocompleteQuery(matchTag[1]);
      return;
    }
    setAutocompleteMode(null);
    setAutocompleteQuery('');
  };

  const hashtagSuggestions = useMemo(() => {
    const q = autocompleteQuery.toLowerCase();
    const topicTags = (state.trendingTopics || []).map((t) => t.tag.replace(/^#/, ''));
    const all = Array.from(new Set([...topicTags, ...SUGGESTED_CAMPUS_TAGS]));
    return all.filter((t) => !q || t.toLowerCase().includes(q)).slice(0, 6);
  }, [autocompleteQuery, state.trendingTopics]);

  const insertTokenCompletion = (prefix: '@' | '#', replacement: string) => {
    const pattern = prefix === '@' ? /@[a-zA-Z0-9_]*$/ : /#[a-zA-Z0-9_]*$/;
    setCaption((prev) => prev.replace(pattern, `${prefix}${replacement} `));
    setAutocompleteMode(null);
    setAutocompleteQuery('');
  };

  const activeCoverUrl =
    customCoverPreview || filmstripFrames[selectedFrameIdx] || '';

  const handleShareReel = async () => {
    if (!videoFile || uploading) return;
    setUploadError('');
    setUploading(true);
    setUploadProgress(5);
    const controller = new AbortController();
    abortCtrlRef.current = controller;

    const fd = new FormData();
    fd.append('video', videoFile);
    fd.append('caption', caption.trim());
    fd.append('durationSec', String(Number(durationSec.toFixed(2))));
    fd.append('trimStart', String(Number(trimStart.toFixed(2))));
    fd.append('trimEnd', String(Number(trimEnd.toFixed(2))));
    fd.append('fitMode', fitMode);
    fd.append('audience', audience);
    fd.append('commentsEnabled', String(!commentsDisabled));

    if (customCoverFile) {
      fd.append('cover', customCoverFile);
    } else if (filmstripFrames[selectedFrameIdx]) {
      fd.append('coverDataUrl', filmstripFrames[selectedFrameIdx]);
    }

    try {
      await createReel(fd, {
        onProgress: (pct) => setUploadProgress(pct),
        signal: controller.signal,
      });
      showToast('Reel shared to Campus Reels!', 'success');
      resetAll();
      onClose();
      onCreated?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to upload reel.';
      setUploadError(msg);
      setUploading(false);
    }
  };

  if (!isOpen) return null;

  const startPct = durationSec > 0 ? (trimStart / durationSec) * 100 : 0;
  const endPct = durationSec > 0 ? (trimEnd / durationSec) * 100 : 100;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/75 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Create Campus Reel"
      onClick={(e) => {
        if (e.target === e.currentTarget) requestClose();
      }}
    >
      <div className="w-full max-w-4xl bg-canvas border border-ink/12 rounded-[16px] overflow-hidden shadow-2xl relative flex flex-col max-h-[90dvh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-ink/12">
          <div className="flex items-center gap-2">
            <Film size={18} className="text-accent" aria-hidden="true" />
            <h2 className="text-sm font-bold text-ink">
              {step === 1
                ? 'Create Reel — Select video'
                : step === 2
                  ? 'Create Reel — Trim & Cover'
                  : 'Create Reel — Details & Share'}
            </h2>
          </div>

          <button
            type="button"
            aria-label="Close reel creator"
            onClick={requestClose}
            className="min-h-[40px] min-w-[40px] rounded-[8px] flex items-center justify-center text-ink/60 hover:text-ink hover:bg-ink/8 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1">
          {/* ─── STEP 1: SELECT VIDEO ─── */}
          {step === 1 && (
            <div className="space-y-4">
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  const dropped = e.dataTransfer.files?.[0];
                  if (dropped) void processSelectedFile(dropped);
                }}
                className={`border-2 border-dashed rounded-[16px] p-8 flex flex-col items-center justify-center text-center transition-colors min-h-[280px] ${
                  isDragging
                    ? 'border-accent bg-accent/8'
                    : 'border-ink/20 bg-ink/4 hover:border-ink/35'
                }`}
              >
                <div className="w-14 h-14 rounded-full bg-canvas border border-ink/12 flex items-center justify-center mb-4">
                  <Upload size={24} className="text-ink" />
                </div>
                <p className="text-base font-bold text-ink">Drag a video here</p>
                <p className="text-xs text-ink/60 mt-1 mb-4">
                  MP4 or MOV • up to 100 MB • up to 90 seconds • 9:16 portrait recommended
                </p>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".mp4,.mov,video/mp4,video/quicktime"
                  className="hidden"
                  onChange={(e) => {
                    const picked = e.target.files?.[0];
                    if (picked) void processSelectedFile(picked);
                    e.target.value = '';
                  }}
                />
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Select from computer
                </Button>

                {videoFile && !videoError && (
                  <p className="mt-4 text-xs font-semibold text-accent">
                    Selected: {videoFile.name} ({formatTimeSec(durationSec)} · {videoDims.w}×{videoDims.h})
                  </p>
                )}
              </div>

              {videoError && (
                <div
                  role="alert"
                  className="p-3 rounded-[10px] border border-danger/40 bg-danger/8 text-xs font-semibold text-danger flex items-center gap-2"
                >
                  <AlertCircle size={16} className="shrink-0" />
                  <span>{videoError}</span>
                </div>
              )}

              {videoFile && videoUrl && (
                <div className="p-4 rounded-[12px] border border-ink/12 bg-ink/4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-ink">
                      {isNineSixteen
                        ? '9:16 vertical framing ready'
                        : `Non-9:16 aspect detected (${videoDims.w}×${videoDims.h})`}
                    </p>
                    <p className="text-xs text-ink/60">
                      {isNineSixteen
                        ? 'Your clip fills the vertical Reels frame cleanly.'
                        : 'Choose whether to fit inside 9:16 with a blurred background or crop to fill.'}
                    </p>
                  </div>

                  {!isNineSixteen && (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => setFitMode('fit')}
                        className={`px-3 py-2 rounded-[8px] text-xs font-semibold border cursor-pointer ${
                          fitMode === 'fit'
                            ? 'bg-ink text-canvas border-ink'
                            : 'bg-canvas text-ink border-ink/12 hover:bg-ink/6'
                        }`}
                      >
                        Fit with blurred bg
                      </button>
                      <button
                        type="button"
                        onClick={() => setFitMode('crop')}
                        className={`px-3 py-2 rounded-[8px] text-xs font-semibold border cursor-pointer ${
                          fitMode === 'crop'
                            ? 'bg-ink text-canvas border-ink'
                            : 'bg-canvas text-ink border-ink/12 hover:bg-ink/6'
                        }`}
                      >
                        Crop to 9:16
                      </button>
                    </div>
                  )}

                  <Button
                    type="button"
                    variant="primary"
                    size="md"
                    onClick={() => setStep(2)}
                  >
                    Next: Edit
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* ─── STEP 2: EDIT (TRIM + COVER) ─── */}
          {step === 2 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              {/* Left: 9:16 Video Preview */}
              <div className="flex flex-col items-center gap-3">
                <div className="relative w-full max-w-[260px] aspect-[9/16] rounded-[16px] overflow-hidden border border-ink/12 bg-ink/10 flex items-center justify-center">
                  {fitMode === 'fit' && (
                    <video
                      ref={bgVideoRef}
                      src={videoUrl}
                      muted
                      playsInline
                      aria-hidden="true"
                      className="absolute inset-0 w-full h-full object-cover scale-110 blur-xl opacity-60 pointer-events-none"
                    />
                  )}
                  <video
                    ref={previewVideoRef}
                    src={videoUrl}
                    muted={isMuted}
                    playsInline
                    onTimeUpdate={handleVideoTimeUpdate}
                    onClick={() => setIsPlaying((p) => !p)}
                    className={`relative z-10 w-full h-full cursor-pointer ${
                      fitMode === 'fit' ? 'object-contain' : 'object-cover'
                    }`}
                  />

                  <div className="absolute bottom-3 left-3 right-3 z-20 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setIsPlaying((p) => !p)}
                      aria-label={isPlaying ? 'Pause preview' : 'Play preview'}
                      className="min-h-[36px] min-w-[36px] p-2 rounded-full bg-canvas/90 border border-ink/12 text-ink flex items-center justify-center cursor-pointer"
                    >
                      {isPlaying ? <Pause size={16} /> : <Play size={16} />}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsMuted((m) => !m)}
                      aria-label={isMuted ? 'Unmute preview' : 'Mute preview'}
                      className="min-h-[36px] min-w-[36px] p-2 rounded-full bg-canvas/90 border border-ink/12 text-ink flex items-center justify-center cursor-pointer"
                    >
                      {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Right: Trim Handles + Cover Picker */}
              <div className="space-y-6">
                <div className="p-4 rounded-[12px] border border-ink/12 bg-ink/4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-ink flex items-center gap-2">
                      <Scissors size={14} className="text-accent" />
                      <span>Trim clip (3s – 90s)</span>
                    </span>
                    <span className="text-xs font-mono text-ink/70">
                      {formatTimeSec(trimStart)} – {formatTimeSec(trimEnd)} ({Math.max(1, Math.round(trimEnd - trimStart))}s)
                    </span>
                  </div>

                  {/* Dual draggable handle track */}
                  <div
                    ref={trimBarRef}
                    className="relative h-8 rounded-[8px] bg-canvas border border-ink/12 overflow-visible select-none"
                  >
                    <div
                      className="absolute top-0 bottom-0 bg-accent/20 border-y-2 border-accent"
                      style={{
                        left: `${startPct}%`,
                        right: `${Math.max(0, 100 - endPct)}%`,
                      }}
                    />
                    <button
                      type="button"
                      aria-label="Trim start handle"
                      onPointerDown={() => {
                        draggingHandleRef.current = 'start';
                      }}
                      className="absolute top-0 bottom-0 w-3 -ml-1 rounded bg-accent border border-canvas shadow cursor-ew-resize"
                      style={{ left: `${startPct}%` }}
                    />
                    <button
                      type="button"
                      aria-label="Trim end handle"
                      onPointerDown={() => {
                        draggingHandleRef.current = 'end';
                      }}
                      className="absolute top-0 bottom-0 w-3 -ml-2 rounded bg-accent border border-canvas shadow cursor-ew-resize"
                      style={{ left: `${endPct}%` }}
                    />
                  </div>

                  {/* Accessible precision sliders */}
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <label className="space-y-1">
                      <span className="text-ink/70 block">Start ({trimStart.toFixed(1)}s)</span>
                      <input
                        type="range"
                        min={0}
                        max={Math.max(0, Number((trimEnd - minSpan).toFixed(1)))}
                        step={0.5}
                        value={trimStart}
                        onChange={(e) => {
                          const val = Math.min(Number(e.target.value), trimEnd - minSpan);
                          setTrimStart(Math.max(0, val));
                          if (previewVideoRef.current) previewVideoRef.current.currentTime = val;
                        }}
                        className="w-full"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-ink/70 block">End ({trimEnd.toFixed(1)}s)</span>
                      <input
                        type="range"
                        min={Number(Math.min(durationSec, trimStart + minSpan).toFixed(1))}
                        max={Number(Math.min(durationSec, trimStart + MAX_REEL_SECONDS).toFixed(1))}
                        step={0.5}
                        value={trimEnd}
                        onChange={(e) => setTrimEnd(Number(e.target.value))}
                        className="w-full"
                      />
                    </label>
                  </div>
                </div>

                {/* Cover Picker */}
                <div className="p-4 rounded-[12px] border border-ink/12 bg-ink/4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-ink flex items-center gap-2">
                      <ImageIcon size={14} className="text-accent" />
                      <span>Cover image</span>
                    </span>
                    <div>
                      <input
                        ref={coverInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        onChange={(e) => {
                          const img = e.target.files?.[0];
                          if (!img) return;
                          if (customCoverPreview) URL.revokeObjectURL(customCoverPreview);
                          setCustomCoverFile(img);
                          setCustomCoverPreview(URL.createObjectURL(img));
                          e.target.value = '';
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => coverInputRef.current?.click()}
                        className="text-xs font-bold text-accent hover:underline cursor-pointer"
                      >
                        Upload from computer
                      </button>
                    </div>
                  </div>

                  {customCoverPreview ? (
                    <div className="flex items-center gap-3">
                      <img
                        src={customCoverPreview}
                        alt="Custom reel cover"
                        className="w-16 h-24 object-cover rounded-[8px] border border-accent"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          URL.revokeObjectURL(customCoverPreview);
                          setCustomCoverPreview('');
                          setCustomCoverFile(null);
                        }}
                        className="text-xs font-semibold text-ink/70 hover:text-ink underline cursor-pointer"
                      >
                        Use video frame instead
                      </button>
                    </div>
                  ) : filmstripFrames.length > 0 ? (
                    <div className="grid grid-cols-6 gap-2">
                      {filmstripFrames.map((src, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setSelectedFrameIdx(idx)}
                          aria-label={`Select cover frame ${idx + 1}`}
                          className={`aspect-[9/16] rounded-[8px] overflow-hidden border-2 cursor-pointer ${
                            selectedFrameIdx === idx ? 'border-accent' : 'border-ink/12 opacity-75 hover:opacity-100'
                          }`}
                        >
                          <img src={src} alt={`Frame ${idx + 1}`} className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-ink/60">
                      Filmstrip preview unavailable for this codec — first frame or custom cover will be used.
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between pt-2">
                  <Button type="button" variant="secondary" size="md" onClick={() => setStep(1)}>
                    Back
                  </Button>
                  <Button type="button" variant="primary" size="md" onClick={() => setStep(3)}>
                    Next
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* ─── STEP 3: DETAILS & SHARE ─── */}
          {step === 3 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              {/* Left: Cover Preview */}
              <div className="flex flex-col items-center gap-2">
                <div className="relative w-full max-w-[240px] aspect-[9/16] rounded-[16px] overflow-hidden border border-ink/12 bg-ink/8 flex items-center justify-center">
                  {activeCoverUrl ? (
                    <img
                      src={activeCoverUrl}
                      alt="Chosen reel cover"
                      className={`w-full h-full ${fitMode === 'fit' ? 'object-contain' : 'object-cover'}`}
                    />
                  ) : (
                    <video
                      src={videoUrl}
                      muted
                      playsInline
                      className={`w-full h-full ${fitMode === 'fit' ? 'object-contain' : 'object-cover'}`}
                    />
                  )}
                  <span className="absolute top-3 right-3 px-2 py-1 rounded-full bg-canvas/90 border border-ink/12 text-xs font-bold text-ink">
                    {formatTimeSec(trimEnd - trimStart)}
                  </span>
                </div>
              </div>

              {/* Right: Caption, Audience, Settings, Share */}
              <div className="space-y-4">
                <div className="relative space-y-1">
                  <div className="flex items-center justify-between">
                    <label htmlFor="reel-caption-input" className="text-xs font-bold text-ink">
                      Caption (#hashtags &amp; @mentions)
                    </label>
                    <span className="text-xs font-mono text-ink/60">
                      {caption.length} / {CAPTION_MAX}
                    </span>
                  </div>
                  <textarea
                    id="reel-caption-input"
                    rows={4}
                    maxLength={CAPTION_MAX}
                    value={caption}
                    onChange={(e) => handleCaptionChange(e.target.value)}
                    placeholder="Describe your campus demo... Use #tags or @mention peers"
                    className="w-full px-3 py-2 rounded-[10px] text-xs bg-canvas border border-ink/12 text-ink placeholder:text-ink/60 focus:outline-none focus:ring-2 focus:ring-accent resize-y"
                  />

                  {/* Autocomplete Dropdown */}
                  {autocompleteMode === 'mention' && mentionSuggestions.length > 0 && (
                    <div className="absolute left-0 right-0 z-30 mt-1 rounded-[10px] border border-ink/12 bg-canvas shadow-lg p-1 max-h-44 overflow-y-auto">
                      {mentionSuggestions.map((peer) => (
                        <button
                          key={peer.username}
                          type="button"
                          onClick={() => insertTokenCompletion('@', peer.username)}
                          className="w-full px-3 py-2 text-left text-xs hover:bg-ink/6 rounded-[8px] flex items-center gap-2 cursor-pointer"
                        >
                          <Avatar initials={peer.initials} size="sm" />
                          <span className="font-bold text-ink">@{peer.username}</span>
                          <span className="text-ink/60 ml-auto">
                            {peer.branch} · {peer.year}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  {autocompleteMode === 'hashtag' && hashtagSuggestions.length > 0 && (
                    <div className="absolute left-0 right-0 z-30 mt-1 rounded-[10px] border border-ink/12 bg-canvas shadow-lg p-1 max-h-44 overflow-y-auto">
                      {hashtagSuggestions.map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => insertTokenCompletion('#', tag)}
                          className="w-full px-3 py-2 text-left text-xs font-semibold text-accent hover:bg-ink/6 rounded-[8px] cursor-pointer"
                        >
                          #{tag}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Audience */}
                <div className="space-y-2">
                  <p className="text-xs font-bold text-ink">Audience</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setAudience('campus')}
                      className={`p-3 rounded-[10px] border text-left text-xs flex items-center gap-2 cursor-pointer ${
                        audience === 'campus'
                          ? 'border-ink bg-ink/6 font-bold text-ink'
                          : 'border-ink/12 text-ink/75 hover:bg-ink/4'
                      }`}
                    >
                      <Globe size={16} />
                      <span>Campus-wide</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setAudience('followers')}
                      className={`p-3 rounded-[10px] border text-left text-xs flex items-center gap-2 cursor-pointer ${
                        audience === 'followers'
                          ? 'border-ink bg-ink/6 font-bold text-ink'
                          : 'border-ink/12 text-ink/75 hover:bg-ink/4'
                      }`}
                    >
                      <Users size={16} />
                      <span>Followers only</span>
                    </button>
                  </div>
                </div>

                {/* Turn off comments */}
                <div className="flex items-center justify-between p-3 rounded-[10px] border border-ink/12 bg-ink/4">
                  <div className="flex items-center gap-2">
                    <MessageSquareOff size={16} className="text-ink/70" />
                    <div>
                      <p className="text-xs font-bold text-ink">Turn off comments</p>
                      <p className="text-xs text-ink/60">Prevent new comments on this reel</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={commentsDisabled}
                    aria-label="Turn off comments"
                    onClick={() => setCommentsDisabled((c) => !c)}
                    className={`w-11 h-6 rounded-full transition-colors p-1 cursor-pointer flex items-center ${
                      commentsDisabled ? 'bg-accent justify-end' : 'bg-ink/20 justify-start'
                    }`}
                  >
                    <span className="w-4 h-4 rounded-full bg-canvas shadow" />
                  </button>
                </div>

                {/* Upload progress / Retry */}
                {uploading && (
                  <div className="p-3 rounded-[10px] border border-ink/12 bg-ink/4 space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold text-ink">
                      <span>Uploading reel...</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-ink/12 overflow-hidden">
                      <div
                        className="h-full bg-accent transition-all"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => abortCtrlRef.current?.abort()}
                        className="text-xs font-bold text-danger hover:underline cursor-pointer"
                      >
                        Cancel upload
                      </button>
                    </div>
                  </div>
                )}

                {uploadError && !uploading && (
                  <div className="p-3 rounded-[10px] border border-danger/40 bg-danger/8 text-xs text-danger flex items-center justify-between gap-2">
                    <span className="font-semibold">{uploadError}</span>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      icon={RotateCcw}
                      onClick={handleShareReel}
                    >
                      Retry
                    </Button>
                  </div>
                )}

                <div className="flex items-center justify-between pt-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="md"
                    disabled={uploading}
                    onClick={() => setStep(2)}
                  >
                    Back
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    size="md"
                    icon={Check}
                    disabled={uploading || (!videoFile && !caption.trim())}
                    onClick={handleShareReel}
                  >
                    {uploading ? 'Sharing...' : 'Share'}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Discard Confirmation Overlay */}
        {showDiscardConfirm && (
          <div className="absolute inset-0 z-40 bg-ink/60 flex items-center justify-center p-4">
            <div className="w-full max-w-sm rounded-[16px] bg-canvas border border-ink/12 p-6 space-y-4 shadow-xl">
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-ink">Discard reel?</h3>
                <p className="text-xs text-ink/70">
                  If you leave now, your selected video, trim edits, and caption will be lost.
                </p>
              </div>
              <div className="flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowDiscardConfirm(false)}
                >
                  Keep editing
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    resetAll();
                    onClose();
                  }}
                >
                  Discard
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
