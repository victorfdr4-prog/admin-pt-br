import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  width?: 'sm' | 'md' | 'lg' | 'xl';
  footer?: React.ReactNode;
  children: React.ReactNode;
  hideHeader?: boolean;
}

const WIDTH_MAP = {
  sm:  'max-w-[420px]',
  md:  'max-w-[560px]',
  lg:  'max-w-[760px]',
  xl:  'max-w-[960px]',
};

export const Drawer: React.FC<DrawerProps> = ({
  open,
  onClose,
  title,
  subtitle,
  width = 'md',
  footer,
  children,
  hideHeader = false,
}) => {
  // ESC fecha
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[200]">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/25 backdrop-blur-[2px]"
          />

          {/* Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 38, mass: 0.8 }}
            className={cn(
              'absolute right-0 top-0 h-full w-full bg-white shadow-2xl flex flex-col',
              WIDTH_MAP[width]
            )}
          >
            {/* Header */}
            {!hideHeader && (
              <div className="flex items-center justify-between border-b border-[#f0f2f5] px-6 py-4 shrink-0">
                <div className="min-w-0">
                  {title && (
                    <h2 className="text-[16px] font-bold text-foreground leading-tight truncate">
                      {title}
                    </h2>
                  )}
                  {subtitle && (
                    <p className="mt-0.5 text-[12px] text-muted-foreground truncate">{subtitle}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="ml-4 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-border text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  <X size={15} />
                </button>
              </div>
            )}

            {/* Body */}
            <div className="flex-1 overflow-y-auto minimal-scrollbar">
              {children}
            </div>

            {/* Footer */}
            {footer && (
              <div className="shrink-0 border-t border-[#f0f2f5] bg-[#fafbfc] px-6 py-4">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

// ── Seção dentro do drawer ────────────────────────────
export const DrawerSection: React.FC<{
  title?: string;
  children: React.ReactNode;
  className?: string;
}> = ({ title, children, className }) => (
  <div className={cn('px-6 py-5 border-b border-[#f5f6f8] last:border-b-0', className)}>
    {title && (
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">
        {title}
      </p>
    )}
    {children}
  </div>
);

// ── Field wrapper ─────────────────────────────────────
export const DrawerField: React.FC<{
  label: string;
  children: React.ReactNode;
  className?: string;
}> = ({ label, children, className }) => (
  <div className={cn('space-y-1.5', className)}>
    <label className="block text-[12px] font-medium text-muted-foreground">{label}</label>
    {children}
  </div>
);
