const PRODUCTION_SUPABASE = 'furviizyohryyqubosut.supabase.co';

export function targetFor(env = process.env) {
  const raw = env.SMOKE_BASE_URL || 'http://localhost:4173';
  let url;
  try { url = new URL(raw); } catch { throw new Error('Invalid smoke target URL'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error('Invalid smoke target URL');
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  const production = host !== 'preview.sipurai.ai' && (host === 'sipurai.ai' || host.endsWith('.sipurai.ai'));
  if (production && env.SMOKE_ALLOW_PRODUCTION_READONLY !== '1') throw new Error('Production target refused; explicit read-only opt-in required');
  const supabaseHost = (env.SMOKE_SUPABASE_HOST || '').toLowerCase().replace(/\.$/, '');
  if (supabaseHost && !/^[a-z0-9-]+\.supabase\.co$/.test(supabaseHost)) throw new Error('Invalid Supabase test host');
  if (supabaseHost === PRODUCTION_SUPABASE) throw new Error('Production Supabase project refused');
  return { baseURL: url.origin, local: !env.SMOKE_BASE_URL, production, readOnly: production, supabaseHost };
}

export function missingFor(role, env = process.env) {
  if (!env.SMOKE_BASE_URL) {
    if (role === 'admin') return ['local admin test account is not configured'];
    return ['E2E_CLERK_USER_EMAIL', 'CLERK_SECRET_KEY'].filter((key) => !env[key]);
  }
  return [role === 'admin' ? 'SMOKE_ADMIN_EMAIL' : 'SMOKE_PARENT_EMAIL', 'CLERK_SECRET_KEY', 'CLERK_PUBLISHABLE_KEY', ...(!targetFor(env).production ? ['SMOKE_SUPABASE_HOST'] : [])].filter((key) => !env[key]);
}

// Local data is always synthetic. Unrecognized requests are blocked, including writes.
export async function isolateBrowser(page, target) {
  const book = { id: 'smoke-book', title: 'ספר בדיקה', child_name: 'נועה', status: 'complete', total_pages: 3, language: 'hebrew' };
  const pages = [1, 2, 3].map((n) => ({ id: `smoke-page-${n}`, book_id: book.id, page_number: n, text_content: `עמוד בדיקה ${n}` }));
  await page.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const host = url.hostname.toLowerCase().replace(/\.$/, '');
    const method = request.method();
    const read = ['GET', 'HEAD', 'OPTIONS'].includes(method);
    const sameApp = url.origin === target.baseURL;
    const clerkDev = host.endsWith('.clerk.accounts.dev') || host.endsWith('.clerk.dev');
    if (target.local && sameApp && url.pathname === '/api/privacy/consent' && method === 'GET') return route.fulfill({ json: { hasConsent: true, policyVersion: '2026-11-10' } });
    if (target.local && host.endsWith('.supabase.co') && url.pathname.startsWith('/rest/v1/') && read) {
      const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET, HEAD, OPTIONS' };
      if (method === 'OPTIONS') return route.fulfill({ status: 204, headers });
      const table = url.pathname.split('/').pop();
      const data = table === 'books' ? [book] : table === 'pages' ? pages : [];
      const single = (request.headers().accept || '').includes('application/vnd.pgrst.object+json');
      return route.fulfill({ json: single ? (data[0] || null) : data, headers });
    }
    if (target.local && sameApp && url.pathname.startsWith('/api/')) return route.abort();
    if ((sameApp && read) || clerkDev || (target.production && host === 'clerk.sipurai.ai') || (!target.local && target.supabaseHost && host === target.supabaseHost && url.protocol === 'https:' && read)) return route.continue();
    return route.abort();
  });
}
