/**
 * Free-tier quota ("5 free books a month") and the global daily safety cap.
 *
 * The truth lives in Postgres (scripts/migrations/2026-11-09-free-quota.sql): one advisory
 * lock per user makes "count then insert" atomic, and the global daily counter is a single
 * guarded UPDATE. This file is the policy + wording; the store is injectable so tests can run
 * the same policy against an in-memory fake (and a separate script runs the real SQL).
 *
 * Months and days are Asia/Jerusalem, never UTC and never the server clock's zone.
 */

export const DEFAULTS = {
  FREE_BOOKS_PER_MONTH: 5,
  // $100/month shared with Bayit (decision 6.11.2026). At the approved ~$0.38 per book this is
  // ~263 books a month across everything, so the default daily ceiling is deliberately low.
  // Elad changes it with SIPURAI_DAILY_BOOK_CAP in Vercel, no deploy needed.
  DAILY_BOOK_CAP: 8,
  CALLS_PER_BOOK: 120,
  LOOSE_CALLS_PER_DAY: 80,
};

const intEnv = (v, d) => {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : d;
};

export function limitsFrom(env = {}) {
  return {
    monthly: intEnv(env.SIPURAI_FREE_BOOKS_PER_MONTH, DEFAULTS.FREE_BOOKS_PER_MONTH),
    dailyCap: intEnv(env.SIPURAI_DAILY_BOOK_CAP, DEFAULTS.DAILY_BOOK_CAP),
    callsPerBook: intEnv(env.SIPURAI_CALLS_PER_BOOK, DEFAULTS.CALLS_PER_BOOK),
    loosePerDay: intEnv(env.SIPURAI_LOOSE_CALLS_PER_DAY, DEFAULTS.LOOSE_CALLS_PER_DAY),
  };
}

export const quotaEnforced = (env = {}) => String(env.FREE_QUOTA_ENFORCE || '').toLowerCase() === 'true';

/** Calendar parts in Israel time for an instant. */
export function israelParts(date = new Date()) {
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const get = (t) => f.find((p) => p.type === t).value;
  return {
    year: Number(get('year')),
    month: Number(get('month')),
    day: `${get('year')}-${get('month')}-${get('day')}`,
    monthKey: `${get('year')}-${get('month')}`,
  };
}

const HE_MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];

/** First day of next month, Israel calendar. */
export function resetInfo(date = new Date()) {
  const { year, month } = israelParts(date);
  const ny = month === 12 ? year + 1 : year;
  const nm = month === 12 ? 1 : month + 1;
  return { resetsOn: `${ny}-${String(nm).padStart(2, '0')}-01`, resetsLabel: `1 ב${HE_MONTHS[nm - 1]}` };
}

export const MESSAGES = {
  monthly: (used, limit, label) =>
    `סיימתם את ${limit} הספרים החינמיים של החודש (${used} מתוך ${limit}). המכסה מתחדשת ב-${label}, ואפשר גם לשדרג לתוכנית בתשלום ולהמשיך ליצור עוד היום.`,
  daily: 'הרבה משפחות יוצרות ספרים עכשיו, ולכן הגענו לתקרת היצירה היומית שלנו. נסו שוב מחר בבוקר. הספרים שכבר יצרתם נשארים בספרייה.',
  unavailable: 'לא הצלחנו לבדוק את מכסת הספרים כרגע. נסו שוב בעוד רגע.',
  bookCalls: 'הספר הזה השתמש בכל פעולות היצירה שלו. אפשר להתחיל ספר חדש.',
  loose: 'הגעתם למכסה היומית של פעולות יצירה מחוץ לספר. נסו שוב מחר או התחילו ספר חדש.',
  needKey: 'נדרש מזהה ספר. רעננו את הדף ונסו שוב.',
};

