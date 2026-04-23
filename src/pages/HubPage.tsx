import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  CheckCircle,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Clock,
  Inbox,
  Kanban,
  Loader2,
  Pencil,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useHubData } from '@/hooks/useHubData';
import { useHubFilters } from '@/hooks/useHubFilters';
import { HubCalendar } from '@/components/hub/HubCalendar';
import { HubKanbanTab } from '@/components/hub/HubKanbanTab';
import { HubApprovalsTab } from '@/components/hub/HubApprovalsTab';
import { HubRequestsTab } from '@/components/hub/HubRequestsTab';
import { HubSidebar } from '@/components/hub/HubSidebar';
import { HubPostModal } from '@/components/hub/HubPostModal';
import { getTodayLocal } from '@/utils/localDate';
import { cn } from '@/utils/cn';
import type { HubPost } from '@/services/hub.service';
import { isQuietClient } from '@/services/_shared';

type HubTab = 'calendar' | 'production' | 'approvals' | 'requests';

const isHubTab = (value: string | null): value is HubTab =>
  value === 'calendar' || value === 'production' || value === 'approvals' || value === 'requests';

const MONTHS_PT = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

interface MetricCardProps {
  label: string;
  value: number;
  icon: React.ElementType;
  colorClass: string;
}

function MetricCard({ label, value, icon: Icon, colorClass }: MetricCardProps) {
  return (
    <div className={cn('flex items-center gap-3 rounded-xl border px-3 py-2.5', colorClass)}>
      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/70">
        <Icon size={14} className="opacity-70" aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">{label}</p>
        <p className="mt-0.5 text-lg font-semibold leading-none">{value}</p>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ElementType;
  label: string;
  badge?: number;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-colors',
        active ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300',
      )}
    >
      <Icon size={14} aria-hidden="true" />
      {label}
      {badge != null && badge > 0 ? (
        <span
          className={cn(
            'flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold',
            active ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-500',
          )}
        >
          {badge}
        </span>
      ) : null}
    </button>
  );
}

