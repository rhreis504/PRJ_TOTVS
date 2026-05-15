# Cockpit WhatsApp Service

Serviço Node independente para manter a sessão do WhatsApp viva fora do ciclo de vida do `index.html`.

## Como executar pela raiz do projeto

```bash
npm run crm:wa
```

O comando acima instala as dependências do serviço em `server/whatsapp` antes de iniciar. Assim, ele também funciona em uma primeira execução após baixar o projeto.

## Como executar manualmente

```bash
cd server/whatsapp
npm install
npm start
```

O serviço sobe por padrão em `http://localhost:4545`.

## Endpoints

- `GET /health` — verifica se o serviço está online.
- `GET /status` — retorna o estado atual da conexão WhatsApp.
- `POST /connect` — inicia o client e orienta o usuário a escanear o QR exibido no terminal.
- `GET /chats` — lista conversas depois que o WhatsApp estiver conectado.
- `POST /restart` — reinicia o client preservando a sessão local.
- `POST /logout` — encerra a sessão e exige novo QR Code na próxima conexão.
- `POST /disconnect` — desconecta o client localmente preservando a pasta `auth`.

## QR Code e sessão

O QR Code real é impresso no terminal via `qrcode-terminal`. O frontend não gera QR Code no navegador e não espera imagem/DataURL do backend.

A sessão é persistida em `server/whatsapp/auth` quando o serviço é iniciado pela raiz com `npm run crm:wa` ou manualmente dentro da pasta do serviço. Essa pasta está ignorada pelo Git.
