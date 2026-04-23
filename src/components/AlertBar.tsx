import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Info, TriangleAlert, X } from 'lucide-react';
import { useSystemStore, SystemAlert } from '@/store/useSystemStore';

const TONE_PRIORITY: Record<SystemAlert['tone'], number> = {
  red: 0,
  amber: 1,
  blue: 2,
  green: 3,
};

const TONE_META: Record<
  SystemAlert['tone'],
  {
    container: string;
    icon: React.ReactNode;
    badge: string;
  }
> = {
  red: {
    container: 'border-red-200 bg-red-50 text-red-700',
    icon: <AlertCircle size={18} />,
    badge: 'Incidente',
  },
  amber: {
    container: 'border-amber-200 bg-amber-50 text-amber-700',
    icon: <TriangleAlert size={18} />,
    badge: 'Atenção',
  },
  blue: {
    container: 'border-blue-200 bg-blue-50 text-blue-700',
    icon: <Info size={18} />,
    badge: 'Aviso',
  },
  green: {
    container: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    icon: <CheckCircle2 size={18} />,
    badge: 'Normalizado',
  },
};

export const AlertBar: React.FC = () => {
  const alerts = useSystemStore((state) => state.alerts || []);
  const dismiss = useSystemStore((state) => state.dismissAlert);
  const navigate = useNavigate();

  const primary = React.useMemo(() => {
    if (!alerts.length) return null;
    return [...alerts].sort((a, b) => {
      const toneDiff = TONE_PRIORITY[a.tone] - TONE_PRIORITY[b.tone];
      if (toneDiff !== 0) return toneDiff;
      return (b.createdAt || 0) - (a.createdAt || 0);
    })[0];
  }, [alerts]);

  if (!primary) return null;

  const meta = TONE_META[primary.tone];

  const handleNavigate = () => {
    if (primary.route) navigate(primary.route);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.22 }}
      className={`border-b ${meta.container}`}
    >
      <div
        className="mx-auto flex max-w-[1600px] cursor-pointer items-center justify-between gap-4 px-4 py-2.5 sm:px-6 lg:px-8"
        onClick={handleNavigate}
        role="button"
        tabIndex={0}
      >
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/75">
            {meta.icon}
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-white/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]">
                {meta.badge}
              </span>
              <span className="truncate text-sm font-semibold">{primary.text}</span>
            </div>
            {primary.route ? (
              <p className="mt-1 text-xs opacity-80">Clique para abrir a área relacionada.</p>
            ) : null}
          </div>
        </div>

        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            dismiss(primary.id);
          }}
          className="rounded-lg p-2 transition-colors hover:bg-white/80"
          aria-label="Fechar alerta"
        >
          <X size={16} />
        </button>
      </div>
    </motion.div>
  );
};

export default AlertBar;
