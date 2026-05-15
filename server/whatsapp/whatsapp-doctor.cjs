const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const http = require('http');
const net = require('net');

const root = __dirname;
const PORT = Number(process.env.WA_SERVICE_PORT || 4545);
const report = {
  startedAt: new Date().toISOString(),
  checks: [],
  recommendations: [],
  finalStatus: 'unknown'
};

function addCheck(name, ok, detail = '', recommendation = '') {
  report.checks.push({ name, ok, detail, recommendation, at: new Date().toISOString() });
  if (!ok && recommendation) report.recommendations.push({ check: name, recommendation });
  console.log(`${ok ? '[OK]' : '[FALHA]'} ${name}${detail ? ' - ' + detail : ''}${!ok && recommendation ? ` | Correção recomendada: ${recommendation}` : ''}`);
}

function writeReport() {
  const lines = [];
  lines.push(`WhatsApp Doctor - ${new Date().toISOString()}`);
  lines.push(`Status final: ${report.finalStatus}`);
  lines.push('');
  lines.push('Checks:');
  lines.push(...report.checks.map(c => `${c.ok ? '[OK]' : '[FALHA]'} ${c.name} ${c.detail || ''}${!c.ok && c.recommendation ? ` | Correção recomendada: ${c.recommendation}` : ''}`));
  if (report.recommendations.length) {
    lines.push('');
    lines.push('Correções recomendadas:');
    lines.push(...report.recommendations.map(r => `- ${r.check}: ${r.recommendation}`));
  }

  fs.writeFileSync(path.join(root, 'whatsapp-doctor-report.json'), JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(root, 'whatsapp-doctor-report.txt'), lines.join('\n'));
}

function requestJson(url, timeoutMs = 5000, options = {}) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const req = http.request({
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || 80,
      path: `${parsedUrl.pathname}${parsedUrl.search}`,
      method: options.method || 'GET',
      headers: options.headers || {}
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({
            statusCode: res.statusCode,
            data: JSON.parse(data)
          });
        } catch (error) {
          reject(new Error(`Resposta inválida em ${url}: ${data.slice(0, 200)}`));
        }
      });
    });

    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error(`Timeout em ${url}`));
    });

    req.on('error', reject);

    if (options.body) req.write(options.body);
    req.end();
  });
}

function checkPort(host = '127.0.0.1', port = PORT, timeoutMs = 1000) {
  return new Promise(resolve => {
    const socket = net.createConnection({ host, port });
    socket.setTimeout(timeoutMs);
    socket.on('connect', () => { socket.destroy(); resolve(true); });
    socket.on('timeout', () => { socket.destroy(); resolve(false); });
    socket.on('error', () => resolve(false));
  });
}

