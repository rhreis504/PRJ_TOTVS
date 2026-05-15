const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const state = {
  connected: false,
  status: 'initializing',
  lastQrAt: null,
  lastError: null,
  phoneNumber: null,
  startedAt: new Date().toISOString()
};

let client = null;
let initialized = false;

function updateState(patch) {
  Object.assign(state, patch);
}

function getPhoneNumber() {
  try {
    return client?.info?.wid?.user || client?.info?.me?.user || null;
  } catch (error) {
    return null;
  }
}

function createClient() {
  client = new Client({
    authStrategy: new LocalAuth({
      dataPath: './auth'
    }),
    puppeteer: {
      headless: true
    }
  });

  client.on('qr', (qr) => {
    updateState({
      connected: false,
      status: 'qr',
      lastQrAt: new Date().toISOString(),
      lastError: null
    });

    console.log('');
    console.log('Escaneie o QR Code abaixo para conectar o WhatsApp:');
    qrcode.generate(qr, { small: true });
    console.log('');
  });

  client.on('ready', () => {
    updateState({
      connected: true,
      status: 'connected',
      lastError: null,
      phoneNumber: getPhoneNumber()
    });

    console.log('[WhatsApp] Conectado com sucesso.');
    console.log(`[WhatsApp] Número: ${state.phoneNumber || 'não identificado'}`);
  });

  client.on('auth_failure', (message) => {
    updateState({
      connected: false,
      status: 'auth_failure',
      lastError: message || 'Falha de autenticação.',
      phoneNumber: null
    });

    console.error('[WhatsApp] Falha de autenticação:', state.lastError);
  });

  client.on('disconnected', (reason) => {
    updateState({
      connected: false,
      status: 'disconnected',
      lastError: reason || null,
      phoneNumber: null
    });

    initialized = false;
    client = null;
    console.warn('[WhatsApp] Desconectado:', reason || 'sem motivo informado');
  });

  return client;
}

async function connectClient() {
  if (!client) {
    createClient();
  }

  if (!initialized) {
    initialized = true;
    updateState({
      status: 'initializing',
      lastError: null
    });

    try {
      await client.initialize();
    } catch (error) {
      initialized = false;
      updateState({
        connected: false,
        status: 'error',
        lastError: error.message || String(error),
        phoneNumber: null
      });
      throw error;
    }
  }

  return getStatus();
}

async function disconnectClient() {
  if (client) {
    await client.destroy();
  }

  client = null;
  initialized = false;
  updateState({
    connected: false,
    status: 'disconnected',
    phoneNumber: null
  });

  return getStatus();
}

function getStatus() {
  return { ...state };
}

module.exports = {
  connectClient,
  disconnectClient,
  getStatus
};
