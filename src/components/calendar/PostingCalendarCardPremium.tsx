import React from 'react';
import { motion } from 'framer-motion';
import { Calendar, ArrowRight, Zap, Lock, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PostingCalendarCardPremiumProps {
  title: string;
  description: string;
  monthsIncluded: number;
  postsLimit: number;
  featuresHighlight: string[];
  isCurrentPlan?: boolean;
  onSelect?: () => void;
  className?: string;
}

export const PostingCalendarCardPremium: React.FC<PostingCalendarCardPremiumProps> = ({
  title,
  description,
  monthsIncluded,
  postsLimit,
  featuresHighlight,
  isCurrentPlan = false,
  onSelect,
  className,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ y: -4 }}
      className={cn(
        'relative rounded-2xl border-2 overflow-hidden transition-all',
        isCurrentPlan
          ? 'border-primary bg-gradient-to-br from-primary/5 to-transparent'
          : 'border-border bg-white hover:border-primary/50',
        className
      )}
    >
      {/* Current badge */}
      {isCurrentPlan && (
        <div className="absolute top-4 right-4 inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-primary/10 text-primary">
          <CheckCircle2 size={14} />
          <span className="text-xs font-medium">Atual</span>
        </div>
      )}

      {/* Operation badge */}
      <div className="absolute top-4 left-4 inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-100 text-amber-700">
        <Zap size={14} />
        <span className="text-xs font-bold">Operação</span>
      </div>

      <div className="p-6 pt-12">
        {/* Header */}
        <div className="mb-6">
          <h3 className="text-xl font-bold text-foreground">{title}</h3>
          <p className="text-sm text-muted-foreground mt-2">{description}</p>
        </div>

        {/* Key metrics */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="rounded-lg p-3 bg-slate-50 border border-border/50"
          >
            <p className="text-xs text-muted-foreground font-medium">Ciclo</p>
            <p className="text-2xl font-bold text-foreground mt-1">
              {monthsIncluded}m
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="rounded-lg p-3 bg-emerald-50 border border-emerald-200"
          >
            <p className="text-xs text-emerald-700 font-medium">Volume</p>
            <p className="text-2xl font-bold text-emerald-700 mt-1">
              {postsLimit}
            </p>
          </motion.div>
        </div>

        {/* Features highlight */}
        <div className="space-y-2 mb-6">
          <p className="text-xs font-semibold text-foreground uppercase tracking-wide">
            Destaques
          </p>
          {featuresHighlight.map((feature, index) => (
            <motion.div
              key={feature}
              custom={index}
              variants={{
                hidden: { opacity: 0, x: -10 },
                visible: {
                  opacity: 1,
                  x: 0,
                  transition: { delay: 0.3 + index * 0.05 },
                },
              }}
              initial="hidden"
              animate="visible"
              className="flex items-start gap-2"
            >
              <span className="text-primary font-bold text-lg flex-shrink-0">✓</span>
              <span className="text-sm text-foreground">{feature}</span>
            </motion.div>
          ))}
        </div>

        {/* CTA Button */}
        {!isCurrentPlan && onSelect && (
          <motion.button
            type="button"
            onClick={onSelect}
            whileHover={{ x: 4 }}
            whileTap={{ scale: 0.98 }}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm transition-colors hover:bg-primary/90"
          >
            Aplicar estrutura
            <ArrowRight size={14} />
          </motion.button>
        )}

        {isCurrentPlan && (
          <div className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary/10 text-primary font-medium text-sm border border-primary/20">
            <Lock size={14} />
            Estrutura em uso
          </div>
        )}
      </div>
    </motion.div>
  );
};
