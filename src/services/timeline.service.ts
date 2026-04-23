import { supabase } from '@/lib/supabase';
import { getCurrentUser } from './_shared';

export interface TimelineEvent {
  id: string;
  event_type: string;
  entity_type: string;
  entity_id: string;
  client_id: string | null;
  actor_id: string | null;
  title: string;
  description: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  // joined
  actor_name?: string | null;
  client_name?: string | null;
}

export interface EmitTimelinePayload {
  event_type: string;
  entity_type: string;
  entity_id: string;
  client_id?: string | null;
  title: string;
  description?: string | null;
  metadata?: Record<string, unknown>;
}

export const TimelineService = {
  emit: async (payload: EmitTimelinePayload): Promise<void> => {
    try {
      const user = await getCurrentUser();
      await supabase.from('timeline_events').insert({
        event_type: payload.event_type,
        entity_type: payload.entity_type,
        entity_id: payload.entity_id,
        client_id: payload.client_id ?? null,
        actor_id: user.id,
        title: payload.title,
        description: payload.description ?? null,
        metadata: payload.metadata ?? {},
      });
    } catch {
      // Best effort — não bloquear fluxo principal
    }
  },

  getByClient: async (
    clientId: string,
    opts?: { limit?: number; offset?: number }
  ): Promise<TimelineEvent[]> => {
    try {
      const { data, error } = await supabase
        .from('timeline_events')
        .select('*, profiles!actor_id(full_name), clients!client_id(name)')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .range(opts?.offset ?? 0, (opts?.offset ?? 0) + (opts?.limit ?? 50) - 1);

      if (error) return [];

      return (data || []).map((row: any) => ({
        ...row,
        actor_name: row.profiles?.full_name ?? null,
        client_name: row.clients?.name ?? null,
      }));
    } catch {
      return [];
    }
  },

  getByEntity: async (entityType: string, entityId: string): Promise<TimelineEvent[]> => {
    try {
      const { data, error } = await supabase
        .from('timeline_events')
        .select('*, profiles!actor_id(full_name)')
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) return [];

      return (data || []).map((row: any) => ({
        ...row,
        actor_name: row.profiles?.full_name ?? null,
      }));
    } catch {
      return [];
    }
  },

  getGlobal: async (opts?: {
    limit?: number;
    offset?: number;
    types?: string[];
  }): Promise<TimelineEvent[]> => {
    try {
      let query = supabase
        .from('timeline_events')
        .select('*, profiles!actor_id(full_name), clients!client_id(name)')
        .order('created_at', { ascending: false })
        .range(opts?.offset ?? 0, (opts?.offset ?? 0) + (opts?.limit ?? 50) - 1);

      if (opts?.types?.length) {
        query = query.in('event_type', opts.types);
      }

      const { data, error } = await query;
      if (error) return [];

      return (data || []).map((row: any) => ({
        ...row,
        actor_name: row.profiles?.full_name ?? null,
        client_name: row.clients?.name ?? null,
      }));
    } catch {
      return [];
    }
  },
};
