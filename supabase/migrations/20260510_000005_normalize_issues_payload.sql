-- Normaliza public.issues para espelhar a origem de Pendências configurada.
-- Cada linha válida do CSV gera uma issue e preserva o JSON bruto da linha em payload_issue.

alter table public.issues add column if not exists tap_entry_id uuid references public.tap_entries(id) on delete set null;
alter table public.issues add column if not exists tap_entries_project_id text;
alter table public.issues add column if not exists project_linked_name text;
alter table public.issues add column if not exists project_stage text;
alter table public.issues add column if not exists days_to_complete text;
alter table public.issues add column if not exists issue_condition text;
alter table public.issues add column if not exists source_row_number integer;
alter table public.issues add column if not exists payload_issue jsonb;

-- Mantém compatibilidade com o campo histórico stage e condition, mas disponibiliza
-- nomes explícitos iguais ao domínio da planilha de Pendências.
update public.issues
set
  project_stage = coalesce(project_stage, stage),
  issue_condition = coalesce(issue_condition, condition),
  project_linked_name = coalesce(project_linked_name, (
    select p.name from public.projects p where p.id = public.issues.project_id
  ))
where project_stage is null
   or issue_condition is null
   or project_linked_name is null;

create index if not exists idx_issues_project_external_id on public.issues(project_id, external_id);
create index if not exists idx_issues_tap_entry_id on public.issues(tap_entry_id);
create index if not exists idx_issues_payload_issue_gin on public.issues using gin(payload_issue);
create index if not exists idx_issues_source_row_number on public.issues(project_id, source_row_number);
