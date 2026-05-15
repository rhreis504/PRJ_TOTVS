# Cockpit WhatsApp Service

## Como iniciar no Windows

Opção 1:
Dê dois cliques em:

start-whatsapp.bat

Opção 2:
Abra o terminal na pasta server/whatsapp e rode:

npm install
npm start

## Testar

Abra:

http://localhost:4545/health

ou execute:

check-whatsapp.bat

## QR Code

Na primeira execução, o QR Code aparece no terminal.

No celular:
WhatsApp > Aparelhos conectados > Conectar aparelho

A sessão será salva em:

server/whatsapp/auth

Não apague essa pasta se quiser manter a conexão.
