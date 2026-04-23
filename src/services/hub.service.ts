// src/services/hub.service.ts
import { supabase } from '@/lib/supabase';
import { PostWorkflowService } from '@/services/post-workflow.service';

export type WorkflowStatus =
  | 'rascunho'
  | 'revisao_interna'
  | 'aprovado_interno'
  | 'em_aprovacao_cliente'
  | 'revisao_cliente'
  | 'aprovado_cliente'
  | 'aguardando_agendamento'
  | 'agendado'
  | 'publicado';

export interface HubPost {
  id: string;
  client_id: string;
  post_date: string;           // 'YYYY-MM-DD'
  title: string | null;
  description: string | null;
  image_url: string | null;
  video_url: string | null;
  workflow_status: WorkflowStatus;
  scheduled_date: string | null;
  published_at: string | null;
  version_number: number;
  revision_count: number;
  post_type: string | null;
  channel: string | null;
  created_at: string;
  updated_at: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

const isMissingColumn = (error: unknown, column: string): boolean => {
  const msg = String((error as { message?: string })?.message || '').toLowerCase();
  return (
    msg.includes(column.toLowerCase()) &&
    (msg.includes('does not exist') || msg.includes('schema cache') || msg.includes('column'))
  );
};

/**
 * Returns true when the PostgREST error indicates one or more columns that are
 * part of the new schema don't exist yet in this environment's DB.
 */
const isNewSchemaColumnMissing = (error: unknown): boolean =>
  isMissingColumn(error, 'is_current_version') ||
  isMissingColumn(error, 'version_number') ||
  isMissingColumn(error, 'revision_count') ||
  isMissingColumn(error, 'scheduled_date') ||
  isMissingColumn(error, 'published_at') ||
  isMissingColumn(error, 'deleted_at') ||
  isMissingColumn(error, 'channel');

/** Normalize a raw DB row into a HubPost, filling in defaults for missing cols */
const normalizeRow = (row: Record<string, unknown>): HubPost => ({
  id: String(row.id ?? ''),
  client_id: String(row.client_id ?? ''),
  post_date: String(row.post_date ?? ''),
  title: typeof row.title === 'string' ? row.title : null,
  description: typeof row.description === 'string' ? row.description : null,
  image_url: typeof row.image_url === 'string' ? row.image_url : null,
  video_url: typeof row.video_url === 'string' ? row.video_url : null,
  workflow_status: (row.workflow_status as WorkflowStatus) ?? 'rascunho',
  scheduled_date: typeof row.scheduled_date === 'string' ? row.scheduled_date : null,
  published_at: typeof row.published_at === 'string' ? row.published_at : null,
  version_number: Number(row.version_number ?? 1),
  revision_count: Number(row.revision_count ?? 0),
  post_type: typeof row.post_type === 'string' ? row.post_type : null,
  channel: typeof row.channel === 'string' ? row.channel : null,
  created_at: String(row.created_at ?? ''),
  updated_at: String(row.updated_at ?? ''),
});

// ────────────────────────────────────────────────────────────────────────────
// Service
// ────────────────────────────────────────────────────────────────────────────

export const HubService = {
  /**
   * Fetch all current-version posts for a client in a given month.
   * Tries the full schema first; falls back gracefully if new columns
   * haven't been migrated yet.
   */
  async getPostsForMonth(clientId: string, year: number, month: number): Promise<HubPost[]> {
    // month is 0-indexed (Jan = 0)
    const start = new Date(year, month, 1).toISOString().split('T')[0];
    const end   = new Date(year, month + 1, 0).toISOString().split('T')[0];

    // Common base query builder
    const baseQuery = () =>
      supabase
        .from('posting_calendar_items')
        .select('*')
        .eq('client_id', clientId)
        .gte('post_date', start)
        .lte('post_date', end)
        .order('post_date', { ascending: true });

    // ── Attempt 1: full schema (is_current_version + deleted_at) ──────────
    let resp = await baseQuery()
      .eq('is_current_version', true)
      .is('deleted_at', null);

    // ── Attempt 2: deleted_at column missing ───────────────────────────────
    if (resp.error && isMissingColumn(resp.error, 'deleted_at')) {
      resp = await baseQuery().eq('is_current_version', true);
    }

    // ── Attempt 3: is_current_version missing → no filter, JS-filter below ─
    if (resp.error && isNewSchemaColumnMissing(resp.error)) {
      resp = await baseQuery();
    }

    if (resp.error) throw resp.error;

    const rows = (resp.data ?? []) as Record<string, unknown>[];

    // Filter in JS too — handles both new schema and legacy
    const filtered = rows.filter((r) => r.is_current_version !== false);

    return filtered.map(normalizeRow);
  },

  async movePostToDay(postId: string, newDate: string): Promise<void> {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate)) {
      throw new Error(`Formato de data inválido: ${newDate}`);
    }
    const { error } = await supabase
      .from('posting_calendar_items')
      .update({ post_date: newDate, updated_at: new Date().toISOString() })
      .eq('id', postId);
    if (error) throw error;
  },

  async updateWorkflowStatus(postId: string, status: WorkflowStatus): Promise<void> {
    const role = 'admin_operacional' as const;

    switch (status) {
      case 'rascunho': {
        await PostWorkflowService.changeStatus({
          postId,
          action: 'retornar_rascunho',
          role,
          comment: 'Post retornado para ajustes internos pelo HUB.',
        });
        return;
      }
      case 'revisao_interna': {
        await PostWorkflowService.changeStatus({
          postId,
          action: 'enviar_revisao_interna',
          role,
          comment: 'Post enviado para revisão interna pelo HUB.',
        });
        return;
      }
      case 'aprovado_interno': {
        await PostWorkflowService.changeStatus({
          postId,
          action: 'aprovar_interno',
          role,
          comment: 'Aprovação interna registrada pelo HUB.',
        });
        return;
      }
      case 'em_aprovacao_cliente': {
        await PostWorkflowService.changeStatus({
          postId,
          action: 'enviar_cliente',
          role,
          comment: 'Post enviado para aprovação do cliente pelo HUB.',
        });
        return;
      }
      case 'aguardando_agendamento': {
        await PostWorkflowService.prepareScheduling({
          postId,
          role,
          comment: 'Post movido para a fila de agendamento pelo HUB.',
        });
        return;
      }
      case 'publicado': {
        await PostWorkflowService.publishPost({
          postId,
          role,
          comment: 'Publicação confirmada pelo HUB.',
        });
        return;
      }
      default:
        throw new Error(`Ação manual não permitida no HUB para o status ${status}.`);
    }
  },

  async schedulePost(postId: string, scheduledDate: string): Promise<void> {
    await PostWorkflowService.schedulePost({
      postId,
      role: 'admin_operacional',
      scheduledDate,
      comment: 'Agendamento confirmado pela Central Operacional.',
    });
  },
};
