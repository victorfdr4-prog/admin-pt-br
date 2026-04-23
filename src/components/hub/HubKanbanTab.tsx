// src/components/hub/HubKanbanTab.tsx
import React from 'react';
import { HubPost, WorkflowStatus } from '@/services/hub.service';
import { useUpdateWorkflowStatus } from '@/hooks/useHubData';
import { STATUS_META } from './HubPostCard';
import { getTodayLocal, formatPostDate } from '@/utils/localDate';
import { cn } from '@/utils/cn';
import { Lightbulb, Pencil, CheckSquare, ArrowRight, Calendar } from 'lucide-react';

interface Props {
  posts: HubPost[];
  clientId: string;
  year: number;
  month: number;
}

// Map from current status → { next, label }
const NEXT_ACTION: Partial<Record<WorkflowStatus, { next: WorkflowStatus; label: string }>> = {
  rascunho:             { next: 'revisao_interna',      label: 'Enviar p/ revisão' },
  revisao_interna:      { next: 'aprovado_interno',     label: 'Aprovar' },
  aprovado_interno:     { next: 'em_aprovacao_cliente', label: 'Enviar p/ cliente' },
  revisao_cliente:      { next: 'revisao_interna',      label: 'Retomar ajustes' },
  aprovado_cliente:     { next: 'aguardando_agendamento', label: 'Liberar agendamento' },
};

const COLUMNS = [
  {
    key: 'ideias' as const,
    label: 'Ideia / Rascunho',
    statuses: ['rascunho'] as WorkflowStatus[],
    icon: Lightbulb,
    headerClass: 'text-slate-600 bg-slate-50 border-slate-200 dark:text-slate-300 dark:bg-slate-800/50 dark:border-slate-700',
    bodyClass: 'bg-slate-50/30 dark:bg-slate-800/20',
  },
  {
    key: 'producao' as const,
    label: 'Em Produção',
    statuses: ['revisao_interna', 'aprovado_interno'] as WorkflowStatus[],
    icon: Pencil,
    headerClass: 'text-violet-700 bg-violet-50 border-violet-200 dark:text-violet-300 dark:bg-violet-900/20 dark:border-violet-800/30',
    bodyClass: 'bg-violet-50/20 dark:bg-violet-900/10',
  },
  {
    key: 'cliente' as const,
    label: 'Cliente',
    statuses: ['em_aprovacao_cliente', 'revisao_cliente'] as WorkflowStatus[],
    icon: CheckSquare,
    headerClass: 'text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-300 dark:bg-amber-900/20 dark:border-amber-800/30',
    bodyClass: 'bg-amber-50/20 dark:bg-amber-900/10',
  },
  {
    key: 'agenda' as const,
    label: 'Agenda',
    statuses: ['aprovado_cliente', 'aguardando_agendamento', 'agendado'] as WorkflowStatus[],
    icon: Calendar,
    headerClass: 'text-sky-700 bg-sky-50 border-sky-200 dark:text-sky-300 dark:bg-sky-900/20 dark:border-sky-800/30',
    bodyClass: 'bg-sky-50/20 dark:bg-sky-900/10',
  },
];

function KanbanCard({ post, clientId, year, month }: { post: HubPost; clientId: string; year: number; month: number }) {
  const updateStatus = useUpdateWorkflowStatus();
  const today = getTodayLocal();
  const isOverdue = post.post_date < today && post.workflow_status !== 'publicado';
  const meta = STATUS_META[post.workflow_status];
  const nextAction = NEXT_ACTION[post.workflow_status];
  const scheduleLabel = post.scheduled_date
    ? new Date(post.scheduled_date).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <div className={cn(
      'rounded-2xl border bg-white dark:bg-slate-900 shadow-sm p-4 space-y-3 transition-all',
      isOverdue ? 'border-l-[3px] border-l-rose-400 border-rose-100 dark:border-rose-900/40' : 'border-slate-100 dark:border-slate-800',
    )}>
      <div>
        <p className="text-sm font-bold text-slate-800 dark:text-slate-100 line-clamp-2 leading-snug">
          {post.title ?? 'Sem título'}
        </p>
        <p className="text-[10px] text-slate-400 mt-1">{formatPostDate(post.post_date)}</p>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full', meta.color)}>
          {meta.label}
        </span>
        {post.channel && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400">
            {post.channel}
          </span>
        )}
        {post.post_type && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400">
            {post.post_type}
          </span>
        )}
        {scheduleLabel && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300">
            {scheduleLabel}
          </span>
        )}
      </div>

      {nextAction && (
        <button
          onClick={() => updateStatus.mutate({ postId: post.id, status: nextAction.next, clientId, year, month })}
          disabled={updateStatus.isPending}
          className="flex items-center gap-1.5 text-[11px] font-bold text-primary hover:underline transition-all disabled:opacity-50"
          aria-label={nextAction.label}
        >
          <ArrowRight size={11} aria-hidden="true" />
          {nextAction.label}
        </button>
      )}
    </div>
  );
}

export function HubKanbanTab({ posts, clientId, year, month }: Props) {
  // Only show posts that are in production flow (not scheduled/published)
  const activePosts = posts.filter((p) =>
    ['rascunho','revisao_interna','aprovado_interno','em_aprovacao_cliente','revisao_cliente','aprovado_cliente','aguardando_agendamento','agendado'].includes(p.workflow_status)
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
      {COLUMNS.map((col) => {
        const colPosts = activePosts.filter((p) => col.statuses.includes(p.workflow_status));
        const ColIcon = col.icon;
        return (
          <div key={col.key} className={cn('rounded-[24px] border overflow-hidden', col.bodyClass, 'border-slate-100 dark:border-slate-800')}>
            {/* Column Header */}
            <div className={cn('flex items-center gap-2 px-4 py-3 border-b', col.headerClass)}>
              <ColIcon size={15} aria-hidden="true" />
              <span className="text-sm font-black tracking-tight">{col.label}</span>
              <span className="ml-auto text-[11px] font-black opacity-60">{colPosts.length}</span>
            </div>
            {/* Cards */}
            <div className="p-3 space-y-3 min-h-[200px]">
              {colPosts.length === 0 ? (
                <p className="text-center text-xs text-slate-400 py-8 font-medium">Nenhum post aqui</p>
              ) : (
                colPosts.map((p) => (
                  <KanbanCard key={p.id} post={p} clientId={clientId} year={year} month={month} />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
