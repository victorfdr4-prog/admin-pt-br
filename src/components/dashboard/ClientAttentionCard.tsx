import { AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { VARIANTS } from '@/lib/motion';
import { HealthBadge } from '../ui/HealthBadge';

interface ClientAttentionCardProps {
  clientName: string;
  healthScore: number;
  issueCount: number;
  nextAction: string;
  daysWithoutActivity: number;
  onClick: () => void;
}

export function ClientAttentionCard({
  clientName,
  healthScore,
  issueCount,
  nextAction,
  daysWithoutActivity,
  onClick,
}: ClientAttentionCardProps) {
  return (
    <motion.button
      variants={VARIANTS.cardHover}
      whileHover="hover"
      onClick={onClick}
      className="w-full text-left rounded-lg border border-border bg-card p-4 transition-all hover:border-primary/50 hover:shadow-md"
    >
      <div className="space-y-3">
        <div className="flex items-start justify-between">
          <h3 className="font-semibold text-text-primary">{clientName}</h3>
          <HealthBadge
            score={healthScore}
            size="sm"
            showScore={false}
          />
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded bg-card/50 px-2 py-1.5">
            <p className="text-text-tertiary">Problemas</p>
            <p className="font-semibold text-text-primary">{issueCount}</p>
          </div>
          <div className="rounded bg-card/50 px-2 py-1.5">
            <p className="text-text-tertiary">Sem atividade</p>
            <p className="font-semibold text-text-primary">{daysWithoutActivity}d</p>
          </div>
        </div>

        <div className="flex items-start gap-2 rounded-md bg-amber-50/50 px-2.5 py-2 text-xs">
          <AlertCircle size={14} className="flex-shrink-0 mt-0.5 text-amber-600" />
          <p className="text-amber-900">{nextAction}</p>
        </div>
      </div>
    </motion.button>
  );
}
