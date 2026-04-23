import { supabase } from '@/lib/supabase';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Board {
  id: string;
  name: string;
  description: string | null;
  client_id: string | null;
  owner_id: string | null;
  color: string;
  icon: string;
  is_template: boolean;
  archived_at: string | null;
  sort_order: number;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  // joined
  client_name?: string | null;
}

export interface BoardStatus {
  id: string;
  board_id: string;
  name: string;
  color: string;
  sort_order: number;
  is_done: boolean;
}

export interface BoardSection {
  id: string;
  board_id: string;
  name: string;
  color: string | null;
  sort_order: number;
  collapsed: boolean;
  created_at: string;
  updated_at: string;
}

export interface BoardCustomField {
  id: string;
  board_id: string;
  name: string;
  field_type: 'text' | 'number' | 'date' | 'select' | 'multi_select' | 'checkbox' | 'url' | 'person';
  options: { id: string; label: string; color?: string }[];
  sort_order: number;
}

export interface TaskLink {
  id: string;
  task_id: string;
  url: string;
  title: string | null;
  link_type: 'general' | 'figma' | 'gdrive' | 'notion' | 'loom' | 'github';
  created_at: string;
}

export interface TaskDependency {
  id: string;
  task_id: string;
  depends_on_task_id: string;
  dependency_type: 'blocks' | 'related';
}

export interface TaskCustomFieldValue {
  id: string;
  task_id: string;
  field_id: string;
  value_text: string | null;
  value_number: number | null;
  value_date: string | null;
  value_json: unknown;
}

export interface BoardTaskV2 {
  id: string;
  title: string;
  description: string | null;
  status: string;         // legacy text status
  status_id: string | null;
  priority: 'low' | 'medium' | 'high';
  client_id: string | null;
  assignee_id: string | null;
  due_date: string | null;
  publish_at: string | null;
  estimated_minutes: number | null;
  activity_type: string | null;
  channel: string | null;
  approval_required: boolean;
  approval_id: string | null;
  board_id: string | null;
  section_id: string | null;
  sort_order: number;
  checklist: { id: string; title: string; done: boolean }[];
  created_at: string;
  updated_at: string;
  // joined
  client_name?: string | null;
  assignee_name?: string | null;
  assignee_avatar?: string | null;
  status_obj?: BoardStatus | null;
  custom_field_values?: TaskCustomFieldValue[];
  links?: TaskLink[];
}

export interface BoardConfig {
  board: Board;
  statuses: BoardStatus[];
  sections: BoardSection[];
  customFields: BoardCustomField[];
}

export interface BoardBundle {
  board: Board;
  statuses: BoardStatus[];
  sections: BoardSection[];
  customFields: BoardCustomField[];
  tasks: BoardTaskV2[];
}

export interface CreateBoardPayload {
  name: string;
  description?: string | null;
  client_id?: string | null;
  color?: string;
  icon?: string;
}

export interface CreateSectionPayload {
  board_id: string;
  name: string;
  color?: string | null;
}

export interface CreateTaskV2Payload {
  title: string;
  description?: string | null;
  board_id: string;
  section_id?: string | null;
  status_id?: string | null;
  client_id?: string | null;
  assignee_id?: string | null;
  due_date?: string | null;
  priority?: 'low' | 'medium' | 'high';
  activity_type?: string | null;
  channel?: string | null;
  estimated_minutes?: number | null;
}

export interface MoveTaskPayload {
  taskId: string;
  targetSectionId: string | null;
  targetStatusId: string | null;
  sortOrder?: number;
}

export interface WipMetrics {
  status_name: string;
  status_color: string;
  count: number;
  avg_age_hours: number;
}

const TASK_ATTACHMENT_BUCKET = 'posting-calendars';

const BOARD_BUNDLE_TTL_MS = 20_000;
const boardBundleCache = new Map<string, { expiresAt: number; data: BoardBundle }>();
const boardBundlePending = new Map<string, Promise<BoardBundle>>();

const getCachedBoardBundle = (boardId: string) => {
  const entry = boardBundleCache.get(boardId);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    boardBundleCache.delete(boardId);
    return null;
  }
  return entry.data;
};

const setCachedBoardBundle = (boardId: string, data: BoardBundle) => {
  boardBundleCache.set(boardId, {
    data,
    expiresAt: Date.now() + BOARD_BUNDLE_TTL_MS,
  });
  return data;
};

