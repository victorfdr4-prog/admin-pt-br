import { supabase } from '@/lib/supabase';
import {
  DEFAULT_POSTING_CALENDAR_TEMPLATE,
  normalizePostingCalendarTemplateConfig,
  type PostingCalendarTemplateConfig,
  type PostingCalendarLegendItem,
} from '@/domain/agencyPlatform';
import {
  buildPostVersionContent,
  getCurrentPostVersion,
  getPreviousPostVersion,
  mapPostVersionRow,
  normalizeChangeLog,
  type PostVersionRecord,
} from '@/domain/postVersions';
import { normalizeWorkflowStatus } from '@/domain/postWorkflow';
import { getCurrentUser, getSettingValue, saveSettingValue } from './_shared';

const POSTING_CALENDAR_LEGEND_SETTING_KEY = 'posting_calendar_legend_items';
const DEFAULT_TEMPLATE_ID = 'posting-calendar-default';

const isMissingSchemaEntityError = (error: unknown, entityName: string) => {
  const message = String((error as { message?: string })?.message || '').toLowerCase();
  return (
    message.includes(entityName.toLowerCase()) &&
    (message.includes('does not exist') || message.includes('schema cache'))
  );
};

const normalizeLegendItems = (value: unknown): PostingCalendarLegendItem[] => {
  const source = Array.isArray(value) ? value : [];
  if (!source.length) {
    return DEFAULT_POSTING_CALENDAR_TEMPLATE.legend_items.map((item) => ({ ...item }));
  }

  return source
    .map((item, index) => {
      if (!item || typeof item !== 'object') return null;
      const record = item as Partial<PostingCalendarLegendItem>;
      return {
        id: String(record.id || `legend-${index + 1}`),
        label: String(record.label || '').trim() || `LEGENDA ${index + 1}`,
        color: String(record.color || '#dbeafe'),
        textColor: String(record.textColor || '#27354d'),
        visible: record.visible !== false,
      } satisfies PostingCalendarLegendItem;
    })
    .filter((item): item is PostingCalendarLegendItem => Boolean(item));
};

const deriveChangeLogEntries = (
  existingItem: Record<string, any> | null,
  payload: {
    title?: string | null;
    description?: string | null;
    notes?: string | null;
    image_url?: string | null;
    video_url?: string | null;
    post_type?: string | null;
    label_color?: string | null;
  }
) => {
  if (!existingItem) {
    return ['Versao inicial'];
  }

  const changes: string[] = [];

  if (
    String(existingItem.title || '') !== String(payload.title || '') ||
    String(existingItem.description || '') !== String(payload.description || '')
  ) {
    changes.push('Texto alterado');
  }

  if (
    String(existingItem.image_url || '') !== String(payload.image_url || '') ||
    String(existingItem.video_url || '') !== String(payload.video_url || '')
  ) {
    changes.push('Imagem/Vídeo alterado');
  }

  if (String(existingItem.notes || '') !== String(payload.notes || '')) {
    changes.push('CTA alterado');
  }

  if (
    String(existingItem.post_type || '') !== String(payload.post_type || '') ||
    String(existingItem.label_color || '') !== String(payload.label_color || '')
  ) {
    changes.push('Design alterado');
  }

  return changes.length ? changes : ['Texto alterado'];
};

const mapCalendarLineageRowToVersion = (row: Record<string, any>): PostVersionRecord => ({
  id: String(row.id || ''),
  post_id: String(row.parent_post_id || row.id || ''),
  version_number: Number(row.version_number || 1),
  title: typeof row.title === 'string' ? row.title : null,
  content: buildPostVersionContent({
    description: row.description ?? null,
    notes: row.notes ?? null,
    image_url: row.image_url ?? null,
    video_url: row.video_url ?? null,
    post_type: row.post_type ?? null,
    label_color: row.label_color ?? null,
    workflow_status: row.workflow_status ?? null,
    approval_status: row.approval_status ?? null,
    day_number: typeof row.day_number === 'number' ? row.day_number : Number(row.day_number || 0) || null,
    post_date: row.post_date ?? null,
  }),
  created_by: typeof row.owner_id === 'string' ? row.owner_id : null,
  created_at: String(row.created_at || row.updated_at || ''),
  change_reason: typeof row.change_reason === 'string' ? row.change_reason : null,
  change_log: normalizeChangeLog(row.change_log),
  is_current: row.is_current_version !== false,
});

