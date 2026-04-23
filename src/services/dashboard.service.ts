import { supabase } from '@/lib/supabase';
import {
  isQuietClient,
  isDoneTask,
  isInProgressTask,
  normalizeOnboardingStatus,
  calculateFinanceSummary,
} from './_shared';
import { FinanceService } from './finance.service';

const emptySummary = {
  operations: {
    clients: { total: 0, active: 0, leads: 0, new_this_month: 0 },
    tasks: { total: 0, pending: 0, in_progress: 0, done: 0, overdue: 0 },
    onboarding: {
      total: 0,
      pending: 0,
      completed: 0,
      in_progress_clients: 0,
      completed_clients: 0,
      completion_rate: 0,
    },
  },
  client_health: [],
  recent_activity: [],
};

export const DashboardService = {
  getSummary: async () => {
    try {
      const [
        { data: clients, error: clientsError },
        { data: tasks, error: tasksError },
        { data: onboarding, error: onboardingError },
        { data: activity, error: activityError },
      ] = await Promise.all([
        supabase.from('clients').select('id, name, status, created_at, is_free_or_trade, one_time_payment'),
        supabase.from('tasks').select('id, client_id, status, due_date, created_at, updated_at'),
        supabase.from('onboarding_tasks').select('id, client_id, status, created_at, updated_at, completed_at'),
        supabase
          .from('activity_logs')
          .select('id, client_id, created_at, action, entity, entity_id, metadata')
          .order('created_at', { ascending: false })
          .limit(500),
      ]);

      if (clientsError) throw clientsError;
      if (tasksError) throw tasksError;
      if (onboardingError) throw onboardingError;
      if (activityError) throw activityError;

      const clientRows = (clients || []).filter((client: any) => !isQuietClient(client as Record<string, unknown>));
      const quietClientIds = new Set(
        (clients || [])
          .filter((client: any) => isQuietClient(client as Record<string, unknown>))
          .map((client: any) => String(client.id))
      );
      const taskRows = (tasks || []).filter((task: any) => !task.client_id || !quietClientIds.has(String(task.client_id)));
      const onboardingRows = (onboarding || []).filter(
        (item: any) => !item.client_id || !quietClientIds.has(String(item.client_id))
      );
      const activityRows = (activity || []).filter(
        (item: any) => !item.client_id || !quietClientIds.has(String(item.client_id))
      );

      const tasksByClient = new Map<string, any[]>();
      const onboardingByClient = new Map<string, any[]>();
      const activityByClient = new Map<string, string>();
      const clientNameById = new Map<string, string>(clientRows.map((client: any) => [String(client.id), String(client.name || '')]));

      for (const task of taskRows) {
        const bucket = tasksByClient.get(task.client_id) || [];
        bucket.push(task);
        tasksByClient.set(task.client_id, bucket);
      }

      for (const item of onboardingRows) {
        const bucket = onboardingByClient.get(item.client_id) || [];
        bucket.push(item);
        onboardingByClient.set(item.client_id, bucket);
      }

      for (const log of activityRows) {
        if (!log.client_id) continue;
        if (!activityByClient.has(log.client_id)) {
          activityByClient.set(log.client_id, String(log.created_at));
        }
      }

      const recentActivity = activityRows.slice(0, 6).map((item: any) => ({
        id: String(item.id || ''),
        action: String(item.action || 'activity'),
        entity: String(item.entity || 'activity'),
        entity_id: item.entity_id ? String(item.entity_id) : null,
        client_id: item.client_id ? String(item.client_id) : null,
        client_name: item.client_id ? clientNameById.get(String(item.client_id)) || null : null,
        created_at: item.created_at ? String(item.created_at) : null,
        metadata: item.metadata || null,
      }));

      const now = new Date();
      const clientHealth = clientRows.map((client: any) => {
        const clientTasks = tasksByClient.get(client.id) || [];
        const clientOnboarding = onboardingByClient.get(client.id) || [];
        const pendingTasks = clientTasks.filter((task) => !isDoneTask(task.status)).length;
        const overdueTasks = clientTasks.filter((task) => {
          if (!task.due_date || isDoneTask(task.status)) return false;
          const due = new Date(task.due_date);
          return Number.isFinite(due.getTime()) && due.getTime() < now.getTime();
        }).length;
        const completedOnboarding = clientOnboarding.filter(
          (item) => normalizeOnboardingStatus(item.status) === 'completed'
        ).length;
        const onboardingCompletion = clientOnboarding.length
          ? Math.round((completedOnboarding / clientOnboarding.length) * 100)
          : 0;

        const lastTaskDate = clientTasks
          .map((task) => String(task.updated_at || task.created_at || ''))
          .filter(Boolean)
          .sort()
          .reverse()[0];
        const lastOnboardingDate = clientOnboarding
          .map((item) => String(item.updated_at || item.completed_at || item.created_at || ''))
          .filter(Boolean)
          .sort()
          .reverse()[0];
        const lastActivity = [activityByClient.get(client.id), lastTaskDate, lastOnboardingDate]
          .filter(Boolean)
          .sort()
          .reverse()[0] || null;

        return {
          id: client.id,
          name: client.name,
          status: client.status,
          pending_tasks: pendingTasks,
          overdue_tasks: overdueTasks,
          onboarding_completion: onboardingCompletion,
          pending_onboarding: Math.max(clientOnboarding.length - completedOnboarding, 0),
          total_open_items: pendingTasks + Math.max(clientOnboarding.length - completedOnboarding, 0),
          last_activity: lastActivity,
        };
      });

      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();

      return {
        operations: {
          clients: {
            total: clientRows.length,
            active: clientRows.filter((client: any) => client.status === 'active').length,
            leads: clientRows.filter((client: any) => client.status === 'lead').length,
            new_this_month: clientRows.filter((client: any) => {
              const created = new Date(client.created_at);
              return created.getMonth() === currentMonth && created.getFullYear() === currentYear;
            }).length,
          },
          tasks: {
            total: taskRows.length,
            pending: taskRows.filter((task: any) => !isDoneTask(task.status) && !isInProgressTask(task.status)).length,
            in_progress: taskRows.filter((task: any) => isInProgressTask(task.status)).length,
            done: taskRows.filter((task: any) => isDoneTask(task.status)).length,
            overdue: taskRows.filter((task: any) => {
              if (!task.due_date || isDoneTask(task.status)) return false;
              return new Date(task.due_date).getTime() < now.getTime();
            }).length,
          },
          onboarding: {
            total: onboardingRows.length,
            pending: onboardingRows.filter((item: any) => normalizeOnboardingStatus(item.status) !== 'completed').length,
            completed: onboardingRows.filter((item: any) => normalizeOnboardingStatus(item.status) === 'completed').length,
            in_progress_clients: clientHealth.filter(
              (client) => client.onboarding_completion > 0 && client.onboarding_completion < 100
            ).length,
            completed_clients: clientHealth.filter((client) => client.onboarding_completion === 100).length,
            completion_rate: clientHealth.length
              ? Math.round(
                  clientHealth.reduce((acc, item) => acc + item.onboarding_completion, 0) / clientHealth.length
                )
              : 0,
          },
        },
        client_health: clientHealth,
        recent_activity: recentActivity,
      };
    } catch (err) {
      console.error('Erro no DashboardService:', err);
      return emptySummary;
    }
  },

  getMonitoring: async () => {
    const [eventsResult, financeEntries, quietClientsResult] = await Promise.all([
      supabase.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(50),
      FinanceService.getAll(),
      supabase.from('clients').select('id, is_free_or_trade, one_time_payment'),
    ]);

    if (eventsResult.error) throw eventsResult.error;
    if (quietClientsResult.error) throw quietClientsResult.error;

    const quietClientIds = new Set(
      (quietClientsResult.data || [])
        .filter((client: any) => isQuietClient(client as Record<string, unknown>))
        .map((client: any) => String(client.id))
    );

    return {
      metrics: calculateFinanceSummary(financeEntries as any[]),
      events: (eventsResult.data || []).filter(
        (event: any) => !event.client_id || !quietClientIds.has(String(event.client_id))
      ),
    };
  },
};
