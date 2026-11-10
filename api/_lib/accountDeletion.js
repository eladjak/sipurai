/**
 * "Delete my account and data".
 *
 * Who is deleted: the `sub` of the verified Clerk token, and nothing else. The body is never consulted.
 *
 * Which files are deleted: only objects whose storage owner is that user. Storage writes `owner_id`
 * from the verified JWT at upload time, so a client cannot pick it. We never derive "which file" from
 * text inside rows: a user could plant a link to someone else's file there. Because ownership comes
 * from storage and not from rows, uploads that no row refers to (orphans) are found too.
 *
 * Order (built so a crash at any point can be retried, see the state table in the PR):
 *   1. read-only checks (paid subscription, unfinished or unknown-status print order) -> refuse, nothing changed
 *   2. write a tombstone (user id + email) that survives until the very end
 *   3. delete the stored consents (so the AI routes refuse this user from now on)
 *   4. delete owned files, then delete rows (profile row last), then VERIFY nothing is left; up to 3 passes
 *   5. delete the Clerk user (last identity step)
 *   6. delete the tombstone
 * Every step is a plain delete, so repeating it is safe.
 *
 * Print orders: an order with an open or unknown status blocks deletion. Finished and cancelled orders are
 * kept as accounting records but made anonymous: the user id is replaced, and address, checkout and tracking
 * links vendor error text and the book title inside the price snapshot are cleared. (print_order_events is append-only and holds only codes, amounts
 * and ids, no personal fields.)
 */
import { serviceClient, createSupabaseConsentStore } from './consent.js';

export const BUCKET = 'sipurai-images';

// Tables that MUST be present and MUST delete cleanly. Any error on them stops the deletion.
const CREATED_BY_TABLES = ['pages', 'books', 'characters', 'story_ideas', 'feedback', 'collaborations', 'comments', 'community'];
// The only tables allowed to be absent (features that are optional per environment).
const OPTIONAL_TABLES = new Set(['book_quota_reservations', 'generation_loose_daily', 'print_orders']);

// Enumerated from the CHECK constraint on print_orders.status. Anything else is unknown and blocks.
export const ORDER_OPEN = ['paid', 'submitting', 'submitted', 'in_production', 'failed_needs_attention'];
export const ORDER_ANONYMIZE = ['awaiting_payment', 'shipped', 'ready_for_pickup', 'cancelled'];
const SUBSCRIPTION_ENDED = ['canceled', 'cancelled', 'expired', 'inactive'];

export const DELETE_MESSAGES = {
  disabled: 'מחיקת חשבון אוטומטית עדיין לא פתוחה. כתבו לנו ל-support@sipurai.ai ונמחק בשבילכם. לא נמחק כלום.',
  notConfigured: 'מחיקת חשבון עדיין לא הופעלה בשרת. פנו אלינו ב-support@sipurai.ai ונמחק בשבילכם. לא נמחק כלום.',
  paidSubscription: 'יש לכם מנוי בתשלום פעיל. מחיקת החשבון לא מבטלת חיוב, ולכן צריך קודם לבטל את המנוי. אחרי הביטול אפשר למחוק.',
  openOrder: 'יש הזמנת ספר מודפס שעדיין בדרך. אפשר למחוק את החשבון אחרי שההזמנה תגיע, או בפנייה אלינו ב-support@sipurai.ai.',
  unknownOrder: 'יש הזמנה במצב שאנחנו לא מכירים, ולכן לא מוחקים אוטומטית. כתבו לנו ל-support@sipurai.ai ונטפל בזה ידנית. לא נמחק כלום.',
  beforeAnyChange: 'המחיקה לא התחילה, ושום דבר לא נמחק. אפשר ללחוץ שוב.',
  midway: 'המחיקה נעצרה באמצע: חלק מהמידע כבר נמחק והשאר עדיין קיים. לחצו שוב ונמשיך מאותה נקודה. אם זה חוזר, כתבו ל-support@sipurai.ai.',
  identity: 'כל המידע נמחק, אבל לא הצלחנו לסגור את ההתחברות עצמה. לחצו שוב כדי לסיים.',
  incomplete: 'המחיקה לא הושלמה: אחרי הניקוי נשארו פריטים. לא סגרנו את החשבון. לחצו שוב, ואם זה חוזר כתבו ל-support@sipurai.ai.',
  needConfirm: 'חסר אישור מחיקה.',
};

