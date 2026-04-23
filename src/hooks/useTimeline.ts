import { useQuery } from '@tanstack/react-query';
import { TimelineService } from '@/services/timeline.service';

export function useClientTimeline(clientId: string | null, limit = 50) {
  return useQuery({
    queryKey: ['timeline', 'client', clientId, limit],
    queryFn: () => TimelineService.getByClient(clientId!, { limit }),
    enabled: !!clientId,
    staleTime: 30_000,
  });
}

export function useEntityTimeline(entityType: string, entityId: string | null) {
  return useQuery({
    queryKey: ['timeline', 'entity', entityType, entityId],
    queryFn: () => TimelineService.getByEntity(entityType, entityId!),
    enabled: !!entityId,
    staleTime: 30_000,
  });
}

export function useGlobalTimeline(opts?: { limit?: number; types?: string[] }) {
  return useQuery({
    queryKey: ['timeline', 'global', opts?.limit, opts?.types],
    queryFn: () => TimelineService.getGlobal(opts),
    staleTime: 30_000,
  });
}
