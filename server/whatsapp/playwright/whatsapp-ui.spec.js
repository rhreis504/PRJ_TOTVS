import { test, expect } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const indexPath = path.resolve(__dirname, '../../../index.html');

test('login, settings WhatsApp accordion and history screen', async ({ page }) => {
  await page.route('**/status', (route) => route.fulfill({ json: { connected: false, status: 'disconnected' } }));
  await page.route('**/chats**', (route) => route.fulfill({ json: { chats: [] } }));
  await page.route('**/connect', (route) => route.fulfill({ json: { connected: false, status: 'qr_pending', qrDataUrl: 'data:image/png;base64,iVBORw0KGgo=' } }));
  await page.route('**/history**', (route) => route.fulfill({ json: { items: [], messageCount: 0, sourceCount: 0, pendingCount: 0, riskCount: 0 } }));
  await page.goto(`file://${indexPath}?menu=1`);
  await expect(page.getByText('Configurações do Sistema')).toBeVisible();
  await page.getByText('Configurações do Sistema').click();
  await expect(page.getByText('Integração WhatsApp')).toBeVisible();
  await expect(page.getByText('Conectar via QR Code')).toBeVisible();
  await page.getByText('Conectar via QR Code').click();
  await expect(page.getByText('Conectar WhatsApp')).toBeVisible();
  await page.getByRole('button', { name: 'Fechar' }).click();
  await page.getByText('Histórico WhatsApp').click();
  await expect(page.getByText('Histórico WhatsApp do Projeto')).toBeVisible();
  await page.getByText('Aplicar Filtros').click();
  await page.getByText('Exportar').click();
  await expect(page.getByText('Exportar Histórico WhatsApp')).toBeVisible();
});
