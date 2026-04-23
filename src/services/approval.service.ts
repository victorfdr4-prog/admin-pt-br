import { supabase } from '@/lib/supabase';
import { getCurrentUser, isMissingRelationError, logActivity } from './_shared';
import { TimelineService } from './timeline.service';

export type ApprovalStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'revision_requested'
  | 'cancelled';

export type ApprovalEntityType =
  | 'file'
  | 'post'
  | 'creative'
  | 'campaign'
  | 'task'
  | 'calendar_item';

export interface Approval {
  id: string;
  entity_type: ApprovalEntityType;
  entity_id: string;
  client_id: string | null;
  title: string;
  description: string | null;
  status: ApprovalStatus;
  requested_by: string;
  decided_by: string | null;
  decided_at: string | null;
  decision_notes: string | null;
  metadata: Record<string, unknown>;
  due_date: string | null;
  created_at: string;
  updated_at: string;
  client_name?: string | null;
  requester_name?: string | null;
  decider_name?: string | null;
}

export interface CreateApprovalPayload {
  entity_type: ApprovalEntityType;
  entity_id: string;
  client_id?: string | null;
  title: string;
  description?: string | null;
  metadata?: Record<string, unknown>;
  due_date?: string | null;
}

type ApprovalRow = {
  id: string;
  entity_type: ApprovalEntityType;
  entity_id: string;
  client_id: string | null;
  title: string;
  description: string | null;
  status: ApprovalStatus;
  requested_by: string;
  decided_by: string | null;
  decided_at: string | null;
  decision_notes: string | null;
  metadata: Record<string, unknown>;
  due_date: string | null;
  created_at: string;
  updated_at: string;
  clients?: {
    name?: string | null;
  } | null;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
};

const baseSelect = `
  id,
  entity_type,
  entity_id,
  client_id,
  title,
  description,
  status,
  requested_by,
  decided_by,
  decided_at,
  decision_notes,
  metadata,
  due_date,
  created_at,
  updated_at,
  clients!client_id(name)
`;

let approvalsUnavailable = false;

const shouldSilenceApprovals = (error: unknown) => {
  if (isMissingRelationError(error, 'approvals')) {
    approvalsUnavailable = true;
    return true;
  }

  const message = String((error as { message?: unknown })?.message || '').toLowerCase();

  if (
    message.includes('approvals') &&
    (message.includes('does not exist') || message.includes('not found'))
  ) {
    approvalsUnavailable = true;
    return true;
  }

  return false;
};

async function enrichApprovals(rows: ApprovalRow[]): Promise<Approval[]> {
  const userIds = [
    ...new Set(
      rows.flatMap((row) => [row.requested_by, row.decided_by]).filter(Boolean) as string[]
    ),
  ];

  let profileMap: Record<string, ProfileRow> = {};

  if (userIds.length > 0) {
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', userIds);

    if (profilesError) {
      throw profilesError;
    }

    profileMap = Object.fromEntries(
      ((profiles as ProfileRow[] | null) || []).map((profile) => [profile.id, profile])
    );
  }

  return rows.map((row) => ({
    ...row,
    client_name: row.clients?.name ?? null,
    requester_name: row.requested_by
      ? profileMap[row.requested_by]?.full_name ?? null
      : null,
    decider_name: row.decided_by
      ? profileMap[row.decided_by]?.full_name ?? null
      : null,
  }));
}

export const ApprovalService = {
  getAll: async (opts?: {
    status?: ApprovalStatus;
    clientId?: string;
    entityType?: ApprovalEntityType;
    limit?: number;
    offset?: number;
  }): Promise<Approval[]> => {
    if (approvalsUnavailable) return [];

    let query = supabase
      .from('approvals')
      .select(baseSelect)
      .order('created_at', { ascending: false })
      .range(opts?.offset ?? 0, (opts?.offset ?? 0) + (opts?.limit ?? 50) - 1);

    if (opts?.status) query = query.eq('status', opts.status);
    if (opts?.clientId) query = query.eq('client_id', opts.clientId);
    if (opts?.entityType) query = query.eq('entity_type', opts.entityType);

    const { data, error } = await query;

    if (error) {
      if (shouldSilenceApprovals(error)) return [];
      throw error;
    }

    return enrichApprovals((data as ApprovalRow[] | null) || []);
  },

  getPending: async (): Promise<Approval[]> => {
    return ApprovalService.getAll({ status: 'pending' });
  },

  getByEntity: async (
    entityType: ApprovalEntityType,
    entityId: string
  ): Promise<Approval[]> => {
    if (approvalsUnavailable) return [];

    const { data, error } = await supabase
      .from('approvals')
      .select(baseSelect)
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .order('created_at', { ascending: false });

    if (error) {
      if (shouldSilenceApprovals(error)) return [];
      throw error;
    }

    return enrichApprovals((data as ApprovalRow[] | null) || []);
  },

  create: async (payload: CreateApprovalPayload): Promise<Approval> => {
    const user = await getCurrentUser();

    const { data, error } = await supabase
      .from('approvals')
      .insert({
        entity_type: payload.entity_type,
        entity_id: payload.entity_id,
        client_id: payload.client_id ?? null,
        title: payload.title,
        description: payload.description ?? null,
        metadata: payload.metadata ?? {},
        due_date: payload.due_date ?? null,
        requested_by: user.id,
        status: 'pending',
      })
      .select(baseSelect)
      .single();

    if (error) throw error;

    const approval = (await enrichApprovals([data as ApprovalRow]))[0];

    await Promise.all([
      logActivity('approval_requested', 'approval', approval.id, payload.client_id ?? null, {
        title: payload.title,
        entity_type: payload.entity_type,
      }),
      TimelineService.emit({
        event_type: 'approval_requested',
        entity_type: 'approval',
        entity_id: approval.id,
        client_id: payload.client_id,
        title: `Aprovação solicitada: ${payload.title}`,
      }),
    ]);

    return approval;
  },

  decide: async (
    id: string,
    decision: 'approved' | 'rejected' | 'revision_requested',
    notes?: string
  ): Promise<Approval> => {
    const user = await getCurrentUser();

    const { data, error } = await supabase
      .from('approvals')
      .update({
        status: decision,
        decided_by: user.id,
        decided_at: new Date().toISOString(),
        decision_notes: notes ?? null,
      })
      .eq('id', id)
      .select(baseSelect)
      .single();

    if (error) throw error;

    const approval = (await enrichApprovals([data as ApprovalRow]))[0];

    await Promise.all([
      logActivity(`approval_${decision}`, 'approval', id, approval.client_id, {
        notes,
        title: approval.title,
      }),
      TimelineService.emit({
        event_type: `approval_${decision}`,
        entity_type: 'approval',
        entity_id: id,
        client_id: approval.client_id,
        title: `${
          decision === 'approved'
            ? 'Aprovado'
            : decision === 'rejected'
            ? 'Rejeitado'
            : 'Revisão solicitada'
        }: ${approval.title}`,
        description: notes ?? null,
      }),
    ]);

    return approval;
  },

  cancel: async (id: string): Promise<void> => {
    const { error } = await supabase
      .from('approvals')
      .update({ status: 'cancelled' })
      .eq('id', id);

    if (error) throw error;

    await logActivity('approval_cancelled', 'approval', id);
  },

  getPendingCount: async (): Promise<number> => {
    if (approvalsUnavailable) return 0;

    const { count, error } = await supabase
      .from('approvals')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending');

    if (error) {
      if (shouldSilenceApprovals(error)) return 0;
      return 0;
    }

    return count ?? 0;
  },
};