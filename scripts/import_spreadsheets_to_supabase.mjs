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

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  const headers = lines[0].split(';').map(s => s.trim());
  return lines.slice(1).map(line => {
    const values = line.split(';');
    return Object.fromEntries(headers.map((h, i) => [h, (values[i] || '').trim()]));
  });
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
      const payload = rows.map(r => ({ project_id: projectId, external_id: r.ID, area: r['Área'], category: r.Categoria, description: r.Descrição || r.Descricao || '', owner: r.Responsável || r.Responsavel, status: r.Status || 'Aberta', source_row_hash: hashRow(r) }));
      await supabase('issues', 'POST', payload);
    }
    if (type === 'riscos') {
      const payload = rows.map(r => ({ project_id: projectId, external_id: r.ID, process: r.Projeto || r.Processo, owner: r.Responsável || r.Responsavel, probability: Number(r.Probabilidade || 0), impact: Number(r.Impacto || 0), strategy: r.Tratamento, description: r.Descrição || r.Descricao || '', life_cycle_status: r['Status Ciclo de Vida'] || r.Status, source_row_hash: hashRow(r) }));
      await supabase('risks', 'POST', payload);
    }
  }

  console.log('Importação concluída com sucesso.');
}

main();
