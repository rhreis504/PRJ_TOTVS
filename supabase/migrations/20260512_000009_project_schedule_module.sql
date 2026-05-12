-- Project Schedule / Cronograma do Projeto module
create extension if not exists pgcrypto;

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  document_number text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  code text unique,
  name text not null,
  client_id uuid references public.clients(id) on delete set null,
  client_name text,
  description text,
  project_code text,
  sponsor_name text,
  project_manager_name text,
  manager_totvs text,
  manager_client text,
  planned_progress numeric(5,2) default 0,
  actual_progress numeric(5,2) default 0,
  status text not null default 'active',
  start_date date,
  end_date date,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.projects add column if not exists client_id uuid references public.clients(id) on delete set null;
alter table public.projects add column if not exists description text;
alter table public.projects add column if not exists project_code text;
alter table public.projects add column if not exists sponsor_name text;
alter table public.projects add column if not exists project_manager_name text;
alter table public.projects add column if not exists start_date date;
alter table public.projects add column if not exists end_date date;
alter table public.projects add column if not exists created_by uuid;
update public.projects set project_code = coalesce(project_code, code) where project_code is null;
update public.projects set project_manager_name = coalesce(project_manager_name, manager_totvs, manager_client) where project_manager_name is null;

create table if not exists public.project_schedules (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  description text,
  schedule_status text not null default 'draft',
  version text,
  default_calendar_id uuid,
  current_baseline_id uuid,
  planned_start_date date,
  planned_finish_date date,
  actual_start_date date,
  actual_finish_date date,
  progress_percent numeric(5,2) default 0,
  health_status text default 'not_evaluated',
  created_by uuid,
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_schedules_status_chk check (schedule_status in ('draft','under_review','approved','in_execution','replanned','closed','cancelled')),
  constraint project_schedules_health_chk check (health_status in ('not_evaluated','on_track','attention','critical')),
  constraint project_schedules_progress_chk check (progress_percent >= 0 and progress_percent <= 100)
);

create table if not exists public.schedule_calendars (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  schedule_id uuid references public.project_schedules(id) on delete cascade,
  name text not null,
  description text,
  is_default boolean default false,
  working_days jsonb not null default '{"monday":true,"tuesday":true,"wednesday":true,"thursday":true,"friday":true,"saturday":false,"sunday":false}'::jsonb,
  working_hours jsonb not null default '{"start":"08:00","end":"17:00","lunch_start":"12:00","lunch_end":"13:00"}'::jsonb,
  hours_per_day numeric(5,2) default 8,
  timezone text default 'America/Sao_Paulo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.schedule_calendar_exceptions (
  id uuid primary key default gen_random_uuid(),
  calendar_id uuid not null references public.schedule_calendars(id) on delete cascade,
  exception_date date not null,
  name text not null,
  exception_type text not null default 'non_working_day',
  is_working_day boolean default false,
  working_hours jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint schedule_calendar_exceptions_type_chk check (exception_type in ('holiday','non_working_day','special_working_day','reduced_hours'))
);

create table if not exists public.schedule_wbs_items (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.project_schedules(id) on delete cascade,
  parent_id uuid references public.schedule_wbs_items(id) on delete cascade,
  wbs_code text not null,
  name text not null,
  description text,
  item_type text not null default 'work_package',
  sort_order integer default 0,
  responsible_name text,
  acceptance_criteria text,
  deliverable_description text,
  assumptions text,
  constraints text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint schedule_wbs_items_type_chk check (item_type in ('phase','deliverable','work_package'))
);

