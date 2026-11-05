import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const out = path.join(root, '.Codex', 'round4-frontend');
const testBody = String.raw`import fs from 'node:fs';
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
`;

function writeFixture(label, ref) {
  const dir = path.join(out, label);
  fs.rmSync(dir, { recursive: true, force: true });
  for (const rel of ['src/hooks/useTTS.js', 'src/pages/BookView.jsx']) {
    const target = path.join(dir, rel);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const content = execFileSync('git', ['show', `${ref}:${rel}`], { cwd: root, encoding: 'utf8' });
    fs.writeFileSync(target, content);
  }
  fs.mkdirSync(path.join(dir, 'src/lib'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'src/lib/ttsProvider.js'), 'export const synthesize = async () => ({ url: "blob:test" });\nexport const getDefaultVoice = () => "nova";\n');
  fs.writeFileSync(path.join(dir, 'src/lib/storyBible.js'), 'export const getNarrationPreset = () => ({ instructions: "warm" });\n');
  fs.writeFileSync(path.join(dir, 'round3.test.jsx'), testBody);
  fs.writeFileSync(path.join(dir, 'vitest.config.mjs'), `import { defineConfig } from 'vitest/config';\nimport react from '@vitejs/plugin-react';\nimport { fileURLToPath } from 'node:url';\nconst root = fileURLToPath(new URL('.', import.meta.url));\nexport default defineConfig({ root, plugins: [react()], test: { environment: 'jsdom', globals: true, include: ['round3.test.jsx'], testTimeout: 10000 } });\n`);
}

fs.mkdirSync(out, { recursive: true });
writeFixture('head', 'HEAD');
writeFixture('head-parent', 'HEAD^');
const results = {};
for (const label of ['head-parent', 'head']) {
  const result = spawnSync('npx.cmd', ['vitest', 'run', '--config', path.join(out, label, 'vitest.config.mjs')], { cwd: path.join(out, label), encoding: 'utf8', shell: true });
  results[label] = { status: result.status, output: `${result.stdout ?? ''}\n${result.stderr ?? ''}\n${result.error ?? ''}` };
  console.log(`--- ${label} status=${result.status} ---`);
  console.log(results[label].output);
}
if (results['head-parent'].status === 0 || results.head.status !== 0) process.exit(1);
console.log('NEGATIVE_CONTROLS_PASS: HEAD^ fails and HEAD passes the three scoped controls');
