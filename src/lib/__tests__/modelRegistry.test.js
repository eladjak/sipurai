import { describe, it, expect, vi, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { MODELS, getModel, getModelChain, REGISTRY_VERSION } from '../../../api/_lib/modelRegistry.js';

const ROOT = path.resolve(__dirname, '../../..');

describe('modelRegistry', () => {
  it('has a version string', () => {
    expect(REGISTRY_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}/);
  });

  it('keeps the text model pinned to gemini-2.5-flash (no text switch in this release)', () => {
    expect(getModel('text', {})).toBe('gemini-2.5-flash');
    expect(MODELS.text.retireAfter).toBe('2026-12-01');
  });

  it('defaults TTS to the Google-listed replacement, not the retiring preview id', () => {
    expect(getModel('ttsGemini', {})).toBe('gemini-3.8-flash-tts');
    expect(getModel('ttsGemini', {})).not.toContain('2.5-flash-preview-tts');
  });

  it('applies env overrides and ignores blank ones', () => {
    expect(getModel('ttsGemini', { GEMINI_TTS_MODEL: 'gemini-3.8-flash-lite-tts' })).toBe('gemini-3.8-flash-lite-tts');
    expect(getModel('text', { GEMINI_TEXT_MODEL: '  gemini-x  ' })).toBe('gemini-x');
    expect(getModel('text', { GEMINI_TEXT_MODEL: '   ' })).toBe('gemini-2.5-flash');
    expect(getModel('text', { GEMINI_TEXT_MODEL: undefined })).toBe('gemini-2.5-flash');
  });

  it('reads process.env at call time by default', () => {
    vi.stubEnv('GEMINI_IMAGE_MODEL', 'img-override');
    expect(getModel('imageDefault')).toBe('img-override');
    vi.unstubAllEnvs();
    expect(getModel('imageDefault')).toBe('gemini-2.5-flash-image');
  });

  it('builds the pro-image chain with the flash-image fallback, no duplicates', () => {
    expect(getModelChain('imagePro', {})).toEqual(['gemini-3-pro-image', 'gemini-2.5-flash-image']);
    expect(getModelChain('imagePro', { GEMINI_PRO_IMAGE_MODEL: 'gemini-2.5-flash-image' })).toEqual(['gemini-2.5-flash-image']);
  });

  it('throws on an unknown capability (fail closed)', () => {
    expect(() => getModel('nope')).toThrow(/Unknown model capability/);
    expect(() => getModelChain('nope')).toThrow();
  });
});

// Boundary test: no model id may live outside the registry
const MODEL_ID = /gemini-\d[\w.-]*|gpt-image-\d[\w.-]*|gpt-4o[\w.-]*-tts/g;

function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
}

// UI model ids (entitlement keys such as modelId === 'gemini-2-5-flash-image') are not API ids.
function findModelIdLeaks(src) {
  return stripComments(src).replace(/modelId\s*===\s*'[^']*'/g, '').match(MODEL_ID) ?? [];
}

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    return e.isDirectory() ? walk(full) : e.name.endsWith('.js') ? [full] : [];
  });
}

describe('model ids stay inside the registry', () => {
  const files = [
    ...walk(path.join(ROOT, 'api')).filter((f) => !f.endsWith('modelRegistry.js')),
    path.join(ROOT, 'src/lib/aiProvider.js'),
    path.join(ROOT, 'src/lib/ttsProvider.js'),
  ];

  it('scans a non-trivial file set', () => {
    expect(files.length).toBeGreaterThan(8);
  });

  it('negative control: the scanner does flag a planted hardcoded id', () => {
    expect(findModelIdLeaks("const m = 'gemini-2.5-flash';")).toHaveLength(1);
    expect(findModelIdLeaks("const m = 'gpt-image-1'; // fine in comment gemini-3-pro")).toHaveLength(1);
    expect(findModelIdLeaks('// only gemini-2.5-flash in a comment')).toHaveLength(0);
  });

  it.each(files.map((f) => [path.relative(ROOT, f).replace(/\\/g, '/'), f]))('%s has no hardcoded model id', (_name, f) => {
    expect(findModelIdLeaks(fs.readFileSync(f, 'utf8'))).toEqual([]);
  });
});

describe('FAQ uses the same text model as generation', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('chat-faq calls the model from GEMINI_TEXT_MODEL', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'k');
    vi.stubEnv('GEMINI_TEXT_MODEL', 'gemini-test-text');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: 'שלום' }] } }] }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const { default: handler } = await import('../../../api/chat-faq.js');
    const res = { setHeader() {}, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; }, end() { return this; } };
    await handler({ method: 'POST', headers: { origin: 'https://sipurai.ai' }, body: { messages: [{ role: 'user', content: 'hi' }] } }, res);
    expect(fetchMock.mock.calls[0][0]).toContain('/models/gemini-test-text:generateContent');
    expect(res.body.content).toBe('שלום');
  });
});
