import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, AlertCircle, CheckCircle2 } from 'lucide-react';
import { VARIANTS } from '@/lib/motion';
import { cn } from '@/lib/utils';

interface HealthFactor {
  label: string;
  value: number; // 0-100
  description?: string;
  color?: 'success' | 'warning' | 'error';
}

interface ClientHealthPanelProps {
  score: number;
  status?: 'healthy' | 'attention' | 'critical';
  factors?: HealthFactor[];
  trendChange?: number; // percentage change from last period
  className?: string;
}

export const ClientHealthPanel: React.FC<ClientHealthPanelProps> = ({
  score,
  status = score >= 75 ? 'healthy' : score >= 50 ? 'attention' : 'critical',
  factors = [],
  trendChange,
  className,
}) => {
  const scoreColor = status === 'healthy' ? 'text-emerald-600' : status === 'attention' ? 'text-amber-600' : 'text-rose-600';
  const scoreBg = status === 'healthy' ? 'bg-emerald-50' : status === 'attention' ? 'bg-amber-50' : 'bg-rose-50';
  const scoreBorder = status === 'healthy' ? 'border-emerald-200' : status === 'attention' ? 'border-amber-200' : 'border-rose-200';

  const getFactorColor = (value: number) => {
    if (value >= 75) return { bg: 'bg-emerald-50', bar: 'bg-emerald-500', text: 'text-emerald-700' };
    if (value >= 50) return { bg: 'bg-amber-50', bar: 'bg-amber-500', text: 'text-amber-700' };
    return { bg: 'bg-rose-50', bar: 'bg-rose-500', text: 'text-rose-700' };
  };

  return (
    <motion.div
      variants={VARIANTS.slideInUp}
      initial="hidden"
      animate="visible"
      className={cn(
        'rounded-2xl border p-6 space-y-6',
        scoreBorder,
        scoreBg,
        className
      )}
    >
      {/* Main Score */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Saúde geral</p>
          <div className="flex items-baseline gap-2">
            <span className={cn('text-4xl font-bold', scoreColor)}>{score}</span>
            <span className="text-sm text-muted-foreground">/100</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {status === 'healthy' && 'Tudo funcionando bem'}
            {status === 'attention' && 'Requer atenção'}
            {status === 'critical' && 'Situação crítica'}
          </p>
        </div>

        {trendChange !== undefined && (
          <motion.div
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium',
              trendChange > 0 ? 'bg-emerald-100 text-emerald-700' : trendChange < 0 ? 'bg-rose-100 text-rose-700' : 'bg-gray-100 text-gray-700'
            )}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <TrendingUp size={14} className={trendChange < 0 ? 'rotate-180' : ''} />
            {Math.abs(trendChange)}%
          </motion.div>
        )}
      </div>

      {/* Factors */}
      {factors.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Fatores de saúde</p>
          <div className="space-y-3">
            {factors.map((factor, index) => {
              const colors = getFactorColor(factor.value);
              return (
                <motion.div
                  key={factor.label}
                  custom={index}
                  variants={{
                    hidden: { opacity: 0, x: -10 },
                    visible: {
                      opacity: 1,
                      x: 0,
                      transition: { delay: index * 0.08 },
                    },
                  }}
                  initial="hidden"
                  animate="visible"
                >
                  <div className={cn('rounded-lg border border-border p-3', colors.bg)}>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <p className={cn('text-sm font-medium', colors.text)}>{factor.label}</p>
                      <span className={cn('text-sm font-bold', colors.text)}>{factor.value}%</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-border overflow-hidden">
                      <motion.div
                        className={cn('h-full rounded-full', colors.bar)}
                        initial={{ width: 0 }}
                        animate={{ width: `${factor.value}%` }}
                        transition={{ duration: 0.6, delay: index * 0.08 + 0.2 }}
                      />
                    </div>
                    {factor.description && (
                      <p className="text-xs text-muted-foreground mt-2">{factor.description}</p>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* Status badge */}
      <div className={cn(
        'flex items-center gap-2 rounded-lg border p-3',
        status === 'healthy' ? 'border-emerald-200 bg-white' : status === 'attention' ? 'border-amber-200 bg-white' : 'border-rose-200 bg-white'
      )}>
        {status === 'healthy' && <CheckCircle2 size={16} className="text-emerald-600" />}
        {status === 'attention' && <AlertCircle size={16} className="text-amber-600" />}
        {status === 'critical' && <AlertCircle size={16} className="text-rose-600" />}
        <p className="text-xs font-medium text-muted-foreground">
          {status === 'healthy' && 'Status: Saudável'}
          {status === 'attention' && 'Status: Requer atenção'}
          {status === 'critical' && 'Status: Crítico'}
        </p>
      </div>
    </motion.div>
  );
};
