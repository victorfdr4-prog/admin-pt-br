alter table public.profiles
  add column if not exists signature_role text,
  add column if not exists bio_hook text not null default '',
  add column if not exists phone_display text,
  add column if not exists linkedin_url text,
  add column if not exists signature_html text;

update public.profiles
set
  bio_hook = coalesce(bio_hook, ''),
  phone_display = coalesce(phone_display, phone)
where true;
