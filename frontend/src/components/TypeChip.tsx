import React from 'react';
import {
  HelpCircle,
  Lightbulb,
  Megaphone,
  Calendar,
  Link2,
  MessagesSquare,
  type LucideIcon,
} from 'lucide-react';
import type { PostType } from '../types/quad';

const TYPE_CONFIG: Record<string, { icon: LucideIcon; label: string }> = {
  Question: { icon: HelpCircle, label: 'Question' },
  Tip: { icon: Lightbulb, label: 'Tip' },
  Update: { icon: Megaphone, label: 'Update' },
  Event: { icon: Calendar, label: 'Event' },
  Resource: { icon: Link2, label: 'Resource' },
  Discussion: { icon: MessagesSquare, label: 'Discussion' },
};

export interface TypeChipProps {
  type?: PostType | string;
  className?: string;
}

export function TypeChip({ type = 'Discussion', className = '' }: TypeChipProps) {
  const config = TYPE_CONFIG[type] || TYPE_CONFIG.Discussion;
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1 px-3 py-1 rounded-full bg-ink/6 text-ink/60 border border-ink/12 font-sans text-[11px] font-medium leading-none whitespace-nowrap ${className}`}
    >
      <Icon size={14} strokeWidth={2} className="shrink-0 text-ink/60" aria-hidden="true" />
      <span>{config.label}</span>
    </span>
  );
}

export default TypeChip;
