export type BoardViewMode = 'table' | 'kanban';

export interface BrandingConfig {
  agency_name: string;
  primary_color: string;
  logo_url: string;
}

export interface PipelineColumn {
  id: string;
  title: string;
  color: string;
  order: number;
}

export type BoardTableColumnId =
  | 'task'
  | 'assignee'
  | 'due_date'
  | 'estimated_minutes'
  | 'activity_type'
  | 'priority'
  | 'status'
  | 'stage'
  | 'updated_at';

export interface BoardTableColumnLayout {
  id: BoardTableColumnId;
  label: string;
  visible: boolean;
  client_visible: boolean;
  order: number;
  width?: number;
}

export interface GoogleDriveConfig {
  folder_pattern: string;
  uppercase: boolean;
  ramo_fallback: string;
  fallback_folder: string;
  subfolders: string[];
  extension_rules: Record<string, string>;
}

export type PostingCalendarTemplateScope = 'default' | 'client';
export type PostingCalendarLogoSource = 'branding' | 'client' | 'none';

export interface PostingCalendarLegendItem {
  id: string;
  label: string;
  color: string;
  textColor: string;
  visible: boolean;
}

export interface PostingCalendarTemplateVisibility {
  show_sidebar: boolean;
  show_sidebar_title: boolean;
  show_legend: boolean;
  show_logo: boolean;
  show_client_name: boolean;
  show_month: boolean;
  show_year: boolean;
  show_weekdays: boolean;
}

export interface PostingCalendarTemplateLayout {
  outer_padding: number;
  outer_radius: number;
  outer_gap: number;
  sidebar_width: number;
  sidebar_padding: number;
  panel_radius: number;
  day_cell_radius: number;
  day_cell_min_height: number;
  month_font_size: number;
  year_font_size: number;
  weekday_font_size: number;
  vertical_title_font_size: number;
  day_number_font_size: number;
  legend_spacing: number;
}

export interface PostingCalendarTemplateTheme {
  canvas_background: string;
  shell_background: string;
  sidebar_background: string;
  border_color: string;
  text_color: string;
  muted_text_color: string;
  weekday_color: string;
  inactive_day_color: string;
  day_cell_background: string;
  day_cell_border_color: string;
  logo_background: string;
}

export interface PostingCalendarTemplateConfig {
  id: string;
  name: string;
  slug: string;
  scope: PostingCalendarTemplateScope;
  client_id: string | null;
  reference_image_url: string | null;
  sidebar_title: string;
  logo_source: PostingCalendarLogoSource;
  status: 'draft' | 'active';
  version: number;
  legend_items: PostingCalendarLegendItem[];
  visibility: PostingCalendarTemplateVisibility;
  layout: PostingCalendarTemplateLayout;
  theme: PostingCalendarTemplateTheme;
}

export interface PostingCalendarTemplateRegistry {
  default: PostingCalendarTemplateConfig;
  clients: Record<string, PostingCalendarTemplateConfig>;
}

export type DashboardBlockId = 'focus' | 'attention' | 'pulse' | 'activity';

export interface DashboardBlockConfig {
  id: DashboardBlockId;
  title: string;
  visible: boolean;
  order: number;
}

export interface OperationalRuleConfig {
  key: string;
  label: string;
  enabled: boolean;
  threshold?: number;
  description?: string;
}

export const DEFAULT_BRANDING: BrandingConfig = {
  agency_name: 'Cromia Comunicação',
  primary_color: '#4F7DF3',
  logo_url: '',
};

export const DEFAULT_PLANS_CATALOG = ['Gestão de Conteúdo Mensal', 'Campanha de Performance', 'Cobertura de Evento'];

export const DEFAULT_PIPELINE_COLUMNS: PipelineColumn[] = [
  { id: 'todo', title: 'Entrada', color: '#94a3b8', order: 1 },
  { id: 'in-progress', title: 'Em execução', color: '#fdab3d', order: 2 },
  { id: 'stuck', title: 'Bloqueado', color: '#e2445c', order: 3 },
  { id: 'done', title: 'Concluído', color: '#00c875', order: 4 },
];

