import { supabase } from '@/lib/supabase';
import { getSettingValue, isDoneTask } from './_shared';

export interface HealthFactor {
  key: string;
  label: string;
  weight: number;   // pontos descontados
  value: number;    // quantidade encontrada
}

export interface NextAction {
  type: string;
  title: string;
  description: string;
  entity_type: string;
  entity_id: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  suggested_assignee_id?: string | null;
}

export interface ClientHealth {
  client_id: string;
  score: number;       // 0-100
  status: 'healthy' | 'attention' | 'critical';
  factors: HealthFactor[];
  next_action: NextAction | null;
}

// Carrega thresholds das regras operacionais (ou usa defaults)
async function getThresholds() {
  try {
    const rules = await getSettingValue('dashboard_rules');
    return {
      inactivity_days: Number(rules?.inactivity_days ?? 3),
      overdue_task_weight: Number(rules?.overdue_task_weight ?? 15),
      pending_approval_weight: Number(rules?.pending_approval_weight ?? 10),
      inactivity_weight: Number(rules?.inactivity_weight ?? 20),
      attention_threshold: Number(rules?.attention_threshold ?? 70),
      critical_threshold: Number(rules?.critical_threshold ?? 40),
    };
  } catch {
    return {
      inactivity_days: 3,
      overdue_task_weight: 15,
      pending_approval_weight: 10,
      inactivity_weight: 20,
      attention_threshold: 70,
      critical_threshold: 40,
    };
  }
}

function scoreToStatus(score: number, thresholds: { attention_threshold: number; critical_threshold: number }) {
  if (score >= thresholds.attention_threshold) return 'healthy' as const;
  if (score >= thresholds.critical_threshold) return 'attention' as const;
  return 'critical' as const;
}

export const HealthService = {
  computeClientHealth: async (clientId: string): Promise<ClientHealth> => {
    const [thresholds, tasksResult, approvalsResult, clientResult] = await Promise.all([
      getThresholds(),
      supabase
        .from('tasks')
        .select('id, status, due_date, title, assignee_id, priority')
        .eq('client_id', clientId),
      supabase
        .from('approvals')
        .select('id, entity_type, created_at, title')
        .eq('client_id', clientId)
        .eq('status', 'pending')
        .then((result) => {
          if (result.error) return { data: [], error: null };
          return result;
        })
        .catch(() => ({ data: [], error: null })),
      supabase
        .from('clients')
        .select('id, last_activity_at, health_status')
        .eq('id', clientId)
        .maybeSingle()
        .then((result) => {
          if (result.error) return { data: null, error: null };
          return result;
        })
        .catch(() => ({ data: null, error: null })),
    ]);

    const { data: tasks } = tasksResult;
    const { data: approvals } = approvalsResult;
    const { data: client } = clientResult;

    const now = new Date();
    const factors: HealthFactor[] = [];
    let score = 100;

    // Fator 1: tarefas atrasadas
    const overdueTasks = (tasks || []).filter((t) => {
      if (isDoneTask(t.status)) return false;
      if (!t.due_date) return false;
      return new Date(t.due_date) < now;
    });
    if (overdueTasks.length > 0) {
      const penalty = Math.min(overdueTasks.length * thresholds.overdue_task_weight, 40);
      score -= penalty;
      factors.push({
        key: 'overdue_tasks',
        label: 'Tarefas atrasadas',
        weight: penalty,
        value: overdueTasks.length,
      });
    }

    // Fator 2: aprovações pendentes há mais de 48h
    const stalePendingApprovals = (approvals || []).filter((a) => {
      const diffHours = (now.getTime() - new Date(a.created_at).getTime()) / 3_600_000;
      return diffHours > 48;
    });
    if (stalePendingApprovals.length > 0) {
      const penalty = Math.min(stalePendingApprovals.length * thresholds.pending_approval_weight, 30);
      score -= penalty;
      factors.push({
        key: 'stale_approvals',
        label: 'Aprovações aguardando',
        weight: penalty,
        value: stalePendingApprovals.length,
      });
    }

    // Fator 3: inatividade
    const lastActivity = client?.last_activity_at ? new Date(client.last_activity_at) : null;
    if (lastActivity) {
      const inactiveDays = (now.getTime() - lastActivity.getTime()) / 86_400_000;
      if (inactiveDays > thresholds.inactivity_days) {
        score -= thresholds.inactivity_weight;
        factors.push({
          key: 'inactivity',
          label: 'Sem atividade recente',
          weight: thresholds.inactivity_weight,
          value: Math.floor(inactiveDays),
        });
      }
    }

    score = Math.max(0, Math.min(100, score));
    const status = scoreToStatus(score, thresholds);

    // Determina próxima ação mais urgente
    let next_action: NextAction | null = null;

    if (stalePendingApprovals.length > 0) {
      const approval = stalePendingApprovals[0];
      next_action = {
        type: 'resolve_approval',
        title: `Aprovar: ${approval.title}`,
        description: 'Aprovação aguardando há mais de 48h',
        entity_type: 'approval',
        entity_id: approval.id,
        priority: 'urgent',
      };
    } else if (overdueTasks.length > 0) {
      const task = overdueTasks.sort((a, b) => {
        const priorityWeight = { urgent: 4, high: 3, medium: 2, low: 1 };
        return (priorityWeight[b.priority as keyof typeof priorityWeight] ?? 2) -
               (priorityWeight[a.priority as keyof typeof priorityWeight] ?? 2);
      })[0];
      next_action = {
        type: 'complete_task',
        title: `Concluir: ${task.title}`,
        description: 'Tarefa atrasada',
        entity_type: 'task',
        entity_id: task.id,
        priority: (task.priority as NextAction['priority']) ?? 'high',
        suggested_assignee_id: task.assignee_id ?? null,
      };
    }

    return { client_id: clientId, score, status, factors, next_action };
  },

  computeAllHealth: async (): Promise<ClientHealth[]> => {
    const { data: clients, error } = await supabase
      .from('clients')
      .select('id')
      .eq('status', 'active')
      .eq('is_free_or_trade', false);

    if (error) throw error;
    if (!clients?.length) return [];

    const results = await Promise.allSettled(
      clients.map((c) => HealthService.computeClientHealth(c.id))
    );

    return results
      .filter((r): r is PromiseFulfilledResult<ClientHealth> => r.status === 'fulfilled')
      .map((r) => r.value);
  },

  getNextActions: async (clientId: string): Promise<NextAction[]> => {
    const health = await HealthService.computeClientHealth(clientId);
    return health.next_action ? [health.next_action] : [];
  },
};
