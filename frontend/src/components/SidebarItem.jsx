import React from 'react';
import { Badge } from './ui';

export function SidebarItem({
  icon: Icon,
  label,
  active = false,
  badge,
  badgeVariant = 'status',
  onClick,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      className={`w-full min-h-[44px] flex items-center justify-center lg:justify-between px-3 py-2 rounded-full text-sm font-medium transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
        active
          ? 'bg-ink text-canvas font-semibold'
          : 'text-ink/60 hover:bg-ink/8 hover:text-ink'
      }`}
    >
      <div className="flex items-center gap-3 min-w-0">
        {Icon && (
          <Icon
            size={20}
            strokeWidth={2}
            fill="none"
            className="shrink-0"
            aria-hidden="true"
          />
        )}
        <span className="hidden lg:inline truncate">{label}</span>
      </div>

      {badge && (
        <span className="hidden lg:inline-flex shrink-0">
          <Badge
            variant={badgeVariant}
            inverted={active && badgeVariant !== 'accent'}
          >
            {badge}
          </Badge>
        </span>
      )}
    </button>
  );
}

export default SidebarItem;
