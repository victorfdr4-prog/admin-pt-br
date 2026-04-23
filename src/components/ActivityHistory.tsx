import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Trash2,
  FileText,
  CheckCircle2,
  Clock,
  AlertCircle,
  Plus,
  Search,
  ChevronDown,
} from 'lucide-react';

interface Activity {
  id: string;
  action: string;
  entity: string;
  entity_id?: string;
  client_id?: string;
  metadata?: Record<string, any>;
  created_at: string;
  user_id: string;
}

interface ActivityHistoryProps {
  limit?: number;
  expandable?: boolean;
}

const ACTION_COLORS: Record<string, { bg: string; border: string; text: string; icon: React.FC<any> }> = {
  'profile_updated': { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', icon: FileText },
  'created': { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', icon: Plus },
  'updated': { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', icon: Clock },
  'deleted': { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', icon: Trash2 },
  'completed': { bg: 'bg-teal-50', border: 'border-teal-200', text: 'text-teal-700', icon: CheckCircle2 },
  'portal_generated': { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', icon: AlertCircle },
};

const ENTITY_LABELS: Record<string, string> = {
  'client': 'Cliente',
  'task': 'Tarefa',
  'project': 'Projeto',
  'client_portal': 'Portal',
  'profile': 'Perfil',
  'onboarding_task': 'Onboarding',
  'finance_entry': 'Financeiro',
};

const formatTimeAgo = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return 'agora';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `há ${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `há ${hours}h`;
    const days = Math.floor(hours / 24);
    return `há ${days}d`;
  } catch {
    return 'data inválida';
  }
};

export const ActivityHistory: React.FC<ActivityHistoryProps> = ({ 
  limit = 10, 
  expandable = false 
}) => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [filteredActivities, setFilteredActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEntity, setSelectedEntity] = useState<string>('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(!expandable);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    fetchActivities();
  }, []);

  useEffect(() => {
    filterActivities();
  }, [activities, searchTerm, selectedEntity, showAll]);

  const fetchActivities = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError, count } = await supabase
        .from('activity_logs')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .limit(50);

      if (fetchError) {
        console.error('Erro ao buscar atividades:', fetchError);
        setError('Erro ao carregar histórico de atividades');
        return;
      }

      setActivities((data || []) as Activity[]);
      setTotalCount(count || 0);
    } catch (err) {
      console.error('Erro inesperado:', err);
      setError('Erro ao carregar histórico');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let subscription: any;

    try {
      subscription = supabase
        .channel('activity_logs_channel')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'activity_logs',
          },
          (payload) => {
            setActivities((prev) => [payload.new as Activity, ...prev.slice(0, 49)]);
            setTotalCount((prev) => prev + 1);
          }
        )
        .subscribe();
    } catch (err) {
      console.error('Erro ao inscrever realtime:', err);
    }

    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, []);

  const filterActivities = () => {
    let filtered = activities;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (activity) =>
          activity.action.toLowerCase().includes(term) ||
          activity.entity.toLowerCase().includes(term)
      );
    }

    if (selectedEntity) {
      filtered = filtered.filter((activity) => activity.entity === selectedEntity);
    }

    // Aplicar limite se não estiver expandido
    if (!showAll && expandable) {
      filtered = filtered.slice(0, limit);
    }

    setFilteredActivities(filtered);
  };

  const getActionConfig = (action: string) => {
    const baseAction = action.split('_')[0];
    return (
      ACTION_COLORS[action] ||
      ACTION_COLORS[baseAction] ||
      ACTION_COLORS['updated']
    );
  };

  const getEntityLabel = (entity: string) => {
    return ENTITY_LABELS[entity] || entity.charAt(0).toUpperCase() + entity.slice(1);
  };

  const formatAction = (action: string) => {
    return action
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const entities: string[] = [...new Set(activities.map((a) => String(a.entity || '')))].filter(
    (entity): entity is string => Boolean(entity)
  );
  const remaining = totalCount - filteredActivities.length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
          <p className="text-muted-foreground text-sm">Carregando histórico...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 border border-dashed rounded-lg border-red-200 bg-red-50">
        <AlertCircle className="h-10 w-10 text-red-600 mx-auto mb-2" />
        <p className="text-red-700 font-medium text-sm">{error}</p>
        <button
          onClick={fetchActivities}
          className="mt-2 px-3 py-1.5 bg-red-600 text-white rounded text-xs hover:bg-red-700"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      <div className="space-y-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Histórico de Atividades</h2>
          <p className="text-xs text-muted-foreground mt-1">
            {filteredActivities.length} de {totalCount} atividades
          </p>
        </div>

        {/* Filters */}
        <div className="flex gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="field-control pl-8 text-sm py-2"
            />
          </div>

          <div className="relative">
            <select
              value={selectedEntity}
              onChange={(e) => setSelectedEntity(e.target.value)}
              className="field-control pl-2.5 pr-8 appearance-none cursor-pointer text-sm py-2"
            >
              <option value="">Todos</option>
              {entities.map((entity) => (
                <option key={entity} value={entity}>
                  {getEntityLabel(entity)}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Activity List */}
      <div className="space-y-1.5 max-h-[600px] overflow-y-auto">
        {filteredActivities.length === 0 ? (
          <div className="text-center py-8 border border-dashed rounded-lg border-border bg-background/50">
            <AlertCircle className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-muted-foreground text-sm">Nenhuma atividade encontrada</p>
          </div>
        ) : (
          filteredActivities.map((activity) => {
            const config = getActionConfig(activity.action);
            const Icon = config.icon;
            const isExpanded = expandedId === activity.id;

            return (
              <div
                key={activity.id}
                className={`border rounded text-xs transition-all ${config.border} ${config.bg} hover:opacity-75`}
              >
                <div
                  className="p-3 cursor-pointer"
                  onClick={() => setExpandedId(isExpanded ? null : activity.id)}
                >
                  <div className="flex items-start gap-2">
                    <div className={`mt-0.5 p-1.5 rounded ${config.bg} border ${config.border} flex-shrink-0`}>
                      <Icon className={`h-3 w-3 ${config.text}`} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-1.5 flex-wrap">
                        <span className={`font-semibold text-xs ${config.text}`}>
                          {formatAction(activity.action)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          em {getEntityLabel(activity.entity)}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {formatTimeAgo(activity.created_at)}
                      </div>
                    </div>

                    {activity.metadata && Object.keys(activity.metadata).length > 0 && (
                      <ChevronDown
                        className={`h-3 w-3 text-muted-foreground flex-shrink-0 transition-transform ${
                          isExpanded ? 'rotate-180' : ''
                        }`}
                      />
                    )}
                  </div>
                </div>

                {isExpanded && activity.metadata && Object.keys(activity.metadata).length > 0 && (
                  <div className="border-t px-3 py-2 bg-background/50 text-xs">
                    <div className="space-y-1 font-mono">
                      {Object.entries(activity.metadata).map(([key, value]) => (
                        <div key={key} className="flex gap-1">
                          <span className="text-muted-foreground flex-shrink-0">{key}:</span>
                          <span className="break-all text-foreground">
                            {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Expandir Button */}
      {expandable && !showAll && remaining > 0 && (
        <button
          onClick={() => setShowAll(true)}
          className="w-full py-2 px-3 border border-dashed rounded text-xs font-medium text-muted-foreground hover:bg-background transition-colors"
        >
          Expandir ({remaining} mais atividades)
        </button>
      )}

      {showAll && expandable && (
        <button
          onClick={() => setShowAll(false)}
          className="w-full py-2 px-3 border border-dashed rounded text-xs font-medium text-muted-foreground hover:bg-background transition-colors"
        >
          Recolher
        </button>
      )}
    </div>
  );
};

export default ActivityHistory;
