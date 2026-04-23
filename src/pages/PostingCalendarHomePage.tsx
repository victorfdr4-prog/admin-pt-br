import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  FileImage,
  FileText,
  LayoutGrid,
  Loader2,
  Pencil,
  Plus,
  Rows3,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR as dateFnsPtBR } from 'date-fns/locale';
import { useNavigate, useSearchParams } from 'react-router-dom';
import jsPDF from 'jspdf';
import PostingCalendarTemplateClassic from '@/components/posting-calendar/PostingCalendarTemplateClassic';
import LegendSortableList from '@/components/posting-calendar/LegendSortableList';
import {
  MONTH_OPTIONS,
  PostingCalendarDayEditor,
  WORKFLOW_STATUS_OPTIONS,
  buildExportFileName,
  buildInitialDayEditor,
  buildMonthCells,
  blobFromDataUrl,
  downloadBlob,
  getWorkflowOperationalBadge,
  normalizeWorkflowStatusId,
  type CalendarClient,
  type PostingCalendarDayEditorState,
  type PostingCalendarItemRecord,
  type PostingCalendarRecord,
  type WorkflowStatusId,
} from '@/components/posting-calendar/PostingCalendarShared';
import {
  DEFAULT_POSTING_CALENDAR_TEMPLATE,
  normalizePostingCalendarTemplateConfig,
  type PostingCalendarLegendItem,
  type PostingCalendarTemplateConfig,
} from '@/domain/agencyPlatform';
import {
  normalizeWorkflowStatus,
  type Role,
  type WorkflowStatus,
} from '@/domain/postWorkflow';
import { ClientService, PostingCalendarService } from '@/services';
import { ContentApprovalService } from '@/services/content-approval.service';
import {
  PostWorkflowService,
  canSendToClient as canSendToClientStatus,
  isFinalStatus as isFinalWorkflowStatus,
} from '@/services/post-workflow.service';
import { useSystemStore } from '@/store/useSystemStore';
import { useAuthStore } from '@/store/useAuthStore';
import { toast } from '@/components/ui/sonner';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { captureElementPngDataUrl, cloneForCanvasExport } from '@/utils/exportCapture';
import { normalizeSystemRole } from '@/domain/accessControl';
import { ptBR } from '@/lib/ptBR';

const DEFAULT_LOGO_PATH = '/CALENDARIO.PNG';

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Falha ao ler arquivo.'));
    reader.readAsDataURL(file);
  });

const parseMonth = (raw: string | null) => {
  const parsed = Number(raw);
  if (Number.isNaN(parsed)) return new Date().getMonth();
  if (parsed >= 0 && parsed <= 11) return parsed;
  if (parsed >= 1 && parsed <= 12) return parsed - 1;
  return new Date().getMonth();
};

const parseYear = (raw: string | null) => {
  const parsed = Number(raw);
  const currentYear = new Date().getFullYear();
  if (Number.isNaN(parsed) || parsed < 2000 || parsed > 2100) return currentYear;
  return parsed;
};

