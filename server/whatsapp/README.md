# WhatsApp Service

Backend local responsável pela conexão WhatsApp do Cockpit Executivo.

## Como executar

1. Abrir terminal:

```bash
cd server/whatsapp
```

2. Instalar:

```bash
npm install
```

3. Rodar:

```bash
npm start
```

4. Abrir health check:

```text
http://localhost:4545/health
```

5. Conectar:

```text
POST http://localhost:4545/connect
```

6. Escanear QR no terminal.

## Endpoints

- `GET /health`: verifica se o serviço está ativo.
- `GET /status`: retorna o estado atual do WhatsApp.
- `POST /connect`: inicializa o client do WhatsApp e gera o QR no terminal quando necessário.
- `POST /disconnect`: destrói o client local e atualiza o status para desconectado.
- `GET /`: retorna uma página HTML simples de confirmação.
