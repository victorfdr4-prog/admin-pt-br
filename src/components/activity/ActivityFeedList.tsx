import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, ChevronDown, ChevronRight, Clock3, Eye, Flame, Heart, Link2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  ActivityFeedGroup,
  ActivityFeedItem,
  FeedActionType,
  formatActivityFeedTime,
  getActivityInitials,
} from '@/lib/activity-feed';

const ACTION_THEME: Record<
  FeedActionType,
  { pill: string; dot: string; icon: typeof CheckCircle2; text: string; accent: string }
> = {
  create: {
    pill: 'bg-emerald-50 text-emerald-700',
    dot: 'bg-emerald-500',
    icon: CheckCircle2,
    text: 'Criado',
    accent: 'group-hover:border-emerald-200',
  },
  edit: {
    pill: 'bg-amber-50 text-amber-700',
    dot: 'bg-amber-500',
    icon: Clock3,
    text: 'Atualizado',
    accent: 'group-hover:border-amber-200',
  },
  approve: {
    pill: 'bg-blue-50 text-blue-700',
    dot: 'bg-blue-500',
    icon: Eye,
    text: 'Aprovado',
    accent: 'group-hover:border-blue-200',
  },
  error: {
    pill: 'bg-rose-50 text-rose-700',
    dot: 'bg-rose-500',
    icon: Flame,
    text: 'Urgente',
    accent: 'group-hover:border-rose-200',
  },
};

interface ActivityFeedListProps {
  groups: ActivityFeedGroup[];
  compact?: boolean;
  emptyMessage?: string;
  className?: string;
}

const FeedSubItem = React.memo(function FeedSubItem({
  item,
  compact,
  onOpen,
}: {
  item: ActivityFeedItem;
  compact: boolean;
  onOpen: (href: string | null) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(item.href)}
      className={cn(
        'flex w-full items-start justify-between gap-3 rounded-2xl border border-[#edf1f6] bg-white px-4 text-left transition duration-200 hover:scale-[1.01] hover:bg-[#fafafa]',
        compact ? 'py-2.5' : 'py-3'
      )}
    >
      <div className="min-w-0">
        <p className="truncate text-[13px] font-medium text-[#111827]">{item.entityLabel}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-[#667085]">
          {item.clientLabel ? <span>{item.clientLabel}</span> : null}
          {item.metaLabel ? <span>{item.metaLabel}</span> : null}
        </div>
      </div>
      <span className="shrink-0 text-[11px] text-[#98a2b3]">{formatActivityFeedTime(item.createdAt)}</span>
    </button>
  );
});

export const ActivityFeedList: React.FC<ActivityFeedListProps> = ({
  groups,
  compact = false,
  emptyMessage = 'Nenhuma atividade recente',
  className,
}) => {
  const navigate = useNavigate();
  const [expanded, setExpanded] = React.useState<Record<string, boolean>>({});

  const openItem = React.useCallback(
    (href: string | null) => {
      if (!href) return;
      navigate(href);
    },
    [navigate]
  );

  if (!groups.length) {
    return <div className={cn('py-10 text-center text-sm text-[#98a2b3]', className)}>{emptyMessage}</div>;
  }

  return (
    <div className={cn('space-y-2.5', className)}>
      {groups.map((group, index) => {
        const theme = ACTION_THEME[group.actionType];
        const Icon = theme.icon;
        const isExpanded = !!expanded[group.id];
        const leadItem = group.items[0];

        return (
          <motion.div
            key={group.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, delay: index * 0.02, ease: 'easeOut' }}
            className={cn(
              'group rounded-[24px] border border-[#edf1f6] bg-white transition duration-200 hover:scale-[1.01] hover:bg-[#fafafa]',
              theme.accent
            )}
          >
            <div className={cn('flex items-start gap-3 px-4', compact ? 'py-3' : 'py-3.5')}>
              {group.actorAvatar ? (
                <img src={group.actorAvatar} alt={group.actorName} className="mt-0.5 h-10 w-10 rounded-full object-cover" />
              ) : (
                <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-full bg-[#f4f6fb] text-[12px] font-semibold text-[#344054]">
                  {getActivityInitials(group.actorName)}
                </div>
              )}

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-[13px] text-[#111827]">
                    <span className="font-semibold">{group.actorName}</span> {group.actionLabel}
                  </p>
                  <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold', theme.pill)}>
                    <Icon className="mr-1 h-3 w-3" />
                    {theme.text}
                  </span>
                </div>

                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-[#667085]">
                  {group.clientLabel ? <span>Cliente: {group.clientLabel}</span> : null}
                  <span>{leadItem.entityLabel}</span>
                  {leadItem.metaLabel ? <span>{leadItem.metaLabel}</span> : null}
                  {group.items.length > 1 ? <span>{group.items.length} ações agrupadas</span> : null}
                </div>

                <div className="mt-2 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-[#98a2b3]">
                    <span className="text-[11px]">{formatActivityFeedTime(group.createdAt)}</span>
                    <button type="button" className="rounded-full p-1.5 transition hover:bg-[#fff1f2] hover:text-[#e11d48]">
                      <Heart className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" className="rounded-full p-1.5 transition hover:bg-[#eff6ff] hover:text-[#2563eb]">
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    {group.items.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => setExpanded((current) => ({ ...current, [group.id]: !current[group.id] }))}
                        className="inline-flex items-center gap-1 rounded-full border border-[#e8edf3] px-2.5 py-1 text-[11px] font-medium text-[#667085] transition hover:bg-white"
                      >
                        {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                        {isExpanded ? 'Recolher' : 'Expandir'}
                      </button>
                    ) : null}

                    <button
                      type="button"
                      onClick={() => openItem(group.href)}
                      className="inline-flex items-center gap-1 rounded-full border border-[#e8edf3] px-2.5 py-1 text-[11px] font-medium text-[#344054] transition hover:bg-white"
                    >
                      <Link2 className="h-3 w-3" />
                      Abrir
                    </button>
                  </div>
                </div>
              </div>

              <span className={cn('mt-2 h-2.5 w-2.5 shrink-0 rounded-full', theme.dot)} />
            </div>

            <AnimatePresence>
              {isExpanded && group.items.length > 1 ? (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.18, ease: 'easeOut' }}
                  className="overflow-hidden border-t border-[#edf1f6] px-4 pb-4 pt-3"
                >
                  <div className="space-y-2.5">
                    {group.items.map((item) => (
                      <FeedSubItem key={item.id} item={item} compact={compact} onOpen={openItem} />
                    ))}
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </motion.div>
        );
      })}
    </div>
  );
};

export default ActivityFeedList;
