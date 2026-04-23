import React from 'react';
import { RefreshCw } from 'lucide-react';

interface MonitoringEvent {
  id: string;
  action: string;
  entity: string;
  entity_id?: string | null;
  created_at: string;
}

interface MonitoringSnapshot {
  metrics: {
    mrr: number;
    net_profit: number;
    total_income: number;
    total_expense: number;
  };
  events: MonitoringEvent[];
}

interface DashboardSummary {
  operations: {
    clients: { total: number; active: number; leads: number; new_this_month: number };
    tasks: { total: number; pending: number; in_progress: number; done: number; overdue: number };
    onboarding: {
      total: number; pending: number; completed: number;
      in_progress_clients: number; completed_clients: number; completion_rate: number;
    };
  };
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

interface Props {
  monitoring: MonitoringSnapshot | null;
  summary: DashboardSummary | null;
  onRefresh: () => void;
}

export const MonitoringPanel: React.FC<Props> = ({ monitoring, summary, onRefresh }) => {
  const completionRate = summary?.operations.onboarding.completion_rate || 0;

  return (
    <div className="space-y-6">
      <div className="text-sm text-muted-foreground">
        MRR {formatCurrency(monitoring?.metrics.mrr || 0)} •{' '}
        Receita {formatCurrency(monitoring?.metrics.total_income || 0)} •{' '}
        Despesa {formatCurrency(monitoring?.metrics.total_expense || 0)} •{' '}
        Lucro {formatCurrency(monitoring?.metrics.net_profit || 0)}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="section-panel p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-foreground">Eventos recentes</h3>
            <button type="button" onClick={onRefresh} className="btn-secondary">
              <RefreshCw size={16} />
              Atualizar
            </button>
          </div>
          <div className="mt-4 max-h-[430px] space-y-3 overflow-y-auto minimal-scrollbar">
            {(monitoring?.events || []).slice(0, 12).map((event) => (
              <div key={event.id} className="flex items-center justify-between gap-3 border-b border-[#f1f1f1] py-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">{event.action}</p>
                  <p className="text-xs text-muted-foreground">{event.entity}</p>
                </div>
                <span className="text-[10px] text-muted-foreground">
                  {new Date(event.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
            {!monitoring?.events?.length ? (
              <div className="rounded-2xl border border-dashed border-border px-4 py-8 text-sm text-muted-foreground">
                Nenhum evento recente encontrado.
              </div>
            ) : null}
          </div>
        </div>

        <div className="section-panel p-4">
          <h3 className="text-lg font-semibold text-foreground">Saúde</h3>
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between border-b border-[#f1f1f1] py-3">
              <span className="text-sm font-medium text-foreground">Clientes ativos</span>
              <span className="text-sm font-semibold text-foreground">{summary?.operations.clients.active || 0}</span>
            </div>
            <div className="flex items-center justify-between border-b border-[#f1f1f1] py-3">
              <span className="text-sm font-medium text-foreground">Tarefas em progresso</span>
              <span className="text-sm font-semibold text-foreground">{summary?.operations.tasks.in_progress || 0}</span>
            </div>
            <div className="flex items-center justify-between border-b border-[#f1f1f1] py-3">
              <span className="text-sm font-medium text-foreground">Onboarding concluído</span>
              <span className="text-sm font-semibold text-foreground">{completionRate}%</span>
            </div>
            <div className="flex items-center justify-between py-3">
              <span className="text-sm font-medium text-foreground">Atrasos</span>
              <span className="text-sm font-semibold text-foreground">{summary?.operations.tasks.overdue || 0}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
