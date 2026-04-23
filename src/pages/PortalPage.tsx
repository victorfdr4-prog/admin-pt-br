import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  CheckCircle2,
  ExternalLink,
  File,
  FileText,
  Image as ImageIcon,
  Link2,
  MessageSquarePlus,
  Paperclip,
  RefreshCw,
  Search,
  Send,
  Video,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR as dateFnsPtBR } from 'date-fns/locale';
import { AnimatePresence, motion } from 'framer-motion';
import { useParams } from 'react-router-dom';
import PortalLoading from '@/components/PortalLoading';
import PortalError from '@/components/PortalError';
import PostingCalendarTemplateClassic from '@/components/posting-calendar/PostingCalendarTemplateClassic';
import {
  DEFAULT_POSTING_CALENDAR_TEMPLATE,
  normalizePostingCalendarTemplateConfig,
  type PostingCalendarTemplateConfig,
} from '@/domain/agencyPlatform';
import {
  WorkflowTone,
  buildMonthCells,
  normalizeWorkflowStatusId,
  type PostingCalendarItemRecord,
  type PostingCalendarRecord,
} from '@/components/posting-calendar/PostingCalendarShared';
import { buildVersionDiffLabels, getCurrentPostVersion, getPreviousPostVersion } from '@/domain/postVersions';
import { PostingCalendarService } from '@/services/posting-calendar.service';
import { systemError, systemLog } from '@/services/system-log.service';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/sonner';
import { readFileAsDataUrl } from '@/services/_shared';

interface PortalFile {
  id: string;
  name: string;
  mime_type: string;
  size: number;
  drive_view_url: string;
  preview_url: string;
  download_url: string;
}

interface PortalPayload {
  portal: {
    id: string;
    token: string;
    is_active: boolean;
  };
  client: {
    id: string;
    name: string;
    logo_url?: string | null;
  };
  branding?: {
    logo_url?: string | null;
  };
  calendar: PostingCalendarRecord | null;
  files: PortalFile[];
}

type PortalTab = 'calendar' | 'approval' | 'files' | 'requests';
type ReviewTag = 'Texto' | 'Imagem' | 'CTA' | 'Design' | 'Outro';
type PortalMonthOption = {
  key: string;
  label: string;
  year: number;
  monthIndex: number;
  monthNumber: number;
  calendarId?: string | null;
  isCurrent: boolean;
};
type PortalIntakeType = 'creative' | 'campaign' | 'support' | 'general';
type PortalIntakeKind = {
  id: string;
  label: string;
  description: string;
  intakeType: PortalIntakeType;
};

const PORTAL_VISIBLE_STATUS_FILTER = [
  'em_aprovacao_cliente',
  'revisao_cliente',
  'aprovado_cliente',
  'aguardando_agendamento',
  'agendado',
  'publicado',
] as const;
const PORTAL_ATTACHMENT_MAX_BYTES = 8 * 1024 * 1024;
const PORTAL_REQUEST_KIND_OPTIONS: PortalIntakeKind[] = [
  { id: 'post', label: 'Post avulso', description: 'Pedido pontual de conteúdo estático.', intakeType: 'creative' },
  { id: 'video', label: 'Vídeo', description: 'Solicitação de roteiro, edição ou vídeo curto.', intakeType: 'creative' },
  { id: 'campaign', label: 'Campanha', description: 'Ação com foco em mídia ou lançamento.', intakeType: 'campaign' },
  { id: 'support', label: 'Ajuste urgente', description: 'Correção, revisão ou apoio operacional.', intakeType: 'support' },
  { id: 'other', label: 'Outro', description: 'Qualquer demanda fora dos blocos acima.', intakeType: 'general' },
];

const REVIEW_TAG_OPTIONS: ReviewTag[] = ['Texto', 'Imagem', 'CTA', 'Design', 'Outro'];

const buildPeriodKey = (year: number, monthIndex: number) =>
  `${year}-${String(monthIndex + 1).padStart(2, '0')}`;

const normalizeCalendarMonthIndex = (rawMonth: number | string | null | undefined) => {
  const numericMonth = Number(rawMonth);
  if (!Number.isFinite(numericMonth)) return new Date().getMonth();
  if (numericMonth === 0) return 0;
  if (numericMonth >= 1 && numericMonth <= 12) return numericMonth - 1;
  if (numericMonth >= 0 && numericMonth <= 11) return numericMonth;
  return new Date().getMonth();
};

const formatPortalMonthLabel = (year: number, monthIndex: number) => {
  const label = format(new Date(year, monthIndex, 1), 'MMMM yyyy', { locale: dateFnsPtBR });
  return label.charAt(0).toUpperCase() + label.slice(1);
};

const buildCurrentMonthOption = (baseDate = new Date()): PortalMonthOption => {
  const year = baseDate.getFullYear();
  const monthIndex = baseDate.getMonth();
  return {
    key: buildPeriodKey(year, monthIndex),
    label: formatPortalMonthLabel(year, monthIndex),
    year,
    monthIndex,
    monthNumber: monthIndex + 1,
    calendarId: null,
    isCurrent: true,
  };
};

const buildMonthWindow = (year: number, monthIndex: number) => {
  const start = new Date(year, monthIndex, 1);
  const end = new Date(year, monthIndex + 1, 0);
  return {
    startIso: format(start, 'yyyy-MM-dd'),
    endIso: format(end, 'yyyy-MM-dd'),
  };
};

const buildPortalMonthOptions = (rows: Array<Record<string, any>> = [], baseDate = new Date()) => {
  const currentOption = buildCurrentMonthOption(baseDate);
  const options = new Map<string, PortalMonthOption>();
  options.set(currentOption.key, currentOption);

  rows.forEach((row) => {
    const year = Number(row.year || currentOption.year);
    const monthIndex = normalizeCalendarMonthIndex(row.month);
    const key = buildPeriodKey(year, monthIndex);

    if (!options.has(key)) {
      options.set(key, {
        key,
        label: formatPortalMonthLabel(year, monthIndex),
        year,
        monthIndex,
        monthNumber: monthIndex + 1,
        calendarId: row.id ? String(row.id) : null,
        isCurrent: key === currentOption.key,
      });
    }
  });

  return Array.from(options.values()).sort((left, right) => {
    const leftTime = new Date(left.year, left.monthIndex, 1).getTime();
    const rightTime = new Date(right.year, right.monthIndex, 1).getTime();
    return leftTime - rightTime;
  });
};

const getFileIcon = (mimeType: string) => {
  if (mimeType?.includes('pdf')) return <FileText size={18} className="text-red-500" />;
  if (mimeType?.startsWith('image/')) return <ImageIcon size={18} className="text-blue-500" />;
  if (mimeType?.startsWith('video/')) return <Video size={18} className="text-purple-500" />;
  return <File size={18} className="text-slate-400" />;
};

