// Static checks of scripts/migrations/2026-11-12-book-delete.sql (no database is available to the build).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sql = readFileSync(new URL('../scripts/migrations/2026-11-12-book-delete.sql', import.meta.url), 'utf8').replace(/--.*$/gm, '');
const fn = sql.match(/function public\.sipurai_delete_book[\s\S]*?\n\$\$;/)[0];

test('definer function with empty search_path, service_role only', () => {
  assert.match(fn, /returns setof text/i);
  assert.match(fn, /security definer\s+set search_path = ''/i);
  assert.match(sql, /revoke all on function public\.sipurai_delete_book\(uuid, text\) from public, anon, authenticated/i);
  assert.match(sql, /grant execute on function public\.sipurai_delete_book\(uuid, text\) to service_role/i);
  assert.doesNotMatch(sql, /grant execute[^;]*to (anon|authenticated|public)/i);
});

test('locks the book row, checks created_by, refuses open print orders with the same statuses as before', () => {
  assert.match(fn, /from public\.books b where b\.id = p_book for update/i);
  assert.match(fn, /v_owner is distinct from p_user/i);
  for (const st of ['paid', 'submitting', 'submitted', 'in_production', 'failed_needs_attention']) assert.ok(fn.includes(`''${st}''`), st);
  assert.match(fn, /raise exception 'sipurai_open_order'/);
  assert.match(fn, /raise exception 'sipurai_not_found'/);
});

test('deletes comments, community, collaborations, pages, book - all after the checks, in one function', () => {
  const at = (re) => fn.search(re);
  const checks = at(/sipurai_open_order/);
  for (const re of [/delete from public\.comments/, /delete from public\.community/, /public\.collaborations/, /delete from public\.pages/, /delete from public\.books/]) {
    assert.ok(at(re) > checks, String(re));
  }
});

test('returned paths: storage owner = user and no remaining book / page / character / avatar reference', () => {
  const tail = fn.slice(fn.indexOf('return query'));
  assert.match(tail, /o\.owner_id = p_user/);
  for (const t of ['public.books', 'public.pages', 'public.characters', 'public.profiles']) assert.ok(tail.includes(t), t);
  for (const c of ['cover_image', 'image_url', 'primary_image_url', 'avatar_url']) assert.ok(tail.includes(c), c);
});

test('rollback drops both functions', () => {
  const rb = readFileSync(new URL('../scripts/migrations/2026-11-12-book-delete.rollback.sql', import.meta.url), 'utf8');
  assert.match(rb, /drop function if exists public\.sipurai_delete_book\(uuid, text\)/);
  assert.match(rb, /drop function if exists public\.sipurai_image_path\(text\)/);
});
