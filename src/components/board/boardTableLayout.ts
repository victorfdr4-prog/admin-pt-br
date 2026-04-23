import {
  DEFAULT_BOARD_TABLE_COLUMNS,
  type BoardTableColumnId,
  type BoardTableColumnLayout,
} from '@/domain/agencyPlatform';

export type LiveBoardColumnLayout = BoardTableColumnLayout & {
  width: number;
};

export const BOARD_COLUMN_MIN_WIDTH: Record<BoardTableColumnId, number> = {
  task: 320,
  assignee: 78,
  due_date: 116,
  estimated_minutes: 96,
  activity_type: 132,
  priority: 110,
  status: 118,
  stage: 118,
  updated_at: 112,
};

export const BOARD_COLUMN_DEFAULT_WIDTH: Record<BoardTableColumnId, number> = DEFAULT_BOARD_TABLE_COLUMNS.reduce(
  (acc, column) => {
    acc[column.id] = Number(column.width || BOARD_COLUMN_MIN_WIDTH[column.id]);
    return acc;
  },
  {} as Record<BoardTableColumnId, number>
);

export const BOARD_COLUMN_LABELS: Record<BoardTableColumnId, string> = DEFAULT_BOARD_TABLE_COLUMNS.reduce(
  (acc, column) => {
    acc[column.id] = column.label;
    return acc;
  },
  {} as Record<BoardTableColumnId, string>
);

export const ensureBoardColumns = (columns: BoardTableColumnLayout[]) =>
  DEFAULT_BOARD_TABLE_COLUMNS.map((fallback, index) => {
    const current = columns.find((column) => column.id === fallback.id);
    return {
      ...fallback,
      ...current,
      order: Number(current?.order || fallback.order || index + 1),
      width: Number(current?.width || fallback.width || BOARD_COLUMN_DEFAULT_WIDTH[fallback.id]),
    } satisfies LiveBoardColumnLayout;
  }).sort((left, right) => left.order - right.order);

export const buildBoardGridTemplate = (columns: LiveBoardColumnLayout[]) =>
  columns
    .filter((column) => column.visible !== false)
    .sort((left, right) => left.order - right.order)
    .map((column) => {
      const minWidth = BOARD_COLUMN_MIN_WIDTH[column.id];
      const width = Math.max(minWidth, Number(column.width || BOARD_COLUMN_DEFAULT_WIDTH[column.id]));
      return `minmax(${minWidth}px, ${width}px)`;
    })
    .join(' ');
