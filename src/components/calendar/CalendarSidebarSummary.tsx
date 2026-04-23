import React from 'react';
import { motion } from 'framer-motion';
import { BarChart3, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatItem {
  label: string;
  value: number | string;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
  trend?: number;
  subtitle?: string;
}

interface CalendarSidebarSummaryProps {
  selectedDate: Date;
  stats: StatItem[];
  className?: string;
}

const VariantColors: Record<string, { bg: string; text: string }> = {
  default: { bg: 'bg-slate-50', text: 'text-slate-700' },
  success: { bg: 'bg-emerald-50', text: 'text-emerald-700' },
  warning: { bg: 'bg-amber-50', text: 'text-amber-700' },
  error: { bg: 'bg-rose-50', text: 'text-rose-700' },
  info: { bg: 'bg-blue-50', text: 'text-blue-700' },
};

export const CalendarSidebarSummary: React.FC<CalendarSidebarSummaryProps> = ({
  selectedDate,
  stats,
  className,
}) => {
  const dateStr = selectedDate.toLocaleDateString('pt-BR', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className={cn('rounded-2xl border border-border bg-white p-6', className)}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-6">
        <div>
          <h3 className="font-semibold text-foreground capitalize">{dateStr}</h3>
          <p className="text-xs text-muted-foreground mt-1">
            {selectedDate.toLocaleDateString('pt-BR')}
          </p>
        </div>
        <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
          <BarChart3 size={16} />
        </div>
      </div>

      {/* Stats grid */}
      <div className="space-y-3">
        {stats.map((stat, index) => {
          const variant = stat.variant || 'default';
          const colors = VariantColors[variant];

          return (
            <motion.div
              key={`${stat.label}-${index}`}
              custom={index}
              variants={{
                hidden: { opacity: 0, y: -10 },
                visible: {
                  opacity: 1,
                  y: 0,
                  transition: { delay: index * 0.05 },
                },
              }}
              initial="hidden"
              animate="visible"
              className={cn(
                'rounded-lg p-3 border border-border/50',
                colors.bg
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className={cn('text-xs font-medium', colors.text)}>
                    {stat.label}
                  </p>
                  <p className={cn('text-xl font-bold mt-1', colors.text)}>
                    {stat.value}
                  </p>
                  {stat.subtitle && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {stat.subtitle}
                    </p>
                  )}
                </div>

                {stat.trend !== undefined && stat.trend !== 0 && (
                  <div className={cn(
                    'flex items-center gap-0.5 px-1.5 py-1 rounded text-xs font-medium flex-shrink-0',
                    stat.trend > 0 ? 'text-emerald-700 bg-emerald-50' : 'text-rose-700 bg-rose-50'
                  )}>
                    <TrendingUp size={12} className={stat.trend < 0 ? 'rotate-180' : ''} />
                    {Math.abs(stat.trend)}%
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
};
