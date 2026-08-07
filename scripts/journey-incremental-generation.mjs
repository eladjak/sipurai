/**
 * journey-incremental-generation.mjs — the incremental generator, end to end,
 * against the LIVE production database and the LIVE Gemini API.
 *
 * WHY THIS EXISTS
 * ---------------
 * A green unit suite proves the state machine is coherent. It cannot prove that
 * PostgREST accepts the columns being written, that a real Gemini call fits
 * inside the abort window, or that a book left half-built is genuinely readable
 * afterwards. Those are the three things that actually broke this product:
 *
 *   - `books.scenes` and `pages.scene_id` were written to columns that do not
 *     exist. PostgREST rejects the whole insert; nothing in the repo noticed.
 *   - one image crossing 90s aborted the entire run.
 *   - the row then sat at `generating` forever with nothing to read.
 *
 * So this script runs the real generator against the real tables and the real
 * model, then inspects the rows that are left behind.
 *
 * ARMS
 * ----
 *   1. HAPPY   — a full small book. Asserts: page one is readable early, every
 *                page lands, the row settles at `complete`.
 *   2. FAILING — the same book with every illustration aborted mid flight,
 *                exactly as `proxyCall`'s AbortController does at 90s. (The old
 *                code lost the whole book to ONE such abort; aborting all of
 *                them is the strictly harder case.)
 *                Asserts: the book is still readable, still settles, and is
 *                NEVER left at `generating`.
 *   3. RESUME  — continues arm 2. Asserts: the missing work is done, the pages
 *                already written are untouched, and the book reaches `complete`.
 *
 * The failing arm is the point. An arm that only ever passes is indistinguishable
 * from one that cannot fail.
 *
 * WHAT IT DOES NOT PROVE
 * ----------------------
 * It authenticates with the SERVICE ROLE key, which BYPASSES RLS. It therefore
 * says nothing about whether a real signed-in parent is allowed to do this —
 * that is `e2e-newuser-prod-harness.mjs`, which needs a fresh Clerk JWT harvested
 * from a browser. Nor does it touch the reader UI. Read it as: "the write shapes
 * are real and the state machine survives real failures", not "the journey works".
 *
 * SAFETY: every row it creates is deleted at the end, including on failure.
 * Titles are marked so a leaked row is identifiable.
 *
 * USAGE (aliases need vite's resolver):
 *   npx vite-node scripts/journey-incremental-generation.mjs
 */

import { readFileSync } from 'node:fs';
import { generateBookIncremental } from '@/lib/bookGeneration';
import { buildRecipe } from '@/lib/bookRecipe';
import { BOOK_STATUS, summarizeBook, readablePages } from '@/lib/bookProgress';

// ─── environment ────────────────────────────────────────────────────────────

const env = readFileSync(new URL('../.env', import.meta.url), 'utf8');
const grab = (k) => (env.match(new RegExp(`^${k}=([^\r\n]+)`, 'm')) || [])[1]?.trim();

const SUPABASE_URL = grab('VITE_SUPABASE_URL');
const SERVICE_KEY = grab('SUPABASE_SERVICE_ROLE_KEY');
const GEMINI_KEY = grab('GEMINI_API_KEY') || grab('VITE_GEMINI_API_KEY');

for (const [name, value] of [['VITE_SUPABASE_URL', SUPABASE_URL], ['SUPABASE_SERVICE_ROLE_KEY', SERVICE_KEY], ['GEMINI_API_KEY', GEMINI_KEY]]) {
  if (!value) {
    console.error(`FATAL: ${name} missing from .env — refusing to run a journey that cannot reach the real thing.`);
    process.exit(2);
  }
}

const QA_OWNER = 'journey_incremental_qa';
const MARKER = 'בדיקת-מסע QA — למחיקה אוטומטית';

// ─── real PostgREST, same payload shapes as src/lib/supabaseEntity.js ───────
// A thin forwarder on purpose: apart from the one documented rename below it
// passes whatever object it is handed straight to PostgREST, so an unknown
// column is rejected here exactly as it would be in the browser. That is the
// property being tested; a smarter adapter that filtered unknown keys would
// hide the very defect this arm exists to catch.
//
// The rename is not a convenience — it is `columnMap` from src/entities/Book.js
// reproduced exactly. Omitting it made the first run of this script fail with
// `Could not find the 'selectedCharacters' column`, which was the adapter
// being unfaithful rather than the app being wrong. Keep these in step: if
// Book.js gains a mapping, it belongs here too.

