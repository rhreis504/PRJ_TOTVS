const { Client, LocalAuth } = require('whatsapp-web.js');
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

function getStatus() {
  return {
    ok: true,
    connected,
    initializing,
    phoneNumber,
    startedAt,
    lastQrAt,
    lastReadyAt,
    lastDisconnectedAt,
    lastError,
    authPath
  };
}

function createClient() {
  console.log('[WhatsApp] Criando client...');
  console.log('[WhatsApp] Auth path:', authPath);

  client = new Client({
    authStrategy: new LocalAuth({
      dataPath: authPath
    }),
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

  client.on('qr', (qr) => {
    lastQrAt = new Date().toISOString();
    lastError = null;
    connected = false;

    console.log('');
    console.log('====================================================');
    console.log('[WhatsApp] ESCANEIE O QR CODE ABAIXO');
    console.log('WhatsApp > Aparelhos conectados > Conectar aparelho');
    console.log('====================================================');
    console.log('');

    qrcode.generate(qr, { small: true });

    console.log('');
    console.log('Aguardando leitura do QR Code...');
    console.log('');
  });

  client.on('ready', () => {
    connected = true;
    initializing = false;
    lastReadyAt = new Date().toISOString();
    lastError = null;

    try {
      phoneNumber = client.info?.wid?.user || null;
    } catch (error) {
      phoneNumber = null;
    }

    console.log('');
    console.log('====================================================');
    console.log('[WhatsApp] CONECTADO COM SUCESSO');
    console.log('[WhatsApp] Número:', phoneNumber || 'não identificado');
    console.log('====================================================');
    console.log('');
  });

  client.on('authenticated', () => {
    lastError = null;
    console.log('[WhatsApp] Autenticado.');
  });

  client.on('auth_failure', (message) => {
    connected = false;
    initializing = false;
    lastError = message || 'Falha de autenticação.';
    console.error('[WhatsApp] Falha de autenticação:', lastError);
  });

  client.on('disconnected', (reason) => {
    connected = false;
    initializing = false;
    lastDisconnectedAt = new Date().toISOString();
    lastError = reason || null;
    console.warn('[WhatsApp] Desconectado:', reason);
  });

  return client;
}

async function startClient() {
  if (client || initializing || connected) {
    return getStatus();
  }

  startedAt = new Date().toISOString();
  initializing = true;
  lastError = null;

  createClient();

  try {
    await client.initialize();
  } catch (error) {
    initializing = false;
    connected = false;
    lastError = error.message || String(error);
    console.error('[WhatsApp] Erro ao inicializar:', error);
  }

  return getStatus();
}

async function restartClient() {
  await disconnectClient();
  return startClient();
}

async function disconnectClient() {
  if (client) {
    try {
      await client.destroy();
    } catch (error) {
      console.error('[WhatsApp] Erro ao destruir client:', error);
    }
  }

  client = null;
  connected = false;
  initializing = false;
  phoneNumber = null;
  lastDisconnectedAt = new Date().toISOString();

  return getStatus();
}

async function logoutClient() {
  if (client) {
    try {
      await client.logout();
    } catch (error) {
      console.error('[WhatsApp] Erro no logout:', error);
    }

    try {
      await client.destroy();
    } catch (error) {
      console.error('[WhatsApp] Erro ao destruir client:', error);
    }
  }

  client = null;
  connected = false;
  initializing = false;
  phoneNumber = null;
  lastDisconnectedAt = new Date().toISOString();

  return getStatus();
}

async function getChats() {
  if (!client || !connected) {
    return {
      ok: true,
      connected: false,
      chats: [],
      status: getStatus(),
      message: 'WhatsApp ainda não conectado.'
    };
  }

  const chats = await client.getChats();

  return {
    ok: true,
    connected: true,
    chats: chats.map(chat => ({
      id: chat.id?._serialized,
      name: chat.name || chat.formattedTitle || chat.id?._serialized,
      type: chat.isGroup ? 'group' : 'contact',
      participantCount: chat.isGroup ? chat.participants?.length || 0 : null
    })),
    status: getStatus()
  };
}

module.exports = {
  startClient,
  restartClient,
  logoutClient,
  disconnectClient,
  getStatus,
  getChats
};
