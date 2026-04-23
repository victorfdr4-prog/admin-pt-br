export function Skeleton({
  className = '',
}: {
  className?: string;
}) {
  return (
    <div
      className={`animate-pulse rounded bg-border ${className}`}
      aria-hidden="true"
    />
  );
}

export function TaskCardSkeleton() {
  return (
    <div className="space-y-3 rounded-lg border border-border bg-surface p-4">
      <div className="flex items-start justify-between">
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-6 w-6" />
      </div>
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-4/5" />
      <div className="flex gap-2 pt-2">
        <Skeleton className="h-6 w-12" />
        <Skeleton className="h-6 w-12" />
      </div>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6 p-6">
      <Skeleton className="h-10 w-1/3" />
      <div className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-2 rounded-lg border border-border bg-surface p-4">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-8 w-2/3" />
          </div>
        ))}
      </div>
      <div className="space-y-3 rounded-lg border border-border bg-surface p-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i}>
            <Skeleton className="h-5 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ClientHubSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-32 rounded-lg border border-border bg-surface" />
      <div className="grid gap-3 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <div className="space-y-2 rounded-lg border border-border bg-surface p-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-full" />
        ))}
      </div>
    </div>
  );
}

export function TableSkeleton() {
  return (
    <div className="space-y-3 rounded-lg border border-border bg-surface p-4">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="flex items-center gap-3">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-24" />
        </div>
      ))}
    </div>
  );
}
