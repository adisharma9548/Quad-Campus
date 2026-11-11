import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Shield,
  Users,
  AlertTriangle,
  FileText,
  Activity,
  Search,
  Lock,
  UserX,
  Trash2,
  CheckCircle,
  RefreshCw,
  LogOut,
  Clock,
  Key,
  ShieldAlert,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { adminService } from '../../services/admin/adminService';
import { Button, TextField, Card, Modal, Avatar } from '../../components/ui';

// Admin Inactivity Timeout: 15 minutes
const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000;

type PendingAdminAction =
  | {
      type: 'BAN_USER';
      title: string;
      description: string;
      payload: { userId: string; username: string; reason?: string };
    }
  | {
      type: 'SUSPEND_USER';
      title: string;
      description: string;
      payload: { userId: string; username: string; days: number; reason?: string };
    }
  | {
      type: 'REMOVE_REPORTED_CONTENT';
      title: string;
      description: string;
      payload: { reportId: string; reason?: string };
    }
  | {
      type: 'DELETE_POST';
      title: string;
      description: string;
      payload: { postId: string; reason?: string };
    };

interface ReauthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  actionTitle?: string;
  actionDescription?: string;
}

/**
 * Re-authentication Modal
 * Prompts the administrator for their password before executing destructive actions.
 */
function ReauthModal({
  isOpen,
  onClose,
  onConfirm,
  actionTitle,
  actionDescription,
}: ReauthModalProps) {
  const { verifyPassword } = useAuth();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  const handleClose = () => {
    setPassword('');
    setError('');
    onClose();
  };

  const handleVerify = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!password) {
      setError('Please enter your administrator password.');
      return;
    }

    setIsVerifying(true);
    setError('');

    try {
      await verifyPassword(password);
      setPassword('');
      onConfirm();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Verification failed. Incorrect admin password.'
      );
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Admin Re-authentication Required"
      description="Destructive actions require confirmation of your administrator credentials."
      size="md"
    >
      <form onSubmit={handleVerify} className="space-y-4 pt-2">
        <div className="p-3 rounded-[8px] bg-danger/10 border border-danger text-danger text-xs space-y-1">
          <p className="font-bold flex items-center gap-2">
            <AlertTriangle size={14} />
            <span>High-Privilege Destructive Action: {actionTitle}</span>
          </p>
          <p className="leading-relaxed opacity-90">{actionDescription}</p>
        </div>

        <TextField
          label="Confirm Admin Password"
          id="adminReauthPassword"
          type="password"
          icon={Key}
          placeholder="Enter your admin account password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            if (error) setError('');
          }}
          error={error}
          autoFocus
          disabled={isVerifying}
        />

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={handleClose}
            disabled={isVerifying}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="destructive"
            size="md"
            loading={isVerifying}
            disabled={!password || isVerifying}
          >
            Authenticate & Execute
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/**
 * Lazy-Loaded Admin Panel
 */
