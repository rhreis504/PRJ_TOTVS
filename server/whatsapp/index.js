require('dotenv').config();

const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const { startClient, restartClient, logoutClient, disconnectClient, getStatus, getChats, getChatMessages } = require('./wa-client');

const app = express();
const PORT = Number(process.env.WA_SERVICE_PORT || 4545);
const dataDir = path.join(__dirname, 'data');
const storePath = path.join(dataDir, 'store.json');

function ensureDataDir() {
  fs.mkdirSync(dataDir, { recursive: true });
}

function readStore() {
  ensureDataDir();
  if (!fs.existsSync(storePath)) return { projectSources: [], history: [] };
  try {
    const parsed = JSON.parse(fs.readFileSync(storePath, 'utf8'));
    return {
      projectSources: Array.isArray(parsed.projectSources) ? parsed.projectSources : [],
      history: Array.isArray(parsed.history) ? parsed.history : []
    };
  } catch (_error) {
    return { projectSources: [], history: [] };
  }
}

function writeStore(store) {
  ensureDataDir();
  fs.writeFileSync(storePath, JSON.stringify(store, null, 2));
}

function asyncRoute(handler) {
  return (req, res) => Promise.resolve(handler(req, res)).catch(error => {
    console.error(`[${req.method} ${req.path}]`, error);
    res.status(500).json({ ok: false, message: error.message || 'Falha no serviço WhatsApp.' });
  });
}

function statusWithOk(extra = {}) {
  return { ok: true, ...getStatus(), ...extra };
}

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

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'cockpit-whatsapp-service',
    port: PORT,
    timestamp: new Date().toISOString(),
    cwd: process.cwd(),
    node: process.version,
    platform: process.platform
  });
});

app.get('/status', (_req, res) => res.json(statusWithOk()));
app.get('/qr', (_req, res) => res.json({ ok: true, qr: getStatus().lastQr, qrDataUrl: getStatus().lastQrDataUrl, status: getStatus() }));

app.post('/connect', asyncRoute(async (_req, res) => {
  const status = await startClient();
  res.json({ ...status, message: status.connected ? 'WhatsApp conectado.' : 'Serviço iniciado. Escaneie o QR Code quando ele aparecer.' });
}));

app.post('/restart', asyncRoute(async (_req, res) => res.json({ ...(await restartClient()), message: 'Serviço reiniciado.' })));
app.post('/logout', asyncRoute(async (_req, res) => res.json({ ...(await logoutClient()), message: 'Logout realizado.' })));
app.post('/disconnect', asyncRoute(async (_req, res) => res.json({ ...(await disconnectClient()), message: 'WhatsApp desconectado.' })));

app.get('/chats', asyncRoute(async (req, res) => {
  const result = await getChats();
  const store = readStore();
  const projectId = String(req.query.project_id || '');
  const sourcesByChat = new Map(store.projectSources
    .filter(source => !projectId || source.project_id === projectId)
    .map(source => [source.chat_id, source]));
  const chats = result.chats.map(chat => ({ ...chat, ...(sourcesByChat.get(chat.id) || {}) }));
  res.json({ ...result, chats });
}));

app.post('/project-sources', (req, res) => {
  const body = req.body || {};
  const projectId = String(body.project_id || '').trim();
  const chatId = String(body.chat_id || '').trim();
  if (!projectId || !chatId) return res.status(400).json({ ok: false, message: 'project_id e chat_id são obrigatórios.' });

  const store = readStore();
  const next = {
    project_id: projectId,
    chat_id: chatId,
    wa_chat_id: chatId,
    chat_name: body.chat_name || chatId,
    name: body.chat_name || chatId,
    type: body.chat_type || body.type || 'contact',
    enabled: Boolean(body.enabled),
    can_analyze_ai: Boolean(body.can_analyze_ai),
    capture_from: body.capture_from || new Date().toISOString(),
    retention_days: Number(body.retention_days || 365),
    updated_at: new Date().toISOString()
  };
  const index = store.projectSources.findIndex(source => source.project_id === projectId && source.chat_id === chatId);
  if (index >= 0) store.projectSources[index] = { ...store.projectSources[index], ...next };
  else store.projectSources.push(next);
  writeStore(store);
  res.json({ ok: true, source: next });
});

