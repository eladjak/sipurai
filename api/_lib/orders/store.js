/**
 * Order persistence. Two implementations of one interface:
 *   - createSupabaseStore(client): production, service-role client
 *   - createMemoryStore(): in-memory fake used by tests
 *
 * Interface (rows are snake_case, same as the print_orders table):
 *   getBook(id)                      -> {id, ownerId, title, printSize, printFiles} | null
 *   findByKey(userId, key)           -> row | null
 *   insertOrder(row)                 -> {order, created}   (idempotent on user_id+idempotency_key)
 *   getOrder(id)                     -> row | null
 *   listByUser(userId)               -> row[]
 *   listAll({status, limit})         -> row[]
 *   transition(id, fromList, patch)  -> row | null   ATOMIC compare-and-set on status
 *   update(id, patch)                -> row | null   (no status change)
 *   addEvent(orderId, type, data)    -> void          (append-only)
 *   hasEvent(orderId, type)          -> boolean
 *   listEvents(orderId)              -> event[]
 *   listAlerts(limit)                -> event[]       (type starts with "alert" or "watch_claim:")
 *   listStuck({paidBefore})          -> row[]
 *   addAgentAudit(entry)             -> void          (Zoey agent audit; table agent_audit)
 *   countAgentAuditSince(actor, iso) -> number        (shared rate limit across serverless instances)
 */
import crypto from 'node:crypto';

const UNIQUE_VIOLATION = '23505';

function uniqueError(constraint) {
  const e = new Error(`duplicate key value violates unique constraint "${constraint}"`);
  e.code = UNIQUE_VIOLATION;
  e.constraint = constraint;
  return e;
}

const ORDER_STATUSES = new Set(['awaiting_payment','paid','submitting','submitted','in_production','shipped','ready_for_pickup','cancelled','failed_needs_attention']);
function selectStuck(rows, paidBefore) {
  if (!Number.isFinite(Date.parse(paidBefore))) throw new Error('paid cutoff unavailable');
  for (const row of rows) {
    if (!row || !row.id || !ORDER_STATUSES.has(row.status)) throw new Error('print order status unavailable');
    if (row.status === 'paid' && (!row.paid_at || !Number.isFinite(Date.parse(row.paid_at)))) throw new Error('paid timestamp unavailable');
  }
  return rows.filter(o => o.status === 'failed_needs_attention' || (o.status === 'paid' && Date.parse(o.paid_at) < Date.parse(paidBefore)));
}

/* ------------------------------------------------------------------ */
/* In-memory fake                                                      */
/* ------------------------------------------------------------------ */
export function createMemoryStore({ books = [], now = () => new Date() } = {}) {
  const bookMap = new Map(books.map((b) => [b.id, b]));
  const orders = new Map();
  const events = [];
  const agentAudit = [];
  let eventSeq = 0;
  const clone = (v) => (v === undefined ? v : structuredClone(v));
  const ts = () => now().toISOString();

  function assertPaymentRefUnique(id, ref) {
    if (!ref) return;
    for (const o of orders.values()) {
      if (o.id !== id && o.payment_ref === ref) throw uniqueError('print_orders_payment_ref_unique');
    }
  }

  return {
    _orders: orders, // test visibility only
    _events: events,
    _agentAudit: agentAudit,
    async getBook(id) {
      return clone(bookMap.get(id)) || null;
    },
    async findByKey(userId, key) {
      for (const o of orders.values()) {
        if (o.user_id === userId && o.idempotency_key === key) return clone(o);
      }
      return null;
    },
    async insertOrder(row) {
      for (const o of orders.values()) {
        if (o.user_id === row.user_id && o.idempotency_key === row.idempotency_key) {
          return { order: clone(o), created: false };
        }
      }
      const t = ts();
      const full = {
        id: crypto.randomUUID(),
        status: 'awaiting_payment',
        currency: 'ILS',
        vendor_submit_attempts: 0,
        payment_provider: null,
        payment_ref: null,
        checkout_url: null,
        paid_at: null,
        vendor_ref: null,
        vendor_last_error: null,
        tracking_url: null,
        created_at: t,
        updated_at: t,
        ...clone(row),
      };
      assertPaymentRefUnique(full.id, full.payment_ref);
      orders.set(full.id, full);
      return { order: clone(full), created: true };
    },
    async getOrder(id) {
      return clone(orders.get(id)) || null;
    },
    async listByUser(userId) {
      return [...orders.values()]
        .filter((o) => o.user_id === userId)
        .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
        .map(clone);
    },
    async listAll({ status, limit = 200 } = {}) {
      return [...orders.values()]
        .filter((o) => !status || o.status === status)
        .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
        .slice(0, limit)
        .map(clone);
    },
    // Synchronous check-and-set inside one tick: atomic, like a single UPDATE ... WHERE status = ANY(...).
    async transition(id, fromList, patch) {
      const o = orders.get(id);
      if (!o || !fromList.includes(o.status)) return null;
      assertPaymentRefUnique(id, patch.payment_ref);
      Object.assign(o, clone(patch), { updated_at: ts() });
      return clone(o);
    },
    async update(id, patch) {
      const o = orders.get(id);
      if (!o) return null;
      assertPaymentRefUnique(id, patch.payment_ref);
      Object.assign(o, clone(patch), { updated_at: ts() });
      return clone(o);
    },
    async addAgentAudit(entry) {
      agentAudit.push({ ...clone(entry), created_at: ts() });
    },
    async countAgentAuditSince(actor, sinceIso) {
      return agentAudit.filter((a) => a.actor === actor && a.created_at >= sinceIso).length;
    },
    async addEvent(orderId, type, data = {}) {
      events.push({ id: ++eventSeq, order_id: orderId, type, data: clone(data), created_at: ts() });
    },
    async tryWatchClaim(orderId, status) {
      const type = `watch_claim:${status}`;
      if (events.some(e => e.order_id === orderId && e.type === type)) return false;
      events.push({ id: ++eventSeq, order_id: orderId, type, data: {}, created_at: ts() });
      return true;
    },
    async hasEvent(orderId, type) {
      return events.some((e) => e.order_id === orderId && e.type === type);
    },
    async listEvents(orderId) {
      return events.filter((e) => e.order_id === orderId).map(clone);
    },
    async listAlerts(limit = 50) {
      return events.filter((e) => (e.type.startsWith('alert') || e.type.startsWith('watch_claim:'))).slice(-limit).reverse().map(clone);
    },
    async listStuck({ paidBefore }) {
      return selectStuck([...orders.values()].map(clone), paidBefore);
    },
  };
}

