/**
 * Admin Service (Real Backend + Mock Fallback Implementation)
 *
 * When VITE_AUTH_MODE=real, all methods hit Fastify + SQLite admin endpoints
 * with server-side RBAC, session timeouts, audit logging, and password re-auth.
 * When VITE_AUTH_MODE=mock, falls back to localStorage mock storage.
 */

import { IS_REAL_BACKEND, apiRequest } from '../apiClient';

const STORAGE_KEYS = {
  USERS: 'campus_shield_mock_users',
  REPORTS: 'campus_shield_mock_reports',
  POSTS: 'campus_shield_mock_posts',
  AUDIT_LOGS: 'campus_shield_mock_audit_log',
};

const SEED_REPORTS = [
  {
    id: 'rep_001',
    reporterHandle: 'cyber_sage',
    targetType: 'post',
    targetId: 'post_003',
    reason: 'Hate speech & Code of Conduct violation',
    details: 'Post targets junior hostel students with derogatory comments.',
    status: 'pending',
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    contentSnippet: 'Why are these junior sections even allowed in the engineering lab?',
  },
  {
    id: 'rep_002',
    reporterHandle: 'algo_ninja',
    targetType: 'post',
    targetId: 'post_004',
    reason: 'Academic Dishonesty / Paid Exam Help',
    details: 'Selling leaked question papers for mid-terms on Telegram.',
    status: 'pending',
    createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
    contentSnippet: 'DM for mid-term OS and DBMS papers 100% genuine guaranteed.',
  },
  {
    id: 'rep_003',
    reporterHandle: 'quantum_dev',
    targetType: 'user',
    targetId: 'usr_spammer_99',
    reason: 'Commercial Spam Bot',
    details: 'Automated account spamming crypto investment links.',
    status: 'pending',
    createdAt: new Date(Date.now() - 3600000 * 12).toISOString(),
    contentSnippet: 'Earn 5000 daily with campus part-time tasks bit.ly/campus-scam',
  },
];

const SEED_POSTS = [
  {
    id: 'post_001',
    authorHandle: 'quantum_dev',
    authorName: 'Aarav Patel',
    department: 'Computer Science & Engineering - Computer Science',
    content: 'Campus Hackathon 2026 starts this Saturday in Main Auditorium! Register your teams before Friday 11:59 PM.',
    createdAt: new Date(Date.now() - 3600000 * 14).toISOString(),
    likes: 42,
    reportsCount: 0,
    status: 'active',
  },
  {
    id: 'post_002',
    authorHandle: 'cyber_sage',
    authorName: 'Rohan Verma',
    department: 'Computer Science & Engineering - Computer Science',
    content: 'Operating Systems lecture notes for Virtual Memory & TLBs uploaded to student repository.',
    createdAt: new Date(Date.now() - 3600000 * 8).toISOString(),
    likes: 67,
    reportsCount: 0,
    status: 'active',
  },
  {
    id: 'post_003',
    authorHandle: 'anonymous_cadet',
    authorName: 'Hostel Cadet',
    department: 'Mechanical Engineering',
    content: 'Why are these junior sections even allowed in the engineering lab? Total nuisance.',
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    likes: 2,
    reportsCount: 3,
    status: 'flagged',
  },
  {
    id: 'post_004',
    authorHandle: 'usr_spammer_99',
    authorName: 'Campus Deals',
    department: 'Information Technology',
    content: 'DM for mid-term OS and DBMS papers 100% genuine guaranteed. Telegram @fastgrades.',
    createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
    likes: 0,
    reportsCount: 6,
    status: 'flagged',
  },
];

const SEED_AUDIT_LOGS = [
  {
    id: 'log_seed_1',
    timestamp: new Date(Date.now() - 86400000 * 2).toISOString(),
    adminUser: 'quad_admin',
    action: 'SYSTEM_BOOT',
    targetType: 'system',
    targetId: 'auth_service',
    details: 'Admin audit log initial bootstrap complete.',
  },
  {
    id: 'log_seed_2',
    timestamp: new Date(Date.now() - 86400000).toISOString(),
    adminUser: 'quad_admin',
    action: 'POLICY_UPDATE',
    targetType: 'security',
    targetId: 'rate_limiter',
    details: 'Enforced 5 failed login attempt lockout (15-min duration).',
  },
];

class AdminService {
  constructor() {
    this._initStorage();
  }

  _initStorage() {
    if (typeof window === 'undefined') return;
    try {
      if (!localStorage.getItem(STORAGE_KEYS.REPORTS)) {
        localStorage.setItem(STORAGE_KEYS.REPORTS, JSON.stringify(SEED_REPORTS));
      }
      if (!localStorage.getItem(STORAGE_KEYS.POSTS)) {
        localStorage.setItem(STORAGE_KEYS.POSTS, JSON.stringify(SEED_POSTS));
      }
      if (!localStorage.getItem(STORAGE_KEYS.AUDIT_LOGS)) {
        localStorage.setItem(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify(SEED_AUDIT_LOGS));
      }
    } catch (e) {
      console.warn('AdminService storage initialization error:', e);
    }
  }

