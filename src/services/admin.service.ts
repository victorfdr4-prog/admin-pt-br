import { supabase } from '@/lib/supabase';
import { getCurrentUser, saveSettingValue, invokeFunction } from './_shared';

export const AdminService = {
  getNotifications: async () => {
    const user = await getCurrentUser();
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(60);

    if (error) throw error;
    return data || [];
  },

  markNotificationRead: async (id: string) => {
    const { data, error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    return data;
  },

  markAllNotificationsRead: async () => {
    const user = await getCurrentUser();
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .is('read_at', null);

    if (error) throw error;
    return true;
  },

  getSettings: async (key?: string) => {
    let query = supabase.from('system_settings').select('*');
    if (key) query = query.eq('key', key);
    const { data, error } = await query.order('key');
    if (error) throw error;
    return data || [];
  },

  saveSetting: async (key: string, value: Record<string, unknown>) => {
    return saveSettingValue(key, value);
  },

  createTeamMember: async (payload: Record<string, unknown>) => {
    return invokeFunction('admin-users', {
      action: 'create_user',
      payload,
    });
  },

  updateTeamMember: async (userId: string, payload: Record<string, unknown>) => {
    return invokeFunction('admin-users', {
      action: 'update_user',
      userId,
      payload,
    });
  },

  changePassword: async (userId: string, newPassword: string) => {
    return invokeFunction('admin-users', {
      action: 'change_password',
      userId,
      payload: { password: newPassword },
    });
  },
};
