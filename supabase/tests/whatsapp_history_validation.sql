-- Validação rápida do schema WhatsApp para executar no SQL Editor do Supabase.
-- Não depende de pgTAP/extensões de teste (has_table, col_type_is etc.).
-- A coluna "ok" deve retornar true em todas as linhas.

with expected_tables(table_name) as (
    values
        ('whatsapp_sessions'),
        ('whatsapp_chats'),
        ('whatsapp_project_sources'),
        ('whatsapp_message_batches'),
        ('whatsapp_project_insights')
), table_checks as (
    select
        'table_exists' as check_type,
        table_name as object_name,
        to_regclass(format('public.%I', table_name)) is not null as ok,
        case
            when to_regclass(format('public.%I', table_name)) is not null then 'Tabela encontrada.'
            else 'Tabela ausente. Execute a migration supabase/migrations/20260514_000012_whatsapp_history.sql.'
        end as details
    from expected_tables
), column_checks as (
    select
        'column_type' as check_type,
        'whatsapp_message_batches.payload' as object_name,
        exists (
            select 1
            from information_schema.columns
            where table_schema = 'public'
              and table_name = 'whatsapp_message_batches'
              and column_name = 'payload'
              and data_type = 'jsonb'
        ) as ok,
        'A coluna payload deve existir como jsonb.' as details
), constraint_checks as (
    select
        'unique_constraint' as check_type,
        constraint_name as object_name,
        exists (
            select 1
            from pg_constraint constraint_info
            join pg_class table_info on table_info.oid = constraint_info.conrelid
            join pg_namespace schema_info on schema_info.oid = table_info.relnamespace
            where schema_info.nspname = 'public'
              and table_info.relname = constraint_table
              and constraint_info.contype = 'u'
              and constraint_info.conkey = (
                  select array_agg(attribute_info.attnum order by expected_columns.ordinality)::smallint[]
                  from unnest(expected_column_names) with ordinality as expected_columns(column_name, ordinality)
                  join pg_attribute attribute_info
                    on attribute_info.attrelid = table_info.oid
                   and attribute_info.attname = expected_columns.column_name
              )
        ) as ok,
        details
    from (
        values
            (
                'whatsapp_project_sources(project_id, wa_chat_id)',
                'whatsapp_project_sources',
                array['project_id', 'wa_chat_id'],
                'Deve impedir vínculo duplicado do mesmo chat no mesmo projeto.'
            ),
            (
                'whatsapp_message_batches(project_id, wa_chat_id, batch_date)',
                'whatsapp_message_batches',
                array['project_id', 'wa_chat_id', 'batch_date'],
                'Deve impedir lote diário duplicado do mesmo chat no mesmo projeto.'
            )
    ) as expected_constraints(constraint_name, constraint_table, expected_column_names, details)
)
select * from table_checks
union all
select * from column_checks
union all
select * from constraint_checks
order by check_type, object_name;
