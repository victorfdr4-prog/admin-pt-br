import { supabase } from '@/lib/supabase';
import {
  getTransitionRule,
  normalizeWorkflowStatus,
  type Role,
  type WorkflowAction,
  type WorkflowStatus,
} from '@/domain/postWorkflow';
import { toLegacyWorkflowRole } from '@/domain/accessControl';
import { systemError, systemLog } from './system-log.service';

export type WorkflowResolutionAction =
  | WorkflowAction
  | 'calendar_send_approval'
  | 'central_approve'
  | 'client_approve'
  | 'client_request_changes';

export interface ResolveNextWorkflowStatusInput {
  currentStatus: WorkflowStatus;
  requestedStatus?: string | null;
  actorRole: Role;
  action: WorkflowResolutionAction;
}

export interface ChangeStatusInput {
  postId: string;
  action: WorkflowAction;
  role: Role;
  comment?: string | null;
  metadata?: Record<string, unknown>;
}

export interface ApplyWorkflowTransitionInput {
  postId: string;
  action: WorkflowResolutionAction;
  role: Role;
  requestedStatus?: string | null;
  comment?: string | null;
  metadata?: Record<string, unknown>;
}

export interface ChangeStatusResult {
  postId: string;
  previousStatus: WorkflowStatus;
  nextStatus: WorkflowStatus;
  nextApprovalStatus: string;
  revisionCount: number;
  role: Role;
}

const FINAL_WORKFLOW_STATUSES: WorkflowStatus[] = [
  'aprovado_cliente',
  'aguardando_agendamento',
  'agendado',
  'publicado',
];

const SEND_TO_CLIENT_ALLOWED_STATUSES: WorkflowStatus[] = [
  'rascunho',
  'revisao_cliente',
];

const INTERNAL_REVIEW_ROLES = new Set<Role>([
  'gestor',
  'admin_estrategico',
  'admin_operacional',
  'sistema',
]);
const CREATION_ROLES = new Set<Role>([
  'social_media',
  'equipe',
  'gestor',
  'admin_estrategico',
  'admin_operacional',
  'sistema',
]);

export function isFinalStatus(status: WorkflowStatus): boolean {
  return FINAL_WORKFLOW_STATUSES.includes(status);
}

export function canSendToClient(status: WorkflowStatus): boolean {
  return SEND_TO_CLIENT_ALLOWED_STATUSES.includes(status);
}

export function resolveApprovalStatusForWorkflow(status: WorkflowStatus): string {
  if (status === 'revisao_cliente') return 'changes_requested';
  if (['aprovado_cliente', 'aguardando_agendamento', 'agendado', 'publicado'].includes(status)) {
    return 'approved';
  }
  return 'pending';
}

function isMissingColumnError(error: unknown, columnName: string) {
  const message = String((error as any)?.message || '').toLowerCase();
  return message.includes(columnName.toLowerCase()) || message.includes(`column "${columnName.toLowerCase()}"`);
}

function logWorkflowEvent(title: string, data: Record<string, unknown>) {
  console.groupCollapsed(`[Workflow PT-BR] ${title}`);
  Object.entries(data).forEach(([key, value]) => {
    console.log(`${key}:`, value);
  });
  console.groupEnd();
}

