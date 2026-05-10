import crypto from 'node:crypto';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SECRET = process.env.SUPABASE_SECRET_KEY;
const PROJECT_CODE = process.env.PROJECT_CODE || 'ROSSI-PMO';
const PROJECT_NAME = process.env.PROJECT_NAME || 'Rossi Supermercados';

if (!URL || !SECRET) {
  throw new Error('Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SECRET_KEY no ambiente.');
}

const sources = {
  pendencias: process.env.SHEET_URL_PENDENCIAS,
  riscos: process.env.SHEET_URL_RISCOS,
  gaps: process.env.SHEET_URL_GAPS,
  atividades: process.env.SHEET_URL_ATIVIDADES,
  geral: process.env.SHEET_URL_GERAL
};

function parseCSVRow(line, delimiter) {
  const out = [];
  let cur = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === delimiter && !inQuotes) {
      out.push(cur.trim());
      cur = '';
      continue;
    }
    cur += ch;
  }
  out.push(cur.trim());
  return out;
}

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (!lines.length) return [];

  const headerIdx = lines.findIndex(l => /\bID\b/i.test(l) && /(Categoria|Descri|Area|Área)/i.test(l));
  if (headerIdx < 0) return [];

  const headerLine = lines[headerIdx];
  const delimiter = (headerLine.split(';').length > headerLine.split(',').length) ? ';' : ',';
  const headers = parseCSVRow(headerLine, delimiter).map(s => s.trim());

  return lines.slice(headerIdx + 1)
    .map(line => parseCSVRow(line, delimiter))
    .map(values => Object.fromEntries(headers.map((h, i) => [h, (values[i] || '').trim()])))
    .filter(row => Object.values(row).some(v => v));
}

async function supabase(path, method = 'GET', body) {
  const res = await fetch(`${URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: SECRET,
      Authorization: `Bearer ${SECRET}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=representation'
    },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${await res.text()}`);
  return res.json();
}

function hashRow(r) { return crypto.createHash('sha1').update(JSON.stringify(r)).digest('hex'); }
function parseDateValue(value) {
  const raw = `${value || ''}`.trim();
  if (!raw || raw === '-') return null;
  const dmy = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return iso ? `${iso[1]}-${iso[2]}-${iso[3]}` : null;
}
function parsePercentValue(value) {
  const num = Number(`${value || ''}`.replace('%', '').replace(',', '.').trim());
  return Number.isFinite(num) ? num : 0;
}
function issuePayload(row, projectId) {
  return {
    source_type: 'pendencias',
    source_label: 'Pendências',
    project_id: projectId,
    project_linked_name: PROJECT_NAME,
    tap_entries_project_id: PROJECT_CODE,
    sheet: { tab_name: 'Pendências', range: '', has_header: true, source_row_number: null },
    row
  };
}

async function main() {
  const [project] = await supabase('projects?code=eq.' + encodeURIComponent(PROJECT_CODE));
  let projectId = project?.id;
  if (!projectId) {
    const created = await supabase('projects', 'POST', [{ code: PROJECT_CODE, name: PROJECT_NAME }]);
    projectId = created[0].id;
  }

  for (const [type, sheetUrl] of Object.entries(sources)) {
    if (!sheetUrl) continue;
    const csv = await fetch(sheetUrl).then(r => r.text());
    const rows = parseCSV(csv);
    if (type === 'pendencias') {
      const payload = rows.map(r => {
        const payloadIssue = issuePayload(r, projectId);
        return {
          project_id: projectId,
          tap_entries_project_id: PROJECT_CODE,
          project_linked_name: PROJECT_NAME,
          external_id: r.ID,
          area: r['Área'] || r.Area,
          category: r.Categoria,
          stage: r['Etapa do Projeto'] || r.Etapa,
          project_stage: r['Etapa do Projeto'] || r.Etapa,
          sprint: r.Sprint,
          activity: r.Atividade,
          description: r.Descrição || r.Descricao || r.Atividade || 'Pendência sem descrição',
          owner: r.Responsável || r.Responsavel,
          client_owner: r['Responsável Cliente'] || r['Responsavel Cliente'],
          criticality: r.Criticidade || r.Prioridade,
          identified_at: parseDateValue(r['Data Identificação'] || r['Data Identificacao']),
          planned_at: parseDateValue(r['Data Planejada'] || r.Vencimento),
          days_to_complete: r['Dias para Concluir'],
          condition: r['Condição Pendência'] || r['Condicao Pendencia'],
          issue_condition: r['Condição Pendência'] || r['Condicao Pendencia'],
          completed_at: parseDateValue(r['Data Conclusão'] || r['Data Conclusao']),
          completion_pct: parsePercentValue(r['% Conclusão'] || r['% Conclusao']),
          status: r.Status || 'Aberta',
          payload_issue: payloadIssue,
          source_row_hash: hashRow(payloadIssue)
        };
      });
      await supabase(`issues?project_id=eq.${projectId}`, 'DELETE');
      if (payload.length) await supabase('issues', 'POST', payload);
    }
    if (type === 'riscos') {
      const payload = rows.map(r => ({ project_id: projectId, external_id: r.ID, process: r.Projeto || r.Processo, owner: r.Responsável || r.Responsavel, probability: Number(r.Probabilidade || 0), impact: Number(r.Impacto || 0), strategy: r.Tratamento, description: r.Descrição || r.Descricao || '', life_cycle_status: r['Status Ciclo de Vida'] || r.Status, source_row_hash: hashRow(r) }));
      await supabase('risks', 'POST', payload);
    }
  }

  console.log('Importação concluída com sucesso.');
}

main();
