import React from 'react';
import { addDays, endOfMonth, endOfWeek, format, isSameMonth, startOfMonth, startOfWeek } from 'date-fns';
import { ptBR as dateFnsPtBR } from 'date-fns/locale';
import {
  CalendarDays,
  Loader2,
  Trash2,
  UploadCloud,
  Video,
  X,
  ImageIcon,
  PlayCircle,
  AlignLeft,
  StickyNote,
  Eye,
} from 'lucide-react';
import { DEFAULT_POSTING_CALENDAR_TEMPLATE, type PostingCalendarLegendItem } from '@/domain/agencyPlatform';
import {
  buildVersionDiffLabels,
  getCurrentPostVersion,
  getPreviousPostVersion,
  type PostVersionRecord,
} from '@/domain/postVersions';
import { cn } from '@/lib/utils';
import { ptBR } from '@/lib/ptBR';

// ── Ícones SVG reais de redes sociais ──────────────────────
const InstagramIcon = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="ig-grad" x1="0%" y1="100%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#f09433" />
        <stop offset="25%" stopColor="#e6683c" />
        <stop offset="50%" stopColor="#dc2743" />
        <stop offset="75%" stopColor="#cc2366" />
        <stop offset="100%" stopColor="#bc1888" />
      </linearGradient>
    </defs>
    <rect x="2" y="2" width="20" height="20" rx="5" fill="url(#ig-grad)" />
    <circle cx="12" cy="12" r="4.5" stroke="white" strokeWidth="1.8" fill="none" />
    <circle cx="17.2" cy="6.8" r="1.1" fill="white" />
  </svg>
);

const FacebookIcon = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" xmlns="http://www.w3.org/2000/svg">
    <rect width="24" height="24" rx="5" fill="#1877F2" />
    <path d="M16.5 8H14.5C13.95 8 13.5 8.45 13.5 9V11H16.5L16 14H13.5V21H10.5V14H8.5V11H10.5V9C10.5 6.79 12.29 5 14.5 5H16.5V8Z" fill="white" />
  </svg>
);

const TikTokIcon = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" xmlns="http://www.w3.org/2000/svg">
    <rect width="24" height="24" rx="5" fill="#000000" />
    <path d="M16.5 5.5H14.5C14.5 7.5 15.5 8.5 17.5 8.5V10.5C16.5 10.5 15.5 10.2 14.5 9.5V15C14.5 17.5 12.5 19.5 10 19.5C7.5 19.5 5.5 17.5 5.5 15C5.5 12.5 7.5 10.5 10 10.5V12.5C8.6 12.5 7.5 13.6 7.5 15C7.5 16.4 8.6 17.5 10 17.5C11.4 17.5 12.5 16.4 12.5 15V5.5H14.5C14.5 5.5 14.5 5.5 16.5 5.5Z" fill="white" />
    <path d="M17.5 8.5C17.5 8.5 18.5 9 19.5 9V11C18.5 11 17.5 10.5 17.5 10.5V8.5Z" fill="#FF0050" />
  </svg>
);

const YouTubeIcon = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" xmlns="http://www.w3.org/2000/svg">
    <rect width="24" height="24" rx="5" fill="#FF0000" />
    <path d="M19.5 8.5C19.5 8.5 19.3 7.2 18.7 6.6C17.9 5.8 17 5.8 16.6 5.8C14.2 5.6 10.5 5.6 10.5 5.6H10.5C10.5 5.6 6.8 5.6 4.4 5.8C4 5.8 3.1 5.8 2.3 6.6C1.7 7.2 1.5 8.5 1.5 8.5S1.3 10 1.3 11.5V12.9C1.3 14.4 1.5 15.9 1.5 15.9C1.5 15.9 1.7 17.2 2.3 17.8C3.1 18.6 4.2 18.6 4.6 18.7C6.1 18.8 10.5 18.8 10.5 18.8C10.5 18.8 14.2 18.8 16.6 18.6C17 18.6 17.9 18.5 18.7 17.8C19.3 17.2 19.5 15.9 19.5 15.9C19.5 15.9 19.7 14.4 19.7 12.9V11.5C19.7 10 19.5 8.5 19.5 8.5ZM9 14.5V9L14 11.8L9 14.5Z" fill="white" />
  </svg>
);

const LinkedInIcon = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" xmlns="http://www.w3.org/2000/svg">
    <rect width="24" height="24" rx="5" fill="#0A66C2" />
    <path d="M7 10H5V19H7V10ZM6 9C5.4 9 5 8.6 5 8C5 7.4 5.4 7 6 7C6.6 7 7 7.4 7 8C7 8.6 6.6 9 6 9ZM19 19H17V14.5C17 13.4 16.1 12.5 15 12.5C13.9 12.5 13 13.4 13 14.5V19H11V10H13V11.3C13.7 10.5 14.8 10 16 10C17.7 10 19 11.3 19 13V19Z" fill="white" />
  </svg>
);

