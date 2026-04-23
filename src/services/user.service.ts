import { supabase } from '@/lib/supabase';

export const UserService = {
  getAll: async () => {
    const { data, error } = await supabase.from('profiles').select('*').order('full_name');
    if (error) throw error;

    return (data || []).map((item) => ({
      ...item,
      name: item.full_name,
      avatar: item.avatar_url,
    }));
  },

  updateProfile: async (id: string, payload: any) => {
    const nextPayload = { ...payload };
    if ('legacy_role' in nextPayload && !('role' in nextPayload)) {
      nextPayload.role = nextPayload.legacy_role;
    }
    delete nextPayload.legacy_role;
    if ('is_active' in nextPayload && !('active' in nextPayload)) {
      nextPayload.active = nextPayload.is_active;
    }
    delete nextPayload.is_active;

    let response = await supabase.from('profiles').update(nextPayload).eq('id', id).select('*').single();

    if (
      response.error &&
      String(response.error.message || '').toLowerCase().includes('access_scope')
    ) {
      delete nextPayload.access_scope;
      delete nextPayload.functional_profile;
      response = await supabase.from('profiles').update(nextPayload).eq('id', id).select('*').single();
    }

    if (
      response.error &&
      String(response.error.message || '').toLowerCase().includes('role')
    ) {
      nextPayload.role = payload.legacy_role || nextPayload.role;
      delete nextPayload.access_scope;
      delete nextPayload.functional_profile;
      response = await supabase.from('profiles').update(nextPayload).eq('id', id).select('*').single();
    }

    if (response.error) throw response.error;
    return response.data;
  },
};
