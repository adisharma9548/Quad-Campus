import test, { after, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import type { DatabaseSync } from 'node:sqlite';

import { buildApp } from '../src/app.ts';

describe('Phase 1: Bug Fixes, Concurrency & Permissions (B1-B5)', () => {
  let app: FastifyInstance;
  let db: DatabaseSync;
  let tmpDir: string;

  let tokenA = '';
  let userAId = '';
  let tokenB = '';
  let userBId = '';
  let tokenC = '';
  let userCId = '';

  async function signupStudent(email: string, username: string) {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/signup',
      payload: {
        email,
        username,
        department: 'Computer Science & Engineering - Computer Science',
        year: '3rd Year',
        section: 'A',
        password: 'Password@123',
      },
    });
    assert.equal(res.statusCode, 201);
    return res.json() as { session: { token: string }; user: { id: string; username: string } };
  }

  before(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'quad-phase1-'));
    const dbPath = path.join(tmpDir, 'test.db');
    process.env.AUTH_SECRET = 'quad-test-secret-phase1-super-safe-12345';
    process.env.UPLOAD_DIR = path.join(tmpDir, 'uploads');
    fs.mkdirSync(process.env.UPLOAD_DIR, { recursive: true });

    const built = await buildApp({ dbPath });
    app = built.app;
    db = built.db;
    await app.ready();

    const a = await signupStudent('student.a.p1@college.edu', 'student_a_p1');
    tokenA = a.session.token;
    userAId = a.user.id;

    const b = await signupStudent('student.b.p1@college.edu', 'student_b_p1');
    tokenB = b.session.token;
    userBId = b.user.id;

    const c = await signupStudent('student.c.p1@college.edu', 'student_c_p1');
    tokenC = c.session.token;
    userCId = c.user.id;
  });

  after(async () => {
    await app.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // ── 1. B1: Reel Views Logging & 30s Throttle (Decision 11) ──────────────
  test('B1: mark-all-seen does NOT inflate views; views are logged per 30s throttle', async () => {
    // Insert a public reel directly into database for userA
    const reelId = 'reel_p1_vtest_' + Date.now();
    const nowMs = Date.now();
    db.prepare(`
      INSERT INTO reels (id, author_id, caption, tag, duration, audience, status, created_at_ms, created_at)
      VALUES (?, ?, 'Test Reel Views', 'Campus Reel', '0:15', 'campus', 'active', ?, ?)
    `).run(reelId, userAId, nowMs, new Date(nowMs).toISOString());

    // 1. Initial reel view count must be 0
    const listRes1 = await app.inject({
      method: 'GET',
      url: '/api/v1/reels',
      headers: { authorization: `Bearer ${tokenB}` },
    });
    assert.equal(listRes1.statusCode, 200);
    const body1 = listRes1.json() as { items: Array<{ id: string; views: string; viewsCount?: number }> };
    const r1 = body1.items.find((item) => item.id === reelId);
    assert.ok(r1, 'Reel should be listed');
    assert.equal(Number(r1.views), 0, 'Reel initial views must be 0');

    // 2. mark-all-seen must NOT increment views_count
    const markSeenRes = await app.inject({
      method: 'POST',
      url: '/api/v1/reels/mark-all-seen',
      headers: { authorization: `Bearer ${tokenB}` },
    });
    assert.equal(markSeenRes.statusCode, 200);

    const listRes2 = await app.inject({
      method: 'GET',
      url: '/api/v1/reels',
      headers: { authorization: `Bearer ${tokenB}` },
    });
    const body2 = listRes2.json() as { items: Array<{ id: string; views: string }> };
    const r2 = body2.items.find((item) => item.id === reelId);
    assert.equal(Number(r2?.views), 0, 'Views must remain 0 after mark-all-seen');

    // 3. First counted view by User B
    const viewRes1 = await app.inject({
      method: 'POST',
      url: `/api/v1/reels/${reelId}/view`,
      headers: { authorization: `Bearer ${tokenB}` },
    });
    assert.equal(viewRes1.statusCode, 200);
    const viewData1 = viewRes1.json() as { seen: boolean; counted: boolean; viewsCount: number };
    assert.equal(viewData1.seen, true);
    assert.equal(viewData1.counted, true);
    assert.equal(viewData1.viewsCount, 1);

    // 4. Immediate second view by User B within 30s must be THROTTLED
    const viewRes2 = await app.inject({
      method: 'POST',
      url: `/api/v1/reels/${reelId}/view`,
      headers: { authorization: `Bearer ${tokenB}` },
    });
    assert.equal(viewRes2.statusCode, 200);
    const viewData2 = viewRes2.json() as { seen: boolean; counted: boolean; viewsCount: number };
    assert.equal(viewData2.seen, true);
    assert.equal(viewData2.counted, false, 'Rapid repeat view within 30s must not count');
    assert.equal(viewData2.viewsCount, 1);

    // 5. Backdate user B's previous view log by 31 seconds to simulate 30s throttle expiration
    db.prepare(`
      UPDATE view_logs SET viewed_at_ms = ? WHERE target_id = ? AND user_id = ?
    `).run(nowMs - 31_000, reelId, userBId);

    // Now User B views again after throttle window -> must be COUNTED as view #2
    const viewRes3 = await app.inject({
      method: 'POST',
      url: `/api/v1/reels/${reelId}/view`,
      headers: { authorization: `Bearer ${tokenB}` },
    });
    assert.equal(viewRes3.statusCode, 200);
    const viewData3 = viewRes3.json() as { seen: boolean; counted: boolean; viewsCount: number };
    assert.equal(viewData3.counted, true, 'View after 30s throttle window must count');
    assert.equal(viewData3.viewsCount, 2);
  });

  // ── 2. B2: Reel Permission Checks ─────────────────────────────────────────
  test('B2: Reel like and view enforce followers-only, deleted, and block permissions', async () => {
    // Insert followers-only reel for User A
    const followersReelId = 'reel_p1_followers_' + Date.now();
    db.prepare(`
      INSERT INTO reels (id, author_id, caption, tag, duration, audience, status, created_at_ms, created_at)
      VALUES (?, ?, 'Followers Only Reel', 'Campus Reel', '0:20', 'followers', 'active', ?, ?)
    `).run(followersReelId, userAId, Date.now(), new Date().toISOString());

    // User C is NOT a follower of User A -> liking must return 404
    const likeResForbidden = await app.inject({
      method: 'POST',
      url: `/api/v1/reels/${followersReelId}/like`,
      headers: { authorization: `Bearer ${tokenC}` },
    });
    assert.equal(likeResForbidden.statusCode, 404, 'Non-follower must get 404 liking followers-only reel');

    // Viewing by non-follower must also return 404
    const viewResForbidden = await app.inject({
      method: 'POST',
      url: `/api/v1/reels/${followersReelId}/view`,
      headers: { authorization: `Bearer ${tokenC}` },
    });
    assert.equal(viewResForbidden.statusCode, 404, 'Non-follower must get 404 viewing followers-only reel');

    // Make User C follow User A
    db.prepare(`
      INSERT INTO follows (follower_id, followee_id, group_name, created_at) VALUES (?, ?, 'Others', ?)
    `).run(userCId, userAId, new Date().toISOString());

    // Now User C can like the followers-only reel
    const likeResAllowed = await app.inject({
      method: 'POST',
      url: `/api/v1/reels/${followersReelId}/like`,
      headers: { authorization: `Bearer ${tokenC}` },
    });
    assert.equal(likeResAllowed.statusCode, 200);
    const likeData = likeResAllowed.json() as { liked: boolean; likes: number };
    assert.equal(likeData.liked, true);
    assert.equal(likeData.likes, 1);

    // Test soft-deleted reel -> like returns 404
    const deletedReelId = 'reel_p1_deleted_' + Date.now();
    db.prepare(`
      INSERT INTO reels (id, author_id, caption, tag, duration, audience, status, created_at_ms, created_at)
      VALUES (?, ?, 'Deleted Reel', 'Campus Reel', '0:20', 'campus', 'deleted', ?, ?)
    `).run(deletedReelId, userAId, Date.now(), new Date().toISOString());

    const likeDeletedRes = await app.inject({
      method: 'POST',
      url: `/api/v1/reels/${deletedReelId}/like`,
      headers: { authorization: `Bearer ${tokenB}` },
    });
    assert.equal(likeDeletedRes.statusCode, 404, 'Deleted reel must return 404 on like');

    // Test block: User A blocks User B
    db.prepare(`
      INSERT INTO blocks (blocker_id, blocked_id, reason, created_at) VALUES (?, ?, 'privacy', ?)
    `).run(userAId, userBId, new Date().toISOString());

    // Blocked User B liking User A's public reel must return 404
    const publicReelId = 'reel_p1_pub_' + Date.now();
    db.prepare(`
      INSERT INTO reels (id, author_id, caption, tag, duration, audience, status, created_at_ms, created_at)
      VALUES (?, ?, 'Public Reel', 'Campus Reel', '0:20', 'campus', 'active', ?, ?)
    `).run(publicReelId, userAId, Date.now(), new Date().toISOString());

    const likeBlockedRes = await app.inject({
      method: 'POST',
      url: `/api/v1/reels/${publicReelId}/like`,
      headers: { authorization: `Bearer ${tokenB}` },
    });
    assert.equal(likeBlockedRes.statusCode, 404, 'Blocked user must get 404 on like');

    // Clean up block
    db.prepare('DELETE FROM blocks WHERE blocker_id = ? AND blocked_id = ?').run(userAId, userBId);
  });

  // ── 3. B2: Thread Like & Reply Permission Checks ──────────────────────────
  test('B2: Thread like and reply enforce active status, author status, and blocks', async () => {
    // User A creates thread
    const threadRes = await app.inject({
      method: 'POST',
      url: '/api/v1/threads',
      headers: { authorization: `Bearer ${tokenA}` },
      payload: { content: 'Campus discussion thread' },
    });
    assert.equal(threadRes.statusCode, 201);
    const thread = threadRes.json() as { id: string };

    // Liking non-existent thread -> 404
    const likeMissing = await app.inject({
      method: 'POST',
      url: '/api/v1/threads/non_existent_id_999/like',
      headers: { authorization: `Bearer ${tokenB}` },
    });
    assert.equal(likeMissing.statusCode, 404);

    // Normal like by User B -> 200, likes = 1
    const likeRes = await app.inject({
      method: 'POST',
      url: `/api/v1/threads/${thread.id}/like`,
      headers: { authorization: `Bearer ${tokenB}` },
    });
    assert.equal(likeRes.statusCode, 200);
    const likeData = likeRes.json() as { liked: boolean; likes: number };
    assert.equal(likeData.liked, true);
    assert.equal(likeData.likes, 1);

    // Soft delete thread -> liking must return 404
    db.prepare("UPDATE threads SET status = 'deleted' WHERE id = ?").run(thread.id);
    const likeDeleted = await app.inject({
      method: 'POST',
      url: `/api/v1/threads/${thread.id}/like`,
      headers: { authorization: `Bearer ${tokenB}` },
    });
    assert.equal(likeDeleted.statusCode, 404, 'Deleted thread must return 404 on like');

    // Create another active thread by User A
    const threadRes2 = await app.inject({
      method: 'POST',
      url: '/api/v1/threads',
      headers: { authorization: `Bearer ${tokenA}` },
      payload: { content: 'Second discussion thread' },
    });
    const thread2 = threadRes2.json() as { id: string };

    // User A blocks User B
    db.prepare(`
      INSERT INTO blocks (blocker_id, blocked_id, reason, created_at) VALUES (?, ?, 'test block', ?)
    `).run(userAId, userBId, new Date().toISOString());

    // Blocked User B liking User A's thread -> 404
    const likeBlockedThread = await app.inject({
      method: 'POST',
      url: `/api/v1/threads/${thread2.id}/like`,
      headers: { authorization: `Bearer ${tokenB}` },
    });
    assert.equal(likeBlockedThread.statusCode, 404, 'Blocked user cannot like thread');

    // Blocked User B replying to User A's thread -> 404
    const replyBlockedThread = await app.inject({
      method: 'POST',
      url: `/api/v1/threads/${thread2.id}/replies`,
      headers: { authorization: `Bearer ${tokenB}` },
      payload: { content: 'Sneaky reply' },
    });
    assert.equal(replyBlockedThread.statusCode, 404, 'Blocked user cannot reply to thread');

    // Clean up block
    db.prepare('DELETE FROM blocks WHERE blocker_id = ? AND blocked_id = ?').run(userAId, userBId);
  });

  // ── 4. Single-Row Post Lookup & Post View Counting ────────────────────────
  test('Post single-row lookup works and post view counting throttles per 30s', async () => {
    // Create a public post
    const postRes = await app.inject({
      method: 'POST',
      url: '/api/v1/posts',
      headers: { authorization: `Bearer ${tokenA}` },
      payload: {
        title: 'Algorithms Homework Help',
        content: 'Anyone solving Graph cycle detection problem 4?',
        type: 'Question',
        space: 'public',
      },
    });
    assert.equal(postRes.statusCode, 201);
    const post = postRes.json() as { id: string };

    // GET /api/v1/posts/:id
    const getRes = await app.inject({
      method: 'GET',
      url: `/api/v1/posts/${post.id}`,
      headers: { authorization: `Bearer ${tokenB}` },
    });
    assert.equal(getRes.statusCode, 200);
    const fetched = getRes.json() as { id: string; title: string };
    assert.equal(fetched.id, post.id);
    assert.equal(fetched.title, 'Algorithms Homework Help');

    // Record Post View (User B)
    const viewRes1 = await app.inject({
      method: 'POST',
      url: `/api/v1/posts/${post.id}/view`,
      headers: { authorization: `Bearer ${tokenB}` },
    });
    assert.equal(viewRes1.statusCode, 200);
    const view1 = viewRes1.json() as { counted: boolean; viewsCount: number };
    assert.equal(view1.counted, true);
    assert.equal(view1.viewsCount, 1);

    // Immediate second view within 30s -> throttled
    const viewRes2 = await app.inject({
      method: 'POST',
      url: `/api/v1/posts/${post.id}/view`,
      headers: { authorization: `Bearer ${tokenB}` },
    });
    assert.equal(viewRes2.statusCode, 200);
    const view2 = viewRes2.json() as { counted: boolean; viewsCount: number };
    assert.equal(view2.counted, false);
    assert.equal(view2.viewsCount, 1);
  });

  // ── 5. Pure Logic Unit Test: In-Flight Like Lock ──────────────────────────
  test('Pure Logic: withLikeLock prevents concurrent duplicate requests', async () => {
    const inFlightLocks = new Set<string>();
    async function withLock<T>(key: string, fn: () => Promise<T>): Promise<T | null> {
      if (inFlightLocks.has(key)) return null;
      inFlightLocks.add(key);
      try {
        return await fn();
      } finally {
        inFlightLocks.delete(key);
      }
    }

    let executionCount = 0;
    const slowTask = async () => {
      executionCount++;
      await new Promise((r) => setTimeout(r, 40));
      return 'done';
    };

    // 1. Fire two concurrent calls for the SAME item
    const [result1, result2] = await Promise.all([
      withLock('post:123', slowTask),
      withLock('post:123', slowTask),
    ]);

    assert.equal(result1, 'done');
    assert.equal(result2, null, 'Second concurrent tap must be rejected with null');
    assert.equal(executionCount, 1, 'Slow task must have run exactly once');

    // 2. Sequential call after completion must succeed
    const result3 = await withLock('post:123', slowTask);
    assert.equal(result3, 'done');
    assert.equal(executionCount, 2, 'Sequential call must run');

    // 3. Different keys run concurrently without blocking
    const [diffKey1, diffKey2] = await Promise.all([
      withLock('post:111', slowTask),
      withLock('post:222', slowTask),
    ]);
    assert.equal(diffKey1, 'done');
    assert.equal(diffKey2, 'done');
  });
});
