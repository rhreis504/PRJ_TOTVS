function normalizeMessages(batch) {
  const payload = batch.payload || batch;
  const source = payload.source || {};
  const messages = Array.isArray(batch.messages) ? batch.messages : (Array.isArray(payload.messages) ? payload.messages : []);
  return messages.map((message) => ({
    project_id: batch.project_id || source.project_id || '',
    project_name: batch.project_name || batch.projects?.name || '',
    chat_name: batch.chat_name || source.chat_name || '',
    chat_type: batch.chat_type || source.chat_type || '',
    message_at: message.timestamp || '',
    sender_name: message.senderName || message.senderId || '',
    message_type: message.type || 'text',
    message_text: message.text || (message.hasMedia ? '[Mensagem com mídia não baixada no MVP]' : '')
  }));
}

export function flattenBatches(batches = []) {
  return batches.flatMap(normalizeMessages);
}

function csvCell(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

export function batchesToCsv(batches = []) {
  const columns = ['project_id', 'project_name', 'chat_name', 'chat_type', 'message_at', 'sender_name', 'message_type', 'message_text'];
  const rows = flattenBatches(batches).map((row) => columns.map((column) => csvCell(row[column])).join(','));
  return [columns.join(','), ...rows].join('\n');
}

export function batchesToMarkdown(batches = [], filters = {}) {
  const lines = ['# Histórico WhatsApp', '', `- Projeto: ${filters.project_id || 'não informado'}`, `- Período: ${filters.start || 'início'} a ${filters.end || 'fim'}`, ''];
  batches.forEach((batch) => {
    const payload = batch.payload || batch;
    const batchInfo = payload.batch || {};
    const source = payload.source || {};
    lines.push(`## ${batch.batch_date || batchInfo.date || 'Sem data'} — ${batch.chat_name || source.chat_name || 'Fonte autorizada'}`);
    (payload.messages || batch.messages || []).forEach((message) => {
      lines.push(`- **${message.timestamp || ''} | ${message.senderName || message.senderId || 'Remetente'}:** ${message.text || (message.hasMedia ? '[mídia]' : '[sem texto]')}`);
    });
    lines.push('');
  });
  return lines.join('\n');
}

export function batchesToTxt(batches = [], filters = {}) {
  return batchesToMarkdown(batches, filters)
    .replace(/^# /gm, '')
    .replace(/^## /gm, '')
    .replace(/\*\*/g, '')
    .replace(/^- /gm, '');
}

export function exportBatches(batches = [], { format = 'json', filters = {} } = {}) {
  if (format === 'csv') return batchesToCsv(batches);
  if (format === 'markdown') return batchesToMarkdown(batches, filters);
  if (format === 'txt') return batchesToTxt(batches, filters);
  return JSON.stringify({ exportedAt: new Date().toISOString(), filters, batches }, null, 2);
}