create table if not exists public.schedule_activities (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.project_schedules(id) on delete cascade,
  wbs_item_id uuid references public.schedule_wbs_items(id) on delete set null,
  activity_code text,
  name text not null,
  description text,
  activity_type text not null default 'task',
  status text not null default 'not_started',
  priority text default 'medium',
  responsible_name text,
  responsible_user_id uuid,
  calendar_id uuid references public.schedule_calendars(id) on delete set null,
  planned_start_date date,
  planned_finish_date date,
  actual_start_date date,
  actual_finish_date date,
  duration_days numeric(8,2),
  planned_work_hours numeric(10,2),
  actual_work_hours numeric(10,2),
  progress_percent numeric(5,2) default 0,
  is_milestone boolean default false,
  is_critical boolean default false,
  total_float_days numeric(8,2),
  free_float_days numeric(8,2),
  constraint_type text,
  constraint_date date,
  acceptance_criteria text,
  notes text,
  agf_gate text,
  agf_stage text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint schedule_activities_type_chk check (activity_type in ('task','milestone','meeting','approval','validation','external_dependency','deliverable')),
  constraint schedule_activities_status_chk check (status in ('not_started','in_progress','in_validation','blocked','completed','cancelled')),
  constraint schedule_activities_priority_chk check (priority in ('low','medium','high','critical')),
  constraint schedule_activities_constraint_type_chk check (constraint_type is null or constraint_type in ('as_soon_as_possible','start_no_earlier_than','finish_no_later_than','must_start_on','must_finish_on')),
  constraint schedule_activities_progress_chk check (progress_percent >= 0 and progress_percent <= 100),
  constraint schedule_activities_milestone_duration_chk check (is_milestone = false or duration_days is null or duration_days = 0)
);

create table if not exists public.schedule_activity_dependencies (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.project_schedules(id) on delete cascade,
  predecessor_activity_id uuid not null references public.schedule_activities(id) on delete cascade,
  successor_activity_id uuid not null references public.schedule_activities(id) on delete cascade,
  dependency_type text not null default 'FS',
  lag_days numeric(8,2) default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint schedule_activity_dependencies_type_chk check (dependency_type in ('FS','SS','FF','SF')),
  constraint schedule_activity_dependencies_no_self_chk check (predecessor_activity_id <> successor_activity_id),
  unique(predecessor_activity_id, successor_activity_id, dependency_type)
);

create table if not exists public.schedule_baselines (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.project_schedules(id) on delete cascade,
  baseline_name text not null,
  baseline_version integer not null default 0,
  description text,
  reason text,
  status text not null default 'active',
  created_by uuid,
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint schedule_baselines_status_chk check (status in ('active','superseded','cancelled')),
  unique(schedule_id, baseline_version)
);

create table if not exists public.schedule_baseline_items (
  id uuid primary key default gen_random_uuid(),
  baseline_id uuid not null references public.schedule_baselines(id) on delete cascade,
  schedule_id uuid not null references public.project_schedules(id) on delete cascade,
  activity_id uuid not null references public.schedule_activities(id) on delete cascade,
  wbs_item_id uuid,
  activity_code text,
  activity_name text not null,
  baseline_start_date date,
  baseline_finish_date date,
  baseline_duration_days numeric(8,2),
  baseline_work_hours numeric(10,2),
  baseline_responsible_name text,
  baseline_progress_percent numeric(5,2) default 0,
  created_at timestamptz not null default now(),
  constraint schedule_baseline_items_progress_chk check (baseline_progress_percent >= 0 and baseline_progress_percent <= 100)
);

create table if not exists public.schedule_resources (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  schedule_id uuid references public.project_schedules(id) on delete cascade,
  name text not null,
  role text,
  resource_type text default 'internal',
  email text,
  calendar_id uuid references public.schedule_calendars(id) on delete set null,
  weekly_capacity_hours numeric(10,2) default 40,
  hourly_cost numeric(12,2),
  is_active boolean default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint schedule_resources_type_chk check (resource_type in ('internal','client','partner','supplier','external'))
);

