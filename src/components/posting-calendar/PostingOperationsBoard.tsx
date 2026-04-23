import React, { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { CalendarDays, CheckCircle2, Clock3, RefreshCw, Rocket, Search, X } from 'lucide-react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import {
  getWorkflowOperationalBadge,
  type PostingCalendarItemRecord,
} from '@/components/posting-calendar/PostingCalendarShared';
import type { Role } from '@/domain/postWorkflow';
import { normalizeSystemRole } from '@/domain/accessControl';
import { supabase } from '@/lib/supabase';
import { ClientService, PostWorkflowService } from '@/services';
import { useAuthStore } from '@/store/useAuthStore';
import { toast } from '@/components/ui/sonner';
import { cn } from '@/lib/utils';

type QueueMode = 'scheduling' | 'scheduled';

type QueueItem = PostingCalendarItemRecord & {
  client_name: string;
  client_slug?: string | null;
};

interface PostingOperationsBoardProps {
  mode: QueueMode;
}

const STATUS_FILTERS: Record<QueueMode, string[]> = {
  scheduling: ['aguardando_agendamento', 'aprovado_cliente'],
  scheduled: ['agendado'],
};

const PAGE_COPY: Record<
  QueueMode,
  {
    title: string;
    subtitle: string;
    actionLabel: string;
    emptyTitle: string;
    emptyHint: string;
  }
> = {
  scheduling: {
    title: 'Fila de Agendamento',
    subtitle: 'Posts aprovados esperando operação real. Nada some do fluxo.',
    actionLabel: 'Agendar',
    emptyTitle: 'Nenhum post aguardando agendamento',
    emptyHint: 'Assim que o cliente aprovar, o item aparece aqui para o social media definir data e hora.',
  },
  scheduled: {
    title: 'Posts Agendados',
    subtitle: 'Posts com data real definida e acompanhamento até a publicação.',
    actionLabel: 'Reagendar',
    emptyTitle: 'Nenhum post agendado',
    emptyHint: 'Quando a equipe confirmar um agendamento, o post aparece aqui até ser marcado como publicado.',
  },
};

