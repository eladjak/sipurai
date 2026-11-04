import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('../lib/ttsProvider', () => ({
  synthesize: vi.fn(),
  getDefaultVoice: () => 'nova',
}));
vi.mock('../lib/storyBible', () => ({
  getNarrationPreset: () => ({ instructions: 'warm' }),
}));

import { synthesize } from '../lib/ttsProvider';
import { useTTS } from './useTTS';

describe('useTTS cloud failure falls back to browser speech', () => {
  let speakSpy;
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    speakSpy = vi.fn();
    window.speechSynthesis = { speak: speakSpy, cancel: vi.fn(), getVoices: () => [], pause: vi.fn(), resume: vi.fn() };
    window.SpeechSynthesisUtterance = function (text) { this.text = text; };
    URL.revokeObjectURL = vi.fn();
    synthesize.mockReset();
  });

  it('speaks with the browser voice and sets a Hebrew notice when cloud TTS throws', async () => {
    synthesize.mockRejectedValue(new Error('TTS failed (502)'));
    const { result } = renderHook(() => useTTS({ language: 'hebrew', engine: 'gemini' }));
    await act(async () => { result.current.speak('שלום עולם'); });
    expect(speakSpy).toHaveBeenCalledTimes(1);
    expect(speakSpy.mock.calls[0][0].text).toBe('שלום עולם');
    expect(result.current.notice).toMatch(/הקול הטבעי לא זמין/);
  });

  it('says so (no silent failure) when browser speech does not exist either', async () => {
    synthesize.mockRejectedValue(new Error('boom'));
    delete window.speechSynthesis;
    const { result } = renderHook(() => useTTS({ language: 'hebrew', engine: 'openai' }));
    await act(async () => { result.current.speak('שלום'); });
    expect(result.current.notice).toMatch(/לא זמינה/);
    expect(result.current.isSpeaking).toBe(false);
  });

  it('browser engine never shows a notice and never calls the cloud', async () => {
    const { result } = renderHook(() => useTTS({ language: 'hebrew', engine: 'browser' }));
    await act(async () => { result.current.speak('שלום'); });
    expect(synthesize).not.toHaveBeenCalled();
    expect(speakSpy).toHaveBeenCalledTimes(1);
    expect(result.current.notice).toBe('');
  });

  it('stop() cancels browser speech that took over after a cloud failure', async () => {
    synthesize.mockRejectedValue(new Error('x'));
    const { result } = renderHook(() => useTTS({ language: 'hebrew', engine: 'gemini' }));
    await act(async () => { result.current.speak('שלום'); });
    window.speechSynthesis.cancel.mockClear();
    act(() => { result.current.stop(); });
    expect(window.speechSynthesis.cancel).toHaveBeenCalled();
  });
});
