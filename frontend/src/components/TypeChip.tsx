import React from 'react';
import {
  HelpCircle,
  Lightbulb,
  Megaphone,
  Calendar,
  BookOpen,
  MessagesSquare,
  type LucideIcon,
} from 'lucide-react';
import type { PostType } from '../types/quad';

const TYPE_CONFIG: Record<string, { icon: LucideIcon; label: string }> = {
  Question: { icon: HelpCircle, label: 'Question' },
  Tip: { icon: Lightbulb, label: 'Tip' },
  Update: { icon: Megaphone, label: 'Update' },
  Event: { icon: Calendar, label: 'Event' },
  Resource: { icon: BookOpen, label: 'Resource' },
  Discussion: { icon: MessagesSquare, label: 'Discussion' },
};

export interface TypeChipProps {
  type?: PostType | string;
  className?: string;
}

export function TypeChip({ type = 'Discussion', className = '' }: TypeChipProps) {
  const config = TYPE_CONFIG[type] || TYPE_CONFIG.Discussion;
  const Icon = config.icon;
  const isQuestion = type === 'Question';

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-[6px] text-xs font-medium leading-normal whitespace-nowrap ${
        isQuestion
          ? 'bg-accent/10 text-accent'
          : 'bg-ink/6 text-ink'
      } ${className}`}
    >
      <Icon size={14} strokeWidth={2} className="shrink-0" aria-hidden="true" />
      <span>{config.label}</span>
    </span>
  );
}

export default TypeChip;
