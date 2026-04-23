-- Adiciona controle de pagamento único
-- Executar no SQL Editor do Supabase (base atual)

alter table public.clients
  add column if not exists one_time_payment boolean not null default false;

-- Mantém todos como recorrentes por padrão.
-- Ajuste manualmente para true apenas nos clientes de pagamento único.
update public.clients
set one_time_payment = coalesce(one_time_payment, false);
