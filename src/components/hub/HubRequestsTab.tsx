import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  Inbox,
  Link2,
  Loader2,
  Paperclip,
  Tag,
  User,
  XCircle,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { intakeService } from '@/services';
import { cn } from '@/utils/cn';

type IntakePriority = 'low' | 'medium' | 'high' | 'urgent';
type IntakeStatus = 'new' | 'triaged' | 'in_progress' | 'completed' | 'cancelled';
type IntakeType = 'general' | 'creative' | 'campaign' | 'support' | 'onboarding' | 'internal';

interface IntakeRow {
  id: string;
  title: string;
  description: string | null;
  status: IntakeStatus;
  priority: IntakePriority;
  type: IntakeType;
  client_id: string;
  client_name?: string | null;
  assignee_name?: string | null;
  created_at: string;
  deadline?: string | null;
  task_id?: string | null;
  form_data?: {
    references?: string | null;
    request_kind?: string | null;
    attachment?: {
      public_url?: string | null;
      name?: string | null;
      size_bytes?: number | null;
    } | null;
  } | null;
}

const STATUS_TABS: { key: IntakeStatus | 'all'; label: string; icon: React.ElementType }[] = [
  { key: 'all', label: 'Todas', icon: Inbox },
  { key: 'new', label: 'Novas', icon: AlertCircle },
  { key: 'triaged', label: 'Triadas', icon: ArrowRight },
  { key: 'in_progress', label: 'Em andamento', icon: Calendar },
  { key: 'completed', label: 'Concluídas', icon: CheckCircle2 },
  { key: 'cancelled', label: 'Canceladas', icon: XCircle },
];

const STATUS_STYLE: Record<IntakeStatus, { badge: string; label: string }> = {
  new: { badge: 'bg-blue-100 text-blue-700', label: 'Nova' },
  triaged: { badge: 'bg-amber-100 text-amber-700', label: 'Triada' },
  in_progress: { badge: 'bg-violet-100 text-violet-700', label: 'Em andamento' },
  completed: { badge: 'bg-emerald-100 text-emerald-700', label: 'Concluída' },
  cancelled: { badge: 'bg-slate-100 text-slate-500', label: 'Cancelada' },
};

const PRIORITY_STYLE: Record<IntakePriority, { dot: string; label: string }> = {
  low: { dot: 'bg-slate-300', label: 'Baixa' },
  medium: { dot: 'bg-amber-400', label: 'Média' },
  high: { dot: 'bg-orange-500', label: 'Alta' },
  urgent: { dot: 'bg-rose-500', label: 'Urgente' },
};

const TYPE_LABEL: Record<IntakeType, string> = {
  general: 'Geral',
  creative: 'Criativo',
  campaign: 'Campanha',
  support: 'Suporte',
  onboarding: 'Onboarding',
  internal: 'Interno',
};

const NEXT_STATUS: Partial<Record<IntakeStatus, IntakeStatus>> = {
  new: 'triaged',
  triaged: 'in_progress',
  in_progress: 'completed',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

interface RequestCardProps {
  request: IntakeRow;
  busy: boolean;
  onAdvance: (request: IntakeRow) => void;
  onCancel: (request: IntakeRow) => void;
  onCreateTask: (request: IntakeRow) => void;
}

function RequestCard({ request, busy, onAdvance, onCancel, onCreateTask }: RequestCardProps) {
  const statusMeta = STATUS_STYLE[request.status];
  const priorityMeta = PRIORITY_STYLE[request.priority] ?? PRIORITY_STYLE.medium;
  const nextStatus = NEXT_STATUS[request.status];

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900">{request.title}</p>
          {request.description ? (
            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500">{request.description}</p>
          ) : (
            <p className="mt-1 text-xs italic text-slate-400">Sem descrição cadastrada.</p>
          )}
        </div>
        <span className={cn('shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium', statusMeta.badge)}>
          {statusMeta.label}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600">
          <span className={cn('h-2 w-2 rounded-full', priorityMeta.dot)} />
          {priorityMeta.label}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600">
          <Tag size={11} />
          {TYPE_LABEL[request.type] ?? request.type}
        </span>
        {request.form_data?.request_kind ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600">
            <Inbox size={11} />
            {request.form_data.request_kind}
          </span>
        ) : null}
        {request.assignee_name ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600">
            <User size={11} />
            {request.assignee_name}
          </span>
        ) : null}
        {request.deadline ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600">
            <Calendar size={11} />
            {new Date(request.deadline).toLocaleDateString('pt-BR')}
          </span>
        ) : null}
        {request.task_id ? (
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
            Tarefa vinculada
          </span>
        ) : null}
      </div>

      {request.form_data?.references || request.form_data?.attachment?.public_url ? (
        <div className="mt-3 space-y-3 rounded-xl border border-slate-200 bg-slate-50/80 p-3">
          {request.form_data?.references ? (
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Referências</p>
              <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-slate-600">{request.form_data.references}</p>
            </div>
          ) : null}
          {request.form_data?.attachment?.public_url ? (
            <a
              href={request.form_data.attachment.public_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 transition hover:text-slate-900"
            >
              <Paperclip size={12} />
              {request.form_data.attachment.name || 'Abrir anexo'}
              <Link2 size={12} />
            </a>
          ) : null}
        </div>
      ) : null}

      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-[11px] font-medium text-slate-400">Recebida em {formatDate(request.created_at)}</p>

        {request.status !== 'completed' && request.status !== 'cancelled' ? (
          <div className="flex flex-wrap items-center justify-end gap-2">
            {nextStatus ? (
              <button
                type="button"
                onClick={() => onAdvance(request)}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-lg border border-lime-200 bg-lime-50 px-3 py-2 text-xs font-medium text-lime-700 transition hover:bg-lime-100 disabled:opacity-50"
              >
                <ArrowRight size={12} />
                Avançar
              </button>
            ) : null}

            {request.status === 'triaged' && request.client_id ? (
              <button
                type="button"
                onClick={() => onCreateTask(request)}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
              >
                <CheckCircle2 size={12} />
                Criar tarefa
              </button>
            ) : null}

            <button
              type="button"
              onClick={() => onCancel(request)}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"
            >
              <XCircle size={12} />
              Cancelar
            </button>
          </div>
        ) : null}
      </div>
    </motion.article>
  );
}