export const DEFAULT_BOARD_TABLE_COLUMNS: BoardTableColumnLayout[] = [
  { id: 'task', label: 'Nome', visible: true, client_visible: true, order: 1, width: 420 },
  { id: 'assignee', label: 'Responsável', visible: true, client_visible: true, order: 2, width: 78 },
  { id: 'due_date', label: 'Data de conclusão', visible: true, client_visible: true, order: 3, width: 136 },
  { id: 'estimated_minutes', label: 'Duração est.', visible: true, client_visible: true, order: 4, width: 118 },
  { id: 'activity_type', label: 'Tipo de atividade', visible: true, client_visible: true, order: 5, width: 152 },
  { id: 'priority', label: 'Prioridade', visible: true, client_visible: true, order: 6, width: 124 },
  { id: 'status', label: 'Status', visible: true, client_visible: true, order: 7, width: 128 },
  { id: 'stage', label: 'Estágio', visible: true, client_visible: true, order: 8, width: 128 },
  { id: 'updated_at', label: 'Atualização', visible: true, client_visible: true, order: 9, width: 116 },
];

export const DEFAULT_GOOGLE_DRIVE: GoogleDriveConfig = {
  folder_pattern: '[CROMIA]_{cliente}_{ramo}',
  uppercase: true,
  ramo_fallback: 'GERAL',
  fallback_folder: '00_OUTROS',
  subfolders: ['00_OUTROS', '01_LOGO', '02_FOTOS', '03_EDITAVEIS', '04_CONTRATOS', '05_ANUNCIOS', '06_AUDIO'],
  extension_rules: {
    pdf: '04_CONTRATOS',
    doc: '04_CONTRATOS',
    docx: '04_CONTRATOS',
    xls: '04_CONTRATOS',
    xlsx: '04_CONTRATOS',
    ppt: '04_CONTRATOS',
    pptx: '04_CONTRATOS',
    ai: '01_LOGO',
    eps: '01_LOGO',
    svg: '01_LOGO',
    cdr: '01_LOGO',
    jpg: '02_FOTOS',
    jpeg: '02_FOTOS',
    png: '02_FOTOS',
    webp: '02_FOTOS',
    raw: '02_FOTOS',
    heic: '02_FOTOS',
    mp4: '05_ANUNCIOS',
    mov: '05_ANUNCIOS',
    avi: '05_ANUNCIOS',
    mkv: '05_ANUNCIOS',
    mp3: '06_AUDIO',
    wav: '06_AUDIO',
    psd: '03_EDITAVEIS',
    fig: '03_EDITAVEIS',
    xd: '03_EDITAVEIS',
  },
};

export const DEFAULT_POSTING_CALENDAR_TEMPLATE: PostingCalendarTemplateConfig = {
  id: 'posting-calendar-classic',
  name: 'Operacional',
  slug: 'operacional',
  scope: 'default',
  client_id: null,
  reference_image_url: null,
  sidebar_title: 'CALENDARIO DE CONTEUDO',
  logo_source: 'branding',
  status: 'active',
  version: 1,
  legend_items: [
    { id: 'events', label: 'EVENTOS', color: '#cfd9ff', textColor: '#27354d', visible: true },
    { id: 'video-influencer', label: 'VÍDEO / INFLUENCIADOR', color: '#f8edb8', textColor: '#574b12', visible: true },
    { id: 'feed', label: 'FEED / STORIES', color: '#cfecc5', textColor: '#294229', visible: true },
    { id: 'reels', label: 'REELS', color: '#f8cccc', textColor: '#652f2f', visible: true },
    { id: 'important', label: 'IMPORTANTE', color: '#d2e6f5', textColor: '#29495c', visible: true },
  ],
  visibility: {
    show_sidebar: true,
    show_sidebar_title: true,
    show_legend: true,
    show_logo: true,
    show_client_name: false,
    show_month: true,
    show_year: true,
    show_weekdays: true,
  },
  layout: {
    outer_padding: 28,
    outer_radius: 32,
    outer_gap: 24,
    sidebar_width: 264,
    sidebar_padding: 20,
    panel_radius: 24,
    day_cell_radius: 20,
    day_cell_min_height: 112,
    month_font_size: 72,
    year_font_size: 56,
    weekday_font_size: 15,
    vertical_title_font_size: 24,
    day_number_font_size: 16,
    legend_spacing: 12,
  },
  theme: {
    canvas_background: '#f4f1eb',
    shell_background: '#f4f1eb',
    sidebar_background: '#ffffff',
    border_color: '#d7d2c9',
    text_color: '#3f3533',
    muted_text_color: '#8f8a82',
    weekday_color: '#3f3533',
    inactive_day_color: '#b8b3ab',
    day_cell_background: '#ffffff',
    day_cell_border_color: '#ede8df',
    logo_background: '#ffffff',
  },
};

