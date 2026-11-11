import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldAlert,
  Lock,
  Eye,
  MapPinOff,
  Smartphone,
  UserX,
  Flag,
  ChevronDown,
  ChevronRight,
  UserMinus,
  PhoneCall,
  FileText,
  VolumeX,
} from 'lucide-react';
import { Card, Button, Modal } from '../components/ui';
import { QuadLogo } from '../components/QuadLogo';

const FAQ_ITEMS = [
  {
    id: 1,
    icon: Lock,
    question: 'How is my real student identity protected?',
    answer:
      'Your real name, college edu email, roll number, section, and personal contacts are permanently isolated in an encrypted vault. On Quad, you interact exclusively using your chosen pseudonym and initials. Even post authors cannot see who liked or viewed their content outside of follower circles.',
  },
  {
    id: 2,
    icon: Eye,
    question: 'Why is Discovery turned OFF by default?',
    answer:
      'Most social apps expose you to search indexing by default. Quad turns Discovery OFF so nobody can search for or browse your account. You only appear in the Department Directory when you intentionally flip the opt-in switch.',
  },
  {
    id: 3,
    icon: UserMinus,
    question: 'What is a "Silent Follower Removal"?',
    answer:
      'If you no longer want someone to view your personal space, you can remove them silently at any time. Quad sends zero notifications or alerts to the removed user; your personal space simply appears private to them again.',
  },
  {
    id: 4,
    icon: MapPinOff,
    question: 'How do you prevent location tracking and stalking?',
    answer:
      'Quad never accesses your device GPS or live location. When you attach a photo to a post, our client automatically strips EXIF metadata, GPS latitude/longitude, and camera serial numbers before transmission.',
  },
  {
    id: 5,
    icon: Smartphone,
    question: 'Can peers see when I am "Active Now" or online?',
    answer:
      'No. "Active Now" indicators, last-seen timestamps, and message read receipts are turned off by default. You can browse campus posts at any hour in total peace.',
  },
  {
    id: 6,
    icon: UserX,
    question: 'What happens when I block another student?',
    answer:
      'Blocking is completely silent. The blocked student cannot view your profile, cannot see your posts in any feed, cannot request to follow you, and cannot message you. No notification is ever sent to them.',
  },
  {
    id: 7,
    icon: Flag,
    question: 'How do I report impersonation or harassment?',
    answer:
      'Tap the three dots on any post or profile to report immediately. Reports are anonymous and routed to campus safety staff. Impersonation of students, professors, or clubs is strictly prohibited and results in immediate edu-token revocation.',
  },
];

