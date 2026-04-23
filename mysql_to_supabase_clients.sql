-- Migração MySQL -> Supabase (clientes + fotos + site principal)
-- Gerado automaticamente em 2026-04-01 16:18:00
-- Fonte MySQL: clients

alter table public.clients
  add column if not exists is_free_or_trade boolean not null default false,
  add column if not exists generate_drive_folder boolean not null default true,
  add column if not exists one_time_payment boolean not null default false,
  add column if not exists logo_url text,
  add column if not exists site_url text,
  add column if not exists site_description text,
  add column if not exists display_order integer not null default 0,
  add column if not exists is_visible_site boolean not null default true,
  add column if not exists is_featured_site boolean not null default false,
  add column if not exists testimonial_content text,
  add column if not exists testimonial_author_name text,
  add column if not exists testimonial_author_role text,
  add column if not exists testimonial_author_avatar text,
  add column if not exists testimonial_rating integer not null default 5,
  add column if not exists testimonial_display_order integer not null default 0,
  add column if not exists is_testimonial_visible boolean not null default false;

with owner_row as (
  select id
  from public.profiles
  where active = true
  order by case when role = 'admin' then 0 else 1 end, created_at asc
  limit 1
),
legacy_mysql (legacy_id, company_name, whatsapp, strategic_plan, is_free_or_trade, legacy_status, legacy_created_at, logo_url, site_url, site_description, display_order, is_visible_site, is_featured_site) as (
  values
  (1, 'Osaka', NULL, NULL, true, 'active', '2026-03-18 10:51:37', '/uploads/clientes/osaka.png', NULL, NULL, 1, true, false),
  (2, 'Hipermais', NULL, NULL, true, 'active', '2026-03-18 10:51:37', '/uploads/clientes/hipermais.png', NULL, NULL, 2, true, false),
  (3, 'Atacado Joinville', NULL, NULL, true, 'active', '2026-03-18 10:51:37', '/uploads/clientes/atacadojoinville.png', NULL, NULL, 3, true, false),
  (4, 'Condor', NULL, NULL, true, 'active', '2026-03-18 10:51:37', '/uploads/clientes/condor.png', NULL, NULL, 4, true, false),
  (5, 'CRN3', NULL, NULL, true, 'active', '2026-03-18 10:51:37', '/uploads/clientes/crn3.png', NULL, NULL, 5, true, false),
  (6, 'Entre Clínica', NULL, NULL, true, 'active', '2026-03-18 10:51:37', '/uploads/clientes/entre.png', 'http://entreclinica.com/', NULL, 6, true, false),
  (7, 'Fortalecendo Competências', NULL, NULL, true, 'active', '2026-03-18 10:51:37', '/uploads/clientes/fortalecendo-competencias.png', NULL, NULL, 7, true, false),
  (8, 'Infraero', NULL, NULL, true, 'active', '2026-03-18 10:51:37', '/uploads/clientes/infraero.png', NULL, 'teste', 8, true, false),
  (9, 'Cantina Artesanat', NULL, NULL, true, 'active', '2026-03-18 10:51:37', '/uploads/clientes/cantina-artesanat.png', NULL, NULL, 9, true, false),
  (10, 'Prorim', NULL, NULL, true, 'active', '2026-03-18 10:51:37', '/uploads/clientes/prorim.png', NULL, NULL, 10, true, false),
  (11, 'Shop', NULL, NULL, true, 'active', '2026-03-18 10:51:37', '/uploads/clientes/shop.png', NULL, NULL, 11, true, false),
  (14, 'Eve Festas', '47 98422-5275', 'META ADS + Criativo', false, 'active', '2026-03-18 21:23:33', NULL, 'https://www.instagram.com/eve.festas.oficial/', NULL, 1, true, true),
  (25, 'Instituo Berggasse de Psicanálise', NULL, 'Criação de Briefing', false, 'active', '2026-03-19 13:02:53', NULL, NULL, NULL, 0, true, false)
),
normalized as (
  select
    uuid_generate_v5('00000000-0000-0000-0000-000000000000', 'mysql-client-' || l.legacy_id::text) as id,
    o.id as owner_id,
    l.company_name as name,
    format('cliente-%s@cromia.local', l.legacy_id) as email,
    nullif(l.whatsapp, '') as phone,
    l.company_name as company,
    case
      when l.legacy_status in ('lead','pending','active','inactive','lost') then l.legacy_status
      else 'active'
    end as status,
    coalesce(nullif(l.strategic_plan, ''), 'Performance Pro') as plan,
    l.is_free_or_trade,
    true::boolean as generate_drive_folder,
    false::boolean as one_time_payment,
    l.logo_url,
    nullif(l.site_url, '') as site_url,
    nullif(l.site_description, '') as site_description,
    null::text as testimonial_content,
    null::text as testimonial_author_name,
    null::text as testimonial_author_role,
    null::text as testimonial_author_avatar,
    5::integer as testimonial_rating,
    0::integer as testimonial_display_order,
    false::boolean as is_testimonial_visible,
    concat('Migrado do MySQL (clients.id=', l.legacy_id::text, ').') as notes,
    greatest(coalesce(l.display_order, 0), 0) as display_order,
    l.is_visible_site,
    l.is_featured_site,
    coalesce((l.legacy_created_at::timestamp at time zone 'America/Sao_Paulo'), now()) as created_at
  from legacy_mysql l
  cross join owner_row o
)
insert into public.clients (
  id, owner_id, name, email, phone, company, status, plan, is_free_or_trade, generate_drive_folder, one_time_payment, logo_url, site_url, site_description, testimonial_content, testimonial_author_name, testimonial_author_role, testimonial_author_avatar, testimonial_rating, testimonial_display_order, is_testimonial_visible, notes, display_order, is_visible_site, is_featured_site, portal_active, created_at, updated_at
)
select
  n.id, n.owner_id, n.name, n.email, n.phone, n.company, n.status, n.plan, n.is_free_or_trade, n.generate_drive_folder, n.one_time_payment, n.logo_url, n.site_url, n.site_description, n.testimonial_content, n.testimonial_author_name, n.testimonial_author_role, n.testimonial_author_avatar, n.testimonial_rating, n.testimonial_display_order, n.is_testimonial_visible, n.notes, n.display_order, n.is_visible_site, n.is_featured_site, true, n.created_at, now()
from normalized n
on conflict (id) do update
set
  name = excluded.name,
  email = excluded.email,
  phone = excluded.phone,
  company = excluded.company,
  status = excluded.status,
  plan = excluded.plan,
  is_free_or_trade = excluded.is_free_or_trade,
  generate_drive_folder = excluded.generate_drive_folder,
  one_time_payment = excluded.one_time_payment,
  logo_url = excluded.logo_url,
  site_url = excluded.site_url,
  site_description = excluded.site_description,
  testimonial_content = excluded.testimonial_content,
  testimonial_author_name = excluded.testimonial_author_name,
  testimonial_author_role = excluded.testimonial_author_role,
  testimonial_author_avatar = excluded.testimonial_author_avatar,
  testimonial_rating = excluded.testimonial_rating,
  testimonial_display_order = excluded.testimonial_display_order,
  is_testimonial_visible = excluded.is_testimonial_visible,
  notes = excluded.notes,
  display_order = excluded.display_order,
  is_visible_site = excluded.is_visible_site,
  is_featured_site = excluded.is_featured_site,
  updated_at = now();