const XIcon = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" xmlns="http://www.w3.org/2000/svg">
    <rect width="24" height="24" rx="5" fill="#000000" />
    <path d="M17.5 5.5H15.2L12 9.7L8.8 5.5H5.5L9.8 11.5L5 18.5H7.3L10.8 14L14.3 18.5H17.5L12.9 12L17.5 5.5Z" fill="white" />
  </svg>
);

export const SOCIAL_PLATFORMS = [
  { id: 'instagram', label: 'Instagram', Icon: InstagramIcon },
  { id: 'facebook', label: 'Facebook', Icon: FacebookIcon },
  { id: 'tiktok', label: 'TikTok', Icon: TikTokIcon },
  { id: 'youtube', label: 'YouTube', Icon: YouTubeIcon },
  { id: 'linkedin', label: 'LinkedIn', Icon: LinkedInIcon },
  { id: 'x', label: 'X', Icon: XIcon },
] as const;

export type SocialPlatformId = typeof SOCIAL_PLATFORMS[number]['id'];

const SUGGESTED_PLATFORMS: Record<string, SocialPlatformId[]> = {
  feed: ['instagram', 'facebook'],
  reels: ['instagram', 'tiktok'],
  'video-influencer': ['youtube', 'tiktok', 'instagram'],
  events: ['instagram', 'facebook'],
  important: [],
};

export const getSuggestedPlatforms = (postType: string): SocialPlatformId[] =>
  SUGGESTED_PLATFORMS[postType] ?? ['instagram'];

export const WORKFLOW_STATUS_OPTIONS = [
  { value: 'rascunho', label: ptBR.workflow.status.rascunho, color: 'text-slate-700' },
  { value: 'revisao_interna', label: ptBR.workflow.status.revisaoInterna, color: 'text-amber-700' },
  { value: 'aprovado_interno', label: ptBR.workflow.status.aprovadoInterno, color: 'text-emerald-700' },
  { value: 'em_aprovacao_cliente', label: ptBR.workflow.status.emAprovacaoCliente, color: 'text-sky-700' },
  { value: 'revisao_cliente', label: ptBR.workflow.status.revisaoCliente, color: 'text-orange-700' },
  { value: 'aprovado_cliente', label: ptBR.workflow.status.aprovadoCliente, color: 'text-green-700' },
  { value: 'aguardando_agendamento', label: ptBR.workflow.status.aguardandoAgendamento, color: 'text-yellow-700' },
  { value: 'agendado', label: ptBR.workflow.status.agendado, color: 'text-indigo-700' },
  { value: 'publicado', label: ptBR.workflow.status.publicado, color: 'text-zinc-700' },
] as const;

export type WorkflowStatusId = typeof WORKFLOW_STATUS_OPTIONS[number]['value'];

export const APPROVAL_STATUS_OPTIONS = [
  { value: 'pending', label: ptBR.workflow.approval.pending },
  { value: 'approved', label: ptBR.workflow.approval.approved },
  { value: 'changes_requested', label: ptBR.workflow.approval.changesRequested },
  { value: 'rejected', label: ptBR.workflow.approval.rejected },
] as const;

export type ApprovalStatusId = typeof APPROVAL_STATUS_OPTIONS[number]['value'];

const LEGACY_WORKFLOW_STATUS_MAP: Record<string, WorkflowStatusId> = {
  planned: 'rascunho',
  draft: 'rascunho',
  rascunho: 'rascunho',
  revisao_interna: 'revisao_interna',
  in_review: 'revisao_interna',
  approved_internal: 'aprovado_interno',
  aprovado_interno: 'aprovado_interno',
  approved: 'aprovado_cliente',
  approved_client: 'aprovado_cliente',
  aprovado_cliente: 'aprovado_cliente',
  pending: 'em_aprovacao_cliente',
  em_aprovacao_cliente: 'em_aprovacao_cliente',
  revisao_cliente: 'revisao_cliente',
  changes_requested: 'revisao_cliente',
  rejected: 'revisao_cliente',
  cancelled: 'rascunho',
  pronto_agendamento: 'aguardando_agendamento',
  aguardando_agendamento: 'aguardando_agendamento',
  ready_to_schedule: 'aguardando_agendamento',
  scheduled: 'agendado',
  agendado: 'agendado',
  published: 'publicado',
  publicado: 'publicado',
  planejado: 'rascunho',
  revisaointerna: 'revisao_interna',
  enviadocliente: 'em_aprovacao_cliente',
  programado: 'agendado',
  postado: 'publicado',
};

