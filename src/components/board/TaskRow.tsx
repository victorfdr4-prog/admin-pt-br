import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  Circle,
  Clock3,
  Flag,
  MoreHorizontal,
  Trash2,
  User2,
  CalendarDays,
  Timer,
  Tag,
  Layers3,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useBoardStore } from '@/store/useBoardStore';
import { useDeleteTask, useUpdateTask } from '@/hooks/useBoardV2';
import type { BoardStatus, BoardTaskV2 } from '@/services/boardV2.service';
import type { LiveBoardColumnLayout } from './boardTableLayout';

const PRIORITY_LABELS: Record<string, string> = {
  high: 'Alta',
  medium: 'Média',
  low: 'Baixa',
};

const PRIORITY_STYLES: Record<string, string> = {
  high: 'bg-[#ffe2e0] text-[#c25555]',
  medium: 'bg-[#ffe8cc] text-[#c26a2e]',
  low: 'bg-[#fff2c2] text-[#9b7a18]',
};

const ACTIVITY_STYLES: Record<string, string> = {
  planejamento: 'bg-[#dbe9ff] text-[#4c6fa5]',
  execucao: 'bg-[#dcf4e5] text-[#3f8b63]',
  revisao: 'bg-[#ecdffb] text-[#7a59a6]',
  aprovacao: 'bg-[#f3e4ff] text-[#8458d8]',
};

const ACTIVITY_OPTIONS = ['Definição de escopo', 'Planejamento', 'Execução operacional', 'Revisão/Qualidade', 'Aprovação'];
const AVATAR_TONES = ['#f59e0b', '#8b5cf6', '#10b981', '#3b82f6', '#ef4444', '#14b8a6'];

type QuickCellId =
  | 'assignee'
  | 'due_date'
  | 'estimated_minutes'
  | 'activity_type'
  | 'priority'
  | 'status'
  | 'stage';

const getInitials = (name?: string | null) =>
  String(name || '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || '?';

const getAvatarTone = (seed: string) => {
  const sum = seed.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return AVATAR_TONES[sum % AVATAR_TONES.length];
};

const formatDueDate = (value?: string | null) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
};

