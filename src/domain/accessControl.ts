export type SystemRole =
  | 'admin_estrategico'
  | 'admin_operacional'
  | 'gestor'
  | 'social_media'
  | 'equipe'
  | 'cliente'
  | 'sistema'
  | 'blocked';

export type AccessScope = 'full' | 'limited' | 'client_only';

export type FunctionalProfile =
  | 'direcao'
  | 'operacao'
  | 'gestao'
  | 'criacao'
  | 'cliente';

export type AppModuleKey =
  | 'dashboard'
  | 'boards'
  | 'content_approvals'
  | 'approvals_legacy'
  | 'intake'
  | 'posting_calendar'
  | 'clients'
  | 'client_hub'
  | 'drive'
  | 'documents'
  | 'finance'
  | 'team'
  | 'logs'
  | 'settings'
  | 'whatsapp';

export interface AccessContextInput {
  role?: string | null;
  full_name?: string | null;
  username?: string | null;
  email?: string | null;
  access_scope?: string | null;
  functional_profile?: string | null;
}

export interface AccessContext {
  role: SystemRole;
  accessScope: AccessScope;
  functionalProfile: FunctionalProfile;
  roleLabel: string;
  accessScopeLabel: string;
  functionalProfileLabel: string;
  fullAccess: boolean;
}

export const SYSTEM_ROLE_LABELS: Record<SystemRole, string> = {
  admin_estrategico: 'Admin Estratégico',
  admin_operacional: 'Admin Operacional',
  gestor: 'Gestor',
  social_media: 'Social Media',
  equipe: 'Equipe',
  cliente: 'Cliente',
  sistema: 'Sistema',
  blocked: 'Bloqueado',
};

export const ACCESS_SCOPE_LABELS: Record<AccessScope, string> = {
  full: 'Full',
  limited: 'Limitado',
  client_only: 'Cliente',
};

export const FUNCTIONAL_PROFILE_LABELS: Record<FunctionalProfile, string> = {
  direcao: 'Direção',
  operacao: 'Operação',
  gestao: 'Gestão',
  criacao: 'Criação',
  cliente: 'Cliente',
};

export const FULL_ACCESS_ROLES: SystemRole[] = [
  'admin_estrategico',
  'admin_operacional',
  'sistema',
];

const MODULE_ACCESS: Record<AppModuleKey, SystemRole[]> = {
  dashboard: ['admin_estrategico', 'admin_operacional', 'gestor', 'social_media', 'equipe'],
  boards: ['admin_estrategico', 'admin_operacional', 'gestor', 'social_media', 'equipe'],
  content_approvals: ['admin_estrategico', 'admin_operacional', 'gestor', 'social_media'],
  approvals_legacy: ['admin_estrategico', 'admin_operacional', 'gestor', 'social_media'],
  intake: ['admin_estrategico', 'admin_operacional', 'gestor', 'social_media', 'equipe'],
  posting_calendar: ['admin_estrategico', 'admin_operacional', 'gestor', 'social_media'],
  clients: ['admin_estrategico', 'admin_operacional', 'gestor', 'social_media', 'equipe'],
  client_hub: ['admin_estrategico', 'admin_operacional', 'gestor', 'social_media', 'equipe'],
  drive: ['admin_estrategico', 'admin_operacional', 'gestor', 'social_media', 'equipe'],
  documents: ['admin_estrategico', 'admin_operacional', 'gestor', 'social_media', 'equipe'],
  finance: ['admin_estrategico', 'admin_operacional'],
  team: ['admin_estrategico', 'admin_operacional'],
  logs: ['admin_estrategico', 'admin_operacional', 'gestor'],
  settings: ['admin_estrategico', 'admin_operacional'],
  whatsapp: ['admin_estrategico', 'admin_operacional'],
};

const normalizeIdentityToken = (value: string | null | undefined) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const matchesLeadershipIdentity = (input: AccessContextInput, terms: string[]) => {
  const haystack = [
    normalizeIdentityToken(input.full_name),
    normalizeIdentityToken(input.username),
    normalizeIdentityToken(String(input.email || '').split('@')[0]),
  ];

  return haystack.some((value) => value && terms.some((term) => value.includes(term)));
};

const inferLeadershipRole = (input: AccessContextInput): SystemRole | null => {
  if (matchesLeadershipIdentity(input, ['nathalia', 'natalia', 'nath', 'hammes'])) {
    return 'admin_estrategico';
  }

  if (matchesLeadershipIdentity(input, ['victor', 'vitor', 'teles'])) {
    return 'admin_operacional';
  }

  return null;
};