async function runChecks() {
  let allOk = true;

  try {
    const nodeVersion = execSync('node -v', { stdio: 'pipe' }).toString().trim();
    addCheck('Node.js instalado', true, nodeVersion);
  } catch (error) {
    addCheck('Node.js instalado', false, 'Node.js não encontrado.', 'Instale o Node.js LTS e execute npm run wa:doctor novamente.');
    allOk = false;
  }

  try {
    const npmVersion = execSync('npm -v', { stdio: 'pipe' }).toString().trim();
    addCheck('npm instalado', true, npmVersion);
  } catch (error) {
    addCheck('npm instalado', false, 'npm não encontrado.', 'Reinstale o Node.js LTS para incluir npm.');
    allOk = false;
  }

  const folderExists = fs.existsSync(root);
  addCheck('Pasta server/whatsapp', folderExists, folderExists ? root : 'ausente', 'Crie a pasta server/whatsapp.');
  if (!folderExists) allOk = false;

  ['package.json', 'index.js', 'wa-client.js'].forEach(file => {
    const exists = fs.existsSync(path.join(root, file));
    addCheck(`Arquivo ${file}`, exists, exists ? 'encontrado' : 'ausente', `Execute npm run wa:fix para recriar ${file}.`);
    if (!exists) allOk = false;
  });

  const nodeModulesExists = fs.existsSync(path.join(root, 'node_modules'));
  addCheck('node_modules', nodeModulesExists, nodeModulesExists ? 'encontrado' : 'ausente', 'Execute npm run wa:fix para rodar npm install.');
  if (!nodeModulesExists) allOk = false;

  const portInUse = await checkPort();
  addCheck(`Porta ${PORT} em uso`, portInUse, portInUse ? 'há um processo escutando' : 'porta livre', `Execute npm run wa:fix para iniciar o serviço na porta ${PORT}.`);
  if (!portInUse) allOk = false;

  try {
    const health = await requestJson(`http://127.0.0.1:${PORT}/health`, 3000);
    const ok = health.statusCode === 200 && health.data.ok === true && health.data.service === 'cockpit-whatsapp-service';
    addCheck('/health em 127.0.0.1', ok, JSON.stringify(health.data), ok ? '' : `A porta ${PORT} pode estar ocupada por outro serviço. Libere a porta e rode npm run wa:doctor.`);
    if (!ok) allOk = false;
  } catch (error) {
    addCheck('/health em 127.0.0.1', false, error.message, 'Execute npm run wa:fix para instalar dependências e iniciar o serviço.');
    allOk = false;
  }

  try {
    const healthLocalhost = await requestJson(`http://localhost:${PORT}/health`, 3000);
    const ok = healthLocalhost.statusCode === 200 && healthLocalhost.data.ok === true && healthLocalhost.data.service === 'cockpit-whatsapp-service';
    addCheck('/health em localhost', ok, JSON.stringify(healthLocalhost.data), ok ? '' : 'Valide se localhost resolve para o serviço local correto.');
    if (!ok) allOk = false;
  } catch (error) {
    addCheck('/health em localhost', false, error.message, 'Teste http://127.0.0.1:4545/health e verifique bloqueios de firewall/proxy para localhost.');
    allOk = false;
  }

  try {
    const status = await requestJson(`http://127.0.0.1:${PORT}/status`, 3000);
    const ok = status.statusCode === 200 && status.data.ok === true;
    addCheck('/status em 127.0.0.1', ok, JSON.stringify(status.data), ok ? '' : 'Reinicie o serviço com npm run wa:doctor.');
    if (!ok) allOk = false;
  } catch (error) {
    addCheck('/status em 127.0.0.1', false, error.message, 'Execute npm run wa:fix para reiniciar o backend local.');
    allOk = false;
  }

  try {
    const connect = await requestJson(`http://127.0.0.1:${PORT}/connect`, 5000, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}'
    });
    const ok = connect.statusCode >= 200 && connect.statusCode < 500 && connect.data.ok !== false;
    addCheck('POST /connect em 127.0.0.1', ok, JSON.stringify(connect.data), ok ? '' : 'Verifique o whatsapp-service.log; o serviço deve mostrar QR Code no terminal quando necessário.');
    if (!ok) allOk = false;
  } catch (error) {
    addCheck('POST /connect em 127.0.0.1', false, error.message, 'Abra server/whatsapp/whatsapp-service.log e confirme se o WhatsApp Web/Puppeteer iniciou corretamente.');
    allOk = false;
  }

  return allOk;
}

async function main() {
  console.log('\nRodando WhatsApp Doctor...\n');

  let ok = await runChecks();

  if (!ok) {
    console.log('\nFalhas encontradas. Executando autofix...\n');

    try {
      execSync('node whatsapp-autofix.cjs', {
        cwd: root,
        stdio: 'inherit'
      });
    } catch (error) {
      addCheck('Autofix', false, error.message, 'Confira whatsapp-doctor-report.txt e whatsapp-service.log.');
    }

    console.log('\nReexecutando diagnóstico...\n');
    ok = await runChecks();
  }

  report.finalStatus = ok ? 'ok' : 'failed';
  writeReport();

  if (ok) {
    console.log('\nWhatsApp Doctor finalizado com sucesso.');
    console.log(`Teste no navegador: http://127.0.0.1:${PORT}/health`);
  } else {
    console.log('\nWhatsApp Doctor finalizado com falhas.');
    console.log('Consulte whatsapp-doctor-report.txt e whatsapp-service.log.');
    process.exit(1);
  }
}

main();
