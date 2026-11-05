import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, renderHook, act, waitFor } from '@testing-library/react';

vi.mock('./src/lib/ttsProvider.js', () => ({ synthesize: vi.fn(), getDefaultVoice: () => 'nova' }));
vi.mock('./src/lib/storyBible.js', () => ({ getNarrationPreset: () => ({ instructions: 'warm' }) }));
import { synthesize } from './src/lib/ttsProvider.js';
import { useTTS } from './src/hooks/useTTS.js';
import React, { useEffect, useMemo, useState } from 'react';

describe('round 3 frontend regression controls', () => {
  let speakSpy;
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    speakSpy = vi.fn();
    window.speechSynthesis = { speak: speakSpy, cancel: vi.fn(), getVoices: () => [], pause: vi.fn(), resume: vi.fn() };
    window.SpeechSynthesisUtterance = function (text) { this.text = text; };
    URL.revokeObjectURL = vi.fn();
    synthesize.mockReset();
  });

  it('cancels a live browser fallback before a newer cloud request', async () => {
    synthesize.mockRejectedValueOnce(new Error('first')).mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useTTS({ language: 'hebrew', engine: 'openai' }));
    await act(async () => { result.current.speak('first'); });
    window.speechSynthesis.cancel.mockClear();
    await act(async () => { result.current.speak('second'); });
    expect(window.speechSynthesis.cancel).toHaveBeenCalledTimes(1);
  });

  it('surfaces a failure when the browser fallback emits a real error', async () => {
    synthesize.mockRejectedValue(new Error('cloud unavailable'));
    const { result } = renderHook(() => useTTS({ language: 'hebrew', engine: 'openai' }));
    await act(async () => { result.current.speak('hello'); });
    const utterance = speakSpy.mock.calls[0][0];
    await act(async () => { utterance.onerror({ error: 'synthesis-failed' }); });
    expect(result.current.notice).toMatch(/לא זמינה/);
  });

  it('keeps the auto-narrate dependency stable when TTS state re-renders', async () => {
    // Scope: an executable extraction of BookView's exact pages + auto-effect setup.
    // Full BookView mounting is intentionally avoided because it requires auth/data/UI mocks.
    const source = fs.readFileSync(path.join(process.cwd(), 'src', 'pages', 'BookView.jsx'), 'utf8');
    const sourceUsesMemo = /const pages = useMemo\(\(\) => readablePages\(allPages\), \[allPages\]\)/.test(source);
    function ExtractedReader({ onSpeak }) {
      const [tick, setTick] = useState(0);
      const allPages = useMemo(() => [{ text_content: 'page' }], []);
      const pages = sourceUsesMemo ? useMemo(() => allPages.filter((p) => p.text_content), [allPages]) : allPages.filter((p) => p.text_content);
      useEffect(() => {
        const timer = setTimeout(() => onSpeak(() => setTick((value) => value + 1)), 0);
        return () => clearTimeout(timer);
      }, [pages, onSpeak]);
      return <span data-tick={tick} />;
    }
    const speak = vi.fn((rerender) => rerender());
    render(<ExtractedReader onSpeak={speak} />);
    await waitFor(() => expect(speak).toHaveBeenCalledTimes(1));
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(speak).toHaveBeenCalledTimes(1);
  });
});
