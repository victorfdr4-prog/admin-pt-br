import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp } from 'lucide-react';
import { VARIANTS } from '@/lib/motion';
import { cn } from '@/lib/utils';

interface StatItemProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
  trend?: 'up' | 'down' | 'neutral';
}

interface ClientSummaryStripProps {
  stats: StatItemProps[];
  className?: string;
}

const VARIANT_CONFIG = {
  default: { bg: 'bg-slate-50', text: 'text-slate-700', icon: 'text-slate-600' },
  success: { bg: 'bg-emerald-50', text: 'text-emerald-700', icon: 'text-emerald-600' },
  warning: { bg: 'bg-amber-50', text: 'text-amber-700', icon: 'text-amber-600' },
  error: { bg: 'bg-rose-50', text: 'text-rose-700', icon: 'text-rose-600' },
  info: { bg: 'bg-blue-50', text: 'text-blue-700', icon: 'text-blue-600' },
} as const;

const StatItem: React.FC<StatItemProps> = ({
  icon,
  label,
  value,
  variant = 'default',
  trend,
}) => {
  const cfg = VARIANT_CONFIG[variant];

  return (
    <motion.div
      variants={VARIANTS.slideInRight}
      className={cn(
        'flex items-center gap-3 rounded-lg border border-border p-3',
        cfg.bg
      )}
    >
      <div className={cn('flex h-9 w-9 items-center justify-center rounded-full bg-white/80', cfg.icon)}>
        {icon}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </p>

        <div className="mt-0.5 flex items-center gap-1.5">
          <p className={cn('text-lg font-bold', cfg.text)}>{value}</p>

          {trend === 'up' && <TrendingUp size={14} className="text-emerald-600" />}
          {trend === 'down' && <TrendingUp size={14} className="rotate-180 text-rose-600" />}
        </div>
      </div>
    </motion.div>
  );
};

export const ClientSummaryStrip: React.FC<ClientSummaryStripProps> = ({
  stats,
  className,
}) => {
  return (
    <div className={cn('grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6', className)}>
      {stats.map((stat, index) => (
        <motion.div
          key={`${stat.label}-${index}`}
          custom={index}
          variants={{
            hidden: { opacity: 0, y: 10 },
            visible: {
              opacity: 1,
              y: 0,
              transition: { delay: index * 0.05 },
            },
          }}
          initial="hidden"
          animate="visible"
        >
          <StatItem {...stat} />
        </motion.div>
      ))}
    </div>
  );
};