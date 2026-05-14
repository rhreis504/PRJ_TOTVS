import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { assertProjectChat } from './authService.js';
import { createSupabaseFromEnv } from './supabaseClient.js';
import { connect, disconnect, fetchMessages, getChats, getStatus } from './whatsappClient.js';
import { exportBatches } from './exportService.js';
import { getHistory, listChatsWithProjectState, saveProjectSource, syncAuthorizedChat, updateProjectSourceAi, upsertChats } from './historyService.js';

const app = express();
const port = Number(process.env.PORT || 3031);
const supabase = await createSupabaseFromEnv();
const allowedOrigins = [/^http:\/\/localhost(?::\d+)?$/, /^http:\/\/127\.0\.0\.1(?::\d+)?$/];

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.some((pattern) => pattern.test(origin))) return callback(null, true);
    return callback(new Error('Origem não permitida pelo CORS do serviço WhatsApp.'));
  }
}));
app.use(express.json({ limit: '2mb' }));

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

app.get('/', (_req, res) => res.json({ ok: true, service: 'whatsapp', port }));

app.get('/health', (_req, res) => res.json({ ok: true, service: 'whatsapp', port }));

app.get('/status', (_req, res) => res.json(getStatus()));

app.post('/connect', asyncRoute(async (_req, res) => res.json(await connect())));

app.post('/disconnect', asyncRoute(async (_req, res) => res.json(await disconnect())));

app.get('/chats', asyncRoute(async (req, res) => {
  const status = getStatus();
  if (!status.connected) return res.json({ chats: [], status: { connected: false, status: 'not_connected' } });

  const chats = await getChats();
  await upsertChats(supabase, chats);
  return res.json({ chats: await listChatsWithProjectState(supabase, req.query.project_id, chats), status: getStatus() });
}));

app.post('/project-sources', asyncRoute(async (req, res) => {
  assertProjectChat(req.body.project_id, req.body.chat_id);
  res.json({ source: await saveProjectSource(supabase, req.body) });
}));

app.post('/project-sources/ai', asyncRoute(async (req, res) => {
  assertProjectChat(req.body.project_id, req.body.chat_id);
  res.json({ source: await updateProjectSourceAi(supabase, req.body) });
}));

app.post('/sync-chat', asyncRoute(async (req, res) => {
  assertProjectChat(req.body.project_id, req.body.chat_id);
  res.json(await syncAuthorizedChat({ supabase, projectId: req.body.project_id, chatId: req.body.chat_id, fetchMessages }));
}));

app.get('/history', asyncRoute(async (req, res) => res.json(await getHistory(supabase, req.query))));

app.get('/export', asyncRoute(async (req, res) => {
  const result = await getHistory(supabase, req.query);
  const format = req.query.format || 'json';
  const output = exportBatches(result.items, { format, filters: req.query });
  const contentTypes = { json: 'application/json', csv: 'text/csv', markdown: 'text/markdown', txt: 'text/plain' };
  res.type(contentTypes[format] || 'text/plain').send(output);
}));

app.use((_req, res) => {
  res.status(404).json({ message: 'Rota não encontrada no serviço WhatsApp.' });
});

app.use((error, _req, res, _next) => {
  const status = error.status || 500;
  console.error('[whatsapp-service]', error.message);
  res.status(status).json({ message: status >= 500 ? 'Falha controlada no serviço WhatsApp.' : error.message });
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(port, () => console.log(`WhatsApp service listening on ${port}`));
}

export default app;
