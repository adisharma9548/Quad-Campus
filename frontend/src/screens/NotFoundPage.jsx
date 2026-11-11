import React from 'react';
import { motion } from 'framer-motion';
import { Compass, ArrowLeft } from 'lucide-react';
import { Button } from '../components/ui';
import { QuadLogo } from '../components/QuadLogo';

/**
 * Standard 404 Page Not Found
 * 
 * Crucial for stealth route gating:
 * When an unauthenticated or non-admin user requests /admin (or any nonexistent route),
 * this exact 404 is rendered with ZERO indication that an administrative endpoint exists.
 */
export default function NotFoundPage({ onNavigate }) {
  const handleReturn = () => {
    if (typeof window !== 'undefined' && window.history && window.history.pushState) {
      window.history.pushState({}, '', '/');
    }
    if (onNavigate) {
      onNavigate('feed');
    } else {
      window.location.href = '/';
    }
  };

  return (
    <div className="min-h-screen bg-canvas text-ink flex flex-col justify-between p-6 sm:p-8 select-none">
      {/* Top Header */}
      <header className="flex items-center justify-between max-w-xl mx-auto w-full pt-4">
        <div className="flex items-center gap-3">
          <QuadLogo size={28} />
          <span className="font-extrabold text-base tracking-tight font-display text-ink">
            Quad
          </span>
        </div>
      </header>

      {/* Main 404 Content */}
      <main className="max-w-md mx-auto w-full my-auto text-center py-12">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
          className="space-y-6"
        >
          <div className="w-16 h-16 rounded-full bg-ink/6 border border-ink/12 mx-auto flex items-center justify-center text-ink/60">
            <Compass size={32} />
          </div>

          <div className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-widest text-ink/40">
              Error 404
            </span>
            <h1 className="text-3xl font-extrabold text-ink tracking-tight font-display">
              Page not found
            </h1>
            <p className="text-sm text-ink/60 leading-relaxed max-w-sm mx-auto">
              The link you followed may be broken, or the resource may have been removed or does not exist.
            </p>
          </div>

          <div className="pt-2 flex justify-center">
            <Button
              variant="primary"
              size="md"
              icon={ArrowLeft}
              onClick={handleReturn}
              className="min-h-[44px]"
            >
              Back to Campus
            </Button>
          </div>
        </motion.div>
      </main>

      {/* Bottom Footer */}
      <footer className="max-w-xl mx-auto w-full text-center pb-4 text-xs text-ink/40">
        Quad Student Network • Protected Space
      </footer>
    </div>
  );
}
