import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Lock,
  Globe,
  Users,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  ShieldAlert,
  UserCheck,
  X,
  AlertCircle,
} from 'lucide-react';
import { QuadLogo } from './QuadLogo';

/* ═══════════════════════════════════════════════════════════════════════
   1. SPINNER (Icon sizes: 16, 20, 24 px)
   ═══════════════════════════════════════════════════════════════════════ */
export function Spinner({ size = 'md', className = '' }) {
  const sizeMap = {
    sm: 'w-4 h-4 border-2', // 16px
    md: 'w-5 h-5 border-2', // 20px
    lg: 'w-6 h-6 border-2', // 24px
  };

  return (
    <div
      role="status"
      aria-label="Loading"
      className={`inline-block rounded-full border-accent border-t-transparent animate-spin ${sizeMap[size] || sizeMap.md} ${className}`}
    >
      <span className="sr-only">Loading...</span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   2. BUTTON (primary, secondary, destructive) - ALL STATES
   ═══════════════════════════════════════════════════════════════════════ */
export function Button({
  children,
  variant = 'primary', // 'primary' | 'secondary' | 'destructive' | 'danger' | 'outline' | 'ghost'
  size = 'md',         // 'sm' | 'md' | 'lg'
  fullWidth = false,
  onClick,
  icon: Icon,
  disabled = false,
  loading = false,
  error = false,
  className = '',
  type = 'button',
  ariaLabel,
}) {
  // Normalize 'danger' to 'destructive'
  const normalizedVariant = variant === 'danger' ? 'destructive' : variant;

  const variantStyles = {
    primary:
      'bg-accent text-canvas font-semibold hover:opacity-90 active:opacity-100',
    secondary:
      'bg-ink/8 hover:bg-ink/12 text-ink font-medium active:bg-ink/16',
    destructive:
      'bg-danger text-canvas font-semibold hover:opacity-90 active:opacity-100',
    outline:
      'border border-ink/12 bg-canvas hover:bg-ink/8 text-ink font-medium active:bg-ink/12',
    ghost:
      'text-ink/60 hover:text-ink hover:bg-ink/8 active:bg-ink/12 font-medium',
    accent:
      'bg-accent text-canvas font-semibold hover:opacity-90 active:opacity-100',
  };

  // All buttons enforce the 44px min touch target with strict spacing scale (px-3, px-4, px-6, py-2, py-3)
  const sizeStyles = {
    sm: 'text-xs px-3 py-2 gap-2 min-h-[44px] min-w-[44px] rounded-[8px]',
    md: 'text-sm px-4 py-2 gap-2 min-h-[44px] min-w-[44px] rounded-[8px]',
    lg: 'text-base px-6 py-3 gap-3 min-h-[48px] min-w-[48px] rounded-[8px]',
  };

  const iconSizes = {
    sm: 16,
    md: 20,
    lg: 24,
  };

  const isInteractive = !disabled && !loading;

  return (
    <button
      type={type}
      onClick={isInteractive ? onClick : undefined}
      disabled={disabled || loading}
      aria-label={ariaLabel}
      aria-busy={loading}
      className={`inline-flex items-center justify-center select-none transition-all duration-150 cursor-pointer ${
        variantStyles[normalizedVariant] || variantStyles.primary
      } ${sizeStyles[size] || sizeStyles.md} ${fullWidth ? 'w-full' : ''} ${
        isInteractive ? 'active:scale-[0.98]' : ''
      } ${
        disabled
          ? 'opacity-30 cursor-not-allowed pointer-events-none'
          : ''
      } ${
        loading ? 'cursor-wait opacity-80' : ''
      } ${
        error ? 'ring-2 ring-danger' : ''
      } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas ${className}`}
    >
      {loading ? (
        <Spinner size={size === 'lg' ? 'md' : 'sm'} className={normalizedVariant === 'secondary' ? 'border-ink' : 'border-canvas'} />
      ) : Icon ? (
        <Icon size={iconSizes[size] || 20} strokeWidth={2} className="flex-shrink-0" />
      ) : null}
      {children && <span className="truncate">{children}</span>}
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   3. TEXT FIELD / INPUT - ALL STATES
   ═══════════════════════════════════════════════════════════════════════ */
export function TextField({
  label,
  placeholder,
  value,
  onChange,
  onBlur,
  type = 'text',
  icon: Icon,
  error,
  helper,
  disabled = false,
  loading = false,
  multiline = false,
  rows = 3,
  rightElement,
  className = '',
  name,
  id,
  autoComplete,
  inputMode,
  ...rest
}) {
  const inputId = id || name || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);
  const helperId = helper ? `${inputId}-helper` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;

  return (
    <div className={`space-y-1 w-full ${className}`}>
      {label && (
        <label
          htmlFor={inputId}
          className="block text-xs font-semibold tracking-wide uppercase text-ink/60"
        >
          {label}
        </label>
      )}

      <div className="relative">
        {Icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/40 pointer-events-none flex items-center justify-center">
            <Icon size={20} strokeWidth={1.8} />
          </div>
        )}

        {multiline ? (
          <textarea
            id={inputId}
            name={name}
            disabled={disabled}
            placeholder={placeholder}
            value={value}
            onChange={onChange}
            onBlur={onBlur}
            rows={rows}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? errorId : helperId}
            className={`w-full rounded-[8px] border bg-canvas p-3 text-sm text-ink placeholder:text-ink/40 transition-all ${
              error
                ? 'border-danger focus:ring-2 focus:ring-danger/20 focus:border-danger text-danger'
                : 'border-ink/12 hover:border-ink/24 focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none'
            } ${Icon ? 'pl-12' : ''} ${
              disabled ? 'opacity-30 bg-ink/6 cursor-not-allowed' : ''
            }`}
            {...rest}
          />
        ) : (
          <input
            id={inputId}
            name={name}
            type={type}
            disabled={disabled}
            placeholder={placeholder}
            value={value}
            onChange={onChange}
            onBlur={onBlur}
            autoComplete={autoComplete}
            inputMode={inputMode}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? errorId : helperId}
            className={`w-full min-h-[44px] rounded-[8px] border bg-canvas px-3 py-2 text-sm text-ink placeholder:text-ink/40 transition-all ${
              error
                ? 'border-danger focus:ring-2 focus:ring-danger/20 focus:border-danger text-danger'
                : 'border-ink/12 hover:border-ink/24 focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none'
            } ${Icon ? 'pl-12' : ''} ${
              loading || rightElement ? 'pr-12' : ''
            } ${disabled ? 'opacity-30 bg-ink/6 cursor-not-allowed' : ''}`}
            {...rest}
          />
        )}

        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
            <Spinner size="sm" />
          </div>
        )}

        {!loading && rightElement && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {rightElement}
          </div>
        )}
      </div>

      {error && (
        <p id={errorId} className="text-xs text-danger font-semibold mt-1 flex items-center gap-1">
          <AlertCircle size={16} className="flex-shrink-0" />
          <span>{error}</span>
        </p>
      )}

      {!error && helper && (
        <p id={helperId} className="text-xs text-ink/60 mt-1">{helper}</p>
      )}
    </div>
  );
}