const HubPage: React.FC = () => {
  const { selectedClientId, year, month, activeFilter, setClient, nextMonth, prevMonth } = useHubFilters();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedPost, setSelectedPost] = useState<HubPost | null>(null);
  const [activeTab, setActiveTabState] = useState<HubTab>(() =>
    isHubTab(searchParams.get('tab')) ? (searchParams.get('tab') as HubTab) : 'calendar'
  );
  const today = getTodayLocal();

  useEffect(() => {
    const requestedTab = searchParams.get('tab');
    const normalized = isHubTab(requestedTab) ? requestedTab : 'calendar';
    setActiveTabState((current) => (current === normalized ? current : normalized));
  }, [searchParams]);

  const setActiveTab = (tab: HubTab) => {
    setActiveTabState(tab);
    const nextParams = new URLSearchParams(searchParams);
    if (tab === 'calendar') nextParams.delete('tab');
    else nextParams.set('tab', tab);
    setSearchParams(nextParams, { replace: true });
  };

  const { data: clients = [] } = useQuery({
    queryKey: ['clients-list-hub'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name, industry, status, logo_url, is_free_or_trade, one_time_payment')
        .eq('status', 'active')
        .order('name');
      if (error) throw error;
      return (data || []).filter((client) => !isQuietClient(client)) as Array<{
        id: string;
        name: string;
        industry: string | null;
        status: string;
        logo_url: string | null;
      }>;
    },
  });

  const selectedClient = clients.find((client) => client.id === selectedClientId) ?? null;
  const { data: posts = [], isLoading } = useHubData(selectedClientId, year, month);

  const metrics = useMemo(
    () => ({
      atrasados: posts.filter((post) => post.post_date < today && post.workflow_status !== 'publicado').length,
      aguardando: posts.filter((post) => ['em_aprovacao_cliente', 'revisao_cliente', 'aprovado_cliente', 'aguardando_agendamento'].includes(post.workflow_status)).length,
      producao: posts.filter((post) => ['rascunho', 'revisao_interna', 'aprovado_interno'].includes(post.workflow_status)).length,
      publicados: posts.filter((post) => post.workflow_status === 'publicado').length,
    }),
    [posts, today]
  );

  return (
    <>
      {selectedPost ? (
        <HubPostModal
          post={selectedPost}
          clientId={selectedClientId ?? ''}
          year={year}
          month={month}
          onClose={() => setSelectedPost(null)}
        />
      ) : null}

      <div className="mx-auto flex min-h-full w-full max-w-[1360px] flex-col gap-4 p-4 md:p-5">
        <section className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Hub</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <h1 className="text-lg font-semibold tracking-tight text-slate-900">
                  {selectedClient ? selectedClient.name : 'Operação central'}
                </h1>
                {selectedClient?.industry ? (
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                    {selectedClient.industry}
                  </span>
                ) : null}
                {selectedClient ? (
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-[11px] font-medium',
                      selectedClient.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500',
                    )}
                  >
                    {selectedClient.status === 'active' ? 'Ativo' : 'Inativo'}
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-sm text-slate-500">
                {selectedClient
                  ? 'Calendário, produção, aprovação e solicitações no mesmo fluxo.'
                  : 'Selecione um cliente ativo para operar calendário, produção, aprovação e solicitações.'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div>
                <label htmlFor="hub-client-select" className="sr-only">
                  Cliente
                </label>
                <select
                  id="hub-client-select"
                  value={selectedClientId ?? ''}
                  onChange={(event) => setClient(event.target.value || null)}
                  className="field-control h-10 min-w-[220px] pr-8 text-sm"
                >
                  <option value="">Selecione o cliente…</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
              </div>

              <nav aria-label="Navegação de mês" className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
                <button
                  onClick={prevMonth}
                  aria-label="Mês anterior"
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-white"
                >
                  <ChevronLeft size={14} aria-hidden="true" />
                </button>
                <span aria-live="polite" aria-atomic="true" className="min-w-[128px] text-center text-sm font-medium text-slate-700">
                  {MONTHS_PT[month]} {year}
                </span>
                <button
                  onClick={nextMonth}
                  aria-label="Próximo mês"
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-white"
                >
                  <ChevronRight size={14} aria-hidden="true" />
                </button>
              </nav>
            </div>
          </div>

          {selectedClientId ? (
            <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4" role="region" aria-label="Métricas do mês">
              <MetricCard label="Atrasados" value={metrics.atrasados} icon={AlertTriangle} colorClass="border-rose-100 bg-rose-50 text-rose-700" />
              <MetricCard label="Cliente / agenda" value={metrics.aguardando} icon={Clock} colorClass="border-amber-100 bg-amber-50 text-amber-700" />
              <MetricCard label="Em produção" value={metrics.producao} icon={Pencil} colorClass="border-violet-100 bg-violet-50 text-violet-700" />
              <MetricCard label="Publicados" value={metrics.publicados} icon={CheckCircle} colorClass="border-green-100 bg-green-50 text-green-700" />
            </div>
          ) : null}

          {selectedClientId ? (
            <nav aria-label="Seções do Hub" className="mt-3 flex flex-wrap gap-2">
              <TabButton active={activeTab === 'calendar'} onClick={() => setActiveTab('calendar')} icon={Calendar} label="Calendário" />
              <TabButton active={activeTab === 'production'} onClick={() => setActiveTab('production')} icon={Kanban} label="Produção" badge={metrics.producao} />
              <TabButton active={activeTab === 'approvals'} onClick={() => setActiveTab('approvals')} icon={CheckSquare} label="Aprovação e agenda" badge={metrics.aguardando} />
              <TabButton active={activeTab === 'requests'} onClick={() => setActiveTab('requests')} icon={Inbox} label="Solicitações" />
            </nav>
          ) : null}
        </section>

        {!selectedClientId ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 py-20">
            <p className="text-base font-medium text-slate-500">Selecione um cliente</p>
            <p className="mt-1 text-sm text-slate-400">para abrir a Central Operacional</p>
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center py-20" role="status" aria-label="Carregando" aria-busy="true">
            <Loader2 size={28} className="animate-spin text-primary" aria-hidden="true" />
          </div>
        ) : (
          <>
            {activeTab === 'calendar' ? (
              <div className="flex items-start gap-4">
                <HubSidebar posts={posts} />
                <main className="min-w-0 flex-1" aria-label="Calendário editorial">
                  <HubCalendar
                    year={year}
                    month={month}
                    posts={posts}
                    activeFilter={activeFilter}
                    onPostClick={setSelectedPost}
                    clientId={selectedClientId}
                  />
                </main>
              </div>
            ) : null}
            {activeTab === 'production' ? <HubKanbanTab posts={posts} clientId={selectedClientId} year={year} month={month} /> : null}
            {activeTab === 'approvals' ? (
              <HubApprovalsTab posts={posts} clientId={selectedClientId} year={year} month={month} onOpenPost={setSelectedPost} />
            ) : null}
            {activeTab === 'requests' ? <HubRequestsTab clientId={selectedClientId} /> : null}
          </>
        )}
      </div>
    </>
  );
};

export default HubPage;
