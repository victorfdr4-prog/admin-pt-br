import { AlertTriangle } from 'lucide-react';
import { motion } from 'framer-motion';
import { VARIANTS } from '@/lib/motion';

interface AlertRiskRowProps {
  clientName: string;
  issue: string;
  severity: 'high' | 'medium';
  actionLabel: string;
  onAction: () => void;
}

const severityConfig = {
  high: 'border-l-4 border-red-500 bg-red-50/50',
  medium: 'border-l-4 border-amber-500 bg-amber-50/50',
};

export function AlertRiskRow({
  clientName,
  issue,
  severity,
  actionLabel,
  onAction,
}: AlertRiskRowProps) {
  return (
    <motion.div
      variants={VARIANTS.slideInUp}
      className={`flex items-start justify-between gap-4 rounded-lg border border-border p-4 ${severityConfig[severity]}`}
    >
      <div className="flex gap-3">
        <AlertTriangle
          size={20}
          className={severity === 'high' ? 'text-red-600' : 'text-amber-600'}
        />
        <div>
          <p className="font-medium text-text-primary">{clientName}</p>
          <p className="text-sm text-text-secondary">{issue}</p>
        </div>
      </div>
      <button
        onClick={onAction}
        className="flex-shrink-0 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary/90 transition-colors"
      >
        {actionLabel}
      </button>
    </motion.div>
  );
}
