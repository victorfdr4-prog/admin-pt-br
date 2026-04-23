import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type BoardViewMode = 'table' | 'kanban';
export type BoardGroupBy = 'section' | 'status' | 'assignee' | 'client' | 'channel';
export type BoardSortBy = 'manual' | 'due' | 'updated' | 'priority';

export interface BoardFilters {
  search: string;
  clientId: string | null;
  assigneeId: string | null;
  statusId: string | null;
  priority: string | null;
  channel: string | null;
}

interface BoardStoreState {
  // Current board
  activeBoardId: string | null;
  setActiveBoardId: (id: string | null) => void;

  // View
  viewMode: BoardViewMode;
  setViewMode: (v: BoardViewMode) => void;

  // Group / Sort
  groupBy: BoardGroupBy;
  setGroupBy: (g: BoardGroupBy) => void;
  sortBy: BoardSortBy;
  setSortBy: (s: BoardSortBy) => void;

  // Filters
  filters: BoardFilters;
  setFilter: <K extends keyof BoardFilters>(key: K, value: BoardFilters[K]) => void;
  clearFilters: () => void;

  // Task drawer
  openTaskId: string | null;
  setOpenTaskId: (id: string | null) => void;

  // Collapsed sections
  collapsedSections: Record<string, boolean>;
  toggleSection: (sectionId: string) => void;
  setSectionCollapsed: (sectionId: string, collapsed: boolean) => void;
}

const defaultFilters: BoardFilters = {
  search: '',
  clientId: null,
  assigneeId: null,
  statusId: null,
  priority: null,
  channel: null,
};

export const useBoardStore = create<BoardStoreState>()(
  persist(
    (set) => ({
      activeBoardId: null,
      setActiveBoardId: (id) => set({ activeBoardId: id }),

      viewMode: 'table',
      setViewMode: (v) => set({ viewMode: v }),

      groupBy: 'section',
      setGroupBy: (g) => set({ groupBy: g }),

      sortBy: 'manual',
      setSortBy: (s) => set({ sortBy: s }),

      filters: defaultFilters,
      setFilter: (key, value) =>
        set((s) => ({ filters: { ...s.filters, [key]: value } })),
      clearFilters: () => set({ filters: defaultFilters }),

      openTaskId: null,
      setOpenTaskId: (id) => set({ openTaskId: id }),

      collapsedSections: {},
      toggleSection: (id) =>
        set((s) => ({
          collapsedSections: {
            ...s.collapsedSections,
            [id]: !s.collapsedSections[id],
          },
        })),
      setSectionCollapsed: (id, collapsed) =>
        set((s) => ({
          collapsedSections: { ...s.collapsedSections, [id]: collapsed },
        })),
    }),
    {
      name: 'cromia-board-store',
      partialize: (s) => ({
        activeBoardId: s.activeBoardId,
        viewMode: s.viewMode,
        groupBy: s.groupBy,
        sortBy: s.sortBy,
        collapsedSections: s.collapsedSections,
      }),
    }
  )
);
