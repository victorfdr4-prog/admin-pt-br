import { getSettingValue, saveSettingValue } from './_shared';

export const KanbanService = {
  getColumns: async (clientId?: string) => {
    const key = clientId ? `kanban_pipeline_client_${clientId}` : 'kanban_pipeline';
    const settings = await getSettingValue(key);

    if (clientId && !Array.isArray(settings?.columns)) {
      const fallback = await getSettingValue('kanban_pipeline');
      return Array.isArray(fallback?.columns) ? fallback.columns : [];
    }

    return Array.isArray(settings?.columns) ? settings.columns : [];
  },

  updateColumns: async (columns: Array<{ id: string; title: string; color?: string }>, clientId?: string) => {
    const key = clientId ? `kanban_pipeline_client_${clientId}` : 'kanban_pipeline';
    const current = await getSettingValue(key);
    const normalized = columns.map((column, index) => ({
      id: String(column.id || `col-${index + 1}`),
      title: String(column.title || `Coluna ${index + 1}`),
      color: String(column.color || '#475569'),
      order: index + 1,
    }));

    await saveSettingValue(key, {
      ...current,
      client_id: clientId || null,
      columns: normalized,
    });

    return normalized;
  },

  updateGlobalColumns: async (columns: Array<{ id: string; title: string; color?: string }>) => {
    return KanbanService.updateColumns(columns);
  },
};
