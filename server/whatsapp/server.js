require('dotenv').config();

const express = require('express');
const cors = require('cors');

const {
  connectWhatsapp,
  getWhatsappStatus,
  disconnectWhatsapp,
  getWhatsappChats
} = require('./whatsappClient');

const app = express();
const PORT = Number(process.env.WHATSAPP_PORT || 3031);

app.use(cors({
  origin: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
}));

app.use(express.json({ limit: '10mb' }));

app.get('/health', (req, res) => {
  res.json({
    ok: true,
    service: 'whatsapp',
    port: PORT,
    timestamp: new Date().toISOString()
  });
});

app.get('/status', (req, res) => {
  res.json(getWhatsappStatus());
});

app.post('/connect', async (req, res) => {
  try {
    const result = await connectWhatsapp();
    res.json(result);
  } catch (error) {
    console.error('[POST /connect] Erro:', error);
    res.status(500).json({
      ok: false,
      message: error.message || 'Falha ao conectar WhatsApp.'
    });
  }
});

app.post('/disconnect', async (req, res) => {
  try {
    const result = await disconnectWhatsapp();
    res.json(result);
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
    const result = await getWhatsappChats();
    res.json(result);
  } catch (error) {
    console.error('[GET /chats] Erro:', error);
    res.status(500).json({
      ok: false,
      message: error.message || 'Falha ao listar conversas.'
    });
  }
});

app.use((req, res) => {
  res.status(404).json({
    ok: false,
    message: `Rota não encontrada: ${req.method} ${req.path}`
  });
});

app.listen(PORT, () => {
  console.log('====================================================');
  console.log(`WhatsApp service running on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log('====================================================');
});
