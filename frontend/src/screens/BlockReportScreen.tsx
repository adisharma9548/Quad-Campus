import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Search,
  Ban,
  AlertTriangle,
  UserX,
  Flag,
  CheckCircle2,
  Lock,
  LifeBuoy,
  Image,
} from 'lucide-react';
import { Card, Button, Avatar, Input, ShieldBanner } from '../components/ui';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';

const REPORT_TYPES = [
  { id: 'impersonation', icon: UserX, label: 'Impersonation', desc: 'Pretending to be another student, professor, or official campus entity' },
  { id: 'harassment', icon: Ban, label: 'Harassment or bullying', desc: 'Intimidation, repeated unwanted contact, or verbal abuse' },
  { id: 'privacy', icon: Lock, label: 'Privacy or tracking violation', desc: 'Attempting to de-anonymize, uncover real identity, section, or location' },
  { id: 'inappropriate', icon: Image, label: 'Inappropriate media', desc: 'Explicit media, non-consensual imagery, or hate speech' },
  { id: 'spam', icon: AlertTriangle, label: 'Commercial spam / exam cheats', desc: 'Promoting exam cheats, paid proxies, or unauthorized services' },
  { id: 'danger', icon: LifeBuoy, label: 'Self-harm or physical danger', desc: 'Immediate student safety escalation to campus wellness & security' },
];