const CALENDAR_LINEAGE_SELECT = `
  id,
  parent_post_id,
  version_number,
  title,
  description,
  notes,
  image_url,
  video_url,
  post_type,
  label_color,
  workflow_status,
  approval_status,
  post_date,
  day_number,
  created_at,
  updated_at,
  owner_id,
  change_reason,
  change_log,
  is_current_version
`;

const buildLegacyVersionsMap = async (postIds: string[]) => {
  const uniquePostIds = Array.from(new Set(postIds.filter(Boolean)));
  const emptyMap = new Map<string, PostVersionRecord[]>();

  if (!uniquePostIds.length) return emptyMap;

  let response = await supabase
    .from('post_versions')
    .select('id, post_id, version_number, title, content, created_by, created_at, change_reason, change_log, is_current')
    .in('post_id', uniquePostIds)
    .order('version_number', { ascending: false });

  if (response.error && isMissingSchemaEntityError(response.error, 'change_log')) {
    response = await supabase
      .from('post_versions')
      .select('id, post_id, version_number, title, content, created_by, created_at, change_reason, is_current')
      .in('post_id', uniquePostIds)
      .order('version_number', { ascending: false });
  }

  if (response.error) {
    if (isMissingSchemaEntityError(response.error, 'post_versions')) {
      return emptyMap;
    }
    throw response.error;
  }

  return (response.data || []).reduce((map, row) => {
    const version = mapPostVersionRow(row as Record<string, unknown>);
    const bucket = map.get(version.post_id) || [];
    bucket.push(version);
    map.set(version.post_id, bucket);
    return map;
  }, emptyMap);
};

const attachVersionsToRows = async <T extends Record<string, any>>(rows: T[]) => {
  if (!rows.length) return rows;

  const rowIds = rows.map((row) => String(row.id || '')).filter(Boolean);
  const parentLookupResponse = await supabase
    .from('posting_calendar_items')
    .select('id, parent_post_id')
    .in('id', rowIds);

  if (
    parentLookupResponse.error &&
    (isMissingSchemaEntityError(parentLookupResponse.error, 'parent_post_id') ||
      isMissingSchemaEntityError(parentLookupResponse.error, 'version_number') ||
      isMissingSchemaEntityError(parentLookupResponse.error, 'is_current_version') ||
      isMissingSchemaEntityError(parentLookupResponse.error, 'change_log') ||
      isMissingSchemaEntityError(parentLookupResponse.error, 'change_reason'))
  ) {
    const versionsMap = await buildLegacyVersionsMap(rowIds);
    return rows.map((row) => {
      const versions = versionsMap.get(String(row.id || '')) || [];
      return {
        ...row,
        versions,
        current_version: getCurrentPostVersion(versions),
        previous_version: getPreviousPostVersion(versions),
        current_version_number: getCurrentPostVersion(versions)?.version_number ?? null,
      };
    });
  }

  if (parentLookupResponse.error) throw parentLookupResponse.error;

  const parentByRowId = new Map(
    (parentLookupResponse.data || []).map((row: any) => [String(row.id || ''), String(row.parent_post_id || row.id || '')])
  );
  const parentIds = Array.from(new Set(Array.from(parentByRowId.values()).filter(Boolean)));

  if (!parentIds.length) {
    return rows.map((row) => ({
      ...row,
      versions: [],
      current_version: null,
      previous_version: null,
      current_version_number: Number(row.version_number || 1) || 1,
    }));
  }

  const lineageResponse = await supabase
    .from('posting_calendar_items')
    .select(CALENDAR_LINEAGE_SELECT)
    .in('parent_post_id', parentIds)
    .order('version_number', { ascending: false })
    .order('created_at', { ascending: false });

  if (lineageResponse.error) throw lineageResponse.error;

  const versionsByParent = new Map<string, PostVersionRecord[]>();
  for (const row of lineageResponse.data || []) {
    const version = mapCalendarLineageRowToVersion(row as Record<string, any>);
    const parentId = String((row as any).parent_post_id || (row as any).id || '');
    const bucket = versionsByParent.get(parentId) || [];
    bucket.push(version);
    versionsByParent.set(parentId, bucket);
  }

  return rows.map((row) => {
    const parentId = parentByRowId.get(String(row.id || '')) || String(row.id || '');
    const versions = versionsByParent.get(parentId) || [];
    return {
      ...row,
      parent_post_id: parentId,
      versions,
      current_version: getCurrentPostVersion(versions),
      previous_version: getPreviousPostVersion(versions),
      current_version_number: getCurrentPostVersion(versions)?.version_number ?? Number(row.version_number || 1) || 1,
    };
  });
};

