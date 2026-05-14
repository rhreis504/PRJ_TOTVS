import { createRequire } from 'node:module';
import qrcode from 'qrcode';

const require = createRequire(import.meta.url);

let Client;
let LocalAuth;
let client = null;
let clientInitializing = false;
let lastQrDataUrl = null;
let connectedPhoneNumber = null;
let connectionStatus = 'not_initialized';
let qrWaiters = [];

async function loadWhatsAppWeb() {
  if (!Client || !LocalAuth) {
    const mod = require('whatsapp-web.js');
    Client = mod.Client;
    LocalAuth = mod.LocalAuth;
  }
}

function notifyQrWaiters() {
  qrWaiters.splice(0).forEach((resolve) => resolve(lastQrDataUrl));
}

function waitForQr(timeoutMs = 15000) {
  if (lastQrDataUrl) return Promise.resolve(lastQrDataUrl);
  if (connectionStatus === 'connected') return Promise.resolve(null);
  return new Promise((resolve) => {
    const timer = globalThis.setTimeout(() => {
      qrWaiters = qrWaiters.filter((waiter) => waiter !== done);
      resolve(null);
    }, timeoutMs);
    const done = (qr) => {
      globalThis.clearTimeout(timer);
      resolve(qr);
    };
    qrWaiters.push(done);
  });
}

function setDisconnected(status = 'not_connected') {
  connectionStatus = status;
  connectedPhoneNumber = null;
}

function getPhoneNumberFromClient() {
  return client?.info?.wid?.user || client?.info?.me?.user || connectedPhoneNumber || null;
}

function buildClient() {
  const sessionName = process.env.WHATSAPP_SESSION_NAME || 'totvs-cockpit';
  client = new Client({
    authStrategy: new LocalAuth({
      clientId: sessionName,
      dataPath: process.env.WHATSAPP_AUTH_PATH || '.wwebjs_auth'
    }),
    puppeteer: {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    }
  });

  client.on('qr', async (qr) => {
    try {
      lastQrDataUrl = await qrcode.toDataURL(qr);
      connectionStatus = 'qr_ready';
      notifyQrWaiters();
    } catch (error) {
      connectionStatus = 'qr_error';
      notifyQrWaiters();
      console.error('[whatsapp-service] Failed to generate QR data URL:', error.message);
    }
  });

  client.on('authenticated', () => {
    connectionStatus = 'authenticated';
  });

  client.on('ready', () => {
    connectedPhoneNumber = getPhoneNumberFromClient();
    connectionStatus = 'connected';
    lastQrDataUrl = null;
    notifyQrWaiters();
  });

  client.on('auth_failure', (message) => {
    setDisconnected('auth_failure');
    lastQrDataUrl = null;
    notifyQrWaiters();
    console.error('[whatsapp-service] Authentication failure:', message);
  });

  client.on('disconnected', (reason) => {
    setDisconnected('disconnected');
    lastQrDataUrl = null;
    client = null;
    clientInitializing = false;
    console.warn('[whatsapp-service] Client disconnected:', reason);
  });

  return client;
}

async function ensureClient() {
  if (client || clientInitializing) return;
  await loadWhatsAppWeb();
  connectionStatus = 'initializing';
  const createdClient = buildClient();
  clientInitializing = true;
  createdClient.initialize()
    .then(() => { clientInitializing = false; })
    .catch((error) => {
      clientInitializing = false;
      client = null;
      lastQrDataUrl = null;
      setDisconnected('initialize_error');
      notifyQrWaiters();
      console.error('[whatsapp-service] Failed to initialize WhatsApp client:', error.message);
    });
}

export function getStatus() {
  const connected = connectionStatus === 'connected';
  return {
    connected,
    status: connected ? 'connected' : (connectionStatus === 'not_initialized' ? 'not_connected' : connectionStatus),
    phoneNumber: connected ? getPhoneNumberFromClient() : null,
    hasQr: Boolean(lastQrDataUrl),
    lastSyncAt: null
  };
}

export async function connect() {
  await ensureClient();

  if (connectionStatus === 'connected') {
    return { ...getStatus(), qrDataUrl: null };
  }

  if (!lastQrDataUrl) {
    connectionStatus = connectionStatus === 'not_initialized' ? 'waiting_qr' : connectionStatus;
    await waitForQr(Number(process.env.WHATSAPP_QR_WAIT_MS || 15000));
  }

  if (connectionStatus === 'connected') {
    return { ...getStatus(), qrDataUrl: null };
  }

  const status = getStatus();
  const waitingStatuses = ['not_connected', 'not_initialized', 'initializing', 'waiting_qr'];
  return {
    ...status,
    status: lastQrDataUrl ? 'qr_ready' : (waitingStatuses.includes(status.status) ? 'waiting_qr' : status.status),
    qrDataUrl: lastQrDataUrl
  };
}

export async function disconnect() {
  const activeClient = client;
  client = null;
  clientInitializing = false;
  lastQrDataUrl = null;
  setDisconnected('not_connected');

  if (activeClient) {
    try {
      await activeClient.logout();
    } catch {
      // The client can be unauthenticated while a QR is pending; destroy still releases resources.
    }
    await activeClient.destroy();
  }

  return getStatus();
}

function mapChat(chat) {
  return {
    id: chat.id?._serialized || chat.id || '',
    name: chat.name || chat.formattedTitle || chat.id?.user || 'Sem nome',
    type: chat.isGroup ? 'group' : 'contact',
    participantCount: chat.participants?.length || null,
    enabled: false,
    project_id: null,
    can_analyze_ai: false
  };
}

export async function getChats() {
  if (!client || connectionStatus !== 'connected') return [];
  return (await client.getChats()).map(mapChat);
}

export async function fetchMessages(chatId, limit = 100) {
  if (!client || connectionStatus !== 'connected') return [];
  const chat = await client.getChatById(chatId);
  const messages = await chat.fetchMessages({ limit });
  return messages.map((message) => ({
    id: message.id?._serialized || '',
    timestamp: new Date((message.timestamp || 0) * 1000).toISOString(),
    senderId: message.author || message.from || '',
    senderName: message._data?.notifyName || message.author || message.from || '',
    type: message.type || 'text',
    text: message.body || '',
    hasMedia: Boolean(message.hasMedia),
    mentionedIds: message.mentionedIds || [],
    replyTo: message.hasQuotedMsg ? message._data?.quotedStanzaID || null : null
  }));
}
