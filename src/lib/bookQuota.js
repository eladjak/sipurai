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
  if (c?.randomUUID) return c.randomUUID();
  const bytes = c.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  return [hex.slice(0,8), hex.slice(8,12), hex.slice(12,16), hex.slice(16,20), hex.slice(20)].join('-');
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
