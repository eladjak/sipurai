/**
 * Browser side of the privacy gate: ask the server whether this parent accepted the current policy,
 * record acceptance, and delete the account. The server decides who the user is (Clerk token);
 * nothing here names a user.
 */
import { getApiAuthHeaders } from '@/lib/apiAuth';
import { CURRENT_POLICY_VERSION, CONSENT_ITEMS } from '../../api/_lib/policyVersion.js';

export { CURRENT_POLICY_VERSION, CONSENT_ITEMS };

export class ConsentApiError extends Error {
  constructor(message, { status = 0, code = '' } = {}) {
    super(message);
    this.name = 'ConsentApiError';
    this.status = status;
    this.code = code;
  }
}

/**
 * The Clerk token getter is registered by AuthProvider in an effect that runs AFTER child effects,
 * so the first call can arrive a tick early. Wait briefly for it instead of failing with 401.
 */
export async function waitForAuthHeaders({ timeoutMs = 4000, stepMs = 50, getHeaders = getApiAuthHeaders } = {}) {
  const until = Date.now() + timeoutMs;
  for (;;) {
    const h = await getHeaders();
    if (h?.Authorization) return h;
    if (Date.now() >= until) return {};
    await new Promise((r) => setTimeout(r, stepMs));
  }
}

async function call(method, url, body, { fetchImpl = globalThis.fetch, getHeaders } = {}) {
  const headers = await waitForAuthHeaders({ getHeaders });
  if (!headers.Authorization) throw new ConsentApiError('not signed in', { status: 401, code: 'unauthorized' });
  let res;
  try {
    res = await fetchImpl(url, {
      method,
      headers: { 'Content-Type': 'application/json', ...headers },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ConsentApiError('network', { code: 'network' });
  }
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* empty or non-JSON body */
  }
  if (!res.ok) {
    const e = data?.error;
    throw new ConsentApiError(e?.message_he || (typeof e === 'string' ? e : '') || `request failed (${res.status})`, {
      status: res.status,
      code: e?.code || data?.code || '',
    });
  }
  return data;
}

/** -> { hasConsent: boolean, returning: boolean, policyVersion } */
export const fetchConsentStatus = (opts) => call('GET', '/api/privacy/consent', null, opts);

/** All three boxes must be ticked; the server checks again. */
export const acceptConsent = ({ locale }, opts) =>
  call(
    'POST',
    '/api/privacy/consent',
    {
      policyVersion: CURRENT_POLICY_VERSION,
      items: Object.fromEntries(CONSENT_ITEMS.map((k) => [k, true])),
      locale,
    },
    opts,
  );

export const deleteMyAccount = (opts) => call('POST', '/api/account/delete', { confirm: 'delete-my-account' }, opts);

/**
 * Pages a signed-in parent may open without having accepted yet: the legal pages themselves (so the
 * gate can link to them), the sign-in screens, and the marketing pages. Everything else is the app.
 */
export function isGateExempt(pathname = '/') {
  const p = pathname.toLowerCase();
  return (
    p === '/privacy' ||
    p === '/terms' ||
    p === '/accessibility' ||
    p === '/contact' ||
    p === '/pricing' ||
    p === '/cancel-subscription' ||
    p === '/welcome' ||
    p.startsWith('/blog') ||
    p.startsWith('/sign-in') ||
    p.startsWith('/sign-up')
  );
}
