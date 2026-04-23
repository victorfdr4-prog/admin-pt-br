import type { FunctionalProfile, SystemRole } from '@/domain/accessControl';

export type WorkflowStatus =
  | 'rascunho'
  | 'revisao_interna'
  | 'aprovado_interno'
  | 'em_aprovacao_cliente'
  | 'revisao_cliente'
  | 'aprovado_cliente'
  | 'aguardando_agendamento'
  | 'agendado'
  | 'publicado';

export type WorkflowAction =
  | 'enviar_revisao_interna'
  | 'aprovar_interno'
  | 'enviar_cliente'
  | 'aprovar_cliente'
  | 'solicitar_revisao_cliente'
  | 'retornar_rascunho'
  | 'preparar_agendamento'
  | 'agendar'
  | 'publicar';

export type Role = Exclude<SystemRole, 'blocked'>;

export interface TransitionRule {
  from: WorkflowStatus;
  action: WorkflowAction;
  to: WorkflowStatus;
  allowedRoles: Role[];
  requiresComment?: boolean;
  incrementsRevision?: boolean;
}

export interface WorkflowStageOwner {
  status: WorkflowStatus;
  label: string;
  naturalOwners: Role[];
  naturalProfiles: FunctionalProfile[];
}

export const WORKFLOW_STATUS_LABELS: Record<WorkflowStatus, string> = {
  rascunho: 'Rascunho',
  revisao_interna: 'Revisão interna',
  aprovado_interno: 'Aprovado interno',
  em_aprovacao_cliente: 'Em aprovação do cliente',
  revisao_cliente: 'Em revisão solicitada pelo cliente',
  aprovado_cliente: 'Aprovado pelo cliente',
  aguardando_agendamento: 'Aguardando agendamento',
  agendado: 'Agendado',
  publicado: 'Publicado',
};

export const WORKFLOW_TRANSITIONS: TransitionRule[] = [
  {
    from: 'rascunho',
    action: 'enviar_revisao_interna',
    to: 'revisao_interna',
    allowedRoles: ['social_media', 'gestor', 'admin_estrategico', 'admin_operacional'],
  },
  {
    from: 'revisao_interna',
    action: 'aprovar_interno',
    to: 'aprovado_interno',
    allowedRoles: ['gestor', 'admin_estrategico', 'admin_operacional'],
  },
  {
    from: 'revisao_interna',
    action: 'retornar_rascunho',
    to: 'rascunho',
    allowedRoles: ['gestor', 'admin_estrategico', 'admin_operacional'],
    requiresComment: true,
    incrementsRevision: true,
  },
  {
    from: 'aprovado_interno',
    action: 'enviar_cliente',
    to: 'em_aprovacao_cliente',
    allowedRoles: ['social_media', 'gestor', 'admin_estrategico', 'admin_operacional'],
  },
  {
    from: 'em_aprovacao_cliente',
    action: 'aprovar_cliente',
    to: 'aprovado_cliente',
    allowedRoles: ['cliente'],
  },
  {
    from: 'em_aprovacao_cliente',
    action: 'solicitar_revisao_cliente',
    to: 'revisao_cliente',
    allowedRoles: ['cliente'],
    requiresComment: true,
    incrementsRevision: true,
  },
  {
    from: 'revisao_cliente',
    action: 'enviar_revisao_interna',
    to: 'revisao_interna',
    allowedRoles: ['social_media', 'gestor', 'admin_estrategico', 'admin_operacional', 'equipe'],
  },
  {
    from: 'aprovado_cliente',
    action: 'preparar_agendamento',
    to: 'aguardando_agendamento',
    allowedRoles: ['social_media', 'admin_estrategico', 'admin_operacional', 'equipe'],
  },
  {
    from: 'aguardando_agendamento',
    action: 'agendar',
    to: 'agendado',
    allowedRoles: ['social_media', 'admin_estrategico', 'admin_operacional'],
  },
  {
    from: 'agendado',
    action: 'publicar',
    to: 'publicado',
    allowedRoles: ['social_media', 'admin_estrategico', 'admin_operacional'],
  },
];

