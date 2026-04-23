import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, MoreHorizontal, Plus } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useQueryClient } from '@tanstack/react-query';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';
import { boardKeys, useBoardConfig, useBoardTasks } from '@/hooks/useBoardV2';
import { useBoardStore } from '@/store/useBoardStore';
import { TaskDrawer } from './TaskDrawer';
import { CreateTaskModal } from './CreateTaskModal';
import { toast } from '@/components/ui/sonner';
import { BoardV2Service, type BoardStatus, type BoardTaskV2 } from '@/services/boardV2.service';

interface BoardKanbanProps {
  boardId: string;
  clients: { id: string; name: string }[];
  users: { id: string; name: string; avatar?: string | null }[];
}

const PRIORITY_DOT: Record<string, string> = {
  high: 'bg-rose-500', medium: 'bg-amber-400', low: 'bg-slate-300',
};

const formatDue = (value?: string | null) => {
  if (!value) return 'Sem prazo';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sem prazo';
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
};

const getInitial = (name?: string | null) => String(name || '?').trim().charAt(0).toUpperCase() || '?';
const hexToRgba = (hex: string | null | undefined, alpha: number) => {
  const normalized = String(hex || '').replace('#', '').trim();
  const full = normalized.length === 3
    ? normalized.split('').map((char) => `${char}${char}`).join('')
    : normalized;

  if (!/^[0-9a-fA-F]{6}$/.test(full)) return `rgba(148, 163, 184, ${alpha})`;

  const value = Number.parseInt(full, 16);
  const red = (value >> 16) & 255;
  const green = (value >> 8) & 255;
  const blue = value & 255;
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
};

// ── Kanban Card ────────────────────────────────────────────────────────────────
interface KanbanCardProps {
  task: BoardTaskV2;
  users: { id: string; name: string; avatar?: string | null }[];
  overlay?: boolean;
}

const KanbanCard: React.FC<KanbanCardProps & { draggable?: boolean }> = ({ task, users, overlay, draggable = true }) => {
  const { setOpenTaskId } = useBoardStore();
  const assignee = users.find((u) => u.id === task.assignee_id);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    disabled: !draggable,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => setOpenTaskId(task.id)}
      className={cn(
        'group cursor-pointer select-none rounded-[20px] border border-[#e5eaf1] bg-[linear-gradient(180deg,#ffffff_0%,#fbfdff_100%)] px-3 py-3 text-left transition-all hover:-translate-y-0.5 hover:border-[#d7dee8] hover:shadow-[0_14px_30px_rgba(15,23,42,0.08)]',
        overlay && 'rotate-[1deg] border-[#cfd7e3] bg-white'
      )}
    >
      <div className="mb-1.5 flex items-start gap-2">
        <div className={cn('mt-1 size-2 rounded-full shrink-0', PRIORITY_DOT[task.priority])} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-medium leading-snug text-[#111827]">{task.title}</p>
          <p className="mt-0.5 truncate text-[12px] text-[#98a2b3]">
            {task.client_name || 'Sem cliente'}
          </p>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2">
        {task.activity_type ? (
          <span className="truncate rounded-full border border-[#eceff4] px-2 py-0.5 text-[11px] text-[#667085]">
            {task.activity_type}
          </span>
        ) : (
          <span />
        )}
        <button
          type="button"
          className="rounded-md p-1 text-[#98a2b3] opacity-0 transition-all hover:bg-[#f3f5f8] hover:text-[#344054] group-hover:opacity-100"
          onClick={(event) => event.stopPropagation()}
        >
          <MoreHorizontal className="size-4" />
        </button>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2 border-t border-[#f1f3f6] pt-3">
        <div className="inline-flex items-center gap-1.5 text-[11px] text-[#98a2b3]">
          <CalendarDays className="size-3.5" />
          <span className={cn(task.due_date && new Date(task.due_date) < new Date() ? 'font-semibold text-rose-500' : '')}>
            {formatDue(task.due_date)}
          </span>
        </div>
        {assignee ? (
          assignee.avatar ? (
            <img src={assignee.avatar} className="size-6 rounded-full border border-[#edf1f5] object-cover" />
          ) : (
            <div className="flex size-6 items-center justify-center rounded-full bg-[#eef2f7] text-[10px] font-semibold text-[#475467]">
              {getInitial(assignee.name)}
            </div>
          )
        ) : (
          <div className="flex size-6 items-center justify-center rounded-full border border-dashed border-[#d7dee8] text-[10px] text-[#98a2b3]">
            ?
          </div>
        )}
      </div>
    </div>
  );
};

