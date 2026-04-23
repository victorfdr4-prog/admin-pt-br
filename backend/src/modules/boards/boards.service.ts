import { BoardsRepository } from './boards.repository';

export class BoardsService {
  constructor(private readonly repository: BoardsRepository) {}

  async listBoards(options: { includeArchived?: boolean; clientId?: string }) {
    const rows = await this.repository.listBoards(Boolean(options.includeArchived), options.clientId);
    return rows.map((board) => ({
      ...board,
      client_name: (board.clients as { name?: string } | null)?.name ?? null,
      clients: undefined,
    }));
  }

  async getBoardBundle(boardId: string) {
    const payload = await this.repository.getBoardBundle(boardId);
    const profileMap = new Map((payload.profiles ?? []).map((profile) => [profile.id, profile]));
    const statusMap = new Map((payload.statuses ?? []).map((status) => [status.id, status]));

    return {
      board: {
        ...payload.board,
        client_name: (payload.board.clients as { name?: string } | null)?.name ?? null,
        clients: undefined,
      },
      statuses: payload.statuses,
      sections: payload.sections,
      customFields: payload.customFields.map((field) => ({
        ...field,
        options: Array.isArray(field.options) ? field.options : [],
      })),
      tasks: payload.tasks.map((task) => ({
        ...task,
        client_name: (task.clients as { name?: string } | null)?.name ?? null,
        assignee_name: profileMap.get(task.assignee_id)?.full_name ?? null,
        assignee_avatar: profileMap.get(task.assignee_id)?.avatar_url ?? null,
        status_obj: statusMap.get(task.status_id) ?? null,
        checklist: Array.isArray(task.checklist) ? task.checklist : [],
        clients: undefined,
      })),
    };
  }

  async getTask(taskId: string) {
    const payload = await this.repository.getTask(taskId);

    return {
      ...payload.task,
      client_name: (payload.task.clients as { name?: string } | null)?.name ?? null,
      assignee_name: (payload.profile as { full_name?: string } | null)?.full_name ?? null,
      assignee_avatar: (payload.profile as { avatar_url?: string } | null)?.avatar_url ?? null,
      status_obj: payload.status ?? null,
      checklist: Array.isArray(payload.task.checklist) ? payload.task.checklist : [],
      custom_field_values: payload.task.task_custom_field_values ?? [],
      links: payload.task.task_links ?? [],
      clients: undefined,
      task_custom_field_values: undefined,
      task_links: undefined,
    };
  }
}
