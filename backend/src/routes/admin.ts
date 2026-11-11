import crypto from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { DatabaseSync } from 'node:sqlite';
import type { AuthMiddleware, UserStatus } from '../types.ts';

function appendAuditLog(
  db: DatabaseSync,
  {
    adminUser,
    action,
    targetType,
    targetId,
    details,
  }: {
    adminUser?: string;
    action: string;
    targetType: string;
    targetId: string;
    details: string;
  }
): void {
  db.prepare(
    'INSERT INTO audit_logs (id, timestamp, admin_user, action, target_type, target_id, details) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(
    'log_' + crypto.randomUUID().slice(0, 12),
    new Date().toISOString(),
    adminUser || 'quad_admin',
    action,
    targetType,
    targetId,
    details
  );
}

interface AdminUserRow {
  id: string;
  username: string;
  email: string;
  role: string;
  status: UserStatus;
  fullName: string;
  department: string;
  year: string;
  section: string;
  branch: string;
  avatarInitials: string;
  suspendedUntil: string | null;
  suspensionReason: string | null;
  bannedAt: string | null;
  banReason: string | null;
  createdAt: string;
}

export function registerAdminRoutes(
  app: FastifyInstance,
  db: DatabaseSync,
  auth: AuthMiddleware
): void {
  app.get('/api/v1/admin/metrics', { preHandler: auth.requireAdmin }, async () => {
    const users = db
      .prepare("SELECT status FROM users WHERE role != 'admin' AND status != 'deleted'")
      .all() as Array<{ status: UserStatus }>;
    const pendingRow = db
      .prepare("SELECT COUNT(*) AS c FROM reports WHERE status = 'pending'")
      .get() as { c: number };
    const activePostsRow = db
      .prepare("SELECT COUNT(*) AS c FROM posts WHERE status IN ('active', 'flagged')")
      .get() as { c: number };

    return {
      totalUsers: users.length,
      activeUsers: users.filter((u) => u.status === 'active').length,
      suspendedUsers: users.filter((u) => u.status === 'suspended').length,
      bannedUsers: users.filter((u) => u.status === 'banned').length,
      pendingReports: Number(pendingRow.c),
      activePosts: Number(activePostsRow.c),
    };
  });

  app.get<{ Querystring: { q?: string; status?: string } }>(
    '/api/v1/admin/users',
    { preHandler: auth.requireAdmin },
    async (request) => {
      const q = String(request.query?.q || '').trim().toLowerCase();
      const statusFilter = String(request.query?.status || 'all').toLowerCase();

      const rows = db
        .prepare(`
          SELECT id, username, email, role, status, full_name AS fullName, department, year, section,
                 branch, avatar_initials AS avatarInitials, suspended_until AS suspendedUntil,
                 suspension_reason AS suspensionReason, banned_at AS bannedAt, ban_reason AS banReason,
                 created_at AS createdAt
          FROM users
          WHERE role != 'admin' AND status != 'deleted'
          ORDER BY created_at DESC
        `)
        .all() as unknown as AdminUserRow[];

      return rows.filter((u) => {
        const matchesQ =
          !q ||
          u.username?.toLowerCase().includes(q) ||
          u.email?.toLowerCase().includes(q) ||
          u.fullName?.toLowerCase().includes(q) ||
          u.department?.toLowerCase().includes(q);
        const matchesStatus = statusFilter === 'all' || u.status === statusFilter;
        return matchesQ && matchesStatus;
      });
    }
  );

  app.post<{ Params: { userId: string }; Body: { days?: number; reason?: string } }>(
    '/api/v1/admin/users/:userId/suspend',
    { preHandler: [auth.requireAdmin, auth.requireAdminReauth] },
    async (request, reply) => {
      const user = db
        .prepare('SELECT id, username FROM users WHERE id = ? AND role != ?')
        .get(request.params.userId, 'admin') as { id: string; username: string } | undefined;
      if (!user) {
        return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'User not found.' } });
      }

      const days = Math.max(1, Math.min(365, Number(request.body?.days || 7)));
      const reason = String(
        request.body?.reason || 'Temporary violation of campus code of conduct'
      );
      const suspendedUntil = new Date(Date.now() + days * 86400000).toISOString();

      db.prepare(
        "UPDATE users SET status = 'suspended', suspended_until = ?, suspension_reason = ? WHERE id = ?"
      ).run(suspendedUntil, reason, user.id);
      db.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id);

      appendAuditLog(db, {
        adminUser: request.auth!.userRow.username,
        action: 'SUSPEND_USER',
        targetType: 'user',
        targetId: user.username,
        details: `Suspended for ${days} days. Reason: ${reason}`,
      });

      return { id: user.id, username: user.username, status: 'suspended', suspendedUntil };
    }
  );

  app.post<{ Params: { userId: string }; Body: { reason?: string } }>(
    '/api/v1/admin/users/:userId/ban',
    { preHandler: [auth.requireAdmin, auth.requireAdminReauth] },
    async (request, reply) => {
      const user = db
        .prepare('SELECT id, username FROM users WHERE id = ? AND role != ?')
        .get(request.params.userId, 'admin') as { id: string; username: string } | undefined;
      if (!user) {
        return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'User not found.' } });
      }

      const reason = String(request.body?.reason || 'Severe campus security policy violation');
      const bannedAt = new Date().toISOString();
      db.prepare(
        "UPDATE users SET status = 'banned', banned_at = ?, ban_reason = ? WHERE id = ?"
      ).run(bannedAt, reason, user.id);
      db.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id);

      appendAuditLog(db, {
        adminUser: request.auth!.userRow.username,
        action: 'BAN_USER',
        targetType: 'user',
        targetId: user.username,
        details: `Permanent ban executed. Reason: ${reason}`,
      });

      return { id: user.id, username: user.username, status: 'banned', bannedAt };
    }
  );

  app.post<{ Params: { userId: string } }>(
    '/api/v1/admin/users/:userId/reactivate',
    { preHandler: auth.requireAdmin },
    async (request, reply) => {
      const user = db
        .prepare('SELECT id, username FROM users WHERE id = ?')
        .get(request.params.userId) as { id: string; username: string } | undefined;
      if (!user) {
        return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'User not found.' } });
      }

      db.prepare(
        "UPDATE users SET status = 'active', suspended_until = NULL, banned_at = NULL, suspension_reason = NULL, ban_reason = NULL WHERE id = ?"
      ).run(user.id);

      appendAuditLog(db, {
        adminUser: request.auth!.userRow.username,
        action: 'REACTIVATE_USER',
        targetType: 'user',
        targetId: user.username,
        details: 'Account reactivated to regular standing.',
      });

      return { id: user.id, username: user.username, status: 'active' };
    }
  );

  app.get('/api/v1/admin/reports', { preHandler: auth.requireAdmin }, async () => {
    return db
      .prepare(`
        SELECT r.id, u.username AS reporterHandle, r.target_type AS targetType, r.target_id AS targetId,
               r.reason, r.details, r.content_snippet AS contentSnippet, r.status, r.action_taken AS actionTaken,
               r.resolved_at AS resolvedAt, r.created_at AS createdAt
        FROM reports r
        JOIN users u ON u.id = r.reporter_id
        ORDER BY CASE WHEN r.status = 'pending' THEN 0 ELSE 1 END, r.created_at DESC
      `)
      .all();
  });

  app.post<{ Params: { reportId: string } }>(
    '/api/v1/admin/reports/:reportId/dismiss',
    { preHandler: auth.requireAdmin },
    async (request, reply) => {
      const rep = db
        .prepare('SELECT id FROM reports WHERE id = ?')
        .get(request.params.reportId) as { id: string } | undefined;
      if (!rep) {
        return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Report not found.' } });
      }

      db.prepare("UPDATE reports SET status = 'dismissed', resolved_at = ? WHERE id = ?").run(
        new Date().toISOString(),
        rep.id
      );

      appendAuditLog(db, {
        adminUser: request.auth!.userRow.username,
        action: 'DISMISS_REPORT',
        targetType: 'report',
        targetId: rep.id,
        details: 'Report reviewed and dismissed as within guidelines.',
      });

      return { id: rep.id, status: 'dismissed' };
    }
  );

  app.post<{ Params: { reportId: string }; Body: { reason?: string } }>(
    '/api/v1/admin/reports/:reportId/remove',
    { preHandler: [auth.requireAdmin, auth.requireAdminReauth] },
    async (request, reply) => {
      const rep = db
        .prepare('SELECT * FROM reports WHERE id = ?')
        .get(request.params.reportId) as
        | { id: string; reason: string; target_type: string; target_id: string }
        | undefined;
      if (!rep) {
        return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Report not found.' } });
      }

      const reason = String(request.body?.reason || rep.reason || 'Violates campus code of conduct');
      const nowIso = new Date().toISOString();
      db.prepare(
        "UPDATE reports SET status = 'actioned', action_taken = 'CONTENT_REMOVED', resolved_at = ? WHERE id = ?"
      ).run(nowIso, rep.id);

      if (rep.target_type === 'post') {
        db.prepare(
          "UPDATE posts SET status = 'deleted', deleted_reason = ?, deleted_at = ? WHERE id = ?"
        ).run(reason, nowIso, rep.target_id);
      }

      appendAuditLog(db, {
        adminUser: request.auth!.userRow.username,
        action: 'REMOVE_REPORTED_CONTENT',
        targetType: rep.target_type,
        targetId: rep.target_id,
        details: `Removed reported item under report ${rep.id}. Reason: ${reason}`,
      });

      return { id: rep.id, status: 'actioned' };
    }
  );

  app.get('/api/v1/admin/posts', { preHandler: auth.requireAdmin }, async () => {
    return db
      .prepare(`
        SELECT p.id, u.username AS authorHandle, u.full_name AS authorName, u.department,
               p.content, p.created_at AS createdAt, p.status,
               (SELECT COUNT(*) FROM post_likes pl WHERE pl.post_id = p.id) AS likes,
               (SELECT COUNT(*) FROM reports r WHERE r.target_id = p.id AND r.target_type = 'post') AS reportsCount
        FROM posts p
        JOIN users u ON u.id = p.author_id
        ORDER BY p.created_at_ms DESC
      `)
      .all();
  });

  app.delete<{ Params: { postId: string }; Body: { reason?: string } }>(
    '/api/v1/admin/posts/:postId',
    { preHandler: [auth.requireAdmin, auth.requireAdminReauth] },
    async (request, reply) => {
      const post = db
        .prepare(
          'SELECT p.id, u.username AS authorHandle FROM posts p JOIN users u ON u.id = p.author_id WHERE p.id = ?'
        )
        .get(request.params.postId) as { id: string; authorHandle: string } | undefined;
      if (!post) {
        return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Post not found.' } });
      }

      const reason = String(request.body?.reason || 'Administrative moderation removal');
      const nowIso = new Date().toISOString();
      db.prepare(
        "UPDATE posts SET status = 'deleted', deleted_reason = ?, deleted_at = ? WHERE id = ?"
      ).run(reason, nowIso, post.id);

      appendAuditLog(db, {
        adminUser: request.auth!.userRow.username,
        action: 'DELETE_POST',
        targetType: 'post',
        targetId: post.id,
        details: `Post deleted by admin. Author: @${post.authorHandle}. Reason: ${reason}`,
      });

      return { id: post.id, status: 'deleted' };
    }
  );

  app.get('/api/v1/admin/audit-logs', { preHandler: auth.requireAdmin }, async () => {
    return db
      .prepare(
        'SELECT id, timestamp, admin_user AS adminUser, action, target_type AS targetType, target_id AS targetId, details FROM audit_logs ORDER BY timestamp DESC LIMIT 100'
      )
      .all();
  });
}
