/**
 * Quad Design System - Central Theme Tokens
 * SINGLE SOURCE OF TRUTH
 * 
 * Strict Foundation Constraints:
 * 1. Colors (4-color system: Canvas, Ink, Accent, Danger)
 * 2. Spacing: 4, 8, 12, 16, 24, 32, 48 px
 * 3. Type scale: 5 sizes (12, 14, 16, 18, 24 px), 3 weights (400, 500, 700)
 * 4. Radius: 2 values (8px, 16px) + full (9999px)
 * 5. Icon sizes: 16, 20, 24 px
 * 6. Min tap target: 44x44 px
 * 7. Motion: 150ms, 250ms, 350ms with easing cubic-bezier(0.4, 0, 0.2, 1)
 */

export const COLORS = {
  light: {
    canvas: '#FFFFFF', // ~62%: backgrounds, cards, sheets, modals, nav bars
    ink: '#111111',    // ~28%: text, icons, borders, active tab, secondary buttons
    accent: '#0A68CC', // ~8%: primary buttons, links, @mentions, focus rings (5.4:1 on white, WCAG AA)
    danger: '#DC2A25', // ~2%: ONLY report, delete, block, destructive confirms, errors
  },
  dark: {
    canvas: '#0B0B0C',
    ink: '#F5F5F5',
    accent: '#4DA6FF',
    danger: '#FF5A52',
  },
};

export const THEME = COLORS;
export const TOKENS = COLORS;

export const DERIVED_OPACITIES = {
  secondaryText: 0.60, // ink at 60%
  inactiveTab: 0.55,   // ink at 55%
  disabled: 0.30,      // ink at 30%
  dividers: 0.12,      // ink at 12%
  secondaryBtn: 0.08,  // ink at 8%
  hover: 0.08,         // ink at 8%
  cardElevated: 0.06,  // ink at 6%
};

export const DERIVED_STATES = DERIVED_OPACITIES;

// Allowed spacing scale in pixels
export const SPACING = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  6: 24,
  8: 32,
  12: 48,
};

// Allowed type scale (max 5 sizes) and weights (max 3 weights)
export const TYPOGRAPHY = {
  sizes: {
    caption: { size: '12px', lineHeight: '16px', className: 'text-xs' },
    bodySm: { size: '14px', lineHeight: '20px', className: 'text-sm' },
    body: { size: '16px', lineHeight: '24px', className: 'text-base' },
    title: { size: '18px', lineHeight: '28px', className: 'text-lg' },
    display: { size: '24px', lineHeight: '32px', className: 'text-2xl' },
  },
  weights: {
    regular: 400,
    medium: 500,
    bold: 700,
  },
  fonts: {
    sans: "'Inter Variable', 'Inter', system-ui, -apple-system, sans-serif",
    display: "'Space Grotesk Variable', 'Space Grotesk', system-ui, sans-serif",
  },
};

// Radius tokens: 8px controls, 12px cards, full pills
export const RADIUS = {
  sm: '8px',    // Buttons, inputs, chips, toasts
  md: '12px',   // Cards, sheets, modals
  full: '9999px', // Avatars, pills, badges
};

// Exactly 3 icon sizes
export const ICON_SIZES = {
  sm: 16,
  md: 20,
  lg: 24,
};

// Minimum touch / click tap target
export const TAP_TARGET_MIN = 44; // 44x44px

// Motion tokens: 3 durations, 1 easing
export const MOTION = {
  fast: 150,   // Micro-interactions, hover, toggle
  normal: 250, // Card expands, toasts, sheet slides
  slow: 350,   // Full modal transitions, page reveals
  easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
};

export default {
  COLORS,
  SPACING,
  TYPOGRAPHY,
  RADIUS,
  ICON_SIZES,
  TAP_TARGET_MIN,
  MOTION,
  DERIVED_STATES,
};
