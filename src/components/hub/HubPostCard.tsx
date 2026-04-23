// src/components/hub/HubPostCard.tsx
import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { HubPost, WorkflowStatus } from '@/services/hub.service';
import { cn } from '@/utils/cn';
import { AlertCircle } from 'lucide-react';

export const STATUS_META: Record<WorkflowStatus, { label: string; color: string; dot: string }> = {
  rascunho:               { label: 'Rascunho',           color: 'bg-slate-100 text-slate-500',   dot: 'bg-slate-400' },
  revisao_interna:        { label: 'Revisão interna',    color: 'bg-violet-100 text-violet-700', dot: 'bg-violet-400' },
  aprovado_interno:       { label: 'Aprovado interno',   color: 'bg-blue-100 text-blue-700',     dot: 'bg-blue-400' },
  em_aprovacao_cliente:   { label: 'Aguard. cliente',    color: 'bg-amber-100 text-amber-700',   dot: 'bg-amber-400' },
  revisao_cliente:        { label: 'Revisão cliente',    color: 'bg-orange-100 text-orange-700', dot: 'bg-orange-400' },
  aprovado_cliente:       { label: 'Aprovado cliente',   color: 'bg-teal-100 text-teal-700',     dot: 'bg-teal-500' },
  aguardando_agendamento: { label: 'Aguard. agendamento',color: 'bg-sky-100 text-sky-700',       dot: 'bg-sky-400' },
  agendado:               { label: 'Agendado',           color: 'bg-indigo-100 text-indigo-700', dot: 'bg-indigo-500' },
  publicado:              { label: 'Publicado',          color: 'bg-green-100 text-green-700',   dot: 'bg-green-500' },
};

interface Props {
  post: HubPost;
  onClick: (post: HubPost) => void;
  isOverdue?: boolean;
}

export const HubPostCard: React.FC<Props> = ({ post, onClick, isOverdue }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: post.id,
    data: { post },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const meta = STATUS_META[post.workflow_status];

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onClick(post)}
      role="button"
      tabIndex={0}
      aria-label={`Post: ${post.title ?? 'Sem título'} — ${meta.label}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick(post);
        }
      }}
      className={cn(
        'group cursor-grab active:cursor-grabbing rounded-xl border bg-white px-3 py-2 text-left transition-all hover:shadow-md dark:bg-slate-800',
        isOverdue ? 'border-rose-200 bg-rose-50/50 dark:bg-rose-950/20' : 'border-slate-100 dark:border-slate-700',
      )}
    >
      <div className="flex items-start gap-2">
        <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', meta.dot)} aria-hidden="true" />
        <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 line-clamp-2 leading-tight">
          {post.title ?? 'Sem título'}
        </p>
      </div>

      <div className="mt-2 flex items-center gap-1.5 flex-wrap">
        {post.channel && (
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-50 dark:bg-slate-700 px-1.5 py-0.5 rounded-md">
            {post.channel}
          </span>
        )}
        <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-md', meta.color)}>
          {meta.label}
        </span>
        {isOverdue && (
          <AlertCircle size={10} className="text-rose-500" aria-hidden="true" />
        )}
      </div>
    </div>
  );
};
