import test, { after, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';

import { buildApp } from '../src/app.ts';

interface ReplyDto {
  id: string;
  threadId: string;
  parentCommentId: string | null;
  replyToUserId: string | null;
  replyToUsername: string | null;
  username: string;
  content: string;
  body: string;
  isDeleted: boolean;
  hasMoreReplies?: boolean;
  hiddenReplyCount?: number;
  reportedByMe?: boolean;
  replies: ReplyDto[];
}

describe('Part 3: Threads Reddit-Style Nested Replies', () => {
  let app: FastifyInstance;
  let tmpDir: string;

  let tokenA = '';
  let tokenB = '';
  let tokenC = '';
  let tokenAdmin = '';

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
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'quad-threads-test-'));
    const built = await buildApp({ dbPath: path.join(tmpDir, 'test.db'), logger: false });
    app = built.app;

    const a = await signupStudent('ta@btech.college.edu.in', 'thread_wizard');
    const b = await signupStudent('tb@btech.college.edu.in', 'thread_quantum');
    const c = await signupStudent('tc@btech.college.edu.in', 'thread_spark');
    tokenA = a.session.token;
    tokenB = b.session.token;
    tokenC = c.session.token;

    const adminLogin = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        identifier: 'quad_admin',
        password: process.env.DEFAULT_ADMIN_PASSWORD || 'QuadAdmin@2026!',
      },
    });
    if (adminLogin.statusCode === 200) {
      tokenAdmin = (adminLogin.json() as { session: { token: string } }).session.token;
    }
  });

  after(async () => {
    await app.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('supports deep nested replies, depth trimming, lazy branch loading, and reply-to notifications', async () => {
    // A creates a thread
    const tRes = await app.inject({
      method: 'POST',
      url: '/api/v1/threads',
      headers: { Authorization: `Bearer ${tokenA}` },
      payload: { content: 'Who is down for late night compiler study?' },
    });
    assert.equal(tRes.statusCode, 201);
    const thread = tRes.json() as { id: string };

    // Depth 0: A posts top-level comment
    const r0 = await app.inject({
      method: 'POST',
      url: `/api/v1/threads/${thread.id}/replies`,
      headers: { Authorization: `Bearer ${tokenA}` },
      payload: { body: 'hey whatsapp' },
    });
    assert.equal(r0.statusCode, 201);
    const c0 = r0.json() as ReplyDto;
    assert.equal(c0.parentCommentId, null);
    assert.equal(c0.replyToUsername, null);

    // Depth 1: B replies to A's comment
    const r1 = await app.inject({
      method: 'POST',
      url: `/api/v1/threads/${thread.id}/replies`,
      headers: { Authorization: `Bearer ${tokenB}` },
      payload: { body: 'bro its whatsup not whatsapp', parentCommentId: c0.id },
    });
    assert.equal(r1.statusCode, 201);
    const c1 = r1.json() as ReplyDto;
    assert.equal(c1.parentCommentId, c0.id);
    assert.equal(c1.replyToUsername, 'thread_wizard');

    // Depth 2: A replies to B's reply
    const r2 = await app.inject({
      method: 'POST',
      url: `/api/v1/threads/${thread.id}/replies`,
      headers: { Authorization: `Bearer ${tokenA}` },
      payload: { body: 'haha my bad', parentCommentId: c1.id },
    });
    assert.equal(r2.statusCode, 201);
    const c2 = r2.json() as ReplyDto;
    assert.equal(c2.parentCommentId, c1.id);
    assert.equal(c2.replyToUsername, 'thread_quantum');

    // Depth 3: C replies to A's depth-2 reply (beyond default maxDepth=2)
    const r3 = await app.inject({
      method: 'POST',
      url: `/api/v1/threads/${thread.id}/replies`,
      headers: { Authorization: `Bearer ${tokenC}` },
      payload: { body: 'deep nested level 3', parentCommentId: c2.id },
    });
    assert.equal(r3.statusCode, 201);
    const c3 = r3.json() as ReplyDto;
    assert.equal(c3.parentCommentId, c2.id);
    assert.equal(c3.replyToUsername, 'thread_wizard');

    // Default GET /threads returns depth 0 -> 1 -> 2, and trims depth 3 behind hasMoreReplies
    const listRes = await app.inject({
      method: 'GET',
      url: '/api/v1/threads',
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.equal(listRes.statusCode, 200);
    const listBody = listRes.json() as {
      items: Array<{ id: string; replyCount: number; replies: ReplyDto[] }>;
    };
    const foundThread = listBody.items.find((x) => x.id === thread.id)!;
    assert.ok(foundThread);
    assert.equal(foundThread.replyCount, 4);
    assert.equal(foundThread.replies[0].replies[0].replies[0].id, c2.id);
    assert.equal(foundThread.replies[0].replies[0].replies[0].hasMoreReplies, true);
    assert.equal(foundThread.replies[0].replies[0].replies[0].hiddenReplyCount, 1);
    assert.equal(foundThread.replies[0].replies[0].replies[0].replies.length, 0);

    // Lazy fetch deeper branch via GET /threads/:id/replies?parentId=c2.id
    const deeperRes = await app.inject({
      method: 'GET',
      url: `/api/v1/threads/${thread.id}/replies?parentId=${c2.id}`,
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.equal(deeperRes.statusCode, 200);
    const deeperBody = deeperRes.json() as { items: ReplyDto[] };
    assert.equal(deeperBody.items.length, 1);
    assert.equal(deeperBody.items[0].id, c3.id);
    assert.equal(deeperBody.items[0].replyToUsername, 'thread_wizard');

    // Notification check: B received notification from A's depth-2 reply to B's comment
    const notifB = await app.inject({
      method: 'GET',
      url: '/api/v1/social/overview',
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert.equal(notifB.statusCode, 200);
    const notifBItems = (notifB.json() as { notifications: Array<{ kind: string; title: string }> }).notifications;
    assert.ok(
      notifBItems.some((n) => n.kind === 'thread_reply' && n.title.includes('@thread_wizard replied to your comment'))
    );
  });

  test('validates same-thread parentCommentId, length limit, soft-delete keeping children, pagination, and rate limiting', async () => {
    const t1 = (
      await app.inject({
        method: 'POST',
        url: '/api/v1/threads',
        headers: { Authorization: `Bearer ${tokenA}` },
        payload: { content: 'Thread One' },
      })
    ).json() as { id: string };

    const t2 = (
      await app.inject({
        method: 'POST',
        url: '/api/v1/threads',
        headers: { Authorization: `Bearer ${tokenB}` },
        payload: { content: 'Thread Two' },
      })
    ).json() as { id: string };

    const parentInT1 = (
      await app.inject({
        method: 'POST',
        url: `/api/v1/threads/${t1.id}/replies`,
        headers: { Authorization: `Bearer ${tokenA}` },
        payload: { body: 'Parent in thread 1' },
      })
    ).json() as ReplyDto;

    // Cross-thread parentCommentId must fail
    const crossThreadRes = await app.inject({
      method: 'POST',
      url: `/api/v1/threads/${t2.id}/replies`,
      headers: { Authorization: `Bearer ${tokenB}` },
      payload: { body: 'Trying cross thread parent', parentCommentId: parentInT1.id },
    });
    assert.equal(crossThreadRes.statusCode, 400);
    assert.equal(crossThreadRes.json().error.code, 'INVALID_PARENT');

    // Auto-mention replying to a user with Directory OFF must always be allowed
    await app.inject({
      method: 'PATCH',
      url: '/api/v1/users/me',
      headers: { Authorization: `Bearer ${tokenA}` },
      payload: { directoryVisible: false },
    });
    const autoMentionHiddenRes = await app.inject({
      method: 'POST',
      url: `/api/v1/threads/${t1.id}/replies`,
      headers: { Authorization: `Bearer ${tokenC}` },
      payload: { body: '@thread_wizard thanks for clarifying!', parentCommentId: parentInT1.id },
    });
    assert.equal(autoMentionHiddenRes.statusCode, 201);
    assert.equal((autoMentionHiddenRes.json() as ReplyDto).replyToUsername, 'thread_wizard');

    // Too long (>2000 chars)
    const longRes = await app.inject({
      method: 'POST',
      url: `/api/v1/threads/${t1.id}/replies`,
      headers: { Authorization: `Bearer ${tokenB}` },
      payload: { body: 'x'.repeat(2001), parentCommentId: parentInT1.id },
    });
    assert.equal(longRes.statusCode, 400);
    assert.equal(longRes.json().error.code, 'REPLY_TOO_LONG');

    // Add child then delete parent: parent turns into [deleted] while child remains
    const childRes = await app.inject({
      method: 'POST',
      url: `/api/v1/threads/${t1.id}/replies`,
      headers: { Authorization: `Bearer ${tokenB}` },
      payload: { body: 'Child must survive', parentCommentId: parentInT1.id },
    });
    assert.equal(childRes.statusCode, 201);
    const child = childRes.json() as ReplyDto;

    const delParentRes = await app.inject({
      method: 'DELETE',
      url: `/api/v1/threads/${t1.id}/replies/${parentInT1.id}`,
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.equal(delParentRes.statusCode, 200);
    assert.equal(delParentRes.json().softDeleted, true);

    const treeAfterDelete = (
      await app.inject({
        method: 'GET',
        url: `/api/v1/threads/${t1.id}/replies`,
        headers: { Authorization: `Bearer ${tokenA}` },
      })
    ).json() as { items: ReplyDto[] };
    assert.equal(treeAfterDelete.items.length, 1);
    assert.equal(treeAfterDelete.items[0].content, '[deleted]');
    assert.equal(treeAfterDelete.items[0].isDeleted, true);
    assert.equal(treeAfterDelete.items[0].replies.length, 2);
    assert.ok(treeAfterDelete.items[0].replies.some((r) => r.id === child.id));

    // Pagination on threads
    const page1 = (
      await app.inject({
        method: 'GET',
        url: '/api/v1/threads?limit=1&offset=0',
      })
    ).json() as { items: Array<{ id: string }>; hasMore: boolean; nextOffset: number; total: number };
    assert.equal(page1.items.length, 1);
    assert.equal(page1.hasMore, true);
    assert.equal(page1.nextOffset, 1);
    assert.ok(page1.total >= 2);

    // Rate limiting: > 30 replies in 1 min from C triggers 429
    let hitRateLimit = false;
    for (let i = 0; i < 32; i++) {
      const rr = await app.inject({
        method: 'POST',
        url: `/api/v1/threads/${t1.id}/replies`,
        headers: { Authorization: `Bearer ${tokenC}` },
        payload: { body: `Spam reply #${i}` },
      });
      if (rr.statusCode === 429) {
        hitRateLimit = true;
        break;
      }
    }
    assert.equal(hitRateLimit, true);
  });

  test('Part 4: reports on thread comments and nested replies prevent duplicates, support Undo, feed admin queue, and protect reporter privacy', async () => {
    const tRes = await app.inject({
      method: 'POST',
      url: '/api/v1/threads',
      headers: { Authorization: `Bearer ${tokenA}` },
      payload: { content: 'Moderation test discussion' },
    });
    assert.equal(tRes.statusCode, 201);
    const thread = tRes.json() as { id: string };

    const topReply = (
      await app.inject({
        method: 'POST',
        url: `/api/v1/threads/${thread.id}/replies`,
        headers: { Authorization: `Bearer ${tokenA}` },
        payload: { body: 'Top comment content' },
      })
    ).json() as ReplyDto;

    const childReply = (
      await app.inject({
        method: 'POST',
        url: `/api/v1/threads/${thread.id}/replies`,
        headers: { Authorization: `Bearer ${tokenB}` },
        payload: { body: 'Nested abusive reply snapshot', parentCommentId: topReply.id },
      })
    ).json() as ReplyDto;

    // A cannot report A's own comment
    const selfReport = await app.inject({
      method: 'POST',
      url: '/api/v1/reports',
      headers: { Authorization: `Bearer ${tokenA}` },
      payload: {
        targetType: 'thread_comment',
        targetId: topReply.id,
        reason: 'Spam',
      },
    });
    assert.equal(selfReport.statusCode, 400);

    // A reports B's nested reply
    const repRes = await app.inject({
      method: 'POST',
      url: '/api/v1/reports',
      headers: { Authorization: `Bearer ${tokenA}` },
      payload: {
        targetType: 'thread_comment',
        targetId: childReply.id,
        reason: 'Harassment or bullying',
        contentSnippet: 'Nested abusive reply snapshot',
      },
    });
    assert.equal(repRes.statusCode, 201);

    // Duplicate report by A on same reply must return 409 "You already reported this"
    const dupRes = await app.inject({
      method: 'POST',
      url: '/api/v1/reports',
      headers: { Authorization: `Bearer ${tokenA}` },
      payload: {
        targetType: 'thread_comment',
        targetId: childReply.id,
        reason: 'Spam',
      },
    });
    assert.equal(dupRes.statusCode, 409);
    assert.equal(dupRes.json().error.message, 'You already reported this');

    // Reporter sees reportedByMe: true; reported user (B) sees reportedByMe: false and NO reporter identity anywhere
    const forA = (
      await app.inject({
        method: 'GET',
        url: `/api/v1/threads/${thread.id}/replies`,
        headers: { Authorization: `Bearer ${tokenA}` },
      })
    ).json() as { items: Array<ReplyDto & { reportedByMe?: boolean }> };
    assert.equal(forA.items[0].replies[0].reportedByMe, true);

    const forB = (
      await app.inject({
        method: 'GET',
        url: `/api/v1/threads/${thread.id}/replies`,
        headers: { Authorization: `Bearer ${tokenB}` },
      })
    ).json() as { items: Array<ReplyDto & { reportedByMe?: boolean }> };
    assert.equal(forB.items[0].replies[0].reportedByMe, false);
    assert.equal(JSON.stringify(forB).includes('thread_wizard'), true); // author of topReply only, not as reporter
    assert.equal(JSON.stringify(forB).includes('rep_'), false);

    // Notifications for B must NOT contain report alert
    const notifB = (
      await app.inject({
        method: 'GET',
        url: '/api/v1/social/overview',
        headers: { Authorization: `Bearer ${tokenB}` },
      })
    ).json() as { notifications: Array<{ kind: string; title: string }> };
    assert.equal(
      notifB.notifications.some((n) => n.title.toLowerCase().includes('report')),
      false
    );

    // Undo pending report deletes it and clears reportedByMe
    const undoRes = await app.inject({
      method: 'DELETE',
      url: `/api/v1/reports/target/thread_comment/${childReply.id}`,
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.equal(undoRes.statusCode, 200);

    const afterUndo = (
      await app.inject({
        method: 'GET',
        url: `/api/v1/threads/${thread.id}/replies`,
        headers: { Authorization: `Bearer ${tokenA}` },
      })
    ).json() as { items: Array<ReplyDto & { reportedByMe?: boolean }> };
    assert.equal(afterUndo.items[0].replies[0].reportedByMe, false);

    // Re-report so admin queue receives it with full context
    const repAgain = await app.inject({
      method: 'POST',
      url: '/api/v1/reports',
      headers: { Authorization: `Bearer ${tokenA}` },
      payload: {
        targetType: 'thread_comment',
        targetId: childReply.id,
        reason: 'Harassment or bullying',
      },
    });
    assert.equal(repAgain.statusCode, 201);
    const reportId = (repAgain.json() as { id: string }).id;

    if (tokenAdmin) {
      const queueRes = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/reports',
        headers: { Authorization: `Bearer ${tokenAdmin}` },
      });
      assert.equal(queueRes.statusCode, 200);
      const qItem = (
        queueRes.json() as Array<{
          id: string;
          targetType: string;
          targetId: string;
          contentSnippet: string;
          targetContext?: { threadId: string; commentId: string; authorUsername: string } | null;
        }>
      ).find((r) => r.id === reportId)!;
      assert.ok(qItem);
      assert.equal(qItem.targetType, 'thread_comment');
      assert.equal(qItem.targetId, childReply.id);
      assert.equal(qItem.contentSnippet, 'Nested abusive reply snapshot');
      assert.equal(qItem.targetContext?.threadId, thread.id);
      assert.equal(qItem.targetContext?.authorUsername, 'thread_quantum');
    }
  });
});
