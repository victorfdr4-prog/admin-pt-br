import React from 'react';

export const ClientHubSkeleton: React.FC = () => {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header skeleton */}
      <div className="rounded-2xl border border-border bg-white p-6">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="flex-1">
            <div className="h-8 w-48 rounded-lg bg-border mb-3" />
            <div className="h-4 w-32 rounded bg-border" />
          </div>
          <div className="h-10 w-28 rounded-lg bg-border" />
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-3 w-16 rounded bg-border" />
              <div className="h-6 w-24 rounded bg-border" />
            </div>
          ))}
        </div>
      </div>

      {/* Summary strip skeleton */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="rounded-lg border border-border bg-white p-3">
            <div className="h-3 w-12 rounded bg-border mb-2" />
            <div className="h-6 w-16 rounded bg-border" />
          </div>
        ))}
      </div>

      {/* Panels skeleton */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left column */}
        <div className="space-y-6">
          {/* Health panel */}
          <div className="rounded-2xl border border-border bg-white p-6">
            <div className="h-4 w-20 rounded bg-border mb-4" />
            <div className="h-12 w-24 rounded bg-border mb-6" />
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="space-y-2">
                  <div className="h-3 w-32 rounded bg-border" />
                  <div className="h-2 w-full rounded-full bg-border" />
                </div>
              ))}
            </div>
          </div>

          {/* Tasks panel */}
          <div className="rounded-2xl border border-border bg-white p-6">
            <div className="h-4 w-20 rounded bg-border mb-4" />
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex gap-3">
                  <div className="h-8 w-8 rounded bg-border flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-32 rounded bg-border" />
                    <div className="h-2 w-20 rounded bg-border" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Content pipeline */}
          <div className="rounded-2xl border border-border bg-white p-6">
            <div className="h-4 w-24 rounded bg-border mb-4" />
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="space-y-2">
                  <div className="h-3 w-40 rounded bg-border" />
                  <div className="flex gap-2">
                    <div className="h-2 w-16 rounded-full bg-border" />
                    <div className="h-2 w-12 rounded-full bg-border" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Timeline */}
          <div className="rounded-2xl border border-border bg-white p-6">
            <div className="h-4 w-20 rounded bg-border mb-4" />
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex gap-3">
                  <div className="h-7 w-7 rounded-full bg-border flex-shrink-0" />
                  <div className="flex-1 space-y-1">
                    <div className="h-3 w-32 rounded bg-border" />
                    <div className="h-2 w-24 rounded bg-border" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