export const normalizeSystemRole = (
  rawRole: string | null | undefined,
  input: AccessContextInput = {}
): SystemRole => {
  const normalized = normalizeIdentityToken(rawRole);

  if (normalized === 'admin_estrategico') return 'admin_estrategico';
  if (normalized === 'admin_operacional') return 'admin_operacional';
  if (normalized === 'gestor' || normalized === 'manager') return 'gestor';
  if (normalized === 'social_media' || normalized === 'socialmedia') return 'social_media';
  if (normalized === 'equipe' || normalized === 'team' || normalized === 'user') {
    if (normalizeFunctionalProfile(input.functional_profile, 'equipe') === 'criacao') {
      return 'social_media';
    }
    if (normalizeIdentityToken(input.access_scope) === 'client_only') {
      return 'cliente';
    }
    return 'equipe';
  }
  if (normalized === 'cliente' || normalized === 'client') return 'cliente';
  if (normalized === 'sistema' || normalized === 'system') return 'sistema';
  if (normalized === 'blocked') return 'blocked';

  if (normalized === 'admin') {
    return inferLeadershipRole(input) ?? 'admin_operacional';
  }

  return inferLeadershipRole(input) ?? 'equipe';
};

export const normalizeAccessScope = (
  rawScope: string | null | undefined,
  role: SystemRole
): AccessScope => {
  const normalized = normalizeIdentityToken(rawScope);

  if (normalized === 'full') return 'full';
  if (normalized === 'limited') return 'limited';
  if (normalized === 'client_only') return 'client_only';

  if (role === 'cliente') return 'client_only';
  if (FULL_ACCESS_ROLES.includes(role)) return 'full';
  return 'limited';
};

export const normalizeFunctionalProfile = (
  rawProfile: string | null | undefined,
  role: SystemRole
): FunctionalProfile => {
  const normalized = normalizeIdentityToken(rawProfile);

  if (normalized === 'direcao') return 'direcao';
  if (normalized === 'operacao') return 'operacao';
  if (normalized === 'gestao') return 'gestao';
  if (normalized === 'criacao') return 'criacao';
  if (normalized === 'cliente') return 'cliente';

  if (role === 'admin_estrategico') return 'direcao';
  if (role === 'admin_operacional' || role === 'equipe' || role === 'sistema') return 'operacao';
  if (role === 'gestor') return 'gestao';
  if (role === 'social_media') return 'criacao';
  return 'cliente';
};

export const hasFullAccess = (role: SystemRole | null | undefined) =>
  FULL_ACCESS_ROLES.includes(normalizeSystemRole(role || null));

export const canAccessModule = (role: SystemRole | null | undefined, module: AppModuleKey) => {
  const normalizedRole = normalizeSystemRole(role || null);
  if (hasFullAccess(normalizedRole)) return true;
  return MODULE_ACCESS[module].includes(normalizedRole);
};

export const buildAccessContext = (input: AccessContextInput): AccessContext => {
  const role = normalizeSystemRole(input.role, input);
  const accessScope = normalizeAccessScope(input.access_scope, role);
  const functionalProfile = normalizeFunctionalProfile(input.functional_profile, role);

  return {
    role,
    accessScope,
    functionalProfile,
    roleLabel: SYSTEM_ROLE_LABELS[role],
    accessScopeLabel: ACCESS_SCOPE_LABELS[accessScope],
    functionalProfileLabel: FUNCTIONAL_PROFILE_LABELS[functionalProfile],
    fullAccess: hasFullAccess(role),
  };
};

export const isFullAdmin = (role: string | null | undefined) => {
  const normalized = normalizeSystemRole(role || null);
  return normalized === 'admin_estrategico' || normalized === 'admin_operacional';
};

export const canApproveInternally = (role: string | null | undefined) => {
  const normalized = normalizeSystemRole(role || null);
  return ['admin_estrategico', 'admin_operacional', 'gestor'].includes(normalized);
};

export const canSendToClient = (role: string | null | undefined) => {
  const normalized = normalizeSystemRole(role || null);
  return ['admin_estrategico', 'admin_operacional', 'gestor', 'social_media'].includes(normalized);
};

export const canManageIntake = (role: string | null | undefined) => {
  const normalized = normalizeSystemRole(role || null);
  return ['admin_estrategico', 'admin_operacional', 'gestor', 'social_media', 'equipe'].includes(normalized);
};

export const canManageBoards = (role: string | null | undefined) => {
  const normalized = normalizeSystemRole(role || null);
  return ['admin_estrategico', 'admin_operacional', 'gestor'].includes(normalized);
};

export const canAccessClientHub = (role: string | null | undefined) => {
  const normalized = normalizeSystemRole(role || null);
  return normalized !== 'blocked' && normalized !== 'cliente';
};

export const toLegacyProfileRole = (role: SystemRole) => {
  if (role === 'admin_estrategico' || role === 'admin_operacional' || role === 'sistema') {
    return 'admin';
  }
  if (role === 'gestor') return 'manager';
  return 'user';
};

export const toLegacyWorkflowRole = (role: SystemRole) => {
  if (role === 'admin_estrategico' || role === 'admin_operacional' || role === 'gestor') {
    return 'admin';
  }
  if (role === 'cliente') return 'client';
  if (role === 'sistema') return 'sistema';
  return 'social_media';
};
