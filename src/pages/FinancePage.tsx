import React, { useDeferredValue, useEffect, useMemo, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Filter,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  TrendingUp,
  Wallet2,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from '@/components/ui/sonner';
import { cn, formatCurrency, formatDate } from '@/utils/cn';
import { useQueryClient } from '@tanstack/react-query';
import { FinanceService } from '@/services';
import { useFinanceOverview } from '@/hooks/useFinance';
import { subscribeRealtimeChange } from '@/lib/realtime';

interface FinanceEntry {
  id: string;
  client_id: string | null;
  client_name: string | null;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  date: string;
  status: 'paid' | 'pending' | 'overdue';
  notes?: string | null;
  client?: { one_time_payment?: boolean | null; is_free_or_trade?: boolean | null } | null;
  acquisition_cost?: boolean | null;
}

interface FinanceSummary {
  mrr: number;
  cac: number;
  ltv: number;
  total_income: number;
  total_expense: number;
  net_profit: number;
}

interface FinanceClient {
  id: string;
  name: string;
}

interface FinanceDraft {
  client_id: string;
  amount: string;
  type: 'income' | 'expense';
  category: string;
  date: string;
  status: 'paid' | 'pending' | 'overdue';
  notes: string;
}

const STATUS_CONFIG: Record<FinanceEntry['status'], { label: string; className: string }> = {
  paid: { label: 'Pago', className: 'status-badge-done' },
  pending: { label: 'Pendente', className: 'status-badge-doing' },
  overdue: { label: 'Atrasado', className: 'status-badge-stuck' },
};

const normalizeEntry = (entry: any): FinanceEntry => ({
  id: String(entry.id),
  client_id: entry.client_id ? String(entry.client_id) : null,
  client_name: entry.client_name ? String(entry.client_name) : null,
  amount: Number(entry.amount || 0),
  type: entry.type === 'expense' ? 'expense' : 'income',
  category: String(entry.category || 'Sem categoria'),
  date: String(entry.date || entry.created_at || new Date().toISOString()),
  status: entry.status === 'pending' || entry.status === 'overdue' ? entry.status : 'paid',
  notes: entry.notes ? String(entry.notes) : null,
  client: entry.client || entry.clients || null,
  acquisition_cost: entry.acquisition_cost ?? null,
});

const calculateFinanceSummary = (entries: FinanceEntry[]): FinanceSummary => {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  let totalIncome = 0;
  let totalExpense = 0;
  let recurringIncomeThisMonth = 0;
  let acquisitionExpenseThisMonth = 0;
  const recurringClients = new Set<string>();

  for (const entry of entries) {
    const amount = Number(entry.amount || 0);
    const date = new Date(entry.date || now.toISOString());
    const sameMonth = date.getMonth() === currentMonth && date.getFullYear() === currentYear;
    const isRecurringClient = !Boolean(entry.client?.one_time_payment || entry.client?.is_free_or_trade);

    if (entry.type === 'income') {
      totalIncome += amount;
      if (sameMonth && isRecurringClient) {
        recurringIncomeThisMonth += amount;
        if (entry.client_id) recurringClients.add(String(entry.client_id));
      }
    } else {
      totalExpense += amount;
      if (sameMonth && Boolean(entry.acquisition_cost)) {
        acquisitionExpenseThisMonth += amount;
      }
    }
  }

  const activeRecurringClients = recurringClients.size;
  const averageRecurringRevenue = activeRecurringClients > 0 ? recurringIncomeThisMonth / activeRecurringClients : 0;

  return {
    mrr: recurringIncomeThisMonth,
    cac: activeRecurringClients > 0 ? acquisitionExpenseThisMonth / activeRecurringClients : 0,
    ltv: averageRecurringRevenue * 12,
    total_income: totalIncome,
    total_expense: totalExpense,
    net_profit: totalIncome - totalExpense,
  };
};

const today = new Date().toISOString().slice(0, 10);

const FinanceModal = ({
  draft,
  clients,
  onChange,
  onClose,
  onSave,
}: {
  draft: FinanceDraft | null;
  clients: FinanceClient[];
  onChange: (update: Partial<FinanceDraft>) => void;
  onClose: () => void;
  onSave: () => Promise<void>;
}) => (
  <AnimatePresence>
    {draft ? (
      <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
        <motion.button
          type="button"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-950/30 backdrop-blur-sm"
        />

        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.98 }}
          className="modal-surface relative z-10 w-full max-w-3xl overflow-hidden"
        >
          <div className="border-b border-border px-6 py-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="page-kicker">
                  <span className="page-kicker-dot" />
                  Nova transação
                </div>
                <h2 className="mt-3 text-2xl font-bold tracking-tight text-foreground">Lançamento financeiro</h2>
                <p className="mt-2 text-sm text-muted-foreground">Registro real no Supabase, sem depender de dados falsos.</p>
              </div>

              <button type="button" onClick={onClose} className="btn-secondary h-10 w-10 px-0">
                <X size={16} />
              </button>
            </div>
          </div>

          <div className="minimal-scrollbar max-h-[84vh] overflow-y-auto p-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Cliente</label>
                <select value={draft.client_id} onChange={(event) => onChange({ client_id: event.target.value })} className="select-control">
                  <option value="">Sem cliente vinculado</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Valor</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={draft.amount}
                  onChange={(event) => onChange({ amount: event.target.value })}
                  className="field-control"
                  placeholder="0,00"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Data</label>
                <input type="date" value={draft.date} onChange={(event) => onChange({ date: event.target.value })} className="field-control" />
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Categoria</label>
                <input value={draft.category} onChange={(event) => onChange({ category: event.target.value })} className="field-control" placeholder="Gestão de Tráfego" />
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Status</label>
                <select
                  value={draft.status}
                  onChange={(event) => onChange({ status: event.target.value as FinanceDraft['status'] })}
                  className="select-control"
                >
                  <option value="paid">Pago</option>
                  <option value="pending">Pendente</option>
                  <option value="overdue">Atrasado</option>
                </select>
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Tipo</label>
                <div className="grid grid-cols-2 gap-3">
                  {(['income', 'expense'] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => onChange({ type })}
                      className={cn('section-panel px-4 py-3 text-left', draft.type === type && 'border-primary/20 bg-primary/5')}
                    >
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        {type === 'income' ? 'Receita' : 'Despesa'}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-foreground">{type === 'income' ? 'Entrada' : 'Saída'}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Observações</label>
                <textarea
                  value={draft.notes}
                  onChange={(event) => onChange({ notes: event.target.value })}
                  rows={4}
                  className="field-control resize-y"
                  placeholder="Contexto interno da transação"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3 border-t border-border pt-4">
              <button type="button" onClick={onClose} className="btn-secondary">
                Cancelar
              </button>
              <button type="button" onClick={() => void onSave()} className="btn-primary">
                <Sparkles size={16} />
                Salvar transação
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    ) : null}
  </AnimatePresence>
);

