#!/usr/bin/env node
/**
 * Implantador da stack Supabase do Cockpit Rossi/TOTVS em outro projeto.
 *
 * Uso:
 *   node scripts/install_supabase_stack.mjs /caminho/do/outro-projeto --patch-index --force
 *
 * O script copia as migrations oficiais, utilitários de importação, modelos de
 * ambiente e um configurador HTML/JS reaproveitável para o menu Configurações.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const MIGRATION_DIR = 'supabase/migrations';
const IMPORT_SCRIPT = 'scripts/import_spreadsheets_to_supabase.mjs';
const REQUIRED_MIGRATIONS = [
  '20260502_000001_initial_schema.sql',
  '20260504_000002_project_sync_and_tap.sql',
  '20260505_000003_api_access_and_rpc.sql',
  '20260509_000004_normalize_tap_entries.sql',
  '20260510_000005_normalize_issues_payload.sql',
];

const args = process.argv.slice(2);
const targetArg = args.find((arg) => !arg.startsWith('--'));
const options = new Set(args.filter((arg) => arg.startsWith('--')));
const dryRun = options.has('--dry-run');
const force = options.has('--force');
const patchIndex = options.has('--patch-index');
const explicitHelp = options.has('--help') || options.has('-h');
const help = explicitHelp || !targetArg;

const sourceRoot = process.cwd();
const targetRoot = targetArg ? path.resolve(targetArg) : '';

if (help) {
  console.log(`\nImplantador Supabase - Cockpit Rossi/TOTVS\n\nUso:\n  node scripts/install_supabase_stack.mjs <pasta-do-outro-projeto> [opções]\n\nOpções:\n  --patch-index  Tenta inserir um item/área de Configurações Supabase no index.html do destino.\n  --force        Sobrescreve arquivos já existentes no destino.\n  --dry-run      Mostra as ações sem gravar arquivos.\n  --help         Exibe esta ajuda.\n\nExemplo:\n  node scripts/install_supabase_stack.mjs ../OUTRA_MAIN --patch-index --force\n`);
  process.exit(explicitHelp ? 0 : 1);
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch (_error) {
    return false;
  }
}

async function ensureDir(dirPath) {
  if (dryRun) {
    console.log(`[dry-run] mkdir -p ${dirPath}`);
    return;
  }
  await fs.mkdir(dirPath, { recursive: true });
}

async function writeFileSafe(filePath, content) {
  const alreadyExists = await exists(filePath);
  if (alreadyExists && !force) {
    console.log(`- Mantido: ${path.relative(targetRoot, filePath)} (use --force para sobrescrever)`);
    return false;
  }
  if (dryRun) {
    console.log(`[dry-run] write ${filePath}${alreadyExists ? ' (overwrite)' : ''}`);
    return true;
  }
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, content);
  console.log(`- ${alreadyExists ? 'Atualizado' : 'Criado'}: ${path.relative(targetRoot, filePath)}`);
  return true;
}

async function copyFileSafe(sourceFile, targetFile) {
  const content = await fs.readFile(sourceFile);
  return writeFileSafe(targetFile, content);
}

function envExampleTemplate() {
  return `# Supabase - Cockpit Rossi/TOTVS\n# Copie este arquivo para .env.local no projeto de destino e preencha os valores reais.\n\nNEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJECT-REF.supabase.co\nNEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=\nNEXT_PUBLIC_SUPABASE_ANON_KEY=\nSUPABASE_SECRET_KEY=\nSUPABASE_SERVICE_ROLE_KEY=\nSUPABASE_SCHEMA=public\nSUPABASE_PROJECTS_TABLE=projects\nSUPABASE_TAP_TABLE=tap_entries\nPROJECT_CODE=ROSSI-PMO\nPROJECT_NAME=Rossi Supermercados\nSHEET_URL_PENDENCIAS=\nSHEET_URL_RISCOS=\nSHEET_URL_GAPS=\nSHEET_URL_ATIVIDADES=\nSHEET_URL_GERAL=\nSHEET_URL_TAP=\n`;
}

function runtimeJsTemplate() {
  return `/* Supabase runtime config - instalado pelo implantador Rossi/TOTVS. */\n(function initSupabaseRuntimeConfig(global) {\n  const STORAGE_KEY = 'totvs_cockpit_config';\n  const DEFAULTS = {\n    url: '',\n    apiUrl: '',\n    projectRef: '',\n    schema: 'public',\n    projectsTable: 'projects',\n    tapTable: 'tap_entries',\n    publishableKey: '',\n    anonKey: '',\n    secret: '',\n    serviceRole: '',\n    currentKey: '',\n    previousKey: ''\n  };\n\n  function normalizeSupabaseUrl(rawUrl) {\n    const input = String(rawUrl || '').trim();\n    if (!input) return '';\n    const candidate = /^https?:\\/\\//i.test(input) ? input : 'https://' + input;\n    const parsed = new URL(candidate);\n    if (parsed.hostname === 'app.supabase.com') {\n      throw new Error('Use a Project URL do Supabase, não app.supabase.com.');\n    }\n    return parsed.protocol + '//' + parsed.hostname;\n  }\n\n  function extractProjectRef(rawUrl) {\n    try {\n      return normalizeSupabaseUrl(rawUrl).replace(/^https?:\\/\\//, '').split('.')[0] || '';\n    } catch (_error) {\n      return '';\n    }\n  }\n\n  function loadConfig() {\n    try {\n      const stored = JSON.parse(global.localStorage.getItem(STORAGE_KEY) || '{}');\n      return { ...DEFAULTS, ...(stored.supabase || stored) };\n    } catch (_error) {\n      return { ...DEFAULTS };\n    }\n  }\n\n  function saveConfig(nextConfig) {\n    const normalizedUrl = normalizeSupabaseUrl(nextConfig.url);\n    const supabase = {\n      ...DEFAULTS,\n      ...nextConfig,\n      url: normalizedUrl,\n      apiUrl: nextConfig.apiUrl || normalizedUrl + '/rest/v1/',\n      projectRef: nextConfig.projectRef || extractProjectRef(normalizedUrl),\n      serviceRole: nextConfig.serviceRole || nextConfig.secret || ''\n    };\n    const stored = JSON.parse(global.localStorage.getItem(STORAGE_KEY) || '{}');\n    global.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...stored, supabase }));\n    return supabase;\n  }\n\n  async function supabaseGet(path, config = loadConfig()) {\n    const key = config.secret || config.serviceRole || config.publishableKey || config.anonKey;\n    if (!config.url || !key) throw new Error('Informe URL e chave Supabase.');\n    const baseUrl = normalizeSupabaseUrl(config.url);\n    const response = await fetch(baseUrl + '/rest/v1/' + path.replace(/^\\//, ''), {\n      headers: { apikey: key, Authorization: 'Bearer ' + key }\n    });\n    if (!response.ok) throw new Error('Supabase GET falhou: HTTP ' + response.status);\n    return response.json();\n  }\n\n  global.TotvsSupabaseRuntime = { STORAGE_KEY, DEFAULTS, loadConfig, saveConfig, supabaseGet, normalizeSupabaseUrl, extractProjectRef };\n})(window);\n`;
}

function configuratorHtmlTemplate() {
  return `<section id="supabase-configuracoes" class="card supabase-configuracoes">\n  <h3><span aria-hidden="true">☁️</span> Configurações Supabase</h3>\n  <p>Preencha os dados do novo projeto Supabase e salve no armazenamento local do Cockpit.</p>\n  <div class="supabase-config-grid">\n    <label>Project URL<input id="supabase-url" type="text" placeholder="https://SEU-PROJECT-REF.supabase.co"></label>\n    <label>Project Ref<input id="supabase-project-ref" type="text" placeholder="SEU-PROJECT-REF"></label>\n    <label>Schema REST<input id="supabase-schema" type="text" value="public"></label>\n    <label>Tabela de Projetos<input id="supabase-projects-table" type="text" value="projects"></label>\n    <label>Tabela TAP<input id="supabase-tap-table" type="text" value="tap_entries"></label>\n    <label>Publishable/Anon Key<input id="supabase-publishable-key" type="password" placeholder="eyJ... ou sb_publishable_..."></label>\n    <label>Service Role/Secret Key<input id="supabase-secret-key" type="password" placeholder="sb_secret_... ou service_role"></label>\n    <label>REST API URL<input id="supabase-api-url" type="text" placeholder="https://SEU-PROJECT-REF.supabase.co/rest/v1/"></label>\n  </div>\n  <div class="supabase-actions">\n    <button type="button" onclick="salvarConfiguracaoSupabase()">Salvar Supabase</button>\n    <button type="button" onclick="testarConfiguracaoSupabase()">Testar Conexão</button>\n  </div>\n  <pre id="supabase-config-log" aria-live="polite"></pre>\n</section>\n<script src="supabase/setup/supabase-runtime.js"></script>\n<script>\nfunction preencherConfiguracaoSupabase() {\n  const cfg = window.TotvsSupabaseRuntime.loadConfig();\n  document.getElementById('supabase-url').value = cfg.url || '';\n  document.getElementById('supabase-project-ref').value = cfg.projectRef || '';\n  document.getElementById('supabase-schema').value = cfg.schema || 'public';\n  document.getElementById('supabase-projects-table').value = cfg.projectsTable || 'projects';\n  document.getElementById('supabase-tap-table').value = cfg.tapTable || 'tap_entries';\n  document.getElementById('supabase-publishable-key').value = cfg.publishableKey || cfg.anonKey || '';\n  document.getElementById('supabase-secret-key').value = cfg.secret || cfg.serviceRole || '';\n  document.getElementById('supabase-api-url').value = cfg.apiUrl || '';\n}\nfunction lerFormularioSupabase() {\n  return {\n    url: document.getElementById('supabase-url').value.trim(),\n    projectRef: document.getElementById('supabase-project-ref').value.trim(),\n    schema: document.getElementById('supabase-schema').value.trim() || 'public',\n    projectsTable: document.getElementById('supabase-projects-table').value.trim() || 'projects',\n    tapTable: document.getElementById('supabase-tap-table').value.trim() || 'tap_entries',\n    publishableKey: document.getElementById('supabase-publishable-key').value.trim(),\n    anonKey: document.getElementById('supabase-publishable-key').value.trim(),\n    secret: document.getElementById('supabase-secret-key').value.trim(),\n    serviceRole: document.getElementById('supabase-secret-key').value.trim(),\n    apiUrl: document.getElementById('supabase-api-url').value.trim()\n  };\n}\nfunction salvarConfiguracaoSupabase() {\n  const log = document.getElementById('supabase-config-log');\n  try {\n    const saved = window.TotvsSupabaseRuntime.saveConfig(lerFormularioSupabase());\n    preencherConfiguracaoSupabase();\n    log.textContent = 'Configuração salva para ' + saved.url + ' no localStorage.';\n  } catch (error) {\n    log.textContent = 'Erro ao salvar: ' + error.message;\n  }\n}\nasync function testarConfiguracaoSupabase() {\n  const log = document.getElementById('supabase-config-log');\n  try {\n    const cfg = window.TotvsSupabaseRuntime.saveConfig(lerFormularioSupabase());\n    const rows = await window.TotvsSupabaseRuntime.supabaseGet((cfg.projectsTable || 'projects') + '?select=id,code,name&limit=1', cfg);\n    log.textContent = 'Conexão OK. Retorno: ' + JSON.stringify(rows, null, 2);\n  } catch (error) {\n    log.textContent = 'Falha na conexão: ' + error.message;\n  }\n}\ndocument.addEventListener('DOMContentLoaded', preencherConfiguracaoSupabase);\n</script>\n<style>\n.supabase-configuracoes { padding: 20px; border: 1px solid #dbe4f0; border-radius: 12px; background: #fff; }\n.supabase-config-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px; }\n.supabase-config-grid label { display: flex; flex-direction: column; gap: 6px; font-weight: 700; font-size: 13px; }\n.supabase-config-grid input { padding: 10px 12px; border: 1px solid #cbd5e1; border-radius: 8px; }\n.supabase-actions { display: flex; gap: 10px; margin-top: 14px; }\n.supabase-actions button { padding: 10px 14px; border: 0; border-radius: 8px; background: #0b3f78; color: white; font-weight: 700; cursor: pointer; }\n#supabase-config-log { min-height: 90px; margin-top: 14px; padding: 12px; white-space: pre-wrap; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; }\n</style>\n`;
}

function docsTemplate() {
  const migrationList = REQUIRED_MIGRATIONS.map(file => `- \`${MIGRATION_DIR}/${file}\``).join('\n');
  const migrationSteps = REQUIRED_MIGRATIONS.map((file, index) => `${index + 1}. \`${MIGRATION_DIR}/${file}\``).join('\n');
  return `# Implantação Supabase - Cockpit Rossi/TOTVS

Este projeto recebeu a estrutura Supabase copiada do Cockpit Rossi/TOTVS.

## 1. Arquivos instalados

${migrationList}
- \`${IMPORT_SCRIPT}\`
- \`supabase/setup/supabase-runtime.js\`
- \`supabase/setup/supabase-configurador.html\`
- \`.env.supabase.example\`

## 2. Executar SQL no novo Supabase

No SQL Editor do novo projeto Supabase, execute as migrations nesta ordem:

${migrationSteps}

Essas migrations criam \`projects\`, \`spreadsheet_sources\`, \`issues\`, \`risks\`, \`gaps\`, \`activities\`, \`import_jobs\`, \`source_rows\`, \`tap_entries\`, grants, policies RLS e RPCs auxiliares.

## 3. Configurar variáveis

Copie \`.env.supabase.example\` para \`.env.local\` e preencha:

\`\`\`env
NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJECT-REF.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SECRET_KEY=...
PROJECT_CODE=ROSSI-PMO
PROJECT_NAME=Rossi Supermercados
\`\`\`

Nunca versionar chaves reais de service role/secret.

## 4. Menu Configurações

Se o \`index.html\` foi atualizado com \`--patch-index\`, haverá um item "Supabase" no menu e uma área "Configurações Supabase".

Se o patch automático não foi possível, copie o conteúdo de \`supabase/setup/supabase-configurador.html\` para a tela/menu de configurações do projeto de destino e mantenha o arquivo \`supabase/setup/supabase-runtime.js\` publicado junto com a aplicação.

## 5. Importação inicial

Depois de preencher as variáveis, rode no terminal do projeto de destino:

\`\`\`bash
node ${IMPORT_SCRIPT}
\`\`\`

## 6. Testes rápidos

\`\`\`bash
curl -s "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/projects?select=id,code,name&limit=1" \\
  -H "apikey: $SUPABASE_SECRET_KEY" \\
  -H "Authorization: Bearer $SUPABASE_SECRET_KEY"

node ${IMPORT_SCRIPT}
\`\`\`
`;
}

async function patchIndexHtml() {
  const indexPath = path.join(targetRoot, 'index.html');
  if (!(await exists(indexPath))) {
    console.log('- Patch index.html ignorado: arquivo não encontrado no destino.');
    return;
  }
  let html = await fs.readFile(indexPath, 'utf8');
  if (html.includes('supabase-configuracoes') || html.includes('nav-supabase-config')) {
    console.log('- Patch index.html ignorado: configurador Supabase já existe.');
    return;
  }

  const backupPath = `${indexPath}.bak-supabase-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  const navItem = `\n                <div class="nav-item" id="nav-supabase-config" onclick="showPage('supabase-config', this)"><i data-lucide="database"></i> Supabase</div>`;
  if (html.includes('<div class="nav-item" id="nav-config"')) {
    html = html.replace('<div class="nav-item" id="nav-config"', `${navItem}\n                <div class="nav-item" id="nav-config"`);
  } else if (html.includes('</nav>')) {
    html = html.replace('</nav>', `${navItem}\n            </nav>`);
  } else {
    console.log('- Patch index.html parcial: não encontrei menu <nav>; somente a seção será adicionada.');
  }

  const section = `\n            <div id="page-supabase-config" class="hidden">\n${configuratorHtmlTemplate().split('\n').map((line) => `                ${line}`).join('\n')}\n            </div>\n`;
  if (html.includes('</main>')) {
    html = html.replace('</main>', `${section}\n        </main>`);
  } else if (html.includes('</body>')) {
    html = html.replace('</body>', `${section}\n</body>`);
  } else {
    console.log('- Patch index.html ignorado: não encontrei </main> ou </body>.');
    return;
  }

  if (dryRun) {
    console.log(`[dry-run] backup ${backupPath}`);
    console.log(`[dry-run] patch ${indexPath}`);
    return;
  }
  await fs.writeFile(backupPath, await fs.readFile(indexPath));
  await fs.writeFile(indexPath, html);
  console.log(`- index.html atualizado com backup: ${path.basename(backupPath)}`);
}

async function main() {
  if (!(await exists(sourceRoot))) throw new Error(`Origem inexistente: ${sourceRoot}`);
  if (!(await exists(targetRoot))) throw new Error(`Destino inexistente: ${targetRoot}`);
  const targetStat = await fs.stat(targetRoot);
  if (!targetStat.isDirectory()) throw new Error(`Destino não é pasta: ${targetRoot}`);

  console.log(`Implantando Supabase em: ${targetRoot}`);

  await ensureDir(path.join(targetRoot, MIGRATION_DIR));
  for (const fileName of REQUIRED_MIGRATIONS) {
    await copyFileSafe(path.join(sourceRoot, MIGRATION_DIR, fileName), path.join(targetRoot, MIGRATION_DIR, fileName));
  }

  await copyFileSafe(path.join(sourceRoot, IMPORT_SCRIPT), path.join(targetRoot, IMPORT_SCRIPT));
  await writeFileSafe(path.join(targetRoot, '.env.supabase.example'), envExampleTemplate());
  await writeFileSafe(path.join(targetRoot, 'supabase/setup/supabase-runtime.js'), runtimeJsTemplate());
  await writeFileSafe(path.join(targetRoot, 'supabase/setup/supabase-configurador.html'), configuratorHtmlTemplate());
  await writeFileSafe(path.join(targetRoot, 'docs/implantacao_supabase.md'), docsTemplate());

  if (patchIndex) await patchIndexHtml();

  console.log('\nConcluído. Próximos passos no projeto de destino:');
  console.log('1. Copie .env.supabase.example para .env.local e preencha as chaves reais.');
  console.log('2. Execute as 5 migrations no SQL Editor do Supabase, na ordem indicada.');
  console.log('3. Rode: node scripts/import_spreadsheets_to_supabase.mjs');
  console.log('4. Abra o menu Configurações/Supabase e clique em Testar Conexão.');
}

main().catch((error) => {
  console.error(`Erro: ${error.message}`);
  process.exit(1);
});
