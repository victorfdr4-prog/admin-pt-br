import React, { type ElementType } from 'react';
import { ArrowRight, CheckCircle2, FileCheck, Zap } from 'lucide-react';
import { cn } from '@/utils/cn';
import type { NextAction } from '@/services/health.service';

export interface NextActionCardProps {
  action: NextAction;
  onNavigate?: (action: NextAction) => void;
  className?: string;
}

const PRIORITY_CONFIG = {
  urgent: { bar: 'bg-red-500',    label: 'Urgente',  text: 'text-red-600' },
  high:   { bar: 'bg-orange-400', label: 'Alta',     text: 'text-orange-600' },
  medium: { bar: 'bg-yellow-400', label: 'Média',    text: 'text-yellow-600' },
  low:    { bar: 'bg-blue-400',   label: 'Baixa',    text: 'text-blue-600' },
};

const TYPE_ICON: Record<string, ElementType> = {
  resolve_approval: FileCheck,
  complete_task:    CheckCircle2,
  default:          Zap,
};

export const NextActionCard: React.FC<NextActionCardProps> = ({ action, onNavigate, className }) => {
  const priority = PRIORITY_CONFIG[action.priority] ?? PRIORITY_CONFIG.medium;
  const Icon = TYPE_ICON[action.type] ?? TYPE_ICON.default;

  return (
    <div
      className={cn(
        'relative flex items-start gap-3 rounded-xl border border-border bg-card p-3.5 overflow-hidden',
        onNavigate && 'cursor-pointer hover:border-primary/40 transition-colors',
        className
      )}
      onClick={() => onNavigate?.(action)}
    >
      {/* Barra de prioridade */}
      <div className={cn('absolute left-0 top-0 bottom-0 w-1 rounded-l-xl', priority.bar)} />

      <div className={cn('mt-0.5 shrink-0', priority.text)}>
        <Icon size={16} strokeWidth={2} />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{action.title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{action.description}</p>
        <span className={cn('text-[11px] font-medium mt-1 inline-block', priority.text)}>
          {priority.label}
        </span>
      </div>

      {onNavigate && (
        <ArrowRight size={14} className="text-muted-foreground shrink-0 mt-1" />
      )}
    </div>
  );
}
