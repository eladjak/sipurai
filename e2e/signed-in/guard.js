// Fail closed for the production domain, including subdomains and a trailing dot.
export function targetFor(env = process.env) {
  const raw = env.SMOKE_BASE_URL || 'http://localhost:4173';
  let url;
  try { url = new URL(raw); } catch { throw new Error('Invalid smoke target URL'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error('Invalid smoke target URL');
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  const production = host === 'sipurai.ai' || host.endsWith('.sipurai.ai');
  if (production && env.SMOKE_ALLOW_PRODUCTION_READONLY !== '1') throw new Error('Production target refused; explicit read-only opt-in required');
  return { baseURL: url.origin, local: !env.SMOKE_BASE_URL, production, readOnly: production };
}

export function missingFor(role, env = process.env) {
  if (!env.SMOKE_BASE_URL) return ['local mode has no offline Clerk session double'];
  return [role === 'admin' ? 'SMOKE_ADMIN_EMAIL' : 'SMOKE_PARENT_EMAIL', 'CLERK_SECRET_KEY', 'CLERK_PUBLISHABLE_KEY'].filter((key) => !env[key]);
}

// Permit only the chosen app and its development Clerk instance. App writes are blocked.
export async function isolateBrowser(page, target) {
  await page.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const host = url.hostname.toLowerCase().replace(/\.$/, '');
    const clerkDev = host.endsWith('.clerk.accounts.dev') || host.endsWith('.clerk.dev');
    const sameApp = url.origin === target.baseURL;
    if ((sameApp && ['GET', 'HEAD', 'OPTIONS'].includes(request.method())) || clerkDev || (target.production && host === 'clerk.sipurai.ai')) return route.continue();
    return route.abort();
  });
}