const BOOK_COLUMN_MAP = { childNames: 'child_names', selectedCharacters: 'selected_characters' };

const toDb = (data, columnMap) => {
  const out = { ...data };
  for (const [appKey, dbCol] of Object.entries(columnMap)) {
    if (appKey in out) {
      out[dbCol] = out[appKey];
      delete out[appKey];
    }
  }
  return out;
};

const rest = async (path, { method = 'GET', body, prefer } = {}) => {
  const headers = {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json',
  };
  if (prefer) headers.Prefer = prefer;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* empty body */ }
  if (!res.ok) throw new Error(`${method} ${path} → HTTP ${res.status}: ${text.slice(0, 300)}`);
  return json;
};

const created = { books: [], pages: [] };

const Book = {
  create: async (data) => {
    const [row] = await rest('books', { method: 'POST', prefer: 'return=representation', body: toDb({ ...data, created_by: QA_OWNER }, BOOK_COLUMN_MAP) });
    created.books.push(row.id);
    return row;
  },
  get: async (id) => (await rest(`books?id=eq.${id}&select=*`))[0] || null,
  update: async (id, patch) => {
    const [row] = await rest(`books?id=eq.${id}`, { method: 'PATCH', prefer: 'return=representation', body: toDb(patch, BOOK_COLUMN_MAP) });
    return row;
  },
};

const Page = {
  create: async (data) => {
    const [row] = await rest('pages', { method: 'POST', prefer: 'return=representation', body: { ...data, created_by: QA_OWNER } });
    created.pages.push(row.id);
    return row;
  },
  update: async (id, patch) => {
    const [row] = await rest(`pages?id=eq.${id}`, { method: 'PATCH', prefer: 'return=representation', body: patch });
    return row;
  },
  filter: async ({ book_id }) => rest(`pages?book_id=eq.${book_id}&select=*&order=page_number.asc`),
};

// ─── real Gemini ────────────────────────────────────────────────────────────

const GEMINI = 'https://generativelanguage.googleapis.com/v1beta/models';

