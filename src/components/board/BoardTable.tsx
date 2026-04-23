import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ChevronDown, EyeOff, GripVertical, MoveHorizontal, PencilLine, Plus, RotateCcw, Search, Trash2, User2 } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import { toast } from '@/components/ui/sonner';
import { useBoardConfig, useBoardTasks } from '@/hooks/useBoardV2';
import { useBoardStore } from '@/store/useBoardStore';
import { SectionHeaderRow } from './SectionHeaderRow';
import { TaskRow } from './TaskRow';
import { TaskDrawer } from './TaskDrawer';
import { CreateTaskModal } from './CreateTaskModal';
import { TableSkeleton } from '@/components/ui/Skeleton';
import type { BoardStatus, BoardTaskV2 } from '@/services/boardV2.service';
import { AdminService, KanbanService } from '@/services';
import { normalizeBoardTableColumns, normalizePipelineColumns } from '@/domain/agencyPlatform';
import {
  BOARD_COLUMN_DEFAULT_WIDTH,
  buildBoardGridTemplate,
  ensureBoardColumns,
  type LiveBoardColumnLayout,
} from './boardTableLayout';

interface BoardTableProps {
  boardId: string;
  boardClientId?: string | null;
  clients: { id: string; name: string }[];
  users: { id: string; name: string; avatar?: string | null }[];
}

type HeaderMenuState = {
  id: LiveBoardColumnLayout['id'];
  label: string;
};

const getBoardColumnSettingKey = (clientId?: string | null) =>
  clientId ? `board_table_columns_client_${clientId}` : 'board_table_columns';

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const normalizeColumnOrder = (columns: LiveBoardColumnLayout[]) => {
  const taskColumn = columns.find((column) => column.id === 'task');
  const otherColumns = columns
    .filter((column) => column.id !== 'task')
    .sort((left, right) => left.order - right.order);

  const ordered = [taskColumn, ...otherColumns].filter(Boolean) as LiveBoardColumnLayout[];
  return ordered.map((column, index) => ({ ...column, order: index + 1 }));
};

const normalizeVisibleColumnOrder = (columns: LiveBoardColumnLayout[]) =>
  normalizeColumnOrder(columns).filter((column) => column.visible !== false);

const formatStatusTitle = (status: BoardStatus) => status.name || 'Sem estágio';

