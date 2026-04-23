import React from 'react';
import { ChevronRight, GripVertical, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useBoardStore } from '@/store/useBoardStore';
import type { BoardSection } from '@/services/boardV2.service';

interface SectionHeaderRowProps {
  section: BoardSection;
  taskCount: number;
  onAddTask?: () => void;
  gridTemplateColumns: string;
  columnCount: number;
}

export const SectionHeaderRow: React.FC<SectionHeaderRowProps> = ({
  section,
  taskCount,
  onAddTask,
  gridTemplateColumns,
  columnCount,
}) => {
  const { collapsedSections, toggleSection } = useBoardStore();
  const collapsed = !!collapsedSections[section.id];
  const hasActionCell = columnCount > 1;

  return (
    <div
      className="grid min-h-[52px] border-b border-[#e7ebf2] bg-[#fcfcfd]"
      style={{ gridTemplateColumns }}
    >
      <div className="flex min-w-0 items-center gap-3 px-4 py-3">
        <GripVertical className="size-3.5 shrink-0 text-[#c0c7d4]" />
        <button
          type="button"
          onClick={() => toggleSection(section.id)}
          className="flex h-6 w-6 items-center justify-center rounded-md text-[#7f8897] transition-colors hover:bg-[#f1f4f8] hover:text-[#202733]"
        >
          <ChevronRight className={cn('size-4 transition-transform duration-150', !collapsed && 'rotate-90')} />
        </button>
        <div className="min-w-0 flex items-center gap-2">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: section.color || '#c0c7d4' }}
          />
          <span className="truncate text-[13px] font-semibold text-[#202733]">{section.name}</span>
          <Zap className="size-3.5 shrink-0 text-[#8f98a8]" />
          <span className="text-[12px] text-[#7f8897]">{taskCount}</span>
        </div>
      </div>

      {Array.from({ length: Math.max(columnCount - (hasActionCell ? 2 : 1), 0) }).map((_, index) => (
        <div key={index} className="border-l border-[#edf1f6]" />
      ))}

      {hasActionCell ? <div className="border-l border-[#edf1f6]" /> : null}
    </div>
  );
};
