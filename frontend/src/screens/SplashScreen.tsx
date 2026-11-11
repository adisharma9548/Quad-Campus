import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { QuadLogo } from '../components/QuadLogo';
import { ShieldCheck, Lock, GraduationCap } from 'lucide-react';

export default function SplashScreen({ onNext }: { onNext?: () => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onNext?.(), 2800);
    return () => clearTimeout(timer);
  }, [onNext]);

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-between py-12 px-6 bg-canvas text-ink overflow-hidden select-none">
      {/* Top micro badge */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-ink/6 border border-ink/12 text-xs text-ink font-medium"
      >
        <Lock size={12} className="text-ink" />
        <span>Verified Campus Network</span>
      </motion.div>

      {/* Main Logo & App Identity */}
      <div className="flex flex-col items-center text-center my-auto">
        <motion.div
          initial={{ scale: 0.6, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 220, damping: 18 }}
          className="relative"
        >
          {/* Logo container */}
          <div className="relative p-2">
            <QuadLogo size={96} />
          </div>

          {/* Pulse ring around the keyhole/shield icon */}
          <motion.div
            className="absolute inset-0 rounded-[28px] border border-ink/20"
            initial={{ scale: 1, opacity: 0.8 }}
            animate={{ scale: 1.35, opacity: 0 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
          />
        </motion.div>

        {/* Brand name */}
        <motion.h1
          className="mt-6 text-4xl font-extrabold tracking-tight text-ink font-display"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
        >
          Quad
        </motion.h1>

        {/* Official Tagline from Logo */}
        <motion.p
          className="mt-2 text-base font-medium text-ink/60 tracking-wide"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.5 }}
        >
          Campus, on your terms.
        </motion.p>

        {/* Value Proposition pills */}
        <motion.div
          className="mt-6 flex flex-wrap justify-center gap-2 max-w-xs"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
        >
          <span className="text-[11px] px-3 py-1 rounded-full bg-ink/6 border border-ink/12 text-ink inline-flex items-center gap-2 font-medium">
            <Lock size={12} className="text-ink" />
            Private-first
          </span>
          <span className="text-[11px] px-3 py-1 rounded-full bg-ink/6 border border-ink/12 text-ink inline-flex items-center gap-2 font-medium">
            <GraduationCap size={12} className="text-ink" />
            Edu Verified
          </span>
          <span className="text-[11px] px-3 py-1 rounded-full bg-ink/6 border border-ink/12 text-ink inline-flex items-center gap-2 font-medium">
            <ShieldCheck size={12} className="text-ink" />
            Zero Tracking
          </span>
        </motion.div>
      </div>

      {/* Bottom loader & Tap to skip */}
      <div className="flex flex-col items-center gap-3">
        <motion.div
          className="flex gap-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
        >
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-2 h-2 rounded-full bg-accent"
              animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.3, 0.8] }}
              transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
            />
          ))}
        </motion.div>

        <button
          onClick={() => onNext?.()}
          className="text-xs text-ink/60 hover:text-ink transition-colors underline underline-offset-4 cursor-pointer"
        >
          Tap to continue
        </button>
      </div>
    </div>
  );
}