export default function SafetyCenterScreen({
  onNavigate,
}: {
  onNavigate: (screen: string) => void;
}) {
  const [expandedId, setExpandedId] = useState<number | null>(1);
  const [showReportConfirm, setShowReportConfirm] = useState(false);

  const toggleExpand = (id: number) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="w-full max-w-3xl mx-auto py-6 px-4 space-y-6">
      <div className="flex items-center justify-between pb-2 border-b border-ink/12">
        <div>
          <h2 className="text-xl font-bold text-ink font-display">
            Campus Safety Center
          </h2>
          <p className="text-xs text-ink/60">
            Plain-language explanations of your privacy protections & safety rules
          </p>
        </div>
      </div>

      {/* Hero Card */}
      <Card className="p-6 bg-canvas border border-ink/12 space-y-4">
        <div className="flex items-center gap-4">
          <QuadLogo size={48} />
          <div>
            <h2 className="text-lg font-bold text-ink font-display">
              Quad Campus Safety Promise
            </h2>
            <p className="text-xs text-ink/60">
              Engineered specifically to eliminate campus stalking and unwanted tracking.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 text-xs font-semibold text-ink">
          <div className="p-3 rounded-[8px] bg-ink/6 border border-ink/12 flex items-center gap-2">
            <Lock size={16} className="text-ink shrink-0" />
            <span>100% Private Vault</span>
          </div>
          <div className="p-3 rounded-[8px] bg-ink/6 border border-ink/12 flex items-center gap-2">
            <MapPinOff size={16} className="text-ink shrink-0" />
            <span>Zero GPS Metadata</span>
          </div>
          <div className="p-3 rounded-[8px] bg-ink/6 border border-ink/12 flex items-center gap-2">
            <VolumeX size={16} className="text-ink shrink-0" />
            <span>Silent Moderation</span>
          </div>
        </div>
      </Card>

      {/* Terms Quick Link Card */}
      <Card
        onClick={() => onNavigate?.('terms')}
        className="p-4 bg-canvas border border-ink/12 hover:border-ink/24 transition-all cursor-pointer"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-[8px] bg-ink/6 text-ink flex items-center justify-center border border-ink/12 shrink-0">
              <FileText size={20} strokeWidth={2} />
            </div>
            <div>
              <p className="text-sm font-bold text-ink">
                Read Terms & Conditions and Privacy Policy
              </p>
              <p className="text-xs text-ink/60">
                Official rules, data disclosures, moderation penalties & appeals
              </p>
            </div>
          </div>
          <ChevronRight size={20} className="text-ink/60 shrink-0" />
        </div>
      </Card>

      {/* Plain Language FAQ Accordion */}
      <div className="space-y-3">
        <p className="text-xs font-bold uppercase tracking-wider text-ink/60 px-1">
          Privacy Architecture & Frequently Asked Questions
        </p>

        <div className="space-y-3">
          {FAQ_ITEMS.map((item) => {
            const Icon = item.icon;
            const isExpanded = expandedId === item.id;
            return (
              <Card
                key={item.id}
                className="p-4 bg-canvas border border-ink/12 transition-all cursor-pointer"
                onClick={() => toggleExpand(item.id)}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-[8px] bg-ink/6 text-ink flex items-center justify-center flex-shrink-0">
                      <Icon size={16} strokeWidth={2} />
                    </div>
                    <p className="text-sm font-bold text-ink">
                      {item.question}
                    </p>
                  </div>
                  <ChevronDown
                    size={16}
                    className={`text-ink/60 transition-transform duration-250 flex-shrink-0 ${
                      isExpanded ? 'rotate-180' : ''
                    }`}
                  />
                </div>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <p className="text-xs text-ink/60 leading-relaxed pt-3 mt-2 border-t border-ink/12">
                        {item.answer}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Safety and Reporting Section (Canvas card, Ink border & text, secondary danger-text button) */}
      <Card className="p-4 sm:p-6 bg-canvas border border-ink/12 rounded-[12px] space-y-3">
        <div className="flex items-center gap-2 text-ink font-semibold text-sm">
          <ShieldAlert size={20} className="text-ink shrink-0" />
          <h3>Safety and reporting</h3>
        </div>
        <p className="text-xs text-ink/60 leading-relaxed">
          Experiencing stalking, harassment, or impersonation? Submit a confidential anonymous report or contact campus security and student wellness directly at 1800-CAMPUS-SAFE.
        </p>
        <div className="pt-1 flex flex-wrap items-center gap-3">
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
            icon={PhoneCall}
            onClick={() => alert('Campus Security Emergency: 1800-CAMPUS-SAFE')}
          >
            Campus Helpline
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => onNavigate?.('terms')}
          >
            Policies
          </Button>
        </div>
      </Card>

      {/* Final Confirmation Dialog for Reporting (Solid Danger Fill ONLY on final confirm) */}
      <Modal
        isOpen={showReportConfirm}
        onClose={() => setShowReportConfirm(false)}
        title="Open Anonymous Safety Report?"
        description="Your report is confidential and will not notify the reported account."
        size="md"
      >
        <div className="space-y-4 pt-2">
          <p className="text-xs text-ink/60 leading-relaxed">
            Proceed to select an account or incident type and submit evidence directly to Campus Safety & Trust moderators.
          </p>
          <div className="flex items-center justify-end gap-3">
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
                onNavigate?.('blockreport');
              }}
            >
              Report
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