export const DEFAULT_POSTING_CALENDAR_TEMPLATE_REGISTRY: PostingCalendarTemplateRegistry = {
  default: DEFAULT_POSTING_CALENDAR_TEMPLATE,
  clients: {},
};

export const DEFAULT_DASHBOARD_BLOCKS: DashboardBlockConfig[] = [
  { id: 'focus', title: 'Foco do dia', visible: true, order: 1 },
  { id: 'attention', title: 'Requer atenção', visible: true, order: 2 },
  { id: 'pulse', title: 'Pulso do sistema', visible: true, order: 3 },
  { id: 'activity', title: 'Atividade recente', visible: true, order: 4 },
];

export const DEFAULT_OPERATIONAL_RULES: OperationalRuleConfig[] = [
  {
    key: 'overdue_focus',
    label: 'Priorizar tarefas atrasadas',
    enabled: true,
    threshold: 1,
    description: 'Coloca o foco do dashboard sempre nas tarefas vencidas antes das demais.',
  },
  {
    key: 'client_health_attention',
    label: 'Alerta de saúde do cliente',
    enabled: true,
    threshold: 40,
    description: 'Marca cliente como atenção quando a saúde operacional cair abaixo desse patamar.',
  },
  {
    key: 'idle_activity',
    label: 'Sinal de inatividade',
    enabled: true,
    threshold: 60,
    description: 'Destaca clientes sem atualização recente acima do limite configurado.',
  },
];

export const normalizeDashboardBlocks = (value: unknown): DashboardBlockConfig[] => {
  const source = Array.isArray(value)
    ? value
    : value && typeof value === 'object' && Array.isArray((value as { blocks?: unknown }).blocks)
      ? ((value as { blocks?: unknown }).blocks as unknown[])
      : [];

  const mapped = source
    .map((item, index) => {
      if (!item || typeof item !== 'object') return null;
      const record = item as Partial<DashboardBlockConfig>;
      const fallback = DEFAULT_DASHBOARD_BLOCKS.find((block) => block.id === record.id);
      if (!fallback) return null;

      return {
        id: fallback.id,
        title: String(record.title || fallback.title),
        visible: record.visible !== false,
        order: Number(record.order || index + 1),
      } satisfies DashboardBlockConfig;
    })
    .filter((item): item is DashboardBlockConfig => Boolean(item));

  return DEFAULT_DASHBOARD_BLOCKS.map((fallback, index) => {
    const current = mapped.find((item) => item.id === fallback.id);
    return current ? { ...fallback, ...current } : { ...fallback, order: index + 1 };
  }).sort((left, right) => left.order - right.order);
};