const syncPostVersionRow = async (input: {
  postId: string;
  versionNumber: number;
  title?: string | null;
  description?: string | null;
  notes?: string | null;
  image_url?: string | null;
  video_url?: string | null;
  post_type?: string | null;
  label_color?: string | null;
  workflow_status?: string | null;
  approval_status?: string | null;
  day_number?: number | null;
  post_date?: string | null;
  created_by?: string | null;
  change_reason?: string | null;
  change_log?: string[];
}) => {
  const { error: clearCurrentError } = await supabase
    .from('post_versions')
    .update({ is_current: false })
    .eq('post_id', input.postId)
    .eq('is_current', true);

  if (clearCurrentError && !isMissingSchemaEntityError(clearCurrentError, 'post_versions')) {
    throw clearCurrentError;
  }

  const insertResponse = await supabase
    .from('post_versions')
    .insert({
      post_id: input.postId,
      version_number: input.versionNumber,
      title: input.title || null,
      content: buildPostVersionContent({
        description: input.description || null,
        notes: input.notes || null,
        image_url: input.image_url || null,
        video_url: input.video_url || null,
        post_type: input.post_type || null,
        label_color: input.label_color || null,
        workflow_status: input.workflow_status || null,
        approval_status: input.approval_status || null,
        day_number: input.day_number ?? null,
        post_date: input.post_date || null,
      }),
      created_by: input.created_by || null,
      change_reason: input.change_reason || null,
      change_log: input.change_log || [],
      is_current: true,
    })
    .select('id')
    .single();

  if (insertResponse.error) {
    if (isMissingSchemaEntityError(insertResponse.error, 'post_versions')) {
      return null;
    }
    if (isMissingSchemaEntityError(insertResponse.error, 'change_log')) {
      const fallbackResponse = await supabase
        .from('post_versions')
        .insert({
          post_id: input.postId,
          version_number: input.versionNumber,
          title: input.title || null,
          content: buildPostVersionContent({
            description: input.description || null,
            notes: input.notes || null,
            image_url: input.image_url || null,
            video_url: input.video_url || null,
            post_type: input.post_type || null,
            label_color: input.label_color || null,
            workflow_status: input.workflow_status || null,
            approval_status: input.approval_status || null,
            day_number: input.day_number ?? null,
            post_date: input.post_date || null,
          }),
          created_by: input.created_by || null,
          change_reason: input.change_reason || null,
          is_current: true,
        })
        .select('id')
        .single();

      if (fallbackResponse.error) throw fallbackResponse.error;
      return fallbackResponse.data?.id ? String(fallbackResponse.data.id) : null;
    }
    throw insertResponse.error;
  }

  return insertResponse.data?.id ? String(insertResponse.data.id) : null;
};

