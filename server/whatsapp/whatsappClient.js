const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');

let client = null;
let initializing = false;
let lastQrDataUrl = null;
let connected = false;
let status = 'disconnected';
let phoneNumber = null;

function createClient() {
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
    lastQrDataUrl = await qrcode.toDataURL(qr);
    connected = false;
    status = 'qr_ready';
    console.log('QR Code real do WhatsApp gerado.');
  });

  client.on('authenticated', () => {
    status = 'authenticated';
    console.log('WhatsApp autenticado.');
  });

  client.on('ready', async () => {
    connected = true;
    status = 'connected';
    lastQrDataUrl = null;

    try {
      const info = client.info;
      phoneNumber = info?.wid?.user || null;
    } catch (error) {
      phoneNumber = null;
    }

    console.log('WhatsApp conectado com sucesso.');
  });

  client.on('auth_failure', (message) => {
    connected = false;
    status = 'auth_failure';
    lastQrDataUrl = null;
    console.error('Falha de autenticação WhatsApp:', message);
  });

  client.on('disconnected', (reason) => {
    connected = false;
    status = 'disconnected';
    lastQrDataUrl = null;
    initializing = false;
    console.log('WhatsApp desconectado:', reason);
  });

  return client;
}

async function connect() {
  if (connected) {
    return getStatus();
  }

  if (!client) {
    createClient();
  }

  if (!initializing) {
    initializing = true;
    status = 'initializing';

    client.initialize()
      .catch((error) => {
        console.error('Falha ao inicializar WhatsApp:', error);
        status = 'error';
        initializing = false;
        client = null;
      });
  }

  const startedAt = Date.now();

  while (!lastQrDataUrl && !connected && Date.now() - startedAt < 20000) {
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  return {
    connected,
    status: connected ? 'connected' : (lastQrDataUrl ? 'qr_ready' : status),
    phoneNumber,
    hasQr: Boolean(lastQrDataUrl),
    qrDataUrl: lastQrDataUrl
  };
}

function getStatus() {
  return {
    connected,
    status,
    phoneNumber,
    hasQr: Boolean(lastQrDataUrl),
    qrDataUrl: lastQrDataUrl
  };
}

async function disconnect() {
  if (client) {
    try {
      await client.destroy();
    } catch (error) {
      console.error('Erro ao destruir client WhatsApp:', error);
    }
  }

  client = null;
  initializing = false;
  lastQrDataUrl = null;
  connected = false;
  status = 'disconnected';
  phoneNumber = null;

  return getStatus();
}

async function getChats() {
  if (!client || !connected) {
    return {
      chats: [],
      status: getStatus()
    };
  }

  const chats = await client.getChats();

  return {
    chats: chats.map(chat => ({
      id: chat.id?._serialized,
      name: chat.name || chat.formattedTitle || chat.id?._serialized,
      type: chat.isGroup ? 'group' : 'contact',
      participantCount: chat.isGroup ? chat.participants?.length || 0 : null,
      enabled: false,
      project_id: null,
      can_analyze_ai: false
    })),
    status: getStatus()
  };
}

module.exports = {
  connect,
  getStatus,
  disconnect,
  getChats
};
