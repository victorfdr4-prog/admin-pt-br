export interface PostVersionContent {
  description: string | null;
  notes: string | null;
  image_url: string | null;
  video_url: string | null;
  post_type: string | null;
  label_color: string | null;
  workflow_status: string | null;
  approval_status: string | null;
  day_number: number | null;
  post_date: string | null;
}

export interface PostVersionRecord {
  id: string;
  post_id: string;
  version_number: number;
  title: string | null;
  content: PostVersionContent;
  created_by: string | null;
  created_at: string;
  change_reason: string | null;
  change_log: string[];
  is_current: boolean;
}

export const normalizeChangeLog = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .map((entry) => String(entry || '').trim())
      .filter(Boolean);
  }

  if (typeof value === 'string' && value.trim()) {
    return [value.trim()];
  }

  return [];
};

const EMPTY_CONTENT: PostVersionContent = {
  description: null,
  notes: null,
  image_url: null,
  video_url: null,
  post_type: null,
  label_color: null,
  workflow_status: null,
  approval_status: null,
  day_number: null,
  post_date: null,
};

export const normalizePostVersionContent = (value: unknown): PostVersionContent => {
  if (!value || typeof value !== 'object') {
    return { ...EMPTY_CONTENT };
  }

  const record = value as Record<string, unknown>;
  return {
    description: typeof record.description === 'string' ? record.description : null,
    notes: typeof record.notes === 'string' ? record.notes : null,
    image_url: typeof record.image_url === 'string' ? record.image_url : null,
    video_url: typeof record.video_url === 'string' ? record.video_url : null,
    post_type: typeof record.post_type === 'string' ? record.post_type : null,
    label_color: typeof record.label_color === 'string' ? record.label_color : null,
    workflow_status: typeof record.workflow_status === 'string' ? record.workflow_status : null,
    approval_status: typeof record.approval_status === 'string' ? record.approval_status : null,
    day_number: typeof record.day_number === 'number' ? record.day_number : null,
    post_date: typeof record.post_date === 'string' ? record.post_date : null,
  };
};

export const mapPostVersionRow = (row: Record<string, unknown>): PostVersionRecord => ({
  id: String(row.id || ''),
  post_id: String(row.post_id || ''),
  version_number: Number(row.version_number || 0),
  title: typeof row.title === 'string' ? row.title : null,
  content: normalizePostVersionContent(row.content),
  created_by: typeof row.created_by === 'string' ? row.created_by : null,
  created_at: String(row.created_at || ''),
  change_reason: typeof row.change_reason === 'string' ? row.change_reason : null,
  change_log: normalizeChangeLog(row.change_log),
  is_current: row.is_current === true,
});

export const getCurrentPostVersion = (versions: PostVersionRecord[] = []) =>
  versions.find((version) => version.is_current) || versions[0] || null;

export const getPreviousPostVersion = (versions: PostVersionRecord[] = []) => {
  const current = getCurrentPostVersion(versions);
  return versions.find((version) => version.id !== current?.id) || null;
};

export const buildVersionDiffLabels = (
  currentVersion: PostVersionRecord | null | undefined,
  previousVersion: PostVersionRecord | null | undefined
) => {
  if (!currentVersion) return [];
  if (currentVersion.change_log?.length) return currentVersion.change_log;
  if (!previousVersion) return ['Versao inicial registrada'];

  const changes: string[] = [];
  if ((currentVersion.title || '') !== (previousVersion.title || '')) {
    changes.push('Titulo atualizado');
  }
  if ((currentVersion.content.description || '') !== (previousVersion.content.description || '')) {
    changes.push('Texto atualizado');
  }
  if ((currentVersion.content.image_url || '') !== (previousVersion.content.image_url || '')) {
    changes.push('Nova imagem aplicada');
  }
  if ((currentVersion.content.video_url || '') !== (previousVersion.content.video_url || '')) {
    changes.push('Video ajustado');
  }
  if ((currentVersion.content.notes || '') !== (previousVersion.content.notes || '')) {
    changes.push('Observacoes internas revisadas');
  }
  if ((currentVersion.content.post_type || '') !== (previousVersion.content.post_type || '')) {
    changes.push('Categoria ajustada');
  }

  return changes.length > 0 ? changes : ['Ajustes internos registrados'];
};

export const buildPostVersionContent = (input: {
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
}) => ({
  description: input.description ?? null,
  notes: input.notes ?? null,
  image_url: input.image_url ?? null,
  video_url: input.video_url ?? null,
  post_type: input.post_type ?? null,
  label_color: input.label_color ?? null,
  workflow_status: input.workflow_status ?? null,
  approval_status: input.approval_status ?? null,
  day_number: input.day_number ?? null,
  post_date: input.post_date ?? null,
});
