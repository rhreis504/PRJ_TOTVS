const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SECRET = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ACCESS_TOKEN;
const TAP_TABLE = process.env.SUPABASE_TAP_TABLE || 'tap_entries';

if (!URL || !SECRET) {
  throw new Error('Defina NEXT_PUBLIC_SUPABASE_URL/SUPABASE_URL e SUPABASE_SECRET_KEY/SUPABASE_SERVICE_ROLE_KEY para executar o backfill.');
}

const baseUrl = URL.replace(/\/rest\/v1\/?$/i, '').replace(/\/$/, '');
const headers = {
  apikey: SECRET,
  Authorization: `Bearer ${SECRET}`,
  'Content-Type': 'application/json',
  Accept: 'application/json',
  Prefer: 'return=representation'
};

const normalizeArray = (value) => {
  if (Array.isArray(value)) return value;
  if (value === null || value === undefined || value === '') return [];
  return String(value).split(',').map((item) => item.trim()).filter(Boolean);
};

const buildLegacyRow = (payload, projectId) => {
  const codCliente = normalizeArray(payload.codCliente);
  const produtos = normalizeArray(payload.produtos);

  return {
    project_id: projectId,
    identificacao: payload.id || null,
    data_referencia: payload.dataTap || null,
    cod_cliente: codCliente.join(', ') || null,
    nome_projeto: payload.nomeProjeto || null,
    gpp: payload.gpp || null,
    coordenador_projeto: payload.coordenador || null,
    esn: payload.esn || null,
    arquiteto: payload.arquiteto || null,
    criticidade_cliente: payload.criticidadeCliente || null,
    criticidade_totvs: payload.criticidadeTotvs || null,
    drive: payload.drive || null,
    produto: produtos.join(', ') || null,
    valor_projeto: payload.valorProjeto || null,
    receita_atual: payload.receitaAtual || null,
    margem_venda_percentual: payload.margemVenda || null,
    margem_atual_percentual: payload.margemAtual || null,
    margem_venda_valor: payload.margemVendaValor || null,
    margem_atual_valor: payload.margemAtualValor || null,
    mrr_recorrente_mensal: payload.mrrMensal || null,
    investimento_perdas: payload.investimentoPerdas || null,
    mrr_total_contratados: payload.mrrTotal || null,
    investimento_comercial: payload.investimentoComercial || null,
    psa_planejado: payload.psaPlanejado || null,
    investimento_erro_produto: payload.investimentoErro || null,
    diferenca_psa_projeto: payload.diferencaPsa || null,
    projeto_em_perda: payload.projetoEmPerda || null,
    data_inicio: payload.dataInicio || null,
    go_live_previsao: payload.goLive || null,
    duracao: payload.duracao || null,
    pos_producao_meses: payload.posProducao || null,
    encerramento: payload.encerramento || null,
    observacoes: payload.observacao || null,
    payload
  };
};

async function supabase(path, method = 'GET', body) {
  const response = await fetch(`${baseUrl}/rest/v1/${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${method} ${path} falhou (${response.status}): ${text}`);
  }

  return text ? JSON.parse(text) : null;
}

const selectColumns = [
  'id', 'project_id', 'payload', 'identificacao', 'data_referencia', 'nome_projeto',
  'coordenador_projeto', 'esn', 'criticidade_cliente', 'drive', 'cod_cliente', 'gpp',
  'produto', 'arquiteto', 'criticidade_totvs', 'valor_projeto', 'margem_venda_percentual',
  'margem_venda_valor', 'mrr_recorrente_mensal', 'mrr_total_contratados', 'psa_planejado',
  'diferenca_psa_projeto', 'receita_atual', 'margem_atual_percentual', 'margem_atual_valor',
  'investimento_perdas', 'investimento_comercial', 'investimento_erro_produto',
  'projeto_em_perda', 'data_inicio', 'go_live_previsao', 'duracao', 'pos_producao_meses',
  'encerramento', 'observacoes'
].join(',');

const rows = await supabase(`${TAP_TABLE}?select=${selectColumns}&payload=not.is.null`);
let updated = 0;

for (const row of rows) {
  const payload = row.payload && typeof row.payload === 'object' ? row.payload : null;
  if (!payload) continue;

  await supabase(`${TAP_TABLE}?id=eq.${encodeURIComponent(row.id)}`, 'PATCH', buildLegacyRow(payload, row.project_id));
  updated += 1;
}

console.log(`Backfill concluído em ${updated} registro(s) da tabela ${TAP_TABLE}.`);
