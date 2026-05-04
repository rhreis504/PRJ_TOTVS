-- Rossi Supermercados PMO - Initial relational schema for Supabase/PostgreSQL
create extension if not exists pgcrypto;

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  code text unique,
  name text not null,
  client_name text,
  manager_totvs text,
  manager_client text,
  planned_progress numeric(5,2) default 0,
  actual_progress numeric(5,2) default 0,
  status text default 'ativo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.spreadsheet_sources (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  source_type text not null check (source_type in ('geral','pendencias','riscos','gaps','atividades','treinamentos')),
  source_url text not null,
  is_active boolean not null default true,
  last_sync_at timestamptz,
  created_at timestamptz not null default now(),
  unique(project_id, source_type)
);

create table if not exists public.issues (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  external_id text,
  area text,
  category text,
  stage text,
  sprint text,
  activity text,
  description text not null,
  owner text,
  client_owner text,
  criticality text,
  identified_at date,
  planned_at date,
  completed_at date,
  completion_pct numeric(5,2) default 0,
  status text not null default 'aberta',
  condition text,
  source_row_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id, external_id)
);

create table if not exists public.risks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  external_id text,
  identified_at date,
  process text,
  owner text,
  status text,
  probability int check (probability between 1 and 5),
  impact int check (impact between 1 and 5),
  exposure int generated always as (coalesce(probability,0) * coalesce(impact,0)) stored,
  strategy text,
  mitigation_plan text,
  contingency_plan text,
  trigger_event text,
  category text,
  description text not null,
  life_cycle_status text,
  analysis_status text,
  source_row_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id, external_id)
);

create table if not exists public.gaps (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  external_id text,
  description text not null,
  impact text,
  estimate text,
  action text,
  owner text,
  status text,
  due_date date,
  source_row_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id, external_id)
);

create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  period text check (period in ('passado','atual','futuro')),
  description text not null,
  owner text,
  status text,
  reference_date date,
  source_row_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.import_jobs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  source_id uuid references public.spreadsheet_sources(id) on delete set null,
  source_type text,
  status text not null check (status in ('running','success','failed')),
  rows_read int default 0,
  rows_upserted int default 0,
  error_message text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create index if not exists idx_issues_project_status on public.issues(project_id, status);
create index if not exists idx_risks_project_exposure on public.risks(project_id, exposure desc);
create index if not exists idx_gaps_project_status on public.gaps(project_id, status);
create index if not exists idx_activities_project_period on public.activities(project_id, period);

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_projects_updated on public.projects;
drop trigger if exists trg_issues_updated on public.issues;
drop trigger if exists trg_risks_updated on public.risks;
drop trigger if exists trg_gaps_updated on public.gaps;
drop trigger if exists trg_activities_updated on public.activities;

create trigger trg_projects_updated before update on public.projects for each row execute function public.touch_updated_at();
create trigger trg_issues_updated before update on public.issues for each row execute function public.touch_updated_at();
create trigger trg_risks_updated before update on public.risks for each row execute function public.touch_updated_at();
create trigger trg_gaps_updated before update on public.gaps for each row execute function public.touch_updated_at();
create trigger trg_activities_updated before update on public.activities for each row execute function public.touch_updated_at();

create or replace view public.v_project_health as
select
  p.id as project_id,
  p.name as project_name,
  p.actual_progress,
  p.planned_progress,
  count(i.*) filter (where i.status not in ('concluida','fechada')) as open_issues,
  count(r.*) filter (where r.life_cycle_status not in ('encerrado','fechado')) as open_risks,
  coalesce(max(r.exposure),0) as max_risk_exposure,
  count(g.*) filter (where g.status not in ('concluido','fechado')) as open_gaps
from public.projects p
left join public.issues i on i.project_id = p.id
left join public.risks r on r.project_id = p.id
left join public.gaps g on g.project_id = p.id
group by p.id;
