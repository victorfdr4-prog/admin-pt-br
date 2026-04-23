-- ============================================================
-- CROMIA AGENCY OS - Migration Principal
-- Aplique este arquivo no Supabase SQL Editor
-- ============================================================

-- ----------------------------------------
-- 1. TABELAS NOVAS
-- ----------------------------------------

-- Versões de arquivos (File Workflow Intelligence)
create table if not exists public.file_versions (
  id uuid primary key default gen_random_uuid(),
  file_id uuid not null references public.drive_files(id) on delete cascade,
  version_number integer not null,
  uploaded_by uuid references auth.users(id) on delete set null,
  size_bytes bigint not null default 0,
  change_summary text,
  created_at timestamptz not null default now(),
  unique(file_id, version_number)
);

-- Comentários em arquivos (vinculados a tasks opcionalmente)
create table if not exists public.file_comments (
  id uuid primary key default gen_random_uuid(),
  file_id uuid not null references public.drive_files(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  parent_id uuid references public.file_comments(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Templates de intake (Intake System + Admin Config)
create table if not exists public.intake_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null default 'general',
  fields jsonb not null default '[]'::jsonb,
  auto_assign_to uuid references auth.users(id) on delete set null,
  auto_create_task boolean not null default false,
  default_priority text not null default 'medium',
  sla_hours integer,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Solicitações de intake (Intake System)
create table if not exists public.intake_requests (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete set null,
  template_id uuid references public.intake_templates(id) on delete set null,
  title text not null,
  description text,
  type text not null default 'general'
    check (type in ('general','creative','campaign','support','onboarding','internal')),
  priority text not null default 'medium'
    check (priority in ('low','medium','high','urgent')),
  status text not null default 'new'
    check (status in ('new','triaged','in_progress','completed','cancelled')),
  assigned_to uuid references auth.users(id) on delete set null,
  form_data jsonb not null default '{}'::jsonb,
  source text not null default 'admin'
    check (source in ('admin','portal','email','api')),
  deadline timestamptz,
  completed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Aprovações unificadas (Approval Center)
create table if not exists public.approvals (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null
    check (entity_type in ('file','post','creative','campaign','task','calendar_item')),
  entity_id uuid not null,
  client_id uuid references public.clients(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'pending'
    check (status in ('pending','approved','rejected','revision_requested','cancelled')),
  requested_by uuid not null references auth.users(id) on delete cascade,
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  decision_notes text,
  metadata jsonb not null default '{}'::jsonb,
  due_date timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Timeline unificada de eventos (substitui/complementa activity_logs)
create table if not exists public.timeline_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  entity_type text not null,
  entity_id uuid not null,
  client_id uuid references public.clients(id) on delete set null,
  actor_id uuid references auth.users(id) on delete set null,
  title text not null,
  description text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Workflows configuráveis (Admin Config)
create table if not exists public.workflow_definitions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  entity_type text not null,
  trigger_event text not null,
  conditions jsonb not null default '{}'::jsonb,
  actions jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ----------------------------------------
-- 2. COLUNAS NOVAS EM TABELAS EXISTENTES
-- ----------------------------------------

-- drive_files: vínculo com task + aprovação + metadados
alter table public.drive_files
  add column if not exists task_id uuid references public.tasks(id) on delete set null,
  add column if not exists uploaded_by uuid references auth.users(id) on delete set null,
  add column if not exists approval_status text
    check (approval_status in ('pending','approved','rejected')),
  add column if not exists description text;

-- tasks: SLA, next action, tipo de serviço, agrupamento
alter table public.tasks
  add column if not exists sla_deadline timestamptz,
  add column if not exists last_action_at timestamptz default now(),
  add column if not exists next_action text,
  add column if not exists next_action_by uuid references auth.users(id) on delete set null,
  add column if not exists service_type text,
  add column if not exists group_id text,
  add column if not exists intake_request_id uuid references public.intake_requests(id) on delete set null;

-- clients: health scoring
alter table public.clients
  add column if not exists health_score integer not null default 100,
  add column if not exists health_status text not null default 'healthy'
    check (health_status in ('healthy','attention','critical')),
  add column if not exists last_activity_at timestamptz default now(),
  add column if not exists next_action text,
  add column if not exists next_action_due timestamptz;

-- ----------------------------------------
-- 3. ÍNDICES
-- ----------------------------------------

create index if not exists idx_drive_files_task_id
  on public.drive_files(task_id);

create index if not exists idx_approvals_entity
  on public.approvals(entity_type, entity_id);

create index if not exists idx_approvals_status
  on public.approvals(status, created_at desc);

create index if not exists idx_approvals_client
  on public.approvals(client_id, status);

create index if not exists idx_intake_requests_status
  on public.intake_requests(status, created_at desc);

create index if not exists idx_intake_requests_client
  on public.intake_requests(client_id, status);

create index if not exists idx_intake_requests_assigned
  on public.intake_requests(assigned_to, status);

create index if not exists idx_timeline_events_client
  on public.timeline_events(client_id, created_at desc);

create index if not exists idx_timeline_events_entity
  on public.timeline_events(entity_type, entity_id);

create index if not exists idx_tasks_sla_deadline
  on public.tasks(sla_deadline) where sla_deadline is not null;

create index if not exists idx_tasks_service_type
  on public.tasks(service_type);

create index if not exists idx_clients_health_status
  on public.clients(health_status);

create index if not exists idx_file_comments_file_id
  on public.file_comments(file_id, created_at desc);

-- ----------------------------------------
-- 4. ROW LEVEL SECURITY
-- ----------------------------------------

alter table public.file_versions enable row level security;
alter table public.file_comments enable row level security;
alter table public.intake_templates enable row level security;
alter table public.intake_requests enable row level security;
alter table public.approvals enable row level security;
alter table public.timeline_events enable row level security;
alter table public.workflow_definitions enable row level security;

-- file_versions: acesso por owner do drive_file (via client)
create policy "file_versions_select" on public.file_versions
  for select using (
    exists (
      select 1 from public.drive_files df
      join public.clients c on c.id = df.client_id
      where df.id = file_versions.file_id
        and (c.owner_id = auth.uid() or is_admin())
    )
  );

create policy "file_versions_insert" on public.file_versions
  for insert with check (is_admin() or auth.uid() is not null);

-- file_comments: qualquer autenticado pode ver/criar
create policy "file_comments_select" on public.file_comments
  for select using (auth.uid() is not null);

create policy "file_comments_insert" on public.file_comments
  for insert with check (auth.uid() = user_id);

create policy "file_comments_update" on public.file_comments
  for update using (auth.uid() = user_id or is_admin());

create policy "file_comments_delete" on public.file_comments
  for delete using (auth.uid() = user_id or is_admin());

-- intake_templates: apenas admins gerenciam; autenticados leem ativos
create policy "intake_templates_select" on public.intake_templates
  for select using (is_active = true or is_admin());

create policy "intake_templates_all" on public.intake_templates
  for all using (is_admin());

-- intake_requests: owner do client ou admin
create policy "intake_requests_select" on public.intake_requests
  for select using (
    is_admin() or
    exists (
      select 1 from public.clients c
      where c.id = intake_requests.client_id and c.owner_id = auth.uid()
    ) or
    assigned_to = auth.uid() or
    created_by = auth.uid()
  );

create policy "intake_requests_insert" on public.intake_requests
  for insert with check (auth.uid() is not null);

create policy "intake_requests_update" on public.intake_requests
  for update using (
    is_admin() or assigned_to = auth.uid() or created_by = auth.uid()
  );

-- approvals: owner do client ou admin
create policy "approvals_select" on public.approvals
  for select using (
    is_admin() or
    exists (
      select 1 from public.clients c
      where c.id = approvals.client_id and c.owner_id = auth.uid()
    ) or
    requested_by = auth.uid()
  );

create policy "approvals_insert" on public.approvals
  for insert with check (auth.uid() is not null);

create policy "approvals_update" on public.approvals
  for update using (is_admin() or requested_by = auth.uid());

-- timeline_events: todos autenticados veem, apenas sistema insere
create policy "timeline_events_select" on public.timeline_events
  for select using (auth.uid() is not null);

create policy "timeline_events_insert" on public.timeline_events
  for insert with check (auth.uid() is not null);

-- workflow_definitions: apenas admins
create policy "workflow_definitions_all" on public.workflow_definitions
  for all using (is_admin());

-- ----------------------------------------
-- 5. TRIGGERS updated_at
-- ----------------------------------------

create or replace trigger set_file_comments_updated_at
  before update on public.file_comments
  for each row execute function set_updated_at();

create or replace trigger set_intake_templates_updated_at
  before update on public.intake_templates
  for each row execute function set_updated_at();

create or replace trigger set_intake_requests_updated_at
  before update on public.intake_requests
  for each row execute function set_updated_at();

create or replace trigger set_approvals_updated_at
  before update on public.approvals
  for each row execute function set_updated_at();

create or replace trigger set_workflow_definitions_updated_at
  before update on public.workflow_definitions
  for each row execute function set_updated_at();
