import { useQuery } from '@tanstack/react-query';
import { ClientService } from '@/services/client.service';
import { TaskService } from '@/services/task.service';
import { DriveService } from '@/services/drive.service';
import { TimelineService } from '@/services/timeline.service';
import { HealthService } from '@/services/health.service';
import { PostingCalendarService } from '@/services/posting-calendar.service';

/**
 * Fetch single client by ID
 */
export function useClient(clientId: string | null) {
  return useQuery({
    queryKey: ['client', clientId],
    queryFn: () => ClientService.getById(clientId!),
    enabled: !!clientId,
    staleTime: 5 * 60_000, // 5 minutes
  });
}

/**
 * Fetch all tasks for a client
 */
export function useClientTasks(clientId: string | null) {
  return useQuery({
    queryKey: ['tasks', 'client', clientId],
    queryFn: async () => {
      if (!clientId) return [];
      return TaskService.getByClient(clientId);
    },
    enabled: !!clientId,
    staleTime: 2 * 60_000, // 2 minutes
  });
}

/**
 * Fetch documents/files for a client
 */
export function useClientDocuments(clientId: string | null) {
  return useQuery({
    queryKey: ['documents', 'client', clientId],
    queryFn: async () => {
      if (!clientId) return [];
      return DriveService.getByClient(clientId);
    },
    enabled: !!clientId,
    staleTime: 3 * 60_000, // 3 minutes
  });
}

/**
 * Fetch timeline events for a client
 */
export function useClientTimeline(clientId: string | null) {
  return useQuery({
    queryKey: ['timeline', 'client', clientId],
    queryFn: async () => {
      if (!clientId) return [];
      return TimelineService.getByClient(clientId);
    },
    enabled: !!clientId,
    staleTime: 2 * 60_000, // 2 minutes
  });
}

/**
 * Fetch health score and factors for a client
 */
export function useClientHealthWithFactors(clientId: string | null) {
  return useQuery({
    queryKey: ['health', 'client', clientId],
    queryFn: async () => {
      if (!clientId) return { score: 100, status: 'healthy' as const, factors: [] };
      return HealthService.computeClientHealth(clientId);
    },
    enabled: !!clientId,
    staleTime: 2 * 60_000, // 2 minutes
  });
}

/**
 * Fetch posting calendar items for a client and date range
 */
export function useClientPostingCalendar(clientId: string | null, startDate: Date, endDate: Date) {
  return useQuery({
    queryKey: ['posting-calendar', 'client', clientId, startDate.toISOString(), endDate.toISOString()],
    queryFn: async () => {
      if (!clientId) return [];
      return PostingCalendarService.getByClientAndDateRange(clientId, startDate, endDate);
    },
    enabled: !!clientId && !!startDate && !!endDate,
    staleTime: 3 * 60_000, // 3 minutes
  });
}

/**
 * Composite hook combining all client hub data
 */
export function useClientHub(clientId: string | null) {
  const client = useClient(clientId);
  const tasks = useClientTasks(clientId);
  const documents = useClientDocuments(clientId);
  const timeline = useClientTimeline(clientId);
  const health = useClientHealthWithFactors(clientId);

  return {
    client,
    tasks,
    documents,
    timeline,
    health,
    isLoading: client.isLoading || tasks.isLoading || documents.isLoading || timeline.isLoading || health.isLoading,
    isError: client.isError || tasks.isError || documents.isError || timeline.isError || health.isError,
    error: client.error || tasks.error || documents.error || timeline.error || health.error,
  };
}
