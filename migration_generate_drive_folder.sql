-- Adiciona controle independente para geração/uso de pasta no Drive
-- Executar no SQL Editor do Supabase (base atual)

alter table public.clients
  add column if not exists generate_drive_folder boolean not null default true;

-- Preserva o comportamento antigo para clientes free sem pasta existente,
-- mas mantém ativo para quem já possui pasta no Drive.
update public.clients
set generate_drive_folder = case
  when drive_folder_id is not null then true
  when is_free_or_trade = true then false
  else true
end;
