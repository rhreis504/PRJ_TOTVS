require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { connectClient, disconnectClient, getStatus } = require('./wa-client');

const app = express();
const PORT = 4545;

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS']
}));

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({
    ok: true,
    service: 'whatsapp-webjs',
    port: PORT,
    timestamp: new Date().toISOString()
  });
});

app.get('/status', (req, res) => {
  res.json(getStatus());
});

app.post('/connect', async (req, res) => {
  try {
    const status = await connectClient();

    res.json({
      ok: true,
      status
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      status: getStatus(),
      error: error.message || 'Falha ao inicializar o WhatsApp.'
    });
  }
});

app.post('/disconnect', async (req, res) => {
  try {
    await disconnectClient();

    res.json({
      ok: true
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message || 'Falha ao desconectar o WhatsApp.'
    });
  }
});

app.get('/', (req, res) => {
  res.send('<h1>WhatsApp Service Running</h1>');
});

app.listen(PORT, () => {
  console.log(`WhatsApp Service Running on http://localhost:${PORT}`);
});
