// Tipos compartilhados do sistema de boards
// Extraídos do BoardsPage para uso nos novos componentes de board

export type Priority = 'low' | 'medium' | 'high';
export type BoardView = 'table' | 'kanban';
export type SortMode = 'manual' | 'due' | 'updated' | 'priority';
export type BoardTableColumnId = 'task' | 'assignee' | 'status' | 'due_date' | 'priority' | 'updated_at';

export interface ChecklistItem {
  id: string;
  title: string;
  done: boolean;
}

export interface BoardTask {
  id: string;
  client_id: string;
  title: string;
  description: string;
  status: string;
  priority: Priority;
  order_index: number;
  assignee_id: string;
  due_date: string | null;
  checklist: ChecklistItem[];
  custom_fields: unknown;
  client_name: string;
  created_at: string | null;
  updated_at: string | null;
  // New Agency OS fields
  sla_deadline?: string | null;
  last_action_at?: string | null;
  next_action?: string | null;
  service_type?: string | null;
}

export interface BoardColumn {
  id: string;
  title: string;
  color: string;
  order: number;
}

export interface BoardUser {
  id: string;
  name: string;
  avatar?: string | null;
}

export interface BoardClient {
  id: string;
  name: string;
  plan?: string | null;
}

export interface BoardTableColumnLayout {
  id: BoardTableColumnId;
  label: string;
  visible: boolean;
  order: number;
}

export const PRIORITY_STYLE: Record<Priority, { label: string; color: string; tint: string }> = {
  low:    { label: 'Baixa',  color: '#579bfc', tint: 'rgba(87, 155, 252, 0.14)' },
  medium: { label: 'Média',  color: '#7f56d9', tint: 'rgba(127, 86, 217, 0.14)' },
  high:   { label: 'Alta',   color: '#344054', tint: 'rgba(52, 64, 84, 0.12)' },
};

export const DEFAULT_COLUMNS: BoardColumn[] = [
  { id: 'todo',        title: 'Entrada',        color: '#94a3b8', order: 1 },
  { id: 'in-progress', title: 'Em execução',    color: '#fdab3d', order: 2 },
  { id: 'stuck',       title: 'Bloqueado',      color: '#e2445c', order: 3 },
  { id: 'done',        title: 'Concluído',      color: '#00c875', order: 4 },
];

export const DEFAULT_TABLE_COLUMNS: BoardTableColumnLayout[] = [
  { id: 'task',       label: 'Tarefa',        visible: true, order: 1 },
  { id: 'assignee',   label: 'Responsável',   visible: true, order: 2 },
  { id: 'status',     label: 'Status',        visible: true, order: 3 },
  { id: 'due_date',   label: 'Prazo',         visible: true, order: 4 },
  { id: 'priority',   label: 'Prioridade',    visible: true, order: 5 },
  { id: 'updated_at', label: 'Atualização',   visible: true, order: 6 },
];

/** Retorna se a deadline SLA já passou */
export function isSlaOverdue(slaDeadline: string | null | undefined): boolean {
  if (!slaDeadline) return false;
  return new Date(slaDeadline) < new Date();
}

/** Retorna cor do badge de SLA */
export function slaBadgeColor(slaDeadline: string | null | undefined): 'green' | 'yellow' | 'red' | null {
  if (!slaDeadline) return null;
  const diff = new Date(slaDeadline).getTime() - Date.now();
  const hours = diff / 3_600_000;
  if (hours < 0) return 'red';
  if (hours < 24) return 'yellow';
  return 'green';
}