export const WORKFLOW_STAGE_OWNERS: WorkflowStageOwner[] = [
  {
    status: 'rascunho',
    label: 'Criação em andamento',
    naturalOwners: ['social_media', 'equipe', 'admin_operacional'],
    naturalProfiles: ['criacao', 'operacao'],
  },
  {
    status: 'revisao_interna',
    label: 'Checkpoint interno',
    naturalOwners: ['admin_estrategico', 'admin_operacional', 'gestor'],
    naturalProfiles: ['direcao', 'operacao', 'gestao'],
  },
  {
    status: 'aprovado_interno',
    label: 'Liberado internamente',
    naturalOwners: ['admin_estrategico', 'admin_operacional', 'gestor'],
    naturalProfiles: ['direcao', 'operacao', 'gestao'],
  },
  {
    status: 'em_aprovacao_cliente',
    label: 'Cliente avaliando',
    naturalOwners: ['cliente', 'admin_operacional'],
    naturalProfiles: ['cliente', 'operacao'],
  },
  {
    status: 'revisao_cliente',
    label: 'Aguardando nova rodada interna',
    naturalOwners: ['social_media', 'admin_operacional', 'equipe'],
    naturalProfiles: ['criacao', 'operacao'],
  },
  {
    status: 'aprovado_cliente',
    label: 'Aprovado pelo cliente',
    naturalOwners: ['cliente', 'admin_operacional'],
    naturalProfiles: ['cliente', 'operacao'],
  },
  {
    status: 'aguardando_agendamento',
    label: 'Fila de agendamento',
    naturalOwners: ['social_media', 'admin_operacional', 'equipe'],
    naturalProfiles: ['criacao', 'operacao'],
  },
  {
    status: 'agendado',
    label: 'Agendado',
    naturalOwners: ['social_media', 'admin_operacional'],
    naturalProfiles: ['criacao', 'operacao'],
  },
  {
    status: 'publicado',
    label: 'Publicado e acompanhando',
    naturalOwners: ['admin_operacional', 'social_media'],
    naturalProfiles: ['operacao', 'criacao'],
  },
];

const LEGACY_TO_STANDARD_STATUS: Record<string, WorkflowStatus> = {
  planned: 'rascunho',
  draft: 'rascunho',
  in_review: 'revisao_interna',
  approved_internal: 'aprovado_interno',
  approved: 'aprovado_cliente',
  pending: 'em_aprovacao_cliente',
  changes_requested: 'revisao_cliente',
  revisao_cliente: 'revisao_cliente',
  rejected: 'revisao_cliente',
  pronto_agendamento: 'aguardando_agendamento',
  aguardando_agendamento: 'aguardando_agendamento',
  ready_to_schedule: 'aguardando_agendamento',
  scheduled: 'agendado',
  published: 'publicado',
  PLANEJADO: 'rascunho',
  REVISAO_INTERNA: 'revisao_interna',
  ENVIADO_CLIENTE: 'em_aprovacao_cliente',
  REPROVADO: 'rascunho',
  APROVADO: 'aprovado_cliente',
  PROGRAMADO: 'agendado',
  POSTADO: 'publicado',
};

export function normalizeWorkflowStatus(rawStatus: string | null | undefined): WorkflowStatus {
  const normalized = String(rawStatus || '').trim();
  if (!normalized) return 'rascunho';
  if ((Object.keys(WORKFLOW_STATUS_LABELS) as WorkflowStatus[]).includes(normalized as WorkflowStatus)) {
    return normalized as WorkflowStatus;
  }

  const normalizedToken = normalized
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\s-]+/g, '_');

  return LEGACY_TO_STANDARD_STATUS[normalized] || LEGACY_TO_STANDARD_STATUS[normalizedToken] || 'rascunho';
}

export function getTransitionRule(from: WorkflowStatus, action: WorkflowAction): TransitionRule | null {
  return WORKFLOW_TRANSITIONS.find((rule) => rule.from === from && rule.action === action) || null;
}
