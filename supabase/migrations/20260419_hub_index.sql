create index if not exists idx_pci_client_date
  on posting_calendar_items (client_id, post_date)
  where deleted_at is null and is_current_version = true;

create index if not exists idx_pci_workflow_client
  on posting_calendar_items (client_id, workflow_status)
  where deleted_at is null and is_current_version = true;
