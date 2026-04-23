alter table if exists public.posting_calendar_items
  add column if not exists scheduled_date timestamp with time zone,
  add column if not exists published_at timestamp with time zone;

update public.posting_calendar_items
set workflow_status = 'aguardando_agendamento'
where workflow_status = 'pronto_agendamento';

update public.posting_calendar_items
set scheduled_date = coalesce(scheduled_date, post_date::timestamp with time zone)
where workflow_status in ('agendado', 'publicado')
  and scheduled_date is null
  and post_date is not null;

update public.posting_calendar_items
set published_at = coalesce(published_at, last_transition_at, approved_at, updated_at, created_at, now())
where workflow_status = 'publicado'
  and published_at is null;

alter table if exists public.posting_calendar_items
  drop constraint if exists posting_calendar_items_workflow_status_check;

alter table if exists public.posting_calendar_items
  add constraint posting_calendar_items_workflow_status_check
  check (
    workflow_status = any (
      array[
        'rascunho'::text,
        'revisao_interna'::text,
        'aprovado_interno'::text,
        'em_aprovacao_cliente'::text,
        'revisao_cliente'::text,
        'aprovado_cliente'::text,
        'aguardando_agendamento'::text,
        'agendado'::text,
        'publicado'::text
      ]
    )
  );