// Backward-compatible alias
export const Input = TextField;

/* ═══════════════════════════════════════════════════════════════════════
   4. AVATAR (sm: 32px, 36px author, md: 44px, lg: 48px, xl: 64px)
   ═══════════════════════════════════════════════════════════════════════ */
function hashAvatarUsername(input = '') {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash % 6;
}

function AvatarPatternOverlay({ variant }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 40 40"
      className="absolute inset-0 w-full h-full pointer-events-none text-ink/12"
      fill="none"
    >
      {variant === 0 && (
        <>
          <line x1="-4" y1="14" x2="14" y2="-4" stroke="currentColor" strokeWidth="3" />
          <line x1="-4" y1="28" x2="28" y2="-4" stroke="currentColor" strokeWidth="3" />
          <line x1="8" y1="44" x2="44" y2="8" stroke="currentColor" strokeWidth="3" />
          <line x1="22" y1="44" x2="44" y2="22" stroke="currentColor" strokeWidth="3" />
        </>
      )}
      {variant === 1 && (
        <>
          <circle cx="40" cy="40" r="24" stroke="currentColor" strokeWidth="4" />
          <circle cx="0" cy="0" r="14" fill="currentColor" />
        </>
      )}
      {variant === 2 && (
        <>
          <circle cx="11" cy="11" r="4" fill="currentColor" />
          <circle cx="29" cy="11" r="4" fill="currentColor" />
          <circle cx="11" cy="29" r="4" fill="currentColor" />
          <circle cx="29" cy="29" r="4" fill="currentColor" />
        </>
      )}
      {variant === 3 && (
        <polygon points="20,4 36,20 20,36 4,20" stroke="currentColor" strokeWidth="3.5" />
      )}
      {variant === 4 && (
        <>
          <polygon points="0,0 20,0 0,20" fill="currentColor" />
          <polygon points="40,40 20,40 40,20" fill="currentColor" />
        </>
      )}
      {variant === 5 && (
        <>
          <line x1="20" y1="4" x2="20" y2="36" stroke="currentColor" strokeWidth="3" />
          <line x1="4" y1="20" x2="36" y2="20" stroke="currentColor" strokeWidth="3" />
        </>
      )}
    </svg>
  );
}