export function resolveNextWorkflowStatus(
  input: ResolveNextWorkflowStatusInput
): WorkflowStatus {
  const requestedStatus = input.requestedStatus
    ? normalizeWorkflowStatus(input.requestedStatus)
    : null;

  logWorkflowEvent('Ação recebida', {
    action: input.action,
    actorRole: input.actorRole,
    currentStatus: input.currentStatus,
    requestedStatus,
  });

  let nextStatus: WorkflowStatus | null = null;

  switch (input.action) {
    case 'calendar_send_approval': {
      if (!CREATION_ROLES.has(input.actorRole)) {
        throw new Error(`Papel ${input.actorRole} não pode enviar conteúdo para revisão interna.`);
      }
      if (!['rascunho', 'revisao_cliente'].includes(input.currentStatus)) {
        throw new Error(`Transição inválida: ${input.currentStatus} não pode voltar para revisão interna.`);
      }
      nextStatus = 'revisao_interna';
      break;
    }
    case 'central_approve': {
      if (!INTERNAL_REVIEW_ROLES.has(input.actorRole)) {
        throw new Error(`Papel ${input.actorRole} não pode aprovar na central.`);
      }
      if (input.currentStatus !== 'revisao_interna') {
        throw new Error(`Transição inválida: ${input.currentStatus} não pode ser aprovado internamente.`);
      }
      nextStatus = 'aprovado_interno';
      break;
    }
    case 'client_approve': {
      if (input.actorRole !== 'cliente') {
        throw new Error(`Papel ${input.actorRole} não pode aprovar como cliente.`);
      }
      if (input.currentStatus !== 'em_aprovacao_cliente') {
        throw new Error(`Transição inválida: ${input.currentStatus} -> client_approve`);
      }
      nextStatus = 'aprovado_cliente';
      break;
    }
    case 'client_request_changes': {
      if (input.actorRole !== 'cliente') {
        throw new Error(`Papel ${input.actorRole} não pode solicitar revisão do cliente.`);
      }
      if (input.currentStatus !== 'em_aprovacao_cliente') {
        throw new Error(`Transição inválida: ${input.currentStatus} -> client_request_changes`);
      }
      nextStatus = 'revisao_cliente';
      break;
    }
    default: {
      const rule = getTransitionRule(input.currentStatus, input.action as WorkflowAction);

      if (!rule) {
        throw new Error(`Transição inválida: ${input.currentStatus} -> ${input.action}`);
      }

      if (!rule.allowedRoles.includes(input.actorRole)) {
        throw new Error(`Papel ${input.actorRole} não pode executar ${input.action}.`);
      }

      nextStatus = rule.to;
      break;
    }
  }

  if (!nextStatus) {
    throw new Error('Não foi possível resolver o próximo status do workflow.');
  }

  logWorkflowEvent('Próximo status resolvido', {
    action: input.action,
    actorRole: input.actorRole,
    currentStatus: input.currentStatus,
    requestedStatus,
    nextStatus,
  });

  return nextStatus;
}

