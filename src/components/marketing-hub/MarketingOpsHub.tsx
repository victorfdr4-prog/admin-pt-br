import React, { useMemo, useState } from 'react';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import { ptBR as dateFnsPtBR } from 'date-fns/locale';
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Copy,
  Loader2,
  MessageSquareShare,
  Rocket,
  Send,
  X,
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  WorkflowTone,
  getWorkflowOperationalBadge,
  normalizeWorkflowStatusId,
  type PostingCalendarItemRecord,
} from '@/components/posting-calendar/PostingCalendarShared';
import { normalizeSystemRole } from '@/domain/accessControl';
import { normalizeWorkflowStatus, type Role, type WorkflowStatus } from '@/domain/postWorkflow';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { PostWorkflowService, systemError, systemLog } from '@/services';
import { useAuthStore } from '@/store/useAuthStore';
import { toast } from '@/components/ui/sonner';

type HubStatusId =
  | 'revisao_interna'
  | 'aprovado_interno'
  | 'em_aprovacao_cliente'
  | 'aprovado_cliente'
  | 'aguardando_agendamento'
  | 'agendado'
  | 'publicado';

interface MarketingClient {
  id: string;
  name: string;
  slug?: string | null;
}

interface MarketingOpsHubProps {
  clients: MarketingClient[];
}

interface MarketingPost extends PostingCalendarItemRecord {
  client_name: string;
  client_slug?: string | null;
  hub_status: HubStatusId;
}

interface ApprovalReminderGroup {
  clientId: string;
  clientName: string;
  clientSlug?: string | null;
  count: number;
  posts: MarketingPost[];
}

const WORKFLOW_STATUS_LABELS: Record<string, string> = {
  rascunho: 'Rascunho',
  revisao_interna: 'Revisão interna',
  aprovado_interno: 'Aprovado internamente',
  em_aprovacao_cliente: 'Pendente do cliente',
  revisao_cliente: 'Ajuste solicitado',
  aprovado_cliente: 'Aprovado pelo cliente',
  aguardando_agendamento: 'Aguardando agendamento',
  agendado: 'Agendado',
  publicado: 'Publicado',
};

const HUB_COLUMNS: Array<{
  id: HubStatusId;
  label: string;
  subtitle: string;
  accent: string;
}> = [
  {
    id: 'revisao_interna',
    label: 'Revisão Interna',
    subtitle: 'Conteúdo em preparo ou ajuste interno',
    accent: 'bg-slate-900',
  },
  {
    id: 'aprovado_interno',
    label: 'Aprovado Internamente',
    subtitle: 'Validado pela equipe e pronto para seguir',
    accent: 'bg-emerald-500',
  },
  {
    id: 'em_aprovacao_cliente',
    label: 'Em Aprovação',
    subtitle: 'Esperando resposta do cliente',
    accent: 'bg-amber-500',
  },
  {
    id: 'aprovado_cliente',
    label: 'Aprovado pelo Cliente',
    subtitle: 'Validado e pronto para entrar na fila operacional',
    accent: 'bg-lime-500',
  },
  {
    id: 'aguardando_agendamento',
    label: 'Aguardando Agendamento',
    subtitle: 'Aprovado e esperando data real',
    accent: 'bg-yellow-500',
  },
  {
    id: 'agendado',
    label: 'Agendado',
    subtitle: 'Com data definida na operação',
    accent: 'bg-sky-500',
  },
  {
    id: 'publicado',
    label: 'Publicado',
    subtitle: 'Executado e concluído',
    accent: 'bg-emerald-500',
  },
];

const SOURCE_STATUSES: WorkflowStatus[] = [
  'rascunho',
  'revisao_interna',
  'aprovado_interno',
  'em_aprovacao_cliente',
  'revisao_cliente',
  'aprovado_cliente',
  'aguardando_agendamento',
  'agendado',
  'publicado',
];

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

const formatWorkflowLabel = (value?: string | null) => {
  const normalized = normalizeWorkflowStatusId(value);
  return WORKFLOW_STATUS_LABELS[normalized] || 'Sem status';
};

const formatDateInput = (value?: string | null) => {
  const parsed = parseDateValue(value);
  return parsed ? format(parsed, 'yyyy-MM-dd') : '';
};

const formatTimeInput = (value?: string | null) => {
  const parsed = parseDateValue(value);
  return parsed ? format(parsed, 'HH:mm') : '';
};

