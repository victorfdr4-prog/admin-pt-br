import React, { useEffect, useMemo, useState } from 'react';
import {
  AlignLeft,
  Calendar,
  Check,
  ChevronDown,
  Circle,
  Clock,
  ExternalLink,
  Flag,
  Link2,
  Loader2,
  MessageSquare,
  Paperclip,
  Plus,
  Radar,
  Rows3,
  Tag,
  Trash2,
  User,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { getCurrentUser } from '@/services/_shared';
import { useAddTaskLink, useBoardTask, useDeleteTask, useUpdateTask } from '@/hooks/useBoardV2';
import type { BoardStatus, TaskLink } from '@/services/boardV2.service';
import { BoardSelectMenu, type BoardSelectOption } from './BoardSelectMenu';
import { ACTIVITY_TYPES, CHANNELS, PRIORITY_META } from './boardOptions';

interface TaskDrawerProps {
  taskId: string;
  boardId: string;
  statuses: BoardStatus[];
  users: { id: string; name: string; avatar?: string | null }[];
  clients: { id: string; name: string }[];
  onClose: () => void;
}

interface TaskComment {
  id: string;
  text: string;
  created_at: string;
  user_id: string;
  author_name: string;
  author_avatar: string | null;
}

type DrawerTab = 'detail' | 'checklist' | 'links' | 'comments';
type DrawerMenu = 'status' | 'assignee' | 'client' | 'activity' | 'channel' | null;

const PRIORITY_COLORS: Record<string, string> = {
  high: 'border-rose-200 bg-rose-50 text-rose-700',
  medium: 'border-amber-200 bg-amber-50 text-amber-700',
  low: 'border-lime-200 bg-lime-50 text-lime-700',
};

const PRIORITY_LABELS: Record<string, string> = {
  high: 'Alta',
  medium: 'Média',
  low: 'Baixa',
};

const ACTIVITY_TONES: Record<string, string> = {
  'Post Feed': '#2563eb',
  Stories: '#0ea5e9',
  Reels: '#8b5cf6',
  Carrossel: '#f97316',
  Copy: '#ec4899',
  Design: '#7c3aed',
  Vídeo: '#ef4444',
  Campanha: '#16a34a',
  Relatório: '#475569',
  Reunião: '#eab308',
  Tráfego: '#f59e0b',
  SEO: '#10b981',
  'E-mail': '#14b8a6',
  Outro: '#94a3b8',
};

const CHANNEL_TONES: Record<string, string> = {
  Instagram: '#ec4899',
  Facebook: '#2563eb',
  TikTok: '#111827',
  LinkedIn: '#0a66c2',
  YouTube: '#ef4444',
  'Google Ads': '#f59e0b',
  'Meta Ads': '#2563eb',
  'E-mail': '#14b8a6',
  Site: '#475569',
};

const LINK_TYPE_LABELS: Record<TaskLink['link_type'], { emoji: string; label: string }> = {
  general: { emoji: '🔗', label: 'Link' },
  figma: { emoji: '🎨', label: 'Figma' },
  gdrive: { emoji: '📁', label: 'Drive' },
  notion: { emoji: '📝', label: 'Notion' },
  loom: { emoji: '🎬', label: 'Loom' },
  github: { emoji: '💻', label: 'GitHub' },
};

const formatTimeAgo = (value?: string | null) => {
  if (!value) return 'agora';
  const target = new Date(value).getTime();
  if (Number.isNaN(target)) return 'agora';
  const diff = Date.now() - target;
  const minutes = Math.max(1, Math.round(diff / 60000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h`;
  const days = Math.round(hours / 24);
  return `${days} d`;
};

const formatDueDateLabel = (value?: string | null) => {
  if (!value) return 'Sem prazo';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Sem prazo';
  return parsed.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
};

const formatMinutesLabel = (value?: number | null) => {
  if (!value || value <= 0) return 'Sem estimativa';
  if (value >= 60) {
    const hours = value / 60;
    return `${hours % 1 === 0 ? hours.toFixed(0) : hours.toFixed(1)} h`;
  }
  return `${value} min`;
};

const getInitials = (value?: string | null) =>
  String(value || '')
    .trim()
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || '?';

export const TaskDrawer: React.FC<TaskDrawerProps> = ({
  taskId,
  boardId,
  statuses,
  users,
  clients,
  onClose,
}) => {
  const { data: task, isLoading } = useBoardTask(taskId);
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const addLink = useAddTaskLink();

  const [tab, setTab] = useState<DrawerTab>('detail');
  const [editTitle, setEditTitle] = useState(false);
  const [titleVal, setTitleVal] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [newLinkTitle, setNewLinkTitle] = useState('');
  const [newCheckItem, setNewCheckItem] = useState('');
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [commentDraft, setCommentDraft] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  const [savingComment, setSavingComment] = useState(false);
  const [openMenu, setOpenMenu] = useState<DrawerMenu>(null);

  useEffect(() => {
    if (task) setTitleVal(task.title);
  }, [task]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const loadComments = async () => {
      setLoadingComments(true);
      try {
        const { data, error } = await supabase
          .from('activity_logs')
          .select('id, user_id, metadata, created_at')
          .eq('entity', 'task')
          .eq('entity_id', taskId)
          .eq('action', 'task_comment')
          .order('created_at', { ascending: false })
          .limit(20);

        if (error) throw error;

        const rows = data || [];
        const userIds = Array.from(new Set(rows.map((row) => String(row.user_id || '')).filter(Boolean)));
        const { data: profiles } = userIds.length
          ? await supabase.from('profiles').select('id, full_name, avatar_url').in('id', userIds)
          : { data: [] as Array<{ id: string; full_name: string | null; avatar_url: string | null }> };

        const profileMap = new Map((profiles || []).map((profile) => [profile.id, profile]));
        const normalized = rows
          .map((row: any) => {
            const metadata = row.metadata && typeof row.metadata === 'object' ? row.metadata : {};
            const text = String((metadata as Record<string, unknown>).text || '').trim();
            if (!text) return null;
            const profile = profileMap.get(String(row.user_id || ''));
            return {
              id: String(row.id),
              text,
              created_at: String(row.created_at || new Date().toISOString()),
              user_id: String(row.user_id || ''),
              author_name: String(profile?.full_name || 'Equipe'),
              author_avatar: profile?.avatar_url || null,
            } satisfies TaskComment;
          })
          .filter((item): item is TaskComment => Boolean(item));

        if (!cancelled) setComments(normalized);
      } catch (error) {
        console.error('Falha ao carregar comentários da tarefa:', error);
        if (!cancelled) setComments([]);
      } finally {
        if (!cancelled) setLoadingComments(false);
      }
    };

    void loadComments();

    channel = supabase
      .channel(`task-comments-${taskId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'activity_logs' },
        (payload) => {
          const next = payload.new as Record<string, unknown>;
          if (String(next.entity || '') !== 'task') return;
          if (String(next.entity_id || '') !== taskId) return;
          if (String(next.action || '') !== 'task_comment') return;
          void loadComments();
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [taskId]);

  const saveField = (patch: Parameters<typeof updateTask.mutate>[0]['patch']) => {
    if (!task) return;
    updateTask.mutate({ taskId: task.id, boardId, patch });
  };

  const saveTitle = () => {
    if (titleVal.trim() && titleVal !== task?.title) {
      saveField({ title: titleVal.trim() });
    }
    setEditTitle(false);
  };

  const toggleCheckItem = (id: string) => {
    if (!task) return;
    const updated = task.checklist.map((item) => (item.id === id ? { ...item, done: !item.done } : item));
    saveField({ checklist: updated });
  };

  const addCheckItem = () => {
    if (!newCheckItem.trim() || !task) return;
    const updated = [
      ...task.checklist,
      { id: crypto.randomUUID(), title: newCheckItem.trim(), done: false },
    ];
    saveField({ checklist: updated });
    setNewCheckItem('');
  };

  const removeCheckItem = (id: string) => {
    if (!task) return;
    saveField({ checklist: task.checklist.filter((item) => item.id !== id) });
  };

  const handleAddLink = () => {
    if (!newLinkUrl.trim()) return;
    addLink.mutate({
      taskId,
      url: newLinkUrl.trim(),
      title: newLinkTitle.trim() || undefined,
    });
    setNewLinkUrl('');
    setNewLinkTitle('');
  };

  const handleDelete = () => {
    if (window.confirm('Excluir esta tarefa?')) {
      deleteTask.mutate({ taskId, boardId });
      onClose();
    }
  };

  const handleAddComment = async () => {
    const text = commentDraft.trim();
    if (!text || !task || savingComment) return;

    setSavingComment(true);
    const optimisticId = `temp-${Date.now()}`;
    setCommentDraft('');
    setComments((current) => [
      {
        id: optimisticId,
        text,
        created_at: new Date().toISOString(),
        user_id: 'me',
        author_name: 'Você',
        author_avatar: null,
      },
      ...current,
    ]);

    try {
      const user = await getCurrentUser();
      const metadata = {
        text,
        task_title: task.title,
      };

      const { error: logError } = await supabase.from('activity_logs').insert({
        user_id: user.id,
        client_id: task.client_id || null,
        action: 'task_comment',
        entity: 'task',
        entity_id: task.id,
        metadata,
        user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      });

      if (logError) throw logError;

      void supabase.from('timeline_events').insert({
        event_type: 'task_comment',
        entity_type: 'task',
        entity_id: task.id,
        client_id: task.client_id || null,
        actor_id: user.id,
        title: `Comentário na tarefa: ${task.title}`,
        metadata,
      });
    } catch (error) {
      console.error('Falha ao salvar comentário da tarefa:', error);
      setComments((current) => current.filter((item) => item.id !== optimisticId));
      setCommentDraft(text);
    } finally {
      setSavingComment(false);
    }
  };

  const currentStatus = statuses.find((status) => status.id === task?.status_id) || null;
  const currentClient = clients.find((client) => client.id === task?.client_id) || null;
  const currentAssignee = users.find((user) => user.id === task?.assignee_id) || null;
  const checkDone = task?.checklist.filter((item) => item.done).length ?? 0;
  const checkTotal = task?.checklist.length ?? 0;

  const assigneeOptions = useMemo<BoardSelectOption[]>(
    () => [
      { value: '', label: 'Sem responsável', description: 'Aguardando definição do dono.' },
      ...users.map((user) => ({
        value: user.id,
        label: user.name,
        description: 'Responsável direto pela execução.',
        avatarUrl: user.avatar || null,
        initials: getInitials(user.name),
      })),
    ],
    [users]
  );

  const clientOptions = useMemo<BoardSelectOption[]>(
    () => [
      { value: '', label: 'Sem cliente', description: 'Entrega ainda sem vínculo comercial.' },
      ...clients.map((client) => ({
        value: client.id,
        label: client.name,
        description: 'Conta impactada por esta tarefa.',
        initials: getInitials(client.name),
      })),
    ],
    [clients]
  );

  const statusOptions = useMemo<BoardSelectOption[]>(
    () =>
      statuses.map((status) => ({
        value: status.id,
        label: status.name,
        description: status.is_done ? 'Entrega finalizada.' : 'Etapa atual do fluxo.',
        tone: status.color,
      })),
    [statuses]
  );

  const activityOptions = useMemo<BoardSelectOption[]>(
    () => [
      { value: '', label: 'Sem tipo definido', description: 'Classifique para facilitar a leitura.', tone: '#94a3b8' },
      ...ACTIVITY_TYPES.map((activity) => ({
        value: activity,
        label: activity,
        description: 'Tipo principal da entrega.',
        tone: ACTIVITY_TONES[activity] || '#8b5cf6',
      })),
    ],
    []
  );

  const channelOptions = useMemo<BoardSelectOption[]>(
    () => [
      { value: '', label: 'Sem canal definido', description: 'Canal ainda não associado.', tone: '#94a3b8' },
      ...CHANNELS.map((channel) => ({
        value: channel,
        label: channel,
        description: 'Canal principal de execução.',
        tone: CHANNEL_TONES[channel] || '#0ea5e9',
      })),
    ],
    []
  );

  const priorityMeta = PRIORITY_META[task?.priority ?? 'medium'];
  const dueDateLabel = formatDueDateLabel(task?.due_date);
  const estimateLabel = formatMinutesLabel(task?.estimated_minutes);
  const checklistProgress = checkTotal ? Math.round((checkDone / checkTotal) * 100) : 0;
  const linkCount = task?.links?.length ?? 0;

  return (
    <div className="fixed inset-0 z-[60] flex justify-end">
      <motion.button
        type="button"
        aria-label="Fechar painel da tarefa"
        className="absolute inset-0 bg-black/20 backdrop-blur-[3px]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />

      <motion.aside
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', stiffness: 340, damping: 34 }}
        className="relative z-[61] flex h-full w-full max-w-[680px] flex-col border-l border-[#e0e8d4] bg-[#f8fbf2] shadow-[0_24px_64px_rgba(84,104,28,0.18)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-[#e3ead8] bg-[radial-gradient(circle_at_top_left,_rgba(154,202,82,0.2),_transparent_40%),linear-gradient(135deg,#ffffff_0%,#fbfdf4_62%,#f3f8df_100%)] px-7 py-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1 pr-2">
              {editTitle ? (
                <input
                  autoFocus
                  value={titleVal}
                  onChange={(event) => setTitleVal(event.target.value)}
                  onBlur={saveTitle}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') saveTitle();
                    if (event.key === 'Escape') {
                      setTitleVal(task?.title ?? '');
                      setEditTitle(false);
                    }
                  }}
                  className="w-full border-b border-[#111827] bg-transparent pb-1 text-[22px] font-semibold text-[#111827] outline-none"
                />
              ) : (
                <>
                  <button
                    type="button"
                    onDoubleClick={() => setEditTitle(true)}
                    className="block max-w-full truncate text-left text-[24px] font-semibold tracking-tight text-[#111827]"
                    title="Duplo clique para editar"
                  >
                    {isLoading ? '…' : task?.title || 'Tarefa'}
                  </button>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px] text-[#667085]">
                    <span className="rounded-full border border-[#d9e3ca] bg-white/90 px-2.5 py-1 font-medium">
                      {currentClient?.name || 'Sem cliente'}
                    </span>
                    {currentStatus?.name ? (
                        <span className="rounded-full border border-[#d9e3ca] bg-white/90 px-2.5 py-1 font-medium">
                        {currentStatus.name}
                      </span>
                    ) : null}
                    <span className="rounded-full border border-[#d9e3ca] bg-white/90 px-2.5 py-1 font-medium">
                      {priorityMeta.label}
                    </span>
                    <span className="rounded-full border border-[#d9e3ca] bg-white/90 px-2.5 py-1 font-medium">
                      Atualizado {formatTimeAgo(task?.updated_at)}
                    </span>
                  </div>
                </>
              )}
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleDelete}
                className="rounded-xl p-2 text-[#d92d20] transition-colors hover:bg-[#fff5f4]"
              >
                <Trash2 className="size-4" />
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl p-2 text-[#667085] transition-colors hover:bg-[#f7f8fa] hover:text-[#111827]"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="size-6 animate-spin text-[#98a2b3]" />
          </div>
        ) : task ? (
          <>
            <div className="border-b border-[#e3ead8] bg-white/90 px-5 py-4 backdrop-blur">
              <div className="flex rounded-2xl border border-[#dfe7d2] bg-[#f6f9ee] p-1">
                {([
                  ['detail', 'Detalhes'],
                  ['checklist', `Checklist${checkTotal ? ` ${checkDone}/${checkTotal}` : ''}`],
                  ['links', 'Links'],
                  ['comments', `Comentários${comments.length ? ` (${comments.length})` : ''}`],
                ] as const).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setTab(value)}
                    className={cn(
                      'relative rounded-xl px-3 py-2.5 text-[13px] font-medium transition-colors',
                      tab === value
                        ? 'bg-white text-[#111827] shadow-[0_8px_16px_rgba(15,23,42,0.06)]'
                        : 'text-[#667085] hover:text-[#111827]'
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="minimal-scrollbar flex-1 overflow-y-auto px-7 py-6">
              <AnimatePresence mode="wait">
                {tab === 'detail' && (
                  <motion.div
                    key="detail"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.18 }}
                    className="space-y-6"
                  >
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      <DrawerMetricCard
                        label="Etapa"
                        value={currentStatus?.name || 'Sem status'}
                        hint="Fluxo atual"
                        tone={currentStatus?.color || '#94a3b8'}
                      />
                      <DrawerMetricCard
                        label="Prazo"
                        value={dueDateLabel}
                        hint={task.due_date ? 'Data alvo' : 'Sem data definida'}
                        tone="#84cc16"
                      />
                      <DrawerMetricCard
                        label="Checklist"
                        value={checkTotal ? `${checkDone}/${checkTotal}` : 'Vazio'}
                        hint={checkTotal ? `${checklistProgress}% concluído` : 'Sem itens'}
                        tone="#65a30d"
                      />
                      <DrawerMetricCard
                        label="Estimativa"
                        value={estimateLabel}
                        hint={linkCount ? `${linkCount} link(s) anexado(s)` : 'Sem links anexados'}
                        tone="#f59e0b"
                      />
                    </div>

                    <DrawerSection
                      eyebrow="Contexto da entrega"
                      title="Leitura rápida da tarefa"
                      description="Status, prioridade, tipo e canal organizados como painel operacional."
                    >
                      <div className="grid gap-4 lg:grid-cols-2">
                        <DrawerField label="Status" icon={<Circle className="size-3.5" />}>
                          <BoardSelectMenu
                            open={openMenu === 'status'}
                            onToggle={() => setOpenMenu((current) => (current === 'status' ? null : 'status'))}
                            selectedValue={task.status_id}
                            options={statusOptions}
                            placeholder="Escolher status"
                            onSelect={(value) => {
                              saveField({ status_id: value || null });
                              setOpenMenu(null);
                            }}
                          />
                        </DrawerField>

                        <DrawerField label="Prioridade" icon={<Flag className="size-3.5" />}>
                          <div className="grid grid-cols-3 gap-2">
                            {(['low', 'medium', 'high'] as const).map((priority) => (
                              <button
                                key={priority}
                                type="button"
                                onClick={() => saveField({ priority })}
                                className={cn(
                                  'rounded-[20px] border px-3 py-3 text-left text-xs font-semibold transition-all',
                                  task.priority === priority
                                    ? PRIORITY_COLORS[priority]
                                    : 'border-[#dfe7d2] bg-white text-[#64748b] hover:border-[#c8d7b3] hover:bg-[#f8fbf0]'
                                )}
                              >
                                <span className="block">{PRIORITY_LABELS[priority]}</span>
                                <span className="mt-1 block text-[11px] font-medium opacity-80">
                                  {PRIORITY_META[priority].description}
                                </span>
                              </button>
                            ))}
                          </div>
                        </DrawerField>

                        <DrawerField label="Tipo de atividade" icon={<Rows3 className="size-3.5" />}>
                          <BoardSelectMenu
                            open={openMenu === 'activity'}
                            onToggle={() => setOpenMenu((current) => (current === 'activity' ? null : 'activity'))}
                            selectedValue={task.activity_type}
                            options={activityOptions}
                            placeholder="Classificar atividade"
                            onSelect={(value) => {
                              saveField({ activity_type: value || null });
                              setOpenMenu(null);
                            }}
                          />
                        </DrawerField>

                        <DrawerField label="Canal" icon={<Radar className="size-3.5" />}>
                          <BoardSelectMenu
                            open={openMenu === 'channel'}
                            onToggle={() => setOpenMenu((current) => (current === 'channel' ? null : 'channel'))}
                            selectedValue={task.channel}
                            options={channelOptions}
                            placeholder="Escolher canal"
                            onSelect={(value) => {
                              saveField({ channel: value || null });
                              setOpenMenu(null);
                            }}
                          />
                        </DrawerField>
                      </div>
                    </DrawerSection>

                    <DrawerSection
                      eyebrow="Operação"
                      title="Quem toca e quando entrega"
                      description="Responsável, cliente, prazo e carga estimada concentrados na mesma dobra."
                    >
                      <div className="grid gap-4 lg:grid-cols-2">
                        <DrawerField label="Responsável" icon={<User className="size-3.5" />}>
                          <BoardSelectMenu
                            open={openMenu === 'assignee'}
                            onToggle={() => setOpenMenu((current) => (current === 'assignee' ? null : 'assignee'))}
                            selectedValue={task.assignee_id}
                            options={assigneeOptions}
                            placeholder="Definir responsável"
                            onSelect={(value) => {
                              saveField({ assignee_id: value || null });
                              setOpenMenu(null);
                            }}
                          />
                        </DrawerField>

                        <DrawerField label="Cliente" icon={<Tag className="size-3.5" />}>
                          <BoardSelectMenu
                            open={openMenu === 'client'}
                            onToggle={() => setOpenMenu((current) => (current === 'client' ? null : 'client'))}
                            selectedValue={task.client_id}
                            options={clientOptions}
                            placeholder="Vincular cliente"
                            onSelect={(value) => {
                              saveField({ client_id: value || null });
                              setOpenMenu(null);
                            }}
                          />
                        </DrawerField>

                        <DrawerField label="Prazo" icon={<Calendar className="size-3.5" />}>
                          <input
                            type="date"
                            value={task.due_date?.split('T')[0] ?? ''}
                            onChange={(event) => saveField({ due_date: event.target.value || null })}
                            className="w-full rounded-[22px] border border-[#dbe5cc] bg-[linear-gradient(180deg,#ffffff_0%,#fbfdf4_100%)] px-4 py-3.5 text-sm font-semibold text-[#0f172a] outline-none shadow-[0_12px_30px_rgba(84,104,28,0.08)] transition-all focus:border-[#9aca52] focus:bg-white focus:ring-4 focus:ring-[#ddeaaf]/30"
                          />
                        </DrawerField>

                        <DrawerField label="Estimativa (min)" icon={<Clock className="size-3.5" />}>
                          <input
                            type="number"
                            min={0}
                            value={task.estimated_minutes ?? ''}
                            onChange={(event) =>
                              saveField({ estimated_minutes: event.target.value ? Number(event.target.value) : null })
                            }
                            placeholder="Ex.: 120"
                            className="w-full rounded-[22px] border border-[#dbe5cc] bg-[linear-gradient(180deg,#ffffff_0%,#fbfdf4_100%)] px-4 py-3.5 text-sm font-semibold text-[#0f172a] outline-none shadow-[0_12px_30px_rgba(84,104,28,0.08)] transition-all focus:border-[#9aca52] focus:bg-white focus:ring-4 focus:ring-[#ddeaaf]/30"
                          />
                        </DrawerField>
                      </div>
                    </DrawerSection>

                    <DrawerSection
                      eyebrow="Execução"
                      title="Briefing e regras de saída"
                      description="Descrição centralizada e aprovação visível sem ruído de formulário."
                    >
                      <div className="space-y-4">
                        <DrawerField label="Descrição" icon={<AlignLeft className="size-3.5" />}>
                          <textarea
                            defaultValue={task.description ?? ''}
                            onBlur={(event) => saveField({ description: event.target.value || null })}
                            rows={6}
                            placeholder="Contexto, referência, CTA, observações de execução e restrições."
                            className="w-full resize-none rounded-[24px] border border-[#dbe5cc] bg-[linear-gradient(180deg,#ffffff_0%,#fbfdf4_100%)] px-4 py-4 text-sm leading-6 text-[#0f172a] outline-none shadow-[0_12px_30px_rgba(84,104,28,0.08)] transition-all focus:border-[#9aca52] focus:bg-white"
                          />
                        </DrawerField>

                        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_220px]">
                          <div className="rounded-[24px] border border-[#dfe7d2] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbf1_100%)] px-5 py-5">
                            <div className="flex items-center gap-3">
                              <div className="rounded-2xl bg-[#eef7db] p-2 text-[#6f8f2f]">
                                <Paperclip className="size-4" />
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-[#0f172a]">Requer aprovação</p>
                                <p className="text-xs leading-5 text-[#64748b]">
                                  Mantém a tarefa vinculada ao fluxo de validação antes da execução final.
                                </p>
                              </div>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => saveField({ approval_required: !task.approval_required })}
                            className={cn(
                              'relative flex items-center justify-between rounded-[24px] border px-5 py-5 text-left transition-all',
                              task.approval_required
                                ? 'border-[#1b1c15] bg-[#1b1c15] text-white shadow-[0_18px_40px_rgba(27,28,21,0.22)]'
                                : 'border-[#dfe7d2] bg-white text-[#0f172a]'
                            )}
                          >
                            <div>
                              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] opacity-70">
                                Estado
                              </div>
                              <div className="mt-2 text-sm font-semibold">
                                {task.approval_required ? 'Fluxo com aprovação' : 'Execução direta'}
                              </div>
                            </div>
                            <span
                              className={cn(
                                'relative h-6 w-11 rounded-full transition-colors',
                                task.approval_required ? 'bg-white/20' : 'bg-[#dfe7d2]'
                              )}
                            >
                              <span
                                className={cn(
                                  'absolute top-1 h-4 w-4 rounded-full bg-white transition-transform',
                                  task.approval_required ? 'translate-x-6' : 'translate-x-1'
                                )}
                              />
                            </span>
                          </button>
                        </div>
                      </div>
                    </DrawerSection>
                  </motion.div>
                )}

                {tab === 'checklist' && (
                  <motion.div
                    key="checklist"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.18 }}
                    className="space-y-4"
                  >
                    <div className="rounded-[24px] border border-[#dfe7d2] bg-[linear-gradient(180deg,#ffffff_0%,#fbfdf4_100%)] p-4">
                      {checkTotal > 0 && (
                        <div className="mb-4">
                          <div className="mb-1 flex justify-between text-xs text-[#667085]">
                            <span>Progresso</span>
                            <span>{checkDone}/{checkTotal}</span>
                          </div>
                          <div className="h-1.5 overflow-hidden rounded-full bg-[#e9efdf]">
                            <div
                              className="h-full rounded-full bg-[linear-gradient(90deg,#84cc16_0%,#22c55e_100%)] transition-all"
                              style={{ width: `${(checkDone / checkTotal) * 100}%` }}
                            />
                          </div>
                        </div>
                      )}

                      <div className="space-y-2">
                        {task.checklist.map((item) => (
                          <div key={item.id} className="group flex items-center gap-3 rounded-2xl border border-[#e3ead8] bg-white px-3 py-3">
                            <button type="button" onClick={() => toggleCheckItem(item.id)} className="shrink-0">
                              {item.done ? (
                                <Check className="size-4 text-[#16a34a]" />
                              ) : (
                                <Circle className="size-4 text-[#c1c9d6]" />
                              )}
                            </button>
                            <span className={cn('flex-1 text-sm text-[#111827]', item.done && 'line-through text-[#98a2b3]')}>
                              {item.title}
                            </span>
                            <button
                              type="button"
                              onClick={() => removeCheckItem(item.id)}
                              className="rounded-md p-1 opacity-0 transition-all hover:bg-[#f7f8fa] hover:text-[#d92d20] group-hover:opacity-100"
                            >
                              <X className="size-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <input
                        value={newCheckItem}
                        onChange={(event) => setNewCheckItem(event.target.value)}
                        onKeyDown={(event) => event.key === 'Enter' && addCheckItem()}
                        placeholder="Novo item do checklist..."
                        className="flex-1 rounded-2xl border border-[#dfe7d2] bg-[#f8fbf1] px-4 py-3 text-sm text-[#111827] outline-none transition focus:border-[#9aca52] focus:bg-white"
                      />
                      <button
                        type="button"
                        onClick={addCheckItem}
                        disabled={!newCheckItem.trim()}
                        className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#111827] text-white disabled:opacity-50"
                      >
                        <Plus className="size-4" />
                      </button>
                    </div>
                  </motion.div>
                )}

                {tab === 'links' && (
                  <motion.div
                    key="links"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.18 }}
                    className="space-y-4"
                  >
                    <div className="space-y-3">
                      {(task.links ?? []).map((link) => {
                        const meta = LINK_TYPE_LABELS[link.link_type] ?? LINK_TYPE_LABELS.general;
                        return (
                          <a
                            key={link.id}
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group flex items-center gap-3 rounded-[22px] border border-[#dfe7d2] bg-[linear-gradient(180deg,#ffffff_0%,#fbfdf4_100%)] px-4 py-4 transition-colors hover:bg-[#f8fbf0]"
                          >
                            <span className="text-lg">{meta.emoji}</span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-[#111827]">{link.title || link.url}</p>
                              <p className="truncate text-xs text-[#98a2b3]">{meta.label}</p>
                            </div>
                            <ExternalLink className="size-3.5 text-[#98a2b3] opacity-0 transition-opacity group-hover:opacity-100" />
                          </a>
                        );
                      })}
                    </div>

                    <div className="rounded-[24px] border border-[#dfe7d2] bg-white p-4">
                      <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#98a2b3]">Adicionar link</p>
                      <div className="space-y-2">
                        <input
                          value={newLinkUrl}
                          onChange={(event) => setNewLinkUrl(event.target.value)}
                          placeholder="URL"
                          className="w-full rounded-2xl border border-[#dfe7d2] bg-[#f8fbf1] px-4 py-3 text-sm text-[#111827] outline-none transition focus:border-[#9aca52] focus:bg-white"
                        />
                        <input
                          value={newLinkTitle}
                          onChange={(event) => setNewLinkTitle(event.target.value)}
                          placeholder="Título (opcional)"
                          className="w-full rounded-2xl border border-[#dfe7d2] bg-[#f8fbf1] px-4 py-3 text-sm text-[#111827] outline-none transition focus:border-[#9aca52] focus:bg-white"
                        />
                        <button
                          type="button"
                          onClick={handleAddLink}
                          disabled={!newLinkUrl.trim() || addLink.isPending}
                          className="inline-flex items-center gap-2 rounded-2xl bg-[#111827] px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
                        >
                          <Link2 className="size-4" />
                          Adicionar
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}

                {tab === 'comments' && (
                  <motion.div
                    key="comments"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.18 }}
                    className="space-y-4"
                  >
                    <div className="rounded-[24px] border border-[#dfe7d2] bg-[linear-gradient(180deg,#ffffff_0%,#fbfdf4_100%)] p-4">
                      <div className="mb-4 flex items-center gap-2">
                        <MessageSquare className="size-4 text-[#64748b]" />
                        <div className="text-[13px] font-semibold text-[#111827]">Timeline de comentários</div>
                      </div>

                      <div className="relative max-h-[360px] overflow-y-auto pr-1">
                        <div className="absolute bottom-0 left-[15px] top-0 w-px bg-[#e6ebf3]" />
                        {loadingComments ? (
                          <div className="pl-10 text-[12px] text-[#98a2b3]">Carregando comentários…</div>
                        ) : comments.length ? (
                          <div className="space-y-4">
                            {comments.map((comment) => (
                              <div key={comment.id} className="relative pl-10">
                                <div className="absolute left-0 top-1 flex h-8 w-8 items-center justify-center rounded-full border border-[#e3e8f2] bg-white shadow-sm">
                                  {comment.author_avatar ? (
                                    <img
                                      src={comment.author_avatar}
                                      alt={comment.author_name}
                                      className="h-8 w-8 rounded-full object-cover"
                                    />
                                  ) : (
                                    <span className="text-[10px] font-semibold text-[#475467]">
                                      {getInitials(comment.author_name)}
                                    </span>
                                  )}
                                </div>
                                <div className="rounded-2xl border border-[#e3ead8] bg-white px-4 py-3 shadow-[0_8px_20px_rgba(84,104,28,0.08)]">
                                  <div className="mb-1 flex items-center gap-2">
                                    <span className="text-[12px] font-semibold text-[#111827]">{comment.author_name}</span>
                                    <span className="text-[11px] text-[#98a2b3]">{formatTimeAgo(comment.created_at)}</span>
                                  </div>
                                  <p className="text-[13px] leading-6 text-[#334155]">{comment.text}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="pl-10 text-[12px] text-[#98a2b3]">Nenhum comentário nesta tarefa.</div>
                        )}
                      </div>
                    </div>

                    <div className="rounded-[24px] border border-[#e3ead8] bg-white p-4">
                      <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.14em] text-[#98a2b3]">
                        Novo comentário
                      </label>
                      <textarea
                        value={commentDraft}
                        onChange={(event) => setCommentDraft(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                            event.preventDefault();
                            void handleAddComment();
                          }
                        }}
                        rows={4}
                        placeholder="Escreva contexto, bloqueio ou próxima ação. Use Ctrl+Enter para enviar."
                        className="w-full resize-none rounded-2xl border border-[#dfe7d2] bg-[#f8fbf1] px-4 py-3 text-sm text-[#111827] outline-none transition focus:border-[#9aca52] focus:bg-white"
                      />
                      <div className="mt-3 flex justify-end">
                        <button
                          type="button"
                          onClick={() => void handleAddComment()}
                          disabled={!commentDraft.trim() || savingComment}
                          className="rounded-2xl bg-[#111827] px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
                        >
                          {savingComment ? 'Enviando...' : 'Comentar'}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </>
        ) : null}
      </motion.aside>
    </div>
  );
};

const DrawerField: React.FC<{ label: string; icon: React.ReactNode; children: React.ReactNode }> = ({
  label,
  icon,
  children,
}) => (
  <div className="space-y-2.5">
    <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8da16a]">
      {icon}
      {label}
    </label>
    {children}
  </div>
);

const DrawerSection = ({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) => (
  <section className="rounded-[28px] border border-[#dfe7d2] bg-white p-6 shadow-[0_18px_40px_rgba(84,104,28,0.08)]">
    <div className="mb-5">
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8da16a]">{eyebrow}</div>
      <h3 className="mt-2 text-lg font-semibold tracking-[-0.03em] text-[#0f172a]">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-[#64748b]">{description}</p>
    </div>
    {children}
  </section>
);

const DrawerMetricCard = ({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone: string;
}) => (
  <div className="rounded-[24px] border border-[#dfe7d2] bg-white px-4 py-4 shadow-[0_14px_30px_rgba(84,104,28,0.08)]">
    <div className="flex items-center gap-2">
      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: tone }} />
      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8da16a]">{label}</div>
    </div>
    <div className="mt-3 text-lg font-semibold text-[#0f172a]">{value}</div>
    <div className="mt-1 text-xs text-[#64748b]">{hint}</div>
  </div>
);
