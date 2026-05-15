const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');

let client = null;
let initializing = false;
let lastQrDataUrl = null;
let connected = false;
let status = 'disconnected';
let phoneNumber = null;
let lastError = null;
let lastQrAt = null;
let lastConnectedAt = null;
let lastDisconnectedAt = null;

function buildStatus(extra = {}) {
  return {
    ok: true,
    connected,
    status,
    phoneNumber,
    hasQr: Boolean(lastQrDataUrl),
    qrDataUrl: lastQrDataUrl,
    lastQrAt,
    lastConnectedAt,
    lastDisconnectedAt,
    lastError,
    ...extra
  };
}

function createClient() {
  console.log('[WhatsApp] Criando client...');

  client = new Client({
    authStrategy: new LocalAuth({
      clientId: 'totvs-cockpit'
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
      connected = false;
      status = 'qr_ready';
      lastQrAt = new Date().toISOString();
      lastError = null;

      console.log('[WhatsApp] QR Code real gerado.');
    } catch (error) {
      lastError = error.message;
      status = 'error';
      console.error('[WhatsApp] Falha ao converter QR Code:', error);
    }
  });

  client.on('authenticated', () => {
    status = 'authenticated';
    lastError = null;
    console.log('[WhatsApp] Autenticado.');
  });

  client.on('auth_failure', (message) => {
    connected = false;
    status = 'auth_failure';
    lastError = message || 'Falha de autenticação.';
    console.error('[WhatsApp] Falha de autenticação:', message);
  });

  client.on('ready', () => {
    connected = true;
    status = 'connected';
    lastQrDataUrl = null;
    lastConnectedAt = new Date().toISOString();
    lastError = null;

    try {
      phoneNumber = client.info?.wid?.user || null;
    } catch (error) {
      phoneNumber = null;
    }

    console.log('[WhatsApp] Conectado com sucesso.');
    console.log('[WhatsApp] Número:', phoneNumber || 'não identificado');
  });

  client.on('disconnected', (reason) => {
    connected = false;
    status = 'disconnected';
    lastQrDataUrl = null;
    initializing = false;
    lastDisconnectedAt = new Date().toISOString();

    console.log('[WhatsApp] Desconectado:', reason);
  });

  return client;
}

async function connectWhatsapp() {
  console.log('[WhatsApp] Solicitação de conexão recebida.');

  if (connected) {
    console.log('[WhatsApp] Já conectado.');
    return buildStatus();
  }

  if (!client) {
    createClient();
  }

  if (!initializing) {
    initializing = true;
    status = 'initializing';
    lastError = null;

    console.log('[WhatsApp] Inicializando client...');

    client.initialize().catch((error) => {
      console.error('[WhatsApp] Erro ao inicializar:', error);
      status = 'error';
      lastError = error.message || String(error);
      initializing = false;
    });
  } else {
    console.log('[WhatsApp] Client já está inicializando.');
  }

  const startedAt = Date.now();
  const timeoutMs = 30000;

  while (!lastQrDataUrl && !connected && status !== 'error' && Date.now() - startedAt < timeoutMs) {
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  if (!lastQrDataUrl && !connected && status !== 'error') {
    console.log('[WhatsApp] QR ainda não disponível após timeout inicial.');
    return buildStatus({
      status: status || 'waiting_qr',
      message: 'QR Code ainda não disponível. Consulte /status ou chame /connect novamente.'
    });
  }

  return buildStatus();
}

function getWhatsappStatus() {
  return buildStatus();
}

async function disconnectWhatsapp() {
  console.log('[WhatsApp] Solicitação de desconexão recebida.');

  if (client) {
    try {
      await client.destroy();
    } catch (error) {
      console.error('[WhatsApp] Erro ao destruir client:', error);
    }
  }

  client = null;
  initializing = false;
  lastQrDataUrl = null;
  connected = false;
  status = 'disconnected';
  phoneNumber = null;
  lastDisconnectedAt = new Date().toISOString();

  return buildStatus();
}

async function getWhatsappChats() {
  if (!client || !connected) {
    return {
      ok: true,
      chats: [],
      status: buildStatus({
        message: 'WhatsApp ainda não conectado.'
      })
    };
  }

  const chats = await client.getChats();

  return {
    ok: true,
    chats: chats.map(chat => ({
      id: chat.id?._serialized,
      name: chat.name || chat.formattedTitle || chat.id?._serialized,
      type: chat.isGroup ? 'group' : 'contact',
      participantCount: chat.isGroup ? chat.participants?.length || 0 : null
    })),
    status: buildStatus()
  };
}

module.exports = {
  connectWhatsapp,
  getWhatsappStatus,
  disconnectWhatsapp,
  getWhatsappChats
};
