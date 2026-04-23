/**
 * content-approval.service.ts
 *
 * ARQUITETURA: A Central de Aprovação funciona como um ALIAS (espelho) do Calendário Editorial.
 * - Fonte única de verdade: posting_calendar_items
 * - Os itens de aprovação (approval_items) referenciam calendar_post_id para evitar duplicidade de dados.
 * - Aprovações manuais (sem vínculo com calendário) utilizam campos de fallback.
 */
import { supabase } from '@/lib/supabase';
import { getCurrentProfile, getCurrentUser, logActivity } from './_shared';
import { PublicApprovalService } from './public-approval.service';
import { PostWorkflowService } from './post-workflow.service';
import { normalizeWorkflowStatus, type Role, type WorkflowStatus } from '@/domain/postWorkflow';
import { canApproveInternally, normalizeSystemRole, type SystemRole } from '@/domain/accessControl';
import { PostingCalendarService } from './posting-calendar.service';
import { getCurrentPostVersion, getPreviousPostVersion, type PostVersionRecord } from '@/domain/postVersions';
import { systemError, systemLog } from './system-log.service';

// ─── Tipagens ─────────────────────────────────────────────────────────────────

export type ApprovalItemStatus = 'pending' | 'approved' | 'rejected' | 'revision_requested';
export type ApprovalPlatform =
  | 'instagram'
  | 'facebook'
  | 'linkedin'
  | 'tiktok'
  | 'youtube'
  | 'twitter'
  | 'other';

/** Dados da publicação — originados preferencialmente do calendário operacional */
export interface ApprovalItem {
  id: string;
  approval_id: string;
  calendar_post_id: string | null;
  title: string;
  content: string | null;
  media_url: string | null;
  media_urls: string[];
  platform: ApprovalPlatform;
  scheduled_date: string | null;
  status: ApprovalItemStatus;
  feedback: string | null;
  reviewer_name: string | null;
  decided_at: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  calendar_image_url?: string | null;
  calendar_video_url?: string | null;
  calendar_day_number?: number | null;
  calendar_post_type?: string | null;
  calendar_label_color?: string | null;
  checklist_arte_ok?: boolean;
  checklist_legenda_ok?: boolean;
  versions?: PostVersionRecord[];
  current_version?: PostVersionRecord | null;
  previous_version?: PostVersionRecord | null;
  current_version_number?: number | null;
}

export interface ContentApproval {
  id: string;
  title: string;
  description: string | null;
  status: string;
  client_id: string | null;
  client_name: string | null;
  requested_by: string;
  decided_by: string | null;
  decided_at: string | null;
  decision_notes: string | null;
  due_date: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  items: ApprovalItem[];
  public_slug: string | null;
  public_url: string | null;
  items_count: number;
  pending_count: number;
  approved_count: number;
  rejected_count: number;
  revision_count: number;
  from_calendar: boolean;
  calendar_id: string | null;
}

export interface CentralApprovalQueueItem {
  id: string;
  calendar_id: string;
  client_id: string | null;
  client_name: string | null;
  client_portal_token?: string | null;
  title: string | null;
  description: string | null;
  image_url: string | null;
  video_url: string | null;
  post_type: string | null;
  post_date: string | null;
  day_number: number | null;
  workflow_status: WorkflowStatus;
  approval_status: string | null;
  owner_role: string | null;
  revision_count: number;
  version_number: number;
  current_version_number: number | null;
  checklist_arte_ok: boolean;
  checklist_legenda_ok: boolean;
  waiting_days: number;
  urgency: 'urgente' | 'atencao' | 'tranquilo';
  current_version?: PostVersionRecord | null;
  previous_version?: PostVersionRecord | null;
  versions?: PostVersionRecord[];
}

export interface CreateApprovalItemPayload {
  title: string;
  content?: string | null;
  media_url?: string | null;
  media_urls?: string[];
  platform?: ApprovalPlatform;
  scheduled_date?: string | null;
  sort_order?: number;
  calendar_post_id?: string | null;
}

export interface CreateContentApprovalPayload {
  title: string;
  description?: string | null;
  client_id?: string | null;
  client_name?: string | null;
  due_date?: string | null;
  month?: number;
  year?: number;
  calendar_id?: string | null;
  items: CreateApprovalItemPayload[];
}

export interface DecideItemPayload {
  itemId: string;
  decision: ApprovalItemStatus;
  feedback?: string | null;
  reviewerName?: string | null;
  actorRole?: SystemRole | null;
}

export type CalendarChecklistField =
  | 'checklist_arte_ok'
  | 'checklist_legenda_ok';

// ─── Auxiliares ───────────────────────────────────────────────────────────────

/** Calcula os contadores de status para o cabeçalho da aprovação */
function computeCounts(items: ApprovalItem[]) {
  return {
    items_count: items.length,
    pending_count: items.filter((i) => i.status === 'pending').length,
    approved_count: items.filter((i) => i.status === 'approved').length,
    rejected_count: items.filter((i) => i.status === 'rejected').length,
    revision_count: items.filter((i) => i.status === 'revision_requested').length,
  };
}