export const normalizeOperationalRules = (value: unknown): OperationalRuleConfig[] => {
  const source = Array.isArray(value)
    ? value
    : value && typeof value === 'object' && Array.isArray((value as { rules?: unknown }).rules)
      ? ((value as { rules?: unknown }).rules as unknown[])
      : [];

  const mapped = source
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const record = item as Partial<OperationalRuleConfig> & { key?: unknown };
      const key = String(record.key || '').trim();
      if (!key) return null;

      const fallback = DEFAULT_OPERATIONAL_RULES.find((rule) => rule.key === key);
      const normalized: OperationalRuleConfig = {
        key,
        label: String(record.label || fallback?.label || key),
        enabled: record.enabled !== false,
        description: String(record.description || fallback?.description || ''),
      };

      if (typeof record.threshold === 'number') {
        normalized.threshold = record.threshold;
      } else if (typeof fallback?.threshold === 'number') {
        normalized.threshold = fallback.threshold;
      }

      return normalized;
    })
    .filter((item): item is OperationalRuleConfig => Boolean(item));

  const fallbackRules = DEFAULT_OPERATIONAL_RULES.filter(
    (rule) => !mapped.some((item) => item.key === rule.key)
  );

  return [...mapped, ...fallbackRules].sort((left, right) => left.label.localeCompare(right.label, 'pt-BR', { sensitivity: 'base' }));
};

export const CONFIGURABLE_SETTING_KEYS = [
  'branding',
  'plans_catalog',
  'kanban_pipeline',
  'board_table_columns',
  'board_view_preferences',
  'google_drive',
  'login_jokes',
  'dashboard_blocks',
  'dashboard_rules',
  'posting_calendar_templates',
] as const;

export const CLIENT_OVERRIDE_SETTING_KEYS = [
  'kanban_pipeline_client_',
  'board_table_columns_client_',
  'portal_config_client_',
  'google_drive_client_',
] as const;

export const slugify = (value: string) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export const titleCase = (value: string) =>
  String(value || '')
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((token) => `${token.charAt(0).toUpperCase()}${token.slice(1).toLowerCase()}`)
    .join(' ');

export const sortUniqueStrings = (items: string[]) =>
  Array.from(new Set(items.map((item) => item.trim()).filter(Boolean))).sort((left, right) =>
    left.localeCompare(right, 'pt-BR', { sensitivity: 'base' })
  );

export const normalizeDriveText = (item: unknown) => {
  if (typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean') {
    const cleaned = String(item).trim();
    if (
      !cleaned ||
      cleaned === '[object Object]' ||
      cleaned === '[object Undefined]' ||
      cleaned === '[object Null]'
    ) {
      return '';
    }
    return cleaned.toUpperCase() === '06_OUTROS' ? '00_OUTROS' : cleaned;
  }

  if (item && typeof item === 'object') {
    const record = item as Record<string, unknown>;
    const candidate =
      record.name ??
      record.label ??
      record.title ??
      record.value ??
      record.folder ??
      record.path ??
      record.key ??
      record.text;

    if (typeof candidate === 'string' || typeof candidate === 'number' || typeof candidate === 'boolean') {
      const cleaned = String(candidate).trim();
      if (
        !cleaned ||
        cleaned === '[object Object]' ||
        cleaned === '[object Undefined]' ||
        cleaned === '[object Null]'
      ) {
        return '';
      }
      return cleaned.toUpperCase() === '06_OUTROS' ? '00_OUTROS' : cleaned;
    }
  }

  return '';
};

export const stringifyExtensionRules = (rules: Record<string, string>) =>
  Object.entries(rules)
    .sort(([left], [right]) => left.localeCompare(right, 'pt-BR'))
    .map(([extension, folder]) => `${extension}=${folder}`)
    .join('\n');

export const parseExtensionRules = (value: string) => {
  const rules: Record<string, string> = {};
  value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      const [extensionRaw, folderRaw] = line.split('=');
      const extension = String(extensionRaw || '').trim().toLowerCase();
      const folder = String(folderRaw || '').trim();
      if (extension && folder) rules[extension] = folder;
    });
  return rules;
};

export const normalizeBrandingConfig = (value: unknown): BrandingConfig => {
  if (!value || typeof value !== 'object') return DEFAULT_BRANDING;
  const source = value as Partial<BrandingConfig>;
  return {
    agency_name: String(source.agency_name || DEFAULT_BRANDING.agency_name),
    primary_color: String(source.primary_color || DEFAULT_BRANDING.primary_color),
    logo_url: String(source.logo_url || ''),
  };
};

