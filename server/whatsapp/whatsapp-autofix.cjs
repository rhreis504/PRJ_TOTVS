const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
const http = require('http');
const net = require('net');

const root = __dirname;
const PORT = Number(process.env.WA_SERVICE_PORT || 4545);
const report = {
  startedAt: new Date().toISOString(),
  steps: [],
  success: false
};

const packageJsonContent = `{
  "name": "cockpit-whatsapp-service",
  "version": "1.0.0",
  "private": true,
  "main": "index.js",
  "scripts": {
    "start": "node index.js",
    "dev": "node index.js",
    "crm:wa": "node index.js",
    "doctor": "node whatsapp-doctor.cjs",
    "fix": "node whatsapp-autofix.cjs"
  },
  "dependencies": {
    "cors": "^2.8.5",
    "dotenv": "^16.4.7",
    "express": "^4.18.3",
    "qrcode-terminal": "^0.12.0",
    "whatsapp-web.js": "^1.26.0",
    "puppeteer": "^23.11.1"
  }
}
`;

const indexJsContent = `require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { startClient, restartClient, logoutClient, disconnectClient, getStatus, getChats } = require('./wa-client');
const app = express();
const PORT = Number(process.env.WA_SERVICE_PORT || 4545);
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Private-Network', 'true');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.use(cors({ origin: true, methods: ['GET', 'POST', 'OPTIONS'], allowedHeaders: ['Content-Type', 'Authorization'] }));
app.use(express.json({ limit: '10mb' }));
app.get('/health', (req, res) => res.json({ ok: true, service: 'cockpit-whatsapp-service', port: PORT, timestamp: new Date().toISOString(), cwd: process.cwd(), node: process.version, platform: process.platform }));
app.get('/status', (req, res) => res.json(getStatus()));
app.post('/connect', async (req, res) => {
  try {
    const status = await startClient();
    res.json({ ...status, message: status.connected ? 'WhatsApp já conectado.' : 'Serviço iniciado. Se necessário, escaneie o QR Code exibido no terminal.' });
  } catch (error) {
    console.error('[POST /connect] Erro:', error);
    res.status(500).json({ ok: false, message: error.message || 'Falha ao iniciar conexão WhatsApp.' });
  }
});
app.post('/restart', async (req, res) => {
  try { res.json({ ...(await restartClient()), message: 'Serviço reiniciado. Verifique o terminal para novo QR Code, se necessário.' }); }
  catch (error) { console.error('[POST /restart] Erro:', error); res.status(500).json({ ok: false, message: error.message || 'Falha ao reiniciar WhatsApp.' }); }
});
app.post('/logout', async (req, res) => {
  try { res.json({ ...(await logoutClient()), message: 'Logout realizado. Na próxima inicialização será necessário escanear novo QR Code.' }); }
  catch (error) { console.error('[POST /logout] Erro:', error); res.status(500).json({ ok: false, message: error.message || 'Falha ao fazer logout do WhatsApp.' }); }
});
app.post('/disconnect', async (req, res) => {
  try { res.json({ ...(await disconnectClient()), message: 'Client desconectado localmente. Sessão preservada.' }); }
  catch (error) { console.error('[POST /disconnect] Erro:', error); res.status(500).json({ ok: false, message: error.message || 'Falha ao desconectar WhatsApp.' }); }
});
app.get('/chats', async (req, res) => {
  try { res.json(await getChats()); }
  catch (error) { console.error('[GET /chats] Erro:', error); res.status(500).json({ ok: false, message: error.message || 'Falha ao listar conversas.' }); }
});
app.get('/diagnostics', (req, res) => res.json({ ok: true, service: 'cockpit-whatsapp-service', port: PORT, cwd: process.cwd(), node: process.version, platform: process.platform, status: getStatus() }));
app.use((req, res) => res.status(404).json({ ok: false, message: \`Rota não encontrada: \${req.method} \${req.path}\` }));
app.listen(PORT, '0.0.0.0', async () => {
  console.log('');
  console.log('====================================================');
  console.log('Cockpit WhatsApp Service rodando');
  console.log(\`Localhost: http://localhost:\${PORT}/health\`);
  console.log(\`Loopback: http://127.0.0.1:\${PORT}/health\`);
  console.log(\`Status: http://localhost:\${PORT}/status\`);
  console.log('====================================================');
  console.log('');
  try { await startClient(); }
  catch (error) { console.error('[startup] WhatsApp não inicializou, mas /health continuará ativo:', error.message); }
});
`;

