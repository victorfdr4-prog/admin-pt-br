import { useQuery } from '@tanstack/react-query';
import { DashboardService } from '@/services';

export function useDashboardSummary() {
  return useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: () => DashboardService.getSummary(),
    staleTime: 60_000,
  });
}
