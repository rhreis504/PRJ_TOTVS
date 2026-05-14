export function canCaptureMessage(source) {
  return Boolean(source && source.enabled === true);
}

export function canAnalyzeWithAi(source) {
  return canCaptureMessage(source) && source.can_analyze_ai === true;
}

export function assertProjectChat(projectId, chatId) {
  if (!projectId || !chatId) {
    const error = new Error('PROJECT_AND_CHAT_REQUIRED');
    error.status = 400;
    throw error;
  }
}
