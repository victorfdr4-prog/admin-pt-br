-- ============================================================
-- Hub: add missing columns to posting_calendar_items
-- Apply via: Supabase Dashboard → SQL Editor → Run
-- These are all safe (no-op) if the column already exists.
-- ============================================================

-- Versioning / lifecycle
alter table public.posting_calendar_items
  add column if not exists is_current_version  boolean   not null default true,
  add column if not exists version_number       integer   not null default 1,
  add column if not exists revision_count       integer   not null default 0,
  add column if not exists parent_post_id       uuid      references public.posting_calendar_items(id),
  add column if not exists superseded_at        timestamptz,
  add column if not exists deleted_at           timestamptz,
  add column if not exists last_transition_at   timestamptz;

-- Scheduling / publishing
alter table public.posting_calendar_items
  add column if not exists scheduled_date       timestamptz,
  add column if not exists published_at         timestamptz;

-- Distribution channel (Instagram, Facebook, etc.)
alter table public.posting_calendar_items
  add column if not exists channel              text;

-- Versioning audit
alter table public.posting_calendar_items
  add column if not exists change_reason        text,
  add column if not exists change_log           jsonb     not null default '[]'::jsonb;

-- ── Indexes ──────────────────────────────────────────────────────────────
-- Fast lookup for Hub calendar queries
create index if not exists idx_pci_client_date
  on public.posting_calendar_items (client_id, post_date)
  where deleted_at is null and is_current_version = true;

create index if not exists idx_pci_workflow_client
  on public.posting_calendar_items (client_id, workflow_status)
  where deleted_at is null and is_current_version = true;
