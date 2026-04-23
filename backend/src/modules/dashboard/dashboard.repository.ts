import type { SupabaseClient } from '@supabase/supabase-js';

export class DashboardRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async getSummarySource() {
    const [clientsRes, tasksRes, onboardingRes, activityRes] = await Promise.all([
      this.supabase.from('clients').select('id, name, status, created_at, is_free_or_trade, one_time_payment'),
      this.supabase.from('tasks').select('id, client_id, status, due_date, created_at, updated_at'),
      this.supabase.from('onboarding_tasks').select('id, client_id, status, created_at, updated_at, completed_at'),
      this.supabase
        .from('activity_logs')
        .select('id, client_id, created_at, action, entity, entity_id, metadata')
        .order('created_at', { ascending: false })
        .limit(500),
    ]);

    if (clientsRes.error) throw clientsRes.error;
    if (tasksRes.error) throw tasksRes.error;
    if (onboardingRes.error) throw onboardingRes.error;
    if (activityRes.error) throw activityRes.error;

    return {
      clients: clientsRes.data ?? [],
      tasks: tasksRes.data ?? [],
      onboarding: onboardingRes.data ?? [],
      activity: activityRes.data ?? [],
    };
  }

  async getMonitoringSource() {
    const [eventsRes, financeRes, quietClientsRes] = await Promise.all([
      this.supabase
        .from('activity_logs')
        .select('id, client_id, created_at, action, entity, entity_id, metadata')
        .order('created_at', { ascending: false })
        .limit(50),
      this.supabase
        .from('finance_entries')
        .select('id, client_id, amount, type, category, date, status, notes, acquisition_cost, clients(name, one_time_payment, is_free_or_trade)')
        .order('date', { ascending: false }),
      this.supabase.from('clients').select('id, is_free_or_trade, one_time_payment'),
    ]);

    if (eventsRes.error) throw eventsRes.error;
    if (financeRes.error) throw financeRes.error;
    if (quietClientsRes.error) throw quietClientsRes.error;

    return {
      events: eventsRes.data ?? [],
      financeEntries: financeRes.data ?? [],
      quietClients: quietClientsRes.data ?? [],
    };
  }
}