const invalidateBoardBundle = (boardId?: string | null) => {
  if (!boardId) return;
  boardBundleCache.delete(boardId);
  boardBundlePending.delete(boardId);
};

// ─── Service ─────────────────────────────────────────────────────────────────

export const BoardV2Service = {
  // ── Boards ────────────────────────────────────────────────────────────────

  async getBoards(options?: { includeArchived?: boolean; clientId?: string }): Promise<Board[]> {
    let q = supabase
      .from('boards')
      .select('*, clients(name)')
      .order('sort_order', { ascending: true });

    if (!options?.includeArchived) q = q.is('archived_at', null);
    if (options?.clientId) q = q.eq('client_id', options.clientId);

    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []).map((b) => ({
      ...b,
      client_name: (b.clients as { name: string } | null)?.name ?? null,
      clients: undefined,
    })) as Board[];
  },

  async getBoard(boardId: string): Promise<Board> {
    const { data, error } = await supabase
      .from('boards')
      .select('*, clients(name)')
      .eq('id', boardId)
      .single();
    if (error) throw error;
    return {
      ...data,
      client_name: (data.clients as { name: string } | null)?.name ?? null,
      clients: undefined,
    } as Board;
  },

  async getBoardBundle(boardId: string, options?: { force?: boolean }): Promise<BoardBundle> {
    if (!options?.force) {
      const cached = getCachedBoardBundle(boardId);
      if (cached) return cached;

      const pending = boardBundlePending.get(boardId);
      if (pending) return pending;
    }

    const request = Promise.all([
      BoardV2Service.getBoardConfigDirect(boardId),
      BoardV2Service.getBoardTasksDirect(boardId),
    ])
      .then(([config, tasks]) =>
        setCachedBoardBundle(boardId, {
          board: config.board,
          statuses: config.statuses,
          sections: config.sections,
          customFields: config.customFields,
          tasks,
        })
      )
      .finally(() => {
        boardBundlePending.delete(boardId);
      });

    boardBundlePending.set(boardId, request);
    return request;
  },

  async getBoardConfigDirect(boardId: string): Promise<BoardConfig> {
    const [boardRes, statusesRes, sectionsRes, fieldsRes] = await Promise.all([
      supabase.from('boards').select('*').eq('id', boardId).single(),
      supabase.from('board_statuses').select('*').eq('board_id', boardId).order('sort_order'),
      supabase.from('board_sections').select('*').eq('board_id', boardId).order('sort_order'),
      supabase.from('board_custom_fields').select('*').eq('board_id', boardId).order('sort_order'),
    ]);

    if (boardRes.error) throw boardRes.error;

    return {
      board: boardRes.data as Board,
      statuses: (statusesRes.data ?? []) as BoardStatus[],
      sections: (sectionsRes.data ?? []) as BoardSection[],
      customFields: (fieldsRes.data ?? []).map((f) => ({
        ...f,
        options: Array.isArray(f.options) ? f.options : [],
      })) as BoardCustomField[],
    };
  },

  async createBoard(payload: CreateBoardPayload): Promise<Board> {
    const { data: maxRow } = await supabase
      .from('boards')
      .select('sort_order')
      .order('sort_order', { ascending: false })
      .limit(1)
      .single();

    const { data, error } = await supabase
      .from('boards')
      .insert({ ...payload, sort_order: (maxRow?.sort_order ?? 0) + 1 })
      .select()
      .single();
    if (error) throw error;

    // create default statuses for the new board
    await supabase.from('board_statuses').insert([
      { board_id: data.id, name: 'A Fazer',      color: '#94a3b8', sort_order: 0, is_done: false },
      { board_id: data.id, name: 'Em Andamento', color: '#f59e0b', sort_order: 1, is_done: false },
      { board_id: data.id, name: 'Em Revisão',   color: '#8b5cf6', sort_order: 2, is_done: false },
      { board_id: data.id, name: 'Concluído',    color: '#10b981', sort_order: 3, is_done: true  },
    ]);

    invalidateBoardBundle(data.id);
    return data as Board;
  },

  async updateBoard(boardId: string, patch: Partial<Omit<Board, 'id' | 'created_at' | 'updated_at'>>): Promise<void> {
    const { error } = await supabase
      .from('boards')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', boardId);
    if (error) throw error;
    invalidateBoardBundle(boardId);
  },

  async archiveBoard(boardId: string): Promise<void> {
    const { error } = await supabase
      .from('boards')
      .update({ archived_at: new Date().toISOString() })
      .eq('id', boardId);
    if (error) throw error;
    invalidateBoardBundle(boardId);
  },

  // ── Board Config (statuses + sections + custom fields) ────────────────────

  async getBoardConfig(boardId: string): Promise<BoardConfig> {
    const bundle = await BoardV2Service.getBoardBundle(boardId);
    return {
      board: bundle.board,
      statuses: bundle.statuses,
      sections: bundle.sections,
      customFields: bundle.customFields,
    };
  },

  // ── Sections ──────────────────────────────────────────────────────────────

  async createSection(payload: CreateSectionPayload): Promise<BoardSection> {
    const { data: maxRow } = await supabase
      .from('board_sections')
      .select('sort_order')
      .eq('board_id', payload.board_id)
      .order('sort_order', { ascending: false })
      .limit(1)
      .single();

    const { data, error } = await supabase
      .from('board_sections')
      .insert({ ...payload, sort_order: (maxRow?.sort_order ?? -1) + 1 })
      .select()
      .single();
    if (error) throw error;
    invalidateBoardBundle(payload.board_id);
    return data as BoardSection;
  },

  async updateSection(sectionId: string, patch: { name?: string; color?: string | null; collapsed?: boolean }): Promise<void> {
    const { data: sectionRow } = await supabase.from('board_sections').select('board_id').eq('id', sectionId).maybeSingle();
    const { error } = await supabase
      .from('board_sections')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', sectionId);
    if (error) throw error;
    invalidateBoardBundle(sectionRow?.board_id ?? null);
  },

  async deleteSection(sectionId: string): Promise<void> {
    // Unlink tasks before deleting
    const { data: sectionRow } = await supabase.from('board_sections').select('board_id').eq('id', sectionId).maybeSingle();
    await supabase.from('tasks').update({ section_id: null }).eq('section_id', sectionId);
    const { error } = await supabase.from('board_sections').delete().eq('id', sectionId);
    if (error) throw error;
    invalidateBoardBundle(sectionRow?.board_id ?? null);
  },

  // ── Statuses ──────────────────────────────────────────────────────────────

  async createStatus(boardId: string, name: string, color = '#94a3b8'): Promise<BoardStatus> {
    const { data: maxRow } = await supabase
      .from('board_statuses')
      .select('sort_order')
      .eq('board_id', boardId)
      .order('sort_order', { ascending: false })
      .limit(1)
      .single();

    const { data, error } = await supabase
      .from('board_statuses')
      .insert({ board_id: boardId, name, color, sort_order: (maxRow?.sort_order ?? -1) + 1 })
      .select()
      .single();
    if (error) throw error;
    invalidateBoardBundle(boardId);
    return data as BoardStatus;
  },

  async updateStatus(statusId: string, patch: { name?: string; color?: string; is_done?: boolean }): Promise<void> {
    const { data: statusRow } = await supabase.from('board_statuses').select('board_id').eq('id', statusId).maybeSingle();
    const { error } = await supabase.from('board_statuses').update(patch).eq('id', statusId);
    if (error) throw error;
    invalidateBoardBundle(statusRow?.board_id ?? null);
  },

  async deleteStatus(statusId: string): Promise<void> {
    const { data: statusRow } = await supabase.from('board_statuses').select('board_id').eq('id', statusId).maybeSingle();
    await supabase.from('tasks').update({ status_id: null }).eq('status_id', statusId);
    const { error } = await supabase.from('board_statuses').delete().eq('id', statusId);
    if (error) throw error;
    invalidateBoardBundle(statusRow?.board_id ?? null);
  },

  // ── Tasks ─────────────────────────────────────────────────────────────────

  async getBoardTasksDirect(boardId: string): Promise<BoardTaskV2[]> {
    const { data, error } = await supabase
      .from('tasks')
      .select('*, clients!tasks_client_id_fkey(name)')
      .eq('board_id', boardId)
      .order('sort_order', { ascending: true });

    if (error) throw error;
    const tasks = data ?? [];

    // Fetch statuses and profiles separately (no FK join available)
    const statusIds = [...new Set(tasks.map((t) => t.status_id).filter(Boolean))] as string[];
    const assigneeIds = [...new Set(tasks.map((t) => t.assignee_id).filter(Boolean))] as string[];

    const [statusesRes, profilesRes] = await Promise.all([
      statusIds.length > 0
        ? supabase.from('board_statuses').select('id, name, color, sort_order, is_done').in('id', statusIds)
        : Promise.resolve({ data: [] }),
      assigneeIds.length > 0
        ? supabase.from('profiles').select('id, full_name, avatar_url').in('id', assigneeIds)
        : Promise.resolve({ data: [] }),
    ]);

    const statusMap = new Map((statusesRes.data ?? []).map((s) => [s.id, s]));
    const profileMap = new Map((profilesRes.data ?? []).map((p) => [p.id, p]));

    return tasks.map((t) => ({
      ...t,
      client_name: (t.clients as { name: string } | null)?.name ?? null,
      assignee_name: profileMap.get(t.assignee_id)?.full_name ?? null,
      assignee_avatar: profileMap.get(t.assignee_id)?.avatar_url ?? null,
      status_obj: statusMap.get(t.status_id) as BoardStatus | null ?? null,
      checklist: Array.isArray(t.checklist) ? t.checklist : [],
      clients: undefined,
    })) as BoardTaskV2[];
  },

  async getBoardTasks(boardId: string): Promise<BoardTaskV2[]> {
    const bundle = await BoardV2Service.getBoardBundle(boardId);
    return bundle.tasks;
  },

  async getTask(taskId: string): Promise<BoardTaskV2> {
    const { data, error } = await supabase
      .from('tasks')
      .select('*, clients!tasks_client_id_fkey(name), task_custom_field_values(*), task_links(*)')
      .eq('id', taskId)
      .single();

    if (error) throw error;

    // Fetch status and profile separately
    const [statusRes, profileRes] = await Promise.all([
      data.status_id
        ? supabase.from('board_statuses').select('id, name, color, sort_order, is_done').eq('id', data.status_id).single()
        : Promise.resolve({ data: null }),
      data.assignee_id
        ? supabase.from('profiles').select('id, full_name, avatar_url').eq('id', data.assignee_id).single()
        : Promise.resolve({ data: null }),
    ]);

    return {
      ...data,
      client_name: (data.clients as { name: string } | null)?.name ?? null,
      assignee_name: (profileRes.data as { full_name: string } | null)?.full_name ?? null,
      assignee_avatar: (profileRes.data as { avatar_url: string } | null)?.avatar_url ?? null,
      status_obj: statusRes.data as BoardStatus | null,
      checklist: Array.isArray(data.checklist) ? data.checklist : [],
      custom_field_values: (data.task_custom_field_values ?? []) as TaskCustomFieldValue[],
      links: (data.task_links ?? []) as TaskLink[],
      clients: undefined,
      task_custom_field_values: undefined,
      task_links: undefined,
    } as BoardTaskV2;
  },

  async createTaskV2(payload: CreateTaskV2Payload): Promise<BoardTaskV2> {
    const { data: maxRow } = await supabase
      .from('tasks')
      .select('sort_order')
      .eq('board_id', payload.board_id)
      .order('sort_order', { ascending: false })
      .limit(1)
      .single();

    // Resolve status_id: use passed one or pick first status of board
    let statusId = payload.status_id ?? null;
    if (!statusId) {
      const { data: firstStatus } = await supabase
        .from('board_statuses')
        .select('id, name')
        .eq('board_id', payload.board_id)
        .order('sort_order')
        .limit(1)
        .single();
      statusId = firstStatus?.id ?? null;
    }

    const { data, error } = await supabase
      .from('tasks')
      .insert({
        title: payload.title,
        description: payload.description ?? null,
        board_id: payload.board_id,
        section_id: payload.section_id ?? null,
        status_id: statusId,
        status: 'todo',
        client_id: payload.client_id ?? null,
        assignee_id: payload.assignee_id ?? null,
        due_date: payload.due_date ?? null,
        priority: payload.priority ?? 'medium',
        activity_type: payload.activity_type ?? null,
        channel: payload.channel ?? null,
        estimated_minutes: payload.estimated_minutes ?? null,
        sort_order: (maxRow?.sort_order ?? -1) + 1,
        checklist: [],
      })
      .select('*, clients!tasks_client_id_fkey(name)')
      .single();

    if (error) throw error;

    // Record state change
    await supabase.from('task_state_changes').insert({
      task_id: data.id,
      from_status: null,
      to_status: 'todo',
      changed_at: new Date().toISOString(),
    });

    const [statusRes, profileRes] = await Promise.all([
      statusId
        ? supabase.from('board_statuses').select('id, name, color, sort_order, is_done').eq('id', statusId).single()
        : Promise.resolve({ data: null }),
      data.assignee_id
        ? supabase.from('profiles').select('id, full_name, avatar_url').eq('id', data.assignee_id).single()
        : Promise.resolve({ data: null }),
    ]);

    invalidateBoardBundle(payload.board_id);
    return {
      ...data,
      client_name: (data.clients as { name: string } | null)?.name ?? null,
      assignee_name: (profileRes.data as { full_name: string } | null)?.full_name ?? null,
      assignee_avatar: (profileRes.data as { avatar_url: string } | null)?.avatar_url ?? null,
      status_obj: statusRes.data as BoardStatus | null,
      checklist: [],
      clients: undefined,
    } as BoardTaskV2;
  },

  async updateTask(
    taskId: string,
    patch: Partial<Pick<BoardTaskV2,
      'title' | 'description' | 'status_id' | 'section_id' | 'priority' |
      'due_date' | 'assignee_id' | 'client_id' | 'activity_type' | 'channel' |
      'estimated_minutes' | 'publish_at' | 'approval_required' | 'checklist'
    >>
  ): Promise<void> {
    const { data: taskRow } = await supabase.from('tasks').select('board_id').eq('id', taskId).maybeSingle();
    const { error } = await supabase
      .from('tasks')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', taskId);
    if (error) throw error;
    invalidateBoardBundle(taskRow?.board_id ?? null);
  },

  async moveTask(payload: MoveTaskPayload): Promise<void> {
    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (payload.targetSectionId !== undefined) patch.section_id = payload.targetSectionId;
    if (payload.targetStatusId !== undefined) patch.status_id = payload.targetStatusId;
    if (payload.sortOrder !== undefined) patch.sort_order = payload.sortOrder;

    const { error } = await supabase.from('tasks').update(patch).eq('id', payload.taskId);
    if (error) throw error;
    const { data: taskRow } = await supabase.from('tasks').select('board_id').eq('id', payload.taskId).maybeSingle();
    invalidateBoardBundle(taskRow?.board_id ?? null);
  },

  async deleteTask(taskId: string): Promise<void> {
    const { data: taskRow } = await supabase.from('tasks').select('board_id').eq('id', taskId).maybeSingle();
    const { error } = await supabase.from('tasks').delete().eq('id', taskId);
    if (error) throw error;
    invalidateBoardBundle(taskRow?.board_id ?? null);
  },

  async setTaskApprovalRequired(taskId: string, required: boolean, approvalId?: string | null): Promise<void> {
    const { data: taskRow } = await supabase.from('tasks').select('board_id').eq('id', taskId).maybeSingle();
    const { error } = await supabase
      .from('tasks')
      .update({ approval_required: required, approval_id: approvalId ?? null, updated_at: new Date().toISOString() })
      .eq('id', taskId);
    if (error) throw error;
    invalidateBoardBundle(taskRow?.board_id ?? null);
  },

  // ── Reorder tasks within a section ────────────────────────────────────────

  async reorderTasks(orderedIds: string[]): Promise<void> {
    const firstTaskId = orderedIds[0];
    const updates = orderedIds.map((id, index) =>
      supabase.from('tasks').update({ sort_order: index }).eq('id', id)
    );
    await Promise.all(updates);
    if (firstTaskId) {
      const { data: taskRow } = await supabase.from('tasks').select('board_id').eq('id', firstTaskId).maybeSingle();
      invalidateBoardBundle(taskRow?.board_id ?? null);
    }
  },

  // ── Task links ────────────────────────────────────────────────────────────

  async addTaskLink(taskId: string, url: string, title?: string, linkType: TaskLink['link_type'] = 'general'): Promise<TaskLink> {
    const { data, error } = await supabase
      .from('task_links')
      .insert({ task_id: taskId, url, title: title ?? null, link_type: linkType })
      .select()
      .single();
    if (error) throw error;
    const { data: taskRow } = await supabase.from('tasks').select('board_id').eq('id', taskId).maybeSingle();
    invalidateBoardBundle(taskRow?.board_id ?? null);
    return data as TaskLink;
  },

  async uploadTaskAttachment(taskId: string, file: File): Promise<TaskLink> {
    const sanitizedName = file.name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9._-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase();

    const path = `task-attachments/${taskId}/${crypto.randomUUID()}-${sanitizedName || 'arquivo'}`;
    const { error: uploadError } = await supabase.storage
      .from(TASK_ATTACHMENT_BUCKET)
      .upload(path, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type || 'application/octet-stream',
      });

    if (uploadError) throw uploadError;

    const { data: publicData } = supabase.storage.from(TASK_ATTACHMENT_BUCKET).getPublicUrl(path);

    return BoardV2Service.addTaskLink(taskId, publicData.publicUrl, file.name, 'general');
  },

  async deleteTaskLink(linkId: string): Promise<void> {
    const { data: linkRow } = await supabase.from('task_links').select('task_id').eq('id', linkId).maybeSingle();
    const { error } = await supabase.from('task_links').delete().eq('id', linkId);
    if (error) throw error;
    if (linkRow?.task_id) {
      const { data: taskRow } = await supabase.from('tasks').select('board_id').eq('id', linkRow.task_id).maybeSingle();
      invalidateBoardBundle(taskRow?.board_id ?? null);
    }
  },

  // ── Custom field values ───────────────────────────────────────────────────

  async setCustomFieldValue(taskId: string, fieldId: string, value: {
    text?: string | null;
    number?: number | null;
    date?: string | null;
    json?: unknown;
  }): Promise<void> {
    const { error } = await supabase
      .from('task_custom_field_values')
      .upsert({
        task_id: taskId,
        field_id: fieldId,
        value_text: value.text ?? null,
        value_number: value.number ?? null,
        value_date: value.date ?? null,
        value_json: value.json ?? null,
      }, { onConflict: 'task_id,field_id' });
    if (error) throw error;
    const { data: taskRow } = await supabase.from('tasks').select('board_id').eq('id', taskId).maybeSingle();
    invalidateBoardBundle(taskRow?.board_id ?? null);
  },

  // ── Metrics ───────────────────────────────────────────────────────────────

  async getWipMetrics(boardId: string): Promise<WipMetrics[]> {
    const bundle = await BoardV2Service.getBoardBundle(boardId);
    const statuses = bundle.statuses;
    const tasks = bundle.tasks;

    const now = Date.now();
    return (statuses ?? []).map((s) => {
      const statusTasks = (tasks ?? []).filter((t) => t.status_id === s.id);
      const totalHours = statusTasks.reduce((sum, t) => {
        const created = t.created_at ? new Date(t.created_at).getTime() : now;
        return sum + (now - created) / 3_600_000;
      }, 0);
      return {
        status_name: s.name,
        status_color: s.color,
        count: statusTasks.length,
        avg_age_hours: statusTasks.length > 0 ? Math.round(totalHours / statusTasks.length) : 0,
      };
    });
  },

  async getCycleTime(boardId: string, days = 30): Promise<{ avg_hours: number; p50_hours: number; p90_hours: number }> {
    const since = new Date(Date.now() - days * 86_400_000).toISOString();

    // Get done status IDs for this board
    const { data: doneStatuses } = await supabase
      .from('board_statuses')
      .select('id')
      .eq('board_id', boardId)
      .eq('is_done', true);

    const doneIds = (doneStatuses ?? []).map((s) => s.id);
    if (doneIds.length === 0) return { avg_hours: 0, p50_hours: 0, p90_hours: 0 };

    const { data: changes } = await supabase
      .from('task_state_changes')
      .select('task_id, from_status, to_status, changed_at')
      .gte('changed_at', since)
      .in('to_status', doneIds);

    if (!changes || changes.length === 0) return { avg_hours: 0, p50_hours: 0, p90_hours: 0 };

    // Match with creation times
    const taskIds = [...new Set(changes.map((c) => c.task_id))];
    const { data: taskRows } = await supabase
      .from('tasks')
      .select('id, created_at')
      .in('id', taskIds);

    const createdMap = new Map((taskRows ?? []).map((t) => [t.id, t.created_at]));

    const durations = changes
      .map((c) => {
        const created = createdMap.get(c.task_id);
        if (!created) return null;
        return (new Date(c.changed_at).getTime() - new Date(created).getTime()) / 3_600_000;
      })
      .filter((d): d is number => d !== null && d >= 0)
      .sort((a, b) => a - b);

    if (durations.length === 0) return { avg_hours: 0, p50_hours: 0, p90_hours: 0 };

    const avg = durations.reduce((s, v) => s + v, 0) / durations.length;
    const p50 = durations[Math.floor(durations.length * 0.5)];
    const p90 = durations[Math.floor(durations.length * 0.9)];

    return {
      avg_hours: Math.round(avg),
      p50_hours: Math.round(p50),
      p90_hours: Math.round(p90),
    };
  },
};