const normalizePostingCalendarLegendItem = (
  value: unknown,
  fallback: PostingCalendarLegendItem,
  index: number
): PostingCalendarLegendItem => {
  if (!value || typeof value !== 'object') {
    return { ...fallback, id: fallback.id || `legend-${index + 1}` };
  }

  const source = value as Partial<PostingCalendarLegendItem>;
  return {
    id: String(source.id || fallback.id || `legend-${index + 1}`),
    label: String(source.label || fallback.label),
    color: String(source.color || fallback.color),
    textColor: String(source.textColor || fallback.textColor),
    visible: source.visible !== false,
  };
};

export const normalizePostingCalendarTemplateConfig = (
  value: unknown,
  fallback: PostingCalendarTemplateConfig = DEFAULT_POSTING_CALENDAR_TEMPLATE
): PostingCalendarTemplateConfig => {
  if (!value || typeof value !== 'object') {
    return {
      ...fallback,
      legend_items: fallback.legend_items.map((item) => ({ ...item })),
      visibility: { ...fallback.visibility },
      layout: { ...fallback.layout },
      theme: { ...fallback.theme },
    };
  }

  const source = value as Partial<PostingCalendarTemplateConfig> & {
    layout?: Partial<PostingCalendarTemplateLayout>;
    theme?: Partial<PostingCalendarTemplateTheme>;
    visibility?: Partial<PostingCalendarTemplateVisibility>;
    legend_items?: unknown[];
  };

  const legendSource = Array.isArray(source.legend_items) ? source.legend_items : fallback.legend_items;
  const normalizedLegend = legendSource.map((item, index) =>
    normalizePostingCalendarLegendItem(item, fallback.legend_items[index] || fallback.legend_items[0], index)
  );

  return {
    id: String(source.id || fallback.id),
    name: String(source.name || fallback.name),
    slug: String(source.slug || fallback.slug),
    scope: source.scope === 'client' ? 'client' : 'default',
    client_id: source.client_id ? String(source.client_id) : null,
    reference_image_url: source.reference_image_url ? String(source.reference_image_url) : null,
    sidebar_title: String(source.sidebar_title || fallback.sidebar_title),
    logo_source:
      source.logo_source === 'client' || source.logo_source === 'none'
        ? source.logo_source
        : fallback.logo_source,
    status: source.status === 'draft' ? 'draft' : 'active',
    version: Number(source.version || fallback.version || 1),
    legend_items: normalizedLegend.length
      ? normalizedLegend
      : fallback.legend_items.map((item) => ({ ...item })),
    visibility: {
      show_sidebar: source.visibility?.show_sidebar !== false,
      show_sidebar_title: source.visibility?.show_sidebar_title !== false,
      show_legend: source.visibility?.show_legend !== false,
      show_logo: source.visibility?.show_logo !== false,
      show_client_name: source.visibility?.show_client_name === true,
      show_month: source.visibility?.show_month !== false,
      show_year: source.visibility?.show_year !== false,
      show_weekdays: source.visibility?.show_weekdays !== false,
    },
    layout: {
      outer_padding: Number(source.layout?.outer_padding || fallback.layout.outer_padding),
      outer_radius: Number(source.layout?.outer_radius || fallback.layout.outer_radius),
      outer_gap: Number(source.layout?.outer_gap || fallback.layout.outer_gap),
      sidebar_width: Number(source.layout?.sidebar_width || fallback.layout.sidebar_width),
      sidebar_padding: Number(source.layout?.sidebar_padding || fallback.layout.sidebar_padding),
      panel_radius: Number(source.layout?.panel_radius || fallback.layout.panel_radius),
      day_cell_radius: Number(source.layout?.day_cell_radius || fallback.layout.day_cell_radius),
      day_cell_min_height: Number(source.layout?.day_cell_min_height || fallback.layout.day_cell_min_height),
      month_font_size: Number(source.layout?.month_font_size || fallback.layout.month_font_size),
      year_font_size: Number(source.layout?.year_font_size || fallback.layout.year_font_size),
      weekday_font_size: Number(source.layout?.weekday_font_size || fallback.layout.weekday_font_size),
      vertical_title_font_size: Number(
        source.layout?.vertical_title_font_size || fallback.layout.vertical_title_font_size
      ),
      day_number_font_size: Number(source.layout?.day_number_font_size || fallback.layout.day_number_font_size),
      legend_spacing: Number(source.layout?.legend_spacing || fallback.layout.legend_spacing),
    },
    theme: {
      canvas_background: String(source.theme?.canvas_background || fallback.theme.canvas_background),
      shell_background: String(source.theme?.shell_background || fallback.theme.shell_background),
      sidebar_background: String(source.theme?.sidebar_background || fallback.theme.sidebar_background),
      border_color: String(source.theme?.border_color || fallback.theme.border_color),
      text_color: String(source.theme?.text_color || fallback.theme.text_color),
      muted_text_color: String(source.theme?.muted_text_color || fallback.theme.muted_text_color),
      weekday_color: String(source.theme?.weekday_color || fallback.theme.weekday_color),
      inactive_day_color: String(source.theme?.inactive_day_color || fallback.theme.inactive_day_color),
      day_cell_background: String(source.theme?.day_cell_background || fallback.theme.day_cell_background),
      day_cell_border_color: String(
        source.theme?.day_cell_border_color || fallback.theme.day_cell_border_color
      ),
      logo_background: String(source.theme?.logo_background || fallback.theme.logo_background),
    },
  };
};

