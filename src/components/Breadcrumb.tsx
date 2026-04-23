import React from 'react';
import { ChevronRight, Home } from 'lucide-react';
import { cn } from '@/utils/cn';

export type BreadcrumbItem = {
  id: string;
  label: string;
};

export const Breadcrumb: React.FC<{
  items: BreadcrumbItem[];
  onNavigate: (item: BreadcrumbItem, index: number) => void;
}> = ({ items, onNavigate }) => {
  const hasItems = items.length > 0;

  return (
    <nav className="flex items-center gap-1 min-w-0 overflow-x-auto drive-scrollbar pb-1" aria-label="Breadcrumb">
      <button
        type="button"
        onClick={() => hasItems && onNavigate(items[0], 0)}
        disabled={!hasItems}
        className={cn(
          'h-7 shrink-0 rounded-lg border px-2.5 text-[10px] font-semibold tracking-wide transition-all duration-150 flex items-center gap-1.5',
          hasItems
            ? 'border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground'
            : 'border-border bg-background text-muted-foreground/70 cursor-default'
        )}
      >
        <Home size={13} />
        HOME
      </button>
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <React.Fragment key={`${item.id}-${index}`}>
            <ChevronRight size={13} className="text-[#6B7280] shrink-0" />
            <button
              type="button"
              onClick={() => onNavigate(item, index)}
              disabled={isLast}
              className={cn(
                'px-2.5 py-1.5 rounded-md text-[10px] font-semibold uppercase tracking-wide max-w-[220px] truncate transition-all duration-150',
                isLast
                  ? 'text-foreground bg-muted border border-border cursor-default'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              )}
              title={item.label}
            >
              {item.label}
            </button>
          </React.Fragment>
        );
      })}
    </nav>
  );
};
