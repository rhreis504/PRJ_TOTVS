-- Permite que o cockpit grave automaticamente as origens lidas pelo navegador
-- quando a credencial disponível for publishable/anon.
-- Sem estas políticas, o clique em "Salvar Configurações" consegue ler o CSV,
-- mas os INSERT/DELETE em source_rows/issues/tap_entries podem falhar com 42501.

-- Grants REST para o papel anon usado pelas chaves publishable/anon.
grant insert, update, delete on public.projects to anon;
grant insert, update, delete on public.source_rows to anon;
grant insert, update, delete on public.tap_entries to anon;
grant insert, update, delete on public.issues to anon;

-- Policies de escrita usadas exclusivamente pelas chamadas REST do dashboard.
do $$ begin
  create policy "anon_write_projects" on public.projects for all to anon using (true) with check (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "anon_write_source_rows" on public.source_rows for all to anon using (true) with check (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "anon_write_tap_entries" on public.tap_entries for all to anon using (true) with check (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "anon_write_issues" on public.issues for all to anon using (true) with check (true);
exception when duplicate_object then null; end $$;
