import React from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Calendar, Filter } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CalendarToolbarProps {
  currentDate: Date;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
  onToday: () => void;
  viewMode?: 'week' | 'month';
  onViewModeChange?: (mode: 'week' | 'month') => void;
  clientFilter?: string;
  onClientFilterChange?: (clientId: string) => void;
  clients?: Array<{ id: string; name: string }>;
  className?: string;
}

export const CalendarToolbar: React.FC<CalendarToolbarProps> = ({
  currentDate,
  onPreviousMonth,
  onNextMonth,
  onToday,
  viewMode = 'month',
  onViewModeChange,
  clientFilter,
  onClientFilterChange,
  clients = [],
  className,
}) => {
  const monthYear = currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-white p-6',
        className
      )}
    >
      {/* Left: Navigation */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onPreviousMonth}
          className="flex items-center justify-center p-2 text-muted-foreground hover:bg-border rounded-lg transition-colors"
        >
          <ChevronLeft size={18} />
        </button>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-muted/30">
          <Calendar size={16} className="text-primary" />
          <span className="text-sm font-semibold text-foreground capitalize">{monthYear}</span>
        </div>

        <button
          type="button"
          onClick={onNextMonth}
          className="flex items-center justify-center p-2 text-muted-foreground hover:bg-border rounded-lg transition-colors"
        >
          <ChevronRight size={18} />
        </button>

        <div className="w-px h-6 bg-border mx-1" />

        <button
          type="button"
          onClick={onToday}
          className="px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/10 rounded-lg transition-colors"
        >
          Hoje
        </button>
      </div>

      {/* Right: Filters and view mode */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* View mode toggle */}
        {onViewModeChange && (
          <div className="flex items-center gap-1 border border-border rounded-lg p-1">
            <button
              type="button"
              onClick={() => onViewModeChange('week')}
              className={cn(
                'px-3 py-1.5 text-sm font-medium rounded transition-colors',
                viewMode === 'week'
                  ? 'bg-primary text-white'
                  : 'text-foreground hover:bg-border'
              )}
            >
              Semana
            </button>
            <button
              type="button"
              onClick={() => onViewModeChange('month')}
              className={cn(
                'px-3 py-1.5 text-sm font-medium rounded transition-colors',
                viewMode === 'month'
                  ? 'bg-primary text-white'
                  : 'text-foreground hover:bg-border'
              )}
            >
              Mês
            </button>
          </div>
        )}

        {/* Client filter */}
        {onClientFilterChange && clients.length > 0 && (
          <select
            value={clientFilter || ''}
            onChange={(e) => onClientFilterChange(e.target.value)}
            className={cn(
              'px-3 py-1.5 text-sm font-medium rounded-lg border border-border bg-white text-foreground',
              'hover:bg-muted/30 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent',
              'transition-colors'
            )}
          >
            <option value="">Todos os clientes</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
        )}

        {/* View all button */}
        <button
          type="button"
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-border rounded-lg transition-colors"
        >
          <Filter size={16} />
          Filtros
        </button>
      </div>
    </motion.div>
  );
};
