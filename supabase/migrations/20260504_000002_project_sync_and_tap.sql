alter table public.spreadsheet_sources drop constraint if exists spreadsheet_sources_source_type_check;
alter table public.spreadsheet_sources add constraint spreadsheet_sources_source_type_check check (source_type in ('geral','pendencias','riscos','gaps','atividades','treinamentos','stakeholders','tap'));

create table if not exists public.source_rows (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  source_type text not null,
  row_data jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.tap_entries (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  identificacao text,
  data_referencia text,
  nome_projeto text,
  coordenador_projeto text,
  esn text,
  criticidade_cliente text,
  drive text,
  cod_cliente text,
  gpp text,
  produto text,
  arquiteto text,
  criticidade_totvs text,
  valor_projeto text,
  margem_venda_percentual text,
  margem_venda_valor text,
  mrr_recorrente_mensal text,
  mrr_total_contratados text,
  psa_planejado text,
  diferenca_psa_projeto text,
  receita_atual text,
  margem_atual_percentual text,
  margem_atual_valor text,
  investimento_perdas text,
  investimento_comercial text,
  investimento_erro_produto text,
  projeto_em_perda text,
  data_inicio text,
  go_live_previsao text,
  duracao text,
  pos_producao_meses text,
  encerramento text,
  descricao_escopo text,
  observacoes text,
  payload jsonb,
  created_at timestamptz not null default now()
);