/** Sincroniza dados do calendário (imagem, vídeo, data) para os itens de aprovação */
async function enrichItemsWithCalendarData(items: ApprovalItem[]): Promise<ApprovalItem[]> {
  const calendarIds = items
    .map((i) => i.calendar_post_id)
    .filter(Boolean) as string[];

  if (calendarIds.length === 0) return items;

  const { data: calendarPosts } = await supabase
    .from('posting_calendar_items')
    .select('id, title, description, image_url, video_url, day_number, post_type, label_color, post_date, checklist_arte_ok, checklist_legenda_ok, current_version_id')
    .in('id', calendarIds);

  if (!calendarPosts) return items;

  const postMap = new Map(calendarPosts.map((p: any) => [p.id, p]));
  const versionsMap = await PostingCalendarService.getPostVersionsMap(calendarIds);

  return items.map((item) => {
    if (!item.calendar_post_id) return item;
    const calPost = postMap.get(item.calendar_post_id) as any;
    if (!calPost) return item;
    const versions = versionsMap.get(item.calendar_post_id) || [];
    return {
      ...item,
      title: calPost.title || item.title,
      content: calPost.description || item.content,
      media_url: calPost.image_url || item.media_url,
      scheduled_date: calPost.post_date ? calPost.post_date.split('T')[0] : item.scheduled_date,
      calendar_image_url: calPost.image_url || null,
      calendar_video_url: calPost.video_url || null,
      calendar_day_number: calPost.day_number || null,
      calendar_post_type: calPost.post_type || null,
      calendar_label_color: calPost.label_color || null,
      checklist_arte_ok: calPost.checklist_arte_ok === true,
      checklist_legenda_ok: calPost.checklist_legenda_ok === true,
      versions,
      current_version: getCurrentPostVersion(versions),
      previous_version: getPreviousPostVersion(versions),
      current_version_number: getCurrentPostVersion(versions)?.version_number ?? null,
    };
  });
}

/** Converte uma linha do banco para a interface de domínio ContentApproval */
function rowToContentApproval(
  a: Record<string, unknown>,
  items: ApprovalItem[]
): ContentApproval {
  const meta = (a.metadata as Record<string, unknown>) ?? {};
  return {
    id: String(a.id),
    title: String(a.title ?? ''),
    description: (a.description as string | null) ?? null,
    status: String(a.status ?? 'pending'),
    client_id: (a.client_id as string | null) ?? null,
    client_name: ((a as any).clients as any)?.name ?? (meta.client_name as string | null) ?? null,
    requested_by: String(a.requested_by ?? ''),
    decided_by: (a.decided_by as string | null) ?? null,
    decided_at: (a.decided_at as string | null) ?? null,
    decision_notes: (a.decision_notes as string | null) ?? null,
    due_date: (a.due_date as string | null) ?? null,
    metadata: meta,
    created_at: String(a.created_at ?? ''),
    updated_at: String(a.updated_at ?? ''),
    items,
    public_slug: (meta.public_slug as string | null) ?? (meta.public_approval_slug as string | null) ?? null,
    public_url: (meta.public_url as string | null) ?? (meta.public_approval_url as string | null) ?? null,
    from_calendar: String((a.entity_type as string) ?? '') === 'calendar_item',
    calendar_id: (a.entity_id as string | null) ?? null,
    ...computeCounts(items),
  };
}

const APPROVALS_SELECT = `
  id, title, description, status, client_id, requested_by, entity_type, entity_id,
  decided_by, decided_at, decision_notes, due_date, metadata, created_at, updated_at,
  clients!client_id(name)
`;

/** Realiza update seguro no calendário tratando possíveis campos inexistentes (graceful degradation) */
async function safeUpdateCalendarApprovalFields(
  calendarPostId: string,
  payload: Record<string, unknown>
) {
  let response = await supabase
    .from('posting_calendar_items')
    .update(payload)
    .eq('id', calendarPostId);

  // Fallback caso a coluna 'approval_notes' não exista no schema atual
  if (
    response.error &&
    String(response.error.message || '').toLowerCase().includes('approval_notes')
  ) {
    const { approval_notes, ...fallbackPayload } = payload;
    response = await supabase
      .from('posting_calendar_items')
      .update(fallbackPayload)
      .eq('id', calendarPostId);
  }

  if (response.error) throw response.error;
}

async function safeUpdateManyCalendarApprovalFields(
  calendarPostIds: string[],
  payload: Record<string, unknown>
) {
  let response = await supabase
    .from('posting_calendar_items')
    .update(payload)
    .in('id', calendarPostIds);

  if (
    response.error &&
    String(response.error.message || '').toLowerCase().includes('approval_notes')
  ) {
    const { approval_notes, ...fallbackPayload } = payload;
    response = await supabase
      .from('posting_calendar_items')
      .update(fallbackPayload)
      .in('id', calendarPostIds);
  }

  if (response.error) throw response.error;
}

async function loadCalendarValidationContext(calendarPostId: string) {
  let response = await supabase
    .from('posting_calendar_items')
    .select('id, workflow_status, revision_count, checklist_arte_ok, checklist_legenda_ok')
    .eq('id', calendarPostId)
    .maybeSingle();

  if (response.error) {
    const message = String(response.error.message || '').toLowerCase();
    if (message.includes('does not exist') || message.includes('schema cache')) {
      response = await supabase
        .from('posting_calendar_items')
        .select('id, workflow_status, revision_count, checklist_arte, checklist_legenda')
        .eq('id', calendarPostId)
        .maybeSingle();
    }
  }

  if (response.error) throw response.error;

  const row = (response.data || null) as Record<string, unknown> | null;
  if (!row) return null;

  return {
    id: String(row.id || ''),
    workflow_status: (row.workflow_status as string | null) ?? null,
    revision_count: Number(row.revision_count || 0),
    checklist_arte_ok: Boolean(row.checklist_arte_ok ?? row.checklist_arte ?? false),
    checklist_legenda_ok: Boolean(row.checklist_legenda_ok ?? row.checklist_legenda ?? false),
  } as
    | {
        id: string;
        workflow_status?: string | null;
        revision_count?: number | null;
        checklist_arte_ok?: boolean | null;
        checklist_legenda_ok?: boolean | null;
      }
    | null;
}