async function applyTransitionToDatabase(
  input: ApplyWorkflowTransitionInput
): Promise<ChangeStatusResult> {
  const { data: row, error: readError } = await supabase
    .from('posting_calendar_items')
    .select('id, workflow_status, revision_count, scheduled_date')
    .eq('id', input.postId)
    .single();

  if (readError || !row) throw readError || new Error('Post não encontrado.');

  const previousStatus = normalizeWorkflowStatus((row as any).workflow_status);

  if (
    isFinalStatus(previousStatus) &&
    ['calendar_send_approval', 'enviar_revisao_interna', 'aprovar_interno', 'enviar_cliente'].includes(input.action)
  ) {
    logWorkflowEvent('Transição inválida bloqueada', {
      postId: input.postId,
      currentStatus: previousStatus,
      action: input.action,
      actorRole: input.role,
      reason: 'final_status_guard',
    });
    void systemLog({
      scope: 'workflow',
      action: 'invalid_transition_blocked',
      tableName: 'posting_calendar_items',
      message: 'Tentativa bloqueada de reiniciar fluxo em status final.',
      data: {
        postId: input.postId,
        currentStatus: previousStatus,
        action: input.action,
        actorRole: input.role,
      },
      level: 'warning',
    });
    throw new Error(
      `Guard clause: não é permitido reiniciar fluxo de item finalizado (${previousStatus}) com ${input.action}.`
    );
  }

  const nextStatus = resolveNextWorkflowStatus({
    currentStatus: previousStatus,
    requestedStatus: input.requestedStatus,
    actorRole: input.role,
    action: input.action,
  });

  const currentRevision = Number((row as any).revision_count || 0);
  const shouldIncrementRevision =
    nextStatus === 'revisao_cliente' ||
    (nextStatus === 'rascunho' && input.action === 'retornar_rascunho');
  const nextRevision = shouldIncrementRevision ? currentRevision + 1 : currentRevision;
  const nextApprovalStatus = resolveApprovalStatusForWorkflow(nextStatus);

  const basePayload: Record<string, unknown> = {
    workflow_status: nextStatus,
    approval_status: nextApprovalStatus,
    owner_role: input.role,
    revision_count: nextRevision,
    last_transition_at: new Date().toISOString(),
  };

  if (nextStatus === 'aprovado_cliente' || nextStatus === 'aguardando_agendamento') {
    basePayload.approved_at = new Date().toISOString();
  }

  if (nextStatus === 'agendado') {
    basePayload.scheduled_date =
      typeof input.metadata?.scheduled_date === 'string' && input.metadata.scheduled_date.trim()
        ? input.metadata.scheduled_date
        : (row as any).scheduled_date || new Date().toISOString();
    basePayload.status = 'scheduled';
  }

  if (nextStatus === 'publicado') {
    basePayload.published_at =
      typeof input.metadata?.published_at === 'string' && input.metadata.published_at.trim()
        ? input.metadata.published_at
        : new Date().toISOString();
    basePayload.status = 'published';
  }

  if (input.comment) {
    basePayload.approval_notes = input.comment;
  }

  let updatePayload: Record<string, unknown> = { ...basePayload };

  let updateError = (
    await supabase
      .from('posting_calendar_items')
      .update(updatePayload)
      .eq('id', input.postId)
  ).error;

  if (updateError && isMissingColumnError(updateError, 'approval_notes')) {
    const { approval_notes, ...withoutApprovalNotes } = updatePayload;
    updatePayload = withoutApprovalNotes;
    updateError = (
      await supabase
        .from('posting_calendar_items')
        .update(updatePayload)
        .eq('id', input.postId)
    ).error;
  }

  if (
    updateError &&
    (isMissingColumnError(updateError, 'scheduled_date') || isMissingColumnError(updateError, 'published_at'))
  ) {
    const { scheduled_date, published_at, ...withoutOperationalDates } = updatePayload as Record<string, unknown> & {
      scheduled_date?: unknown;
      published_at?: unknown;
    };
    updatePayload = withoutOperationalDates;
    updateError = (
      await supabase
        .from('posting_calendar_items')
        .update(updatePayload)
        .eq('id', input.postId)
    ).error;
  }

  if (updateError && String(updateError.message || '').toLowerCase().includes('owner_role')) {
    const fallbackPayload = {
      ...updatePayload,
      owner_role: toLegacyWorkflowRole(input.role),
    };

    updateError = (
      await supabase
        .from('posting_calendar_items')
        .update(fallbackPayload)
        .eq('id', input.postId)
    ).error;
  }

  if (updateError) {
    console.error('[Workflow] Query error', {
      table: 'posting_calendar_items',
      postId: input.postId,
      payload: updatePayload,
      error: updateError,
    });
    void systemError({
      scope: 'workflow',
      action: 'transition_update_failed',
      tableName: 'posting_calendar_items',
      message: 'Falha ao persistir atualização de workflow.',
      error: updateError,
      data: {
        postId: input.postId,
        previousStatus,
        nextStatus,
        actorRole: input.role,
      },
    });
    throw updateError;
  }

  logWorkflowEvent('Status de aprovação atualizado', {
    postId: input.postId,
    previousStatus,
    nextStatus,
    nextApprovalStatus,
    revisionCount: nextRevision,
    actorRole: input.role,
  });
  void systemLog({
    scope: 'workflow',
    action: 'transition_applied',
    tableName: 'posting_calendar_items',
    message: 'Workflow atualizado com sucesso.',
    data: {
      postId: input.postId,
      previousStatus,
      nextStatus,
      nextApprovalStatus,
      revisionCount: nextRevision,
      actorRole: input.role,
    },
  });

  try {
    await supabase.from('post_logs').insert({
      post_id: input.postId,
      action: input.action,
      from_status: previousStatus,
      to_status: nextStatus,
      user_role: input.role,
      owner_role: input.role,
      from_version:
        typeof input.metadata?.from_version === 'number' ? Number(input.metadata.from_version) : null,
      to_version:
        typeof input.metadata?.to_version === 'number' ? Number(input.metadata.to_version) : null,
      metadata: {
        action: input.action,
        comment: input.comment ?? null,
        revision_count: nextRevision,
        requested_status: input.requestedStatus ?? null,
        approval_status: nextApprovalStatus,
        ...(input.metadata || {}),
      },
    });
  } catch (error) {
    console.warn('Falha ao registrar post_logs:', error);
  }

  return {
    postId: input.postId,
    previousStatus,
    nextStatus,
    nextApprovalStatus,
    revisionCount: nextRevision,
    role: input.role,
  };
}