export default function AdminPanel({
  onNavigate: _onNavigate,
}: {
  onNavigate?: (screen: string) => void;
}) {
  const { user, session, logOut } = useAuth();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState('dashboard');
  const [metrics, setMetrics] = useState<import('../../types/quad').AdminMetrics | null>(null);
  const [usersList, setUsersList] = useState<
    import('../../services/admin/adminService').AdminManagedUser[]
  >([]);
  const [reportsList, setReportsList] = useState<
    import('../../services/admin/adminService').MutableAdminReport[]
  >([]);
  const [postsList, setPostsList] = useState<
    import('../../services/admin/adminService').MutableAdminPost[]
  >([]);
  const [auditLogs, setAuditLogs] = useState<import('../../types/quad').AuditLogEntry[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);

  // Search & Filter States
  const [userSearch, setUserSearch] = useState('');
  const [userStatusFilter, setUserStatusFilter] = useState('all');

  // Reauth Modal State
  const [reauthOpen, setReauthOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAdminAction | null>(null);

  // Session remaining minutes calculated safely via interval
  const [sessionRemainingMinutes, setSessionRemainingMinutes] = useState(30);

  // Inactivity auto-logout tracking
  const lastActivityRef = useRef(0);

  const handleUserActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
  }, []);

  useEffect(() => {
    lastActivityRef.current = Date.now();
    const activityEvents = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];
    activityEvents.forEach((evt) =>
      window.addEventListener(evt, handleUserActivity, { passive: true })
    );

    const updateTimer = () => {
      const elapsed = Date.now() - lastActivityRef.current;
      if (elapsed > INACTIVITY_TIMEOUT_MS) {
        showToast('Admin session expired due to inactivity.', 'error');
        logOut();
      }
      if (session?.expiresAt) {
        const mins = Math.max(0, Math.floor((session.expiresAt - Date.now()) / (60 * 1000)));
        setSessionRemainingMinutes(mins);
      }
    };

    const initTimer = setTimeout(updateTimer, 0);
    const interval = setInterval(updateTimer, 15000);

    return () => {
      clearTimeout(initTimer);
      activityEvents.forEach((evt) => window.removeEventListener(evt, handleUserActivity));
      clearInterval(interval);
    };
  }, [handleUserActivity, logOut, showToast, session?.expiresAt]);

  // Load all initial data
  const refreshAllData = useCallback(async () => {
    setIsLoadingData(true);
    try {
      const [m, u, r, p, a] = await Promise.all([
        adminService.getDashboardMetrics(),
        adminService.getUsers(userSearch, userStatusFilter),
        adminService.getReportsQueue(),
        adminService.getPostsList(),
        Promise.resolve(adminService.getAuditLogs()),
      ]);
      setMetrics(m);
      setUsersList(u);
      setReportsList(r);
      setPostsList(p);
      setAuditLogs(a);
    } catch (e) {
      console.warn('Failed to fetch admin data:', e);
      showToast('Error refreshing administrative records.', 'error');
    } finally {
      setIsLoadingData(false);
    }
  }, [userSearch, userStatusFilter, showToast]);

  useEffect(() => {
    let active = true;
    const loadTimer = setTimeout(() => {
      if (active) {
        refreshAllData();
      }
    }, 0);
    return () => {
      active = false;
      clearTimeout(loadTimer);
    };
  }, [refreshAllData]);

  // Handle Action Trigger requiring reauth
  const requestPrivilegedAction = (actionSpec: PendingAdminAction) => {
    setPendingAction(actionSpec);
    setReauthOpen(true);
  };

  const executePendingAction = async () => {
    if (!pendingAction) return;
    setReauthOpen(false);

    try {
      const adminHandle = user?.username || 'quad_admin';

      if (pendingAction.type === 'BAN_USER') {
        const { payload } = pendingAction;
        await adminService.banUser(payload.userId, payload.reason || '', adminHandle);
        showToast(`User @${payload.username} has been permanently banned.`, 'success');
      } else if (pendingAction.type === 'SUSPEND_USER') {
        const { payload } = pendingAction;
        await adminService.suspendUser(payload.userId, payload.days, payload.reason || '', adminHandle);
        showToast(`User @${payload.username} suspended for ${payload.days} days.`, 'success');
      } else if (pendingAction.type === 'REMOVE_REPORTED_CONTENT') {
        const { payload } = pendingAction;
        await adminService.removeReportedContent(payload.reportId, payload.reason || '', adminHandle);
        showToast(`Reported content successfully removed from platform.`, 'success');
      } else if (pendingAction.type === 'DELETE_POST') {
        const { payload } = pendingAction;
        await adminService.deletePost(payload.postId, payload.reason || '', adminHandle);
        showToast(`Post deleted and audit log recorded.`, 'success');
      }

      await refreshAllData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Action failed to execute.', 'error');
    } finally {
      setPendingAction(null);
    }
  };

  // Safe non-destructive actions
  const handleReactivateUser = async (userId: string, username: string) => {
    try {
      await adminService.reactivateUser(userId, user?.username || 'quad_admin');
      showToast(`User @${username} reactivated to regular standing.`, 'success');
      refreshAllData();
    } catch {
      showToast('Failed to reactivate user.', 'error');
    }
  };

  const handleDismissReport = async (reportId: string) => {
    try {
      await adminService.dismissReport(reportId, user?.username || 'quad_admin');
      showToast('Report dismissed as resolved.', 'success');
      refreshAllData();
    } catch {
      showToast('Failed to dismiss report.', 'error');
    }
  };

  return (
    <div className="min-h-screen bg-canvas text-ink flex flex-col select-none">
      {/* Re-authentication Prompt Modal */}
      {reauthOpen && (
        <ReauthModal
          isOpen={reauthOpen}
          onClose={() => {
            setReauthOpen(false);
            setPendingAction(null);
          }}
          onConfirm={executePendingAction}
          actionTitle={pendingAction?.title || 'Destructive Action'}
          actionDescription={pendingAction?.description || ''}
        />
      )}

      {/* Top Admin Navigation Bar */}
      <header className="border-b border-ink/12 bg-canvas sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-[8px] bg-ink/6 border border-ink/12 flex items-center justify-center text-accent">
              <Shield size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm sm:text-base tracking-tight font-display text-ink">
                  Quad Administration Console
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded-full bg-accent/10 text-accent border border-accent/20">
                  Role: Admin
                </span>
              </div>
              <p className="text-[11px] text-ink/60">
                Audited & Encrypted Campus Moderation Gateway
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 text-xs text-ink/60 px-3 py-2 rounded-[8px] bg-ink/6 border border-ink/12">
              <Clock size={14} className="text-accent" />
              <span>Session: {sessionRemainingMinutes}m left</span>
            </div>

            <Button
              variant="secondary"
              size="sm"
              icon={RefreshCw}
              onClick={refreshAllData}
              loading={isLoadingData}
              className="min-h-[44px]"
              ariaLabel="Refresh Data"
            >
              <span className="hidden sm:inline">Refresh</span>
            </Button>

            <Button
              variant="destructive"
              size="sm"
              icon={LogOut}
              onClick={() => logOut()}
              className="min-h-[44px]"
            >
              Log out
            </Button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex gap-2 border-t border-ink/6 overflow-x-auto scrollbar-none py-1">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: Activity, count: null },
            { id: 'users', label: 'Users', icon: Users, count: metrics?.totalUsers },
            {
              id: 'reports',
              label: 'Reported Content',
              icon: AlertTriangle,
              count: metrics?.pendingReports,
              alert: (metrics?.pendingReports ?? 0) > 0,
            },
            { id: 'posts', label: 'Posts Moderation', icon: FileText, count: metrics?.activePosts },
            { id: 'audit', label: 'Audit Log', icon: ShieldAlert, count: auditLogs.length },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-[8px] whitespace-nowrap min-h-[44px] cursor-pointer ${
                  isActive
                    ? 'bg-ink text-canvas font-bold'
                    : 'text-ink/60 hover:text-ink hover:bg-ink/6'
                }`}
              >
                <Icon size={16} />
                <span>{tab.label}</span>
                {tab.count !== null && (
                  <span
                    className={`px-2 py-1 rounded-full text-[10px] font-bold ${
                      tab.alert && !isActive
                        ? 'bg-danger text-canvas'
                        : isActive
                        ? 'bg-canvas text-ink'
                        : 'bg-ink/12 text-ink/80'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 sm:p-6 space-y-6">
        {/* ══════════ TAB 1: DASHBOARD ══════════ */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-extrabold text-ink tracking-tight font-display">
                System Overview
              </h1>
              <p className="text-sm text-ink/60 mt-1">
                Real-time metrics, active moderation queues, and security status.
              </p>
            </div>

            {/* Metric Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card variant="outline" className="p-4 space-y-2">
                <div className="flex items-center justify-between text-ink/60">
                  <span className="text-xs font-semibold uppercase tracking-wider">Total Registered</span>
                  <Users size={18} className="text-accent" />
                </div>
                <div className="text-3xl font-extrabold text-ink font-display">
                  {metrics?.totalUsers ?? '-'}
                </div>
                <div className="text-xs text-ink/60">
                  {metrics?.activeUsers ?? 0} active • {metrics?.suspendedUsers ?? 0} suspended
                </div>
              </Card>

              <Card variant="outline" className="p-4 space-y-2">
                <div className="flex items-center justify-between text-ink/60">
                  <span className="text-xs font-semibold uppercase tracking-wider">Pending Reports</span>
                  <AlertTriangle
                    size={18}
                    className={(metrics?.pendingReports ?? 0) > 0 ? 'text-danger' : 'text-accent'}
                  />
                </div>
                <div
                  className={`text-3xl font-extrabold font-display ${
                    (metrics?.pendingReports ?? 0) > 0 ? 'text-danger' : 'text-ink'
                  }`}
                >
                  {metrics?.pendingReports ?? '-'}
                </div>
                <div className="text-xs text-ink/60">Requires moderator action</div>
              </Card>

              <Card variant="outline" className="p-4 space-y-2">
                <div className="flex items-center justify-between text-ink/60">
                  <span className="text-xs font-semibold uppercase tracking-wider">Platform Posts</span>
                  <FileText size={18} className="text-accent" />
                </div>
                <div className="text-3xl font-extrabold text-ink font-display">
                  {metrics?.activePosts ?? '-'}
                </div>
                <div className="text-xs text-ink/60">Peer posts monitored</div>
              </Card>

              <Card variant="outline" className="p-4 space-y-2">
                <div className="flex items-center justify-between text-ink/60">
                  <span className="text-xs font-semibold uppercase tracking-wider">Active Bans</span>
                  <UserX size={18} className="text-danger" />
                </div>
                <div className="text-3xl font-extrabold text-danger font-display">
                  {metrics?.bannedUsers ?? 0}
                </div>
                <div className="text-xs text-ink/60">Enforced by admin policy</div>
              </Card>
            </div>

            {/* Security Guardrail Callout */}
            <Card variant="outline" className="p-6 space-y-3 border-accent/30 bg-accent/5">
              <div className="flex items-start gap-3">
                <Lock size={20} className="text-accent flex-shrink-0 mt-1" />
                <div className="space-y-1 text-xs text-ink/80 leading-relaxed">
                  <p className="font-bold text-ink text-sm">
                    Admin Security Architecture & Guardrails Active
                  </p>
                  <p>
                    • <strong>Stealth URL:</strong> Unauthenticated visits to <code>/admin</code> return standard 404 Not Found without redirect.
                  </p>
                  <p>
                    • <strong>Code-Splitting:</strong> Admin UI bundle is lazy-loaded and never sent to regular students.
                  </p>
                  <p>
                    • <strong>Re-authentication:</strong> Destructive actions require password re-verification before execution.
                  </p>
                  <p>
                    • <strong>Rate Limiter & Lockout:</strong> Accounts lock out for 15 minutes after 5 consecutive failed logins.
                  </p>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* ══════════ TAB 2: USERS MANAGEMENT ══════════ */}
        {activeTab === 'users' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-extrabold text-ink tracking-tight font-display">
                  Student Registry & Moderation
                </h1>
                <p className="text-sm text-ink/60 mt-1">
                  Inspect student accounts, verified academic identity, and manage account standing.
                </p>
              </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <TextField
                  placeholder="Search by username, email, full name or branch..."
                  icon={Search}
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                />
              </div>

              <div className="flex gap-2">
                {['all', 'active', 'suspended', 'banned'].map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setUserStatusFilter(st)}
                    className={`px-3 py-2 text-xs font-semibold rounded-[8px] min-h-[44px] capitalize cursor-pointer border ${
                      userStatusFilter === st
                        ? 'bg-ink text-canvas border-ink'
                        : 'bg-canvas text-ink/60 border-ink/12 hover:text-ink hover:bg-ink/6'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            {/* Users Table */}
            <Card variant="outline" className="overflow-hidden p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-ink/6 border-b border-ink/12 text-ink/60 font-semibold uppercase tracking-wider">
                    <tr>
                      <th className="p-4">Student</th>
                      <th className="p-4">College Email</th>
                      <th className="p-4">Department & Year</th>
                      <th className="p-4">Section (Vault)</th>
                      <th className="p-4">Status</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink/12">
                    {usersList.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-ink/60">
                          No student accounts match this query.
                        </td>
                      </tr>
                    ) : (
                      usersList.map((st) => {
                        const status = st.status || 'active';
                        return (
                          <tr key={st.id} className="hover:bg-ink/4 transition-colors">
                            <td className="p-4">
                              <div className="flex items-center gap-3">
                                <Avatar
                                  initials={st.avatarInitials || st.username?.substring(0, 2).toUpperCase()}
                                  size="sm"
                                />
                                <div>
                                  <div className="font-bold text-ink">@{st.username}</div>
                                  <div className="text-[11px] text-ink/60">{st.fullName || 'Private'}</div>
                                </div>
                              </div>
                            </td>
                            <td className="p-4 text-ink/80 font-mono text-[11px]">
                              {st.email}
                            </td>
                            <td className="p-4 text-ink/80">
                              <div className="font-medium">{st.department || st.branch}</div>
                              <div className="text-[11px] text-ink/60">{st.year}</div>
                            </td>
                            <td className="p-4 text-ink/80 font-semibold">
                              Section {st.section || 'A'}
                            </td>
                            <td className="p-4">
                              <span
                                className={`inline-flex items-center px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                                  status === 'banned'
                                    ? 'bg-danger text-canvas font-black'
                                    : status === 'suspended'
                                    ? 'bg-danger/10 text-danger border border-danger/30'
                                    : 'bg-ink/6 text-ink border border-ink/12'
                                }`}
                              >
                                {status}
                              </span>
                            </td>
                            <td className="p-4 text-right space-x-1">
                              {status === 'active' ? (
                                <>
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() =>
                                      requestPrivilegedAction({
                                        type: 'SUSPEND_USER',
                                        title: `Suspend @${st.username}`,
                                        description: `Suspend student account for 7 days. They will be temporarily logged out.`,
                                        payload: {
                                          userId: st.id,
                                          username: st.username,
                                          days: 7,
                                          reason: 'Temporary violation of campus code of conduct',
                                        },
                                      })
                                    }
                                  >
                                    Suspend
                                  </Button>
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() =>
                                      requestPrivilegedAction({
                                        type: 'BAN_USER',
                                        title: `Permanent Ban for @${st.username}`,
                                        description: `Permanently ban student account. Access will be revoked immediately.`,
                                        payload: {
                                          userId: st.id,
                                          username: st.username,
                                          reason: 'Severe campus security policy violation',
                                        },
                                      })
                                    }
                                  >
                                    Ban
                                  </Button>
                                </>
                              ) : (
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => handleReactivateUser(st.id, st.username)}
                                >
                                  Reactivate
                                </Button>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {/* ══════════ TAB 3: REPORTED CONTENT QUEUE ══════════ */}
        {activeTab === 'reports' && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-extrabold text-ink tracking-tight font-display">
                Reported Content Queue
              </h1>
              <p className="text-sm text-ink/60 mt-1">
                Student flagged items requiring immediate review.
              </p>
            </div>

            <div className="space-y-4">
              {reportsList.length === 0 ? (
                <Card variant="outline" className="p-8 text-center text-ink/60">
                  <CheckCircle size={32} className="mx-auto mb-2 text-accent" />
                  <p className="font-bold text-ink">Queue Clean</p>
                  <p className="text-xs">No pending student reports in the system.</p>
                </Card>
              ) : (
                reportsList.map((rep) => {
                  const isPending = rep.status === 'pending';
                  return (
                    <Card
                      key={rep.id}
                      variant="outline"
                      className={`p-4 space-y-3 ${
                        isPending ? 'border-danger/40 bg-danger/5' : 'opacity-60'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-ink/12 pb-3">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                              isPending
                                ? 'bg-danger text-canvas font-black'
                                : 'bg-ink/10 text-ink/60'
                            }`}
                          >
                            {rep.status}
                          </span>
                          <span className="font-bold text-ink text-sm">
                            Flagged {rep.targetType.toUpperCase()} ({rep.targetId})
                          </span>
                        </div>
                        <span className="text-[11px] text-ink/60">
                          Reported by @{rep.reporterHandle} • {new Date(rep.createdAt).toLocaleString()}
                        </span>
                      </div>

                      <div className="space-y-2 text-xs">
                        <div>
                          <span className="font-bold text-ink">Violation Reason: </span>
                          <span className="text-danger font-semibold">{rep.reason}</span>
                        </div>
                        {rep.details && (
                          <div className="text-ink/80">
                            <span className="font-semibold text-ink">Details: </span>
                            {rep.details}
                          </div>
                        )}
                        {rep.contentSnippet && (
                          <div className="p-3 rounded-[8px] bg-canvas border border-ink/12 italic text-ink/90 font-mono text-xs">
                            "{rep.contentSnippet}"
                          </div>
                        )}
                      </div>

                      {isPending && (
                        <div className="flex items-center justify-end gap-2 pt-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleDismissReport(rep.id)}
                          >
                            Dismiss Report
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() =>
                              requestPrivilegedAction({
                                type: 'REMOVE_REPORTED_CONTENT',
                                title: `Remove Content (${rep.targetId})`,
                                description: `Permanently delete this reported item from the campus feed.`,
                                payload: {
                                  reportId: rep.id,
                                  reason: rep.reason,
                                },
                              })
                            }
                          >
                            Remove Content
                          </Button>
                        </div>
                      )}
                    </Card>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* ══════════ TAB 4: POSTS MODERATION ══════════ */}
        {activeTab === 'posts' && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-extrabold text-ink tracking-tight font-display">
                Posts Moderation
              </h1>
              <p className="text-sm text-ink/60 mt-1">
                Monitor community posts across departments and remove violating content.
              </p>
            </div>

            <div className="space-y-4">
              {postsList.map((post) => {
                const isDeleted = post.status === 'deleted';
                return (
                  <Card
                    key={post.id}
                    variant="outline"
                    className={`p-4 space-y-3 ${isDeleted ? 'opacity-40' : ''}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-ink text-sm">@{post.authorHandle}</span>
                        <span className="text-xs text-ink/60">• {post.department}</span>
                      </div>
                      <span
                        className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                          isDeleted
                            ? 'bg-danger text-canvas font-black'
                            : post.status === 'flagged'
                            ? 'bg-danger/20 text-danger border border-danger/40'
                            : 'bg-ink/6 text-ink border border-ink/12'
                        }`}
                      >
                        {post.status}
                      </span>
                    </div>

                    <p className="text-sm text-ink leading-relaxed">
                      {post.content}
                    </p>

                    <div className="flex items-center justify-between text-xs text-ink/60 pt-2 border-t border-ink/12">
                      <span>
                        Posted: {new Date(post.createdAt).toLocaleDateString()} • {post.likes} likes • {post.reportsCount} reports
                      </span>
                      {!isDeleted && (
                        <Button
                          variant="destructive"
                          size="sm"
                          icon={Trash2}
                          onClick={() =>
                            requestPrivilegedAction({
                              type: 'DELETE_POST',
                              title: `Delete Post (${post.id})`,
                              description: `Permanently delete post by @${post.authorHandle}.`,
                              payload: {
                                postId: post.id,
                                reason: 'Administrative moderation removal',
                              },
                            })
                          }
                        >
                          Delete Post
                        </Button>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* ══════════ TAB 5: AUDIT LOG ══════════ */}
        {activeTab === 'audit' && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-extrabold text-ink tracking-tight font-display">
                Cryptographic Administrative Audit Log
              </h1>
              <p className="text-sm text-ink/60 mt-1">
                Chronological immutable record of every moderation and security action executed.
              </p>
            </div>

            <Card variant="outline" className="overflow-hidden p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-ink/6 border-b border-ink/12 text-ink/60 font-semibold uppercase tracking-wider">
                    <tr>
                      <th className="p-4">Timestamp</th>
                      <th className="p-4">Admin Account</th>
                      <th className="p-4">Action Executed</th>
                      <th className="p-4">Target</th>
                      <th className="p-4">Audit Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink/12 font-mono">
                    {auditLogs.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-ink/60 font-sans">
                          No audit log entries recorded.
                        </td>
                      </tr>
                    ) : (
                      auditLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-ink/4">
                          <td className="p-4 text-ink/60 whitespace-nowrap text-[11px]">
                            {new Date(log.timestamp).toLocaleString()}
                          </td>
                          <td className="p-4 text-accent font-bold">
                            @{log.adminUser}
                          </td>
                          <td className="p-4">
                            <span className="px-2 py-1 rounded bg-ink/10 text-ink font-bold text-[10px]">
                              {log.action}
                            </span>
                          </td>
                          <td className="p-4 text-ink/80">
                            {log.targetType}:{log.targetId}
                          </td>
                          <td className="p-4 text-ink/70 font-sans text-xs">
                            {log.details}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
