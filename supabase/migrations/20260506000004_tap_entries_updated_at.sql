-- Add update timestamp support for TAP entries.
-- Existing deployments of 20260504_000002_project_sync_and_tap.sql created
-- tap_entries with created_at only; this keeps the table compatible with code
-- paths or reports that expect updated_at to exist.
alter table public.tap_entries
  add column if not exists updated_at timestamptz not null default now();

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_tap_entries_updated on public.tap_entries;
create trigger trg_tap_entries_updated
  before update on public.tap_entries
  for each row execute function public.touch_updated_at();