export const normalizePostingCalendarTemplateRegistry = (value: unknown): PostingCalendarTemplateRegistry => {
  if (!value || typeof value !== 'object') {
    return {
      default: normalizePostingCalendarTemplateConfig(DEFAULT_POSTING_CALENDAR_TEMPLATE),
      clients: {},
    };
  }

  const source = value as {
    default?: unknown;
    clients?: Record<string, unknown>;
  };

  const clients = Object.entries(source.clients || {}).reduce<Record<string, PostingCalendarTemplateConfig>>(
    (acc, [clientId, template]) => {
      acc[clientId] = normalizePostingCalendarTemplateConfig(template, {
        ...DEFAULT_POSTING_CALENDAR_TEMPLATE,
        id: `posting-calendar-client-${clientId}`,
        name: DEFAULT_POSTING_CALENDAR_TEMPLATE.name,
        slug: DEFAULT_POSTING_CALENDAR_TEMPLATE.slug,
        scope: 'client',
        client_id: clientId,
      });
      return acc;
    },
    {}
  );

  return {
    default: normalizePostingCalendarTemplateConfig(source.default, DEFAULT_POSTING_CALENDAR_TEMPLATE),
    clients,
  };
};

export const normalizePlansCatalog = (value: unknown): string[] => {
  const source = Array.isArray(value)
    ? value
    : value && typeof value === 'object' && Array.isArray((value as { plans?: unknown }).plans)
      ? ((value as { plans?: unknown }).plans as unknown[])
      : [];

  const unique = new Map<string, string>();
  source.forEach((item) => {
    const plan = String(item).trim();
    if (!plan) return;
    const key = plan.toLowerCase();
    if (!unique.has(key)) {
      unique.set(key, plan);
    }
  });

  return Array.from(unique.values()).sort((left, right) => left.localeCompare(right, 'pt-BR', { sensitivity: 'base' }));
};

