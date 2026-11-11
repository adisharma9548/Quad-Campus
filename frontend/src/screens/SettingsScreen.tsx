import React, { useState } from 'react';
import {
  Ban,
  EyeOff,
  VolumeX,
  ShieldCheck,
  ShieldAlert,
  Flag,
  Moon,
  Sun,
  MapPinOff,
  MessageSquareOff,
  Lock,
  Eye,
  Sliders,
  Smartphone,
  BookOpen,
  FileText,
  LogOut,
  AlertTriangle,
  Download,
  Trash2,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  Card,
  Toggle,
  ShieldBanner,
  MenuItem,
  Button,
  Modal,
} from '../components/ui';
import { QuadLogo } from '../components/QuadLogo';

export default function SettingsScreen({
  onNavigate,
}: {
  onNavigate: (screen: string) => void;
}) {
  const { dark, toggle } = useTheme();
  const {
    state,
    toggleProfileVisibility,
    toggleDiscoverability,
    updatePrivacySetting,
  } = useApp();
  const { user, logOut, exportMyData, deleteAccount } = useAuth();
  const { showToast } = useToast();

  /* ─── Plain-language privacy state (derived from verified user/AppContext) ─── */
  const privateProfile = !state.profilePublic;
  const showInDiscovery = Boolean(state.discoverableByBranch);
  const readReceipts = Boolean(state.readReceipts);
  const activeStatus = Boolean(state.activeStatus);
  const [typingIndicator, setTypingIndicator] = useState(false);
  const [stripExif, setStripExif] = useState(true);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showReportConfirm, setShowReportConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const isDev = import.meta.env.DEV;
  const blockedCount = (state.blockedUsers || []).length;

  const handlePrivateToggle = async () => {
    const nextPrivate = !privateProfile;
    await toggleProfileVisibility(!nextPrivate);
    showToast(nextPrivate ? 'Switched to Private Vault mode' : 'Switched to Public Profile mode', 'info');
  };

  const handleDiscoveryToggle = async () => {
    const next = !showInDiscovery;
    await toggleDiscoverability(next);
    showToast(next ? 'Enabled directory discovery for your branch' : 'Hidden from campus directory search', 'info');
  };

  const handleDownloadData = async () => {
    setIsExporting(true);
    try {
      const payload = await exportMyData();
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `quad-data-${user?.username || 'account'}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showToast('Account data archive downloaded cleanly (JSON)', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to export account data right now', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  const executeDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      await deleteAccount();
      setShowDeleteConfirm(false);
      showToast('Your account and posts have been scheduled for deletion.', 'info');
      onNavigate('welcome');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to delete account right now', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const executeLogout = async () => {
    setShowLogoutConfirm(false);
    await logOut();
    onNavigate('welcome');
  };

  return (
    <div className="w-full max-w-2xl mx-auto py-6 px-4 space-y-6">
      <div className="flex items-center justify-between pb-3 border-b border-ink/12 gap-3">
        <div>
          <h2 className="text-xl font-bold text-ink font-display">
            Privacy & Account Settings
          </h2>
          <p className="text-xs text-ink/60 mt-1">
            Zero tracking by default • You own your campus visibility
          </p>
        </div>

        <button
          type="button"
          onClick={toggle}
          aria-label={dark ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
          className="min-h-[44px] min-w-[44px] p-2 rounded-[8px] bg-canvas border border-ink/12 text-ink hover:bg-ink/8 active:bg-ink/12 cursor-pointer transition-colors flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {dark ? <Sun size={20} /> : <Moon size={20} />}
        </button>
      </div>

      {/* Safe notice banner */}
      <ShieldBanner
        type="info"
        icon={Lock}
        message="Privacy by Default: Unlike conventional social networks, your personal space, active status, and location metadata are permanently secured until you explicitly change them."
      />

      {/* ─── 1. PROFILE & DISCOVERY PRIVACY ─── */}
      <div className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-wider text-ink/60 px-1">
          Profile & Visibility Control
        </p>
        <Card className="divide-y divide-ink/12 p-3 sm:p-4 bg-canvas border border-ink/12 rounded-[12px]">
          <Toggle
            active={privateProfile}
            onToggle={handlePrivateToggle}
            label="Only people I approve can see my posts"
            description="Personal Space is locked. Peers must send a request and be tagged into a group."
            icon={Lock}
          />
          <Toggle
            active={showInDiscovery}
            onToggle={handleDiscoveryToggle}
            label="Let others in my branch find me"
            description="Allow classmates in your branch to search for your pseudonym in Directory."
            icon={Eye}
          />
        </Card>
      </div>

      {/* ─── 2. ZERO-TRACKING & ACTIVITY CONTROLS ─── */}
      <div className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-wider text-ink/60 px-1">
          Presence & Activity Signals (Disabled by Default)
        </p>
        <Card className="divide-y divide-ink/12 p-3 sm:p-4 bg-canvas border border-ink/12 rounded-[12px]">
          <Toggle
            active={readReceipts}
            onToggle={() => {
              const next = !readReceipts;
              updatePrivacySetting({ readReceipts: next });
              showToast(next ? 'Read receipts enabled' : 'Read receipts disabled', 'info');
            }}
            label="Read receipts"
            description="Prevent classmates from knowing when you have opened their messages or posts."
            icon={MessageSquareOff}
          />
          <Toggle
            active={activeStatus}
            onToggle={() => {
              const next = !activeStatus;
              updatePrivacySetting({ activeStatus: next });
              showToast(next ? 'Online presence visible' : 'Online presence hidden', 'info');
            }}
            label="Show 'Active Now' online indicator"
            description="Keep your online presence completely invisible while browsing campus updates."
            icon={Smartphone}
          />
          <Toggle
            active={typingIndicator}
            onToggle={() => {
              setTypingIndicator(!typingIndicator);
              showToast(!typingIndicator ? 'Typing indicator enabled' : 'Typing indicator disabled', 'info');
            }}
            label="Live typing indicators"
            description="Do not reveal when you are actively composing replies or comments."
            icon={Sliders}
          />
        </Card>
      </div>

      {/* ─── 3. PHOTO & HARDWARE PRIVACY ─── */}
      <div className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-wider text-ink/60 px-1">
          Location & Hardware Metadata Scrubbing
        </p>
        <Card className="divide-y divide-ink/12 p-3 sm:p-4 bg-canvas border border-ink/12 rounded-[12px]">
          <Toggle
            active={stripExif}
            onToggle={() => {
              setStripExif(!stripExif);
              showToast(!stripExif ? 'Automatic EXIF metadata scrubbing enabled' : 'Warning: EXIF scrubbing disabled', 'info');
            }}
            label="Auto-strip EXIF & GPS from photo uploads"
            description="Erases camera serial numbers, GPS coordinates, and timestamps before upload."
            icon={MapPinOff}
          />
        </Card>
      </div>

      {/* ─── 4. BLOCKING, MUTING & HIDING ─── */}
      <div className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-wider text-ink/60 px-1">
          Block, Mute & Boundaries
        </p>
        <Card className="divide-y divide-ink/12 p-3 sm:p-4 bg-canvas border border-ink/12 rounded-[12px]">
          <MenuItem
            icon={Ban}
            label="Blocked accounts"
            description="Manage students blocked from seeing or finding your profile"
            badge={blockedCount > 0 ? `${blockedCount} blocked` : undefined}
            onClick={() => onNavigate('blockreport')}
          />
          <MenuItem
            icon={EyeOff}
            label="Hide my profile from specific people"
            description="Prevent specific pseudonyms from viewing you in directory"
            onClick={() => onNavigate('blockreport')}
          />
          <MenuItem
            icon={VolumeX}
            label="Muted accounts"
            description="Silently suppress posts and comments without blocking"
            onClick={() => onNavigate('blockreport')}
          />
        </Card>
      </div>

      {/* ─── 5. PRIVACY AND SAFETY: SAFETY AND REPORTING ─── */}
      <div className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-wider text-ink/60 px-1">
          Privacy and Safety
        </p>

        {/* Safety and reporting card: canvas card, ink border, secondary-style "Report a concern" button with danger text */}
        <Card className="p-4 bg-canvas border border-ink/12 rounded-[12px] space-y-3">
          <div className="flex items-center gap-2 text-ink font-semibold text-sm">
            <ShieldAlert size={20} className="text-ink shrink-0" />
            <h3>Safety and reporting</h3>
          </div>
          <p className="text-xs text-ink/60 leading-relaxed">
            Experiencing stalking, harassment, or impersonation? Submit a confidential anonymous report or contact campus wellness and safety support.
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="button"
              onClick={() => setShowReportConfirm(true)}
              className="min-h-[44px] px-4 py-2 rounded-[8px] bg-ink/8 hover:bg-ink/12 text-danger text-xs font-semibold inline-flex items-center gap-2 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <Flag size={16} />
              <span>Report a concern</span>
            </button>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => onNavigate('terms')}
            >
              Policies
            </Button>
          </div>
        </Card>

        <Card className="divide-y divide-ink/12 p-3 sm:p-4 bg-canvas border border-ink/12 rounded-[12px]">
          <MenuItem
            icon={ShieldCheck}
            label="Campus Safety Center"
            description="Plain-language privacy explanations and emergency contact"
            onClick={() => onNavigate('safety')}
          />
          <MenuItem
            icon={Flag}
            label="Block & Moderation"
            description="Manage blocked users, muted accounts & moderation queue"
            onClick={() => onNavigate('blockreport')}
          />
          <MenuItem
            icon={FileText}
            label="Terms & Policies"
            description="Official community rules, data collection disclosures, penalties & appeals"
            onClick={() => onNavigate('terms')}
          />
          {isDev && (
            <MenuItem
              icon={BookOpen}
              label="Design System Spec"
              description="Inspect colors, components, typography & design tokens"
              onClick={() => onNavigate('designsystem')}
            />
          )}
        </Card>
      </div>

      {/* ─── 6. PERMANENT ACADEMIC IDENTITY & VERIFICATION (LOCKED) ─── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <p className="text-xs font-bold uppercase tracking-wider text-ink/60">
            Verified College Network
          </p>
          <span className="inline-flex items-center gap-2 text-xs font-semibold text-ink bg-ink/6 px-3 py-1 rounded-full border border-ink/12">
            <Lock size={14} />
            <span>Locked to Email</span>
          </span>
        </div>

        <Card className="p-4 sm:p-6 bg-canvas border border-ink/12 rounded-[12px] space-y-4">
          <div className="flex items-start justify-between text-xs pb-3 border-b border-ink/12 gap-3">
            <div className="min-w-0">
              <span className="text-ink/60 block text-xs">College Email</span>
              <span className="font-sans font-semibold text-ink truncate block">
                {user?.email || 'aarav.patel@btech.college.edu.in'}
              </span>
            </div>
            <span className="text-xs font-semibold text-ink bg-ink/6 px-3 py-1 rounded-full border border-ink/12 shrink-0">
              Verified College Network
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between gap-3">
              <span className="text-ink/60 shrink-0">Department:</span>
              <span
                className="font-semibold text-ink text-right truncate max-w-[280px]"
                title={user?.department || 'Computer Science & Engineering - Computer Science'}
              >
                {user?.department || 'Computer Science & Engineering - Computer Science'}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-ink/60 shrink-0">Academic Year:</span>
              <span className="font-semibold text-ink">{user?.year || '3rd Year'}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-ink/60 shrink-0">Class Section:</span>
              <span className="font-semibold text-ink">
                Section {user?.section || 'A'}{' '}
                <span className="text-xs font-normal text-ink/60">(Private vault only)</span>
              </span>
            </div>
          </div>

          <div className="pt-3 border-t border-ink/12 text-xs text-ink/60 flex items-start gap-2 leading-relaxed">
            <Lock size={16} className="text-accent shrink-0 mt-1" />
            <span>
              Your department, year, and section cannot be changed as they are cryptographically linked to your verified college email.
            </span>
          </div>
        </Card>
      </div>

      {/* ─── 7. ACCOUNT SESSION & DATA OWNERSHIP ─── */}
      <div className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-wider text-ink/60 px-1">
          Account Session & Data Rights
        </p>
        <Card className="p-4 sm:p-6 bg-canvas border border-ink/12 rounded-[12px] space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-bold text-ink truncate">
                Signed in as @{user?.username || state.username || 'quantum_dev'}
              </p>
              <p className="text-xs text-ink/60 mt-1">
                Active authenticated session stored securely on this device.
              </p>
            </div>
            <Button
              variant="destructive"
              size="sm"
              icon={LogOut}
              onClick={() => setShowLogoutConfirm(true)}
            >
              Log out
            </Button>
          </div>

          <div className="pt-4 border-t border-ink/12 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <Button
              variant="secondary"
              size="sm"
              icon={Download}
              disabled={isExporting}
              onClick={handleDownloadData}
            >
              {isExporting ? 'Preparing archive...' : 'Download My Data (JSON)'}
            </Button>

            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="min-h-[44px] px-4 py-2 rounded-[8px] bg-ink/6 hover:bg-ink/12 text-danger text-xs font-semibold inline-flex items-center justify-center gap-2 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <Trash2 size={16} />
              <span>Delete Account Permanently</span>
            </button>
          </div>
        </Card>
      </div>

      {/* App Version Info */}
      <div className="text-center pt-4 text-xs text-ink/60 space-y-1">
        <div className="flex justify-center mb-2">
          <QuadLogo size={28} />
        </div>
        <p className="font-semibold text-ink">
          Quad Platform (B.Tech Campus Edition)
        </p>
        <p className="text-xs text-ink/60">
          Privacy-first social architecture for engineering universities
        </p>
      </div>

      {/* Confirmation Modal for Confidential Reporting (Solid Danger Fill ONLY on final confirm) */}
      <Modal
        isOpen={showReportConfirm}
        onClose={() => setShowReportConfirm(false)}
        title="Open Confidential Report?"
        description="Submit an anonymous safety, stalking, or impersonation report."
        size="md"
      >
        <div className="space-y-4 pt-1">
          <p className="text-xs text-ink/60 leading-relaxed">
            Your report is private and no notification is sent to the reported student. Continue to the moderation & reporting queue?
          </p>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              variant="secondary"
              size="md"
              onClick={() => setShowReportConfirm(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="md"
              icon={Flag}
              onClick={() => {
                setShowReportConfirm(false);
                onNavigate('blockreport');
              }}
            >
              Report
            </Button>
          </div>
        </div>
      </Modal>

      {/* Confirmation Modal for Destructive Log Out */}
      <Modal
        isOpen={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        title="Log Out of Quad?"
        description="Are you sure you want to end your current authenticated session?"
        size="md"
      >
        <div className="space-y-4 pt-1">
          <div className="p-4 rounded-[12px] bg-ink/6 border border-ink/12 text-ink text-xs flex items-start gap-3">
            <AlertTriangle size={20} className="text-danger shrink-0 mt-1" />
            <span className="leading-relaxed font-semibold">
              You will need your campus handle or college email and password to log back into your verified account.
            </span>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              variant="secondary"
              size="md"
              onClick={() => setShowLogoutConfirm(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="md"
              icon={LogOut}
              onClick={executeLogout}
            >
              Yes, Log Out
            </Button>
          </div>
        </div>
      </Modal>

      {/* Confirmation Modal for Permanent Account Deletion */}
      <Modal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title="Delete Account Permanently?"
        description="This deletes your pseudonym profile and authored posts within 30 days."
        size="md"
      >
        <div className="space-y-4 pt-1">
          <div className="p-4 rounded-[12px] bg-danger/10 border border-danger text-danger text-xs flex items-start gap-3">
            <AlertTriangle size={20} className="shrink-0 mt-1" />
            <span className="leading-relaxed font-semibold">
              Your campus sessions will end immediately and your Personal Space, follows, and posts will be removed. Download your JSON archive first if needed.
            </span>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              variant="secondary"
              size="md"
              onClick={() => setShowDeleteConfirm(false)}
            >
              Keep Account
            </Button>
            <Button
              variant="destructive"
              size="md"
              icon={Trash2}
              disabled={isDeleting}
              onClick={executeDeleteAccount}
            >
              {isDeleting ? 'Deleting...' : 'Yes, Delete Account'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
