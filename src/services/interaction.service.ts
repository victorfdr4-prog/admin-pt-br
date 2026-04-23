import { supabase } from '@/lib/supabase';

export const InteractionService = {
  getByClientId: async (clientId: string) => {
    const { data, error } = await supabase
      .from('activity_logs')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    return (data || []).map((item: any) => {
      const action = String(item.action || '').toLowerCase();
      let type: 'meeting' | 'email' | 'call' | 'whatsapp' = 'meeting';
      if (action.includes('email')) type = 'email';
      else if (action.includes('call') || action.includes('lig')) type = 'call';
      else if (action.includes('whats')) type = 'whatsapp';

      return {
        id: item.id,
        date: item.created_at,
        summary:
          item.metadata?.summary ||
          item.metadata?.message ||
          `${item.action} • ${item.entity}${item.entity_id ? ` (${item.entity_id})` : ''}`,
        type,
      };
    });
  },
};
