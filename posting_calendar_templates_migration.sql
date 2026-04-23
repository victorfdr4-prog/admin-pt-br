-- Templates editáveis do calendário de postagem
-- Execute no SQL Editor do Supabase para habilitar a entidade dedicada.

create extension if not exists "pgcrypto";

create table if not exists public.posting_calendar_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  client_id uuid references public.clients(id) on delete cascade,
  reference_image_url text,
  config jsonb not null default '{}'::jsonb,
  legend_items jsonb not null default '[]'::jsonb,
  status text not null default 'draft',
  is_active boolean not null default false,
  version integer not null default 1,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_posting_calendar_templates_client
  on public.posting_calendar_templates(client_id, updated_at desc);

create index if not exists idx_posting_calendar_templates_scope_active
  on public.posting_calendar_templates(is_active, updated_at desc);

create unique index if not exists idx_posting_calendar_templates_slug_scope
  on public.posting_calendar_templates(coalesce(client_id::text, 'default'), slug);

create or replace function public.touch_posting_calendar_templates_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_touch_posting_calendar_templates_updated_at on public.posting_calendar_templates;
create trigger trg_touch_posting_calendar_templates_updated_at
before update on public.posting_calendar_templates
for each row
execute function public.touch_posting_calendar_templates_updated_at();

alter table public.posting_calendar_templates enable row level security;

drop policy if exists posting_calendar_templates_select on public.posting_calendar_templates;
create policy posting_calendar_templates_select
on public.posting_calendar_templates
for select
using (
  public.is_admin()
  or exists (
    select 1
    from public.clients c
    where c.id = posting_calendar_templates.client_id
      and c.owner_id = auth.uid()
  )
);

drop policy if exists posting_calendar_templates_write on public.posting_calendar_templates;
create policy posting_calendar_templates_write
on public.posting_calendar_templates
for all
using (
  public.is_admin()
  or exists (
    select 1
    from public.clients c
    where c.id = posting_calendar_templates.client_id
      and c.owner_id = auth.uid()
  )
)
with check (
  public.is_admin()
  or exists (
    select 1
    from public.clients c
    where c.id = posting_calendar_templates.client_id
      and c.owner_id = auth.uid()
  )
);

insert into storage.buckets (id, name, public)
values ('posting-calendars', 'posting-calendars', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists posting_calendars_public_read on storage.objects;
create policy posting_calendars_public_read
on storage.objects
for select
using (bucket_id = 'posting-calendars');

drop policy if exists posting_calendars_admin_write on storage.objects;
create policy posting_calendars_admin_write
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'posting-calendars'
  and public.is_admin()
);

drop policy if exists posting_calendars_admin_update on storage.objects;
create policy posting_calendars_admin_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'posting-calendars'
  and public.is_admin()
)
with check (
  bucket_id = 'posting-calendars'
  and public.is_admin()
);

drop policy if exists posting_calendars_admin_delete on storage.objects;
create policy posting_calendars_admin_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'posting-calendars'
  and public.is_admin()
);
