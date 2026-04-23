import React from 'react';
import { motion } from 'framer-motion';
import { Calendar, ArrowRight, Zap } from 'lucide-react';
import { VARIANTS } from '@/lib/motion';
import { cn } from '@/lib/utils';

interface PipelineItem {
  id: string;
  title: string;
  dueDate: string;
  status: 'draft' | 'scheduled' | 'published' | 'failed';
  platform?: 'instagram' | 'facebook' | 'linkedin' | 'twitter';
  onClick?: () => void;
}

interface ClientContentPipelineProps {
  items: PipelineItem[];
  viewCalendarHref?: string;
  onViewCalendar?: () => void;
  isEmpty?: boolean;
  emptyMessage?: string;
  className?: string;
}

const StatusConfig = {
  draft: { bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200', label: 'Rascunho' },
  scheduled: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', label: 'Agendado' },
  published: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', label: 'Publicado' },
  failed: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', label: 'Falhou' },
};

const PlatformColor: Record<string, string> = {
  instagram: 'bg-pink-100 text-pink-700',
  facebook: 'bg-blue-100 text-blue-700',
  linkedin: 'bg-sky-100 text-sky-700',
  twitter: 'bg-cyan-100 text-cyan-700',
};

export const ClientContentPipeline: React.FC<ClientContentPipelineProps> = ({
  items,
  viewCalendarHref,
  onViewCalendar,
  isEmpty = false,
  emptyMessage = 'Nenhum conteúdo no fluxo',
  className,
}) => {
  const draftCount = items.filter((i) => i.status === 'draft').length;
  const scheduledCount = items.filter((i) => i.status === 'scheduled').length;
  const publishedCount = items.filter((i) => i.status === 'published').length;

  const upcomingItems = items
    .filter((i) => i.status === 'draft' || i.status === 'scheduled')
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
    .slice(0, 4);

  return (
    <motion.div
      variants={VARIANTS.slideInUp}
      initial="hidden"
      animate="visible"
      className={cn('rounded-2xl border border-border bg-white overflow-hidden', className)}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-4 border-b border-border px-6 py-4">
        <div>
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <Zap size={16} className="text-amber-500" />
          Fluxo de conteúdo
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {draftCount} rascunho{draftCount !== 1 ? 's' : ''} • {scheduledCount} agendado{scheduledCount !== 1 ? 's' : ''} • {publishedCount} publicado{publishedCount !== 1 ? 's' : ''}
          </p>
        </div>

        {(viewCalendarHref || onViewCalendar) && (
          <motion.button
            type="button"
            onClick={onViewCalendar}
            whileHover={{ x: 4 }}
            className="flex items-center gap-1 text-sm font-medium text-primary hover:underline flex-shrink-0"
          >
            Ver calendário <ArrowRight size={14} />
          </motion.button>
        )}
      </div>

      {/* Content */}
      {isEmpty || upcomingItems.length === 0 ? (
        <div className="flex h-40 items-center justify-center px-6 py-8">
          <p className="text-sm text-muted-foreground">{emptyMessage}</p>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {upcomingItems.map((item, index) => {
            const cfg = StatusConfig[item.status as keyof typeof StatusConfig];

            return (
              <motion.button
                key={item.id}
                type="button"
                onClick={item.onClick}
                custom={index}
                variants={{
                  hidden: { opacity: 0, y: 10 },
                  visible: {
                    opacity: 1,
                    y: 0,
                    transition: { delay: index * 0.06 },
                  },
                }}
                initial="hidden"
                animate="visible"
                whileHover={{ x: 2 }}
                className="interactive-list-clickable w-full px-6 py-3 text-left transition-colors hover:bg-border/30"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{item.title}</p>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className={cn(
                        'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium',
                        cfg.bg, cfg.text, cfg.border
                      )}>
                        {cfg.label}
                      </span>

                      {item.platform && (
                        <span className={cn(
                          'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                          PlatformColor[item.platform]
                        )}>
                          {item.platform.charAt(0).toUpperCase() + item.platform.slice(1)}
                        </span>
                      )}

                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar size={12} />
                        {new Date(item.dueDate).toLocaleDateString('pt-BR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>

                  <ArrowRight size={14} className="text-muted-foreground flex-shrink-0" />
                </div>
              </motion.button>
            );
          })}
        </div>
      )}

      {/* Footer if more items */}
      {upcomingItems.length < items.length && (
        <div className="border-t border-border px-6 py-3 text-center">
          <p className="text-xs text-muted-foreground">
              +{items.length - upcomingItems.length} item{items.length - upcomingItems.length !== 1 ? 'ns' : ''} no fluxo
          </p>
        </div>
      )}
    </motion.div>
  );
};
