/**
 * workflow-engine — Supabase Edge Function
 *
 * Triggered by:
 *   POST /functions/v1/workflow-engine
 *   Body: { event: string; entity_type: string; entity_id: string; payload?: object }
 *
 * Supported events:
 *   task.status_changed  — record task_state_changes, send notifications
 *   task.overdue         — scheduled check via pg_cron (called externally)
 *   approval.decided     — sync back to related entity
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(supabaseUrl, supabaseKey);

interface WorkflowEvent {
  event: string;
  entity_type: string;
  entity_id: string;
  payload?: Record<string, unknown>;
}

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  let body: WorkflowEvent;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const { event, entity_type, entity_id, payload = {} } = body;

  try {
    switch (`${entity_type}.${event}`) {
      case 'task.status_changed': {
        await handleTaskStatusChanged(entity_id, payload);
        break;
      }
      case 'task.overdue_check': {
        await handleOverdueCheck();
        break;
      }
      case 'approval.decided': {
        await handleApprovalDecided(entity_id, payload);
        break;
      }
      default:
        return json({ error: `Unknown event: ${entity_type}.${event}` }, 400);
    }

    return json({ ok: true, event: `${entity_type}.${event}` });
  } catch (err) {
    console.error('[workflow-engine]', err);
    return json({ error: String(err) }, 500);
  }
});

// ── Handlers ──────────────────────────────────────────────────────────────────

async function handleTaskStatusChanged(taskId: string, payload: Record<string, unknown>) {
  const fromStatus = payload.from_status as string | undefined;
  const toStatus = payload.to_status as string;
  const changedBy = payload.changed_by as string | undefined;

  if (!toStatus) return;

  // 1. Compute time in previous status (minutes)
  let timeInPrevMinutes: number | null = null;
  if (fromStatus) {
    const { data: lastChange } = await supabase
      .from('task_state_changes')
      .select('changed_at')
      .eq('task_id', taskId)
      .eq('to_status', fromStatus)
      .order('changed_at', { ascending: false })
      .limit(1)
      .single();

    if (lastChange?.changed_at) {
      timeInPrevMinutes = Math.round(
        (Date.now() - new Date(lastChange.changed_at).getTime()) / 60_000
      );
    }
  }

  // 2. Record state change
  await supabase.from('task_state_changes').insert({
    task_id: taskId,
    from_status: fromStatus ?? null,
    to_status: toStatus,
    changed_by: changedBy ?? null,
    time_in_prev_status_minutes: timeInPrevMinutes,
  });

  // 3. Check if moved to done status — update task
  const { data: doneStatus } = await supabase
    .from('board_statuses')
    .select('is_done')
    .eq('id', toStatus)
    .single();

  if (doneStatus?.is_done) {
    await supabase
      .from('tasks')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', taskId);
  }

  // 4. Create notification for assignee
  const { data: task } = await supabase
    .from('tasks')
    .select('title, assignee_id, board_statuses:status_id(name)')
    .eq('id', taskId)
    .single();

  if (task?.assignee_id) {
    const statusName = (task.board_statuses as { name: string } | null)?.name ?? toStatus;
    await supabase.from('notifications').insert({
      user_id: task.assignee_id,
      type: 'task_status_changed',
      title: 'Status da tarefa atualizado',
      message: `"${task.title}" foi movida para "${statusName}"`,
      entity_type: 'task',
      entity_id: taskId,
    });
  }
}

async function handleOverdueCheck() {
  const now = new Date().toISOString();

  // Fetch tasks that are overdue and not in a done status
  const { data: overdueTasks } = await supabase
    .from('tasks')
    .select('id, title, assignee_id, due_date, status_id')
    .lt('due_date', now)
    .not('status_id', 'is', null);

  if (!overdueTasks || overdueTasks.length === 0) return;

  // Filter out tasks already in done statuses
  const statusIds = [...new Set(overdueTasks.map((t) => t.status_id).filter(Boolean))];
  const { data: doneStatuses } = await supabase
    .from('board_statuses')
    .select('id')
    .in('id', statusIds as string[])
    .eq('is_done', true);

  const doneSet = new Set((doneStatuses ?? []).map((s) => s.id));
  const actualOverdue = overdueTasks.filter((t) => !doneSet.has(t.status_id!));

  console.log(`[workflow-engine] ${actualOverdue.length} overdue tasks found`);

  // Create overdue notifications (bulk)
  if (actualOverdue.length > 0) {
    const notifications = actualOverdue
      .filter((t) => t.assignee_id)
      .map((t) => ({
        user_id: t.assignee_id,
        type: 'task_overdue',
        title: 'Tarefa atrasada',
        message: `"${t.title}" está atrasada (prazo: ${new Date(t.due_date).toLocaleDateString('pt-BR')})`,
        entity_type: 'task',
        entity_id: t.id,
      }));

    if (notifications.length > 0) {
      await supabase.from('notifications').insert(notifications);
    }
  }
}

async function handleApprovalDecided(approvalId: string, payload: Record<string, unknown>) {
  const decision = payload.decision as string;
  const notes = payload.notes as string | undefined;

  // Sync to related task if any
  const { data: approval } = await supabase
    .from('approvals')
    .select('entity_type, entity_id')
    .eq('id', approvalId)
    .single();

  if (!approval) return;

  if (approval.entity_type === 'task') {
    await supabase
      .from('tasks')
      .update({
        approval_required: decision !== 'approved',
        updated_at: new Date().toISOString(),
      })
      .eq('id', approval.entity_id);
  }
}

// ── Helper ────────────────────────────────────────────────────────────────────

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
