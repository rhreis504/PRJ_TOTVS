import QRCode from 'qrcode';

let Client;
let LocalAuth;
let client;
let latestQr;
let state = { connected: false, status: 'disconnected', phoneNumber: null, lastSyncAt: null };

async function loadWhatsAppWeb() {
  if (!Client || !LocalAuth) {
    const mod = await import('whatsapp-web.js');
    Client = mod.Client;
    LocalAuth = mod.LocalAuth;
  }
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

export async function connect() {
  if (process.env.WHATSAPP_MOCK === 'true') {
    latestQr = await QRCode.toDataURL('totvs-whatsapp-mock-qr');
    state = { ...state, connected: false, status: 'qr_pending' };
    return { ...state, qrDataUrl: latestQr };
  }
  await loadWhatsAppWeb();
  if (!client) {
    client = new Client({
      authStrategy: new LocalAuth({ clientId: process.env.WHATSAPP_SESSION_NAME || 'default', dataPath: process.env.WHATSAPP_AUTH_PATH || '.wwebjs_auth' }),
      puppeteer: { args: ['--no-sandbox', '--disable-setuid-sandbox'] }
    });
    client.on('qr', async (qr) => { latestQr = await QRCode.toDataURL(qr); state = { ...state, connected: false, status: 'qr_pending' }; });
    client.on('ready', () => { state = { ...state, connected: true, status: 'connected', phoneNumber: client.info?.wid?.user || null }; });
    client.on('disconnected', () => { state = { ...state, connected: false, status: 'disconnected' }; });
    await client.initialize();
  }
  return { ...state, qrDataUrl: latestQr };
}

export async function disconnect() {
  if (client) {
    await client.destroy();
    client = null;
  }
  latestQr = null;
  state = { connected: false, status: 'disconnected', phoneNumber: null, lastSyncAt: state.lastSyncAt };
  return state;
}

export function getStatus() {
  return state;
}

export async function getChats() {
  if (process.env.WHATSAPP_MOCK === 'true') {
    return [
      { id: '120363000000000000@g.us', name: 'Projeto Rossi - Implantação RH', type: 'group', participantCount: 15, enabled: false, project_id: null, can_analyze_ai: false },
      { id: '5511999999999@c.us', name: 'Bruna TOTVS NE', type: 'contact', participantCount: null, enabled: false, project_id: null, can_analyze_ai: false }
    ];
  }
  if (!client || !state.connected) return [];
  return (await client.getChats()).map(mapChat);
}

export async function fetchMessages(chatId, limit = 100) {
  if (process.env.WHATSAPP_MOCK === 'true') {
    return [
      { id: 'mock-1', timestamp: new Date('2026-05-14T09:15:00-03:00').toISOString(), senderId: '5511999999999@c.us', senderName: 'Bruna TOTVS NE', type: 'text', text: 'Bom dia, Regis. Vou validar o cronograma com o consultor.', hasMedia: false, mentionedIds: [], replyTo: null },
      { id: 'mock-2', timestamp: new Date('2026-05-14T09:42:00-03:00').toISOString(), senderId: 'me', senderName: 'Regis', type: 'text', text: 'Obrigado, fico no aguardo da validação.', hasMedia: false, mentionedIds: [], replyTo: null }
    ];
  }
  if (!client || !state.connected) return [];
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
