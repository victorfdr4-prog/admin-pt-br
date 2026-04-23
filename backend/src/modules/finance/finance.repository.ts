import type { SupabaseClient } from '@supabase/supabase-js';

export class FinanceRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async getOverview(clientId?: string) {
    let financeQuery = this.supabase
      .from('finance_entries')
      .select('id, client_id, amount, type, category, date, status, notes, acquisition_cost, created_at, clients(name, one_time_payment, is_free_or_trade)')
      .order('date', { ascending: false });

    if (clientId) financeQuery = financeQuery.eq('client_id', clientId);

    const [entriesRes, clientsRes] = await Promise.all([
      financeQuery,
      this.supabase.from('clients').select('id, name, is_free_or_trade, one_time_payment').order('name'),
    ]);

    if (entriesRes.error) throw entriesRes.error;
    if (clientsRes.error) throw clientsRes.error;

    return {
      entries: entriesRes.data ?? [],
      clients: clientsRes.data ?? [],
    };
  }
}
