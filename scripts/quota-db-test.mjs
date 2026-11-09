#!/usr/bin/env node
/**
 * Runs the REAL SQL functions (not the in-memory fake) against the Sipurai database with a
 * synthetic user and a far-future day, then deletes everything it created.
 *   node scripts/quota-db-test.mjs            (needs SUPABASE_DB_PASSWORD in .env)
 * Proves: 12 parallel reservations -> exactly 5 ok; a sixth is refused; paid is unaffected;
 * the daily cap is atomic; a new month starts fresh.
 */
import { readFileSync } from 'node:fs';
import pg from 'pg';
const env = Object.fromEntries(readFileSync(new URL('../.env', import.meta.url), 'utf8').split('\n')
  .map((l) => l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)).filter(Boolean).map((m) => [m[1], m[2]]));
const mk = () => new pg.Client({ host: 'aws-1-eu-central-1.pooler.supabase.com', port: 5432, user: 'postgres.furviizyohryyqubosut',
  password: env.SUPABASE_DB_PASSWORD, database: 'postgres', ssl: { rejectUnauthorized: false } });
const U = `qa_quota_${Date.now()}`;
const DAY = '2099-01-01';
let fails = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} ${extra}`); if (!ok) fails++; };

const admin = mk(); await admin.connect();
const reserve = async (c, user, book, month, cap = 1000, limit = 5, day = DAY) =>
  (await c.query('select sipurai_reserve_book($1,$2,$3,$4::date,$5,$6) r', [user, book, month, day, limit, cap])).rows[0].r;
try {
  // 12 separate connections, all at once
  const conns = await Promise.all(Array.from({ length: 12 }, async () => { const c = mk(); await c.connect(); return c; }));
  const rs = await Promise.all(conns.map((c, i) => reserve(c, U, `par-${i}`, '2099-01')));
  const ok = rs.filter((r) => r.status === 'ok').length;
  check('12 parallel reservations -> exactly 5 ok', ok === 5, `(ok=${ok}, refused=${rs.filter((r) => r.status === 'monthly_limit').length})`);
  const six = await reserve(admin, U, 'sixth', '2099-01');
  check('6th book in the same month is refused', six.status === 'monthly_limit');
  const first = (await admin.query('select book_key from book_quota_reservations where user_id=$1 and month_key=$2 limit 1', [U, '2099-01'])).rows[0].book_key;
  const again = await reserve(admin, U, first, '2099-01');
  check('retry of an already-reserved book is free', again.status === 'already' && again.used === 5);
  const feb = await reserve(admin, U, 'feb-1', '2099-02');
  check('new month starts fresh', feb.status === 'ok' && feb.used === 1);

  // CONTROL (deliberate break): the same function WITHOUT the per-user lock must overshoot,
  // proving the parallel test can fail and that the lock is what holds the line.
  const src = (await admin.query("select pg_get_functiondef('sipurai_reserve_book(text,text,text,date,integer,integer)'::regprocedure) d")).rows[0].d;
  const broken = src.replace('sipurai_reserve_book', 'sipurai_reserve_book_nolock').replace(/perform pg_advisory_xact_lock[^;]*;/, 'perform pg_sleep(0.2);');
  check('control: lock line really removed from the copy', broken !== src && !broken.includes('advisory'));
  await admin.query(broken);
  const NL = U + '_nolock';
  const nl = await Promise.all(conns.map((c, i) => c.query("select sipurai_reserve_book_nolock($1,$2,'2099-04','2099-01-03'::date,5,1000) r", [NL, `n-${i}`]).then((x) => x.rows[0].r)));
  const nlOk = nl.filter((r) => r.status === 'ok').length;
  check('control: WITHOUT the lock 12 parallel overshoot 5 (test is able to fail)', nlOk > 5, `(ok=${nlOk})`);
  await admin.query('drop function sipurai_reserve_book_nolock(text,text,text,date,integer,integer)');

  // paid user: needs a profile + subscription
  const P = `qa_paid_${Date.now()}`; const email = `${P}@example.invalid`;
  await admin.query('insert into profiles (clerk_id,email) values ($1,$2)', [P, email]);
  await admin.query("insert into subscriptions (user_email,plan,status) values ($1,'premium','active')", [email]);
  const prs = await Promise.all(conns.slice(0, 8).map((c, i) => reserve(c, P, `p-${i}`, '2099-01')));
  check('paid user is not limited (8 of 8 ok)', prs.every((r) => r.status === 'ok'));
  await admin.query('delete from subscriptions where user_email=$1', [email]);
  await admin.query('delete from profiles where clerk_id=$1', [P]);
  await admin.query('delete from book_quota_reservations where user_id=$1', [P]);

  // global daily cap, atomic across users
  const D2 = '2099-01-02';
  const users = Array.from({ length: 10 }, (_, i) => `${U}_g${i}`);
  const grs = await Promise.all(users.map((u, i) => reserve(conns[i % conns.length], u, 'g', '2099-03', 3, 5, D2)));
  check('daily cap 3 with 10 parallel users -> exactly 3 ok', grs.filter((r) => r.status === 'ok').length === 3 && grs.filter((r) => r.status === 'daily_cap').length === 7);
  const cnt = (await admin.query('select books from generation_daily where day=$1', [D2])).rows[0].books;
  check('daily counter equals 3, never above', cnt === 3, `(counter=${cnt})`);
  const noLeak = (await admin.query('select count(*) from book_quota_reservations where user_id like $1', [`${U}_g%`])).rows[0].count;
  check('refused users left no reservation row', Number(noLeak) === 3, `(rows=${noLeak})`);

  // closed to the public API keys
  const priv = (await admin.query("select has_table_privilege('anon','book_quota_reservations','select') a, has_table_privilege('authenticated','generation_daily','select') b, has_function_privilege('anon','sipurai_reserve_book(text,text,text,date,integer,integer)','execute') c")).rows[0];
  check('anon/authenticated cannot read tables or call the function', !priv.a && !priv.b && !priv.c);
  for (const c of conns) await c.end();
} finally {
  await admin.query('delete from book_quota_reservations where user_id like $1', [`${U}%`]);
  await admin.query("delete from generation_daily where day in ('2099-01-01','2099-01-02','2099-01-03')");
  await admin.query('drop function if exists sipurai_reserve_book_nolock(text,text,text,date,integer,integer)');
  await admin.end();
}
console.log(fails ? `\n${fails} FAILED` : '\nall passed (test rows cleaned up)');
process.exit(fails ? 1 : 0);