export const normalizeGoogleDriveConfig = (value: unknown): GoogleDriveConfig => {
  if (!value || typeof value !== 'object') return DEFAULT_GOOGLE_DRIVE;
  const source = value as Partial<GoogleDriveConfig>;
  const subfolders = sortUniqueStrings(
    Array.isArray(source.subfolders) ? source.subfolders.map((item) => normalizeDriveText(item)) : DEFAULT_GOOGLE_DRIVE.subfolders
  );
  const extensionRules =
    source.extension_rules && typeof source.extension_rules === 'object'
      ? Object.entries(source.extension_rules as Record<string, unknown>).reduce<Record<string, string>>((acc, [key, folder]) => {
          const extension = String(key || '').trim().toLowerCase();
          const folderName = normalizeDriveText(folder);
          if (extension && folderName) acc[extension] = folderName;
          return acc;
        }, {})
      : DEFAULT_GOOGLE_DRIVE.extension_rules;
  const orderedExtensionRules = Object.fromEntries(
    Object.entries(extensionRules).sort(([left], [right]) => left.localeCompare(right, 'pt-BR', { sensitivity: 'base' }))
  );

  return {
    folder_pattern: String(source.folder_pattern || DEFAULT_GOOGLE_DRIVE.folder_pattern),
    uppercase: source.uppercase !== false,
    ramo_fallback: String(source.ramo_fallback || DEFAULT_GOOGLE_DRIVE.ramo_fallback),
    fallback_folder: String(source.fallback_folder || DEFAULT_GOOGLE_DRIVE.fallback_folder),
    subfolders: subfolders.length ? subfolders : DEFAULT_GOOGLE_DRIVE.subfolders,
    extension_rules: Object.keys(orderedExtensionRules).length ? orderedExtensionRules : DEFAULT_GOOGLE_DRIVE.extension_rules,
  };
};

export const normalizePipelineColumns = (value: unknown): PipelineColumn[] => {
  const fallback = DEFAULT_PIPELINE_COLUMNS;

  if (!Array.isArray(value) || !value.length) return fallback;

  return value.map((item: any, index: number) => ({
    id: String(item?.id || `status-${index + 1}`),
    title: String(item?.title || `Status ${index + 1}`),
    color: String(item?.color || '#579bfc'),
    order: Number(item?.order || index + 1),
  }));
};

export const normalizeBoardTableColumns = (value: unknown): BoardTableColumnLayout[] => {
  const source = Array.isArray((value as { columns?: unknown[] })?.columns)
    ? (value as { columns: unknown[] }).columns
    : Array.isArray(value)
      ? value
      : [];

  const mapped = source
    .map((item, index) => {
      if (!item || typeof item !== 'object') return null;
      const record = item as Partial<BoardTableColumnLayout>;
      const fallback = DEFAULT_BOARD_TABLE_COLUMNS.find((column) => column.id === record.id);
      if (!fallback) return null;

      return {
        id: fallback.id,
        label: String(record.label || fallback.label),
        visible: record.visible !== false,
        client_visible: record.client_visible !== false,
        order: Number(record.order || index + 1),
        width:
          typeof record.width === 'number' && Number.isFinite(record.width)
            ? record.width
            : fallback.width,
      } satisfies BoardTableColumnLayout;
    })
    .filter(Boolean) as Array<BoardTableColumnLayout & { width?: number }>;

  return DEFAULT_BOARD_TABLE_COLUMNS.map((fallback, index) => {
    const current = mapped.find((item) => item.id === fallback.id);
    return current ? { ...fallback, ...current } : { ...fallback, order: index + 1 };
  }).sort((left, right) => left.order - right.order);
};

export const normalizeBoardViewMode = (value: unknown): BoardViewMode => {
  const candidate =
    value && typeof value === 'object' && 'defaultView' in value
      ? String((value as { defaultView?: unknown }).defaultView || '')
      : '';

  return candidate === 'kanban' ? 'kanban' : 'table';
};

export const buildDriveFolderPreview = (config: GoogleDriveConfig, clientName: string, ramo: string) => {
  const value = config.folder_pattern
    .replace(/\{cliente\}/gi, clientName)
    .replace(/\{ramo\}/gi, ramo || config.ramo_fallback || 'GERAL')
    .replace(/\s+/g, ' ')
    .trim();
  return config.uppercase ? value.toUpperCase() : value;
};

export const DEFAULT_PORTAL_COLUMNS: BoardTableColumnLayout[] = DEFAULT_BOARD_TABLE_COLUMNS.map((column) => ({
  ...column,
}));

export const DEFAULT_PORTAL_PIPELINE: PipelineColumn[] = DEFAULT_PIPELINE_COLUMNS.map((column) => ({
  ...column,
}));