const isClientApprovalTransitionStatus = (status: WorkflowStatus) => status === 'em_aprovacao_cliente';

function assertCalendarDecisionAllowed(
  decision: ApprovalItemStatus,
  context: {
    revision_count?: number | null;
    checklist_arte_ok?: boolean | null;
    checklist_legenda_ok?: boolean | null;
  } | null
) {
  const revisionCount = Number(context?.revision_count || 0);
  const missingChecklist: string[] = [];
  if (context?.checklist_arte_ok !== true) missingChecklist.push('Arte');
  if (context?.checklist_legenda_ok !== true) missingChecklist.push('Legenda');

  if (decision === 'approved' && missingChecklist.length > 0) {
    throw new Error(`Checklist incompleto. Falta validar: ${missingChecklist.join(', ')}`);
  }

  if ((decision === 'revision_requested' || decision === 'rejected') && revisionCount >= 2) {
    throw new Error(
      'Limite Excedido: Este item já atingiu o máximo de 2 revisões permitidas no contrato.'
    );
  }

  return { revisionCount, checklistComplete: missingChecklist.length === 0 };
}

function calculateDaysDiff(dateString: string | null | undefined) {
  if (!dateString) return null;
  const target = new Date(String(dateString));
  if (Number.isNaN(target.getTime())) return null;
  const now = new Date();
  const targetDay = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((targetDay - today) / 86_400_000);
}

function calculateWaitingDays(dateString: string | null | undefined) {
  if (!dateString) return 0;
  const target = new Date(String(dateString));
  if (Number.isNaN(target.getTime())) return 0;
  return Math.max(0, Math.floor((Date.now() - target.getTime()) / 86_400_000));
}

function resolveUrgency(postDate: string | null | undefined): 'urgente' | 'atencao' | 'tranquilo' {
  const diff = calculateDaysDiff(postDate);
  if (diff === null) return 'tranquilo';
  if (diff <= 1) return 'urgente';
  if (diff <= 3) return 'atencao';
  return 'tranquilo';
}

function ensureWorkflowRole(role: SystemRole | null | undefined, fallback: Role): Role {
  const normalized = normalizeSystemRole(role || fallback);
  if (normalized === 'blocked') {
    throw new Error('Usuário bloqueado não pode executar ações no workflow.');
  }
  return normalized;
}

// ─── Serviço de Domínio ───────────────────────────────────────────────────────