const isMissingTable = (error, table) =>
  !!error && (error.code === '42P01' || error.code === 'PGRST205') && String(error.message || '').includes(table);

/* ---------------- Supabase store (service role) ---------------- */
export function createSupabaseAccountStore(db) {
  // Runs one query. Only the explicitly optional tables may be absent; every other error is thrown.
  const q = async (table, op) => {
    const { data, error, count } = await op;
    if (error) {
      if (OPTIONAL_TABLES.has(table) && isMissingTable(error, table)) return { data: [], count: 0 };
      throw new Error(`${table}: ${error.message}`);
    }
    return { data: data ?? [], count: count ?? 0 };
  };
  const del = async (table, col, val) =>
    (await q(table, db.from(table).delete({ count: 'exact' }).eq(col, val))).count;
  const emailVariants = (email) => [...new Set([email, String(email).toLowerCase()])];

  return {
    async tombstone(userId) {
      const { data } = await q('account_deletions', db.from('account_deletions').select('email,status').eq('user_id', userId).limit(1));
      return data[0] || null;
    },
    async profileEmail(userId) {
      const { data } = await q('profiles', db.from('profiles').select('email').eq('clerk_id', userId).limit(1));
      return data[0]?.email || null;
    },
    /** Read-only. Returns codes: paid_subscription | open_order | unknown_order_status. */
    async blockers(userId, email) {
      const out = [];
      if (email) {
        for (const e of emailVariants(email)) {
          const { data } = await q('subscriptions', db.from('subscriptions').select('plan,status').eq('user_email', e));
          // fail closed: any non-free subscription whose status is not clearly ended still bills
          if (data.some((s) => s.plan && s.plan !== 'free' && !SUBSCRIPTION_ENDED.includes(String(s.status || '').toLowerCase()))) {
            out.push('paid_subscription');
            break;
          }
        }
      }
      const { data: orders } = await q('print_orders', db.from('print_orders').select('status').eq('user_id', userId));
      if (orders.some((o) => ORDER_OPEN.includes(o.status))) out.push('open_order');
      if (orders.some((o) => !ORDER_OPEN.includes(o.status) && !ORDER_ANONYMIZE.includes(o.status))) out.push('unknown_order_status');
      return out;
    },
    async markDeleting(userId, email) {
      await q('account_deletions', db.from('account_deletions').upsert(
        { user_id: userId, email: email || null, status: 'deleting', updated_at: new Date().toISOString() },
        { onConflict: 'user_id' },
      ));
    },
    /** Objects whose storage owner is this user (written by Storage from the verified JWT). */
    async ownedFiles(userId) {
      const { data, error } = await db.rpc('sipurai_owned_storage_paths', { p_user: userId });
      if (error) throw new Error(`owned files: ${error.message}`);
      return (data || []).map((r) => r.name).filter(Boolean);
    },
    async removeFiles(paths) {
      for (let i = 0; i < paths.length; i += 100) {
        const { error } = await db.storage.from(BUCKET).remove(paths.slice(i, i + 100));
        if (error) throw new Error(`storage remove: ${error.message}`);
      }
    },
    /** Deletes rows. The profile row goes last. Order rows are anonymized, not deleted (see header). */
    async purge(userId, email) {
      const n = {};
      for (const t of CREATED_BY_TABLES) n[t] = await del(t, 'created_by', userId);
      n.follows = (await del('follows', 'created_by', userId)) + (await del('follows', 'follower_id', userId)) + (await del('follows', 'following_id', userId));
      n.notifications = (await del('notifications', 'created_by', userId)) + (await del('notifications', 'recipient_id', userId)) + (await del('notifications', 'actor_id', userId));
      n.user_badges = (await del('user_badges', 'created_by', userId)) + (await del('user_badges', 'user_id', userId));
      if (email) {
        n.subscriptions = 0;
        for (const e of emailVariants(email)) n.subscriptions += await del('subscriptions', 'user_email', e);
      }
      n.quota = (await del('book_quota_reservations', 'user_id', userId)) + (await del('generation_loose_daily', 'user_id', userId));

      const { data: orders } = await q('print_orders', db.from('print_orders').select('id,status,quote').eq('user_id', userId));
      n.orders_anonymized = 0;
      for (const o of orders) {
        if (!ORDER_ANONYMIZE.includes(o.status)) throw new Error(`print_orders: refusing status ${o.status}`);
        await q('print_orders', db.from('print_orders').update({
          user_id: `deleted:${o.id}`, address: null, checkout_url: null, tracking_url: null, vendor_last_error: null, book_id: 'deleted',
          // the price snapshot keeps its numbers; the book title can contain a child's name
          quote: { ...(o.quote || {}), bookTitle: '' },
        }).eq('id', o.id));
        n.orders_anonymized += 1;
      }
      n.profiles = await del('profiles', 'clerk_id', userId);
      return n;
    },
    /** Counts everything still identifiable. Must be 0 before the identity is deleted. */
    async remaining(userId, email) {
      const head = (t, col, val) => q(t, db.from(t).select('*', { count: 'exact', head: true }).eq(col, val)).then((r) => r.count);
      let left = 0;
      for (const t of CREATED_BY_TABLES) left += await head(t, 'created_by', userId);
      left += await head('follows', 'created_by', userId);
      left += await head('follows', 'follower_id', userId);
      left += await head('follows', 'following_id', userId);
      left += await head('notifications', 'created_by', userId);
      left += await head('notifications', 'recipient_id', userId);
      left += await head('notifications', 'actor_id', userId);
      left += await head('user_badges', 'created_by', userId);
      left += await head('user_badges', 'user_id', userId);
      left += await head('book_quota_reservations', 'user_id', userId);
      left += await head('generation_loose_daily', 'user_id', userId);
      left += await head('print_orders', 'user_id', userId);
      left += await head('profiles', 'clerk_id', userId);
      if (email) for (const e of emailVariants(email)) left += await head('subscriptions', 'user_email', e);
      left += (await this.ownedFiles(userId)).length;
      return left;
    },
    async clearTombstone(userId) {
      await del('account_deletions', 'user_id', userId);
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

export const accountDeleteEnabled = (env = {}) => String(env.ACCOUNT_DELETE_ENABLED || '').toLowerCase() === 'true';

const fail = (http, code, message_he, extra = {}) => ({ http, body: { error: { code, message_he, ...extra } } });

/** Runs the whole thing. Returns {http, body}. The target is userId and nothing else. */
export async function deleteAccount({ userId, store, consentStore, clerkDelete, env = {} }) {
  if (!accountDeleteEnabled(env)) return fail(503, 'disabled', DELETE_MESSAGES.disabled);
  if (!userId) return fail(401, 'unauthorized', 'נדרשת התחברות');
  if (!env.CLERK_SECRET_KEY) return fail(503, 'not_configured', DELETE_MESSAGES.notConfigured);

  let stage = 'inspect';
  try {
    const tomb = await store.tombstone(userId);
    const email = tomb?.email || (await store.profileEmail(userId));
    const blockers = await store.blockers(userId, email);
    if (blockers.includes('paid_subscription')) return fail(409, 'paid_subscription', DELETE_MESSAGES.paidSubscription);
    if (blockers.includes('open_order')) return fail(409, 'open_order', DELETE_MESSAGES.openOrder);
    if (blockers.includes('unknown_order_status')) return fail(409, 'unknown_order_status', DELETE_MESSAGES.unknownOrder);

    stage = 'mark';
    await store.markDeleting(userId, email);
    stage = 'consent';
    await consentStore.deleteAll(userId);

    let left = 1;
    for (let pass = 1; pass <= 3 && left > 0; pass++) {
      stage = 'files';
      await store.removeFiles(await store.ownedFiles(userId));
      stage = 'rows';
      await store.purge(userId, email);
      stage = 'verify';
      left = await store.remaining(userId, email);
    }
    if (left > 0) return fail(500, 'incomplete', DELETE_MESSAGES.incomplete, { stage: 'verify' });

    stage = 'identity';
    await clerkDelete(userId);
    stage = 'marker';
    await store.clearTombstone(userId);
    return { http: 200, body: { ok: true } };
  } catch (e) {
    console.error(`[account/delete] failed at ${stage}:`, String(e?.message).slice(0, 160));
    if (stage === 'marker') return { http: 200, body: { ok: true, warning: 'marker_left' } };
    const message = stage === 'inspect' || stage === 'mark' ? DELETE_MESSAGES.beforeAnyChange : stage === 'identity' ? DELETE_MESSAGES.identity : DELETE_MESSAGES.midway;
    return fail(500, `delete_failed_${stage}`, message, { stage });
  }
}
