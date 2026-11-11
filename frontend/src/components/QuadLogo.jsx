import React from 'react';

/**
 * Quad Logo component styled strictly with design system tokens:
 * Speech bubble with a keyhole on a rounded tile.
 * Uses var(--color-ink) and var(--color-canvas) for theme adaptability.
 */
export function QuadLogo({
  size = 40,
  variant = 'primary', // 'primary' | 'bare'
  showText = false,
  tagline = false,
  className = '',
}) {
  const isBare = variant === 'bare';

  return (
    <div className={`inline-flex items-center gap-3 ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 512 512"
        role="img"
        aria-label="Quad logo: speech bubble with keyhole"
        className="flex-shrink-0 select-none"
      >
        {!isBare && (
          <rect
            x="2"
            y="2"
            width="508"
            height="508"
            rx="112"
            fill="var(--color-ink)"
          />
        )}
        {/* Speech Bubble */}
        <path
          d="M186 120 H326 A70 70 0 0 1 396 190 V260 A70 70 0 0 1 326 330 H250 L172 392 V330 H186 A70 70 0 0 1 116 260 V190 A70 70 0 0 1 186 120 Z"
          fill="var(--color-canvas)"
        />
        {/* Keyhole Circle */}
        <circle cx="256" cy="208" r="30" fill="var(--color-ink)" />
        {/* Keyhole Stem */}
        <path d="M236 230 L276 230 L286 282 H226 Z" fill="var(--color-ink)" />
      </svg>

      {showText && (
        <div className="flex flex-col text-left select-none">
          <span
            className="text-2xl font-bold tracking-tight text-ink font-display"
          >
            Quad
          </span>
          {tagline && (
            <span className="text-xs font-medium text-ink/60">
              Campus, on your terms.
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export default QuadLogo;