/* ---------------- in-memory store (tests only; same contract as the SQL) ---------------- */
export function createMemoryQuotaStore({ paid = [] } = {}) {
  const res = [];
  const daily = new Map();
  const loose = new Map();
  const paidSet = new Set(paid);
  return {
    _res: res,
    _daily: daily,
    setPaid(u, v = true) {
      if (v) paidSet.add(u);
      else paidSet.delete(u);
    },
    async reserve({ userId, bookKey, monthKey, day, limit, dailyCap }) {
      const used = res.filter((r) => r.user_id === userId && r.month_key === monthKey).length;
      if (res.some((r) => r.user_id === userId && r.book_key === bookKey)) return { status: 'already', used };
      const isPaid = paidSet.has(userId);
      if (!isPaid && used >= limit) return { status: 'monthly_limit', used };
      const d = daily.get(day) || { books: 0, alerted: false };
      if (d.books >= dailyCap) {
        daily.set(day, d);
        return { status: 'daily_cap', used };
      }
      d.books += 1;
      daily.set(day, d);
      res.push({ user_id: userId, book_key: bookKey, month_key: monthKey, paid: isPaid, calls: 0 });
      return { status: 'ok', used: used + 1, paid: isPaid, daily_books: d.books };
    },
    async useCall({ userId, bookKey, day, bookMax, looseMax }) {
      const r = bookKey && res.find((x) => x.user_id === userId && x.book_key === bookKey);
      if (r) {
        if (r.calls >= bookMax) return { status: 'book_call_cap' };
        r.calls += 1;
        return { status: 'ok', calls: r.calls };
      }
      if (paidSet.has(userId)) return { status: 'ok', loose: true };
      const k = `${userId}|${day}`;
      const n = loose.get(k) || 0;
      if (n >= looseMax) return { status: 'loose_cap' };
      loose.set(k, n + 1);
      return { status: 'ok', calls: n + 1, loose: true };
    },
    async status({ userId, monthKey }) {
      return { used: res.filter((r) => r.user_id === userId && r.month_key === monthKey).length, paid: paidSet.has(userId) };
    },
    async markAlerted(day) {
      const d = daily.get(day);
      if (!d || d.alerted) return false;
      d.alerted = true;
      return true;
    },
    async unmarkAlerted(day) {
      const d = daily.get(day);
      if (d) d.alerted = false;
    },
  };
}

/* ---------------- Supabase store (service-role client) ---------------- */
export function createSupabaseQuotaStore(db) {
  const rpc = async (fn, args) => {
    const { data, error } = await db.rpc(fn, args);
    if (error) throw new Error(`quota rpc ${fn}: ${error.message}`);
    return data;
  };
  return {
    reserve: ({ userId, bookKey, monthKey, day, limit, dailyCap }) =>
      rpc('sipurai_reserve_book', {
        p_user: userId, p_book: bookKey, p_month: monthKey, p_day: day, p_limit: limit, p_daily_cap: dailyCap,
      }),
    useCall: ({ userId, bookKey, day, bookMax, looseMax }) =>
      rpc('sipurai_use_call', {
        p_user: userId, p_book: bookKey || null, p_day: day, p_book_max: bookMax, p_loose_max: looseMax,
      }),
    status: ({ userId, monthKey }) => rpc('sipurai_quota_status', { p_user: userId, p_month: monthKey }),
    async markAlerted(day) {
      const { data, error } = await db
        .from('generation_daily').update({ alerted: true }).eq('day', day).eq('alerted', false).select('day');
      if (error) throw new Error(`quota markAlerted: ${error.message}`);
      return Array.isArray(data) && data.length > 0;
    },
    async unmarkAlerted(day) {
      const { error } = await db.from('generation_daily').update({ alerted: false }).eq('day', day);
      if (error) throw new Error(`quota unmarkAlerted: ${error.message}`);
    },
  };
}

export async function defaultQuotaStore(env = process.env) {
  const { createClient } = await import('@supabase/supabase-js');
  const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('supabase service role not configured');
  return createSupabaseQuotaStore(createClient(url, key, { auth: { persistSession: false } }));
}

