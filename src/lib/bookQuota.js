/**
 * Client side of the free-book quota. The server is the authority (api/books/reserve);
 * this only asks for a slot, remembers which book the following AI calls belong to,
 * and turns a refusal into something the UI can show.
 */
import { getApiAuthHeaders } from '@/lib/apiAuth';

let activeKey = null;
export const getActiveBookKey = () => activeKey;
export const clearActiveBookKey = () => { activeKey = null; };

export class QuotaError extends Error {
  constructor(info) {
    super(info.message_he);
    this.name = 'QuotaError';
    this.code = info.code;
    this.resetsLabel = info.resetsLabel || null;
    this.resetsOn = info.resetsOn || null;
    this.canUpgrade = !!info.canUpgrade;
  }
}

export function newBookKey() {
  const c = globalThis.crypto;
  return c?.randomUUID ? c.randomUUID() : `k${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}

/** Reserve (or re-confirm) a slot for this book. Throws QuotaError when refused. */
export async function reserveBookSlot(bookKey, fetchImpl = fetch) {
  const headers = { 'Content-Type': 'application/json', ...(await getApiAuthHeaders()) };
  let res;
  try {
    res = await fetchImpl('/api/books/reserve', { method: 'POST', headers, body: JSON.stringify({ bookKey }) });
  } catch {
    return { ok: true, skipped: true }; // checker unreachable: do not stop a family mid-story
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // A broken CHECKER must not block creation (the server-side gate still bounds spend when
    // enforced). A real refusal (monthly_limit, daily_cap) always blocks.
    const code = data?.error?.code;
    if (!code || code === 'quota_unavailable' || code === 'unauthorized') return { ok: true, skipped: true };
    throw new QuotaError(data.error);
  }
  activeKey = bookKey;
  return data;
}