const waClientContent = `const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const path = require('path');
let client = null;
let connected = false;
let initializing = false;
let startedAt = null;
let lastQrAt = null;
let lastReadyAt = null;
let lastError = null;
let lastDisconnectedAt = null;
let phoneNumber = null;
const authPath = path.resolve(__dirname, 'auth');
function getStatus() { return { ok: true, connected, initializing, phoneNumber, startedAt, lastQrAt, lastReadyAt, lastDisconnectedAt, lastError, authPath }; }
function createClient() {
  console.log('[WhatsApp] Criando client...');
  console.log('[WhatsApp] Auth path:', authPath);
  client = new Client({ authStrategy: new LocalAuth({ dataPath: authPath }), puppeteer: { headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--no-first-run', '--no-zygote'] } });
  client.on('qr', (qr) => { lastQrAt = new Date().toISOString(); lastError = null; connected = false; console.log(''); console.log('===================================================='); console.log('[WhatsApp] ESCANEIE O QR CODE ABAIXO'); console.log('WhatsApp > Aparelhos conectados > Conectar aparelho'); console.log('===================================================='); console.log(''); qrcode.generate(qr, { small: true }); console.log(''); console.log('Aguardando leitura do QR Code...'); console.log(''); });
  client.on('ready', () => { connected = true; initializing = false; lastReadyAt = new Date().toISOString(); lastError = null; try { phoneNumber = client.info?.wid?.user || null; } catch (error) { phoneNumber = null; } console.log(''); console.log('===================================================='); console.log('[WhatsApp] CONECTADO COM SUCESSO'); console.log('[WhatsApp] Número:', phoneNumber || 'não identificado'); console.log('===================================================='); console.log(''); });
  client.on('authenticated', () => { lastError = null; console.log('[WhatsApp] Autenticado.'); });
  client.on('auth_failure', (message) => { connected = false; initializing = false; lastError = message || 'Falha de autenticação.'; console.error('[WhatsApp] Falha de autenticação:', lastError); });
  client.on('disconnected', (reason) => { connected = false; initializing = false; lastDisconnectedAt = new Date().toISOString(); lastError = reason || null; console.warn('[WhatsApp] Desconectado:', reason); });
  return client;
}
async function startClient() { if (client || initializing || connected) return getStatus(); startedAt = new Date().toISOString(); initializing = true; lastError = null; createClient(); try { await client.initialize(); } catch (error) { initializing = false; connected = false; lastError = error.message || String(error); console.error('[WhatsApp] Erro ao inicializar:', error); } return getStatus(); }
async function restartClient() { await disconnectClient(); return startClient(); }
async function disconnectClient() { if (client) { try { await client.destroy(); } catch (error) { console.error('[WhatsApp] Erro ao destruir client:', error); } } client = null; connected = false; initializing = false; phoneNumber = null; lastDisconnectedAt = new Date().toISOString(); return getStatus(); }
async function logoutClient() { if (client) { try { await client.logout(); } catch (error) { console.error('[WhatsApp] Erro no logout:', error); } try { await client.destroy(); } catch (error) { console.error('[WhatsApp] Erro ao destruir client:', error); } } client = null; connected = false; initializing = false; phoneNumber = null; lastDisconnectedAt = new Date().toISOString(); return getStatus(); }
async function getChats() { if (!client || !connected) return { ok: true, connected: false, chats: [], status: getStatus(), message: 'WhatsApp ainda não conectado.' }; const chats = await client.getChats(); return { ok: true, connected: true, chats: chats.map(chat => ({ id: chat.id?._serialized, name: chat.name || chat.formattedTitle || chat.id?._serialized, type: chat.isGroup ? 'group' : 'contact', participantCount: chat.isGroup ? chat.participants?.length || 0 : null })), status: getStatus() }; }
module.exports = { startClient, restartClient, logoutClient, disconnectClient, getStatus, getChats };
`;