/* ---------------- alert to Elad only (never to customers) ---------------- */
export async function alertDailyCap({ store, day, cap, env = {}, fetchImpl = globalThis.fetch }) {
  const url = env.QUOTA_ALERT_WEBHOOK_URL || env.PRINT_ALERT_WEBHOOK_URL;
  if (!url) {
    console.error('[quota] daily cap reached; no alert webhook configured', { day, cap });
    return 'not_configured';
  }
  // Claim first (atomic flip), so concurrent refusals send one alert; give the claim back if delivery fails.
  if (!(await store.markAlerted(day))) return 'already_alerted';
  try {
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `סיפוראי: הגענו לתקרת היצירה היומית (${cap} ספרים ב-${day}). יצירות חדשות נעצרו עד מחר. לשינוי: SIPURAI_DAILY_BOOK_CAP בוורסל.`,
      }),
    });
    if (!res.ok) {
      await store.unmarkAlerted(day);
      return `failed_${res.status}`;
    }
    return 'sent';
  } catch (e) {
    await store.unmarkAlerted(day).catch(() => {});
    return `failed_${String(e?.message).slice(0, 60)}`;
  }
}

/* ---------------- policy ---------------- */
export async function reserveBook({ store, userId, bookKey, env = {}, now = new Date(), fetchImpl }) {
  const lim = limitsFrom(env);
  const { monthKey, day } = israelParts(now);
  const out = await store.reserve({ userId, bookKey, monthKey, day, limit: lim.monthly, dailyCap: lim.dailyCap });
  const { resetsOn, resetsLabel } = resetInfo(now);
  if (out.status === 'ok' || out.status === 'already') {
    return {
      ok: true,
      http: 200,
      body: {
        ok: true, status: out.status, used: out.used, limit: lim.monthly,
        remaining: Math.max(0, lim.monthly - out.used), paid: !!out.paid, resetsOn,
      },
    };
  }
  if (out.status === 'monthly_limit') {
    return {
      ok: false,
      http: 429,
      body: {
        error: {
          code: 'monthly_limit', message_he: MESSAGES.monthly(out.used, lim.monthly, resetsLabel),
          used: out.used, limit: lim.monthly, resetsOn, resetsLabel, canUpgrade: true,
        },
      },
    };
  }
  if (out.status === 'daily_cap') {
    const alert = await alertDailyCap({ store, day, cap: lim.dailyCap, env, fetchImpl });
    return { ok: false, http: 503, alert, body: { error: { code: 'daily_cap', message_he: MESSAGES.daily } } };
  }
  throw new Error(`unknown reserve status ${out.status}`);
}

export async function checkCall({ store, userId, bookKey, env = {}, now = new Date() }) {
  const lim = limitsFrom(env);
  const { day } = israelParts(now);
  const out = await store.useCall({ userId, bookKey, day, bookMax: lim.callsPerBook, looseMax: lim.loosePerDay });
  if (out.status === 'ok') return { ok: true };
  const map = { book_call_cap: ['book_call_cap', MESSAGES.bookCalls], loose_cap: ['loose_cap', MESSAGES.loose] };
  const [code, msg] = map[out.status] || ['quota_error', MESSAGES.unavailable];
  return { ok: false, http: 429, code, message_he: msg };
}

/**
 * Gate for the AI routes. Returns false to continue, or sends the response and returns true.
 * Off by default (FREE_QUOTA_ENFORCE=true turns it on). On: fails CLOSED if the store errors,
 * because an unmetered AI call is exactly the exposure this exists to prevent.
 */
export async function gateAiCall(req, res, userId, overrides = {}) {
  const env = overrides.env || process.env;
  if (!quotaEnforced(env)) return false;
  try {
    const store = overrides.store || (await defaultQuotaStore(env));
    const bookKey = String(req.headers?.['x-book-key'] || '').slice(0, 80);
    const r = await checkCall({ store, userId, bookKey, env, now: overrides.now });
    if (r.ok) return false;
    res.status(r.http).json({ error: r.message_he, code: r.code });
    return true;
  } catch (e) {
    console.error('[quota] gate failed closed:', String(e?.message).slice(0, 120));
    res.status(503).json({ error: MESSAGES.unavailable, code: 'quota_unavailable' });
    return true;
  }
}