// ── Kanban Column ─────────────────────────────────────────────────────────────
interface KanbanColumnProps {
  status: BoardStatus;
  tasks: BoardTaskV2[];
  users: { id: string; name: string; avatar?: string | null }[];
  onAddTask: () => void;
  onRenameStatus: (statusId: string, nextName: string) => Promise<void>;
}

const KanbanColumn: React.FC<KanbanColumnProps> = ({ status, tasks, users, onAddTask, onRenameStatus }) => {
  const { setNodeRef } = useDroppable({ id: status.id });
  const [isEditingName, setIsEditingName] = useState(false);
  const [draftName, setDraftName] = useState(status.name);

  useEffect(() => {
    setDraftName(status.name);
  }, [status.name]);

  const commitStatusName = async () => {
    const nextName = draftName.trim();
    setIsEditingName(false);
    if (!nextName || nextName === status.name) {
      setDraftName(status.name);
      return;
    }
    await onRenameStatus(status.id, nextName);
  };

  return (
    <div className="flex w-[288px] shrink-0 flex-col overflow-hidden rounded-[18px] border border-[#e7ebf2] bg-[#fbfcfd]">
      <div
        className="flex items-center gap-2 border-b px-3 py-2.5"
        style={{
          borderColor: hexToRgba(status.color, 0.2),
          background: `linear-gradient(135deg, ${hexToRgba(status.color, 0.18)} 0%, ${hexToRgba(status.color, 0.05)} 46%, #ffffff 100%)`,
        }}
      >
        <span
          className="size-2.5 rounded-full shrink-0"
          style={{ background: status.color }}
        />
        <div className="min-w-0 flex-1">
          {isEditingName ? (
            <input
              autoFocus
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
              onBlur={() => void commitStatusName()}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void commitStatusName();
                if (event.key === 'Escape') {
                  setDraftName(status.name);
                  setIsEditingName(false);
                }
              }}
              className="h-7 w-full rounded-lg border border-[#d9e0ea] bg-white px-2.5 text-[13px] font-semibold text-[#111827] outline-none focus:border-[#bfc9d9]"
            />
          ) : (
            <button
              type="button"
              onClick={() => setIsEditingName(true)}
              className="w-full truncate text-left text-[13px] font-semibold text-[#111827] transition-colors hover:text-[#0f172a]"
              title="Clique para editar o título da coluna"
            >
              {status.name}
            </button>
          )}
        </div>
        <span className="rounded-full border border-[#e3e8f0] bg-white px-2 py-0.5 text-[11px] text-[#667085]">
          {tasks.length}
        </span>
        <button
          onClick={onAddTask}
          className="rounded-full border bg-white p-1.5 transition-colors hover:text-[#111827]"
          style={{
            borderColor: hexToRgba(status.color, 0.22),
            color: status.color,
          }}
        >
          <Plus className="size-3.5" />
        </button>
      </div>

      <div
        ref={setNodeRef}
        className="minimal-scrollbar flex min-h-[96px] flex-1 flex-col gap-2 overflow-y-auto p-2.5"
        style={{
          background: `linear-gradient(180deg, ${hexToRgba(status.color, 0.04)} 0%, rgba(255,255,255,0.92) 24%)`,
        }}
      >
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <KanbanCard key={task.id} task={task} users={users} />
          ))}
        </SortableContext>
        {tasks.length === 0 && (
          <div className="rounded-[16px] border border-dashed border-[#e3e8f0] bg-white px-3 py-6 text-center text-[11px] text-[#98a2b3]">
            Arraste tarefas aqui
          </div>
        )}
      </div>
    </div>
  );
};

// ── Board Kanban ───────────────────────────────────────────────────────────────

