# Cockpit WhatsApp Service

## Diagnosticar e corrigir automaticamente

Na raiz do projeto:

npm run wa:doctor

Ou dentro da pasta:

cd server/whatsapp
node whatsapp-doctor.cjs

## Corrigir automaticamente

npm run wa:fix

## Iniciar serviço

npm run wa:start

Ou:

cd server/whatsapp
npm install
npm start

## Testar

Abra:

http://127.0.0.1:4545/health

## QR Code

Na primeira execução, o QR Code aparece no terminal.

No celular:

WhatsApp > Aparelhos conectados > Conectar aparelho

A sessão será salva em:

server/whatsapp/auth

Não apague essa pasta se quiser manter a conexão.