export const FinancePage: React.FC = () => {
  const [entries, setEntries] = useState<FinanceEntry[]>([]);
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [clients, setClients] = useState<FinanceClient[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | FinanceEntry['status']>('all');
  const [draft, setDraft] = useState<FinanceDraft | null>(null);
  const deferredSearch = useDeferredValue(searchTerm);
  const queryClient = useQueryClient();
  const {
    data: financeOverview,
    isLoading: loading,
    refetch: refetchFinanceOverview,
  } = useFinanceOverview();

  useEffect(() => {
    if (!financeOverview) return;

    setEntries((financeOverview.entries || []).map(normalizeEntry));
    setSummary(financeOverview.summary as FinanceSummary);
    setClients((financeOverview.clients || []).map((item: any) => ({ id: String(item.id), name: String(item.name || 'Sem nome') })));
  }, [financeOverview]);

  useEffect(() => {
    return subscribeRealtimeChange((detail) => {
      if (detail.schema !== 'public') return;

      if (detail.table === 'finance_entries') {
        const row = detail.eventType === 'DELETE' ? detail.oldRow : detail.newRow;
        if (!row) return;

        const normalized = normalizeEntry(row);
        setEntries((current) => {
          if (detail.eventType === 'DELETE') {
            return current.filter((entry) => entry.id !== normalized.id);
          }

          const exists = current.some((entry) => entry.id === normalized.id);
          return exists
            ? current.map((entry) => (entry.id === normalized.id ? normalized : entry))
            : [normalized, ...current];
        });
      }

      if (detail.table === 'clients') {
        const row = detail.eventType === 'DELETE' ? detail.oldRow : detail.newRow;
        if (!row) return;

        const clientId = String((row as Record<string, unknown>).id || '');
        if (!clientId) return;

        const hidden = Boolean(
          (row as Record<string, unknown>).is_free_or_trade || (row as Record<string, unknown>).one_time_payment)
        ;
        const nextClient = {
          id: clientId,
          name: String((row as Record<string, unknown>).name || 'Sem nome'),
        };

        setClients((current) => {
          if (detail.eventType === 'DELETE' || hidden) {
            return current.filter((client) => client.id !== clientId);
          }

          const exists = current.some((client) => client.id === clientId);
          return exists
            ? current.map((client) => (client.id === clientId ? nextClient : client))
            : [nextClient, ...current];
        });

        setEntries((current) => {
          if (detail.eventType === 'DELETE' || hidden) {
            return current.filter((entry) => entry.client_id !== clientId);
          }

          return current.map((entry) =>
            entry.client_id === clientId ? { ...entry, client_name: nextClient.name } : entry
          );
        });
      }
    });
  }, []);

  useEffect(() => {
    if (!entries.length) return;
    setSummary(calculateFinanceSummary(entries));
  }, [entries]);

  const filtered = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase();
    return entries.filter((entry) => {
      const matchesSearch =
        !q ||
        (entry.client_name || '').toLowerCase().includes(q) ||
        entry.category.toLowerCase().includes(q) ||
        (entry.notes || '').toLowerCase().includes(q);
      const matchesType = typeFilter === 'all' || entry.type === typeFilter;
      const matchesStatus = statusFilter === 'all' || entry.status === statusFilter;
      return matchesSearch && matchesType && matchesStatus;
    });
  }, [deferredSearch, entries, statusFilter, typeFilter]);

  const openCreate = () => {
    setDraft({
      client_id: '',
      amount: '',
      type: 'income',
      category: '',
      date: today,
      status: 'paid',
      notes: '',
    });
  };

  const updateDraft = (update: Partial<FinanceDraft>) => {
    setDraft((current) => (current ? { ...current, ...update } : current));
  };

  const handleSave = async () => {
    if (!draft) return;

    const amount = Number(String(draft.amount).replace(',', '.'));
    if (!amount || Number.isNaN(amount) || amount <= 0) {
      toast.error('Informe um valor válido.');
      return;
    }

    const payload = {
      client_id: draft.client_id || null,
      amount,
      type: draft.type,
      category: draft.category.trim() || 'Sem categoria',
      date: draft.date,
      status: draft.status,
      notes: draft.notes.trim() || null,
    };

    const snapshotEntries = entries;
    const snapshotDraft = draft;
    const tempId = `temp-finance-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const optimistic = normalizeEntry({
      id: tempId,
      client_id: payload.client_id,
      client_name: clients.find((client) => client.id === payload.client_id)?.name || null,
      amount: payload.amount,
      type: payload.type,
      category: payload.category,
      date: payload.date,
      status: payload.status,
      notes: payload.notes,
    });

    setEntries((current) => [optimistic, ...current]);
    setDraft(null);

    try {
      const created = await FinanceService.create(payload);
      const normalized = normalizeEntry(created);
      setEntries((current) => current.map((entry) => (entry.id === tempId ? normalized : entry)));
      void queryClient.invalidateQueries({ queryKey: ['finance', 'overview'] });
      toast.success('Transação salva.');
    } catch (error) {
      console.error(error);
      setEntries(snapshotEntries);
      setDraft(snapshotDraft);
      toast.error('Não foi possível salvar a transação.');
    }
  };

  if (loading) {
    return (
<div className="mx-auto flex min-h-full w-full max-w-[1560px] flex-col gap-6 px-4 py-5 md:px-6 md:py-6 xl:px-8">
<div className="premium-card flex min-h-[180px] items-center justify-center p-5">
          <div className="flex items-center gap-3 text-muted-foreground">
            <RefreshCw size={18} className="animate-spin text-primary" />
            <span className="text-sm font-medium">Carregando financeiro...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <FinanceModal draft={draft} clients={clients} onChange={updateDraft} onClose={() => setDraft(null)} onSave={() => handleSave()} />

<div className="mx-auto flex min-h-full w-full max-w-[1560px] flex-col gap-6 px-4 py-5 md:px-6 md:py-6 xl:px-8">
        <section className="premium-card overflow-hidden">
          <div className="border-b border-border/70 px-5 py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="page-kicker">
                  <span className="page-kicker-dot" />
                  Operação financeira
                </div>
                <h1 className="mt-3 text-2xl font-bold tracking-tight text-foreground">Financeiro</h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                  Entradas, saídas, margem e receita recorrente da operação em tempo real.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button type="button" onClick={openCreate} className="btn-primary">
                  <Plus size={16} />
                  Nova transação
                </button>
                <button type="button" onClick={() => void refetchFinanceOverview()} className="btn-secondary">
                  <RefreshCw size={16} />
                  Recarregar
                </button>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <div className="relative min-w-[240px] flex-1 max-w-md">
                <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Buscar cliente, categoria ou observação"
                  className="field-control pl-11"
                />
              </div>

              <div className="section-panel flex items-center gap-2 px-3 py-2">
                <Filter size={15} className="text-muted-foreground" />
                <select
                  value={typeFilter}
                  onChange={(event) => setTypeFilter(event.target.value as 'all' | 'income' | 'expense')}
                  className="border-0 bg-transparent text-sm font-medium text-foreground outline-none"
                >
                  <option value="all">Todos</option>
                  <option value="income">Receitas</option>
                  <option value="expense">Despesas</option>
                </select>
              </div>

              <div className="section-panel flex items-center gap-2 px-3 py-2">
                <Filter size={15} className="text-muted-foreground" />
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value as 'all' | FinanceEntry['status'])}
                  className="border-0 bg-transparent text-sm font-medium text-foreground outline-none"
                >
                  <option value="all">Todos os status</option>
                  <option value="paid">Pago</option>
                  <option value="pending">Pendente</option>
                  <option value="overdue">Atrasado</option>
                </select>
              </div>
            </div>
          </div>

          <div className="grid gap-4 px-6 py-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="metric-card">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Receita</p>
              <p className="metric-card-value">{formatCurrency(summary?.total_income || 0)}</p>
            </div>
            <div className="metric-card">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Despesa</p>
              <p className="metric-card-value">{formatCurrency(summary?.total_expense || 0)}</p>
            </div>
            <div className="metric-card">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Lucro líquido</p>
              <p className={cn('metric-card-value', (summary?.net_profit || 0) >= 0 ? 'text-status-success' : 'text-status-danger')}>
                {formatCurrency(summary?.net_profit || 0)}
              </p>
            </div>
            <div className="metric-card">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Receita recorrente</p>
              <p className="metric-card-value">{formatCurrency(summary?.mrr || 0)}</p>
            </div>
          </div>
        </section>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.85fr)]">
          <section className="table-shell overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1180px] border-collapse">
                <thead className="bg-transparent">
                  <tr className="border-b border-border/80 text-left text-[12px] uppercase tracking-[0.12em] text-muted-foreground">
                    <th className="px-4 py-3 font-semibold">Descrição</th>
                    <th className="w-[190px] px-4 py-3 font-semibold">Categoria</th>
                    <th className="w-[160px] px-4 py-3 font-semibold">Valor</th>
                    <th className="w-[140px] px-4 py-3 font-semibold">Data</th>
                    <th className="w-[140px] px-4 py-3 font-semibold">Status</th>
                    <th className="w-[120px] px-4 py-3 font-semibold">Tipo</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((entry) => {
                    const isIncome = entry.type === 'income';
                    return (
                      <tr key={entry.id} className="interactive-list-item border-b border-border/70">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className={cn('flex h-9 w-9 items-center justify-center rounded-2xl', isIncome ? 'bg-status-success/10 text-status-success' : 'bg-status-danger/10 text-status-danger')}>
                              {isIncome ? <ArrowUpRight size={16} /> : <ArrowDownLeft size={16} />}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-foreground">{entry.client_name || 'Sem cliente'}</p>
                              {entry.notes ? <p className="truncate text-xs text-muted-foreground">{entry.notes}</p> : null}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{entry.category}</td>
                        <td className={cn('px-4 py-3 text-sm font-semibold', isIncome ? 'text-status-success' : 'text-status-danger')}>
                          {isIncome ? '+' : '-'}
                          {formatCurrency(entry.amount)}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{formatDate(entry.date)}</td>
                        <td className="px-4 py-3">
                          <span className={cn('status-badge', STATUS_CONFIG[entry.status].className)}>{STATUS_CONFIG[entry.status].label}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn('pill text-[10px]', isIncome ? 'pill-success' : 'pill-danger')}>
                            {isIncome ? 'Receita' : 'Despesa'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}

                  {!filtered.length ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-16 text-center text-sm text-muted-foreground">
                        Nenhuma transação encontrada para este filtro.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>

          <aside className="space-y-5">
            <section className="premium-card p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Indicadores-chave</p>
                  <h2 className="mt-1 text-lg font-semibold text-foreground">Saúde financeira</h2>
                </div>
                <TrendingUp size={18} className="text-primary" />
              </div>

              <div className="mt-5 space-y-4">
                <div className="section-panel p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Custo de aquisição</p>
                  <p className="mt-1 text-xl font-bold text-foreground">{formatCurrency(summary?.cac || 0)}</p>
                </div>
                <div className="section-panel p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Valor por cliente</p>
                  <p className="mt-1 text-xl font-bold text-foreground">{formatCurrency(summary?.ltv || 0)}</p>
                </div>
                <div className="section-panel p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Lançamentos</p>
                  <p className="mt-1 text-xl font-bold text-foreground">{filtered.length}</p>
                </div>
              </div>
            </section>

            <section className="premium-card p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Resumo</p>
                  <h2 className="mt-1 text-lg font-semibold text-foreground">Resumo do caixa</h2>
                </div>
                <Wallet2 size={18} className="text-status-warning" />
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="section-panel p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Receitas</p>
                  <p className="mt-1 text-2xl font-bold text-foreground">{formatCurrency(summary?.total_income || 0)}</p>
                </div>
                <div className="section-panel p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Despesas</p>
                  <p className="mt-1 text-2xl font-bold text-foreground">{formatCurrency(summary?.total_expense || 0)}</p>
                </div>
                <div className="section-panel p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Lucro</p>
                  <p className="mt-1 text-2xl font-bold text-foreground">{formatCurrency(summary?.net_profit || 0)}</p>
                </div>
                <div className="section-panel p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Atualização</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">Supabase ao vivo</p>
                </div>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </>
  );
};

export default FinancePage;