  _getUsers() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.USERS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  _saveUsers(users) {
    try {
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
    } catch (e) {
      console.warn('Failed to save users:', e);
    }
  }

  _getReports() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.REPORTS);
      return data ? JSON.parse(data) : SEED_REPORTS;
    } catch {
      return SEED_REPORTS;
    }
  }

  _saveReports(reports) {
    try {
      localStorage.setItem(STORAGE_KEYS.REPORTS, JSON.stringify(reports));
    } catch (e) {
      console.warn('Failed to save reports:', e);
    }
  }

  _getPosts() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.POSTS);
      return data ? JSON.parse(data) : SEED_POSTS;
    } catch {
      return SEED_POSTS;
    }
  }

  _savePosts(posts) {
    try {
      localStorage.setItem(STORAGE_KEYS.POSTS, JSON.stringify(posts));
    } catch (e) {
      console.warn('Failed to save posts:', e);
    }
  }

  // --- Audit Logging ---
  recordAuditLog({ adminUser, action, targetType, targetId, details }) {
    try {
      const current = this.getAuditLogs();
      const newEntry = {
        id: 'log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        timestamp: new Date().toISOString(),
        adminUser: adminUser || 'quad_admin',
        action,
        targetType,
        targetId,
        details,
      };
      const updated = [newEntry, ...current].slice(0, 100); // Keep last 100 entries
      localStorage.setItem(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify(updated));
      return newEntry;
    } catch (e) {
      console.warn('Failed to record audit log:', e);
      return null;
    }
  }

  async getAuditLogs() {
    if (IS_REAL_BACKEND) {
      return apiRequest('/admin/audit-logs', { method: 'GET' });
    }
    try {
      const data = localStorage.getItem(STORAGE_KEYS.AUDIT_LOGS);
      return data ? JSON.parse(data) : SEED_AUDIT_LOGS;
    } catch {
      return SEED_AUDIT_LOGS;
    }
  }

  // --- Dashboard Metrics ---
  async getDashboardMetrics() {
    if (IS_REAL_BACKEND) {
      return apiRequest('/admin/metrics', { method: 'GET' });
    }
    const users = this._getUsers();
    const reports = this._getReports();
    const posts = this._getPosts();

    const activeUsers = users.filter((u) => !u.status || u.status === 'active').length;
    const suspendedUsers = users.filter((u) => u.status === 'suspended').length;
    const bannedUsers = users.filter((u) => u.status === 'banned').length;
    const pendingReports = reports.filter((r) => r.status === 'pending').length;
    const activePosts = posts.filter((p) => p.status === 'active' || p.status === 'flagged').length;

    return {
      totalUsers: users.length,
      activeUsers,
      suspendedUsers,
      bannedUsers,
      pendingReports,
      activePosts,
    };
  }

  // --- User Management ---
  async getUsers(searchQuery = '', statusFilter = 'all') {
    if (IS_REAL_BACKEND) {
      const params = new URLSearchParams();
      if (searchQuery) params.set('q', searchQuery);
      if (statusFilter) params.set('status', statusFilter);
      return apiRequest(`/admin/users?${params.toString()}`, { method: 'GET' });
    }
    const users = this._getUsers();
    const query = (searchQuery || '').trim().toLowerCase();

    return users.filter((u) => {
      // Exclude master admin from regular user listing to avoid self-ban
      if (u.role === 'admin') return false;

      const matchesQuery =
        !query ||
        u.username?.toLowerCase().includes(query) ||
        u.email?.toLowerCase().includes(query) ||
        u.fullName?.toLowerCase().includes(query) ||
        u.department?.toLowerCase().includes(query);

      const userStatus = u.status || 'active';
      const matchesStatus = statusFilter === 'all' || userStatus === statusFilter;

      return matchesQuery && matchesStatus;
    });
  }

  async suspendUser(userId, days = 7, reason = '', adminIdentifier = 'admin') {
    if (IS_REAL_BACKEND) {
      return apiRequest(`/admin/users/${encodeURIComponent(userId)}/suspend`, {
        method: 'POST',
        body: { days, reason },
      });
    }
    const users = this._getUsers();
    const index = users.findIndex((u) => u.id === userId);
    if (index === -1) throw new Error('User not found');

    const suspendedUntil = new Date(Date.now() + days * 86400000).toISOString();
    users[index] = {
      ...users[index],
      status: 'suspended',
      suspendedUntil,
      suspensionReason: reason,
    };
    this._saveUsers(users);

    this.recordAuditLog({
      adminUser: adminIdentifier,
      action: 'SUSPEND_USER',
      targetType: 'user',
      targetId: users[index].username,
      details: `Suspended for ${days} days. Reason: ${reason || 'Violation of campus conduct'}`,
    });

    return users[index];
  }

  async banUser(userId, reason = '', adminIdentifier = 'admin') {
    if (IS_REAL_BACKEND) {
      return apiRequest(`/admin/users/${encodeURIComponent(userId)}/ban`, {
        method: 'POST',
        body: { reason },
      });
    }
    const users = this._getUsers();
    const index = users.findIndex((u) => u.id === userId);
    if (index === -1) throw new Error('User not found');

    users[index] = {
      ...users[index],
      status: 'banned',
      bannedAt: new Date().toISOString(),
      banReason: reason,
    };
    this._saveUsers(users);

    this.recordAuditLog({
      adminUser: adminIdentifier,
      action: 'BAN_USER',
      targetType: 'user',
      targetId: users[index].username,
      details: `Permanent ban executed. Reason: ${reason || 'Severe security violation'}`,
    });

    return users[index];
  }

  async reactivateUser(userId, adminIdentifier = 'admin') {
    if (IS_REAL_BACKEND) {
      return apiRequest(`/admin/users/${encodeURIComponent(userId)}/reactivate`, {
        method: 'POST',
      });
    }
    const users = this._getUsers();
    const index = users.findIndex((u) => u.id === userId);
    if (index === -1) throw new Error('User not found');

    users[index] = {
      ...users[index],
      status: 'active',
      suspendedUntil: null,
      bannedAt: null,
      suspensionReason: null,
      banReason: null,
    };
    this._saveUsers(users);

    this.recordAuditLog({
      adminUser: adminIdentifier,
      action: 'REACTIVATE_USER',
      targetType: 'user',
      targetId: users[index].username,
      details: 'Account reactivated to regular standing.',
    });

    return users[index];
  }

  // --- Reports Queue ---
  async getReportsQueue() {
    if (IS_REAL_BACKEND) {
      return apiRequest('/admin/reports', { method: 'GET' });
    }
    return this._getReports();
  }

  async dismissReport(reportId, adminIdentifier = 'admin') {
    if (IS_REAL_BACKEND) {
      return apiRequest(`/admin/reports/${encodeURIComponent(reportId)}/dismiss`, {
        method: 'POST',
      });
    }
    const reports = this._getReports();
    const index = reports.findIndex((r) => r.id === reportId);
    if (index === -1) throw new Error('Report not found');

    reports[index].status = 'dismissed';
    reports[index].resolvedAt = new Date().toISOString();
    this._saveReports(reports);

    this.recordAuditLog({
      adminUser: adminIdentifier,
      action: 'DISMISS_REPORT',
      targetType: 'report',
      targetId: reportId,
      details: 'Report reviewed and dismissed as false positive or within guidelines.',
    });

    return reports[index];
  }

  async removeReportedContent(reportId, reason = '', adminIdentifier = 'admin') {
    if (IS_REAL_BACKEND) {
      return apiRequest(`/admin/reports/${encodeURIComponent(reportId)}/remove`, {
        method: 'POST',
        body: { reason },
      });
    }
    const reports = this._getReports();
    const repIndex = reports.findIndex((r) => r.id === reportId);
    if (repIndex === -1) throw new Error('Report not found');

    const report = reports[repIndex];
    report.status = 'actioned';
    report.actionTaken = 'CONTENT_REMOVED';
    report.resolvedAt = new Date().toISOString();
    this._saveReports(reports);

    // If report was targeting a post, mark the post deleted
    if (report.targetType === 'post') {
      const posts = this._getPosts();
      const pIndex = posts.findIndex((p) => p.id === report.targetId);
      if (pIndex !== -1) {
        posts[pIndex].status = 'deleted';
        posts[pIndex].deletedReason = reason || report.reason;
        this._savePosts(posts);
      }
    }

    this.recordAuditLog({
      adminUser: adminIdentifier,
      action: 'REMOVE_REPORTED_CONTENT',
      targetType: report.targetType,
      targetId: report.targetId,
      details: `Removed reported item under report ${reportId}. Reason: ${reason || report.reason}`,
    });

    return report;
  }

  // --- Posts Moderation ---
  async getPostsList() {
    if (IS_REAL_BACKEND) {
      return apiRequest('/admin/posts', { method: 'GET' });
    }
    return this._getPosts();
  }

  async deletePost(postId, reason = '', adminIdentifier = 'admin') {
    if (IS_REAL_BACKEND) {
      return apiRequest(`/admin/posts/${encodeURIComponent(postId)}`, {
        method: 'DELETE',
        body: { reason },
      });
    }
    const posts = this._getPosts();
    const index = posts.findIndex((p) => p.id === postId);
    if (index === -1) throw new Error('Post not found');

    const removedPost = posts[index];
    posts[index].status = 'deleted';
    posts[index].deletedReason = reason || 'Admin moderation deletion';
    posts[index].deletedAt = new Date().toISOString();
    this._savePosts(posts);

    this.recordAuditLog({
      adminUser: adminIdentifier,
      action: 'DELETE_POST',
      targetType: 'post',
      targetId: postId,
      details: `Post deleted by admin. Author: ${removedPost.authorHandle}. Reason: ${reason || 'Unspecified'}`,
    });

    return posts[index];
  }
}

export const adminService = new AdminService();
export default adminService;
