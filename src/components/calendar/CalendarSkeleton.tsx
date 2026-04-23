import React from 'react';

export const CalendarSkeleton: React.FC = () => {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Toolbar skeleton */}
      <div className="rounded-2xl border border-border bg-white p-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-border" />
            <div className="h-6 w-32 rounded bg-border" />
            <div className="h-10 w-10 rounded-lg bg-border" />
            <div className="w-px h-6 bg-border mx-1" />
            <div className="h-8 w-16 rounded bg-border" />
          </div>
          <div className="flex items-center gap-2">
            <div className="h-8 w-24 rounded-lg border border-border bg-border" />
            <div className="h-8 w-32 rounded-lg border border-border bg-border" />
            <div className="h-8 w-20 rounded-lg bg-border" />
          </div>
        </div>
      </div>

      {/* Sidebar summary skeleton */}
      <div className="rounded-2xl border border-border bg-white p-6">
        <div className="h-4 w-20 rounded bg-border mb-6" />
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-3 w-24 rounded bg-border" />
              <div className="h-6 w-16 rounded bg-border" />
            </div>
          ))}
        </div>
      </div>

      {/* Calendar grid skeleton */}
      <div className="grid grid-cols-7 gap-2">
        {[...Array(35)].map((_, i) => (
          <div key={i} className="h-24 rounded-lg border border-border bg-white p-2">
            <div className="h-3 w-4 rounded bg-border mb-2" />
            <div className="space-y-1">
              {[...Array(2)].map((_, j) => (
                <div key={j} className="h-2 w-full rounded bg-border/50" />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Day details skeleton */}
      <div className="rounded-2xl border border-border bg-white p-6">
        <div className="h-4 w-32 rounded bg-border mb-4" />
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex gap-3 p-3 border border-border rounded-lg">
              <div className="h-8 w-8 rounded bg-border flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-32 rounded bg-border" />
                <div className="h-2 w-24 rounded bg-border" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
