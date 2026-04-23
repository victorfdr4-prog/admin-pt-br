-- =============================================================
-- Fix: is_admin() + RLS policies para admin_estrategico/operacional
-- Problema: is_admin() verificava role='admin' (nunca existiu).
-- Os papeis reais são admin_estrategico e admin_operacional.
-- =============================================================

-- 1. Corrigir is_admin() para usar os papéis canônicos
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin_estrategico', 'admin_operacional')
      and p.active = true
  );
$$;

-- 2. Corrigir/criar a função is_internal_user() usada em algumas policies
create or replace function public.is_internal_user()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in (
        'admin_estrategico',
        'admin_operacional',
        'gestor',
        'social_media',
        'equipe'
      )
      and p.active = true
  );
$$;

-- 3. Recriar policies de profiles com os papéis corretos
-- (drop seguro — recria logo abaixo)
drop policy if exists "profiles_select"        on public.profiles;
drop policy if exists "profiles_select_own"    on public.profiles;
drop policy if exists "profiles_insert"        on public.profiles;
drop policy if exists "profiles_insert_own"    on public.profiles;
drop policy if exists "profiles_update"        on public.profiles;
drop policy if exists "profiles_update_own"    on public.profiles;

-- SELECT: usuário vê o próprio perfil; admin vê todos
create policy "profiles_select_own"
  on public.profiles
  for select
  to authenticated
  using (id = auth.uid());

create policy "profiles_select_admin"
  on public.profiles
  for select
  to authenticated
  using (public.is_admin());

-- INSERT: apenas o próprio usuário (on signup) ou admin (via service role / Edge Function)
create policy "profiles_insert_own"
  on public.profiles
  for insert
  to authenticated
  with check (id = auth.uid());

-- UPDATE: usuário edita o próprio; admin edita qualquer um
create policy "profiles_update_own"
  on public.profiles
  for update
  to authenticated
  using  (id = auth.uid())
  with check (id = auth.uid());

create policy "profiles_update_admin"
  on public.profiles
  for update
  to authenticated
  using  (public.is_admin())
  with check (public.is_admin());

-- 4. Corrigir policy de login_jokes que também usa role='admin'
drop policy if exists "Gestão total admin"        on public.login_jokes;
drop policy if exists "Permitir gestão para admins" on public.login_jokes;

create policy "login_jokes_admin"
  on public.login_jokes
  for all
  to authenticated
  using  (public.is_admin())
  with check (public.is_admin());
