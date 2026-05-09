-- Allow the browser dashboard to list TAPs with the configured anon/publishable key.
-- The sidebar TAP selector reads public.tap_entries directly to show the TAPs already
-- registered for the project.

do $$ begin
  create policy "anon_read_tap_entries" on public.tap_entries for select to anon using (true);
exception when duplicate_object then null; end $$;

grant select on public.tap_entries to anon;