const formatRelative = (value?: string | null) => {
  if (!value) return '—';
  const target = new Date(value).getTime();
  if (Number.isNaN(target)) return '—';
  const diff = Date.now() - target;
  const minutes = Math.max(1, Math.round(diff / 60000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h`;
  const days = Math.round(hours / 24);
  return `${days} d`;
};

const normalizeActivityStyle = (value?: string | null) => {
  const label = String(value || '').toLowerCase();
  if (label.includes('planej') || label.includes('escopo')) return ACTIVITY_STYLES.planejamento;
  if (label.includes('execu') || label.includes('produ')) return ACTIVITY_STYLES.execucao;
  if (label.includes('revis')) return ACTIVITY_STYLES.revisao;
  if (label.includes('aprova')) return ACTIVITY_STYLES.aprovacao;
  return 'bg-[#eef2f7] text-[#667085]';
};

const normalizeStatusStyle = (status?: BoardStatus | null) => {
  const label = String(status?.name || '').toLowerCase();
  if (label.includes('concl')) return 'bg-[#dcf4e5] text-[#2f865a]';
  if (label.includes('anda')) return 'bg-[#ffe8bf] text-[#a05b16]';
  if (label.includes('inic') || label.includes('fazer') || label.includes('todo')) return 'bg-[#eef1f5] text-[#667085]';
  if (label.includes('stuck') || label.includes('trav')) return 'bg-[#ffe1e3] text-[#bf4c5d]';
  return 'bg-[#eef1f5] text-[#667085]';
};

const getStatusDisplay = (statuses: BoardStatus[], task: BoardTaskV2) =>
  statuses.find((status) => status.id === task.status_id) ?? task.status_obj ?? statuses[0] ?? null;

const QuickPopover = ({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}) => (
  <div className="absolute left-2 top-[38px] z-30 w-[244px] rounded-2xl border border-[#e5eaf1] bg-white p-3 shadow-sm">
    <div className="mb-3 flex items-start justify-between gap-3">
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#98a2b3]">{title}</div>
        {subtitle ? <div className="mt-1 text-[12px] text-[#667085]">{subtitle}</div> : null}
      </div>
      <button
        type="button"
        onClick={onClose}
        className="rounded-md p-1 text-[#98a2b3] transition-colors hover:bg-[#f3f5f8] hover:text-[#344054]"
      >
        <X className="size-4" />
      </button>
    </div>
    {children}
  </div>
);

interface TaskRowProps {
  task: BoardTaskV2;
  statuses: BoardStatus[];
  users: { id: string; name: string; avatar?: string | null }[];
  clients: { id: string; name: string }[];
  sectionName?: string;
  columns: LiveBoardColumnLayout[];
  gridTemplateColumns: string;
}

export const TaskRow: React.FC<TaskRowProps> = ({
  task,
  statuses,
  users,
  clients,
  sectionName,
  columns,
  gridTemplateColumns,
}) => {
  const { openTaskId, setOpenTaskId } = useBoardStore();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const [showMenu, setShowMenu] = useState(false);
  const [openCell, setOpenCell] = useState<QuickCellId | null>(null);
  const [activityDraft, setActivityDraft] = useState(task.activity_type || '');
  const [estimatedDraft, setEstimatedDraft] = useState(task.estimated_minutes ? String(task.estimated_minutes) : '');
  const rowRef = useRef<HTMLDivElement | null>(null);

  const currentStatus = getStatusDisplay(statuses, task);
  const doneStatus = statuses.find((status) => status.is_done);
  const assignee = users.find((user) => user.id === task.assignee_id);
  const client = clients.find((item) => item.id === task.client_id);
  const isSelected = openTaskId === task.id;
  const stageLabel = sectionName || currentStatus?.name || 'Sem etapa';
  const estimatedLabel = task.estimated_minutes ? `${task.estimated_minutes} m` : '—';
  const relativeUpdated = formatRelative(task.updated_at);
  const statusClass = normalizeStatusStyle(currentStatus);
  const activityClass = normalizeActivityStyle(task.activity_type);
  const priorityClass = PRIORITY_STYLES[task.priority] ?? PRIORITY_STYLES.low;

  useEffect(() => {
    const onDocumentClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!rowRef.current?.contains(target)) {
        setOpenCell(null);
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', onDocumentClick);
    return () => document.removeEventListener('mousedown', onDocumentClick);
  }, []);

  const assigneeContent = useMemo(() => {
    if (assignee?.avatar) {
      return (
        <img
          src={assignee.avatar}
          alt={assignee.name}
          className="h-8 w-8 rounded-full border border-[#edf1f5] object-cover"
        />
      );
    }

    if (assignee?.name) {
      return (
        <div
          className="flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-semibold text-white"
          style={{ backgroundColor: getAvatarTone(assignee.name) }}
        >
          {getInitials(assignee.name)}
        </div>
      );
    }

    return (
      <div className="flex h-8 w-8 items-center justify-center rounded-full border border-dashed border-[#d5dbe5] text-[#9aa4b2]">
        <User2 className="size-4" />
      </div>
    );
  }, [assignee]);

  const updateTaskField = (patch: Parameters<typeof updateTask.mutate>[0]['patch']) => {
    updateTask.mutate({
      taskId: task.id,
      boardId: task.board_id!,
      patch,
    });
  };

  const renderCell = (column: LiveBoardColumnLayout, index: number) => {
    const borderClass = index > 0 ? 'border-l border-[#edf1f6]' : '';

    if (column.id === 'task') {
      return (
        <div
          key={column.id}
          className={`relative flex min-w-0 items-center gap-3 px-4 py-2.5 ${borderClass}`}
          onClick={() => setOpenTaskId(task.id)}
        >
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              if (!doneStatus) return;
              updateTaskField({
                status_id: currentStatus?.is_done ? statuses[0]?.id ?? null : doneStatus.id,
              });
            }}
            className="shrink-0 text-[#7a8493] transition-colors hover:text-[#253041]"
          >
            {currentStatus?.is_done ? <CheckCircle2 className="size-[18px]" /> : <Circle className="size-[18px]" />}
          </button>

          <div className="min-w-0 flex-1 cursor-pointer text-left">
            <div className="truncate text-[14px] font-medium text-[#1f2937]">{task.title}</div>
            {client?.name ? (
              <div className="mt-0.5 truncate text-[12px] text-[#8a94a6]">{client.name}</div>
            ) : null}
          </div>

          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setShowMenu((value) => !value);
              setOpenCell(null);
            }}
            className="shrink-0 rounded-md p-1 text-[#9aa4b2] opacity-0 transition-all hover:bg-[#f3f5f8] hover:text-[#344054] group-hover:opacity-100"
          >
            <MoreHorizontal className="size-4" />
          </button>

          {showMenu && (
            <div
              className="absolute right-4 top-[42px] z-20 w-40 overflow-hidden rounded-xl border border-[#e5eaf1] bg-white shadow-sm"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => {
                  setOpenTaskId(task.id);
                  setShowMenu(false);
                }}
                className="block w-full px-3 py-2 text-left text-[13px] text-[#344054] hover:bg-[#f8fafc]"
              >
                Abrir tarefa
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteTask.mutate({ taskId: task.id, boardId: task.board_id! });
                  setShowMenu(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-[#d92d20] hover:bg-[#fff5f4]"
              >
                <Trash2 className="size-3.5" />
                Excluir
              </button>
            </div>
          )}
        </div>
      );
    }

    if (column.id === 'assignee') {
      return (
        <div key={column.id} className={`relative flex items-center px-3 py-2 ${borderClass}`}>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setOpenCell((value) => (value === 'assignee' ? null : 'assignee'));
              setShowMenu(false);
            }}
            className="flex w-full items-center justify-center rounded-md px-1 py-1 text-left transition-colors hover:bg-[#f6f8fb]"
            title={assignee?.name || 'Selecionar responsável'}
          >
            {assigneeContent}
            <ChevronDown className="absolute right-1 top-1/2 size-3.5 -translate-y-1/2 text-[#98a2b3]" />
          </button>

          {openCell === 'assignee' && (
            <QuickPopover title="Responsável" subtitle="Clique para atribuir ou remover." onClose={() => setOpenCell(null)}>
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => {
                    updateTaskField({ assignee_id: null });
                    setOpenCell(null);
                  }}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-[13px] text-[#344054] hover:bg-[#f8fafc]"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full border border-dashed border-[#d5dbe5] text-[#9aa4b2]">
                    <User2 className="size-4" />
                  </div>
                  Sem responsável
                </button>
                {users.map((user) => (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => {
                      updateTaskField({ assignee_id: user.id });
                      setOpenCell(null);
                    }}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-[13px] text-[#344054] hover:bg-[#f8fafc]"
                  >
                    {user.avatar ? (
                      <img src={user.avatar} alt={user.name} className="h-8 w-8 rounded-full object-cover" />
                    ) : (
                      <div
                        className="flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-semibold text-white"
                        style={{ backgroundColor: getAvatarTone(user.name) }}
                      >
                        {getInitials(user.name)}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="truncate">{user.name}</div>
                      <div className="truncate text-[11px] text-[#98a2b3]">{user.id === task.assignee_id ? 'Atual' : 'Selecionar'}</div>
                    </div>
                  </button>
                ))}
              </div>
            </QuickPopover>
          )}
        </div>
      );
    }

    if (column.id === 'due_date') {
      return (
        <div key={column.id} className={`relative flex items-center px-3 py-2 ${borderClass}`}>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setOpenCell((value) => (value === 'due_date' ? null : 'due_date'));
              setShowMenu(false);
            }}
            className="flex w-full items-center gap-2 rounded-md px-1 py-1 text-left text-[13px] text-[#475467] transition-colors hover:bg-[#f6f8fb]"
          >
            <CalendarDays className="size-3.5 text-[#98a2b3]" />
            {formatDueDate(task.due_date)}
            <ChevronDown className="ml-auto size-3.5 text-[#98a2b3]" />
          </button>

          {openCell === 'due_date' && (
            <QuickPopover title="Prazo" subtitle="Ajuste a data rapidamente." onClose={() => setOpenCell(null)}>
              <div className="space-y-2">
                <input
                  type="date"
                  defaultValue={task.due_date?.slice(0, 10) || ''}
                  onChange={(event) => updateTaskField({ due_date: event.target.value || null })}
                  className="h-10 w-full rounded-xl border border-[#d9e0ea] px-3 text-[13px] text-[#111827] outline-none focus:border-[#c4ccda]"
                />
                <button
                  type="button"
                  onClick={() => {
                    updateTaskField({ due_date: null });
                    setOpenCell(null);
                  }}
                  className="w-full rounded-xl border border-[#e3e8f0] px-3 py-2 text-[13px] text-[#344054]"
                >
                  Remover prazo
                </button>
              </div>
            </QuickPopover>
          )}
        </div>
      );
    }

    if (column.id === 'estimated_minutes') {
      return (
        <div key={column.id} className={`relative flex items-center px-3 py-2 ${borderClass}`}>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setOpenCell((value) => (value === 'estimated_minutes' ? null : 'estimated_minutes'));
              setEstimatedDraft(task.estimated_minutes ? String(task.estimated_minutes) : '');
              setShowMenu(false);
            }}
            className="flex w-full items-center gap-2 rounded-md px-1 py-1 text-left text-[13px] text-[#475467] transition-colors hover:bg-[#f6f8fb]"
          >
            <Timer className="size-3.5 text-[#98a2b3]" />
            {estimatedLabel}
            <ChevronDown className="ml-auto size-3.5 text-[#98a2b3]" />
          </button>

          {openCell === 'estimated_minutes' && (
            <QuickPopover title="Duração" subtitle="Defina a estimativa em minutos." onClose={() => setOpenCell(null)}>
              <div className="space-y-2">
                <div className="flex items-center gap-2 rounded-xl border border-[#d9e0ea] p-2">
                  <button
                    type="button"
                    onClick={() => setEstimatedDraft((current) => String(Math.max(0, Number(current || 0) - 5)))}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#e3e8f0] text-[16px] text-[#344054]"
                  >
                    –
                  </button>
                  <input
                    value={estimatedDraft}
                    onChange={(event) => setEstimatedDraft(event.target.value.replace(/\D+/g, ''))}
                    className="min-w-0 flex-1 bg-transparent text-center text-[14px] font-semibold text-[#111827] outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setEstimatedDraft((current) => String(Number(current || 0) + 5))}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#e3e8f0] text-[16px] text-[#344054]"
                  >
                    +
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    updateTaskField({ estimated_minutes: estimatedDraft ? Number(estimatedDraft) : null });
                    setOpenCell(null);
                  }}
                  className="w-full rounded-xl border border-[#111827] bg-[#111827] px-3 py-2 text-[13px] font-medium text-white"
                >
                  Salvar duração
                </button>
              </div>
            </QuickPopover>
          )}
        </div>
      );
    }

    if (column.id === 'activity_type') {
      return (
        <div key={column.id} className={`relative flex items-center px-3 py-2 ${borderClass}`}>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setOpenCell((value) => (value === 'activity_type' ? null : 'activity_type'));
              setActivityDraft(task.activity_type || '');
              setShowMenu(false);
            }}
            className="flex w-full items-center rounded-md px-1 py-1 text-left transition-colors hover:bg-[#f6f8fb]"
          >
            <span className={cn('inline-flex max-w-full items-center gap-1 truncate rounded-md px-2.5 py-1 text-[12px] font-medium', activityClass)}>
              {task.activity_type || '—'}
              <ChevronDown className="size-3 text-current opacity-70" />
            </span>
          </button>

          {openCell === 'activity_type' && (
            <QuickPopover title="Tipo de atividade" subtitle="Edite ou escolha um rótulo rápido." onClose={() => setOpenCell(null)}>
              <div className="space-y-2">
                <input
                  value={activityDraft}
                  onChange={(event) => setActivityDraft(event.target.value)}
                  className="h-10 w-full rounded-xl border border-[#d9e0ea] px-3 text-[13px] text-[#111827] outline-none focus:border-[#c4ccda]"
                  placeholder="Ex.: Definição de escopo"
                />
                <div className="flex flex-wrap gap-2">
                  {ACTIVITY_OPTIONS.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setActivityDraft(option)}
                      className="rounded-full border border-[#e3e8f0] px-3 py-1.5 text-[12px] text-[#344054]"
                    >
                      {option}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    updateTaskField({ activity_type: activityDraft || null });
                    setOpenCell(null);
                  }}
                  className="w-full rounded-xl border border-[#111827] bg-[#111827] px-3 py-2 text-[13px] font-medium text-white"
                >
                  Salvar atividade
                </button>
              </div>
            </QuickPopover>
          )}
        </div>
      );
    }

    if (column.id === 'priority') {
      return (
        <div key={column.id} className={`relative flex items-center px-3 py-2 ${borderClass}`}>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setOpenCell((value) => (value === 'priority' ? null : 'priority'));
              setShowMenu(false);
            }}
            className="flex w-full items-center rounded-md px-1 py-1 text-left transition-colors hover:bg-[#f6f8fb]"
          >
            <span className={cn('inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[12px] font-medium', priorityClass)}>
              <Flag className="size-3" />
              {PRIORITY_LABELS[task.priority] ?? task.priority}
              <ChevronDown className="size-3 text-current opacity-70" />
            </span>
          </button>

          {openCell === 'priority' && (
            <QuickPopover title="Prioridade" subtitle="Escolha a prioridade da tarefa." onClose={() => setOpenCell(null)}>
              <div className="space-y-1">
                {(['high', 'medium', 'low'] as const).map((priority) => (
                  <button
                    key={priority}
                    type="button"
                    onClick={() => {
                      updateTaskField({ priority });
                      setOpenCell(null);
                    }}
                    className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left hover:bg-[#f8fafc]"
                  >
                    <span className={cn('inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[12px] font-medium', PRIORITY_STYLES[priority])}>
                      <Flag className="size-3" />
                      {PRIORITY_LABELS[priority]}
                    </span>
                    {task.priority === priority ? <span className="text-[11px] text-[#98a2b3]">Atual</span> : null}
                  </button>
                ))}
              </div>
            </QuickPopover>
          )}
        </div>
      );
    }

    if (column.id === 'status' || column.id === 'stage') {
      const cellId: QuickCellId = column.id === 'status' ? 'status' : 'stage';
      const badgeLabel = column.id === 'status' ? currentStatus?.name || 'Sem status' : stageLabel;

      return (
        <div key={column.id} className={`relative flex items-center px-3 py-2 ${borderClass}`}>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setOpenCell((value) => (value === cellId ? null : cellId));
              setShowMenu(false);
            }}
            className="flex w-full items-center rounded-md px-1 py-1 text-left transition-colors hover:bg-[#f6f8fb]"
          >
            <span className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] font-medium',
              column.id === 'status' ? statusClass : 'bg-[#f1ddfb] text-[#9159b8]'
            )}>
              <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
              {badgeLabel}
              <ChevronDown className="size-3 text-current opacity-70" />
            </span>
          </button>

          {openCell === cellId && (
            <QuickPopover
              title={column.id === 'status' ? 'Status' : 'Estágio'}
              subtitle="Selecione rapidamente a opção disponível."
              onClose={() => setOpenCell(null)}
            >
              <div className="space-y-1">
                {statuses.map((status) => (
                  <button
                    key={status.id}
                    type="button"
                    onClick={() => {
                      updateTaskField({ status_id: status.id });
                      setOpenCell(null);
                    }}
                    className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left hover:bg-[#f8fafc]"
                  >
                    <span
                      className="inline-flex items-center gap-2 rounded-md px-2.5 py-1 text-[12px] font-medium"
                      style={{
                        backgroundColor: `${status.color}18`,
                        color: status.color,
                      }}
                    >
                      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: status.color }} />
                      {status.name}
                    </span>
                    {task.status_id === status.id ? <span className="text-[11px] text-[#98a2b3]">Atual</span> : null}
                  </button>
                ))}
              </div>
            </QuickPopover>
          )}
        </div>
      );
    }

    if (column.id === 'updated_at') {
      return (
        <div key={column.id} className={`flex items-center px-3 py-2 text-[12px] text-[#7b8796] ${borderClass}`}>
          <span className="inline-flex items-center gap-1 text-[#98a2b3]">
            <Clock3 className="size-3.5" />
            {relativeUpdated}
          </span>
        </div>
      );
    }

    return (
      <div key={column.id} className={`flex items-center px-3 py-2 ${borderClass}`}>
        —
      </div>
    );
  };

  return (
    <div
      ref={rowRef}
      className={cn(
        'group relative grid min-h-[52px] border-b border-[#edf1f6] bg-white transition-colors duration-100 hover:bg-[#fbfcfe]',
        isSelected && 'bg-[#f7f9fc]'
      )}
      style={{ gridTemplateColumns }}
    >
      {columns.map((column, index) => renderCell(column, index))}
    </div>
  );
};
