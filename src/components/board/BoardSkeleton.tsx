import { Skeleton } from '../ui/Skeleton';

export function BoardSkeleton() {
  return (
    <div className="space-y-4 p-6">
      {/* Toolbar */}
      <div className="flex gap-3">
        <Skeleton className="h-10 flex-1 max-w-xs" />
        <Skeleton className="h-10 w-20" />
        <Skeleton className="h-10 w-32" />
      </div>

      {/* Kanban Columns */}
      <div className="grid grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, col) => (
          <div key={col} className="space-y-3">
            {/* Column Header */}
            <Skeleton className="h-8 w-24" />

            {/* Cards */}
            {Array.from({ length: 3 }).map((_, card) => (
              <div key={card} className="space-y-2 rounded-lg border border-border bg-surface p-4">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <div className="flex gap-2 pt-2">
                  <Skeleton className="h-6 w-12" />
                  <Skeleton className="h-6 w-12" />
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
