import type { TimelineEvent } from '@/services/timeline.service';

export type FeedActionType = 'create' | 'edit' | 'approve' | 'error';

export type ActivityFeedItem = {
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
};

export type ActivityFeedGroup = {
  id: string;
  primary: ActivityFeedItem;
  items: ActivityFeedItem[];
};

const readableEntity = (value: string) => {
  const token = String(value || '').toLowerCase();
  if (token === 'task') return 'tarefa';
  if (token === 'client') return 'cliente';
  if (token === 'file') return 'arquivo';
  if (token === 'approval') return 'aprovação';
  if (token === 'posting_calendar') return 'calendário';
  if (token === 'document') return 'documento';
  if (token === 'intake') return 'solicitação';
  if (token === 'finance_entry') return 'financeiro';
  return token || 'atividade';
};

export const inferActionType = (value: string): FeedActionType => {
  const token = String(value || '').toLowerCase();
  if (token.includes('approv')) return 'approve';
  if (token.includes('delete') || token.includes('error') || token.includes('overdue') || token.includes('atras')) return 'error';
  if (token.includes('update') || token.includes('edit') || token.includes('change')) return 'edit';
  return 'create';
};

const readableAction = (action: string, entity: string) => {
  const token = String(action || '').toLowerCase();
  const label = readableEntity(entity);
  if (token.includes('created')) return `criou ${label}`;
  if (token.includes('updated') || token.includes('edit')) return `atualizou ${label}`;
  if (token.includes('deleted')) return `removeu ${label}`;
  if (token.includes('approv')) return `aprovou ${label}`;
  if (token.includes('rejected')) return `rejeitou ${label}`;
  if (token.includes('requested')) return `solicitou ${label}`;
  return token.replace(/_/g, ' ') || `moveu ${label}`;
};

export const buildFeedItemFromActivityLog = (
  activity: any,
  profiles: Map<string, any>,
  clients: Map<string, string>
): ActivityFeedItem => {
  const actionType = inferActionType(activity.action);
  const actor = profiles.get(String(activity.user_id || '')) || null;
  const metadata = activity.metadata || {};

  return {
    id: String(activity.id),
    actorName: String(actor?.full_name || actor?.username || metadata.actor_name || 'Equipe'),
    actorAvatar: actor?.avatar_url ? String(actor.avatar_url) : null,
    actionType,
    actionLabel: String(metadata.summary || readableAction(activity.action, activity.entity)),
    entityLabel: readableEntity(activity.entity),
    entityType: String(activity.entity || ''),
    entityId: activity.entity_id ? String(activity.entity_id) : null,
    clientId: activity.client_id ? String(activity.client_id) : null,
    clientLabel: activity.client_id ? clients.get(String(activity.client_id)) || null : null,
    metaLabel: String(metadata.type || metadata.platform || metadata.status || '').trim() || null,
    createdAt: String(activity.created_at || new Date().toISOString()),
  };
};

export const buildFeedItemFromTimeline = (event: TimelineEvent): ActivityFeedItem => {
  const actionType = inferActionType(event.event_type);
  const metadata = event.metadata || {};
  return {
    id: String(event.id),
    actorName: String(event.actor_name || metadata.actor_name || 'Equipe'),
    actorAvatar: null,
    actionType,
    actionLabel: String(event.title || readableAction(event.event_type, event.entity_type)),
    entityLabel: readableEntity(event.entity_type),
    entityType: String(event.entity_type || ''),
    entityId: event.entity_id ? String(event.entity_id) : null,
    clientId: event.client_id ? String(event.client_id) : null,
    clientLabel: event.client_name ? String(event.client_name) : null,
    metaLabel: String(metadata.type || metadata.platform || '').trim() || null,
    createdAt: String(event.created_at || new Date().toISOString()),
  };
};

export const groupConsecutiveActivities = (items: ActivityFeedItem[], windowMinutes = 30): ActivityFeedGroup[] => {
  const groups: ActivityFeedGroup[] = [];
  for (const item of items) {
    const last = groups[groups.length - 1];
    if (!last) {
      groups.push({ id: item.id, primary: item, items: [item] });
      continue;
    }
    const diffMinutes = Math.abs(new Date(last.primary.createdAt).getTime() - new Date(item.createdAt).getTime()) / 60000;
    const sameActor = last.primary.actorName === item.actorName;
    const sameAction = last.primary.actionType === item.actionType;
    const sameClient = last.primary.clientId === item.clientId;
    if (sameActor && sameAction && sameClient && diffMinutes <= windowMinutes) {
      last.items.push(item);
      continue;
    }
    groups.push({ id: item.id, primary: item, items: [item] });
  }
  return groups;
};

export const resolveActivityHref = (item: ActivityFeedItem) => {
  const params = item.clientId ? `?client=${encodeURIComponent(item.clientId)}` : '';
  const entity = item.entityType.toLowerCase();
  if (entity.includes('task')) {
    const taskParam = item.entityId ? `${params ? `${params}&` : '?'}task=${encodeURIComponent(item.entityId)}` : params;
    return `/boards${taskParam}`;
  }
  if (entity.includes('client')) {
    return item.clientId ? `/clients/${encodeURIComponent(item.clientId)}` : item.entityId ? `/clients/${encodeURIComponent(item.entityId)}` : '/clients';
  }
  if (entity.includes('approval')) return '/hub?tab=approvals';
  if (entity.includes('posting_calendar') || entity.includes('calendar') || entity.includes('post')) return `/posting-calendar${params}`;
  if (entity.includes('file') || entity.includes('drive')) return `/drive${params}`;
  if (entity.includes('document')) return item.entityId ? `/documents/${encodeURIComponent(item.entityId)}/edit` : '/documents';
  if (entity.includes('intake')) return '/hub?tab=requests';
  if (entity.includes('finance')) return `/finance${params}`;
  return item.clientId ? `/clients/${encodeURIComponent(item.clientId)}` : '/dashboard';
};

export const formatFeedTime = (dateString: string) => {
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

export const getInitials = (value: string) =>
  value
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((chunk) => chunk[0]?.toUpperCase())
    .join('') || 'C';