const buildScheduledDateTime = (dateValue: string, timeValue: string) => {
  if (!dateValue) return null;
  const parsed = new Date(`${dateValue}T${timeValue || '00:00'}:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
};

const getUrgencyTone = (post: MarketingPost) => {
  const scheduledDate = parseDateValue(post.scheduled_date || null);
  if (post.hub_status === 'aguardando_agendamento') {
    const approvedDate = parseDateValue(post.approved_at || post.updated_at || post.created_at || null);
    const waitingDays = approvedDate
      ? Math.max(0, Math.floor((Date.now() - approvedDate.getTime()) / 86400000))
      : 0;

    if (waitingDays > 2) {
      return {
        label: '🔴 atraso operacional',
        className: 'border-rose-200 bg-rose-50 text-rose-700',
      };
    }

    return {
      label: '🟡 pendente',
      className: 'border-amber-200 bg-amber-50 text-amber-700',
    };
  }

  if (scheduledDate && scheduledDate.getTime() < Date.now() && post.hub_status !== 'publicado') {
    return {
      label: '🔴 atrasado',
      className: 'border-rose-200 bg-rose-50 text-rose-700',
    };
  }

  if (post.hub_status === 'publicado') {
    return {
      label: '🟢 concluído',
      className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    };
  }

  return {
    label: '🔵 em fluxo',
    className: 'border-sky-200 bg-sky-50 text-sky-700',
  };
};

const mapWorkflowToHubStatus = (status: string | null | undefined): HubStatusId => {
  const normalized = normalizeWorkflowStatus(status);
  switch (normalized) {
    case 'rascunho':
    case 'revisao_cliente':
    case 'revisao_interna':
      return 'revisao_interna';
    case 'aprovado_interno':
      return 'aprovado_interno';
    case 'em_aprovacao_cliente':
      return 'em_aprovacao_cliente';
    case 'aprovado_cliente':
      return 'aprovado_cliente';
    case 'aguardando_agendamento':
      return 'aguardando_agendamento';
    case 'agendado':
      return 'agendado';
    case 'publicado':
      return 'publicado';
    default:
      return 'revisao_interna';
  }
};

const buildHubMessage = (group: ApprovalReminderGroup) => {
  const firstPost = group.posts[0];
  const monthBase =
    parseDateValue(firstPost?.scheduled_date || firstPost?.post_date || null) || new Date();
  const monthLabel = format(monthBase, 'MMMM yyyy', { locale: dateFnsPtBR });
  const portalPath = `/portal/${group.clientSlug || group.clientId}`;
  const portalUrl =
    typeof window !== 'undefined' ? `${window.location.origin}${portalPath}` : portalPath;

  return `🚨 APROVAÇÃO NECESSÁRIA

Cliente: ${group.clientName}
Calendário: ${monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)}
Posts pendentes: ${group.count}

Seu conteúdo está aguardando validação no Portal da Cromia Comunicação

👉 Acesse:
${portalUrl}

⏱ Leva menos de 1 minuto
⚠ Sem aprovação não será publicado
⚠ Pedimos que revise todo o conteúdo antes de confirmar`;
};

const getStatusAccentClass = (value?: string | null) => {
  const normalized = normalizeWorkflowStatusId(value);

  switch (normalized) {
    case 'publicado':
      return 'bg-emerald-500';
    case 'agendado':
      return 'bg-sky-500';
    case 'aguardando_agendamento':
    case 'aprovado_cliente':
      return 'bg-amber-500';
    case 'em_aprovacao_cliente':
      return 'bg-yellow-500';
    case 'aprovado_interno':
      return 'bg-lime-500';
    case 'revisao_cliente':
      return 'bg-orange-500';
    default:
      return 'bg-slate-400';
  }
};

const MonthNavigator: React.FC<{
  monthLabel: string;
  onPrevious: () => void;
  onNext: () => void;
}> = ({ monthLabel, onPrevious, onNext }) => (
  <div className="flex items-center gap-2">
    <button
      type="button"
      onClick={onPrevious}
      className="rounded-full border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-50"
    >
      <ChevronLeft size={16} />
    </button>
    <span className="min-w-[180px] text-center text-sm font-semibold text-slate-900">{monthLabel}</span>
    <button
      type="button"
      onClick={onNext}
      className="rounded-full border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-50"
    >
      <ChevronRight size={16} />
    </button>
  </div>
);

const HubCard: React.FC<{ post: MarketingPost }> = ({ post }) => {
  const operationalBadge = getWorkflowOperationalBadge(post.workflow_status);
  const urgency = getUrgencyTone(post);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: post.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
  };

  return (
    <article
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="cursor-grab rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg active:cursor-grabbing"
    >
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              {post.client_name}
            </p>
            <h3 className="mt-1 text-sm font-semibold leading-snug text-slate-950">
              {post.title || post.post_type || 'Post sem título'}
            </h3>
          </div>
          <span
            className={cn(
              'inline-flex items-center rounded-full border px-2 py-1 text-[11px] font-semibold',
              urgency.className
            )}
          >
            {urgency.label}
          </span>
        </div>

        <p className="line-clamp-2 text-xs text-slate-600">
          {post.description || 'Briefing ainda não detalhado.'}
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <WorkflowTone value={post.workflow_status} />
          {operationalBadge ? (
            <span
              className={cn(
                'inline-flex items-center rounded-full border px-2 py-1 text-[11px] font-semibold',
                operationalBadge.className
              )}
            >
              {operationalBadge.label}
            </span>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-2 rounded-[18px] bg-slate-50 p-3 text-xs text-slate-600">
          <div>
            <p className="font-semibold uppercase tracking-[0.15em] text-slate-500">Versão</p>
            <p className="mt-1 text-sm font-medium text-slate-900">
              v{Number(post.version_number || post.current_version_number || 1)}
            </p>
          </div>
          <div>
            <p className="font-semibold uppercase tracking-[0.15em] text-slate-500">Status</p>
            <p className="mt-1 text-sm font-medium text-slate-900">
              {formatWorkflowLabel(post.hub_status)}
            </p>
          </div>
          <div>
            <p className="font-semibold uppercase tracking-[0.15em] text-slate-500">Data</p>
            <p className="mt-1 text-sm font-medium text-slate-900">
              {formatDateLabel(post.scheduled_date || post.post_date || null)}
            </p>
          </div>
          <div>
            <p className="font-semibold uppercase tracking-[0.15em] text-slate-500">Hora</p>
            <p className="mt-1 text-sm font-medium text-slate-900">
              {formatTimeLabel(post.scheduled_date || post.post_date || null)}
            </p>
          </div>
        </div>
      </div>
    </article>
  );
};

const HubColumn: React.FC<{
  id: HubStatusId;
  label: string;
  subtitle: string;
  accent: string;
  posts: MarketingPost[];
}> = ({ id, label, subtitle, accent, posts }) => {
  const { setNodeRef } = useDroppable({ id });

  return (
    <section className="flex min-w-[300px] max-w-[300px] shrink-0 flex-col rounded-[28px] border border-slate-200 bg-slate-50/80">
      <div className="border-b border-slate-200 px-4 py-4">
        <div className="flex items-center gap-2">
          <span className={cn('h-2.5 w-2.5 rounded-full', accent)} />
          <h2 className="text-sm font-semibold text-slate-950">{label}</h2>
          <span className="ml-auto rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs font-semibold text-slate-600">
            {posts.length}
          </span>
        </div>
        <p className="mt-2 text-xs text-slate-500">{subtitle}</p>
      </div>

      <div ref={setNodeRef} className="flex min-h-[320px] flex-1 flex-col gap-3 overflow-y-auto p-4">
        <SortableContext items={posts.map((post) => post.id)} strategy={verticalListSortingStrategy}>
          {posts.map((post) => (
            <HubCard key={post.id} post={post} />
          ))}
        </SortableContext>
        {posts.length === 0 ? (
          <div className="rounded-[22px] border border-dashed border-slate-200 bg-white/80 px-4 py-10 text-center text-xs text-slate-400">
            Arraste posts para esta etapa
          </div>
        ) : null}
      </div>
    </section>
  );
};

export default function MarketingOpsHub({ clients }: MarketingOpsHubProps) {
  const currentUserRole = useAuthStore((state) => state.user?.role);
  const workflowActorRole: Role =
    currentUserRole === 'blocked'
      ? 'admin_operacional'
      : (normalizeSystemRole(currentUserRole || 'admin_operacional') as Role);
  const queryClient = useQueryClient();

  const [activeDragPost, setActiveDragPost] = useState<MarketingPost | null>(null);
  const [schedulePost, setSchedulePost] = useState<MarketingPost | null>(null);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('09:00');
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [timelineMonth, setTimelineMonth] = useState(() => startOfMonth(new Date()));
  const [whatsAppGroup, setWhatsAppGroup] = useState<ApprovalReminderGroup | null>(null);

  const clientMap = useMemo(
    () =>
      new Map(
        clients.map((client) => [
          client.id,
          {
            name: client.name,
            slug: client.slug || null,
          },
        ])
      ),
    [clients]
  );

  const {
    data: rawPosts = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['marketing-ops-hub'],
    staleTime: 30_000,
    queryFn: async () => {
      console.log('SUPABASE: consultando tabela public.posting_calendar_items para o hub operacional');

      const buildQuery = () =>
        supabase
          .from('posting_calendar_items')
          .select('*')
          .in('workflow_status', SOURCE_STATUSES)
          .order('updated_at', { ascending: false });

      let response = await buildQuery().is('deleted_at', null);
      const missingDeletedAt =
        String((response.error as { message?: string } | null)?.message || '')
          .toLowerCase()
          .includes('deleted_at');

      if (response.error && missingDeletedAt) {
        response = await buildQuery();
      }

      if (response.error) throw response.error;

      return ((response.data || []) as Array<Record<string, unknown>>)
        .filter((row) => row.is_current_version !== false)
        .map((row) => row as PostingCalendarItemRecord);
    },
  });

  const posts = useMemo(
    () =>
      rawPosts.map((row) => {
        const clientId = String(row.client_id || '');
        const client = clientMap.get(clientId);
        const workflowStatus = normalizeWorkflowStatus(row.workflow_status as string | null | undefined);
        return {
          ...row,
          client_name: client?.name || 'Cliente',
          client_slug: client?.slug || null,
          hub_status: mapWorkflowToHubStatus(workflowStatus),
          workflow_status: workflowStatus,
        } as MarketingPost;
      }),
    [clientMap, rawPosts]
  );

  const groupedPosts = useMemo(() => {
    const map = new Map<HubStatusId, MarketingPost[]>();
    HUB_COLUMNS.forEach((column) => map.set(column.id, []));
    posts.forEach((post) => {
      const bucket = map.get(post.hub_status);
      if (bucket) bucket.push(post);
    });
    return map;
  }, [posts]);

  const approvalReminderGroups = useMemo<ApprovalReminderGroup[]>(() => {
    const grouped = new Map<string, ApprovalReminderGroup>();
    posts
      .filter((post) => post.hub_status === 'em_aprovacao_cliente')
      .forEach((post) => {
        const key = post.client_id || post.client_name;
        const current = grouped.get(key) || {
          clientId: String(post.client_id || key),
          clientName: post.client_name,
          clientSlug: post.client_slug || null,
          count: 0,
          posts: [],
        };
        current.count += 1;
        current.posts.push(post);
        grouped.set(key, current);
      });

    return Array.from(grouped.values()).sort((left, right) =>
      left.clientName.localeCompare(right.clientName, 'pt-BR')
    );
  }, [posts]);

  const unscheduledPosts = useMemo(
    () =>
      posts.filter(
        (post) =>
          ['aprovado_cliente', 'aguardando_agendamento'].includes(post.hub_status) && !post.scheduled_date
      ),
    [posts]
  );

  const overduePosts = useMemo(
    () =>
      posts.filter((post) => {
        if (post.hub_status === 'publicado') return false;
        const scheduledDate = parseDateValue(post.scheduled_date || post.post_date || null);
        return Boolean(scheduledDate && scheduledDate.getTime() < Date.now() && !isToday(scheduledDate));
      }),
    [posts]
  );

  const internalReviewPosts = useMemo(
    () => posts.filter((post) => post.hub_status === 'revisao_interna'),
    [posts]
  );

  const timelineItems = useMemo(
    () =>
      posts.filter((post) => {
        const scheduledDate = parseDateValue(post.scheduled_date || post.post_date || null);
        return Boolean(scheduledDate && isSameMonth(scheduledDate, timelineMonth));
      }),
    [posts, timelineMonth]
  );

  const calendarGridDays = useMemo(
    () =>
      eachDayOfInterval({
        start: startOfWeek(startOfMonth(timelineMonth), { weekStartsOn: 0 }),
        end: endOfWeek(endOfMonth(timelineMonth), { weekStartsOn: 0 }),
      }),
    [timelineMonth]
  );

  const timelineDays = useMemo(
    () =>
      eachDayOfInterval({
        start: startOfMonth(timelineMonth),
        end: endOfMonth(timelineMonth),
      }),
    [timelineMonth]
  );

  const formattedMonth = useMemo(() => {
    const label = format(timelineMonth, 'MMMM yyyy', { locale: dateFnsPtBR });
    return label.charAt(0).toUpperCase() + label.slice(1);
  }, [timelineMonth]);

  const monthCalendarItems = useMemo(() => {
    const grouped = new Map<string, MarketingPost[]>();

    timelineItems.forEach((post) => {
      const scheduledDate = parseDateValue(post.scheduled_date || post.post_date || null);
      if (!scheduledDate) return;

      const key = format(scheduledDate, 'yyyy-MM-dd');
      const bucket = grouped.get(key) || [];
      bucket.push(post);
      grouped.set(key, bucket);
    });

    return grouped;
  }, [timelineItems]);

  const monthOverview = useMemo(
    () => ({
      approvals: timelineItems.filter((post) => post.hub_status === 'em_aprovacao_cliente').length,
      scheduling: timelineItems.filter((post) =>
        ['aprovado_cliente', 'aguardando_agendamento'].includes(post.hub_status)
      ).length,
      scheduled: timelineItems.filter((post) => post.hub_status === 'agendado').length,
      published: timelineItems.filter((post) => post.hub_status === 'publicado').length,
    }),
    [timelineItems]
  );

  const moveToPreviousMonth = () => setTimelineMonth((current) => startOfMonth(subMonths(current, 1)));
  const moveToNextMonth = () => setTimelineMonth((current) => startOfMonth(addMonths(current, 1)));

  const refreshHub = async () => {
    await queryClient.invalidateQueries({ queryKey: ['marketing-ops-hub'] });
    await refetch();
  };

  const persistWorkflowStatus = async (
    post: MarketingPost,
    nextStatus: WorkflowStatus,
    options?: {
      scheduledDate?: string | null;
      publishedAt?: string | null;
    }
  ) => {
    if (nextStatus === 'agendado') {
      if (!options?.scheduledDate) {
        throw new Error('Defina data e horário antes de confirmar o agendamento.');
      }

      return PostWorkflowService.schedulePost({
        postId: post.id,
        role: workflowActorRole,
        scheduledDate: options.scheduledDate,
        comment: 'Agendamento confirmado pela Central Operacional.',
        metadata: {
          source: 'marketing_ops_hub',
          client_name: post.client_name,
        },
      });
    }

    if (nextStatus === 'publicado') {
      return PostWorkflowService.publishPost({
        postId: post.id,
        role: workflowActorRole,
        publishedAt: options?.publishedAt || new Date().toISOString(),
        comment: 'Publicação confirmada pela Central Operacional.',
        metadata: {
          source: 'marketing_ops_hub',
          scheduled_date: post.scheduled_date || post.post_date || null,
          client_name: post.client_name,
        },
      });
    }

    if (nextStatus === 'aprovado_interno') {
      return PostWorkflowService.applyResolvedTransition({
        postId: post.id,
        action: 'aprovar_interno',
        role: workflowActorRole,
        comment: 'Post aprovado internamente pela Central Operacional.',
        metadata: {
          source: 'marketing_ops_hub',
          client_name: post.client_name,
        },
      });
    }

    if (nextStatus === 'em_aprovacao_cliente') {
      return PostWorkflowService.applyResolvedTransition({
        postId: post.id,
        action: 'enviar_cliente',
        role: workflowActorRole,
        comment: 'Post enviado para aprovação do cliente pela Central Operacional.',
        metadata: {
          source: 'marketing_ops_hub',
          client_name: post.client_name,
        },
      });
    }

    if (nextStatus === 'aguardando_agendamento') {
      return PostWorkflowService.prepareScheduling({
        postId: post.id,
        role: workflowActorRole,
        comment: 'Post movido para a fila de agendamento pela Central Operacional.',
        metadata: {
          source: 'marketing_ops_hub',
          client_name: post.client_name,
        },
      });
    }

    throw new Error(`Ação não suportada pela Central Operacional para ${nextStatus}.`);
  };

  const handleDropStatus = async (post: MarketingPost, target: HubStatusId) => {
    const nextStatus = target as WorkflowStatus;
    if (mapWorkflowToHubStatus(post.workflow_status) === target) return;

    if (target === 'aprovado_cliente') {
      toast.info('A aprovação do cliente acontece pelo portal do cliente, não pelo hub interno.');
      return;
    }

    if (target === 'agendado' && !post.scheduled_date) {
      setSchedulePost(post);
      setScheduleDate(formatDateInput(post.post_date || new Date().toISOString()));
      setScheduleTime(formatTimeInput(post.post_date || null) || '09:00');
      return;
    }

    try {
      await persistWorkflowStatus(post, nextStatus);
      toast.success(`Post movido para ${target.replaceAll('_', ' ')}.`);
      await refreshHub();
    } catch (dropError) {
      console.error('Falha ao mover card:', dropError);
      await systemError({
        scope: 'marketing_hub',
        action: 'drag_status_failed',
        tableName: 'posting_calendar_items',
        message: 'Falha ao atualizar workflow pelo Kanban.',
        error: dropError,
        data: {
          postId: post.id,
          fromStatus: post.workflow_status,
          toStatus: target,
        },
      });
      toast.error(
        dropError instanceof Error
          ? dropError.message
          : 'Não foi possível mover o post para esta etapa.'
      );
    }
  };

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const handleDragStart = (event: DragStartEvent) => {
    const post = posts.find((entry) => entry.id === event.active.id) || null;
    setActiveDragPost(post);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveDragPost(null);
    const { active, over } = event;
    if (!over) return;

    const draggedPost = posts.find((entry) => entry.id === active.id);
    if (!draggedPost) return;

    const directColumnTarget = HUB_COLUMNS.find((column) => column.id === over.id);
    const cardTarget = posts.find((entry) => entry.id === over.id);
    const targetColumn = directColumnTarget?.id || cardTarget?.hub_status || null;
    if (!targetColumn) return;

    await handleDropStatus(draggedPost, targetColumn);
  };

  const closeScheduleModal = () => {
    if (savingSchedule) return;
    setSchedulePost(null);
    setScheduleDate('');
    setScheduleTime('09:00');
  };

  const handleConfirmScheduledDrop = async () => {
    if (!schedulePost) return;
    const nextScheduledDate = buildScheduledDateTime(scheduleDate, scheduleTime);
    if (!nextScheduledDate) {
      toast.error('Defina data e horário válidos para o agendamento.');
      return;
    }

    try {
      setSavingSchedule(true);
      await persistWorkflowStatus(schedulePost, 'agendado', {
        scheduledDate: nextScheduledDate,
      });
      toast.success('Agendamento confirmado pela Central Operacional.');
      closeScheduleModal();
      await refreshHub();
    } catch (scheduleError) {
      console.error('Falha ao confirmar agendamento pelo hub:', scheduleError);
      toast.error('Não foi possível confirmar o agendamento.');
    } finally {
      setSavingSchedule(false);
    }
  };

  const handleCopyWhatsApp = async () => {
    if (!whatsAppGroup) return;
    try {
      await navigator.clipboard.writeText(buildHubMessage(whatsAppGroup));
      toast.success('Copiado! Cole no WhatsApp.');
    } catch (clipboardError) {
      console.error('Falha ao copiar mensagem:', clipboardError);
      toast.error('Não foi possível copiar a mensagem.');
    }
  };

  const portalErrorCard = error
    ? 'Cliente: operação indisponível. A equipe precisa verificar o carregamento.'
    : null;

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(125,211,252,0.18),_transparent_28%),linear-gradient(180deg,_#f8fbff_0%,_#ffffff_24%,_#f8fafc_100%)] p-4">
      <section className="rounded-[24px] border border-slate-200/80 bg-white/90 p-5 shadow-sm backdrop-blur">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="space-y-2">
            <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
              Operação da agência
            </span>
            <div>
              <h1 className="text-[28px] font-semibold text-slate-950">Central Operacional</h1>
              <p className="mt-1.5 max-w-3xl text-sm text-slate-600">
                Operação diária da Cromia: aprovação, agenda, execução e publicação no mesmo fluxo.
              </p>
            </div>
          </div>

          <div className="grid gap-2.5 sm:grid-cols-4">
            <div className="rounded-[20px] border border-slate-200 bg-slate-50 px-3.5 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Posts ativos</p>
              <p className="mt-1.5 text-[26px] font-semibold text-slate-950">{posts.length}</p>
            </div>
            <div className="rounded-[20px] border border-slate-200 bg-slate-50 px-3.5 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Aprovação</p>
              <p className="mt-1.5 text-[26px] font-semibold text-slate-950">{approvalReminderGroups.length}</p>
            </div>
            <div className="rounded-[20px] border border-slate-200 bg-slate-50 px-3.5 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Sem agenda</p>
              <p className="mt-1.5 text-[26px] font-semibold text-slate-950">{unscheduledPosts.length}</p>
            </div>
            <div className="rounded-[20px] border border-slate-200 bg-slate-50 px-3.5 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Atrasados</p>
              <p className="mt-1.5 text-[26px] font-semibold text-slate-950">{overduePosts.length}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-3 xl:grid-cols-4">
        <div className="rounded-[22px] border border-amber-200 bg-amber-50 p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-white p-2 text-amber-600">
              <Send size={18} />
            </div>
            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-slate-950">Posts pendentes de aprovação</h2>
              <p className="text-sm text-slate-600">
                {approvalReminderGroups.reduce((total, group) => total + group.count, 0)} post(s) aguardando validação do cliente.
              </p>
              {approvalReminderGroups.slice(0, 2).map((group) => (
                <button
                  key={group.clientId}
                  type="button"
                  onClick={() => setWhatsAppGroup(group)}
                  className="flex w-full items-center justify-between rounded-2xl border border-amber-200 bg-white px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-amber-100"
                >
                  <span>{group.clientName}</span>
                  <span className="font-semibold">{group.count}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-[22px] border border-yellow-200 bg-yellow-50 p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-white p-2 text-yellow-600">
              <Clock3 size={18} />
            </div>
            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-slate-950">Post aprovado sem agendamento</h2>
              <p className="text-sm text-slate-600">
                {unscheduledPosts.length} post(s) podem atrasar a publicação se a equipe não agir.
              </p>
              <div className="space-y-2">
                {unscheduledPosts.slice(0, 2).map((post) => (
                  <div key={post.id} className="rounded-2xl border border-yellow-200 bg-white px-3 py-2 text-sm text-slate-700">
                    <p className="font-medium">{post.client_name}</p>
                    <p className="text-xs text-slate-500">{post.title || post.post_type}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[22px] border border-rose-200 bg-rose-50 p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-white p-2 text-rose-600">
              <AlertTriangle size={18} />
            </div>
            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-slate-950">Posts atrasados</h2>
              <p className="text-sm text-slate-600">
                {overduePosts.length} item(ns) passaram da data e ainda não foram publicados.
              </p>
              <div className="space-y-2">
                {overduePosts.slice(0, 2).map((post) => (
                  <div key={post.id} className="rounded-2xl border border-rose-200 bg-white px-3 py-2 text-sm text-slate-700">
                    <p className="font-medium">{post.client_name}</p>
                    <p className="text-xs text-slate-500">
                      {post.title || post.post_type} • {formatDateLabel(post.scheduled_date || post.post_date || null)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-white p-2 text-slate-700">
              <CalendarClock size={18} />
            </div>
            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-slate-950">Revisão interna ativa</h2>
              <p className="text-sm text-slate-600">
                {internalReviewPosts.length} post(s) ainda não saíram da operação interna.
              </p>
              <div className="space-y-2">
                {internalReviewPosts.slice(0, 2).map((post) => (
                  <div key={post.id} className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                    <p className="font-medium">{post.client_name}</p>
                    <p className="text-xs text-slate-500">{post.title || post.post_type}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {portalErrorCard ? (
        <section className="rounded-[24px] border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700 shadow-sm">
          <p className="font-semibold">🚨 ERRO NO PORTAL</p>
          <p className="mt-1">{portalErrorCard}</p>
        </section>
      ) : null}

      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[24px] border border-slate-200/80 bg-white/90 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Kanban operacional</h2>
            <p className="text-sm text-slate-500">Arraste o card e o workflow é atualizado automaticamente.</p>
          </div>
          <button
            type="button"
            onClick={() => void refetch()}
            className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Atualizar
          </button>
        </div>

        {isLoading ? (
          <div className="flex min-h-[320px] items-center justify-center gap-3 text-sm text-slate-500">
            <Loader2 size={18} className="animate-spin" />
            Carregando Central Operacional...
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden p-4">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCorners}
              onDragStart={handleDragStart}
              onDragEnd={(event) => void handleDragEnd(event)}
            >
              <div className="flex min-w-max gap-4">
                {HUB_COLUMNS.map((column) => (
                  <HubColumn
                    key={column.id}
                    id={column.id}
                    label={column.label}
                    subtitle={column.subtitle}
                    accent={column.accent}
                    posts={groupedPosts.get(column.id) || []}
                  />
                ))}
              </div>
              <DragOverlay>{activeDragPost ? <HubCard post={activeDragPost} /> : null}</DragOverlay>
            </DndContext>
          </div>
        )}
      </section>

      <section className="rounded-[30px] border border-slate-200/80 bg-white/90 shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-200 px-6 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Calendário operacional</h2>
            <p className="text-sm text-slate-500">
              Visão de mês completo para aprovações pendentes, carga de agendamento e publicações já concluídas.
            </p>
          </div>
          <MonthNavigator
            monthLabel={formattedMonth}
            onPrevious={moveToPreviousMonth}
            onNext={moveToNextMonth}
          />
        </div>

        <div className="grid gap-3 border-b border-slate-100 px-6 py-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-[22px] border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-700">Aprovação</p>
            <p className="mt-2 text-2xl font-semibold text-slate-950">{monthOverview.approvals}</p>
          </div>
          <div className="rounded-[22px] border border-yellow-200 bg-yellow-50 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-yellow-700">Fila operacional</p>
            <p className="mt-2 text-2xl font-semibold text-slate-950">{monthOverview.scheduling}</p>
          </div>
          <div className="rounded-[22px] border border-sky-200 bg-sky-50 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-700">Agendados</p>
            <p className="mt-2 text-2xl font-semibold text-slate-950">{monthOverview.scheduled}</p>
          </div>
          <div className="rounded-[22px] border border-emerald-200 bg-emerald-50 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">Publicados</p>
            <p className="mt-2 text-2xl font-semibold text-slate-950">{monthOverview.published}</p>
          </div>
        </div>

        <div className="grid gap-3 p-5 md:grid-cols-2 xl:grid-cols-7">
          {calendarGridDays.map((day) => {
            const dayKey = format(day, 'yyyy-MM-dd');
            const dayItems = monthCalendarItems.get(dayKey) || [];
            const outsideCurrentMonth = !isSameMonth(day, timelineMonth);

            return (
              <div
                key={dayKey}
                className={cn(
                  'min-h-[210px] rounded-[24px] border p-4 shadow-sm',
                  outsideCurrentMonth
                    ? 'border-slate-200 bg-slate-50/70 opacity-70'
                    : 'border-slate-200 bg-white',
                  isToday(day) && 'border-sky-300 bg-sky-50/60'
                )}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      {format(day, 'dd')}
                    </p>
                    <p className="mt-1 text-[11px] font-medium text-slate-400">
                      {format(day, 'EEE', { locale: dateFnsPtBR })}
                    </p>
                  </div>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                    {dayItems.length}
                  </span>
                </div>

                <div className="mt-4 space-y-2">
                  {dayItems.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-3 py-6 text-center text-xs text-slate-400">
                      Nenhum post
                    </div>
                  ) : (
                    dayItems.slice(0, 3).map((post) => (
                      <div
                        key={post.id}
                        className="rounded-2xl border border-slate-200 bg-slate-50/80 px-3 py-2.5 text-sm text-slate-700"
                      >
                        <div className="flex items-start gap-2">
                          <span className={cn('mt-1 h-2.5 w-2.5 rounded-full', getStatusAccentClass(post.workflow_status))} />
                          <div className="min-w-0">
                            <p className="truncate font-medium text-slate-900">{post.title || post.post_type || 'Post sem título'}</p>
                            <p className="mt-1 truncate text-xs text-slate-500">{post.client_name}</p>
                            <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                              {formatWorkflowLabel(post.workflow_status)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}

                  {dayItems.length > 3 ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-3 py-2 text-center text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                      +{dayItems.length - 3} post(s)
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-[30px] border border-slate-200/80 bg-white/90 shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-200 px-6 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Timeline mensal</h2>
            <p className="text-sm text-slate-500">Linha do tempo do mês com o que está pendente, agendado e já entregue.</p>
          </div>
          <MonthNavigator
            monthLabel={formattedMonth}
            onPrevious={moveToPreviousMonth}
            onNext={moveToNextMonth}
          />
        </div>

        <div className="grid gap-3 p-5 md:grid-cols-2 xl:grid-cols-4">
          {timelineDays.map((day) => {
            const dayItems = timelineItems.filter((post) => {
              const scheduledDate = parseDateValue(post.scheduled_date || post.post_date || null);
              return Boolean(
                scheduledDate &&
                  scheduledDate.getDate() === day.getDate() &&
                  scheduledDate.getMonth() === day.getMonth() &&
                  scheduledDate.getFullYear() === day.getFullYear()
              );
            });

            return (
              <div
                key={day.toISOString()}
                className={cn(
                  'rounded-[24px] border border-slate-200 bg-slate-50 p-4',
                  isToday(day) && 'border-sky-300 bg-sky-50/70'
                )}
              >
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    {format(day, 'dd')}
                  </p>
                  <span className="text-xs text-slate-400">{format(day, 'EEE', { locale: dateFnsPtBR })}</span>
                </div>

                <div className="mt-3 space-y-2">
                  {dayItems.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-3 py-4 text-center text-xs text-slate-400">
                      sem post
                    </div>
                  ) : (
                    dayItems.map((post) => {
                      const rawDate = parseDateValue(post.scheduled_date || post.post_date || null);
                      const overdue =
                        post.hub_status !== 'publicado' &&
                        Boolean(rawDate && rawDate.getTime() < Date.now());

                      return (
                        <div
                          key={post.id}
                          className={cn(
                            'rounded-2xl border px-3 py-2 text-sm shadow-sm',
                            post.hub_status === 'publicado'
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                              : overdue
                                ? 'border-rose-200 bg-rose-50 text-rose-700'
                                : 'border-sky-200 bg-sky-50 text-sky-700'
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="font-medium">{post.title || post.post_type}</p>
                              <p className="text-xs opacity-80">{post.client_name}</p>
                            </div>
                            {post.hub_status === 'publicado' ? <CheckCircle2 size={16} /> : <Rocket size={16} />}
                          </div>
                          <p className="mt-1 text-xs font-semibold">{formatTimeLabel(post.scheduled_date || post.post_date || null)}</p>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {schedulePost ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-[2px]">
          <div className="w-full max-w-xl rounded-[30px] border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{schedulePost.client_name}</p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-950">Confirmar agendamento</h2>
                <p className="mt-2 text-sm text-slate-600">{schedulePost.title || schedulePost.post_type}</p>
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
                  value={scheduleDate}
                  onChange={(event) => setScheduleDate(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">Horário de publicação</span>
                <input
                  type="time"
                  value={scheduleTime}
                  onChange={(event) => setScheduleTime(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                />
              </label>
            </div>

            <div className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
              O card foi arrastado para <strong>Agendado</strong>. Agora confirme a data real para atualizar o pipeline sem perder visibilidade.
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
                onClick={() => void handleConfirmScheduledDrop()}
                disabled={savingSchedule}
                className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {savingSchedule ? 'Salvando...' : 'Confirmar agendamento'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {whatsAppGroup ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-[2px]">
          <div className="w-full max-w-2xl rounded-[30px] border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">WhatsApp operacional</p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-950">Mensagem pronta para copiar</h2>
                <p className="mt-2 text-sm text-slate-600">
                  Cliente: {whatsAppGroup.clientName} • Posts pendentes: {whatsAppGroup.count}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setWhatsAppGroup(null)}
                className="rounded-full border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50"
              >
                <X size={16} />
              </button>
            </div>

            <div className="mt-6 rounded-[24px] border border-slate-200 bg-slate-50 p-4">
              <pre className="whitespace-pre-wrap font-sans text-sm leading-6 text-slate-700">
                {buildHubMessage(whatsAppGroup)}
              </pre>
            </div>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setWhatsAppGroup(null)}
                className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Fechar
              </button>
              <button
                type="button"
                onClick={() => void handleCopyWhatsApp()}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-emerald-500"
              >
                <Copy size={16} />
                Copiar mensagem para WhatsApp
              </button>
              <button
                type="button"
                onClick={() => void handleCopyWhatsApp()}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                <MessageSquareShare size={16} />
                Copiar e colar no atendimento
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
