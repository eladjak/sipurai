/**
 * "Delete my account and data".
 *
 * Authorization rule, the only one that matters: the account being deleted is the `sub` of the
 * verified Clerk token. The request body is never consulted for who to delete.
 *
 * Order is chosen so a failure in the middle can simply be retried:
 *   1. refuse early (Clerk not configured / paid subscription / open print order)
 *   2. list the user's uploaded files, then delete them
 *   3. delete the database rows
 *   4. delete the stored consents
 *   5. delete the Clerk user (404 from Clerk = already gone = fine)
 * Rows are deleted only after the files were deleted, because the rows are the only record of
 * which files are the user's (uploads are not stored under a per-user path).
 *
 * Kept on purpose: completed print orders (shipped / ready for pickup) are accounting records
 * the business must keep; their delivery address is blanked.
 */
import { forgetConsent, serviceClient, createSupabaseConsentStore } from './consent.js';

export const BUCKET = 'sipurai-images';
export const STORAGE_MARKER = `/storage/v1/object/public/${BUCKET}/`;
const CONTENT_TABLES = ['pages', 'books', 'characters', 'story_ideas', 'feedback', 'collaborations', 'comments', 'community'];
const REF_TABLES = ['books', 'pages', 'characters', 'story_ideas', 'community', 'collaborations'];
const OPEN_ORDER = ['paid', 'submitting', 'submitted', 'in_production', 'failed_needs_attention'];
const KEPT_ORDER = ['shipped', 'ready_for_pickup'];

export const DELETE_MESSAGES = {
  notConfigured: 'מחיקת חשבון עדיין לא הופעלה בשרת. פנו אלינו ב-support@sipurai.ai ונמחק בשבילכם. לא נמחק כלום.',
  paidSubscription: 'יש לכם מנוי בתשלום פעיל. מחיקת החשבון לא מבטלת חיוב, ולכן צריך קודם לבטל את המנוי. אחרי הביטול אפשר למחוק.',
  openOrder: 'יש הזמנת ספר מודפס שעדיין בדרך. אפשר למחוק את החשבון אחרי שההזמנה תגיע, או בפנייה אלינו ב-support@sipurai.ai.',
  failed: 'המחיקה לא הושלמה. לא קרה שום נזק, אפשר ללחוץ שוב ונמשיך מאותה נקודה.',
  needConfirm: 'חסר אישור מחיקה.',
};

