export interface VideoSanitizeResult {
  buffer: Buffer;
  mimeType: 'video/mp4' | 'video/quicktime';
  extension: 'mp4' | 'mov';
  strippedBytes: number;
  parsedDurationSec: number | null;
}

export interface VideoSanitizeError extends Error {
  status: number;
  code: string;
}

function makeVideoError(message: string, code: string, status = 400): VideoSanitizeError {
  const err = new Error(message) as VideoSanitizeError;
  err.status = status;
  err.code = code;
  return err;
}

const KNOWN_BRANDS = new Set([
  'isom',
  'iso2',
  'iso3',
  'iso4',
  'iso5',
  'iso6',
  'avc1',
  'hvc1',
  'hev1',
  'mp41',
  'mp42',
  'M4V ',
  'M4VP',
  'f4v ',
  'dash',
  'qt  ',
  'm4a ',
  'MSNV',
]);

// Metadata / GPS / XMP container FourCCs stripped unconditionally
const METADATA_ATOMS = new Set(['udta', 'meta', '\xa9xyz', 'XMP_', 'keys', 'ilst']);
// Container atoms whose children should also be recursed to purge nested udta/meta/©xyz
const CONTAINER_ATOMS = new Set(['moov', 'trak', 'mdia']);

interface ParsedBox {
  type: string;
  data: Buffer; // payload only (excluding box header)
}

function readBoxHeader(
  buf: Buffer,
  offset: number,
  end: number
): { headerSize: number; boxSize: number; type: string } | null {
  if (offset + 8 > end) return null;
  const size32 = buf.readUInt32BE(offset);
  const type = buf.subarray(offset + 4, offset + 8).toString('latin1');

  if (size32 === 1) {
    if (offset + 16 > end) return null;
    const size64 = Number(buf.readBigUInt64BE(offset + 8));
    if (!Number.isFinite(size64) || size64 < 16 || offset + size64 > end) return null;
    return { headerSize: 16, boxSize: size64, type };
  }
  if (size32 === 0) {
    return { headerSize: 8, boxSize: end - offset, type };
  }
  if (size32 < 8 || offset + size32 > end) return null;
  return { headerSize: 8, boxSize: size32, type };
}

function parseMvhdDuration(payload: Buffer): number | null {
  if (payload.length < 20) return null;
  const version = payload[0];
  if (version === 0 && payload.length >= 20) {
    const timescale = payload.readUInt32BE(12);
    const duration = payload.readUInt32BE(16);
    if (timescale > 0 && duration > 0) return duration / timescale;
  } else if (version === 1 && payload.length >= 32) {
    const timescale = payload.readUInt32BE(20);
    const duration = Number(payload.readBigUInt64BE(24));
    if (timescale > 0 && duration > 0) return duration / timescale;
  }
  return null;
}

function stripContainerChildren(
  buf: Buffer,
  start: number,
  end: number
): { cleaned: Buffer; strippedBytes: number; durationSec: number | null } {
  const kept: Buffer[] = [];
  let strippedBytes = 0;
  let durationSec: number | null = null;
  let pos = start;

  while (pos < end) {
    const hdr = readBoxHeader(buf, pos, end);
    if (!hdr) {
      // Non-standard trailing bytes — preserve verbatim so playback cannot break
      kept.push(buf.subarray(pos, end));
      break;
    }

    const boxEnd = pos + hdr.boxSize;

    if (METADATA_ATOMS.has(hdr.type)) {
      strippedBytes += hdr.boxSize;
      pos = boxEnd;
      continue;
    }

    if (hdr.type === 'mvhd') {
      const parsed = parseMvhdDuration(buf.subarray(pos + hdr.headerSize, boxEnd));
      if (parsed !== null && Number.isFinite(parsed)) {
        durationSec = parsed;
      }
    }

    if (CONTAINER_ATOMS.has(hdr.type)) {
      const inner = stripContainerChildren(buf, pos + hdr.headerSize, boxEnd);
      strippedBytes += inner.strippedBytes;
      if (inner.durationSec !== null && durationSec === null) {
        durationSec = inner.durationSec;
      }
      const newSize = 8 + inner.cleaned.length;
      const boxHdr = Buffer.allocUnsafe(8);
      boxHdr.writeUInt32BE(newSize, 0);
      boxHdr.write(hdr.type, 4, 4, 'latin1');
      kept.push(boxHdr, inner.cleaned);
    } else {
      kept.push(buf.subarray(pos, boxEnd));
    }

    pos = boxEnd;
  }

  return { cleaned: Buffer.concat(kept), strippedBytes, durationSec };
}