const parseDateValue = (value?: string | null) => {
  const raw = String(value || '').trim();
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [year, month, day] = raw.split('-').map(Number);
    return new Date(year, month - 1, day);
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatDateInput = (value?: string | null) => {
  const parsed = parseDateValue(value);
  return parsed ? format(parsed, 'yyyy-MM-dd') : '';
};

const formatTimeInput = (value?: string | null) => {
  const parsed = parseDateValue(value);
  return parsed ? format(parsed, 'HH:mm') : '';
};

const formatDateLabel = (value?: string | null) => {
  const parsed = parseDateValue(value);
  return parsed ? format(parsed, 'dd/MM/yyyy') : 'Sem data';
};

const formatTimeLabel = (value?: string | null) => {
  const parsed = parseDateValue(value);
  if (!parsed) return 'A definir';
  const label = format(parsed, 'HH:mm');
  return label === '00:00' ? 'A definir' : label;
};

const buildScheduledDateTime = (dateValue: string, timeValue: string) => {
  if (!dateValue) return null;
  const parsed = new Date(`${dateValue}T${timeValue || '00:00'}:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
};

const getReferenceDate = (item: QueueItem) =>
  item.scheduled_date || item.approved_at || item.updated_at || item.created_at || item.post_date || null;

const getWaitingDays = (item: QueueItem) => {
  const parsed = parseDateValue(item.approved_at || item.updated_at || item.created_at || item.post_date || null);
  if (!parsed) return 0;
  return Math.max(0, Math.floor((Date.now() - parsed.getTime()) / 86400000));
};

const getUrgencyTone = (item: QueueItem, mode: QueueMode) => {
  if (mode === 'scheduling') {
    const days = getWaitingDays(item);
    if (days > 2) {
      return {
        label: '🔴 atraso operacional',
        className: 'border-rose-200 bg-rose-50 text-rose-700',
      };
    }
    if (days >= 1) {
      return {
        label: '🟡 dentro do radar',
        className: 'border-amber-200 bg-amber-50 text-amber-700',
      };
    }
    return {
      label: '🟢 no prazo',
      className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    };
  }

  const scheduledDate = parseDateValue(item.scheduled_date || item.post_date || null);
  if (!scheduledDate) {
    return {
      label: '🟡 sem horário',
      className: 'border-amber-200 bg-amber-50 text-amber-700',
    };
  }

  const diffHours = Math.round((scheduledDate.getTime() - Date.now()) / 3600000);
  if (diffHours <= 24) {
    return {
      label: '🔴 publica logo',
      className: 'border-rose-200 bg-rose-50 text-rose-700',
    };
  }
  if (diffHours <= 72) {
    return {
      label: '🟡 atenção',
      className: 'border-amber-200 bg-amber-50 text-amber-700',
    };
  }
  return {
    label: '🟢 organizado',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  };
};

const getCalendarHref = (item: QueueItem) => {
  const parsed = parseDateValue(item.scheduled_date || item.post_date || item.created_at || null) || new Date();
  const params = new URLSearchParams({
    client: String(item.client_id || ''),
    month: String(parsed.getMonth()),
    year: String(parsed.getFullYear()),
  });
  return `/posting-calendar?${params.toString()}`;
};

const buildClientMap = async () => {
  const clients = await ClientService.getAll();
  return new Map(
    (clients || []).map((client: any) => [
      String(client.id),
      {
        name: String(client.name || 'Cliente'),
        slug: client.slug ? String(client.slug) : null,
      },
    ])
  );
};

export const PostingOperationsBoard: React.FC<PostingOperationsBoardProps> = ({ mode }) => {
  const currentUserRole = useAuthStore((state) => state.user?.role);
  const workflowActorRole: Role =
    currentUserRole === 'blocked'
      ? 'admin_operacional'
      : (normalizeSystemRole(currentUserRole || 'admin_operacional') as Role);

  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [selectedItem, setSelectedItem] = useState<QueueItem | null>(null);
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [saving, setSaving] = useState(false);

  const page = PAGE_COPY[mode];

  const loadQueue = useCallback(async () => {
    const clientMap = await buildClientMap();
    const statuses = STATUS_FILTERS[mode];

    console.log('[Fila operacional] Consultando tabela public.posting_calendar_items');
    console.log('[Fila operacional] Filtro de status:', statuses);

    const buildQuery = () =>
      supabase
        .from('posting_calendar_items')
        .select('*')
        .in('workflow_status', statuses)
        .order(mode === 'scheduled' ? 'scheduled_date' : 'approved_at', { ascending: true });

    let response = await buildQuery().is('deleted_at', null);
    const missingDeletedAt =
      String((response.error as { message?: string } | null)?.message || '')
        .toLowerCase()
        .includes('deleted_at');

    if (response.error && missingDeletedAt) {
      response = await buildQuery();
    }

    if (response.error) throw response.error;

    let rows = (response.data || []) as Array<Record<string, unknown>>;
    rows = rows.filter((row) => row.is_current_version !== false);

    const nextItems = rows
      .map((row) => {
        const clientId = String(row.client_id || '');
        const client = clientMap.get(clientId);
        return {
          ...(row as PostingCalendarItemRecord),
          client_name: client?.name || 'Cliente',
          client_slug: client?.slug || null,
        } as QueueItem;
      })
      .sort((left, right) => {
        const leftTime = parseDateValue(getReferenceDate(left))?.getTime() || 0;
        const rightTime = parseDateValue(getReferenceDate(right))?.getTime() || 0;
        if (mode === 'scheduled') return leftTime - rightTime;
        if (leftTime !== rightTime) return leftTime - rightTime;
        return left.client_name.localeCompare(right.client_name, 'pt-BR');
      });

    nextItems.forEach((item) => {
      console.log('[Fila operacional] Status atual:', item.workflow_status);
      console.log('[Fila operacional] Agendamento:', item.scheduled_date || 'pendente');
      console.log('[Fila operacional] Cliente:', item.client_name);
    });

    setItems(nextItems);
  }, [mode]);

  useEffect(() => {
    let active = true;
    setLoading(true);

    void loadQueue()
      .catch((error) => {
        console.error('Falha ao carregar fila operacional:', error);
        toast.error('Não foi possível carregar a fila operacional.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [loadQueue]);

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      await loadQueue();
      toast.success('Fila operacional atualizada.');
    } catch (error) {
      console.error('Falha ao atualizar fila operacional:', error);
      toast.error('Não foi possível atualizar a fila operacional.');
    } finally {
      setRefreshing(false);
    }
  };

  const openScheduleModal = (item: QueueItem) => {
    setSelectedItem(item);
    setScheduledDate(formatDateInput(item.scheduled_date || item.post_date || new Date().toISOString()));
    setScheduledTime(formatTimeInput(item.scheduled_date || item.post_date || null) || '09:00');
  };

  const closeScheduleModal = () => {
    if (saving) return;
    setSelectedItem(null);
    setScheduledDate('');
    setScheduledTime('');
  };

  const handleConfirmSchedule = async () => {
    if (!selectedItem) return;
    if (!scheduledDate || !scheduledTime) {
      toast.error('Defina data e horário para confirmar o agendamento.');
      return;
    }

    const nextScheduledDate = buildScheduledDateTime(scheduledDate, scheduledTime);
    if (!nextScheduledDate) {
      toast.error('Data ou horário inválido.');
      return;
    }

    try {
      setSaving(true);
      await PostWorkflowService.schedulePost({
        postId: selectedItem.id,
        role: workflowActorRole,
        scheduledDate: nextScheduledDate,
        comment:
          mode === 'scheduled'
            ? 'Agendamento ajustado pela fila operacional.'
            : 'Agendamento confirmado pela fila operacional.',
        metadata: {
          source: 'posting_operations_board',
          client_name: selectedItem.client_name,
        },
      });

      await loadQueue();
      toast.success(mode === 'scheduled' ? 'Agendamento atualizado.' : 'Agendamento confirmado.');
      closeScheduleModal();
    } catch (error) {
      console.error('Falha ao salvar agendamento:', error);
      toast.error('Não foi possível salvar o agendamento.');
    } finally {
      setSaving(false);
    }
  };

  const handleMarkPublished = async (item: QueueItem) => {
    try {
      await PostWorkflowService.publishPost({
        postId: item.id,
        role: workflowActorRole,
        publishedAt: new Date().toISOString(),
        comment: 'Publicação confirmada pela fila operacional.',
        metadata: {
          source: 'posting_operations_board',
          scheduled_date: item.scheduled_date || item.post_date || null,
          client_name: item.client_name,
        },
      });

      await loadQueue();
      toast.success('Post marcado como publicado.');
    } catch (error) {
      console.error('Falha ao marcar como publicado:', error);
      toast.error('Não foi possível marcar o post como publicado.');
    }
  };

  const filteredItems = useMemo(() => {
    const token = deferredSearch.trim().toLowerCase();
    if (!token) return items;
    return items.filter((item) =>
      [item.client_name, item.title, item.description, item.post_type]
        .map((value) => String(value || '').toLowerCase())
        .some((value) => value.includes(token))
    );
  }, [deferredSearch, items]);

  const summary = useMemo(() => {
    const urgent = items.filter((item) => getUrgencyTone(item, mode).label.includes('🔴')).length;
    const uniqueClients = new Set(items.map((item) => item.client_id).filter(Boolean)).size;
    const averageDays =
      items.length === 0
        ? 0
        : Math.round(items.reduce((total, item) => total + getWaitingDays(item), 0) / items.length);

    return {
      total: items.length,
      urgent,
      uniqueClients,
      averageDays,
    };
  }, [items, mode]);

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              {mode === 'scheduling' ? 'Operação de agenda' : 'Operação de publicação'}
            </div>
            <div>
              <h1 className="text-3xl font-semibold text-slate-950">{page.title}</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-600">{page.subtitle}</p>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <label className="flex min-w-[260px] items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
              <Search size={16} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por cliente ou post"
                className="w-full bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
              />
            </label>
            <button
              type="button"
              onClick={handleRefresh}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
              Atualizar
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Total</p>
            <p className="mt-2 text-2xl font-semibold text-slate-950">{summary.total}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Urgentes</p>
            <p className="mt-2 text-2xl font-semibold text-slate-950">{summary.urgent}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Clientes</p>
            <p className="mt-2 text-2xl font-semibold text-slate-950">{summary.uniqueClients}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">SLA médio</p>
            <p className="mt-2 text-2xl font-semibold text-slate-950">{summary.averageDays} dia(s)</p>
          </div>
        </div>
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        {loading ? (
          <div className="flex min-h-[220px] items-center justify-center text-sm text-slate-500">
            Carregando operação...
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="flex min-h-[220px] flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-slate-50/80 px-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-slate-500 shadow-sm">
              {mode === 'scheduling' ? <CalendarDays size={22} /> : <Rocket size={22} />}
            </div>
            <h2 className="mt-4 text-lg font-semibold text-slate-900">{page.emptyTitle}</h2>
            <p className="mt-2 max-w-xl text-sm text-slate-500">{page.emptyHint}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredItems.map((item) => {
              const operationalBadge = getWorkflowOperationalBadge(item.workflow_status);
              const urgency = getUrgencyTone(item, mode);
              const waitingDays = getWaitingDays(item);

              return (
                <article
                  key={item.id}
                  className="rounded-3xl border border-slate-200 bg-white p-5 transition hover:border-slate-300 hover:shadow-sm"
                >
                  <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-white">
                          {item.client_name}
                        </span>
                        {operationalBadge ? (
                          <span
                            className={cn(
                              'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold',
                              operationalBadge.className
                            )}
                          >
                            {operationalBadge.label}
                          </span>
                        ) : null}
                        <span
                          className={cn(
                            'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold',
                            urgency.className
                          )}
                        >
                          {urgency.label}
                        </span>
                      </div>

                      <div>
                        <h2 className="text-xl font-semibold text-slate-950">
                          {item.title || item.post_type || 'Post sem título'}
                        </h2>
                        <p className="mt-1 max-w-3xl text-sm text-slate-600">
                          {item.description || 'Briefing não informado.'}
                        </p>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Status</p>
                          <p className="mt-2 text-sm font-medium text-slate-900">
                            {operationalBadge?.label || item.workflow_status || 'Sem status'}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Data</p>
                          <p className="mt-2 text-sm font-medium text-slate-900">
                            {formatDateLabel(item.scheduled_date || item.post_date || null)}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Hora</p>
                          <p className="mt-2 text-sm font-medium text-slate-900">
                            {formatTimeLabel(item.scheduled_date || item.post_date || null)}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                            {mode === 'scheduling' ? 'Aprovado há' : 'SLA'}
                          </p>
                          <p className="mt-2 text-sm font-medium text-slate-900">{waitingDays} dia(s)</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex min-w-[220px] flex-col gap-3">
                      <button
                        type="button"
                        onClick={() => openScheduleModal(item)}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
                      >
                        <Clock3 size={16} />
                        {page.actionLabel}
                      </button>

                      {mode === 'scheduled' ? (
                        <button
                          type="button"
                          onClick={() => void handleMarkPublished(item)}
                          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 transition hover:bg-emerald-100"
                        >
                          <CheckCircle2 size={16} />
                          Marcar como publicado
                        </button>
                      ) : null}

                      <Link
                        to={getCalendarHref(item)}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                      >
                        <CalendarDays size={16} />
                        Abrir no calendário
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {selectedItem ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-[2px]">
          <div className="w-full max-w-xl rounded-[28px] border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  {selectedItem.client_name}
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-950">
                  {mode === 'scheduled' ? 'Reagendar publicação' : 'Confirmar agendamento'}
                </h2>
                <p className="mt-2 text-sm text-slate-600">
                  {selectedItem.title || selectedItem.post_type || 'Post sem título'}
                </p>
              </div>

              <button
                type="button"
                onClick={closeScheduleModal}
                className="rounded-full border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50"
              >
                <X size={16} />
              </button>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">Data de publicação</span>
                <input
                  type="date"
                  value={scheduledDate}
                  onChange={(event) => setScheduledDate(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">Horário de publicação</span>
                <input
                  type="time"
                  value={scheduledTime}
                  onChange={(event) => setScheduledTime(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                />
              </label>
            </div>

            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Supabase: esta ação grava na tabela <strong>public.posting_calendar_items</strong> e atualiza as
              colunas <strong>workflow_status</strong>, <strong>scheduled_date</strong> e
              <strong>published_at</strong> quando necessário.
            </div>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeScheduleModal}
                className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmSchedule()}
                disabled={saving}
                className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? 'Salvando...' : mode === 'scheduled' ? 'Salvar novo horário' : 'Confirmar agendamento'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default PostingOperationsBoard;
