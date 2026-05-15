process.chdir(__dirname);
require('dotenv').config();

const express = require('express');
const cors = require('cors');

const {
  startClient,
  restartClient,
  logoutClient,
  getStatus,
  getChats
} = require('./wa-client');

const app = express();
const PORT = Number(process.env.WA_SERVICE_PORT || process.env.WHATSAPP_PORT || 4545);

app.use(cors({
  origin: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
}));

app.use(express.json({ limit: '10mb' }));

app.get('/health', (req, res) => {
  res.json({
    ok: true,
    service: 'cockpit-whatsapp-service',
    port: PORT,
    timestamp: new Date().toISOString()
  });
});

app.get('/status', (req, res) => {
  res.json(getStatus());
});

app.post('/connect', async (req, res) => {
  try {
    const status = await startClient();

    res.json({
      ...status,
      message: status.connected
        ? 'WhatsApp já conectado.'
        : 'Serviço iniciado. Se ainda não estiver conectado, escaneie o QR Code exibido no terminal.'
    });
  } catch (error) {
    console.error('[POST /connect] Erro:', error);
    res.status(500).json({
      ok: false,
      message: error.message || 'Falha ao iniciar conexão WhatsApp.'
    });
  }
});

app.post('/restart', async (req, res) => {
  try {
    const status = await restartClient();
    res.json({
      ...status,
      message: 'Serviço reiniciado. Verifique o terminal para novo QR Code, se necessário.'
    });
  } catch (error) {
    console.error('[POST /restart] Erro:', error);
    res.status(500).json({
      ok: false,
      message: error.message || 'Falha ao reiniciar WhatsApp.'
    });
  }
});

app.post('/logout', async (req, res) => {
  try {
    const status = await logoutClient({ keepAuth: false });
    res.json({
      ...status,
      message: 'Logout realizado. Na próxima inicialização será necessário escanear novo QR Code.'
    });
  } catch (error) {
    console.error('[POST /logout] Erro:', error);
    res.status(500).json({
      ok: false,
      message: error.message || 'Falha ao fazer logout do WhatsApp.'
    });
  }
});

app.post('/disconnect', async (req, res) => {
  try {
    const status = await logoutClient({ keepAuth: true });
    res.json({
      ...status,
      message: 'Client desconectado localmente. A sessão auth foi preservada.'
    });
  } catch (error) {
    console.error('[POST /disconnect] Erro:', error);
    res.status(500).json({
      ok: false,
      message: error.message || 'Falha ao desconectar WhatsApp.'
    });
  }
});

app.get('/chats', async (req, res) => {
  try {
    const result = await getChats();
    res.json(result);
  } catch (error) {
    console.error('[GET /chats] Erro:', error);
    res.status(500).json({
      ok: false,
      message: error.message || 'Falha ao listar conversas.'
    });
  }
});

app.get('/events', (req, res) => {
  res.json({
    ok: true,
    status: getStatus(),
    events: []
  });
});

app.use((req, res) => {
  res.status(404).json({
    ok: false,
    message: `Rota não encontrada: ${req.method} ${req.path}`
  });
});

app.listen(PORT, async () => {
  console.log('');
  console.log('====================================================');
  console.log(`Cockpit WhatsApp Service rodando em http://localhost:${PORT}`);
  console.log(`Health: http://localhost:${PORT}/health`);
  console.log(`Status: http://localhost:${PORT}/status`);
  console.log('====================================================');
  console.log('');

  await startClient();
});
