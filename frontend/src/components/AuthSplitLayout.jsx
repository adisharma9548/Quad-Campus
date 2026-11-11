import React from 'react';
import { motion } from 'framer-motion';
import { Lock, ShieldCheck, GraduationCap } from 'lucide-react';
import { QuadLogo } from './QuadLogo';

/**
 * Responsive two-column split layout for authentication and onboarding screens.
 * Left column (lg+): Quad brand showcase, tagline, and privacy guarantees.
 * Right column (lg+): Interactive action card (Welcome CTA, Login form, Sign-up stepper, or Reset password).
 * Automatically stacks vertically on narrow mobile viewports.
 */
export function AuthSplitLayout({
  children,
  compactMobileHeader = false,
  footer = null,
}) {
  return (
    <div className="w-full max-w-5xl mx-auto min-h-[calc(100dvh-140px)] flex flex-col justify-center py-4 sm:py-8 px-2 sm:px-4 select-none">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center w-full">
        {/* Left Column: Brand Showcase */}
        <motion.div
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
          className={`lg:col-span-6 flex flex-col items-center lg:items-start text-center lg:text-left ${
            compactMobileHeader ? 'gap-3 lg:gap-6' : 'gap-6'
          }`}
        >
          {/* Network Micro Badge */}
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-ink/6 border border-ink/12 text-xs font-semibold text-ink">
            <GraduationCap size={16} className="text-accent shrink-0" />
            <span>Engineering Campus Network</span>
          </span>

          {/* Brand Identity */}
          <div className="flex flex-col items-center lg:items-start gap-3">
            <div className="p-2">
              <QuadLogo size={compactMobileHeader ? 64 : 88} />
            </div>
            <div>
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-ink font-display">
                Quad
              </h1>
              <p className="mt-2 text-base text-ink/60 font-medium tracking-wide max-w-sm">
                Campus, on your terms.
              </p>
            </div>
          </div>

          {/* Privacy Value Proposition Cards */}
          <div
            className={`grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-md lg:max-w-none text-left ${
              compactMobileHeader ? 'hidden lg:grid' : 'grid'
            }`}
          >
            <div className="p-4 rounded-[16px] bg-ink/6 border border-ink/12">
              <Lock size={16} className="text-accent mb-2" />
              <p className="text-xs font-bold text-ink">Private Vault</p>
              <p className="text-xs text-ink/60 mt-1 leading-relaxed">
                Personal space is locked by default.
              </p>
            </div>
            <div className="p-4 rounded-[16px] bg-ink/6 border border-ink/12">
              <ShieldCheck size={16} className="text-accent mb-2" />
              <p className="text-xs font-bold text-ink">Zero Stalking</p>
              <p className="text-xs text-ink/60 mt-1 leading-relaxed">
                No live GPS, read receipts, or active status.
              </p>
            </div>
          </div>
        </motion.div>

        {/* Right Column: Action / Auth Form Container */}
        <motion.div
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.25, delay: 0.05, ease: [0.4, 0, 0.2, 1] }}
          className="lg:col-span-6 w-full max-w-md mx-auto lg:max-w-none"
        >
          {children}
          {footer && (
            <div className="mt-4 text-center text-xs text-ink/60">
              {footer}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
export default AuthSplitLayout;