/** Finds every uploaded-file path mentioned anywhere inside a row (strings and nested JSON). */
export function extractStoragePaths(value, out = new Set()) {
  if (typeof value === 'string') {
    let from = 0;
    for (;;) {
      const at = value.indexOf(STORAGE_MARKER, from);
      if (at === -1) break;
      const rest = value.slice(at + STORAGE_MARKER.length);
      const m = /^[^\s"'?#)]+/.exec(rest);
      if (m) out.add(decodeURIComponent(m[0]));
      from = at + STORAGE_MARKER.length;
    }
  } else if (Array.isArray(value)) {
    value.forEach((v) => extractStoragePaths(v, out));
  } else if (value && typeof value === 'object') {
    Object.values(value).forEach((v) => extractStoragePaths(v, out));
  }
  return out;
}

/* ---------------- Supabase store (service role) ---------------- */
export function createSupabaseAccountStore(db) {
  // A table that does not exist yet (quota / print orders are optional features) has nothing to delete.
  const missing = (e) => e && (e.code === '42P01' || e.code === 'PGRST205' || /does not exist|schema cache/i.test(e.message || ''));
  const must = (label, { error, count }) => {
    if (error && !missing(error)) throw new Error(`${label}: ${error.message}`);
    return count ?? 0;
  };
  const del = async (table, col, val) =>
    must(`delete ${table}.${col}`, await db.from(table).delete({ count: 'exact' }).eq(col, val));

  return {
    async profileEmail(userId) {
      const { data, error } = await db.from('profiles').select('email').eq('clerk_id', userId).maybeSingle();
      if (error) throw new Error(`profile read: ${error.message}`);
      return data?.email || null;
    },
    async blockers(userId, email) {
      const out = [];
      if (email) {
        const { data, error } = await db.from('subscriptions').select('plan,status').ilike('user_email', email);
        if (error) throw new Error(`subscription read: ${error.message}`);
        if ((data || []).some((s) => s.status === 'active' && s.plan && s.plan !== 'free')) out.push('paid_subscription');
      }
      const { data: orders, error: oe } = await db.from('print_orders').select('status').eq('user_id', userId).in('status', OPEN_ORDER);
      if (oe && !missing(oe)) throw new Error(`orders read: ${oe.message}`);
      if ((orders || []).length) out.push('open_order');
      return out;
    },
    async storagePaths(userId) {
      const paths = new Set();
      for (const table of REF_TABLES) {
        for (let from = 0; ; from += 1000) {
          const { data, error } = await db.from(table).select('*').eq('created_by', userId).range(from, from + 999);
          if (error) throw new Error(`refs ${table}: ${error.message}`);
          (data || []).forEach((row) => extractStoragePaths(row, paths));
          if (!data || data.length < 1000) break;
        }
      }
      const { data: prof, error: pe } = await db.from('profiles').select('avatar_url').eq('clerk_id', userId);
      if (pe) throw new Error(`refs profiles: ${pe.message}`);
      (prof || []).forEach((row) => extractStoragePaths(row, paths));
      return [...paths];
    },
    async removeFiles(paths) {
      for (let i = 0; i < paths.length; i += 100) {
        const { error } = await db.storage.from(BUCKET).remove(paths.slice(i, i + 100));
        if (error) throw new Error(`storage remove: ${error.message}`);
      }
    },
    async purge(userId, email) {
      const n = {};
      for (const t of CONTENT_TABLES) n[t] = await del(t, 'created_by', userId);
      n.follows = (await del('follows', 'created_by', userId)) + (await del('follows', 'follower_id', userId)) + (await del('follows', 'following_id', userId));
      n.notifications = (await del('notifications', 'created_by', userId)) + (await del('notifications', 'recipient_id', userId)) + (await del('notifications', 'actor_id', userId));
      n.user_badges = (await del('user_badges', 'created_by', userId)) + (await del('user_badges', 'user_id', userId));
      if (email) n.subscriptions = await del('subscriptions', 'user_email', email);
      n.quota = (await del('book_quota_reservations', 'user_id', userId)) + (await del('generation_loose_daily', 'user_id', userId));
      n.print_orders_deleted = must(
        'delete print_orders',
        await db.from('print_orders').delete({ count: 'exact' }).eq('user_id', userId).in('status', ['awaiting_payment', 'cancelled']),
      );
      must('blank kept order addresses', await db.from('print_orders').update({ address: null }).eq('user_id', userId).in('status', KEPT_ORDER));
      n.profiles = await del('profiles', 'clerk_id', userId);
      return n;
    },
  };
}

export async function defaultDeletionDeps(env = process.env) {
  const db = await serviceClient(env);
  return { store: createSupabaseAccountStore(db), consentStore: createSupabaseConsentStore(db) };
}

export async function clerkDeleteUser(userId, { env = process.env, fetchImpl = globalThis.fetch } = {}) {
  const res = await fetchImpl(`https://api.clerk.com/v1/users/${encodeURIComponent(userId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${env.CLERK_SECRET_KEY}` },
  });
  if (res.ok || res.status === 404) return true;
  throw new Error(`clerk delete ${res.status}`);
}

/** Runs the whole thing. Returns {http, body}. The target is userId and nothing else. */
export async function deleteAccount({ userId, store, consentStore, clerkDelete, env = {} }) {
  if (!userId) return { http: 401, body: { error: { code: 'unauthorized', message_he: 'נדרשת התחברות' } } };
  if (!env.CLERK_SECRET_KEY) {
    return { http: 503, body: { error: { code: 'not_configured', message_he: DELETE_MESSAGES.notConfigured } } };
  }
  try {
    const email = await store.profileEmail(userId);
    const blockers = await store.blockers(userId, email);
    if (blockers.includes('paid_subscription')) {
      return { http: 409, body: { error: { code: 'paid_subscription', message_he: DELETE_MESSAGES.paidSubscription } } };
    }
    if (blockers.includes('open_order')) {
      return { http: 409, body: { error: { code: 'open_order', message_he: DELETE_MESSAGES.openOrder } } };
    }
    const paths = await store.storagePaths(userId);
    await store.removeFiles(paths);
    const deleted = await store.purge(userId, email);
    await consentStore.deleteAll(userId);
    forgetConsent(userId);
    await clerkDelete(userId);
    return { http: 200, body: { ok: true, deleted: { ...deleted, files: paths.length } } };
  } catch (e) {
    console.error('[account/delete] failed:', String(e?.message).slice(0, 160));
    return { http: 500, body: { error: { code: 'delete_failed', message_he: DELETE_MESSAGES.failed } } };
  }
}
