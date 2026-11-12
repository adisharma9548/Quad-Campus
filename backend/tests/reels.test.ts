import test, { after, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';

import { buildApp } from '../src/app.ts';
import { ADMIN_EMAIL, FFMPEG_PATH, SEED_ADMIN_PASSWORD } from '../src/config/constants.ts';
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
  let uploadDir = '';
  let tokenAuthor = '';
  let tokenOther = '';

  before(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'quad-reels-test-'));
    uploadDir = path.join(tmpDir, 'uploads');
    const built = await buildApp({
      dbPath: path.join(tmpDir, 'test.db'),
      uploadDir,
      logger: false,
    });
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

  test('Phase 5.5: enforces reel delete auth, retains media on open report for admin, and filters peer profile reels by visibility', async () => {
    const uploadShortReel = async (audience: 'campus' | 'followers', caption: string) => {
      const mp4 = generateRealVideoBuffer(tmpDir, 4, false);
      const form = buildMultipartBody(
        [
          { name: 'caption', value: caption },
          { name: 'durationSec', value: '4' },
          { name: 'trimStart', value: '0' },
          { name: 'trimEnd', value: '4' },
          { name: 'audience', value: audience },
          { name: 'commentsEnabled', value: 'true' },
        ],
        [{ name: 'video', filename: `${audience}.mp4`, contentType: 'video/mp4', data: mp4 }]
      );
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/reels',
        headers: {
          Authorization: `Bearer ${tokenAuthor}`,
          'content-type': form.contentType,
        },
        payload: form.payload,
      });
      assert.equal(res.statusCode, 201);
      const { id } = res.json() as { id: string };
      for (let i = 0; i < 60; i += 1) {
        const poll = await app.inject({
          method: 'GET',
          url: `/api/v1/reels/${id}`,
          headers: { Authorization: `Bearer ${tokenAuthor}` },
        });
        const body = poll.json() as { id: string; status: string; videoUrl: string; thumbnailUrl: string };
        if (body.status === 'active') return body;
        assert.notEqual(body.status, 'failed');
        await new Promise((r) => setTimeout(r, 100));
      }
      assert.fail(`Timed out waiting for reel ${id}`);
    };

    const campusReel = await uploadShortReel('campus', 'Campus lab demo');
    const followersReel = await uploadShortReel('followers', 'Followers-only sneak peek');

    // Insert a processing reel via upload? Verify peer profile hides followers reel for non-follower
    const profileBeforeFollow = await app.inject({
      method: 'GET',
      url: '/api/v1/users/reel_creator/profile',
      headers: { Authorization: `Bearer ${tokenOther}` },
    });
    assert.equal(profileBeforeFollow.statusCode, 200);
    const beforeReels = (profileBeforeFollow.json() as { reels: Array<{ id: string }> }).reels;
    assert.equal(beforeReels.some((r) => r.id === campusReel.id), true);
    assert.equal(beforeReels.some((r) => r.id === followersReel.id), false);

    // Follow reel_creator and accept request -> followers reel now visible in peer profile
    const followReq = await app.inject({
      method: 'POST',
      url: '/api/v1/follow-requests',
      headers: { Authorization: `Bearer ${tokenOther}` },
      payload: { targetUsername: 'reel_creator' },
    });
    assert.equal(followReq.statusCode, 200);
    const overviewRes = (
      await app.inject({
        method: 'GET',
        url: '/api/v1/social/overview',
        headers: { Authorization: `Bearer ${tokenAuthor}` },
      })
    ).json() as { followRequests: Array<{ id: string; username: string }> };
    const reqFromViewer = overviewRes.followRequests.find((r) => r.username === 'reel_viewer');
    assert.ok(reqFromViewer);
    const acceptRes = await app.inject({
      method: 'POST',
      url: `/api/v1/follow-requests/${reqFromViewer.id}/respond`,
      headers: { Authorization: `Bearer ${tokenAuthor}` },
      payload: { action: 'accept', group: 'Classmates' },
    });
    assert.equal(acceptRes.statusCode, 200);

    const profileAfterFollow = await app.inject({
      method: 'GET',
      url: '/api/v1/users/reel_creator/profile',
      headers: { Authorization: `Bearer ${tokenOther}` },
    });
    assert.equal(profileAfterFollow.statusCode, 200);
    const afterReels = (profileAfterFollow.json() as { reels: Array<{ id: string }> }).reels;
    assert.equal(afterReels.some((r) => r.id === campusReel.id), true);
    assert.equal(afterReels.some((r) => r.id === followersReel.id), true);

    // Non-owner cannot delete another student's reel (403)
    const forbidDel = await app.inject({
      method: 'DELETE',
      url: `/api/v1/reels/${followersReel.id}`,
      headers: { Authorization: `Bearer ${tokenOther}` },
    });
    assert.equal(forbidDel.statusCode, 403);

    // Owner deletes unreported followersReel -> 200, media dir deleted, GET returns 404
    const followersDir = path.join(uploadDir, 'reels', followersReel.id);
    assert.equal(fs.existsSync(followersDir), true);
    const okDel = await app.inject({
      method: 'DELETE',
      url: `/api/v1/reels/${followersReel.id}`,
      headers: { Authorization: `Bearer ${tokenAuthor}` },
    });
    assert.equal(okDel.statusCode, 200);
    assert.equal(okDel.json().deleted, true);
    assert.equal(okDel.json().retainedForModeration, false);
    assert.equal(fs.existsSync(followersDir), false);

    const deletedGet = await app.inject({
      method: 'GET',
      url: `/api/v1/reels/${followersReel.id}`,
      headers: { Authorization: `Bearer ${tokenAuthor}` },
    });
    assert.equal(deletedGet.statusCode, 404);

    // Deleted reel never appears on peer profile
    const profileAfterDel = await app.inject({
      method: 'GET',
      url: '/api/v1/users/reel_creator/profile',
      headers: { Authorization: `Bearer ${tokenOther}` },
    });
    const postDelReels = (profileAfterDel.json() as { reels: Array<{ id: string }> }).reels;
    assert.equal(postDelReels.some((r) => r.id === followersReel.id), false);

    // Report campusReel, then owner deletes -> retainedForModeration: true, hidden from normal users, readable by admin
    const reportRes = await app.inject({
      method: 'POST',
      url: '/api/v1/reports',
      headers: { Authorization: `Bearer ${tokenOther}` },
      payload: {
        targetType: 'reel',
        targetId: campusReel.id,
        reason: 'Inappropriate content',
      },
    });
    assert.equal(reportRes.statusCode, 201);

    const campusDir = path.join(uploadDir, 'reels', campusReel.id);
    const delReported = await app.inject({
      method: 'DELETE',
      url: `/api/v1/reels/${campusReel.id}`,
      headers: { Authorization: `Bearer ${tokenAuthor}` },
    });
    assert.equal(delReported.statusCode, 200);
    assert.equal(delReported.json().deleted, true);
    assert.equal(delReported.json().retainedForModeration, true);
    assert.equal(fs.existsSync(campusDir), true);

    // Hidden from normal users (even author)
    const studentMediaAfterDel = await app.inject({
      method: 'GET',
      url: campusReel.videoUrl,
      headers: { Authorization: `Bearer ${tokenAuthor}` },
    });
    assert.equal(studentMediaAfterDel.statusCode, 403);

    // Admin can still view retained media for open report moderation
    const adminLogin = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { identifier: ADMIN_EMAIL, password: SEED_ADMIN_PASSWORD },
    });
    assert.equal(adminLogin.statusCode, 200);
    const adminToken = (adminLogin.json() as { session: { token: string } }).session.token;

    const adminVideo = await app.inject({
      method: 'GET',
      url: campusReel.videoUrl,
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(adminVideo.statusCode, 200);
    const adminThumb = await app.inject({
      method: 'GET',
      url: campusReel.thumbnailUrl,
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(adminThumb.statusCode, 200);
  });

  test('Part C+D: enforces nested reel comments, visibility, sanitization, notifications, delete, and reporting', async () => {
    const uploadReel = async (audience: 'campus' | 'followers', commentsEnabled: boolean, caption: string) => {
      const mp4 = generateRealVideoBuffer(tmpDir, 4, false);
      const form = buildMultipartBody(
        [
          { name: 'caption', value: caption },
          { name: 'durationSec', value: '4' },
          { name: 'trimStart', value: '0' },
          { name: 'trimEnd', value: '4' },
          { name: 'audience', value: audience },
          { name: 'commentsEnabled', value: String(commentsEnabled) },
        ],
        [{ name: 'video', filename: `${audience}-c.mp4`, contentType: 'video/mp4', data: mp4 }]
      );
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/reels',
        headers: {
          Authorization: `Bearer ${tokenAuthor}`,
          'content-type': form.contentType,
        },
        payload: form.payload,
      });
      assert.equal(res.statusCode, 201);
      const { id } = res.json() as { id: string };
      for (let i = 0; i < 60; i += 1) {
        const poll = await app.inject({
          method: 'GET',
          url: `/api/v1/reels/${id}`,
          headers: { Authorization: `Bearer ${tokenAuthor}` },
        });
        const body = poll.json() as { id: string; status: string };
        if (body.status === 'active') return body;
        await new Promise((r) => setTimeout(r, 100));
      }
      throw new Error(`Timed out waiting for reel ${id}`);
    };

    const signupRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/signup',
      payload: {
        email: 'reel_stranger@btech.college.edu.in',
        password: 'Password@123',
        department: 'Computer Science & Engineering - Computer Science',
        year: '3rd Year',
        section: 'A',
        username: 'reel_stranger',
      },
    });
    assert.equal(signupRes.statusCode, 201);
    const tokenStranger = (signupRes.json() as { session: { token: string } }).session.token;

    const campusReel = await uploadReel('campus', true, 'Campus comments test reel');
    const followersReel = await uploadReel('followers', true, 'Followers comments test reel');

    // Stranger cannot GET or POST comments on followers-only reel (403)
    const forbidGet = await app.inject({
      method: 'GET',
      url: `/api/v1/reels/${followersReel.id}/comments`,
      headers: { Authorization: `Bearer ${tokenStranger}` },
    });
    assert.equal(forbidGet.statusCode, 403);

    const forbidPost = await app.inject({
      method: 'POST',
      url: `/api/v1/reels/${followersReel.id}/comments`,
      headers: { Authorization: `Bearer ${tokenStranger}` },
      payload: { content: 'Should fail' },
    });
    assert.equal(forbidPost.statusCode, 403);

    // Approved follower (tokenOther from Phase 5.5) can comment on followers-only reel
    const followerComment = await app.inject({
      method: 'POST',
      url: `/api/v1/reels/${followersReel.id}/comments`,
      headers: { Authorization: `Bearer ${tokenOther}` },
      payload: { content: 'Follower insight' },
    });
    assert.equal(followerComment.statusCode, 201);
    const followerCommentId = (followerComment.json() as { id: string }).id;

    // Validation: script-only content -> 400 EMPTY_COMMENT; HTML tags stripped; >500 chars -> 400 COMMENT_TOO_LONG
    const xssEmpty = await app.inject({
      method: 'POST',
      url: `/api/v1/reels/${campusReel.id}/comments`,
      headers: { Authorization: `Bearer ${tokenStranger}` },
      payload: { content: '<script>alert(1)</script>' },
    });
    assert.equal(xssEmpty.statusCode, 400);

    const tooLong = await app.inject({
      method: 'POST',
      url: `/api/v1/reels/${campusReel.id}/comments`,
      headers: { Authorization: `Bearer ${tokenStranger}` },
      payload: { content: 'a'.repeat(501) },
    });
    assert.equal(tooLong.statusCode, 400);
    assert.equal(tooLong.json().error.code, 'COMMENT_TOO_LONG');

    const crossReelParent = await app.inject({
      method: 'POST',
      url: `/api/v1/reels/${campusReel.id}/comments`,
      headers: { Authorization: `Bearer ${tokenOther}` },
      payload: { content: 'Cross reel attempt', parentCommentId: followerCommentId },
    });
    assert.equal(crossReelParent.statusCode, 400);
    assert.equal(crossReelParent.json().error.code, 'INVALID_PARENT');

    // Create 4-level deep reply chain (levels 0 -> 1 -> 2 -> 3)
    const rootRes = await app.inject({
      method: 'POST',
      url: `/api/v1/reels/${campusReel.id}/comments`,
      headers: { Authorization: `Bearer ${tokenStranger}` },
      payload: { content: '<script>bad()</script><b>Clean</b> root comment' },
    });
    assert.equal(rootRes.statusCode, 201);
    const rootComment = rootRes.json() as { id: string; content: string };
    assert.equal(rootComment.content, 'Clean root comment');

    const r1Res = await app.inject({
      method: 'POST',
      url: `/api/v1/reels/${campusReel.id}/comments`,
      headers: { Authorization: `Bearer ${tokenOther}` },
      payload: { content: 'Level 1 reply', parentCommentId: rootComment.id },
    });
    assert.equal(r1Res.statusCode, 201);
    const r1 = r1Res.json() as { id: string; replyToUsername: string };
    assert.equal(r1.replyToUsername, 'reel_stranger');

    const r2Res = await app.inject({
      method: 'POST',
      url: `/api/v1/reels/${campusReel.id}/comments`,
      headers: { Authorization: `Bearer ${tokenAuthor}` },
      payload: { content: 'Level 2 reply', parentCommentId: r1.id },
    });
    assert.equal(r2Res.statusCode, 201);
    const r2 = r2Res.json() as { id: string };

    const r3Res = await app.inject({
      method: 'POST',
      url: `/api/v1/reels/${campusReel.id}/comments`,
      headers: { Authorization: `Bearer ${tokenStranger}` },
      payload: { content: 'Level 3 deep reply', parentCommentId: r2.id },
    });
    assert.equal(r3Res.statusCode, 201);
    const r3 = r3Res.json() as { id: string };

    // GET comments with default maxDepth=2 hides level 3 behind hiddenReplyCount
    const treeRes = await app.inject({
      method: 'GET',
      url: `/api/v1/reels/${campusReel.id}/comments?limit=10&offset=0&maxDepth=2`,
      headers: { Authorization: `Bearer ${tokenStranger}` },
    });
    assert.equal(treeRes.statusCode, 200);
    const tree = treeRes.json() as {
      totalCount: number;
      items: Array<{
        id: string;
        replies: Array<{
          id: string;
          replies: Array<{ id: string; hasMoreReplies?: boolean; hiddenReplyCount?: number }>;
        }>;
      }>;
    };
    assert.equal(tree.totalCount, 4);
    const loadedL2 = tree.items[0].replies[0].replies[0];
    assert.equal(loadedL2.hasMoreReplies, true);
    assert.equal(loadedL2.hiddenReplyCount, 1);

    // Load more replies under level 2 returns level 3
    const deepRes = await app.inject({
      method: 'GET',
      url: `/api/v1/reels/${campusReel.id}/comments?parentId=${r2.id}&maxDepth=2`,
      headers: { Authorization: `Bearer ${tokenStranger}` },
    });
    assert.equal(deepRes.statusCode, 200);
    const deepItems = (deepRes.json() as { items: Array<{ id: string }> }).items;
    assert.equal(deepItems.length, 1);
    assert.equal(deepItems[0].id, r3.id);

    // Report r1 by tokenStranger; self-report & duplicate blocked
    const selfReport = await app.inject({
      method: 'POST',
      url: '/api/v1/reports',
      headers: { Authorization: `Bearer ${tokenOther}` },
      payload: { targetType: 'reel_comment', targetId: r1.id, reason: 'Harassment' },
    });
    assert.equal(selfReport.statusCode, 400);

    const reportOk = await app.inject({
      method: 'POST',
      url: '/api/v1/reports',
      headers: { Authorization: `Bearer ${tokenStranger}` },
      payload: { targetType: 'reel_comment', targetId: r1.id, reason: 'Spam or misleading' },
    });
    assert.equal(reportOk.statusCode, 201);

    const reportDup = await app.inject({
      method: 'POST',
      url: '/api/v1/reports',
      headers: { Authorization: `Bearer ${tokenStranger}` },
      payload: { targetType: 'reel_comment', targetId: r1.id, reason: 'Spam or misleading' },
    });
    assert.equal(reportDup.statusCode, 409);

    // Notifications created for stranger when tokenOther replied to rootComment
    const notifsRes = await app.inject({
      method: 'GET',
      url: '/api/v1/social/overview',
      headers: { Authorization: `Bearer ${tokenStranger}` },
    });
    assert.equal(notifsRes.statusCode, 200);
    const notifItems = (notifsRes.json() as { notifications?: Array<{ kind: string; targetId: string }> }).notifications || [];
    assert.equal(
      notifItems.some((n) => n.kind === 'reel_comment_reply' && n.targetId === campusReel.id),
      true
    );

    // Unauthorized delete blocked (403); author deletes parent with children -> soft-deleted keeping subtree
    const forbidDelComment = await app.inject({
      method: 'DELETE',
      url: `/api/v1/reels/${campusReel.id}/comments/${r1.id}`,
      headers: { Authorization: `Bearer ${tokenStranger}` },
    });
    assert.equal(forbidDelComment.statusCode, 403);

    const softDelParent = await app.inject({
      method: 'DELETE',
      url: `/api/v1/reels/${campusReel.id}/comments/${rootComment.id}`,
      headers: { Authorization: `Bearer ${tokenStranger}` },
    });
    assert.equal(softDelParent.statusCode, 200);
    assert.equal(softDelParent.json().softDeleted, true);
    assert.equal(softDelParent.json().commentsCount, 3);

    // Verify tree preserves children under [deleted] root & reportedByMe=true on r1
    const treeAfterDel = (
      await app.inject({
        method: 'GET',
        url: `/api/v1/reels/${campusReel.id}/comments`,
        headers: { Authorization: `Bearer ${tokenStranger}` },
      })
    ).json() as { items: Array<{ isDeleted: boolean; content: string; replies: Array<{ reportedByMe?: boolean }> }> };
    assert.equal(treeAfterDel.items[0].isDeleted, true);
    assert.equal(treeAfterDel.items[0].content, '[deleted]');
    assert.equal(treeAfterDel.items[0].replies[0].reportedByMe, true);

    // Reel owner can moderate & hard-delete leaf comment r3
    const ownerDelLeaf = await app.inject({
      method: 'DELETE',
      url: `/api/v1/reels/${campusReel.id}/comments/${r3.id}`,
      headers: { Authorization: `Bearer ${tokenAuthor}` },
    });
    assert.equal(ownerDelLeaf.statusCode, 200);
    assert.equal(ownerDelLeaf.json().softDeleted, false);
    assert.equal(ownerDelLeaf.json().commentsCount, 2);
  });

  test('Part C+D: supports comment likes (no notifications), Top/Newest cursor sort, pending-report penalty, hide, self-action guards, and followStatus', async () => {
    const mp4 = generateRealVideoBuffer(tmpDir, 4, false);
    const form = buildMultipartBody(
      [
        { name: 'caption', value: 'Ranking and actions reel' },
        { name: 'durationSec', value: '4' },
        { name: 'trimStart', value: '0' },
        { name: 'trimEnd', value: '4' },
        { name: 'audience', value: 'campus' },
        { name: 'commentsEnabled', value: 'true' },
      ],
      [{ name: 'video', filename: 'sort-d.mp4', contentType: 'video/mp4', data: mp4 }]
    );
    const uploadRes = await app.inject({
      method: 'POST',
      url: '/api/v1/reels',
      headers: { Authorization: `Bearer ${tokenAuthor}`, 'content-type': form.contentType },
      payload: form.payload,
    });
    assert.equal(uploadRes.statusCode, 201);
    const reelId = (uploadRes.json() as { id: string }).id;
    for (let i = 0; i < 60; i += 1) {
      const poll = await app.inject({
        method: 'GET',
        url: `/api/v1/reels/${reelId}`,
        headers: { Authorization: `Bearer ${tokenAuthor}` },
      });
      if ((poll.json() as { status: string }).status === 'active') break;
      await new Promise((r) => setTimeout(r, 100));
    }

    // Create 3 comments sequentially so createdAtMs differs strictly
    const c1Res = await app.inject({
      method: 'POST',
      url: `/api/v1/reels/${reelId}/comments`,
      headers: { Authorization: `Bearer ${tokenAuthor}`, 'content-type': 'application/json' },
      payload: { content: 'First top-candidate comment' },
    });
    assert.equal(c1Res.statusCode, 201);
    const c1 = c1Res.json() as { id: string };
    await new Promise((r) => setTimeout(r, 15));

    const c2Res = await app.inject({
      method: 'POST',
      url: `/api/v1/reels/${reelId}/comments`,
      headers: { Authorization: `Bearer ${tokenOther}` },
      payload: { content: 'Reported high-like comment' },
    });
    assert.equal(c2Res.statusCode, 201);
    const c2 = c2Res.json() as { id: string };
    await new Promise((r) => setTimeout(r, 15));

    const c3Res = await app.inject({
      method: 'POST',
      url: `/api/v1/reels/${reelId}/comments`,
      headers: { Authorization: `Bearer ${tokenOther}` },
      payload: { content: 'Newest unreported low-score comment' },
    });
    assert.equal(c3Res.statusCode, 201);
    const c3 = c3Res.json() as { id: string };

    // Add 3 child replies under c1 (oldest first when expanded)
    for (const label of ['Branch reply A', 'Branch reply B', 'Branch reply C']) {
      await new Promise((r) => setTimeout(r, 10));
      const rep = await app.inject({
        method: 'POST',
        url: `/api/v1/reels/${reelId}/comments`,
        headers: { Authorization: `Bearer ${tokenOther}` },
        payload: { content: label, parentCommentId: c1.id },
      });
      assert.equal(rep.statusCode, 201);
    }

    // Check notifications baseline before liking c1
    const notifBefore = (
      (
        await app.inject({
          method: 'GET',
          url: '/api/v1/social/overview',
          headers: { Authorization: `Bearer ${tokenAuthor}` },
        })
      ).json() as { notifications?: unknown[] }
    ).notifications?.length || 0;

    // Toggle like on c1 (2 likes from different users) & c2 (1 like, then reported)
    const l1 = await app.inject({
      method: 'POST',
      url: `/api/v1/reels/${reelId}/comments/${c1.id}/like`,
      headers: { Authorization: `Bearer ${tokenOther}` },
    });
    assert.equal(l1.statusCode, 200);
    assert.equal(l1.json().liked, true);
    assert.equal(l1.json().likes, 1);

    const l1Author = await app.inject({
      method: 'POST',
      url: `/api/v1/reels/${reelId}/comments/${c1.id}/like`,
      headers: { Authorization: `Bearer ${tokenAuthor}` },
    });
    assert.equal(l1Author.json().likes, 2);

    // Toggle off & back on by tokenOther -> stays 1 per user
    const l1Off = await app.inject({
      method: 'POST',
      url: `/api/v1/reels/${reelId}/comments/${c1.id}/like`,
      headers: { Authorization: `Bearer ${tokenOther}` },
    });
    assert.equal(l1Off.json().liked, false);
    assert.equal(l1Off.json().likes, 1);

    // No notification created by comment like
    const notifAfter = (
      (
        await app.inject({
          method: 'GET',
          url: '/api/v1/social/overview',
          headers: { Authorization: `Bearer ${tokenAuthor}` },
        })
      ).json() as { notifications?: unknown[] }
    ).notifications?.length || 0;
    assert.equal(notifAfter, notifBefore);

    // Report c2 -> sinks below unreported c3 even with like
    await app.inject({
      method: 'POST',
      url: `/api/v1/reels/${reelId}/comments/${c2.id}/like`,
      headers: { Authorization: `Bearer ${tokenAuthor}` },
    });
    const repC2 = await app.inject({
      method: 'POST',
      url: '/api/v1/reports',
      headers: { Authorization: `Bearer ${tokenAuthor}` },
      payload: { targetType: 'reel_comment', targetId: c2.id, reason: 'Spam or misleading' },
    });
    assert.equal(repC2.statusCode, 201);

    // Top sort + maxDepth=0 collapses branches + sinks c2
    const topPage1 = await app.inject({
      method: 'GET',
      url: `/api/v1/reels/${reelId}/comments?sort=top&limit=2&maxDepth=0`,
      headers: { Authorization: `Bearer ${tokenAuthor}` },
    });
    assert.equal(topPage1.statusCode, 200);
    const p1 = topPage1.json() as {
      items: Array<{ id: string; likes: number; likedByMe: boolean; replies: unknown[]; hasMoreReplies: boolean; hiddenReplyCount: number }>;
      hasMore: boolean;
      nextCursor: string | null;
    };
    assert.deepEqual(
      p1.items.map((x) => x.id),
      [c1.id, c3.id]
    );
    assert.equal(p1.items[0].likedByMe, true);
    assert.equal(p1.items[0].likes, 1);
    assert.equal(p1.items[0].replies.length, 0);
    assert.equal(p1.items[0].hasMoreReplies, true);
    assert.equal(p1.items[0].hiddenReplyCount, 3);
    assert.equal(p1.hasMore, true);
    assert.ok(p1.nextCursor);

    const topPage2 = await app.inject({
      method: 'GET',
      url: `/api/v1/reels/${reelId}/comments?sort=top&limit=2&maxDepth=0&cursor=${encodeURIComponent(p1.nextCursor!)}`,
      headers: { Authorization: `Bearer ${tokenAuthor}` },
    });
    const p2 = topPage2.json() as { items: Array<{ id: string }>; hasMore: boolean };
    assert.deepEqual(
      p2.items.map((x) => x.id),
      [c2.id]
    );
    assert.equal(p2.hasMore, false);

    // Newest sort orders unreported newest first [c3, c1], with pending-reported c2 last
    const newestRes = await app.inject({
      method: 'GET',
      url: `/api/v1/reels/${reelId}/comments?sort=newest&limit=10&maxDepth=0`,
      headers: { Authorization: `Bearer ${tokenAuthor}` },
    });
    const newestIds = (newestRes.json() as { items: Array<{ id: string }> }).items.map((x) => x.id);
    assert.deepEqual(newestIds, [c3.id, c1.id, c2.id]);

    // Branch expansion + cursor pagination returns replies oldest-first
    const branchPage1 = (
      await app.inject({
        method: 'GET',
        url: `/api/v1/reels/${reelId}/comments?parentId=${c1.id}&limit=2&maxDepth=1`,
        headers: { Authorization: `Bearer ${tokenAuthor}` },
      })
    ).json() as { items: Array<{ content: string }>; hasMore: boolean; nextCursor: string | null };
    assert.deepEqual(
      branchPage1.items.map((x) => x.content),
      ['Branch reply A', 'Branch reply B']
    );
    assert.equal(branchPage1.hasMore, true);

    const branchPage2 = (
      await app.inject({
        method: 'GET',
        url: `/api/v1/reels/${reelId}/comments?parentId=${c1.id}&limit=2&maxDepth=1&cursor=${encodeURIComponent(branchPage1.nextCursor!)}`,
        headers: { Authorization: `Bearer ${tokenAuthor}` },
      })
    ).json() as { items: Array<{ content: string }>; hasMore: boolean };
    assert.deepEqual(
      branchPage2.items.map((x) => x.content),
      ['Branch reply C']
    );
    assert.equal(branchPage2.hasMore, false);

    // Self-action guards & hide/unhide reel
    const selfHide = await app.inject({
      method: 'POST',
      url: `/api/v1/reels/${reelId}/hide`,
      headers: { Authorization: `Bearer ${tokenAuthor}` },
    });
    assert.equal(selfHide.statusCode, 400);

    const authorSession = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/session',
      headers: { Authorization: `Bearer ${tokenAuthor}` },
    });
    const authorUsername = (authorSession.json() as { user: { username: string } }).user.username;

    const selfMute = await app.inject({
      method: 'POST',
      url: '/api/v1/mutes',
      headers: { Authorization: `Bearer ${tokenAuthor}` },
      payload: { username: authorUsername },
    });
    assert.equal(selfMute.statusCode, 400);

    const selfBlock = await app.inject({
      method: 'POST',
      url: '/api/v1/blocks',
      headers: { Authorization: `Bearer ${tokenAuthor}` },
      payload: { username: authorUsername },
    });
    assert.equal(selfBlock.statusCode, 400);

    const otherHide = await app.inject({
      method: 'POST',
      url: `/api/v1/reels/${reelId}/hide`,
      headers: { Authorization: `Bearer ${tokenOther}` },
    });
    assert.equal(otherHide.statusCode, 200);

    const feedHidden = (
      await app.inject({
        method: 'GET',
        url: '/api/v1/reels',
        headers: { Authorization: `Bearer ${tokenOther}` },
      })
    ).json() as { items: Array<{ id: string }> };
    assert.equal(feedHidden.items.some((r) => r.id === reelId), false);

    const otherUnhide = await app.inject({
      method: 'DELETE',
      url: `/api/v1/reels/${reelId}/hide`,
      headers: { Authorization: `Bearer ${tokenOther}` },
    });
    assert.equal(otherUnhide.statusCode, 200);

    const feedRestored = (
      await app.inject({
        method: 'GET',
        url: '/api/v1/reels',
        headers: { Authorization: `Bearer ${tokenOther}` },
      })
    ).json() as { items: Array<{ id: string; followStatus?: string }> };
    const matched = feedRestored.items.find((r) => r.id === reelId);
    assert.ok(matched);
    assert.equal(matched!.followStatus, 'following');
  });
});
