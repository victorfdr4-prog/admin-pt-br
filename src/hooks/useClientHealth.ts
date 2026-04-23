import { useQuery } from '@tanstack/react-query';
import { HealthService } from '@/services/health.service';

export function useClientHealth(clientId: string | null) {
  return useQuery({
    queryKey: ['health', 'client', clientId],
    queryFn: () => HealthService.computeClientHealth(clientId!),
    enabled: !!clientId,
    staleTime: 2 * 60_000, // 2 min
  });
}

export function useAllHealth() {
  return useQuery({
    queryKey: ['health', 'all'],
    queryFn: () => HealthService.computeAllHealth(),
    staleTime: 2 * 60_000,
  });
}
