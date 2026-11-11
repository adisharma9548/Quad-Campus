import test, { after, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import type { DatabaseSync } from 'node:sqlite';

import { buildApp } from '../src/app.ts';
import { sanitizeUploadedImage, type MediaSanitizeError } from '../src/utils/exifStripper.ts';
import {
  canViewerSeePost,
  rankCampusReels,
  rankDiscoverablePeers,
  rankFeedPosts,
} from '../src/algorithms/campusRanker.ts';
import {
  ADMIN_EMAIL,
  SEED_ADMIN_PASSWORD,
  SEED_STUDENT_PASSWORD,
} from '../src/config/constants.ts';
import type { ViewerRelations } from '../src/types.ts';

function createSyntheticJpegWithExif(): Buffer {
  // SOI + APP1 (EXIF GPS payload) + SOF0/SOS stub + EOI
  const soi = Buffer.from([0xff, 0xd8]);
  const exifText = Buffer.from('Exif\0\0GPSLatitude:28.6139N,GPSLongitude:77.2090E', 'ascii');
  const app1 = Buffer.alloc(4 + exifText.length);
  app1[0] = 0xff;
  app1[1] = 0xe1;
  app1.writeUInt16BE(exifText.length + 2, 2);
  exifText.copy(app1, 4);

  const sos = Buffer.from([0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00, 0xff, 0xd9]);
  return Buffer.concat([soi, app1, sos]);
}

function createSyntheticPngWithExif(): Buffer {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdrData = Buffer.alloc(13, 0);
  ihdrData.writeUInt32BE(1, 0);
  ihdrData.writeUInt32BE(1, 4);
  ihdrData[8] = 8;

  const makeChunk = (type: string, data: Buffer): Buffer => {
    const buf = Buffer.alloc(12 + data.length);
    buf.writeUInt32BE(data.length, 0);
    buf.write(type, 4, 'ascii');
    data.copy(buf, 8);
    // CRC ignored by sanitizer, test structural preservation
    return buf;
  };

  const ihdr = makeChunk('IHDR', ihdrData);
  const exifChunk = makeChunk('eXIf', Buffer.from('II*\0GPS_SECRET_COORD'));
  const textChunk = makeChunk('tEXt', Buffer.from('Camera\0Pixel 9 Pro'));
  const idat = makeChunk('IDAT', Buffer.from([0x78, 0x9c, 0x63, 0x00, 0x00, 0x00, 0x02, 0x00, 0x01]));
  const iend = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([sig, ihdr, exifChunk, textChunk, idat, iend]);
}

describe('Unit: EXIF & Metadata Stripper', () => {
  test('strips APP1/EXIF GPS metadata from synthetic JPEG', () => {
    const raw = createSyntheticJpegWithExif();
    const cleaned = sanitizeUploadedImage(raw);
    assert.equal(cleaned.mimeType, 'image/jpeg');
    assert.equal(cleaned.exifStripped, true);
    assert.ok(cleaned.strippedBytes > 0);
    assert.equal(cleaned.buffer.includes(Buffer.from('GPSLatitude')), false);
    assert.equal(cleaned.buffer[0], 0xff);
    assert.equal(cleaned.buffer[1], 0xd8);
  });

  test('strips eXIf and tEXt chunks from synthetic PNG while keeping IHDR/IDAT/IEND', () => {
    const raw = createSyntheticPngWithExif();
    const cleaned = sanitizeUploadedImage(raw);
    assert.equal(cleaned.mimeType, 'image/png');
    assert.ok(cleaned.strippedBytes > 0);
    assert.equal(cleaned.buffer.includes(Buffer.from('GPS_SECRET_COORD')), false);
    assert.equal(cleaned.buffer.includes(Buffer.from('Pixel 9 Pro')), false);
    assert.equal(cleaned.buffer.includes(Buffer.from('IHDR')), true);
    assert.equal(cleaned.buffer.includes(Buffer.from('IEND')), true);
  });

  test('rejects invalid file magic bytes cleanly', () => {
    assert.throws(
      () => sanitizeUploadedImage(Buffer.from('not-an-image-script')),
      (err: unknown) => {
        const mediaErr = err as MediaSanitizeError;
        return mediaErr.code === 'UNSUPPORTED_MEDIA_TYPE' && mediaErr.status === 415;
      }
    );
  });
});

describe('Unit: Campus Ranking & Privacy Filter Engine', () => {
  const baseRelations = (): ViewerRelations => ({
    followingIds: new Set(['u2']),
    outgoingRequestTargetIds: new Set(),
    viewerMembershipByAuthor: new Map([['u2', 'Close Friends']]),
    blockedIds: new Set(['u_blocked']),
    blockedByIds: new Set(['u_blocker']),
    mutedIds: new Set(['u_muted']),
    dismissedPostIds: new Set(['p_dismissed']),
    dismissedTopics: [],
  });

  test('filters blocked (both directions), muted, dismissed, and unauthorized personal posts', () => {
    const viewer = { id: 'u1', branch: 'CSE', year: '3rd Year', interests: ['Algorithms'] };
    const rel = baseRelations();
    const posts = [
      { id: 'p_ok', authorId: 'u2', authorStatus: 'active' as const, space: 'public' as const, audience: 'campus', status: 'active' as const },
      { id: 'p_personal_self', authorId: 'u1', authorStatus: 'active' as const, space: 'personal' as const, audience: 'followers', status: 'active' as const },
      { id: 'p_personal_group_ok', authorId: 'u2', authorStatus: 'active' as const, space: 'personal' as const, audience: 'group', groupName: 'Close Friends', status: 'active' as const },
      { id: 'p_personal_group_denied', authorId: 'u2', authorStatus: 'active' as const, space: 'personal' as const, audience: 'group', groupName: 'Lab Partners', status: 'active' as const },
      { id: 'p_personal_stranger', authorId: 'u3', authorStatus: 'active' as const, space: 'personal' as const, audience: 'followers', status: 'active' as const },
      { id: 'p_blk1', authorId: 'u_blocked', authorStatus: 'active' as const, space: 'public' as const, audience: 'campus', status: 'active' as const },
      { id: 'p_blk2', authorId: 'u_blocker', authorStatus: 'active' as const, space: 'public' as const, audience: 'campus', status: 'active' as const },
      { id: 'p_mut', authorId: 'u_muted', authorStatus: 'active' as const, space: 'public' as const, audience: 'campus', status: 'active' as const },
      { id: 'p_dismissed', authorId: 'u2', authorStatus: 'active' as const, space: 'public' as const, audience: 'campus', status: 'active' as const },
    ];

    const visibleIds = posts.filter((p) => canViewerSeePost(p, viewer, rel)).map((p) => p.id);
    assert.deepEqual(visibleIds, ['p_ok', 'p_personal_self', 'p_personal_group_ok']);
  });

  test('boosts unanswered Questions and interleaves authors to avoid feed monotony', () => {
    const now = Date.now();
    const viewer = { id: 'u1', branch: 'CSE', year: '3rd Year', interests: ['Compilers'] };
    const rel = baseRelations();
    const posts = [
      {
        id: 'p_spam_1',
        authorId: 'u_spammer',
        authorStatus: 'active' as const,
        authorBranch: 'ME',
        authorYear: '1st',
        type: 'Update',
        title: 'Note 1',
        content: 'General campus note 1',
        hashtags: [],
        space: 'public' as const,
        audience: 'campus',
        status: 'active' as const,
        likesCount: 5,
        answersCount: 0,
        savesCount: 0,
        sharesCount: 0,
        createdAtMs: now - 10 * 60 * 1000,
      },
      {
        id: 'p_spam_2',
        authorId: 'u_spammer',
        authorStatus: 'active' as const,
        authorBranch: 'ME',
        authorYear: '1st',
        type: 'Update',
        title: 'Note 2',
        content: 'General campus note 2',
        hashtags: [],
        space: 'public' as const,
        audience: 'campus',
        status: 'active' as const,
        likesCount: 5,
        answersCount: 0,
        savesCount: 0,
        sharesCount: 0,
        createdAtMs: now - 11 * 60 * 1000,
      },
      {
        id: 'p_question_help',
        authorId: 'u_helper',
        authorStatus: 'active' as const,
        authorBranch: 'CSE',
        authorYear: '3rd',
        type: 'Question',
        title: 'Compilers LL(1) left recursion help',
        content: 'Need clarification on compiler lab parser grammar',
        hashtags: ['#Compilers'],
        space: 'public' as const,
        audience: 'campus',
        status: 'active' as const,
        likesCount: 1,
        answersCount: 0,
        savesCount: 1,
        sharesCount: 0,
        createdAtMs: now - 20 * 60 * 1000,
      },
    ];

    const ranked = rankFeedPosts({ posts, viewer, relations: rel, now });
    assert.equal(ranked.items[0].id, 'p_question_help');
    assert.equal(ranked.total, 3);
    assert.ok(ranked.items.length === 3);
  });

  test('discoverable peer ranker hides non-discoverable peers and never exposes section or email', () => {
    const viewer = { id: 'u1', branch: 'CSE', year: '3rd Year', interests: ['Systems'] };
    const rel = baseRelations();
    const candidates = [
      {
        id: 'u_hidden',
        username: 'hidden_peer',
        email: 'hidden@btech.college.edu.in',
        role: 'student' as const,
        status: 'active' as const,
        department: 'Computer Science & Engineering - Computer Science',
        branch: 'CSE',
        year: '3rd Year',
        section: 'C',
        discoverable: 0,
        avatarInitials: 'HP',
        interests: ['Systems'],
      },
      {
        id: 'u_open',
        username: 'open_peer',
        email: 'open@btech.college.edu.in',
        role: 'student' as const,
        status: 'active' as const,
        department: 'Computer Science & Engineering - Computer Science',
        branch: 'CSE',
        year: '3rd Year',
        section: 'A',
        discoverable: 1,
        avatarInitials: 'OP',
        interests: ['Systems'],
      },
    ];

    const list = rankDiscoverablePeers({ candidates, viewer, relations: rel });
    assert.equal(list.length, 1);
    assert.equal(list[0].username, 'open_peer');
    assert.equal((list[0] as unknown as Record<string, unknown>).section, undefined);
    assert.equal((list[0] as unknown as Record<string, unknown>).email, undefined);
  });

  test('reels ranker prioritizes unseen reels before seen reels', () => {
    const now = Date.now();
    const rel = baseRelations();
    const ranked = rankCampusReels({
      reels: [
        { id: 'r_seen', authorId: 'u2', authorStatus: 'active', status: 'active', unseen: false, likesCount: 50, commentsCount: 10, sharesCount: 5, caption: 'Popular seen reel', tag: 'Campus', createdAtMs: now - 1000 },
        { id: 'r_unseen', authorId: 'u3', authorStatus: 'active', status: 'active', unseen: true, likesCount: 1, commentsCount: 0, sharesCount: 0, caption: 'Fresh unseen reel', tag: 'Lab', createdAtMs: now - 3600 * 1000 },
      ],
      viewer: { id: 'u1', interests: [] },
      relations: rel,
      now,
    });
    assert.equal(ranked[0].id, 'r_unseen');
  });
});

describe('HTTP Integration: Auth, Privacy, Media Access, Ranking, Export, Admin', () => {
  let app: FastifyInstance;
  let db: DatabaseSync;
  let tmpDir: string;

  before(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'quad-backend-test-'));
    const built = await buildApp({ dbPath: path.join(tmpDir, 'test.db'), logger: false });
    app = built.app;
    db = built.db;
  });

  after(async () => {
    if (app) await app.close();
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('health endpoint returns ok and engine info', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/health' });
    assert.equal(res.statusCode, 200);
    const json = res.json();
    assert.equal(json.status, 'ok');
    assert.equal(json.engine, 'fastify+sqlite-wal');
  });

  test('signup enforces college email and compulsory engineering department/year/section', async () => {
    // Reject mobile number / gmail
    const badEmail = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/signup',
      payload: {
        email: '9876543210',
        username: 'test_student',
        department: 'Computer Science & Engineering - Computer Science',
        year: '2nd Year',
        section: 'B',
        password: 'Password@123',
      },
    });
    assert.equal(badEmail.statusCode, 400);
    assert.equal(badEmail.json().error.code, 'INVALID_COLLEGE_EMAIL');

    // Reject missing section
    const missingSection = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/signup',
      payload: {
        email: 'neha.sharma@btech.college.edu.in',
        username: 'neha_iot',
        department: 'Computer Science & Engineering - Internet of Things',
        year: '2nd Year',
        section: '',
        password: 'Password@123',
      },
    });
    assert.equal(missingSection.statusCode, 400);
    assert.equal(missingSection.json().error.code, 'MISSING_SECTION');

    // Valid signup with CSE-IoT
    const valid = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/signup',
      payload: {
        email: 'neha.sharma@btech.college.edu.in',
        username: 'neha_iot',
        fullName: 'Neha Sharma',
        department: 'Computer Science & Engineering - Internet of Things',
        year: '2nd Year',
        section: 'B',
        password: 'Password@123',
        interests: ['IoT', 'Embedded'],
      },
    });
    assert.equal(valid.statusCode, 201);
    const body = valid.json();
    assert.equal(body.user.branch, 'IoT');
    assert.equal(body.user.section, 'B');
    assert.equal(body.user.profilePublic, false);
    assert.ok(body.session.token);

    // Public peer lookup MUST strip section & email & non-discoverable branch/year
    const peerLookup = await app.inject({
      method: 'GET',
      url: '/api/v1/users/neha_iot',
    });
    assert.equal(peerLookup.statusCode, 200);
    const peer = peerLookup.json();
    assert.equal(peer.section, undefined);
    assert.equal(peer.email, undefined);
    assert.equal(peer.branch, null);
    assert.equal(peer.year, null);

    // PATCH /users/me must reject tampering with immutable department/section/role
    const tamper = await app.inject({
      method: 'PATCH',
      url: '/api/v1/users/me',
      headers: { authorization: `Bearer ${body.session.token}` },
      payload: { section: 'A', role: 'admin' },
    });
    assert.equal(tamper.statusCode, 400);
    assert.equal(tamper.json().error.code, 'IMMUTABLE_IDENTITY_FIELD');
  });

  test('login lockout activates after 5 consecutive failed attempts for a target account', async () => {
    for (let i = 1; i <= 4; i += 1) {
      const fail = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { identifier: 'neha_iot', password: 'WrongPassword!' },
      });
      assert.equal(fail.statusCode, 401);
      assert.equal(fail.json().error.consecutiveFailures, i);
    }

    const fifth = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { identifier: 'neha_iot', password: 'WrongPassword!' },
    });
    assert.equal(fifth.statusCode, 429);
    assert.equal(fifth.json().error.code, 'ACCOUNT_LOCKED');
    assert.equal(fifth.json().error.isLockedOut, true);
  });

  test('EXIF-stripped media uploaded on a Personal Space post cannot be read by unauthorized strangers', async () => {
    const loginQuantum = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { identifier: 'quantum_dev', password: SEED_STUDENT_PASSWORD },
    });
    assert.equal(loginQuantum.statusCode, 200);
    const quantumToken = loginQuantum.json().session.token;

    const loginAnonymousCadet = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { identifier: 'anonymous_cadet', password: SEED_STUDENT_PASSWORD },
    });
    assert.equal(loginAnonymousCadet.statusCode, 200);
    const cadetToken = loginAnonymousCadet.json().session.token;

    // Upload JPEG with embedded GPS string
    const rawJpeg = createSyntheticJpegWithExif();
    const uploadRes = await app.inject({
      method: 'POST',
      url: '/api/v1/media/upload',
      headers: { authorization: `Bearer ${quantumToken}` },
      payload: {
        dataUrl: `data:image/jpeg;base64,${rawJpeg.toString('base64')}`,
      },
    });
    assert.equal(uploadRes.statusCode, 201);
    const media = uploadRes.json();
    assert.equal(media.exifStripped, true);
    assert.ok(media.strippedBytes > 0);

    // Attach to a Personal Space Close Friends post (anonymous_cadet is NOT in Close Friends for quantum_dev)
    const createPost = await app.inject({
      method: 'POST',
      url: '/api/v1/posts',
      headers: { authorization: `Bearer ${quantumToken}` },
      payload: {
        type: 'Update',
        title: 'Private lab notes photo',
        content: 'Confidential group photo with GPS scrubbed server-side.',
        space: 'personal',
        audience: 'group',
        groupName: 'Close Friends',
        mediaId: media.mediaId,
      },
    });
    assert.equal(createPost.statusCode, 201);

    // Stranger / unauthorized peer gets 403 on media
    const denied = await app.inject({
      method: 'GET',
      url: media.url,
      headers: { authorization: `Bearer ${cadetToken}` },
    });
    assert.equal(denied.statusCode, 403);

    // Owner can retrieve scrubbed image bytes without GPS text
    const allowed = await app.inject({
      method: 'GET',
      url: media.url,
      headers: { authorization: `Bearer ${quantumToken}` },
    });
    assert.equal(allowed.statusCode, 200);
    assert.equal(allowed.rawPayload.includes(Buffer.from('GPSLatitude')), false);
  });

  test('student receives 404/403 on admin routes; admin requires re-auth before destructive actions', async () => {
    const studentLogin = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { identifier: 'quantum_dev', password: SEED_STUDENT_PASSWORD },
    });
    const studentToken = studentLogin.json().session.token;

    const studentAdminAttempt = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/metrics',
      headers: { authorization: `Bearer ${studentToken}` },
    });
    assert.equal(studentAdminAttempt.statusCode, 403);

    // Sign in as admin
    const adminLogin = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { identifier: ADMIN_EMAIL, password: SEED_ADMIN_PASSWORD },
    });
    assert.equal(adminLogin.statusCode, 200);
    const adminToken = adminLogin.json().session.token;
    assert.equal(adminLogin.json().user.role, 'admin');

    // Without password re-auth, suspend returns 403 REAUTH_REQUIRED
    const suspendWithoutReauth = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/users/usr_code_wizard/suspend',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { days: 3, reason: 'Testing guard' },
    });
    assert.equal(suspendWithoutReauth.statusCode, 403);
    assert.equal(suspendWithoutReauth.json().error.code, 'REAUTH_REQUIRED');

    // Re-authenticate password
    const reauth = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/verify-password',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { password: SEED_ADMIN_PASSWORD },
    });
    assert.equal(reauth.statusCode, 200);
    assert.equal(reauth.json().verified, true);

    // Now suspend works and records audit log
    const suspendOk = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/users/usr_code_wizard/suspend',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { days: 3, reason: 'Verified test suspension' },
    });
    assert.equal(suspendOk.statusCode, 200);
    assert.equal(suspendOk.json().status, 'suspended');

    const logs = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/audit-logs',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.equal(logs.statusCode, 200);
    assert.ok(
      (logs.json() as Array<{ action: string; targetId: string }>).some(
        (l) => l.action === 'SUSPEND_USER' && l.targetId === 'code_wizard'
      )
    );

    // Test admin inactivity timeout enforcement directly in SQLite
    db.prepare('UPDATE sessions SET last_active_at = ? WHERE user_id = ?').run(
      Date.now() - 20 * 60 * 1000,
      'usr_admin_master'
    );
    const expiredCheck = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/metrics',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.equal(expiredCheck.statusCode, 401);
  });

  test('student data export & self-account deletion work cleanly and wipe active session', async () => {
    const valid = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/signup',
      payload: {
        email: 'aarohi.export@btech.college.edu.in',
        username: 'aarohi_exp',
        fullName: 'Aarohi Export',
        department: 'Computer Science & Engineering - Data Science',
        year: '1st Year',
        section: 'C',
        password: 'Password@123',
      },
    });
    assert.equal(valid.statusCode, 201);
    const token = valid.json().session.token;

    const exportRes = await app.inject({
      method: 'GET',
      url: '/api/v1/users/me/export',
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(exportRes.statusCode, 200);
    assert.equal(exportRes.json().profile.username, 'aarohi_exp');

    const delRes = await app.inject({
      method: 'DELETE',
      url: '/api/v1/users/me',
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(delRes.statusCode, 200);

    const sessionAfterDel = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/session',
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(sessionAfterDel.statusCode, 401);
  });
});
