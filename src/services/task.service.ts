import { supabase } from '@/lib/supabase';
import { isQuietClient, logActivity } from './_shared';

export const BoardService = {
  getTasks: async (clientId?: string) => {
    let query = supabase
      .from('tasks')
      .select('*, clients!tasks_client_id_fkey(name, is_free_or_trade, one_time_payment)')
      .order('status', { ascending: true })
      .order('order_index', { ascending: true });

    if (clientId) query = query.eq('client_id', clientId);

    const { data, error } = await query;
    if (error) throw error;

    return (data || [])
      .filter((item: any) => !item.clients || !isQuietClient(item.clients as Record<string, unknown>))
      .map((item: any) => ({
        ...item,
        client_name: item.clients?.name || null,
      }));
  },

  updateTaskStatus: async (id: string, status: string, orderIndex?: number) => {
    const { data, error } = await supabase
      .from('tasks')
      .update({
        status,
        ...(typeof orderIndex === 'number' ? { order_index: orderIndex } : {}),
      })
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    return data;
  },

  updateTask: async (id: string, payload: any) => {
    const { data, error } = await supabase.from('tasks').update(payload).eq('id', id).select('*').single();
    if (error) throw error;
    return data;
  },

  createTask: async (payload: any) => {
    if (!payload?.client_id) throw new Error('Selecione um cliente antes de criar a tarefa.');

    const { data, error } = await supabase.from('tasks').insert(payload).select('*, clients!tasks_client_id_fkey(name)').single();
    if (error) throw error;

    await logActivity('task_created', 'task', data.id, data.client_id, {
      title: data.title,
      status: data.status,
    });

    return {
      ...data,
      client_name: data.clients?.name || null,
    };
  },

  deleteTask: async (id: string) => {
    const { error } = await supabase.from('tasks').delete().eq('id', id);
    if (error) throw error;
    await logActivity('task_deleted', 'task', id);
  },

  updateTasksBatch: async (items: Array<{ id: string; status: string; order_index: number }>) => {
    await Promise.all(
      items.map((item) =>
        supabase
          .from('tasks')
          .update({ status: item.status, order_index: item.order_index })
          .eq('id', item.id)
      )
    );

    return items;
  },
};

// Alias for backward compatibility
export const TaskService = {
  ...BoardService,
  getByClient: BoardService.getTasks,
};
