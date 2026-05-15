#!/usr/bin/env node
const { spawn, spawnSync } = require('node:child_process');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const serviceDir = path.join(repoRoot, 'server', 'whatsapp');
const requiredModules = [
  'cors',
  'dotenv',
  'express',
  'qrcode-terminal',
  'whatsapp-web.js'
];

function findMissingModules() {
  return requiredModules.filter((moduleName) => {
    try {
      require.resolve(moduleName, { paths: [serviceDir] });
      return false;
    } catch (error) {
      if (error && error.code === 'MODULE_NOT_FOUND') return true;
      throw error;
    }
  });
}

function runInstall() {
  console.log('[WhatsApp] Dependências ausentes. Executando npm install em server/whatsapp...');
  const result = spawnSync('npm', ['install'], {
    cwd: serviceDir,
    stdio: 'inherit',
    shell: process.platform === 'win32'
  });

  if (result.error) {
    console.error('[WhatsApp] Falha ao executar npm install:', result.error.message);
    process.exit(1);
  }

  if (result.status !== 0) {
    console.error(`[WhatsApp] npm install terminou com código ${result.status}.`);
    console.error('[WhatsApp] Execute manualmente: cd server/whatsapp && npm install && npm start');
    process.exit(result.status || 1);
  }
}

let missingModules = findMissingModules();
if (missingModules.length > 0) {
  console.log(`[WhatsApp] Módulos não encontrados: ${missingModules.join(', ')}`);
  runInstall();
  missingModules = findMissingModules();
}

if (missingModules.length > 0) {
  console.error(`[WhatsApp] Ainda há módulos ausentes após npm install: ${missingModules.join(', ')}`);
  process.exit(1);
}

console.log('[WhatsApp] Iniciando serviço local em http://localhost:4545 ...');
const child = spawn('node', ['index.js'], {
  cwd: serviceDir,
  stdio: 'inherit',
  shell: process.platform === 'win32'
});

child.on('error', (error) => {
  console.error('[WhatsApp] Falha ao iniciar o serviço:', error.message);
  process.exit(1);
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code || 0);
});
