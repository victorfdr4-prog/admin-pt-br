// src/hooks/useHubFilters.ts
import { create } from 'zustand';

export type HubFilter = 'all' | 'atrasados' | 'hoje' | 'aguardando_cliente' | 'sem_agendamento';

interface HubFiltersState {
  activeFilter: HubFilter;
  selectedClientId: string | null;
  year: number;
  month: number; // 0-indexed
  setFilter: (f: HubFilter) => void;
  setClient: (id: string | null) => void;
  setMonth: (year: number, month: number) => void;
  nextMonth: () => void;
  prevMonth: () => void;
}

export const useHubFilters = create<HubFiltersState>((set, get) => {
  const now = new Date();
  return {
  activeFilter: 'all',
  selectedClientId: null,
  year: now.getFullYear(),
  month: now.getMonth(),
  setFilter: (f) => set({ activeFilter: f }),
  setClient: (id) => set({ selectedClientId: id }),
  setMonth: (year, month) => set({ year, month }),
  nextMonth: () => {
    const { year, month } = get();
    if (month === 11) set({ year: year + 1, month: 0 });
    else set({ month: month + 1 });
  },
  prevMonth: () => {
    const { year, month } = get();
    if (month === 0) set({ year: year - 1, month: 11 });
    else set({ month: month - 1 });
  },
  };
});