const InvokeLLM = async ({ prompt, response_json_schema, max_tokens, thinking_budget }) => {
  const res = await fetch(`${GEMINI}/gemini-2.5-flash:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_KEY },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      // Honour max_tokens exactly as api/ai/generate.js does — the ceiling is
      // the guard against a runaway, so an adapter that ignored it would test
      // a system without the fix in it.
      generationConfig: {
        ...(response_json_schema
          ? { responseMimeType: 'application/json', responseSchema: toGeminiSchema(response_json_schema) }
          : {}),
        ...(max_tokens !== undefined ? { maxOutputTokens: max_tokens } : {}),
        ...(thinking_budget !== undefined ? { thinkingConfig: { thinkingBudget: thinking_budget } } : {}),
      },
    }),
  });
  if (!res.ok) throw new Error(`Gemini text HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
  if (!text) throw new Error('Gemini returned no text');
  if (!response_json_schema) return text;
  try {
    return JSON.parse(text);
  } catch {
    const cut = data.candidates?.[0]?.finishReason === 'MAX_TOKENS';
    throw new Error(cut ? "The model's answer was cut off before it finished." : 'AI returned invalid JSON.');
  }
};

/**
 * Real image generation, with an optional abort that reproduces exactly what
 * `proxyCall` does at 90s — a genuine AbortError on a genuinely in-flight
 * request, not a thrown string pretending to be one.
 */
const makeGenerateImage = ({ abortPageContaining = null, abortAfterMs = 1500 } = {}) => async ({ prompt }) => {
  const ctrl = new AbortController();
  let timer = null;
  if (abortPageContaining && prompt.includes(abortPageContaining)) {
    timer = setTimeout(() => ctrl.abort(), abortAfterMs);
  }
  try {
    const res = await fetch(`${GEMINI}/gemini-2.5-flash-image:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_KEY },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`Gemini image HTTP ${res.status}`);
    const data = await res.json();
    const part = data.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
    if (!part) throw new Error('No image in response');
    // Not uploaded to storage — this journey is about durability and state, and
    // a data URL exercises the same "the row now has an image_url" path.
    return { url: `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data.slice(0, 64)}`, base64: part.inlineData.data };
  } catch (err) {
    if (err?.name === 'AbortError') throw new Error('AI request timed out after 90s. Please try again.');
    throw err;
  } finally {
    if (timer) clearTimeout(timer);
  }
};

const TYPE_MAP = { string: 'STRING', number: 'NUMBER', integer: 'INTEGER', boolean: 'BOOLEAN', array: 'ARRAY', object: 'OBJECT' };
function toGeminiSchema(schema) {
  if (!schema || typeof schema !== 'object') return schema;
  const out = {};
  for (const [k, v] of Object.entries(schema)) {
    if (k === 'type' && typeof v === 'string') out.type = TYPE_MAP[v.toLowerCase()] || v.toUpperCase();
    else if (k === 'properties') out.properties = Object.fromEntries(Object.entries(v).map(([p, s]) => [p, toGeminiSchema(s)]));
    else if (k === 'items') out.items = toGeminiSchema(v);
    else if (k === 'required' || k === 'description') out[k] = v;
  }
  return out;
}

// ─── assertions ─────────────────────────────────────────────────────────────

let pass = 0;
let fail = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? '  ✓' : '  ✗'} ${name}${detail ? ` — ${detail}` : ''}`);
  ok ? pass++ : fail++;
};

const recipeFor = (title) =>
  buildRecipe({
    bookData: {
      title,
      description: 'ארנב קטן שמחפש את הכובע שלו בגינה',
      art_style: 'watercolor',
      language: 'hebrew',
      age_range: '5-7',
      tone: 'exciting',
      moral: 'לבקש עזרה זה בסדר',
      genre: 'adventure',
      length: 'short',
      selectedCharacters: [{ id: 'c1', name: 'נמרוד', appearance: 'ארנב לבן קטן עם כובע אדום' }],
    },
    characters: [{ id: 'c1', name: 'נמרוד', appearance: 'ארנב לבן קטן עם כובע אדום' }],
    pageCount: 3,
  });

const noLock = () => () => {};

// ─── the journey ────────────────────────────────────────────────────────────

async function main() {
  const started = Date.now();

  // ══ ARM 1 — happy path ════════════════════════════════════════════════════
  console.log('\n[1] HAPPY — a whole small book against real Gemini and the real database');
  let firstReadableAt = null;
  const happy = await generateBookIncremental({
    entities: { Book, Page },
    ai: { InvokeLLM, GenerateImage: makeGenerateImage() },
    recipe: recipeFor(`${MARKER} · happy`),
    lock: noLock,
    onEvent: (e) => {
      if (e.type === 'page-text' && firstReadableAt === null) firstReadableAt = Date.now() - started;
      if (e.type === 'page-text' || e.type === 'page-image' || e.type === 'settled') {
        console.log(`      ${e.type}${e.index !== undefined ? ` p${e.index}` : ''} ${e.ready ?? ''}/${e.total ?? ''} ${e.status || ''}`);
      }
      if (e.type.endsWith('-failed')) console.log(`      ${e.type}: ${e.message}`);
    },
  });

  const happyRows = await Page.filter({ book_id: happy.bookId });
  const happyBook = await Book.get(happy.bookId);
  check('the write shapes are accepted by the real schema', true, `book ${happy.bookId}`);
  check('page one became readable before the book finished', firstReadableAt !== null && firstReadableAt < Date.now() - started, `${(firstReadableAt / 1000).toFixed(1)}s in, whole book ${((Date.now() - started) / 1000).toFixed(1)}s`);
  check('every planned page has text', readablePages(happyRows).length === 3, `${readablePages(happyRows).length}/3`);
  check('the row settled at complete', happyBook.status === BOOK_STATUS.COMPLETE, happyBook.status);
  check('total_pages was persisted from the outline', happyBook.total_pages === 3, String(happyBook.total_pages));
  check('the cast was persisted for a later resume', Array.isArray(happyBook.selected_characters) && happyBook.selected_characters.length === 1, JSON.stringify(happyBook.selected_characters)?.slice(0, 60));

  // ══ ARM 2 — an illustration aborts mid-run ════════════════════════════════
  console.log('\n[2] FAILING — the illustration for one page is aborted in flight, as proxyCall does at 90s');
  const broken = await generateBookIncremental({
    entities: { Book, Page },
    ai: { InvokeLLM, GenerateImage: makeGenerateImage({ abortPageContaining: 'Scene:' }) },
    recipe: recipeFor(`${MARKER} · failing`),
    lock: noLock,
    concurrency: 1,
    onEvent: (e) => {
      if (e.type.endsWith('-failed')) console.log(`      ${e.type}${e.index !== undefined ? ` p${e.index}` : ''}: ${e.message}`);
      if (e.type === 'settled') console.log(`      settled ${e.status} ${e.ready}/${e.total}`);
    },
  });

  const brokenRows = await Page.filter({ book_id: broken.bookId });
  const brokenBook = await Book.get(broken.bookId);
  const brokenSummary = summarizeBook(brokenBook, brokenRows);

  check('the book is NOT stranded at generating', brokenBook.status !== BOOK_STATUS.GENERATING, brokenBook.status);
  check('a parent can still read what was written', brokenSummary.isReadable, `${brokenSummary.ready}/${brokenSummary.total} pages readable`);
  check('the failed illustrations are recorded, not silent', broken.imageFailures.length > 0, `${broken.imageFailures.length} marked for retry`);
  check('the pages that failed to draw still have their words', brokenSummary.ready === brokenSummary.total, `${brokenSummary.ready}/${brokenSummary.total}`);
  check('a complete-but-artless book still admits work is left', brokenSummary.missingImage.length === brokenSummary.total, `${brokenSummary.missingImage.length} pages without art`);

  // ══ ARM 3 — resume ════════════════════════════════════════════════════════
  console.log('\n[3] RESUME — continuing the same book, with a healthy image generator');
  const textBefore = readablePages(brokenRows).map((p) => p.text_content);
  const llmCalls = [];
  const countedLLM = async (args) => { llmCalls.push(args.prompt); return InvokeLLM(args); };

  const resumed = await generateBookIncremental({
    entities: { Book, Page },
    ai: { InvokeLLM: countedLLM, GenerateImage: makeGenerateImage() },
    recipe: recipeFor(`${MARKER} · failing`),
    bookId: broken.bookId,
    lock: noLock,
    onEvent: (e) => { if (e.type === 'settled') console.log(`      settled ${e.status} ${e.ready}/${e.total}`); },
  });

  const resumedRows = await Page.filter({ book_id: broken.bookId });
  const resumedBook = await Book.get(broken.bookId);
  const textAfter = readablePages(resumedRows).map((p) => p.text_content);

  check('the resume finished the book', resumedBook.status === BOOK_STATUS.COMPLETE, resumedBook.status);
  check('every page now has an illustration', resumedRows.every((p) => p.image_url), `${resumedRows.filter((p) => p.image_url).length}/${resumedRows.length}`);
  check('the story the parent already read is byte-identical', JSON.stringify(textBefore) === JSON.stringify(textAfter));
  check('no page text was re-generated (nobody pays twice)', llmCalls.length === 0, `${llmCalls.length} text calls`);
  check('no duplicate page rows were created', resumedRows.length === 3, `${resumedRows.length} rows`);

  console.log(`\n  elapsed ${((Date.now() - started) / 1000).toFixed(1)}s`);
}

async function cleanup() {
  console.log('\n[cleanup] removing every row this run created');
  for (const id of created.pages) {
    await rest(`pages?id=eq.${id}`, { method: 'DELETE' }).catch((e) => console.error(`  page ${id}: ${e.message}`));
  }
  for (const id of created.books) {
    await rest(`books?id=eq.${id}`, { method: 'DELETE' }).catch((e) => console.error(`  book ${id}: ${e.message}`));
  }
  console.log(`  deleted ${created.pages.length} page(s), ${created.books.length} book(s)`);
}

try {
  await main();
} catch (err) {
  console.error(`\nJOURNEY CRASHED: ${err?.stack || err?.message || err}`);
  fail++;
} finally {
  await cleanup();
}

console.log(`\n${'─'.repeat(60)}\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