const readmeContent = `# Cockpit WhatsApp Service

## Diagnosticar e corrigir automaticamente

Na raiz do projeto:

npm run wa:doctor

Ou dentro da pasta:

cd server/whatsapp
node whatsapp-doctor.cjs

## Corrigir automaticamente

npm run wa:fix

## Iniciar serviço

npm run wa:start

Ou:

cd server/whatsapp
npm install
npm start

## Testar

Abra:

http://127.0.0.1:4545/health

## QR Code

Na primeira execução, o QR Code aparece no terminal.

No celular:

WhatsApp > Aparelhos conectados > Conectar aparelho

A sessão será salva em:

server/whatsapp/auth

Não apague essa pasta se quiser manter a conexão.
`;

function log(step, ok, detail = '') {
  const item = { step, ok, detail, at: new Date().toISOString() };
  report.steps.push(item);
  console.log(`${ok ? '[OK]' : '[ERRO]'} ${step}${detail ? ' - ' + detail : ''}`);
}

function writeReport() {
  fs.writeFileSync(path.join(root, 'whatsapp-doctor-report.json'), JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(root, 'whatsapp-doctor-report.txt'), report.steps.map(s => `${s.ok ? '[OK]' : '[ERRO]'} ${s.step} ${s.detail || ''}`).join('\n'));
}

function requestJson(url, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (error) {
          reject(new Error(`Resposta não JSON em ${url}: ${data.slice(0, 200)}`));
        }
      });
    });

    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error(`Timeout em ${url}`));
    });

    req.on('error', reject);
  });
}

function checkPort(host = '127.0.0.1', port = PORT, timeoutMs = 1000) {
  return new Promise(resolve => {
    const socket = net.createConnection({ host, port });
    socket.setTimeout(timeoutMs);
    socket.on('connect', () => { socket.destroy(); resolve(true); });
    socket.on('timeout', () => { socket.destroy(); resolve(false); });
    socket.on('error', () => resolve(false));
  });
}

async function waitHealth() {
  const started = Date.now();

  while (Date.now() - started < 30000) {
    try {
      const data = await requestJson(`http://127.0.0.1:${PORT}/health`, 3000);
      if (data && data.ok) return data;
    } catch (_error) {}

    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  throw new Error('Serviço não respondeu /health em até 30 segundos.');
}

function ensureFile(relativePath, content) {
  const filePath = path.join(root, relativePath);
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, content);
    log(`Arquivo ${relativePath} criado`, true);
  } else {
    log(`Arquivo ${relativePath} já existe`, true);
  }
}

function ensurePackageJson() {
  const packagePath = path.join(root, 'package.json');
  if (!fs.existsSync(packagePath)) {
    fs.writeFileSync(packagePath, packageJsonContent);
    log('package.json criado', true);
    return;
  }

  const parsed = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  parsed.scripts = {
    ...(parsed.scripts || {}),
    start: 'node index.js',
    dev: 'node index.js',
    'crm:wa': 'node index.js',
    doctor: 'node whatsapp-doctor.cjs',
    fix: 'node whatsapp-autofix.cjs'
  };
  parsed.dependencies = {
    ...(parsed.dependencies || {}),
    cors: '^2.8.5',
    dotenv: '^16.4.7',
    express: '^4.18.3',
    'qrcode-terminal': '^0.12.0',
    'whatsapp-web.js': '^1.26.0',
    puppeteer: '^23.11.1'
  };
  fs.writeFileSync(packagePath, `${JSON.stringify(parsed, null, 2)}\n`);
  log('package.json validado', true);
}