export const ContentApprovalService = {
  async getCentralQueue(opts?: {
    clientId?: string;
    status?: WorkflowStatus | 'all';
    limit?: number;
  }): Promise<CentralApprovalQueueItem[]> {
    const queueStatuses: WorkflowStatus[] =
      opts?.status && opts.status !== 'all'
        ? [opts.status]
        : ['revisao_interna', 'aprovado_interno', 'revisao_cliente'];

    const baseSelect = `
      id,
      calendar_id,
      client_id,
      title,
      description,
      image_url,
      video_url,
      post_type,
      post_date,
      day_number,
      workflow_status,
      approval_status,
      owner_role,
      revision_count,
      version_number,
      checklist_arte_ok,
      checklist_legenda_ok,
      current_version_id,
      parent_post_id,
      is_current_version,
      created_at,
      updated_at
    `;

    let response = await supabase
      .from('posting_calendar_items')
      .select(baseSelect)
      .in('workflow_status', queueStatuses)
      .eq('is_current_version', true)
      .order('post_date', { ascending: true })
      .order('day_number', { ascending: true })
      .limit(opts?.limit ?? 250);

    if (opts?.clientId) {
      response = await supabase
        .from('posting_calendar_items')
        .select(baseSelect)
        .eq('client_id', opts.clientId)
        .in('workflow_status', queueStatuses)
        .eq('is_current_version', true)
        .order('post_date', { ascending: true })
        .order('day_number', { ascending: true })
        .limit(opts?.limit ?? 250);
    }

    if (
      response.error &&
      (String(response.error.message || '').toLowerCase().includes('client_id') ||
        String(response.error.message || '').toLowerCase().includes('is_current_version'))
    ) {
      let fallback = supabase
        .from('posting_calendar_items')
        .select(`
          id,
          calendar_id,
          title,
          description,
          image_url,
          video_url,
          post_type,
          post_date,
          day_number,
          workflow_status,
          approval_status,
          owner_role,
          revision_count,
          version_number,
          checklist_arte_ok,
          checklist_legenda_ok,
          current_version_id,
          parent_post_id,
          created_at,
          updated_at,
          posting_calendars!inner(client_id)
        `)
        .in('workflow_status', queueStatuses)
        .order('post_date', { ascending: true })
        .order('day_number', { ascending: true })
        .limit(opts?.limit ?? 250);

      if (opts?.clientId) {
        fallback = fallback.eq('posting_calendars.client_id', opts.clientId);
      }

      const fallbackResponse = await fallback;
      if (fallbackResponse.error) throw fallbackResponse.error;
      response = {
        ...fallbackResponse,
        data: (fallbackResponse.data || []).map((row: any) => ({
          ...row,
          client_id: row.posting_calendars?.client_id ?? null,
          is_current_version: true,
        })),
      } as typeof response;
    }

    if (response.error) {
      await systemError({
        scope: 'approval_center',
        action: 'queue_load_failed',
        clientId: opts?.clientId ?? null,
        tableName: 'posting_calendar_items',
        query: 'getCentralQueue',
        message: 'Falha ao carregar fila da central de aprovação.',
        error: response.error,
        data: {
          status: opts?.status ?? 'all',
          limit: opts?.limit ?? 250,
        },
      });
      throw response.error;
    }

    const rows = ((response.data || []) as Record<string, unknown>[])
      .filter((row) => row.is_current_version !== false);

    const clientIds = Array.from(new Set(rows.map((row) => String(row.client_id || '')).filter(Boolean)));
    const { data: clientsRows, error: clientsError } = clientIds.length
      ? await supabase.from('clients').select('id, name, portal_token').in('id', clientIds)
      : { data: [], error: null };

    if (clientsError) throw clientsError;

    const clientsMap = new Map((clientsRows || []).map((row: any) => [String(row.id), row]));
    const versionsMap = await PostingCalendarService.getPostVersionsMap(rows.map((row) => String(row.id || '')).filter(Boolean));

    const queue = rows.map((row) => {
      const id = String(row.id || '');
      const versions = versionsMap.get(id) || [];
      const currentVersion = getCurrentPostVersion(versions);
      const previousVersion = getPreviousPostVersion(versions);
      const waitingDays = calculateWaitingDays(
        String(row.updated_at || row.created_at || row.post_date || '')
      );

      return {
        id,
        calendar_id: String(row.calendar_id || ''),
        client_id: row.client_id ? String(row.client_id) : null,
        client_name: row.client_id ? String((clientsMap.get(String(row.client_id)) as any)?.name || '') || null : null,
        client_portal_token: row.client_id ? String((clientsMap.get(String(row.client_id)) as any)?.portal_token || '') || null : null,
        title: row.title ? String(row.title) : null,
        description: row.description ? String(row.description) : null,
        image_url: row.image_url ? String(row.image_url) : null,
        video_url: row.video_url ? String(row.video_url) : null,
        post_type: row.post_type ? String(row.post_type) : null,
        post_date: row.post_date ? String(row.post_date) : null,
        day_number: row.day_number ? Number(row.day_number) : null,
        workflow_status: normalizeWorkflowStatus(String(row.workflow_status || 'rascunho')),
        approval_status: row.approval_status ? String(row.approval_status) : null,
        owner_role: row.owner_role ? String(row.owner_role) : null,
        revision_count: Number(row.revision_count || 0),
        version_number: Number(row.version_number || 1),
        current_version_number: currentVersion?.version_number ?? Number(row.version_number || 1),
        checklist_arte_ok: Boolean(row.checklist_arte_ok ?? false),
        checklist_legenda_ok: Boolean(row.checklist_legenda_ok ?? false),
        waiting_days: waitingDays,
        urgency: resolveUrgency(row.post_date ? String(row.post_date) : null),
        versions,
        current_version: currentVersion,
        previous_version: previousVersion,
      };
    });

    if (queue.length === 0) {
      await systemLog({
        scope: 'approval_center',
        action: 'queue_empty',
        clientId: opts?.clientId ?? null,
        tableName: 'posting_calendar_items',
        query: 'getCentralQueue',
        message: 'Nenhum post encontrado para os filtros atuais da central.',
        data: {
          status: opts?.status ?? 'all',
          limit: opts?.limit ?? 250,
        },
        level: 'warning',
      });
    }

    return queue;
  },

  async transitionCentralQueueItem(input: {
    postId: string;
    action: 'approve_internal' | 'send_client' | 'request_adjustment';
    actorRole?: SystemRole | null;
    comment?: string | null;
  }) {
    const normalizedActorRole = ensureWorkflowRole(input.actorRole, 'gestor');
    const comment = String(input.comment || '').trim();

    const workflowAction =
      input.action === 'approve_internal'
        ? 'aprovar_interno'
        : input.action === 'send_client'
          ? 'enviar_cliente'
          : 'retornar_rascunho';

    const requestedStatus =
      input.action === 'approve_internal'
        ? 'aprovado_interno'
        : input.action === 'send_client'
          ? 'em_aprovacao_cliente'
          : 'rascunho';

    try {
      const result = await PostWorkflowService.applyResolvedTransition({
        postId: input.postId,
        action: workflowAction,
        role: normalizedActorRole,
        requestedStatus,
        comment:
          comment ||
          (input.action === 'approve_internal'
            ? 'Post aprovado internamente.'
            : input.action === 'send_client'
              ? 'Post liberado para o portal do cliente.'
              : 'Post retornado para ajustes internos.'),
        metadata: {
          source: 'content_approval_central_queue',
          decision: input.action,
        },
      });

      await systemLog({
        scope: 'approval_center',
        action: `transition_${input.action}`,
        tableName: 'posting_calendar_items',
        message: 'Transição executada na central de aprovação.',
        data: {
          postId: input.postId,
          actorRole: normalizedActorRole,
          result,
        },
      });

      return result;
    } catch (error) {
      await systemError({
        scope: 'approval_center',
        action: `transition_${input.action}_failed`,
        tableName: 'posting_calendar_items',
        message: 'Falha ao executar transição na central de aprovação.',
        error,
        data: {
          postId: input.postId,
          actorRole: normalizedActorRole,
          requestedStatus,
        },
      });
      throw error;
    }
  },

  /** Cria um novo pacote de aprovação vinculado obrigatoriamente ao Calendário Editorial */
  async create(payload: CreateContentApprovalPayload): Promise<ContentApproval> {
    const user = await getCurrentUser();

    if (!payload.calendar_id) {
      throw new Error('Fluxo centralizado: aprovações devem ser geradas através do Calendário Editorial.');
    }

    if (payload.items.some((item) => !item.calendar_post_id)) {
      throw new Error('Inconsistência de dados: todas as publicações precisam de vínculo com o Calendário.');
    }

    const month = payload.month ?? new Date().getMonth() + 1;
    const year = payload.year ?? new Date().getFullYear();
    const clientName = payload.client_name ?? 'cliente';
    const monthLabel = new Date(year, month - 1).toLocaleString('pt-BR', { month: 'long' });

    const { data: approvalRow, error: approvalError } = await supabase
      .from('approvals')
      .insert({
        entity_type: 'calendar_item',
        entity_id: payload.calendar_id,
        client_id: payload.client_id ?? null,
        title: payload.title,
        description: payload.description ?? null,
        status: 'pending',
        requested_by: user.id,
        due_date: payload.due_date ?? null,
        metadata: {
          source: 'content_approval',
          client_name: clientName,
          month,
          year,
          month_label: monthLabel,
          items_count: payload.items.length,
          from_calendar: true,
          calendar_id: payload.calendar_id,
        },
      })
      .select('id')
      .single();

    if (approvalError) throw approvalError;
    const approvalId = String(approvalRow.id);

    if (payload.items.length > 0) {
      const { error: itemsError } = await supabase.from('approval_items').insert(
        payload.items.map((item, i) => ({
          approval_id: approvalId,
          calendar_post_id: item.calendar_post_id ?? null,
          title: item.title,
          content: item.content ?? null,
          media_url: item.media_url ?? null,
          media_urls: item.media_urls ?? [],
          platform: item.platform ?? 'instagram',
          scheduled_date: item.scheduled_date ?? null,
          sort_order: item.sort_order ?? i,
          status: 'pending',
        }))
      );
      if (itemsError) throw itemsError;
    }

    // Geração de link público via Edge Function
    try {
      const { data: fullApproval } = await supabase
        .from('approvals')
        .select('*')
        .eq('id', approvalId)
        .single();

      const publicLink = await PublicApprovalService.createOrGetLinkForApproval({
        ...fullApproval,
        client_name: clientName,
      });

      await supabase
        .from('approvals')
        .update({
          metadata: {
            ...(fullApproval.metadata ?? {}),
            public_slug: publicLink.slug,
            public_url: publicLink.public_url,
            public_approval_slug: publicLink.slug,
            public_approval_url: publicLink.public_url,
          },
        })
        .eq('id', approvalId);
    } catch (e) {
      console.warn('Alerta: Falha ao gerar link público de aprovação:', e);
    }

    await logActivity('content_approval_created', 'approval', approvalId, payload.client_id ?? null, {
      title: payload.title,
      items_count: payload.items.length,
      from_calendar: true,
    });

    return ContentApprovalService.getById(approvalId);
  },

  /** Lista todos os pacotes de aprovação de acordo com os filtros */
  async getAll(opts?: {
    status?: string;
    clientId?: string;
    limit?: number;
    offset?: number;
  }): Promise<ContentApproval[]> {
    let query = supabase
      .from('approvals')
      .select(APPROVALS_SELECT)
      .order('created_at', { ascending: false })
      .range(opts?.offset ?? 0, (opts?.offset ?? 0) + (opts?.limit ?? 100) - 1);

    if (opts?.status && opts.status !== 'all') query = query.eq('status', opts.status);
    if (opts?.clientId) query = query.eq('client_id', opts.clientId);

    // Filtra apenas registros de aprovação de conteúdo
    query = query.or('entity_type.eq.post,entity_type.eq.calendar_item')
      .not('metadata->>source', 'is', null);

    const { data, error } = await query;
    if (error) throw error;

    const rows = (data ?? []) as unknown as Record<string, unknown>[];

    const ids = rows.map((r) => r.id as string);
    const itemMap: Record<string, ApprovalItem[]> = {};

    if (ids.length > 0) {
      const { data: itemRows } = await supabase
        .from('approval_items')
        .select('id, approval_id, status, calendar_post_id')
        .in('approval_id', ids);

      for (const row of itemRows ?? []) {
        const r = row as any;
        if (!itemMap[r.approval_id]) itemMap[r.approval_id] = [];
        itemMap[r.approval_id].push(r);
      }
    }

    return rows.map((row) =>
      rowToContentApproval(row, itemMap[row.id as string] ?? [])
    );
  },

  /** Recupera um pacote de aprovação detalhado pelo ID */
  async getById(id: string): Promise<ContentApproval> {
    const [{ data: a, error: aErr }, { data: itemRows, error: iErr }] = await Promise.all([
      supabase.from('approvals').select(APPROVALS_SELECT).eq('id', id).single(),
      supabase.from('approval_items').select('*').eq('approval_id', id).order('sort_order'),
    ]);

    if (aErr) throw new Error('Aprovação não encontrada no banco de dados.');
    if (iErr) throw iErr;

    const items = (itemRows ?? []) as ApprovalItem[];
    const enriched = await enrichItemsWithCalendarData(items);
    return rowToContentApproval(a as unknown as Record<string, unknown>, enriched);
  },

  /** Localiza uma aprovação através do slug público */
  async getBySlug(slug: string): Promise<ContentApproval> {
    const { data: link, error: linkError } = await supabase
      .from('approval_public_links')
      .select('approval_id, is_active')
      .eq('slug', slug)
      .single();

    if (linkError || !link) throw new Error('O link de acesso fornecido é inválido ou expirou.');
    if (!(link as any).is_active) throw new Error('Este link de aprovação já foi desativado pela agência.');

    return ContentApprovalService.getById(String((link as any).approval_id));
  },

  /** Registra a decisão (Aprovação/Reprovação/Revisão) para um item específico */
  async decideItem(payload: DecideItemPayload): Promise<ApprovalItem> {
    const now = new Date().toISOString();
    const trimmedFeedback = String(payload.feedback || '').trim();
    const actorRole = ensureWorkflowRole(payload.actorRole, 'cliente');

    if (payload.decision !== 'approved' && !trimmedFeedback) {
      throw new Error('Informe o motivo da alteracao antes de solicitar nova versao.');
    }

    const { data: existingItem, error: existingItemError } = await supabase
      .from('approval_items')
      .select('*')
      .eq('id', payload.itemId)
      .single();

    if (existingItemError) throw existingItemError;

    const item = existingItem as ApprovalItem;

    // Guard clause: avoid reprocessing items already decided with the same final decision.
    if (item.status === payload.decision && item.status !== 'pending') {
      await ContentApprovalService._syncParentStatus(item.approval_id);
      return item;
    }

    if (item.calendar_post_id) {
      const calendarRow = await loadCalendarValidationContext(item.calendar_post_id);
      const { revisionCount } = assertCalendarDecisionAllowed(payload.decision, calendarRow);
      const currentWorkflow = normalizeWorkflowStatus(calendarRow?.workflow_status || 'rascunho');

      const updatePayload: Record<string, unknown> = {
        approved_by_name: payload.reviewerName ?? null,
      };

      if (payload.feedback) {
        updatePayload.approval_notes = payload.feedback;
      }

      if (payload.decision === 'approved') {
        if (canApproveInternally(actorRole)) {
          const result = await PostWorkflowService.applyResolvedTransition({
            postId: item.calendar_post_id,
            action: 'central_approve',
            role: actorRole,
            requestedStatus: 'aprovado_interno',
            comment: trimmedFeedback || 'Conteúdo validado internamente.',
            metadata: { source: 'content_approval', decision: payload.decision },
          });
          updatePayload.approval_status = result.nextApprovalStatus;
        } else if (isClientApprovalTransitionStatus(currentWorkflow)) {
          const result = await PostWorkflowService.applyResolvedTransition({
            postId: item.calendar_post_id,
            action: 'client_approve',
            role: 'cliente',
            requestedStatus: 'aprovado_cliente',
            comment: trimmedFeedback || null,
            metadata: { source: 'content_approval', decision: payload.decision },
          });
          updatePayload.approval_status = result.nextApprovalStatus;
          updatePayload.approved_at = now;
        }
      } else {
        if (canApproveInternally(actorRole)) {
          const result = await PostWorkflowService.applyResolvedTransition({
            postId: item.calendar_post_id,
            action: 'retornar_rascunho',
            role: actorRole,
            comment: trimmedFeedback || 'Ajustes internos solicitados.',
            metadata: {
              source: 'content_approval',
              decision: payload.decision,
              previous_revision_count: revisionCount,
            },
          });
          updatePayload.approval_status = result.nextApprovalStatus;
          updatePayload.revision_count = result.revisionCount;
        } else if (isClientApprovalTransitionStatus(currentWorkflow)) {
          const result = await PostWorkflowService.applyResolvedTransition({
            postId: item.calendar_post_id,
            action: 'client_request_changes',
            role: 'cliente',
            requestedStatus: 'revisao_cliente',
            comment: trimmedFeedback,
            metadata: {
              source: 'content_approval',
              decision: payload.decision,
              previous_revision_count: revisionCount,
            },
          });
          updatePayload.approval_status = result.nextApprovalStatus;
          updatePayload.revision_count = result.revisionCount;
        }
      }

      if (!updatePayload.approval_status) {
        updatePayload.approval_status = PostWorkflowService.resolveApprovalStatusForWorkflow(currentWorkflow);
      }

      await safeUpdateCalendarApprovalFields(item.calendar_post_id, updatePayload);
    }

    const { data, error } = await supabase
      .from('approval_items')
      .update({
        status: payload.decision,
        feedback: trimmedFeedback || null,
        reviewer_name: payload.reviewerName ?? null,
        decided_at: now,
        updated_at: now,
      })
      .eq('id', payload.itemId)
      .select('*')
      .single();

    if (error) throw error;
    const updatedItem = data as ApprovalItem;

    await logActivity('content_approval_item_decided', 'approval_item', updatedItem.id, null, {
      approval_id: updatedItem.approval_id,
      calendar_post_id: updatedItem.calendar_post_id,
      decision: payload.decision,
      reviewer_name: payload.reviewerName ?? null,
    });

    // Sincroniza o status do pacote pai
    await ContentApprovalService._syncParentStatus(updatedItem.approval_id);
    return updatedItem;
  },

  /** Aplica uma decisão em lote para todos os itens pendentes do pacote */
  async decideAll(
    approvalId: string,
    decision: ApprovalItemStatus,
    feedback?: string | null,
    reviewerName?: string | null,
    actorRole?: SystemRole | null
  ): Promise<void> {
    const now = new Date().toISOString();
    const trimmedFeedback = String(feedback || '').trim();
    const normalizedActorRole = ensureWorkflowRole(actorRole, 'cliente');

    if (decision !== 'approved' && !trimmedFeedback) {
      throw new Error('Informe o motivo da alteracao antes de solicitar nova versao.');
    }

    const { data: pendingItems } = await supabase
      .from('approval_items')
      .select('id, calendar_post_id')
      .eq('approval_id', approvalId)
      .eq('status', 'pending');

    const calendarIds = (pendingItems ?? [])
      .map((i: any) => i.calendar_post_id)
      .filter(Boolean) as string[];

    if (calendarIds.length > 0) {
      const calendarContextMap = new Map<string, Awaited<ReturnType<typeof loadCalendarValidationContext>>>();
      for (const calendarId of calendarIds) {
        const row = await loadCalendarValidationContext(calendarId);
        assertCalendarDecisionAllowed(decision, row);
        calendarContextMap.set(calendarId, row);
      }

      for (const calendarId of calendarIds) {
        const calendarRow = calendarContextMap.get(calendarId);
        const currentWorkflow = normalizeWorkflowStatus(calendarRow?.workflow_status || 'rascunho');
        const updatePayload: Record<string, unknown> = {
          approved_by_name: reviewerName ?? null,
        };

        if (feedback) {
          updatePayload.approval_notes = feedback;
        }

        if (decision === 'approved') {
          if (canApproveInternally(normalizedActorRole)) {
            const result = await PostWorkflowService.applyResolvedTransition({
              postId: calendarId,
              action: 'central_approve',
              role: normalizedActorRole,
              requestedStatus: 'aprovado_interno',
              comment: trimmedFeedback || 'Conteúdo validado internamente.',
              metadata: { source: 'content_approval', decision },
            });
            updatePayload.approval_status = result.nextApprovalStatus;
          } else if (isClientApprovalTransitionStatus(currentWorkflow)) {
            const result = await PostWorkflowService.applyResolvedTransition({
              postId: calendarId,
              action: 'client_approve',
              role: 'cliente',
              requestedStatus: 'aprovado_cliente',
              comment: trimmedFeedback || null,
              metadata: { source: 'content_approval', decision },
            });
            updatePayload.approval_status = result.nextApprovalStatus;
            updatePayload.approved_at = now;
          }
        } else {
          if (canApproveInternally(normalizedActorRole)) {
            const result = await PostWorkflowService.applyResolvedTransition({
              postId: calendarId,
              action: 'retornar_rascunho',
              role: normalizedActorRole,
              comment: trimmedFeedback || 'Ajustes internos solicitados.',
              metadata: { source: 'content_approval', decision },
            });
            updatePayload.approval_status = result.nextApprovalStatus;
            updatePayload.revision_count = result.revisionCount;
          } else if (isClientApprovalTransitionStatus(currentWorkflow)) {
            const result = await PostWorkflowService.applyResolvedTransition({
              postId: calendarId,
              action: 'client_request_changes',
              role: 'cliente',
              requestedStatus: 'revisao_cliente',
              comment: trimmedFeedback,
              metadata: { source: 'content_approval', decision },
            });
            updatePayload.approval_status = result.nextApprovalStatus;
            updatePayload.revision_count = result.revisionCount;
          }
        }

        if (!updatePayload.approval_status) {
          updatePayload.approval_status = PostWorkflowService.resolveApprovalStatusForWorkflow(currentWorkflow);
        }

        await safeUpdateCalendarApprovalFields(calendarId, updatePayload);
      }
    }

    const { error } = await supabase
      .from('approval_items')
      .update({
        status: decision,
        feedback: trimmedFeedback || null,
        reviewer_name: reviewerName ?? null,
        decided_at: now,
        updated_at: now,
      })
      .eq('approval_id', approvalId)
      .eq('status', 'pending');

    if (error) throw error;

    await logActivity('content_approval_batch_decision', 'approval', approvalId, null, {
      decision,
      reviewer_name: reviewerName ?? null,
    });

    await ContentApprovalService._syncParentStatus(approvalId);
  },

  /** Atualiza checklist interno no post vinculado ao calendário (fonte única de verdade). */
  async updateChecklistField(
    itemId: string,
    field: CalendarChecklistField,
    value: boolean
  ): Promise<{
    id: string;
    checklist_arte_ok: boolean;
    checklist_legenda_ok: boolean;
  }> {
    const allowedFields: CalendarChecklistField[] = [
      'checklist_arte_ok',
      'checklist_legenda_ok',
    ];

    if (!allowedFields.includes(field)) {
      throw new Error('Campo de checklist inválido.');
    }

    const { profile } = await getCurrentProfile();
    if (!canApproveInternally(profile?.role ?? null)) {
      throw new Error('Sem permissão para marcar checklist interno.');
    }

    const { data: item, error: itemError } = await supabase
      .from('approval_items')
      .select('id, calendar_post_id')
      .eq('id', itemId)
      .maybeSingle();

    if (itemError) throw itemError;
    if (!item?.calendar_post_id) {
      throw new Error('Item sem vínculo com calendário para checklist.');
    }

    let response = await supabase
      .from('posting_calendar_items')
      .update({ [field]: value })
      .eq('id', item.calendar_post_id)
      .select('id, checklist_arte_ok, checklist_legenda_ok')
      .single();

    if (response.error) {
      const message = String(response.error.message || '').toLowerCase();
      const fallbackField =
        field === 'checklist_arte_ok' ? 'checklist_arte' : 'checklist_legenda';

      if (message.includes('does not exist') || message.includes('schema cache')) {
        response = await supabase
          .from('posting_calendar_items')
          .update({ [fallbackField]: value })
          .eq('id', item.calendar_post_id)
          .select('id, checklist_arte, checklist_legenda')
          .single();
      }
    }

    if (response.error) throw response.error;

    const data = response.data as Record<string, unknown>;
    const artifactChecked = Boolean(
      data.checklist_arte_ok ?? data.checklist_arte ?? false
    );
    const captionChecked = Boolean(
      data.checklist_legenda_ok ?? data.checklist_legenda ?? false
    );

    await logActivity('content_approval_checklist_updated', 'posting_calendar_item', item.calendar_post_id, null, {
      approval_item_id: itemId,
      field,
      value,
    });

    return {
      id: String(data.id || ''),
      checklist_arte_ok: artifactChecked,
      checklist_legenda_ok: captionChecked,
    };
  },

  async updateQueueChecklistField(
    postId: string,
    field: CalendarChecklistField,
    value: boolean
  ): Promise<{
    id: string;
    checklist_arte_ok: boolean;
    checklist_legenda_ok: boolean;
  }> {
    const allowedFields: CalendarChecklistField[] = ['checklist_arte_ok', 'checklist_legenda_ok'];
    if (!allowedFields.includes(field)) {
      throw new Error('Campo de checklist inválido.');
    }

    const { profile } = await getCurrentProfile();
    if (!canApproveInternally(profile?.role ?? null)) {
      throw new Error('Sem permissão para marcar checklist interno.');
    }

    let response = await supabase
      .from('posting_calendar_items')
      .update({ [field]: value })
      .eq('id', postId)
      .select('id, checklist_arte_ok, checklist_legenda_ok, client_id')
      .single();

    if (response.error) {
      const message = String(response.error.message || '').toLowerCase();
      const fallbackField = field === 'checklist_arte_ok' ? 'checklist_arte' : 'checklist_legenda';

      if (message.includes('does not exist') || message.includes('schema cache')) {
        response = await supabase
          .from('posting_calendar_items')
          .update({ [fallbackField]: value })
          .eq('id', postId)
          .select('id, checklist_arte, checklist_legenda, client_id')
          .single();
      }
    }

    if (response.error) {
      await systemError({
        scope: 'approval_center',
        action: 'queue_checklist_failed',
        tableName: 'posting_calendar_items',
        message: 'Falha ao atualizar checklist diretamente na central.',
        error: response.error,
        data: { postId, field, value },
      });
      throw response.error;
    }

    const data = response.data as Record<string, unknown>;
    const artifactChecked = Boolean(data.checklist_arte_ok ?? data.checklist_arte ?? false);
    const captionChecked = Boolean(data.checklist_legenda_ok ?? data.checklist_legenda ?? false);

    await systemLog({
      scope: 'approval_center',
      action: 'queue_checklist_updated',
      clientId: data.client_id ? String(data.client_id) : null,
      tableName: 'posting_calendar_items',
      message: 'Checklist atualizado com sucesso na central.',
      data: { postId, field, value },
    });

    return {
      id: String(data.id || ''),
      checklist_arte_ok: artifactChecked,
      checklist_legenda_ok: captionChecked,
    };
  },

  /** Adiciona um novo item individual a um pacote existente */
  async addItem(approvalId: string, item: CreateApprovalItemPayload): Promise<ApprovalItem> {
    const { data, error } = await supabase
      .from('approval_items')
      .insert({
        approval_id: approvalId,
        calendar_post_id: item.calendar_post_id ?? null,
        title: item.title,
        content: item.content ?? null,
        media_url: item.media_url ?? null,
        media_urls: item.media_urls ?? [],
        platform: item.platform ?? 'instagram',
        scheduled_date: item.scheduled_date ?? null,
        sort_order: item.sort_order ?? 0,
        status: 'pending',
      })
      .select('*')
      .single();

    if (error) throw error;

    await ContentApprovalService._syncParentStatus(approvalId);
    return (data ?? null) as ApprovalItem;
  },

  /** Remove um item de um pacote de aprovação */
  async deleteItem(itemId: string): Promise<void> {
    const { data: existing, error: readError } = await supabase
      .from('approval_items')
      .select('approval_id')
      .eq('id', itemId)
      .single();

    if (readError) throw readError;

    const approvalId = String((existing as any)?.approval_id || '');
    const { error } = await supabase.from('approval_items').delete().eq('id', itemId);
    if (error) throw new Error('Falha ao desvincular o item da aprovação.');

    if (approvalId) {
      await ContentApprovalService._syncParentStatus(approvalId);
    }
  },

  /** Cancela um pacote de aprovação permanentemente */
  async cancel(id: string): Promise<void> {
    const { error } = await supabase
      .from('approvals')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw new Error('Erro ao processar o cancelamento da aprovação.');
  },

  /** Obtém o total de aprovações pendentes de ação da agência */
  async getPendingCount(): Promise<number> {
    const { count, error } = await supabase
      .from('approvals')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending')
      .not('metadata->>source', 'is', null);

    if (error) return 0;
    return count ?? 0;
  },

  /** Lógica interna para re-calcular o status do pacote pai com base nos itens filhos */
  async _syncParentStatus(approvalId: string): Promise<void> {
    const { data: items } = await supabase
      .from('approval_items')
      .select('status')
      .eq('approval_id', approvalId);

    if (!items || items.length === 0) return;

    const statuses = items.map((i: any) => String(i.status));
    let newStatus: string;

    if (statuses.every((s) => s === 'approved')) {
      newStatus = 'approved';
    } else if (
      statuses.some((s) => s === 'rejected') &&
      statuses.every((s) => s !== 'pending')
    ) {
      newStatus = 'rejected';
    } else if (
      statuses.some((s) => s === 'revision_requested') &&
      statuses.every((s) => s !== 'pending')
    ) {
      newStatus = 'revision_requested';
    } else {
      newStatus = 'pending';
    }

    await supabase
      .from('approvals')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', approvalId);
  },
};
