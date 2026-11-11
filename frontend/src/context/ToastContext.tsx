import React, { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'info' | 'success' | 'danger' | 'error';

export interface ToastInput {
  title?: string;
  message?: string;
  type?: ToastType;
  duration?: number;
}

export interface ToastItem {
  id: string;
  title?: string;
  message?: string;
  type: 'info' | 'success' | 'danger';
}

export interface ToastContextValue {
  showToast: (arg1: string | ToastInput, arg2?: string, arg3?: number) => string | null;
  toast: {
    info: (message: string, title?: string) => string | null;
    success: (message: string, title?: string) => string | null;
    danger: (message: string, title?: string) => string | null;
    error: (message: string, title?: string) => string | null;
  };
}

const ToastContext = createContext<ToastContextValue>({
  showToast: () => null,
  toast: {
    info: () => null,
    success: () => null,
    danger: () => null,
    error: () => null,
  },
});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (arg1: string | ToastInput, arg2 = 'info', arg3 = 3500): string | null => {
      const normalized =
        typeof arg1 === 'string'
          ? {
              message: arg1,
              type: (['info', 'success', 'danger', 'error'].includes(arg2)
                ? arg2 === 'error'
                  ? 'danger'
                  : arg2
                : 'info') as 'info' | 'success' | 'danger',
              title: ['info', 'success', 'danger', 'error'].includes(arg2) ? undefined : arg2,
              duration: arg3,
            }
          : {
              title: arg1?.title,
              message: arg1?.message,
              type: (arg1?.type === 'error' ? 'danger' : arg1?.type || 'info') as
                | 'info'
                | 'success'
                | 'danger',
              duration: arg1?.duration ?? 3500,
            };

      if (!normalized.message && !normalized.title) return null;

      const id = Date.now() + Math.random().toString(36).substring(2, 6);
      const newToast: ToastItem = {
        id,
        title: normalized.title,
        message: normalized.message,
        type: normalized.type,
      };

      setToasts((prev) => [...prev, newToast]);

      if (normalized.duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, normalized.duration);
      }
      return id;
    },
    [removeToast]
  );

  const toast = {
    info: (message: string, title?: string) => showToast({ message, title, type: 'info' }),
    success: (message: string, title?: string) => showToast({ message, title, type: 'success' }),
    danger: (message: string, title?: string) => showToast({ message, title, type: 'danger' }),
    error: (message: string, title?: string) => showToast({ message, title, type: 'danger' }),
  };

  return (
    <ToastContext.Provider value={{ showToast, toast }}>
      {children}
      {/* Toast Notification Container */}
      <div
        className="fixed bottom-4 mb-12 md:mb-0 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none p-4"
        aria-live="polite"
      >
        <AnimatePresence>
          {toasts.map((t) => {
            const isDanger = t.type === 'danger';
            const isSuccess = t.type === 'success';
            const Icon = isDanger ? AlertCircle : isSuccess ? CheckCircle2 : Info;

            return (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 16, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 16, scale: 0.95 }}
                transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                className={`pointer-events-auto flex items-center gap-3 p-4 rounded-[8px] bg-canvas border ${
                  isDanger ? 'border-danger text-danger' : 'border-ink/12 text-ink'
                }`}
                role="status"
              >
                <Icon
                  size={20}
                  className={`flex-shrink-0 ${
                    isDanger ? 'text-danger' : isSuccess ? 'text-accent' : 'text-ink'
                  }`}
                />
                <div className="flex-1 min-w-0">
                  {t.title && (
                    <p className="text-sm font-bold leading-tight font-display">
                      {t.title}
                    </p>
                  )}
                  {t.message && (
                    <p
                      className={`text-xs leading-relaxed ${
                        t.title ? 'text-ink/60 mt-1' : 'text-ink font-medium'
                      }`}
                    >
                      {t.message}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => removeToast(t.id)}
                  className="min-w-[44px] min-h-[44px] -m-2 flex items-center justify-center text-ink/55 hover:text-ink cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-full transition-colors"
                  aria-label="Dismiss toast"
                >
                  <X size={16} />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
