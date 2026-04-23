import React, { useEffect, useMemo, useState } from 'react';
import {
  Building2,
  ChevronUp,
  ChevronDown,
  ChevronRight,
  Activity,
  Globe,
  MessageCircle,
  Plus,
  RefreshCw,
  Save,
  Sparkles,
  KanbanSquare,
  Workflow,
  Trash2,
  Upload,
  User,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useSearchParams } from 'react-router-dom';
import { toast } from '@/components/ui/sonner';
import { cn, formatCurrency, formatDate } from '@/utils/cn';
import {
  DEFAULT_BOARD_TABLE_COLUMNS as PRODUCT_DEFAULT_BOARD_TABLE_COLUMNS,
  DEFAULT_BRANDING as PRODUCT_DEFAULT_BRANDING,
  DEFAULT_DASHBOARD_BLOCKS as PRODUCT_DEFAULT_DASHBOARD_BLOCKS,
  DEFAULT_GOOGLE_DRIVE as PRODUCT_DEFAULT_GOOGLE_DRIVE,
  DEFAULT_OPERATIONAL_RULES as PRODUCT_DEFAULT_OPERATIONAL_RULES,
  DEFAULT_PIPELINE_COLUMNS as PRODUCT_DEFAULT_PIPELINE_COLUMNS,
  normalizeDashboardBlocks,
  normalizeOperationalRules,
} from '@/domain/agencyPlatform';
import { SYSTEM_ROLE_LABELS, type SystemRole } from '@/domain/accessControl';
import { buildEmailSignatureHtml, extractPhoneDigits } from '@/lib/emailSignature';
import { AdminService, AuthService, DashboardService, JokeService, KanbanService } from '@/services';
import { emitProfileUpdated, subscribeRealtimeChange } from '@/lib/realtime';
import { useSystemStore } from '@/store/useSystemStore';
import { SignatureSettings, type SignatureProfileForm } from './settings/SignatureSettings';
import { BrandingPanel } from './settings/BrandingPanel';
import { PlansPanel } from './settings/PlansPanel';
import { DashboardPanel } from './settings/DashboardPanel';
import { PipelinePanel } from './settings/PipelinePanel';
import { MonitoringPanel } from './settings/MonitoringPanel';
import { JokesPanel } from './settings/JokesPanel';
import { IntegrationsPanel } from './settings/IntegrationsPanel';
import { SecurityPanel } from './settings/SecurityPanel';

type SettingsTab = 'profile' | 'branding' | 'dashboard' | 'pipeline' | 'plans' | 'monitoring' | 'integrations' | 'jokes';
type BoardViewMode = 'table' | 'kanban';
type BoardTableColumnId =
  | 'task'
  | 'assignee'
  | 'due_date'
  | 'estimated_minutes'
  | 'activity_type'
  | 'priority'
  | 'status'
  | 'stage'
  | 'updated_at';

interface BrandingForm {
  agency_name: string;
  primary_color: string;
  logo_url: string;
}

interface GoogleDriveForm {
  folder_pattern: string;
  uppercase: boolean;
  ramo_fallback: string;
  fallback_folder: string;
  subfolders: string[];
  extension_rules: Record<string, string>;
}

interface DashboardSummary {
  operations: {
    clients: { total: number; active: number; leads: number; new_this_month: number };
    tasks: { total: number; pending: number; in_progress: number; done: number; overdue: number };
    onboarding: {
      total: number;
      pending: number;
      completed: number;
      in_progress_clients: number;
      completed_clients: number;
      completion_rate: number;
    };
  };
}

interface PipelineColumn {
  id: string;
  title: string;
  color: string;
  order: number;
}

interface BoardTableColumnLayout {
  id: BoardTableColumnId;
  label: string;
  visible: boolean;
  client_visible: boolean;
  order: number;
  width?: number;
}

interface MonitoringSnapshot {
  metrics: {
    mrr: number;
    net_profit: number;
    total_income: number;
    total_expense: number;
  };
  events: Array<{ id: string; action: string; entity: string; entity_id?: string | null; created_at: string }>;
}

interface SettingRow {
  key: string;
  value: unknown;
  updated_at?: string | null;
}

interface LoginJokeDraft {
  id?: string;
  tempKey: string;
  text: string;
  active: boolean;
  created_at?: string | null;
}

const tabs: Array<{
  id: SettingsTab;
  label: string;
  icon: React.ElementType;
}> = [
  { id: 'profile', label: 'Minha Conta', icon: User },
  { id: 'branding', label: 'Identidade', icon: Building2 },
  { id: 'dashboard', label: 'Painel Operacional', icon: Sparkles },
  { id: 'pipeline', label: 'Fluxos de Trabalho', icon: KanbanSquare },
  { id: 'monitoring', label: 'Monitoramento', icon: Activity },
  { id: 'jokes', label: 'Mensagens de Login', icon: MessageCircle },
  { id: 'integrations', label: 'Integrações', icon: Globe },
];

const isSettingsTab = (value: string | null): value is SettingsTab => tabs.some((item) => item.id === value);

const DEFAULT_PIPELINE_COLUMNS: PipelineColumn[] = PRODUCT_DEFAULT_PIPELINE_COLUMNS;

const DEFAULT_BOARD_TABLE_COLUMNS: BoardTableColumnLayout[] = PRODUCT_DEFAULT_BOARD_TABLE_COLUMNS;

const DEFAULT_BRANDING: BrandingForm = PRODUCT_DEFAULT_BRANDING;

const DEFAULT_GOOGLE_DRIVE: GoogleDriveForm = PRODUCT_DEFAULT_GOOGLE_DRIVE;

const normalizeDriveText = (item: unknown) => {
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

const normalizeBranding = (value: unknown): BrandingForm => {
  if (!value || typeof value !== 'object') return DEFAULT_BRANDING;
  const source = value as Partial<BrandingForm>;
  return {
    agency_name: String(source.agency_name || DEFAULT_BRANDING.agency_name),
    primary_color: String(source.primary_color || DEFAULT_BRANDING.primary_color),
    logo_url: String(source.logo_url || ''),
  };
};

const uniqueLines = (items: string[]) => Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)));

