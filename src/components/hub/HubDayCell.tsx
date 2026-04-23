// src/components/hub/HubDayCell.tsx
import React, { useMemo } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { HubPost } from '@/services/hub.service';
import type { HubFilter } from '@/hooks/useHubFilters';
import { HubPostCard } from './HubPostCard';
import { cn } from '@/utils/cn';
import { getTodayLocal } from '@/utils/localDate';
import { Plus } from 'lucide-react';

interface Props {
  date: string; // 'YYYY-MM-DD'
  dayNumber: number;
  isToday: boolean;
  isCurrentMonth: boolean;
  posts: HubPost[];
  onPostClick: (post: HubPost) => void;
  onAddPost?: (date: string) => void;
  activeFilter: HubFilter;
}

export const HubDayCell: React.FC<Props> = ({
  date, dayNumber, isToday, isCurrentMonth, posts, onPostClick, onAddPost, activeFilter,
}) => {
  const { setNodeRef, isOver } = useDroppable({ id: `day-${date}`, data: { date } });
  const today = useMemo(() => getTodayLocal(), []);

  const filteredPosts = posts.filter((p) => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'atrasados') return p.post_date < today && p.workflow_status !== 'publicado';
    if (activeFilter === 'hoje') return p.post_date === today;
    if (activeFilter === 'aguardando_cliente') return ['em_aprovacao_cliente', 'revisao_cliente'].includes(p.workflow_status);
    if (activeFilter === 'sem_agendamento') return ['aprovado_cliente', 'aguardando_agendamento'].includes(p.workflow_status) && !p.scheduled_date;
    return true;
  });

  return (
    <div
      ref={setNodeRef}
      aria-label={`Dia ${dayNumber}`}
      className={cn(
        'group min-h-[92px] rounded-xl border p-1.5 transition-all',
        !isOver && (isCurrentMonth ? 'bg-white dark:bg-slate-900' : 'bg-slate-50/50 dark:bg-slate-800/30'),
        isToday && !isOver && 'border-primary ring-1 ring-primary/20',
        !isToday && !isOver && 'border-slate-100 dark:border-slate-800',
        isOver && 'border-primary/50 bg-primary/5',
      )}
    >
      <div className="mb-1 flex items-center justify-between">
        <span className={cn(
          'text-xs font-bold',
          isToday
            ? 'flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white'
            : isCurrentMonth ? 'text-slate-700 dark:text-slate-300' : 'text-slate-300 dark:text-slate-600',
        )}>
          {dayNumber}
        </span>
        {isCurrentMonth && onAddPost && (
          <button
            onClick={() => onAddPost(date)}
            aria-label={`Adicionar post no dia ${dayNumber}`}
            className="opacity-0 group-hover:opacity-100 h-5 w-5 flex items-center justify-center rounded-full text-slate-400 hover:bg-primary/10 hover:text-primary transition-all"
          >
            <Plus size={12} aria-hidden="true" />
          </button>
        )}
      </div>

      <SortableContext items={filteredPosts.map((p) => p.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-0.5">
          {filteredPosts.map((p) => (
            <HubPostCard
              key={p.id}
              post={p}
              onClick={onPostClick}
              isOverdue={p.post_date < today && p.workflow_status !== 'publicado'}
            />
          ))}
        </div>
      </SortableContext>
    </div>
  );
};
