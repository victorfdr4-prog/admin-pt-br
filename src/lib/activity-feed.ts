import type { TimelineEvent } from '@/services/timeline.service';

export type FeedActionType = 'create' | 'edit' | 'approve' | 'error';

export interface ActivityFeedItem {
  id: string;
  actorName: string;
  actorAvatar: string | null;
  actionType: FeedActionType;
  actionLabel: string;
  entityLabel: string;
  entityType: string;
  entityId: string | null;
  clientId: string | null;
  clientLabel: string | null;
  metaLabel: string | null;
  createdAt: string;
  href: string | null;
}

export interface ActivityFeedGroup {
  id: string;
  actorName: string;
  actorAvatar: string | null;
  actionType: FeedActionType;
  actionLabel: string;
  clientLabel: string | null;
  items: ActivityFeedItem[];
  createdAt: string;
  href: string | null;
}

type DashboardRecentActivity = {
  id: string;
  action: string;
  entity: string;
  entity_id: string | null;
  client_id: string | null;
  client_name: string | null;
  created_at: string | null;
  metadata: Record<string, unknown> | null;
};

const normalizeToken = (value: unknown) => String(value || '').trim().toLowerCase();

const prettifyToken = (value: string) =>
  value
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());

export const formatActivityFeedTime = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (minutes < 1) return 'agora';
  if (minutes < 60) return `${minutes} min`;
  if (hours < 24) return `${hours} h`;
  if (days < 7) return `${days} d`;
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
};

export const getActivityInitials = (value: string) =>
  value
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((chunk) => chunk[0]?.toUpperCase())
    .join('') || 'C';

export const inferFeedActionType = (action: string): FeedActionType => {
  const token = normalizeToken(action);
  if (token.includes('approv')) return 'approve';
  if (
    token.includes('delete') ||
    token.includes('error') ||
    token.includes('overdue') ||
    token.includes('atras') ||
    token.includes('reject') ||
    token.includes('cancel')
  ) {
    return 'error';
  }
  if (token.includes('update') || token.includes('edit') || token.includes('change')) return 'edit';
  return 'create';
};

const resolveEntityLabel = (entity: string, metadata?: Record<string, unknown> | null) => {
  const token = normalizeToken(entity);
  if (token === 'task' || token === 'tasks') return 'Tarefa';
  if (token === 'client' || token === 'clients') return 'Cliente';
  if (token.includes('calendar') || token === 'post' || token === 'posting_calendar_item') return 'Post';
  if (token.includes('approval')) return 'Aprovação';
  if (token.includes('drive') || token.includes('file') || token.includes('document')) return 'Arquivo';
  if (token.includes('finance')) return 'Financeiro';
  if (token.includes('intake') || token.includes('request')) return 'Solicitação';
  const metadataType = String(metadata?.type || metadata?.platform || '').trim();
  return metadataType ? prettifyToken(metadataType) : prettifyToken(token || 'atividade');
};

const resolveActionLabel = (action: string, metadata?: Record<string, unknown> | null) => {
  const token = normalizeToken(action);
  const summary = String(metadata?.summary || metadata?.title || '').trim();
  if (summary) return summary;
  if (token.includes('task_created')) return 'criou uma tarefa';
  if (token.includes('task_updated')) return 'atualizou uma tarefa';
  if (token.includes('task_deleted')) return 'removeu uma tarefa';
  if (token.includes('approval_requested')) return 'solicitou aprovação';
  if (token.includes('approval_approved')) return 'aprovou um item';
  if (token.includes('approval_rejected')) return 'rejeitou um item';
  if (token.includes('client_created')) return 'cadastrou um cliente';
  if (token.includes('client_updated')) return 'atualizou um cliente';
  if (token.includes('file_upload')) return 'enviou um arquivo';
  if (token.includes('file_deleted')) return 'removeu um arquivo';
  if (token.includes('posting') || token.includes('post')) return 'movimentou um post';
  return prettifyToken(token || 'atividade');
};

export const resolveActivityFeedHref = ({
  entityType,
  entityId,
  clientId,
  metadata,
}: {
  entityType: string;
  entityId: string | null;
  clientId: string | null;
  metadata?: Record<string, unknown> | null;
}) => {
  const entity = normalizeToken(entityType);
  const taskId = entityId || (metadata?.task_id ? String(metadata.task_id) : null);
  const effectiveClientId = clientId || (metadata?.client_id ? String(metadata.client_id) : null);

  if (entity === 'task' || entity === 'tasks') {
    const params = new URLSearchParams();
    if (effectiveClientId) params.set('client', effectiveClientId);
    if (taskId) params.set('task', taskId);
    const query = params.toString();
    return query ? `/boards?${query}` : '/boards';
  }

  if (entity === 'client' || entity === 'clients') {
    return effectiveClientId || entityId ? `/clients/${effectiveClientId || entityId}` : '/clients';
  }

  if (entity.includes('calendar') || entity === 'post' || entity === 'posting_calendar_item') {
    const params = new URLSearchParams();
    if (effectiveClientId) params.set('client', effectiveClientId);
    const month = metadata?.month ? String(metadata.month) : '';
    const year = metadata?.year ? String(metadata.year) : '';
    if (month) params.set('month', month);
    if (year) params.set('year', year);
    const query = params.toString();
    return query ? `/posting-calendar?${query}` : '/posting-calendar';
  }

  if (entity.includes('approval')) return '/hub?tab=approvals';
  if (entity.includes('intake') || entity.includes('request')) return '/hub?tab=requests';
  if (entity.includes('finance')) return '/finance';
  if (entity.includes('drive') || entity.includes('file') || entity.includes('document')) return '/drive';
  return effectiveClientId ? `/clients/${effectiveClientId}` : null;
};