const sortLinesAlphabetically = (items: string[]) =>
  uniqueLines(items).sort((left, right) => left.localeCompare(right, 'pt-BR', { sensitivity: 'base' }));

const stringifyExtensionRules = (rules: Record<string, string>) =>
  Object.entries(rules)
    .sort(([left], [right]) => left.localeCompare(right, 'pt-BR'))
    .map(([extension, folder]) => `${extension}=${folder}`)
    .join('\n');

const parseExtensionRules = (value: string) => {
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

const normalizeGoogleDrive = (value: unknown): GoogleDriveForm => {
  if (!value || typeof value !== 'object') return DEFAULT_GOOGLE_DRIVE;
  const source = value as Partial<GoogleDriveForm>;
  const subfolders = sortLinesAlphabetically(
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

const buildDriveFolderPreview = (config: GoogleDriveForm, clientName: string, ramo: string) => {
  const value = config.folder_pattern
    .replace(/\{cliente\}/gi, clientName)
    .replace(/\{ramo\}/gi, ramo || config.ramo_fallback || 'GERAL')
    .replace(/\s+/g, ' ')
    .trim();
  return config.uppercase ? value.toUpperCase() : value;
};

const normalizePlans = (value: unknown): string[] => {
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

const normalizeJokeDraft = (item: any, index: number): LoginJokeDraft => ({
  id: item?.id ? String(item.id) : undefined,
  tempKey: `joke-${item?.id || index}`,
  text: String(item?.text || ''),
  active: item?.active !== false,
  created_at: item?.created_at ? String(item.created_at) : null,
});

const normalizeJokeRows = (rows: unknown): LoginJokeDraft[] =>
  Array.isArray(rows) ? rows.map((item: any, index: number) => normalizeJokeDraft(item, index)) : [];

const upsertSettingRow = (rows: SettingRow[], key: string, value: unknown, updatedAt?: string | null) => {
  const next: SettingRow = { key, value, updated_at: updatedAt ?? null };
  const exists = rows.some((item) => item.key === key);
  return exists ? rows.map((item) => (item.key === key ? next : item)) : [next, ...rows.filter((item) => item.key !== key)];
};

const normalizePipelineColumns = (value: unknown): PipelineColumn[] => {
  const fallback = DEFAULT_PIPELINE_COLUMNS;

  if (!Array.isArray(value) || !value.length) return fallback;

  return value.map((item: any, index: number) => ({
    id: String(item?.id || `status-${index + 1}`),
    title: String(item?.title || `Status ${index + 1}`),
    color: String(item?.color || '#579bfc'),
    order: Number(item?.order || index + 1),
  }));
};

const normalizeBoardTableColumns = (value: unknown): BoardTableColumnLayout[] => {
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

const normalizeBoardViewMode = (value: unknown): BoardViewMode => {
  const candidate =
    value && typeof value === 'object' && 'defaultView' in value
      ? String((value as { defaultView?: unknown }).defaultView || '')
      : '';

  return candidate === 'kanban' ? 'kanban' : 'table';
};

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Falha ao ler arquivo.'));
    reader.readAsDataURL(file);
  });

const InlineSwitch = ({
  checked,
  onToggle,
  label,
}: {
  checked: boolean;
  onToggle: () => void;
  label: string;
}) => (
  <button
    type="button"
    onClick={onToggle}
    className={cn(
      'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition',
      checked
        ? 'border-primary/20 bg-primary/10 text-primary'
        : 'border-border/70 bg-white text-muted-foreground hover:border-primary/20 hover:text-foreground'
    )}
  >
    <span
      className={cn(
        'relative inline-flex h-5 w-9 rounded-full border transition',
        checked ? 'border-primary bg-primary' : 'border-border bg-muted'
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform',
          checked ? 'left-4' : 'left-0.5'
        )}
      />
    </span>
    {label}
  </button>
);

export const SettingsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<SettingsTab>(() => {
    const requestedTab = searchParams.get('tab');
    return isSettingsTab(requestedTab) && requestedTab !== 'plans' ? requestedTab : 'profile';
  });
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [profile, setProfile] = useState<SignatureProfileForm>({
    full_name: '',
    username: '',
    email: '',
    avatar_url: '',
    signature_role: '',
    bio_hook: '',
    phone_display: '',
    linkedin_url: '',
  });
  const [branding, setBranding] = useState<BrandingForm>(DEFAULT_BRANDING);
  const [plans, setPlans] = useState<string[]>([]);
  const [planDraft, setPlanDraft] = useState('');
  const [dashboardBlocks, setDashboardBlocks] = useState(PRODUCT_DEFAULT_DASHBOARD_BLOCKS);
  const [dashboardRules, setDashboardRules] = useState(PRODUCT_DEFAULT_OPERATIONAL_RULES);
  const [pipelineColumns, setPipelineColumns] = useState<PipelineColumn[]>(DEFAULT_PIPELINE_COLUMNS);
  const [boardTableColumns, setBoardTableColumns] = useState<BoardTableColumnLayout[]>(DEFAULT_BOARD_TABLE_COLUMNS);
  const [boardDefaultView, setBoardDefaultView] = useState<BoardViewMode>('table');
  const [pipelineDraft, setPipelineDraft] = useState('');
  const [pipelineColor, setPipelineColor] = useState('#579bfc');
  const [monitoring, setMonitoring] = useState<MonitoringSnapshot | null>(null);
  const [settingsRows, setSettingsRows] = useState<SettingRow[]>([]);
  const [googleDrive, setGoogleDrive] = useState<GoogleDriveForm>(DEFAULT_GOOGLE_DRIVE);
  const [googleDriveFoldersText, setGoogleDriveFoldersText] = useState(DEFAULT_GOOGLE_DRIVE.subfolders.join('\n'));
  const [googleDriveRulesText, setGoogleDriveRulesText] = useState(
    stringifyExtensionRules(DEFAULT_GOOGLE_DRIVE.extension_rules)
  );
  const [jokes, setJokes] = useState<LoginJokeDraft[]>([]);
  const [jokesBulkText, setJokesBulkText] = useState('');
  const [jokesScrollTop, setJokesScrollTop] = useState(0);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [savingBranding, setSavingBranding] = useState(false);
  const [savingDashboard, setSavingDashboard] = useState(false);
  const [savingPlans, setSavingPlans] = useState(false);
  const [savingPipeline, setSavingPipeline] = useState(false);
  const [savingBoardLayout, setSavingBoardLayout] = useState(false);
  const [savingGoogleDrive, setSavingGoogleDrive] = useState(false);
  const [savingJokes, setSavingJokes] = useState(false);
  const avatarInputRef = React.useRef<HTMLInputElement | null>(null);
  const brandingLogoInputRef = React.useRef<HTMLInputElement | null>(null);
  const jokesTextareaRef = React.useRef<HTMLTextAreaElement | null>(null);

  const systemPlans = useSystemStore((state) => state.plans);
  const systemBranding = useSystemStore((state) => state.branding);
  const setSystemBranding = useSystemStore((state) => state.setBranding);
  const setSystemPlans = useSystemStore((state) => state.setPlans);
  const changeTab = (tab: SettingsTab) => {
    setActiveTab(tab);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('tab', tab);
    setSearchParams(nextParams, { replace: true });
  };

  const loadSettings = async () => {
    setLoading(true);
    try {
      const [me, config, dashboard, monitor, pipelineSettings, rows, jokesRows] = await Promise.all([
        AuthService.getMe().catch(() => null),
        AuthService.getAppConfig().catch(() => ({})),
        DashboardService.getSummary().catch(() => null),
        DashboardService.getMonitoring().catch(() => null),
        KanbanService.getColumns().catch(() => []),
        AdminService.getSettings().catch(() => []),
        JokeService.getAll().catch(() => []),
      ]);

      const nextBranding = normalizeBranding((config as Record<string, unknown>).branding);
      const nextPlans = normalizePlans((config as Record<string, unknown>).plans_catalog);
      const nextPipeline = normalizePipelineColumns(pipelineSettings);
      const settingsList = Array.isArray(rows)
        ? rows.map((item: any) => ({
            key: String(item.key),
            value: item.value,
            updated_at: item.updated_at ? String(item.updated_at) : null,
          }))
        : [];
      const googleDriveSetting = settingsList.find((item) => item.key === 'google_drive');
      const dashboardBlocksSetting = settingsList.find((item) => item.key === 'dashboard_blocks');
      const dashboardRulesSetting = settingsList.find((item) => item.key === 'dashboard_rules');
      const boardColumnsSetting = settingsList.find((item) => item.key === 'board_table_columns');
      const boardViewSetting = settingsList.find((item) => item.key === 'board_view_preferences');
      const nextGoogleDrive = normalizeGoogleDrive(googleDriveSetting?.value);
      const nextDashboardBlocks = normalizeDashboardBlocks(dashboardBlocksSetting?.value);
      const nextDashboardRules = normalizeOperationalRules(dashboardRulesSetting?.value);

      setProfile({
        full_name: String(me?.profile?.full_name || me?.full_name || ''),
        username: String(me?.profile?.username || me?.username || ''),
        email: String(me?.email || me?.profile?.email || ''),
        avatar_url: String(me?.profile?.avatar_url || me?.avatar_url || ''),
        signature_role: String(
          me?.profile?.signature_role ||
            SYSTEM_ROLE_LABELS[String(me?.profile?.role || me?.role || 'equipe') as SystemRole] ||
            ''
        ),
        bio_hook: String(me?.profile?.bio_hook || ''),
        phone_display: String(me?.profile?.phone_display || me?.profile?.phone || ''),
        linkedin_url: String(me?.profile?.linkedin_url || ''),
      });
      setBranding(nextBranding);
      setPlans(nextPlans.length ? nextPlans : systemPlans);
      setPipelineColumns(nextPipeline.length ? nextPipeline : DEFAULT_PIPELINE_COLUMNS);
      setBoardTableColumns(normalizeBoardTableColumns(boardColumnsSetting?.value));
      setBoardDefaultView(normalizeBoardViewMode(boardViewSetting?.value));
      setDashboardBlocks(nextDashboardBlocks);
      setDashboardRules(nextDashboardRules);
      setMonitoring((monitor as MonitoringSnapshot) || null);
      setSettingsRows(settingsList);
      setGoogleDrive(nextGoogleDrive);
      setGoogleDriveFoldersText(nextGoogleDrive.subfolders.join('\n'));
      setGoogleDriveRulesText(stringifyExtensionRules(nextGoogleDrive.extension_rules));
      const normalizedJokes = normalizeJokeRows(jokesRows);
      setJokes(normalizedJokes);
      setJokesBulkText(
        normalizedJokes
          .map((item) => item.text.trim())
          .filter(Boolean)
          .join('\n')
      );
      setSystemBranding(nextBranding);
      useSystemStore.getState().setDashboardBlocks(nextDashboardBlocks);
      useSystemStore.getState().setOperationalRules(nextDashboardRules);
      if (nextPlans.length) setSystemPlans(nextPlans);
      if (dashboard) setSummary(dashboard as DashboardSummary);
    } catch (error) {
      console.error(error);
      toast.error('Não foi possível carregar as configurações.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return subscribeRealtimeChange((detail) => {
      if (detail.schema !== 'public') return;

      const row = detail.eventType === 'DELETE' ? detail.oldRow : detail.newRow;
      if (!row) return;

      const store = useSystemStore.getState();

      if (detail.table === 'system_settings') {
        const key = String((row as Record<string, unknown>).key || '');
        const value = (row as Record<string, unknown>).value;
        const updatedAt = (row as Record<string, unknown>).updated_at
          ? String((row as Record<string, unknown>).updated_at)
          : null;

        if (!key) return;

        setSettingsRows((current) =>
          detail.eventType === 'DELETE'
            ? current.filter((item) => item.key !== key)
            : upsertSettingRow(current, key, value, updatedAt)
        );

        if (key === 'branding') {
          const nextBranding = normalizeBranding(value);
          setBranding(nextBranding);
          store.setBranding(nextBranding);
        } else if (key === 'plans_catalog') {
          const nextPlans = normalizePlans(value);
          setPlans(nextPlans);
          store.setPlans(nextPlans);
        } else if (key === 'google_drive') {
          const nextGoogleDrive = normalizeGoogleDrive(value);
          setGoogleDrive(nextGoogleDrive);
          setGoogleDriveFoldersText(nextGoogleDrive.subfolders.join('\n'));
          setGoogleDriveRulesText(stringifyExtensionRules(nextGoogleDrive.extension_rules));
        } else if (key === 'dashboard_blocks') {
          const nextDashboardBlocks = normalizeDashboardBlocks(value);
          setDashboardBlocks(nextDashboardBlocks);
          store.setDashboardBlocks(nextDashboardBlocks);
        } else if (key === 'dashboard_rules') {
          const nextDashboardRules = normalizeOperationalRules(value);
          setDashboardRules(nextDashboardRules);
          store.setOperationalRules(nextDashboardRules);
        } else if (key === 'kanban_pipeline') {
          setPipelineColumns(normalizePipelineColumns(value));
        } else if (key === 'board_table_columns') {
          setBoardTableColumns(normalizeBoardTableColumns(value));
        } else if (key === 'board_view_preferences') {
          setBoardDefaultView(normalizeBoardViewMode(value));
        }
      }

      if (detail.table === 'login_jokes') {
        const normalized = normalizeJokeDraft(row, 0);
        const jokeId = normalized.id || normalized.tempKey;

        setJokes((current) => {
          let next = current;

          if (detail.eventType === 'DELETE') {
            next = current.filter((item) => (item.id || item.tempKey) !== jokeId);
          } else {
            const index = current.findIndex((item) => (item.id || item.tempKey) === jokeId);
            if (index >= 0) {
              next = current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...normalized } : item));
            } else {
              next = [...current, normalized];
            }
          }

          setJokesBulkText(
            next
              .map((item) => item.text.trim())
              .filter(Boolean)
              .join('\n')
          );
          return next;
        });
      }
    });
  }, [setSystemBranding, setSystemPlans]);

  const addPlan = () => {
    const next = planDraft.trim();
    if (!next) return;
    setPlans((current) => Array.from(new Set([...current, next])));
    setPlanDraft('');
  };

  const removePlan = (plan: string) => {
    setPlans((current) => current.filter((item) => item !== plan));
  };

  const updateDashboardBlock = (id: string, update: Partial<(typeof PRODUCT_DEFAULT_DASHBOARD_BLOCKS)[number]>) => {
    setDashboardBlocks((current) => current.map((block) => (block.id === id ? { ...block, ...update } : block)));
  };

  const moveDashboardBlock = (id: string, direction: -1 | 1) => {
    setDashboardBlocks((current) => {
      const ordered = [...current].sort((left, right) => left.order - right.order);
      const index = ordered.findIndex((block) => block.id === id);
      const targetIndex = index + direction;
      if (index < 0 || targetIndex < 0 || targetIndex >= ordered.length) return current;

      const next = [...ordered];
      const [item] = next.splice(index, 1);
      next.splice(targetIndex, 0, item);
      return next.map((block, position) => ({ ...block, order: position + 1 }));
    });
  };

  const updateOperationalRule = (
    key: string,
    update: Partial<(typeof PRODUCT_DEFAULT_OPERATIONAL_RULES)[number]>
  ) => {
    setDashboardRules((current) => current.map((rule) => (rule.key === key ? { ...rule, ...update } : rule)));
  };

  const handleSaveProfile = async () => {
    if (!profile.full_name.trim() || !profile.username.trim()) {
      toast.error('Preencha nome e usuário.');
      return;
    }

    const snapshot = profile;
    const nextProfile = {
      ...profile,
      full_name: profile.full_name.trim(),
      username: profile.username.trim(),
      avatar_url: profile.avatar_url.trim(),
      signature_role: profile.signature_role.trim(),
      bio_hook: profile.bio_hook.trim(),
      phone_display: profile.phone_display.trim(),
      linkedin_url: profile.linkedin_url.trim(),
    };
    const signatureHtml = buildEmailSignatureHtml(nextProfile, systemBranding);
    const phoneDigits = extractPhoneDigits(nextProfile.phone_display);

    setProfile(nextProfile);
    emitProfileUpdated({
      full_name: nextProfile.full_name,
      username: nextProfile.username,
      email: nextProfile.email,
      avatar_url: nextProfile.avatar_url || undefined,
    });
    setSavingProfile(true);
    try {
      const updated = await AuthService.updateMyProfile({
        full_name: nextProfile.full_name,
        username: nextProfile.username,
        avatar_url: nextProfile.avatar_url || null,
        signature_role: nextProfile.signature_role || null,
        bio_hook: nextProfile.bio_hook || null,
        phone: phoneDigits || null,
        phone_display: nextProfile.phone_display || null,
        linkedin_url: nextProfile.linkedin_url || null,
        signature_html: signatureHtml,
      });

      setProfile((current) => ({
        ...current,
        full_name: String(updated.full_name || current.full_name),
        username: String(updated.username || current.username),
        avatar_url: String(updated.avatar_url || ''),
        signature_role: String(updated.signature_role ?? ''),
        bio_hook: String(updated.bio_hook ?? ''),
        phone_display: String(updated.phone_display ?? updated.phone ?? ''),
        linkedin_url: String(updated.linkedin_url ?? ''),
      }));
      emitProfileUpdated({
        full_name: String(updated.full_name || nextProfile.full_name),
        username: String(updated.username || nextProfile.username),
        email: nextProfile.email,
        avatar_url: String(updated.avatar_url || ''),
      });
      toast.success('Perfil atualizado.');
    } catch (error) {
      console.error(error);
      setProfile(snapshot);
      emitProfileUpdated({
        full_name: snapshot.full_name,
        username: snapshot.username,
        email: snapshot.email,
        avatar_url: snapshot.avatar_url || undefined,
      });
      toast.error('Não foi possível salvar o perfil.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async ({
    currentPassword,
    newPassword,
    confirmPassword,
  }: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  }) => {
    if (!currentPassword.trim() || !newPassword.trim() || !confirmPassword.trim()) {
      toast.error('Preencha senha atual, nova senha e confirmação.');
      return false;
    }

    if (newPassword !== confirmPassword) {
      toast.error('A confirmação da senha não confere.');
      return false;
    }

    if (newPassword.length < 8) {
      toast.error('A nova senha precisa ter pelo menos 8 caracteres.');
      return false;
    }

    setSavingPassword(true);
    try {
      await AuthService.changeMyPassword(currentPassword, newPassword);
      toast.success('Senha atualizada com sucesso.');
      return true;
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : 'Não foi possível atualizar a senha.';
      toast.error(message);
      return false;
    } finally {
      setSavingPassword(false);
    }
  };

  const handleSaveBranding = async () => {
    const snapshot = branding;
    setSystemBranding(branding);
    setBranding(branding);
    setSavingBranding(true);
    try {
      await AdminService.saveSetting('branding', branding);
      setSettingsRows((current) => upsertSettingRow(current, 'branding', branding));
      toast.success('Identidade visual atualizada.');
    } catch (error) {
      console.error(error);
      setBranding(snapshot);
      setSystemBranding(snapshot);
      toast.error('Não foi possível salvar a marca.');
    } finally {
      setSavingBranding(false);
    }
  };

  const handleSaveDashboard = async () => {
    const normalizedBlocks = dashboardBlocks
      .slice()
      .sort((left, right) => left.order - right.order)
      .map((block, index) => ({
        id: String(block.id || `block-${index + 1}`),
        title: String(block.title || '').trim() || block.title,
        visible: block.visible !== false,
        order: index + 1,
      }));

    const normalizedRules = dashboardRules.map((rule) => ({
      key: String(rule.key || '').trim(),
      label: String(rule.label || '').trim() || String(rule.key || '').trim(),
      enabled: rule.enabled !== false,
      ...(typeof rule.threshold === 'number' && Number.isFinite(rule.threshold) ? { threshold: rule.threshold } : {}),
      description: String(rule.description || '').trim(),
    }));

    const snapshotBlocks = dashboardBlocks;
    const snapshotRules = dashboardRules;
    setDashboardBlocks(normalizedBlocks);
    setDashboardRules(normalizedRules);
    useSystemStore.getState().setDashboardBlocks(normalizedBlocks);
    useSystemStore.getState().setOperationalRules(normalizedRules);
    setSavingDashboard(true);
    try {
      await Promise.all([
        AdminService.saveSetting('dashboard_blocks', { blocks: normalizedBlocks }),
        AdminService.saveSetting('dashboard_rules', { rules: normalizedRules }),
      ]);
      setSettingsRows((current) => upsertSettingRow(current, 'dashboard_blocks', { blocks: normalizedBlocks }));
      setSettingsRows((current) => upsertSettingRow(current, 'dashboard_rules', { rules: normalizedRules }));
      toast.success('Painel operacional atualizado.');
    } catch (error) {
      console.error(error);
      setDashboardBlocks(snapshotBlocks);
      setDashboardRules(snapshotRules);
      useSystemStore.getState().setDashboardBlocks(snapshotBlocks);
      useSystemStore.getState().setOperationalRules(snapshotRules);
      toast.error('Não foi possível salvar o painel operacional.');
    } finally {
      setSavingDashboard(false);
    }
  };

  const handleAvatarUpload = async (file: File) => {
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setProfile((current) => ({ ...current, avatar_url: dataUrl }));
      toast.success('Avatar carregado. Salve para aplicar.');
    } catch (error) {
      console.error(error);
      toast.error('Não foi possível carregar o avatar.');
    }
  };

  const handleBrandingLogoUpload = async (file: File) => {
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setBranding((current) => ({ ...current, logo_url: dataUrl }));
      toast.success('Logo carregada. Salve para aplicar.');
    } catch (error) {
      console.error(error);
      toast.error('Não foi possível carregar a logo.');
    }
  };

  const handleSavePlans = async () => {
    const normalized: string[] = Array.from(
      new Map(
        plans
          .map((plan) => plan.trim())
          .filter(Boolean)
          .map((plan) => [plan.toLowerCase(), plan] as const)
      ).values()
    )
      .map((plan) => String(plan))
      .sort((left, right) => left.localeCompare(right, 'pt-BR', { sensitivity: 'base' }));

    const snapshot = plans;
    setPlans(normalized);
    setSystemPlans(normalized);
    setSavingPlans(true);
    try {
      await AdminService.saveSetting('plans_catalog', { plans: normalized });
      setSettingsRows((current) => upsertSettingRow(current, 'plans_catalog', { plans: normalized }));
      toast.success('Catálogo de serviços atualizado.');
    } catch (error) {
      console.error(error);
      setPlans(snapshot);
      setSystemPlans(snapshot);
      toast.error('Não foi possível salvar o catálogo de serviços.');
    } finally {
      setSavingPlans(false);
    }
  };

  const handleSavePipeline = async () => {
    const normalized = pipelineColumns.map((column, index) => ({
      id: String(column.id || `status-${index + 1}`),
      title: String(column.title || `Status ${index + 1}`).trim() || `Status ${index + 1}`,
      color: String(column.color || '#579bfc'),
      order: index + 1,
    }));

    const snapshot = pipelineColumns;
    setPipelineColumns(normalized);
    setSavingPipeline(true);
    try {
      const saved = await KanbanService.updateGlobalColumns(normalized);
      setPipelineColumns(saved);
      setSettingsRows((current) => upsertSettingRow(current, 'kanban_pipeline', saved));
      toast.success('Fluxo de trabalho atualizado.');
    } catch (error) {
      console.error(error);
      setPipelineColumns(snapshot);
      toast.error('Não foi possível salvar o fluxo de trabalho.');
    } finally {
      setSavingPipeline(false);
    }
  };

  const addPipelineColumn = () => {
    const title = pipelineDraft.trim();
    if (!title) return;

    const baseId = title
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    const candidate = baseId || `status-${pipelineColumns.length + 1}`;
    const suffix = pipelineColumns.some((item) => item.id === candidate) ? `-${pipelineColumns.length + 1}` : '';
    const nextId = `${candidate}${suffix}`;

    setPipelineColumns((current) => [
      ...current,
      { id: nextId, title, color: pipelineColor, order: current.length + 1 },
    ]);
    setPipelineDraft('');
    setPipelineColor('#579bfc');
  };

  const updatePipelineColumn = (id: string, update: Partial<PipelineColumn>) => {
    setPipelineColumns((current) =>
      current.map((column) => (column.id === id ? { ...column, ...update } : column))
    );
  };

  const removePipelineColumn = (id: string) => {
    setPipelineColumns((current) => current.filter((column) => column.id !== id).map((column, index) => ({ ...column, order: index + 1 })));
  };

  const movePipelineColumn = (id: string, direction: -1 | 1) => {
    setPipelineColumns((current) => {
      const index = current.findIndex((column) => column.id === id);
      const targetIndex = index + direction;
      if (index < 0 || targetIndex < 0 || targetIndex >= current.length) return current;

      const next = [...current];
      const [item] = next.splice(index, 1);
      next.splice(targetIndex, 0, item);
      return next.map((column, position) => ({ ...column, order: position + 1 }));
    });
  };

  const updateBoardTableColumn = (id: BoardTableColumnId, update: Partial<BoardTableColumnLayout>) => {
    setBoardTableColumns((current) =>
      current.map((column) => (column.id === id ? { ...column, ...update } : column))
    );
  };

  const moveBoardTableColumn = (id: BoardTableColumnId, direction: -1 | 1) => {
    setBoardTableColumns((current) => {
      const ordered = [...current].sort((left, right) => left.order - right.order);
      const index = ordered.findIndex((column) => column.id === id);
      const targetIndex = index + direction;
      if (index < 0 || targetIndex < 0 || targetIndex >= ordered.length) return current;

      const next = [...ordered];
      const [item] = next.splice(index, 1);
      next.splice(targetIndex, 0, item);
      return next.map((column, position) => ({ ...column, order: position + 1 }));
    });
  };

  const handleSaveBoardLayout = async () => {
    const normalized = boardTableColumns
      .slice()
      .sort((left, right) => left.order - right.order)
      .map((column, index) => ({
        id: column.id,
        label: column.label,
        visible: column.visible,
        client_visible: column.client_visible,
        order: index + 1,
        width:
          typeof column.width === 'number' && Number.isFinite(column.width)
            ? Math.round(column.width)
            : undefined,
      }));

    if (!normalized.some((column) => column.visible)) {
      toast.error('Mantenha pelo menos uma coluna visível.');
      return;
    }

    const snapshotColumns = boardTableColumns;
    const snapshotView = boardDefaultView;
    setBoardTableColumns(normalized);
    setSavingBoardLayout(true);
    try {
      await Promise.all([
        AdminService.saveSetting('board_table_columns', { columns: normalized }),
        AdminService.saveSetting('board_view_preferences', { defaultView: boardDefaultView }),
      ]);
      setSettingsRows((current) => upsertSettingRow(current, 'board_table_columns', { columns: normalized }));
      setSettingsRows((current) => upsertSettingRow(current, 'board_view_preferences', { defaultView: boardDefaultView }));
      toast.success('Colunas e visualização padrão atualizadas.');
    } catch (error) {
      console.error(error);
      setBoardTableColumns(snapshotColumns);
      setBoardDefaultView(snapshotView);
      toast.error('Não foi possível salvar as colunas do board.');
    } finally {
      setSavingBoardLayout(false);
    }
  };

  const handleSaveJokes = async () => {
    const snapshotJokes = jokes;
    const snapshotText = jokesBulkText;
    const lines = jokesBulkText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    const nextJokes = lines.map((text, index) => {
      const previous = snapshotJokes[index];
      return {
        id: previous?.id,
        tempKey: previous?.tempKey || `joke-${previous?.id || index}-${Date.now()}`,
        text,
        active: true,
        created_at: previous?.created_at || null,
      };
    });

    setJokes(nextJokes);
    setJokesBulkText(lines.join('\n'));
    setSavingJokes(true);
    try {
      const persisted = snapshotJokes.filter((item) => item.id);
      const nextUpdates = persisted.slice(0, lines.length);
      const nextCreates = lines.slice(persisted.length);
      const deletePromises = persisted.slice(lines.length).map((item) => JokeService.delete(item.id as string));
      const updatePromises = nextUpdates.map((item, index) =>
        JokeService.update(item.id as string, {
          text: lines[index],
          active: true,
        })
      );
      const createPromises = nextCreates.map((text) =>
        JokeService.create({
          text,
          active: true,
        })
      );

      await Promise.all([...deletePromises, ...updatePromises]);
      const createdJokes = (await Promise.all(createPromises)).map((item, index) => normalizeJokeDraft(item, index));

      if (createdJokes.length) {
        setJokes((current) => {
          const next = [...current];
          const startIndex = persisted.length;
          createdJokes.forEach((item, offset) => {
            const targetIndex = startIndex + offset;
            if (targetIndex < next.length) {
              next[targetIndex] = item;
            } else {
              next.push(item);
            }
          });
          return next;
        });
      }

      toast.success('Mensagens de login atualizadas.');
    } catch (error) {
      console.error(error);
      setJokes(snapshotJokes);
      setJokesBulkText(snapshotText);
      toast.error('Não foi possível salvar as mensagens de login.');
    } finally {
      setSavingJokes(false);
    }
  };

  const handleSaveGoogleDrive = async () => {
    const snapshot = googleDrive;
    const snapshotFolders = googleDriveFoldersText;
    const snapshotRules = googleDriveRulesText;
    const nextConfig = normalizeGoogleDrive({
      ...googleDrive,
      subfolders: googleDriveFoldersText.split(/\r?\n/),
      extension_rules: parseExtensionRules(googleDriveRulesText),
    });

    setGoogleDrive(nextConfig);
    setGoogleDriveFoldersText(nextConfig.subfolders.join('\n'));
    setGoogleDriveRulesText(stringifyExtensionRules(nextConfig.extension_rules));
    setSettingsRows((current) => upsertSettingRow(current, 'google_drive', nextConfig));
    setSavingGoogleDrive(true);
    try {
      await AdminService.saveSetting('google_drive', nextConfig as unknown as Record<string, unknown>);
      toast.success('Padrão do Google Drive atualizado.');
    } catch (error) {
      console.error(error);
      setGoogleDrive(snapshot);
      setGoogleDriveFoldersText(snapshotFolders);
      setGoogleDriveRulesText(snapshotRules);
      toast.error('Não foi possível salvar o padrão do Google Drive.');
    } finally {
      setSavingGoogleDrive(false);
    }
  };

  const orderedPipelineColumns = useMemo(
    () => [...pipelineColumns].sort((left, right) => left.order - right.order),
    [pipelineColumns]
  );
  const orderedBoardTableColumns = useMemo(
    () => [...boardTableColumns].sort((left, right) => left.order - right.order),
    [boardTableColumns]
  );
  const orderedDashboardBlocks = useMemo(
    () => [...dashboardBlocks].sort((left, right) => left.order - right.order),
    [dashboardBlocks]
  );
  const orderedOperationalRules = useMemo(
    () => [...dashboardRules].sort((left, right) => left.label.localeCompare(right.label, 'pt-BR', { sensitivity: 'base' })),
    [dashboardRules]
  );

  const completionRate = summary?.operations.onboarding.completion_rate || 0;
  const activeTabMeta = useMemo(() => tabs.find((item) => item.id === activeTab), [activeTab]);
  const isVictortelesAdmin = profile.username.trim().toLowerCase() === 'victorteles';
  const jokeLines = useMemo(() => jokesBulkText.split(/\r?\n/), [jokesBulkText]);
  const jokeLineCount = useMemo(() => Math.max(1, jokeLines.length), [jokeLines.length]);
  const jokeValidCount = useMemo(() => jokeLines.map((line) => line.trim()).filter(Boolean).length, [jokeLines]);
  const googleDriveSubfolders = useMemo(
    () => sortLinesAlphabetically(googleDriveFoldersText.split(/\r?\n/)),
    [googleDriveFoldersText]
  );
  const googleDriveRules = useMemo(
    () =>
      Object.entries(parseExtensionRules(googleDriveRulesText)).sort(([left], [right]) =>
        left.localeCompare(right, 'pt-BR', { sensitivity: 'base' })
      ),
    [googleDriveRulesText]
  );
  useEffect(() => {
    if (!isVictortelesAdmin && activeTab !== 'profile') {
      changeTab('profile');
    }
  }, [activeTab, isVictortelesAdmin]);

  useEffect(() => {
    const requestedTab = searchParams.get('tab');
    if (requestedTab === 'plans') {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.set('tab', 'profile');
      setSearchParams(nextParams, { replace: true });
      if (activeTab !== 'profile') setActiveTab('profile');
      return;
    }

    if (isSettingsTab(requestedTab) && requestedTab !== activeTab) {
      setActiveTab(requestedTab);
    }
  }, [activeTab, searchParams, setSearchParams]);

  const clearEmptyJokeLines = () => {
    const cleaned = jokeLines
      .map((line) => line.trim())
      .filter(Boolean)
      .join('\n');
    setJokesBulkText(cleaned);
    setJokesScrollTop(0);
    if (jokesTextareaRef.current) {
      jokesTextareaRef.current.scrollTop = 0;
    }
  };

  const handleSortGoogleDriveFolders = () => {
    setGoogleDriveFoldersText(googleDriveSubfolders.join('\n'));
  };

  const handleSortGoogleDriveRules = () => {
    setGoogleDriveRulesText(stringifyExtensionRules(parseExtensionRules(googleDriveRulesText)));
  };

  if (loading) {
    return (
<div className="mx-auto flex h-full w-full max-w-[1560px] flex-col gap-8 px-4 py-5 md:px-6 md:py-6 xl:px-8">
<div className="premium-card p-4">
          <div className="shimmer h-10 w-56 rounded-2xl" />
          <div className="mt-6 grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
            <div className="space-y-3">
              {[1, 2, 3, 4].map((item) => (
                <div key={item} className="shimmer h-12 rounded-2xl" />
              ))}
            </div>
            <div className="space-y-4">
              <div className="shimmer h-56 rounded-3xl" />
              <div className="shimmer h-40 rounded-3xl" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
<div className="mx-auto flex h-full w-full max-w-[1560px] flex-col gap-8 px-4 py-5 md:px-6 md:py-6 xl:px-8">
      <section className="premium-card overflow-hidden">
        <div className="border-b border-border/70 px-5 py-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Configurações</h1>
            </div>

            <button type="button" onClick={() => void loadSettings()} className="btn-secondary h-10">
              <RefreshCw size={16} />
              Recarregar
            </button>
          </div>
        </div>

        <div className="grid gap-0 lg:grid-cols-[248px_minmax(0,1fr)] lg:items-start">
          <aside className="self-start border-b border-border/70 bg-transparent p-4 lg:border-b-0 lg:border-r lg:p-5">
            <div className="space-y-2">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = tab.id === activeTab;
                const isLocked = !isVictortelesAdmin && tab.id !== 'profile';
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => !isLocked && changeTab(tab.id)}
                    disabled={isLocked}
                    className={cn(
                      'group flex w-full items-center justify-between rounded-2xl border px-3 py-3 text-left transition-all',
                      isActive
                        ? 'border-primary/18 bg-white text-foreground'
                        : 'border-transparent bg-transparent text-foreground hover:border-primary/12 hover:bg-white',
                      isLocked && 'cursor-not-allowed opacity-55'
                    )}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div
                        className={cn(
                          'flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl',
                          isActive ? 'bg-primary/10 text-primary' : 'bg-white text-primary'
                        )}
                      >
                        <Icon size={16} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold">{tab.label}</p>
                      </div>
                    </div>
                    <ChevronRight size={14} className="text-muted-foreground" />
                  </button>
                );
              })}
            </div>
          </aside>

          <div className="p-5 lg:p-7 xl:p-8">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18 }}
              className="space-y-6"
            >
              <div>
                <h2 className="mt-2 text-xl font-bold tracking-tight text-foreground">{activeTabMeta?.label}</h2>
              </div>

              {activeTab === 'profile' && (
                <div className="grid gap-8 2xl:grid-cols-[minmax(0,1.15fr)_400px]">
                  <div className="space-y-6">
                    <SignatureSettings
                      profile={profile}
                      setProfile={setProfile}
                      saving={savingProfile}
                      onSave={() => void handleSaveProfile()}
                      onAvatarUpload={(file) => void handleAvatarUpload(file)}
                      avatarInputRef={avatarInputRef}
                      companyBranding={systemBranding}
                    />
                  </div>

                  <div className="space-y-6">
                    <SecurityPanel
                      email={profile.email}
                      username={profile.username}
                      saving={savingPassword}
                      onSubmit={handleChangePassword}
                    />

                    <section className="rounded-[30px] border border-slate-200/80 bg-white p-6 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                        Identidade operacional
                      </div>
                      <div className="mt-4 grid gap-3">
                        <div className="rounded-[22px] border border-slate-200 bg-slate-50/80 px-4 py-4">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                            Nome exibido
                          </div>
                          <div className="mt-2 text-sm font-semibold text-slate-900">{profile.full_name || 'Sem nome definido'}</div>
                        </div>
                        <div className="rounded-[22px] border border-slate-200 bg-slate-50/80 px-4 py-4">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                            Cargo
                          </div>
                          <div className="mt-2 text-sm font-semibold text-slate-900">
                            {profile.signature_role || 'Cargo não informado'}
                          </div>
                        </div>
                        <div className="rounded-[22px] border border-lime-200 bg-lime-50/80 px-4 py-4">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-lime-700">
                            Resultado
                          </div>
                          <div className="mt-2 text-sm leading-6 text-lime-900">
                            Perfil, assinatura e segurança agora ficam no mesmo fluxo de manutenção da conta.
                          </div>
                        </div>
                      </div>
                    </section>
                  </div>
                </div>
              )}

              {activeTab === 'branding' && (
                <BrandingPanel
                  branding={branding}
                  setBranding={setBranding}
                  saving={savingBranding}
                  onSave={() => void handleSaveBranding()}
                  onLogoUpload={(file) => void handleBrandingLogoUpload(file)}
                  logoInputRef={brandingLogoInputRef}
                />
              )}

              {activeTab === 'dashboard' && (
                <DashboardPanel
                  orderedDashboardBlocks={orderedDashboardBlocks}
                  orderedOperationalRules={orderedOperationalRules}
                  onUpdateBlock={updateDashboardBlock}
                  onMoveBlock={moveDashboardBlock}
                  onUpdateRule={updateOperationalRule}
                  saving={savingDashboard}
                  onSave={() => void handleSaveDashboard()}
                />
              )}

              {activeTab === 'plans' && (
                <PlansPanel
                  plans={plans}
                  planDraft={planDraft}
                  setPlanDraft={setPlanDraft}
                  onAdd={addPlan}
                  onRemove={removePlan}
                  saving={savingPlans}
                  onSave={() => void handleSavePlans()}
                />
              )}

              {activeTab === 'pipeline' && (
                <PipelinePanel
                  orderedPipelineColumns={orderedPipelineColumns}
                  orderedBoardTableColumns={orderedBoardTableColumns}
                  boardDefaultView={boardDefaultView}
                  pipelineDraft={pipelineDraft}
                  pipelineColor={pipelineColor}
                  setPipelineDraft={setPipelineDraft}
                  setPipelineColor={setPipelineColor}
                  onAddColumn={addPipelineColumn}
                  onRemoveColumn={removePipelineColumn}
                  onUpdateColumn={updatePipelineColumn}
                  onMoveColumn={movePipelineColumn}
                  setBoardDefaultView={setBoardDefaultView}
                  onUpdateBoardTableColumn={updateBoardTableColumn}
                  onMoveBoardTableColumn={moveBoardTableColumn}
                  savingPipeline={savingPipeline}
                  savingBoardLayout={savingBoardLayout}
                  onSavePipeline={() => void handleSavePipeline()}
                  onSaveBoardLayout={() => void handleSaveBoardLayout()}
                />
              )}

              {activeTab === 'monitoring' && (
                <MonitoringPanel
                  monitoring={monitoring}
                  summary={summary}
                  onRefresh={() => void loadSettings()}
                />
              )}

              {activeTab === 'jokes' && (
                <JokesPanel
                  jokesBulkText={jokesBulkText}
                  setJokesBulkText={setJokesBulkText}
                  jokesScrollTop={jokesScrollTop}
                  setJokesScrollTop={setJokesScrollTop}
                  jokeLineCount={jokeLineCount}
                  jokeValidCount={jokeValidCount}
                  saving={savingJokes}
                  onSave={() => void handleSaveJokes()}
                  onClearEmpty={clearEmptyJokeLines}
                  textareaRef={jokesTextareaRef}
                />
              )}

              {activeTab === 'integrations' && (
                <IntegrationsPanel
                  googleDrive={googleDrive}
                  setGoogleDrive={setGoogleDrive}
                  foldersText={googleDriveFoldersText}
                  setFoldersText={setGoogleDriveFoldersText}
                  rulesText={googleDriveRulesText}
                  setRulesText={setGoogleDriveRulesText}
                  googleDriveSubfolders={googleDriveSubfolders}
                  folderPreview={buildDriveFolderPreview(googleDrive, 'Daniela de Cássia', googleDrive.ramo_fallback || 'GERAL')}
                  saving={savingGoogleDrive}
                  onSave={() => void handleSaveGoogleDrive()}
                  onSortFolders={handleSortGoogleDriveFolders}
                  onSortRules={handleSortGoogleDriveRules}
                />
              )}
            </motion.div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default SettingsPage;