export function Avatar({
  initials = 'QD',
  username = '',
  src,
  alt,
  size = 'md', // 'sm' (32px) | '36' | '40' | 'md' (44px) | 'lg' (48px) | 'xl' (64px)
  hasUnseenReel = false,
  showBadge = false,
  badgeType = 'private', // 'private' | 'public' | 'group'
  onClick,
  disabled = false,
  className = '',
}) {
  const [imgFailed, setImgFailed] = React.useState(false);

  const sizeConfig = {
    sm: 'w-8 h-8 text-xs',                         // 32px
    36: 'w-9 h-9 text-xs font-semibold',           // 36px (feed post author)
    author: 'w-9 h-9 text-xs font-semibold',       // 36px alias
    40: 'w-10 h-10 text-xs font-semibold',         // 40px
    feed: 'w-10 h-10 text-xs font-semibold',       // 40px
    md: 'w-11 h-11 text-sm font-semibold',         // 44px (min touch target)
    lg: 'w-12 h-12 text-base font-bold',           // 48px
    xl: 'w-16 h-16 text-lg font-bold',             // 64px (profile header)
  };

  const patternVariant = hashAvatarUsername(username || initials);
  const showImage = Boolean(src) && !imgFailed;
  const isClickable = Boolean(onClick) && !disabled;

  return (
    <div
      onClick={isClickable ? onClick : undefined}
      className={`relative inline-flex flex-shrink-0 select-none ${
        isClickable
          ? 'cursor-pointer hover:opacity-90 active:scale-[0.96] transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-full'
          : ''
      } ${disabled ? 'opacity-30 cursor-not-allowed' : ''} ${className}`}
    >
      <div
        className={`relative overflow-hidden ${
          sizeConfig[size] || sizeConfig.md
        } rounded-full bg-ink/6 text-ink border border-ink/12 flex items-center justify-center font-sans tracking-tight ${
          hasUnseenReel ? 'ring-2 ring-accent ring-offset-2 ring-offset-canvas' : ''
        }`}
      >
        {showImage ? (
          <img
            src={src}
            alt={alt || `@${username || initials} avatar`}
            onError={() => setImgFailed(true)}
            className="w-full h-full object-cover"
          />
        ) : (
          <>
            <AvatarPatternOverlay variant={patternVariant} />
            <span className="relative z-10">{initials}</span>
          </>
        )}
      </div>

      {showBadge && (
        <div className="absolute -bottom-1 -right-1">
          {badgeType === 'private' ? (
            <div
              title="Private Space"
              className="w-4 h-4 rounded-full bg-ink text-canvas flex items-center justify-center border-2 border-canvas"
            >
              <Lock size={9} strokeWidth={2.5} />
            </div>
          ) : badgeType === 'group' ? (
            <div
              title="Group Only"
              className="w-4 h-4 rounded-full bg-accent text-canvas flex items-center justify-center border-2 border-canvas"
            >
              <Users size={9} strokeWidth={2.5} />
            </div>
          ) : (
            <div
              title="Public Space"
              className="w-4 h-4 rounded-full bg-ink/12 text-ink flex items-center justify-center border-2 border-canvas"
            >
              <Globe size={9} strokeWidth={2.5} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   5. CARD (radius-md: 16px) - ALL STATES
   ═══════════════════════════════════════════════════════════════════════ */
export function Card({
  children,
  className = '',
  onClick,
  padding = true,
  elevated = false,
  disabled = false,
}) {
  const isInteractive = Boolean(onClick) && !disabled;

  return (
    <div
      onClick={isInteractive ? onClick : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      onKeyDown={
        isInteractive
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick(e);
              }
            }
          : undefined
      }
      className={`bg-canvas rounded-[12px] border border-ink/12 ${
        elevated ? 'bg-ink/6' : ''
      } ${padding ? 'p-4' : ''} ${
        isInteractive
          ? 'cursor-pointer hover:border-ink/24 hover:bg-ink/8 active:scale-[0.99] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent'
          : ''
      } ${disabled ? 'opacity-30 pointer-events-none' : ''} ${className}`}
    >
      {children}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   6. MODAL & SHEET - ALL STATES & MOTION
   ═══════════════════════════════════════════════════════════════════════ */
export function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  variant = 'modal', // 'modal' | 'sheet'
  size = 'md',        // 'sm' | 'md' | 'lg'
}) {
  const dialogRef = useRef(null);

  // Accessible Escape key handler
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-3xl',
  };

  const isSheet = variant === 'sheet';

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? 'modal-title' : undefined}
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            onClick={onClose}
            className="fixed inset-0 bg-ink/60 backdrop-blur-xs cursor-pointer"
          />

          {/* Dialog Container */}
          <motion.div
            ref={dialogRef}
            initial={
              isSheet
                ? { opacity: 0, y: 100 }
                : { opacity: 0, scale: 0.95, y: 16 }
            }
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={
              isSheet
                ? { opacity: 0, y: 100 }
                : { opacity: 0, scale: 0.95, y: 16 }
            }
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            className={`relative w-full ${sizeClasses[size] || sizeClasses.md} bg-canvas border border-ink/12 rounded-[12px] p-6 z-10 ${
              isSheet ? 'mt-auto sm:my-auto' : 'my-auto'
            }`}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                {title && (
                  <h3
                    id="modal-title"
                    className="text-lg font-bold text-ink font-display"
                  >
                    {title}
                  </h3>
                )}
                {description && (
                  <p className="text-xs text-ink/60 mt-1 leading-relaxed">
                    {description}
                  </p>
                )}
              </div>

              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="min-w-[44px] min-h-[44px] -m-2 flex items-center justify-center text-ink/60 hover:text-ink hover:bg-ink/8 rounded-full transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  aria-label="Close dialog"
                >
                  <X size={20} />
                </button>
              )}
            </div>

            {/* Content Body */}
            <div>{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export const Sheet = (props) => <Modal {...props} variant="sheet" />;

/* ═══════════════════════════════════════════════════════════════════════
   7. SKELETON LOADER
   ═══════════════════════════════════════════════════════════════════════ */
export function Skeleton({
  variant = 'rect', // 'rect' | 'circle' | 'text'
  width,
  height,
  className = '',
}) {
  const variantStyles = {
    circle: 'rounded-full',
    rect: 'rounded-[8px]',
    text: 'rounded-[4px] h-4 w-full',
  };

  const style = {
    width: width || undefined,
    height: height || undefined,
  };

  return (
    <div
      style={style}
      className={`animate-pulse bg-ink/8 ${variantStyles[variant] || variantStyles.rect} ${className}`}
      aria-hidden="true"
    />
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   8. EMPTY STATE
   ═══════════════════════════════════════════════════════════════════════ */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className = '',
}) {
  return (
    <div className={`flex flex-col items-center justify-center py-12 px-6 text-center ${className}`}>
      {Icon && (
        <div className="w-16 h-16 bg-ink/6 border border-ink/12 rounded-full flex items-center justify-center mb-4 text-ink">
          <Icon size={24} strokeWidth={1.8} />
        </div>
      )}
      <h3 className="text-base font-bold text-ink mb-1 font-display">
        {title}
      </h3>
      {description && (
        <p className="text-xs text-ink/60 max-w-sm leading-relaxed mb-4">
          {description}
        </p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   9. PRIVACY BADGE
   ═══════════════════════════════════════════════════════════════════════ */
export function PrivacyBadge({ level = 'private', labelCustom, size = 'sm' }) {
  const config = {
    private: { icon: Lock, label: labelCustom || 'Private' },
    public: { icon: Globe, label: labelCustom || 'Public (Campus)' },
    group: { icon: Users, label: labelCustom || 'Group Only' },
    followers: { icon: UserCheck, label: labelCustom || 'Followers Only' },
  };

  const c = config[level] || config.private;
  const Icon = c.icon;
  const sizeClasses =
    size === 'sm' ? 'text-xs px-3 py-1 gap-1' : 'text-xs px-3 py-1 gap-2';

  return (
    <span
      className={`inline-flex items-center rounded-full font-semibold tracking-wide bg-ink/6 text-ink border border-ink/12 ${sizeClasses}`}
    >
      <Icon size={16} className="text-ink flex-shrink-0" strokeWidth={2} />
      <span>{c.label}</span>
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   9B. UNIFIED BADGE (status | count | accent | danger) - NO MONOSPACE
   ═══════════════════════════════════════════════════════════════════════ */
export function Badge({
  children,
  variant = 'status', // 'status' | 'count' | 'accent' | 'danger'
  icon: Icon,
  inverted = false,
  className = '',
}) {
  const styles = {
    status: inverted
      ? 'bg-canvas/20 text-canvas border border-canvas/20'
      : 'bg-ink/6 text-ink border border-ink/12',
    count: inverted
      ? 'bg-canvas/20 text-canvas border border-canvas/20'
      : 'bg-ink/6 text-ink border border-ink/12',
    accent: 'bg-accent text-canvas',
    danger: 'bg-canvas text-danger border border-danger/30',
  };

  return (
    <span
      className={`inline-flex items-center justify-center gap-1 rounded-full font-sans text-[11px] font-semibold leading-none whitespace-nowrap ${
        variant === 'count' ? 'px-2 py-1 min-w-[20px]' : 'px-3 py-1'
      } ${styles[variant] || styles.status} ${className}`}
    >
      {Icon && <Icon size={16} strokeWidth={2} className="flex-shrink-0" />}
      <span>{children}</span>
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   10. TOGGLE SWITCH (Plain Language)
   ═══════════════════════════════════════════════════════════════════════ */
export function Toggle({ active, onToggle, label, description, icon: Icon, disabled = false }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      disabled={disabled}
      onClick={disabled ? undefined : onToggle}
      className={`flex items-center justify-between w-full py-3 px-1 group text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-[8px] cursor-pointer ${
        disabled ? 'opacity-30 cursor-not-allowed' : ''
      }`}
    >
      <div className="flex items-start gap-3 flex-1 pr-4">
        {Icon && (
          <div className="w-8 h-8 rounded-[8px] bg-ink/6 border border-ink/12 flex items-center justify-center flex-shrink-0 mt-1 text-ink">
            <Icon size={16} strokeWidth={2} />
          </div>
        )}
        <div>
          <p className="font-semibold text-sm text-ink group-hover:text-accent transition-colors">
            {label}
          </p>
          {description && (
            <p className="text-xs text-ink/60 mt-1 leading-relaxed">
              {description}
            </p>
          )}
        </div>
      </div>

      <div
        className={`w-12 h-7 rounded-full relative transition-colors duration-200 flex-shrink-0 ${
          active ? 'bg-accent' : 'bg-ink/12'
        }`}
      >
        <div
          className={`w-5 h-5 bg-canvas rounded-full absolute top-1 transition-transform duration-200 flex items-center justify-center ${
            active ? 'translate-x-6' : 'translate-x-1'
          }`}
        >
          {active ? (
            <Lock size={10} className="text-accent" strokeWidth={2.5} />
          ) : (
            <div className="w-1.5 h-1.5 rounded-full bg-ink/30" />
          )}
        </div>
      </div>
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   11. SHIELD BANNER
   ═══════════════════════════════════════════════════════════════════════ */
export function ShieldBanner({ message, type = 'info', icon: CustomIcon }) {
  const isDanger = type === 'danger';
  const Icon = CustomIcon || (isDanger ? ShieldAlert : ShieldCheck);

  return (
    <div
      className={`flex items-start gap-3 rounded-[8px] p-3 text-xs leading-relaxed ${
        isDanger
          ? 'bg-danger/10 border border-danger/30 text-danger font-semibold'
          : 'bg-ink/6 border border-ink/12 text-ink font-medium'
      }`}
    >
      <Icon
        size={16}
        className={`${isDanger ? 'text-danger' : 'text-ink'} flex-shrink-0 mt-1`}
        strokeWidth={2}
      />
      <span className="flex-1">{message}</span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   12. AUDIENCE CHIP
   ═══════════════════════════════════════════════════════════════════════ */
export function AudienceChip({ label, icon: Icon, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 px-3 py-2 min-h-[44px] rounded-full text-xs font-semibold transition-all select-none cursor-pointer border ${
        active
          ? 'bg-ink text-canvas border-ink'
          : 'bg-ink/6 text-ink/60 hover:text-ink hover:bg-ink/8 border-ink/12'
      } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent`}
    >
      {Icon && <Icon size={16} strokeWidth={2} />}
      <span>{label}</span>
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   13. MENU ITEM
   ═══════════════════════════════════════════════════════════════════════ */
export function MenuItem({
  icon: Icon,
  label,
  description,
  onClick,
  danger,
  rightContent,
  badge,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-3 w-full min-h-[44px] py-2 px-2 text-left rounded-[8px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent cursor-pointer ${
        danger ? 'hover:bg-ink/8 text-danger' : 'hover:bg-ink/8 text-ink'
      }`}
    >
      <div
        className={`w-9 h-9 rounded-[8px] flex items-center justify-center flex-shrink-0 border ${
          danger
            ? 'bg-ink/6 border-ink/12 text-danger'
            : 'bg-ink/6 border-ink/12 text-ink'
        }`}
      >
        <Icon size={18} strokeWidth={1.8} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold truncate">{label}</p>
          {badge && (
            <span className="bg-danger text-white text-[10px] font-bold px-2 py-1 rounded-full">
              {badge}
            </span>
          )}
        </div>
        {description && (
          <p className="text-xs text-ink/60 mt-1 truncate">{description}</p>
        )}
      </div>
      {rightContent || <ChevronRight size={16} className="text-ink/40 flex-shrink-0" />}
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   14. HEADER
   ═══════════════════════════════════════════════════════════════════════ */
export function Header({
  title,
  subtitle,
  onBack,
  rightAction,
  rightIcon: RightIcon,
  showLogo = false,
  badge,
}) {
  return (
    <header className="sticky top-0 z-40 bg-canvas/95 backdrop-blur-md border-b border-ink/12">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="min-w-[44px] min-h-[44px] -ml-2 rounded-full flex items-center justify-center hover:bg-ink/8 transition-colors text-ink cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              aria-label="Go back"
            >
              <ChevronLeft size={20} strokeWidth={2} />
            </button>
          )}

          {showLogo && <QuadLogo size={32} />}

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight text-ink font-display">
                {title}
              </h1>
              {badge && (
                <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-ink/6 text-ink border border-ink/12">
                  {badge}
                </span>
              )}
            </div>
            {subtitle && <p className="text-xs text-ink/60">{subtitle}</p>}
          </div>
        </div>

        {rightAction && (
          <button
            onClick={rightAction}
            className="min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center hover:bg-ink/8 transition-colors text-ink cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {RightIcon && <RightIcon size={20} strokeWidth={1.8} />}
          </button>
        )}
      </div>
    </header>
  );
}

const UI = {
  Button,
  TextField,
  Input,
  Avatar,
  Card,
  Modal,
  Sheet,
  Skeleton,
  EmptyState,
  Spinner,
  PrivacyBadge,
  Badge,
  Toggle,
  ShieldBanner,
  AudienceChip,
  MenuItem,
  Header,
};

export default UI;