function startServiceInBackground() {
  fs.closeSync(fs.openSync(path.join(root, 'whatsapp-service.log'), 'a'));

  if (process.platform === 'win32') {
    const child = spawn('cmd.exe', ['/c', 'start-whatsapp-background.bat'], {
      cwd: root,
      detached: true,
      stdio: 'ignore',
      windowsHide: true
    });
    child.unref();
    return;
  }

  const child = spawn('sh', ['-c', 'npm start >> whatsapp-service.log 2>&1'], {
    cwd: root,
    detached: true,
    stdio: 'ignore'
  });
  child.unref();
}

async function main() {
  try {
    log('Pasta server/whatsapp localizada', true, root);

    try {
      const version = execSync('node -v', { stdio: 'pipe' }).toString().trim();
      log('Node.js encontrado', true, version);
    } catch (error) {
      throw new Error('Node.js não encontrado. Instale o Node.js LTS.');
    }

    try {
      const version = execSync('npm -v', { stdio: 'pipe' }).toString().trim();
      log('npm encontrado', true, version);
    } catch (error) {
      throw new Error('npm não encontrado. Reinstale o Node.js LTS.');
    }

    ensurePackageJson();
    ensureFile('index.js', indexJsContent);
    ensureFile('wa-client.js', waClientContent);
    ensureFile('.gitignore', 'node_modules/\n.env\nauth/\n.wwebjs_auth/\n.wwebjs_cache/\nwhatsapp-doctor-report.json\nwhatsapp-doctor-report.txt\nwhatsapp-service.log\n');
    ensureFile('README_WHATSAPP.md', readmeContent);
    ensureFile('start-whatsapp-background.bat', '@echo off\ncd /d "%~dp0"\necho Iniciando Cockpit WhatsApp Service em segundo plano...\nstart "Cockpit WhatsApp Service" /min cmd /c "npm start >> whatsapp-service.log 2>&1"\necho Serviço iniciado. Aguarde alguns segundos.\necho Teste: http://127.0.0.1:4545/health\npause\n');
    ensureFile('start-whatsapp.bat', '@echo off\ntitle Cockpit WhatsApp Service\necho ==========================================\necho Iniciando Cockpit WhatsApp Service\necho ==========================================\ncd /d "%~dp0"\necho Pasta atual:\ncd\necho.\necho Instalando dependencias...\ncall npm install\necho.\necho Iniciando servidor na porta 4545...\ncall npm start\npause\n');
    ensureFile('check-whatsapp.bat', '@echo off\ntitle Check Cockpit WhatsApp Service\ncd /d "%~dp0"\necho ==========================================\necho Rodando WhatsApp Doctor\necho ==========================================\nnode whatsapp-doctor.cjs\npause\n');

    fs.closeSync(fs.openSync(path.join(root, 'whatsapp-service.log'), 'a'));
    log('Arquivo whatsapp-service.log preparado', true);

    log('Instalando dependências com npm install', true);
    execSync('npm install', { cwd: root, stdio: 'inherit' });

    let health = null;
    try {
      health = await requestJson(`http://127.0.0.1:${PORT}/health`, 3000);
    } catch (_error) {}

    if (health && health.ok && health.service === 'cockpit-whatsapp-service') {
      log('Serviço WhatsApp já responde /health', true, JSON.stringify(health));
    } else if (await checkPort()) {
      throw new Error(`A porta ${PORT} está ocupada por outro processo ou serviço desconhecido. Libere a porta ${PORT} e execute npm run wa:doctor novamente.`);
    } else {
      log('Tentando iniciar serviço em segundo plano', true);
      startServiceInBackground();
      health = await waitHealth();
      log('/health respondeu com sucesso', true, JSON.stringify(health));
    }

    report.success = true;
    writeReport();
    console.log('\nAutofix concluído com sucesso.');
    console.log(`Abra: http://127.0.0.1:${PORT}/health`);
  } catch (error) {
    log('Autofix falhou', false, error.message);
    report.success = false;
    writeReport();
    console.error('\nAutofix falhou:', error.message);
    process.exit(1);
  }
}

main();
