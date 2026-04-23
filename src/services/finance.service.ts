import { supabase } from '@/lib/supabase';
import { isQuietClient, logActivity, calculateFinanceSummary } from './_shared';

const decorateEntries = (entries: any[]) =>
  (entries || [])
    .filter((item: any) => !item.clients || !isQuietClient(item.clients as Record<string, unknown>))
    .map((item: any) => ({
      ...item,
      amount: Number(item.amount || 0),
      client_name: item.clients?.name || null,
      client: item.clients || null,
    }));

export const FinanceService = {
  getOverview: async (params?: { clientId?: string }) => {
    const [entries, clients] = await Promise.all([
      FinanceService.getAllDirect(params),
      supabase.from('clients').select('id, name, is_free_or_trade, one_time_payment').order('name'),
    ]);

    if (clients.error) throw clients.error;

    return {
      entries,
      summary: calculateFinanceSummary(entries as any[]),
      clients: (clients.data || [])
        .filter((item: any) => !isQuietClient(item as Record<string, unknown>))
        .map((item: any) => ({
          id: String(item.id),
          name: String(item.name || 'Sem nome'),
        })),
    };
  },

  getAllDirect: async (params?: { clientId?: string }) => {
    let query = supabase
      .from('finance_entries')
      .select('*, clients(name, one_time_payment, is_free_or_trade)')
      .order('date', { ascending: false });

    if (params?.clientId) query = query.eq('client_id', params.clientId);

    const { data, error } = await query;
    if (error) throw error;

    return decorateEntries(data || []);
  },

  getAll: async (params?: { clientId?: string }) => {
    const overview = await FinanceService.getOverview(params);
    return overview.entries;
  },

  create: async (payload: any) => {
    const { data, error } = await supabase.from('finance_entries').insert(payload).select('*').single();
    if (error) throw error;

    await logActivity('finance_entry_created', 'finance_entry', data.id, data.client_id, {
      type: data.type,
      amount: Number(data.amount || 0),
    });

    return data;
  },

  getSummary: async () => {
    const overview = await FinanceService.getOverview();
    return overview.summary;
  },
};
