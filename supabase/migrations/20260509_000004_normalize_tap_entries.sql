-- Normaliza a tabela de TAP para espelhar os campos reais gravados no payload.
-- O payload continua existindo como fonte completa; as colunas abaixo facilitam filtros,
-- relatórios e consultas diretas no Supabase.

alter table public.tap_entries add column if not exists tap_payload_id text;
alter table public.tap_entries add column if not exists data_tap text;
alter table public.tap_entries add column if not exists coordenador text;
alter table public.tap_entries add column if not exists produtos jsonb;
alter table public.tap_entries add column if not exists detalhes_produtos jsonb;
alter table public.tap_entries add column if not exists margem_venda text;
alter table public.tap_entries add column if not exists margem_atual text;
alter table public.tap_entries add column if not exists mrr_mensal text;
alter table public.tap_entries add column if not exists mrr_total text;
alter table public.tap_entries add column if not exists investimento_erro text;
alter table public.tap_entries add column if not exists diferenca_psa text;
alter table public.tap_entries add column if not exists go_live text;
alter table public.tap_entries add column if not exists pos_producao text;
alter table public.tap_entries add column if not exists observacao text;
alter table public.tap_entries add column if not exists updated_at timestamptz not null default now();

-- codCliente é multi-seleção no payload, portanto a coluna precisa aceitar array JSON.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'tap_entries'
      and column_name = 'cod_cliente'
      and data_type <> 'jsonb'
  ) then
    alter table public.tap_entries
      alter column cod_cliente type jsonb
      using case
        when cod_cliente is null or btrim(cod_cliente) = '' then '[]'::jsonb
        else to_jsonb(string_to_array(cod_cliente, ', '))
      end;
  end if;
end $$;

-- Backfill dos registros já existentes: copia exclusivamente os valores reais do payload
-- gravado em tap_entries para as colunas normalizadas.
update public.tap_entries
set
  tap_payload_id = payload->>'id',
  identificacao = coalesce(payload->>'id', identificacao),
  data_tap = nullif(payload->>'dataTap', ''),
  data_referencia = coalesce(nullif(payload->>'dataTap', ''), data_referencia),
  cod_cliente = coalesce(payload->'codCliente', '[]'::jsonb),
  nome_projeto = payload->>'nomeProjeto',
  gpp = payload->>'gpp',
  coordenador = payload->>'coordenador',
  coordenador_projeto = coalesce(payload->>'coordenador', coordenador_projeto),
  esn = payload->>'esn',
  arquiteto = payload->>'arquiteto',
  criticidade_cliente = payload->>'criticidadeCliente',
  criticidade_totvs = payload->>'criticidadeTotvs',
  drive = payload->>'drive',
  produtos = coalesce(payload->'produtos', '[]'::jsonb),
  produto = case
    when jsonb_typeof(payload->'produtos') = 'array' then array_to_string(ARRAY(select jsonb_array_elements_text(payload->'produtos')), ', ')
    else produto
  end,
  detalhes_produtos = coalesce(payload->'detalhesProdutos', '{}'::jsonb),
  valor_projeto = payload->>'valorProjeto',
  receita_atual = payload->>'receitaAtual',
  margem_venda = payload->>'margemVenda',
  margem_venda_percentual = coalesce(payload->>'margemVenda', margem_venda_percentual),
  margem_atual = payload->>'margemAtual',
  margem_atual_percentual = coalesce(payload->>'margemAtual', margem_atual_percentual),
  margem_venda_valor = payload->>'margemVendaValor',
  margem_atual_valor = payload->>'margemAtualValor',
  mrr_mensal = payload->>'mrrMensal',
  mrr_recorrente_mensal = coalesce(payload->>'mrrMensal', mrr_recorrente_mensal),
  investimento_perdas = payload->>'investimentoPerdas',
  mrr_total = payload->>'mrrTotal',
  mrr_total_contratados = coalesce(payload->>'mrrTotal', mrr_total_contratados),
  investimento_comercial = payload->>'investimentoComercial',
  psa_planejado = payload->>'psaPlanejado',
  investimento_erro = payload->>'investimentoErro',
  investimento_erro_produto = coalesce(payload->>'investimentoErro', investimento_erro_produto),
  diferenca_psa = payload->>'diferencaPsa',
  diferenca_psa_projeto = coalesce(payload->>'diferencaPsa', diferenca_psa_projeto),
  projeto_em_perda = payload->>'projetoEmPerda',
  data_inicio = nullif(payload->>'dataInicio', ''),
  go_live = nullif(payload->>'goLive', ''),
  go_live_previsao = coalesce(nullif(payload->>'goLive', ''), go_live_previsao),
  duracao = payload->>'duracao',
  pos_producao = payload->>'posProducao',
  pos_producao_meses = coalesce(payload->>'posProducao', pos_producao_meses),
  encerramento = nullif(payload->>'encerramento', ''),
  observacao = payload->>'observacao',
  observacoes = coalesce(payload->>'observacao', observacoes),
  updated_at = now()
where payload is not null;
