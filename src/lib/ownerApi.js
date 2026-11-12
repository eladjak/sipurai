/**
 * Browser side of the parent's own-data controls: stop sharing a book, delete a book, and the
 * subscription (status + cancel). The server decides who the user is from the Clerk token;
 * nothing here names a user.
 */
import { waitForAuthHeaders } from '@/lib/privacyConsent';

export class OwnerApiError extends Error {
  constructor(message, { status = 0, code = '' } = {}) {
    super(message);
    this.name = 'OwnerApiError';
    this.status = status;
    this.code = code;
  }
}

async function call(method, url, body, { fetchImpl = globalThis.fetch, getHeaders } = {}) {
  const headers = await waitForAuthHeaders({ getHeaders });
  if (!headers.Authorization) throw new OwnerApiError('not signed in', { status: 401, code: 'unauthorized' });
  let res;
  try {
    res = await fetchImpl(url, {
      method,
      headers: { 'Content-Type': 'application/json', ...headers },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new OwnerApiError('network', { code: 'network' });
  }
  let data = null;
  try { data = await res.json(); } catch { /* empty body */ }
  if (!res.ok) {
    const e = data?.error;
    throw new OwnerApiError(e?.message_he || `request failed (${res.status})`, { status: res.status, code: e?.code || '' });
  }
  return data;
}

export const unshareBook = (bookId, opts) => call('POST', '/api/books/unshare', { bookId }, opts);
export const deleteBook = (bookId, opts) => call('POST', '/api/books/delete', { bookId }, opts);
export const fetchSubscription = (opts) => call('GET', '/api/subscription/cancel', null, opts);
export const cancelMySubscription = (opts) => call('POST', '/api/subscription/cancel', {}, opts);