const parseDateInputValue = (value: string | null | undefined) => {
  const raw = String(value || '').trim();
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [year, month, day] = raw.split('-').map(Number);
    return new Date(year, month - 1, day);
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatInputDateValue = (value: string | null | undefined) => {
  const parsed = parseDateInputValue(value);
  return parsed ? format(parsed, 'yyyy-MM-dd') : '';
};

const formatInputTimeValue = (value: string | null | undefined) => {
  const parsed = parseDateInputValue(value);
  return parsed ? format(parsed, 'HH:mm') : '';
};

const buildScheduledDateTime = (dateValue: string, timeValue: string) => {
  if (!dateValue) return null;
  const parsed = new Date(`${dateValue}T${timeValue || '00:00'}:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
};

const getOperationalDateValue = (item: PostingCalendarItemRecord) => item.scheduled_date || item.post_date || null;

const formatOperationalDateLabel = (item: PostingCalendarItemRecord) => {
  const parsed = parseDateInputValue(getOperationalDateValue(item));
  return parsed ? format(parsed, 'dd/MM/yyyy') : 'Sem data';
};

const formatOperationalTimeLabel = (item: PostingCalendarItemRecord) => {
  const parsed = parseDateInputValue(getOperationalDateValue(item));
  if (!parsed) return 'A definir';
  const label = format(parsed, 'HH:mm');
  return label === '00:00' ? 'A definir' : label;
};

const getOperationalUrgency = (item: PostingCalendarItemRecord) => {
  const parsed = parseDateInputValue(getOperationalDateValue(item));
  if (!parsed) {
    return {
      label: '🟢 tranquilo',
      className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    };
  }

  const now = new Date();
  const diffHours = Math.round((parsed.getTime() - now.getTime()) / 3600000);
  if (diffHours <= 24) {
    return {
      label: '🔴 urgente',
      className: 'border-rose-200 bg-rose-50 text-rose-700',
    };
  }
  if (diffHours <= 72) {
    return {
      label: '🟡 atenção',
      className: 'border-amber-200 bg-amber-50 text-amber-700',
    };
  }
  return {
    label: '🟢 tranquilo',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  };
};

const buildEditorFromItem = (
  day: number,
  item: PostingCalendarItemRecord | null,
  fallbackType: string
): PostingCalendarDayEditorState => {
  const base = buildInitialDayEditor();

  return {
    ...base,
    open: true,
    day,
    itemId: item?.id || null,
    postType: item?.post_type || fallbackType,
    title: item?.title || '',
    description: item?.description || '',
    notes: item?.notes || '',
    labelColor: item?.label_color || '',
    workflowStatus: normalizeWorkflowStatusId(item?.workflow_status),
    platforms: Array.isArray((item as any)?.platforms) && (item as any).platforms.length
      ? (item as any).platforms
      : base.platforms,
    imageUrl: item?.image_url || '',
    videoUrl: item?.video_url || '',
    approvalStatus: item?.approval_status || 'pending',
    changeReason:
      normalizeWorkflowStatus(item?.workflow_status || 'rascunho') === 'revisao_cliente'
        ? item?.approval_notes || ''
        : '',
    clientFeedback:
      normalizeWorkflowStatus(item?.workflow_status || 'rascunho') === 'revisao_cliente'
        ? item?.approval_notes || ''
        : '',
    scheduledDate: formatInputDateValue(item?.scheduled_date || item?.post_date || null),
    scheduledTime: formatInputTimeValue(item?.scheduled_date || item?.post_date || null),
    selectedVersionId: item?.previous_version?.id || null,
    versions: item?.versions || [],
  };
};

export const PostingCalendarHomePage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const previewRef = useRef<HTMLDivElement | null>(null);

  const isFirstMount = useRef(true);
  const [isUpdating, setIsUpdating] = useState(false);

  const brandLogoUrl = useSystemStore((state) => state.branding.logo_url);
  const currentUserRole = useAuthStore((state) => state.user?.role);
  const currentUserId = useAuthStore((state) => state.user?.id);

  const [clients, setClients] = useState<CalendarClient[]>([]);
  const [selectedClientId, setSelectedClientId] = useState(searchParams.get('client') || '');
  const [selectedMonth, setSelectedMonth] = useState(() => parseMonth(searchParams.get('month')));
  const [selectedYear, setSelectedYear] = useState(() => parseYear(searchParams.get('year')));
  const [calendar, setCalendar] = useState<PostingCalendarRecord | null>(null);
  const [calendarItems, setCalendarItems] = useState<PostingCalendarItemRecord[]>([]);
  const [templateConfig, setTemplateConfig] = useState<PostingCalendarTemplateConfig>(DEFAULT_POSTING_CALENDAR_TEMPLATE);
  const [dayEditor, setDayEditor] = useState<PostingCalendarDayEditorState>(buildInitialDayEditor());
  const [loading, setLoading] = useState(true);
  const [savingLegend, setSavingLegend] = useState(false);
  const [uploadingAsset, setUploadingAsset] = useState<'image' | 'video' | null>(null);
  const [exporting, setExporting] = useState<'png' | 'pdf' | null>(null);
  const [sendingApproval, setSendingApproval] = useState(false);
  const [viewMode, setViewMode] = useState<'visual' | 'list'>('visual');
  const [useClientLogo, setUseClientLogo] = useState(false);

  const selectedClient = useMemo(
    () => clients.find((client) => client.id === selectedClientId) || null,
    [clients, selectedClientId]
  );

  const workflowActorRole: Role =
    currentUserRole === 'blocked'
      ? 'admin_operacional'
      : (normalizeSystemRole(currentUserRole || 'admin_operacional') as Role);

  const monthLabel = useMemo(
    () => format(new Date(selectedYear, selectedMonth, 1), 'MMMM', { locale: dateFnsPtBR }),
    [selectedMonth, selectedYear]
  );

  const calendarCells = useMemo(() => buildMonthCells(selectedYear, selectedMonth), [selectedMonth, selectedYear]);
  const weekDays = useMemo(() => ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'], []);

  const syncParams = useCallback(
    (clientId: string, month: number, year: number) => {
      const params = new URLSearchParams(searchParams);
      if (clientId) params.set('client', clientId);
      else params.delete('client');
      params.set('month', String(month));
      params.set('year', String(year));
      setSearchParams(params, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  const loadCalendarData = useCallback(
    async (clientId: string, month: number, year: number) => {
      if (!clientId) {
        setCalendar(null);
        setCalendarItems([]);
        return;
      }

      const [calendarRow, templateResponse] = await Promise.all([
        PostingCalendarService.getOrCreateCalendar(clientId, month, year),
        PostingCalendarService.getResolvedTemplate(),
      ]);

      const items = await PostingCalendarService.getCalendarItems(calendarRow.id);

      const normalizedItems = (items as PostingCalendarItemRecord[]).map((item) => ({
        ...item,
        workflow_status: normalizeWorkflowStatusId(item.workflow_status),
      }));

      setCalendar(calendarRow as PostingCalendarRecord);
      setCalendarItems(normalizedItems);
      setTemplateConfig(templateResponse?.template || DEFAULT_POSTING_CALENDAR_TEMPLATE);
      setSelectedClientId(clientId);
      syncParams(clientId, month, year);
    },
    [syncParams]
  );

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        if (isFirstMount.current) {
          setLoading(true);
        } else {
          setIsUpdating(true);
        }

        let currentClients = clients;

        if (isFirstMount.current) {
          const loadedClients = await ClientService.getAll();
          if (cancelled) return;

          currentClients = (loadedClients || []).map((client: any) => ({
            id: String(client.id),
            name: String(client.name),
            logo_url: client.logo_url ? String(client.logo_url) : null,
            plan: client.plan ? String(client.plan) : null,
          }));
          setClients(currentClients);
        }

        const fallbackClientId = selectedClientId || currentClients[0]?.id || '';
        if (!fallbackClientId) {
          setCalendar(null);
          setCalendarItems([]);
          return;
        }

        await loadCalendarData(fallbackClientId, selectedMonth, selectedYear);
      } catch (error) {
        console.error('Falha ao carregar calendário:', error);
        toast.error(error instanceof Error ? error.message : 'Não foi possível atualizar o mês.');
      } finally {
        if (!cancelled) {
          setLoading(false);
          setIsUpdating(false);
          isFirstMount.current = false;
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [loadCalendarData, selectedClientId, selectedMonth, selectedYear]);

  const openDayEditor = useCallback(
    (day: number) => {
      const item = calendarItems.find((entry) => Number(entry.day_number) === day) || null;
      const safeLegendItems = templateConfig?.legend_items || DEFAULT_POSTING_CALENDAR_TEMPLATE.legend_items;
      const fallbackType = safeLegendItems[0]?.id || 'feed';
      setDayEditor(buildEditorFromItem(day, item, fallbackType));
    },
    [calendarItems, templateConfig?.legend_items]
  );

  const closeDayEditor = useCallback(() => {
    setDayEditor(buildInitialDayEditor());
  }, []);

  const handleLegendChange = (index: number, patch: Partial<PostingCalendarLegendItem>) => {
    setTemplateConfig((current) => {
      const base = current || DEFAULT_POSTING_CALENDAR_TEMPLATE;
      return {
        ...base,
        legend_items: (base.legend_items || []).map((item, itemIndex) =>
          itemIndex === index ? { ...item, ...patch } : item
        ),
      };
    });
  };

  const handleLegendAdd = () => {
    setTemplateConfig((current) => {
      const base = current || DEFAULT_POSTING_CALENDAR_TEMPLATE;
      return {
        ...base,
        legend_items: [
          ...(base.legend_items || []),
          {
            id: `legend-${Date.now()}`,
            label: 'NOVA LEGENDA',
            color: '#dbeafe',
            textColor: '#1f2937',
            visible: true,
          },
        ],
      };
    });
  };

  const handleLegendRemove = (index: number) => {
    setTemplateConfig((current) => {
      const base = current || DEFAULT_POSTING_CALENDAR_TEMPLATE;
      return {
        ...base,
        legend_items: (base.legend_items || []).filter((_, itemIndex) => itemIndex !== index),
      };
    });
  };

  const handleLegendReorder = (items: PostingCalendarLegendItem[]) => {
    setTemplateConfig((current) => ({ ...(current || DEFAULT_POSTING_CALENDAR_TEMPLATE), legend_items: items }));
  };

  const handleLegendSave = async () => {
    try {
      setSavingLegend(true);
      const savedResponse = await PostingCalendarService.saveTemplate({
        template: normalizePostingCalendarTemplateConfig({
          ...(templateConfig || DEFAULT_POSTING_CALENDAR_TEMPLATE),
          scope: 'default',
          client_id: null,
        }),
      });
      setTemplateConfig(savedResponse?.template || DEFAULT_POSTING_CALENDAR_TEMPLATE);
      toast.success('Legenda padrão salva.');
    } catch (error) {
      console.error('Falha ao salvar legenda:', error);
      toast.error('Não foi possível salvar a legenda.');
    } finally {
      setSavingLegend(false);
    }
  };

  const handleDaySave = async () => {
    if (!calendar || !dayEditor.day) return;

    try {
      setDayEditor((current) => ({ ...current, saving: true }));

      const existing =
        calendarItems.find((item) => item.id === dayEditor.itemId) ||
        calendarItems.find((item) => item.day_number === dayEditor.day) ||
        null;
      const scheduledDateTime = buildScheduledDateTime(dayEditor.scheduledDate, dayEditor.scheduledTime);
      const selectedDate =
        scheduledDateTime && ['agendado', 'publicado'].includes(dayEditor.workflowStatus)
          ? new Date(scheduledDateTime)
          : new Date(selectedYear, selectedMonth, dayEditor.day);
      const postDate = format(selectedDate, 'yyyy-MM-dd');
      const lockedWorkflowStatus = existing
        ? normalizeWorkflowStatus(existing.workflow_status || existing.status || 'rascunho')
        : 'rascunho';

      if (
        normalizeWorkflowStatus(dayEditor.workflowStatus || lockedWorkflowStatus) !== lockedWorkflowStatus
      ) {
        toast.info('O status operacional agora é atualizado apenas pelo fluxo oficial.');
      }

      await PostingCalendarService.saveCalendarItemVersioned({
        existingItem: existing,
        calendar_id: calendar.id,
        post_date: postDate,
        day_number: selectedDate.getDate(),
        post_type: dayEditor.postType,
        title: dayEditor.title,
        description: dayEditor.description,
        notes: dayEditor.notes,
        image_url: dayEditor.imageUrl || null,
        video_url: dayEditor.videoUrl || null,
        label_color: dayEditor.labelColor || null,
        workflow_status: lockedWorkflowStatus,
        status:
          lockedWorkflowStatus === 'publicado'
            ? 'published'
            : lockedWorkflowStatus === 'agendado'
              ? 'scheduled'
              : existing?.status || 'planned',
        owner_role: workflowActorRole,
        approval_status: existing?.approval_status || dayEditor.approvalStatus || 'pending',
        approval_notes: dayEditor.clientFeedback || existing?.approval_notes || null,
        scheduled_date: lockedWorkflowStatus === 'agendado' ? scheduledDateTime : existing?.scheduled_date || null,
        published_at:
          lockedWorkflowStatus === 'publicado'
            ? existing?.published_at || new Date().toISOString()
            : existing?.published_at || null,
        actor_id: currentUserId || null,
        change_reason: dayEditor.itemId ? dayEditor.changeReason : 'Versao inicial',
      });

      await loadCalendarData(selectedClientId, selectedMonth, selectedYear);
      toast.success(dayEditor.itemId ? 'Publicação atualizada.' : 'Publicação criada no calendário.');
      closeDayEditor();
    } catch (error) {
      console.error('Falha ao salvar dia:', error);
      toast.error('Não foi possível salvar este dia.');
      setDayEditor((current) => ({ ...current, saving: false }));
    }
  };

  const handleConfirmSchedule = async () => {
    if (!calendar || !dayEditor.itemId) return;
    if (!dayEditor.scheduledDate || !dayEditor.scheduledTime) {
      toast.error('Defina a data e o horário antes de confirmar o agendamento.');
      return;
    }

    try {
      setDayEditor((current) => ({ ...current, saving: true }));
      const existing = calendarItems.find((item) => item.id === dayEditor.itemId) || null;
      const scheduledDateTime = buildScheduledDateTime(dayEditor.scheduledDate, dayEditor.scheduledTime);
      if (!scheduledDateTime) throw new Error('Data ou horário inválido para agendamento.');

      await PostWorkflowService.schedulePost({
        postId: dayEditor.itemId,
        role: workflowActorRole,
        scheduledDate: scheduledDateTime,
        comment: dayEditor.changeReason.trim() || 'Agendamento confirmado pela equipe.',
        metadata: {
          source: 'posting_calendar_editor',
          client_name: selectedClient?.name || 'Cliente',
        },
      });

      await loadCalendarData(selectedClientId, selectedMonth, selectedYear);
      toast.success('Agendamento confirmado.');
      closeDayEditor();
    } catch (error) {
      console.error('Falha ao confirmar agendamento:', error);
      toast.error(error instanceof Error ? error.message : 'Não foi possível confirmar o agendamento.');
      setDayEditor((current) => ({ ...current, saving: false }));
    }
  };

  const handleMarkPublished = async () => {
    if (!calendar || !dayEditor.itemId) return;

    try {
      setDayEditor((current) => ({ ...current, saving: true }));
      const existing = calendarItems.find((item) => item.id === dayEditor.itemId) || null;
      const scheduledDateTime =
        buildScheduledDateTime(dayEditor.scheduledDate, dayEditor.scheduledTime) ||
        existing?.scheduled_date ||
        existing?.post_date ||
        null;

      await PostWorkflowService.publishPost({
        postId: dayEditor.itemId,
        role: workflowActorRole,
        publishedAt: new Date().toISOString(),
        comment: dayEditor.changeReason.trim() || 'Publicação confirmada pela equipe.',
        metadata: {
          source: 'posting_calendar_editor',
          scheduled_date: scheduledDateTime,
          client_name: selectedClient?.name || 'Cliente',
        },
      });

      await loadCalendarData(selectedClientId, selectedMonth, selectedYear);
      toast.success('Post marcado como publicado.');
      closeDayEditor();
    } catch (error) {
      console.error('Falha ao marcar como publicado:', error);
      toast.error('Não foi possível marcar o post como publicado.');
      setDayEditor((current) => ({ ...current, saving: false }));
    }
  };

  const handleDayDelete = async () => {
    if (!dayEditor.itemId) return;
    try {
      setDayEditor((current) => ({ ...current, saving: true }));
      const { error } = await supabase.from('posting_calendar_items').delete().eq('id', dayEditor.itemId);
      if (error) throw error;

      await loadCalendarData(selectedClientId, selectedMonth, selectedYear);
      toast.success('Publicação removida do calendário.');
      closeDayEditor();
    } catch (error) {
      console.error('Falha ao excluir dia:', error);
      toast.error('Não foi possível remover a publicação.');
      setDayEditor((current) => ({ ...current, saving: false }));
    }
  };

  const handleAssetUpload = async (kind: 'image' | 'video', file: File) => {
    if (!calendar || !selectedClientId || !dayEditor.day) return;
    try {
      setUploadingAsset(kind);
      const fileUrl = await readFileAsDataUrl(file);
      setDayEditor((current) => ({
        ...current,
        imageUrl: kind === 'image' ? fileUrl : current.imageUrl,
        videoUrl: kind === 'video' ? fileUrl : current.videoUrl,
      }));
      toast.success(kind === 'image' ? 'Imagem enviada.' : 'Vídeo enviado.');
    } catch (error) {
      console.error('Falha ao subir mídia:', error);
      toast.error('Não foi possível enviar o arquivo.');
    } finally {
      setUploadingAsset(null);
    }
  };

  const handleExport = async (formatType: 'png' | 'pdf') => {
    if (!previewRef.current || !calendar || !selectedClient) return;
    let exportNode: HTMLElement | null = null;
    try {
      setExporting(formatType);
      exportNode = await cloneForCanvasExport(previewRef.current, DEFAULT_LOGO_PATH);
      const dataUrl = await captureElementPngDataUrl(exportNode);
      const fileName = buildExportFileName(selectedClient.name, selectedMonth, selectedYear, formatType);
      let blob: Blob;

      if (formatType === 'png') {
        blob = await blobFromDataUrl(dataUrl);
      } else {
        const width = previewRef.current.offsetWidth || 1400;
        const height = previewRef.current.offsetHeight || 900;
        const pdf = new jsPDF({
          orientation: width >= height ? 'landscape' : 'portrait',
          unit: 'px',
          format: [width, height],
          compress: true,
        });
        pdf.addImage(dataUrl, 'PNG', 0, 0, width, height);
        blob = pdf.output('blob');
      }

      downloadBlob(blob, fileName);
      toast.success(`Calendário exportado em ${formatType.toUpperCase()}.`);
    } catch (error) {
      console.error('Falha ao exportar:', error);
      toast.error('Não foi possível exportar o calendário.');
    } finally {
      if (exportNode?.parentNode) exportNode.parentNode.removeChild(exportNode);
      setExporting(null);
    }
  };

  const handleSendApproval = async () => {
    if (!calendar?.id) return;

    try {
      setSendingApproval(true);

      const candidateItems = calendarItems
        .map((item) => {
          const currentStatus = normalizeWorkflowStatus(item.workflow_status || item.status || 'rascunho');
          return { item, currentStatus };
        })
        .filter(({ currentStatus }) => canSendToClientStatus(currentStatus));

      const isFinalStatus = (status: WorkflowStatus) => isFinalWorkflowStatus(status);
      const canSendToClient = (status: WorkflowStatus) => canSendToClientStatus(status);

      if (candidateItems.length === 0) {
        const blockedCount = calendarItems.filter((item) =>
          isFinalStatus(normalizeWorkflowStatus(item.workflow_status || item.status || 'rascunho'))
        ).length;
        if (blockedCount > 0) {
          toast.warning('Nenhum item elegível para reenvio. Itens já avançados foram preservados.');
        } else {
          toast.warning('Nenhum item elegível para envio à revisão interna.');
        }
        return;
      }

      for (const { item, currentStatus } of candidateItems) {
        if (!canSendToClient(currentStatus)) {
          continue;
        }

        await PostWorkflowService.applyResolvedTransition({
          postId: item.id,
          action: 'calendar_send_approval',
          role: workflowActorRole,
          requestedStatus: 'revisao_interna',
          comment: 'Conteúdo enviado para revisão interna.',
          metadata: {
            source: 'posting_calendar_send_approval',
            from_version: item.current_version_number ?? null,
            to_version: item.current_version_number ?? null,
          },
        });
      }

      const approvalItems = candidateItems
        .map(({ item }) => item)
        .slice()
        .sort((a, b) => a.day_number - b.day_number)
        .map((item, index) => ({
          title: item.title || item.post_type || `Post ${item.day_number}`,
          content: item.description || null,
          media_url: item.image_url || null,
          platform: 'instagram' as const,
          scheduled_date: item.post_date || null,
          sort_order: index,
          calendar_post_id: item.id,
        }));

      if (approvalItems.length > 0 && selectedClient?.id) {
        const { data: existingApproval } = await supabase
          .from('approvals')
          .select('id')
          .eq('entity_type', 'calendar_item')
          .eq('entity_id', calendar.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (existingApproval?.id) {
          await supabase
            .from('approvals')
            .update({
              status: 'pending',
              title: `Calendário ${selectedClient.name} — ${monthLabel} ${selectedYear}`,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingApproval.id);

          await supabase.from('approval_items').delete().eq('approval_id', existingApproval.id);

          await supabase.from('approval_items').insert(
            approvalItems.map((item) => ({
              approval_id: existingApproval.id,
              calendar_post_id: item.calendar_post_id,
              title: item.title,
              content: item.content,
              media_url: item.media_url,
              media_urls: [],
              platform: item.platform,
              scheduled_date: item.scheduled_date,
              sort_order: item.sort_order,
              status: 'pending',
            }))
          );
        } else {
          await ContentApprovalService.create({
            title: `Calendário ${selectedClient.name} — ${monthLabel} ${selectedYear}`,
            description: 'Aprovação gerada automaticamente a partir do calendário.',
            client_id: selectedClient.id,
            client_name: selectedClient.name,
            month: selectedMonth + 1,
            year: selectedYear,
            calendar_id: calendar.id,
            items: approvalItems,
          });
        }
      }

      await supabase
        .from('posting_calendars')
        .update({ status: 'pending' })
        .eq('id', calendar.id);

      setCalendar((current) => (current ? { ...current, status: 'pending' } : current));
      await loadCalendarData(selectedClientId, selectedMonth, selectedYear);
      toast.success('Calendário enviado para aprovação.');
    } catch (error) {
      console.error('Falha ao enviar aprovação:', error);
      toast.error('Não foi possível enviar para aprovação.');
    } finally {
      setSendingApproval(false);
    }
  };

  const handleMonthShift = async (direction: -1 | 1) => {
    const nextDate = new Date(selectedYear, selectedMonth + direction, 1);
    setSelectedMonth(nextDate.getMonth());
    setSelectedYear(nextDate.getFullYear());
  };

  const handleQuickCreate = () => {
    const today = new Date();
    const day =
      today.getMonth() === selectedMonth && today.getFullYear() === selectedYear ? today.getDate() : 1;
    openDayEditor(day);
  };

  const templateUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (selectedClientId) params.set('client', selectedClientId);
    params.set('month', String(selectedMonth));
    params.set('year', String(selectedYear));
    return `/posting-calendar/template?${params.toString()}`;
  }, [selectedClientId, selectedMonth, selectedYear]);

  if (loading) {
    return (
      <div className="min-h-full px-4 py-6">
        <div className="mx-auto max-w-[1680px] space-y-4">
          <div className="h-10 w-64 shimmer" />
          <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
            <div className="h-[520px] rounded-[24px] border border-border bg-white shimmer dark:bg-slate-900" />
            <div className="h-[520px] rounded-[24px] border border-border bg-white shimmer dark:bg-slate-900" />
          </div>
        </div>
      </div>
    );
  }

  if (!clients.length) {
    return (
      <div className="min-h-full px-4 py-6">
        <div className="mx-auto flex min-h-[360px] max-w-[1680px] items-center justify-center rounded-[24px] border border-border bg-white dark:bg-slate-950">
          <div className="space-y-2 text-center">
            <p className="text-[18px] font-semibold text-[#111111] dark:text-slate-100">Nenhum cliente disponível</p>
            <p className="text-[13px] text-[#6b7280] dark:text-slate-400">Cadastre um cliente antes de montar o calendário.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full px-4 py-6">
      <div className="mx-auto max-w-[1680px] space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-ui-label">Calendário de postagem</p>
            <h1 className="text-[26px] font-semibold tracking-[-0.04em] text-[#111111] dark:text-slate-100">
              Planejamento visual
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center rounded-full border border-border bg-white p-1 dark:bg-slate-900">
              <button
                type="button"
                onClick={() => setViewMode('visual')}
                className={cn(
                  'inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[12px] font-medium transition',
                  viewMode === 'visual'
                    ? 'bg-[#111111] text-white dark:bg-slate-200 dark:text-slate-900'
                    : 'text-[#667085] dark:text-slate-300'
                )}
              >
                <LayoutGrid size={13} />
                Visual
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={cn(
                  'inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[12px] font-medium transition',
                  viewMode === 'list'
                    ? 'bg-[#111111] text-white dark:bg-slate-200 dark:text-slate-900'
                    : 'text-[#667085] dark:text-slate-300'
                )}
              >
                <Rows3 size={13} />
                Lista
              </button>
            </div>

            <button type="button" onClick={() => navigate(templateUrl)} className="btn-secondary">
              <Pencil size={14} />
              Ajustar template
            </button>

            <button
              type="button"
              onClick={() => void handleExport('png')}
              disabled={exporting !== null}
              className="btn-secondary"
            >
              {exporting === 'png' ? <Loader2 size={14} className="animate-spin" /> : <FileImage size={14} />}
              PNG
            </button>

            <button
              type="button"
              onClick={() => void handleExport('pdf')}
              disabled={exporting !== null}
              className="btn-secondary"
            >
              {exporting === 'pdf' ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
              PDF
            </button>

            <button
              type="button"
              onClick={() => void handleSendApproval()}
              disabled={sendingApproval}
              className="btn-secondary"
            >
              {sendingApproval ? <Loader2 size={14} className="animate-spin" /> : null}
              Enviar aprovação
            </button>

            <button type="button" onClick={handleQuickCreate} className="btn-primary">
              <Plus size={14} />
              Novo post
            </button>
          </div>
        </header>

        <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="space-y-4">
            <section className="rounded-[28px] border border-border bg-white p-5 space-y-4 dark:bg-slate-950/90">
              <div className="space-y-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-ui-label">Filtros</span>
                  {isUpdating && <Loader2 size={14} className="animate-spin text-blue-600" />}
                </div>

                <div className="space-y-2">
                  <span className="text-[12px] font-medium text-[#6b7280] dark:text-slate-400">Cliente</span>
                  <select
                    value={selectedClientId}
                    onChange={(event) => setSelectedClientId(event.target.value)}
                    className="select-control"
                  >
                    {clients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <span className="text-[12px] font-medium text-[#6b7280] dark:text-slate-400">Mês</span>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => void handleMonthShift(-1)} className="btn-secondary h-10 w-10 px-0">
                      <ChevronLeft size={14} />
                    </button>
                    <select
                      value={selectedMonth}
                      onChange={(event) => setSelectedMonth(Number(event.target.value))}
                      className="select-control flex-1"
                    >
                      {MONTH_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label.charAt(0).toUpperCase() + option.label.slice(1)}
                        </option>
                      ))}
                    </select>
                    <button type="button" onClick={() => void handleMonthShift(1)} className="btn-secondary h-10 w-10 px-0">
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="text-[12px] font-medium text-[#6b7280] dark:text-slate-400">Ano</span>
                  <input
                    type="number"
                    value={selectedYear}
                    onChange={(event) => setSelectedYear(Number(event.target.value) || new Date().getFullYear())}
                    className="field-control"
                  />
                </div>

                <div className="space-y-2">
                  <span className="text-[12px] font-medium text-[#6b7280] dark:text-slate-400">Logo</span>
                  <label className="flex items-center gap-2 rounded-xl border border-border px-3 py-2.5 text-[12px] text-[#475467] dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={useClientLogo}
                      onChange={(event) => setUseClientLogo(event.target.checked)}
                    />
                    Usar logo do cliente
                  </label>
                </div>
              </div>
            </section>

            <section className="rounded-[28px] border border-border bg-white p-5 space-y-4 dark:bg-slate-950/90">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[15px] font-semibold text-[#111111] dark:text-slate-100">Legenda</p>
                  <p className="mt-1 text-[12px] text-[#6b7280] dark:text-slate-400">Edite aqui sem abrir o editor.</p>
                </div>
                <button type="button" onClick={handleLegendAdd} className="btn-secondary h-9 px-3">
                  <Plus size={14} />
                  Nova
                </button>
              </div>

              <div className="space-y-3">
                <LegendSortableList
                  items={templateConfig?.legend_items || []}
                  onChange={handleLegendChange}
                  onRemove={handleLegendRemove}
                  onReorder={handleLegendReorder}
                />
              </div>

              <button
                type="button"
                onClick={() => void handleLegendSave()}
                disabled={savingLegend}
                className="btn-secondary w-full justify-center"
              >
                {savingLegend ? <Loader2 size={14} className="animate-spin" /> : <Pencil size={14} />}
                Salvar legenda
              </button>
            </section>
          </aside>

          <section className="rounded-[28px] border border-border bg-white p-5 dark:bg-slate-950/90">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
              <div>
                <p className="text-[15px] font-semibold text-[#111111] dark:text-slate-100">
                  {viewMode === 'visual' ? 'Calendário de postagem' : 'Lista de publicações'} • {selectedClient?.name || 'Cliente'}
                </p>
                <p className="mt-1 text-[12px] text-[#6b7280] dark:text-slate-400">
                  {monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)} {selectedYear} • {calendarItems.length} dia(s) configurado(s)
                </p>
              </div>
            </div>

            {viewMode === 'visual' ? (
              <div
                className={cn(
                  'mt-5 overflow-hidden rounded-[32px] border border-border bg-white p-4 transition-all duration-300 dark:bg-[#0a0a0a]',
                  isUpdating && 'opacity-50 pointer-events-none grayscale-[20%]'
                )}
                ref={previewRef}
              >
                <PostingCalendarTemplateClassic
                  client={selectedClient}
                  brandLogoUrl={useClientLogo ? selectedClient?.logo_url || DEFAULT_LOGO_PATH : brandLogoUrl || DEFAULT_LOGO_PATH}
                  monthLabel={monthLabel}
                  year={selectedYear}
                  weekDays={weekDays}
                  calendarCells={calendarCells}
                  calendarItems={calendarItems.map((item) => ({
                    id: item.id,
                    day_number: item.day_number,
                    post_type: item.post_type,
                    title: item.title || null,
                    status: normalizeWorkflowStatusId(item.workflow_status),
                    label_color: item.label_color || null,
                  }))}
                  config={templateConfig || DEFAULT_POSTING_CALENDAR_TEMPLATE}
                  selectedDay={dayEditor.day}
                  onDayClick={openDayEditor}
                />
              </div>
            ) : (
              <div
                className={cn(
                  'mt-5 overflow-hidden rounded-[24px] border border-border bg-white transition-all duration-300 dark:bg-slate-950',
                  isUpdating && 'opacity-50 pointer-events-none grayscale-[20%]'
                )}
              >
                {calendarItems.length ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full border-collapse">
                      <thead className="bg-[#f8fafc]">
                        <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-[#667085]">
                          <th className="px-5 py-3">Post</th>
                          <th className="px-5 py-3">Cliente</th>
                          <th className="px-5 py-3">Status</th>
                          <th className="px-5 py-3">Data</th>
                          <th className="px-5 py-3">Hora</th>
                          <th className="px-5 py-3">Urgência</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {calendarItems
                          .slice()
                          .sort((left, right) => {
                            const leftTime = parseDateInputValue(getOperationalDateValue(left))?.getTime() || 0;
                            const rightTime = parseDateInputValue(getOperationalDateValue(right))?.getTime() || 0;
                            if (leftTime !== rightTime) return leftTime - rightTime;
                            return left.day_number - right.day_number;
                          })
                          .map((item) => {
                            const safeLegendItems = templateConfig?.legend_items || [];
                            const legend = safeLegendItems.find((entry) => entry.id === item.post_type);
                            const normalizedWorkflow = normalizeWorkflowStatusId(item.workflow_status);
                            const workflowLabel =
                              WORKFLOW_STATUS_OPTIONS.find((option) => option.value === normalizedWorkflow)?.label ||
                              ptBR.workflow.status.rascunho;
                            const operationalBadge = getWorkflowOperationalBadge(normalizedWorkflow);
                            const urgency = getOperationalUrgency(item);

                            return (
                              <tr
                                key={item.id}
                                onClick={() => openDayEditor(item.day_number)}
                                className="cursor-pointer transition hover:bg-[#fafafa] dark:hover:bg-slate-900/80"
                              >
                                <td className="px-5 py-4">
                                  <div className="space-y-1">
                                    <p className="text-[14px] font-medium text-[#111111] dark:text-slate-100">
                                      {item.title || legend?.label || 'Publicação'}
                                    </p>
                                    <div className="flex flex-wrap items-center gap-2">
                                      <div className="flex items-center gap-1.5 rounded-full border border-border bg-white px-2.5 py-1 shadow-sm w-fit dark:bg-slate-900">
                                        <div
                                          className="h-2 w-2 rounded-full shadow-inner"
                                          style={{ backgroundColor: item.label_color || legend?.color || '#cbd5e1' }}
                                        />
                                        <span className="text-[11px] font-semibold text-[#475467] dark:text-slate-300">
                                          {legend?.label || item.post_type}
                                        </span>
                                      </div>
                                      {item.current_version_number ? (
                                        <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700">
                                          v{item.current_version_number}
                                        </span>
                                      ) : null}
                                    </div>
                                  </div>
                                </td>
                                <td className="px-5 py-4 text-[13px] text-[#475467]">{selectedClient?.name || 'Cliente'}</td>
                                <td className="px-5 py-4">
                                  {operationalBadge ? (
                                    <span
                                      className={cn(
                                        'inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold',
                                        operationalBadge.className
                                      )}
                                    >
                                      {operationalBadge.label}
                                    </span>
                                  ) : (
                                    <span className="text-[12px] font-medium text-[#475467]">{workflowLabel}</span>
                                  )}
                                </td>
                                <td className="px-5 py-4 text-[13px] text-[#475467]">{formatOperationalDateLabel(item)}</td>
                                <td className="px-5 py-4 text-[13px] text-[#475467]">{formatOperationalTimeLabel(item)}</td>
                                <td className="px-5 py-4">
                                  <span
                                    className={cn(
                                      'inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold',
                                      urgency.className
                                    )}
                                  >
                                    {urgency.label}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="px-5 py-10 text-center">
                    <Rows3 className="mx-auto mb-3 h-8 w-8 text-[#c6ccd7]" />
                    <p className="text-[15px] font-medium text-[#111111] dark:text-slate-100">Nenhuma publicação listada</p>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      </div>

      <PostingCalendarDayEditor
        state={dayEditor}
        legendItems={templateConfig?.legend_items || []}
        uploadingAsset={uploadingAsset}
        onChange={(patch) => setDayEditor((current) => ({ ...current, ...patch }))}
        onClose={closeDayEditor}
        onSave={handleDaySave}
        onDelete={dayEditor.itemId ? handleDayDelete : null}
        onConfirmSchedule={dayEditor.itemId ? handleConfirmSchedule : null}
        onMarkPublished={dayEditor.itemId ? handleMarkPublished : null}
        onUploadAsset={handleAssetUpload}
      />
    </div>
  );
};

export default PostingCalendarHomePage;
