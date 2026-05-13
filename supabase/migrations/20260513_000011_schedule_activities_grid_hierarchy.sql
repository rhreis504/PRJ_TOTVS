-- Ajustes seguros para consolidar schedule_activities como fonte do grid de cronograma.
-- Não remove dados existentes; apenas garante defaults, índices e parent_id hierárquico.

alter table public.schedule_activities
  add column if not exists parent_id uuid references public.schedule_activities(id) on delete cascade,
  add column if not exists row_number integer,
  add column if not exists outline_level integer default 0,
  add column if not exists wbs_code text,
  add column if not exists task_mode text default 'auto',
  add column if not exists task_name text,
  add column if not exists task_type text default 'task',
  add column if not exists duration_value numeric(10,2),
  add column if not exists duration_unit text default 'd',
  add column if not exists predecessors_text text,
  add column if not exists deliverable_or_milestone text,
  add column if not exists percent_complete numeric(5,2) default 0,
  add column if not exists resource_names text,
  add column if not exists is_summary boolean default false,
  add column if not exists is_expanded boolean default true;

alter table public.schedule_activities
  alter column outline_level set default 0,
  alter column task_mode set default 'auto',
  alter column task_type set default 'task',
  alter column duration_unit set default 'd',
  alter column percent_complete set default 0,
  alter column is_summary set default false,
  alter column is_expanded set default true;

update public.schedule_activities
set
  outline_level = coalesce(outline_level, 0),
  task_mode = coalesce(task_mode, 'auto'),
  task_name = coalesce(task_name, name),
  task_type = coalesce(task_type, activity_type, 'task'),
  duration_value = coalesce(duration_value, duration_days),
  duration_unit = coalesce(duration_unit, 'd'),
  percent_complete = coalesce(percent_complete, progress_percent, 0),
  is_summary = coalesce(is_summary, false),
  is_expanded = coalesce(is_expanded, true)
where outline_level is null
   or task_mode is null
   or task_name is null
   or task_type is null
   or duration_unit is null
   or percent_complete is null
   or is_summary is null
   or is_expanded is null;

do $$
declare
  parent_fk_name text;
begin
  select conname into parent_fk_name
  from pg_constraint
  where conrelid = 'public.schedule_activities'::regclass
    and contype = 'f'
    and conkey = array[(select attnum from pg_attribute where attrelid = 'public.schedule_activities'::regclass and attname = 'parent_id')]
  limit 1;

  if parent_fk_name is not null then
    execute format('alter table public.schedule_activities drop constraint %I', parent_fk_name);
  end if;

  alter table public.schedule_activities
    add constraint schedule_activities_parent_id_fkey
    foreign key (parent_id) references public.schedule_activities(id) on delete cascade;
end $$;

create index if not exists idx_schedule_activities_schedule_row
on public.schedule_activities(schedule_id, row_number);

create index if not exists idx_schedule_activities_parent
on public.schedule_activities(parent_id);
