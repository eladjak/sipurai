import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const FILE = 'scripts/migrations/2026-11-12-profiles-and-public-pages.sql';
// Strip SQL comments so prose cannot satisfy or trip a check.
const sql = () => readFileSync(FILE, 'utf8').replace(/--.*$/gm, '');

describe('profiles + public_pages migration (static)', () => {
  it('drops the open profiles select policy', () => {
    expect(sql()).toMatch(/DROP POLICY IF EXISTS "profiles_authed_select" ON public\.profiles/);
  });
  it('has no select policy on profiles with USING (true)', () => {
    const s = sql();
    const policies = s.split(/CREATE POLICY/i).slice(1).filter((p) => /ON public\.profiles/.test(p));
    expect(policies.length).toBeGreaterThan(0);
    for (const p of policies) {
      expect(p).not.toMatch(/USING\s*\(\s*true\s*\)/i);
    }
  });
  it('creates a self-only select policy via current_clerk_id()', () => {
    expect(sql()).toMatch(/CREATE POLICY "profiles_self_select"[\s\S]*?FOR SELECT[\s\S]*?clerk_id\s*=\s*\(SELECT public\.current_clerk_id\(\)\)/);
  });
  it('public_pages does not select image_prompt, created_by or p.*', () => {
    const s = sql();
    const m = s.match(/CREATE VIEW public\.public_pages[\s\S]*?;/);
    expect(m).not.toBeNull();
    expect(m[0]).not.toMatch(/image_prompt/);
    expect(m[0]).not.toMatch(/created_by/);
    expect(m[0]).not.toMatch(/p\.\*/);
    expect(m[0]).toMatch(/p\.text_content/);
  });
  it('definer functions set search_path and are not executable by anon/public', () => {
    const s = sql();
    for (const fn of ['resolve_clerk_id\\(citext\\)', 'notify_my_followers\\(text, text, text, text\\)']) {
      expect(s).toMatch(new RegExp(`REVOKE ALL ON FUNCTION public\\.${fn} FROM public, anon`));
      expect(s).toMatch(new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${fn} TO authenticated`));
    }
    expect((s.match(/SECURITY DEFINER\s+SET search_path/g) || []).length).toBe(2);
  });
  it('notify_my_followers accepts only new_book, caps lengths 200/500/300 and requires a /BookView?id= link', () => {
    const body = sql().match(/FUNCTION public\.notify_my_followers[\s\S]*?\$\$;/)[0];
    expect(body).toMatch(/p_type IS DISTINCT FROM 'new_book' THEN RAISE EXCEPTION/);
    expect(body).toMatch(/char_length\(coalesce\(p_title, ''\)\)\s*>\s*200 THEN RAISE/);
    expect(body).toMatch(/char_length\(coalesce\(p_message, ''\)\)\s*>\s*500 THEN RAISE/);
    expect(body).toMatch(/char_length\(coalesce\(p_link, ''\)\)\s*>\s*300 THEN RAISE/);
    expect(body).toMatch(/left\(coalesce\(p_link, ''\), 13\) <> '\/BookView\?id=' THEN RAISE/);
    // the checks must run before the insert
    expect(body.indexOf("p_type IS DISTINCT FROM 'new_book'")).toBeLessThan(body.indexOf('INSERT INTO public.notifications'));
    expect('/BookView?id='.length).toBe(13);
  });
});
