create extension if not exists pgcrypto;

create table if not exists public.whatsapp_sessions (
    id uuid primary key default gen_random_uuid(),
    session_name text not null default 'default',
    connected boolean not null default false,
    phone_number text,
    device_name text,
    status text not null default 'disconnected',
    last_qr_at timestamptz,
    last_connected_at timestamptz,
    last_disconnected_at timestamptz,
    last_sync_at timestamptz,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.whatsapp_chats (
    id uuid primary key default gen_random_uuid(),
    wa_chat_id text not null unique,
    chat_name text not null,
    chat_type text not null check (chat_type in ('group', 'contact')),
    phone_number text,
    is_group boolean not null default false,
    participant_count integer,
    raw_profile jsonb not null default '{}'::jsonb,
    last_message_at timestamptz,
    discovered_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.whatsapp_project_sources (
    id uuid primary key default gen_random_uuid(),
    project_id uuid not null references public.projects(id) on delete cascade,
    wa_chat_id text not null references public.whatsapp_chats(wa_chat_id) on delete cascade,
    chat_name text not null,
    chat_type text not null check (chat_type in ('group', 'contact')),
    enabled boolean not null default false,
    capture_from timestamptz not null default now(),
    retention_days integer not null default 365,
    can_analyze_ai boolean not null default false,
    notes text,
    created_by text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique(project_id, wa_chat_id)
);

create table if not exists public.whatsapp_message_batches (
    id uuid primary key default gen_random_uuid(),
    project_id uuid not null references public.projects(id) on delete cascade,
    source_id uuid not null references public.whatsapp_project_sources(id) on delete cascade,
    wa_chat_id text not null,
    chat_name text not null,
    chat_type text not null check (chat_type in ('group', 'contact')),
    batch_date date not null,
    message_count integer not null default 0,
    first_message_at timestamptz,
    last_message_at timestamptz,
    payload jsonb not null default '{"messages":[]}'::jsonb,
    search_text text,
    imported_at timestamptz not null default now(),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique(project_id, wa_chat_id, batch_date)
);

create table if not exists public.whatsapp_project_insights (
    id uuid primary key default gen_random_uuid(),
    project_id uuid not null references public.projects(id) on delete cascade,
    source_id uuid references public.whatsapp_project_sources(id) on delete set null,
    batch_id uuid references public.whatsapp_message_batches(id) on delete cascade,
    insight_type text not null check (insight_type in ('summary', 'decision', 'pending', 'risk', 'action', 'question')),
    title text not null,
    description text,
    responsible text,
    due_date date,
    severity text check (severity in ('baixa', 'media', 'alta', 'critica')),
    status text not null default 'open',
    evidence jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_whatsapp_chats_type on public.whatsapp_chats(chat_type);
create index if not exists idx_whatsapp_project_sources_project on public.whatsapp_project_sources(project_id);
create index if not exists idx_whatsapp_project_sources_enabled on public.whatsapp_project_sources(project_id, enabled);
create index if not exists idx_whatsapp_batches_project_date on public.whatsapp_message_batches(project_id, batch_date desc);
create index if not exists idx_whatsapp_batches_chat on public.whatsapp_message_batches(wa_chat_id, batch_date desc);
create index if not exists idx_whatsapp_batches_payload_gin on public.whatsapp_message_batches using gin(payload);
create index if not exists idx_whatsapp_batches_search_text on public.whatsapp_message_batches using gin(to_tsvector('portuguese', coalesce(search_text, '')));
create index if not exists idx_whatsapp_insights_project_type on public.whatsapp_project_insights(project_id, insight_type, status);
