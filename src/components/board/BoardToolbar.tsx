import { Search, Filter, LayoutGrid, List } from 'lucide-react';
import { FilterPill } from '../ui/FilterPill';

interface BoardToolbarProps {
  viewMode: 'table' | 'kanban';
  onViewModeChange: (mode: 'table' | 'kanban') => void;
  groupBy: string;
  onGroupByChange: (group: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  activeFilters: string[];
  onFilterRemove: (filter: string) => void;
}

export function BoardToolbar({
  viewMode,
  onViewModeChange,
  groupBy,
  onGroupByChange,
  searchQuery,
  onSearchChange,
  activeFilters,
  onFilterRemove,
}: BoardToolbarProps) {
  return (
    <div className="space-y-3 border-b border-border bg-surface px-6 py-4">
      {/* Search & View Toggle */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Procurar tarefas..."
            className="w-full rounded-md border border-border bg-card pl-10 pr-4 py-2 text-sm focus:border-primary focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-1 border-l border-border pl-3">
          <button
            onClick={() => onViewModeChange('table')}
            className={`p-2 rounded transition-colors ${
              viewMode === 'table'
                ? 'bg-primary text-white'
                : 'text-text-secondary hover:bg-card'
            }`}
            title="Visualizar em tabela"
          >
            <List size={18} />
          </button>
          <button
            onClick={() => onViewModeChange('kanban')}
            className={`p-2 rounded transition-colors ${
              viewMode === 'kanban'
                ? 'bg-primary text-white'
                : 'text-text-secondary hover:bg-card'
            }`}
            title="Visualizar em kanban"
          >
            <LayoutGrid size={18} />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Filter size={16} className="text-text-secondary" />
        <select
          value={groupBy}
          onChange={(e) => onGroupByChange(e.target.value)}
          className="rounded-md border border-border bg-card px-3 py-1.5 text-sm focus:border-primary focus:outline-none"
        >
          <option value="status">Agrupar por Status</option>
          <option value="client">Agrupar por Cliente</option>
          <option value="assignee">Agrupar por Responsável</option>
          <option value="priority">Agrupar por Prioridade</option>
        </select>

        {activeFilters.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {activeFilters.map((filter) => (
              <FilterPill
                key={filter}
                label={filter}
                onRemove={() => onFilterRemove(filter)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
