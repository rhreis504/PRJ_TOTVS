-- Remove duplicidades históricas e protege as tabelas sincronizadas contra novas duplicações.
-- Issues: cada pendência do CSV deve existir uma única vez por projeto/external_id.
-- Source rows: cada linha lida da origem deve existir uma única vez por projeto/fonte/linha.

alter table public.source_rows add column if not exists source_row_number integer;
alter table public.source_rows add column if not exists row_hash text;

update public.source_rows
set row_hash = md5(row_data::text)
where row_hash is null;

update public.issues
set external_id = null
where external_id is not null
  and btrim(external_id) = '';

with duplicated_issues as (
  select
    id,
    row_number() over (
      partition by project_id, external_id
      order by updated_at desc nulls last, created_at desc nulls last, id desc
    ) as rn
  from public.issues
  where external_id is not null
    and btrim(external_id) <> ''
)
delete from public.issues i
using duplicated_issues d
where i.id = d.id
  and d.rn > 1;

with duplicated_source_rows as (
  select
    id,
    row_number() over (
      partition by project_id, source_type, coalesce(source_row_number, -1), coalesce(row_hash, md5(row_data::text))
      order by created_at desc nulls last, id desc
    ) as rn
  from public.source_rows
)
delete from public.source_rows sr
using duplicated_source_rows d
where sr.id = d.id
  and d.rn > 1;

create unique index if not exists ux_issues_project_external_id
  on public.issues(project_id, external_id);

create unique index if not exists ux_source_rows_project_source_line_hash
  on public.source_rows(project_id, source_type, coalesce(source_row_number, -1), coalesce(row_hash, md5(row_data::text)));
