import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { FastifyInstance } from 'fastify';
import type { DatabaseSync } from 'node:sqlite';
import { buildApp } from '../src/app.ts';

describe('Phase 4: Unified Polymorphic Saved Content', () => {
  let app: FastifyInstance;
  let db: DatabaseSync;
  let tokenA: string;
  let tokenB: string;
  let userAId: string;
  let userBId: string;

  before(async () => {
    process.env.AUTH_SECRET = 'quad-test-secret-phase4-super-safe-12345';
    const built = await buildApp({ dbPath: ':memory:' });
    app = built.app;
    db = built.db;
    await app.ready();

    // Signup User A
    const resA = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/signup',
      payload: {
        email: 'alice.cs@college.edu',
        username: 'alice_cs',
        password: 'Password@123',
        department: 'Computer Science & Engineering - Computer Science',
        year: '3rd Year',
        section: 'A',
      },
    });
    assert.equal(resA.statusCode, 201);
    const bodyA = JSON.parse(resA.body);
    tokenA = bodyA.session.token;
    userAId = bodyA.user.id;

    // Signup User B
    const resB = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/signup',
      payload: {
        email: 'bob.me@college.edu',
        username: 'bob_me',
        password: 'Password@123',
        department: 'Mechanical Engineering',
        year: '2nd Year',
        section: 'B',
      },
    });
    assert.equal(resB.statusCode, 201);
    const bodyB = JSON.parse(resB.body);
    tokenB = bodyB.session.token;
    userBId = bodyB.user.id;
  });

  after(async () => {
    await app.close();
  });

  it('allows saving and unsaving posts, reels, and threads with proper polymorphic typing', async () => {
    // 1. User B creates a post
    const postRes = await app.inject({
      method: 'POST',
      url: '/api/v1/posts',
      headers: { authorization: `Bearer ${tokenB}` },
      payload: {
        title: 'Distributed Systems',
        content: 'Exam notes for Distributed Systems',
        type: 'Discussion',
      },
    });
    assert.equal(postRes.statusCode, 201);
    const postId = JSON.parse(postRes.body).id;

    // 2. User B creates a thread
    const threadRes = await app.inject({
      method: 'POST',
      url: '/api/v1/threads',
      headers: { authorization: `Bearer ${tokenB}` },
      payload: {
        content: 'Campus Robotics Club Project Brainstorm',
      },
    });
    assert.equal(threadRes.statusCode, 201);
    const threadId = JSON.parse(threadRes.body).id;

    // 3. Insert an active reel for User B
    const reelId = 'reel_test_p4_01';
    db.prepare(`
      INSERT INTO reels (id, author_id, caption, tag, audience, status, created_at_ms, created_at)
      VALUES (?, ?, ?, ?, ?, 'active', ?, ?)
    `).run(reelId, userBId, 'Lab Demo Reel', 'Tech', 'all', Date.now(), new Date().toISOString());

    // 4. User A saves the post
    const savePostRes = await app.inject({
      method: 'POST',
      url: `/api/v1/saved/post/${postId}`,
      headers: { authorization: `Bearer ${tokenA}` },
    });
    assert.equal(savePostRes.statusCode, 200);
    assert.deepEqual(JSON.parse(savePostRes.body), { saved: true, type: 'post', id: String(postId) });

    // Idempotent save does not error
    const savePostAgain = await app.inject({
      method: 'POST',
      url: `/api/v1/saved/post/${postId}`,
      headers: { authorization: `Bearer ${tokenA}` },
    });
    assert.equal(savePostAgain.statusCode, 200);

    // 5. User A saves the thread
    const saveThreadRes = await app.inject({
      method: 'POST',
      url: `/api/v1/saved/thread/${threadId}`,
      headers: { authorization: `Bearer ${tokenA}` },
    });
    assert.equal(saveThreadRes.statusCode, 200);
    assert.deepEqual(JSON.parse(saveThreadRes.body), { saved: true, type: 'thread', id: String(threadId) });

    // 6. User A saves the reel
    const saveReelRes = await app.inject({
      method: 'POST',
      url: `/api/v1/saved/reel/${reelId}`,
      headers: { authorization: `Bearer ${tokenA}` },
    });
    assert.equal(saveReelRes.statusCode, 200);
    assert.deepEqual(JSON.parse(saveReelRes.body), { saved: true, type: 'reel', id: reelId });

    // 7. GET /api/v1/saved without filter returns all 3
    const getAllRes = await app.inject({
      method: 'GET',
      url: '/api/v1/saved',
      headers: { authorization: `Bearer ${tokenA}` },
    });
    assert.equal(getAllRes.statusCode, 200);
    const allBody = JSON.parse(getAllRes.body);
    assert.equal(allBody.items.length, 3);
    const types = allBody.items.map((i: { type: string }) => i.type);
    assert.ok(types.includes('post'));
    assert.ok(types.includes('thread'));
    assert.ok(types.includes('reel'));

    // 8. GET /api/v1/saved?type=reel returns only reels
    const getReelsRes = await app.inject({
      method: 'GET',
      url: '/api/v1/saved?type=reel',
      headers: { authorization: `Bearer ${tokenA}` },
    });
    assert.equal(getReelsRes.statusCode, 200);
    const reelsBody = JSON.parse(getReelsRes.body);
    assert.equal(reelsBody.items.length, 1);
    assert.equal(reelsBody.items[0].type, 'reel');
    assert.equal(reelsBody.items[0].targetId, reelId);

    // 9. User A unsaves the thread via DELETE /api/v1/saved/thread/:id
    const unsaveThreadRes = await app.inject({
      method: 'DELETE',
      url: `/api/v1/saved/thread/${threadId}`,
      headers: { authorization: `Bearer ${tokenA}` },
    });
    assert.equal(unsaveThreadRes.statusCode, 200);
    assert.deepEqual(JSON.parse(unsaveThreadRes.body), { saved: false, type: 'thread', id: String(threadId) });

    // After unsaving, GET /api/v1/saved?type=thread is empty
    const getThreadAfterRes = await app.inject({
      method: 'GET',
      url: '/api/v1/saved?type=thread',
      headers: { authorization: `Bearer ${tokenA}` },
    });
    assert.equal(getThreadAfterRes.statusCode, 200);
    assert.equal(JSON.parse(getThreadAfterRes.body).items.length, 0);
  });

  it('enforces strict permissions (404 for deleted/blocked/follower-only content)', async () => {
    // 1. User B creates a followers-only reel
    const secretReelId = 'reel_secret_followers';
    db.prepare(`
      INSERT INTO reels (id, author_id, caption, tag, audience, status, created_at_ms, created_at)
      VALUES (?, ?, ?, ?, 'followers', 'active', ?, ?)
    `).run(secretReelId, userBId, 'Followers Only Reel', 'Private', Date.now(), new Date().toISOString());

    // User A does not follow User B yet -> 404
    const saveFollowerReelRes = await app.inject({
      method: 'POST',
      url: `/api/v1/saved/reel/${secretReelId}`,
      headers: { authorization: `Bearer ${tokenA}` },
    });
    assert.equal(saveFollowerReelRes.statusCode, 404);

    // 2. User B blocks User A
    db.prepare(`
      INSERT INTO blocks (blocker_id, blocked_id, created_at)
      VALUES (?, ?, ?)
    `).run(userBId, userAId, new Date().toISOString());

    // User A tries to save a new public post of User B -> 404
    const newPostRes = await app.inject({
      method: 'POST',
      url: '/api/v1/posts',
      headers: { authorization: `Bearer ${tokenB}` },
      payload: { title: 'Post B', content: 'Public post by B', type: 'Discussion' },
    });
    const newPostId = JSON.parse(newPostRes.body).id;

    const saveBlockedPostRes = await app.inject({
      method: 'POST',
      url: `/api/v1/saved/post/${newPostId}`,
      headers: { authorization: `Bearer ${tokenA}` },
    });
    assert.equal(saveBlockedPostRes.statusCode, 404);

    // 3. Invalid target type returns 400
    const invalidTypeRes = await app.inject({
      method: 'POST',
      url: `/api/v1/saved/invalid_kind/123`,
      headers: { authorization: `Bearer ${tokenA}` },
    });
    assert.equal(invalidTypeRes.statusCode, 400);
  });
});
