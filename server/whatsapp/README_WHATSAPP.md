# Serviço WhatsApp Web - Cockpit PMO

Este serviço local gera o QR Code real do WhatsApp Web para conexão com o Cockpit.

## Como executar

Abra o terminal na raiz do projeto e rode:

cd server/whatsapp
npm install
npm start

Depois acesse:

http://localhost:3031/health

O retorno esperado é:

{
  "ok": true,
  "service": "whatsapp",
  "port": 3031
}

Para gerar QR Code:

POST http://localhost:3031/connect

No PowerShell:

Invoke-RestMethod -Method Post http://localhost:3031/connect | ConvertTo-Json -Depth 5

O campo qrDataUrl deve começar com:

data:image/png;base64,

Depois abra o Cockpit e clique em:

Configurações do Sistema > Integração WhatsApp > Conectar via QR Code
