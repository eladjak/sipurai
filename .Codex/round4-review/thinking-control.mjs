import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const registryUrl = pathToFileURL(path.resolve('api/_lib/modelRegistry.js')).href;
const originalFetch = globalThis.fetch;
const originalOverride = process.env.GEMINI_PRO_IMAGE_MODEL;
try {
  for (const revision of ['HEAD^', 'HEAD']) {
    const source = execFileSync('git', ['show', `${revision}:api/ai/gemini-image.js`], { encoding: 'utf8' })
      .replace("'../_lib/modelRegistry.js'", JSON.stringify(registryUrl));
    const { geminiProImage } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
    let config;
    globalThis.fetch = async (_url, init) => {
      config = JSON.parse(init.body).generationConfig;
      return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ inlineData: { data: 'AAAA' } }] } }] }) };
    };
    process.env.GEMINI_PRO_IMAGE_MODEL = 'gemini-2.5-flash-image';
    await geminiProImage('FAKE_REVIEW_KEY', 'control');
    let acceptsFlash;
    try { assert.equal(config.thinkingConfig, undefined); acceptsFlash = true; }
    catch { acceptsFlash = false; }
    assert.equal(acceptsFlash, revision === 'HEAD');
    console.log(`${revision}: flash override predicate ${acceptsFlash ? 'PASS' : 'FAIL (expected negative control)'}`);
    delete process.env.GEMINI_PRO_IMAGE_MODEL;
    await geminiProImage('FAKE_REVIEW_KEY', 'control');
    assert.equal(config.thinkingConfig.thinkingBudget, 512);
    console.log(`${revision}: default pro keeps thinking options PASS`);
  }
} finally {
  globalThis.fetch = originalFetch;
  if (originalOverride === undefined) delete process.env.GEMINI_PRO_IMAGE_MODEL;
  else process.env.GEMINI_PRO_IMAGE_MODEL = originalOverride;
}