const LEGACY_APPROVAL_STATUS_MAP: Record<string, ApprovalStatusId> = {
  pending: 'pending',
  in_review: 'pending',
  aguardando: 'pending',
  approved: 'approved',
  aprovado: 'approved',
  changes_requested: 'changes_requested',
  revision_requested: 'changes_requested',
  ajustes: 'changes_requested',
  rejected: 'rejected',
  reprovado: 'rejected',
};

const WORKFLOW_TONE_STYLES: Record<WorkflowStatusId, string> = {
  rascunho: 'border-slate-200 bg-slate-50 text-slate-700',
  revisao_interna: 'border-amber-200 bg-amber-50 text-amber-700',
  aprovado_interno: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  em_aprovacao_cliente: 'border-sky-200 bg-sky-50 text-sky-700',
  revisao_cliente: 'border-orange-200 bg-orange-50 text-orange-700',
  aprovado_cliente: 'border-green-200 bg-green-50 text-green-700',
  aguardando_agendamento: 'border-yellow-200 bg-yellow-50 text-yellow-700',
  agendado: 'border-indigo-200 bg-indigo-50 text-indigo-700',
  publicado: 'border-zinc-200 bg-zinc-100 text-zinc-700',
};

const WORKFLOW_OPERATIONAL_BADGES: Partial<
  Record<WorkflowStatusId, { label: string; className: string }>
> = {
  em_aprovacao_cliente: {
    label: '⏳ Pendente de aprovação',
    className: 'border-sky-200 bg-sky-50 text-sky-800',
  },
  aprovado_cliente: {
    label: '✅ Aprovado pelo cliente',
    className: 'border-green-200 bg-green-50 text-green-800',
  },
  aguardando_agendamento: {
    label: '🟡 Aguardando agendamento',
    className: 'border-yellow-200 bg-yellow-50 text-yellow-800',
  },
  agendado: {
    label: '📅 Agendado',
    className: 'border-indigo-200 bg-indigo-50 text-indigo-800',
  },
  publicado: {
    label: '🚀 Publicado',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  },
};

const APPROVAL_TONE_STYLES: Record<ApprovalStatusId, string> = {
  pending: 'border-amber-200 bg-amber-50 text-amber-700',
  approved: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  changes_requested: 'border-orange-200 bg-orange-50 text-orange-700',
  rejected: 'border-rose-200 bg-rose-50 text-rose-700',
};

export const normalizeWorkflowStatusId = (
  value: string | null | undefined
): WorkflowStatusId => {
  const raw = String(value || '').trim();
  if (!raw) return 'rascunho';

  const directMatch = WORKFLOW_STATUS_OPTIONS.find((option) => option.value === raw);
  if (directMatch) return directMatch.value;

  const normalized = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

  if (LEGACY_WORKFLOW_STATUS_MAP[normalized]) {
    return LEGACY_WORKFLOW_STATUS_MAP[normalized];
  }

  const upperNormalized = normalized.replace(/_/g, '').toUpperCase();
  if (LEGACY_WORKFLOW_STATUS_MAP[upperNormalized.toLowerCase()]) {
    return LEGACY_WORKFLOW_STATUS_MAP[upperNormalized.toLowerCase()];
  }

  return 'rascunho';
};

export const normalizeApprovalStatus = (
  value: string | null | undefined
): ApprovalStatusId => {
  const raw = String(value || '').trim();
  if (!raw) return 'pending';

  const directMatch = APPROVAL_STATUS_OPTIONS.find((option) => option.value === raw);
  if (directMatch) return directMatch.value;

  const normalized = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

  return LEGACY_APPROVAL_STATUS_MAP[normalized] || 'pending';
};

export const WorkflowTone: React.FC<{
  value: string | null | undefined;
  className?: string;
}> = ({ value, className }) => {
  const normalized = normalizeWorkflowStatusId(value);
  const option =
    WORKFLOW_STATUS_OPTIONS.find((entry) => entry.value === normalized) ||
    WORKFLOW_STATUS_OPTIONS[0];

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold',
        WORKFLOW_TONE_STYLES[normalized],
        className
      )}
    >
      {option.label}
    </span>
  );
};

