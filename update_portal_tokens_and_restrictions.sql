-- Atualização massiva de portais e restrições
-- 1. Atualizar todos os tokens para UUID (mais curtos e padronizados que o hex longo anterior)
UPDATE public.clients
SET portal_token = gen_random_uuid()::text;

-- 2. Desativar portal para clientes "Restritos" (Quiet Clients)
-- Seguindo a regra: is_free_or_trade = true OU one_time_payment = true
UPDATE public.clients
SET portal_active = false
WHERE is_free_or_trade = true OR one_time_payment = true;

-- 3. Garantir que clientes normais tenham portal ativo
UPDATE public.clients
SET portal_active = true
WHERE is_free_or_trade = false AND one_time_payment = false;