export default function BlockReportScreen({
  onNavigate,
}: {
  onNavigate: (screen: string) => void;
}) {
  const { state, unblockAuthor, submitReport } = useApp();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState('block');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedReport, setSelectedReport] = useState('impersonation');
  const [reportTarget, setReportTarget] = useState('');
  const [reportDetails, setReportDetails] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const allBlockedUsers = state.blockedUsers || [];
  const blockedUsers = searchQuery.trim()
    ? allBlockedUsers.filter((u) =>
        u.username?.toLowerCase().includes(searchQuery.trim().toLowerCase())
      )
    : allBlockedUsers;

  const handleUnblock = async (userObj: { id: string | number; username: string }) => {
    try {
      await unblockAuthor(userObj.username || userObj.id);
      showToast(`Unblocked @${userObj.username}`, 'info');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not unblock user', 'error');
    }
  };

  const handleSubmitReport = async (e?: React.FormEvent<HTMLFormElement>) => {
    e?.preventDefault();
    const targetClean = reportTarget.trim().replace(/^@/, '') || 'unspecified_user';
    const selectedObj = REPORT_TYPES.find((r) => r.id === selectedReport);
    try {
      await submitReport({
        targetType: 'user',
        targetId: targetClean,
        reason: selectedObj?.label || 'Code of Conduct Violation',
        details: reportDetails.trim(),
      });
      setSubmitted(true);
      setTimeout(() => {
        setSubmitted(false);
        setReportTarget('');
        setReportDetails('');
        onNavigate('settings');
      }, 2200);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to submit report', 'error');
    }
  };

  const tabs = ['Block & Restrict', 'File Report'];

  return (
    <div className="w-full space-y-6">
      <div className="flex items-center justify-between pb-2 border-b border-ink/12">
        <div>
          <h2 className="text-xl font-bold text-ink font-display">
            Safety, Block & Moderation
          </h2>
          <p className="text-xs text-ink/60">
            Block peers silently, report violations, and preserve campus boundaries
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-ink/6 rounded-xl p-1 border border-ink/12">
        {tabs.map((tab, idx) => {
          const key = idx === 0 ? 'block' : 'report';
          const isActive = activeTab === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key)}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                isActive
                  ? 'bg-ink text-canvas shadow-xs'
                  : 'text-ink/60 hover:text-ink'
              }`}
            >
              {tab}
            </button>
          );
        })}
      </div>

      <div className="space-y-4">
        {activeTab === 'block' ? (
          /* ════════════ BLOCK TAB ════════════ */
          <div className="space-y-4">
            <Card className="p-4 bg-ink/6 border border-ink/12 space-y-2">
              <div className="flex items-center gap-2 text-ink font-bold text-xs">
                <Ban size={16} />
                <span>What happens when you block someone:</span>
              </div>
              <ul className="text-xs text-ink/60 space-y-1 list-disc list-inside">
                <li>They cannot view your profile or personal space posts.</li>
                <li>They cannot search for or find you in the Department Directory.</li>
                <li>They are NOT notified that you blocked them (100% silent).</li>
                <li>Any existing follow relationship is silently dissolved.</li>
              </ul>
            </Card>

            <Input
              placeholder="Search blocked students..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              icon={Search}
            />

            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <p className="text-xs font-bold uppercase tracking-wider text-ink/60">
                  Currently Blocked ({blockedUsers.length})
                </p>
                <span className="text-xs text-ink/60">Can be unblocked anytime</span>
              </div>

              {blockedUsers.length === 0 ? (
                <Card className="p-8 text-center text-ink/40">
                  <p className="text-xs font-medium">Your block list is empty.</p>
                </Card>
              ) : (
                <div className="space-y-2">
                  {blockedUsers.map((user) => (
                    <Card
                      key={user.id}
                      className="p-4 bg-canvas border border-ink/12 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar initials={user.initials} size="sm" />
                        <div>
                          <p className="text-xs font-bold text-ink">
                            @{user.username}
                          </p>
                          <p className="text-xs text-ink/60">
                            Blocked {user.blockedAt} • {user.reason}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleUnblock(user)}
                      >
                        Unblock
                      </Button>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* ════════════ REPORT TAB ════════════ */
          <div className="space-y-4">
            {submitted ? (
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-center py-12 space-y-4"
              >
                <div className="w-16 h-16 rounded-full bg-ink/8 text-ink flex items-center justify-center mx-auto">
                  <CheckCircle2 size={36} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-ink font-display">
                    Report Filed Anonymously
                  </h3>
                  <p className="text-xs text-ink/60 mt-1 max-w-sm mx-auto">
                    Campus moderation will review this within 12 hours. The reported student is never informed of your identity.
                  </p>
                </div>
              </motion.div>
            ) : (
              <form onSubmit={handleSubmitReport} className="space-y-4">
                <ShieldBanner
                  type="info"
                  icon={Lock}
                  message="Anonymous Reporting: The reported student will never know who submitted this report. All submissions are encrypted."
                />

                <Input
                  label="Target Pseudonym"
                  placeholder="@username to report"
                  value={reportTarget}
                  onChange={(e) => setReportTarget(e.target.value)}
                />

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-ink/60">
                    Reason for Report
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {REPORT_TYPES.map((type) => {
                      const Icon = type.icon;
                      const isSelected = selectedReport === type.id;
                      return (
                        <button
                          key={type.id}
                          type="button"
                          onClick={() => setSelectedReport(type.id)}
                          className={`min-h-[44px] p-4 rounded-[12px] border text-left transition-all flex items-start gap-3 cursor-pointer ${
                            isSelected
                              ? 'border-accent bg-ink/6'
                              : 'border-ink/12 bg-canvas hover:bg-ink/8'
                          }`}
                        >
                          <div className={`p-2 rounded-[8px] flex-shrink-0 mt-1 ${
                            isSelected
                              ? 'bg-ink text-canvas'
                              : 'bg-ink/8 text-ink'
                          }`}>
                            <Icon size={16} strokeWidth={2} />
                          </div>
                          <div className="flex-1">
                            <p className="text-xs font-bold text-ink">
                              {type.label}
                            </p>
                            <p className="text-xs text-ink/60 mt-1 line-clamp-2">
                              {type.desc}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-ink/60">
                    Additional Context (Optional)
                  </label>
                  <textarea
                    rows={3}
                    value={reportDetails}
                    onChange={(e) => setReportDetails(e.target.value)}
                    placeholder="Provide details about the post or interaction (EXIF location stripped automatically)..."
                    className="w-full rounded-[12px] border border-ink/12 bg-canvas p-3 text-xs text-ink placeholder:text-ink/40 focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>

                <Button
                  type="submit"
                  variant="danger"
                  size="lg"
                  fullWidth
                  icon={Flag}
                >
                  Submit Anonymous Report
                </Button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
