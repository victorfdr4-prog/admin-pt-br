import { supabase } from '@/lib/supabase';
import { isQuietClient, normalizeOnboardingStatus } from './_shared';
import { AutomationService } from '@/lib/services/automationService';

export const OnboardingService = {
  getAll: async (clientId?: string) => {
    let query = supabase
      .from('onboarding_tasks')
      .select('*, clients(name, is_free_or_trade, one_time_payment)')
      .order('order_index', { ascending: true });

    if (clientId) query = query.eq('client_id', clientId);

    const { data, error } = await query;
    if (error) throw error;

    return (data || [])
      .filter((item: any) => !item.clients || !isQuietClient(item.clients as Record<string, unknown>))
      .map((item: any) => ({
        ...item,
        status: normalizeOnboardingStatus(item.status),
        client_name: item.clients?.name || null,
      }));
  },

  updateStatus: async (taskId: string, status: string) => {
    const normalizedStatus = normalizeOnboardingStatus(status);
    const { data, error } = await supabase
      .from('onboarding_tasks')
      .update({
        status: normalizedStatus,
        completed_at: normalizedStatus === 'completed' ? new Date().toISOString() : null,
      })
      .eq('id', taskId)
      .select('*')
      .single();

    if (error) throw error;

    if (data?.client_id && normalizedStatus === 'completed') {
      try {
        await AutomationService.runClientOnboardingAutomation(String(data.client_id));
      } catch (automationError) {
        console.error('Falha na automação pós-onboarding:', automationError);
      }
    }

    return data;
  },
};
