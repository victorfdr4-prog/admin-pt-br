// src/hooks/useHubData.ts
import { useEffect, useId } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { HubService, WorkflowStatus, HubPost } from '@/services/hub.service';
import { supabase } from '@/lib/supabase';
import { toast } from '@/components/ui/sonner';

export function useHubData(clientId: string | null, year: number, month: number) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['hub-posts', clientId, year, month],
    queryFn: () => HubService.getPostsForMonth(clientId!, year, month),
    enabled: !!clientId,
    staleTime: 30_000,
  });

  // Realtime invalidation
  const uid = useId();
  useEffect(() => {
    if (!clientId) return;
    const channel = supabase
      .channel(`hub-realtime-${uid}-${clientId}-${year}-${month}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'posting_calendar_items',
          filter: `client_id=eq.${clientId}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: ['hub-posts', clientId, year, month] });
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [clientId, year, month, qc]);

  return query;
}

export function useMovePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ postId, newDate }: { postId: string; newDate: string; clientId: string; year: number; month: number }) =>
      HubService.movePostToDay(postId, newDate),
    onMutate: async ({ postId, newDate, clientId, year, month }) => {
      const key = ['hub-posts', clientId, year, month] as const;
      await qc.cancelQueries({ queryKey: key });
      const snapshot = qc.getQueryData<HubPost[]>(key);
      qc.setQueryData(key, (old: HubPost[] | undefined) => {
        if (!old) return old;
        return old.map((p) => p.id === postId ? { ...p, post_date: newDate } : p);
      });
      return { snapshot, key };
    },
    onError: (_err, _vars, context: { snapshot: HubPost[] | undefined; key: readonly unknown[] } | undefined) => {
      if (context) qc.setQueryData(context.key, context.snapshot);
      toast.error('Erro ao mover post');
    },
    onSuccess: (_data, { clientId, year, month }) => {
      qc.invalidateQueries({ queryKey: ['hub-posts', clientId, year, month] });
    },
  });
}

export function useUpdateWorkflowStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ postId, status, clientId, year, month }: { postId: string; status: WorkflowStatus; clientId: string; year: number; month: number }) =>
      HubService.updateWorkflowStatus(postId, status),
    onMutate: async ({ postId, status, clientId, year, month }) => {
      const key = ['hub-posts', clientId, year, month] as const;
      await qc.cancelQueries({ queryKey: key });
      const snapshot = qc.getQueryData<HubPost[]>(key);
      qc.setQueryData(key, (old: HubPost[] | undefined) => {
        if (!old) return old;
        return old.map((p) => p.id === postId ? { ...p, workflow_status: status } : p);
      });
      return { snapshot, key };
    },
    onError: (_err, _vars, context: { snapshot: HubPost[] | undefined; key: readonly unknown[] } | undefined) => {
      if (context) qc.setQueryData(context.key, context.snapshot);
      toast.error('Erro ao atualizar status');
    },
    onSuccess: (_data, { clientId, year, month }) => {
      qc.invalidateQueries({ queryKey: ['hub-posts', clientId, year, month] });
      toast.success('Status atualizado');
    },
  });
}

export function useSchedulePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ postId, scheduledDate }: { postId: string; scheduledDate: string; clientId: string; year: number; month: number }) =>
      HubService.schedulePost(postId, scheduledDate),
    onSuccess: (_data, { clientId, year, month }) => {
      qc.invalidateQueries({ queryKey: ['hub-posts', clientId, year, month] });
      toast.success('Post agendado');
    },
    onError: () => toast.error('Erro ao agendar post'),
  });
}
