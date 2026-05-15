const path = require('path');
const qrcodeTerminal = require('qrcode-terminal');

let Client;
let LocalAuth;
try {
  ({ Client, LocalAuth } = require('whatsapp-web.js'));
} catch (error) {
  const installError = new Error('Dependências do WhatsApp não instaladas. Execute npm run crm:wa na raiz do projeto para instalar e iniciar automaticamente.');
  installError.cause = error;
  throw installError;
}

const state = {
  ok: true,
  connected: false,
  status: 'stopped',
  lastQrAt: null,
  lastQr: null,
  lastQrDataUrl: null,
  lastError: null,
  phoneNumber: null,
  startedAt: new Date().toISOString(),
  lastSyncAt: null,
  totalGroups: 0,
  totalContacts: 0
};

let client = null;
let initializingPromise = null;

function updateState(patch) {
  Object.assign(state, patch, { ok: true });
}

function getPhoneNumber() {
  try {
    return client?.info?.wid?.user || client?.info?.me?.user || client?.info?.phone?.wa_version || null;
  } catch (_error) {
    return null;
  }
}

function normalizeChat(chat) {
  const id = chat?.id?._serialized || chat?.id?.user || chat?.id || '';
  return {
    id,
    wa_chat_id: id,
    name: chat?.name || chat?.formattedTitle || chat?.pushname || id,
    chat_name: chat?.name || chat?.formattedTitle || chat?.pushname || id,
    type: chat?.isGroup ? 'group' : 'contact',
    participantCount: chat?.isGroup ? (chat?.participants?.length || 0) : null
  };
}

async function refreshChatCounters() {
  if (!client || !state.connected) return;
  try {
    const chats = await client.getChats();
    updateState({
      totalGroups: chats.filter(chat => chat.isGroup).length,
      totalContacts: chats.filter(chat => !chat.isGroup).length,
      lastSyncAt: new Date().toISOString()
    });
  } catch (error) {
    updateState({ lastError: error.message || String(error) });
  }
}

function createClient() {
  client = new Client({
    authStrategy: new LocalAuth({ dataPath: path.join(__dirname, 'auth') }),
    puppeteer: {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
        '--no-zygote'
      ]
    }
  });

  client.on('qr', async (qr) => {
    updateState({
      connected: false,
      status: 'qr',
      lastQrAt: new Date().toISOString(),
      lastQr: qr,
      lastError: null,
      phoneNumber: null
    });

    console.log('\nEscaneie o QR Code abaixo para conectar o WhatsApp:');
    qrcodeTerminal.generate(qr, { small: true });
    console.log('\nO Cockpit avisará quando este QR Code estiver pronto para escanear.\n');
  });

  client.on('ready', async () => {
    updateState({
      connected: true,
      status: 'connected',
      lastQr: null,
      lastQrDataUrl: null,
      lastError: null,
      phoneNumber: getPhoneNumber()
    });
    await refreshChatCounters();
    console.log('[WhatsApp] Conectado com sucesso.');
  });

  client.on('authenticated', () => updateState({ status: 'authenticated', lastError: null }));
  client.on('loading_screen', (_percent, message) => updateState({ status: message || 'loading' }));
  client.on('auth_failure', (message) => updateState({ connected: false, status: 'auth_failure', lastError: message || 'Falha de autenticação.', phoneNumber: null }));
  client.on('disconnected', (reason) => {
    updateState({ connected: false, status: 'disconnected', lastError: reason || null, phoneNumber: null });
    initializingPromise = null;
    client = null;
  });

  return client;
}

async function startClient() {
  if (state.connected) return getStatus();
  if (initializingPromise) return getStatus();
  if (!client) createClient();

  updateState({ status: 'initializing', lastError: null });
  initializingPromise = client.initialize()
    .then(() => { initializingPromise = null; return getStatus(); })
    .catch((error) => {
      updateState({ connected: false, status: 'error', lastError: error.message || String(error), phoneNumber: null });
      initializingPromise = null;
      console.error('[WhatsApp] Falha ao inicializar:', error);
    });

  return getStatus();
}

async function disconnectClient() {
  if (client) await client.destroy();
  client = null;
  initializingPromise = null;
  updateState({ connected: false, status: 'disconnected', phoneNumber: null, lastQr: null, lastQrDataUrl: null });
  return getStatus();
}

async function logoutClient() {
  if (client) {
    try { await client.logout(); } catch (_error) {}
  }
  return disconnectClient();
}

async function restartClient() {
  await disconnectClient();
  return startClient();
}

async function getChats() {
  if (!client || !state.connected) return { ok: true, connected: false, chats: [], status: getStatus(), message: 'WhatsApp ainda não conectado.' };
  const chats = (await client.getChats()).map(normalizeChat);
  updateState({ totalGroups: chats.filter(c => c.type === 'group').length, totalContacts: chats.filter(c => c.type !== 'group').length, lastSyncAt: new Date().toISOString() });
  return { ok: true, connected: true, chats, status: getStatus() };
}

async function getChatMessages(chatId, limit = 50) {
  if (!client || !state.connected) return [];
  const chat = await client.getChatById(chatId);
  const messages = await chat.fetchMessages({ limit: Math.max(1, Math.min(Number(limit) || 50, 500)) });
  return messages.map(message => ({
    id: message.id?._serialized || message.id?.id || '',
    wa_message_id: message.id?._serialized || message.id?.id || '',
    chat_id: chatId,
    from: message.from,
    to: message.to,
    author: message.author || message.from,
    body: message.body || '',
    type: message.type || 'chat',
    timestamp: message.timestamp ? new Date(message.timestamp * 1000).toISOString() : new Date().toISOString(),
    fromMe: Boolean(message.fromMe)
  }));
}

function getStatus() {
  return { ...state };
}

module.exports = { startClient, restartClient, logoutClient, disconnectClient, getStatus, getChats, getChatMessages };
