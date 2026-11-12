import test, { after, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';

import { buildApp } from '../src/app.ts';

describe('Part 2: Directory & Who to follow Single Source of Truth', () => {
  let app: FastifyInstance;
  let tmpDir: string;

  let tokenA = '';
  let tokenB = '';
  let tokenC = '';

  async function signupStudent(email: string, username: string, dept: string, year: string, section: string) {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/signup',
      payload: {
        email,
        username,
        department: dept,
        year,
        section,
        password: 'Password@123',
        bio: `Bio for ${username}`,
        interests: ['Systems', 'Compilers'],
      },
    });
    assert.equal(res.statusCode, 201);
    return res.json() as { session: { token: string }; user: { id: string; username: string } };
  }

  before(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'quad-discovery-test-'));
    const built = await buildApp({ dbPath: path.join(tmpDir, 'test.db'), logger: false });
    app = built.app;

    const a = await signupStudent(
      'user_a@btech.college.edu.in',
      'user_a',
      'Computer Science & Engineering - Computer Science',
      '3rd Year',
      'A'
    );
    const b = await signupStudent(
      'user_b@btech.college.edu.in',
      'user_b',
      'Computer Science & Engineering - Computer Science',
      '3rd Year',
      'B'
    );
    const c = await signupStudent(
      'user_c@btech.college.edu.in',
      'user_c',
      'Information Technology',
      '2nd Year',
      'A'
    );

    tokenA = a.session.token;
    tokenB = b.session.token;
    tokenC = c.session.token;

    // A turns Directory ON; B turns Directory ON; C keeps Directory OFF
    const patchA = await app.inject({
      method: 'PATCH',
      url: '/api/v1/users/me',
      headers: { authorization: `Bearer ${tokenA}` },
      payload: { directoryVisible: true },
    });
    assert.equal(patchA.statusCode, 200);
    assert.equal(patchA.json().directoryVisible, true);

    const patchB = await app.inject({
      method: 'PATCH',
      url: '/api/v1/users/me',
      headers: { authorization: `Bearer ${tokenB}` },
      payload: { directoryVisible: true },
    });
    assert.equal(patchB.statusCode, 200);
  });

  after(async () => {
    if (app) await app.close();
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('User A (Directory ON) appears for B; User C (Directory OFF) never appears for anyone', async () => {
    const dirForB = await app.inject({
      method: 'GET',
      url: '/api/v1/directory?limit=50',
      headers: { authorization: `Bearer ${tokenB}` },
    });
    assert.equal(dirForB.statusCode, 200);
    const dirHandlesB = (dirForB.json().items as Array<{ username: string }>).map((u) => u.username);
    assert.ok(dirHandlesB.includes('user_a'), 'User A should appear in Directory for B');
    assert.ok(!dirHandlesB.includes('user_b'), 'Self (B) must be excluded');
    assert.ok(!dirHandlesB.includes('user_c'), 'User C (Directory OFF) must not appear in Directory');

    const wtfForB = await app.inject({
      method: 'GET',
      url: '/api/v1/who-to-follow?limit=20',
      headers: { authorization: `Bearer ${tokenB}` },
    });
    assert.equal(wtfForB.statusCode, 200);
    const wtfHandlesB = (wtfForB.json().items as Array<{ username: string }>).map((u) => u.username);
    assert.ok(wtfHandlesB.includes('user_a'), 'User A should appear in Who to follow for B');
    assert.ok(!wtfHandlesB.includes('user_c'), 'User C (Directory OFF) must not appear in Who to follow');

    const searchForA = await app.inject({
      method: 'GET',
      url: '/api/v1/users/search?q=user_c',
      headers: { authorization: `Bearer ${tokenA}` },
    });
    assert.equal(searchForA.statusCode, 200);
    assert.equal((searchForA.json().items as unknown[]).length, 0);

    // Discovery profile lookup must block hidden user C
    const profileCForB = await app.inject({
      method: 'GET',
      url: '/api/v1/users/user_c/profile',
      headers: { authorization: `Bearer ${tokenB}` },
    });
    assert.equal(profileCForB.statusCode, 404);
  });

  test('User C (Directory OFF) can still browse User A in Directory, Who to follow, and profile lookup', async () => {
    const dirForC = await app.inject({
      method: 'GET',
      url: '/api/v1/directory?limit=50',
      headers: { authorization: `Bearer ${tokenC}` },
    });
    assert.equal(dirForC.statusCode, 200);
    const dirHandlesC = (dirForC.json().items as Array<{ username: string }>).map((u) => u.username);
    assert.ok(dirHandlesC.includes('user_a'), 'User C (Directory OFF) can still see User A in Directory');
    assert.ok(dirHandlesC.includes('user_b'), 'User C (Directory OFF) can still see User B in Directory');
    assert.ok(!dirHandlesC.includes('user_c'));

    const wtfForC = await app.inject({
      method: 'GET',
      url: '/api/v1/who-to-follow?limit=20',
      headers: { authorization: `Bearer ${tokenC}` },
    });
    assert.equal(wtfForC.statusCode, 200);
    const wtfHandlesC = (wtfForC.json().items as Array<{ username: string }>).map((u) => u.username);
    assert.ok(wtfHandlesC.includes('user_a'), 'User C (Directory OFF) can still see User A in Who to follow');

    // A creates both a public post and a private personal space post
    await app.inject({
      method: 'POST',
      url: '/api/v1/posts',
      headers: { authorization: `Bearer ${tokenA}` },
      payload: { type: 'Discussion', title: 'Public note', content: 'Visible campus post', space: 'public' },
    });
    await app.inject({
      method: 'POST',
      url: '/api/v1/posts',
      headers: { authorization: `Bearer ${tokenA}` },
      payload: { type: 'Update', title: 'Secret note', content: 'Private vault post', space: 'personal', audience: 'followers' },
    });

    const profileA = await app.inject({
      method: 'GET',
      url: '/api/v1/users/user_a/profile',
      headers: { authorization: `Bearer ${tokenC}` },
    });
    assert.equal(profileA.statusCode, 200);
    const body = profileA.json();
    assert.equal(body.user.username, 'user_a');
    assert.equal(body.publicPosts.length, 1);
    assert.equal(body.personalPosts.length, 0, 'Private personal space must remain hidden to non-followers');
  });

  test('Excludes pending follow requests, accepted follows, and blocks from both Directory and Who to follow', async () => {
    // C requests to follow B -> B must disappear from C's Directory & Who to follow immediately
    const reqRes = await app.inject({
      method: 'POST',
      url: '/api/v1/follow-requests',
      headers: { authorization: `Bearer ${tokenC}` },
      payload: { targetUsername: 'user_b' },
    });
    assert.ok(reqRes.statusCode === 200 || reqRes.statusCode === 201);

    const dirAfterReq = await app.inject({
      method: 'GET',
      url: '/api/v1/directory?limit=50',
      headers: { authorization: `Bearer ${tokenC}` },
    });
    const wtfAfterReq = await app.inject({
      method: 'GET',
      url: '/api/v1/who-to-follow?limit=20',
      headers: { authorization: `Bearer ${tokenC}` },
    });
    assert.ok(!(dirAfterReq.json().items as Array<{ username: string }>).some((u) => u.username === 'user_b'));
    assert.ok(!(wtfAfterReq.json().items as Array<{ username: string }>).some((u) => u.username === 'user_b'));
    // Note: B also shouldn't see C anyway (C is Directory OFF), and if B accepts, C won't see B in discovery either.

    // Check overview on B to find pending request id, accept it -> B stays excluded from C's discovery
    const ovB = await app.inject({
      method: 'GET',
      url: '/api/v1/social/overview',
      headers: { authorization: `Bearer ${tokenB}` },
    });
    const reqItem = (ovB.json().followRequests as Array<{ id: string; username: string }>).find(
      (r) => r.username === 'user_c'
    );
    assert.ok(reqItem, 'B should see follow request from C');
    const acceptRes = await app.inject({
      method: 'POST',
      url: `/api/v1/follow-requests/${reqItem!.id}/respond`,
      headers: { authorization: `Bearer ${tokenB}` },
      payload: { action: 'accept', group: 'Classmates' },
    });
    assert.equal(acceptRes.statusCode, 200);

    const dirAfterAccept = await app.inject({
      method: 'GET',
      url: '/api/v1/directory?limit=50',
      headers: { authorization: `Bearer ${tokenC}` },
    });
    const wtfAfterAccept = await app.inject({
      method: 'GET',
      url: '/api/v1/who-to-follow?limit=20',
      headers: { authorization: `Bearer ${tokenC}` },
    });
    assert.ok(!(dirAfterAccept.json().items as Array<{ username: string }>).some((u) => u.username === 'user_b'));
    assert.ok(!(wtfAfterAccept.json().items as Array<{ username: string }>).some((u) => u.username === 'user_b'));

    // Blocking User A excludes A bidirectionally from Directory and Who to follow
    const blockRes = await app.inject({
      method: 'POST',
      url: '/api/v1/blocks',
      headers: { authorization: `Bearer ${tokenB}` },
      payload: { username: 'user_a', reason: 'Test block' },
    });
    assert.equal(blockRes.statusCode, 200);
    const dirAForB = await app.inject({
      method: 'GET',
      url: '/api/v1/directory?limit=50',
      headers: { authorization: `Bearer ${tokenB}` },
    });
    const dirBForA = await app.inject({
      method: 'GET',
      url: '/api/v1/directory?limit=50',
      headers: { authorization: `Bearer ${tokenA}` },
    });
    assert.ok(!(dirAForB.json().items as Array<{ username: string }>).some((u) => u.username === 'user_a'));
    assert.ok(!(dirBForA.json().items as Array<{ username: string }>).some((u) => u.username === 'user_b'));
  });
});
