import React, { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Calendar, CalendarCheck2, CheckCircle2, ClipboardList, ExternalLink, Send, Sparkles } from 'lucide-react';
import { useCentralApprovalQueue, useUpdateQueueChecklist } from '@/hooks/useContentApprovals';
import { useSchedulePost, useUpdateWorkflowStatus } from '@/hooks/useHubData';
import type { CalendarChecklistField, CentralApprovalQueueItem } from '@/services/content-approval.service';
import type { HubPost } from '@/services/hub.service';
import { STATUS_META } from './HubPostCard';
import { formatPostDate } from '@/utils/localDate';
import { cn } from '@/utils/cn';

interface Props {
  posts: HubPost[];
  clientId: string;
  year: number;
  month: number;
  onOpenPost?: (post: HubPost) => void;
}

const toInputDateTime = (value?: string | null) => {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  const offset = parsed.getTimezoneOffset();
  const local = new Date(parsed.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
};

function SectionCard({
  title,
  description,
  count,
  tone,
  children,
}: {
  title: string;
  description: string;
  count: number;
  tone: 'lime' | 'amber' | 'orange' | 'sky' | 'indigo';
  children: React.ReactNode;
}) {
  const toneClass = {
    lime: 'border-lime-200',
    amber: 'border-amber-200',
    orange: 'border-orange-200',
    sky: 'border-sky-200',
    indigo: 'border-indigo-200',
  }[tone];

  return (
    <section className={cn('overflow-hidden rounded-2xl border bg-white shadow-sm', toneClass)}>
      <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          <p className="mt-1 text-xs text-slate-500">{description}</p>
        </div>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
          {count}
        </span>
      </div>
      <div className="divide-y divide-slate-100">{children}</div>
    </section>
  );
}

function ChecklistToggle({
  label,
  checked,
  busy,
  onToggle,
}: {
  label: string;
  checked: boolean;
  busy: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={busy}
      className={cn(
        'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-black transition-all disabled:opacity-50',
        checked
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
          : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
      )}
    >
      <span className={cn('h-2 w-2 rounded-full', checked ? 'bg-emerald-500' : 'bg-slate-300')} />
      {label}
    </button>
  );
}

function QueueCard({
  post,
  year,
  month,
  clientId,
  onOpenPost,
}: {
  post: CentralApprovalQueueItem;
  year: number;
  month: number;
  clientId: string;
  onOpenPost?: (post: HubPost) => void;
}) {
  const queryClient = useQueryClient();
  const updateStatus = useUpdateWorkflowStatus();
  const updateChecklist = useUpdateQueueChecklist();

  const invalidateHub = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['hub-posts', clientId, year, month] }),
      queryClient.invalidateQueries({ queryKey: ['content-approvals', 'central-queue'] }),
    ]);
  };

  const asHubPost: HubPost = {
    id: post.id,
    client_id: post.client_id ?? clientId,
    post_date: post.post_date ?? '',
    title: post.title,
    description: post.description,
    image_url: post.image_url,
    video_url: post.video_url,
    workflow_status: post.workflow_status,
    scheduled_date: null,
    published_at: null,
    version_number: post.current_version_number ?? post.version_number ?? 1,
    revision_count: post.revision_count,
    post_type: post.post_type,
    channel: null,
    created_at: '',
    updated_at: '',
  };

  const canApproveInternal = post.workflow_status === 'revisao_interna';
  const canSendClient = post.workflow_status === 'aprovado_interno';
  const canReturnToDraft = post.workflow_status === 'revisao_interna';
  const canResumeReview = post.workflow_status === 'revisao_cliente';
  const checklistReady = post.checklist_arte_ok && post.checklist_legenda_ok;

  const handleWorkflowChange = (status: HubPost['workflow_status']) => {
    updateStatus.mutate(
      {
        postId: post.id,
        status,
        clientId,
        year,
        month,
      },
      {
        onSuccess: () => {
          void invalidateHub();
        },
      }
    );
  };

  const toggleChecklist = (field: CalendarChecklistField, value: boolean) => {
    updateChecklist.mutate(
      { postId: post.id, field, value },
      {
        onSuccess: () => {
          void invalidateHub();
        },
      }
    );
  };

  return (
    <div className="flex flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center">
      <div className="min-w-0 flex-1">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900">{post.title ?? 'Sem título'}</p>
          <p className="mt-1 text-xs text-slate-500">
            {post.post_date ? formatPostDate(post.post_date) : 'Sem data definida'}
            {post.post_type ? ` · ${post.post_type}` : ''}
          </p>
        </div>

        <div className="mt-2 flex flex-wrap gap-2">
          <span className={cn('rounded-full px-2 py-1 text-[10px] font-medium', STATUS_META[post.workflow_status].color)}>
            {STATUS_META[post.workflow_status].label}
          </span>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-medium text-slate-600">
            Versão {post.current_version_number ?? post.version_number ?? 1}
          </span>
          <span
            className={cn(
              'rounded-full px-2 py-1 text-[10px] font-medium',
              post.urgency === 'urgente'
                ? 'bg-rose-50 text-rose-700'
                : post.urgency === 'atencao'
                  ? 'bg-amber-50 text-amber-700'
                  : 'bg-emerald-50 text-emerald-700'
            )}
          >
            {post.urgency === 'urgente' ? 'Urgente' : post.urgency === 'atencao' ? 'Atenção' : 'Estável'}
          </span>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-medium text-slate-600">
            {post.waiting_days} dia(s) em fila
          </span>
        </div>

        <div className="mt-2 flex flex-wrap gap-2">
        <ChecklistToggle
          label="Arte"
          checked={post.checklist_arte_ok}
          busy={updateChecklist.isPending}
          onToggle={() => toggleChecklist('checklist_arte_ok', !post.checklist_arte_ok)}
        />
        <ChecklistToggle
          label="Legenda"
          checked={post.checklist_legenda_ok}
          busy={updateChecklist.isPending}
          onToggle={() => toggleChecklist('checklist_legenda_ok', !post.checklist_legenda_ok)}
        />
        </div>

        {canApproveInternal && !checklistReady ? (
          <p className="mt-2 text-[11px] font-medium text-amber-600">
            Valide arte e legenda antes de enviar para o cliente.
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2 lg:justify-end">
        {onOpenPost ? (
          <button
            type="button"
            onClick={() => onOpenPost(asHubPost)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
          >
            <ExternalLink size={12} />
            Abrir post
          </button>
        ) : null}

        {canApproveInternal ? (
          <button
            type="button"
            onClick={() => handleWorkflowChange('aprovado_interno')}
            disabled={!checklistReady || updateStatus.isPending}
            className="inline-flex items-center gap-1.5 rounded-lg border border-lime-200 bg-lime-50 px-3 py-2 text-xs font-medium text-lime-700 transition hover:bg-lime-100 disabled:opacity-50"
          >
            <CheckCircle2 size={12} />
            Aprovar interno
          </button>
        ) : null}

        {canSendClient ? (
          <button
            type="button"
            onClick={() => handleWorkflowChange('em_aprovacao_cliente')}
            disabled={updateStatus.isPending}
            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700 transition hover:bg-amber-100 disabled:opacity-50"
          >
            <Send size={12} />
            Enviar cliente
          </button>
        ) : null}

        {canResumeReview ? (
          <button
            type="button"
            onClick={() => handleWorkflowChange('revisao_interna')}
            disabled={updateStatus.isPending}
            className="inline-flex items-center gap-1.5 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-xs font-medium text-orange-700 transition hover:bg-orange-100 disabled:opacity-50"
          >
            <Sparkles size={12} />
            Retomar revisão
          </button>
        ) : null}

        {canReturnToDraft ? (
          <button
            type="button"
            onClick={() => handleWorkflowChange('rascunho')}
            disabled={updateStatus.isPending}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"
          >
            Solicitar ajuste
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function HubApprovalsTab({ posts, clientId, year, month, onOpenPost }: Props) {
  const queryClient = useQueryClient();
  const updateStatus = useUpdateWorkflowStatus();
  const schedulePost = useSchedulePost();
  const [scheduleDrafts, setScheduleDrafts] = useState<Record<string, string>>({});

  const { data: queue = [] } = useCentralApprovalQueue({
    clientId,
    limit: 250,
  });

  const internalReview = useMemo(
    () => queue.filter((post) => post.workflow_status === 'revisao_interna'),
    [queue]
  );
  const readyForClient = useMemo(
    () => queue.filter((post) => post.workflow_status === 'aprovado_interno'),
    [queue]
  );
  const revisionRequested = useMemo(
    () => queue.filter((post) => post.workflow_status === 'revisao_cliente'),
    [queue]
  );
  const awaitingClient = useMemo(
    () => posts.filter((post) => post.workflow_status === 'em_aprovacao_cliente'),
    [posts]
  );
  const readyToSchedule = useMemo(
    () => posts.filter((post) => ['aprovado_cliente', 'aguardando_agendamento'].includes(post.workflow_status)),
    [posts]
  );
  const scheduledPosts = useMemo(
    () => posts.filter((post) => post.workflow_status === 'agendado'),
    [posts]
  );

  const totalTracked =
    internalReview.length +
    readyForClient.length +
    awaitingClient.length +
    revisionRequested.length +
    readyToSchedule.length +
    scheduledPosts.length;

  if (totalTracked === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 py-18">
        <ClipboardList size={32} className="mb-3 text-slate-300" aria-hidden="true" />
        <p className="font-medium text-slate-500">Nenhum item pendente no fluxo de aprovação e agenda</p>
        <p className="mt-1 text-sm text-slate-400">Tudo certo por aqui 🎉</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-600">Em revisão: {internalReview.length}</span>
        <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-600">Prontos p/ cliente: {readyForClient.length}</span>
        <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-600">Aguardando cliente: {awaitingClient.length}</span>
        <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-600">Ajustes: {revisionRequested.length}</span>
        <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-600">Prontos p/ agenda: {readyToSchedule.length}</span>
        <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-600">Agendados: {scheduledPosts.length}</span>
      </div>

      {internalReview.length > 0 && (
        <SectionCard
          title="Revisão da equipe"
          description="Posts em checkpoint interno. O envio ao cliente só acontece depois da validação manual da equipe."
          count={internalReview.length}
          tone="lime"
        >
          {internalReview.map((post) => (
            <QueueCard
              key={post.id}
              post={post}
              clientId={clientId}
              year={year}
              month={month}
              onOpenPost={onOpenPost}
            />
          ))}
        </SectionCard>
      )}

      {readyForClient.length > 0 && (
        <SectionCard
          title="Prontos para envio ao cliente"
          description="Itens já aprovados internamente e aguardando disparo manual para o portal."
          count={readyForClient.length}
          tone="amber"
        >
          {readyForClient.map((post) => (
            <QueueCard
              key={post.id}
              post={post}
              clientId={clientId}
              year={year}
              month={month}
              onOpenPost={onOpenPost}
            />
          ))}
        </SectionCard>
      )}

      {awaitingClient.length > 0 && (
        <SectionCard
          title="Aguardando cliente"
          description="Posts já enviados para o portal e aguardando decisão do cliente."
          count={awaitingClient.length}
          tone="amber"
        >
          {awaitingClient.map((post) => {
            const meta = STATUS_META[post.workflow_status];
            return (
              <div key={post.id} className="flex items-center gap-4 px-4 py-3">
                <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', meta.dot)} aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-900">{post.title ?? 'Sem título'}</p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    <span className="text-[10px] text-slate-400">{formatPostDate(post.post_date)}</span>
                    {post.channel ? (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">
                        {post.channel}
                      </span>
                    ) : null}
                    {post.post_type ? (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">
                        {post.post_type}
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-medium text-slate-600">
                  Aguardando resposta do cliente no portal.
                </div>
              </div>
            );
          })}
        </SectionCard>
      )}

      {revisionRequested.length > 0 && (
        <SectionCard
          title="Cliente pediu ajustes"
          description="Posts que voltaram do portal e já retornaram para o checkpoint da equipe."
          count={revisionRequested.length}
          tone="orange"
        >
          {revisionRequested.map((post) => (
            <QueueCard
              key={post.id}
              post={post}
              clientId={clientId}
              year={year}
              month={month}
              onOpenPost={onOpenPost}
            />
          ))}
        </SectionCard>
      )}

      {readyToSchedule.length > 0 && (
        <SectionCard
          title="Prontos para agendar"
          description="Posts aprovados pelo cliente e aguardando definição de data e hora."
          count={readyToSchedule.length}
          tone="sky"
        >
          {readyToSchedule.map((post) => {
            const inputValue = scheduleDrafts[post.id] ?? toInputDateTime(post.scheduled_date);
            return (
              <div key={post.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">{post.title ?? 'Sem título'}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {post.workflow_status === 'aguardando_agendamento'
                        ? 'Já está na fila de agendamento. Defina a data final abaixo.'
                        : 'Aprovado pelo cliente. Falta definir data e hora.'}
                    </p>
                  </div>
                  <span className={cn('rounded-full px-2 py-1 text-[10px] font-bold', STATUS_META[post.workflow_status].color)}>
                    {STATUS_META[post.workflow_status].label}
                  </span>
                </div>

                <div className="mt-4 flex flex-col gap-3 xl:flex-row xl:items-center">
                  <input
                    type="datetime-local"
                    value={inputValue}
                    onChange={(event) =>
                      setScheduleDrafts((current) => ({
                        ...current,
                        [post.id]: event.target.value,
                      }))
                    }
                    className="field-control h-10 text-sm xl:flex-1"
                  />
                  <div className="flex items-center gap-2">
                    {onOpenPost ? (
                      <button
                        type="button"
                        onClick={() => onOpenPost(post)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
                      >
                        <ExternalLink size={12} />
                        Abrir
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => {
                        if (!inputValue) return;
                        schedulePost.mutate({
                          postId: post.id,
                          scheduledDate: new Date(inputValue).toISOString(),
                          clientId,
                          year,
                          month,
                        });
                        void queryClient.invalidateQueries({ queryKey: ['content-approvals', 'central-queue'] });
                      }}
                      disabled={!inputValue || schedulePost.isPending}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-medium text-sky-700 transition hover:bg-sky-100 disabled:opacity-50"
                    >
                      <Calendar size={12} />
                      Agendar
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </SectionCard>
      )}

      {scheduledPosts.length > 0 && (
        <SectionCard
          title="Agendados"
          description="Posts já agendados e prontos para virar publicado quando a publicação for confirmada."
          count={scheduledPosts.length}
          tone="indigo"
        >
          {scheduledPosts.map((post) => (
            <div key={post.id} className="flex items-center gap-4 px-4 py-3">
              <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', STATUS_META[post.workflow_status].dot)} aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900">{post.title ?? 'Sem título'}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {post.scheduled_date
                    ? `Agendado para ${new Date(post.scheduled_date).toLocaleString('pt-BR')}.`
                    : 'Agendado sem data visível.'}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {onOpenPost ? (
                  <button
                    type="button"
                    onClick={() => onOpenPost(post)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
                  >
                    <ExternalLink size={12} />
                    Abrir
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() =>
                    updateStatus.mutate(
                      { postId: post.id, status: 'publicado', clientId, year, month },
                      {
                        onSuccess: () => {
                          void queryClient.invalidateQueries({ queryKey: ['content-approvals', 'central-queue'] });
                        },
                      }
                    )
                  }
                  disabled={updateStatus.isPending}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-medium text-indigo-700 transition hover:bg-indigo-100 disabled:opacity-50"
                >
                  <CalendarCheck2 size={12} />
                  Marcar publicado
                </button>
              </div>
            </div>
          ))}
        </SectionCard>
      )}
    </div>
  );
}
