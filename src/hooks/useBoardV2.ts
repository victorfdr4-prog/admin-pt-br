import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/components/ui/sonner';
import {
  BoardV2Service,
  type BoardTaskV2,
  type CreateBoardPayload,
  type CreateSectionPayload,
  type CreateTaskV2Payload,
  type MoveTaskPayload,
} from '@/services/boardV2.service';

// ── Query keys ────────────────────────────────────────────────────────────────

export const boardKeys = {
  all: ['boards'] as const,
  list: (opts?: object) => [...boardKeys.all, 'list', opts] as const,
  config: (id: string) => [...boardKeys.all, 'config', id] as const,
  tasks: (boardId: string) => [...boardKeys.all, 'tasks', boardId] as const,
  task: (taskId: string) => [...boardKeys.all, 'task', taskId] as const,
  wip: (boardId: string) => [...boardKeys.all, 'wip', boardId] as const,
  cycle: (boardId: string, days: number) => [...boardKeys.all, 'cycle', boardId, days] as const,
};

// ── Boards list ────────────────────────────────────────────────────────────────

export function useBoards(opts?: { clientId?: string; includeArchived?: boolean }) {
  return useQuery({
    queryKey: boardKeys.list(opts),
    queryFn: () => BoardV2Service.getBoards(opts),
    staleTime: 30_000,
  });
}

// ── Board config (statuses, sections, custom fields) ──────────────────────────

export function useBoardConfig(boardId: string | null) {
  return useQuery({
    queryKey: boardKeys.config(boardId!),
    queryFn: () => BoardV2Service.getBoardConfig(boardId!),
    enabled: !!boardId,
    staleTime: 20_000,
  });
}

// ── Board tasks ────────────────────────────────────────────────────────────────

export function useBoardTasks(boardId: string | null) {
  return useQuery({
    queryKey: boardKeys.tasks(boardId!),
    queryFn: () => BoardV2Service.getBoardTasks(boardId!),
    enabled: !!boardId,
    staleTime: 20_000,
  });
}

// ── Single task ────────────────────────────────────────────────────────────────

export function useBoardTask(taskId: string | null) {
  return useQuery({
    queryKey: boardKeys.task(taskId!),
    queryFn: () => BoardV2Service.getTask(taskId!),
    enabled: !!taskId,
    staleTime: 15_000,
  });
}

// ── Mutations ──────────────────────────────────────────────────────────────────

export function useCreateBoard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateBoardPayload) => BoardV2Service.createBoard(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: boardKeys.all });
      toast.success('Board criado');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateBoard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ boardId, patch }: { boardId: string; patch: Parameters<typeof BoardV2Service.updateBoard>[1] }) =>
      BoardV2Service.updateBoard(boardId, patch),
    onSuccess: (_d, { boardId }) => {
      qc.invalidateQueries({ queryKey: boardKeys.config(boardId) });
      qc.invalidateQueries({ queryKey: boardKeys.list() });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useArchiveBoard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (boardId: string) => BoardV2Service.archiveBoard(boardId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: boardKeys.all });
      toast.success('Board arquivado');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useCreateSection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateSectionPayload) => BoardV2Service.createSection(payload),
    onSuccess: (_d, { board_id }) => qc.invalidateQueries({ queryKey: boardKeys.config(board_id) }),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateSection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ sectionId, boardId, patch }: { sectionId: string; boardId: string; patch: Parameters<typeof BoardV2Service.updateSection>[1] }) =>
      BoardV2Service.updateSection(sectionId, patch),
    onSuccess: (_d, { boardId }) => qc.invalidateQueries({ queryKey: boardKeys.config(boardId) }),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteSection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ sectionId, boardId }: { sectionId: string; boardId: string }) =>
      BoardV2Service.deleteSection(sectionId),
    onSuccess: (_d, { boardId }) => {
      qc.invalidateQueries({ queryKey: boardKeys.config(boardId) });
      qc.invalidateQueries({ queryKey: boardKeys.tasks(boardId) });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useCreateTaskV2() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateTaskV2Payload) => BoardV2Service.createTaskV2(payload),
    onSuccess: (task) => {
      if (task.board_id) {
        qc.setQueryData<BoardTaskV2[]>(boardKeys.tasks(task.board_id), (old) =>
          old ? [...old, task] : [task]
        );
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, patch }: { taskId: string; boardId: string; patch: Parameters<typeof BoardV2Service.updateTask>[1] }) =>
      BoardV2Service.updateTask(taskId, patch),
    onSuccess: (_d, { taskId, boardId }) => {
      qc.invalidateQueries({ queryKey: boardKeys.task(taskId) });
      qc.invalidateQueries({ queryKey: boardKeys.tasks(boardId) });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useMoveTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ payload }: { payload: MoveTaskPayload; boardId: string }) =>
      BoardV2Service.moveTask(payload),
    onSuccess: (_d, { boardId }) => {
      qc.invalidateQueries({ queryKey: boardKeys.tasks(boardId) });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId }: { taskId: string; boardId: string }) =>
      BoardV2Service.deleteTask(taskId),
    onSuccess: (_d, { taskId, boardId }) => {
      qc.removeQueries({ queryKey: boardKeys.task(taskId) });
      qc.invalidateQueries({ queryKey: boardKeys.tasks(boardId) });
      toast.success('Tarefa excluída');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useAddTaskLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, url, title, linkType }: { taskId: string; url: string; title?: string; linkType?: Parameters<typeof BoardV2Service.addTaskLink>[3] }) =>
      BoardV2Service.addTaskLink(taskId, url, title, linkType),
    onSuccess: (_d, { taskId }) => qc.invalidateQueries({ queryKey: boardKeys.task(taskId) }),
    onError: (e: Error) => toast.error(e.message),
  });
}

// ── Metrics ────────────────────────────────────────────────────────────────────

export function useWipMetrics(boardId: string | null) {
  return useQuery({
    queryKey: boardKeys.wip(boardId!),
    queryFn: () => BoardV2Service.getWipMetrics(boardId!),
    enabled: !!boardId,
    staleTime: 60_000,
  });
}

export function useCycleTime(boardId: string | null, days = 30) {
  return useQuery({
    queryKey: boardKeys.cycle(boardId!, days),
    queryFn: () => BoardV2Service.getCycleTime(boardId!, days),
    enabled: !!boardId,
    staleTime: 60_000,
  });
}
