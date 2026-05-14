import { describe, expect, it } from 'vitest';
import { batchesToCsv, batchesToMarkdown, batchesToTxt } from '../exportService.js';

const batches = [{
  project_id: 'project-a',
  project_name: 'Projeto A',
  chat_name: 'Grupo A',
  chat_type: 'group',
  batch_date: '2026-05-14',
  payload: {
    messages: [{ timestamp: '2026-05-14T09:15:00-03:00', senderName: 'Bruna', type: 'text', text: 'Linha 1, com vírgula' }]
  }
}];

describe('export transformations', () => {
  it('transforms JSONB batches to CSV', () => {
    const csv = batchesToCsv(batches);
    expect(csv).toContain('project_id,project_name,chat_name');
    expect(csv).toContain('"Linha 1, com vírgula"');
  });

  it('transforms JSONB batches to Markdown', () => {
    expect(batchesToMarkdown(batches, { project_id: 'project-a' })).toContain('## 2026-05-14 — Grupo A');
  });

  it('transforms JSONB batches to TXT', () => {
    expect(batchesToTxt(batches, { project_id: 'project-a' })).toContain('Histórico WhatsApp');
  });
});