interface HubRequestsTabProps {
  clientId: string | null;
}

export const HubRequestsTab: React.FC<HubRequestsTabProps> = ({ clientId }) => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<IntakeStatus | 'all'>('all');

  const { data: requests = [], isLoading, isError } = useQuery<IntakeRow[]>({
    queryKey: ['hub-intake-requests', clientId],
    enabled: !!clientId,
    staleTime: 120_000,
    queryFn: async () => {
      if (!clientId) return [];

      const { data, error } = await supabase
        .from('intake_requests')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      return (data ?? []) as IntakeRow[];
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: IntakeStatus }) => {
      const { error } = await supabase.from('intake_requests').update({ status }).eq('id', id);
      if (error) throw error;
      return { id, status };
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['hub-intake-requests', clientId] }),
        queryClient.invalidateQueries({ queryKey: ['intake'] }),
      ]);
    },
  });

  const createTask = useMutation({
    mutationFn: (intakeId: string) => intakeService.createTaskFromIntake(intakeId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['hub-intake-requests', clientId] }),
        queryClient.invalidateQueries({ queryKey: ['intake'] }),
        queryClient.invalidateQueries({ queryKey: ['boards'] }),
      ]);
    },
  });

  const filteredRequests = useMemo(() => {
    if (activeTab === 'all') return requests;
    return requests.filter((request) => request.status === activeTab);
  }, [activeTab, requests]);

  const counts = useMemo(
    () =>
      requests.reduce<Record<IntakeStatus, number>>(
        (acc, request) => {
          acc[request.status] += 1;
          return acc;
        },
        {
          new: 0,
          triaged: 0,
          in_progress: 0,
          completed: 0,
          cancelled: 0,
        }
      ),
    [requests]
  );

  if (!clientId) return null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center rounded-[32px] border border-dashed border-slate-200 py-20">
        <Loader2 size={28} className="animate-spin text-lime-600" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center rounded-[32px] border border-dashed border-rose-200 bg-rose-50/40 py-20">
        <p className="text-sm font-black text-rose-600">Erro ao carregar solicitações</p>
        <p className="mt-1 text-xs text-rose-400">Recarregue a tela para tentar novamente.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-600">Novas: {counts.new}</span>
        <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-600">Triadas: {counts.triaged}</span>
        <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-600">Em andamento: {counts.in_progress}</span>
        <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-600">Concluídas: {counts.completed}</span>
        <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-600">Canceladas: {counts.cancelled}</span>
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUS_TABS.map(({ key, label, icon: Icon }) => {
          const count = key === 'all' ? requests.length : counts[key];
          const active = activeTab === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key)}
              className={cn(
                'inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-colors',
                active
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              )}
            >
              <Icon size={14} />
              {label}
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-[10px] font-medium',
                  active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {filteredRequests.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-200 py-16 text-center">
          <Inbox size={32} className="text-slate-300" />
          <div>
            <p className="font-medium text-slate-500">Nenhuma solicitação nesta etapa</p>
            <p className="mt-1 text-sm text-slate-400">
              Quando o cliente abrir um novo pedido ou o time avançar o fluxo, ele aparecerá aqui.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          <AnimatePresence mode="popLayout">
            {filteredRequests.map((request) => (
              <RequestCard
                key={request.id}
                request={request}
                busy={updateStatus.isPending || createTask.isPending}
                onAdvance={(item) => {
                  const nextStatus = NEXT_STATUS[item.status];
                  if (!nextStatus) return;
                  updateStatus.mutate({ id: item.id, status: nextStatus });
                }}
                onCancel={(item) => updateStatus.mutate({ id: item.id, status: 'cancelled' })}
                onCreateTask={(item) => createTask.mutate(item.id)}
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};