export const PostingCalendarService = {
  getPostVersionsMap: async (postIds: string[]) => {
    const rows = postIds.map((id) => ({ id }));
    const attached = await attachVersionsToRows(rows);
    return attached.reduce((map, row) => {
      map.set(String(row.id || ''), row.versions || []);
      return map;
    }, new Map<string, PostVersionRecord[]>());
  },

  saveCalendarItemVersioned: async (payload: {
    existingItem?: Record<string, any> | null;
    calendar_id: string;
    post_date: string;
    day_number: number;
    post_type: string;
    title?: string | null;
    description?: string | null;
    notes?: string | null;
    image_url?: string | null;
    video_url?: string | null;
    label_color?: string | null;
    workflow_status?: string | null;
    owner_role?: string | null;
    approval_status?: string | null;
    approval_notes?: string | null;
    actor_id?: string | null;
    change_reason?: string | null;
  }) => {
    const existingItem = payload.existingItem || null;
    const normalizedWorkflow =
      existingItem && normalizeWorkflowStatus(existingItem.workflow_status || 'rascunho') === 'revisao_cliente'
        ? 'revisao_interna'
        : normalizeWorkflowStatus(payload.workflow_status || existingItem?.workflow_status || 'rascunho');

    const changeReason = String(payload.change_reason || '').trim();
    if (existingItem?.id && !changeReason) {
      throw new Error('Informe o que mudou nesta nova versão antes de salvar.');
    }

    const changeLog = deriveChangeLogEntries(existingItem, {
      title: payload.title,
      description: payload.description,
      notes: payload.notes,
      image_url: payload.image_url,
      video_url: payload.video_url,
      post_type: payload.post_type,
      label_color: payload.label_color,
    });

    const basePayload: Record<string, unknown> = {
      calendar_id: payload.calendar_id,
      post_date: payload.post_date,
      day_number: payload.day_number,
      post_type: payload.post_type,
      title: payload.title || null,
      description: payload.description || null,
      notes: payload.notes || null,
      image_url: payload.image_url || null,
      video_url: payload.video_url || null,
      label_color: payload.label_color || null,
      workflow_status: normalizedWorkflow,
      owner_role: payload.owner_role || existingItem?.owner_role || null,
      owner_id: payload.actor_id || existingItem?.owner_id || null,
      approval_status: payload.approval_status || 'pending',
      approval_notes: payload.approval_notes || null,
      change_reason: existingItem?.id ? changeReason : 'Versao inicial',
      change_log: changeLog,
      is_current_version: true,
    };

    let postRow: Record<string, any> | null = null;
    let nextVersionNumber = 1;
    let previousVersionNumber: number | null = null;
    let parentPostId = existingItem?.parent_post_id || existingItem?.id || null;

    if (existingItem?.id) {
      previousVersionNumber = Number(existingItem.version_number || 1);
      nextVersionNumber = previousVersionNumber + 1;

      const { error: archiveError } = await supabase
        .from('posting_calendar_items')
        .update({
          is_current_version: false,
          superseded_at: new Date().toISOString(),
        })
        .eq('id', existingItem.id);

      if (archiveError && !isMissingSchemaEntityError(archiveError, 'is_current_version')) {
        throw archiveError;
      }

      let response = await supabase
        .from('posting_calendar_items')
        .insert({
          ...basePayload,
          parent_post_id: parentPostId,
          version_number: nextVersionNumber,
          revision_count: Number(existingItem.revision_count || 0) + 1,
          checklist_arte_ok: false,
          checklist_legenda_ok: false,
          approved_at: null,
          approved_by_name: null,
        })
        .select('*')
        .single();

      if (
        response.error &&
        (isMissingSchemaEntityError(response.error, 'approval_notes') ||
          isMissingSchemaEntityError(response.error, 'change_reason') ||
          isMissingSchemaEntityError(response.error, 'change_log') ||
          isMissingSchemaEntityError(response.error, 'is_current_version') ||
          isMissingSchemaEntityError(response.error, 'superseded_at') ||
          isMissingSchemaEntityError(response.error, 'parent_post_id') ||
          isMissingSchemaEntityError(response.error, 'version_number'))
      ) {
        const {
          approval_notes,
          change_reason,
          change_log,
          is_current_version,
          parent_post_id: fallbackParentId,
          version_number,
          ...fallbackPayload
        } = {
          ...basePayload,
          parent_post_id: parentPostId,
          version_number: nextVersionNumber,
        };

        response = await supabase
          .from('posting_calendar_items')
          .update({
            ...fallbackPayload,
            revision_count: Number(existingItem.revision_count || 0) + 1,
          })
          .eq('id', existingItem.id)
          .select('*')
          .single();
      }

      if (response.error) throw response.error;
      postRow = response.data as Record<string, any>;
    } else {
      let response = await supabase
        .from('posting_calendar_items')
        .insert({
          ...basePayload,
          version_number: 1,
          revision_count: 0,
          checklist_arte_ok: false,
          checklist_legenda_ok: false,
        })
        .select('*')
        .single();

      if (
        response.error &&
        (isMissingSchemaEntityError(response.error, 'approval_notes') ||
          isMissingSchemaEntityError(response.error, 'change_reason') ||
          isMissingSchemaEntityError(response.error, 'change_log') ||
          isMissingSchemaEntityError(response.error, 'is_current_version') ||
          isMissingSchemaEntityError(response.error, 'version_number'))
      ) {
        const {
          approval_notes,
          change_reason,
          change_log,
          is_current_version,
          version_number,
          ...fallbackPayload
        } = {
          ...basePayload,
          version_number: 1,
        };

        response = await supabase
          .from('posting_calendar_items')
          .insert({
            ...fallbackPayload,
            revision_count: 0,
            checklist_arte_ok: false,
            checklist_legenda_ok: false,
          })
          .select('*')
          .single();
      }

      if (response.error) throw response.error;
      postRow = response.data as Record<string, any>;
      parentPostId = String(postRow.id || '');

      const { error: linkParentError } = await supabase
        .from('posting_calendar_items')
        .update({ parent_post_id: parentPostId })
        .eq('id', parentPostId);

      if (linkParentError && !isMissingSchemaEntityError(linkParentError, 'parent_post_id')) {
        throw linkParentError;
      }
    }

    const postId = String(postRow?.id || '');
    if (!postId) {
      throw new Error('Nao foi possivel determinar o post salvo.');
    }

    const versionRecordId = await syncPostVersionRow({
      postId,
      versionNumber: nextVersionNumber,
      title: postRow.title || null,
      description: postRow.description || null,
      notes: postRow.notes || null,
      image_url: postRow.image_url || null,
      video_url: postRow.video_url || null,
      post_type: postRow.post_type || null,
      label_color: postRow.label_color || null,
      workflow_status: postRow.workflow_status || normalizedWorkflow,
      approval_status: postRow.approval_status || 'pending',
      day_number: postRow.day_number || null,
      post_date: postRow.post_date || null,
      created_by: payload.actor_id || null,
      change_reason: existingItem?.id ? changeReason : 'Versao inicial',
      change_log: changeLog,
    });

    if (versionRecordId) {
      const { error: linkVersionError } = await supabase
        .from('posting_calendar_items')
        .update({ current_version_id: versionRecordId })
        .eq('id', postId);

      if (linkVersionError && !isMissingSchemaEntityError(linkVersionError, 'current_version_id')) {
        throw linkVersionError;
      }
    }

    try {
      await supabase.from('post_logs').insert({
        post_id: postId,
        action: existingItem?.id ? 'edit' : 'create',
        from_version: previousVersionNumber,
        to_version: nextVersionNumber,
        user_role: payload.owner_role || null,
        owner_role: payload.owner_role || null,
        changed_by: payload.actor_id || null,
        from_status: existingItem?.workflow_status || null,
        to_status: normalizedWorkflow,
        metadata: {
          parent_post_id: parentPostId,
          change_reason: changeReason || null,
          change_log: changeLog,
          current_version_id: versionRecordId || null,
        },
      });
    } catch (logError) {
      console.warn('Falha ao registrar versao do post:', logError);
    }

    const [enrichedRow] = await attachVersionsToRows([postRow]);
    return enrichedRow;
  },

  getResolvedTemplate: async () => {
    const storedLegend = await getSettingValue(POSTING_CALENDAR_LEGEND_SETTING_KEY);
    const legendItems = normalizeLegendItems(
      (storedLegend as { legend_items?: unknown })?.legend_items || storedLegend
    );
    return {
      template: normalizePostingCalendarTemplateConfig({
        ...DEFAULT_POSTING_CALENDAR_TEMPLATE,
        id: DEFAULT_TEMPLATE_ID,
        slug: 'default',
        scope: 'default',
        client_id: null,
        version: 1,
        legend_items: legendItems,
      }),
    };
  },

  saveTemplate: async (payload: {
    template: PostingCalendarTemplateConfig;
  }) => {
    const normalized = normalizePostingCalendarTemplateConfig(payload.template);
    const nextLegendItems = normalizeLegendItems(normalized.legend_items);
    await saveSettingValue(POSTING_CALENDAR_LEGEND_SETTING_KEY, { legend_items: nextLegendItems });
    return PostingCalendarService.getResolvedTemplate();
  },

  getOrCreateCalendar: async (
    clientId: string,
    month: number,
    year: number
  ) => {
    const monthNumber = month + 1;
    const { data: existing } = await supabase
      .from('posting_calendars')
      .select('*')
      .eq('client_id', clientId)
      .eq('month', monthNumber)
      .eq('year', year)
      .maybeSingle();

    if (existing) return existing;

    const user = await getCurrentUser();

    const { data, error } = await supabase
      .from('posting_calendars')
      .insert({
        client_id: clientId,
        month: monthNumber,
        year,
        status: 'draft',
        created_by: user.id,
      })
      .select()
      .single();

    if (error) throw error;

    return data;
  },

  getCalendarItems: async (calendarId: string) => {
    const buildBaseQuery = () =>
      supabase
        .from('posting_calendar_items')
        .select('*')
        .eq('calendar_id', calendarId)
        .order('day_number', { ascending: true });

    let response = await buildBaseQuery().is('deleted_at', null);
    if (response.error && isMissingSchemaEntityError(response.error, 'deleted_at')) {
      response = await buildBaseQuery();
    }
    if (response.error) throw response.error;

    let rows = (response.data || []) as Record<string, any>[];

    try {
      rows = rows.filter((row) => row.is_current_version !== false);
    } catch {
      // schema legado sem is_current_version
    }

    return attachVersionsToRows(rows);
  },

  getRecords: async (clientId: string, month?: number, year?: number) => {
    const targetMonth = typeof month === 'number' ? month : new Date().getMonth();
    const targetYear = typeof year === 'number' ? year : new Date().getFullYear();
    const calendar = await PostingCalendarService.getOrCreateCalendar(clientId, targetMonth, targetYear);
    const items = await PostingCalendarService.getCalendarItems(String((calendar as { id: string }).id));
    return { calendar, items };
  },

  getByClientAndDateRange: async (clientId: string, startDate: Date, endDate: Date) => {
    const normalizedStart = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
    const normalizedEnd = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 23, 59, 59, 999);
    const startIso = normalizedStart.toISOString().slice(0, 10);
    const endIso = normalizedEnd.toISOString().slice(0, 10);

    const buildBaseQuery = () =>
      supabase
        .from('posting_calendar_items')
        .select(
          `
            *,
            posting_calendars!inner(client_id)
          `
        )
        .eq('posting_calendars.client_id', clientId)
        .gte('post_date', startIso)
        .lte('post_date', endIso)
        .order('post_date', { ascending: true });

    let response = await buildBaseQuery().is('deleted_at', null);
    if (response.error && isMissingSchemaEntityError(response.error, 'deleted_at')) {
      response = await buildBaseQuery();
    }
    if (response.error) throw response.error;

    let rows = (response.data || []) as Array<Record<string, any>>;

    try {
      rows = rows.filter((row) => row.is_current_version !== false);
    } catch {
      // schema legado sem is_current_version
    }

    return attachVersionsToRows(rows);
  },
};