export const buildFeedItemFromActivityLog = (
  activity: any,
  profiles: Map<string, any>,
  clients: Map<string, string>
): ActivityFeedItem => {
  const metadata = (activity?.metadata as Record<string, unknown> | null) || {};
  const actionType = inferFeedActionType(String(activity?.action || ''));
  const actor = profiles.get(String(activity?.user_id || '')) || null;
  const actorName = String(actor?.full_name || actor?.username || metadata.actor_name || 'Equipe');
  const entityType = String(activity?.entity || metadata.entity_type || 'atividade');
  const entityId = activity?.entity_id ? String(activity.entity_id) : null;
  const clientId = activity?.client_id ? String(activity.client_id) : null;

  return {
    id: String(activity?.id || crypto.randomUUID()),
    actorName,
    actorAvatar: actor?.avatar_url ? String(actor.avatar_url) : null,
    actionType,
    actionLabel: resolveActionLabel(String(activity?.action || ''), metadata),
    entityLabel: resolveEntityLabel(entityType, metadata),
    entityType,
    entityId,
    clientId,
    clientLabel: clientId ? clients.get(clientId) || String(metadata.client_name || '') || null : null,
    metaLabel: String(metadata.type || metadata.platform || metadata.status || '').trim() || null,
    createdAt: String(activity?.created_at || new Date().toISOString()),
    href: resolveActivityFeedHref({ entityType, entityId, clientId, metadata }),
  };
};

export const buildFeedItemFromTimelineEvent = (event: TimelineEvent): ActivityFeedItem => {
  const metadata = (event.metadata as Record<string, unknown> | null) || {};
  return {
    id: String(event.id),
    actorName: String(event.actor_name || metadata.actor_name || 'Equipe'),
    actorAvatar: metadata.actor_avatar ? String(metadata.actor_avatar) : null,
    actionType: inferFeedActionType(event.event_type),
    actionLabel: resolveActionLabel(event.event_type, metadata) || String(event.title || 'Atualizou uma atividade'),
    entityLabel: String(event.title || resolveEntityLabel(event.entity_type, metadata)),
    entityType: String(event.entity_type || 'atividade'),
    entityId: event.entity_id ? String(event.entity_id) : null,
    clientId: event.client_id ? String(event.client_id) : null,
    clientLabel: event.client_name ? String(event.client_name) : null,
    metaLabel: String(metadata.type || metadata.platform || metadata.status || event.description || '').trim() || null,
    createdAt: String(event.created_at || new Date().toISOString()),
    href: resolveActivityFeedHref({
      entityType: String(event.entity_type || ''),
      entityId: event.entity_id ? String(event.entity_id) : null,
      clientId: event.client_id ? String(event.client_id) : null,
      metadata,
    }),
  };
};

export const buildFeedItemFromDashboardRecent = (item: DashboardRecentActivity): ActivityFeedItem => {
  const metadata = item.metadata || {};
  return {
    id: String(item.id),
    actorName: String(metadata.actor_name || 'Equipe'),
    actorAvatar: metadata.actor_avatar ? String(metadata.actor_avatar) : null,
    actionType: inferFeedActionType(item.action),
    actionLabel: resolveActionLabel(item.action, metadata),
    entityLabel: resolveEntityLabel(item.entity, metadata),
    entityType: String(item.entity || 'atividade'),
    entityId: item.entity_id ? String(item.entity_id) : null,
    clientId: item.client_id ? String(item.client_id) : null,
    clientLabel: item.client_name ? String(item.client_name) : null,
    metaLabel: String(metadata.type || metadata.platform || metadata.status || '').trim() || null,
    createdAt: String(item.created_at || new Date().toISOString()),
    href: resolveActivityFeedHref({
      entityType: String(item.entity || ''),
      entityId: item.entity_id ? String(item.entity_id) : null,
      clientId: item.client_id ? String(item.client_id) : null,
      metadata,
    }),
  };
};

export const groupFeedItems = (items: ActivityFeedItem[], maxWindowMinutes = 25): ActivityFeedGroup[] => {
  const groups: ActivityFeedGroup[] = [];

  for (const item of items) {
    const lastGroup = groups[groups.length - 1];
    if (!lastGroup) {
      groups.push({
        id: item.id,
        actorName: item.actorName,
        actorAvatar: item.actorAvatar,
        actionType: item.actionType,
        actionLabel: item.actionLabel,
        clientLabel: item.clientLabel,
        items: [item],
        createdAt: item.createdAt,
        href: item.href,
      });
      continue;
    }

    const lastItem = lastGroup.items[lastGroup.items.length - 1];
    const withinWindow =
      Math.abs(new Date(lastItem.createdAt).getTime() - new Date(item.createdAt).getTime()) <=
      maxWindowMinutes * 60_000;
    const sameContext =
      lastGroup.actorName === item.actorName &&
      lastGroup.actionType === item.actionType &&
      normalizeToken(lastItem.entityType) === normalizeToken(item.entityType) &&
      (lastItem.clientId || '') === (item.clientId || '');

    if (withinWindow && sameContext) {
      lastGroup.items.push(item);
      lastGroup.createdAt = lastGroup.items[0].createdAt;
      lastGroup.href = lastGroup.href || item.href;
      continue;
    }

    groups.push({
      id: item.id,
      actorName: item.actorName,
      actorAvatar: item.actorAvatar,
      actionType: item.actionType,
      actionLabel: item.actionLabel,
      clientLabel: item.clientLabel,
      items: [item],
      createdAt: item.createdAt,
      href: item.href,
    });
  }

  return groups;
};