/**
 * Validate MP4/MOV ISO BMFF upload & strip GPS/camera metadata atoms (`udta`, `meta`, `©xyz`, `XMP_`).
 */
export function sanitizeUploadedVideo(
  rawBuffer: Buffer,
  maxBytes: number,
  declaredMimeOrName = ''
): VideoSanitizeResult {
  if (!Buffer.isBuffer(rawBuffer) || rawBuffer.length < 12) {
    throw makeVideoError(
      'Uploaded video file is empty or corrupted.',
      'INVALID_VIDEO_FORMAT',
      400
    );
  }
  if (rawBuffer.length > maxBytes) {
    throw makeVideoError(
      `Video exceeds maximum size of ${Math.round(maxBytes / (1024 * 1024))} MB.`,
      'FILE_TOO_LARGE',
      413
    );
  }

  const firstHdr = readBoxHeader(rawBuffer, 0, rawBuffer.length);
  let ftypBrand = '';
  if (firstHdr && firstHdr.type === 'ftyp') {
    const ftypEnd = firstHdr.boxSize;
    if (ftypEnd >= 12) {
      ftypBrand = rawBuffer.subarray(8, 12).toString('latin1');
    }
  } else {
    // Allow fast-check if 'ftyp' is near start within first 32 bytes
    const boxTypeAt4 = rawBuffer.subarray(4, 8).toString('latin1');
    if (boxTypeAt4 !== 'ftyp') {
      throw makeVideoError(
        'Only MP4 and MOV videos are supported.',
        'INVALID_VIDEO_FORMAT',
        400
      );
    }
    ftypBrand = rawBuffer.subarray(8, 12).toString('latin1');
  }

  // Validate major or compatible brand
  let hasKnownBrand = KNOWN_BRANDS.has(ftypBrand);
  if (!hasKnownBrand && firstHdr && firstHdr.boxSize >= 16) {
    for (let p = 16; p + 4 <= Math.min(firstHdr.boxSize, 64); p += 4) {
      const compat = rawBuffer.subarray(p, p + 4).toString('latin1');
      if (KNOWN_BRANDS.has(compat)) {
        hasKnownBrand = true;
        break;
      }
    }
  }
  if (!hasKnownBrand) {
    throw makeVideoError(
      'Only valid MP4 (.mp4) and QuickTime MOV (.mov) containers are allowed.',
      'INVALID_VIDEO_FORMAT',
      400
    );
  }

  const lowerDecl = declaredMimeOrName.toLowerCase();
  const isMov = ftypBrand === 'qt  ' || lowerDecl.includes('quicktime') || lowerDecl.endsWith('.mov');
  const mimeType: 'video/mp4' | 'video/quicktime' = isMov ? 'video/quicktime' : 'video/mp4';
  const extension: 'mp4' | 'mov' = isMov ? 'mov' : 'mp4';

  const { cleaned, strippedBytes, durationSec } = stripContainerChildren(
    rawBuffer,
    0,
    rawBuffer.length
  );

  // Keep ParsedBox type referenced cleanly if needed in future extensions
  void (null as unknown as ParsedBox | null);

  return {
    buffer: cleaned,
    mimeType,
    extension,
    strippedBytes,
    parsedDurationSec: durationSec,
  };
}
