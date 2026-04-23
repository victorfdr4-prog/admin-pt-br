import { useQuery } from '@tanstack/react-query';
import { FinanceService } from '@/services';

export function useFinanceOverview() {
  return useQuery({
    queryKey: ['finance', 'overview'],
    queryFn: () => FinanceService.getOverview(),
    staleTime: 60_000,
  });
}
