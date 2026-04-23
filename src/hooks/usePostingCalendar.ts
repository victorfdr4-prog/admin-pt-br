import { useQuery } from '@tanstack/react-query';
import { ClientService } from '@/services/client.service';
import { PostingCalendarService } from '@/services/posting-calendar.service';
import { normalizeWorkflowStatus } from '@/domain/postWorkflow';

type CalendarPlatform = 'instagram' | 'facebook' | 'linkedin' | 'twitter';
type CalendarStatus = 'draft' | 'scheduled' | 'published' | 'failed';

const normalizePlatform = (value: string): CalendarPlatform => {
  const normalized = String(value || '').toLowerCase();
  if (normalized === 'facebook' || normalized === 'linkedin' || normalized === 'twitter') {
    return normalized;
  }
  return 'instagram';
};

const normalizeStatus = (status: string, workflowStatus?: string | null): CalendarStatus => {
  const normalizedRaw = String(status || '').toLowerCase();
  if (normalizedRaw === 'failed') return 'failed';

  const workflow = normalizeWorkflowStatus(workflowStatus || status);
  if (workflow === 'publicado') return 'published';
  if (workflow === 'agendado') return 'scheduled';
  return 'draft';
};

const extractTimeLabel = (postDate?: string | null) => {
  if (!postDate) return undefined;
  const date = new Date(postDate);
  if (Number.isNaN(date.getTime())) return undefined;
  const hours = date.getHours();
  const minutes = date.getMinutes();
  if (hours === 0 && minutes === 0) return undefined;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

const buildMonthKey = (month: Date) =>
  `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`;

const fetchCalendarItemsForMonth = async (month: Date, clientId?: string | null) => {
  const targetClients = clientId ? [{ id: clientId }] : await ClientService.getAll();
  const calendars = await Promise.all(
    targetClients.map(async (client) => {
      const records = await PostingCalendarService.getRecords(
        client.id,
        month.getMonth(),
        month.getFullYear()
      );
      const calendar = records?.calendar as { id?: string } | undefined;
      const items = Array.isArray(records?.items) ? records.items : [];
      if (!calendar?.id) return null;
      return {
        clientId: client.id,
        clientName: 'name' in client ? String((client as any).name || '') : '',
        items,
      };
    })
  );

  return calendars.filter(Boolean) as Array<{
    clientId: string;
    clientName: string;
    items: any[];
  }>;
};

/**
 * Fetch all clients for calendar filter
 */
export function useCalendarClients() {
  return useQuery({
    queryKey: ['posting-calendar', 'clients'],
    queryFn: async () => {
      return ClientService.getAll();
    },
    staleTime: 5 * 60_000, // 5 minutes
  });
}

/**
 * Fetch calendar data for a specific month and optional client
 */
export function useCalendarMonth(month: Date, clientId?: string | null) {
  return useQuery({
    queryKey: ['posting-calendar', 'month', buildMonthKey(month), clientId || 'all'],
    queryFn: async () => {
      const grouped = new Map<number, { date: Date; posts: Array<{ id: string; title: string; status: CalendarStatus; platform: CalendarPlatform; time?: string }> }>();
      const calendarEntries = await fetchCalendarItemsForMonth(month, clientId);

      calendarEntries.forEach(({ clientName, items }) => {
        items.forEach((item) => {
          const dayNumber = Number(item.day_number || 0);
          if (!dayNumber) return;

          const dayDate = new Date(month.getFullYear(), month.getMonth(), dayNumber);
          const existing = grouped.get(dayNumber) || { date: dayDate, posts: [] };
          existing.posts.push({
            id: String(item.id),
            title: String(item.title || clientName || 'Post'),
            status: normalizeStatus(String(item.status || 'planned'), String(item.workflow_status || '')),
            platform: normalizePlatform(String(item.post_type || 'instagram')),
            time: extractTimeLabel(item.post_date),
          });
          grouped.set(dayNumber, existing);
        });
      });

      return grouped;
    },
    staleTime: 2 * 60_000, // 2 minutes
  });
}

/**
 * Fetch calendar stats
 */
export function useCalendarStats(month: Date, clientId?: string | null) {
  return useQuery({
    queryKey: ['posting-calendar', 'stats', buildMonthKey(month), clientId || 'all'],
    queryFn: async () => {
      const calendarEntries = await fetchCalendarItemsForMonth(month, clientId);
      const totals = {
        scheduled: 0,
        published: 0,
        draft: 0,
        failed: 0,
      };

      calendarEntries.forEach(({ items }) => {
        items.forEach((item) => {
          const status = normalizeStatus(
            String(item.status || 'planned'),
            String(item.workflow_status || '')
          );
          if (status === 'published') totals.published += 1;
          else if (status === 'failed') totals.failed += 1;
          else if (status === 'draft') totals.draft += 1;
          else totals.scheduled += 1;
        });
      });

      return {
        scheduled: totals.scheduled,
        published: totals.published,
        draft: totals.draft,
        failed: totals.failed,
      };
    },
    staleTime: 2 * 60_000,
  });
}