export const PostWorkflowService = {
  resolveNextWorkflowStatus,
  resolveApprovalStatusForWorkflow,

  async applyResolvedTransition(input: ApplyWorkflowTransitionInput): Promise<ChangeStatusResult> {
    return applyTransitionToDatabase(input);
  },

  async prepareScheduling(input: {
    postId: string;
    role: Role;
    comment?: string | null;
    metadata?: Record<string, unknown>;
  }): Promise<ChangeStatusResult | null> {
    const { data: row, error } = await supabase
      .from('posting_calendar_items')
      .select('workflow_status')
      .eq('id', input.postId)
      .single();

    if (error || !row) throw error || new Error('Post não encontrado.');

    const currentStatus = normalizeWorkflowStatus((row as any).workflow_status);
    if (currentStatus === 'aguardando_agendamento') {
      return null;
    }

    if (currentStatus !== 'aprovado_cliente') {
      throw new Error(
        `Somente posts aprovados pelo cliente podem entrar na fila de agendamento. Status atual: ${currentStatus}.`
      );
    }

    return applyTransitionToDatabase({
      postId: input.postId,
      action: 'preparar_agendamento',
      role: input.role,
      comment: input.comment || 'Post enviado para a fila de agendamento.',
      metadata: input.metadata,
    });
  },

  async schedulePost(input: {
    postId: string;
    role: Role;
    scheduledDate: string;
    comment?: string | null;
    metadata?: Record<string, unknown>;
  }): Promise<ChangeStatusResult> {
    await this.prepareScheduling({
      postId: input.postId,
      role: input.role,
      comment: 'Post preparado para agendamento.',
      metadata: input.metadata,
    });

    return applyTransitionToDatabase({
      postId: input.postId,
      action: 'agendar',
      role: input.role,
      comment: input.comment || 'Agendamento confirmado pela operação.',
      metadata: {
        ...(input.metadata || {}),
        scheduled_date: input.scheduledDate,
      },
    });
  },

  async publishPost(input: {
    postId: string;
    role: Role;
    publishedAt?: string | null;
    comment?: string | null;
    metadata?: Record<string, unknown>;
  }): Promise<ChangeStatusResult> {
    return applyTransitionToDatabase({
      postId: input.postId,
      action: 'publicar',
      role: input.role,
      comment: input.comment || 'Publicação confirmada pela operação.',
      metadata: {
        ...(input.metadata || {}),
        published_at: input.publishedAt || new Date().toISOString(),
      },
    });
  },

  async changeStatus(input: ChangeStatusInput): Promise<ChangeStatusResult> {
    return applyTransitionToDatabase({
      postId: input.postId,
      action: input.action,
      role: input.role,
      comment: input.comment,
      metadata: input.metadata,
    });
  },

  async changeManyStatus(
    postIds: string[],
    input: Omit<ChangeStatusInput, 'postId'>
  ): Promise<ChangeStatusResult[]> {
    const results: ChangeStatusResult[] = [];
    for (const postId of postIds) {
      const result = await this.changeStatus({ ...input, postId });
      results.push(result);
    }
    return results;
  },
};
