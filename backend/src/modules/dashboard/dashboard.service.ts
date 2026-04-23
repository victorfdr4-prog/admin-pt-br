import { DashboardRepository } from './dashboard.repository';

const isQuietClient = (row: Record<string, unknown> | null | undefined) =>
  Boolean(row?.is_free_or_trade) || Boolean(row?.one_time_payment);

const isDoneTask = (status: unknown) => ['done', 'completed', 'concluido', 'concluído'].includes(String(status || '').toLowerCase());
const isInProgressTask = (status: unknown) => ['in_progress', 'doing', 'em andamento', 'in-progress'].includes(String(status || '').toLowerCase());
const normalizeOnboardingStatus = (status: unknown) => {
  const value = String(status || '').toLowerCase();
  if (['done', 'completed', 'concluido', 'concluído'].includes(value)) return 'completed';
  if (['in_progress', 'doing', 'em andamento'].includes(value)) return 'in_progress';
  return 'pending';
};

const calculateFinanceSummary = (entries: any[]) => {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  let totalIncome = 0;
  let totalExpense = 0;
  let recurringIncomeThisMonth = 0;
  let acquisitionExpenseThisMonth = 0;
  const recurringClients = new Set<string>();

  for (const entry of entries) {
    const amount = Number(entry.amount || 0);
    const date = new Date(entry.date || now.toISOString());
    const sameMonth = date.getMonth() === currentMonth && date.getFullYear() === currentYear;
    const client = entry.clients || entry.client || null;
    const isRecurringClient = !Boolean(client?.one_time_payment || client?.is_free_or_trade);

    if (entry.type === 'income') {
      totalIncome += amount;
      if (sameMonth && isRecurringClient) {
        recurringIncomeThisMonth += amount;
        if (entry.client_id) recurringClients.add(String(entry.client_id));
      }
    } else {
      totalExpense += amount;
      if (sameMonth && Boolean(entry.acquisition_cost)) {
        acquisitionExpenseThisMonth += amount;
      }
    }
  }

  const activeRecurringClients = recurringClients.size;
  const averageRecurringRevenue = activeRecurringClients > 0 ? recurringIncomeThisMonth / activeRecurringClients : 0;

  return {
    mrr: recurringIncomeThisMonth,
    cac: activeRecurringClients > 0 ? acquisitionExpenseThisMonth / activeRecurringClients : 0,
    ltv: averageRecurringRevenue * 12,
    total_income: totalIncome,
    total_expense: totalExpense,
    net_profit: totalIncome - totalExpense,
  };
};

export class DashboardService {
  constructor(private readonly repository: DashboardRepository) {}

  async getSummary() {
    const { clients, tasks, onboarding, activity } = await this.repository.getSummarySource();

    const clientRows = clients.filter((client) => !isQuietClient(client as Record<string, unknown>));
    const quietClientIds = new Set(
      clients.filter((client) => isQuietClient(client as Record<string, unknown>)).map((client) => String(client.id))
    );
    const taskRows = tasks.filter((task) => !task.client_id || !quietClientIds.has(String(task.client_id)));
    const onboardingRows = onboarding.filter((item) => !item.client_id || !quietClientIds.has(String(item.client_id)));
    const activityRows = activity.filter((item) => !item.client_id || !quietClientIds.has(String(item.client_id)));

    const tasksByClient = new Map<string, any[]>();
    const onboardingByClient = new Map<string, any[]>();
    const activityByClient = new Map<string, string>();
    const clientNameById = new Map<string, string>(clientRows.map((client) => [String(client.id), String(client.name || '')]));

    for (const task of taskRows) {
      const key = String(task.client_id || '');
      if (!key) continue;
      const bucket = tasksByClient.get(key) || [];
      bucket.push(task);
      tasksByClient.set(key, bucket);
    }

    for (const item of onboardingRows) {
      const key = String(item.client_id || '');
      if (!key) continue;
      const bucket = onboardingByClient.get(key) || [];
      bucket.push(item);
      onboardingByClient.set(key, bucket);
    }

    for (const log of activityRows) {
      const key = String(log.client_id || '');
      if (key && !activityByClient.has(key)) {
        activityByClient.set(key, String(log.created_at));
      }
    }

    const recentActivity = activityRows.slice(0, 6).map((item) => ({
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
    const clientHealth = clientRows.map((client) => {
      const clientId = String(client.id);
      const clientTasks = tasksByClient.get(clientId) || [];
      const clientOnboarding = onboardingByClient.get(clientId) || [];
      const pendingTasks = clientTasks.filter((task) => !isDoneTask(task.status)).length;
      const overdueTasks = clientTasks.filter((task) => {
        if (!task.due_date || isDoneTask(task.status)) return false;
        const due = new Date(task.due_date);
        return Number.isFinite(due.getTime()) && due.getTime() < now.getTime();
      }).length;
      const completedOnboarding = clientOnboarding.filter((item) => normalizeOnboardingStatus(item.status) === 'completed').length;
      const onboardingCompletion = clientOnboarding.length ? Math.round((completedOnboarding / clientOnboarding.length) * 100) : 0;

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
      const lastActivity = [activityByClient.get(clientId), lastTaskDate, lastOnboardingDate].filter(Boolean).sort().reverse()[0] || null;

      return {
        id: clientId,
        name: String(client.name || ''),
        status: String(client.status || ''),
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
          active: clientRows.filter((client) => client.status === 'active').length,
          leads: clientRows.filter((client) => client.status === 'lead').length,
          new_this_month: clientRows.filter((client) => {
            const created = new Date(String(client.created_at || ''));
            return created.getMonth() === currentMonth && created.getFullYear() === currentYear;
          }).length,
        },
        tasks: {
          total: taskRows.length,
          pending: taskRows.filter((task) => !isDoneTask(task.status) && !isInProgressTask(task.status)).length,
          in_progress: taskRows.filter((task) => isInProgressTask(task.status)).length,
          done: taskRows.filter((task) => isDoneTask(task.status)).length,
          overdue: taskRows.filter((task) => task.due_date && !isDoneTask(task.status) && new Date(task.due_date).getTime() < now.getTime()).length,
        },
        onboarding: {
          total: onboardingRows.length,
          pending: onboardingRows.filter((item) => normalizeOnboardingStatus(item.status) !== 'completed').length,
          completed: onboardingRows.filter((item) => normalizeOnboardingStatus(item.status) === 'completed').length,
          in_progress_clients: clientHealth.filter((client) => client.onboarding_completion > 0 && client.onboarding_completion < 100).length,
          completed_clients: clientHealth.filter((client) => client.onboarding_completion === 100).length,
          completion_rate: clientHealth.length ? Math.round(clientHealth.reduce((acc, item) => acc + item.onboarding_completion, 0) / clientHealth.length) : 0,
        },
      },
      client_health: clientHealth,
      recent_activity: recentActivity,
    };
  }

  async getMonitoring() {
    const { events, financeEntries, quietClients } = await this.repository.getMonitoringSource();
    const quietClientIds = new Set(
      quietClients.filter((client) => isQuietClient(client as Record<string, unknown>)).map((client) => String(client.id))
    );

    return {
      metrics: calculateFinanceSummary(financeEntries),
      events: events.filter((event) => !event.client_id || !quietClientIds.has(String(event.client_id))),
    };
  }
}
