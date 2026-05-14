import { beforeEach, describe, expect, it } from 'vitest';
import { _memory, saveProjectSource, syncAuthorizedChat, getHistory } from '../historyService.js';

const messages = [
  { id: '1', timestamp: '2026-05-14T09:15:00-03:00', senderId: 'a', senderName: 'Bruna', type: 'text', text: 'Validar cronograma', hasMedia: false, mentionedIds: [], replyTo: null }
];

beforeEach(() => {
  _memory().sources.clear();
  _memory().batches.clear();
});

describe('project_id + chat_id isolation', () => {
  it('does not save unauthorized chat history', async () => {
    const result = await syncAuthorizedChat({ supabase: null, projectId: 'project-a', chatId: 'chat-1', fetchMessages: async () => messages });
    expect(result).toEqual({ skipped: true, reason: 'CHAT_NOT_AUTHORIZED' });
    expect(_memory().batches.size).toBe(0);
  });

  it('saves authorized chat history under correct project only', async () => {
    await saveProjectSource(null, { project_id: 'project-a', chat_id: 'chat-1', chat_name: 'Grupo A', chat_type: 'group', enabled: true });
    await syncAuthorizedChat({ supabase: null, projectId: 'project-a', chatId: 'chat-1', fetchMessages: async () => messages });
    expect((await getHistory(null, { project_id: 'project-a' })).items).toHaveLength(1);
    expect((await getHistory(null, { project_id: 'project-b' })).items).toHaveLength(0);
  });

  it('persists but does not allow IA when can_analyze_ai is false', async () => {
    await saveProjectSource(null, { project_id: 'project-a', chat_id: 'chat-1', chat_name: 'Grupo A', chat_type: 'group', enabled: true, can_analyze_ai: false });
    const result = await syncAuthorizedChat({ supabase: null, projectId: 'project-a', chatId: 'chat-1', fetchMessages: async () => messages });
    expect(result.skipped).toBe(false);
    expect(result.canAnalyzeAi).toBe(false);
  });
});
