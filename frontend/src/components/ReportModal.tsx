import React, { useState, useEffect } from 'react';
import { Flag } from 'lucide-react';
import { Modal, Button } from './ui';

export const CAMPUS_REPORT_REASONS: ReadonlyArray<{ id: string; label: string }> = [
  { id: 'guidelines', label: 'Community Guidelines Review' },
  { id: 'harassment', label: 'Harassment or bullying' },
  { id: 'privacy', label: 'Privacy or doxxing violation' },
  { id: 'inappropriate', label: 'Inappropriate or hateful content' },
  { id: 'spam', label: 'Commercial spam or exam cheats' },
  { id: 'impersonation', label: 'Impersonation or fake account' },
];

export interface ReportModalProps {
  isOpen: boolean;
  targetLabel?: string;
  snippet?: string;
  onClose: () => void;
  onConfirm: (reason: string, details: string) => Promise<void>;
}

export default function ReportModal({
  isOpen,
  targetLabel,
  snippet,
  onClose,
  onConfirm,
}: ReportModalProps) {
  const [selectedReason, setSelectedReason] = useState(CAMPUS_REPORT_REASONS[0].label);
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSelectedReason(CAMPUS_REPORT_REASONS[0].label);
      setDetails('');
      setSubmitting(false);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      await onConfirm(selectedReason, details.trim());
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Submit confidential report?"
      description="Your report is private. No alert is sent to the author."
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-2">
        {targetLabel && (
          <div className="p-3 rounded-[10px] border border-ink/12 bg-ink/4 space-y-1">
            <p className="text-xs font-bold text-ink">{targetLabel}</p>
            {snippet && (
              <p className="text-xs text-ink/70 line-clamp-2 italic">"{snippet}"</p>
            )}
          </div>
        )}

        <div className="space-y-2">
          <p className="text-xs font-bold text-ink">Select reason</p>
          <div className="space-y-2">
            {CAMPUS_REPORT_REASONS.map((item) => {
              const active = selectedReason === item.label;
              return (
                <label
                  key={item.id}
                  className={`flex items-center gap-3 p-3 rounded-[10px] border text-xs cursor-pointer transition-colors ${
                    active
                      ? 'border-ink bg-ink/6 font-bold text-ink'
                      : 'border-ink/12 text-ink/80 hover:bg-ink/4'
                  }`}
                >
                  <input
                    type="radio"
                    name="campus_report_reason"
                    checked={active}
                    onChange={() => setSelectedReason(item.label)}
                    className="accent-current"
                  />
                  <span>{item.label}</span>
                </label>
              );
            })}
          </div>
        </div>

        <div className="space-y-1">
          <label
            htmlFor="report-extra-details"
            className="text-xs font-semibold text-ink/80 block"
          >
            Additional context (optional)
          </label>
          <textarea
            id="report-extra-details"
            rows={2}
            maxLength={500}
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder="Share brief context for campus moderators..."
            className="w-full px-3 py-2 rounded-[8px] text-xs bg-canvas border border-ink/12 text-ink placeholder:text-ink/60 focus:outline-none focus:ring-2 focus:ring-accent resize-y"
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" size="md" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="destructive"
            size="md"
            icon={Flag}
            disabled={submitting}
          >
            {submitting ? 'Submitting...' : 'Confirm Report'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