app.post('/project-sources/ai', (req, res) => {
  const { project_id: projectId, chat_id: chatId, can_analyze_ai: canAnalyzeAi } = req.body || {};
  const store = readStore();
  const source = store.projectSources.find(item => item.project_id === projectId && item.chat_id === chatId);
  if (!source) return res.status(404).json({ ok: false, message: 'Fonte não encontrada para este projeto.' });
  source.can_analyze_ai = Boolean(canAnalyzeAi);
  source.updated_at = new Date().toISOString();
  writeStore(store);
  res.json({ ok: true, source });
});

app.post('/sync-chat', asyncRoute(async (req, res) => {
  const projectId = String(req.body?.project_id || '').trim();
  const chatId = String(req.body?.chat_id || '').trim();
  const limit = Number(req.body?.limit || 100);
  const store = readStore();
  const source = store.projectSources.find(item => item.project_id === projectId && item.chat_id === chatId && item.enabled);
  if (!source) return res.json({ ok: true, skipped: true, message: 'Fonte não autorizada para este projeto.' });

  const messages = await getChatMessages(chatId, limit);
  let inserted = 0;
  for (const message of messages) {
    const id = message.id || `${chatId}-${message.timestamp}-${message.body.slice(0, 20)}`;
    const item = {
      ...message,
      id,
      project_id: projectId,
      source_id: chatId,
      chat_name: source.chat_name || source.name || chatId,
      source_name: source.chat_name || source.name || chatId,
      synced_at: new Date().toISOString()
    };
    const index = store.history.findIndex(existing => existing.id === id && existing.project_id === projectId);
    if (index >= 0) store.history[index] = { ...store.history[index], ...item };
    else { store.history.push(item); inserted += 1; }
  }
  writeStore(store);
  res.json({ ok: true, skipped: false, inserted, total: messages.length, items: messages });
}));

app.get('/history', (req, res) => {
  const store = readStore();
  const projectId = String(req.query.project_id || '');
  const sourceId = String(req.query.source_id || '');
  const search = String(req.query.search || '').toLowerCase();
  const type = String(req.query.type || 'all');
  const start = req.query.start ? new Date(String(req.query.start)) : null;
  const end = req.query.end ? new Date(String(req.query.end)) : null;

  const items = store.history.filter(item => {
    if (projectId && item.project_id !== projectId) return false;
    if (sourceId && item.source_id !== sourceId) return false;
    if (type !== 'all' && item.type !== type) return false;
    if (search && ![item.body, item.chat_name, item.author, item.from].some(value => String(value || '').toLowerCase().includes(search))) return false;
    const when = new Date(item.timestamp || item.synced_at || 0);
    if (start && when < start) return false;
    if (end) {
      const endOfDay = new Date(end);
      endOfDay.setHours(23, 59, 59, 999);
      if (when > endOfDay) return false;
    }
    return true;
  }).sort((a, b) => String(b.timestamp || '').localeCompare(String(a.timestamp || '')));

  const sources = Array.from(new Set(items.map(item => item.source_id))).length;
  res.json({ ok: true, items, total: items.length, sources, messages: items.length, lastSyncAt: getStatus().lastSyncAt });
});

app.get('/export', (req, res) => {
  const store = readStore();
  const projectId = String(req.query.project_id || '');
  const items = projectId ? store.history.filter(item => item.project_id === projectId) : store.history;
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="whatsapp-history.csv"');
  res.write('project_id,source_id,timestamp,author,type,body\n');
  for (const item of items) {
    const row = [item.project_id, item.source_id, item.timestamp, item.author, item.type, item.body]
      .map(value => `"${String(value || '').replace(/"/g, '""')}"`).join(',');
    res.write(`${row}\n`);
  }
  res.end();
});

app.get('/', (_req, res) => res.type('html').send(`<h1>Cockpit WhatsApp Service Running</h1><p><a href="/health">/health</a></p>`));

app.listen(PORT, () => {
  ensureDataDir();
  console.log(`Cockpit WhatsApp Service running on http://localhost:${PORT}`);
  console.log(`Health: http://localhost:${PORT}/health`);
});
