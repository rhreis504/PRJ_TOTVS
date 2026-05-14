import { canAnalyzeWithAi } from './authService.js';

const memory = {
  chats: new Map(),
  sources: new Map(),
  batches: new Map(),
  insights: []
};

function sourceKey(projectId, chatId) {
  return `${projectId}::${chatId}`;
}

function batchKey(projectId, chatId, date) {
  return `${projectId}::${chatId}::${date}`;
}

export async function upsertChats(supabase, chats = []) {
  chats.forEach((chat) => memory.chats.set(chat.id, chat));
  if (!supabase || !chats.length) return;
  await supabase.from('whatsapp_chats').upsert(chats.map((chat) => ({
    wa_chat_id: chat.id,
    chat_name: chat.name,
    chat_type: chat.type === 'group' ? 'group' : 'contact',
    is_group: chat.type === 'group',
    participant_count: chat.participantCount,
    raw_profile: { id: chat.id, name: chat.name, type: chat.type }
  })), { onConflict: 'wa_chat_id' });
}

export async function listChatsWithProjectState(supabase, projectId, chats = []) {
  const merged = chats.map((chat) => {
    const source = memory.sources.get(sourceKey(projectId, chat.id));
    return { ...chat, enabled: Boolean(source?.enabled), project_id: source?.project_id || null, can_analyze_ai: Boolean(source?.can_analyze_ai) };
  });
  if (!supabase || !projectId) return merged;
  const { data } = await supabase.from('whatsapp_project_sources').select('*').eq('project_id', projectId);
  const byChat = new Map((data || []).map((source) => [source.wa_chat_id, source]));
  return chats.map((chat) => {
    const source = byChat.get(chat.id);
    return { ...chat, enabled: Boolean(source?.enabled), project_id: source?.project_id || null, can_analyze_ai: Boolean(source?.can_analyze_ai) };
  });
}

export async function saveProjectSource(supabase, payload) {
  const source = {
    id: payload.id || sourceKey(payload.project_id, payload.chat_id),
    project_id: payload.project_id,
    wa_chat_id: payload.chat_id,
    chat_name: payload.chat_name,
    chat_type: payload.chat_type === 'group' ? 'group' : 'contact',
    enabled: payload.enabled === true,
    capture_from: payload.capture_from || new Date().toISOString(),
    retention_days: payload.retention_days || 365,
    can_analyze_ai: payload.can_analyze_ai === true
  };
  memory.sources.set(sourceKey(source.project_id, source.wa_chat_id), source);
  if (supabase) {
    await supabase.from('whatsapp_chats').upsert({ wa_chat_id: source.wa_chat_id, chat_name: source.chat_name, chat_type: source.chat_type, is_group: source.chat_type === 'group' }, { onConflict: 'wa_chat_id' });
    const { data, error } = await supabase.from('whatsapp_project_sources').upsert(source, { onConflict: 'project_id,wa_chat_id' }).select().single();
    if (error) throw error;
    return data;
  }
  return source;
}

export async function updateProjectSourceAi(supabase, { project_id, chat_id, can_analyze_ai }) {
  const key = sourceKey(project_id, chat_id);
  const source = memory.sources.get(key) || { id: key, project_id, wa_chat_id: chat_id, enabled: false };
  source.can_analyze_ai = can_analyze_ai === true;
  memory.sources.set(key, source);
  if (supabase) await supabase.from('whatsapp_project_sources').update({ can_analyze_ai: source.can_analyze_ai }).eq('project_id', project_id).eq('wa_chat_id', chat_id);
  return source;
}

export async function findProjectSource(supabase, projectId, chatId) {
  if (supabase) {
    const { data } = await supabase.from('whatsapp_project_sources').select('*').eq('project_id', projectId).eq('wa_chat_id', chatId).maybeSingle();
    return data;
  }
  return memory.sources.get(sourceKey(projectId, chatId));
}

function buildBatch(projectId, source, messages) {
  const sorted = [...messages].sort((a, b) => String(a.timestamp).localeCompare(String(b.timestamp)));
  const date = (sorted[0]?.timestamp || new Date().toISOString()).slice(0, 10);
  const payload = {
    source: { wa_chat_id: source.wa_chat_id, chat_name: source.chat_name, chat_type: source.chat_type, project_id: projectId },
    batch: { date, first_message_at: sorted[0]?.timestamp || null, last_message_at: sorted.at(-1)?.timestamp || null, message_count: sorted.length },
    messages: sorted
  };
  return {
    project_id: projectId,
    source_id: source.id,
    wa_chat_id: source.wa_chat_id,
    chat_name: source.chat_name,
    chat_type: source.chat_type,
    batch_date: date,
    message_count: sorted.length,
    first_message_at: payload.batch.first_message_at,
    last_message_at: payload.batch.last_message_at,
    payload,
    search_text: sorted.map((message) => `${message.senderName || ''} ${message.text || ''}`).join('\n')
  };
}

export async function syncAuthorizedChat({ supabase, projectId, chatId, fetchMessages }) {
  const source = await findProjectSource(supabase, projectId, chatId);
  if (!source || source.enabled !== true) {
    return { skipped: true, reason: 'CHAT_NOT_AUTHORIZED' };
  }
  const messages = await fetchMessages(chatId);
  const batch = buildBatch(projectId, source, messages);
  memory.batches.set(batchKey(projectId, chatId, batch.batch_date), batch);
  if (supabase) {
    const { data, error } = await supabase.from('whatsapp_message_batches').upsert(batch, { onConflict: 'project_id,wa_chat_id,batch_date' }).select().single();
    if (error) throw error;
    return { skipped: false, batch: data, canAnalyzeAi: canAnalyzeWithAi(source) };
  }
  return { skipped: false, batch, canAnalyzeAi: canAnalyzeWithAi(source) };
}

export function filterBatches(batches, filters = {}) {
  return batches.filter((batch) => {
    if (filters.project_id && batch.project_id !== filters.project_id) return false;
    if (filters.source_id && batch.wa_chat_id !== filters.source_id) return false;
    if (filters.start && batch.batch_date < filters.start) return false;
    if (filters.end && batch.batch_date > filters.end) return false;
    if (filters.search && !String(batch.search_text || '').toLowerCase().includes(String(filters.search).toLowerCase())) return false;
    return true;
  });
}

export async function getHistory(supabase, filters = {}) {
  let batches = [...memory.batches.values()];
  if (supabase) {
    let query = supabase.from('whatsapp_message_batches').select('*').eq('project_id', filters.project_id || '');
    if (filters.source_id) query = query.eq('wa_chat_id', filters.source_id);
    if (filters.start) query = query.gte('batch_date', filters.start);
    if (filters.end) query = query.lte('batch_date', filters.end);
    if (filters.search) query = query.ilike('search_text', `%${filters.search}%`);
    const { data, error } = await query.order('batch_date', { ascending: false });
    if (error) throw error;
    batches = data || [];
  } else {
    batches = filterBatches(batches, filters);
  }
  const messageCount = batches.reduce((sum, batch) => sum + (batch.message_count || batch.payload?.messages?.length || 0), 0);
  return { items: batches, messageCount, sourceCount: new Set(batches.map((batch) => batch.wa_chat_id)).size, pendingCount: 0, riskCount: 0 };
}

export function _memory() {
  return memory;
}