export const ApprovalTone: React.FC<{
  value: string | null | undefined;
  className?: string;
}> = ({ value, className }) => {
  const normalized = normalizeApprovalStatus(value);
  const option =
    APPROVAL_STATUS_OPTIONS.find((entry) => entry.value === normalized) ||
    APPROVAL_STATUS_OPTIONS[0];

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold',
        APPROVAL_TONE_STYLES[normalized],
        className
      )}
    >
      {option.label}
    </span>
  );
};

export const getWorkflowOperationalBadge = (value: string | null | undefined) => {
  const normalized = normalizeWorkflowStatusId(value);
  return WORKFLOW_OPERATIONAL_BADGES[normalized] || null;
};

const getContrastTextColor = (hex: string | null | undefined, fallback = '#27354d') => {
  const normalized = String(hex || '').trim();
  if (!/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(normalized)) return fallback;
  const full =
    normalized.length === 4
      ? `#${normalized[1]}${normalized[1]}${normalized[2]}${normalized[2]}${normalized[3]}${normalized[3]}`
      : normalized;
  const red = parseInt(full.slice(1, 3), 16);
  const green = parseInt(full.slice(3, 5), 16);
  const blue = parseInt(full.slice(5, 7), 16);
  const luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255;
  return luminance > 0.68 ? '#27354d' : '#ffffff';
};

export type CalendarClient = {
  id: string;
  name: string;
  logo_url?: string | null;
  plan?: string | null;
};

export type PostingCalendarRecord = {
  id: string;
  client_id: string;
  month: number;
  year: number;
  title?: string | null;
  template_name?: string | null;
  status?: string | null;
  exported_file_url?: string | null;
  approval_status?: string | null;
  approval_requested_at?: string | null;
  approved_at?: string | null;
  approved_by_name?: string | null;
};

export type PostingCalendarItemRecord = {
  id: string;
  calendar_id: string;
  client_id?: string | null;
  parent_post_id?: string | null;
  version_number?: number | null;
  is_current_version?: boolean | null;
  change_log?: string[] | null;
  change_reason?: string | null;
  post_date: string;
  day_number: number;
  post_type: string;
  title?: string | null;
  description?: string | null;
  notes?: string | null;
  image_url?: string | null;
  video_url?: string | null;
  label_color?: string | null;
  status?: string | null;
  workflow_status?: WorkflowStatusId | null;
  owner_role?: string | null;
  revision_count?: number | null;
  approval_status?: ApprovalStatusId | null;
  approval_notes?: string | null;
  approved_at?: string | null;
  approved_by_name?: string | null;
  current_version_id?: string | null;
  current_version_number?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
  scheduled_date?: string | null;
  published_at?: string | null;
  versions?: PostVersionRecord[];
  current_version?: PostVersionRecord | null;
  previous_version?: PostVersionRecord | null;
};

export type CalendarCell = {
  day: number | null;
  isCurrentMonth?: boolean;
};

export type PostingCalendarDayEditorState = {
  open: boolean;
  day: number | null;
  itemId: string | null;
  postType: string;
  title: string;
  description: string;
  notes: string;
  labelColor: string;
  workflowStatus: WorkflowStatusId;
  platforms: SocialPlatformId[];
  imageUrl: string;
  videoUrl: string;
  approvalStatus: ApprovalStatusId;
  changeReason: string;
  clientFeedback: string;
  scheduledDate: string;
  scheduledTime: string;
  selectedVersionId: string | null;
  versions: PostVersionRecord[];
  saving: boolean;
};

export const MONTH_OPTIONS = Array.from({ length: 12 }, (_, index) => ({
  value: index,
  label: format(new Date(2026, index, 1), 'MMMM', { locale: dateFnsPtBR }),
}));

export const buildInitialDayEditor = (): PostingCalendarDayEditorState => ({
  open: false,
  day: null,
  itemId: null,
  postType: DEFAULT_POSTING_CALENDAR_TEMPLATE.legend_items[0]?.id || 'feed',
  title: '',
  description: '',
  notes: '',
  labelColor: '',
  workflowStatus: 'rascunho',
  platforms: getSuggestedPlatforms(DEFAULT_POSTING_CALENDAR_TEMPLATE.legend_items[0]?.id || 'feed'),
  imageUrl: '',
  videoUrl: '',
  approvalStatus: 'pending',
  changeReason: '',
  clientFeedback: '',
  scheduledDate: '',
  scheduledTime: '',
  selectedVersionId: null,
  versions: [],
  saving: false,
});

export const buildMonthCells = (year: number, month: number): CalendarCell[] => {
  const monthDate = new Date(year, month, 1);
  const start = startOfWeek(startOfMonth(monthDate), { weekStartsOn: 0 });
  const end = endOfWeek(endOfMonth(monthDate), { weekStartsOn: 0 });

  const cells: CalendarCell[] = [];
  let cursor = start;

  while (cursor.getTime() <= end.getTime()) {
    cells.push({
      day: Number(format(cursor, 'd')),
      isCurrentMonth: isSameMonth(cursor, monthDate),
    });
    cursor = addDays(cursor, 1);
  }

  return cells;
};

