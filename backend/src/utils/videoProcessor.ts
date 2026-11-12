import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { FFMPEG_PATH, FFPROBE_PATH } from '../config/constants.ts';
import { sanitizeUploadedImage } from './exifStripper.ts';

const execFileAsync = promisify(execFile);

export interface VideoProbeResult {
  durationSec: number;
  width: number;
  height: number;
  hasAudio: boolean;
  videoCodec: string;
}

export interface TranscodeReelOptions {
  uploadDir: string;
  reelId: string;
  rawInputPath: string;
  fitMode: 'fit' | 'crop';
  trimStart: number;
  trimEnd: number;
  hasAudio: boolean;
  customCoverBuffer?: Buffer | null;
}

export interface TranscodeReelResult {
  videoRelPath: string;
  thumbnailRelPath: string;
  coverRelPath: string;
  durationSec: number;
  width: number;
  height: number;
}

export function resolveUploadPath(uploadDir: string, relativePath: string | null | undefined): string | null {
  if (!relativePath) return null;
  const base = path.resolve(uploadDir);
  const candidate = path.resolve(base, relativePath);
  if (candidate !== base && !candidate.startsWith(base + path.sep)) {
    return null;
  }
  return candidate;
}

let cachedToolsVerifiedKey = '';

export function assertMediaToolsAvailable(): void {
  const cacheKey = `${FFMPEG_PATH}|${FFPROBE_PATH}`;
  if (cachedToolsVerifiedKey === cacheKey) return;

  try {
    execFileSync(FFPROBE_PATH, ['-version'], { stdio: 'pipe', timeout: 10000 });
  } catch (err) {
    throw new Error(
      `ffprobe binary not found or failed to execute ("${FFPROBE_PATH}"). ` +
        `Install FFmpeg/ffprobe and ensure it is on PATH or set FFPROBE_PATH in .env. (${String((err as Error).message || err)})`
    );
  }

  let encodersOutput = '';
  try {
    execFileSync(FFMPEG_PATH, ['-version'], { stdio: 'pipe', timeout: 10000 });
    encodersOutput = execFileSync(FFMPEG_PATH, ['-hide_banner', '-encoders'], {
      encoding: 'utf8',
      stdio: 'pipe',
      timeout: 10000,
    });
  } catch (err) {
    throw new Error(
      `ffmpeg binary not found or failed to execute ("${FFMPEG_PATH}"). ` +
        `Install FFmpeg and ensure it is on PATH or set FFMPEG_PATH in .env. (${String((err as Error).message || err)})`
    );
  }

  if (!/\blibx264\b/.test(encodersOutput) || !/\baac\b/.test(encodersOutput)) {
    throw new Error(
      `ffmpeg ("${FFMPEG_PATH}") must support both libx264 and aac encoders for Reel transcoding.`
    );
  }

  cachedToolsVerifiedKey = cacheKey;
}

export async function probeVideo(filePath: string): Promise<VideoProbeResult> {
  const { stdout } = await execFileAsync(
    FFPROBE_PATH,
    [
      '-v',
      'error',
      '-print_format',
      'json',
      '-show_format',
      '-show_streams',
      filePath,
    ],
    { timeout: 20000, maxBuffer: 4 * 1024 * 1024 }
  );

  const parsed = JSON.parse(stdout) as {
    format?: { duration?: string | number };
    streams?: Array<{
      codec_type?: string;
      codec_name?: string;
      width?: number;
      height?: number;
      duration?: string | number;
    }>;
  };

  const streams = Array.isArray(parsed.streams) ? parsed.streams : [];
  const videoStream = streams.find((s) => s.codec_type === 'video');
  if (!videoStream) {
    throw Object.assign(new Error('Uploaded file does not contain a valid video stream.'), {
      status: 400,
      code: 'INVALID_VIDEO_STREAM',
    });
  }

  const rawDur =
    Number(parsed.format?.duration ?? 0) > 0
      ? Number(parsed.format?.duration)
      : Number(videoStream.duration ?? 0);

  if (!Number.isFinite(rawDur) || rawDur <= 0) {
    throw Object.assign(new Error('Could not read a valid video duration from uploaded file.'), {
      status: 400,
      code: 'INVALID_VIDEO_DURATION',
    });
  }

  const width = Number(videoStream.width || 0);
  const height = Number(videoStream.height || 0);
  const hasAudio = streams.some((s) => s.codec_type === 'audio');

  return {
    durationSec: Number(rawDur.toFixed(3)),
    width,
    height,
    hasAudio,
    videoCodec: String(videoStream.codec_name || 'unknown'),
  };
}

