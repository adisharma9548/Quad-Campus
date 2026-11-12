import test, { after, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';

import { buildApp } from '../src/app.ts';
import { FFMPEG_PATH } from '../src/config/constants.ts';
import { sanitizeUploadedVideo } from '../src/utils/videoStripper.ts';

function generateRealVideoBuffer(tmpDir: string, durationSec: number, withGps = false): Buffer {
  const outPath = path.join(tmpDir, `fixture-${durationSec}-${Date.now()}-${Math.random().toString(16).slice(2)}.mp4`);
  const args = [
    '-y',
    '-hide_banner',
    '-loglevel',
    'error',
    '-f',
    'lavfi',
    '-i',
    `color=c=navy:s=320x240:r=10:d=${durationSec}`,
    '-f',
    'lavfi',
    '-i',
    `anullsrc=r=44100:cl=mono:d=${durationSec}`,
    '-shortest',
    '-c:v',
    'libx264',
    '-preset',
    'ultrafast',
    '-pix_fmt',
    'yuv420p',
    '-c:a',
    'aac',
  ];
  if (withGps) {
    args.push('-movflags', 'use_metadata_tags', '-metadata', 'location=+28.6139+077.2090/', '-metadata', 'comment=SecretLocation');
  }
  args.push(outPath);
  execFileSync(FFMPEG_PATH, args, { stdio: 'pipe' });
  return fs.readFileSync(outPath);
}

function makeBox(type: string, payload: Buffer): Buffer {
  const hdr = Buffer.alloc(8);
  hdr.writeUInt32BE(8 + payload.length, 0);
  hdr.write(type, 4, 4, 'latin1');
  return Buffer.concat([hdr, payload]);
}

function makeMvhd(timescale: number, durationUnits: number): Buffer {
  // Version 0 mvhd = 100 bytes payload
  const buf = Buffer.alloc(100);
  buf[0] = 0;
  buf.writeUInt32BE(timescale, 12);
  buf.writeUInt32BE(durationUnits, 16);
  buf.writeUInt32BE(0x00010000, 20); // rate 1.0
  return makeBox('mvhd', buf);
}

function buildSyntheticMp4({
  durationSec = 15,
  withGpsUdta = true,
}: { durationSec?: number; withGpsUdta?: boolean } = {}): Buffer {
  const ftypPayload = Buffer.concat([
    Buffer.from('isom', 'latin1'),
    Buffer.from([0, 0, 2, 0]),
    Buffer.from('isomiso2mp41', 'latin1'),
  ]);
  const ftyp = makeBox('ftyp', ftypPayload);

  const mvhd = makeMvhd(1000, durationSec * 1000);
  const moovChildren: Buffer[] = [mvhd];
  if (withGpsUdta) {
    const gpsPayload = Buffer.from('+28.6139+077.2090/', 'latin1');
    const xyzBox = makeBox('\xa9xyz', gpsPayload);
    const udta = makeBox('udta', xyzBox);
    moovChildren.push(udta);
  }
  const moov = makeBox('moov', Buffer.concat(moovChildren));
  const mdat = makeBox('mdat', Buffer.from([0x00, 0x00, 0x00, 0x02, 0x09, 0x10]));
  return Buffer.concat([ftyp, moov, mdat]);
}

function buildMultipartBody(
  fields: Array<{ name: string; value: string }>,
  files: Array<{ name: string; filename: string; contentType: string; data: Buffer }>
): { payload: Buffer; contentType: string } {
  const boundary = '----QuadTestBoundary7e3a91';
  const chunks: Buffer[] = [];
  for (const f of fields) {
    chunks.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${f.name}"\r\n\r\n${f.value}\r\n`,
        'utf8'
      )
    );
  }
  for (const file of files) {
    chunks.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${file.name}"; filename="${file.filename}"\r\nContent-Type: ${file.contentType}\r\n\r\n`,
        'utf8'
      ),
      file.data,
      Buffer.from('\r\n', 'utf8')
    );
  }
  chunks.push(Buffer.from(`--${boundary}--\r\n`, 'utf8'));
  return {
    payload: Buffer.concat(chunks),
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
}