export const BoardTable: React.FC<BoardTableProps> = ({ boardId, boardClientId, clients, users }) => {
  const { filters, setFilter, collapsedSections, openTaskId, setOpenTaskId } = useBoardStore();
  const { data: config, isLoading: loadingConfig } = useBoardConfig(boardId);
  const { data: tasks = [], isLoading: loadingTasks } = useBoardTasks(boardId);

  const [addTaskStatusId, setAddTaskStatusId] = useState<string | null>(null);
  const [columnLayout, setColumnLayout] = useState<LiveBoardColumnLayout[]>(() => ensureBoardColumns([]));
  const [pipelineColumns, setPipelineColumns] = useState<Array<{ id: string; title: string; color: string; order: number }>>([]);
  const [layoutLoading, setLayoutLoading] = useState(true);
  const [headerMenu, setHeaderMenu] = useState<HeaderMenuState | null>(null);
  const [headerMenuEditingId, setHeaderMenuEditingId] = useState<LiveBoardColumnLayout['id'] | null>(null);
  const columnLayoutRef = useRef(columnLayout);
  const resizeStateRef = useRef<{ id: LiveBoardColumnLayout['id']; startX: number; startWidth: number } | null>(null);

  const activeClientId = filters.clientId || boardClientId || null;
  const statuses = config?.statuses ?? [];

  useEffect(() => {
    columnLayoutRef.current = columnLayout;
  }, [columnLayout]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest('[data-board-header-menu]')) {
        setHeaderMenu(null);
        setHeaderMenuEditingId(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadBoardConfiguration = async () => {
      setLayoutLoading(true);
      try {
        const [pipeline, scopedColumnsRows, globalColumnsRows] = await Promise.all([
          KanbanService.getColumns(activeClientId || undefined).catch(() => []),
          AdminService.getSettings(getBoardColumnSettingKey(activeClientId)).catch(() => []),
          activeClientId ? AdminService.getSettings('board_table_columns').catch(() => []) : Promise.resolve([]),
        ]);

        if (cancelled) return;

        const scopedColumns = scopedColumnsRows?.[0]?.value;
        const fallbackColumns = globalColumnsRows?.[0]?.value;
        const resolvedColumns = scopedColumns || fallbackColumns || { columns: [] };

        setPipelineColumns(normalizePipelineColumns(pipeline));
        setColumnLayout(ensureBoardColumns(normalizeBoardTableColumns(resolvedColumns)));
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          setPipelineColumns([]);
          setColumnLayout(ensureBoardColumns([]));
        }
      } finally {
        if (!cancelled) setLayoutLoading(false);
      }
    };

    void loadBoardConfiguration();
    return () => {
      cancelled = true;
    };
  }, [activeClientId]);

  useEffect(() => {
    if (!resizeStateRef.current) return;

    const handlePointerMove = (event: MouseEvent) => {
      const resizeState = resizeStateRef.current;
      if (!resizeState) return;

      const nextWidth = clamp(
        resizeState.startWidth + (event.clientX - resizeState.startX),
        96,
        640
      );

      setColumnLayout((current) =>
        current.map((column) =>
          column.id === resizeState.id ? { ...column, width: nextWidth } : column
        )
      );
    };

    const handlePointerUp = () => {
      resizeStateRef.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      void persistBoardColumns(columnLayoutRef.current, activeClientId);
    };

    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerUp);

    return () => {
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', handlePointerUp);
    };
  }, [activeClientId]);

  const persistBoardColumns = async (columns: LiveBoardColumnLayout[], clientId?: string | null) => {
    const normalized = normalizeColumnOrder(columns).map((column, index) => ({
      id: column.id,
      label: column.label,
      visible: column.visible !== false,
      client_visible: column.client_visible !== false,
      order: index + 1,
      width: Math.round(column.width || BOARD_COLUMN_DEFAULT_WIDTH[column.id]),
    }));

    try {
      await AdminService.saveSetting(getBoardColumnSettingKey(clientId), { columns: normalized });
    } catch (error) {
      console.error(error);
      toast.error('Não foi possível salvar a configuração das colunas.');
    }
  };

  const applyColumnsChange = (updater: (current: LiveBoardColumnLayout[]) => LiveBoardColumnLayout[], persist = true) => {
    setColumnLayout((current) => {
      const next = normalizeColumnOrder(updater(current));
      if (persist) void persistBoardColumns(next, activeClientId);
      return next;
    });
  };

  const visibleColumns = useMemo(
    () =>
      normalizeColumnOrder(columnLayout)
        .filter((column) => column.visible !== false),
    [columnLayout]
  );

  const gridTemplateColumns = useMemo(() => buildBoardGridTemplate(visibleColumns), [visibleColumns]);

  const displayStatuses = useMemo(() => {
    const orderedStatuses = [...statuses].sort((left, right) => left.sort_order - right.sort_order);
    if (!pipelineColumns.length) return orderedStatuses;

    return orderedStatuses.map((status, index) => {
      const pipeline = pipelineColumns[index];
      if (!pipeline) return status;
      return {
        ...status,
        name: pipeline.title,
        color: pipeline.color,
        sort_order: pipeline.order,
      };
    });
  }, [pipelineColumns, statuses]);

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (filters.search) {
        const indexed = [
          task.title,
          task.client_name,
          task.assignee_name,
          task.activity_type,
          task.channel,
          task.description,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!indexed.includes(filters.search.toLowerCase())) return false;
      }
      if (filters.clientId && task.client_id !== filters.clientId) return false;
      if (filters.assigneeId && task.assignee_id !== filters.assigneeId) return false;
      if (filters.statusId && task.status_id !== filters.statusId) return false;
      if (filters.priority && task.priority !== filters.priority) return false;
      if (filters.channel && task.channel !== filters.channel) return false;
      return true;
    });
  }, [filters, tasks]);

  const groupedByStatus = useMemo(() => {
    const map = new Map<string, BoardTaskV2[]>();
    displayStatuses.forEach((status) => map.set(status.id, []));

    filteredTasks.forEach((task) => {
      const fallbackStatusId = displayStatuses[0]?.id ?? null;
      const statusId = task.status_id && map.has(task.status_id) ? task.status_id : fallbackStatusId;
      if (!statusId) return;
      map.get(statusId)?.push(task);
    });

    return map;
  }, [displayStatuses, filteredTasks]);

  const handleStartResize = (columnId: LiveBoardColumnLayout['id'], event: React.MouseEvent | React.PointerEvent) => {
    event.preventDefault();
    event.stopPropagation();
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    const column = columnLayoutRef.current.find((item) => item.id === columnId);
    if (!column) return;
    resizeStateRef.current = {
      id: columnId,
      startX: event.clientX,
      startWidth: Number(column.width || BOARD_COLUMN_DEFAULT_WIDTH[columnId]),
    };
  };

  const moveColumn = (columnId: LiveBoardColumnLayout['id'], direction: -1 | 1) => {
    applyColumnsChange((current) => {
      const ordered = normalizeColumnOrder(current);
      if (columnId === 'task') return current;

      const visibleOrdered = normalizeVisibleColumnOrder(current);
      const visibleIndex = visibleOrdered.findIndex((column) => column.id === columnId);
      const targetVisible = visibleOrdered[visibleIndex + direction];
      if (visibleIndex < 0 || !targetVisible || targetVisible.id === 'task') return current;

      const index = ordered.findIndex((column) => column.id === columnId);
      const targetIndex = ordered.findIndex((column) => column.id === targetVisible.id);
      if (index < 0 || targetIndex < 0 || targetIndex === 0) return current;

      const next = [...ordered];
      const [item] = next.splice(index, 1);
      next.splice(targetIndex, 0, item);
      return next;
    });
    setHeaderMenu(null);
    setHeaderMenuEditingId(null);
  };

  const renameColumn = (columnId: LiveBoardColumnLayout['id'], label: string) => {
    const nextLabel = label.trim();
    if (!nextLabel) return;
    applyColumnsChange((current) =>
      current.map((column) => (column.id === columnId ? { ...column, label: nextLabel } : column))
    );
    setHeaderMenu(null);
    setHeaderMenuEditingId(null);
  };

  const hideColumn = (columnId: LiveBoardColumnLayout['id']) => {
    if (columnId === 'task') return;
    const visibleCount = columnLayout.filter((column) => column.visible !== false).length;
    if (visibleCount <= 1) {
      toast.error('Mantenha pelo menos uma coluna visível.');
      return;
    }
    applyColumnsChange((current) =>
      current.map((column) =>
        column.id === columnId ? { ...column, visible: false } : column
      )
    );
    setHeaderMenu(null);
    setHeaderMenuEditingId(null);
  };

  const removeColumn = (columnId: LiveBoardColumnLayout['id']) => {
    hideColumn(columnId);
  };

  const resetColumnWidth = (columnId: LiveBoardColumnLayout['id']) => {
    applyColumnsChange((current) =>
      current.map((column) =>
        column.id === columnId
          ? { ...column, width: BOARD_COLUMN_DEFAULT_WIDTH[column.id] }
          : column
      )
    );
    setHeaderMenu(null);
    setHeaderMenuEditingId(null);
  };

  if (loadingConfig || loadingTasks || layoutLoading) return <TableSkeleton rows={8} />;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[18px] border border-[#e7ebf2] bg-white">
      <div className="border-b border-[#edf1f6] px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative max-w-[360px] flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#98a2b3]" />
            <input
              value={filters.search}
              onChange={(event) => setFilter('search', event.target.value)}
              placeholder="Buscar tarefas..."
              className="h-10 w-full rounded-xl border border-[#e4e8ef] bg-white pl-10 pr-4 text-[14px] text-[#111827] outline-none transition-colors placeholder:text-[#98a2b3] focus:border-[#cfd7e3]"
            />
          </div>
        </div>
      </div>

      <div className="minimal-scrollbar flex-1 min-h-0 overflow-x-auto overflow-y-auto" role="region" aria-label="Tabela do board">
        <div
          className="min-h-full"
          style={{
            width:
              visibleColumns.reduce((acc, column) => acc + Number(column.width || BOARD_COLUMN_DEFAULT_WIDTH[column.id]), 0) + 40,
            minWidth: '100%',
          }}
        >
          <div
            className="grid min-h-[46px] border-b border-[#e7ebf2] bg-[#fbfcfd]"
            style={{ gridTemplateColumns }}
          >
            {visibleColumns.map((column, index) => {
              const isTaskColumn = column.id === 'task';
              const visibleOrderedColumns = normalizeVisibleColumnOrder(columnLayout);
              const visibleIndex = visibleOrderedColumns.findIndex((item) => item.id === column.id);
              const canMoveLeft = column.id !== 'task' && visibleIndex > 1;
              const canMoveRight =
                column.id !== 'task' &&
                visibleIndex >= 0 &&
                visibleIndex < visibleOrderedColumns.length - 1;

              return (
                <div
                  key={column.id}
                  className={`relative flex items-center px-4 text-[13px] font-medium text-[#667085] ${index > 0 ? 'border-l border-[#edf1f6]' : ''}`}
                  data-board-header-menu
                >
                  <button
                    type="button"
                    onClick={() => {
                      setHeaderMenu({ id: column.id, label: column.label });
                      setHeaderMenuEditingId(null);
                    }}
                    className="flex min-w-0 flex-1 items-center justify-between gap-2 text-left"
                  >
                    {column.id === 'assignee' ? (
                      <span className="inline-flex items-center gap-2 text-[#98a2b3]" aria-label="Responsável">
                        <User2 className="size-3.5" />
                      </span>
                    ) : (
                      <span className="truncate">{column.label}</span>
                    )}
                    <GripVertical className="size-3.5 text-[#c0c7d4]" />
                  </button>

                  <button
                    type="button"
                    onPointerDown={(event) => handleStartResize(column.id, event)}
                    className="absolute -right-2 top-0 z-10 flex h-full w-4 cursor-col-resize items-center justify-center"
                    aria-label={`Redimensionar ${column.label}`}
                  >
                    <span className="h-5 w-px rounded-full bg-[#cfd7e3]" />
                  </button>

                  {headerMenu?.id === column.id && (
                    <div
                      className="absolute left-3 top-[42px] z-20 w-[260px] rounded-2xl border border-[#e5eaf1] bg-white p-3 shadow-sm"
                      onMouseDown={(event) => event.stopPropagation()}
                      onClick={(event) => event.stopPropagation()}
                    >
                      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#98a2b3]">
                        Campo da tabela
                      </div>
                      <div className="space-y-1">
                        <button
                          type="button"
                          onClick={() =>
                            setHeaderMenuEditingId((current) => (current === column.id ? null : column.id))
                          }
                          className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-[13px] text-[#344054] transition-colors hover:bg-[#f8fafc]"
                        >
                          <span className="inline-flex items-center gap-2">
                            <PencilLine className="size-3.5" />
                            Editar campo
                          </span>
                          <ChevronDown className="size-3.5 text-[#98a2b3]" />
                        </button>

                        {headerMenuEditingId === column.id && (
                          <div className="space-y-2 rounded-xl border border-[#edf1f6] bg-[#fbfcfd] p-2">
                            <input
                              autoFocus
                              value={headerMenu.label}
                              onChange={(event) => setHeaderMenu({ id: column.id, label: event.target.value })}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter') renameColumn(column.id, headerMenu.label);
                              }}
                              className="h-10 w-full rounded-xl border border-[#d9e0ea] bg-white px-3 text-[13px] text-[#111827] outline-none focus:border-[#c4ccda]"
                            />
                            <button
                              type="button"
                              onClick={() => renameColumn(column.id, headerMenu.label)}
                              className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-[#111827] bg-[#111827] px-3 py-2 text-[13px] font-medium text-white"
                            >
                              <PencilLine className="size-3.5" />
                              Salvar nome
                            </button>
                          </div>
                        )}

                        <div className="h-px bg-[#edf1f6]" />

                        <div className="rounded-xl border border-[#edf1f6] bg-[#fbfcfd] p-2">
                          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#98a2b3]">
                            Mover coluna
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => moveColumn(column.id, -1)}
                              disabled={!canMoveLeft}
                              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#e3e8f0] bg-white px-3 py-2 text-[13px] text-[#344054] disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              <ArrowLeft className="size-3.5" />
                              Esquerda
                            </button>
                            <button
                              type="button"
                              onClick={() => moveColumn(column.id, 1)}
                              disabled={!canMoveRight}
                              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#e3e8f0] bg-white px-3 py-2 text-[13px] text-[#344054] disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              <ArrowRight className="size-3.5" />
                              Direita
                            </button>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => resetColumnWidth(column.id)}
                          className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-[13px] text-[#344054] transition-colors hover:bg-[#f8fafc]"
                        >
                          <RotateCcw className="size-3.5" />
                          Restaurar largura
                        </button>

                        <button
                          type="button"
                          onClick={() => hideColumn(column.id)}
                          disabled={isTaskColumn}
                          className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-[13px] text-[#344054] transition-colors hover:bg-[#f8fafc] disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <EyeOff className="size-3.5" />
                          Ocultar a coluna
                        </button>

                        <button
                          type="button"
                          onClick={() => removeColumn(column.id)}
                          disabled={isTaskColumn}
                          className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-[13px] text-[#d92d20] transition-colors hover:bg-[#fff5f4] disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <Trash2 className="size-3.5" />
                          Remover campo do projeto
                        </button>

                        <div className="mt-1 rounded-xl border border-dashed border-[#e4e8ef] px-3 py-2 text-[11px] text-[#98a2b3]">
                          <div className="inline-flex items-center gap-1.5">
                            <MoveHorizontal className="size-3.5" />
                            Arraste a borda do cabeçalho para redimensionar.
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {displayStatuses.map((status) => {
            const statusTasks = (groupedByStatus.get(status.id) ?? [])
              .slice()
              .sort((left, right) => Number(left.sort_order || 0) - Number(right.sort_order || 0));
            const collapsed = !!collapsedSections[status.id];

            return (
              <section key={status.id}>
                <SectionHeaderRow
                  section={{
                    id: status.id,
                    board_id: boardId,
                    name: formatStatusTitle(status),
                    color: status.color,
                    sort_order: status.sort_order,
                    collapsed,
                    created_at: '',
                    updated_at: '',
                  }}
                  taskCount={statusTasks.length}
                  onAddTask={() => setAddTaskStatusId(status.id)}
                  gridTemplateColumns={gridTemplateColumns}
                  columnCount={visibleColumns.length}
                />

                {!collapsed && (
                  <>
                    {statusTasks.map((task) => (
                      <TaskRow
                        key={task.id}
                        task={task}
                        statuses={displayStatuses}
                        users={users}
                        clients={clients}
                        sectionName={status.name}
                        columns={visibleColumns}
                        gridTemplateColumns={gridTemplateColumns}
                      />
                    ))}

                    <button
                      type="button"
                      onClick={() => setAddTaskStatusId(status.id)}
                      className="grid min-h-[48px] w-full border-b border-[#edf1f6] bg-white text-left transition-colors hover:bg-[#fafbfd]"
                      style={{ gridTemplateColumns }}
                    >
                      {visibleColumns.map((column, index) => (
                        <div
                          key={column.id}
                          className={`flex items-center px-4 py-3 ${index > 0 ? 'border-l border-[#edf1f6]' : ''}`}
                        >
                          {column.id === 'task' ? (
                            <span className="flex items-center gap-3 text-[13px] font-medium text-[#667085]">
                              <Plus className="size-4" />
                              Adicionar tarefa
                            </span>
                          ) : null}
                        </div>
                      ))}
                    </button>
                  </>
                )}
              </section>
            );
          })}

          {filteredTasks.length === 0 && (
            <div className="flex min-h-[240px] items-center justify-center border-t border-[#edf1f6] px-6 py-12 text-center">
              <div>
                <div className="text-[22px] font-semibold text-[#111827]">Nenhuma tarefa cadastrada ainda</div>
                <p className="mt-2 text-[14px] text-[#667085]">Crie a primeira tarefa para começar este quadro.</p>
                <button
                  type="button"
                  onClick={() => setAddTaskStatusId(displayStatuses[0]?.id ?? '')}
                  className="mt-5 inline-flex items-center gap-2 rounded-full border border-[#111827] bg-[#111827] px-4 py-2 text-[14px] font-medium text-white transition-opacity hover:opacity-90"
                >
                  <Plus className="size-4" />
                  Criar primeira tarefa
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {openTaskId && (
          <TaskDrawer
            taskId={openTaskId}
            boardId={boardId}
            statuses={displayStatuses}
            users={users}
            clients={clients}
            onClose={() => setOpenTaskId(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {addTaskStatusId !== null && (
          <CreateTaskModal
            boardId={boardId}
            statusId={addTaskStatusId || undefined}
            clients={clients}
            users={users}
            onClose={() => setAddTaskStatusId(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};
