-- API access helpers for dashboard synchronization

-- Ensure RLS does not block service_role / authenticated integrations unexpectedly.
alter table public.projects enable row level security;
alter table public.spreadsheet_sources enable row level security;
alter table public.issues enable row level security;
alter table public.risks enable row level security;
alter table public.gaps enable row level security;
alter table public.activities enable row level security;
alter table public.import_jobs enable row level security;
alter table public.source_rows enable row level security;
alter table public.tap_entries enable row level security;

-- Service role bypasses RLS automatically, but these policies keep behavior explicit
-- and allow authenticated key usage when needed.
do $$ begin
  create policy "authenticated_full_projects" on public.projects for all to authenticated using (true) with check (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "authenticated_full_spreadsheet_sources" on public.spreadsheet_sources for all to authenticated using (true) with check (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "authenticated_full_issues" on public.issues for all to authenticated using (true) with check (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "authenticated_full_risks" on public.risks for all to authenticated using (true) with check (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "authenticated_full_gaps" on public.gaps for all to authenticated using (true) with check (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "authenticated_full_activities" on public.activities for all to authenticated using (true) with check (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "authenticated_full_import_jobs" on public.import_jobs for all to authenticated using (true) with check (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "authenticated_full_source_rows" on public.source_rows for all to authenticated using (true) with check (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "authenticated_full_tap_entries" on public.tap_entries for all to authenticated using (true) with check (true);
exception when duplicate_object then null; end $$;

-- Optional read-only access for anon (public dashboard queries)
do $$ begin
  create policy "anon_read_projects" on public.projects for select to anon using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "anon_read_project_health" on public.issues for select to anon using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "anon_read_risks" on public.risks for select to anon using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "anon_read_gaps" on public.gaps for select to anon using (true);
exception when duplicate_object then null; end $$;

-- Helpful grants for REST roles
grant usage on schema public to anon, authenticated;
grant select on public.projects, public.issues, public.risks, public.gaps, public.v_project_health to anon;
grant all on public.projects, public.spreadsheet_sources, public.issues, public.risks, public.gaps, public.activities, public.import_jobs, public.source_rows, public.tap_entries to authenticated;
