export type SystemRole =
  | 'admin_estrategico'
  | 'admin_operacional'
  | 'gestor'
  | 'social_media'
  | 'equipe'
  | 'cliente'
  | 'blocked';

export type AccessScope = 'full' | 'limited' | 'client_only';

export type FunctionalProfile =
  | 'direcao'
  | 'operacao'
  | 'gestao'
  | 'criacao'
  | 'cliente';

export function isFullAdmin(role?: string | null): boolean {
  return role === 'admin_estrategico' || role === 'admin_operacional';
}

export function isStrategicAdmin(role?: string | null): boolean {
  return role === 'admin_estrategico';
}

export function isOperationalAdmin(role?: string | null): boolean {
  return role === 'admin_operacional';
}

export function canApproveInternally(role?: string | null): boolean {
  return (
    role === 'admin_estrategico' ||
    role === 'admin_operacional' ||
    role === 'gestor'
  );
}

export function canSendToClient(role?: string | null): boolean {
  return (
    role === 'admin_estrategico' ||
    role === 'admin_operacional' ||
    role === 'gestor' ||
    role === 'social_media'
  );
}

export function canManageIntake(role?: string | null): boolean {
  return (
    role === 'admin_estrategico' ||
    role === 'admin_operacional' ||
    role === 'gestor' ||
    role === 'equipe'
  );
}

export function canManageBoards(role?: string | null): boolean {
  return (
    role === 'admin_estrategico' ||
    role === 'admin_operacional' ||
    role === 'gestor'
  );
}

export function canAccessClientHub(role?: string | null): boolean {
  return role !== 'blocked' && role !== 'cliente' && !!role;
}

export function canEditContent(role?: string | null): boolean {
  return (
    role === 'admin_estrategico' ||
    role === 'admin_operacional' ||
    role === 'gestor' ||
    role === 'social_media' ||
    role === 'equipe'
  );
}

export function canViewAllClients(role?: string | null): boolean {
  return (
    role === 'admin_estrategico' ||
    role === 'admin_operacional' ||
    role === 'gestor'
  );
}

export function getRoleLabel(role?: string | null): string {
  switch (role) {
    case 'admin_estrategico':
      return 'Admin Estratégico';
    case 'admin_operacional':
      return 'Admin Operacional';
    case 'gestor':
      return 'Gestor';
    case 'social_media':
      return 'Social Media';
    case 'equipe':
      return 'Equipe';
    case 'cliente':
      return 'Cliente';
    case 'blocked':
      return 'Bloqueado';
    default:
      return 'Sem perfil';
  }
}