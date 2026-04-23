import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowRight, Loader2, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface QuickField {
  key: string;
  label: string;
  placeholder: string;
  type?: 'text' | 'email' | 'phone' | 'checkbox' | string;
  required?: boolean;
  autoFocus?: boolean;
}

interface QuickCreateModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (values: Record<string, any>) => Promise<void> | void;
  title: string;
  subtitle?: string;
  fields: QuickField[];
  confirmLabel?: string;
  loading?: boolean;
}

export const QuickCreateModal: React.FC<QuickCreateModalProps> = ({
  open,
  onClose,
  onConfirm,
  title,
  subtitle,
  fields,
  confirmLabel = 'Criar',
  loading = false,
}) => {
  const [values, setValues] = React.useState<Record<string, any>>({});
  const firstInputRef = useRef<HTMLInputElement>(null);

  // Initialize values based on field types
  useEffect(() => {
    if (open) {
      const initial: Record<string, any> = {};
      fields.forEach(f => {
        if (f.type === 'checkbox') initial[f.key] = true; // Default to checked for standard flow
        else initial[f.key] = '';
      });
      setValues(initial);
      setTimeout(() => firstInputRef.current?.focus(), 150);
    }
  }, [open, fields]);

  // ESC close
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onConfirm(values);
  };

  const setVal = (key: string, val: any) =>
    setValues((prev) => ({ ...prev, [key]: val }));

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center px-4 overflow-y-auto py-10">
          {/* Backdrop with enhanced blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-950/40 backdrop-blur-md"
          />

          {/* Modal with glassmorphic premium feel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 12 }}
            transition={{ type: 'spring', stiffness: 450, damping: 32 }}
            className="relative z-10 w-full max-w-[420px] bg-white/95 backdrop-blur-xl rounded-[28px] shadow-[0_24px_80px_-12px_rgba(0,0,0,0.25)] overflow-hidden border border-white/40"
          >
            {/* Design Accent */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary/40 via-primary to-primary/40" />

            {/* Header */}
            <div className="flex items-start justify-between px-7 pt-7 pb-5">
              <div>
                <h3 className="text-[20px] font-bold text-foreground tracking-tight leading-tight">{title}</h3>
                {subtitle && (
                  <p className="mt-1.5 text-[14px] text-muted-foreground/80 leading-relaxed font-medium">{subtitle}</p>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted/80 hover:text-foreground transition-all mt-[-4px] mr-[-8px]"
              >
                <X size={18} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="px-7 pb-7 space-y-5">
              <div className="space-y-4">
                {fields.map((field, i) => (
                  <div key={field.key} className={cn("space-y-2", field.type === 'checkbox' ? 'pt-1' : '')}>
                    {field.type !== 'checkbox' ? (
                      <>
                        <label className="block text-[13px] font-bold text-slate-700/80 uppercase tracking-wider ml-1">
                          {field.label}
                          {field.required && <span className="ml-1 text-rose-500">*</span>}
                        </label>
                        <input
                          ref={i === 0 ? firstInputRef : undefined}
                          type={field.type || 'text'}
                          value={values[field.key] ?? ''}
                          onChange={(e) => setVal(field.key, e.target.value)}
                          placeholder={field.placeholder}
                          required={field.required}
                          className="field-control h-12 text-[15px] rounded-2xl border-slate-200/60 bg-slate-50/50 px-4 focus:bg-white transition-all shadow-sm hover:shadow-md"
                        />
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setVal(field.key, !values[field.key])}
                        className="flex items-center gap-3 group text-left w-full interactive-card p-3 rounded-2xl hover:bg-slate-50/80 transition-all border border-transparent hover:border-slate-100"
                      >
                        <div className={cn(
                          "flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border-2 transition-all shadow-sm",
                          values[field.key] 
                            ? "bg-primary border-primary text-white scale-105" 
                            : "bg-white border-slate-300 text-transparent group-hover:border-primary/50"
                        )}>
                          <Check size={14} strokeWidth={4} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[14px] font-semibold text-slate-800 leading-tight">{field.label}</p>
                          <p className="text-[12px] text-muted-foreground mt-0.5">{field.placeholder}</p>
                        </div>
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-4 pt-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 h-12 text-[15px] font-bold text-slate-500 hover:text-foreground hover:bg-slate-100 rounded-2xl transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className={cn(
                    'flex-[1.5] flex items-center justify-center gap-2 h-12 rounded-2xl bg-foreground px-6 text-[15px] font-bold text-white',
                    'hover:bg-foreground/90 transition-all disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.98]',
                    'shadow-[0_8px_20px_-4px_rgba(0,0,0,0.2)] hover:shadow-[0_12px_24px_-4px_rgba(0,0,0,0.3)]'
                  )}
                >
                  {loading ? (
                    <><Loader2 size={18} className="animate-spin" /> Aguarde...</>
                  ) : (
                    <>{confirmLabel} <ArrowRight size={18} className="ml-1 opacity-70" /></>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

