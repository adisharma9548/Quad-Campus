import type { ReelItem } from '../types/quad';

/** Format a clip length in seconds as `m:ss`, or return `''` when missing/invalid. */
export function formatTotalSeconds(seconds: number | null | undefined): string {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds <= 0) {
    return '';
  }
  const safe = Math.max(0, Math.round(seconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

/** Format an active playback cursor position (`Math.floor` so `0:00` advances cleanly). */
export function formatPlaybackSeconds(seconds: number | null | undefined): string {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds < 0) {
    return '0:00';
  }
  const safe = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

/** Resolve the authoritative duration badge string (`m:ss`) or `''` if unknown/processing. */
export function resolveReelDurationLabel(reel: Pick<ReelItem, 'duration' | 'durationSec' | 'status'>): string {
  if (reel.status === 'processing' || reel.status === 'failed') {
    return '';
  }
  if (typeof reel.durationSec === 'number' && Number.isFinite(reel.durationSec) && reel.durationSec > 0) {
    return formatTotalSeconds(reel.durationSec);
  }
  const raw = String(reel.duration || '').trim();
  return /^\d+:\d{2}$/.test(raw) ? raw : '';
}
