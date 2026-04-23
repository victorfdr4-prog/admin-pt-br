import React from 'react';
import { motion } from 'framer-motion';
import { Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CalendarEmptyStateProps {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export const CalendarEmptyState: React.FC<CalendarEmptyStateProps> = ({
  title = 'Nenhum conteúdo agendado',
  description = 'Comece criando seu primeiro post ou campanha para ver aqui',
  icon,
  action,
  className,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        'flex h-full flex-col items-center justify-center rounded-2xl border border-border bg-muted/30 p-8 text-center',
        className
      )}
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-border/50 text-muted-foreground mb-4">
        {icon || <Calendar size={32} />}
      </div>

      <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-xs mb-6">{description}</p>

      {action && (
        <motion.button
          type="button"
          onClick={action.onClick}
          whileHover={{ y: -2 }}
          whileTap={{ y: 0 }}
          className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium text-sm transition-colors hover:bg-primary/90"
        >
          {action.label}
        </motion.button>
      )}
    </motion.div>
  );
};