export const buildExportFileName = (
  clientName: string,
  month: number,
  year: number,
  extension: 'png' | 'pdf'
) =>
  `calendario-${String(clientName || 'cliente')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')}-${year}-${String(month + 1).padStart(2, '0')}.${extension}`;

export const blobFromDataUrl = async (dataUrl: string) => {
  const response = await fetch(dataUrl);
  return response.blob();
};

export const downloadBlob = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};

export const clampNumber = (value: number, fallback: number, min = 0) => {
  if (Number.isNaN(value)) return fallback;
  return Math.max(min, value);
};

export const FieldLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="text-ui-label">{children}</span>
);

export const SectionTitle: React.FC<{ title: string; subtitle?: string }> = ({ title, subtitle }) => (
  <div className="space-y-1">
    <h2 className="text-[15px] font-semibold text-[#111111]">{title}</h2>
    {subtitle ? <p className="text-[12px] text-[#6b7280]">{subtitle}</p> : null}
  </div>
);

export const InlineStat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <span className="text-[12px] text-[#6b7280]">
    {label} <span className="font-medium text-[#111111]">{value}</span>
  </span>
);

interface PostingCalendarDayEditorProps {
  state: PostingCalendarDayEditorState;
  legendItems: PostingCalendarLegendItem[];
  uploadingAsset: 'image' | 'video' | null;
  onChange: (patch: Partial<PostingCalendarDayEditorState>) => void;
  onClose: () => void;
  onSave: () => void;
  onDelete: (() => void) | null;
  onConfirmSchedule?: (() => void) | null;
  onMarkPublished?: (() => void) | null;
  onUploadAsset: (kind: 'image' | 'video', file: File) => Promise<void>;
}

