/**
 * Privacy-preserving binary image sanitizer.
 * Validates JPEG / PNG / WebP magic bytes and strips EXIF (GPS, camera serial, timestamps),
 * XMP, IPTC, and text metadata chunks without altering visible pixels.
 */

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const STRIPPED_PNG_CHUNKS = new Set(['eXIf', 'tEXt', 'zTXt', 'iTXt', 'tIME']);
const STRIPPED_WEBP_CHUNKS = new Set(['EXIF', 'XMP ']);

function detectImageType(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.subarray(0, 8).equals(PNG_SIG)) return 'image/png';
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    return 'image/webp';
  }
  return null;
}

function stripJpegMetadata(buf) {
  const chunks = [buf.subarray(0, 2)]; // SOI 0xFFD8
  let offset = 2;
  let strippedBytes = 0;

  while (offset + 1 < buf.length) {
    if (buf[offset] !== 0xff) break;
    while (offset < buf.length && buf[offset] === 0xff) offset += 1;
    if (offset >= buf.length) break;

    const marker = buf[offset];
    offset += 1;

    // SOS (0xDA) starts entropy-coded scan until EOI
    if (marker === 0xda) {
      chunks.push(Buffer.from([0xff, marker]));
      chunks.push(buf.subarray(offset));
      break;
    }
    if (marker === 0xd9) {
      chunks.push(Buffer.from([0xff, marker]));
      break;
    }
    // Standalone markers without length
    if (marker === 0x00 || (marker >= 0xd0 && marker <= 0xd8)) {
      chunks.push(Buffer.from([0xff, marker]));
      continue;
    }
    if (offset + 2 > buf.length) break;
    const segLen = buf.readUInt16BE(offset);
    if (segLen < 2 || offset + segLen > buf.length) break;

    // Strip APP1 (EXIF/XMP/GPS), APP12/APP13 (Ducky/IPTC), and COM (0xFE)
    const shouldStrip =
      marker === 0xe1 ||
      marker === 0xec ||
      marker === 0xed ||
      marker === 0xfe;

    if (shouldStrip) {
      strippedBytes += segLen + 2;
    } else {
      chunks.push(Buffer.from([0xff, marker]));
      chunks.push(buf.subarray(offset, offset + segLen));
    }
    offset += segLen;
  }

  return { buffer: Buffer.concat(chunks), strippedBytes };
}

function stripPngMetadata(buf) {
  const chunks = [buf.subarray(0, 8)];
  let offset = 8;
  let strippedBytes = 0;

  while (offset + 12 <= buf.length) {
    const length = buf.readUInt32BE(offset);
    const type = buf.toString('ascii', offset + 4, offset + 8);
    const totalLen = 12 + length;
    if (offset + totalLen > buf.length) break;

    if (STRIPPED_PNG_CHUNKS.has(type)) {
      strippedBytes += totalLen;
    } else {
      chunks.push(buf.subarray(offset, offset + totalLen));
    }
    offset += totalLen;
    if (type === 'IEND') break;
  }

  return { buffer: Buffer.concat(chunks), strippedBytes };
}

function stripWebpMetadata(buf) {
  const bodyChunks = [];
  let offset = 12;
  let strippedBytes = 0;

  while (offset + 8 <= buf.length) {
    const fourCC = buf.toString('ascii', offset, offset + 4);
    const size = buf.readUInt32LE(offset + 4);
    const padded = 8 + size + (size % 2);
    if (offset + 8 + size > buf.length) break;

    if (STRIPPED_WEBP_CHUNKS.has(fourCC)) {
      strippedBytes += Math.min(padded, buf.length - offset);
    } else {
      bodyChunks.push(buf.subarray(offset, Math.min(offset + padded, buf.length)));
    }
    offset += padded;
  }

  const body = Buffer.concat(bodyChunks);
  const header = Buffer.alloc(12);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(4 + body.length, 4);
  header.write('WEBP', 8, 'ascii');
  return { buffer: Buffer.concat([header, body]), strippedBytes };
}

/**
 * Validate and scrub privacy-sensitive EXIF/GPS/XMP metadata from uploaded images.
 */
export function sanitizeUploadedImage(rawBuffer, maxBytes = 5 * 1024 * 1024) {
  if (!Buffer.isBuffer(rawBuffer) || rawBuffer.length === 0) {
    throw Object.assign(new Error('No image file data provided.'), {
      code: 'EMPTY_FILE',
      status: 400,
    });
  }
  if (rawBuffer.length > maxBytes) {
    throw Object.assign(new Error('Image exceeds the 5 MB upload limit.'), {
      code: 'FILE_TOO_LARGE',
      status: 413,
    });
  }

  const mimeType = detectImageType(rawBuffer);
  if (!mimeType) {
    throw Object.assign(new Error('Unsupported image format. Use JPEG, PNG, or WebP.'), {
      code: 'UNSUPPORTED_MEDIA_TYPE',
      status: 415,
    });
  }

  let result;
  let extension;
  if (mimeType === 'image/jpeg') {
    result = stripJpegMetadata(rawBuffer);
    extension = 'jpg';
  } else if (mimeType === 'image/png') {
    result = stripPngMetadata(rawBuffer);
    extension = 'png';
  } else {
    result = stripWebpMetadata(rawBuffer);
    extension = 'webp';
  }

  return {
    buffer: result.buffer,
    mimeType,
    extension,
    strippedBytes: result.strippedBytes,
    exifStripped: true,
  };
}