export const BoardKanban: React.FC<BoardKanbanProps> = ({ boardId, clients, users }) => {
  const { openTaskId, setOpenTaskId } = useBoardStore();
  const { data: config } = useBoardConfig(boardId);
  const { data: tasks = [] } = useBoardTasks(boardId);
  const queryClient = useQueryClient();

  const statuses = config?.statuses ?? [];
  const [dragTask, setDragTask] = useState<BoardTaskV2 | null>(null);
  const [addToStatus, setAddToStatus] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const grouped = useMemo(() => {
    const map = new Map<string, BoardTaskV2[]>();
    statuses.forEach((s) => map.set(s.id, []));
    tasks.forEach((t) => {
      if (t.status_id && map.has(t.status_id)) map.get(t.status_id)!.push(t);
      else if (statuses[0]) map.get(statuses[0].id)!.push(t);
    });
    map.forEach((statusTasks, statusId) => {
      map.set(
        statusId,
        [...statusTasks].sort((left, right) => Number(left.sort_order || 0) - Number(right.sort_order || 0))
      );
    });
    return map;
  }, [tasks, statuses]);

  const getTaskStatusId = (task: BoardTaskV2) => task.status_id || statuses[0]?.id || null;

  const invalidateBoardTasks = async () => {
    await queryClient.invalidateQueries({ queryKey: boardKeys.tasks(boardId) });
    await queryClient.invalidateQueries({ queryKey: boardKeys.config(boardId) });
  };

  const renameStatus = async (statusId: string, nextName: string) => {
    try {
      await BoardV2Service.updateStatus(statusId, { name: nextName });
      await invalidateBoardTasks();
      toast.success('Título da coluna atualizado.');
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'Não foi possível atualizar a coluna.');
    }
  };

  const handleDragStart = (e: DragStartEvent) => {
    setDragTask(tasks.find((t) => t.id === e.active.id) ?? null);
  };

  const handleDragEnd = async (e: DragEndEvent) => {
    setDragTask(null);
    const { active, over } = e;
    if (!over || active.id === over.id) return;

    const activeTask = tasks.find((task) => task.id === active.id);
    if (!activeTask) return;

    const overTask = tasks.find((task) => task.id === over.id);
    const sourceStatusId = getTaskStatusId(activeTask);
    const targetStatusId =
      statuses.find((status) => status.id === over.id)?.id ??
      (overTask ? getTaskStatusId(overTask) : null);

    if (!sourceStatusId || !targetStatusId) return;

    const sourceIds = (grouped.get(sourceStatusId) ?? []).map((task) => task.id);
    const targetBaseIds =
      sourceStatusId === targetStatusId
        ? sourceIds.filter((taskId) => taskId !== activeTask.id)
        : (grouped.get(targetStatusId) ?? []).map((task) => task.id).filter((taskId) => taskId !== activeTask.id);

    const overIndex = overTask ? targetBaseIds.indexOf(overTask.id) : -1;
    const insertAt = overIndex >= 0 ? overIndex : targetBaseIds.length;
    const destinationIds = [...targetBaseIds];
    destinationIds.splice(insertAt, 0, activeTask.id);

    try {
      if (sourceStatusId === targetStatusId) {
        await BoardV2Service.reorderTasks(destinationIds);
      } else {
        await BoardV2Service.moveTask({
          taskId: activeTask.id,
          targetSectionId: null,
          targetStatusId,
          sortOrder: insertAt,
        });

        const nextSourceIds = sourceIds.filter((taskId) => taskId !== activeTask.id);
        await Promise.all([
          nextSourceIds.length > 0 ? BoardV2Service.reorderTasks(nextSourceIds) : Promise.resolve(),
          destinationIds.length > 0 ? BoardV2Service.reorderTasks(destinationIds) : Promise.resolve(),
        ]);
      }

      await invalidateBoardTasks();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'Não foi possível mover a tarefa.');
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-white">
      <div className="minimal-scrollbar flex-1 min-h-0 overflow-x-auto overflow-y-hidden">
        <div className="flex min-w-max gap-3 p-3">
          <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            {statuses.map((status) => (
              <KanbanColumn
                key={status.id}
                status={status}
                tasks={grouped.get(status.id) ?? []}
                users={users}
                onAddTask={() => setAddToStatus(status.id)}
                onRenameStatus={renameStatus}
              />
            ))}
            <DragOverlay>
              {dragTask && <KanbanCard task={dragTask} users={users} overlay draggable={false} />}
            </DragOverlay>
          </DndContext>
        </div>
      </div>

      {/* Task drawer */}
      <AnimatePresence>
        {openTaskId && (
          <TaskDrawer
            taskId={openTaskId}
            boardId={boardId}
            statuses={statuses}
            users={users}
            clients={clients}
            onClose={() => setOpenTaskId(null)}
          />
        )}
      </AnimatePresence>

      {/* Create task for column */}
      <AnimatePresence>
        {addToStatus && (
          <CreateTaskModal
            boardId={boardId}
            statusId={addToStatus}
            clients={clients}
            users={users}
            onClose={() => setAddToStatus(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};
