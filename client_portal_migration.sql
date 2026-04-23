-- Portal externo de clientes (Supabase)
-- Execute esta query no Supabase SQL Editor

create extension if not exists "pgcrypto";

create table if not exists public.client_portal (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  token uuid not null unique default gen_random_uuid(),
  is_active boolean not null default true,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_client_portal_client_created
  on public.client_portal(client_id, created_at desc);

create index if not exists idx_client_portal_active_expires
  on public.client_portal(is_active, expires_at);

alter table public.client_portal enable row level security;

drop policy if exists client_portal_all on public.client_portal;
create policy client_portal_all on public.client_portal
for all
using (
  exists (
    select 1
    from public.clients c
    where c.id = client_portal.client_id
      and (c.owner_id = auth.uid() or public.is_admin())
  )
)
with check (
  exists (
    select 1
    from public.clients c
    where c.id = client_portal.client_id
      and (c.owner_id = auth.uid() or public.is_admin())
  )
);