const formatSize = (value: number) => {
  if (!value) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = value;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
};

const extractDayNumber = (post: PostingCalendarItemRecord) => {
  const operationalDate = post.scheduled_date || post.post_date || null;
  if (operationalDate) {
    const parsed = new Date(operationalDate);
    if (!Number.isNaN(parsed.getTime())) return parsed.getDate();
  }
  if (typeof post.day_number === 'number' && Number.isFinite(post.day_number)) return post.day_number;
  if (!post.post_date) return 0;
  const parsed = new Date(post.post_date);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getDate();
};

const getPortalOperationalDate = (post: PostingCalendarItemRecord) => post.scheduled_date || post.post_date || null;

const parsePortalDateValue = (value?: string | null) => {
  const raw = String(value || '').trim();
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [year, month, day] = raw.split('-').map(Number);
    return new Date(year, month - 1, day);
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatPortalDate = (value?: string | null) => {
  const parsed = parsePortalDateValue(value);
  return parsed ? format(parsed, 'dd/MM/yyyy') : 'Sem data';
};

const formatPortalTime = (value?: string | null) => {
  const parsed = parsePortalDateValue(value);
  if (!parsed) return 'A definir';
  const label = format(parsed, 'HH:mm');
  return label === '00:00' ? 'A definir' : label;
};

const getUrgencyTone = (postDate?: string | null) => {
  if (!postDate) {
    return { label: '🟢 tranquilo', className: 'border-emerald-200 bg-emerald-50 text-emerald-700' };
  }

  const target = parsePortalDateValue(postDate);
  if (!target) {
    return { label: '🟢 tranquilo', className: 'border-emerald-200 bg-emerald-50 text-emerald-700' };
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const publishDay = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime();
  const diffDays = Math.round((publishDay - today) / 86400000);

  if (diffDays <= 1) {
    return { label: '🔴 urgente', className: 'border-rose-200 bg-rose-50 text-rose-700' };
  }
  if (diffDays <= 3) {
    return { label: '🟡 atenção', className: 'border-amber-200 bg-amber-50 text-amber-700' };
  }
  return { label: '🟢 tranquilo', className: 'border-emerald-200 bg-emerald-50 text-emerald-700' };
};

const getWaitingLabel = (postDate?: string | null) => {
  if (!postDate) return '⏱ aguardando sem data definida';
  const parsed = parsePortalDateValue(postDate);
  if (!parsed) return '⏱ aguardando sem data válida';
  const diff = Math.max(0, Math.floor((Date.now() - parsed.getTime()) / 86400000));
  return `⏱ aguardando há ${diff} dia(s)`;
};

const VersionAuditBlock: React.FC<{ item: PostingCalendarItemRecord }> = ({ item }) => {
  const currentVersion = item.current_version || null;
  const previousVersion = item.previous_version || null;
  const changes = buildVersionDiffLabels(currentVersion, previousVersion);

  if (!currentVersion) return null;

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Versão atual</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">v{currentVersion.version_number}</p>
        </div>
        <WorkflowTone value={item.workflow_status} />
      </div>

      <div className="space-y-2">
        <p className="text-[12px] font-semibold text-slate-700">O que mudou</p>
        <div className="flex flex-wrap gap-2">
          {changes.map((change) => (
            <span
              key={`${item.id}-${change}`}
              className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700"
            >
              {change}
            </span>
          ))}
        </div>
      </div>

      {currentVersion.change_reason ? (
        <p className="text-xs text-slate-600">
          <strong>Motivo desta versão:</strong> {currentVersion.change_reason}
        </p>
      ) : null}

      {previousVersion ? (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Versão anterior</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">
            v{previousVersion.version_number} • {previousVersion.title || 'Sem título'}
          </p>
          {previousVersion.content.image_url ? (
            <img
              src={previousVersion.content.image_url}
              alt={previousVersion.title || 'Versão anterior'}
              className="mt-3 h-28 w-full rounded-xl object-cover"
            />
          ) : null}
          {previousVersion.content.description ? (
            <p className="mt-2 text-xs leading-relaxed text-slate-500">{previousVersion.content.description}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

export const PortalPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [loading, setLoading] = useState(true);
  const [postsLoading, setPostsLoading] = useState(true);
  const [filesLoading, setFilesLoading] = useState(false);
  const [error, setError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [payload, setPayload] = useState<PortalPayload | null>(null);
  const [client, setClient] = useState<PortalPayload['client'] | null>(null);
  const [posts, setPosts] = useState<PostingCalendarItemRecord[]>([]);
  const [templateConfig, setTemplateConfig] = useState<PostingCalendarTemplateConfig>(() =>
    normalizePostingCalendarTemplateConfig(DEFAULT_POSTING_CALENDAR_TEMPLATE)
  );
  const [monthOptions, setMonthOptions] = useState<PortalMonthOption[]>(() => [buildCurrentMonthOption()]);
  const [selectedPeriodKey, setSelectedPeriodKey] = useState(() => buildCurrentMonthOption().key);
  const [reloadTick, setReloadTick] = useState(0);
  const [activeTab, setActiveTab] = useState<PortalTab>('calendar');
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [decisionLoadingId, setDecisionLoadingId] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [reviewTags, setReviewTags] = useState<Record<string, ReviewTag[]>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [requestTitle, setRequestTitle] = useState('');
  const [requestDescription, setRequestDescription] = useState('');
  const [requestReferences, setRequestReferences] = useState('');
  const [requestKindId, setRequestKindId] = useState<string>(PORTAL_REQUEST_KIND_OPTIONS[0].id);
  const [requestAttachment, setRequestAttachment] = useState<File | null>(null);
  const [requestSubmitting, setRequestSubmitting] = useState(false);

  const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL || '');
  const anonKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY || '');

  const loadPortal = useCallback(async () => {
    console.group('[PortalPage] Carga inicial');
    console.log('slug:', slug);
    console.log('loading inicial:', true);
    console.groupEnd();

    try {
      setLoading(true);
      setError(false);
      setErrorMessage('');

      if (!slug) {
        throw new Error('Slug do portal ausente.');
      }

      console.log('[PortalPage] Consulta do portal iniciada');
      const response = await fetch(`${supabaseUrl}/functions/v1/portal-view?token=${encodeURIComponent(slug)}`, {
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
        },
      });

      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        console.error('[PortalPage] Erro na consulta', {
          tabela: 'portal-view',
          token: slug,
          error: body,
        });
        throw new Error(String((body as any)?.error || 'Não foi possível carregar o portal.'));
      }

      const portalData = body as PortalPayload;
      const resolvedClient = portalData?.client ?? null;
      const resolvedClientId = resolvedClient?.id ?? null;

      console.log('[PortalPage] Portal carregado');
      console.log('🔍 Cliente carregado:', resolvedClient);
      console.log('portalData:', portalData);
      console.log('clientId resolvido:', resolvedClientId);
      void systemLog({
        scope: 'portal',
        action: 'portal_loaded',
        clientId: resolvedClientId,
        tableName: 'clients',
        message: 'Portal carregado com cliente resolvido.',
        data: {
          slug,
          portalId: portalData?.portal?.id ?? null,
        },
      });

      setPayload(portalData);
      setClient(resolvedClient);

      if (!resolvedClientId) {
        console.warn('[PortalPage] clientId ausente');
        throw new Error('Cliente do portal não foi resolvido.');
      }

      try {
        const { template } = await PostingCalendarService.getResolvedTemplate();
        setTemplateConfig(template);
      } catch (templateError) {
        console.warn('[PortalPage] Falha ao carregar template do calendário. Usando padrão.', templateError);
        setTemplateConfig(normalizePostingCalendarTemplateConfig(DEFAULT_POSTING_CALENDAR_TEMPLATE));
      }

      console.log('[PortalPage] Consulta dos períodos do calendário iniciada');
      const { data: calendarRows, error: calendarError } = await supabase
        .from('posting_calendars')
        .select('id, client_id, month, year, status, created_at')
        .eq('client_id', resolvedClientId)
        .order('year', { ascending: false })
        .order('month', { ascending: false });

      if (calendarError) {
        console.error('[PortalPage] Erro na consulta', {
          tabela: 'posting_calendars',
          filtros: { client_id: resolvedClientId },
          clientId: resolvedClientId,
          portalId: portalData?.portal?.id ?? null,
          error: calendarError,
        });
        void systemError({
          scope: 'portal',
          action: 'calendar_periods_failed',
          clientId: resolvedClientId,
          tableName: 'posting_calendars',
          query: 'loadPortal/calendarPeriods',
          message: 'Falha ao carregar competências do portal.',
          error: calendarError,
          data: {
            slug,
          },
        });
      }

      const nextMonthOptions = buildPortalMonthOptions((calendarRows as Array<Record<string, any>> | null) || []);
      console.log('[PortalPage] Competências disponíveis:', nextMonthOptions);
      setMonthOptions(nextMonthOptions);
      setSelectedPeriodKey((current) =>
        nextMonthOptions.some((option) => option.key === current) ? current : buildCurrentMonthOption().key
      );
      setPostsLoading(true);
      setReloadTick((current) => current + 1);
    } catch (loadError) {
      console.error('[PortalPage] Erro na consulta', loadError);
      void systemError({
        scope: 'portal',
        action: 'portal_load_failed',
        clientId: client?.id ?? null,
        tableName: 'portal_view',
        query: 'loadPortal',
        message: 'Falha ao carregar o portal do cliente.',
        error: loadError,
        data: {
          slug,
        },
      });
      setError(true);
      setErrorMessage(loadError instanceof Error ? loadError.message : 'Erro inesperado ao carregar o portal.');
    } finally {
      setLoading(false);
    }
  }, [anonKey, slug, supabaseUrl]);

  useEffect(() => {
    void loadPortal();
  }, [loadPortal]);

  const loadPortalFiles = useCallback(async () => {
    if (!slug) return;

    try {
      setFilesLoading(true);
      console.group('[PORTAL] Atualizando arquivos');
      console.log('Cliente:', client?.name || 'desconhecido');
      console.log('Tabela:', 'portal-view');
      console.log('Query:', `GET portal-view?token=${slug}`);
      console.groupEnd();

      const response = await fetch(`${supabaseUrl}/functions/v1/portal-view?token=${encodeURIComponent(slug)}`, {
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
        },
      });

      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(String((body as { error?: string }).error || 'Não foi possível carregar os arquivos do portal.'));
      }

      const portalData = body as PortalPayload;
      setPayload((current) => {
        if (!current) return portalData;
        return {
          ...current,
          files: portalData.files ?? [],
        };
      });

      console.info('[PORTAL] Resultado:', `${portalData.files?.length ?? 0} arquivo(s)`);
    } catch (loadFilesError) {
      console.error('[PORTAL] Falha ao carregar arquivos do portal.', loadFilesError);
      toast.error(loadFilesError instanceof Error ? loadFilesError.message : 'Erro ao carregar arquivos do portal.');
    } finally {
      setFilesLoading(false);
    }
  }, [anonKey, client?.name, slug, supabaseUrl]);

  const selectedPeriod = useMemo(
    () => monthOptions.find((option) => option.key === selectedPeriodKey) || buildCurrentMonthOption(),
    [monthOptions, selectedPeriodKey]
  );

  const loadPostsForSelectedPeriod = useCallback(async () => {
    if (!client?.id) {
      console.warn('[PortalPage] clientId ausente');
      setPosts([]);
      setPostsLoading(false);
      return;
    }

    const { startIso, endIso } = buildMonthWindow(selectedPeriod.year, selectedPeriod.monthIndex);
    setPostsLoading(true);
    console.log('[PortalPage] Consulta de posts iniciada');
    console.log('filtros da busca:', {
      clientId: client.id,
      startIso,
      endIso,
      statusFilter: PORTAL_VISIBLE_STATUS_FILTER,
      selectedPeriod,
    });

    try {
      // IMPORTANTE:
      // O portal precisa manter a visibilidade do item do momento da aprovação até a publicação.
      // Se estiver vazio, verificar:
      // 1. client_id errado
      // 2. workflow_status incorreto
      // 3. RLS bloqueando
      let { data, error: postsError } = await supabase
        .from('posting_calendar_items')
        .select('*')
        .eq('client_id', client.id)
        .gte('post_date', startIso)
        .lte('post_date', endIso)
        .in('workflow_status', [...PORTAL_VISIBLE_STATUS_FILTER])
        .order('post_date', { ascending: true })
        .order('day_number', { ascending: true });

      if (postsError) {
        console.log('⚠️ Erro ao buscar posts:', postsError);
        console.error('[PortalPage] Erro na consulta', {
          tabela: 'posting_calendar_items',
          filtros: {
            client_id: client.id,
            startIso,
            endIso,
            workflow_status: PORTAL_VISIBLE_STATUS_FILTER,
          },
          clientId: client.id,
          portalId: payload?.portal?.id ?? null,
          statusFilter: PORTAL_VISIBLE_STATUS_FILTER,
          error: postsError,
        });
        void systemError({
          scope: 'portal',
          action: 'posts_load_failed',
          clientId: client.id,
          tableName: 'posting_calendar_items',
          query: 'loadPostsForSelectedPeriod',
          message: 'Falha ao carregar posts do portal.',
          error: postsError,
          data: {
            startIso,
            endIso,
            selectedPeriod,
          },
        });

        const fallback = await supabase
          .from('posting_calendar_items')
          .select('*, posting_calendars!inner(client_id)')
          .eq('posting_calendars.client_id', client.id)
          .gte('post_date', startIso)
          .lte('post_date', endIso)
          .in('workflow_status', [...PORTAL_VISIBLE_STATUS_FILTER])
          .order('post_date', { ascending: true })
          .order('day_number', { ascending: true });

        if (fallback.error) {
          console.log('⚠️ Erro ao buscar posts:', fallback.error);
          throw fallback.error;
        }

        data = fallback.data as any[] | null;
      }

      console.log('📦 Posts retornados do banco:', data);
      if (!data || data.length === 0) {
        console.warn('❌ Nenhum post encontrado - verificar RLS ou filtro');
        void systemLog({
          scope: 'portal',
          action: 'posts_empty',
          clientId: client.id,
          tableName: 'posting_calendar_items',
          query: 'loadPostsForSelectedPeriod',
          message: 'Nenhum post retornado para o portal no período selecionado.',
          data: {
            startIso,
            endIso,
            selectedPeriod,
          },
          level: 'warning',
        });
      }

      const ids = (data || []).map((row: any) => String(row.id || '')).filter(Boolean);
      const versionsMap = await PostingCalendarService.getPostVersionsMap(ids);
      const hydratedPosts = (data || []).map((row: any) => {
        const versions = versionsMap.get(String(row.id || '')) || [];
        const currentVersion = getCurrentPostVersion(versions);
        return {
          ...row,
          versions,
          current_version: currentVersion,
          previous_version: getPreviousPostVersion(versions),
          current_version_number: currentVersion?.version_number ?? (Number(row.version_number || 1) || 1),
        } as PostingCalendarItemRecord;
      });

      setPosts(hydratedPosts);
      console.log('[PortalPage] Consulta de posts concluída');
      console.log('quantidade de posts:', hydratedPosts.length);
      void systemLog({
        scope: 'portal',
        action: 'posts_loaded',
        clientId: client.id,
        tableName: 'posting_calendar_items',
        query: 'loadPostsForSelectedPeriod',
        message: 'Posts do portal carregados com sucesso.',
        data: {
          count: hydratedPosts.length,
          selectedPeriod,
        },
      });
    } catch (postsError) {
      console.error('[PortalPage] Erro na consulta', postsError);
      void systemError({
        scope: 'portal',
        action: 'posts_cycle_failed',
        clientId: client?.id ?? null,
        tableName: 'posting_calendar_items',
        query: 'loadPostsForSelectedPeriod',
        message: 'Falha no ciclo principal de carregamento de posts do portal.',
        error: postsError,
        data: {
          selectedPeriod,
        },
      });
      toast.error('Nao foi possivel carregar os posts deste mes.');
      setPosts([]);
    } finally {
      setPostsLoading(false);
    }
  }, [client?.id, payload?.portal?.id, selectedPeriod]);

  useEffect(() => {
    void loadPostsForSelectedPeriod();
  }, [loadPostsForSelectedPeriod, reloadTick]);

  useEffect(() => {
    setSelectedDay(null);
    setSelectedPostId(null);
  }, [selectedPeriodKey]);

  useEffect(() => {
    if (activeTab !== 'files') return;
    void loadPortalFiles();
  }, [activeTab, loadPortalFiles]);

  useEffect(() => {
    console.group('[PortalPage] Snapshot do estado de renderização');
    console.log('loading:', loading);
    console.log('postsLoading:', postsLoading);
    console.log('portalData:', payload);
    console.log('client:', client);
    console.log('clientId resolved:', client?.id ?? null);
    console.log('selectedPeriod:', selectedPeriod);
    console.log('posts count:', posts.length);
    console.groupEnd();
  }, [client, loading, payload, posts.length, postsLoading, selectedPeriod]);

  useEffect(() => {
    document.title = client?.name
      ? `Portal ${client.name} | Cromia Comunicacao`
      : 'Portal | Cromia Comunicacao';
  }, [client?.name]);

  const files = payload?.files ?? [];
  const logoUrl = payload?.branding?.logo_url || client?.logo_url || null;
  const monthLabel = selectedPeriod.label;
  const monthCells = useMemo(
    () => buildMonthCells(selectedPeriod.year, selectedPeriod.monthIndex),
    [selectedPeriod.monthIndex, selectedPeriod.year]
  );

  const groupedPosts = useMemo(() => {
    return posts.reduce<Record<number, PostingCalendarItemRecord[]>>((acc, item) => {
      const day = extractDayNumber(item);
      if (!day) return acc;
      if (!acc[day]) acc[day] = [];
      acc[day].push(item);
      return acc;
    }, {});
  }, [posts]);

  const templateCalendarItems = useMemo(
    () =>
      posts.map((item) => ({
        id: item.id,
        day_number: extractDayNumber(item),
        post_type: item.post_type || 'feed',
        title: item.title || item.current_version?.title || null,
        status: normalizeWorkflowStatusId(item.workflow_status),
        label_color: item.label_color || null,
      })),
    [posts]
  );

  const pendingPosts = useMemo(
    () =>
      posts.filter((item) =>
        ['em_aprovacao_cliente', 'revisao_cliente'].includes(normalizeWorkflowStatusId(item.workflow_status))
      ),
    [posts]
  );

  const awaitingSchedulePosts = useMemo(
    () =>
      posts.filter((item) => {
        const normalized = normalizeWorkflowStatusId(item.workflow_status);
        return normalized === 'aprovado_cliente' || normalized === 'aguardando_agendamento';
      }),
    [posts]
  );

  const scheduledPosts = useMemo(
    () => posts.filter((item) => normalizeWorkflowStatusId(item.workflow_status) === 'agendado'),
    [posts]
  );

  const publishedPosts = useMemo(
    () => posts.filter((item) => normalizeWorkflowStatusId(item.workflow_status) === 'publicado'),
    [posts]
  );

  const selectedDayPosts = useMemo(() => {
    if (selectedDay === null) return [];
    return groupedPosts[selectedDay] || [];
  }, [groupedPosts, selectedDay]);

  const selectedPost = useMemo(() => {
    if (!selectedDayPosts.length) return null;
    return selectedDayPosts.find((item) => item.id === selectedPostId) || selectedDayPosts[0];
  }, [selectedDayPosts, selectedPostId]);

  const approvalList = useMemo(() => {
    const base = posts.filter((item) =>
      (PORTAL_VISIBLE_STATUS_FILTER as readonly string[]).includes(normalizeWorkflowStatusId(item.workflow_status))
    );

    if (!searchTerm.trim()) return base;
    const query = searchTerm.toLowerCase();
    return base.filter((item) => {
      const haystack = [item.title, item.description, item.post_type, item.post_date]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [posts, searchTerm]);

  const openDayModal = (day: number) => {
    const dayPosts = groupedPosts[day] || [];
    setSelectedDay(day);
    setSelectedPostId(dayPosts[0]?.id || null);
  };

  const toggleReviewTag = (itemId: string, tag: ReviewTag) => {
    setReviewTags((current) => {
      const currentTags = current[itemId] || [];
      const nextTags = currentTags.includes(tag)
        ? currentTags.filter((entry) => entry !== tag)
        : [...currentTags, tag];
      return {
        ...current,
        [itemId]: nextTags,
      };
    });
  };

  const handlePortalDecision = async (itemId: string, action: 'approve_calendar' | 'request_calendar_changes') => {
    try {
      const note = String(reviewNotes[itemId] || '').trim();
      const categories = reviewTags[itemId] || [];

      if (action === 'request_calendar_changes' && !note) {
        toast.error('Explique o ajuste necessário antes de enviar.');
        return;
      }

      if (action === 'request_calendar_changes' && !categories.length) {
        toast.error('Selecione pelo menos um tipo de ajuste.');
        return;
      }

      setDecisionLoadingId(itemId);
      const response = await fetch(`${supabaseUrl}/functions/v1/portal-view`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
        },
        body: JSON.stringify({
          token: slug,
          action,
          calendarItemId: itemId,
          note: note || null,
          categories,
        }),
      });

      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(String((body as any)?.error || 'Não foi possível registrar a decisão.'));
      }

      toast.success(action === 'approve_calendar' ? 'Post aprovado com sucesso.' : 'Ajuste enviado para a equipe.');
      setReviewNotes((current) => ({ ...current, [itemId]: '' }));
      setReviewTags((current) => ({ ...current, [itemId]: [] }));
      await loadPortal();
    } catch (decisionError) {
      console.error('⚠️ Erro ao buscar posts:', decisionError);
      toast.error(decisionError instanceof Error ? decisionError.message : 'Erro ao registrar decisão.');
    } finally {
      setDecisionLoadingId(null);
    }
  };

  const handlePortalIntakeSubmit = async () => {
    const title = requestTitle.trim();
    const description = requestDescription.trim();
    const references = requestReferences.trim();
    const selectedKind = PORTAL_REQUEST_KIND_OPTIONS.find((option) => option.id === requestKindId) || PORTAL_REQUEST_KIND_OPTIONS[0];

    if (!title) {
      toast.error('Informe um título para a solicitação.');
      return;
    }

    if (requestAttachment && requestAttachment.size > PORTAL_ATTACHMENT_MAX_BYTES) {
      toast.error('O anexo do portal suporta até 8 MB nesta versão.');
      return;
    }

    try {
      setRequestSubmitting(true);

      const attachmentDataUrl = requestAttachment ? await readFileAsDataUrl(requestAttachment) : null;
      const response = await fetch(`${supabaseUrl}/functions/v1/portal-view`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
        },
        body: JSON.stringify({
          action: 'submit_intake',
          token: slug,
          title,
          description,
          type: selectedKind.intakeType,
          references,
          request_kind: selectedKind.label,
          attachment_name: requestAttachment?.name || null,
          attachment_content_type: requestAttachment?.type || null,
          attachment_data_url: attachmentDataUrl,
        }),
      });

      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(String((body as { error?: string }).error || 'Não foi possível enviar a solicitação.'));
      }

      toast.success('Solicitação enviada. Ela já caiu no Hub do time.');
      setRequestTitle('');
      setRequestDescription('');
      setRequestReferences('');
      setRequestKindId(PORTAL_REQUEST_KIND_OPTIONS[0].id);
      setRequestAttachment(null);
    } catch (submitError) {
      toast.error(submitError instanceof Error ? submitError.message : 'Erro ao enviar solicitação.');
    } finally {
      setRequestSubmitting(false);
    }
  };

  if (loading) {
    console.log('⏳ Carregando portal...');
    return <PortalLoading clientName={client?.name || 'Cliente'} logoUrl={logoUrl} isReady={false} />;
  }

  if (error) {
    return <PortalError clientName={client?.name || 'Cliente'} message={errorMessage} />;
  }

  if (!client) {
    return <PortalError clientName="Cliente" message={errorMessage || 'Cliente do portal não foi encontrado.'} />;
  }

  return (
    <div className="min-h-screen bg-[#f5f6f8] text-slate-900">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="rounded-[32px] border border-slate-200 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
          <div className="border-b border-slate-100 px-6 py-6 sm:px-8">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-4">
                <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                  {logoUrl ? (
                    <img src={logoUrl} alt={client.name} className="h-full w-full object-contain p-2" />
                  ) : (
                    <span className="text-xl font-semibold text-slate-700">C</span>
                  )}
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Portal do Cliente</p>
                  <h1 className="mt-1 text-2xl font-bold text-slate-900">{client.name}</h1>
                  <p className="mt-1 text-sm text-slate-500">Cromia Comunicação • {monthLabel}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Total</p>
                  <p className="mt-2 text-2xl font-bold text-slate-900">{posts.length}</p>
                </div>
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-amber-700">Pendentes</p>
                  <p className="mt-2 text-2xl font-bold text-amber-900">{pendingPosts.length}</p>
                </div>
                <div className="rounded-2xl border border-yellow-200 bg-yellow-50 px-4 py-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-yellow-700">Aguardando</p>
                  <p className="mt-2 text-2xl font-bold text-yellow-900">{awaitingSchedulePosts.length}</p>
                </div>
                <div className="rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-indigo-700">Agendados</p>
                  <p className="mt-2 text-2xl font-bold text-indigo-900">{scheduledPosts.length}</p>
                </div>
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-700">Publicados</p>
                  <p className="mt-2 text-2xl font-bold text-emerald-900">{publishedPosts.length}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="border-b border-slate-100 px-6 py-4 sm:px-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                {[
                  { id: 'calendar', label: 'Calendário', icon: CalendarDays },
                  { id: 'approval', label: 'Aprovação', icon: MessageSquarePlus },
                  { id: 'requests', label: 'Solicitações', icon: Send },
                  { id: 'files', label: 'Arquivos', icon: FileText },
                ].map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id as PortalTab)}
                      className={cn(
                        'inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-colors',
                        activeTab === tab.id
                          ? 'border-slate-900 bg-slate-900 text-white'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900'
                      )}
                    >
                      <Icon size={15} />
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => void loadPortal()}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:border-slate-300 hover:text-slate-900"
              >
                <RefreshCw size={15} /> Atualizar
              </button>
            </div>
          </div>

          <div className="px-6 py-6 sm:px-8">
            {activeTab === 'calendar' && (
              <div className="space-y-6">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">Calendário de aprovação</h2>
                    <p className="text-sm text-slate-500">
                      O portal sempre abre no mês atual. Para consultar meses encerrados ou futuros, basta trocar a competência abaixo.
                    </p>
                  </div>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                    {monthLabel}
                  </span>
                </div>

                <div className="flex gap-2 overflow-x-auto pb-2">
                  {monthOptions.map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => setSelectedPeriodKey(option.key)}
                      className={cn(
                        'whitespace-nowrap rounded-full border px-4 py-2 text-sm font-semibold transition-all',
                        selectedPeriodKey === option.key
                          ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900'
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>

                {postsLoading ? (
                  <div className="rounded-[32px] border border-slate-200 bg-slate-50 px-6 py-14 text-center text-sm font-medium text-slate-500">
                    Sincronizando os posts de {monthLabel.toLowerCase()}...
                  </div>
                ) : (
                  <div className="overflow-x-auto pb-2">
                    <PostingCalendarTemplateClassic
                      className="min-w-[980px]"
                      client={client}
                      brandLogoUrl={logoUrl}
                      monthLabel={monthLabel.replace(/\s+\d{4}$/u, '')}
                      year={selectedPeriod.year}
                      weekDays={['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB']}
                      calendarCells={monthCells}
                      calendarItems={templateCalendarItems}
                      config={templateConfig}
                      selectedDay={selectedDay}
                      onDayClick={openDayModal}
                    />
                  </div>
                )}

                {!postsLoading && posts.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center text-sm text-slate-500">
                    Nenhum post deste fluxo foi encontrado para {monthLabel.toLowerCase()}.
                  </div>
                ) : null}
              </div>
            )}

            {activeTab === 'approval' && (
              <div className="space-y-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">Aprovação rápida</h2>
                    <p className="text-sm text-slate-500">Lista direta dos posts do mês para decidir sem navegar no calendário.</p>
                  </div>
                  <div className="relative w-full sm:w-72">
                    <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      value={searchTerm}
                      onChange={(event) => setSearchTerm(event.target.value)}
                      placeholder="Buscar post, tipo ou data"
                      className="h-11 w-full rounded-2xl border border-slate-200 bg-white pl-10 pr-4 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
                    />
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  {approvalList.length === 0 ? (
                    <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center text-sm text-slate-500 lg:col-span-2">
                      Nenhum post disponível para este filtro.
                    </div>
                  ) : (
                    approvalList.map((item) => {
                      const operationalDate = getPortalOperationalDate(item);
                      const urgency = getUrgencyTone(operationalDate);
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            openDayModal(extractDayNumber(item));
                            setSelectedPostId(item.id);
                          }}
                          className="rounded-3xl border border-slate-200 bg-white p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
                        >
                          <div className="mb-4 flex items-start justify-between gap-3">
                            <div>
                              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                                {item.post_type || 'Post'} • {formatPortalDate(operationalDate)} às {formatPortalTime(operationalDate)}
                              </p>
                              <h3 className="mt-2 text-base font-bold text-slate-900">{item.title || 'Sem título'}</h3>
                            </div>
                            <WorkflowTone value={item.workflow_status} />
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <span className={cn('rounded-full border px-2.5 py-1 text-[11px] font-semibold', urgency.className)}>
                              {urgency.label}
                            </span>
                            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                              Versão {item.current_version_number || item.version_number || 1}
                            </span>
                            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                              {getWaitingLabel(operationalDate)}
                            </span>
                          </div>

                          <p className="mt-4 line-clamp-3 text-sm leading-relaxed text-slate-600">{item.description || 'Sem legenda disponível.'}</p>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {activeTab === 'files' && (
              <div className="space-y-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">Arquivos compartilhados</h2>
                    <p className="text-sm text-slate-500">Prévia rápida do material já liberado para consulta.</p>
                  </div>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                    {files.length} arquivo(s)
                  </span>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {filesLoading ? (
                    <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center text-sm text-slate-500 sm:col-span-2 xl:col-span-3">
                      Carregando arquivos compartilhados...
                    </div>
                  ) : files.length === 0 ? (
                    <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center text-sm text-slate-500 sm:col-span-2 xl:col-span-3">
                      Nenhum arquivo disponível no momento.
                    </div>
                  ) : (
                    files.map((file) => (
                      <div key={file.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="mb-4 flex items-center justify-between">
                          <div className="rounded-2xl bg-slate-50 p-3">{getFileIcon(file.mime_type)}</div>
                          <a
                            href={file.preview_url || file.drive_view_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-semibold text-primary"
                          >
                            Abrir <ExternalLink size={13} />
                          </a>
                        </div>
                        <h3 className="line-clamp-2 text-sm font-semibold text-slate-900">{file.name}</h3>
                        <p className="mt-2 text-xs text-slate-500">{formatSize(file.size)}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {activeTab === 'requests' && (
              <div className="grid gap-6 xl:grid-cols-[minmax(0,1.08fr)_360px]">
                <div className="space-y-5">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">Nova solicitação</h2>
                    <p className="text-sm text-slate-500">
                      Abra pedidos de posts, vídeos, campanhas e ajustes. Tudo cai direto no Hub do time operacional.
                    </p>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    {PORTAL_REQUEST_KIND_OPTIONS.map((option) => {
                      const active = requestKindId === option.id;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => setRequestKindId(option.id)}
                          className={cn(
                            'rounded-3xl border p-5 text-left transition-all',
                            active
                              ? 'border-slate-900 bg-slate-900 text-white shadow-lg'
                              : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:shadow-sm'
                          )}
                        >
                          <p className="text-sm font-bold">{option.label}</p>
                          <p className={cn('mt-2 text-sm leading-6', active ? 'text-white/80' : 'text-slate-500')}>
                            {option.description}
                          </p>
                        </button>
                      );
                    })}
                  </div>

                  <div className="grid gap-5 rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
                    <div className="space-y-2">
                      <label className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Título</label>
                      <input
                        value={requestTitle}
                        onChange={(event) => setRequestTitle(event.target.value)}
                        placeholder="Ex.: Vídeo para campanha de lançamento do produto"
                        className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 outline-none transition focus:border-primary focus:bg-white focus:ring-4 focus:ring-primary/10"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Descrição</label>
                      <textarea
                        value={requestDescription}
                        onChange={(event) => setRequestDescription(event.target.value)}
                        rows={5}
                        placeholder="Explique o objetivo, contexto, formato esperado e qualquer detalhe importante."
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-primary focus:bg-white focus:ring-4 focus:ring-primary/10"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Referências</label>
                      <textarea
                        value={requestReferences}
                        onChange={(event) => setRequestReferences(event.target.value)}
                        rows={4}
                        placeholder="Cole links, referências visuais, exemplos, observações de marca ou instruções complementares."
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-primary focus:bg-white focus:ring-4 focus:ring-primary/10"
                      />
                    </div>

                    <div className="space-y-3 rounded-3xl border border-dashed border-slate-200 bg-slate-50/80 p-5">
                      <div className="flex items-start gap-3">
                        <div className="rounded-2xl bg-white p-3 shadow-sm">
                          <Paperclip size={18} className="text-slate-600" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-slate-900">Anexo opcional</p>
                          <p className="mt-1 text-sm leading-6 text-slate-500">
                            Você pode enviar um arquivo de apoio. Nesta versão, o portal aceita até 8 MB por solicitação.
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-3">
                        <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-900">
                          <Paperclip size={14} />
                          Escolher arquivo
                          <input
                            type="file"
                            className="hidden"
                            onChange={(event) => setRequestAttachment(event.target.files?.[0] || null)}
                          />
                        </label>

                        {requestAttachment ? (
                          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-600">
                            <strong className="text-slate-900">{requestAttachment.name}</strong>
                            <span className="ml-2 text-slate-400">({formatSize(requestAttachment.size)})</span>
                          </div>
                        ) : (
                          <span className="text-sm text-slate-400">Nenhum arquivo selecionado.</span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setRequestTitle('');
                          setRequestDescription('');
                          setRequestReferences('');
                          setRequestKindId(PORTAL_REQUEST_KIND_OPTIONS[0].id);
                          setRequestAttachment(null);
                        }}
                        className="inline-flex items-center gap-2 rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
                      >
                        Limpar
                      </button>
                      <button
                        type="button"
                        onClick={() => void handlePortalIntakeSubmit()}
                        disabled={requestSubmitting}
                        className="inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-primary/20 transition hover:bg-primary/90 disabled:opacity-60"
                      >
                        <Send size={15} />
                        {requestSubmitting ? 'Enviando...' : 'Enviar para o Hub'}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 xl:sticky xl:top-6 xl:self-start">
                  <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Como funciona</p>
                    <div className="mt-4 space-y-3">
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                        <p className="text-sm font-semibold text-slate-900">1. Você abre a solicitação</p>
                        <p className="mt-1 text-sm text-slate-500">O pedido entra imediatamente na fila operacional da equipe.</p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                        <p className="text-sm font-semibold text-slate-900">2. O time faz a triagem</p>
                        <p className="mt-1 text-sm text-slate-500">A equipe classifica, detalha e vincula a tarefa necessária.</p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                        <p className="text-sm font-semibold text-slate-900">3. Acompanhe pelo portal</p>
                        <p className="mt-1 text-sm text-slate-500">Quando virar conteúdo do calendário, ele aparece aqui para revisão e aprovação.</p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[32px] border border-slate-200 bg-slate-50 p-6">
                    <div className="flex items-start gap-3">
                      <div className="rounded-2xl bg-white p-3 shadow-sm">
                        <Link2 size={18} className="text-slate-600" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">Dica de briefing</p>
                        <p className="mt-2 text-sm leading-6 text-slate-500">
                          Quanto mais claro o contexto, objetivo e referência, mais rápido o time consegue transformar a solicitação em execução.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {selectedDay !== null && (
          <div className="fixed inset-0 z-[999] flex items-center justify-center px-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedDay(null)}
              className="fixed inset-0 bg-slate-950/45 backdrop-blur-sm"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 16 }}
              className="relative z-10 flex max-h-[85vh] w-full max-w-6xl flex-col overflow-hidden rounded-[32px] bg-white shadow-[0_24px_80px_rgba(15,23,42,0.2)]"
            >
              <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5 sm:px-8">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Posts do dia</p>
                  <h2 className="mt-1 text-xl font-bold text-slate-900">Dia {selectedDay} • {monthLabel}</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedDay(null)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                >
                  ×
                </button>
              </div>

              <div className="grid min-h-0 flex-1 gap-0 lg:grid-cols-[360px_1fr]">
                <div className="border-b border-slate-100 bg-slate-50/70 p-5 lg:border-b-0 lg:border-r">
                  <div className="mb-4 flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-700">Posts deste dia</p>
                    <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-500">{selectedDayPosts.length}</span>
                  </div>

                  <div className="space-y-3 overflow-y-auto pr-1 lg:max-h-[62vh]">
                    {selectedDayPosts.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
                        Nenhum post encontrado para este dia.
                      </div>
                    ) : (
                      selectedDayPosts.map((item) => {
                        const urgency = getUrgencyTone(getPortalOperationalDate(item));
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => setSelectedPostId(item.id)}
                            className={cn(
                              'w-full rounded-2xl border p-4 text-left transition-all',
                              selectedPost?.id === item.id
                                ? 'border-primary bg-primary/5 shadow-sm'
                                : 'border-slate-200 bg-white hover:border-slate-300'
                            )}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold text-slate-900">{item.title || 'Sem título'}</p>
                                <p className="mt-1 line-clamp-2 text-xs text-slate-500">{item.description || 'Sem legenda.'}</p>
                              </div>
                              <WorkflowTone value={item.workflow_status} className="shrink-0" />
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                              <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest', urgency.className)}>
                                {urgency.label}
                              </span>
                              <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                                V{item.current_version_number || item.version_number || 1}
                              </span>
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>

                <div className="min-h-0 overflow-y-auto p-6 sm:p-8">
                  {!selectedPost ? (
                    <div className="flex h-full min-h-[280px] items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500">
                      Selecione um post para abrir o detalhe.
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
                            {selectedPost.post_type || 'Post'} • {formatPortalDate(getPortalOperationalDate(selectedPost))} às {formatPortalTime(getPortalOperationalDate(selectedPost))}
                          </p>
                          <h3 className="mt-2 text-2xl font-bold text-slate-900">{selectedPost.title || 'Sem título'}</h3>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <WorkflowTone value={selectedPost.workflow_status} />
                            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                              Versão atual v{selectedPost.current_version_number || selectedPost.version_number || 1}
                            </span>
                          </div>
                        </div>
                        {normalizeWorkflowStatusId(selectedPost.workflow_status) === 'em_aprovacao_cliente' ? (
                          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
                            ⚠ Sem aprovação, não será publicado na data planejada.
                          </div>
                        ) : normalizeWorkflowStatusId(selectedPost.workflow_status) === 'revisao_cliente' ? (
                          <div className="rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm font-medium text-orange-800">
                            Ajustes solicitados. A equipe vai revisar esta peça antes de reenviar.
                          </div>
                        ) : normalizeWorkflowStatusId(selectedPost.workflow_status) === 'aguardando_agendamento' ||
                          normalizeWorkflowStatusId(selectedPost.workflow_status) === 'aprovado_cliente' ? (
                          <div className="rounded-2xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm font-medium text-yellow-800">
                            Post aprovado. Aguardando agendamento pela equipe.
                          </div>
                        ) : normalizeWorkflowStatusId(selectedPost.workflow_status) === 'agendado' ? (
                          <div className="rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm font-medium text-indigo-800">
                            Agendado para {formatPortalDate(getPortalOperationalDate(selectedPost))} às {formatPortalTime(getPortalOperationalDate(selectedPost))}.
                          </div>
                        ) : (
                          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
                            Publicado com sucesso.
                          </div>
                        )}
                      </div>

                      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                        <div className="space-y-4">
                          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-50 shadow-sm">
                            {selectedPost.image_url ? (
                              <img src={selectedPost.image_url} alt={selectedPost.title || 'Post'} className="h-full w-full object-cover" />
                            ) : selectedPost.video_url ? (
                              <video src={selectedPost.video_url} controls className="h-full w-full" />
                            ) : (
                              <div className="flex min-h-[280px] items-center justify-center text-slate-400">
                                <ImageIcon size={32} />
                              </div>
                            )}
                          </div>

                          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Legenda completa</p>
                            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                              {selectedPost.description || 'Sem legenda informada.'}
                            </p>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Contexto</p>
                            <div className="mt-3 grid gap-3 text-sm text-slate-600">
                              <div className="flex items-center justify-between gap-3">
                                <span>Data de publicação</span>
                                <strong>{formatPortalDate(getPortalOperationalDate(selectedPost))}</strong>
                              </div>
                              <div className="flex items-center justify-between gap-3">
                                <span>Horário</span>
                                <strong>{formatPortalTime(getPortalOperationalDate(selectedPost))}</strong>
                              </div>
                              <div className="flex items-center justify-between gap-3">
                                <span>Urgência</span>
                                <strong>{getUrgencyTone(getPortalOperationalDate(selectedPost)).label}</strong>
                              </div>
                              <div className="flex items-center justify-between gap-3">
                                <span>Tempo aguardando</span>
                                <strong>{getWaitingLabel(getPortalOperationalDate(selectedPost))}</strong>
                              </div>
                              {selectedPost.published_at ? (
                                <div className="flex items-center justify-between gap-3">
                                  <span>Publicado em</span>
                                  <strong>{formatPortalDate(selectedPost.published_at)} às {formatPortalTime(selectedPost.published_at)}</strong>
                                </div>
                              ) : normalizeWorkflowStatusId(selectedPost.workflow_status) === 'publicado' ? (
                                <div className="flex items-center justify-between gap-3">
                                  <span>Publicado em</span>
                                  <strong>{formatPortalDate(getPortalOperationalDate(selectedPost))} às {formatPortalTime(getPortalOperationalDate(selectedPost))}</strong>
                                </div>
                              ) : null}
                            </div>
                          </div>

                          <VersionAuditBlock item={selectedPost} />

                          {normalizeWorkflowStatusId(selectedPost.workflow_status) === 'em_aprovacao_cliente' ? (
                            <>
                              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Solicitar ajuste</p>
                                <div className="mt-3 flex flex-wrap gap-2">
                                  {REVIEW_TAG_OPTIONS.map((tag) => {
                                    const active = (reviewTags[selectedPost.id] || []).includes(tag);
                                    return (
                                      <button
                                        key={`${selectedPost.id}-${tag}`}
                                        type="button"
                                        onClick={() => toggleReviewTag(selectedPost.id, tag)}
                                        className={cn(
                                          'rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-all',
                                          active
                                            ? 'border-orange-300 bg-orange-100 text-orange-800'
                                            : 'border-slate-200 bg-white text-slate-600 hover:border-orange-200 hover:text-orange-700'
                                        )}
                                      >
                                        {tag}
                                      </button>
                                    );
                                  })}
                                </div>
                                <textarea
                                  value={reviewNotes[selectedPost.id] || ''}
                                  onChange={(event) =>
                                    setReviewNotes((current) => ({
                                      ...current,
                                      [selectedPost.id]: event.target.value,
                                    }))
                                  }
                                  rows={4}
                                  placeholder="Explique o ajuste necessário para esta versão."
                                  className="mt-4 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-primary focus:bg-white focus:ring-4 focus:ring-primary/10"
                                />
                              </div>

                              <div className="flex flex-wrap justify-end gap-3">
                                <button
                                  type="button"
                                  disabled={decisionLoadingId === selectedPost.id}
                                  onClick={() => void handlePortalDecision(selectedPost.id, 'request_calendar_changes')}
                                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
                                >
                                  <MessageSquarePlus size={15} /> Solicitar ajustes
                                </button>
                                <button
                                  type="button"
                                  disabled={decisionLoadingId === selectedPost.id}
                                  onClick={() => void handlePortalDecision(selectedPost.id, 'approve_calendar')}
                                  className="inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-primary/20 transition hover:bg-primary/90 disabled:opacity-60"
                                >
                                  <CheckCircle2 size={15} /> Aprovar e liberar publicação
                                </button>
                              </div>
                            </>
                          ) : (
                            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Status atual</p>
                              <p className="mt-3 text-sm leading-relaxed text-slate-600">
                                {normalizeWorkflowStatusId(selectedPost.workflow_status) === 'revisao_cliente'
                                  ? 'Seu ajuste foi recebido. A equipe está preparando uma nova versão para reenviar ao portal.'
                                  : normalizeWorkflowStatusId(selectedPost.workflow_status) === 'aguardando_agendamento' ||
                                normalizeWorkflowStatusId(selectedPost.workflow_status) === 'aprovado_cliente'
                                  ? 'A equipe já recebeu a aprovação e vai definir a data e hora da publicação.'
                                  : normalizeWorkflowStatusId(selectedPost.workflow_status) === 'agendado'
                                    ? `Agendado para ${formatPortalDate(getPortalOperationalDate(selectedPost))} às ${formatPortalTime(getPortalOperationalDate(selectedPost))}.`
                                    : `Publicado em ${formatPortalDate(selectedPost.published_at || getPortalOperationalDate(selectedPost))} às ${formatPortalTime(selectedPost.published_at || getPortalOperationalDate(selectedPost))}.`}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