create table if not exists public.schedule_activity_assignments (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.project_schedules(id) on delete cascade,
  activity_id uuid not null references public.schedule_activities(id) on delete cascade,
  resource_id uuid not null references public.schedule_resources(id) on delete cascade,
  allocation_percent numeric(5,2) default 100,
  planned_work_hours numeric(10,2),
  actual_work_hours numeric(10,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint schedule_activity_assignments_alloc_chk check (allocation_percent >= 0 and allocation_percent <= 100),
  unique(activity_id, resource_id)
);

create table if not exists public.schedule_change_requests (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.project_schedules(id) on delete cascade,
  title text not null,
  description text,
  change_reason text,
  impact_scope text,
  impact_schedule text,
  impact_cost text,
  impact_resources text,
  status text not null default 'draft',
  requested_by uuid,
  approved_by uuid,
  approved_at timestamptz,
  rejected_reason text,
  creates_new_baseline boolean default false,
  created_baseline_id uuid references public.schedule_baselines(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint schedule_change_requests_status_chk check (status in ('draft','submitted','approved','rejected','cancelled','implemented'))
);

create table if not exists public.schedule_audit_log (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.project_schedules(id) on delete cascade,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  field_name text,
  old_value text,
  new_value text,
  changed_by uuid,
  change_reason text,
  created_at timestamptz not null default now(),
  constraint schedule_audit_log_entity_chk check (entity_type in ('schedule','wbs','activity','dependency','baseline','calendar','resource','assignment','change_request')),
  constraint schedule_audit_log_action_chk check (action in ('created','updated','deleted','baseline_created','approved','status_changed'))
);

alter table public.project_schedules drop constraint if exists project_schedules_default_calendar_fk;
alter table public.project_schedules add constraint project_schedules_default_calendar_fk foreign key (default_calendar_id) references public.schedule_calendars(id) on delete set null;
alter table public.project_schedules drop constraint if exists project_schedules_current_baseline_fk;
alter table public.project_schedules add constraint project_schedules_current_baseline_fk foreign key (current_baseline_id) references public.schedule_baselines(id) on delete set null;

create index if not exists idx_project_schedules_project_id on public.project_schedules(project_id);
create index if not exists idx_schedule_wbs_items_schedule_id on public.schedule_wbs_items(schedule_id);
create index if not exists idx_schedule_wbs_items_parent_id on public.schedule_wbs_items(parent_id);
create index if not exists idx_schedule_activities_schedule_id on public.schedule_activities(schedule_id);
create index if not exists idx_schedule_activities_wbs_item_id on public.schedule_activities(wbs_item_id);
create index if not exists idx_schedule_activities_status on public.schedule_activities(status);
create index if not exists idx_schedule_activities_responsible_user_id on public.schedule_activities(responsible_user_id);
create index if not exists idx_schedule_activity_dependencies_schedule_id on public.schedule_activity_dependencies(schedule_id);
create index if not exists idx_schedule_activity_dependencies_predecessor on public.schedule_activity_dependencies(predecessor_activity_id);
create index if not exists idx_schedule_activity_dependencies_successor on public.schedule_activity_dependencies(successor_activity_id);
create index if not exists idx_schedule_baselines_schedule_id on public.schedule_baselines(schedule_id);
create index if not exists idx_schedule_baseline_items_baseline_id on public.schedule_baseline_items(baseline_id);
create index if not exists idx_schedule_baseline_items_activity_id on public.schedule_baseline_items(activity_id);
create index if not exists idx_schedule_resources_project_id on public.schedule_resources(project_id);
create index if not exists idx_schedule_activity_assignments_activity_id on public.schedule_activity_assignments(activity_id);
create index if not exists idx_schedule_audit_log_schedule_id on public.schedule_audit_log(schedule_id);

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['clients','project_schedules','schedule_calendars','schedule_calendar_exceptions','schedule_wbs_items','schedule_activities','schedule_activity_dependencies','schedule_baselines','schedule_resources','schedule_activity_assignments','schedule_change_requests'] loop
    execute format('drop trigger if exists trg_%s_updated on public.%I', t, t);
    execute format('create trigger trg_%s_updated before update on public.%I for each row execute function public.touch_updated_at()', t, t);
  end loop;
end $$;

create or replace function public.prevent_schedule_dependency_cycle() returns trigger language plpgsql as $$
declare has_cycle boolean;
begin
  with recursive dependency_path(activity_id) as (
    select new.successor_activity_id
    union
    select sad.successor_activity_id
    from public.schedule_activity_dependencies sad
    join dependency_path dp on sad.predecessor_activity_id = dp.activity_id
    where sad.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  select exists(select 1 from dependency_path where activity_id = new.predecessor_activity_id) into has_cycle;
  if has_cycle then
    raise exception 'Dependência circular não permitida no cronograma';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_schedule_dependency_cycle on public.schedule_activity_dependencies;
create trigger trg_schedule_dependency_cycle before insert or update on public.schedule_activity_dependencies for each row execute function public.prevent_schedule_dependency_cycle();

create or replace function public.calculate_schedule_progress(p_schedule_id uuid) returns numeric language sql stable as $$
  select coalesce(round(avg(progress_percent)::numeric, 2), 0)
  from public.schedule_activities
  where schedule_id = p_schedule_id and status <> 'cancelled';
$$;

create or replace function public.create_schedule_baseline(p_schedule_id uuid, p_baseline_name text, p_reason text default null, p_description text default null) returns uuid language plpgsql security definer as $$
declare
  v_baseline_id uuid;
  v_version integer;
begin
  select coalesce(max(baseline_version), -1) + 1 into v_version from public.schedule_baselines where schedule_id = p_schedule_id;

  insert into public.schedule_baselines(schedule_id, baseline_name, baseline_version, reason, description, status, created_by)
  values (p_schedule_id, p_baseline_name, v_version, p_reason, p_description, 'active', auth.uid())
  returning id into v_baseline_id;

  insert into public.schedule_baseline_items(
    baseline_id, schedule_id, activity_id, wbs_item_id, activity_code, activity_name,
    baseline_start_date, baseline_finish_date, baseline_duration_days, baseline_work_hours,
    baseline_responsible_name, baseline_progress_percent
  )
  select v_baseline_id, schedule_id, id, wbs_item_id, activity_code, name,
         planned_start_date, planned_finish_date, duration_days, planned_work_hours,
         responsible_name, progress_percent
  from public.schedule_activities
  where schedule_id = p_schedule_id;

  update public.project_schedules set current_baseline_id = v_baseline_id, updated_at = now() where id = p_schedule_id;

  insert into public.schedule_audit_log(schedule_id, entity_type, entity_id, action, new_value, changed_by, change_reason)
  values (p_schedule_id, 'baseline', v_baseline_id, 'baseline_created', p_baseline_name, auth.uid(), p_reason);

  return v_baseline_id;
end;
$$;

create or replace view public.v_schedule_late_activities as
select *
from public.schedule_activities
where planned_finish_date < current_date and status <> 'completed';

alter table public.clients enable row level security;
alter table public.project_schedules enable row level security;
alter table public.schedule_calendars enable row level security;
alter table public.schedule_calendar_exceptions enable row level security;
alter table public.schedule_wbs_items enable row level security;
alter table public.schedule_activities enable row level security;
alter table public.schedule_activity_dependencies enable row level security;
alter table public.schedule_baselines enable row level security;
alter table public.schedule_baseline_items enable row level security;
alter table public.schedule_resources enable row level security;
alter table public.schedule_activity_assignments enable row level security;
alter table public.schedule_change_requests enable row level security;
alter table public.schedule_audit_log enable row level security;

do $$
declare t text;
begin
  foreach t in array array['clients','project_schedules','schedule_calendars','schedule_calendar_exceptions','schedule_wbs_items','schedule_activities','schedule_activity_dependencies','schedule_baselines','schedule_baseline_items','schedule_resources','schedule_activity_assignments','schedule_change_requests','schedule_audit_log'] loop
    begin
      execute format('create policy %I on public.%I for all to authenticated using (true) with check (true)', 'authenticated_full_' || t, t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

do $$
declare t text;
begin
  foreach t in array array['clients','project_schedules','schedule_calendars','schedule_calendar_exceptions','schedule_wbs_items','schedule_activities','schedule_activity_dependencies','schedule_baselines','schedule_baseline_items','schedule_resources','schedule_activity_assignments','schedule_change_requests','schedule_audit_log'] loop
    begin
      execute format('create policy %I on public.%I for all to anon using (true) with check (true)', 'anon_full_' || t, t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.clients, public.project_schedules, public.schedule_calendars, public.schedule_calendar_exceptions, public.schedule_wbs_items, public.schedule_activities, public.schedule_activity_dependencies, public.schedule_baselines, public.schedule_baseline_items, public.schedule_resources, public.schedule_activity_assignments, public.schedule_change_requests, public.schedule_audit_log to anon;
grant all on public.clients, public.project_schedules, public.schedule_calendars, public.schedule_calendar_exceptions, public.schedule_wbs_items, public.schedule_activities, public.schedule_activity_dependencies, public.schedule_baselines, public.schedule_baseline_items, public.schedule_resources, public.schedule_activity_assignments, public.schedule_change_requests, public.schedule_audit_log to authenticated;
grant execute on function public.create_schedule_baseline(uuid, text, text, text) to anon, authenticated;
grant execute on function public.calculate_schedule_progress(uuid) to anon, authenticated;
grant select on public.v_schedule_late_activities to anon, authenticated;
