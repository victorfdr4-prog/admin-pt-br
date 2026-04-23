-- CROMiaOS - One-shot Supabase reset (DESTRUCTIVE)
-- This script drops and recreates the app schema used by the backend.
-- Run this whole file in one execution in Supabase SQL Editor.

begin;

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";
create extension if not exists "vector";

drop trigger if exists on_auth_user_created on auth.users;

drop function if exists public.match_ai_documents(vector, integer, uuid, uuid, boolean);
drop function if exists public.handle_new_user();
drop function if exists public.is_admin();
drop function if exists public.set_updated_at();

drop table if exists public.ai_documents cascade;
drop table if exists public.activity_logs cascade;
drop table if exists public.notifications cascade;
drop table if exists public.drive_files cascade;
drop table if exists public.client_portal cascade;
drop table if exists public.finance_entries cascade;
drop table if exists public.onboarding_tasks cascade;
drop table if exists public.tasks cascade;
drop table if exists public.clients cascade;
drop table if exists public.system_settings cascade;
drop table if exists public.profiles cascade;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text not null unique,
  phone text,
  role text not null default 'user' check (role in ('admin', 'manager', 'user')),
  active boolean not null default true,
  avatar_url text,
  bio text not null default '',
  specialties text[] not null default '{}',
  performance_score numeric(5,2) not null default 0,
  active_projects integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.system_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete restrict,
  name text not null,
  email text not null,
  phone text,
  company text,
  segment text,
  industry text,
  status text not null default 'lead' check (status in ('lead', 'pending', 'active', 'inactive', 'lost')),
  plan text not null default 'Performance Pro',
  is_free_or_trade boolean not null default false,
  generate_drive_folder boolean not null default true,
  one_time_payment boolean not null default false,
  logo_url text,
  site_url text,
  site_description text,
  display_order integer not null default 0,
  is_visible_site boolean not null default true,
  is_featured_site boolean not null default false,
  testimonial_content text,
  testimonial_author_name text,
  testimonial_author_role text,
  testimonial_author_avatar text,
  testimonial_rating integer not null default 5 check (testimonial_rating between 1 and 5),
  testimonial_display_order integer not null default 0,
  is_testimonial_visible boolean not null default false,
  notes text,
  value numeric(12,2) not null default 0,
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  kanban_pipeline jsonb not null default '{}'::jsonb,
  drive_folder_id text,
  drive_subfolders jsonb not null default '{}'::jsonb,
  portal_token text not null unique default gen_random_uuid()::text,
  portal_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.client_portal (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  token uuid not null unique default gen_random_uuid(),
  is_active boolean not null default true,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'todo',
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  order_index integer not null default 0,
  assignee_id uuid references auth.users(id) on delete set null,
  due_date timestamptz,
  checklist jsonb not null default '[]'::jsonb,
  custom_fields jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.onboarding_tasks (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  title text not null,
  description text,
  required boolean not null default false,
  status text not null default 'pending' check (status in ('pending', 'completed')),
  order_index integer not null default 0,
  due_date date,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.finance_entries (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  type text not null check (type in ('income', 'expense')),
  amount numeric(12,2) not null check (amount > 0),
  category text not null,
  description text,
  status text not null default 'pending' check (status in ('paid', 'pending', 'overdue')),
  date date not null default current_date,
  acquisition_cost boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.drive_files (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  file_id text not null unique,
  name text not null,
  mime_type text,
  folder_name text,
  folder_id text,
  version integer not null default 1,
  size_bytes bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  message text not null,
  type text not null default 'info' check (type in ('info', 'success', 'warning', 'error')),
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  action text not null,
  entity text not null,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  ip inet,
  user_agent text,
  created_at timestamptz not null default now()
);

create table public.ai_documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  source text not null,
  source_id text not null,
  content text not null,
  embedding vector(1536) not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_id, source, source_id)
);

create index idx_clients_owner_id on public.clients(owner_id);
create index idx_clients_status on public.clients(status);
create index idx_client_portal_client_created on public.client_portal(client_id, created_at desc);
create index idx_client_portal_active_expires on public.client_portal(is_active, expires_at);

create index idx_tasks_client_status_order on public.tasks(client_id, status, order_index);
create index idx_tasks_assignee_id on public.tasks(assignee_id);

create index idx_onboarding_tasks_client_order on public.onboarding_tasks(client_id, order_index);

create index idx_finance_entries_client_date on public.finance_entries(client_id, date desc);
create index idx_finance_entries_type_status on public.finance_entries(type, status);

create index idx_drive_files_client_updated_at on public.drive_files(client_id, updated_at desc);
create index idx_drive_files_folder_id on public.drive_files(folder_id);

create index idx_notifications_user_id_created_at on public.notifications(user_id, created_at desc);

create index idx_activity_logs_created_at on public.activity_logs(created_at desc);
create index idx_activity_logs_client_created_at on public.activity_logs(client_id, created_at desc);

create index idx_ai_documents_owner_created_at on public.ai_documents(owner_id, created_at desc);
create index idx_ai_documents_embedding on public.ai_documents
using ivfflat (embedding vector_cosine_ops) with (lists = 100);

create function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_profiles_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger trg_clients_updated_at before update on public.clients
for each row execute function public.set_updated_at();
create trigger trg_tasks_updated_at before update on public.tasks
for each row execute function public.set_updated_at();
create trigger trg_onboarding_tasks_updated_at before update on public.onboarding_tasks
for each row execute function public.set_updated_at();
create trigger trg_finance_entries_updated_at before update on public.finance_entries
for each row execute function public.set_updated_at();
create trigger trg_drive_files_updated_at before update on public.drive_files
for each row execute function public.set_updated_at();
create trigger trg_ai_documents_updated_at before update on public.ai_documents
for each row execute function public.set_updated_at();

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, role, active)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.email,
    'user',
    true
  )
  on conflict (id) do update
  set
    full_name = excluded.full_name,
    email = excluded.email;

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
      and p.active = true
  );
