require('dotenv').config();

const express = require('express');
const cors = require('cors');

const {
  connect,
  getStatus,
  disconnect,
  getChats
} = require('./whatsappClient');

const app = express();
const PORT = Number(process.env.WHATSAPP_PORT || 3031);

app.use(cors({
  origin: [
    'http://localhost',
    'http://localhost:3000',
    'http://localhost:5173',
    'http://127.0.0.1',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5173'
  ],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
}));

app.use(express.json({ limit: '10mb' }));

app.get('/health', (req, res) => {
  res.json({
    ok: true,
    service: 'whatsapp',
    port: PORT
  });
});

app.get('/status', (req, res) => {
  res.json(getStatus());
});

app.post('/connect', async (req, res) => {
  try {
    const result = await connect();
    res.json(result);
  } catch (error) {
    console.error('Erro em /connect:', error);
    res.status(500).json({
      message: error.message || 'Falha ao conectar WhatsApp.'
    });
  }
});

app.post('/disconnect', async (req, res) => {
  try {
    const result = await disconnect();
    res.json(result);
  } catch (error) {
    console.error('Erro em /disconnect:', error);
    res.status(500).json({
      message: error.message || 'Falha ao desconectar WhatsApp.'
    });
  }
});

app.get('/chats', async (req, res) => {
  try {
    const result = await getChats();
    res.json(result);
  } catch (error) {
    console.error('Erro em /chats:', error);
    res.status(500).json({
      message: error.message || 'Falha ao listar conversas.'
    });
  }
});


app.use((req, res) => {
  res.status(404).json({
    message: 'Rota não encontrada no serviço WhatsApp.'
  });
});

app.use((error, req, res, next) => {
  console.error('Erro inesperado no serviço WhatsApp:', error);
  res.status(500).json({
    message: error.message || 'Falha inesperada no serviço WhatsApp.'
  });
});

app.listen(PORT, () => {
  console.log(`WhatsApp history service listening on ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});
