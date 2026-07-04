/**
 * e2e-newuser-prod-harness.mjs — proves the RECONCILED write path against the
 * LIVE production RLS with a REAL brand-new-user Clerk JWT.
 *
 * Mirrors exactly what the reconciled client code does (same PostgREST calls,
 * same payload shapes as src/lib/profiles.js ensureProfile + secureEntity.create):
 *   1. profiles upsert (ensureProfile)
 *   2. books INSERT with created_by = jwt sub
 *   3. pages INSERT for that book
 *   4. Library read: books?created_by=eq.<sub>
 *   5. anon CANNOT read the private book (negative)
 *   6. is_public=true → anon reads it via public_books (PII-safe view)
 *   7. cleanup: DELETE pages + book (self-cleaning; profiles row kept — inert)
 *
 * Usage: CLERK_JWT=<fresh supabase-template token> node scripts/e2e-newuser-prod-harness.mjs
 * (Template tokens live ~60s — harvest immediately before running.)
 * SAFE: touches ONLY rows created by this run for the QA test user.
 */
import { readFileSync } from 'node:fs';

const env = readFileSync(new URL('../.env', import.meta.url), 'utf8');
const grab = (k) => (env.match(new RegExp(`${k}=([^\r\n]+)`)) || [])[1]?.trim();
const SUPABASE_URL = grab('VITE_SUPABASE_URL');
const ANON = grab('VITE_SUPABASE_ANON_KEY');
const JWT = process.env.CLERK_JWT;
if (!JWT) { console.error('Missing CLERK_JWT'); process.exit(1); }

const payload = JSON.parse(Buffer.from(JWT.split('.')[1], 'base64url').toString());
const SUB = payload.sub;
console.log(`JWT: sub=${SUB} iss=${payload.iss} role=${payload.role || '-'} exp in ${payload.exp - Math.floor(Date.now() / 1000)}s`);

let pass = 0, fail = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ' — ' + detail : ''}`);
  ok ? pass++ : fail++;
};

const rest = async (path, { method = 'GET', body, authed = true, prefer } = {}) => {
  const headers = { apikey: ANON, 'Content-Type': 'application/json' };
  if (authed) headers.Authorization = `Bearer ${JWT}`;
  if (prefer) headers.Prefer = prefer;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let json = null; try { json = JSON.parse(text); } catch { /* empty */ }
  return { status: res.status, json, text };
};

// 1. ensureProfile (same payload as src/lib/profiles.js)
const prof = await rest('profiles?on_conflict=clerk_id', {
  method: 'POST',
  prefer: 'resolution=ignore-duplicates,return=minimal',
  body: { clerk_id: SUB, email: 'eladhiteclearning+sipqa0705@gmail.com', display_name: 'דניאל בדיקה-QA', avatar_url: null },
});
check('ensureProfile upsert accepted by RLS', prof.status === 201 || prof.status === 200 || prof.status === 204, `HTTP ${prof.status} ${prof.status >= 400 ? prof.text.slice(0, 120) : ''}`);

// 2. Book INSERT exactly like secureEntity.create (created_by = user.id = sub)
const bookBody = {
  title: 'ספר בדיקת QA — למחיקה אוטומטית',
  child_name: 'דניאל',
  language: 'hebrew',
  genre: 'adventure',
  age_range: '5-7',
  status: 'draft',
  created_by: SUB,
};
const bookIns = await rest('books', { method: 'POST', prefer: 'return=representation', body: bookBody });
const book = Array.isArray(bookIns.json) ? bookIns.json[0] : null;
check('books INSERT with created_by=sub accepted (THE 6-week blocker)', bookIns.status === 201 && !!book?.id, `HTTP ${bookIns.status} ${bookIns.status >= 400 ? bookIns.text.slice(0, 160) : 'id=' + (book?.id || '?')}`);

let pageIds = [];
if (book?.id) {
  // 3. Pages INSERT
  const pagesIns = await rest('pages', {
    method: 'POST', prefer: 'return=representation',
    body: [
      { book_id: book.id, page_number: 1, text_content: 'בוקר אחד גילה דניאל שביל קסום בגינה.', created_by: SUB },
      { book_id: book.id, page_number: 2, text_content: 'בסוף השביל חיכה לו דרקון ירוק וקטן.', created_by: SUB },
    ],
  });
  pageIds = (pagesIns.json || []).map((p) => p.id);
  check('pages INSERT accepted', pagesIns.status === 201 && pageIds.length === 2, `HTTP ${pagesIns.status}`);

  // 4. Library read path (Book.filter({created_by: user.id}))
  const lib = await rest(`books?created_by=eq.${SUB}&select=id,title`);
  check('Library read returns the new book', lib.status === 200 && (lib.json || []).some((b) => b.id === book.id), `HTTP ${lib.status}, rows=${(lib.json || []).length}`);

  // 5. anon cannot read the private book
  const anonRead = await rest(`books?id=eq.${book.id}&select=id`, { authed: false });
  check('anon CANNOT read private book (RLS negative)', anonRead.status === 401 || (anonRead.status === 200 && (anonRead.json || []).length === 0), `HTTP ${anonRead.status}, rows=${(anonRead.json || []).length ?? '-'}`);

  // 6. share flow: is_public=true → anon reads via PII-safe public_books
  const pub = await rest(`books?id=eq.${book.id}`, { method: 'PATCH', prefer: 'return=minimal', body: { is_public: true } });
  check('owner can set is_public=true', pub.status === 204 || pub.status === 200, `HTTP ${pub.status}`);
  const anonPub = await rest(`public_books?id=eq.${book.id}&select=*`, { authed: false });
  const row = (anonPub.json || [])[0];
  check('anon CAN read shared book via public_books view', anonPub.status === 200 && !!row, `HTTP ${anonPub.status}`);
  check('public view is PII-safe (no child_name column)', !!row && !('child_name' in row) && !('family_members' in row), row ? 'cols: ' + Object.keys(row).slice(0, 8).join(',') : 'no row');

  // 7. cleanup — delete ONLY the rows this run created
  const delPages = await rest(`pages?book_id=eq.${book.id}`, { method: 'DELETE', prefer: 'return=minimal' });
  const delBook = await rest(`books?id=eq.${book.id}`, { method: 'DELETE', prefer: 'return=minimal' });
  check('cleanup: pages+book deleted by owner', delPages.status === 204 && delBook.status === 204, `pages HTTP ${delPages.status}, book HTTP ${delBook.status}`);
  const gone = await rest(`books?id=eq.${book.id}&select=id`);
  check('cleanup verified (book gone)', gone.status === 200 && (gone.json || []).length === 0);
}

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
