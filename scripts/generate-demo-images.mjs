/**
 * generate-demo-images.mjs — one-time generator for the landing showcase
 * demo books. Uses the SAME model + request contract as api/ai/gemini-image.js
 * (gemini-3-pro-image-preview, thinkingBudget 512) and enforces CHARACTER
 * CONSISTENCY: page 1 is generated from the book's own imagePrompt, then
 * every subsequent page (and the cover) receives page-1's image as a
 * multimodal reference + a locked character descriptor.
 *
 * Asset rules honored (multi-agent-team-playbook §5):
 *   - ZERO text baked into images (covers get the title from the UI overlay)
 *   - child-safety directive appended to every prompt
 *
 * Output: public/demo/<bookId>/page-N.png + cover.png  (+ .webp via
 * scripts/compress-demo-images.py afterwards).
 *
 * Run: node scripts/generate-demo-images.mjs [--only demo-brave-fox] [--force]
 */
import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import demoBooks from '../src/data/demoBooks.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const env = readFileSync(join(root, '.env'), 'utf8');
const API_KEY = (env.match(/^GEMINI_API_KEY=([^\r\n]+)/m) || [])[1]?.trim();
if (!API_KEY) { console.error('Missing GEMINI_API_KEY in .env'); process.exit(1); }

const MODEL = 'gemini-3-pro-image-preview';
const URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

// Locked character descriptors — repeated VERBATIM on every page of the book
// (same discipline as storyBible.characterPromptFor + elad-brand-kit).
const CHARACTER_LOCK = {
  'demo-dragons-garden':
    'MAIN CHARACTER (must look IDENTICAL to the reference image): Lily — a quiet 6-year-old girl, fair skin, long brown braided pigtails, big brown eyes, simple rust-red pinafore dress over cream blouse. SECONDARY: Emerald — a huge friendly green dragon with enormous plate-sized kind green eyes.',
  'demo-space-adventure':
    'MAIN CHARACTER (must look IDENTICAL to the reference image): Yael — a creative 8-year-old Israeli girl, olive skin, dark curly shoulder-length hair, denim overalls over a yellow t-shirt, round safety goggles worn on her head.',
  'demo-brave-fox':
    'MAIN CHARACTER (must look IDENTICAL to the reference image): Felix — a small brave red fox cub with bright orange fur, white chest and muzzle, big amber eyes, a tiny blue neckerchief.',
};

const SAFETY = "\n\nThis image is for a children's book. It must be completely child-friendly, wholesome, and appropriate for young readers. ABSOLUTELY NO text, letters, words, captions or typography anywhere in the image.";

const args = process.argv.slice(2);
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;
const force = args.includes('--force');

async function generate(prompt, { aspectRatio, referenceB64 }) {
  const parts = [{ text: prompt + SAFETY }];
  if (referenceB64) {
    parts.push({ inlineData: { mimeType: 'image/png', data: referenceB64 } });
  }
  const body = {
    contents: [{ parts }],
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
      imageConfig: { aspectRatio },
      thinkingConfig: { thinkingBudget: 512 }, // required for gemini-3-pro-*
      maxOutputTokens: 4000,
    },
  };
  for (let attempt = 1; attempt <= 4; attempt++) {
    const r = await fetch(URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': API_KEY },
      body: JSON.stringify(body),
    });
    if (r.status === 429 || r.status >= 500) {
      const wait = 45000 * attempt;
      console.log(`  … HTTP ${r.status}, retry ${attempt}/4 in ${wait / 1000}s`);
      await new Promise((res) => setTimeout(res, wait));
      continue;
    }
    if (!r.ok) throw new Error(`Gemini ${r.status}: ${(await r.text()).slice(0, 200)}`);
    const data = await r.json();
    const p = data.candidates?.[0]?.content?.parts?.find((x) => x.inlineData);
    if (!p) throw new Error('No image in response (finishReason=' + data.candidates?.[0]?.finishReason + ')');
    return p.inlineData.data; // base64 PNG
  }
  throw new Error('Rate-limited after 4 attempts');
}

for (const book of demoBooks) {
  if (only && book.id !== only) continue;
  const dir = join(root, 'public', 'demo', book.id);
  mkdirSync(dir, { recursive: true });
  const lock = CHARACTER_LOCK[book.id] || '';
  let referenceB64 = null;

  console.log(`\n📖 ${book.id} (${book.art_style}, ${book.pages.length} pages)`);

  for (const page of book.pages) {
    const out = join(dir, `page-${page.pageNumber}.png`);
    if (existsSync(out) && !force) {
      console.log(`  page ${page.pageNumber}: exists, skip`);
      if (!referenceB64) referenceB64 = readFileSync(out).toString('base64');
      continue;
    }
    const isFirst = page.pageNumber === 1;
    const prompt = isFirst
      ? `${page.imagePrompt}\n\n${lock}`
      : `${page.imagePrompt}\n\n${lock}\nUse the attached reference image ONLY for the characters' identity, face, hair, colors and outfit — keep them EXACTLY consistent with it. Compose a NEW scene per the description above.`;
    process.stdout.write(`  page ${page.pageNumber}: generating…`);
    const b64 = await generate(prompt, { aspectRatio: '4:3', referenceB64: isFirst ? null : referenceB64 });
    writeFileSync(out, Buffer.from(b64, 'base64'));
    console.log(` saved (${Math.round(Buffer.from(b64, 'base64').length / 1024)}KB)`);
    if (isFirst) referenceB64 = b64;
    await new Promise((r) => setTimeout(r, 12000)); // free-tier RPM guard
  }

  // Cover: hero composition of the main character, NO text (UI overlays title)
  const coverOut = join(dir, 'cover.png');
  if (!existsSync(coverOut) || force) {
    const coverPrompt = `Book cover hero illustration (NO TEXT WHATSOEVER — the title is added later by software). ${book.art_style === 'pixar' ? 'Pixar-style 3D rendered' : book.art_style === 'watercolor' ? 'Delicate watercolor' : 'Classic storybook'} full-scene portrait of the main character in the most magical moment of the story, centered composition with generous headroom at the top third for a title overlay.\n\n${lock}\nUse the attached reference image ONLY for character identity — keep it EXACTLY consistent.`;
    process.stdout.write('  cover: generating…');
    const b64 = await generate(coverPrompt, { aspectRatio: '3:4', referenceB64 });
    writeFileSync(coverOut, Buffer.from(b64, 'base64'));
    console.log(' saved');
  } else {
    console.log('  cover: exists, skip');
  }
}
console.log('\nDONE. Next: python scripts/compress-demo-images.py');
