import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Check,
  UserCheck,
  Lock,
  Tag,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import {
  Avatar,
  Card,
  Button,
  ShieldBanner,
  EmptyState,
  Modal,
} from '../components/ui';

const GROUP_OPTIONS = [
  'Close Friends',
  'My Branch',
  'My Year',
  'Classmates',
  'Project Team',
  'Others',
];

export default function FollowRequestsScreen({
  onNavigate,
}: {
  onNavigate: (screen: string) => void;
}) {
  const { state, respondFollowRequest } = useApp();
  const { showToast } = useToast();

  const requests = state.followRequests || [];
  const [activeRequest, setActiveRequest] = useState<
    import('../types/quad').FollowRequestItem | null
  >(null);
  const [selectedGroups, setSelectedGroups] = useState<string[]>(['Close Friends']);

  const handleDecline = async (id: string | number, username: string) => {
    try {
      await respondFollowRequest(id, 'decline');
      showToast(`Declined @${username} silently (no notification sent)`, 'info');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to decline request', 'error');
    }
  };

  const handleStartAccept = (req: import('../types/quad').FollowRequestItem) => {
    setActiveRequest(req);
    setSelectedGroups(['Classmates']);
  };

  const toggleGroup = (group: string) => {
    setSelectedGroups((prev) =>
      prev.includes(group) ? prev.filter((g) => g !== group) : [...prev, group]
    );
  };

  const confirmAccept = async () => {
    if (!activeRequest) return;
    const req = activeRequest;
    const primaryGroup = selectedGroups[0] || 'Close Friends';
    try {
      await respondFollowRequest(req.id, 'accept', primaryGroup);
      showToast(`Accepted @${req.username} into: ${primaryGroup}`, 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to accept request', 'error');
    } finally {
      setActiveRequest(null);
      setSelectedGroups([]);
    }
  };

  return (
    <div className="w-full space-y-6">
      <div className="flex items-center justify-between pb-3 border-b border-ink/12 gap-3">
        <div>
          <h2 className="text-xl font-bold text-ink font-display">
            Pending Follow Requests & Alerts
          </h2>
          <p className="text-xs text-ink/60 mt-1">
            Accept students into specific visibility circles or decline silently
          </p>
        </div>

        <span className="text-xs font-semibold px-3 py-1 rounded-full bg-ink/6 text-ink border border-ink/12 shrink-0">
          {requests.length} Pending
        </span>
      </div>

      <ShieldBanner
        type="info"
        icon={Lock}
        message="Granular Privacy: Accepting someone does NOT reveal your college email, section, or real identity. Tag them into specific circles to control what they see."
      />

      {requests.length === 0 ? (
        <EmptyState
          icon={UserCheck}
          title="No Pending Requests"
          description="You're all caught up! When students request to follow your private personal space, they will appear here."
          action={
            <Button
              variant="primary"
              size="md"
              onClick={() => onNavigate('profile')}
            >
              Back to Personal Space
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {requests.map((req) => (
              <motion.div
                key={req.id}
                layout
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, x: -24 }}
                transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
              >
                <Card className="p-4 bg-canvas border border-ink/12 rounded-[16px] flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-ink/24 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar initials={req.initials || 'ST'} size="md" />
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-ink truncate">
                        @{req.username}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-ink/60 mt-1 flex-wrap">
                        <span>
                          {req.branch
                            ? `${req.branch} • ${req.year || '3rd'} Year`
                            : 'Verified campus student'}
                        </span>
                        <span>•</span>
                        <span>Requested {req.timestamp}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleDecline(req.id, req.username)}
                      ariaLabel={`Decline Silently, follow request from @${req.username}`}
                    >
                      Decline Silently
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      icon={Tag}
                      onClick={() => handleStartAccept(req)}
                      ariaLabel={`Accept & Assign Groups, for @${req.username}`}
                    >
                      Accept & Assign Groups
                    </Button>
                  </div>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* ──── Standard Foundation Modal for Group Assignment ──── */}
      <Modal
        isOpen={Boolean(activeRequest)}
        onClose={() => setActiveRequest(null)}
        title={activeRequest ? `Add @${activeRequest.username} to Circles` : ''}
        description="Choose which categories of your personal space they can view:"
        size="md"
      >
        {activeRequest && (
          <div className="space-y-4 pt-1">
            <div className="flex items-center gap-3 p-3 rounded-[8px] bg-ink/6 border border-ink/12">
              <Avatar initials={activeRequest.initials || 'ST'} size="md" />
              <div className="min-w-0">
                <p className="text-sm font-bold text-ink truncate">
                  @{activeRequest.username}
                </p>
                <p className="text-xs text-ink/60">
                  {activeRequest.branch} • {activeRequest.year} Year
                </p>
              </div>
            </div>

            {/* Group Chips Selection */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-ink/60 block">
                Select Groups (Multi-select)
              </label>
              <div className="flex flex-wrap gap-2">
                {GROUP_OPTIONS.map((group) => {
                  const isSelected = selectedGroups.includes(group);
                  return (
                    <button
                      key={group}
                      type="button"
                      onClick={() => toggleGroup(group)}
                      className={`min-h-[44px] px-4 py-2 rounded-[8px] text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer border active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                        isSelected
                          ? 'bg-ink text-canvas border-ink font-bold'
                          : 'bg-canvas text-ink/60 border-ink/12 hover:bg-ink/8 hover:text-ink'
                      }`}
                    >
                      {isSelected && <Check size={16} strokeWidth={2.5} />}
                      <span>{group}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="p-3 rounded-[8px] bg-ink/6 border border-ink/12 text-xs text-ink flex items-start gap-2 font-medium">
              <Lock size={16} className="mt-1 shrink-0 text-accent" />
              <span className="leading-relaxed">
                You can adjust group permissions or remove followers silently at any time from your Privacy Settings.
              </span>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="secondary"
                size="md"
                onClick={() => setActiveRequest(null)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={confirmAccept}
                disabled={selectedGroups.length === 0}
              >
                Confirm ({selectedGroups.length} circles)
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