describe('Part 5: Reels Video Sanitizer & Upload Flow', () => {
  let app: FastifyInstance;
  let tmpDir: string;
  let tokenAuthor = '';
  let tokenOther = '';

  before(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'quad-reels-test-'));
    const built = await buildApp({ dbPath: path.join(tmpDir, 'test.db'), logger: false });
    app = built.app;

    const r1 = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/signup',
      payload: {
        email: 'reel_author@btech.college.edu.in',
        username: 'reel_creator',
        department: 'Computer Science & Engineering - Computer Science',
        year: '3rd Year',
        section: 'A',
        password: 'Password@123',
      },
    });
    assert.equal(r1.statusCode, 201);
    tokenAuthor = (r1.json() as { session: { token: string } }).session.token;

    const r2 = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/signup',
      payload: {
        email: 'reel_viewer@btech.college.edu.in',
        username: 'reel_viewer',
        department: 'Information Technology',
        year: '2nd Year',
        section: 'B',
        password: 'Password@123',
      },
    });
    assert.equal(r2.statusCode, 201);
    tokenOther = (r2.json() as { session: { token: string } }).session.token;

    // Make reel_viewer discoverable so mentions can reference @reel_viewer cleanly
    await app.inject({
      method: 'PATCH',
      url: '/api/v1/users/me',
      headers: { Authorization: `Bearer ${tokenOther}` },
      payload: { directoryVisible: true },
    });
  });

  after(async () => {
    await app.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('unit: sanitizeUploadedVideo strips udta/GPS atoms, parses mvhd duration, and rejects invalid/oversize files', () => {
    const mp4 = buildSyntheticMp4({ durationSec: 24, withGpsUdta: true });
    assert.equal(mp4.includes('+28.6139+077.2090/'), true);

    const cleaned = sanitizeUploadedVideo(mp4, 10 * 1024 * 1024, 'video/mp4 clip.mp4');
    assert.equal(cleaned.mimeType, 'video/mp4');
    assert.equal(cleaned.extension, 'mp4');
    assert.ok(cleaned.strippedBytes > 0);
    assert.equal(cleaned.buffer.includes('+28.6139+077.2090/'), false);
    assert.equal(cleaned.parsedDurationSec, 24);

    assert.throws(
      () => sanitizeUploadedVideo(Buffer.from('NOT_A_VIDEO_FILE'), 1024 * 1024),
      (err: { code?: string }) => err.code === 'INVALID_VIDEO_FORMAT'
    );

    assert.throws(
      () => sanitizeUploadedVideo(mp4, 10),
      (err: { code?: string }) => err.code === 'FILE_TOO_LARGE'
    );
  });

  test('uploads multipart MP4 reel, transcodes off-thread to disk, serves byte-range stream, enforces duration/comments/followers rules', async () => {
    const waitForActiveReel = async (reelId: string, token: string) => {
      for (let i = 0; i < 60; i += 1) {
        const res = await app.inject({
          method: 'GET',
          url: `/api/v1/reels/${reelId}`,
          headers: { Authorization: `Bearer ${token}` },
        });
        assert.equal(res.statusCode, 200);
        const body = res.json() as {
          id: string;
          status: string;
          videoUrl: string;
          thumbnailUrl: string;
          coverUrl: string;
          duration: string;
          durationSec: number | null;
          trimStart: number;
          trimEnd: number;
          fitMode: string;
          commentsEnabled: boolean;
          mentions: string[];
          hashtags: string[];
        };
        if (body.status === 'active') return body;
        if (body.status === 'failed') {
          assert.fail(`Reel processing failed unexpectedly for ${reelId}`);
        }
        await new Promise((resolve) => setTimeout(resolve, 150));
      }
      assert.fail(`Timed out waiting for reel ${reelId} to become active`);
    };

    // 1. Over-duration video (>90s) is rejected by real ffprobe check
    const tooLongMp4 = generateRealVideoBuffer(tmpDir, 95, false);
    const longForm = buildMultipartBody(
      [
        { name: 'caption', value: 'Too long video' },
        { name: 'durationSec', value: '95' },
        { name: 'trimStart', value: '0' },
        { name: 'trimEnd', value: '95' },
      ],
      [{ name: 'video', filename: 'long.mp4', contentType: 'video/mp4', data: tooLongMp4 }]
    );
    const tooLongRes = await app.inject({
      method: 'POST',
      url: '/api/reels',
      headers: {
        Authorization: `Bearer ${tokenAuthor}`,
        'content-type': longForm.contentType,
      },
      payload: longForm.payload,
    });
    assert.equal(tooLongRes.statusCode, 400);
    assert.equal(tooLongRes.json().error.code, 'VIDEO_TOO_LONG');

    // 2. Valid multipart upload with comments disabled + mention + fit mode + trim [2..14] -> 12s real output
    const validMp4 = generateRealVideoBuffer(tmpDir, 20, true);
    assert.equal(validMp4.includes('+28.6139+077.2090/'), true);

    const okForm = buildMultipartBody(
      [
        { name: 'caption', value: 'Autonomous rover test run #Robotics with @reel_viewer' },
        { name: 'durationSec', value: '20' },
        { name: 'trimStart', value: '2' },
        { name: 'trimEnd', value: '14' },
        { name: 'fitMode', value: 'fit' },
        { name: 'audience', value: 'campus' },
        { name: 'commentsEnabled', value: 'false' },
      ],
      [{ name: 'video', filename: 'rover.mp4', contentType: 'video/mp4', data: validMp4 }]
    );
    const createdRes = await app.inject({
      method: 'POST',
      url: '/api/reels',
      headers: {
        Authorization: `Bearer ${tokenAuthor}`,
        'content-type': okForm.contentType,
      },
      payload: okForm.payload,
    });
    assert.equal(createdRes.statusCode, 201);
    const createdInitial = createdRes.json() as {
      id: string;
      status: string;
      fitMode: string;
      commentsEnabled: boolean;
      mentions: string[];
      hashtags: string[];
    };
    assert.equal(createdInitial.fitMode, 'fit');
    assert.equal(createdInitial.commentsEnabled, false);
    assert.deepEqual(createdInitial.mentions, ['reel_viewer']);
    assert.deepEqual(createdInitial.hashtags, ['robotics']);

    const created = await waitForActiveReel(createdInitial.id, tokenAuthor);
    assert.equal(created.videoUrl, `/api/v1/reels/${created.id}/video`);
    assert.equal(created.thumbnailUrl, `/api/v1/reels/${created.id}/thumbnail`);
    assert.equal(created.duration, '0:12');
    assert.ok(created.durationSec !== null && Math.abs(created.durationSec - 12) <= 0.6);

    // HTTP Range request 206 Partial Content works for disk video playback & metadata stripped
    const rangeRes = await app.inject({
      method: 'GET',
      url: created.videoUrl,
      headers: {
        Authorization: `Bearer ${tokenOther}`,
        Range: 'bytes=0-15',
      },
    });
    assert.equal(rangeRes.statusCode, 206);
    assert.equal(rangeRes.headers['content-type'], 'video/mp4');
    assert.equal(rangeRes.headers['accept-ranges'], 'bytes');
    assert.ok(String(rangeRes.headers['content-range'] || '').startsWith('bytes 0-15/'));

    const fullVideoRes = await app.inject({
      method: 'GET',
      url: created.videoUrl,
      headers: { Authorization: `Bearer ${tokenOther}` },
    });
    assert.equal(fullVideoRes.statusCode, 200);
    assert.equal(fullVideoRes.rawPayload.includes('+28.6139+077.2090/'), false);
    assert.equal(fullVideoRes.rawPayload.includes('SecretLocation'), false);

    // Comments disabled enforcement
    const commentBlock = await app.inject({
      method: 'POST',
      url: `/api/v1/reels/${created.id}/comments`,
      headers: { Authorization: `Bearer ${tokenOther}` },
      payload: { content: 'Nice rover!' },
    });
    assert.equal(commentBlock.statusCode, 403);
    assert.equal(commentBlock.json().error.code, 'COMMENTS_DISABLED');

    // Followers-only reel hidden from non-follower
    const privMp4 = generateRealVideoBuffer(tmpDir, 6, false);
    const privForm = buildMultipartBody(
      [
        { name: 'caption', value: 'Followers only debug demo' },
        { name: 'durationSec', value: '6' },
        { name: 'trimStart', value: '0' },
        { name: 'trimEnd', value: '6' },
        { name: 'audience', value: 'followers' },
        { name: 'commentsEnabled', value: 'true' },
      ],
      [{ name: 'video', filename: 'priv.mp4', contentType: 'video/mp4', data: privMp4 }]
    );
    const privCreatedInitial = (
      await app.inject({
        method: 'POST',
        url: '/api/v1/reels',
        headers: {
          Authorization: `Bearer ${tokenAuthor}`,
          'content-type': privForm.contentType,
        },
        payload: privForm.payload,
      })
    ).json() as { id: string };
    const privCreated = await waitForActiveReel(privCreatedInitial.id, tokenAuthor);

    const strangerList = (
      await app.inject({
        method: 'GET',
        url: '/api/v1/reels?limit=1&offset=0',
        headers: { Authorization: `Bearer ${tokenOther}` },
      })
    ).json() as { items: Array<{ id: string }>; hasMore: boolean };
    assert.equal(typeof strangerList.hasMore, 'boolean');

    const fullStrangerList = (
      await app.inject({
        method: 'GET',
        url: '/api/v1/reels',
        headers: { Authorization: `Bearer ${tokenOther}` },
      })
    ).json() as { items: Array<{ id: string }> };
    assert.equal(
      fullStrangerList.items.some((r) => r.id === privCreated.id),
      false
    );

    const mediaForbidden = await app.inject({
      method: 'GET',
      url: privCreated.videoUrl,
      headers: { Authorization: `Bearer ${tokenOther}` },
    });
    assert.equal(mediaForbidden.statusCode, 403);
  });
});
