-- Aprovação de calendário pelo portal e mídia nativa por dia
-- Execute no SQL Editor do Supabase.

alter table if exists public.posting_calendars
  add column if not exists approval_status text not null default 'draft',
  add column if not exists approval_requested_at timestamptz,
  add column if not exists approved_at timestamptz,
  add column if not exists approved_by_name text;

alter table if exists public.posting_calendar_items
  add column if not exists approval_status text not null default 'pending',
  add column if not exists approval_notes text,
  add column if not exists approved_at timestamptz,
  add column if not exists approved_by_name text;

create index if not exists idx_posting_calendar_items_calendar_approval
  on public.posting_calendar_items(calendar_id, approval_status);

create index if not exists idx_posting_calendars_client_approval
  on public.posting_calendars(client_id, approval_status);
