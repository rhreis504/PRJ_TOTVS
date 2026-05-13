-- Suporte incremental para o grid operacional de cronograma (ScheduleProjectGrid).
-- Mantém schedule_activities como fonte principal para não duplicar tabelas já existentes.

alter table public.schedule_activities
  add column if not exists parent_id uuid references public.schedule_activities(id) on delete set null,
  add column if not exists row_number integer,
  add column if not exists outline_level integer not null default 0,
  add column if not exists wbs_code text,
  add column if not exists task_mode text not null default 'auto',
  add column if not exists task_name text,
  add column if not exists task_type text,
  add column if not exists duration_value numeric(10,2),
  add column if not exists duration_unit text default 'd',
  add column if not exists predecessors_text text,
  add column if not exists deliverable_or_milestone text,
  add column if not exists percent_complete numeric(5,2),
  add column if not exists resource_names text,
  add column if not exists is_summary boolean not null default false,
  add column if not exists is_expanded boolean not null default true;

update public.schedule_activities
set
  row_number = coalesce(row_number, ordered.rn),
  wbs_code = coalesce(wbs_code, activity_code, ordered.rn::text),
  task_name = coalesce(task_name, name),
  task_type = coalesce(task_type, activity_type),
  duration_value = coalesce(duration_value, duration_days),
  duration_unit = coalesce(duration_unit, 'd'),
  percent_complete = coalesce(percent_complete, progress_percent, 0)
from (
  select id, row_number() over (partition by schedule_id order by planned_start_date nulls last, created_at, id) as rn
  from public.schedule_activities
) ordered
where public.schedule_activities.id = ordered.id;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'schedule_activities_task_mode_chk'
  ) then
    alter table public.schedule_activities
      add constraint schedule_activities_task_mode_chk check (task_mode in ('auto','manual'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'schedule_activities_outline_level_chk'
  ) then
    alter table public.schedule_activities
      add constraint schedule_activities_outline_level_chk check (outline_level >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'schedule_activities_percent_complete_chk'
  ) then
    alter table public.schedule_activities
      add constraint schedule_activities_percent_complete_chk check (percent_complete is null or (percent_complete >= 0 and percent_complete <= 100));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'schedule_activities_duration_unit_chk'
  ) then
    alter table public.schedule_activities
      add constraint schedule_activities_duration_unit_chk check (duration_unit is null or duration_unit in ('d','h','w'));
  end if;
end $$;

create index if not exists idx_schedule_activities_parent_id on public.schedule_activities(parent_id);
create index if not exists idx_schedule_activities_grid_order on public.schedule_activities(schedule_id, row_number);
create index if not exists idx_schedule_activities_wbs_code on public.schedule_activities(schedule_id, wbs_code);
