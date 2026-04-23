import { supabase } from '@/lib/supabase';
import { logActivity, normalizeLoginJoke } from './_shared';

export const JokeService = {
  getAll: async () => {
    const { data, error } = await supabase
      .from('login_jokes')
      .select('id, text, active, created_at')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(normalizeLoginJoke);
  },

  create: async (payload: { text: string; active?: boolean }) => {
    const { data, error } = await supabase
      .from('login_jokes')
      .insert({
        text: String(payload.text || '').trim(),
        active: payload.active !== false,
      })
      .select('id, text, active, created_at')
      .single();

    if (error) throw error;
    await logActivity('login_joke_created', 'login_joke', String(data.id), null, { active: data.active });
    return normalizeLoginJoke(data);
  },

  update: async (id: string, payload: { text?: string; active?: boolean }) => {
    const nextPayload: Record<string, unknown> = {};

    if (typeof payload.text === 'string') {
      nextPayload.text = payload.text.trim();
    }

    if (typeof payload.active === 'boolean') {
      nextPayload.active = payload.active;
    }

    const { data, error } = await supabase
      .from('login_jokes')
      .update(nextPayload)
      .eq('id', id)
      .select('id, text, active, created_at')
      .single();

    if (error) throw error;
    await logActivity('login_joke_updated', 'login_joke', id, null, { fields: Object.keys(nextPayload) });
    return normalizeLoginJoke(data);
  },

  delete: async (id: string) => {
    const { error } = await supabase.from('login_jokes').delete().eq('id', id);
    if (error) throw error;
    await logActivity('login_joke_deleted', 'login_joke', id);
    return true;
  },
};