$$;

create function public.match_ai_documents(
  query_embedding vector(1536),
  match_count integer default 8,
  p_owner_id uuid default null,
  p_client_id uuid default null,
  p_is_admin boolean default false
)
returns table (
  id uuid,
  content text,
  metadata jsonb,
  similarity float
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select
    d.id,
    d.content,
    d.metadata,
    1 - (d.embedding <=> query_embedding) as similarity
  from public.ai_documents d
  where
    (p_is_admin = true or d.owner_id = p_owner_id)
    and (p_client_id is null or d.client_id = p_client_id)
  order by d.embedding <=> query_embedding
  limit greatest(match_count, 1);
end;
$$;

alter table public.profiles enable row level security;
alter table public.system_settings enable row level security;
alter table public.clients enable row level security;
alter table public.client_portal enable row level security;
alter table public.tasks enable row level security;
alter table public.onboarding_tasks enable row level security;
alter table public.finance_entries enable row level security;
alter table public.drive_files enable row level security;
alter table public.notifications enable row level security;
alter table public.activity_logs enable row level security;
alter table public.ai_documents enable row level security;

create policy profiles_select on public.profiles
for select using (id = auth.uid() or public.is_admin());
create policy profiles_update on public.profiles
for update using (id = auth.uid() or public.is_admin())
with check (id = auth.uid() or public.is_admin());
create policy profiles_insert on public.profiles
for insert with check (id = auth.uid() or public.is_admin());

create policy system_settings_admin on public.system_settings
for all using (public.is_admin())
with check (public.is_admin());

create policy clients_select on public.clients
for select using (owner_id = auth.uid() or public.is_admin());
create policy clients_insert on public.clients
for insert with check (owner_id = auth.uid() or public.is_admin());
create policy clients_update on public.clients
for update using (owner_id = auth.uid() or public.is_admin())
with check (owner_id = auth.uid() or public.is_admin());
create policy clients_delete on public.clients
for delete using (owner_id = auth.uid() or public.is_admin());

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

create policy tasks_all on public.tasks
for all
using (
  exists (
    select 1
    from public.clients c
    where c.id = tasks.client_id
      and (c.owner_id = auth.uid() or public.is_admin())
  )
)
with check (
  exists (
    select 1
    from public.clients c
    where c.id = tasks.client_id
      and (c.owner_id = auth.uid() or public.is_admin())
  )
);

create policy onboarding_tasks_all on public.onboarding_tasks
for all
using (
  exists (
    select 1
    from public.clients c
    where c.id = onboarding_tasks.client_id
      and (c.owner_id = auth.uid() or public.is_admin())
  )
)
with check (
  exists (
    select 1
    from public.clients c
    where c.id = onboarding_tasks.client_id
      and (c.owner_id = auth.uid() or public.is_admin())
  )
);

create policy finance_entries_all on public.finance_entries
for all
using (
  exists (
    select 1
    from public.clients c
    where c.id = finance_entries.client_id
      and (c.owner_id = auth.uid() or public.is_admin())
  )
)
with check (
  exists (
    select 1
    from public.clients c
    where c.id = finance_entries.client_id
      and (c.owner_id = auth.uid() or public.is_admin())
  )
);

create policy drive_files_all on public.drive_files
for all
using (
  exists (
    select 1
    from public.clients c
    where c.id = drive_files.client_id
      and (c.owner_id = auth.uid() or public.is_admin())
  )
)
with check (
  exists (
    select 1
    from public.clients c
    where c.id = drive_files.client_id
      and (c.owner_id = auth.uid() or public.is_admin())
  )
);

create policy notifications_select on public.notifications
for select using (user_id = auth.uid() or public.is_admin());
create policy notifications_update on public.notifications
for update using (user_id = auth.uid() or public.is_admin())
with check (user_id = auth.uid() or public.is_admin());
create policy notifications_insert_admin on public.notifications
for insert with check (public.is_admin());

create policy activity_logs_select on public.activity_logs
for select
using (
  public.is_admin()
  or user_id = auth.uid()
  or exists (
    select 1
    from public.clients c
    where c.id = activity_logs.client_id
      and c.owner_id = auth.uid()
  )
);
create policy activity_logs_insert on public.activity_logs
for insert with check (public.is_admin() or user_id = auth.uid());

create policy ai_documents_all on public.ai_documents
for all
using (owner_id = auth.uid() or public.is_admin())
with check (owner_id = auth.uid() or public.is_admin());

grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant all on all routines in schema public to anon, authenticated, service_role;

alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on routines to anon, authenticated, service_role;

insert into public.system_settings (key, value)
values
  (
    'google_drive',
    '{
      "root_folder_id": "1r1eeuinYigWFLWwB6kJAkT9ATJJJIpCn",
      "folder_pattern": "[CROMIA]_[CLIENTE]_[RAMO]",
      "uppercase": true,
      "subfolders": [
        {"name": "01_LOGO", "active": true},
        {"name": "02_FOTOS", "active": true},
        {"name": "03_OUTROS", "active": true},
        {"name": "04_CONTRATOS", "active": true},
        {"name": "05_ANUNCIOS", "active": true}
      ]
    }'::jsonb
  ),
  (
    'kanban_pipeline',
    '{
      "columns": [
        {"id": "todo", "title": "A Fazer", "order": 1},
        {"id": "in-progress", "title": "Em Andamento", "order": 2},
        {"id": "review", "title": "Revisão", "order": 3},
        {"id": "done", "title": "Concluído", "order": 4}
      ]
    }'::jsonb
  ),
  (
    'onboarding_template',
    '{
      "tasks": [
        {"title": "Kickoff", "description": "Reunião inicial com cliente", "required": true},
        {"title": "Coleta de acessos", "description": "Receber acessos de mídia e analytics", "required": true},
        {"title": "Pasta Drive", "description": "Estrutura de arquivos criada e validada", "required": true},
        {"title": "Primeira entrega", "description": "Apresentação inicial de plano e cronograma", "required": false}
      ]
    }'::jsonb
  ),
  (
    'plans_catalog',
    '{
      "items": [
        "Performance Pro",
        "Growth Starter",
        "Enterprise Scale"
      ]
    }'::jsonb
  ),
  (
    'branding',
    '{
      "agency_name": "CROMiaOS",
      "primary_color": "#0F172A",
      "logo_url": ""
    }'::jsonb
  )
on conflict (key) do update
set
  value = excluded.value,
  updated_at = now();

commit;

select pg_notify('pgrst', 'reload schema');
