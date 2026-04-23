import type { SupabaseClient } from '@supabase/supabase-js';

export class BoardsRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async listBoards(includeArchived = false, clientId?: string) {
    let query = this.supabase
      .from('boards')
      .select('id, name, description, client_id, owner_id, color, icon, is_template, archived_at, sort_order, settings, created_at, updated_at, clients(name)')
      .order('sort_order', { ascending: true });

    if (!includeArchived) query = query.is('archived_at', null);
    if (clientId) query = query.eq('client_id', clientId);

    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  }

  async getBoardBundle(boardId: string) {
    const [boardRes, statusesRes, sectionsRes, fieldsRes, tasksRes] = await Promise.all([
      this.supabase
        .from('boards')
        .select('id, name, description, client_id, owner_id, color, icon, is_template, archived_at, sort_order, settings, created_at, updated_at, clients(name)')
        .eq('id', boardId)
        .single(),
      this.supabase
        .from('board_statuses')
        .select('id, board_id, name, color, sort_order, is_done')
        .eq('board_id', boardId)
        .order('sort_order'),
      this.supabase
        .from('board_sections')
        .select('id, board_id, name, color, sort_order, collapsed, created_at, updated_at')
        .eq('board_id', boardId)
        .order('sort_order'),
      this.supabase
        .from('board_custom_fields')
        .select('id, board_id, name, field_type, options, sort_order')
        .eq('board_id', boardId)
        .order('sort_order'),
      this.supabase
        .from('tasks')
        .select('id, title, description, status, status_id, priority, client_id, assignee_id, due_date, publish_at, estimated_minutes, activity_type, channel, approval_required, approval_id, board_id, section_id, sort_order, checklist, created_at, updated_at, clients!tasks_client_id_fkey(name)')
        .eq('board_id', boardId)
        .order('sort_order', { ascending: true }),
    ]);

    if (boardRes.error) throw boardRes.error;
    if (statusesRes.error) throw statusesRes.error;
    if (sectionsRes.error) throw sectionsRes.error;
    if (fieldsRes.error) throw fieldsRes.error;
    if (tasksRes.error) throw tasksRes.error;

    const tasks = tasksRes.data ?? [];
    const assigneeIds = [...new Set(tasks.map((task) => task.assignee_id).filter(Boolean))] as string[];

    const { data: profiles, error: profilesError } = assigneeIds.length
      ? await this.supabase.from('profiles').select('id, full_name, avatar_url').in('id', assigneeIds)
      : { data: [], error: null };

    if (profilesError) throw profilesError;

    return {
      board: boardRes.data,
      statuses: statusesRes.data ?? [],
      sections: sectionsRes.data ?? [],
      customFields: fieldsRes.data ?? [],
      tasks,
      profiles: profiles ?? [],
    };
  }

  async getTask(taskId: string) {
    const { data, error } = await this.supabase
      .from('tasks')
      .select('id, title, description, status, status_id, priority, client_id, assignee_id, due_date, publish_at, estimated_minutes, activity_type, channel, approval_required, approval_id, board_id, section_id, sort_order, checklist, created_at, updated_at, clients!tasks_client_id_fkey(name), task_custom_field_values(*), task_links(*)')
      .eq('id', taskId)
      .single();

    if (error) throw error;

    const [statusRes, profileRes] = await Promise.all([
      data.status_id
        ? this.supabase
            .from('board_statuses')
            .select('id, board_id, name, color, sort_order, is_done')
            .eq('id', data.status_id)
            .single()
        : Promise.resolve({ data: null, error: null }),
      data.assignee_id
        ? this.supabase.from('profiles').select('id, full_name, avatar_url').eq('id', data.assignee_id).single()
        : Promise.resolve({ data: null, error: null }),
    ]);

    if (statusRes.error) throw statusRes.error;
    if (profileRes.error) throw profileRes.error;

    return {
      task: data,
      status: statusRes.data,
      profile: profileRes.data,
    };
  }
}
