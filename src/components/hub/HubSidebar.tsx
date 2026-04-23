// src/components/hub/HubSidebar.tsx
import React from 'react';
import { HubPost } from '@/services/hub.service';
import { useHubFilters, HubFilter } from '@/hooks/useHubFilters';
import { cn } from '@/utils/cn';
import { AlertCircle, Calendar, Clock, CheckCircle2, Zap } from 'lucide-react';
import { getTodayLocal } from '@/utils/localDate';

interface Props {
  posts: HubPost[];
}

export const HubSidebar: React.FC<Props> = ({ posts }) => {
  const { activeFilter, setFilter } = useHubFilters();
  const today = getTodayLocal();

  const counts = {
    atrasados: posts.filter((p) => p.post_date < today && p.workflow_status !== 'publicado').length,
    hoje: posts.filter((p) => p.post_date === today).length,
    aguardando_cliente: posts.filter((p) => ['em_aprovacao_cliente', 'revisao_cliente'].includes(p.workflow_status)).length,
    sem_agendamento: posts.filter((p) => ['aprovado_cliente', 'aguardando_agendamento'].includes(p.workflow_status) && !p.scheduled_date).length,
  };

  const buttons: Array<{ key: HubFilter; label: string; count: number; icon: React.ElementType; activeClass: string; iconClass: string }> = [
    { key: 'all', label: 'Todos', count: posts.length, icon: Zap, activeClass: 'border-slate-300 bg-slate-100 text-slate-700', iconClass: 'text-slate-500' },
    { key: 'atrasados', label: 'Atrasados', count: counts.atrasados, icon: AlertCircle, activeClass: 'border-rose-200 bg-rose-50 text-rose-700', iconClass: 'text-rose-500' },
    { key: 'hoje', label: 'Hoje', count: counts.hoje, icon: Clock, activeClass: 'border-amber-200 bg-amber-50 text-amber-700', iconClass: 'text-amber-500' },
    { key: 'aguardando_cliente', label: 'Cliente / revisão', count: counts.aguardando_cliente, icon: Calendar, activeClass: 'border-violet-200 bg-violet-50 text-violet-700', iconClass: 'text-violet-500' },
    { key: 'sem_agendamento', label: 'Sem agenda', count: counts.sem_agendamento, icon: CheckCircle2, activeClass: 'border-teal-200 bg-teal-50 text-teal-700', iconClass: 'text-teal-500' },
  ];

  return (
    <aside aria-label="Filtros rápidos" className="w-44 shrink-0">
      <div className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
        <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Filtros</p>
        <div className="flex flex-col gap-1.5">
          {buttons.map(({ key, label, count, icon: Icon, activeClass, iconClass }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              aria-pressed={activeFilter === key}
              className={cn(
                'flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm font-medium transition-colors',
                activeFilter === key
                  ? activeClass
                  : 'border-transparent bg-white text-slate-600 hover:border-slate-200 hover:bg-slate-50',
              )}
            >
              <Icon size={14} aria-hidden="true" className={cn(activeFilter === key ? '' : iconClass)} />
              <span className="flex-1">{label}</span>
              <span
                aria-label={`${count} posts`}
                className={cn(
                  'flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                  activeFilter === key ? 'bg-white/70 text-current' : 'bg-slate-100 text-slate-500'
                )}
              >
                {count}
              </span>
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
};
