import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { subscribeRealtimeChange } from '@/lib/realtime';

/**
 * Hook to sync React Query cache with realtime changes
 * Automatically invalidates queries when data changes in Supabase
 */
export function useRealtimeSync(tables: string[], enabled: boolean = true) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) return;

    const unsubscribe = subscribeRealtimeChange((payload) => {
      if (!tables.includes(payload.table)) return;

      // Invalidate all queries related to the changed table
      const queryKeyPrefixes: Record<string, string[]> = {
        tasks: ['tasks', 'board'],
        clients: ['clients', 'client-hub'],
        timeline_events: ['timeline', 'activity'],
        approvals: ['approvals'],
        file_comments: ['files', 'comments'],
        file_versions: ['files', 'versions'],
        intake_requests: ['intake'],
        drive_files: ['files', 'documents', 'drive'],
      };

      const prefixes = queryKeyPrefixes[payload.table] || [payload.table];
      prefixes.forEach((prefix) => {
        queryClient.invalidateQueries({
          queryKey: [prefix],
          type: 'all',
        });
      });
    });

    return unsubscribe;
  }, [queryClient, tables, enabled]);
}