/* ------------------------------------------------------------------ */
/* Supabase (service role)                                             */
/* ------------------------------------------------------------------ */
export function createSupabaseStore(db) {
  const must = ({ data, error }) => {
    if (error) {
      const e = new Error(error.message || 'db error');
      e.code = error.code;
      throw e;
    }
    return data;
  };
  const stamp = (patch) => ({ ...patch, updated_at: new Date().toISOString() });

  return {
    async getBook(id) {
      const { data, error } = await db.from('books').select('*').eq('id', id).maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) return null;
      return {
        id: String(data.id),
        ownerId: data.created_by,
        title: data.title || '',
        printSize: data.print_size || null,
        // TODO(unverified): the print-file columns do not exist yet; the print pipeline owner decides.
        printFiles:
          data.print_content_url && data.print_cover_url
            ? { contentUrl: data.print_content_url, coverUrl: data.print_cover_url }
            : null,
      };
    },
    async findByKey(userId, key) {
      return must(
        await db.from('print_orders').select('*').eq('user_id', userId).eq('idempotency_key', key).maybeSingle(),
      );
    },
    async insertOrder(row) {
      const res = await db.from('print_orders').insert(row).select('*').single();
      if (res.error) {
        if (res.error.code === UNIQUE_VIOLATION) {
          const existing = await this.findByKey(row.user_id, row.idempotency_key);
          if (existing) return { order: existing, created: false };
        }
        throw new Error(res.error.message);
      }
      return { order: res.data, created: true };
    },
    async getOrder(id) {
      return must(await db.from('print_orders').select('*').eq('id', id).maybeSingle());
    },
    async listByUser(userId) {
      return must(
        await db.from('print_orders').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
      );
    },
    async listAll({ status, limit = 200 } = {}) {
      let q = db.from('print_orders').select('*').order('created_at', { ascending: false }).limit(limit);
      if (status) q = q.eq('status', status);
      return must(await q);
    },
    async transition(id, fromList, patch) {
      const res = await db.from('print_orders').update(stamp(patch)).eq('id', id).in('status', fromList).select('*');
      const rows = must(res);
      return rows && rows.length ? rows[0] : null;
    },
    async update(id, patch) {
      return must(await db.from('print_orders').update(stamp(patch)).eq('id', id).select('*').maybeSingle());
    },
    async addAgentAudit(entry) {
      must(await db.from('agent_audit').insert(entry));
    },
    async countAgentAuditSince(actor, sinceIso) {
      const { count, error } = await db
        .from('agent_audit')
        .select('id', { count: 'exact', head: true })
        .eq('actor', actor)
        .gte('created_at', sinceIso);
      if (error || typeof count !== 'number') throw new Error('agent audit count unavailable');
      return count;
    },
    async addEvent(orderId, type, data = {}) {
      must(await db.from('print_order_events').insert({ order_id: orderId, type, data }));
    },
    async tryWatchClaim(orderId, status) {
      const { error } = await db.from('print_order_events').insert({ order_id: orderId, type: `watch_claim:${status}`, data: {} });
      if (error?.code === '23505') return false;
      if (error) throw new Error('watch claim unavailable');
      return true;
    },
    async hasEvent(orderId, type) {
      const rows = must(
        await db.from('print_order_events').select('id').eq('order_id', orderId).eq('type', type).limit(1),
      );
      return rows.length > 0;
    },
    async listEvents(orderId) {
      return must(await db.from('print_order_events').select('*').eq('order_id', orderId).order('id'));
    },
    async listAlerts(limit = 50) {
      return must(
        await db.from('print_order_events').select('*').or('type.like.alert%,type.like.watch_claim:%').order('id', { ascending: false }).limit(limit),
      );
    },
    async listStuck({ paidBefore }) {
      // One statement gives a coherent snapshot; larger sets are unknown.
      const result = await db.from('print_orders').select('id,status,paid_at', { count: 'exact' }).order('id').range(0, 499);
      const rows = must(result);
      if (!Array.isArray(rows) || !Number.isInteger(result.count) || rows.length !== result.count || new Set(rows.map(row => row.id)).size !== rows.length) throw new Error('print order source incomplete');
      return selectStuck(rows, paidBefore);
    },
  };
}
