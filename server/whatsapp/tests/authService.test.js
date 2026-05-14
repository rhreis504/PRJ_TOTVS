import { describe, expect, it } from 'vitest';
import { canAnalyzeWithAi, canCaptureMessage } from '../authService.js';

describe('authorization rules', () => {
  it('blocks chat not authorized', () => {
    expect(canCaptureMessage(null)).toBe(false);
    expect(canCaptureMessage({ enabled: false })).toBe(false);
  });

  it('allows authorized chat', () => {
    expect(canCaptureMessage({ enabled: true })).toBe(true);
  });

  it('blocks IA when can_analyze_ai is false', () => {
    expect(canAnalyzeWithAi({ enabled: true, can_analyze_ai: false })).toBe(false);
  });

  it('allows IA only for enabled source with permission', () => {
    expect(canAnalyzeWithAi({ enabled: true, can_analyze_ai: true })).toBe(true);
    expect(canAnalyzeWithAi({ enabled: false, can_analyze_ai: true })).toBe(false);
  });
});