export const PostingCalendarDayEditor: React.FC<PostingCalendarDayEditorProps> = ({
  state,
  legendItems,
  uploadingAsset,
  onChange,
  onClose,
  onSave,
  onDelete,
  onConfirmSchedule,
  onMarkPublished,
  onUploadAsset,
}) => {
  if (!state.open) return null;

  const selectedLegend =
    legendItems.find((item) => item.id === state.postType) ||
    legendItems[0] ||
    DEFAULT_POSTING_CALENDAR_TEMPLATE.legend_items[0];

  const selectedPlatforms = new Set(state.platforms);

  const togglePlatform = (platformId: SocialPlatformId) => {
    const next = new Set(selectedPlatforms);
    if (next.has(platformId)) {
      next.delete(platformId);
    } else {
      next.add(platformId);
    }
    onChange({ platforms: Array.from(next) });
  };

  const handleTypeChange = (postType: string) => {
    const nextLegend = legendItems.find((item) => item.id === postType);
    onChange({
      postType,
      labelColor: nextLegend?.color || '',
      platforms: getSuggestedPlatforms(postType),
    });
  };

  const handleFileInput = async (
    event: React.ChangeEvent<HTMLInputElement>,
    kind: 'image' | 'video'
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await onUploadAsset(kind, file);
    event.target.value = '';
  };

  const workflowValue = state.workflowStatus || 'rascunho';
  const currentVersion = getCurrentPostVersion(state.versions);
  const previousVersion = getPreviousPostVersion(state.versions);
  const inspectedVersion =
    state.versions.find((version) => version.id === state.selectedVersionId) || previousVersion;
  const versionDiff = buildVersionDiffLabels(currentVersion, previousVersion);
  const operationalBadge = getWorkflowOperationalBadge(workflowValue);
  const canConfirmSchedule =
    Boolean(state.itemId) &&
    (workflowValue === 'aguardando_agendamento' || workflowValue === 'aprovado_cliente');
  const canMarkPublished = Boolean(state.itemId) && workflowValue === 'agendado';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 backdrop-blur-[2px] p-4">
      <div className="flex max-h-[92vh] w-full max-w-[820px] flex-col overflow-hidden rounded-[28px] border border-border bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#c7d2fe] text-[14px] font-semibold text-[#4f46e5]">
              {state.day ?? '•'}
            </div>
            <div>
              <p className="text-ui-label">{state.day ? `${ptBR.calendar.editor.dayLabel} ${state.day} • ${selectedLegend?.label || ptBR.calendar.editor.defaultCategory}` : ptBR.calendar.editor.defaultCategory}</p>
              <h2 className="text-[18px] font-semibold text-[#111111]">
                {state.itemId ? ptBR.calendar.editor.editTitle : ptBR.calendar.editor.createTitle}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-border text-[#667085] transition hover:bg-[#f8fafc]"
          >
            <X size={18} />
          </button>
        </div>

        <div className="grid flex-1 gap-0 overflow-y-auto border-b border-border lg:grid-cols-[1.25fr_0.75fr]">
          <div className="space-y-5 px-6 py-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <FieldLabel>{ptBR.calendar.editor.category}</FieldLabel>
                <select
                  value={state.postType}
                  onChange={(event) => handleTypeChange(event.target.value)}
                  className="select-control font-bold"
                  style={{
                    backgroundColor: selectedLegend?.color || '#ffffff',
                    color: selectedLegend?.textColor || '#111111',
                    borderColor: selectedLegend?.color ? 'transparent' : undefined
                  }}
                >
                  {legendItems.map((item) => (
                    <option key={item.id} value={item.id} style={{ backgroundColor: '#ffffff', color: '#111111' }}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <FieldLabel>{ptBR.calendar.editor.workflowStatus}</FieldLabel>
                <select
                  value={workflowValue}
                  disabled
                  className="select-control"
                >
                  {WORKFLOW_STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <p className="text-[12px] text-[#667085]">
                  O status operacional agora segue apenas o fluxo oficial de aprovação, agendamento e publicação.
                </p>
              </div>
            </div>

            <div className="space-y-3 rounded-[24px] border border-border bg-[#fbfcfe] px-4 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <FieldLabel>{ptBR.calendar.editor.scheduleDate}</FieldLabel>
                  <p className="mt-1 text-[12px] text-[#667085]">{ptBR.calendar.editor.scheduleHint}</p>
                </div>
                {operationalBadge ? (
                  <span
                    className={cn(
                      'inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold',
                      operationalBadge.className
                    )}
                  >
                    {operationalBadge.label}
                  </span>
                ) : null}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <FieldLabel>{ptBR.calendar.editor.scheduleDate}</FieldLabel>
                  <input
                    type="date"
                    value={state.scheduledDate}
                    onChange={(event) => onChange({ scheduledDate: event.target.value })}
                    className="field-control"
                  />
                </div>
                <div className="space-y-2">
                  <FieldLabel>{ptBR.calendar.editor.scheduleTime}</FieldLabel>
                  <input
                    type="time"
                    value={state.scheduledTime}
                    onChange={(event) => onChange({ scheduledTime: event.target.value })}
                    className="field-control"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <FieldLabel>{ptBR.calendar.editor.socialNetworks}</FieldLabel>
              <div className="flex flex-wrap gap-2">
                {SOCIAL_PLATFORMS.map(({ id, label, Icon }) => {
                  const active = selectedPlatforms.has(id);
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => togglePlatform(id)}
                      className={cn(
                        'inline-flex items-center gap-2 rounded-full border px-3 py-2 text-[13px] font-medium transition',
                        active
                          ? 'border-[#98a2b3] bg-white text-[#111111] shadow-sm'
                          : 'border-border bg-[#f8fafc] text-[#667085]'
                      )}
                    >
                      <Icon />
                      {label}
                      {active ? <span className="text-[#16a34a]">●</span> : null}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <FieldLabel>{ptBR.calendar.editor.title}</FieldLabel>
              <input
                type="text"
                value={state.title}
                onChange={(event) => onChange({ title: event.target.value })}
                className="field-control"
                placeholder={ptBR.calendar.editor.titlePlaceholder}
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-2">
                <FieldLabel>{ptBR.calendar.editor.description}</FieldLabel>
                <div className="relative">
                  <AlignLeft className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-[#98a2b3]" />
                  <textarea
                    value={state.description}
                    onChange={(event) => onChange({ description: event.target.value })}
                    className="min-h-[116px] w-full rounded-[20px] border border-border bg-white px-10 py-3 text-[14px] text-[#111111] shadow-sm outline-none transition focus:border-[#b9d7ff] focus:ring-4 focus:ring-[#d9e9ff]"
                    placeholder={ptBR.calendar.editor.descriptionPlaceholder}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <FieldLabel>{ptBR.calendar.editor.internalNotes}</FieldLabel>
                <div className="relative">
                  <StickyNote className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-[#98a2b3]" />
                  <textarea
                    value={state.notes}
                    onChange={(event) => onChange({ notes: event.target.value })}
                    className="min-h-[116px] w-full rounded-[20px] border border-border bg-white px-10 py-3 text-[14px] text-[#111111] shadow-sm outline-none transition focus:border-[#b9d7ff] focus:ring-4 focus:ring-[#d9e9ff]"
                    placeholder={ptBR.calendar.editor.notesPlaceholder}
                  />
                </div>
              </div>
            </div>

            {state.itemId ? (
              <div className="space-y-2">
                <FieldLabel>{ptBR.calendar.editor.changeReason}</FieldLabel>
                <textarea
                  value={state.changeReason}
                  onChange={(event) => onChange({ changeReason: event.target.value })}
                  className="min-h-[88px] w-full rounded-[20px] border border-border bg-white px-4 py-3 text-[14px] text-[#111111] shadow-sm outline-none transition focus:border-[#b9d7ff] focus:ring-4 focus:ring-[#d9e9ff]"
                  placeholder={ptBR.calendar.editor.changeReasonPlaceholder}
                />

                {state.workflowStatus === 'revisao_cliente' && state.clientFeedback ? (
                  <div className="rounded-[18px] border border-orange-200 bg-orange-50 px-4 py-3 text-[13px] text-orange-700">
                    <p className="mb-1 font-semibold">{ptBR.calendar.editor.clientRevisionNote}</p>
                    <p className="leading-relaxed">{state.clientFeedback}</p>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="border-l border-border bg-[#fbfcfe] px-6 py-5">
            <div className="space-y-5">
              <div className="space-y-2">
                <FieldLabel>{ptBR.calendar.editor.image}</FieldLabel>
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-[18px] border border-dashed border-border bg-white px-4 py-3 text-[13px] font-medium text-[#475467] transition hover:border-[#b9d7ff] hover:bg-[#f8fbff]">
                  {uploadingAsset === 'image' ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
                  {ptBR.calendar.editor.uploadImage}
                  <input type="file" accept="image/*" className="hidden" onChange={(event) => void handleFileInput(event, 'image')} />
                </label>

                <div className="overflow-hidden rounded-[22px] border border-dashed border-border bg-white min-h-[180px]">
                  {state.imageUrl ? (
                    <img src={state.imageUrl} alt={state.title || 'Visualização'} className="h-[180px] w-full object-cover" />
                  ) : (
                    <div className="flex h-[180px] flex-col items-center justify-center gap-2 text-[#98a2b3]">
                      <ImageIcon className="h-6 w-6" />
                      <span className="text-[13px]">{ptBR.calendar.editor.noImage}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <FieldLabel>{ptBR.calendar.editor.video}</FieldLabel>
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-[18px] border border-dashed border-border bg-white px-4 py-3 text-[13px] font-medium text-[#475467] transition hover:border-[#b9d7ff] hover:bg-[#f8fbff]">
                  {uploadingAsset === 'video' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Video className="h-4 w-4" />}
                  {ptBR.calendar.editor.uploadVideo}
                  <input type="file" accept="video/*" className="hidden" onChange={(event) => void handleFileInput(event, 'video')} />
                </label>

                <div className="overflow-hidden rounded-[22px] border border-dashed border-border bg-white min-h-[180px]">
                  {state.videoUrl ? (
                    <video src={state.videoUrl} controls className="h-[180px] w-full object-cover" />
                  ) : (
                    <div className="flex h-[180px] flex-col items-center justify-center gap-2 text-[#98a2b3]">
                      <PlayCircle className="h-6 w-6" />
                      <span className="text-[13px]">{ptBR.calendar.editor.noVideo}</span>
                    </div>
                  )}
                </div>
              </div>

              {state.itemId ? (
                <div className="space-y-3 rounded-[24px] border border-border bg-white p-4 shadow-sm">
                  <div className="space-y-1">
                    <FieldLabel>{ptBR.calendar.editor.versionHistory}</FieldLabel>
                    <p className="text-[12px] text-[#667085]">{ptBR.calendar.editor.latestVersionHint}</p>
                  </div>

                  {currentVersion ? (
                    <div className="rounded-[18px] border border-emerald-200 bg-emerald-50 px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-[13px] font-semibold text-emerald-800">
                            {ptBR.calendar.editor.currentVersion}: v{currentVersion.version_number}
                          </p>
                          <p className="mt-1 text-[12px] text-emerald-700">
                            {currentVersion.change_reason || 'Versao atual em uso no fluxo.'}
                          </p>
                        </div>
                        <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                          Atual
                        </span>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        {versionDiff.map((change) => (
                          <span
                            key={`${currentVersion.id}-${change}`}
                            className="rounded-full border border-emerald-200 bg-white px-2.5 py-1 text-[11px] font-medium text-emerald-700"
                          >
                            {change}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="max-h-[260px] space-y-3 overflow-y-auto pr-1">
                    {state.versions.map((version) => {
                      const isCurrent = version.is_current;
                      const diffLabels = buildVersionDiffLabels(version, state.versions.find((entry) => entry.version_number === version.version_number - 1) || null);

                      return (
                        <div key={version.id} className="relative pl-5">
                          <span className="absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full bg-[#1677ff]" />
                          <div className="rounded-[18px] border border-border bg-[#fbfcfe] px-4 py-3">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-[13px] font-semibold text-[#111111]">
                                  v{version.version_number}
                                </p>
                                <p className="mt-1 text-[12px] text-[#667085]">
                                  {version.change_reason || 'Atualizacao registrada no historico.'}
                                </p>
                              </div>

                              {!isCurrent ? (
                                <button
                                  type="button"
                                  onClick={() => onChange({ selectedVersionId: version.id })}
                                  className="inline-flex items-center gap-1 rounded-full border border-border bg-white px-3 py-1.5 text-[11px] font-medium text-[#475467] transition hover:bg-[#f8fafc]"
                                >
                                  <Eye size={12} />
                                  {ptBR.calendar.editor.viewPreviousVersion}
                                </button>
                              ) : (
                                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                                  Atual
                                </span>
                              )}
                            </div>

                            <div className="mt-3 flex flex-wrap gap-2">
                              {diffLabels.map((change) => (
                                <span
                                  key={`${version.id}-${change}`}
                                  className="rounded-full border border-border bg-white px-2.5 py-1 text-[11px] font-medium text-[#475467]"
                                >
                                  {change}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {inspectedVersion ? (
                    <div className="rounded-[18px] border border-border bg-[#f8fafc] px-4 py-4">
                      <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#667085]">
                        {ptBR.calendar.editor.previousVersion}: v{inspectedVersion.version_number}
                      </p>
                      <p className="mt-2 text-[14px] font-semibold text-[#111111]">
                        {inspectedVersion.title || 'Sem titulo'}
                      </p>
                      {inspectedVersion.content.description ? (
                        <p className="mt-2 text-[13px] leading-relaxed text-[#475467]">
                          {inspectedVersion.content.description}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
          <div className="flex items-center gap-2 text-[12px] text-[#98a2b3]">
            <CalendarDays className="h-4 w-4" />
            {ptBR.calendar.editor.footerHint}
          </div>

          <div className="flex items-center gap-3">
            {canConfirmSchedule && onConfirmSchedule ? (
              <button
                type="button"
                onClick={onConfirmSchedule}
                disabled={state.saving || !state.scheduledDate || !state.scheduledTime}
                className="inline-flex items-center gap-2 rounded-full border border-yellow-300 bg-yellow-50 px-4 py-2.5 text-[14px] font-medium text-yellow-800 transition hover:bg-yellow-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {ptBR.calendar.editor.confirmSchedule}
              </button>
            ) : null}

            {canMarkPublished && onMarkPublished ? (
              <button
                type="button"
                onClick={onMarkPublished}
                disabled={state.saving}
                className="inline-flex items-center gap-2 rounded-full border border-emerald-300 bg-emerald-50 px-4 py-2.5 text-[14px] font-medium text-emerald-800 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {ptBR.calendar.editor.markPublished}
              </button>
            ) : null}

            {onDelete ? (
              <button
                type="button"
                onClick={onDelete}
                disabled={state.saving}
                className="inline-flex items-center gap-2 rounded-full border border-red-200 px-4 py-2.5 text-[14px] font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Trash2 size={14} />
                {ptBR.calendar.editor.delete}
              </button>
            ) : null}

            <button
              type="button"
              onClick={onClose}
              disabled={state.saving}
              className="rounded-full border border-border px-5 py-2.5 text-[14px] font-medium text-[#475467] transition hover:bg-[#f8fafc] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {ptBR.calendar.editor.cancel}
            </button>

            <button
              type="button"
              onClick={onSave}
              disabled={state.saving || (Boolean(state.itemId) && !state.changeReason.trim())}
              className="inline-flex items-center gap-2 rounded-full bg-[#1677ff] px-5 py-2.5 text-[14px] font-semibold text-white shadow-sm transition hover:bg-[#136be3] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {state.saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {state.itemId ? ptBR.calendar.editor.save : ptBR.calendar.editor.create}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const getLegendPillStyles = (legend: PostingCalendarLegendItem | null | undefined) => {
  const background = legend?.color || '#dbeafe';
  const textColor = legend?.textColor || getContrastTextColor(background);
  return { backgroundColor: background, color: textColor };
};