export async function transcodeReelVideo(opts: TranscodeReelOptions): Promise<TranscodeReelResult> {
  const relDir = path.posix.join('reels', opts.reelId);
  const absDir = path.join(path.resolve(opts.uploadDir), 'reels', opts.reelId);
  await fsp.mkdir(absDir, { recursive: true });

  const videoRelPath = path.posix.join(relDir, 'video.mp4');
  const thumbnailRelPath = path.posix.join(relDir, 'thumb.jpg');
  const coverRelPath = path.posix.join(relDir, 'cover.jpg');

  const tmpVideoPath = path.join(absDir, 'video.tmp.mp4');
  const finalVideoPath = path.join(absDir, 'video.mp4');
  const tmpThumbPath = path.join(absDir, 'thumb.tmp.jpg');
  const finalThumbPath = path.join(absDir, 'thumb.jpg');
  const finalCoverPath = path.join(absDir, 'cover.jpg');

  const safeStart = Math.max(0, Number.isFinite(opts.trimStart) ? opts.trimStart : 0);
  const clipDuration =
    Number.isFinite(opts.trimEnd) && opts.trimEnd > safeStart ? opts.trimEnd - safeStart : 0;

  const args: string[] = ['-y', '-hide_banner', '-loglevel', 'error'];
  if (safeStart > 0) {
    args.push('-ss', safeStart.toFixed(3));
  }
  args.push('-i', opts.rawInputPath);
  if (clipDuration > 0) {
    args.push('-t', clipDuration.toFixed(3));
  }

  if (opts.fitMode === 'fit') {
    args.push(
      '-filter_complex',
      '[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=20:2[bg];' +
        '[0:v]scale=1080:1920:force_original_aspect_ratio=decrease[fg];' +
        '[bg][fg]overlay=(W-w)/2:(H-h)/2,setsar=1,format=yuv420p[v]',
      '-map',
      '[v]'
    );
    if (opts.hasAudio) {
      args.push('-map', '0:a:0?');
    }
  } else {
    args.push(
      '-vf',
      'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,format=yuv420p'
    );
  }

  args.push(
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-crf',
    '23',
    '-profile:v',
    'high',
    '-level',
    '4.1',
    '-pix_fmt',
    'yuv420p'
  );

  if (opts.hasAudio) {
    args.push('-c:a', 'aac', '-b:a', '128k', '-ac', '2', '-ar', '44100');
  } else {
    args.push('-an');
  }

  // Strip all metadata/GPS atoms and put moov upfront for instant web range streaming
  args.push('-movflags', '+faststart', '-map_metadata', '-1', '-map_chapters', '-1', tmpVideoPath);

  await execFileAsync(FFMPEG_PATH, args, { timeout: 180_000, maxBuffer: 8 * 1024 * 1024 });
  await fsp.rename(tmpVideoPath, finalVideoPath);

  // Measure authoritative output duration & dimensions from the transcoded MP4
  const finalProbe = await probeVideo(finalVideoPath);

  // Extract a crisp representative JPEG frame for the thumbnail
  const seekFrame = Math.min(1, Math.max(0, finalProbe.durationSec * 0.25));
  await execFileAsync(
    FFMPEG_PATH,
    [
      '-y',
      '-hide_banner',
      '-loglevel',
      'error',
      '-ss',
      seekFrame.toFixed(3),
      '-i',
      finalVideoPath,
      '-vframes',
      '1',
      '-q:v',
      '3',
      '-map_metadata',
      '-1',
      tmpThumbPath,
    ],
    { timeout: 30_000, maxBuffer: 4 * 1024 * 1024 }
  );
  await fsp.rename(tmpThumbPath, finalThumbPath);

  // Use custom uploaded EXIF-stripped cover if provided, otherwise use generated thumbnail
  if (opts.customCoverBuffer && opts.customCoverBuffer.length > 0) {
    const cleanedCover = sanitizeUploadedImage(opts.customCoverBuffer, 5 * 1024 * 1024);
    await fsp.writeFile(finalCoverPath, cleanedCover.buffer);
  } else {
    await fsp.copyFile(finalThumbPath, finalCoverPath);
  }

  return {
    videoRelPath,
    thumbnailRelPath,
    coverRelPath,
    durationSec: finalProbe.durationSec,
    width: finalProbe.width || 1080,
    height: finalProbe.height || 1920,
  };
}

export async function deleteReelUploadDir(uploadDir: string, reelId: string): Promise<void> {
  const dir = path.join(path.resolve(uploadDir), 'reels', reelId);
  await fsp.rm(dir, { recursive: true, force: true });
}

export async function streamDiskMediaFile(
  request: FastifyRequest,
  reply: FastifyReply,
  absPath: string,
  mimeType: string
) {
  let stat: fs.Stats;
  try {
    stat = await fsp.stat(absPath);
  } catch {
    return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Media file not found on disk.' } });
  }
  if (!stat.isFile()) {
    return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Media file not found.' } });
  }

  const totalLen = stat.size;
  const rangeHeader = request.headers.range;

  reply.header('X-Content-Type-Options', 'nosniff');
  reply.header('Cache-Control', 'private, max-age=3600');
  reply.header('Accept-Ranges', 'bytes');

  if (typeof rangeHeader === 'string' && rangeHeader.startsWith('bytes=')) {
    const [startRaw, endRaw] = rangeHeader.replace('bytes=', '').split('-');
    const start = startRaw ? Number.parseInt(startRaw, 10) : 0;
    const end = endRaw ? Number.parseInt(endRaw, 10) : totalLen - 1;
    if (
      Number.isFinite(start) &&
      Number.isFinite(end) &&
      start >= 0 &&
      end < totalLen &&
      start <= end
    ) {
      reply.code(206);
      reply.header('Content-Type', mimeType);
      reply.header('Content-Range', `bytes ${start}-${end}/${totalLen}`);
      reply.header('Content-Length', end - start + 1);
      return reply.send(fs.createReadStream(absPath, { start, end }));
    }
    return reply.code(416).header('Content-Range', `bytes */${totalLen}`).send();
  }

  reply.header('Content-Type', mimeType);
  reply.header('Content-Length', totalLen);
  return reply.send(fs.createReadStream(absPath));
}
