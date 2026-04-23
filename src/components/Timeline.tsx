import React from 'react';
import {
  CheckCircle2,
  FileUp,
  MessageSquare,
  Pencil,
  Plus,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  User,
  Zap,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import type { TimelineEvent } from '@/services/timeline.service';

// -----------------------------------------------
// Mapeamento de tipo de evento → ícone + cor
// -----------------------------------------------
const EVENT_CONFIG: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  task_created:       { icon: Plus,         color: 'text-blue-500',  label: 'Tarefa criada' },
  task_updated:       { icon: Pencil,       color: 'text-yellow-500', label: 'Tarefa atualizada' },
  task_deleted:       { icon: Trash2,       color: 'text-red-500',   label: 'Tarefa removida' },
  task_status_change: { icon: CheckCircle2, color: 'text-green-500', label: 'Status alterado' },
  file_upload:        { icon: FileUp,       color: 'text-purple-500', label: 'Arquivo enviado' },
  file_deleted:       { icon: Trash2,       color: 'text-red-400',   label: 'Arquivo removido' },
  approval_requested: { icon: Zap,          color: 'text-orange-500', label: 'Aprovação solicitada' },
  approval_approved:  { icon: ThumbsUp,     color: 'text-green-500', label: 'Aprovado' },
  approval_rejected:  { icon: ThumbsDown,   color: 'text-red-500',   label: 'Rejeitado' },
  comment_added:      { icon: MessageSquare, color: 'text-sky-500',  label: 'Comentário adicionado' },
  intake_created:     { icon: Plus,         color: 'text-indigo-500', label: 'Solicitação recebida' },
  profile_updated:    { icon: User,         color: 'text-gray-500',  label: 'Perfil atualizado' },
  password_changed:   { icon: User,         color: 'text-gray-500',  label: 'Senha alterada' },
};

const DEFAULT_EVENT = { icon: Zap, color: 'text-gray-400', label: 'Evento' };

// -----------------------------------------------
// Helpers
// -----------------------------------------------
function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'agora';
  if (mins < 60) return `há ${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `há ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `há ${days}d`;
  return new Date(dateStr).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

// -----------------------------------------------
// Item individual
// -----------------------------------------------
const TimelineItem: React.FC<{ event: TimelineEvent; last: boolean }> = ({ event, last }) => {
  const config = EVENT_CONFIG[event.event_type] ?? DEFAULT_EVENT;
  const Icon = config.icon;

  return (
    <div className="flex gap-3 group">
      {/* Ícone + linha vertical */}
      <div className="flex flex-col items-center">
        <div className={cn(
          'flex items-center justify-center w-7 h-7 rounded-full bg-white border border-border shrink-0',
          config.color
        )}>
          <Icon size={14} strokeWidth={2} />
        </div>
        {!last && <div className="w-px flex-1 bg-border mt-1" />}
      </div>

      {/* Conteúdo */}
      <div className={cn('pb-5 min-w-0 flex-1', last && 'pb-0')}>
        <p className="text-sm text-foreground leading-snug">{event.title}</p>
        {event.description && (
          <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{event.description}</p>
        )}
        <div className="flex items-center gap-2 mt-1">
          {event.actor_name && (
            <span className="text-xs text-muted-foreground">{event.actor_name}</span>
          )}
          {event.client_name && (
            <span className="text-xs text-muted-foreground">· {event.client_name}</span>
          )}
          <span className="text-xs text-muted-foreground ml-auto">{relativeTime(event.created_at)}</span>
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------
// Componente principal
// -----------------------------------------------
interface TimelineProps {
  events: TimelineEvent[];
  loading?: boolean;
  emptyMessage?: string;
  className?: string;
  /** Quantos itens mostrar antes do "ver mais" */
  initialCount?: number;
}

export function Timeline({
  events,
  loading = false,
  emptyMessage = 'Nenhuma atividade registrada.',
  className,
  initialCount = 20,
}: TimelineProps) {
  const [showAll, setShowAll] = React.useState(false);
  const visible = showAll ? events : events.slice(0, initialCount);

  if (loading) {
    return (
      <div className={cn('space-y-3', className)}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex gap-3 animate-pulse">
            <div className="w-7 h-7 rounded-full bg-muted shrink-0" />
            <div className="flex-1 space-y-1.5 py-1">
              <div className="h-3 bg-muted rounded w-3/4" />
              <div className="h-2.5 bg-muted rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!events.length) {
    return (
      <p className={cn('text-sm text-muted-foreground py-4 text-center', className)}>
        {emptyMessage}
      </p>
    );
  }

  return (
    <div className={cn('', className)}>
      {visible.map((event, i) => (
        <TimelineItem key={event.id} event={event} last={i === visible.length - 1 && (showAll || events.length <= initialCount)} />
      ))}
      {!showAll && events.length > initialCount && (
        <button
          onClick={() => setShowAll(true)}
          className="text-xs text-primary hover:underline mt-2 ml-10"
        >
          Ver mais {events.length - initialCount} eventos
        </button>
      )}
    </div>
  );
}
